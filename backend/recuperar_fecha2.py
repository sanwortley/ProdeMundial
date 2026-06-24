"""
Recupera las predicciones de Fecha 2 perdidas por el deploy destructivo.

Algoritmo: analiza las predicciones de Fecha 1 de cada usuario para
inferir qué hubiera pronosticado en cada partido de Fecha 2, basándose
en la confianza que le asignó a cada equipo.

Uso:
    python recuperar_fecha2.py              # dry-run (no escribe nada)
    python recuperar_fecha2.py --force       # ejecuta la recuperación
"""

import argparse
import datetime
import logging
import sys
from collections import defaultdict

from app.database import SessionLocal
from app.models import Prediccion, Partido, Grupo, GrupoUsuario
from app.utils import recalcular_puntos_grupo

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

FECHA2_IDS = list(range(25, 49))


def build_team_confidence(db):
    """Analiza Fecha 1 y construye mapa de confianza por usuario y por equipo."""
    fecha1_matches = db.query(Partido).filter(Partido.fase == "Fecha 1").all()
    fecha1_ids = {m.id_partido for m in fecha1_matches}

    preds = (
        db.query(Prediccion)
        .filter(Prediccion.id_partido.in_(fecha1_ids))
        .all()
    )

    # user_id -> {team_name: {"favor": int, "contra": int, "count": int}}
    confianza: dict[int, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"favor": 0, "contra": 0, "count": 0})
    )

    match_map = {m.id_partido: m for m in fecha1_matches}

    for p in preds:
        m = match_map.get(p.id_partido)
        if not m:
            continue
        loc = confianza[p.id_usuario][m.equipo_local]
        loc["favor"] += p.goles_local_predicho
        loc["contra"] += p.goles_visitante_predicho
        loc["count"] += 1

        vis = confianza[p.id_usuario][m.equipo_visitante]
        vis["favor"] += p.goles_visitante_predicho
        vis["contra"] += p.goles_local_predicho
        vis["count"] += 1

    return confianza


def build_user_profile(db):
    """Construye perfil general de cada usuario desde Fecha 1."""
    fecha1_matches = db.query(Partido).filter(Partido.fase == "Fecha 1").all()
    fecha1_ids = {m.id_partido for m in fecha1_matches}

    preds = (
        db.query(Prediccion)
        .filter(Prediccion.id_partido.in_(fecha1_ids))
        .all()
    )

    # user_id -> {total_local, total_visit, total_matches, draws}
    perfiles: dict[int, dict] = defaultdict(
        lambda: {"total_local": 0, "total_visit": 0, "total_matches": 0, "draws": 0}
    )

    for p in preds:
        pr = perfiles[p.id_usuario]
        pr["total_local"] += p.goles_local_predicho
        pr["total_visit"] += p.goles_visitante_predicho
        pr["total_matches"] += 1
        if p.goles_local_predicho == p.goles_visitante_predicho:
            pr["draws"] += 1

    return perfiles


def generar_prediccion(
    equipo_local: str,
    equipo_visitante: str,
    confianza_equipos: dict[str, dict[str, int]],
    perfil: dict,
) -> tuple[int, int]:
    """Genera una predicción inferida para un partido basada en la confianza del usuario."""
    c_local = confianza_equipos.get(equipo_local, {"favor": 0, "contra": 0, "count": 0})
    c_visit = confianza_equipos.get(equipo_visitante, {"favor": 0, "contra": 0, "count": 0})

    def net_confidence(c):
        return (c["favor"] - c["contra"]) / max(c["count"], 1)

    conf_local = net_confidence(c_local)
    conf_visit = net_confidence(c_visit)
    diff = conf_local - conf_visit

    avg_local = round(perfil["total_local"] / max(perfil["total_matches"], 1))
    avg_visit = round(perfil["total_visit"] / max(perfil["total_matches"], 1))
    avg_total = avg_local + avg_visit

    # Umbral para decidir si hay un favorito claro
    THRESHOLD = 0.5

    if diff > THRESHOLD:
        # El usuario confía más en el local
        gd = min(round(abs(diff)), 3)
        p_local = avg_local + gd
        p_visit = max(avg_visit - max(gd - 1, 0), 0)
    elif diff < -THRESHOLD:
        # El usuario confía más en el visitante
        gd = min(round(abs(diff)), 3)
        p_local = max(avg_local - max(gd - 1, 0), 0)
        p_visit = avg_visit + gd
    else:
        # Sin confianza clara → empate con goles promedio
        mitad = round(avg_total / 2)
        p_local = mitad
        p_visit = mitad

    # Asegurar que ningún equipo tenga más de 10 goles (límite realista)
    p_local = min(max(p_local, 0), 10)
    p_visit = min(max(p_visit, 0), 10)

    return p_local, p_visit


