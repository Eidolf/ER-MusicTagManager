import logging

import mutagen
from mutagen.easyid3 import EasyID3

from app.domain.models import Album

logger = logging.getLogger(__name__)

class TaggingService:
    async def download_cover_art(self, url: str) -> bytes | None:
        import httpx
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=5.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    return resp.content
        except Exception as e:
            logger.error(f"Failed to download cover art: {e}")
        return None

    async def tag_album(self, album: Album) -> Album:
        """
        Writes metadata (Artist, Album, Year) to all files in the album.
        """
        if album.status != "Match" and album.status != "Pending": 
            pass

        cover_data = None
        # Priority 1: Local Cover Art
        if album.local_cover_path and album.local_cover_path.exists():
            try:
                cover_data = album.local_cover_path.read_bytes()
                logger.info(f"Using local cover for {album.title}")
            except Exception as e:
                logger.error(f"Failed to read local cover {album.local_cover_path}: {e}")

        # Priority 2: Online Cover Art (if local not found)
        if not cover_data and album.cover_art_url:
            cover_data = await self.download_cover_art(album.cover_art_url)

        for file in album.files:
            try:
                # Basic ID3 Handling for MP3
                if file.extension == '.mp3':
                    try:
                        audio = EasyID3(file.path)
                    except mutagen.id3.ID3NoHeaderError:
                        audio = EasyID3()
                        audio.save(file.path)
                    
                    audio['artist'] = album.artist
                    audio['album'] = album.title
                    if album.year:
                        audio['date'] = str(album.year)
                    audio.save()
                    
                    # Extended Metadata (ID3 TXXX)
                    # We need to re-open with mutagen.id3.ID3 to add frames safely 
                    # if EasyID3 doesn't support them easily
                    if album.extended_metadata:
                        try:
                            from mutagen.id3 import ID3, TXXX
                            tags = ID3(file.path)
                            for k, v in album.extended_metadata.items():
                                # Map common keys to standard ID3 frames if possible?
                                # For now, use TXXX for everything requested as "MusicBrainz style" 
                                # usually implies TXXX for MBIDs
                                # But some like 'label' -> TPUB, 'copyright' -> TCOP
                                frame_map = {
                                    'label': 'TPUB',
                                    'copyright': 'TCOP',
                                    'barcode': 'TXXX:BARCODE',
                                    'asin': 'TXXX:ASIN',
                                    'catalognumber': 'TXXX:CATALOGNUMBER',
                                    'isrc': 'TSRC',
                                    'musicbrainz_recordingid': 'UFID:http://musicbrainz.org', # Complex?
                                    'musicbrainz_trackid': 'UFID:http://musicbrainz.org',
                                }
                                
                                # Use TXXX as default/fallback
                                frame_id = frame_map.get(k, f"TXXX:{k.upper()}")
                                
                                if k == 'totaldiscs' or k == 'discnumber':
                                    # Handle TPOS (Disc Number) 1/1
                                    pass # Already handled mostly or tricky with TPOS 1/2
                                elif k == 'totaltracks':
                                    pass # Handled with TRCK
                                else:
                                    if frame_id.startswith("TXXX:"):
                                        desc = frame_id.split(":")[1]
                                        tags.add(TXXX(encoding=3, desc=desc, text=[str(v)]))
                                    else:
                                        # Standard frames
                                        from mutagen.id3 import TCOP, TPUB, TSRC
                                        if frame_id == 'TPUB': 
                                            tags.add(TPUB(encoding=3, text=[str(v)]))
                                        elif frame_id == 'TCOP': 
                                            tags.add(TCOP(encoding=3, text=[str(v)]))
                                        elif frame_id == 'TSRC': 
                                            tags.add(TSRC(encoding=3, text=[str(v)]))
                                        
                            tags.save()
                        except Exception as e:
                            logger.error(f"Failed to write extended ID3 tags: {e}")

                    # Update in-memory file object for Frontend response
                    file.artist = album.artist
                    file.album = album.title
                    file.year = album.year
                    file.extended_tags = album.extended_metadata.copy()

                    if cover_data:
                        from mutagen.id3 import APIC, ID3
                        id3 = ID3(file.path)
                        id3.add(
                            APIC(
                                encoding=3, # 3 is UTF-8
                                mime='image/jpeg', # Assume JPEG from CAA usually
                                type=3, # 3 is front cover
                                desc='Cover',
                                data=cover_data
                            )
                        )
                        id3.save()
                
                # FLAC/Ogg Handling
                elif file.extension in ['.flac', '.ogg']:
                    audio = mutagen.File(file.path)
                    if audio:
                        audio['artist'] = album.artist
                        audio['album'] = album.title
                        if album.year:
                            audio['date'] = str(album.year)
                        
                        # Extended Metadata (Vorbis Comments)
                        if album.extended_metadata:
                            for k, v in album.extended_metadata.items():
                                # Vorbis comments are usually KEY=VALUE, case insensitive often
                                audio[k] = str(v)

                        # Update in-memory file object
                        file.artist = album.artist
                        file.album = album.title
                        file.year = album.year
                        file.extended_tags = album.extended_metadata.copy()

                        if cover_data:
                            from mutagen.flac import Picture
                            p = Picture()
                            p.type = 3
                            p.mime = "image/jpeg"
                            p.desc = "Cover"
                            p.data = cover_data
                            
                            if hasattr(audio, 'add_picture'):
                                audio.add_picture(p)
                            elif hasattr(audio, 'clear_pictures'): # OggVorbis/FLAC
                                audio.clear_pictures()
                                audio.add_picture(p)

                        audio.save()
                        
            except Exception as e:
                logger.error(f"Failed to tag {file.filename}: {e}")
                
        return album

    async def tag_all(self, albums: list[Album]) -> list[Album]:
        for album in albums:
            # Only tag matches to prevent destroying data with "Unknown"
            if album.status == "Match":
                await self.tag_album(album) # Make tag_album async
        return albums
