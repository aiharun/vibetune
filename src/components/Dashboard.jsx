import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import firebaseService from '../services/FirebaseService';
import { TIER_FEATURES, TIERS } from '../services/SubscriptionService';

function Dashboard() {
    const [user, setUser] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [totalAnalyses, setTotalAnalyses] = useState(0);
    const [selectedUser, setSelectedUser] = useState(null);
    const [creditEditUser, setCreditEditUser] = useState(null);
    const [creditInputValue, setCreditInputValue] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        firebaseService.initialize();
        const unsubscribe = firebaseService.onAuthChange(async (user) => {
            setUser(user);
            if (user) {
                const adminStatus = firebaseService.isAdmin();
                setIsAdmin(adminStatus);
                if (adminStatus) {
                    await loadDashboardData();
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const loadDashboardData = async () => {
        try {
            const [usersData, analysesCount] = await Promise.all([
                firebaseService.getAllUsers(),
                firebaseService.getTotalAnalysesCount()
            ]);
            setUsers(usersData);
            setTotalAnalyses(analysesCount);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            await firebaseService.signInWithGoogle();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        await firebaseService.signOutUser();
        navigate('/');
    };

    const handleUpdateTier = async (userId, newTier) => {
        try {
            await firebaseService.updateUserById(userId, { tier: newTier });
            await loadDashboardData();
            setSelectedUser(null);
            showSuccess('Tier güncellendi');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleResetCredits = async (userId, tierCredits) => {
        try {
            await firebaseService.updateUserById(userId, { credits: tierCredits });
            await loadDashboardData();
            showSuccess('Krediler sıfırlandı');
        } catch (err) {
            setError(err.message);
        }
    };

    const openCreditModal = (u) => {
        setCreditEditUser(u);
        setCreditInputValue(u.credits?.toString() || '0');
    };

    const handleSetCredits = async () => {
        if (!creditEditUser) return;
        const credits = parseInt(creditInputValue, 10);
        if (isNaN(credits) || credits < 0) {
            setError('Geçerli bir sayı girin');
            return;
        }
        try {
            await firebaseService.updateUserById(creditEditUser.id, { credits });
            await loadDashboardData();
            setCreditEditUser(null);
            showSuccess(`Kredi ${credits} olarak ayarlandı`);
        } catch (err) {
            setError(err.message);
        }
    };

    const showSuccess = (message) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    // Pagination state
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    // Filter users by search
    const searchedUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Pagination
    const totalPages = Math.ceil(searchedUsers.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const filteredUsers = searchedUsers.slice(startIndex, startIndex + pageSize);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, pageSize]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-16 h-16 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                    <p className="text-neutral-400">Yükleniyor...</p>
                </motion.div>
            </div>
        );
    }

    // Not logged in - show Google sign in
    if (!user) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-md w-full text-center"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                        className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-orange-500/30"
                    >
                        <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </motion.div>
                    <h1 className="text-4xl font-bold text-white mb-4">Admin Dashboard</h1>
                    <p className="text-neutral-400 mb-8 text-lg">Yönetim paneline erişmek için giriş yapın</p>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white text-black font-semibold rounded-2xl hover:bg-neutral-100 transition-all shadow-lg"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94L5.84 14.1z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        Google ile Giriş Yap
                    </motion.button>

                    <Link to="/" className="block mt-6 text-neutral-500 hover:text-white transition-colors">
                        ← Ana Sayfaya Dön
                    </Link>

                    {error && (
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 text-red-400 text-sm"
                        >
                            {error}
                        </motion.p>
                    )}
                </motion.div>
            </div>
        );
    }

    // Not admin - access denied
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-red-500/20 border-2 border-red-500/30 flex items-center justify-center">
                        <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Erişim Reddedildi</h1>
                    <p className="text-neutral-400 mb-2">Bu sayfaya erişim yetkiniz yok.</p>
                    <p className="text-neutral-500 text-sm mb-8">{user.email}</p>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSignOut}
                        className="px-8 py-3 bg-[#222] text-white font-semibold rounded-xl hover:bg-[#333] transition-colors"
                    >
                        Çıkış Yap
                    </motion.button>
                </motion.div>
            </div>
        );
    }

    // Admin dashboard
    const tierStats = {
        free: users.filter(u => u.tier === TIERS.FREE || !u.tier).length,
        premium: users.filter(u => u.tier === TIERS.PREMIUM).length,
        premiumPlus: users.filter(u => u.tier === TIERS.PREMIUM_PLUS).length
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <motion.header
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-lg border-b border-[#1a1a1a]"
            >
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-2 text-white hover:text-orange-400 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <div className="h-6 w-px bg-[#333]"></div>
                        <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-neutral-400 hidden sm:block">{user.email}</span>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleSignOut}
                            className="px-4 py-2 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#222] transition-colors border border-[#333]"
                        >
                            Çıkış
                        </motion.button>
                    </div>
                </div>
            </motion.header>

            <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Toplam Kullanıcı', value: users.length, color: 'text-white', icon: '👥' },
                        { label: 'Toplam Analiz', value: totalAnalyses, color: 'text-orange-400', icon: '🎵' },
                        { label: 'Premium', value: tierStats.premium, color: 'text-amber-400', icon: '⭐' },
                        { label: 'Premium+', value: tierStats.premiumPlus, color: 'text-violet-400', icon: '💎' }
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            className="bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-[#222] rounded-2xl p-5 cursor-default"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl">{stat.icon}</span>
                            </div>
                            <p className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
                            <p className="text-neutral-500 text-sm">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Users Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden"
                >
                    {/* Search & Header */}
                    <div className="p-5 border-b border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-white">Kullanıcılar</h2>
                            <span className="text-neutral-500 text-sm">({searchedUsers.length} toplam)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Page Size Selector */}
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/50 transition-colors cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={250}>250</option>
                            </select>
                            {/* Search */}
                            <div className="relative">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Kullanıcı ara..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-[#0a0a0a] border border-[#333] rounded-xl text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-orange-500/50 w-full sm:w-64 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#0a0a0a]">
                                <tr>
                                    <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-5 py-4">Kullanıcı</th>
                                    <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-5 py-4">Tier</th>
                                    <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-5 py-4">Kredi</th>
                                    <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-5 py-4 hidden md:table-cell">Kayıt</th>
                                    <th className="text-right text-xs text-neutral-500 font-medium uppercase tracking-wider px-5 py-4">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1a1a1a]">
                                <AnimatePresence>
                                    {filteredUsers.map((u, index) => {
                                        const tierInfo = TIER_FEATURES[u.tier || TIERS.FREE];
                                        return (
                                            <motion.tr
                                                key={u.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ delay: index * 0.03 }}
                                                className="hover:bg-[#1a1a1a]/50 transition-colors group"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-[#333] flex items-center justify-center text-white font-semibold">
                                                                {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            {/* Auth Provider Badge */}
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#111] border border-[#333] flex items-center justify-center">
                                                                {u.authProvider === 'google' ? (
                                                                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                                                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                                        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94L5.84 14.1z" />
                                                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-white font-medium">{u.displayName || 'Anonim'}</p>
                                                            <p className="text-neutral-500 text-sm">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold inline-block"
                                                        style={{
                                                            backgroundColor: `${tierInfo.color}15`,
                                                            color: tierInfo.color,
                                                            border: `1px solid ${tierInfo.color}30`
                                                        }}
                                                    >
                                                        {tierInfo.displayName}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium">{u.credits ?? 0}</span>
                                                        <span className="text-neutral-600">/</span>
                                                        <span className="text-neutral-500">{tierInfo.weeklyCreditLimit === Infinity ? '∞' : tierInfo.weeklyCreditLimit}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-neutral-400 text-sm hidden md:table-cell">
                                                    {u.createdAt?.toDate?.().toLocaleDateString('tr-TR') || '-'}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleResetCredits(u.id, tierInfo.weeklyCreditLimit === Infinity ? 999 : tierInfo.weeklyCreditLimit)}
                                                            className="px-3 py-1.5 bg-[#222] text-white text-xs font-medium rounded-lg hover:bg-[#333] transition-colors"
                                                        >
                                                            Sıfırla
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => openCreditModal(u)}
                                                            className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                                                        >
                                                            Ayarla
                                                        </motion.button>
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => setSelectedUser(u)}
                                                            className="px-3 py-1.5 bg-orange-500/10 text-orange-400 text-xs font-medium rounded-lg hover:bg-orange-500/20 transition-colors border border-orange-500/20"
                                                        >
                                                            Tier
                                                        </motion.button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </AnimatePresence>
                            </tbody>
                        </table>

                        {filteredUsers.length === 0 && (
                            <div className="text-center py-12 text-neutral-500">
                                {searchQuery ? 'Kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-[#222] flex items-center justify-between">
                            <p className="text-neutral-500 text-sm">
                                {startIndex + 1}-{Math.min(startIndex + pageSize, searchedUsers.length)} / {searchedUsers.length} kullanıcı
                            </p>
                            <div className="flex items-center gap-2">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 bg-[#222] text-white text-sm font-medium rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    ← Önceki
                                </motion.button>
                                <span className="text-white text-sm px-3">
                                    {currentPage} / {totalPages}
                                </span>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 bg-[#222] text-white text-sm font-medium rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Sonraki →
                                </motion.button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </main>

            {/* Tier Change Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setSelectedUser(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111] border border-[#222] rounded-3xl p-6 w-full max-w-md shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-[#333] flex items-center justify-center text-white font-bold text-lg">
                                    {(selectedUser.displayName || selectedUser.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Tier Değiştir</h3>
                                    <p className="text-neutral-500 text-sm">{selectedUser.email}</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {Object.entries(TIER_FEATURES).map(([tierId, tier]) => (
                                    <motion.button
                                        key={tierId}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        onClick={() => handleUpdateTier(selectedUser.id, tierId)}
                                        className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${selectedUser.tier === tierId
                                            ? 'border-orange-500 bg-orange-500/10'
                                            : 'border-[#333] hover:border-[#444] hover:bg-[#1a1a1a]'
                                            }`}
                                    >
                                        <div>
                                            <p className="font-semibold" style={{ color: tier.color }}>{tier.displayName}</p>
                                            <p className="text-neutral-500 text-sm">{tier.weeklyCreditLimit === Infinity ? 'Sınırsız' : tier.weeklyCreditLimit} kredi/hafta</p>
                                        </div>
                                        {selectedUser.tier === tierId && (
                                            <span className="text-orange-400 text-sm font-medium">Mevcut</span>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedUser(null)}
                                className="w-full mt-4 py-3 bg-[#222] text-white font-medium rounded-xl hover:bg-[#333] transition-colors"
                            >
                                İptal
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Credit Edit Modal */}
            <AnimatePresence>
                {creditEditUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setCreditEditUser(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#111] border border-[#222] rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">Kredi Ayarla</h3>
                            <p className="text-neutral-500 text-sm mb-6">{creditEditUser.displayName || creditEditUser.email}</p>

                            <input
                                type="number"
                                min="0"
                                value={creditInputValue}
                                onChange={(e) => setCreditInputValue(e.target.value)}
                                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] rounded-xl text-white text-lg font-medium focus:outline-none focus:border-blue-500/50 transition-colors mb-4"
                                placeholder="Kredi sayısı"
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setCreditEditUser(null)}
                                    className="flex-1 py-3 bg-[#222] text-white font-medium rounded-xl hover:bg-[#333] transition-colors"
                                >
                                    İptal
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSetCredits}
                                    className="flex-1 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-400 transition-colors"
                                >
                                    Kaydet
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast Messages */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 50, x: '-50%' }}
                        className="fixed bottom-6 left-1/2 bg-green-500/10 border border-green-500/20 text-green-400 px-6 py-3 rounded-xl backdrop-blur-sm"
                    >
                        ✓ {successMessage}
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 50, x: '-50%' }}
                        className="fixed bottom-6 left-1/2 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-3 rounded-xl backdrop-blur-sm"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Dashboard;
