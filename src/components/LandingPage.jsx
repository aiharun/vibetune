import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import playlistService from '../services/PlaylistService';
import aiService from '../services/AIService';
import spotifyService from '../services/SpotifyService';
import recommendationService from '../services/RecommendationService';
import firebaseService from '../services/FirebaseService';
import subscriptionService, { TIERS } from '../services/SubscriptionService';
import AuthModal from './AuthModal';
import PricingModal from './PricingModal';

function LandingPage({ setAnalysisResult, setIsAnalyzing }) {
    const location = useLocation();
    const [autoStart, setAutoStart] = useState(false);
    const pendingIntentRef = useRef(null);
    const [inputType, setInputType] = useState('playlist');
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);

    // Auto-Run Effect (Triggered by Refresh/Retry from ResultsPage)
    useEffect(() => {
        if (location.state?.autoRun) {
            const { inputValue: newVal, inputType: newType, intentData: passedIntent } = location.state;
            if (newVal) setInputValue(newVal);
            if (newType) setInputType(newType);
            if (passedIntent) pendingIntentRef.current = passedIntent;
            setAutoStart(true);
            // Clear history state to prevent loop
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        if (autoStart && inputValue) {
            handleAnalyze(null, pendingIntentRef.current);
            pendingIntentRef.current = null;
            setAutoStart(false);
        }
    }, [autoStart, inputValue]);
    const navigate = useNavigate();

    // Auth state listener
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
        return () => unsubscribe();
    }, []);

    // Handle Spotify OAuth callback (from Profile Settings connection)
    useEffect(() => {
        const handleSpotifyCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const connectSource = sessionStorage.getItem('spotify_connect_source');

            if (code && connectSource === 'profile') {
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                sessionStorage.removeItem('spotify_connect_source');

                try {
                    const redirectUri = window.location.origin + '/';
                    const authData = await spotifyService.getAccessTokenFromCode(code, redirectUri);

                    if (authData?.accessToken) {
                        // Save token to session
                        sessionStorage.setItem('spotify_access_token', authData.accessToken);

                        // Get user profile and save to Firebase
                        const spotifyProfile = await spotifyService.getUserProfile(authData.accessToken);
                        if (spotifyProfile && user) {
                            await firebaseService.updateUserPlatform('spotifyId', spotifyProfile.id);
                            // Refresh user profile
                            const profile = await firebaseService.getUserProfile();
                            setUserProfile(profile);
                        }
                    }
                } catch (error) {
                    console.error('Spotify connect callback error:', error);
                }
            }
        };

        handleSpotifyCallback();
    }, [user]);

    // Detect platform as user types
    const detectedPlatform = useMemo(() => {
        if (inputType !== 'playlist' || !inputValue.trim()) return null;
        return playlistService.detectPlatform(inputValue);
    }, [inputValue, inputType]);

    // Get tier features
    const tierFeatures = useMemo(() => {
        return subscriptionService.getTierFeatures(userProfile?.tier || TIERS.FREE);
    }, [userProfile]);

    // Check if user can analyze
    const analysisStatus = useMemo(() => {
        if (!userProfile) return { allowed: true, remaining: 3 };
        return subscriptionService.canAnalyze(userProfile.tier, userProfile.credits || 0);
    }, [userProfile]);

    // Check platform support
    const platformSupported = useMemo(() => {
        if (!detectedPlatform) return true;
        if (!userProfile) return detectedPlatform.id === 'spotify'; // Free tier only Spotify
        return subscriptionService.isPlatformSupported(userProfile.tier, detectedPlatform.id);
    }, [detectedPlatform, userProfile]);

    const handleAnalyze = async (e, overrideIntentData) => {
        if (e && e.preventDefault) e.preventDefault();
        // Auth check
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        if (!inputValue.trim()) {
            setError('Lütfen bir playlist linki veya açıklama girin');
            return;
        }

        // Check analysis limit
        if (!analysisStatus.allowed) {
            setShowPricingModal(true);
            return;
        }

        // Check platform support
        if (detectedPlatform && !platformSupported) {
            setError(`${detectedPlatform.name} platformu Premium üyelik gerektirir. Şimdilik sadece Spotify linkleri ile analiz yapabilirsiniz.`);
            return;
        }

        setError('');
        setLoading(true);
        setIsAnalyzing?.(true);

        try {
            let trackData = '';
            let sourceTracks = [];
            let platform = null;
            let intentData = {};

            if (inputType === 'playlist') {
                console.log('Fetching playlist data for:', inputValue);
                // Multi-platform detection
                const playlistData = await playlistService.getPlaylistData(inputValue);
                platform = playlistData.platform;

                if (playlistData.isDirectFetch) {
                    // Spotify - we have actual tracks
                    sourceTracks = playlistData.tracks;
                    trackData = playlistData.trackData;
                } else {
                    // Other platforms - use AI context
                    trackData = playlistService.createAnalysisPrompt(playlistData, '');
                }
            }

            let result;

            // Check for artist names in manual input
            if (inputType === 'manual') {
                console.log('Manual input:', inputValue);

                // --- NEW V2 PIPELINE (Audio-Feature Based) ---
                let newFlowSuccess = false;
                let stats = {};

                try {
                    console.log('Starting V2 Pipeline (Stage A-F)...');

                    // STAGE A: Intent Parsing (LLM) - Skip if overriding intent provided
                    // This allows "Refresh" to get new songs with SAME prompt/intent
                    intentData = overrideIntentData || await aiService.parseUserIntent(inputValue);
                    console.log('Stage A (Intent):', intentData);

                    // STAGE B, C, D, E: Candidate Processing (Code)
                    // Query Build -> Spotify Search -> Audio Filter -> Diversity
                    const processed = await recommendationService.processCandidateTracks(intentData, spotifyService);
                    const filteredTracks = processed.selected || [];
                    stats = processed.stats || {};

                    if (filteredTracks.length > 0) {
                        // STAGE F: Explanation (LLM)
                        result = await aiService.explainTracks(filteredTracks, intentData);

                        // MERGE GROUND TRUTH STATS
                        if (processed.vibeStats) {
                            result.vibeAnalysis = {
                                ...result.vibeAnalysis,
                                ...processed.vibeStats
                            };
                        }

                        newFlowSuccess = true;
                        console.log('Stage F (Explanation): Done');
                    } else {
                        console.warn('V2 Pipeline: No tracks passed strict filters.', stats);
                    }
                } catch (e) {
                    console.error('V2 Pipeline Error:', e);
                }

                if (!newFlowSuccess) {
                    console.log('Strict Pipeline Failure: No tracks found or API error.');

                    const failReason = stats.total > 0
                        ? `Analiz Edilen: ${stats.total} şarkı. \nElenenler:\n- ${stats.genreFiltered} şarkı kara listeden (Rap/Remix)\n- ${stats.audioFiltered} şarkı Enerji/BPM kriterinden\n- ${stats.audioMissing} şarkı veri eksikliğinden.\nGeriye kalan aday sayısı: 0`
                        : 'Spotify ve Playlist taramalarından (Türkçe Slow vb.) hiç aday şarkı gelmedi. Bağlantı sorunu olabilir.';

                    // STRICT FAIL: Return detailed empty result
                    result = {
                        vibeAnalysis: {
                            mood: 'Sonuç Bulunamadı (Strict Mode)',
                            vibeDescription: `Maalesef kriterlerine tam uyan şarkı bulunamadı.\n\n${failReason}\n\nLütfen aramayı "slow pop" gibi biraz daha genelleyerek tekrar dene.`,
                            dominantGenres: intentData.explicit_genres || []
                        },
                        recommendations: []
                    };
                }
            } else {
                // PLAYLIST MODE
                console.log('Playlist mode - analyzing tracks...');
                result = await aiService.analyzeAndRecommend(trackData, '', tierFeatures.recommendationCount);
            }

            console.log('Analysis complete:', result);

            // For Spotify playlists, get real recommendations from Spotify API
            let finalRecommendations = result.recommendations;
            if (platform === 'spotify' && sourceTracks && sourceTracks.length > 0) {
                try {
                    console.log('Fetching Spotify recommendations...');
                    const spotifyRecs = await spotifyService.getRecommendations(sourceTracks, tierFeatures.recommendationCount);
                    if (spotifyRecs && spotifyRecs.length > 0) {
                        console.log('Got Spotify recommendations:', spotifyRecs);
                        // Use Spotify recommendations but keep AI reasons
                        finalRecommendations = spotifyRecs.map((rec, i) => ({
                            ...rec,
                            reason: result.recommendations[i]?.reason || `${result.vibeAnalysis.mood} havanıza uygun bir öneri`
                        }));
                    }
                } catch (spotifyError) {
                    console.warn('Spotify recommendations failed, using AI recommendations:', spotifyError);
                    // Fall back to AI recommendations with album art search
                }
            }

            // For AI recommendations without album art, search Spotify for album art
            if (finalRecommendations.some(rec => !rec.albumArt)) {
                console.log('Fetching album art for AI recommendations...');
                const enhancedRecs = await Promise.all(
                    finalRecommendations.map(async (rec) => {
                        if (rec.albumArt) return rec;
                        try {
                            const spotifyTrack = await spotifyService.searchTrack(rec.spotifySearchQuery || `${rec.name} ${rec.artist}`);
                            if (spotifyTrack) {
                                return {
                                    ...rec,
                                    albumArt: spotifyTrack.albumArt,
                                    spotifyUrl: spotifyTrack.spotifyUrl || rec.spotifyUrl
                                };
                            }
                        } catch (e) {
                            console.warn('Failed to get album art for:', rec.name);
                        }
                        return rec;
                    })
                );
                finalRecommendations = enhancedRecs;
            }

            // Use credit - don't let it block navigation if it takes too long
            firebaseService.useCredit().then(() => {
                firebaseService.getUserProfile().then(newProfile => setUserProfile(newProfile));
            }).catch(err => console.error('Failed to update credits:', err));

            setAnalysisResult?.({ ...result, recommendations: finalRecommendations, inputType, inputValue, sourceTracks, platform, intentData });
            navigate('/results');
        } catch (err) {
            console.error('Analysis error:', err);
            setError(err.message || 'Analiz başarısız. Tekrar deneyin.');
        } finally {
            setLoading(false);
            setIsAnalyzing?.(false);
        }
    };

    const handleUpgrade = async (tierId) => {
        // Simulated upgrade - in real app this would go to payment
        await firebaseService.updateUserTier(tierId);
        const newProfile = await firebaseService.getUserProfile();
        setUserProfile(newProfile);
        setShowPricingModal(false);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Hero Section */}
            <section className="min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center max-w-3xl mx-auto"
                >
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] mb-8">
                        <span className="text-orange-400">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                            </svg>
                        </span>
                        <span className="text-sm text-neutral-300">AI-Powered Music Analysis</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                        Your music taste,{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-400 to-violet-400">
                            decoded.
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-xl mx-auto">
                        Paste a{' '}
                        <span className="text-orange-400">playlist link</span>{' '}
                        or{' '}
                        <span className="text-violet-400">describe your vibe</span>.
                        We'll analyze your taste and recommend songs you'll actually love.
                    </p>

                    {/* Tab Switcher */}
                    <div className="flex justify-center mb-6">
                        <div className="flex p-1 bg-[#1a1a1a] rounded-full border border-[#2a2a2a]">
                            <button
                                onClick={() => setInputType('playlist')}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${inputType === 'playlist'
                                    ? 'bg-[#2a2a2a] text-white'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Playlist Link
                            </button>
                            <button
                                onClick={() => setInputType('manual')}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${inputType === 'manual'
                                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                                    : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                Describe Your Taste
                            </button>
                        </div>
                    </div>

                    {/* Input Card */}
                    <div className="max-w-xl mx-auto bg-[#111111] rounded-2xl border border-[#222222] p-6 mb-4">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={
                                inputType === 'playlist'
                                    ? 'Paste your playlist link from any platform...'
                                    : 'Describe the vibe you want...'
                            }
                            className="w-full bg-transparent border-b border-[#333] pb-4 mb-4 text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
                        />

                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            style={detectedPlatform && inputType === 'playlist' ? {
                                backgroundColor: detectedPlatform.color,
                                color: '#000'
                            } : {
                                backgroundColor: '#fff',
                                color: '#000'
                            }}
                        >
                            {/* Platform Icon */}
                            {detectedPlatform && inputType === 'playlist' && (
                                <>
                                    {detectedPlatform.id === 'spotify' && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                        </svg>
                                    )}
                                    {detectedPlatform.id === 'youtube' && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
                                        </svg>
                                    )}
                                    {detectedPlatform.id === 'apple' && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.401-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393z" />
                                        </svg>
                                    )}
                                    {detectedPlatform.id === 'deezer' && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38H6.27zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027H6.27zm6.27 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03H6.27zm6.27 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z" />
                                        </svg>
                                    )}
                                    {detectedPlatform.id === 'soundcloud' && (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm3.713.14c-.209 0-.404.041-.59.104-.123-2.689-2.322-4.842-5.05-4.842-1.327 0-2.529.519-3.429 1.363-.177.167-.227.4-.058.59v10.048c0 .218.177.4.395.413 3.164.009 9.277.009 9.277.009 1.809 0 3.273-1.45 3.273-3.236-.009-1.786-1.455-3.186-3.264-3.186z" />
                                        </svg>
                                    )}
                                </>
                            )}
                            {loading ? 'Analyzing...' : detectedPlatform && inputType === 'playlist'
                                ? `Analyze with ${detectedPlatform.name}`
                                : 'Analyze My Taste'}
                        </button>

                        {error && (
                            <p className="mt-4 text-red-400 text-sm">{error}</p>
                        )}
                    </div>

                    {/* Supported Platforms */}
                    <div className="flex items-center justify-center gap-6 mb-6">
                        <span className="text-xs text-neutral-500">Supports:</span>
                        <div className="flex items-center gap-4">
                            {/* Spotify - Always available */}
                            <div className="group flex items-center gap-1.5 text-neutral-500 hover:text-[#1DB954] transition-colors cursor-default">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                <span className="text-xs font-medium hidden sm:inline">Spotify</span>
                            </div>

                            {/* YouTube Music - Premium */}
                            <div className={`group flex items-center gap-1.5 transition-colors cursor-default ${tierFeatures.platforms.includes('youtube') ? 'text-neutral-500 hover:text-[#FF0000]' : 'text-neutral-700 opacity-50'}`}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228 18.228 15.432 18.228 12 15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" />
                                </svg>
                                <span className="text-xs font-medium hidden sm:inline">YT Music</span>
                                {!tierFeatures.platforms.includes('youtube') && <span className="text-[8px] text-orange-500 font-bold">PRO</span>}
                            </div>

                            {/* Apple Music - Premium */}
                            <div className={`group flex items-center gap-1.5 transition-colors cursor-default ${tierFeatures.platforms.includes('apple') ? 'text-neutral-500 hover:text-[#FC3C44]' : 'text-neutral-700 opacity-50'}`}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.401-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.775-.6-1.943-1.546-.142-.803.17-1.724 1.22-2.167.42-.177.862-.282 1.305-.405.51-.147.76-.42.79-.96.008-.142.002-.283.002-.424V8.725c0-.312-.086-.428-.39-.484-.838-.156-1.675-.313-2.512-.473l-3.482-.656c-.323-.06-.452.038-.477.372-.005.062-.002.125-.002.187v7.82c0 .463-.05.92-.268 1.337-.3.572-.766.93-1.382 1.1-.35.097-.706.148-1.064.164-.978.04-1.794-.606-1.95-1.59-.104-.65.077-1.21.503-1.68.34-.378.77-.594 1.252-.74.34-.103.693-.178 1.04-.267.478-.123.694-.385.72-.87.003-.058.002-.117.002-.175V5.8c0-.43.1-.54.52-.603.53-.08 1.062-.152 1.593-.227l3.463-.5 2.554-.367c.404-.058.81-.113 1.214-.172.3-.043.416.063.447.37.005.054.007.11.007.164v5.65z" />
                                </svg>
                                <span className="text-xs font-medium hidden sm:inline">Apple</span>
                                {!tierFeatures.platforms.includes('apple') && <span className="text-[8px] text-orange-500 font-bold">PRO</span>}
                            </div>

                            {/* Deezer - Premium */}
                            <div className={`group flex items-center gap-1.5 transition-colors cursor-default ${tierFeatures.platforms.includes('deezer') ? 'text-neutral-500 hover:text-[#FEAA2D]' : 'text-neutral-700 opacity-50'}`}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38H6.27zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027H6.27zm6.27 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03H6.27zm6.27 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z" />
                                </svg>
                                <span className="text-xs font-medium hidden sm:inline">Deezer</span>
                                {!tierFeatures.platforms.includes('deezer') && <span className="text-[8px] text-orange-500 font-bold">PRO</span>}
                            </div>

                            {/* SoundCloud - Premium */}
                            <div className={`group flex items-center gap-1.5 transition-colors cursor-default ${tierFeatures.platforms.includes('soundcloud') ? 'text-neutral-500 hover:text-[#FF5500]' : 'text-neutral-700 opacity-50'}`}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899 1.425c-.055 0-.1.046-.108.104l-.2 1.775.2 1.725c.008.054.053.1.108.1.054 0 .096-.046.104-.1l.23-1.725-.23-1.775c-.008-.054-.05-.104-.104-.104zm2.451-.775c-.059 0-.104.05-.113.109l-.213 2.504.213 2.4c.009.059.054.109.113.109.057 0 .104-.05.113-.109l.241-2.4-.241-2.504c-.009-.059-.056-.109-.113-.109zm.896-.727c-.064 0-.114.054-.122.113l-.196 3.236.196 3.085c.008.059.058.113.122.113.063 0 .113-.054.121-.113l.227-3.085-.227-3.236c-.008-.059-.058-.113-.121-.113zm.896-.363c-.069 0-.119.059-.128.122l-.18 3.599.18 3.421c.009.068.059.122.128.122.068 0 .118-.054.127-.122l.205-3.421-.205-3.599c-.009-.063-.059-.122-.127-.122zm.95-.149c-.073 0-.128.063-.136.131l-.163 3.748.163 3.667c.008.068.063.131.136.131.073 0 .127-.063.136-.131l.186-3.667-.186-3.748c-.009-.068-.063-.131-.136-.131zm.943-.107c-.078 0-.133.068-.141.14l-.15 3.856.15 3.775c.008.073.063.141.141.141.077 0 .132-.068.14-.141l.171-3.775-.171-3.856c-.008-.072-.063-.14-.14-.14zm.951.193c-.082 0-.137.072-.146.149l-.136 3.512.136 3.63c.009.077.064.149.146.149.082 0 .137-.072.145-.149l.155-3.63-.155-3.512c-.008-.077-.063-.149-.145-.149zm.951-.357c-.086 0-.142.077-.15.159l-.12 3.869.12 3.739c.008.082.064.159.15.159.086 0 .141-.077.15-.159l.136-3.739-.136-3.869c-.009-.082-.064-.159-.15-.159zm3.713.14c-.209 0-.404.041-.59.104-.123-2.689-2.322-4.842-5.05-4.842-1.327 0-2.529.519-3.429 1.363-.177.167-.227.4-.058.59v10.048c0 .218.177.4.395.413 3.164.009 9.277.009 9.277.009 1.809 0 3.273-1.45 3.273-3.236-.009-1.786-1.455-3.186-3.264-3.186-.15 0-.313.014-.463.041-.073-.186-.159-.368-.254-.536l.009.009c-.532-.941-1.545-1.577-2.713-1.577z" />
                                </svg>
                                <span className="text-xs font-medium hidden sm:inline">SoundCloud</span>
                                {!tierFeatures.platforms.includes('soundcloud') && <span className="text-[8px] text-orange-500 font-bold">PRO</span>}
                            </div>
                        </div>
                    </div>

                    {/* Sample Link */}
                    <Link to="/results" className="text-sm text-neutral-400 hover:text-white transition-colors inline-flex items-center gap-1">
                        See a sample result
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-neutral-500">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Private
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            No signup needed
                        </div>
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Takes ~20 seconds
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-4 border-t border-[#1a1a1a]">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">What you'll get</h2>
                        <p className="text-neutral-400">
                            Deep <span className="text-orange-400">insights</span> into your musical preferences with{' '}
                            <span className="text-violet-400">personalized recommendations</span>
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                ),
                                title: 'Taste Profile',
                                description: 'Detailed breakdown of your musical preferences including mood, energy levels, and era preferences.'
                            },
                            {
                                icon: (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                ),
                                title: 'Why you\'ll like it',
                                description: 'AI-powered explanations for each recommendation so you understand the connection to your taste.'
                            },
                            {
                                icon: (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                ),
                                title: 'Match Score',
                                description: 'Precision matching from 0-100 showing how well each song aligns with your unique taste.'
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="p-6 bg-[#111111] rounded-2xl border border-[#222222] hover:border-[#333] transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white mb-4">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-neutral-400 text-sm leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Demo Section */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-12">See it in action</h2>

                        {/* Preview Card */}
                        <div className="bg-[#111111] rounded-2xl border border-[#222222] overflow-hidden">
                            <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-[#151515] to-[#0a0a0a]">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#1a1a1a] flex items-center justify-center">
                                        <svg className="w-8 h-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-neutral-500 text-sm">Sample results preview</p>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 border-t border-[#222]">
                                <div className="p-6 border-r border-[#222]">
                                    <h4 className="text-sm font-semibold mb-1">Mood Profile</h4>
                                    <p className="text-neutral-500 text-xs">Melancholic, Introspective, Energetic</p>
                                </div>
                                <div className="p-6">
                                    <h4 className="text-sm font-semibold mb-1">Top Match</h4>
                                    <p className="text-neutral-500 text-xs">96% match • Indie Rock • 2020s</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-4 border-t border-[#1a1a1a]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                        <span className="font-semibold">VibeTune</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowPricingModal(true)}
                            className="text-sm text-neutral-400 hover:text-white transition-colors"
                        >
                            Planlar
                        </button>
                        <p className="text-sm text-neutral-500">© 2024 VibeTune. Built with AI.</p>
                    </div>
                </div>
            </footer>

            {/* Modals */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
            <PricingModal
                isOpen={showPricingModal}
                onClose={() => setShowPricingModal(false)}
                currentTier={userProfile?.tier || TIERS.FREE}
                onUpgrade={handleUpgrade}
            />
        </div>
    );
}

/* Helper Function for Stage B, D, E - Orchestration & Filtering */
/* Helper Function moved to RecommendationService.js */

export default LandingPage;
