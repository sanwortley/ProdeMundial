import sys
import os

# Set current path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import PrediccionCampeon, Grupo
from app.utils import recalcular_puntos_grupo

def reset_champion_points():
    db = SessionLocal()
    try:
        # Reset all champion predictions points obtained to 0
        num_reset = db.query(PrediccionCampeon).update({PrediccionCampeon.puntos_obtenidos: 0})
        db.commit()
        print(f"Reseteadas {num_reset} predicciones de campeón a 0 puntos.")

        # Recalculate points for all groups
        grupos = db.query(Grupo).all()
        for g in grupos:
            recalcular_puntos_grupo(db, g.id_grupo)
            print(f"Ranking recalculado para el grupo: {g.nombre_grupo} (ID: {g.id_grupo})")
        
        print("Puntos de todos los grupos recalculados exitosamente.")
    except Exception as e:
        db.rollback()
        print(f"Error resetting champion points: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_champion_points()
