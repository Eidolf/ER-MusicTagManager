import os
from collections import Counter
from pathlib import Path

import httpx
import mutagen
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.domain.models import Album, MusicFile
from app.services.identification import IdentificationService
from app.services.organization import OrganizationService
from app.services.tagging import TaggingService

router = APIRouter()

AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.m4a', '.ogg'}

class ScanRequest(BaseModel):
    input_path: str
    output_path: str

class OrganizeRequest(BaseModel):
    albums: list[Album]
    output_path: str

@router.get("/health")
async def health_check():
    return {"status": "ok"}

@router.get("/ready")
async def readiness_check():
    # In a real app, check DB/Disk connectivity
    return {"status": "ready"}

@router.get("/connectivity/musicbrainz")
async def check_musicbrainz_connection():
    try:
        # Verify connection to MusicBrainz
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://musicbrainz.org", follow_redirects=True)
            if resp.status_code in [200, 301, 302]:
                return {"status": "online", "message": "Connected to MusicBrainz"}
            return {"status": "offline", "message": f"Status Code: {resp.status_code}"}
    except Exception as e:
        return {"status": "offline", "message": str(e)}

@router.post("/scan")
async def scan_directory(request: ScanRequest) -> list[Album]:
    input_path = Path(request.input_path)
    if not input_path.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {request.input_path}")

    albums_map = {}
    
    for root, _, files in os.walk(input_path):
        audio_files = [f for f in files if Path(f).suffix.lower() in AUDIO_EXTENSIONS]
        if not audio_files:
            continue
            
        root_path = Path(root)
        album_files = []
        
        # Heuristic metadata aggregation from files
        artists = []
        albums_titles = []
        years = []
        
        for file in audio_files:
            file_path = root_path / file
            stat = file_path.stat()
            
            # Read metadata
            # title = None # usage optimization
            artist = None
            album_name = None
            year = None
            
            try:
                f = mutagen.File(file_path, easy=True)
                if f:
                    f.get('title', [None])[0]
                    artist = f.get('artist', [None])[0]
                    album_name = f.get('album', [None])[0]
                    date = f.get('date', [None])[0] 
                    if date:
                        # Extract year 2021 from "2021-01-01"
                        year = int(str(date)[:4]) if str(date)[:4].isdigit() else None
                    
                    if artist:
                        artists.append(artist)
                    if album_name:
                        albums_titles.append(album_name)
                    if year:
                        years.append(year)
            except Exception as e:
                print(f"Error reading metadata for {file}: {e}")



            # Extended Metadata Reading (ID3 v2.3/2.4) to find MusicBrainz IDs
            mb_release_id = None
            if file_path.suffix.lower() == '.mp3':
                try:
                    from mutagen.id3 import ID3
                    tags = ID3(str(file_path))
                    # TXXX:MusicBrainz Release Id
                    # Mutagen access TXXX frames: TXXX:desc
                    txxx_frames = tags.getall("TXXX") # returns list of TXXX frames
                    for frame in txxx_frames:
                        if frame.desc.lower() == 'musicbrainz release id':
                            mb_release_id = str(frame.text[0])
                        # Also could read other IDs here
                except Exception:
                    # Usually means no id3 tag or error reading
                    pass

            music_file = MusicFile(
                filename=file,
                path=file_path,
                extension=file_path.suffix.lower(),
                size_bytes=stat.st_size,
                artist=artist,
                album=album_name,
                year=year,
                extended_tags={'musicbrainz_albumid': mb_release_id} if mb_release_id else {}
            )
            album_files.append(music_file)

        # Determine majority vote for Folder Album info
        def get_most_common(lst):
            return Counter(lst).most_common(1)[0][0] if lst else None

        detected_artist = get_most_common(artists)
        detected_title = get_most_common(albums_titles)
        detected_year = get_most_common(years)

        # Fallback to folder name heuristics if tags missing
        folder_name = root_path.name
        if not detected_artist or not detected_title:
             parts = folder_name.split(' - ')
             if not detected_artist:
                 detected_artist = parts[0] if len(parts) > 1 else "Unknown Artist"
             if not detected_title:
                 detected_title = parts[1] if len(parts) > 1 else folder_name

        # Check for local cover art
        local_cover = None
        common_covers = ['cover.jpg', 'cover.png', 'folder.jpg', 'folder.png', 'front.jpg', 'front.png']
        for cover_name in common_covers:
            possible_cover = root_path / cover_name
            # Case insensitive check might be needed for linux, but basic check first
            if possible_cover.exists():
                local_cover = possible_cover
                break
            # Try lowercase if file system is case sensitive but file is uppercase
            if not local_cover:
                 for f in files:
                     if f.lower() == cover_name:
                         local_cover = root_path / f
                         break
            if local_cover:
                break

        # Check consensus MBID
        mb_ids = [
            f.extended_tags.get('musicbrainz_albumid') 
            for f in album_files if f.extended_tags.get('musicbrainz_albumid')
        ]
        consensus_mbid = None
        if mb_ids and len(mb_ids) == len(album_files) and len(set(mb_ids)) == 1:
             consensus_mbid = mb_ids[0]

        album = Album(
            id=str(root_path),
            title=detected_title or "Unknown Album",
            artist=detected_artist or "Unknown Artist",
            year=detected_year,
            path=root_path,
            files=album_files,
            # If we have ID, it's effectively matched but we need to fetch details. Let's keep Pending but pass ID.
            status="Match" if consensus_mbid else "Pending",
            mb_release_id=consensus_mbid,
            local_cover_path=local_cover
        )
        albums_map[str(root_path)] = album

    return list(albums_map.values())

@router.post("/identify")
async def identify_albums(albums: list[Album]) -> list[Album]:
    service = IdentificationService()
    return await service.identify_all(albums)

class SearchReleaseRequest(BaseModel):
    artist: str
    album: str

@router.post("/identify/search")
async def search_releases(request: SearchReleaseRequest) -> list[dict]:
    service = IdentificationService()
    return await service.search_releases(request.artist, request.album)

class ResolveReleaseRequest(BaseModel):
    album: Album
    mb_release_id: str

@router.post("/identify/resolve")
async def resolve_release(request: ResolveReleaseRequest) -> Album:
    service = IdentificationService()
    return await service.resolve_release(request.album, request.mb_release_id)

@router.post("/tag")
async def tag_files(albums: list[Album]) -> list[Album]:
    service = TaggingService()
    return await service.tag_all(albums)

@router.post("/organize")
async def organize_files(request: OrganizeRequest) -> dict:
    service = OrganizationService(request.output_path)
    return await service.organize_all(request.albums)
@router.post("/system/shutdown")
async def shutdown_application():
    import signal
    import threading
    import time
    
    def kill_server():
        time.sleep(1)
        os.kill(os.getpid(), signal.SIGINT)
        
    threading.Thread(target=kill_server).start()
    return {"status": "shutting_down", "message": "Server will shutdown in 1 second"}
