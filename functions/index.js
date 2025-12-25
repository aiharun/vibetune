/**
 * Cloud Functions for VibeTune
 * 
 * Bu dosya Firebase Admin SDK ile kullanıcı silme işlemini gerçekleştirir.
 * Dashboard'dan çağrılır ve Authentication'dan kullanıcıyı siler.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Firebase Admin SDK'yı başlat
admin.initializeApp();

// Admin email - sadece bu email kullanıcı silebilir
const ADMIN_EMAIL = 'widrivite@gmail.com';

/**
 * deleteAuthUser - Authentication'dan kullanıcı sil
 * 
 * Callable function - client'tan çağrılabilir
 * Sadece admin email'i ile giriş yapmış kullanıcılar kullanabilir
 */
exports.deleteAuthUser = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
        // Auth kontrolü
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Giriş yapmalısınız'
            );
        }

        // Admin kontrolü
        if (context.auth.token.email !== ADMIN_EMAIL) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Bu işlem için yetkiniz yok'
            );
        }

        // userId kontrolü
        const { userId } = data;
        if (!userId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'userId gerekli'
            );
        }

        // Admin kendi kendini silemesin
        if (userId === context.auth.uid) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Kendinizi silemezsiniz'
            );
        }

        try {
            // Firebase Auth'tan kullanıcıyı sil
            await admin.auth().deleteUser(userId);

            // Firestore'dan kullanıcı dökümanını sil
            await admin.firestore().collection('users').doc(userId).delete();

            // Kullanıcının vibes'larını sil
            const vibesSnapshot = await admin.firestore()
                .collection('vibeAnalyses')
                .where('userId', '==', userId)
                .get();

            const batch = admin.firestore().batch();
            vibesSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            return { success: true, message: 'Kullanıcı silindi' };
        } catch (error) {
            console.error('Delete user error:', error);

            if (error.code === 'auth/user-not-found') {
                // User not in Auth but might be in Firestore - clean up anyway
                try {
                    await admin.firestore().collection('users').doc(userId).delete();
                    const vibesSnapshot = await admin.firestore()
                        .collection('vibeAnalyses')
                        .where('userId', '==', userId)
                        .get();
                    const batch = admin.firestore().batch();
                    vibesSnapshot.docs.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    return { success: true, message: 'Firestore temizlendi (Auth kaydı bulunamadı)' };
                } catch (e) {
                    console.error('Firestore cleanup error:', e);
                }
                throw new functions.https.HttpsError(
                    'not-found',
                    'Kullanıcı bulunamadı'
                );
            }

            throw new functions.https.HttpsError(
                'internal',
                'Kullanıcı silinemedi: ' + error.message
            );
        }
    });
