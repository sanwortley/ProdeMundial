import datetime
import logging
import os
import subprocess
import shutil
from pathlib import Path

BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"
os.makedirs(BACKUP_DIR, exist_ok=True)

logger = logging.getLogger(__name__)

def run_backup():
    from .database import DATABASE_URL

    if DATABASE_URL.startswith("sqlite"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = BACKUP_DIR / f"prode_backup_{timestamp}.db"
        shutil.copy2(db_path, filename)
        logger.info(f"SQLite backup created: {filename} ({os.path.getsize(filename)} bytes)")
    else:
        if not shutil.which("pg_dump"):
            logger.warning("pg_dump not found, skipping backup")
            return
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = BACKUP_DIR / f"prode_backup_{timestamp}.sql"
        try:
            with open(filename, "w") as f:
                subprocess.run(
                    ["pg_dump", DATABASE_URL],
                    stdout=f,
                    stderr=subprocess.PIPE,
                    check=True,
                )
            logger.info(f"Backup created: {filename} ({os.path.getsize(filename)} bytes)")
        except subprocess.CalledProcessError as e:
            logger.error(f"Backup failed: {e.stderr.decode()}")
            if filename.exists():
                filename.unlink()
            return

    prune_backups()

def prune_backups():
    cutoff = datetime.datetime.now() - datetime.timedelta(days=7)
    for b in sorted(BACKUP_DIR.glob("prode_backup_*")):
        mtime = datetime.datetime.fromtimestamp(b.stat().st_mtime)
        if mtime < cutoff:
            b.unlink()
            logger.info(f"Pruned old backup: {b}")
