import logging
from .sync import sync_results as sync_free_api
from .sync_service import auto_sync_matches
from .database import SessionLocal

logger = logging.getLogger("prode.sync_manager")


def run_full_sync():
    """
    Ejecuta ambos mecanismos de sincronización:
    1. API gratuita worldcup26.ir (sin API key)
    2. football-data.org (requiere FOOTBALL_DATA_KEY)

    La API gratuita se ejecuta primero por no necesitar configuración.
    Retorna dict con resultado combinado.
    """
    result = {"updated": 0, "groups": 0, "free_api": 0, "errors": []}

    # Step 1: Free API — worldcup26.ir
    try:
        updated_free = sync_free_api()
        if updated_free > 0:
            result["updated"] += updated_free
            result["free_api"] = updated_free
            logger.info(f"[SyncManager] API gratuita: {updated_free} partido(s) actualizado(s)")
    except Exception as e:
        logger.error(f"[SyncManager] Error en API gratuita: {e}")
        result["errors"].append(f"free_api: {e}")

    # Step 2: football-data.org
    try:
        db = SessionLocal()
        try:
            fb_result = auto_sync_matches(db)
            fb_updated = fb_result.get("updated", 0)
            if fb_updated > 0:
                result["updated"] += fb_updated
                result["groups"] += fb_result.get("groups", 0)
                logger.info(f"[SyncManager] football-data.org: {fb_updated} partido(s) actualizado(s)")
            if fb_result.get("error"):
                logger.warning(f"[SyncManager] football-data.org: {fb_result['error']}")
                result["errors"].append(f"football_data: {fb_result['error']}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[SyncManager] Error en football-data.org: {e}")
        result["errors"].append(f"football_data: {e}")

    return result
