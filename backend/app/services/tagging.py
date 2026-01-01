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

        for i, file in enumerate(album.files):
            try:
                # Merge Album Metadata with Track Metadata
                write_metadata = album.extended_metadata.copy()
                if i < len(album.tracks_metadata):
                    write_metadata.update(album.tracks_metadata[i])

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
                    if write_metadata:
                        try:
                            from mutagen.id3 import ID3, TXXX
                            tags = ID3(file.path)
                            for k, v in write_metadata.items():
                                # Frame Mapping
                                frame_map = {
                                    'label': 'TPUB',
                                    'copyright': 'TCOP',
                                    'barcode': 'TXXX:BARCODE',
                                    'asin': 'TXXX:ASIN',
                                    'catalognumber': 'TXXX:CATALOGNUMBER',
                                    'isrc': 'TSRC',
                                    'musicbrainz_recordingid': 'UFID:http://musicbrainz.org',
                                    'musicbrainz_trackid': 'TXXX:MusicBrainz Release Track Id',
                                    'script': 'TXXX:SCRIPT',
                                    'originalyear': 'TXXX:ORIGINALYEAR',
                                    'originaldate': 'TDOR', # ID3 v2.4
                                    'releasecountry': 'TXXX:RELEASECOUNTRY',
                                    'releasestatus': 'TXXX:RELEASESTATUS',
                                    'releasetype': 'TXXX:RELEASETYPE',
                                    'artists': 'TXXX:ARTISTS',
                                    'artistsort': 'TXXX:ARTISTSORT',
                                }
                                
                                # Use TXXX as default/fallback
                                frame_id = frame_map.get(k, f"TXXX:{k.upper()}")
                                
                                if k in ['totaldiscs', 'discnumber', 'totaltracks']:
                                    pass # Handled basic tags usually or ignore (EasyID3 handles basics?)
                                    # Actually EasyID3 handles tracknumber/discnumber but we removed logic.
                                    # Leaving as pass to avoid conflicts.
                                else:
                                    if frame_id.startswith("TXXX:"):
                                        desc = frame_id.split(":")[1]
                                        tags.add(TXXX(encoding=3, desc=desc, text=[str(v)]))
                                    elif frame_id.startswith("UFID:"):
                                        # UFID requires owner and data (byte string)
                                        # mutagen UFID(owner='url', data=b'id')
                                        owner = frame_id.split(":")[1]
                                        from mutagen.id3 import UFID
                                        tags.add(UFID(owner=owner, data=str(v).encode('utf-8')))
                                    else:
                                        # Standard frames
                                        from mutagen.id3 import TCOP, TDOR, TPUB, TSRC
                                        if frame_id == 'TPUB': 
                                            tags.add(TPUB(encoding=3, text=[str(v)]))
                                        elif frame_id == 'TCOP': 
                                            tags.add(TCOP(encoding=3, text=[str(v)]))
                                        elif frame_id == 'TSRC': 
                                            tags.add(TSRC(encoding=3, text=[str(v)]))
                                        elif frame_id == 'TDOR':
                                            tags.add(TDOR(encoding=3, text=[str(v)]))
                                        
                            tags.save()
                        except Exception as e:
                            logger.error(f"Failed to write extended ID3 tags: {e}")

                    # Update in-memory file object
                    file.artist = album.artist
                    file.album = album.title
                    file.year = album.year
                    file.extended_tags = write_metadata.copy()

                    if cover_data:
                        from mutagen.id3 import APIC, ID3
                        id3 = ID3(file.path)
                        # Check exist covers
                        apic_keys = [key for key in id3 if key.startswith('APIC:')]
                        count = len(apic_keys)
                        
                        should_add = False
                        if count > 1:
                            # Delete all and add new
                            id3.delall('APIC')
                            should_add = True
                            logger.info(f"Revoking duplicate covers for {file.filename}")
                        elif count == 0:
                            should_add = True
                        
                        if should_add:
                            id3.add(
                                APIC(
                                    encoding=3, # 3 is UTF-8
                                    mime='image/jpeg',
                                    type=3, # 3 is front cover
                                    desc='Cover',
                                    data=cover_data
                                )
                            )
                            id3.save()
                        else:
                            logger.info(f"Preserving existing single cover for {file.filename}")
                
                # FLAC/Ogg Handling
                elif file.extension in ['.flac', '.ogg']:
                    audio = mutagen.File(file.path)
                    if audio:
                        audio['artist'] = album.artist
                        audio['album'] = album.title
                        if album.year:
                            audio['date'] = str(album.year)
                        
                        # Extended Metadata (Vorbis Comments)
                        if write_metadata:
                            for k, v in write_metadata.items():
                                audio[k] = str(v)

                        # Update in-memory file object
                        file.artist = album.artist
                        file.album = album.title
                        file.year = album.year
                        file.extended_tags = write_metadata.copy()

                        if cover_data:
                            should_add = False
                            existing_pics = audio.pictures if hasattr(audio, 'pictures') else []
                            count = len(existing_pics)
                            
                            if count > 1:
                                if hasattr(audio, 'clear_pictures'):
                                    audio.clear_pictures()
                                    should_add = True
                                    logger.info(f"Revoking duplicate covers for {file.filename}")
                            elif count == 0:
                                should_add = True
                            
                            if should_add:
                                from mutagen.flac import Picture
                                p = Picture()
                                p.type = 3
                                p.mime = "image/jpeg"
                                p.desc = "Cover"
                                p.data = cover_data
                                
                                if hasattr(audio, 'add_picture') or hasattr(audio, 'clear_pictures'):
                                    audio.add_picture(p)
                            else:
                                 logger.info(f"Preserving existing single cover for {file.filename}")

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
