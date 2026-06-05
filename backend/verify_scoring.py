import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Usuario, Grupo, GrupoUsuario, Partido, Prediccion, PrediccionCampeon
from app.utils import recalcular_puntos_grupo

def test_scoring_system():
    print("--- INICIANDO VERIFICACIÓN DE REGLAS DE PUNTOS ---")
    
    # 1. Configurar base de datos en memoria para pruebas
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)
    session = Session()
    Base.metadata.create_all(bind=engine)
    
    # 2. Crear Usuarios de Prueba
    user_a = Usuario(nombre="Usuario A", email="usera@test.com", password_hash="hash")
    user_b = Usuario(nombre="Usuario B", email="userb@test.com", password_hash="hash")
    session.add_all([user_a, user_b])
    session.commit()
    
    # 3. Crear Grupo de Prueba
    group = Grupo(nombre_grupo="Grupo Amigos", codigo_invitacion="TEST-1234", creado_por=user_a.id_usuario)
    session.add(group)
    session.commit()
    
    # Unir a ambos usuarios al grupo
    member_a = GrupoUsuario(id_grupo=group.id_grupo, id_usuario=user_a.id_usuario, rol="admin")
    member_b = GrupoUsuario(id_grupo=group.id_grupo, id_usuario=user_b.id_usuario, rol="member")
    session.add_all([member_a, member_b])
    session.commit()
    
    # 4. Crear 6 Partidos de Prueba (con fechas incrementales para calcular racha correctamente)
    now = datetime.datetime.utcnow()
    matches = [
        Partido(fecha=now + datetime.timedelta(hours=1), fase="Fase de Grupos", equipo_local="Argentina", equipo_visitante="Arabia Saudita"),
        Partido(fecha=now + datetime.timedelta(hours=2), fase="Fase de Grupos", equipo_local="Argentina", equipo_visitante="México"),
        Partido(fecha=now + datetime.timedelta(hours=3), fase="Fase de Grupos", equipo_local="Argentina", equipo_visitante="Polonia"),
        Partido(fecha=now + datetime.timedelta(hours=4), fase="Fase de Grupos", equipo_local="Francia", equipo_visitante="Polonia"),
        Partido(fecha=now + datetime.timedelta(hours=5), fase="Fase de Grupos", equipo_local="Inglaterra", equipo_visitante="Irán"),
        Partido(fecha=now + datetime.timedelta(hours=6), fase="Final", equipo_local="Argentina", equipo_visitante="Francia")
    ]
    session.add_all(matches)
    session.commit()
    
    # 5. Crear predicciones del Usuario A
    # Match 1: local: 2, vis: 1 (Usa Doble)
    # Match 2: local: 2, vis: 0 (Usa Joker)
    # Match 3: local: 2, vis: 0
    # Match 4: local: 3, vis: 1
    # Match 5: local: 2, vis: 0
    # Match 6: local: 1, vis: 1
    preds_a = [
        Prediccion(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, id_partido=matches[0].id_partido, goles_local_predicho=2, goles_visitante_predicho=1, usa_doble=True),
        Prediccion(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, id_partido=matches[1].id_partido, goles_local_predicho=2, goles_visitante_predicho=0, usa_joker=True),
        Prediccion(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, id_partido=matches[2].id_partido, goles_local_predicho=2, goles_visitante_predicho=0),
        Prediccion(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, id_partido=matches[3].id_partido, goles_local_predicho=3, goles_visitante_predicho=1),
        Prediccion(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, id_partido=matches[4].id_partido, goles_local_predicho=2, goles_visitante_predicho=0),
        Prediccion(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, id_partido=matches[5].id_partido, goles_local_predicho=1, goles_visitante_predicho=1)
    ]
    
    # 6. Crear predicciones del Usuario B
    # Match 1: local: 1, vis: 2
    # Match 2: local: 1, vis: 0
    # Match 3: local: 2, vis: 0 (Usa Joker)
    # Match 4: local: 3, vis: 1
    # Match 5: local: 2, vis: 0
    # Match 6: local: 1, vis: 1
    preds_b = [
        Prediccion(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, id_partido=matches[0].id_partido, goles_local_predicho=1, goles_visitante_predicho=2),
        Prediccion(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, id_partido=matches[1].id_partido, goles_local_predicho=1, goles_visitante_predicho=0),
        Prediccion(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, id_partido=matches[2].id_partido, goles_local_predicho=2, goles_visitante_predicho=0, usa_joker=True),
        Prediccion(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, id_partido=matches[3].id_partido, goles_local_predicho=3, goles_visitante_predicho=1),
        Prediccion(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, id_partido=matches[4].id_partido, goles_local_predicho=2, goles_visitante_predicho=0),
        Prediccion(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, id_partido=matches[5].id_partido, goles_local_predicho=1, goles_visitante_predicho=1)
    ]
    session.add_all(preds_a + preds_b)
    session.commit()
    
    # Predicciones de Campeón
    camp_a = PrediccionCampeon(id_usuario=user_a.id_usuario, id_grupo=group.id_grupo, equipo_campeon="Argentina", puntos_obtenidos=50) # Acierta!
    camp_b = PrediccionCampeon(id_usuario=user_b.id_usuario, id_grupo=group.id_grupo, equipo_campeon="Argentina", puntos_obtenidos=50) # Acierta!
    session.add_all([camp_a, camp_b])
    session.commit()
    
    # 7. Finalizar partidos con resultados reales
    # Match 1: 1 - 2 (Arabia Saudita gana)
    #   User A: predijo 2-1 con Doble. Incorrecto -> 0 puntos.
    #   User B: predijo 1-2. Exacto -> 10 puntos.
    matches[0].goles_local = 1
    matches[0].goles_visitante = 2
    matches[0].finalizado = True
    
    # Match 2: 2 - 0 (Argentina gana)
    #   User A: predijo 2-0 con Joker. Exacto -> 30 puntos.
    #   User B: predijo 1-0. Outcome -> 5 puntos.
    matches[1].goles_local = 2
    matches[1].goles_visitante = 0
    matches[1].finalizado = True
    
    # Match 3: 2 - 0 (Argentina gana)
    #   User A: predijo 2-0. Exacto -> 10 puntos.
    #   User B: predijo 2-0 con Joker. Exacto -> 30 puntos.
    matches[2].goles_local = 2
    matches[2].goles_visitante = 0
    matches[2].finalizado = True
    
    # Match 4: 3 - 1 (Francia gana)
    #   User A: predijo 3-1. Exacto -> 10 puntos.
    #   User B: predijo 3-1. Exacto -> 10 puntos.
    matches[3].goles_local = 3
    matches[3].goles_visitante = 1
    matches[3].finalizado = True
    
    # Match 5: 6 - 2 (Inglaterra gana)
    #   User A: predijo 2-0. Outcome -> 5 puntos.
    #   User B: predijo 2-0. Outcome -> 5 puntos.
    matches[4].goles_local = 6
    matches[4].goles_visitante = 2
    matches[4].finalizado = True
    
    # Match 6: 3 - 3 (Empate)
    #   User A: predijo 1-1. Outcome -> 5 puntos.
    #   User B: predijo 1-1. Outcome -> 5 puntos.
    matches[5].goles_local = 3
    matches[5].goles_visitante = 3
    matches[5].finalizado = True
    
    session.commit()
    
    # Recalcular puntos
    recalcular_puntos_grupo(session, group.id_grupo)
    
    # Consultar resultados calculados
    res_a = session.query(GrupoUsuario).filter(GrupoUsuario.id_usuario == user_a.id_usuario).first()
    res_b = session.query(GrupoUsuario).filter(GrupoUsuario.id_usuario == user_b.id_usuario).first()
    
    print("\n--- RESULTADOS OBTENIDOS ---")
    print(f"Usuario A (esperado: 125 puntos):")
    print(f"  Puntos Totales: {res_a.puntos_totales}")
    print(f"  Cantidad de Exactos: {res_a.cantidad_exactos} (esperado: 3 - Matches 2, 3, 4)")
    print(f"  Mejor Racha: {res_a.mejor_racha} (esperado: 5 - Matches 2 a 6)")
    
    print(f"\nUsuario B (esperado: 130 puntos):")
    print(f"  Puntos Totales: {res_b.puntos_totales}")
    print(f"  Cantidad de Exactos: {res_b.cantidad_exactos} (esperado: 3 - Matches 1, 3, 4)")
    print(f"  Mejor Racha: {res_b.mejor_racha} (esperado: 6 - Matches 1 a 6)")
    
    # Validaciones asserts
    assert res_a.puntos_totales == 125, f"Error puntos A: {res_a.puntos_totales}"
    assert res_a.cantidad_exactos == 3, f"Error exactos A: {res_a.cantidad_exactos}"
    assert res_a.mejor_racha == 5, f"Error racha A: {res_a.mejor_racha}"
    
    assert res_b.puntos_totales == 130, f"Error puntos B: {res_b.puntos_totales}"
    assert res_b.cantidad_exactos == 3, f"Error exactos B: {res_b.cantidad_exactos}"
    assert res_b.mejor_racha == 6, f"Error racha B: {res_b.mejor_racha}"
    
    print("\n--- ¡VERIFICACIÓN EXITOSA! TODOS LOS CASOS CALCULADOS CORRECTAMENTE ---")

if __name__ == "__main__":
    test_scoring_system()
