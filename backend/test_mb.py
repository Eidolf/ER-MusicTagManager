import json
import urllib.request

url = "https://musicbrainz.org/ws/2/release?query=artist:Michael%20Jackson%20AND%20release:Thriller&fmt=json&limit=3"
req = urllib.request.Request(url, headers={'User-Agent': 'ERMusicTagManager/0.1.0', 'Accept': 'application/json'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())
    for r in data['releases']:
        print(f"Release: {r['title']} - {r['id']}")
        # print all keys
        print(r.keys())
        # print cover art info if present
        print("cover-art-archive in keys:", 'cover-art-archive' in r)
