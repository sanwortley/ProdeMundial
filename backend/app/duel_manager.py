import random
import asyncio
import logging
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import Duelo, RondaDuelo, Jugador, JugadorEquipoFecha, EquipoFecha, Usuario
from .auth import SECRET_KEY, ALGORITHM
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

active_duels: dict[int, dict[int, WebSocket]] = {}
game_tasks: dict[int, asyncio.Task] = {}
message_queues: dict[int, dict[int, asyncio.Queue]] = {}
game_states: dict[int, dict] = {}

ROUND_TIMEOUT = 10
ANIMATION_DURATION = 10
DISCONNECT_TIMEOUT = 30


def _get_user_from_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("id_usuario")
    except JWTError:
        return None


async def handle_duel_ws(websocket: WebSocket, duelo_id: int, token: str):
    user_id = _get_user_from_token(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Invalid token")
        return

    db = SessionLocal()
    try:
        duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
        if not duelo:
            await websocket.close(code=4004, reason="Duelo not found")
            return
        if user_id not in (duelo.id_retador, duelo.id_rival):
            await websocket.close(code=4003, reason="Not a participant")
            return
    finally:
        db.close()

    await websocket.accept()

    if duelo_id not in active_duels:
        active_duels[duelo_id] = {}
        message_queues[duelo_id] = {}
    active_duels[duelo_id][user_id] = websocket
    message_queues[duelo_id][user_id] = asyncio.Queue()

    # If both players connected, start game
    db = SessionLocal()
    try:
        duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
        if duelo and duelo.estado in ("pending", "playing"):
            other_id = duelo.id_rival if user_id == duelo.id_retador else duelo.id_retador
            if other_id in active_duels.get(duelo_id, {}):
                if duelo.estado == "pending":
                    duelo.estado = "playing"
                    db.commit()
                if duelo_id not in game_tasks:
                    task = asyncio.create_task(_run_game(duelo_id))
                    game_tasks[duelo_id] = task
        if duelo and duelo.estado == "playing" and duelo_id in game_states:
            # Reconnect: send current game state
            state = game_states[duelo_id]
            if "match_start" in state:
                await websocket.send_json(state["match_start"])
            if "animation_phase" in state:
                await websocket.send_json(state["animation_phase"])
            if "penalty_phase" in state:
                await websocket.send_json(state["penalty_phase"])
            if "ronda_actual" in state:
                await websocket.send_json({"type": "ronda_info", "ronda": state["ronda_actual"]})
    finally:
        db.close()

    # Listen for messages and put them in the queue for _run_game to consume
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=60)
                if data.get("type") in ("shoot", "defend"):
                    q = message_queues.get(duelo_id, {}).get(user_id)
                    if q:
                        await q.put(data)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if duelo_id in active_duels:
            active_duels[duelo_id].pop(user_id, None)
        if duelo_id in message_queues:
            message_queues[duelo_id].pop(user_id, None)
        if duelo_id in active_duels and not active_duels[duelo_id]:
            del active_duels[duelo_id]
        if duelo_id in message_queues and not message_queues[duelo_id]:
            del message_queues[duelo_id]

        if duelo_id not in active_duels or len(active_duels.get(duelo_id, {})) == 0:
            if duelo_id in game_tasks:
                game_tasks[duelo_id].cancel()
                del game_tasks[duelo_id]
            db = SessionLocal()
            try:
                d = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
                if d and d.estado == "playing":
                    d.estado = "cancelled"
                    db.commit()
            finally:
                db.close()


