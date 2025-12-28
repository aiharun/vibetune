import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import firebaseService from '../services/FirebaseService';
import spotifyService from '../services/SpotifyService';
import { TIER_FEATURES, TIERS } from '../services/SubscriptionService';

const PLATFORMS = [
    {
        id: 'spotify',
        name: 'Spotify',
        color: '#1DB954',
        icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
        ),
        freeAccess: true
    },
    {
        id: 'youtube',
        name: 'YouTube Music',
        color: '#FF0000',
        icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        ),
        freeAccess: false
    },
    {
        id: 'apple',
        name: 'Apple Music',
        color: '#FC3C44',
        icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.401-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81.84-.553 1.472-1.287 1.88-2.208.186-.42.293-.865.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.363-2.255-1.202-.267-.476-.336-1-.227-1.544.193-.964.99-1.734 1.963-1.913.507-.093 1.022-.132 1.532-.223.31-.055.503-.264.534-.563.003-.038.006-.075.006-.112v-4.928c0-.31-.14-.46-.452-.397l-4.94 1.003c-.053.01-.108.017-.16.033-.335.102-.48.276-.48.626-.005 2.12-.003 4.24-.004 6.36 0 .418-.06.832-.243 1.215-.283.593-.754.97-1.39 1.15-.344.098-.694.155-1.053.172-.985.044-1.828-.397-2.28-1.286-.228-.448-.296-.93-.213-1.426.186-.997 1.006-1.774 2.013-1.956.494-.09.996-.126 1.492-.216.325-.06.51-.272.535-.594.002-.027.004-.055.004-.084V6.273c0-.372.107-.645.464-.752.054-.016.11-.028.166-.038l6.126-1.24c.12-.025.24-.053.362-.064.324-.03.522.15.522.478 0 1.885.003 3.77 0 5.657z" />
            </svg>
        ),
        freeAccess: false
    },
    {
        id: 'deezer',
        name: 'Deezer',
        color: '#FEAA2D',
        icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.27 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03h-5.19zm6.27 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z" />
            </svg>
        ),
        freeAccess: false
    },
    {
        id: 'soundcloud',
        name: 'SoundCloud',
        color: '#FF5500',
        icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094s.089-.037.099-.094l.19-1.308-.19-1.334c-.01-.057-.044-.09-.09-.09m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.12.12.12.074 0 .12-.06.12-.12l.24-2.458-.24-2.563c0-.06-.045-.104-.12-.104m.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.64c-.015-.075-.074-.135-.15-.135m1.005.165c-.09 0-.149.075-.149.159l-.18 2.505.195 2.505c0 .09.06.164.149.164.09 0 .149-.074.164-.164l.21-2.505-.225-2.505c-.014-.09-.074-.159-.164-.159m.96-.27c-.104 0-.179.09-.179.194l-.18 2.595.18 2.459c0 .104.075.18.18.18.104 0 .179-.074.193-.18l.21-2.459-.21-2.595c-.015-.105-.09-.195-.194-.195m.976-.074c-.119 0-.21.104-.21.224l-.165 2.639.165 2.414c0 .12.091.21.21.21.12 0 .21-.09.225-.21l.18-2.414-.18-2.639c-.015-.12-.104-.224-.225-.224m1.064-.165c-.135 0-.239.105-.239.24l-.15 2.775.15 2.37c0 .135.104.24.239.24.135 0 .239-.105.254-.24l.164-2.37-.164-2.775c-.015-.135-.12-.24-.254-.24m.976.03c-.149 0-.269.12-.269.27l-.135 2.715.135 2.385c0 .15.12.27.269.27.15 0 .27-.12.284-.27l.15-2.385-.15-2.715c-.014-.15-.135-.27-.284-.27m1.064-.165c-.164 0-.299.135-.299.3l-.12 2.85.12 2.4c0 .165.135.3.299.3.165 0 .3-.135.314-.3l.135-2.4-.135-2.85c-.014-.165-.149-.3-.314-.3m1.049-.045c-.18 0-.314.15-.314.33l-.12 2.865.12 2.37c0 .18.135.33.314.33.18 0 .314-.15.329-.33l.135-2.37-.135-2.865c-.015-.18-.15-.33-.33-.33m2.129 1.35c-.27 0-.479.21-.479.479v4.484c0 .27.21.479.479.479h1.35c2.879 0 5.22-2.355 5.22-5.25s-2.341-5.25-5.22-5.25c-.689 0-1.35.15-1.95.404C13.725 5.07 12.66 4.17 11.4 4.17c-.525 0-.989.135-1.395.375-.074.045-.104.105-.104.18v6.72c0 .135.09.255.225.27z" />
            </svg>
        ),
        freeAccess: false
    }
];

