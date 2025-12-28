import { motion } from 'framer-motion';

function VibeAnalysis({ vibeAnalysis, isLocked = false, onUpgradeClick, fullWidth = false, userPrompt = '' }) {
    const metrics = [
        {
            label: 'Enerji',
            value: vibeAnalysis.energyLevel,
            color: 'from-orange-500 to-red-500',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        },
        {
            label: 'Melankoli',
            value: vibeAnalysis.melancholyLevel,
            color: 'from-violet-500 to-indigo-500',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
        },
        {
            label: 'Enstrümantal',
            value: vibeAnalysis.instrumentalIntensity,
            color: 'from-pink-500 to-rose-500',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
        },
        {
            label: 'Dans',
            value: vibeAnalysis.danceability,
            color: 'from-green-400 to-emerald-500',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
    ];

    return (
        <div className="relative overflow-hidden rounded-3xl bg-[#050505] border border-[#222]">
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />

            <div className={`relative z-10 p-6 md:p-8 flex flex-col gap-8`}>

                {/* Top Section: Mood & Description */}
                <div className="flex flex-col items-start w-full">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 w-fit mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">Taste Profile</span>
                    </div>

                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight">
                        {vibeAnalysis.mood || 'Analiz Ediliyor...'}
                    </h2>

                    <p className="text-neutral-400 text-base leading-relaxed mb-6 border-l-2 border-orange-500/30 pl-4 max-w-3xl">
                        {vibeAnalysis.vibeDescription}
                    </p>

                    <div className={`flex flex-wrap gap-2 ${isLocked ? 'opacity-20 pointer-events-none' : ''}`}>
                        {(vibeAnalysis.dominantGenres || vibeAnalysis.genres || []).map((g, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-neutral-300 hover:bg-white/10 transition-colors cursor-default">
                                #{g}
                            </span>
                        ))}
                    </div>

                    {/* User's Original Input */}
                    {userPrompt && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <span className="italic truncate max-w-md">"{userPrompt}"</span>
                        </div>
                    )}
                </div>

                {/* Bottom Section: Metrics Grid */}
                <div className={`w-full ${isLocked ? 'pointer-events-none select-none relative' : ''}`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {metrics.map((m, i) => (
                            <div key={m.label} className="bg-[#0f0f0f]/50 border border-white/5 p-4 rounded-2xl hover:bg-[#111] transition-colors group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{m.icon}</span>
                                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{m.label}</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">{isLocked ? '?' : m.value}<span className="text-neutral-600 text-xs">/10</span></span>
                                </div>

                                <div className="h-2 w-full bg-black rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: isLocked ? '0%' : `${m.value * 10}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                                        className={`h-full rounded-full bg-gradient-to-r ${m.color}`}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Locked Overlay */}
                    {isLocked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]/60 backdrop-blur-sm rounded-2xl border border-white/5">
                            <div className="text-center p-6 bg-[#0a0a0a] rounded-2xl border border-orange-500/20 shadow-2xl transform hover:scale-105 transition-transform">
                                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">Detaylı Analiz Kilidi</h3>
                                <p className="text-xs text-neutral-400 mb-4 max-w-[200px] mx-auto">Müzik DNA'nızın tüm teknik detaylarını görmek için Premium'a geçin.</p>
                                <button
                                    onClick={onUpgradeClick}
                                    className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-orange-500/20"
                                >
                                    PROFİLİ AÇ
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VibeAnalysis;