async def _run_game(duelo_id: int):
    db = SessionLocal()
    game_states[duelo_id] = {}
    try:
        duelo = db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
        if not duelo or duelo.estado != "playing":
            return

        retador = db.query(Usuario).filter(Usuario.id_usuario == duelo.id_retador).first()
        rival = db.query(Usuario).filter(Usuario.id_usuario == duelo.id_rival).first()
        retador_nombre = retador.nombre if retador else "?"
        rival_nombre = rival.nombre if rival else "?"

        gk_retador = _get_team_goalkeeper(db, duelo, duelo.id_retador)
        gk_rival = _get_team_goalkeeper(db, duelo, duelo.id_rival)

        match_start_msg = {
            "type": "match_start",
            "duelo_id": duelo_id,
            "retador": retador_nombre,
            "rival": rival_nombre,
            "retador_id": duelo.id_retador,
            "rival_id": duelo.id_rival,
            "total_rondas": 10,
        }
        game_states[duelo_id]["match_start"] = match_start_msg
        await broadcast(duelo_id, match_start_msg)

        for ronda_num in range(1, 11):
            duelo = _refresh_duelo(db, duelo_id)
            if not duelo or duelo.estado != "playing":
                break

            duelo.ronda_actual = ronda_num
            atacante_id = _pick_random_attacker(duelo, ronda_num)
            duelo.turno_atacante_id = atacante_id
            db.commit()

            arquero_id = duelo.id_rival if atacante_id == duelo.id_retador else duelo.id_retador
            gk_info = gk_rival if atacante_id == duelo.id_retador else gk_retador

            pateador = _get_random_shooter(db, duelo, atacante_id)

            retador_jugs = _get_team_player_names(db, duelo, duelo.id_retador)
            rival_jugs = _get_team_player_names(db, duelo, duelo.id_rival)

            anim_msg = {
                "type": "animation_phase",
                "ronda": ronda_num,
                "duracion": ANIMATION_DURATION,
                "pateador_nombre": pateador["nombre"] if pateador else "?",
                "pateador_posicion": pateador["posicion"] if pateador else "?",
                "arquero_nombre": gk_info["nombre"] if gk_info else "Arquero",
                "retador_jugadores": retador_jugs,
                "rival_jugadores": rival_jugs,
            }
            game_states[duelo_id]["animation_phase"] = anim_msg
            game_states[duelo_id]["ronda_actual"] = ronda_num
            if "penalty_phase" in game_states[duelo_id]:
                del game_states[duelo_id]["penalty_phase"]
            await broadcast(duelo_id, anim_msg)

            try:
                await asyncio.sleep(ANIMATION_DURATION)
            except asyncio.CancelledError:
                return

            penalty_msg = {
                "type": "penalty_phase",
                "ronda": ronda_num,
                "atacante_id": atacante_id,
                "atacante_nombre": retador_nombre if atacante_id == duelo.id_retador else rival_nombre,
                "arquero_id": arquero_id,
                "pateador_nombre": pateador["nombre"] if pateador else "?",
                "pateador_posicion": pateador["posicion"] if pateador else "?",
                "pateador_valor": pateador["valor_inicial"] if pateador else 0,
                "arquero_nombre": gk_info["nombre"] if gk_info else "Arquero",
                "arquero_valor": gk_info["valor_inicial"] if gk_info else 0,
                "timeout": ROUND_TIMEOUT,
            }
            game_states[duelo_id]["penalty_phase"] = penalty_msg
            await broadcast(duelo_id, penalty_msg)

            pos_atacante = None
            pos_arquero = None

            async def recv_choice(uid: int, expected_type: str) -> int | None:
                q = message_queues.get(duelo_id, {}).get(uid)
                if not q:
                    return None
                try:
                    data = await asyncio.wait_for(q.get(), timeout=ROUND_TIMEOUT)
                    if data.get("type") == expected_type:
                        return data.get("posicion")
                except asyncio.TimeoutError:
                    pass
                return None

            try:
                results = await asyncio.gather(
                    recv_choice(atacante_id, "shoot"),
                    recv_choice(arquero_id, "defend"),
                )
                pos_atacante, pos_arquero = results
            except asyncio.CancelledError:
                return

            bonus_arquero = _prob_arquero_bonus(gk_info["valor_inicial"]) if gk_info else 0
            es_gol = _calcular_resultado(
                pos_atacante, pos_arquero,
                pateador["valor_inicial"] if pateador else 0,
                pateador["posicion"] if pateador else "DEF",
                bonus_arquero,
            )

            if es_gol:
                if atacante_id == duelo.id_retador:
                    duelo.goles_retador += 1
                else:
                    duelo.goles_rival += 1

            ronda = RondaDuelo(
                id_duelo=duelo.id_duelo,
                numero=ronda_num,
                atacante_id=atacante_id,
                posicion_atacante=pos_atacante,
                posicion_arquero=pos_arquero,
                es_gol=es_gol,
                pateador_nombre=pateador["nombre"] if pateador else "?",
                arquero_nombre=gk_info["nombre"] if gk_info else "?",
            )
            db.add(ronda)
            db.commit()

            await broadcast(duelo_id, {
                "type": "result",
                "ronda": ronda_num,
                "es_gol": es_gol,
                "posicion_atacante": pos_atacante,
                "posicion_arquero": pos_arquero,
                "goles_retador": duelo.goles_retador,
                "goles_rival": duelo.goles_rival,
                "pateador_nombre": pateador["nombre"] if pateador else "?",
                "arquero_nombre": gk_info["nombre"] if gk_info else "?",
            })

            try:
                await asyncio.sleep(2)
            except asyncio.CancelledError:
                return

        duelo = _refresh_duelo(db, duelo_id)
        if duelo and duelo.estado == "playing":
            duelo.estado = "finished"
            if duelo.goles_retador > duelo.goles_rival:
                duelo.ganador_id = duelo.id_retador
            elif duelo.goles_rival > duelo.goles_retador:
                duelo.ganador_id = duelo.id_rival
            db.commit()

        await broadcast(duelo_id, {
            "type": "match_end",
            "ganador_id": duelo.ganador_id if duelo else None,
            "goles_retador": duelo.goles_retador if duelo else 0,
            "goles_rival": duelo.goles_rival if duelo else 0,
            "retador_nombre": retador_nombre,
            "rival_nombre": rival_nombre,
            "total_rondas": 10,
        })
    finally:
        db.close()
        if duelo_id in game_tasks:
            del game_tasks[duelo_id]
        if duelo_id in game_states:
            del game_states[duelo_id]


