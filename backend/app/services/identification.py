import asyncio
import contextlib
import logging

import httpx

from app.domain.models import Album

logger = logging.getLogger(__name__)

class IdentificationService:
    BASE_URL = "https://musicbrainz.org/ws/2"
    USER_AGENT = "ER-MusicTagManager/1.0.0 ( contact@example.com )"

    async def search_releases(self, artist: str, release: str, limit: int = 50) -> list[dict]:
        """
        Public method to search for releases manually.
        Returns raw MusicBrainz release dictionaries.
        """
        query = f'artist:"{artist}" AND release:"{release}"'
        params = {
            "query": query,
            "fmt": "json",
            "limit": limit
        }
        headers = {"User-Agent": self.USER_AGENT, "Accept": "application/json"}
        
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
             # Simple retry logic could be added here similar to identify_album
            try:
                response = await client.get(f"{self.BASE_URL}/release", params=params, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("releases", [])
            except Exception as e:
                logger.error(f"Search failed: {e}")
        return []

    async def resolve_release(self, album: Album, mb_release_id: str) -> Album:
        """
        Manually resolves an album using a specific MusicBrainz Release ID.
        Forces the album status to 'Match' and populates metadata.
        """
        headers = {"User-Agent": self.USER_AGENT, "Accept": "application/json"}
        lookup_params = {
            "inc": "recordings+artist-credits+labels+isrcs+release-groups+url-rels+tags+genres"
        }
        
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            try:
                # 1. Fetch Details
                det_resp = await client.get(
                    f"{self.BASE_URL}/release/{mb_release_id}", 
                    params=lookup_params, 
                    headers=headers
                )
                
                if det_resp.status_code == 200:
                    details = det_resp.json()
                    album.mb_release_id = details.get("id")
                    album.title = details.get("title")
                    
                    if "artist-credit" in details:
                        album.artist = details["artist-credit"][0]["name"]

                    # Populate Extended Metadata (Refactored logic could go here)
                    # For now duplication of logic from identify_album is acceptable or we extract it
                    self._parse_details_into_album(album, details)
                    
                    album.status = "Match"
                    
                    # Cover Art
                    with contextlib.suppress(Exception):
                        album.cover_art_url = f"http://coverartarchive.org/release/{album.mb_release_id}/front"
                else:
                    album.status = f"API Error: {det_resp.status_code}"
                    
            except Exception as e:
                logger.error(f"Resolve failed: {e}")
                album.status = f"Error: {str(e)}"
        
        return album

    def _parse_details_into_album(self, album: Album, details: dict):
        """Helper to parse MB release details into Album model"""
        meta = {}
        
        # Basic Info
        meta['musicbrainz_albumid'] = details.get('id', '')
        meta['barcode'] = details.get('barcode', '')
        meta['asin'] = details.get('asin', '')
        meta['releasestatus'] = details.get('status', '') 
        meta['releasecountry'] = details.get('country', '')
        
        # Script
        if 'text-representation' in details:
            meta['script'] = details['text-representation'].get('script', '')
        
        # Label
        if 'label-info' in details and details['label-info']:
            li = details['label-info'][0]
            if 'label' in li:
                meta['label'] = li['label'].get('name', '')
                meta['catalognumber'] = li.get('catalog-number', '')
        
        # Date
        date_str = details.get('date', '')
        if date_str and date_str[:4].isdigit():
             album.year = int(date_str[:4])
        meta['date'] = date_str
        meta['originaldate'] = date_str
        
        # Release Group
        if 'release-group' in details:
            rg = details['release-group']
            meta['musicbrainz_releasegroupid'] = rg.get('id', '')
            meta['musicbrainz_primarytype'] = rg.get('primary-type', '')
            meta['releasetype'] = rg.get('primary-type', '')
            
            first_date = rg.get('first-release-date', '')
            if first_date:
                meta['originalyear'] = first_date[:4]
                meta['originaldate'] = first_date

        # Artist IDs & Multi-Value Artists
        if 'artist-credit' in details and details['artist-credit']:
            ac_list = details['artist-credit']
            ac = ac_list[0]
            if 'artist' in ac:
                meta['musicbrainz_artistid'] = ac['artist'].get('id', '')
                meta['musicbrainz_albumartistid'] = ac['artist'].get('id', '')
                meta['albumartist'] = ac['artist'].get('name', '')
                
            artists_sort = [item['artist']['sort-name'] for item in ac_list if 'artist' in item]
            meta['artistsort'] = '; '.join(artists_sort)
            
            artists = [item['artist']['name'] for item in ac_list if 'artist' in item]
            meta['artists'] = '; '.join(artists)

        # Tags / Genres
        if 'tags' in details:
            tags = [t['name'] for t in details['tags']]
            meta['genre'] = '; '.join(tags) # Map tags to genre for simple compatibility
            meta['tags'] = '; '.join(tags)

        if 'genres' in details:
             # If genres specific field exists (modern MB)
             genres = [g['name'] for g in details['genres']]
             if genres:
                 meta['genre'] = '; '.join(genres)

        # Media / Discs / Tracks
        if 'media' in details:
            tracks_data = []
            total_discs = len(details['media'])
            meta['totaldiscs'] = str(total_discs)
            
            for current_disc, medium in enumerate(details['media'], start=1):
                if current_disc == 1:
                    meta['media'] = medium.get('format', '')
                    meta['discnumber'] = str(medium.get('position', '1'))
                    meta['totaltracks'] = str(medium.get('track-count', ''))

                if 'tracks' in medium:
                    for track in medium['tracks']:
                        t_meta = {}
                        t_meta['musicbrainz_trackid'] = track.get('id', '')
                        t_meta['title'] = track.get('title', '')
                        if 'artist-credit' in track:
                             t_meta['artist'] = track['artist-credit'][0]['name']
                        elif 'artist-credit' in medium: # sometimes on medium level? unlikley but check schema
                             pass
                        
                        if 'recording' in track:
                            t_meta['musicbrainz_recordingid'] = track['recording'].get('id', '')
                        tracks_data.append(t_meta)
            
            album.tracks_metadata = tracks_data
        
        album.extended_metadata = {k: v for k, v in meta.items() if v}


    async def identify_album(self, album: Album, client: httpx.AsyncClient | None = None) -> Album:
        """
        Queries MusicBrainz for the best matching release based on Artist and Album Title.
        Updates the album status and metadata if a high-confidence match is found.
        """
        if album.artist == "Unknown Artist" or not album.title:
            album.status = "Unclear"
            return album

        headers = {"User-Agent": self.USER_AGENT, "Accept": "application/json"}
        
        # Lucene search query
        query = f'artist:"{album.artist}" AND release:"{album.title}"'
        if album.year:
             query += f' AND date:"{album.year}"'

        params = {
            "query": query,
            "fmt": "json",
            "limit": 10
        }

        should_close = False
        if client is None:
            active_client = httpx.AsyncClient(verify=False, timeout=10.0)
            should_close = True
        else:
            active_client = client

        try:
            # Retry loop for API resilience
            max_retries = 3
            backoff = 1.0
            response = None
            
            for attempt in range(max_retries + 1):
                try:
                    response = await active_client.get(f"{self.BASE_URL}/release", params=params, headers=headers)
                    
                    if response.status_code == 503 and attempt < max_retries:
                        logger.warning(
                            f"MusicBrainz 503 (Attempt {attempt+1}/{max_retries}). "
                            f"Retrying in {backoff}s..."
                        )
                        await asyncio.sleep(backoff)
                        backoff *= 2
                        continue
                    
                    break # Success or non-retriable status

                except (httpx.TimeoutException, httpx.RequestError) as e:
                    if attempt < max_retries:
                        logger.warning(f"MusicBrainz Network Error: {e}. Retrying in {backoff}s...")
                        await asyncio.sleep(backoff)
                        backoff *= 2
                    else:
                        raise e
            
            if not response:
                 album.status = "API Error: No Response"
                 return album
                
            if response.status_code == 200:
                data = response.json()
                releases = data.get("releases", [])
                
                # Filter for high confidence candidates
                candidates = [r for r in releases if int(r.get("score", "0")) > 80]
                
                if candidates:
                    # Smart Selection Logic
                    file_count = len(album.files)
                    
                    def score_candidate(release):
                        track_count = int(release.get("track-count", 0))
                        diff = abs(track_count - file_count)
                        has_cover = 0
                        if "cover-art-archive" in release and release["cover-art-archive"].get("front", False):
                            has_cover = 1
                        score_val = int(release.get("score", "0"))
                        return (diff, -has_cover, -score_val)

                    candidates.sort(key=score_candidate)
                    match = candidates[0]
                    
                    if True:
                        album.mb_release_id = match.get("id")
                        album.title = match.get("title")
                        if "artist-credit" in match:
                             album.artist = match["artist-credit"][0]["name"]
                            
                        # Secondary Lookup utilizing _parse_details_into_album
                        try:
                            lookup_params = {
                                "inc": "recordings+artist-credits+labels+isrcs+release-groups+url-rels"
                            }
                            await asyncio.sleep(1.1)
                            
                            det_resp = await active_client.get(
                                f"{self.BASE_URL}/release/{album.mb_release_id}", 
                                params=lookup_params, 
                                headers=headers
                            )
                            
                            if det_resp.status_code == 200:
                                self._parse_details_into_album(album, det_resp.json())
                                
                        except Exception as e:
                            logger.warning(f"Secondary lookup failed for {album.title}: {repr(e)}")

                        album.status = "Match"
                        
                        # Fetch Cover Art URL
                        try:
                            # Optimistic: http://coverartarchive.org/release/{mbid}/front
                            album.cover_art_url = f"http://coverartarchive.org/release/{album.mb_release_id}/front"
                        except Exception as e:
                            logger.warning(f"Could not determine cover art URL: {repr(e)}")

                    else:
                        album.status = "Unclear (Low Confidence)"
                else:
                    album.status = "NotFound"
            else:
                logger.error(f"MusicBrainz API Error: {response.status_code}")
                # Don't overwrite error if it's already set to something more specific
                album.status = f"API Error: {response.status_code}"
                
        except Exception as e:
            logger.error(f"Identification failed: {repr(e)}")
            album.status = f"Error: {str(e)}"
        
        finally:
            if should_close and active_client:
                await active_client.aclose()

        # Rate limiting compliance
        await asyncio.sleep(1.1) 
        
        return album

    async def identify_all(self, albums: list[Album]) -> list[Album]:
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            tasks = []
            for album in albums:
                # Fast Path: If album already has an ID (from tags or manual fix), resolve directly
                if album.mb_release_id:
                     tasks.append(self.resolve_release(album, album.mb_release_id))
                else:
                     tasks.append(self.identify_album(album, client))
            
            return await asyncio.gather(*tasks)
