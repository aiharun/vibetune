import { motion } from 'framer-motion';

function VibeAnalysis({ vibeAnalysis, isLocked = false, onUpgradeClick, fullWidth = false }) {
    const metrics = [
        { label: 'Energy', value: vibeAnalysis.energyLevel, color: 'bg-orange-400' },
        { label: 'Melancholy', value: vibeAnalysis.melancholyLevel, color: 'bg-violet-400' },
        { label: 'Instrumentation', value: vibeAnalysis.instrumentalIntensity, color: 'bg-pink-400' },
        { label: 'Danceability', value: vibeAnalysis.danceability, color: 'bg-green-400' }
    ];

    return (
        <div className="bg-[#111] rounded-2xl border border-[#222] p-6 relative overflow-hidden">
            <div className={fullWidth ? 'grid grid-cols-1 lg:grid-cols-3 gap-8' : ''}>
                {/* Mood Header */}
                <div className={fullWidth ? 'lg:col-span-1' : 'mb-6'}>
                    <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2 block">
                        Taste Profile
                    </span>
                    <h2 className="text-3xl font-bold text-white mb-3">
                        {vibeAnalysis.mood || 'Unknown'}
                    </h2>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                        {vibeAnalysis.vibeDescription}
                    </p>

                    {/* Genres - moved here for fullWidth */}
                    {fullWidth && (
                        <div className={`mt-4 flex flex-wrap gap-2 ${isLocked ? 'opacity-20 pointer-events-none' : ''}`}>
                            {vibeAnalysis.dominantGenres.map((g, i) => (
                                <span key={i} className="px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs font-medium text-neutral-400">
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Metrics */}
                <div className={`${fullWidth ? 'lg:col-span-2' : ''} ${isLocked ? 'pointer-events-none select-none opacity-40' : ''}`}>
                    <div className={fullWidth ? 'grid grid-cols-2 gap-6' : 'space-y-5'}>
                        {metrics.map((m, i) => (
                            <div key={m.label}>
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-xs font-medium text-neutral-500">{m.label}</span>
                                    <span className="text-xs font-semibold text-white">
                                        {isLocked ? '??' : `${m.value}/10`}
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: isLocked ? '30%' : `${m.value * 10}%` }}
                                        transition={{ duration: 0.8, delay: i * 0.1 }}
                                        className={`h-full rounded-full ${isLocked ? 'bg-neutral-800' : m.color}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Locked Overlay */}
            {isLocked && (
                <div className="absolute inset-x-0 bottom-0 top-[120px] z-10 flex flex-col items-center justify-center p-6 bg-gradient-to-t from-[#111] via-[#111]/80 to-transparent">
                    <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-center max-w-[200px]">
                        <svg className="w-6 h-6 text-orange-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-xs font-semibold text-white mb-1">Detaylı Analiz</p>
                        <p className="text-[10px] text-neutral-400 mb-3">Tüm metrikleri görmek için Premium'a yükseltin.</p>
                        <button
                            onClick={onUpgradeClick}
                            className="bg-orange-500 text-black text-[10px] font-bold py-1.5 px-3 rounded-lg hover:bg-orange-400 transition-colors"
                        >
                            Yükselt
                        </button>
                    </div>
                </div>
            )}

            {/* Genres - only for non-fullWidth */}
            {!fullWidth && (
                <div className={`mt-6 pt-6 border-t border-[#222] flex flex-wrap gap-2 ${isLocked ? 'opacity-20 pointer-events-none' : ''}`}>
                    {vibeAnalysis.dominantGenres.map((g, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-xs font-medium text-neutral-400">
                            {g}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default VibeAnalysis;
