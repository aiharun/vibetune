/**
 * SubscriptionService - Tier Management & Feature Gating
 * 
 * Tiers: FREE, PREMIUM, PREMIUM_PLUS
 */

export const TIERS = {
    FREE: 'free',
    PREMIUM: 'premium',
    PREMIUM_PLUS: 'premium_plus'
};

export const TIER_FEATURES = {
    [TIERS.FREE]: {
        name: 'Free',
        displayName: 'Free',
        weeklyCreditLimit: 3,
        recommendationCount: 5,
        platforms: ['spotify'], // Only Spotify
        canSaveResults: false,
        detailedAnalysis: false,
        prioritySupport: false,
        price: 0,
        color: '#6b7280' // Gray
    },
    [TIERS.PREMIUM]: {
        name: 'Premium',
        displayName: 'Premium',
        weeklyCreditLimit: 20,
        recommendationCount: 10,
        platforms: ['spotify', 'youtube', 'apple', 'deezer', 'soundcloud'],
        canSaveResults: true,
        detailedAnalysis: true,
        prioritySupport: false,
        price: 9.99,
        color: '#f59e0b' // Amber
    },
    [TIERS.PREMIUM_PLUS]: {
        name: 'Premium+',
        displayName: 'Premium+',
        weeklyCreditLimit: Infinity,
        recommendationCount: 15,
        platforms: ['spotify', 'youtube', 'apple', 'deezer', 'soundcloud'],
        canSaveResults: true,
        detailedAnalysis: true,
        prioritySupport: true,
        price: 19.99,
        color: '#8b5cf6' // Violet
    }
};

class SubscriptionService {
    /**
     * Get tier features for a given tier
     * @param {string} tier - Tier ID
     * @returns {object} - Tier features
     */
    getTierFeatures(tier) {
        return TIER_FEATURES[tier] || TIER_FEATURES[TIERS.FREE];
    }

    /**
     * Check if user can perform analysis based on their tier and usage
     * @param {string} tier - User's tier
     * @param {number} currentCredits - User's current credits
     * @returns {object} - { allowed: boolean, reason?: string, remaining?: number }
     */
    canAnalyze(tier, currentCredits) {
        const features = this.getTierFeatures(tier);

        if (currentCredits <= 0 && features.weeklyCreditLimit !== Infinity) {
            return {
                allowed: false,
                reason: 'credits_exhausted',
                remaining: 0,
                limit: features.weeklyCreditLimit
            };
        }

        return {
            allowed: true,
            remaining: currentCredits,
            limit: features.weeklyCreditLimit
        };
    }

    /**
     * Check if a platform is supported for user's tier
     * @param {string} tier - User's tier
     * @param {string} platformId - Platform ID
     * @returns {boolean}
     */
    isPlatformSupported(tier, platformId) {
        const features = this.getTierFeatures(tier);
        return features.platforms.includes(platformId);
    }

    /**
     * Check if user can save results
     * @param {string} tier - User's tier
     * @returns {boolean}
     */
    canSaveResults(tier) {
        return this.getTierFeatures(tier).canSaveResults;
    }

    /**
     * Get recommendation count for tier
     * @param {string} tier - User's tier
     * @returns {number}
     */
    getRecommendationCount(tier) {
        return this.getTierFeatures(tier).recommendationCount;
    }

    /**
     * Get all tiers for pricing display
     * @returns {Array}
     */
    getAllTiers() {
        return Object.entries(TIER_FEATURES).map(([id, features]) => ({
            id,
            ...features
        }));
    }

    /**
     * Get upgrade options for a tier
     * @param {string} currentTier - User's current tier
     * @returns {Array}
     */
    getUpgradeOptions(currentTier) {
        const tiers = [TIERS.FREE, TIERS.PREMIUM, TIERS.PREMIUM_PLUS];
        const currentIndex = tiers.indexOf(currentTier);

        return tiers.slice(currentIndex + 1).map(tier => ({
            id: tier,
            ...TIER_FEATURES[tier]
        }));
    }
}

// Singleton instance
const subscriptionService = new SubscriptionService();
export default subscriptionService;
