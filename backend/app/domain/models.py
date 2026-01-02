from pathlib import Path

from pydantic import BaseModel


class MusicFile(BaseModel):
    filename: str
    path: Path
    extension: str
    size_bytes: int
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    year: int | None = None
    extended_tags: dict[str, str] = {}

class Album(BaseModel):
    id: str # UUID or Scan Path
    title: str
    artist: str
    year: int | None = None
    path: Path
    files: list[MusicFile] = []
    
    # Extended Metadata (MusicBrainz full data)
    extended_metadata: dict[str, str] = {}
    tracks_metadata: list[dict[str, str]] = []

    
    # Identification / Match Status
    status: str = "Pending"  # Pending, Match, Unclear, NotFound
    mb_release_id: str | None = None
    cover_art_url: str | None = None
    local_cover_path: Path | None = None
    
    @property
    def folder_name(self) -> str:
        # Band Name - Album Name - (Year)
        year_str = f" - ({self.year})" if self.year else ""
        return f"{self.artist} - {self.title}{year_str}"
