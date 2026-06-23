import sys
from app.database import SessionLocal
from app.models import Partido

def main():
    if len(sys.argv) < 4:
        print("Uso: python set_knockout_teams.py <match_id> <equipo_local> <equipo_visitante>")
        print("Ejemplo: python set_knockout_teams.py 73 \"Argentina\" \"México\"")
        sys.exit(1)
        
    try:
        match_id = int(sys.argv[1])
    except ValueError:
        print("Error: El ID del partido debe ser un número entero.")
        sys.exit(1)
        
    local = sys.argv[2].strip()
    visitante = sys.argv[3].strip()
    
    db = SessionLocal()
    try:
        partido = db.query(Partido).filter(Partido.id_partido == match_id).first()
        if not partido:
            print(f"Error: No se encontró el partido con ID {match_id}")
            sys.exit(1)
            
        print(f"Partido {match_id} ({partido.fase}):")
        print(f"  Antes: {partido.equipo_local} vs {partido.equipo_visitante}")
        
        partido.equipo_local = local
        partido.equipo_visitante = visitante
        db.commit()
        
        print(f"  Ahora: {partido.equipo_local} vs {partido.equipo_visitante}")
        print("¡Partido actualizado exitosamente!")
    except Exception as e:
        print(f"Error al actualizar la base de datos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    main()
