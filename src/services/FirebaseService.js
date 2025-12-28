/**
 * FirebaseService - Firebase Auth & Firestore Integration
 * 
 * Bu servis kullanıcı authentication ve vibe kaydetme işlemlerini yönetir.
 * Email/Password tabanlı manuel giriş sistemi kullanır.
 */

import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp,
    increment
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import subscriptionService, { TIERS } from './SubscriptionService';

// Firebase config - .env'den okunacak
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

class FirebaseService {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.functions = null;
        this.user = null;
        this.initialized = false;
    }

    /**
     * Firebase'i başlat
     */
    initialize() {
        if (this.initialized) return;

        try {
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
                console.warn('Firebase config eksik - bazı özellikler çalışmayacak');
                return;
            }

            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);
            this.functions = getFunctions(this.app);
            this.initialized = true;

            onAuthStateChanged(this.auth, (user) => {
                this.user = user;
            });
        } catch (error) {
            console.error('Firebase initialization error:', error);
        }
    }

    isInitialized() {
        return this.initialized;
    }

    /**
     * Email ile kayıt ol
     * @param {string} email
     * @param {string} password
     * @param {string} displayName
     */
    async signUpWithEmail(email, password, displayName) {
        if (!this.auth) {
            this.initialize();
            if (!this.auth) throw new Error('Firebase başlatılamadı');
        }

        try {
            const result = await createUserWithEmailAndPassword(this.auth, email, password);

            // Kullanıcı adını güncelle
            await updateProfile(result.user, { displayName });
            this.user = result.user;

            // Profil dokümanını hemen oluştur (Haftalık kredi sistemi ve yeni şema için kritik)
            const userRef = doc(this.db, 'users', result.user.uid);
            const initialTier = TIERS.FREE;
            const features = subscriptionService.getTierFeatures(initialTier);
            await setDoc(userRef, {
                uid: result.user.uid,
                email: email,
                displayName: displayName,
                authProvider: 'email',
                tier: initialTier,
                credits: features.weeklyCreditLimit,
                lastCreditReset: serverTimestamp(),
                createdAt: serverTimestamp(),
                platforms: {
                    spotifyId: '',
                    ytMusicId: '',
                    appleId: '',
                    deezerId: '',
                    soundCloudId: ''
                },
                settings: {
                    primaryPlatform: 'spotify',
                    theme: 'dark'
                }
            });

            return {
                uid: result.user.uid,
                displayName: displayName,
                email: result.user.email
            };
        } catch (error) {
            console.error('Sign-up error:', error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Bu email zaten kullanılıyor');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Şifre en az 6 karakter olmalı');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Geçersiz email adresi');
            }
            throw new Error('Kayıt oluşturulamadı');
        }
    }

    async signInWithGoogle() {
        if (!this.auth) {
            this.initialize();
            if (!this.auth) throw new Error('Firebase başlatılamadı');
        }

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(this.auth, provider);

            // Profil dökümanını kontrol et ve gerekirse oluştur
            const userRef = doc(this.db, 'users', result.user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                const initialTier = TIERS.FREE;
                const features = subscriptionService.getTierFeatures(initialTier);
                await setDoc(userRef, {
                    uid: result.user.uid,
                    email: result.user.email,
                    displayName: result.user.displayName,
                    authProvider: 'google',
                    tier: initialTier,
                    credits: features.weeklyCreditLimit,
                    lastCreditReset: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    platforms: {
                        spotifyId: '',
                        ytMusicId: '',
                        appleId: '',
                        deezerId: '',
                        soundCloudId: ''
                    },
                    settings: {
                        primaryPlatform: 'spotify',
                        theme: 'dark'
                    }
                });
            }

            return {
                uid: result.user.uid,
                displayName: result.user.displayName,
                email: result.user.email
            };
        } catch (error) {
            console.error('Google sign-in error:', error);
            if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Giriş iptal edildi');
            } else if (error.code === 'auth/popup-blocked') {
                throw new Error('Popup engellendi, lütfen izin verin');
            }
            throw new Error('Google ile giriş yapılamadı');
        }
    }

    /**
     * Email ile giriş yap
     * @param {string} email
     * @param {string} password
     */
    async signInWithEmail(email, password) {
        if (!this.auth) {
            this.initialize();
            if (!this.auth) throw new Error('Firebase başlatılamadı');
        }

        try {
            const result = await signInWithEmailAndPassword(this.auth, email, password);
            this.user = result.user;

            return {
                uid: result.user.uid,
                displayName: result.user.displayName,
                email: result.user.email
            };
        } catch (error) {
            console.error('Sign-in error:', error);
            if (error.code === 'auth/user-not-found') {
                throw new Error('Kullanıcı bulunamadı');
            } else if (error.code === 'auth/wrong-password') {
                throw new Error('Yanlış şifre');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Geçersiz email adresi');
            }
            throw new Error('Giriş yapılamadı');
        }
    }

    /**
     * Çıkış yap
     */
    async signOutUser() {
        if (!this.auth) return;

        try {
            await signOut(this.auth);
            this.user = null;
        } catch (error) {
            console.error('Sign-out error:', error);
            throw new Error('Çıkış yapılamadı');
        }
    }

    getCurrentUser() {
        if (!this.auth) return null;
        return this.auth.currentUser;
    }

    /**
     * Vibe analiz sonucunu kaydet
     */
    async saveVibe(vibeData) {
        if (!this.db || !this.user) {
            throw new Error('Kaydetmek için giriş yapmalısınız');
        }

        try {
            const vibesRef = collection(this.db, 'vibeAnalyses');
            const docRef = await addDoc(vibesRef, {
                userId: this.user.uid,
                input: {
                    type: vibeData.inputType === 'playlist' ? 'link' : 'manual_text',
                    platform: vibeData.platform || '',
                    sourceUrl: vibeData.inputValue || ''
                },
                analysisResult: {
                    vibeName: vibeData.vibeAnalysis?.mood || '',
                    characteristics: vibeData.vibeAnalysis?.dominantGenres || [],
                    summary: vibeData.vibeAnalysis?.vibeDescription || '',
                    recommendations: vibeData.recommendations || [],
                    // Save full analysis for detailed view
                    fullAnalysis: vibeData.vibeAnalysis || {}
                },
                createdAt: serverTimestamp()
            });

            return docRef.id;
        } catch (error) {
            console.error('Save vibe error:', error);
            throw new Error('Vibe kaydedilemedi');
        }
    }

    /**
     * Kullanıcının kayıtlı vibe'larını getir
     */
    async getUserVibes() {
        if (!this.db || !this.user) {
            return [];
        }

        try {
            const vibesRef = collection(this.db, 'vibeAnalyses');
            const q = query(
                vibesRef,
                where('userId', '==', this.user.uid),
                orderBy('createdAt', 'desc')
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date()
            }));
        } catch (error) {
            console.error('Get vibes error:', error);
            return [];
        }
    }

    /**
     * Kayıtlı vibe'ı sil
     */
    async deleteVibe(vibeId) {
        if (!this.db || !this.user) {
            throw new Error('Silmek için giriş yapmalısınız');
        }

        try {
            await deleteDoc(doc(this.db, 'vibeAnalyses', vibeId));
        } catch (error) {
            console.error('Delete vibe error:', error);
            throw new Error('Vibe silinemedi');
        }
    }

    /**
     * Get or create user profile with tier info and credits
     * @returns {Promise<object>} - User profile with tier and credits
     */
    async getUserProfile() {
        if (!this.db || !this.user) return null;

        try {
            const userRef = doc(this.db, 'users', this.user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                const features = subscriptionService.getTierFeatures(data.tier || TIERS.FREE);

                // Check if we need to reset weekly credits
                const now = new Date();
                const lastReset = data.lastCreditReset?.toDate?.() || new Date(0);
                const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

                if (now.getTime() - lastReset.getTime() >= oneWeekMs) {
                    // New week - reset credits
                    const resetData = {
                        credits: features.weeklyCreditLimit,
                        lastCreditReset: serverTimestamp()
                    };
                    await updateDoc(userRef, resetData);
                    return { ...data, ...resetData, lastCreditReset: now };
                }

                // Ensure new schema fields exist
                if (!data.platforms || !data.settings) {
                    const updateData = {};
                    if (!data.platforms) updateData.platforms = { spotifyId: '', ytMusicId: '', appleId: '', deezerId: '', soundCloudId: '' };
                    if (!data.settings) updateData.settings = { primaryPlatform: 'spotify', theme: 'dark' };

                    if (Object.keys(updateData).length > 0) {
                        await updateDoc(userRef, updateData);
                        return { ...data, ...updateData };
                    }
                }

                return data;
            } else {
                // Create new user profile
                const initialTier = TIERS.FREE;
                const features = subscriptionService.getTierFeatures(initialTier);
                const newProfile = {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName,
                    tier: initialTier,
                    credits: features.weeklyCreditLimit,
                    lastCreditReset: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    platforms: {
                        spotifyId: '',
                        ytMusicId: '',
                        appleId: '',
                        deezerId: '',
                        soundCloudId: ''
                    },
                    settings: {
                        primaryPlatform: 'spotify',
                        theme: 'dark'
                    }
                };
                await setDoc(userRef, newProfile);
                return newProfile;
            }
        } catch (error) {
            console.error('Get user profile error:', error);
            return { tier: TIERS.FREE, credits: 0 };
        }
    }

    /**
     * Get user's subscription tier
     * @returns {Promise<string>} - Tier ID
     */
    async getUserTier() {
        const profile = await this.getUserProfile();
        return profile?.tier || TIERS.FREE;
    }

    /**
     * Get user's current credits
     * @returns {Promise<number>}
     */
    async getUserCredits() {
        const profile = await this.getUserProfile();
        return profile?.credits || 0;
    }

    /**
     * Decrement user's credits after a successful analysis
     * @returns {Promise<number>} - New credit balance
     */
    async useCredit() {
        if (!this.db || !this.user) return 0;

        try {
            const userRef = doc(this.db, 'users', this.user.uid);
            const profile = await this.getUserProfile();
            const features = subscriptionService.getTierFeatures(profile?.tier || TIERS.FREE);

            // Don't decrement if unlimited
            if (features.weeklyCreditLimit === Infinity) {
                return Infinity;
            }

            await updateDoc(userRef, {
                credits: increment(-1)
            });

            const updatedProfile = await this.getUserProfile();
            return updatedProfile?.credits || 0;
        } catch (error) {
            console.error('Use credit error:', error);
            return 0;
        }
    }

    /**
     * Update user's tier (for upgrade/downgrade)
     * @param {string} newTier - New tier ID
     */
    async updateUserTier(newTier) {
        if (!this.db || !this.user) return;

        try {
            const userRef = doc(this.db, 'users', this.user.uid);
            await updateDoc(userRef, { tier: newTier });
        } catch (error) {
            console.error('Update tier error:', error);
        }
    }

    /**
     * Auth state değişikliklerini dinle
     */
    onAuthChange(callback) {
        if (!this.auth) {
            this.initialize();
            if (!this.auth) {
                return () => { };
            }
        }

        return onAuthStateChanged(this.auth, callback);
    }

    /**
     * Update user's connected platform ID
     * @param {string} platformKey - Platform key (spotifyId, ytMusicId, etc.)
     * @param {string} platformId - User's ID on that platform
     */
    async updateUserPlatform(platformKey, platformId) {
        if (!this.db || !this.user) return;

        try {
            const userRef = doc(this.db, 'users', this.user.uid);
            await updateDoc(userRef, { [`platforms.${platformKey}`]: platformId });
        } catch (error) {
            console.error('Update platform error:', error);
            throw error;
        }
    }

    /**
     * Disconnect a platform (clear the ID)
     * @param {string} platformKey - Platform key to disconnect
     */
    async disconnectPlatform(platformKey) {
        if (!this.db || !this.user) return;

        try {
            const userRef = doc(this.db, 'users', this.user.uid);
            await updateDoc(userRef, { [`platforms.${platformKey}`]: '' });
        } catch (error) {
            console.error('Disconnect platform error:', error);
            throw error;
        }
    }

    // ==================== ADMIN METHODS ====================

    /**
     * Admin email - only this email can access dashboard
     */
    static ADMIN_EMAIL = 'widrivite@gmail.com';

    /**
     * Check if current user is admin
     * @returns {boolean}
     */
    isAdmin() {
        if (!this.user) return false;
        return this.user.email === FirebaseService.ADMIN_EMAIL;
    }

    /**
     * Get all users (admin only)
     * @returns {Promise<Array>}
     */
    async getAllUsers() {
        if (!this.db || !this.isAdmin()) {
            throw new Error('Yetkisiz erişim');
        }

        try {
            const usersRef = collection(this.db, 'users');
            const snapshot = await getDocs(usersRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Get all users error:', error);
            throw new Error('Kullanıcılar alınamadı');
        }
    }

    /**
     * Update user by ID (admin only)
     * @param {string} userId - User ID to update
     * @param {object} updates - Fields to update
     */
    async updateUserById(userId, updates) {
        if (!this.db || !this.isAdmin()) {
            throw new Error('Yetkisiz erişim');
        }

        try {
            const userRef = doc(this.db, 'users', userId);
            await updateDoc(userRef, updates);
        } catch (error) {
            console.error('Update user error:', error);
            throw new Error('Kullanıcı güncellenemedi');
        }
    }

    /**
     * Get all analyses count (admin only)
     * @returns {Promise<number>}
     */
    async getTotalAnalysesCount() {
        if (!this.db || !this.isAdmin()) {
            throw new Error('Yetkisiz erişim');
        }

        try {
            const vibesRef = collection(this.db, 'vibeAnalyses');
            const snapshot = await getDocs(vibesRef);
            return snapshot.size;
        } catch (error) {
            console.error('Get analyses count error:', error);
            return 0;
        }
    }

    /**
     * Delete user by ID (admin only) - removes from Auth and Firestore via Cloud Function
     * Falls back to Firestore-only deletion if Cloud Function fails
     * @param {string} userId - User ID to delete
     */
    async deleteUserById(userId) {
        if (!this.db || !this.isAdmin()) {
            throw new Error('Yetkisiz erişim');
        }

        // Try Cloud Function first (deletes from both Auth and Firestore)
        if (this.functions) {
            try {
                const deleteAuthUser = httpsCallable(this.functions, 'deleteAuthUser');
                const result = await deleteAuthUser({ userId });
                return result.data;
            } catch (error) {
                console.warn('Cloud Function failed, falling back to Firestore deletion:', error.message);
                // Fall through to Firestore-only deletion
            }
        }

        // Fallback: Delete from Firestore only
        try {
            const userRef = doc(this.db, 'users', userId);
            await deleteDoc(userRef);

            const vibesRef = collection(this.db, 'vibeAnalyses');
            const q = query(vibesRef, where('userId', '==', userId));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(d => deleteDoc(doc(this.db, 'vibeAnalyses', d.id)));
            await Promise.all(deletePromises);

            return { success: true, message: 'Firestore silindi (Auth silme için Cloud Function deploy edin)' };
        } catch (error) {
            console.error('Delete user error:', error);
            throw new Error('Kullanıcı silinemedi');
        }
    }
}

// Singleton instance
const firebaseService = new FirebaseService();
export default firebaseService;
