import { motion } from 'framer-motion';

function SongCard({ song, index, onAddToPlaylist, onRemoveFromPlaylist, isInPlaylist = false, showPlaylistButton = false }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex flex-col bg-[#050505] rounded-[16px] overflow-hidden border transition-all duration-300 group
                ${song.isDisabled
                    ? 'border-orange-500/20 opacity-60'
                    : isInPlaylist
                        ? 'border-green-500/50 shadow-[0_0_30px_-10px_rgba(34,197,94,0.3)]'
                        : 'border-[#222] hover:border-[#333] hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]'
                }`}
        >
            {/* Image Section - Main Focus */}
            <div className="relative aspect-[2/1] md:aspect-[4/3] w-full bg-[#111] overflow-hidden">
                {song.albumArt ? (
                    <img
                        src={song.albumArt}
                        alt={song.album || song.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#111] text-neutral-600">
                        <svg className="w-12 h-12 mb-3 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                        </svg>
                        <span className="text-xs font-medium opacity-40 uppercase tracking-widest">No Preview</span>
                    </div>
                )}

                {/* Play Button Overlay (Hover Only) */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px] pointer-events-none">
                    <a
                        href={song.spotifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transform scale-90 group-hover:scale-100 transition-all hover:bg-[#1DB954] hover:text-white shadow-xl pointer-events-auto"
                        title="Spotify'da Dinle"
                    >
                        <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </a>
                </div>

                {/* Add to Playlist Button (Always Visible) */}
                {showPlaylistButton && !song.isDisabled && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            isInPlaylist ? onRemoveFromPlaylist?.(song) : onAddToPlaylist?.(song);
                        }}
                        className={`absolute bottom-2 right-2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95 ${isInPlaylist
                            ? 'bg-green-500 text-white hover:bg-red-500'
                            : 'bg-black/70 backdrop-blur-md text-white hover:bg-green-500 border border-white/20'
                            }`}
                        title={isInPlaylist ? 'Listeden Çıkar' : 'Listeye Ekle'}
                    >
                        {isInPlaylist ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        )}
                    </button>
                )}
            </div>

            {/* Info Footer - Compact Layout */}
            <div className="flex flex-col border-t border-[#222] bg-[#0a0a0a]">
                <div className="p-3 md:p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col">
                            <span className="text-white font-bold truncate text-base" title={song.name}>{song.name}</span>
                            <span className="text-xs text-neutral-400 truncate" title={song.artist}>{song.artist || song.artistsString}</span>
                        </div>
                    </div>

                    <div className="flex-shrink-0 text-right pl-2 border-l border-[#222]">
                        <div className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500 leading-none">
                            {song.matchScore || 95}%
                        </div>
                        <div className="text-[9px] text-neutral-500 uppercase tracking-wider mt-0.5">Match</div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default SongCard;
