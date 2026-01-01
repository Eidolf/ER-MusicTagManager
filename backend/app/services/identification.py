import asyncio
import logging

import httpx

from app.domain.models import Album

logger = logging.getLogger(__name__)

class IdentificationService:
    BASE_URL = "https://musicbrainz.org/ws/2"
    USER_AGENT = "ER-MusicTagManager/1.0.0 ( contact@example.com )"

    async def identify_album(self, album: Album) -> Album:
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
            "limit": 1
        }

        try:
            # verify=False is used here to avoid SSL certificate issues in some Docker/Portable environments.
            # In production with proper certs, this should be True.
            async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
                response = await client.get(f"{self.BASE_URL}/release", params=params, headers=headers)
                
            if response.status_code == 200:
                data = response.json()
                releases = data.get("releases", [])
                
                if releases:
                    match = releases[0]
                    score = int(match.get("score", "0"))
                    
                    if score > 80: # Confidence threshold
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
                            async with httpx.AsyncClient(verify=False, timeout=10.0) as detail_client:
                                await asyncio.sleep(1.1)
                                det_resp = await detail_client.get(
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
                                    meta['status'] = details.get('status', '') # releasestatus
                                    meta['type'] = (
                                        details.get('release-events', [{}])[0]
                                        .get('area', {})
                                        .get('name', '')
                                    ) # Approximating releasecountry/type
                                    
                                    # Label
                                    if 'label-info' in details and details['label-info']:
                                        li = details['label-info'][0]
                                        if 'label' in li:
                                            meta['label'] = li['label'].get('name', '')
                                            meta['catalognumber'] = li.get('catalog-number', '')
                                    
                                    # Date
                                    meta['date'] = details.get('date', '')
                                    meta['originaldate'] = details.get('date', '') # Often same if not digging deeper
                                    
                                    # Release Group
                                    if 'release-group' in details:
                                        rg = details['release-group']
                                        meta['musicbrainz_releasegroupid'] = rg.get('id', '')
                                        meta['musicbrainz_primarytype'] = rg.get('primary-type', '')
                                    
                                    # Artist IDs
                                    if 'artist-credit' in details and details['artist-credit']:
                                        ac = details['artist-credit'][0]
                                        if 'artist' in ac:
                                            meta['musicbrainz_artistid'] = ac['artist'].get('id', '')
                                            meta['musicbrainz_albumartistid'] = (
                                                ac['artist'].get('id', '')
                                            ) # Assuming 1 artist for now
                                            meta['albumartist'] = ac['artist'].get('name', '')
                                            meta['albumartistsort'] = ac['artist'].get('sort-name', '')

                                    # Media / Discs
                                    if 'media' in details and details['media']:
                                        medium = details['media'][0]
                                        meta['media'] = medium.get('format', '')
                                        meta['totaldiscs'] = str(len(details['media']))
                                        meta['discnumber'] = str(medium.get('position', '1'))
                                        meta['totaltracks'] = str(medium.get('track-count', ''))
                                        
                                        # Tracks / Recordings (Assuming mapping 1:1 to files by order is risky?
                                        # Ideally we map by track filename/length match, but for now we stash raw data?
                                        # Or better: We put album-level data here. 
                                        # Track-level data like ISRC needs file-mapping logic.
                                        # For this specific request, let's store album-level data in extended_metadata
                                        # And maybe lists for track data?)
                                    
                                    # Store dictionary
                                    album.extended_metadata = {k: v for k, v in meta.items() if v}
                                    
                        except Exception as e:
                            logger.warning(f"Secondary lookup failed for {album.title}: {e}")

                        
                        date_str = match.get("date", "")
                        if date_str and date_str[:4].isdigit():
                            album.year = int(date_str[:4])
                            
                        album.status = "Match"
                        
                        # Fetch Cover Art URL
                        try:
                            # Optimistic: http://coverartarchive.org/release/{mbid}/front
                            album.cover_art_url = f"http://coverartarchive.org/release/{album.mb_release_id}/front"
                        except Exception as e:
                            logger.warning(f"Could not determine cover art URL: {e}")

                    else:
                        album.status = "Unclear (Low Confidence)"
                else:
                    album.status = "NotFound"
            else:
                logger.error(f"MusicBrainz API Error: {response.status_code}")
                album.status = "API Error"
                
        except Exception as e:
            logger.error(f"Identification failed: {e}")
            album.status = f"Error: {str(e)}"

        # Rate limiting compliance (1 req/sec per logic, but here we process list serially or with semaphore)
        await asyncio.sleep(1.1) 
        
        return album

    async def identify_all(self, albums: list[Album]) -> list[Album]:
        for album in albums:
            await self.identify_album(album)
        return albums
