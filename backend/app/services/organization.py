import logging
import shutil
from pathlib import Path

from app.domain.models import Album

logger = logging.getLogger(__name__)

class OrganizationService:
    def __init__(self, output_base_path: str):
        self.output_base = Path(output_base_path)

    async def organize_album(self, album: Album) -> bool:
        """
        Moves files to Output/Artist/Album (Year)/
        """
        if not self.output_base.exists():
            self.output_base.mkdir(parents=True, exist_ok=True)
            
        # Sanitize folder names
        safe_artist = "".join(x for x in album.artist if (x.isalnum() or x in "._- ")).strip()
        safe_album = "".join(x for x in album.title if (x.isalnum() or x in "._- ")).strip()
        
        # User requested: Bandname - Albumname (Jahr)
        folder_name = f"{safe_artist} - {safe_album}"
        if album.year:
            folder_name += f" ({album.year})"
            
        target_dir = self.output_base / safe_artist / folder_name
        
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            
            for file in album.files:
                source = file.path
                destination = target_dir / file.filename
                
                if source.exists():
                    shutil.move(str(source), str(destination))
                    # Update model path (though memory object might be discarded soon)
                    file.path = destination
            
            # Cleanup: Remove source directory and remaining files
            try:
                # check if album.path exists and is a directory
                # check if album.path exists and is a directory
                if album.path and album.path.exists() and album.path.is_dir():
                    shutil.rmtree(album.path)
                    logger.info(f"Successfully removed source directory: {album.path}")
            except Exception as e:
                # Log cleanup error but don't fail the organization status entirely
                logger.warning(f"Cleanup warning for {album.path}: {e}")

            return True
        except Exception as e:
            logger.error(f"Failed to organize album {album.title}: {e}")
            return False

    async def organize_all(self, albums: list[Album]) -> dict:
        count = 0
        for album in albums:
            # Only move if recognized/tagged? Or move all?
            # Usually only move processed ones.
            if album.status == "Match" and await self.organize_album(album):
                count += 1
        return {"attempted": len(albums), "moved": count}
