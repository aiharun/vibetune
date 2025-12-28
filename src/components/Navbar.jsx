import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import firebaseService from '../services/FirebaseService';
import { TIER_FEATURES, TIERS } from '../services/SubscriptionService';
import AuthModal from './AuthModal';
import ProfileSettings from './ProfileSettings';

function Navbar() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [scrolled, setScrolled] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const location = useLocation();

    useEffect(() => {
        firebaseService.initialize();
        const unsubscribe = firebaseService.onAuthChange(async (user) => {
            setUser(user);
            if (user) {
                const profile = await firebaseService.getUserProfile();
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
        });

        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);

        return () => {
            unsubscribe();
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const handleSignOut = async () => {
        try {
            await firebaseService.signOutUser();
            setShowDropdown(false);
        } catch (e) {
            console.error(e);
        }
    };

    const tierInfo = TIER_FEATURES[userProfile?.tier || TIERS.FREE];

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-lg border-b border-[#1a1a1a]' : 'bg-transparent'
                }`}>
                <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 group">
                        <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                        <span className="font-semibold text-white">VibeTune</span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-sm text-neutral-400 hover:text-white transition-colors">
                            Features
                        </a>
                        <a href="#how" className="text-sm text-neutral-400 hover:text-white transition-colors">
                            How it works
                        </a>
                        {user && (
                            <Link
                                to="/my-vibes"
                                className={`text-sm transition-colors ${location.pathname === '/my-vibes' ? 'text-white' : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                My Vibes
                            </Link>
                        )}
                    </div>

                    {/* Auth Section */}
                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                                        {user.displayName?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <span className="hidden sm:block">{user.displayName || 'User'}</span>
                                    {/* Tier Badge */}
                                    <span
                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                        style={{
                                            backgroundColor: `${tierInfo.color}20`,
                                            color: tierInfo.color
                                        }}
                                    >
                                        {tierInfo.displayName}
                                    </span>
                                </button>

                                {showDropdown && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#111] rounded-xl border border-[#222] overflow-hidden shadow-lg">
                                        {/* Usage Info */}
                                        <div className="px-4 py-3 border-b border-[#222]">
                                            <p className="text-xs text-neutral-500 mb-1">Bu hafta</p>
                                            <p className="text-sm font-medium text-white">
                                                {userProfile?.credits ?? 0} / {tierInfo.weeklyCreditLimit === Infinity ? '∞' : tierInfo.weeklyCreditLimit} kredi
                                            </p>
                                        </div>
                                        <Link
                                            to="/my-vibes"
                                            onClick={() => setShowDropdown(false)}
                                            className="block px-4 py-3 text-sm text-neutral-300 hover:bg-[#1a1a1a] transition-colors"
                                        >
                                            Arşivim
                                        </Link>
                                        <button
                                            onClick={() => {
                                                setShowProfileSettings(true);
                                                setShowDropdown(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-neutral-300 hover:bg-[#1a1a1a] transition-colors flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            Profil Ayarları
                                        </button>
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-[#1a1a1a] transition-colors"
                                        >
                                            Çıkış Yap
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="text-sm text-neutral-400 hover:text-white transition-colors"
                            >
                                Sign Up
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <ProfileSettings
                isOpen={showProfileSettings}
                onClose={() => setShowProfileSettings(false)}
                userProfile={userProfile}
                onProfileUpdate={async () => {
                    const profile = await firebaseService.getUserProfile();
                    setUserProfile(profile);
                }}
            />
        </>
    );
}

export default Navbar;
