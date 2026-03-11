import os
from pathlib import Path

# Create a dummy MP3 and FLAC in a temporary directory
test_dir = Path("/tmp/test_music_scan")
test_dir.mkdir(exist_ok=True, parents=True)

(test_dir / "untagged.mp3").write_bytes(b"\x00" * 1024)

input_path = test_dir
AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.m4a', '.ogg'}

issues = []
for root, _, files in os.walk(input_path):
    audio_files = [f for f in files if Path(f).suffix.lower() in AUDIO_EXTENSIONS]
    if not audio_files:
        continue
        
    root_path = Path(root)
    
    # Check for local cover art
    has_cover = False
    common_covers = ['cover.jpg', 'cover.png', 'folder.jpg', 'folder.png', 'front.jpg', 'front.png']
    for cover_name in common_covers:
        possible_cover = root_path / cover_name
        if possible_cover.exists():
            has_cover = True
            break
        if not has_cover:
             for f in files:
                 if f.lower() == cover_name:
                     has_cover = True
                     break
        if has_cover:
            break
            
    has_mbid = False
    sample_file = root_path / audio_files[0]
    if sample_file.suffix.lower() == '.mp3':
        try:
            from mutagen.id3 import ID3
            tags = ID3(str(sample_file))
            if not has_cover and tags.getall("APIC"):
                has_cover = True
            for frame in tags.getall("TXXX"):
                desc = frame.desc.lower()
                if desc in ('musicbrainz release id', 'musicbrainz_albumid', 'musicbrainz album id'):
                    has_mbid = True
                    break
        except Exception as e:
            print("MP3 EXCEPT:", e)
            pass
    elif sample_file.suffix.lower() == '.flac':
        try:
            from mutagen.flac import FLAC
            tags = FLAC(str(sample_file))
            if not has_cover and tags.pictures:
                has_cover = True
            if 'musicbrainz_albumid' in tags or 'MUSICBRAINZ_ALBUMID' in tags or 'musicbrainz album id' in tags:
                has_mbid = True
        except Exception as e:
            print("FLAC EXCEPT:", e)
            pass

    if not has_cover or not has_mbid:
        issues.append((str(root_path), not has_cover, not has_mbid))

print("Issues found:", len(issues))
print(issues)
