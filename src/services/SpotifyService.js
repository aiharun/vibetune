/**
 * SpotifyService - Spotify Web API Integration
 * 
 * Bu servis Spotify playlist verilerini çekmek için kullanılır.
 * Client Credentials Flow kullanır - user authentication gerektirmez.
 */

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET || '';

class SpotifyService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Spotify API için access token al (Client Credentials Flow)
     */
    async getAccessToken() {
        // Token hala geçerliyse mevcut token'ı döndür
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                throw new Error('Token alınamadı');
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 dakika önce expire et

            return this.accessToken;
        } catch (error) {
            console.error('Spotify token error:', error);
            throw new Error('Spotify bağlantısı kurulamadı');
        }
    }

    /**
     * Spotify playlist URL'inden playlist ID'sini çıkar
     * @param {string} url - Spotify playlist URL'i
     * @returns {string|null} - Playlist ID veya null
     */
    extractPlaylistId(url) {
        // Desteklenen formatlar:
        // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
        // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
        // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123

        const patterns = [
            /spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
            /spotify:playlist:([a-zA-Z0-9]+)/,
            /^([a-zA-Z0-9]{22})$/  // Sadece ID girilmişse
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Playlist'ten şarkıları çek
     * @param {string} playlistUrl - Spotify playlist URL'i
     * @param {number} limit - Çekilecek şarkı sayısı (max 20)
     * @returns {Promise<Array>} - Şarkı listesi
     */
    async getPlaylistTracks(playlistUrl, limit = 50) {
        const playlistId = this.extractPlaylistId(playlistUrl);

        if (!playlistId) {
            throw new Error('Geçersiz Spotify playlist linki');
        }

        try {
            const token = await this.getAccessToken();

            const response = await fetch(
                `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&fields=items(track(id,name,artists,album(name,images),external_urls,preview_url))`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Playlist bulunamadı');
                }
                throw new Error('Şarkılar alınamadı');
            }

            const data = await response.json();
            return this.formatTrackData(data.items);
        } catch (error) {
            console.error('Playlist fetch error:', error);
            throw error;
        }
    }

    /**
     * Ham Spotify verisini kullanılabilir formata dönüştür
     * @param {Array} items - Spotify API'den gelen track items
     * @returns {Array} - Formatlanmış şarkı listesi
     */
    formatTrackData(items) {
        return items
            .filter(item => item.track) // Null track'leri filtrele
            .map(item => ({
                id: item.track.id,
                name: item.track.name,
                artists: item.track.artists.map(artist => artist.name),
                artistsString: item.track.artists.map(artist => artist.name).join(', '),
                album: item.track.album.name,
                albumArt: item.track.album.images[0]?.url || null,
                spotifyUrl: item.track.external_urls.spotify,
                previewUrl: item.track.preview_url
            }));
    }

    /**
     * AI analizi için şarkı verilerinden prompt oluştur
     * @param {Array} tracks - Formatlanmış şarkı listesi
     * @returns {string} - AI için hazırlanmış prompt metni
     */
    createPromptFromTracks(tracks) {
        const trackList = tracks.map((track, index) =>
            `${index + 1}. "${track.name}" by ${track.artistsString}`
        ).join('\n');

        return trackList;
    }

    /**
     * Spotify'dan şarkı önerileri al
     * @param {Array} tracks - Playlist'teki şarkılar
     * @param {number} limit - Öneri sayısı (max 20)
     * @returns {Promise<Array>} - Önerilen şarkılar
     */
    async getRecommendations(tracks, limit = 5) {
        if (!tracks || tracks.length === 0) {
            throw new Error('Öneri için şarkı gerekli');
        }

        try {
            const token = await this.getAccessToken();

            // İlk 5 şarkıdan seed track'ler oluştur (Spotify max 5 seed destekliyor)
            const seedTracks = tracks.slice(0, 5).map(t => t.id).join(',');

            const response = await fetch(
                `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTracks}&limit=${limit}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                console.error('Recommendations API error:', response.status);
                return []; // Hata durumunda boş dizi dön
            }

            const data = await response.json();

            // Format recommendations
            return data.tracks.map(track => ({
                id: track.id,
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                artistsString: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                albumArt: track.album.images[0]?.url || null,
                spotifyUrl: track.external_urls.spotify,
                previewUrl: track.preview_url,
                spotifySearchQuery: `${track.name} ${track.artists[0]?.name || ''}`
            }));
        } catch (error) {
            console.error('Spotify recommendations error:', error);
            return []; // Hata durumunda boş dizi dön
        }
    }

    /**
     * Şarkı arama
     * @param {string} query - Arama sorgusu
     * @returns {Promise<Object|null>} - Bulunan şarkı veya null
     */
    async searchTrack(query) {
        try {
            const token = await this.getAccessToken();

            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const track = data.tracks?.items?.[0];

            if (!track) return null;

            return {
                id: track.id,
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                albumArt: track.album.images[0]?.url || null,
                spotifyUrl: track.external_urls.spotify,
                previewUrl: track.preview_url
            };
        } catch (error) {
            console.error('Spotify search error:', error);
        }
    }

    /**
     * Sanatçı ismine göre şarkılarını getir
     * @param {string} artistName - Sanatçı adı
     * @param {number} limit - Maksimum şarkı sayısı
     * @returns {Promise<Array>} - Sanatçının şarkıları
     */
    async searchArtistTracks(artistName, limit = 50) {
        try {
            const token = await this.getAccessToken();

            // Önce sanatçıyı bul
            const artistResponse = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!artistResponse.ok) return [];

            const artistData = await artistResponse.json();
            const artist = artistData.artists?.items?.[0];

            if (!artist) return [];

            // Sanatçının top tracks'ini al
            const topTracksResponse = await fetch(
                `https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=TR`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            let tracks = [];

            if (topTracksResponse.ok) {
                const topData = await topTracksResponse.json();
                tracks = topData.tracks || [];
            }

            // Eğer yeterli değilse, sanatçının albümlerinden daha fazla şarkı çek
            if (tracks.length < limit) {
                const albumsResponse = await fetch(
                    `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album,single&limit=10&market=TR`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (albumsResponse.ok) {
                    const albumsData = await albumsResponse.json();
                    const albums = albumsData.items || [];

                    for (const album of albums.slice(0, 5)) {
                        if (tracks.length >= limit) break;

                        const albumTracksResponse = await fetch(
                            `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=20`,
                            { headers: { 'Authorization': `Bearer ${token}` } }
                        );

                        if (albumTracksResponse.ok) {
                            const albumTracksData = await albumTracksResponse.json();
                            const albumTracks = albumTracksData.items || [];

                            for (const track of albumTracks) {
                                if (!tracks.find(t => t.name === track.name)) {
                                    tracks.push({
                                        ...track,
                                        album: album,
                                        artists: track.artists || [{ name: artist.name }]
                                    });
                                }
                                if (tracks.length >= limit) break;
                            }
                        }
                    }
                }
            }

            return tracks.slice(0, limit).map(track => ({
                id: track.id,
                name: track.name,
                artist: track.artists?.map(a => a.name).join(', ') || artist.name,
                album: track.album?.name || '',
                albumArt: track.album?.images?.[0]?.url || null,
                spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
                spotifyUri: track.uri || `spotify:track:${track.id}`,
                previewUrl: track.preview_url || null
            }));

        } catch (error) {
            console.error('Search artist tracks error:', error);
            return [];
        }
    }

    /**
     * Birden fazla sanatçının şarkılarını getir
     * @param {Array<string>} artistNames - Sanatçı isimleri
     * @param {number} tracksPerArtist - Her sanatçıdan kaç şarkı
     * @returns {Promise<Array>} - Tüm sanatçıların şarkıları
     */
    async searchMultipleArtistsTracks(artistNames, tracksPerArtist = 20) {
        const allTracks = [];

        for (const artistName of artistNames) {
            const tracks = await this.searchArtistTracks(artistName.trim(), tracksPerArtist);
            allTracks.push(...tracks);
        }

        return allTracks;
    }

    /**
     * Genel arama sorgusu ile şarkı bul (tür, mood, açıklama için)
     * @param {string} query - Arama sorgusu (örn: "sad Turkish pop", "energetic workout")
     * @param {number} limit - Maksimum şarkı sayısı
     * @returns {Promise<Array>} - Bulunan şarkılar
     */
    async searchByQuery(query, limit = 50) {
        try {
            const token = await this.getAccessToken();

            // Translate Turkish mood words to better Spotify search terms
            let searchQuery = query.toLowerCase();
            const isSlow = searchQuery.includes('slow') || searchQuery.includes('yavaş') || searchQuery.includes('sakin');
            const isFast = searchQuery.includes('hızlı') || searchQuery.includes('enerjik') || searchQuery.includes('dans');

            // Detect language preference
            const wantsTurkish = searchQuery.includes('türkçe') || searchQuery.includes('türk') || searchQuery.includes('turkce');
            const wantsEnglish = searchQuery.includes('ingilizce') || searchQuery.includes('english') || searchQuery.includes('yabancı');
            const languageFilter = wantsTurkish ? ' turkish' : wantsEnglish ? ' english' : '';

            // Build better search query
            if (isSlow) {
                searchQuery = 'ballad OR acoustic OR slow' + languageFilter;
            } else if (isFast) {
                searchQuery = 'dance OR party OR upbeat' + languageFilter;
            } else {
                // Keep original query but add language filter
                searchQuery = query + languageFilter;
            }

            // Spotify search with multiple offset calls to get variety
            const allTracks = [];
            const offsetSteps = [0, 25, 50, 75];

            // Use market parameter for language filtering
            const market = wantsTurkish ? 'TR' : wantsEnglish ? 'US' : '';
            const marketParam = market ? `&market=${market}` : '';

            for (const offset of offsetSteps) {
                if (allTracks.length >= limit * 2) break;

                const response = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=25&offset=${offset}${marketParam}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (!response.ok) continue;

                const data = await response.json();
                const tracks = data.tracks?.items || [];

                for (const track of tracks) {
                    const nameLower = track.name.toLowerCase();

                    // Filter out obviously wrong matches
                    if (isSlow) {
                        // Skip fast-sounding songs for slow query
                        if (nameLower.includes('hızlı') || nameLower.includes('halay') ||
                            nameLower.includes('remix') || nameLower.includes('party') ||
                            nameLower.includes('dance')) {
                            continue;
                        }
                    }

                    if (!allTracks.find(t => t.id === track.id)) {
                        allTracks.push({
                            id: track.id,
                            name: track.name,
                            artist: track.artists.map(a => a.name).join(', '),
                            artistPrimary: track.artists[0]?.name || '',
                            album: track.album.name,
                            albumArt: track.album.images[0]?.url || null,
                            spotifyUrl: track.external_urls.spotify,
                            spotifyUri: track.uri,
                            previewUrl: track.preview_url
                        });
                    }
                }
            }

            // Limit tracks per artist to ensure variety
            const artistCount = {};
            const diverseTracks = allTracks.filter(track => {
                const artist = track.artistPrimary.toLowerCase();
                artistCount[artist] = (artistCount[artist] || 0) + 1;
                return artistCount[artist] <= 2;
            });

            // Shuffle for randomness
            const shuffled = diverseTracks.sort(() => Math.random() - 0.5);

            return shuffled.slice(0, limit);

        } catch (error) {
            console.error('Search by query error:', error);
            return [];
        }
    }

    /**
     * STAGE B: LLM'den gelen çoklu sorguları paralel çalıştır
     * @param {Array} queries - Arama sorguları
     * @returns {Promise<Array>} - Benzersiz şarkı havuzu
     */
    async searchMultipleQueries(queries) {
        if (!queries || queries.length === 0) return [];

        console.log('Running Stage B - Multi-Search:', queries);

        const token = await this.getAccessToken();
        const allTracks = [];
        const seenIds = new Set();

        // Execute all queries in parallel
        const promises = queries.map(query => this.searchRaw(query, token));
        const results = await Promise.all(promises);

        // Flatten and deduplicate
        results.flat().forEach(track => {
            if (!seenIds.has(track.id)) {
                seenIds.add(track.id);
                allTracks.push(track);
            }
        });

        console.log(`Stage B Complete: Found ${allTracks.length} unique tracks.`);
        return allTracks;
    }

    /**
     * Ham Spotify araması - Akıllı filtreler olmadan direkt API sorgusu
     * @param {string} query 
     * @param {string} token 
     */
    async searchRaw(query, token) {
        try {
            // Market belirleme: Sorgu "turkish" içeriyorsa TR, yoksa US
            const market = query.toLowerCase().includes('turkish') || query.toLowerCase().includes('türk') ? 'TR' : 'US';

            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20&market=${market}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) return [];

            const data = await response.json();
            return (data.tracks?.items || []).map(track => ({
                id: track.id,
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                artistPrimary: track.artists[0]?.name || '',
                album: track.album.name,
                albumArt: track.album.images[0]?.url || null,
                spotifyUrl: track.external_urls.spotify,
                spotifyUri: track.uri,
                previewUrl: track.preview_url,
                popularity: track.popularity
            }));
        } catch (error) {
            console.error('Raw search error:', error);
            return [];
        }
    }

    /**
     * STAGE D: Şarkıların audio özelliklerini (tempo, energy, etc.) al
     * @param {Array<string>} trackIds - Spotify Track ID listesi (Max 100)
     * @returns {Promise<Object>} - ID -> Features haritası
     */
    async getAudioFeatures(trackIds) {
        if (!trackIds || trackIds.length === 0) return {};

        const token = await this.getAccessToken();
        // Spotify allows max 100 IDs per call
        const chunks = [];
        for (let i = 0; i < trackIds.length; i += 100) {
            chunks.push(trackIds.slice(i, i + 100));
        }

        const featuresMap = {};

        try {
            for (const chunk of chunks) {
                const ids = chunk.join(',');
                const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    (data.audio_features || []).forEach(feat => {
                        if (feat) featuresMap[feat.id] = feat;
                    });
                }
            }
        } catch (error) {
            console.error('Get Audio Features Error:', error);
        }
        return featuresMap;
    }

    /**
     * STAGE C (Advanced): Spotify Recommendations API ile özellikleri hedeflenmiş şarkılar çek
     * @param {Object} params - { seed_genres, target_energy, max_energy, market, etc. }
     */
    async getRecommendationsAdvanced(params) {
        try {
            const token = await this.getAccessToken();
            const urlParams = new URLSearchParams({
                limit: 100,
                market: params.market || 'TR'
            });

            if (params.seed_genres) urlParams.append('seed_genres', params.seed_genres);
            if (params.target_energy) urlParams.append('target_energy', params.target_energy);
            if (params.max_energy) urlParams.append('max_energy', params.max_energy);
            if (params.target_tempo) urlParams.append('target_tempo', params.target_tempo);
            if (params.max_tempo) urlParams.append('max_tempo', params.max_tempo);
            if (params.min_popularity) urlParams.append('min_popularity', params.min_popularity);

            const response = await fetch(`https://api.spotify.com/v1/recommendations?${urlParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return [];

            const data = await response.json();
            return (data.tracks || []).map(this._formatTrack);
        } catch (error) {
            console.error('Advanced Recs Error:', error);
            return [];
        }
    }

    // Helper to format track object uniformly
    _formatTrack(track) {
        return {
            id: track.id,
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            artistPrimary: track.artists[0]?.name || '',
            album: track.album.name,
            albumArt: track.album.images?.[0]?.url || null,
            spotifyUrl: track.external_urls?.spotify,
            spotifyUri: track.uri,
            previewUrl: track.preview_url,
            popularity: track.popularity
        };
    }

    /**
     * Sanatçı isminden en iyi eşleşen sanatçıyı bulur
     */
    async searchArtist(artistName) {
        if (!artistName) return null;
        try {
            const token = await this.getAccessToken();
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1&market=TR`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) return null;
            const data = await response.json();
            const artist = data.artists?.items[0];
            return artist ? { id: artist.id, name: artist.name } : null;
        } catch (e) {
            console.error('Search artist error:', e);
            return null;
        }
    }

    /**
     * Sanatçının en popüler şarkılarını çeker
     */
    async getArtistTopTracks(artistId) {
        if (!artistId) return [];
        try {
            const token = await this.getAccessToken();
            const response = await fetch(
                `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=TR`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (!response.ok) return [];
            const data = await response.json();
            return (data.tracks || []).map(this._formatTrack);
        } catch (e) {
            console.error('Get artist top tracks error:', e);
            return [];
        }
    }

    async searchPlaylists(query, limit = 3) {
        try {
            const token = await this.getAccessToken();
            const market = query.toLowerCase().includes('türk') ? 'TR' : 'US';
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=${limit}&market=${market}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (!response.ok) return [];
            const data = await response.json();
            return data.playlists?.items || [];
        } catch (e) { return []; }
    }

    async getPlaylistTracks(playlistId) {
        try {
            const token = await this.getAccessToken();
            const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return (data.items || []).map(item => item.track ? this._formatTrack(item.track) : null).filter(Boolean);
        } catch (e) { return []; }
    }

    /**
     * PKCE için rastgele string oluştur
     */
    generateRandomString(length) {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * PKCE için SHA256 hash oluştur
     */
    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Authorization Code'u Access Token ile değiştir (PKCE Flow)
     */
    async getAccessTokenFromCode(code, redirectUri) {
        console.log('[SpotifyAuth] Exchanging code for token...');
        const codeVerifier = window.sessionStorage.getItem('spotify_code_verifier');

        if (!codeVerifier) {
            throw new Error('PKCE Code Verifier bulunamadı! İşlem yeniden başlatılmalı.');
        }

        const params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        });

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[SpotifyAuth] Token exchange failed:', errorData);
                throw new Error(`Token alma hatası: ${errorData.error_description || errorData.error}`);
            }

            const data = await response.json();
            console.log('[SpotifyAuth] Token exchange successful!');

            // Temizlik
            window.sessionStorage.removeItem('spotify_code_verifier');

            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in
            };
        } catch (error) {
            console.error('[SpotifyAuth] Network or parsing error:', error);
            throw error;
        }
    }

    /**
     * Kullanıcı girişi için Login URL oluştur (PKCE Flow)
     * @param {string} redirectUri - Uygulamaya dönüş adresi
     * @returns {Promise<string>} - Spotify Authorize URL
     */
    async getLoginUrl(redirectUri) {
        const platform = window.location.hostname === 'localhost' ? 'dev' : 'prod';
        console.log(`[SpotifyAuth] Generating login URL for ${platform} mode. Redirect URI: ${redirectUri}`);

        const scopes = [
            'playlist-modify-public',
            'playlist-modify-private',
            'user-read-private',
            'user-read-email'
        ];

        if (!SPOTIFY_CLIENT_ID) {
            console.error('CRITICAL: SPOTIFY_CLIENT_ID is missing from environment variables!');
        }

        // PKCE Verifier ve Challenge oluştur
        const codeVerifier = this.generateRandomString(128);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // Verifier'ı kaydet (Token alırken lazım olacak)
        window.sessionStorage.setItem('spotify_code_verifier', codeVerifier);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: SPOTIFY_CLIENT_ID,
            scope: scopes.join(' '),
            redirect_uri: redirectUri,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        });

        const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

        console.log('Generated Spotify Auth URL (PKCE):', authUrl);
        return authUrl;
    }

    /**
     * URL hash'inden access token'ı çıkar
     * @returns {string|null} - Access token veya null
     */
    getTokenFromUrl() {
        const hash = window.location.hash;
        if (!hash) return null;

        const params = new URLSearchParams(hash.substring(1));
        return params.get('access_token');
    }

    /**
     * Kullanıcı profilini getir
     * @param {string} userToken - Kullanıcı access token'ı
     * @returns {Promise<Object>} - Kullanıcı profili
     */
    async getUserProfile(userToken) {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (!response.ok) throw new Error('Kullanıcı profili alınamadı');
        return response.json();
    }

    /**
     * Yeni playlist oluştur
     * @param {string} userToken - Kullanıcı access token'ı
     * @param {string} userId - Spotify User ID
     * @param {string} name - Playlist adı
     * @param {string} description - Playlist açıklaması
     * @returns {Promise<Object>} - Oluşturulan playlist objesi
     */
    async createPlaylist(userToken, userId, name, description) {
        const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                description: description,
                public: false
            })
        });

        if (!response.ok) throw new Error('Playlist oluşturulamadı');
        return response.json();
    }

    /**
     * Playlist'e şarkı ekle
     * @param {string} userToken - Kullanıcı access token'ı
     * @param {string} playlistId - Playlist ID
     * @param {Array<string>} uris - Spotify Track URI listesi
     */
    async addTracksToPlaylist(userToken, playlistId, uris) {
        // En fazla 100 şarkı eklenebilir, gerekirse chunk'lara böl
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: uris
            })
        });

        if (!response.ok) throw new Error('Şarkılar playliste eklenemedi');
        return response.json();
    }
}

// Singleton instance
const spotifyService = new SpotifyService();
export default spotifyService;
