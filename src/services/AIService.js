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
            ? `KOLLEKSİYON ANALİZİ İÇİN ŞARKILAR (Bu liste kullanıcının müzik kimliğidir):\n${trackData}`
            : `KULLANICI MÜZİK PROFİLİ/TERCİHLERİ:\n${userPreferences}`;

        return `Sen dünyanın en prestijli müzik küratörüsün. Sadece popüler listeleri değil, derin müzik kültürünü, "hidden gem" (gizli cevher) parçaları ve türlerin alt janralarını bilen bir uzmansın.

GÖREVİN:
1. Aşağıdaki veri setini detaylıca analiz et.
2. Bu şarkıların ortak "ruhunu" (vibe), ritim yapısını, harmonik özelliklerini ve dönemini belirle.
3. Kullanıcının zevkine "%100 Nokta Atışı" yapacak, onu şaşırtacak ve heyecanlandıracak ${recCount} adet şarkı öner.

${inputSection}

ÖNERİ STRATEJİSİ:
- KULLANICI İSTEĞİNE SAYGI (ÇOK ÖNEMLİ): Eğer kullanıcı "Bana Metallica'dan şarkı öner" dediyse, LÜTFEN Metallica şarkılarını listeye ekle. "Keşif" yapacağım diye kullanıcının net isteğini sakın görmezden gelme.
- TÜR TUTARLILIĞI: Kullanıcı "Dark Techno" dinliyorsa, ona "Pop Rock" önerme. Tarzın derinliklerine in.
- DUYGU BAĞI: Kullanıcı melankolik/hüzünlü parçalar seviyorsa, neşeli ve hızlı parçalarla modunu bozma.
- BAĞLAM: "Kullanıcı X şarkısını seviyorsa, Y şarkısındaki benzer gitar riff'ini de sever" mantığıyla düşün.

KATI KURALLAR:
1. SADECE GERÇEK, VAR OLAN ŞARKILAR: Uydurma şarkı veya sanatçı ASLA önerme.
2. DOĞRULUK: Şarkı adı ve sanatçı adı Spotify'daki ile birebir aynı olmalı.
3. ÇEŞİTLİLİK: Eğer kullanıcı ÖZEL BİR SANATÇI İSTEMEDİYSE, aynı sanatçıdan birden fazla şarkı önerme. Ama kullanıcı "Sadece Tarkan çal" dediyse sadece Tarkan öner.

İSTENEN JSON FORMATI (Sadece bu JSON'ı döndür):
{
  "vibeAnalysis": {
    "energyLevel": <1-10>,
    "melancholyLevel": <1-10>,
    "instrumentalIntensity": <1-10>,
    "danceability": <1-10>,
    "vibeDescription": "<Kullanıcının müzik zevkini analiz eden, 2-3 cümlelik, samimi ve teknik terimler de içerebilen havalı bir analiz. Türkçe.>",
    "dominantGenres": ["<Alt Tür 1>", "<Alt Tür 2>", "<Alt Tür 3>"],
    "mood": "<Vibe'ı en iyi anlatan TEK kelime (Örn: 'Geceyarısı', 'Roadtrip', 'Melankolik', 'Hardcore', 'Chill')>"
  },
  "recommendations": [
    {
      "name": "<Şarkı Adı>",
      "artist": "<Sanatçı Adı>",
      "reason": "<Neden bu şarkı? (Teknik veya duygusal bir bağ kur. Örn: 'Listendeki X şarkısına benzer bir synth yapısına sahip' veya 'Sevdiğin o karanlık atmosferi tam yansıtıyor')>",
      "spotifySearchQuery": "<Şarkı Adı Sanatçı Adı>"
    }
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
                    name: rec.name,
                    artist: rec.artist,
                    reason: rec.reason,
                    spotifySearchQuery: rec.spotifySearchQuery
                }))
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
}

const aiService = new AIService();
export default aiService;
