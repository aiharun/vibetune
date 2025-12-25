import { motion } from 'framer-motion';

function SongCard({ song, index, onAddToPlaylist, onRemoveFromPlaylist, isInPlaylist = false, showPlaylistButton = false }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 bg-[#111] rounded-xl border flex items-center gap-4 group transition-colors ${song.isDisabled
                    ? 'border-orange-500/50 bg-orange-500/5'
                    : isInPlaylist
                        ? 'border-green-500/50 bg-green-500/5'
                        : 'border-[#222] hover:border-[#333]'
                }`}
        >
            <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden">
                {song.albumArt ? (
                    <img
                        src={song.albumArt}
                        alt={song.album || song.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-pink-500/20" />
                        <div className="absolute inset-0 flex items-center justify-center text-neutral-500 group-hover:text-orange-400 transition-colors">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate group-hover:text-orange-400 transition-colors">
                    {song.name}
                </h3>
                <p className="text-sm text-neutral-500 truncate">
                    {song.artist || song.artistsString}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {/* Add/Remove from Playlist Button */}
                {showPlaylistButton && (
                    <div className="relative group/tooltip">
                        <motion.button
                            whileHover={!song.isDisabled ? { scale: 1.1 } : {}}
                            whileTap={!song.isDisabled ? { scale: 0.9 } : {}}
                            onClick={() => {
                                if (song.isDisabled) return;
                                isInPlaylist ? onRemoveFromPlaylist?.(song) : onAddToPlaylist?.(song);
                            }}
                            disabled={song.isDisabled}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${song.isDisabled
                                ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-600 cursor-not-allowed opacity-50'
                                : isInPlaylist
                                    ? 'bg-green-500 text-white hover:bg-red-500'
                                    : 'bg-[#1a1a1a] border border-[#2a2a2a] text-neutral-400 hover:bg-green-500 hover:text-white hover:border-green-500'
                                }`}
                            // Keep basic title as fallback
                            title={!song.isDisabled ? (isInPlaylist ? 'Playlistten Çıkar' : 'Playliste Ekle') : ''}
                        >
                            {isInPlaylist || song.isDisabled ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        </motion.button>

                        {/* Custom Tooltip for Disabled State */}
                        {song.isDisabled && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-neutral-700">
                                "Listemi Ekle" açıkken değiştirilemez
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-800" />
                            </div>
                        )}
                    </div>
                )}

                {/* Play on Spotify Button */}
                <a
                    href={song.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-9 h-9 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center hover:bg-[#1DB954] hover:border-[#1DB954] hover:text-white transition-all text-neutral-400"
                    title="Spotify'da Aç"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </a>
            </div>
        </motion.div>
    );
}

export default SongCard;
