import { motion, AnimatePresence } from 'framer-motion';
import subscriptionService, { TIER_FEATURES, TIERS } from '../services/SubscriptionService';

function PricingModal({ isOpen, onClose, currentTier = TIERS.FREE, onUpgrade }) {
    const tiers = subscriptionService.getAllTiers();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/80" />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-4xl bg-[#0a0a0a] rounded-2xl border border-[#222] p-8 overflow-y-auto max-h-[90vh]"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Header */}
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-white mb-2">Planını Seç</h2>
                        <p className="text-neutral-400">Müzik zevkini keşfetmeye devam et</p>
                    </div>

                    {/* Tier Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {tiers.map((tier) => {
                            const isCurrent = tier.id === currentTier;
                            const isPopular = tier.id === TIERS.PREMIUM;

                            return (
                                <div
                                    key={tier.id}
                                    className={`relative rounded-2xl border p-6 transition-all ${isCurrent
                                        ? 'border-green-500/50 bg-green-500/5'
                                        : isPopular
                                            ? 'border-orange-500/50 bg-orange-500/5'
                                            : 'border-[#333] bg-[#111]'
                                        }`}
                                >
                                    {/* Popular Badge */}
                                    {isPopular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-500 text-black text-xs font-bold rounded-full">
                                            Popüler
                                        </div>
                                    )}

                                    {/* Current Badge */}
                                    {isCurrent && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-black text-xs font-bold rounded-full">
                                            Mevcut Plan
                                        </div>
                                    )}

                                    {/* Tier Name */}
                                    <h3
                                        className="text-xl font-bold mb-2"
                                        style={{ color: tier.color }}
                                    >
                                        {tier.displayName}
                                    </h3>

                                    {/* Price */}
                                    <div className="mb-6">
                                        <span className="text-4xl font-bold text-white">
                                            {tier.price === 0 ? 'Ücretsiz' : `$${tier.price}`}
                                        </span>
                                        {tier.price > 0 && (
                                            <span className="text-neutral-500 text-sm">/ay</span>
                                        )}
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-3 mb-6">
                                        <li className="flex items-center gap-2 text-sm text-neutral-300">
                                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {tier.weeklyCreditLimit === Infinity ? 'Sınırsız' : tier.weeklyCreditLimit} kredi/hafta
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-neutral-300">
                                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {tier.recommendationCount} öneri/analiz
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-neutral-300">
                                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            {tier.platforms.length > 1 ? 'Tüm platformlar' : 'Sadece Spotify'}
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-neutral-300">
                                            <svg className={`w-4 h-4 ${tier.canSaveResults ? 'text-green-400' : 'text-neutral-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tier.canSaveResults ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                                            </svg>
                                            Sonuç kaydetme
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-neutral-300">
                                            <svg className={`w-4 h-4 ${tier.prioritySupport ? 'text-green-400' : 'text-neutral-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tier.prioritySupport ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                                            </svg>
                                            Öncelikli destek
                                        </li>
                                    </ul>

                                    {/* CTA Button */}
                                    <button
                                        disabled={isCurrent || tier.price > 0}
                                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${isCurrent
                                            ? 'bg-[#222] text-neutral-500 cursor-not-allowed'
                                            : tier.price > 0
                                                ? 'bg-[#333] text-neutral-400 cursor-not-allowed'
                                                : 'bg-white text-black hover:bg-neutral-200'
                                            }`}
                                    >
                                        {isCurrent ? 'Mevcut Plan' : tier.price === 0 ? 'Ücretsiz Başla' : 'Yakında'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer Note */}
                    <p className="text-center text-neutral-500 text-xs mt-8">
                        İstediğin zaman iptal edebilirsin. Sorularınız için destek@vibetune.com
                    </p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default PricingModal;
