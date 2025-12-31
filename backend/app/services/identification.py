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
                        # Extract artist credit if needed, logic is complex, simpler for now
                        if "artist-credit" in match:
                             album.artist = match["artist-credit"][0]["name"]
                        
                        date_str = match.get("date", "")
                        if date_str and date_str[:4].isdigit():
                            album.year = int(date_str[:4])
                            
                        album.status = "Match"
                        
                        # Fetch Cover Art URL
                        try:
                            # Cover Art Archive API: http://coverartarchive.org/release/{mbid}
                            # We check if front image exists without full query to save time/bandwidth? 
                            # Or just construct URL and let TaggingService handle 404? 
                            # Better: Check existence briefly or optimistic.
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
