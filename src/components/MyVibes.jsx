import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import firebaseService from '../services/FirebaseService';
import subscriptionService, { TIERS } from '../services/SubscriptionService';
import AuthModal from './AuthModal';
import PricingModal from './PricingModal';

function MyVibes() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [vibes, setVibes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        firebaseService.initialize();
        const unsubscribe = firebaseService.onAuthChange(async (user) => {
            setUser(user);
            if (user) {
                const profile = await firebaseService.getUserProfile();
                setUserProfile(profile);
                const userVibes = await firebaseService.getUserVibes();
                setVibes(userVibes);
            } else {
                setUserProfile(null);
                setVibes([]);
                // Redirect to home when user signs out
                navigate('/');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm('Bu hatırayı silmek istediğine emin misin?')) return;
        try {
            await firebaseService.deleteVibe(id);
            setVibes(vibes.filter(v => v.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-neutral-500 font-medium">Arşiv yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-[#111] border border-[#222] rounded-3xl flex items-center justify-center mb-8">
                    <svg className="w-10 h-10 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-bold text-white mb-4">Arşiv Kilitli</h1>
                <p className="text-neutral-400 mb-8 max-w-sm">Geçmiş analizlerine erişmek için giriş yapmalısın.</p>
                <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-colors"
                >
                    Giriş Yap
                </button>
                <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            </div>
        );
    }

    // Check if user's tier allows saving results
    const tierFeatures = subscriptionService.getTierFeatures(userProfile?.tier || TIERS.FREE);
    const canSaveResults = tierFeatures.canSaveResults;

    // Show upgrade prompt for Free tier users
    if (!canSaveResults) {
        return (
            <main className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 px-4 md:px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 flex items-center justify-center">
                        <svg className="w-12 h-12 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Premium Özellik</h1>
                    <p className="text-lg text-neutral-400 mb-8 max-w-md mx-auto">
                        Analiz sonuçlarını arşivleme ve daha sonra görüntüleme özelliği Premium üyelere özeldir.
                    </p>
                    <div className="bg-[#111] border border-[#222] rounded-2xl p-6 mb-8 max-w-sm mx-auto">
                        <h3 className="text-white font-semibold mb-4">Premium ile Neler Kazanırsın?</h3>
                        <ul className="text-left space-y-3">
                            <li className="flex items-center gap-3 text-neutral-300 text-sm">
                                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Sonuçları arşivle ve tekrar görüntüle
                            </li>
                            <li className="flex items-center gap-3 text-neutral-300 text-sm">
                                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Tüm platformlardan playlist analizi
                            </li>
                            <li className="flex items-center gap-3 text-neutral-300 text-sm">
                                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Haftalık 20 kredi
                            </li>
                        </ul>
                    </div>
                    <button
                        onClick={() => setShowPricingModal(true)}
                        className="px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-full hover:from-orange-400 hover:to-pink-400 transition-all shadow-lg shadow-orange-500/25"
                    >
                        Planları Görüntüle
                    </button>
                    <Link
                        to="/"
                        className="block mt-4 text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                        Ana Sayfaya Dön
                    </Link>
                </div>
                <PricingModal
                    isOpen={showPricingModal}
                    onClose={() => setShowPricingModal(false)}
                    currentTier={userProfile?.tier || TIERS.FREE}
                />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0a0a0a] pt-32 pb-20 px-4 md:px-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-4">
                            <span className="text-orange-400">✦</span>
                            <span className="text-xs text-neutral-300">Your Music Archive</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-white">Sonic Archive</h1>
                    </div>
                    <div className="flex items-center gap-3 text-neutral-500">
                        <span className="text-3xl font-bold text-orange-500/50">{vibes.length}</span>
                        <span className="text-sm uppercase tracking-widest font-medium">Kayıtlı Vibe</span>
                    </div>
                </div>

                {vibes.length === 0 ? (
                    <div className="bg-[#111] border border-[#222] rounded-[32px] p-12 text-center">
                        <p className="text-neutral-400 text-lg mb-8">Henüz kaydedilmiş bir analiz bulunmuyor.</p>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-bold transition-colors"
                        >
                            İlk Analizini Başlat
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {vibes.map((v, i) => (
                            <motion.div
                                key={v.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`group bg-[#111] border border-[#222] rounded-2xl overflow-hidden transition-all hover:border-[#333] ${expandedId === v.id ? 'ring-1 ring-orange-500/50' : ''}`}
                            >
                                <div
                                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                                    className="p-6 cursor-pointer flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl">
                                            {v.analysisResult?.vibeName === 'Energetic' ? '⚡' : '🔮'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                                                {v.analysisResult?.vibeName || 'Bilinmeyen Vibe'}
                                            </h3>
                                            <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                                                {new Date(v.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <svg className={`w-5 h-5 transition-transform duration-300 ${expandedId === v.id ? 'rotate-180 text-orange-400' : 'text-neutral-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {expandedId === v.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-[#222]"
                                        >
                                            <div className="p-6">
                                                <p className="text-neutral-300 text-lg font-light leading-relaxed mb-8 italic">
                                                    "{v.analysisResult?.summary}"
                                                </p>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                                                    {v.analysisResult?.recommendations?.slice(0, 4).map((r, k) => (
                                                        <div key={k} className="bg-black/40 border border-[#222] p-4 rounded-xl flex justify-between items-center text-sm shadow-inner transition-colors hover:border-orange-500/30">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-white">{r.name}</span>
                                                                <span className="text-neutral-500 text-xs">{r.artist}</span>
                                                            </div>
                                                            <svg className="w-4 h-4 text-orange-500/50" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                                            </svg>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex justify-between items-center">
                                                    <button
                                                        onClick={() => {
                                                            navigate('/results', { state: { analysisData: v } });
                                                        }}
                                                        className="text-xs font-bold text-orange-400 hover:text-orange-300 uppercase tracking-widest transition-colors"
                                                    >
                                                        Detayları Gör
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(e, v.id)}
                                                        className="text-xs font-bold text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-2 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Arşivden Sil
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

export default MyVibes;
