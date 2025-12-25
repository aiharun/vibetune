import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SongCard from './SongCard';
import VibeAnalysis from './VibeAnalysis';
import PricingModal from './PricingModal';
import firebaseService from '../services/FirebaseService';
import aiService from '../services/AIService';
import spotifyService from '../services/SpotifyService';
import subscriptionService, { TIERS } from '../services/SubscriptionService';

function ResultsPage({ analysisResult: propAnalysisResult, setAnalysisResult }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [saveStatus, setSaveStatus] = useState('idle');
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentRecommendations, setCurrentRecommendations] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
    const [spotifyUserToken, setSpotifyUserToken] = useState(null);
    const [spotifyUserProfile, setSpotifyUserProfile] = useState(null);
    const [exporting, setExporting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Check for Spotify Access Token in URL hash (callback handling)
    useEffect(() => {
        const token = spotifyService.getTokenFromUrl();
        if (token) {
            setSpotifyUserToken(token);
            window.location.hash = ''; // Clear hash

            // Get user profile
            spotifyService.getUserProfile(token)
                .then(profile => setSpotifyUserProfile(profile))
                .catch(err => console.error('Spotify profile error:', err));
        }
    }, []);

    // Determine analysis data from props or navigation state
    const analysisResult = useMemo(() => {
        if (propAnalysisResult) return propAnalysisResult;

        // If coming from MyVibes (Archive)
        const stateData = location.state?.analysisData;
        if (stateData) {
            // Map the nested schema back to the flat format expected by components
            return {
                vibeAnalysis: stateData.analysisResult?.fullAnalysis || {
                    mood: stateData.analysisResult?.vibeName,
                    dominantGenres: stateData.analysisResult?.characteristics,
                    vibeDescription: stateData.analysisResult?.summary
                },
                recommendations: stateData.analysisResult?.recommendations || [],
                inputType: stateData.input?.type,
                inputValue: stateData.input?.sourceUrl,
                isFromArchive: true
            };
        }

        // Check session storage for persisted result (e.g. returning from Spotify auth)
        try {
            const storedResult = sessionStorage.getItem('tempAnalysisResult');
            if (storedResult) {
                // Optional: Clear it if you want to avoid stale data, 
                // but usually keeping it until new analysis is fine for UX.
                // sessionStorage.removeItem('tempAnalysisResult'); 
                return JSON.parse(storedResult);
            }
        } catch (e) {
            console.error('Failed to parse stored analysis result', e);
        }

        return null;
    }, [propAnalysisResult, location.state]);

    // Initialize currentRecommendations from analysisResult
    useEffect(() => {
        if (analysisResult?.recommendations && !currentRecommendations) {
            setCurrentRecommendations(analysisResult.recommendations);
        }
    }, [analysisResult, currentRecommendations]);

    useEffect(() => {
        if (!analysisResult) {
            navigate('/');
            return;
        }
        firebaseService.initialize();
        const unsubscribe = firebaseService.onAuthChange(async (user) => {
            setUser(user);
            if (user) {
                const profile = await firebaseService.getUserProfile();
                setUserProfile(profile);
            }
        });
        return () => unsubscribe();
    }, [analysisResult, navigate]);

    const tierFeatures = useMemo(() => {
        return subscriptionService.getTierFeatures(userProfile?.tier || TIERS.FREE);
    }, [userProfile]);

    const handleSaveVibe = async () => {
        if (!user) return;

        if (!tierFeatures.canSaveResults) {
            setShowPricingModal(true);
            return;
        }

        setSaveStatus('saving');
        try {
            await firebaseService.saveVibe({ ...analysisResult, recommendations: currentRecommendations || analysisResult.recommendations });
            setSaveStatus('saved');
        } catch (e) {
            console.error(e);
            setSaveStatus('error');
        }
    };

    const handleUpgrade = async (tierId) => {
        await firebaseService.updateUserTier(tierId);
        const newProfile = await firebaseService.getUserProfile();
        setUserProfile(newProfile);
        setShowPricingModal(false);
    };

    // Refresh recommendations
    const handleRefresh = async () => {
        if (refreshing) return;

        setRefreshing(true);
        try {
            const { inputType, sourceTracks, platform, vibeAnalysis } = analysisResult;
            let newRecommendations = [];

            if (inputType === 'playlist' && platform === 'spotify' && sourceTracks && sourceTracks.length > 0) {
                // For Spotify playlists, get new recommendations from Spotify API
                newRecommendations = await spotifyService.getRecommendations(sourceTracks, tierFeatures.recommendationCount);

                // Add reasons based on vibe analysis
                newRecommendations = newRecommendations.map(rec => ({
                    ...rec,
                    reason: `${vibeAnalysis.mood} havanıza uygun bir öneri`
                }));
            } else {
                // For manual input or non-Spotify, use AI to generate new recommendations
                const trackData = inputType === 'playlist' ?
                    (analysisResult.inputValue || '') : '';
                const preferences = inputType === 'manual' ?
                    (analysisResult.inputValue || '') : '';

                const result = await aiService.analyzeAndRecommend(trackData, preferences, tierFeatures.recommendationCount);
                newRecommendations = result.recommendations;

                // Fetch album art for AI recommendations
                const enhancedRecs = await Promise.all(
                    newRecommendations.map(async (rec) => {
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
                newRecommendations = enhancedRecs;
            }

            if (newRecommendations.length > 0) {
                setCurrentRecommendations(newRecommendations);
                // Update parent state if available
                if (setAnalysisResult) {
                    setAnalysisResult(prev => prev ? { ...prev, recommendations: newRecommendations } : prev);
                }
            }
        } catch (error) {
            console.error('Refresh error:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Playlist handlers
    const addToPlaylist = (song) => {
        if (!playlist.find(s => s.name === song.name && s.artist === song.artist)) {
            setPlaylist(prev => [...prev, song]);
            if (!showPlaylistPanel) setShowPlaylistPanel(true);
        }
    };

    const removeFromPlaylist = (song) => {
        setPlaylist(prev => prev.filter(s => !(s.name === song.name && s.artist === song.artist)));
    };

    const isInPlaylist = (song) => {
        return playlist.some(s => s.name === song.name && s.artist === song.artist);
    };

    const copyPlaylistToClipboard = () => {
        const text = playlist.map((s, i) => `${i + 1}. ${s.name} - ${s.artist || s.artistsString}`).join('\n');
        navigator.clipboard.writeText(text);
    };

    const handleConnectSpotify = () => {
        // Save analysis result to session storage to persist across redirect
        if (analysisResult) {
            sessionStorage.setItem('tempAnalysisResult', JSON.stringify(analysisResult));
        }

        // Redirect back to this page (/results) to handle the token
        const redirectUri = window.location.origin + '/results';
        window.location.href = spotifyService.getLoginUrl(redirectUri);
    };

    const handleSaveToSpotify = async () => {
        if (!spotifyUserToken || !spotifyUserProfile || playlist.length === 0) return;

        setExporting(true);
        try {
            // 1. Create Playlist
            const playlistName = `TasteMirror: ${analysisResult.vibeAnalysis?.mood || 'My Vibe'}`;
            const description = `Generated by TasteMirror based on my music taste. ${analysisResult.vibeAnalysis?.vibeDescription || ''}`;

            const newPlaylist = await spotifyService.createPlaylist(
                spotifyUserToken,
                spotifyUserProfile.id,
                playlistName,
                description
            );

            // 2. Get URIs
            // If we have direct URI from object use it, otherwise might need search
            // Assuming recommendation objects have `uri` or `id` -> `spotify:track:ID`
            const uris = playlist.map(track => {
                if (track.uri) return track.uri;
                if (track.id) return `spotify:track:${track.id}`;
                return null;
            }).filter(Boolean);

            if (uris.length > 0) {
                // 3. Add Tracks
                await spotifyService.addTracksToPlaylist(spotifyUserToken, newPlaylist.id, uris);
                alert(`Playlist başarıyla oluşturuldu!\n"${playlistName}"`);
                setPlaylist([]); // Optional: clear playlist after save
                setShowPlaylistPanel(false);
            } else {
                alert('Eklenecek geçerli şarkı bulunamadı.');
            }

        } catch (error) {
            console.error('Export failed:', error);
            alert('Playlist oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setExporting(false);
        }
    };

    if (!analysisResult) return null;
    const { vibeAnalysis } = analysisResult;
    const recommendations = currentRecommendations || analysisResult.recommendations;

    return (
        <main className="pt-24 pb-20 px-4 md:px-6 max-w-6xl mx-auto min-h-screen bg-[#0a0a0a]">
            {/* Top Section: Vibe Analysis - Full Width */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
            >
                <VibeAnalysis
                    vibeAnalysis={vibeAnalysis}
                    isLocked={!tierFeatures.detailedAnalysis}
                    onUpgradeClick={() => setShowPricingModal(true)}
                    fullWidth={true}
                />

                {/* Action Buttons */}
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                    {!analysisResult.isFromArchive && (
                        <button
                            onClick={handleSaveVibe}
                            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${saveStatus === 'saved'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-white text-black hover:bg-neutral-200'
                                }`}
                        >
                            {!tierFeatures.canSaveResults ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    Save (Premium)
                                </span>
                            ) : (
                                saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save to Archive'
                            )}
                        </button>
                    )}
                    <Link
                        to="/"
                        className="px-6 py-3 rounded-xl font-semibold text-sm bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#222] transition-colors"
                    >
                        New Analysis
                    </Link>
                </div>
            </motion.div>

            {/* Recommendations Section */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-white">Recommended for you</h1>
                    <p className="text-neutral-500">Songs that match your taste profile</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                >
                    <motion.svg
                        animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                        transition={refreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </motion.svg>
                    {refreshing ? 'Yenileniyor...' : 'Yenile'}
                </motion.button>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={recommendations.map(r => r.name).join(',')}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {recommendations.map((song, i) => (
                        <SongCard
                            key={`${song.name}-${i}`}
                            song={song}
                            index={i}
                            showPlaylistButton={true}
                            isInPlaylist={isInPlaylist(song)}
                            onAddToPlaylist={addToPlaylist}
                            onRemoveFromPlaylist={removeFromPlaylist}
                        />
                    ))}
                </motion.div>
            </AnimatePresence>

            {analysisResult.sourceTracks && analysisResult.sourceTracks.length > 0 && (
                <div className="mt-16">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-2 text-neutral-400">Source Tracks</h2>
                        <p className="text-neutral-600">From your analyzed playlist</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60 hover:opacity-100 transition-opacity">
                        {analysisResult.sourceTracks.map((song, i) => {
                            // Check if "Listemi Ekle" toggle is potentially active for all tracks
                            // For simplicity, we disable if the track is in the playlist AND we know it's a source track
                            // But cleaner is: pass the isDisabled property if "Listemi Ekle" logic should lock it.
                            // The user request: "listemi ekle butonu aktifse kullanıcının listesinde olan müziklerin + butonu devre dışı kalsın"

                            const allSourceTracksInPlaylist = analysisResult.sourceTracks.every(st =>
                                playlist.some(p => p.name === st.name && (p.artist === st.artistsString || p.artistsString === st.artistsString || p.artist === st.artist))
                            );

                            return (
                                <SongCard
                                    key={`source-${i}`}
                                    song={{ ...song, isDisabled: allSourceTracksInPlaylist }}
                                    index={i}
                                    showPlaylistButton={true}
                                    isInPlaylist={isInPlaylist(song)}
                                    onAddToPlaylist={addToPlaylist}
                                    onRemoveFromPlaylist={removeFromPlaylist}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            <PricingModal
                isOpen={showPricingModal}
                onClose={() => setShowPricingModal(false)}
                currentTier={userProfile?.tier || TIERS.FREE}
                onUpgrade={handleUpgrade}
            />

            {/* Floating Playlist Panel */}
            <AnimatePresence>
                {playlist.length > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
                    >
                        <div className="bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="p-4 border-b border-[#222] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">Playlistim</h3>
                                        <p className="text-xs text-neutral-500">{playlist.length} şarkı</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Include Source Tracks Toggle */}
                                    {analysisResult.sourceTracks && analysisResult.sourceTracks.length > 0 && (() => {
                                        const allSourceTracksInPlaylist = analysisResult.sourceTracks.every(st =>
                                            playlist.some(p => p.name === st.name && (p.artist === st.artistsString || p.artistsString === st.artistsString || p.artist === st.artist))
                                        );

                                        return (
                                            <div className="flex items-center gap-2 mr-2">
                                                <span className="text-xs text-neutral-400 font-medium">Listemi Ekle</span>
                                                <button
                                                    onClick={() => {
                                                        if (allSourceTracksInPlaylist) {
                                                            // Remove source tracks
                                                            setPlaylist(prev => prev.filter(p =>
                                                                !analysisResult.sourceTracks.some(st =>
                                                                    st.name === p.name && (st.artistsString === p.artist || st.artist === p.artist || st.artistsString === p.artistsString)
                                                                )
                                                            ));
                                                        } else {
                                                            // Add source tracks
                                                            const newTracks = analysisResult.sourceTracks.filter(
                                                                st => !playlist.some(p => p.name === st.name && (p.artist === st.artistsString || p.artistsString === st.artistsString))
                                                            );
                                                            if (newTracks.length > 0) {
                                                                setPlaylist(prev => [...prev, ...newTracks.map(t => ({
                                                                    ...t,
                                                                    artist: t.artistsString || t.artist,
                                                                    albumArt: t.albumArt || null // Ensure albumArt is preserved or handled
                                                                }))]);
                                                            }
                                                        }
                                                    }}
                                                    className={`relative w-10 h-6 rounded-full transition-colors duration-200 ease-in-out ${allSourceTracksInPlaylist ? 'bg-orange-500' : 'bg-[#333]'
                                                        }`}
                                                >
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* Spotify Actions */}
                                    {!spotifyUserToken ? (
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleConnectSpotify}
                                            className="px-3 py-1.5 bg-[#1DB954] text-white text-xs font-medium rounded-lg hover:bg-[#1ed760] transition-colors flex items-center gap-1.5"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z" />
                                            </svg>
                                            Bağlan
                                        </motion.button>
                                    ) : (
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleSaveToSpotify}
                                            disabled={exporting || playlist.length === 0}
                                            className={`px-3 py-1.5 border border-[#1DB954] ${exporting ? 'bg-[#1DB954]/20' : 'bg-transparent hover:bg-[#1DB954] hover:text-white'} text-[#1DB954] text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${exporting || playlist.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {exporting ? (
                                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z" />
                                                </svg>
                                            )}
                                            {exporting ? 'Kaydediliyor...' : 'Kaydet'}
                                        </motion.button>
                                    )}

                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={copyPlaylistToClipboard}
                                        className="px-3 py-1.5 bg-[#222] text-white text-xs font-medium rounded-lg hover:bg-[#333] transition-colors"
                                    >
                                        Kopyala
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowPlaylistPanel(!showPlaylistPanel)}
                                        className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                                    >
                                        <svg className={`w-5 h-5 transition-transform ${showPlaylistPanel ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                    </motion.button>
                                </div>
                            </div>

                            {/* Playlist Items */}
                            <AnimatePresence>
                                {showPlaylistPanel && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="max-h-64 overflow-y-auto p-2">
                                            {playlist.map((song, i) => (
                                                <motion.div
                                                    key={`playlist-${song.name}-${i}`}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20 }}
                                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] group"
                                                >
                                                    <span className="text-xs text-neutral-600 w-5">{i + 1}</span>
                                                    {song.albumArt && (
                                                        <img src={song.albumArt} alt="" className="w-8 h-8 rounded object-cover" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white truncate">{song.name}</p>
                                                        <p className="text-xs text-neutral-500 truncate">{song.artist || song.artistsString}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromPlaylist(song)}
                                                        className="w-6 h-6 flex items-center justify-center text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>
                                        <div className="p-3 border-t border-[#222]">
                                            <button
                                                onClick={() => setPlaylist([])}
                                                className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                Tümünü Temizle
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )
                }
            </AnimatePresence >
        </main >
    );
}

export default ResultsPage;