def main():
    parser = argparse.ArgumentParser(description="Recuperar predicciones de Fecha 2")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ejecuta la recuperación y escribe en la base de datos",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Solo muestra lo que se haría (por defecto)",
    )
    args = parser.parse_args()

    if args.force:
        args.dry_run = False

    db = SessionLocal()

    try:
        # 1. Obtener partidos de Fecha 2
        fecha2_matches = (
            db.query(Partido)
            .filter(Partido.id_partido.in_(FECHA2_IDS))
            .order_by(Partido.id_partido)
            .all()
        )

        if not fecha2_matches:
            logger.error("No se encontraron partidos de Fecha 2")
            return

        logger.info(f"Partidos de Fecha 2 encontrados: {len(fecha2_matches)}")

        # 2. Construir perfiles de usuario
        logger.info("Analizando predicciones de Fecha 1...")
        confianza = build_team_confidence(db)
        perfiles = build_user_profile(db)

        logger.info(f"Usuarios con predicciones en Fecha 1: {len(perfiles)}")

        # 3. Obtener todos los grupos y sus miembros
        grupos = db.query(Grupo).all()
        logger.info(f"Grupos encontrados: {len(grupos)}")

        # 4. Para cada grupo, para cada usuario, verificar qué predicciones de Fecha 2 faltan
        match_map = {m.id_partido: m for m in fecha2_matches}

        total_generated = 0
        total_skipped = 0
        total_inserted = 0

        stats_por_usuario = defaultdict(
            lambda: {"generadas": 0, "saltadas": 0, "insertadas": 0}
        )

        for grupo in grupos:
            miembros = (
                db.query(GrupoUsuario)
                .filter(GrupoUsuario.id_grupo == grupo.id_grupo)
                .all()
            )

            for miembro in miembros:
                uid = miembro.id_usuario

                existentes = {
                    p.id_partido
                    for p in db.query(Prediccion).filter(
                        Prediccion.id_grupo == grupo.id_grupo,
                        Prediccion.id_usuario == uid,
                        Prediccion.id_partido.in_(FECHA2_IDS),
                    ).all()
                }

                conf_usr = confianza.get(uid, {})
                perfil_usr = perfiles.get(uid, {"total_local": 1, "total_visit": 1, "total_matches": 1})

                for pid in FECHA2_IDS:
                    if pid in existentes:
                        stats_por_usuario[uid]["saltadas"] += 1
                        total_skipped += 1
                        continue

                    match = match_map.get(pid)
                    if not match:
                        continue

                    p_local, p_visit = generar_prediccion(
                        match.equipo_local,
                        match.equipo_visitante,
                        conf_usr,
                        perfil_usr,
                    )

                    stats_por_usuario[uid]["generadas"] += 1
                    total_generated += 1

                    if not args.dry_run:
                        pred = Prediccion(
                            id_usuario=uid,
                            id_grupo=grupo.id_grupo,
                            id_partido=pid,
                            goles_local_predicho=p_local,
                            goles_visitante_predicho=p_visit,
                            puntos_obtenidos=0,
                            usa_joker=False,
                            usa_doble=False,
                            fecha_carga=datetime.datetime.utcnow(),
                        )
                        db.add(pred)
                        stats_por_usuario[uid]["insertadas"] += 1
                        total_inserted += 1

        if not args.dry_run:
            db.commit()
            logger.info(f"Predicciones insertadas: {total_inserted}")

            logger.info("Recalculando puntos de todos los grupos...")
            for grupo in grupos:
                recalcular_puntos_grupo(db, grupo.id_grupo)
            logger.info("Puntos recalculados exitosamente.")
        else:
            logger.info("--- MODO DRY-RUN (no se escribió nada) ---")

        print()
        print("=" * 60)
        print("RESUMEN DE RECUPERACIÓN")
        print("=" * 60)
        print(f"  Partidos Fecha 2:          {len(fecha2_matches)}")
        print(f"  Grupos:                    {len(grupos)}")
        print(f"  Usuarios con perfil:       {len(perfiles)}")
        print(f"  Predicciones ya existentes: {total_skipped}")
        print(f"  Predicciones a generar:    {total_generated}")
        if args.dry_run:
            print(f"  *** MODO DRY-RUN: no se insertó nada ***")
        else:
            print(f"  Predicciones insertadas:   {total_inserted}")
        print()

        if total_generated > 0:
            sorted_users = sorted(
                stats_por_usuario.items(),
                key=lambda x: x[1]["generadas"],
                reverse=True,
            )[:10]

            print("Top usuarios con más predicciones generadas:")
            print(f"  {'ID':>5} {'Generadas':>10} {'Saltadas':>10} {'Insertadas':>10}")
            for uid, s in sorted_users:
                print(f"  {uid:>5} {s['generadas']:>10} {s['saltadas']:>10} {s['insertadas']:>10}")
            print()

    except Exception as e:
        logger.error(f"Error durante la recuperación: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
