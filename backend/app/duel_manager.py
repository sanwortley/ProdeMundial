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
disconnect_timers: dict[int, asyncio.Task] = {}

ROUND_TIMEOUT = 10
ANIMATION_DURATION = 10
DISCONNECT_WAIT = 60


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

    # Cancel pending disconnect timer (reconnect)
    if duelo_id in disconnect_timers:
        disconnect_timers[duelo_id].cancel()
        del disconnect_timers[duelo_id]

    if duelo_id not in active_duels:
        active_duels[duelo_id] = {}
        message_queues[duelo_id] = {}
    if duelo_id not in message_queues:
        message_queues[duelo_id] = {}
    active_duels[duelo_id][user_id] = websocket
    message_queues[duelo_id][user_id] = asyncio.Queue()

    # Notify the other player about reconnect
    for uid, ws in active_duels.get(duelo_id, {}).items():
        if uid != user_id:
            try:
                await ws.send_json({"type": "rival_reconnected"})
            except Exception:
                pass

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
        if duelo and duelo.estado != "pending" and duelo_id in game_states:
            state = game_states[duelo_id]
            if "match_start" in state:
                await websocket.send_json(state["match_start"])
            if "animation_phase" in state:
                await websocket.send_json(state["animation_phase"])
            if "penalty_phase" in state:
                await websocket.send_json(state["penalty_phase"])
            if "ronda_actual" in state:
                await websocket.send_json({"type": "ronda_info", "ronda": state["ronda_actual"]})
            if duelo.estado == "finished" and "match_end" in state:
                await websocket.send_json(state["match_end"])
            if duelo.estado == "cancelled" and "match_cancelled" in state:
                await websocket.send_json(state["match_cancelled"])
    finally:
        db.close()

    # Listen for messages and put them in the queue for _run_game to consume
    disconnect_reason = "disconnected"
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=60)
                if data.get("type") in ("shoot", "defend"):
                    q = message_queues.get(duelo_id, {}).get(user_id)
                    if q:
                        await q.put(data)
                elif data.get("type") == "leave":
                    disconnect_reason = "left"
                    for uid, ws in list(active_duels.get(duelo_id, {}).items()):
                        if uid != user_id:
                            try:
                                await ws.send_json({"type": "rival_left"})
                            except Exception:
                                pass
                    break
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        # Remove this user's WebSocket from broadcasts
        if duelo_id in active_duels:
            active_duels[duelo_id].pop(user_id, None)
        # Remove queue so recv_choice returns None immediately for this user
        if duelo_id in message_queues:
            message_queues[duelo_id].pop(user_id, None)

        db_check = SessionLocal()
        try:
            d = db_check.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
            if not d or d.estado != "playing":
                # Game already ended or not started — nothing to do
                pass
            elif disconnect_reason == "left":
                # User explicitly clicked Salir → forfeit, other player wins
                other_id = d.id_rival if user_id == d.id_retador else d.id_retador
                d.estado = "finished"
                d.ganador_id = other_id
                db_check.commit()
                # Cancel any pending disconnect timer
                if duelo_id in disconnect_timers:
                    disconnect_timers[duelo_id].cancel()
                    del disconnect_timers[duelo_id]
                if duelo_id in game_tasks:
                    game_tasks[duelo_id].cancel()
                    del game_tasks[duelo_id]
                # Notify the other player
                other_ws = active_duels.get(duelo_id, {}).get(other_id)
                this_user = db_check.query(Usuario).filter(Usuario.id_usuario == user_id).first()
                other_user = db_check.query(Usuario).filter(Usuario.id_usuario == other_id).first()
                if other_ws:
                    try:
                        await other_ws.send_json({
                            "type": "match_end",
                            "ganador_id": d.ganador_id,
                            "goles_retador": d.goles_retador,
                            "goles_rival": d.goles_rival,
                            "retador_nombre": other_user.nombre if other_user else "?",
                            "rival_nombre": this_user.nombre if this_user else "?",
                            "total_rondas": d.ronda_actual or 0,
                            "walkover": True,
                            "reason": "rival_left",
                        })
                    except Exception:
                        pass
                if duelo_id in game_states:
                    del game_states[duelo_id]
            else:
                # Disconnected during playing → start a reconnect timer
                other_id = d.id_rival if user_id == d.id_retador else d.id_retador
                other_ws = active_duels.get(duelo_id, {}).get(other_id)
                if other_ws:
                    try:
                        await other_ws.send_json({
                            "type": "rival_disconnected",
                            "timeout": DISCONNECT_WAIT,
                        })
                    except Exception:
                        pass
                # Cancel the game loop so rounds stop processing
                if duelo_id in game_tasks:
                    game_tasks[duelo_id].cancel()
                    del game_tasks[duelo_id]

                # Timer: wait for reconnect, then walkover
                async def _timeout_walkover():
                    await asyncio.sleep(DISCONNECT_WAIT)
                    if duelo_id not in disconnect_timers:
                        return  # cancelled
                    db_timer = SessionLocal()
                    try:
                        dd = db_timer.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
                        if dd and dd.estado == "playing":
                            dd.estado = "finished"
                            dd.ganador_id = other_id
                            db_timer.commit()
                        ws = active_duels.get(duelo_id, {}).get(other_id)
                        ou = db_timer.query(Usuario).filter(Usuario.id_usuario == other_id).first()
                        tu = db_timer.query(Usuario).filter(Usuario.id_usuario == user_id).first()
                        if ws:
                            try:
                                await ws.send_json({
                                    "type": "match_end",
                                    "ganador_id": dd.ganador_id if dd else None,
                                    "goles_retador": dd.goles_retador if dd else 0,
                                    "goles_rival": dd.goles_rival if dd else 0,
                                    "retador_nombre": ou.nombre if ou else "?",
                                    "rival_nombre": tu.nombre if tu else "?",
                                    "total_rondas": dd.ronda_actual or 0,
                                    "walkover": True,
                                    "reason": "rival_disconnected",
                                })
                            except Exception:
                                pass
                    finally:
                        db_timer.close()
                    if duelo_id in game_states:
                        del game_states[duelo_id]
                    if duelo_id in disconnect_timers:
                        del disconnect_timers[duelo_id]

                timer_task = asyncio.create_task(_timeout_walkover())
                disconnect_timers[duelo_id] = timer_task
        except Exception:
            pass
        finally:
            db_check.close()

        has_active = duelo_id in active_duels and len(active_duels[duelo_id]) > 0
        has_queues = duelo_id in message_queues and len(message_queues[duelo_id]) > 0

        if not has_active and not has_queues:
            # No users left — clean up state
            if duelo_id in active_duels:
                del active_duels[duelo_id]
            if duelo_id in message_queues:
                del message_queues[duelo_id]
            if duelo_id in disconnect_timers:
                disconnect_timers[duelo_id].cancel()
                del disconnect_timers[duelo_id]
            if duelo_id in game_tasks:
                game_tasks[duelo_id].cancel()
                del game_tasks[duelo_id]
            if duelo_id in game_states:
                del game_states[duelo_id]
            db_clean = SessionLocal()
            try:
                d = db_clean.query(Duelo).filter(Duelo.id_duelo == duelo_id).first()
                if d and d.estado == "playing":
                    d.estado = "cancelled"
                    db_clean.commit()
            finally:
                db_clean.close()


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

            # Drain stale messages from previous round
            for uid in (duelo.id_retador, duelo.id_rival):
                q = message_queues.get(duelo_id, {}).get(uid)
                if q:
                    while not q.empty():
                        try:
                            q.get_nowait()
                        except asyncio.QueueEmpty:
                            break

            # Randomize shot type and goalie starting position
            tipo_disparo = random.choice(['penalty', 'penalty', 'costado_izq', 'costado_der', 'fuera_area'])
            pos_ini_arquero = random.choice(['centro', 'centro', 'izquierda', 'derecha'])

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
                "tipo_disparo": tipo_disparo,
                "pos_ini_arquero": pos_ini_arquero,
            }
            game_states[duelo_id]["penalty_phase"] = penalty_msg
            await broadcast(duelo_id, penalty_msg)

            pos_atacante = None
            pos_arquero = None
            fuerza = 50

            async def recv_choice(uid: int, expected_type: str) -> dict | None:
                q = message_queues.get(duelo_id, {}).get(uid)
                if not q:
                    return None
                try:
                    data = await asyncio.wait_for(q.get(), timeout=ROUND_TIMEOUT)
                    if data.get("type") == expected_type:
                        return data
                except asyncio.TimeoutError:
                    pass
                return None

            try:
                atk_data, def_data = await asyncio.gather(
                    recv_choice(atacante_id, "shoot"),
                    recv_choice(arquero_id, "defend"),
                )
                pos_atacante = atk_data.get("posicion") if atk_data else None
                fuerza = atk_data.get("fuerza", 50) if atk_data else 50
                pos_arquero = def_data.get("posicion") if def_data else None
            except asyncio.CancelledError:
                return

            es_gol = _calcular_resultado(pos_atacante, pos_arquero, fuerza, tipo_disparo, pos_ini_arquero)

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
                fuerza=fuerza,
            )
            db.add(ronda)
            db.commit()

            await broadcast(duelo_id, {
                "type": "result",
                "ronda": ronda_num,
                "es_gol": es_gol,
                "posicion_atacante": pos_atacante,
                "posicion_arquero": pos_arquero,
                "fuerza": fuerza,
                "goles_retador": duelo.goles_retador,
                "goles_rival": duelo.goles_rival,
                "pateador_nombre": pateador["nombre"] if pateador else "?",
                "arquero_nombre": gk_info["nombre"] if gk_info else "?",
                "tipo_disparo": tipo_disparo,
                "pos_ini_arquero": pos_ini_arquero,
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
    except Exception as e:
        logger.error(f"Error en _run_game duelo {duelo_id}: {e}", exc_info=True)
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
    fuerza: int,
    tipo_disparo: str = 'penalty',
    pos_ini_arquero: str = 'centro'
) -> bool:
    FUERZA_MAX = 95  # above this → miss (too overpowered)
    if pos_atk is None or pos_atk == 0 or fuerza > FUERZA_MAX:
        return False
    if pos_atk >= 6:
        return False
    if pos_def is None or pos_def == 0:
        return True

    left_zones = {1, 4}
    right_zones = {2, 5}

    def get_side(zone_id):
        if zone_id in left_zones: return 'izquierda'
        if zone_id in right_zones: return 'derecha'
        return 'centro'

    atk_side = get_side(pos_atk)
    def_side = get_side(pos_def)

    # Force factor: 1 at fuerza=0 (very weak), 0 at fuerza=FUERZA_MAX (very strong)
    # Higher = goalkeeper has more time to react = more likely to save
    ff = max(0.0, (FUERZA_MAX - fuerza) / FUERZA_MAX)

    # 1. Same zone: goalkeeper guessed correctly
    if pos_atk == pos_def:
        if pos_ini_arquero == 'derecha' and def_side == 'izquierda':
            save_chance = 0.25 + ff * 0.50
        elif pos_ini_arquero == 'izquierda' and def_side == 'derecha':
            save_chance = 0.25 + ff * 0.50
        else:
            save_chance = 0.55 + ff * 0.40
        # save_chance ranges from 0.55–0.95 (normal) or 0.25–0.75 (opposite side)
        return random.random() >= save_chance

    # 2. Different zones: goalkeeper guessed wrong, but fuerza gives a chance to recover
    if tipo_disparo == 'fuera_area':
        save_chance = 0.20 + ff * 0.40  # 0.20–0.60
    elif tipo_disparo in ('costado_izq', 'costado_der'):
        save_chance = 0.12 + ff * 0.30  # 0.12–0.42
    else:  # penalty
        save_chance = 0.08 + ff * 0.20  # 0.08–0.28

    return random.random() >= save_chance


async def broadcast(duelo_id: int, message: dict):
    if duelo_id not in active_duels:
        return
    for uid, ws in list(active_duels[duelo_id].items()):
        try:
            await ws.send_json(message)
        except Exception:
            pass