def _refresh_duelo(db: Session, duelo_id: int) -> Duelo | None:
    return db.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()


def _pick_random_attacker(duelo: Duelo, ronda_num: int) -> int:
    if ronda_num == 1:
        return random.choice([duelo.id_retador, duelo.id_rival])
    return duelo.id_rival if duelo.turno_atacante_id == duelo.id_retador else duelo.id_retador


def _get_team_player_names(db: Session, duelo: Duelo, user_id: int) -> list[dict]:
    ef = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == user_id,
        EquipoFecha.id_grupo == duelo.id_grupo,
    ).first()
    if not ef:
        return []
    picks = db.query(JugadorEquipoFecha).filter(
        JugadorEquipoFecha.id_equipo == ef.id_equipo
    ).all()
    players = []
    for p in picks:
        j = db.query(Jugador).filter(Jugador.id_jugador == p.id_jugador).first()
        if j and j.posicion != "GK":
            players.append(j)
    # Sort by position to match canvas indices: DEF (0-3), MID (4-6), FWD (7-9)
    players.sort(key=lambda j: {"DEF": 0, "MID": 1, "FWD": 2}.get(j.posicion, 3))
    return [
        {
            "nombre": j.nombre,
            "posicion": j.posicion,
            "posicion_especifica": j.posicion_especifica or j.posicion,
        }
        for j in players
    ]


def _get_team_goalkeeper(db: Session, duelo: Duelo, user_id: int) -> dict | None:
    ef = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == user_id,
        EquipoFecha.id_grupo == duelo.id_grupo,
    ).first()
    if not ef:
        return None
    pick = db.query(JugadorEquipoFecha).join(Jugador).filter(
        JugadorEquipoFecha.id_equipo == ef.id_equipo,
        Jugador.posicion == "GK",
    ).first()
    if not pick:
        return None
    j = pick.jugador
    return {
        "id_jugador": j.id_jugador,
        "nombre": j.nombre,
        "posicion": "GK",
        "posicion_especifica": j.posicion_especifica or "GK",
        "valor_inicial": j.valor_inicial,
    }


def _get_random_shooter(db: Session, duelo: Duelo, atacante_id: int) -> dict | None:
    ef = db.query(EquipoFecha).filter(
        EquipoFecha.id_usuario == atacante_id,
        EquipoFecha.id_grupo == duelo.id_grupo,
    ).first()
    if not ef:
        return None

    picks = db.query(JugadorEquipoFecha).filter(
        JugadorEquipoFecha.id_equipo == ef.id_equipo
    ).all()

    jugadores = []
    for p in picks:
        j = db.query(Jugador).filter(Jugador.id_jugador == p.id_jugador).first()
        if j and j.posicion != "GK":
            weight = {"FWD": 3, "MID": 2, "DEF": 1}.get(j.posicion, 1)
            jugadores.extend([j] * weight)

    if not jugadores:
        return None

    chosen = random.choice(jugadores)
    return {
        "id_jugador": chosen.id_jugador,
        "nombre": chosen.nombre,
        "posicion": chosen.posicion,
        "valor_inicial": chosen.valor_inicial,
    }


def _calcular_resultado(
    pos_atk: int | None,
    pos_def: int | None,
    valor_pateador: int,
    posicion_pateador: str,
    bonus_arquero: int,
) -> bool:
    if pos_atk is None:
        return False
    if pos_def is None:
        return True
    if pos_atk == pos_def:
        return False

    prob_base = _prob_por_valor(valor_pateador)
    bonus_pos = {"FWD": 5, "MID": 0, "DEF": -10}.get(posicion_pateador, 0)

    prob = prob_base + bonus_pos - bonus_arquero
    prob = max(10, min(95, prob))
    return random.random() < (prob / 100)


def _prob_por_valor(valor: int) -> int:
    if valor > 42:
        return 85
    if valor > 27:
        return 70
    if valor > 14:
        return 55
    return 40


def _prob_arquero_bonus(valor: int) -> int:
    if valor > 42:
        return 15
    if valor > 27:
        return 10
    if valor > 14:
        return 5
    return 0


async def broadcast(duelo_id: int, message: dict):
    if duelo_id not in active_duels:
        return
    for uid, ws in list(active_duels[duelo_id].items()):
        try:
            await ws.send_json(message)
        except Exception:
            pass
