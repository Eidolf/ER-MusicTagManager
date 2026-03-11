import { useState, useEffect } from 'react'

// Injected by Vite
declare const __APP_VERSION__: string;

// --- Types ---
interface MusicFile {
    filename: string;
    path: string;
    extension: string;
    size_bytes: number;
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    extended_tags?: Record<string, string>;
}

interface Album {
    id: string;
    title: string;
    artist: string;
    year?: number;
    path: string;
    files: MusicFile[];
    status?: string;
    cover_art_url?: string;
    local_cover_path?: string;
    mb_release_id?: string;
    tracks_metadata?: Record<string, string>[];
    extended_metadata?: Record<string, string>;
}

interface MusicBrainzRelease {
    id: string;
    title: string;
    "artist-credit"?: { name: string }[];
    "track-count"?: number;
    date?: string;
    "label-info"?: { label: { name: string } }[];
    score?: string;
    "cover-art-archive"?: { front: boolean };
}

interface LibraryHealthIssue {
    folder_path: string;
    missing_cover: boolean;
    missing_mbid: boolean;
    track_count: number;
    found_mbid?: string;
    cover_base64?: string;
}

// --- Components ---

// --- Components ---
const MetadataDiffModal = ({ file, original, onClose }: { file: MusicFile, original?: MusicFile, onClose: () => void }) => {
    // Collect all unique keys
    const allKeys = new Set<string>();

    // Standard keys
    ['title', 'artist', 'album', 'year'].forEach(k => allKeys.add(k));

    // Extended keys
    // We don't have extended tags in frontend model explicit properties for 'original' scan unless we store it.
    // However, the 'file' object is from the 'tagged' response which has 'extended_tags'.
    // The 'original' object is from 'scanned' response.
    // Since we don't scan deep extended metadata initially in scan_directory (only easyid3 standard),
    // the diff for extended tags will mostly be New vs None.

    if (file.extended_tags) Object.keys(file.extended_tags).forEach(k => allKeys.add(k));

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-8" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <h2 className="text-xl font-bold text-white">Metadata Changes: <span className="text-primary font-mono text-sm">{file.filename}</span></h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="grid grid-cols-3 gap-4 font-bold text-gray-400 mb-2 px-2">
                    <div>Field</div>
                    <div>Original (Scan)</div>
                    <div>New (Tag)</div>
                </div>

                <div className="space-y-1">
                    {Array.from(allKeys).sort().map(key => {
                        // @ts-expect-error: Dynamic key access
                        const origVal = original ? (original[key] || original.extended_tags?.[key] || '-') : '-';
                        // @ts-expect-error: Dynamic key access
                        const newVal = file[key] || file.extended_tags?.[key] || '-';

                        const isDifferent = String(origVal) !== String(newVal);

                        return (
                            <div key={key} className={`grid grid-cols-3 gap-4 px-2 py-2 rounded ${isDifferent ? 'bg-gray-700/50' : ''}`}>
                                <div className="text-gray-400 font-mono text-xs uppercase">{key}</div>
                                <div className="text-gray-500 text-sm truncate" title={String(origVal)}>{String(origVal)}</div>
                                <div className={`text-sm truncate font-medium ${isDifferent ? 'text-green-400' : 'text-gray-500'}`} title={String(newVal)}>
                                    {String(newVal)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const DetailsModal = ({ title, data, onClose, type, onDiff, onManualIdentify, onWrite, onUpdateCover }: {
    title: string,
    data: Album[],
    onClose: () => void,
    type: string,
    onDiff?: (file: MusicFile) => void,
    onManualIdentify?: (album: Album) => void,
    onWrite?: (album: Album) => void,
    onUpdateCover?: (albumId: string, url: string) => void
}) => {
    // State moved here - SAFE now
    const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
    const [editingCoverId, setEditingCoverId] = useState<string | null>(null);
    const [coverUrlInput, setCoverUrlInput] = useState("");

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-primary">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                {data.length === 0 ? (
                    <p className="text-gray-400">No data available yet.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {data.map((album, idx) => (
                            <div key={idx} className={`p-4 rounded-lg border flex flex-col gap-4 ${album.status?.startsWith('Error') || album.status === 'API Error' ? 'bg-red-900/20 border-red-700' : 'bg-gray-900/50 border-gray-700'}`}>
                                <div className="flex gap-4">
                                    {/* Cover Art Preview */}
                                    <div
                                        className={`w-24 h-24 flex-shrink-0 bg-gray-800 rounded relative overflow-hidden flex flex-col items-center justify-center text-gray-500 text-xs text-center border ${album.cover_art_url ? 'border-gray-700' : 'border-dashed border-gray-600'} ${onUpdateCover ? 'cursor-pointer hover:opacity-80 transition-opacity group' : ''}`}
                                        onClick={() => {
                                            if (onUpdateCover && !album.cover_art_url) {
                                                const query = encodeURIComponent(`${album.artist} ${album.title} cover art`);
                                                window.open(`https://www.google.com/search?q=${query}&tbm=isch&tbs=isz:l`, '_blank');
                                                setCoverUrlInput("");
                                                setEditingCoverId(album.id);
                                            }
                                        }}
                                        title={onUpdateCover ? "Click to search for and manually set/override the cover image" : (album.cover_art_url ? "Cover Art" : "No Cover Available")}
                                    >
                                        {album.cover_art_url ? (
                                            <>
                                                <img src={album.cover_art_url} alt="Cover" className="w-full h-full object-cover" />
                                                {onUpdateCover && (
                                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                                        <span className="text-white font-bold tracking-wider text-[10px] mb-2">CHANGE COVER</span>
                                                        <button
                                                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded w-full mb-1"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const query = encodeURIComponent(`${album.artist} ${album.title} cover art`);
                                                                window.open(`https://www.google.com/search?q=${query}&tbm=isch&tbs=isz:l`, '_blank');
                                                                setCoverUrlInput("");
                                                                setEditingCoverId(album.id);
                                                            }}
                                                        >
                                                            1. Search Web
                                                        </button>
                                                        <button
                                                            className="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2 py-1 rounded w-full"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCoverUrlInput("");
                                                                setEditingCoverId(album.id);
                                                            }}
                                                        >
                                                            2. Paste URL
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="p-1 flex flex-col items-center justify-center h-full w-full">
                                                <svg className="w-6 h-6 mx-auto mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                <span>No Cover<br />(Click to Search)</span>
                                            </div>
                                        )}
                                        {/* Inline Input Overlay */}
                                        {editingCoverId === album.id && (
                                            <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-2 z-10" onClick={e => e.stopPropagation()}>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={coverUrlInput}
                                                    onChange={e => setCoverUrlInput(e.target.value)}
                                                    placeholder="Paste Image URL..."
                                                    className="w-full text-xs p-1 mb-2 bg-gray-800 border border-gray-600 text-white rounded"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            if (coverUrlInput.trim() && onUpdateCover) onUpdateCover(album.id, coverUrlInput.trim());
                                                            setEditingCoverId(null);
                                                        }
                                                        if (e.key === 'Escape') setEditingCoverId(null);
                                                    }}
                                                />
                                                <div className="flex gap-1 w-full justify-between">
                                                    <button
                                                        className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-2 py-1 rounded"
                                                        onClick={(e) => { e.stopPropagation(); setEditingCoverId(null); }}
                                                    >Cancel</button>
                                                    <button
                                                        className="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2 py-1 rounded"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (coverUrlInput.trim() && onUpdateCover) onUpdateCover(album.id, coverUrlInput.trim());
                                                            setEditingCoverId(null);
                                                        }}
                                                    >Save</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-lg text-white">{album.artist} - {album.title} {album.year && `(${album.year})`}</h3>
                                                <div className="text-sm text-gray-400">
                                                    <p>Path: <span className="font-mono text-xs text-gray-500">{album.path}</span></p>
                                                    <p className="mt-1">Tracks in folder: <span className="font-bold text-gray-300">{album.files.length}</span></p>
                                                    {album.mb_release_id && (
                                                        <p className="mt-1">MBID: <span className="font-mono text-xs text-primary">{album.mb_release_id}</span></p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div
                                                    onClick={() => (album.status?.startsWith('Error') || album.status === 'API Error') && alert(album.status)}
                                                    className={`px-2 py-1 rounded text-xs font-bold uppercase whitespace-nowrap ${(album.status?.startsWith('Error') || album.status === 'API Error') ? 'cursor-pointer hover:bg-red-800' : ''} ${album.status === 'Match' ? 'bg-green-900 text-green-400' :
                                                        album.status === 'Unclear' ? 'bg-yellow-900 text-yellow-400' :
                                                            (album.status?.startsWith('Error') || album.status === 'API Error') ? 'bg-red-900 text-red-200' :
                                                                'bg-gray-700'
                                                        }`}>
                                                    {(album.status?.startsWith('Error')) ? <span className="flex items-center justify-center gap-1">Error <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span> : (album.status || 'Pending')}
                                                </div>

                                                {/* Toggle Button for Details */}
                                                <button
                                                    onClick={() => setExpandedAlbumId(expandedAlbumId === album.id ? null : album.id)}
                                                    className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                                                >
                                                    {expandedAlbumId === album.id ? "Hide Tracks" : "Show Tracks"}
                                                </button>

                                                {/* Manual Fix / Change Release Button */}
                                                {onManualIdentify && (
                                                    <button
                                                        onClick={() => onManualIdentify(album)}
                                                        className={`text-xs px-3 py-1 rounded transition-colors text-white ${album.status === 'Match'
                                                            ? 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                                                            : 'bg-yellow-700 hover:bg-yellow-600'
                                                            }`}
                                                    >
                                                        {album.status === 'Match' ? 'Change Release' : 'Deep Search'}
                                                    </button>
                                                )}

                                                {/* Write Button in Modal */}
                                                {onWrite && album.status === 'Match' && (
                                                    <button
                                                        onClick={() => onWrite(album)}
                                                        className="text-xs px-3 py-1 rounded transition-colors text-white bg-blue-600 hover:bg-blue-500 shadow-sm border border-blue-500"
                                                    >
                                                        Confirm & Write
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Extended Metadata Display */}
                                        {album.extended_metadata && (
                                            <div className="mt-4 bg-gray-800/50 rounded p-3 text-xs text-gray-400 border border-gray-700/30">
                                                <h4 className="font-bold text-gray-500 mb-2 uppercase tracking-wider">Extended Tags (MusicBrainz)</h4>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                    {Object.entries(album.extended_metadata).map(([key, value]) => {
                                                        if (!value) return null;
                                                        // Filter readable keys if needed, or show all
                                                        const label = key.replace('musicbrainz_', '').replace(/_/g, ' ');
                                                        return (
                                                            <div key={key} className="flex gap-2">
                                                                <span className="font-mono text-gray-500 capitalize min-w-[100px]">{label}:</span>
                                                                <span className="text-gray-300 break-all">{value}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Diff View (Album Level) - Only for 'tagged' view */}
                                        {type === 'tagged' && album.status === 'Match' && (
                                            <div className="mt-4 bg-gray-800/50 rounded p-3 text-sm">
                                                <div className="grid grid-cols-3 gap-4 font-semibold text-gray-400 border-b border-gray-700 pb-1 mb-2">
                                                    <div>Field</div>
                                                    <div>Current State</div>
                                                    <div>Value</div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4 py-1 border-b border-gray-700/50">
                                                    <div className="text-gray-400">Artist</div>
                                                    <div className="text-gray-500">Current</div>
                                                    <div className="text-green-400 text-shadow-glow">{album.artist}</div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4 py-1 border-b border-gray-700/50">
                                                    <div className="text-gray-400">Album</div>
                                                    <div className="text-gray-500">Current</div>
                                                    <div className="text-green-400 text-shadow-glow">{album.title}</div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4 py-1">
                                                    <div className="text-gray-400">Year</div>
                                                    <div className="text-gray-500">Current</div>
                                                    <div className="text-green-400 text-shadow-glow">{album.year || "-"}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Track List */}
                                {expandedAlbumId === album.id && (
                                    <div className="mt-2 bg-gray-800/80 rounded p-4 border-t border-gray-700 animate-in fade-in slide-in-from-top-2">
                                        <h4 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">Track Details</h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-xs text-gray-400">
                                                <thead className="text-gray-500 border-b border-gray-700 font-mono">
                                                    <tr>
                                                        <th className="py-2 px-2">Filename</th>
                                                        <th className="py-2 px-2">Title</th>
                                                        <th className="py-2 px-2">Artist</th>
                                                        <th className="py-2 px-2">Album</th>
                                                        <th className="py-2 px-2">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/50">
                                                    {album.files.map((f: MusicFile, i: number) => (
                                                        <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                                                            <td className="py-2 px-2 font-mono text-gray-300">{f.filename}</td>
                                                            <td className="py-2 px-2 text-white">{f.title || "-"}</td>
                                                            <td className="py-2 px-2">{f.artist || "-"}</td>
                                                            <td className="py-2 px-2">{f.album || "-"}</td>
                                                            <td className="py-2 px-2">
                                                                {type === 'tagged' && (
                                                                    <button
                                                                        onClick={() => onDiff && onDiff(f)}
                                                                        className="text-primary hover:text-blue-400 underline"
                                                                    >
                                                                        Diff
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const CoverIndicator = ({ releaseId }: { releaseId: string }) => {
    const [hasCover, setHasCover] = useState<boolean | null>(null);
    useEffect(() => {
        let isMounted = true;
        fetch(`https://coverartarchive.org/release/${releaseId}/front-250.jpg`, { method: 'HEAD' })
            .then(res => {
                if (isMounted) setHasCover(res.ok);
            })
            .catch(() => {
                if (isMounted) setHasCover(false);
            });
        return () => { isMounted = false; };
    }, [releaseId]);

    if (hasCover === null) {
        return <span className="text-gray-400 text-[10px] px-2 py-0.5 italic">Checking cover...</span>;
    }

    return hasCover ? (
        <span className="bg-green-900 border-green-500 text-green-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border shadow-sm flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a2.25 2.25 0 00-3.182 0l-1.44 1.439-2.25-1.5a2.25 2.25 0 00-2.438.037L2.5 11.06zm15-4.31l-3.22 3.22a.75.75 0 00-1.06 0L11.78 8.53a.75.75 0 00-1.06 0l-8.22 8.22v-3.69l3.22-3.22a.75.75 0 011.06 0l1.44 1.439 2.25-1.5a.75.75 0 01.813-.037L17.5 11.06v-4.31z" clipRule="evenodd" />
                <path d="M5.5 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            YES Cover
        </span>
    ) : (
        <span className="bg-red-900 border-red-500 text-red-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase border shadow-sm flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            NO Cover
        </span>
    );
};

const ManualSearchModal = ({ album, onClose, onResolve, onUpdateCover }: { album: Album, onClose: () => void, onResolve: (updatedAlbum: Album) => void, onUpdateCover?: (albumId: string, url: string) => void }) => {
    const [artistQuery, setArtistQuery] = useState(album.artist === "Unknown Artist" ? "" : album.artist);
    const [albumQuery, setAlbumQuery] = useState(album.title);
    const [results, setResults] = useState<MusicBrainzRelease[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [isEditingCover, setIsEditingCover] = useState(false);
    const [coverUrlInput, setCoverUrlInput] = useState("");

    const handleSearch = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/identify/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist: artistQuery, album: albumQuery })
            });
            const data = await res.json();
            setResults(data);
        } catch (e) {
            console.error(e);
            alert("Search failed");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (releaseId: string) => {
        setAnalyzing(true);
        try {
            const res = await fetch('/api/v1/identify/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ album: album, mb_release_id: releaseId })
            });
            const updatedAlbum = await res.json();
            onResolve(updatedAlbum);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Resolution failed");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-8" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <h2 className="text-xl font-bold text-white">Manual Identification logs: <span className="text-primary font-mono text-sm">{album.title}</span></h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="flex gap-4 mb-6 items-center">
                    {/* Add Current Cover Preview to Modal */}
                    <div
                        className={`w-16 h-16 flex-shrink-0 bg-gray-800 rounded relative overflow-hidden flex flex-col items-center justify-center text-gray-500 text-[10px] text-center border ${album.cover_art_url ? 'border-gray-700' : 'border-dashed border-gray-600'} ${onUpdateCover ? 'cursor-pointer hover:opacity-80 transition-opacity group' : ''}`}
                        onClick={() => {
                            if (onUpdateCover && !album.cover_art_url) {
                                const query = encodeURIComponent(`${album.artist} ${album.title} cover art`);
                                window.open(`https://www.google.com/search?q=${query}&tbm=isch&tbs=isz:l`, '_blank');
                                setCoverUrlInput("");
                                setIsEditingCover(true);
                            }
                        }}
                        title={onUpdateCover ? "Click to search for and manually set/override the cover image for this album" : (album.cover_art_url ? "Cover Art" : "No Cover Available")}
                    >
                        {album.cover_art_url ? (
                            <>
                                <img src={album.cover_art_url} alt="Cover" className="w-full h-full object-cover" />
                                {onUpdateCover && (
                                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                        <button
                                            className="bg-blue-600 hover:bg-blue-500 text-white text-[8px] px-1 py-1 rounded w-full mb-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const query = encodeURIComponent(`${album.artist} ${album.title} cover art`);
                                                window.open(`https://www.google.com/search?q=${query}&tbm=isch&tbs=isz:l`, '_blank');
                                                setCoverUrlInput("");
                                                setIsEditingCover(true);
                                            }}
                                        >
                                            Search
                                        </button>
                                        <button
                                            className="bg-green-600 hover:bg-green-500 text-white text-[8px] px-1 py-1 rounded w-full"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCoverUrlInput("");
                                                setIsEditingCover(true);
                                            }}
                                        >
                                            Paste
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-1 flex flex-col items-center justify-center h-full w-full">
                                <svg className="w-5 h-5 mx-auto mb-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <span>No Cover</span>
                            </div>
                        )}
                        {/* Inline Input Overlay */}
                        {isEditingCover && (
                            <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-1 z-10" onClick={e => e.stopPropagation()}>
                                <input
                                    autoFocus
                                    type="text"
                                    value={coverUrlInput}
                                    onChange={e => setCoverUrlInput(e.target.value)}
                                    placeholder="URL..."
                                    className="w-full text-[10px] p-1 mb-1 bg-gray-800 border border-gray-600 text-white rounded"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            if (coverUrlInput.trim() && onUpdateCover) onUpdateCover(album.id, coverUrlInput.trim());
                                            setIsEditingCover(false);
                                        }
                                        if (e.key === 'Escape') setIsEditingCover(false);
                                    }}
                                />
                                <div className="flex gap-1 w-full justify-between">
                                    <button
                                        className="bg-red-600 hover:bg-red-500 text-white text-[8px] px-1 rounded"
                                        onClick={(e) => { e.stopPropagation(); setIsEditingCover(false); }}
                                    >X</button>
                                    <button
                                        className="bg-green-600 hover:bg-green-500 text-white text-[8px] px-1 rounded flex-1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (coverUrlInput.trim() && onUpdateCover) onUpdateCover(album.id, coverUrlInput.trim());
                                            setIsEditingCover(false);
                                        }}
                                    >Save</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <input
                        className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white flex-1"
                        placeholder="Artist"
                        value={artistQuery}
                        onChange={e => setArtistQuery(e.target.value)}
                    />
                    <input
                        className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white flex-1"
                        placeholder="Album"
                        value={albumQuery}
                        onChange={e => setAlbumQuery(e.target.value)}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded font-bold disabled:opacity-50"
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </div>

                {analyzing && (
                    <div className="text-center py-8">
                        <div className="text-yellow-400 text-xl font-bold animate-pulse">Resolving & Fetching Metadata...</div>
                    </div>
                )}

                <div className="space-y-2">
                    {results.map((r) => {
                        const trackCount = r["track-count"] || "?";
                        const year = r["date"] || "Unknown";
                        const label = r["label-info"]?.[0]?.label?.name || "-";

                        return (
                            <div key={r.id} className="bg-gray-700/50 p-3 rounded flex justify-between items-center hover:bg-gray-700 transition">
                                <div>
                                    <div className="font-bold text-white">{r.title} <span className="text-sm font-normal text-gray-400">by {r["artist-credit"]?.[0]?.name}</span></div>
                                    <div className="text-xs text-gray-400 flex items-center gap-4 mt-1">
                                        <span>Year: {year}</span>
                                        <span>Tracks: {trackCount}</span>
                                        <span>Label: {label}</span>
                                        <span>Score: {r.score}</span>
                                        <CoverIndicator releaseId={r.id} />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSelect(r.id)}
                                    disabled={analyzing}
                                    className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded"
                                >
                                    Select & Preview
                                </button>
                            </div>
                        )
                    })}
                    {results.length === 0 && !loading && (
                        <p className="text-gray-500 text-center italic">No results found. Try adjusting the search terms.</p>
                    )}
                </div>
            </div>
        </div>
    )

}

const LibraryHealthModal = ({ results, onClose, onFixFolder }: { results: LibraryHealthIssue[], onClose: () => void, onFixFolder: (path: string) => void }) => {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const toggleExpand = (path: string) => {
        const next = new Set(expanded);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpanded(next);
    };

    const displayResults = [...results].sort((a, b) => {
        // Sort issues first
        const aIssue = a.missing_cover || a.missing_mbid ? 1 : 0;
        const bIssue = b.missing_cover || b.missing_mbid ? 1 : 0;
        if (aIssue !== bIssue) return bIssue - aIssue;
        return a.folder_path.localeCompare(b.folder_path);
    });

    const issuesCount = results.filter(r => r.missing_cover || r.missing_mbid).length;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-8" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 max-w-5xl w-full max-h-[90vh] flex flex-col border border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4 shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>Library Health Check</span>
                        <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">{results.length} Folders</span>
                        {issuesCount > 0 && <span className="bg-red-900/50 text-red-200 text-xs px-2 py-1 rounded-full">{issuesCount} Issues</span>}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                {results.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-700/20 rounded-lg shrink-0">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        No audio folders found in the scanned directory!
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        <div className="grid grid-cols-12 gap-4 font-bold text-gray-400 mb-2 px-2 text-sm sticky top-0 bg-gray-800 py-2 border-b border-gray-700 z-10">
                            <div className="col-span-7">Folder Path</div>
                            <div className="col-span-2 text-center">Tracks</div>
                            <div className="col-span-2 text-center">Status</div>
                            <div className="col-span-1 text-right">Action</div>
                        </div>
                        {displayResults.map((issue, idx) => (
                            <div key={idx} className="bg-gray-700/50 rounded hover:bg-gray-700 transition flex flex-col border border-transparent hover:border-gray-600">
                                <div className="grid grid-cols-12 gap-4 p-3 items-center cursor-pointer" onClick={() => toggleExpand(issue.folder_path)}>
                                    <div className="col-span-7 font-mono text-xs text-gray-300 truncate" title={issue.folder_path}>
                                        {issue.folder_path}
                                    </div>
                                    <div className="col-span-2 text-center text-gray-400 text-sm">{issue.track_count}</div>
                                    <div className="col-span-2 flex justify-center gap-1">
                                        {issue.missing_mbid && <span className="bg-red-900/50 text-red-300 text-[10px] px-2 py-0.5 rounded border border-red-800 font-bold" title="Missing MusicBrainz ID">MBID</span>}
                                        {issue.missing_cover && <span className="bg-yellow-900/50 text-yellow-300 text-[10px] px-2 py-0.5 rounded border border-yellow-800 font-bold" title="Missing Cover Art">COVER</span>}
                                        {!issue.missing_mbid && !issue.missing_cover && <span className="text-green-400" title="All Good"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>}
                                    </div>
                                    <div className="col-span-1 text-right flex justify-end gap-2 items-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onFixFolder(issue.folder_path);
                                                onClose();
                                            }}
                                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded transition shadow-sm"
                                            title="Load this folder for processing"
                                        >
                                            Load
                                        </button>
                                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded.has(issue.folder_path) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                                {expanded.has(issue.folder_path) && (
                                    <div className="p-4 bg-gray-900/80 text-sm border-t border-gray-600/50">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-4">
                                                <div className="bg-gray-800 rounded-lg w-16 h-16 flex items-center justify-center shrink-0 overflow-hidden border border-gray-700 shadow-inner">
                                                    {issue.cover_base64 ? (
                                                        <img src={issue.cover_base64} alt="Cover Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    )}
                                                </div>
                                                <div className="py-1">
                                                    <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">Cover Art</div>
                                                    {issue.missing_cover ? <div className="text-red-400 font-medium">Missing ❌</div> : <div className="text-green-400 font-medium flex items-center gap-1">Found <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="bg-gray-800 rounded-lg w-16 h-16 flex items-center justify-center shrink-0 border border-gray-700">
                                                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                                                </div>
                                                <div className="py-1">
                                                    <div className="text-gray-400 text-xs font-bold mb-1 uppercase tracking-wider">MusicBrainz ID</div>
                                                    {issue.missing_mbid ? <div className="text-red-400 font-medium">Missing ❌</div> : <div className="text-green-400 font-mono text-xs bg-green-900/30 px-2 py-1 rounded inline-block">{issue.found_mbid || 'Present (Unknown ID format)'}</div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const HelpModal = ({ onClose }: { onClose: () => void }) => {
    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[80] p-8" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-600" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="flex items-center gap-2"><svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> ER-MusicTagManager Guide</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="space-y-6 text-gray-300 text-sm">
                    <section>
                        <h3 className="text-primary font-bold text-lg mb-2">1. Library Health Check</h3>
                        <p>Quickly scan your library to find missing album artwork or MusicBrainz IDs without modifying any files or doing deep metadata lookups. Use this to identify which folders need your attention.</p>
                    </section>

                    <section>
                        <h3 className="text-orange-500 font-bold text-lg mb-2">2. Processing Workflow</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>Input & Output Directories:</strong> Enter the source folder of untagged music and a clean destination folder.</li>
                            <li><strong>Start Processing:</strong> Scans files, identifies albums via MusicBrainz, and stages them for review.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-red-400 font-bold text-lg mb-2">3. Manual Identification (Review & Fix)</h3>
                        <p>Albums that couldn't be perfectly matched automatically will end up here. Click <strong>Review & Fix</strong> to:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Click <strong>Deep Search</strong> to query MusicBrainz manually.</li>
                            <li>Click the <strong>No Cover</strong> prompt to quickly search Google Images and paste an image URL.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-green-500 font-bold text-lg mb-2">4. Writing and Organizing</h3>
                        <p>Once everything is matched, click <strong>Write All</strong> to embed the new ID3/FLAC metadata (tags, cover art) into the files and move them into the output directory structured by <code>Artist/Album/File</code>.</p>
                    </section>
                </div>

                <div className="mt-8 text-right">
                    <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded font-bold transition">Got it</button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---

function App() {
    const [stats, setStats] = useState({ scanned: 0, identified: 0, tagged: 0 });
    const [status, setStatus] = useState("Idle");
    const [mbStatus, setMbStatus] = useState<{ status: string, message: string }>({ status: 'checking', message: 'Checking...' });

    // Inputs
    const [inputPath, setInputPath] = useState("");
    const [outputPath, setOutputPath] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    // Data & Progress
    const [scannedAlbums, setScannedAlbums] = useState<Album[]>([]);
    const [identifiedAlbums, setIdentifiedAlbums] = useState<Album[]>([]);
    const [taggedAlbums, setTaggedAlbums] = useState<Album[]>([]);
    const [organizeProgress, setOrganizeProgress] = useState(0);

    // UI View State
    const [viewDetails, setViewDetails] = useState<string | null>(null);
    const [diffFile, setDiffFile] = useState<{ file: MusicFile, original?: MusicFile } | null>(null);
    const [manualFixAlbum, setManualFixAlbum] = useState<Album | null>(null);
    const [manuallyFixedIds, setManuallyFixedIds] = useState<Set<string>>(new Set());

    // Library Health State
    const [libraryHealthResults, setLibraryHealthResults] = useState<LibraryHealthIssue[] | null>(null);
    const [isHealthScanning, setIsHealthScanning] = useState(false);

    // Help UI
    const [showHelp, setShowHelp] = useState(false);

    // --- Effects ---
    useEffect(() => {
        checkBackend();
        checkMusicBrainz();
    }, []);

    const checkBackend = () => {
        setStatus("Connecting...");
        fetch('/api/v1/health')
            .then(res => res.json())
            .then(data => {
                console.log("Backend status:", data);
                setStatus("Online");
            })
            .catch(err => {
                console.error("Backend offline:", err);
                setStatus("Offline");
            });
    };

    const checkMusicBrainz = async () => {
        try {
            const res = await fetch('/api/v1/connectivity/musicbrainz');
            const data = await res.json();
            setMbStatus(data);
        } catch (e) {
            setMbStatus({ status: 'offline', message: 'Connection Failed' });
        }
    };

    const handleShutdown = async () => {
        if (!confirm("Are you sure you want to shut down the application?")) return;
        try {
            await fetch('/api/v1/system/shutdown', { method: 'POST' });
            alert("Application is shutting down. You can close this window.");
            setStatus("Offline");
        } catch (e) {
            console.error("Shutdown failed", e);
        }
    }

    const handleHealthScan = async () => {
        if (!inputPath) {
            alert("Please enter an Input Directory (Scan) to check your library.");
            return;
        }
        setIsHealthScanning(true);
        setStatus("Health Checking...");
        setLibraryHealthResults(null);

        try {
            const res = await fetch('/api/v1/library-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input_path: inputPath })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Health scan failed");
            }
            const data: LibraryHealthIssue[] = await res.json();
            setLibraryHealthResults(data);
            setStatus("Idle");
        } catch (err) {
            const e = err as Error;
            console.error(e);
            alert("Health scan error: " + e.message);
            setStatus("Error");
        } finally {
            setIsHealthScanning(false);
        }
    };

    // --- Main Workflow ---
    const handleStart = async () => {
        if (!inputPath || !outputPath) {
            alert("Please enter both input and output paths.");
            return;
        }
        setIsProcessing(true);
        setOrganizeProgress(0); // Reset progress

        // Reset previous data
        setScannedAlbums([]);
        setIdentifiedAlbums([]);
        setTaggedAlbums([]);
        setManuallyFixedIds(new Set());

        try {
            // Step 1: Scan
            setStatus("Scanning...");
            const scanRes = await fetch('/api/v1/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input_path: inputPath, output_path: outputPath })
            });

            if (!scanRes.ok) {
                const errText = await scanRes.text();
                throw new Error(`Scan failed: ${errText}`);
            }
            const albums = await scanRes.json();

            if (!albums || albums.length === 0) {
                setStatus("No files found");
                alert(`No audio files found in: ${inputPath}`);
                return;
            }

            setScannedAlbums(albums);
            const totalFiles = albums.reduce((acc: number, album: Album) => acc + (album.files ? album.files.length : 0), 0);
            setStats(prev => ({ ...prev, scanned: totalFiles }));

            // Step 2: Identify (MusicBrainz)
            setStatus("Identifying...");
            const idRes = await fetch('/api/v1/identify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(albums)
            });
            const identifiedData = await idRes.json();
            setIdentifiedAlbums(identifiedData);

            const matchedCount = identifiedData.filter((a: Album) => a.status === 'Match').length;
            setStats(prev => ({ ...prev, identified: matchedCount }));

            // Step 3: Tag
            setStatus("Tagging...");
            const tagRes = await fetch('/api/v1/tag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(identifiedData)
            });
            if (!tagRes.ok) {
                const errText = await tagRes.text();
                throw new Error(`Tagging failed: ${errText}`);
            }
            const taggedData = await tagRes.json();
            setTaggedAlbums(taggedData);
            const totalTagged = taggedData.reduce((acc: number, album: Album) => acc + (album.files ? album.files.length : 0), 0);
            setStats(prev => ({ ...prev, tagged: totalTagged }));

            // Step 4: Organize (Batched)
            setStatus("Organizing...");
            let processedCount = 0;
            const totalAlbums = taggedData.length;

            if (totalAlbums === 0) {
                setOrganizeProgress(100);
            } else {
                // Sequential processing
                for (const album of taggedData) {
                    await fetch('/api/v1/organize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            albums: [album], // Send one by one
                            output_path: outputPath
                        })
                    });

                    processedCount++;
                    setOrganizeProgress(Math.round((processedCount / totalAlbums) * 100));
                }
            }

            setStatus("Finished");
        } catch (err: unknown) {
            console.error(err);
            setStatus("Error");
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Error: ${msg}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper to get modal data
    const getModalData = () => {
        if (viewDetails === 'scanned') return { title: 'Scanned Albums', data: scannedAlbums };
        if (viewDetails === 'identified') return { title: 'Identified Albums (MB)', data: identifiedAlbums };
        if (viewDetails === 'tagged') return { title: 'Tagged Albums', data: taggedAlbums };
        if (viewDetails === 'unidentified') return {
            title: 'Unidentified Albums',
            data: identifiedAlbums.filter(a => a.status !== 'Match' || manuallyFixedIds.has(a.id))
        };
        return null;
    };

    const handleDiff = (file: MusicFile) => {
        // Find original file from scannedAlbums
        // Weak matching by filename + albumId (path in scanned) mostly unique
        // Or we just search through all scannedAlbums since we don't have direct mapping ID persisted easily
        // But scannedAlbums structure mirros taggedAlbums structure mostly (except when ID changed?)

        let original: MusicFile | undefined;
        // Optimization: Find album in scanned with same path/ID
        // Note: ID in tagged/identified might be MBID-based? No, we kept path-based ID in 'scan' logic unless changed.
        // Wait, identification.py replaces ID? No, it updates MBID field. ID field stays path often?
        // Let's assume ID is stable-ish or search by path.

        for (const alb of scannedAlbums) {
            // Find file
            const found = alb.files.find(f => f.filename === file.filename && f.size_bytes === file.size_bytes);
            if (found) {
                original = found;
                break;
            }
        }

        setDiffFile({ file, original });
    }

    const handleManualResolve = (updatedAlbum: Album) => {
        // Warning if identical
        const original = identifiedAlbums.find(a => a.id === updatedAlbum.id);
        if (original && original.mb_release_id === updatedAlbum.mb_release_id && original.status === 'Match') {
            // Optional: Toast or Alert
            // alert("This album is already matched to this release!"); 
            // But maybe the user wants to re-apply tags? So just proceed but maybe log or non-blocking warn.
            console.log("Re-applying same release");
        }
        // Optimistic update of file metadata for preview
        if (updatedAlbum.tracks_metadata && updatedAlbum.files.length === updatedAlbum.tracks_metadata.length) {
            updatedAlbum.files = updatedAlbum.files.map((f, i) => {
                const tm = updatedAlbum.tracks_metadata![i];
                return {
                    ...f,
                    title: tm.title || f.title,
                    artist: tm.artist || updatedAlbum.artist || f.artist,
                    album: updatedAlbum.title || f.album
                };
            });
        }

        // Update in identifiedAlbums
        // Progressive Focus Logic:
        // 1. Mark the album as fixed.
        // 2. Filter the session to ONLY show:
        //    - The album we just fixed.
        //    - Any other albums that are still Unidentified (need attention).
        //    - Any other albums we already Manually Fixed in this session.
        //    - REMOVE albums that were automatically Matched and never touched (they are "done").

        const nextManuallyFixedIds = new Set(manuallyFixedIds);
        nextManuallyFixedIds.add(updatedAlbum.id);

        setManuallyFixedIds(nextManuallyFixedIds);

        // Apply update first
        const updatedList = identifiedAlbums.map(a => a.id === updatedAlbum.id ? updatedAlbum : a);

        // Filter list
        const focusedList = updatedList.filter(a => {
            const isUnidentified = a.status !== 'Match';
            const isManuallyFixed = nextManuallyFixedIds.has(a.id);
            return isUnidentified || isManuallyFixed;
        });

        // Update Session State immediately to reflect "Focus"
        setIdentifiedAlbums(focusedList);
        setScannedAlbums(focusedList); // Also filter scanned view
        setTaggedAlbums(prev => prev.filter(a => focusedList.find(fa => fa.id === a.id))); // Sync tagged view

        // Update Stats
        const scannedCount = focusedList.reduce((acc, a) => acc + (a.files ? a.files.length : 0), 0);
        const identifiedCount = focusedList.filter(a => a.status === 'Match').length;
        setStats({
            scanned: scannedCount,
            identified: identifiedCount,
            tagged: 0 // Reset tagged count as we are effectively "re-identifying" in a new sub-session
        });
    };

    const handleReprocess = async () => {
        if (identifiedAlbums.length === 0) return;

        // Focus Mode Logic: Filter to manually fixed albums if any exist
        let albumsToProcess = identifiedAlbums;
        if (manuallyFixedIds.size > 0) {
            albumsToProcess = identifiedAlbums.filter(a => manuallyFixedIds.has(a.id));

            // Visual Reset: Update session state to only show the subset being processed
            // This satisfies the user request to hide "done" albums and reset stats
            if (albumsToProcess.length > 0) {
                setScannedAlbums(albumsToProcess);
                setIdentifiedAlbums(albumsToProcess);
                setTaggedAlbums([]);

                const subsetFileCount = albumsToProcess.reduce((acc, a) => acc + (a.files ? a.files.length : 0), 0);
                setStats({ scanned: subsetFileCount, identified: albumsToProcess.length, tagged: 0 });
            }
        } else {
            // Fallback: If no specific manual fixes tracked (or tracking failed),
            // assume we want to process ALL "Match" albums.
            // This safeguards against state bugs where manuallyFixedIds is lost.
            const matches = identifiedAlbums.filter(a => a.status === 'Match');
            if (matches.length > 0) {
                albumsToProcess = matches;
            }
        }

        setIsProcessing(true);
        setOrganizeProgress(0);
        setStatus("Reprocessing...");
        setManuallyFixedIds(new Set()); // Clear tracking

        try {
            // Step 3: Tag (Retry)
            setStatus("Applying Tags...");
            const tagRes = await fetch('/api/v1/tag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(albumsToProcess)
            });
            if (!tagRes.ok) {
                const errText = await tagRes.text();
                throw new Error(`Tagging failed: ${errText}`);
            }
            const taggedData = await tagRes.json();
            setTaggedAlbums(taggedData);

            // Step 4: Organize (Retry)
            setStatus("Organizing...");
            let processedCount = 0;
            const totalAlbums = taggedData.length;

            if (totalAlbums === 0) {
                setOrganizeProgress(100);
            } else {
                for (const album of taggedData) {
                    await fetch('/api/v1/organize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            albums: [album],
                            output_path: outputPath
                        })
                    });
                    processedCount++;
                    setOrganizeProgress(Math.round((processedCount / totalAlbums) * 100));
                }
            }
            setStatus("Finished");
            setViewDetails('tagged'); // Switch view to show results

        } catch (e: unknown) {
            console.error(e);
            setStatus("Error");
            const msg = e instanceof Error ? e.message : String(e);
            alert(`Reprocess Error: ${msg}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateCover = (albumId: string, url: string) => {
        const updateAlbum = (a: Album) => a.id === albumId ? { ...a, cover_art_url: url } : a;
        setScannedAlbums(prev => prev.map(updateAlbum));
        setIdentifiedAlbums(prev => prev.map(updateAlbum));
        setTaggedAlbums(prev => prev.map(updateAlbum));
    };

    const modalInfo = getModalData();
    const unidentifiedCount = identifiedAlbums.filter(a => a.status !== 'Match').length;

    return (
        <div className="min-h-screen bg-dark text-white font-sans p-8">
            <header className="mb-12 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 bg-primary/60 blur-md rounded-full animate-pulse"></div>
                            <img
                                src="/logo.png"
                                alt="ER-MusicTagManager Logo"
                                className="relative z-10 w-full h-full rounded-lg object-contain bg-gray-900 border border-gray-700"
                            />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            ER-MusicTagManager
                        </h1>
                    </div>
                    {/* Status Indicators */}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="text-gray-400">
                            System: <span className={status === "Error" ? "text-red-500 font-bold" : "text-green-400 text-shadow-glow"}>{status}</span>
                        </div>
                        <div className="text-gray-400">
                            MB API: <span className={
                                mbStatus.status === 'online' ? "text-green-400 font-bold" :
                                    mbStatus.status === 'working' ? "text-yellow-500" :
                                        "text-red-500 font-bold"
                            }>{mbStatus.status === 'online' ? "Online" : "Offline"}</span>
                        </div>
                        <button
                            onClick={() => setShowHelp(true)}
                            className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 w-8 h-8 rounded-full transition-colors flex items-center justify-center font-bold"
                            title="Open Guide / Help"
                        >
                            ?
                        </button>
                        <button
                            onClick={handleShutdown}
                            className="bg-red-900/50 hover:bg-red-700 text-red-200 p-2 rounded-full transition-colors"
                            title="Shutdown Application"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Path selection inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-800/30 p-4 rounded-lg border border-gray-700">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase font-semibold">Input Directory (Scan)</label>
                        <input
                            type="text"
                            value={inputPath}
                            onChange={(e) => setInputPath(e.target.value)}
                            placeholder="e.g. Linux: /music | Win: C:\Users\Music"
                            title="The folder where your untagged music currently resides."
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase font-semibold">Output Directory (Organize)</label>
                        <input
                            type="text"
                            value={outputPath}
                            onChange={(e) => setOutputPath(e.target.value)}
                            placeholder="e.g. Linux: /sorted | Win: C:\Users\Sorted"
                            title="The destination folder where perfectly tagged and structured music will be saved."
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-green-500 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end mt-2 gap-4">
                        <button
                            onClick={handleHealthScan}
                            disabled={isProcessing || isHealthScanning}
                            title="Instantly scan your input directory to find albums missing covers or MusicBrainz IDs without modifying files."
                            className={`font-bold py-2 px-6 rounded shadow-lg transition-all ${isHealthScanning ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isHealthScanning ? "Checking..." : "Library Health Check"}
                        </button>
                        <button
                            onClick={handleStart}
                            disabled={isProcessing || isHealthScanning}
                            title="Perform a deep scan, identify music on MusicBrainz, and prepare files for tagging."
                            className={`font-bold py-2 px-6 rounded shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all ${identifiedAlbums.length > 0
                                ? "bg-orange-600 hover:bg-orange-500 text-white"
                                : "bg-primary hover:bg-blue-600 text-white"
                                }`}
                        >
                            {isProcessing ? "Processing..." : (identifiedAlbums.length > 0 ? "Reset & Rescan" : "Start Processing")}
                        </button>
                    </div>
                </div>
            </header>

            {/* Unidentified Banner - Review Phase */}
            {identifiedAlbums.length > 0 && unidentifiedCount > 0 && (
                <div
                    className="mb-8 bg-red-900/30 border border-red-700/50 p-4 rounded-xl flex items-center justify-between transition"
                >
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setViewDetails('unidentified')}>
                        <div className="flex justify-center mb-2"><svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                        <div>
                            <h3 className="font-bold text-lg text-red-200">
                                {unidentifiedCount} Albums Need Attention
                            </h3>
                            <p className="text-gray-400 text-sm">
                                {manuallyFixedIds.size > 0
                                    ? `${manuallyFixedIds.size} albums fixed and ready to write. ${unidentifiedCount} still need review.`
                                    : "Some albums could not be automatically identified."}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setViewDetails('unidentified')}
                            className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded font-bold shadow transition-colors"
                        >
                            Review & Fix
                        </button>

                    </div>
                </div>
            )}

            {/* Reprocess Banner - Ready Phase */}
            {identifiedAlbums.length > 0 && unidentifiedCount === 0 && taggedAlbums.length === 0 && (
                <div className="mb-8 bg-green-900/30 border border-green-700/50 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex justify-center mb-2"><svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                        <div>
                            <h3 className="font-bold text-lg text-green-200">All Albums Identified</h3>
                            <p className="text-gray-400 text-sm">
                                {manuallyFixedIds.size > 0
                                    ? `You have ${manuallyFixedIds.size} manual fixes ready to apply.`
                                    : "All albums are matched. You can now apply tags and organize files."}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {/* Always show Review button if we have manual fixes provided, so user can check them */}
                        {manuallyFixedIds.size > 0 && (
                            <button
                                onClick={() => setViewDetails('unidentified')}
                                className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded font-bold shadow transition-colors"
                            >
                                Review Changes
                            </button>
                        )}
                        <button
                            onClick={handleReprocess}
                            disabled={isProcessing}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold shadow transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {manuallyFixedIds.size > 0 ? `Write ${manuallyFixedIds.size} Fixed Albums` : "Write & Organize All"}
                        </button>
                    </div>
                </div>
            )}

            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Scan */}
                <div
                    onClick={() => setViewDetails('scanned')}
                    className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 backdrop-blur-sm hover:border-primary/50 transition-colors cursor-pointer group"
                >
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Scan Library</h2>
                    <p className="text-gray-400 text-sm mb-4">Analyze input directory.</p>
                    <div className="flex justify-between items-end">
                        <span className="text-4xl font-mono">{stats.scanned}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Files</span>
                    </div>
                </div>

                {/* Card 2: Identify */}
                <div
                    onClick={() => setViewDetails('identified')}
                    className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 backdrop-blur-sm hover:border-yellow-500/50 transition-colors cursor-pointer group"
                >
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-yellow-500 transition-colors">Identify</h2>
                    <p className="text-gray-400 text-sm mb-4">Match with MusicBrainz.</p>
                    <div className="flex justify-between items-end">
                        <span className="text-4xl font-mono">{stats.identified}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Matched</span>
                    </div>
                </div>

                {/* Card 3: Tag */}
                <div
                    onClick={() => setViewDetails('tagged')}
                    className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 backdrop-blur-sm hover:border-secondary/50 transition-colors cursor-pointer group"
                >
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-secondary transition-colors">Process Tags</h2>
                    <p className="text-gray-400 text-sm mb-4">Write new metadata.</p>
                    <div className="flex justify-between items-end">
                        <span className="text-4xl font-mono">{stats.tagged}</span>
                        <span className="text-xs text-gray-500 uppercase tracking-widest">Wrote</span>
                    </div>
                </div>

                {/* Card 4: Output */}
                <div
                    onClick={() => setViewDetails('tagged')}
                    className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50 backdrop-blur-sm hover:border-green-500/50 transition-colors cursor-pointer group"
                >
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-green-500 transition-colors">Organize</h2>
                    <p className="text-gray-400 text-sm mb-4">Move named folders.</p>
                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden mt-6">
                        <div
                            className="bg-green-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${organizeProgress}%` }}
                        ></div>
                    </div>
                    {organizeProgress > 0 && organizeProgress < 100 && (
                        <p className="text-xs text-green-400 mt-2 text-right">{organizeProgress}%</p>
                    )}
                </div>
            </main>

            {viewDetails && modalInfo && (
                <DetailsModal
                    title={modalInfo.title}
                    data={modalInfo.data}
                    onClose={() => setViewDetails(null)}
                    type={viewDetails}
                    onDiff={handleDiff}
                    onManualIdentify={setManualFixAlbum}
                    onWrite={handleReprocess}
                    onUpdateCover={handleUpdateCover}
                />
            )}

            {diffFile && diffFile.file && (
                <MetadataDiffModal
                    file={diffFile.file}
                    original={diffFile.original}
                    onClose={() => setDiffFile(null)}
                />
            )}

            {libraryHealthResults && (
                <LibraryHealthModal
                    results={libraryHealthResults}
                    onClose={() => setLibraryHealthResults(null)}
                    onFixFolder={(path) => {
                        setInputPath(path);
                        setTimeout(() => handleStart(), 100);
                    }}
                />
            )}

            {manualFixAlbum && (
                <ManualSearchModal
                    album={manualFixAlbum}
                    onClose={() => setManualFixAlbum(null)}
                    onResolve={handleManualResolve}
                    onUpdateCover={handleUpdateCover}
                />
            )}

            {showHelp && (
                <HelpModal onClose={() => setShowHelp(false)} />
            )}

            <footer className="mt-20 text-center text-gray-600 text-sm">
                <p>&copy; 2025 ER-MusicTagManager. <span className="opacity-50">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span></p>
            </footer>
        </div>
    )
}

export default App
