import asyncio
import logging

import httpx

from app.domain.models import Album

logger = logging.getLogger(__name__)

class IdentificationService:
    BASE_URL = "https://musicbrainz.org/ws/2"
    USER_AGENT = "ER-MusicTagManager/1.0.0 ( contact@example.com )"

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
                    # Priority 1: Exact Track Count Match (diff=0 is best)
                    # Priority 2: Cover Art Available (cover-art-archive.front == True)
                    # Priority 3: Score (Higher is better)
                    
                    file_count = len(album.files)
                    
                    def score_candidate(release):
                        # Track Count Diff (Minimize)
                        track_count = int(release.get("track-count", 0))
                        diff = abs(track_count - file_count)
                        
                        # Cover Art (Maximize: 1=Yes, 0=No/Unknown)
                        has_cover = 0
                        if "cover-art-archive" in release and release["cover-art-archive"].get("front", False):
                            has_cover = 1
                            
                        # Score (Maximize)
                        score_val = int(release.get("score", "0"))
                        
                        # Return tuple for sorting: 
                        # (diff ASC, has_cover DESC, score DESC)
                        return (diff, -has_cover, -score_val)

                    candidates.sort(key=score_candidate)
                    
                    match = candidates[0]
                    # score variable was unused, removed it.
                    
                    if True: # Score check already done in filtering
                        album.mb_release_id = match.get("id")
                        album.title = match.get("title")
                        if "artist-credit" in match:
                             album.artist = match["artist-credit"][0]["name"]
                            
                        # Secondary Lookup for Comprehensive Metadata
                        try:
                            # 1 req/sec max usually, but we are inside a serial loop in identify_all? 
                            # If identify_all calls this, we should sleep effectively.
                            # We need detailed info: recordings, isrcs, labels, artist-credits, release-groups, url-rels
                            lookup_params = {
                                "inc": "recordings+artist-credits+labels+isrcs+release-groups+url-rels"
                            }

                            await asyncio.sleep(1.1)
                            # Reuse existing client (active_client)
                            
                            det_resp = None
                            # Retry loop for secondary lookup as well? MusicBrainz might rate limit here too.
                            # Simpler: Just one try with the active client, or maybe minimal retry.
                            # Let's trust the outer retry is mostly for initial connection, but 503 can happen anywhere.
                            # For now, standard single try on active_client to avoid complexity explosion, 
                            # as connection pooling solves most issues.
                            
                            det_resp = await active_client.get(
                                f"{self.BASE_URL}/release/{album.mb_release_id}", 
                                params=lookup_params, 
                                headers=headers
                            )
                            
                            if det_resp.status_code == 200:
                                details = det_resp.json()
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
                                meta['date'] = details.get('date', '')
                                meta['originaldate'] = details.get('date', '')
                                
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
                                        meta['musicbrainz_albumartistid'] = (
                                            ac['artist'].get('id', '')
                                        )
                                        meta['albumartist'] = ac['artist'].get('name', '')
                                        
                                    artists_sort = [
                                        item['artist']['sort-name'] for item in ac_list if 'artist' in item
                                    ]
                                    meta['artistsort'] = '; '.join(artists_sort)
                                    
                                    # Full artist list
                                    artists = [item['artist']['name'] for item in ac_list if 'artist' in item]
                                    meta['artists'] = '; '.join(artists)

                                # Media / Discs / Tracks
                                if 'media' in details:
                                    tracks_data = []
                                    total_discs = len(details['media'])
                                    meta['totaldiscs'] = str(total_discs)
                                    
                                    # Flatten all tracks from all discs to match file list?
                                    # Assuming file list might be just files in folder.
                                    # Logic: Iterate all media, collect all tracks.
                                    for current_disc, medium in enumerate(details['media'], start=1):
                                        # We only store disc/track totals for the first matches usually 
                                        # or aggregate? Match metadata.
                                        
                                        if current_disc == 1:
                                            meta['media'] = medium.get('format', '')
                                            meta['discnumber'] = str(medium.get('position', '1'))
                                            meta['totaltracks'] = str(medium.get('track-count', ''))

                                        if 'tracks' in medium:
                                            for track in medium['tracks']:
                                                t_meta = {}
                                                t_meta['musicbrainz_trackid'] = track.get('id', '')
                                                if 'recording' in track:
                                                    rec_id = track['recording'].get('id', '')
                                                    t_meta['musicbrainz_recordingid'] = rec_id
                                                tracks_data.append(t_meta)
                                    
                                    album.tracks_metadata = tracks_data
                                
                                # Store dictionary
                                album.extended_metadata = {k: v for k, v in meta.items() if v}
                                
                        except Exception as e:
                            logger.warning(f"Secondary lookup failed for {album.title}: {repr(e)}")

                        
                        date_str = match.get("date", "")
                        if date_str and date_str[:4].isdigit():
                            album.year = int(date_str[:4])
                            
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

        # Rate limiting compliance (1 req/sec per logic, but here we process list serially or with semaphore)
        await asyncio.sleep(1.1) 
        
        return album

    async def identify_all(self, albums: list[Album]) -> list[Album]:
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            for album in albums:
                await self.identify_album(album, client=client)
        return albums
