/**
 * AIService - Google Gemini API Integration
 * 
 * Bu servis müzik verilerini analiz edip öneri üretmek için Gemini AI kullanır.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

class AIService {
    constructor() {
        this.genAI = null;
        this.model = null;
    }

    /**
     * Gemini modelini başlat
     */
    initialize() {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API anahtarı bulunamadı');
        }

        this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    }

    /**
     * Playlist verisini analiz et ve öneri al
     * @param {string} trackData - Şarkı listesi string formatında
     * @param {string} userPreferences - Kullanıcının manuel girdiği tercihler (opsiyonel)
     * @param {number} recCount - Önerilecek şarkı sayısı
     * @returns {Promise<Object>} - Analiz sonucu ve öneriler
     */
    async analyzeAndRecommend(trackData, userPreferences = '', recCount = 5) {
        // DEPRECATED: This method is being replaced by the new flow in LandingPage.jsx
        // For backward compatibility during migration, we'll keep it but it should not be used in the new flow.
        return this.parseResponse("{}", recCount);
    }

    /**
     * STAGE A: Kullanıcı Niyet Analizi (Intent Parsing)
     * @param {string} userInput - Kullanıcı isteği
     * @returns {Promise<Object>} - Yapılandırılmış niyet verisi
     */
    async parseUserIntent(userInput) {
        if (!this.model) {
            this.initialize();
        }

        const prompt = `
ROL: Müzik Taksonomi Uzmanı (Music Taxonomy Expert)
GÖREV: Kullanıcı isteğini analiz et ve yapılandırılmış JSON verisine dönüştür.
KULLANICI GİRDİSİ: "${userInput}"

⚠️ KURALLAR:
1. ŞARKI veya SANATÇI ismi ÖNERME.
2. "Mood" ile "Genre" ayrımını kesin yap.
3. DİL MANTIĞI (Smart Language Defaults):
   - Adım 1: Kullanıcı girdisinin dilini tespit et (prompt_language).
   - Adım 2: Kullanıcı açıkça dil belirtti mi? ("Türkçe", "Yabancı", "İngilizce") -> Varsa bunu KULLAN (language).
   - Adım 3: Belirtmediyse, varsayılan olarak 'prompt_language' kullan.
   - İSTİSNA (Override): Kullanıcı Türkçe yazıp SADECE Yabancı sanatçılar (Rihanna, Metallica vb.) istediyse -> language="en" veya "mixed" yap.
4. SANATÇI TESPİTİ (Çok Önemli):
   - Kullanıcının bahsettiği TÜM sanatçıları sırasıyla 'explicit_artists' dizisine ekle.
   - Asla sadece ilkini alıp diğerlerini bırakma.
   - Eğer kullanıcı "X, Y ve Z" dediyse, hepsini ekle.

ÇIKTI FORMATI (JSON ONLY):
{
  "prompt_language": "tr" | "en" | "other",
  "language": "tr" | "en" | "mixed", // Final karar
  "language_source": "explicit" | "default" | "override",
  "explicit_genres": ["tür1", "tür2"],
  "moods": ["mood1", "mood2"],
  "explicit_artists": ["sanatçı1", "sanatçı2", "sanatçı3"],
  "artist_intent_strength": "strong" | "weak",
  "mainstream_tolerance": "high" | "mid" | "low"
}`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            const jsonText = text.substring(firstBrace, lastBrace + 1);

            return JSON.parse(jsonText);
        } catch (error) {
            console.error('Intent Parse Error:', error);
            return {
                language: 'mixed',
                explicit_genres: [],
                moods: [],
                explicit_artists: [],
                mainstream_tolerance: 'mid'
            };
        }
    }

    /**
     * STAGE F: Seçilen ve filtrelenen şarkıları açıkla
     * @param {Array} selectedTracks - Audio-feature testinden geçmiş gerçek şarkılar
     * @param {Object} intentData - Kullanıcı niyet verisi
     * @returns {Promise<Object>} - Final öneri objesi
     */
    async explainTracks(selectedTracks, intentData) {
        if (!this.model) {
            this.initialize();
        }

        const trackList = selectedTracks.map((t, i) =>
            `${i + 1}. ${t.name} - ${t.artist}`
        ).join('\n');

        const prompt = `
ROL: Müzik Küratörü
GÖREV: Aşağıdaki şeçilmiş şarkı listesini kullanıcıya sunmak için kısa açıklamalar yaz.
KULLANICI MOOD'U: ${intentData.moods.join(', ')} (${intentData.language})

ŞARKI LİSTESİ (BU LİSTE KESİN VE DEĞİŞTİRİLEMEZ):
${trackList}

YAPILACAKLAR:
1. "vibeDescription": Kullanıcının istediği mood'u ve listenin genel havasını anlatan 2 cümlelik samimi bir giriş yazısı.
2. Her şarkı için "reason": Neden bu mood'a uygun olduğunu anlatan tek cümle.
3. Match Score: 85-99 arası puan ver.
4. LİSTEDEKİ ŞARKILARI AYNEN KULLAN. Asla yenisini ekleme, çıkarma.

JSON FORMATI:
{
  "vibeAnalysis": {
    "mood": "${intentData.moods[0] || 'Genel'}",
    "vibeDescription": "...",
    "dominantGenres": ${JSON.stringify(intentData.explicit_genres)}
  },
  "recommendations": [
    {
      "name": "Şarkı Adı",
      "artist": "Sanatçı",
      "reason": "...",
      "matchScore": 95
    }
  ]
}`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            const jsonText = text.substring(firstBrace, lastBrace + 1);
            const parsed = JSON.parse(jsonText);

            // Merge back with original track data
            const merged = parsed.recommendations.map(rec => {
                const original = selectedTracks.find(t =>
                    t.name.toLowerCase().includes(rec.name.toLowerCase()) ||
                    rec.name.toLowerCase().includes(t.name.toLowerCase())
                );
                if (original) {
                    return { ...original, ...rec, id: original.id, albumArt: original.albumArt };
                }
                return null;
            }).filter(Boolean);

            return {
                vibeAnalysis: parsed.vibeAnalysis,
                recommendations: merged
            };
        } catch (error) {
            console.error('Explanation Error:', error);
            // Fallback
            return {
                vibeAnalysis: {
                    mood: intentData.moods[0] || 'Genel',
                    vibeDescription: 'Seçtiğim şarkıların keyfini çıkar!',
                    dominantGenres: intentData.explicit_genres
                },
                recommendations: selectedTracks.map(t => ({ ...t, matchScore: 90, reason: 'Moduna tam uyuyor.' }))
            };
        }
    }

    /**
     * AI için prompt oluştur
     * @param {string} trackData - Şarkı listesi
     * @param {string} userPreferences - Kullanıcı tercihleri
     * @param {number} recCount - Önerilecek şarkı sayısı
     * @returns {string} - Oluşturulan prompt
     */
    generatePrompt(trackData, userPreferences, recCount) {
        // Request 2.5x more songs to have buffer after filtering
        const requestCount = Math.ceil(recCount * 2.5);

        const input = trackData
            ? `Playlist şarkıları:\n${trackData}`
            : `Kullanıcı isteği: "${userPreferences}"`;

        // Detect if artist names are mentioned
        const artistMode = userPreferences && !trackData;

        // Store detected artists for diversity filter adjustment
        if (artistMode) {
            this.lastUserPreferences = userPreferences;
        }

        return `Sen bir müzik uzmanısın. Kullanıcının isteğine TAM UYAN şarkılar önereceksin.

${input}

🎤 SANATÇI KONTROLÜ:
Eğer kullanıcı bir veya daha fazla SANATÇI İSMİ belirttiyse (örn: "Tarkan", "Sezen Aksu", "Metallica"):
- Önerilerin %40'ı (3-4 şarkı) bu sanatçı(lar)dan olsun
- Önerilerin %60'ı (4-5 şarkı) benzer TARZDA ve MOOD'DA şarkılar olsun (farklı sanatçılardan)
- Her yenilemede FARKLI şarkılar öner

🎵 MOOD/TÜR FİLTRELEME:
Kullanıcının isteğine göre uygun filtreleri uygula:

"slow/yavaş/sakin" istendiğinde:
✓ Ballad, akustik, soft pop, R&B yavaş
✗ Remix, dance, halay, EDM, rap, hip-hop, trap, drill

"enerjik/hızlı/dans" istendiğinde:
✓ Dance, pop, EDM, hip-hop, halay
✗ Ballad, yavaş şarkılar, akustik

"rap/hip-hop" istendiğinde:
✓ Rap, hip-hop, trap, drill
✗ Slow ballad, arabesk

"rock/metal" istendiğinde:
✓ Rock, metal, alternatif
✗ Pop, R&B, arabesk

🌍 DİL FİLTRELEME:
- "türkçe" → SADECE Türkçe şarkılar
- "ingilizce/yabancı" → SADECE İngilizce şarkılar
- Dil belirtilmemişse → Karışık olabilir

📋 GÖREV: ${requestCount} şarkı öner.

✅ GENEL KURALLAR:
1. İstenen türe uygun şarkılar öner
2. İstenen dilde şarkılar öner
3. Spotify'da gerçekten VAR olan şarkılar
4. Her şarkı farklı sanatçıdan olmalı

JSON:
{
  "vibeAnalysis": {
    "energyLevel": <1-10>,
    "melancholyLevel": <1-10>,
    "instrumentalIntensity": <1-10>,
    "danceability": <1-10>,
    "vibeDescription": "<2 cümle açıklama>",
    "dominantGenres": ["tür1", "tür2"],
    "mood": "<tek kelime>"
  },
  "recommendations": [
    {"name": "şarkı", "artist": "sanatçı", "reason": "neden bu şarkı", "matchScore": 90, "spotifySearchQuery": "şarkı sanatçı"}
  ]
}`;
    }

    /**
     * AI yanıtını parse et
     * @param {string} responseText - AI'dan gelen ham metin
     * @param {number} recCount - Beklenen öneri sayısı
     * @returns {Object} - Parse edilmiş analiz ve öneriler
     */
    parseResponse(responseText, recCount) {
        try {
            // Find the first { and the last }
            const firstBrace = responseText.indexOf('{');
            const lastBrace = responseText.lastIndexOf('}');

            if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
                console.error('No JSON block found in response:', responseText);
                throw new Error('JSON yanıt bulunamadı');
            }

            let jsonText = responseText.substring(firstBrace, lastBrace + 1);

            // Clean up potentially invisible or problematic characters (control characters)
            // that sometimes Gemini might include accidentally
            jsonText = jsonText.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ");

            const parsed = JSON.parse(jsonText);

            // Validasyon
            if (!parsed.vibeAnalysis || !parsed.recommendations || !Array.isArray(parsed.recommendations)) {
                console.error('AI Data format error:', parsed);
                throw new Error('Eksik veya hatalı formatta veri');
            }

            // Parse recommendations
            const rawRecommendations = parsed.recommendations.slice(0, recCount * 2).map(rec => ({
                name: rec.name,
                artist: rec.artist,
                reason: rec.reason,
                matchScore: rec.matchScore || Math.floor(Math.random() * (99 - 85 + 1) + 85),
                spotifySearchQuery: rec.spotifySearchQuery
            }));

            // POST-PROCESSING FILTER: Block certain artists/genres for specific moods
            const userRequest = this.lastUserPreferences || '';
            const isSlowRequest = /slow|yavaş|sakin|ballad/i.test(userRequest);

            // Known rap/drill artists to filter for slow requests
            const rapArtists = ['lvbel c5', 'çakal', 'uzi', 'khontkar', 'şehinşah', 'ceza', 'sagopa kajmer',
                'norm ender', 'ezhel', 'ben fero', 'mero', 'murda', 'heijan', 'motive'];

            let filteredRecommendations = rawRecommendations;
            if (isSlowRequest) {
                filteredRecommendations = rawRecommendations.filter(rec => {
                    const artistLower = (rec.artist || '').toLowerCase();
                    const nameLower = (rec.name || '').toLowerCase();
                    // Skip if artist is in rap list or song name contains fast/dance keywords
                    const isRapArtist = rapArtists.some(ra => artistLower.includes(ra));
                    const isFastSong = /remix|halay|dans|party|drill|trap/i.test(nameLower);
                    return !isRapArtist && !isFastSong;
                });
            }

            const mentionedArtists = userRequest.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);

            // CODE-LEVEL DIVERSITY FILTER
            const artistCount = {};
            const diverseRecommendations = filteredRecommendations.filter(rec => {
                const artistLower = (rec.artist || '').toLowerCase().trim();

                // Check if this artist was mentioned by user
                const isMentionedArtist = mentionedArtists.some(mentioned =>
                    artistLower.includes(mentioned) || mentioned.includes(artistLower.split(' ')[0])
                );

                // Count artist occurrences
                artistCount[artistLower] = (artistCount[artistLower] || 0) + 1;

                // Allow more songs from mentioned artists (up to 4), limit others to 1
                const maxAllowed = isMentionedArtist ? 4 : 1;

                return artistCount[artistLower] <= maxAllowed && artistLower.length > 0;
            }).slice(0, recCount);


            return {
                vibeAnalysis: {
                    energyLevel: Math.min(10, Math.max(1, Number(parsed.vibeAnalysis.energyLevel) || 5)),
                    melancholyLevel: Math.min(10, Math.max(1, Number(parsed.vibeAnalysis.melancholyLevel) || 5)),
                    instrumentalIntensity: Math.min(10, Math.max(1, Number(parsed.vibeAnalysis.instrumentalIntensity) || 5)),
                    danceability: Math.min(10, Math.max(1, Number(parsed.vibeAnalysis.danceability) || 5)),
                    vibeDescription: String(parsed.vibeAnalysis.vibeDescription || 'Benzersiz bir müzik zevkin var!'),
                    dominantGenres: Array.isArray(parsed.vibeAnalysis.dominantGenres) ? parsed.vibeAnalysis.dominantGenres : ['Pop', 'Rock'],
                    mood: String(parsed.vibeAnalysis.mood || 'Karma')
                },
                recommendations: diverseRecommendations
            };
        } catch (error) {
            console.error('AI Parsing Error:', error);
            // Fallback for demo/error proofing
            return {
                vibeAnalysis: {
                    vibeDescription: "Müzik analizinde küçük bir aksaklık oldu ama senin için klasiklerden seçtim.",
                    mood: "Karma",
                    dominantGenres: ["Pop", "Rock"],
                    energyLevel: 5, melancholyLevel: 5, instrumentalIntensity: 5, danceability: 5
                },
                recommendations: []
            };
        }
    }

    /**
     * Kullanıcı girdisinden sanatçı isimlerini tespit et
     * @param {string} input - Kullanıcı girdisi
     * @returns {Array<string>} - Tespit edilen sanatçı isimleri
     */
    detectArtists(input) {
        if (!input || input.trim().length === 0) return [];

        // Virgül veya "ve" ile ayrılmış isimleri ayır
        const parts = input.split(/,|ve |and |\+/i).map(p => p.trim()).filter(p => p.length > 1);

        // Eğer genel terimler varsa (tür, mood) sanatçı değil demektir
        const genericTerms = ['rock', 'pop', 'jazz', 'metal', 'hip hop', 'rap', 'klasik', 'türkçe', 'türkü',
            'elektronik', 'dance', 'chill', 'sad', 'mutlu', 'hüzünlü', 'enerjik', 'sakin',
            'öneri', 'öner', 'playlist', 'şarkı', 'müzik', 'dinle', 'mood', 'vibe'];

        const potentialArtists = parts.filter(part => {
            const lower = part.toLowerCase();
            // Genel terim değilse ve yeterince uzunsa sanatçı olabilir
            return !genericTerms.some(term => lower === term || lower.includes(term + ' ') || lower.startsWith(term));
        });

        // En az 2 karakterli ve büyük harfle başlayan veya tam isim gibi görünen parçaları al
        return potentialArtists.filter(p => p.length >= 2);
    }

    /**
     * Sanatçı modu için özel prompt oluştur - SADECE verilen listeden seçim yapar
     * @param {Array} verifiedTracks - Spotify'dan doğrulanmış şarkı listesi
     * @param {number} recCount - Seçilecek şarkı sayısı
     * @param {string} context - Kullanıcının istediği context
     * @returns {string} - Prompt
     */
    generateArtistModePrompt(verifiedTracks, recCount, context = '') {
        // Shuffle tracks so AI doesn't always pick from top
        const shuffled = [...verifiedTracks].sort(() => Math.random() - 0.5);

        const trackList = shuffled.map((t, i) =>
            `${i + 1}. "${t.name}" - ${t.artist}`
        ).join('\n');

        // Check for mood keywords and create strong filtering
        const contextLower = context.toLowerCase();
        let moodFilter = '';

        if (contextLower.includes('slow') || contextLower.includes('yavaş') || contextLower.includes('sakin')) {
            moodFilter = `
🚨 MOOD FİLTRESİ: SLOW/YAVAŞ
- SADECE yavaş tempolu, sakin, ballad tarzı şarkıları seç
- Hızlı, enerjik, dans şarkılarını ATLA
- Önce şarkının slow olup olmadığını kontrol et, sonra seç`;
        } else if (contextLower.includes('enerjik') || contextLower.includes('hızlı') || contextLower.includes('dans')) {
            moodFilter = `
🚨 MOOD FİLTRESİ: ENERJİK/HIZLI
- SADECE hızlı tempolu, enerjik şarkıları seç
- Yavaş, sakin şarkıları ATLA`;
        } else if (contextLower.includes('hüzünlü') || contextLower.includes('melankolik')) {
            moodFilter = `
🚨 MOOD FİLTRESİ: HÜZÜNLÜ
- SADECE hüzünlü, melankolik şarkıları seç
- Mutlu, neşeli şarkıları ATLA`;
        }

        return `Sen bir müzik uzmanısın. Aşağıdaki listeden ${recCount} şarkı seçeceksin.

KULLANICI İSTEĞİ: "${context}"
${moodFilter}

ŞARKI LİSTESİ:
${trackList}

📋 GÖREV:
1. Önce kullanıcının istediği MOOD'u belirle (slow, enerjik, hüzünlü, vb.)
2. Listeden SADECE bu mood'a uyan şarkıları seç
3. ${recCount} şarkı seç

⚠️ ÖNEMLİ: Mood filtresi EN ÖNEMLİ kriter! Mood'a uymayan şarkı seçme.

JSON FORMATI (Şarkı adları listeden birebir kopyalanmalı):
{
  "vibeAnalysis": {
    "energyLevel": <1-10>,
    "melancholyLevel": <1-10>,
    "instrumentalIntensity": <1-10>,
    "danceability": <1-10>,
    "vibeDescription": "<Sanatçı(lar)ın müzik tarzını anlatan 2-3 cümle. Türkçe.>",
    "dominantGenres": ["<Tür 1>", "<Tür 2>", "<Tür 3>"],
    "mood": "<Tek kelime vibe>"
  },
  "recommendations": [
    {
      "name": "<LİSTEDEKİ şarkı adı - AYNEN KOPYALA>",
      "artist": "<Sanatçı adı>",
      "reason": "<Neden bu şarkı?>",
      "matchScore": <85-99>,
      "spotifySearchQuery": "<şarkı adı sanatçı adı>"
    }
  ]
}`;
    }

    /**
     * Doğrulanmış şarkı listesinden seçim yap
     * @param {Array} verifiedTracks - Spotify'dan çekilen doğru şarkılar
     * @param {number} recCount - Seçilecek şarkı sayısı
     * @param {string} context - Kullanıcının istediği context (sanatçı + mood)
     * @returns {Promise<Object>} - Analiz ve öneriler
     */
    async selectFromVerifiedTracks(verifiedTracks, recCount = 8, context = '') {
        if (!this.model) {
            this.initialize();
        }

        if (!verifiedTracks || verifiedTracks.length === 0) {
            return {
                vibeAnalysis: {
                    vibeDescription: "Sanatçı bulunamadı.",
                    mood: "Bilinmiyor",
                    dominantGenres: [],
                    energyLevel: 5, melancholyLevel: 5, instrumentalIntensity: 5, danceability: 5
                },
                recommendations: []
            };
        }

        const prompt = this.generateArtistModePrompt(verifiedTracks, recCount, context);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const parsed = this.parseResponse(text, recCount);

            // AI'ın seçtiği şarkıları doğrulanmış listeden zenginleştir
            const enrichedRecommendations = parsed.recommendations.map(rec => {
                // Try to find matching track with fuzzy matching
                const recNameLower = (rec.name || '').toLowerCase().replace(/[^\w\s]/g, '');
                const recArtistLower = (rec.artist || '').toLowerCase();

                const verified = verifiedTracks.find(t => {
                    const tNameLower = (t.name || '').toLowerCase().replace(/[^\w\s]/g, '');
                    const tArtistLower = (t.artist || '').toLowerCase();

                    // Exact match
                    if (tNameLower === recNameLower) return true;
                    // Partial name match + artist match
                    if (tNameLower.includes(recNameLower) || recNameLower.includes(tNameLower)) {
                        if (tArtistLower.includes(recArtistLower) || recArtistLower.includes(tArtistLower)) {
                            return true;
                        }
                    }
                    return false;
                });

                if (verified) {
                    return {
                        ...rec,
                        ...verified,
                        reason: rec.reason,
                        matchScore: rec.matchScore
                    };
                }
                return null; // Mark as unmatched
            }).filter(Boolean);

            // If too few matches, supplement with random tracks from verified list
            let finalRecommendations = enrichedRecommendations;
            if (enrichedRecommendations.length < recCount) {
                console.log(`Only ${enrichedRecommendations.length} matches found, adding from verified pool...`);
                const usedIds = new Set(enrichedRecommendations.map(r => r.id));
                const remaining = verifiedTracks.filter(t => !usedIds.has(t.id));
                const shuffled = remaining.sort(() => Math.random() - 0.5);
                const needed = recCount - enrichedRecommendations.length;
                const supplemental = shuffled.slice(0, needed).map(t => ({
                    ...t,
                    reason: 'Bu sanatçının popüler parçalarından',
                    matchScore: Math.floor(Math.random() * (95 - 85) + 85)
                }));
                finalRecommendations = [...enrichedRecommendations, ...supplemental];
            }

            // Duplicate prevention
            const uniqueRecommendations = finalRecommendations.filter((rec, index, self) =>
                index === self.findIndex(t => t.id === rec.id)
            ).slice(0, recCount);

            return {
                ...parsed,
                recommendations: uniqueRecommendations
            };

        } catch (error) {
            console.error('Artist mode AI error:', error);
            // Fallback: Rastgele seç
            const shuffled = [...verifiedTracks].sort(() => 0.5 - Math.random());
            return {
                vibeAnalysis: {
                    vibeDescription: "Sanatçının en iyi parçaları",
                    mood: "Karışık",
                    dominantGenres: ["Pop"],
                    energyLevel: 6, melancholyLevel: 5, instrumentalIntensity: 5, danceability: 6
                },
                recommendations: shuffled.slice(0, recCount).map(t => ({
                    ...t,
                    reason: "Sanatçının popüler parçalarından",
                    matchScore: Math.floor(Math.random() * (99 - 85) + 85)
                }))
            };
        }
    }
}

const aiService = new AIService();
export default aiService;