function ProfileSettings({ isOpen, onClose, userProfile, onProfileUpdate }) {
    const [loading, setLoading] = useState({});
    const [connectedPlatforms, setConnectedPlatforms] = useState({});
    const [showPricingModal, setShowPricingModal] = useState(false);

    const isPremium = userProfile?.tier === TIERS.PREMIUM || userProfile?.tier === TIERS.PRO;
    const tierInfo = TIER_FEATURES[userProfile?.tier || TIERS.FREE];

    useEffect(() => {
        if (userProfile?.platforms) {
            setConnectedPlatforms(userProfile.platforms);
        }
    }, [userProfile]);

    const handleConnectSpotify = async () => {
        setLoading(prev => ({ ...prev, spotify: true }));
        try {
            // Check if already have a token in session
            const token = sessionStorage.getItem('spotify_access_token');
            if (token) {
                // Already connected - fetch user ID and save
                const userInfo = await spotifyService.getUserProfile(token);
                if (userInfo) {
                    await firebaseService.updateUserPlatform('spotifyId', userInfo.id);
                    setConnectedPlatforms(prev => ({ ...prev, spotifyId: userInfo.id }));
                    onProfileUpdate?.();
                }
            } else {
                // Redirect to Spotify OAuth
                const redirectUri = window.location.origin + '/';
                const loginUrl = await spotifyService.getLoginUrl(redirectUri);
                // Store that we're connecting from profile settings
                sessionStorage.setItem('spotify_connect_source', 'profile');
                window.location.href = loginUrl;
            }
        } catch (error) {
            console.error('Spotify connect error:', error);
        } finally {
            setLoading(prev => ({ ...prev, spotify: false }));
        }
    };

    const handleDisconnect = async (platformKey) => {
        setLoading(prev => ({ ...prev, [platformKey]: true }));
        try {
            await firebaseService.disconnectPlatform(platformKey);
            setConnectedPlatforms(prev => ({ ...prev, [platformKey]: '' }));
            onProfileUpdate?.();
        } catch (error) {
            console.error('Disconnect error:', error);
        } finally {
            setLoading(prev => ({ ...prev, [platformKey]: false }));
        }
    };

    const getPlatformKey = (id) => {
        const map = {
            spotify: 'spotifyId',
            youtube: 'ytMusicId',
            apple: 'appleId',
            deezer: 'deezerId',
            soundcloud: 'soundCloudId'
        };
        return map[id];
    };

    const isConnected = (platformId) => {
        const key = getPlatformKey(platformId);
        return !!connectedPlatforms[key];
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg bg-[#0a0a0a] rounded-3xl border border-[#222] overflow-hidden shadow-2xl"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-[#222] flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Profil Ayarları</h2>
                            <p className="text-sm text-neutral-500 mt-1">Platform bağlantılarını yönet</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-[#111] hover:bg-[#1a1a1a] flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* User Info */}
                    <div className="p-6 border-b border-[#222]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                                {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold">{userProfile?.displayName || 'Kullanıcı'}</p>
                                <p className="text-sm text-neutral-500">{userProfile?.email}</p>
                            </div>
                            <span
                                className="px-3 py-1 rounded-full text-xs font-bold"
                                style={{
                                    backgroundColor: `${tierInfo?.color}20`,
                                    color: tierInfo?.color
                                }}
                            >
                                {tierInfo?.displayName}
                            </span>
                        </div>
                    </div>

                    {/* Platform Connections */}
                    <div className="p-6">
                        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">
                            Platform Bağlantıları
                        </h3>
                        <div className="space-y-3">
                            {PLATFORMS.map((platform) => {
                                const connected = isConnected(platform.id);
                                const canAccess = platform.freeAccess || isPremium;
                                const platformKey = getPlatformKey(platform.id);
                                const isLoading = loading[platform.id];

                                return (
                                    <div
                                        key={platform.id}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${connected
                                            ? 'bg-[#111] border-green-500/30'
                                            : canAccess
                                                ? 'bg-[#111] border-[#222] hover:border-[#333]'
                                                : 'bg-[#0a0a0a] border-[#1a1a1a] opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: `${platform.color}20`, color: platform.color }}
                                            >
                                                {platform.icon}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{platform.name}</p>
                                                {connected && (
                                                    <p className="text-xs text-green-400">Bağlı</p>
                                                )}
                                                {!canAccess && (
                                                    <p className="text-xs text-orange-400">Premium Gerekli</p>
                                                )}
                                            </div>
                                        </div>

                                        {canAccess ? (
                                            connected ? (
                                                <button
                                                    onClick={() => handleDisconnect(platformKey)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                                >
                                                    {isLoading ? '...' : 'Bağlantıyı Kes'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={platform.id === 'spotify' ? handleConnectSpotify : () => { }}
                                                    disabled={isLoading || platform.id !== 'spotify'}
                                                    className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                                                >
                                                    {isLoading ? '...' : 'Bağla'}
                                                </button>
                                            )
                                        ) : (
                                            <button
                                                onClick={() => setShowPricingModal(true)}
                                                className="px-4 py-2 rounded-xl text-sm font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                Yükselt
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {!isPremium && (
                            <div className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20">
                                <p className="text-sm text-neutral-300">
                                    <span className="text-orange-400 font-semibold">Premium</span> ile tüm platformlara bağlanın ve müzik deneyiminizi genişletin!
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default ProfileSettings;
