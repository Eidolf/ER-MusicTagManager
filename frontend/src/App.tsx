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

const DetailsModal = ({ title, data, onClose, type, onDiff, onManualIdentify, onWrite }: {
    title: string,
    data: Album[],
    onClose: () => void,
    type: string,
    onDiff?: (file: MusicFile) => void,
    onManualIdentify?: (album: Album) => void,
    onWrite?: (album: Album) => void
}) => {
    // State moved here - SAFE now
    const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);

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
                                    {album.cover_art_url ? (
                                        <div className="w-24 h-24 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                                            <img src={album.cover_art_url} alt="Cover" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 flex-shrink-0 bg-gray-800 rounded flex items-center justify-center text-gray-500 text-xs">No Cover</div>
                                    )}

                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-lg text-white">{album.artist} - {album.title} {album.year && `(${album.year})`}</h3>
                                                <div className="text-sm text-gray-400">
                                                    <p>Path: <span className="font-mono text-xs text-gray-500">{album.path}</span></p>
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
                                                    {(album.status?.startsWith('Error')) ? 'Error ℹ' : (album.status || 'Pending')}
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

const ManualSearchModal = ({ album, onClose, onResolve }: { album: Album, onClose: () => void, onResolve: (updatedAlbum: Album) => void }) => {
    const [artistQuery, setArtistQuery] = useState(album.artist === "Unknown Artist" ? "" : album.artist);
    const [albumQuery, setAlbumQuery] = useState(album.title);
    const [results, setResults] = useState<MusicBrainzRelease[]>([]);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

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

                <div className="flex gap-4 mb-6">
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
                        const hasCover = r["cover-art-archive"]?.front ? "📷" : "";
                        const trackCount = r["track-count"] || "?";
                        const year = r["date"] || "Unknown";
                        const label = r["label-info"]?.[0]?.label?.name || "-";

                        return (
                            <div key={r.id} className="bg-gray-700/50 p-3 rounded flex justify-between items-center hover:bg-gray-700 transition">
                                <div>
                                    <div className="font-bold text-white">{r.title} <span className="text-sm font-normal text-gray-400">by {r["artist-credit"]?.[0]?.name}</span></div>
                                    <div className="text-xs text-gray-400 flex gap-4 mt-1">
                                        <span>Year: {year}</span>
                                        <span>Tracks: {trackCount}</span>
                                        <span>Label: {label}</span>
                                        <span>Score: {r.score}</span>
                                        <span>{hasCover}</span>
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
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-green-500 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end mt-2">
                        <button
                            onClick={handleStart}
                            disabled={isProcessing}
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
                        <div className="text-2xl text-red-400">⚠️</div>
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
                        <div className="text-2xl text-green-400">✅</div>
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
                />
            )}

            {diffFile && diffFile.file && (
                <MetadataDiffModal
                    file={diffFile.file}
                    original={diffFile.original}
                    onClose={() => setDiffFile(null)}
                />
            )}

            {manualFixAlbum && (
                <ManualSearchModal
                    album={manualFixAlbum}
                    onClose={() => setManualFixAlbum(null)}
                    onResolve={handleManualResolve}
                />
            )}

            <footer className="mt-20 text-center text-gray-600 text-sm">
                <p>&copy; 2025 ER-MusicTagManager. <span className="opacity-50">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</span></p>
            </footer>
        </div>
    )
}

export default App
