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
        if (!this.model) {
            this.initialize();
        }

        const prompt = this.generatePrompt(trackData, userPreferences, recCount);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return this.parseResponse(text, recCount);
        } catch (error) {
            console.error('AI Analysis error:', error);
            throw new Error('Analiz sırasında bir hata oluştu');
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
        const inputSection = trackData
            ? `Kullanıcının playlistindeki şarkılar:\n${trackData}`
            : `Kullanıcının müzik tercihleri:\n${userPreferences}`;

        return `Sen dünya müzik kültürüne hakim bir müzik uzmanısın. Kullanıcının dinlediği şarkıları analiz edip, zevkine uygun GERÇEK şarkılar önereceksin.

${inputSection}

ÖNEMLİ KURALLAR:
1. SADECE GERÇEK, VAR OLAN ŞARKILAR ÖNER - Uydurma şarkı önerme!
2. Önerdiğin şarkılar Spotify, YouTube veya diğer platformlarda bulunabilmeli
3. Şarkı ve sanatçı adlarını DOĞRU yaz
4. Kullanıcının playlistindeki türlere, enerjiye ve mood'a uygun öner
5. Playlistte olmayan ama benzer tarzda şarkılar öner

Lütfen aşağıdaki formatta JSON yanıt ver (sadece JSON, başka metin yok):

{
  "vibeAnalysis": {
    "energyLevel": <1-10 arası sayı>,
    "melancholyLevel": <1-10 arası sayı>,
    "instrumentalIntensity": <1-10 arası sayı>,
    "danceability": <1-10 arası sayı>,
    "vibeDescription": "<Türkçe, 2-3 cümlelik vibe açıklaması>",
    "dominantGenres": ["<tür1>", "<tür2>", "<tür3>"],
    "mood": "<tek kelime mood: Enerjik/Melankolik/Romantik/Agresif/Sakin/Nostaljik>"
  },
  "recommendations": [
    {
      "name": "<şarkı adı - tam ve doğru>",
      "artist": "<sanatçı adı - tam ve doğru>",
      "reason": "<neden bu şarkıyı önerdiğine dair kısa Türkçe açıklama>",
      "spotifySearchQuery": "<şarkı adı sanatçı - arama için>"
    }
  ]
}

Tam olarak ${recCount} adet GERÇEK şarkı öner. Öneriler:
- Kullanıcının playlistindeki sanatçıların diğer popüler şarkıları olabilir
- Benzer türde farklı sanatçıların hit şarkıları olabilir
- Aynı dönemden veya benzer soundtan şarkılar olabilir
- Farklı sanatçılardan olmalı (aynı sanatçı birden fazla olmasın)

Yanıtın sadece geçerli JSON olmalı, başka açıklama ekleme.`;
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
                recommendations: parsed.recommendations.slice(0, recCount).map(rec => ({
                    name: String(rec.name || 'Bilinmeyen Şarkı'),
                    artist: String(rec.artist || 'Bilinmeyen Sanatçı'),
                    reason: String(rec.reason || 'Zevkine uygun olabilir.'),
                    spotifySearchQuery: rec.spotifySearchQuery || `${rec.name} ${rec.artist}`,
                    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(rec.spotifySearchQuery || `${rec.name} ${rec.artist}`)}`
                }))
            };
        } catch (error) {
            console.error('Parse error details:', error, '\nRaw response start:', responseText.slice(0, 200));
            throw new Error('AI yanıtı işlenemedi');
        }
    }

    /**
     * Manuel giriş için basit analiz
     * @param {string} preferences - Kullanıcının manuel tercihleri
     * @returns {Promise<Object>} - Analiz sonucu
     */
    async analyzePreferences(preferences) {
        return this.analyzeAndRecommend('', preferences);
    }
}

// Singleton instance
const aiService = new AIService();
export default aiService;
