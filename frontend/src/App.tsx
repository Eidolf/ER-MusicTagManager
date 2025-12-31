import { useState, useEffect } from 'react'

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
}

// --- Components ---

const DetailsModal = ({ title, data, onClose, type }: { title: string, data: Album[], onClose: () => void, type: string }) => {
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
                                                <div className={`px-2 py-1 rounded text-xs font-bold uppercase whitespace-nowrap ${album.status === 'Match' ? 'bg-green-900 text-green-400' :
                                                        album.status === 'Unclear' ? 'bg-yellow-900 text-yellow-400' :
                                                            (album.status?.startsWith('Error') || album.status === 'API Error') ? 'bg-red-900 text-red-200' :
                                                                'bg-gray-700'
                                                    }`}>
                                                    {album.status || 'Pending'}
                                                </div>

                                                {/* Toggle Button for Details */}
                                                <button
                                                    onClick={() => setExpandedAlbumId(expandedAlbumId === album.id ? null : album.id)}
                                                    className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                                                >
                                                    {expandedAlbumId === album.id ? "Hide Tracks" : "Show Tracks"}
                                                </button>
                                            </div>
                                        </div>

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
                                                        <th className="py-2 px-2">Year</th>
                                                        <th className="py-2 px-2">Size</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-700/50">
                                                    {album.files.map((f: MusicFile, i: number) => (
                                                        <tr key={i} className="hover:bg-gray-700/30 transition-colors">
                                                            <td className="py-2 px-2 font-mono text-gray-300">{f.filename}</td>
                                                            <td className="py-2 px-2 text-white">{f.title || "-"}</td>
                                                            <td className="py-2 px-2">{f.artist || "-"}</td>
                                                            <td className="py-2 px-2">{f.album || "-"}</td>
                                                            <td className="py-2 px-2">{f.year || "-"}</td>
                                                            <td className="py-2 px-2 font-mono">{(f.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
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

        try {
            // Step 1: Scan
            setStatus("Scanning...");
            const scanRes = await fetch('/api/v1/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input_path: inputPath, output_path: outputPath })
            });

            if (!scanRes.ok) throw new Error("Scan failed");
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
        return null;
    };

    const modalInfo = getModalData();

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
                    <div className="flex gap-6 text-sm">
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
                            placeholder="/path/to/music/input"
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-primary focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase font-semibold">Output Directory (Organize)</label>
                        <input
                            type="text"
                            value={outputPath}
                            onChange={(e) => setOutputPath(e.target.value)}
                            placeholder="/path/to/music/output"
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-green-500 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end mt-2">
                        <button
                            onClick={handleStart}
                            disabled={isProcessing}
                            className="bg-primary hover:bg-blue-600 text-white font-bold py-2 px-6 rounded shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isProcessing ? "Processing..." : "Start Processing"}
                        </button>
                    </div>
                </div>
            </header>

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
                />
            )}

            <footer className="mt-20 text-center text-gray-600 text-sm">
                <p>&copy; 2025 ER-MusicTagManager. Production Ready System.</p>
            </footer>
        </div>
    )
}

export default App
