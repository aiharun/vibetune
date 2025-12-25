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
    async getPlaylistTracks(playlistUrl, limit = 20) {
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
            return null;
        }
    }
    /**
     * Kullanıcı girişi için Login URL oluştur
     * @param {string} redirectUri - Uygulamaya dönüş adresi
     * @returns {string} - Spotify Authorize URL
     */
    getLoginUrl(redirectUri) {
        const scopes = [
            'playlist-modify-public',
            'playlist-modify-private',
            'user-read-private',
            'user-read-email'
        ];

        return 'https://accounts.spotify.com/authorize' +
            '?response_type=token' +
            '&client_id=' + SPOTIFY_CLIENT_ID +
            '&scope=' + encodeURIComponent(scopes.join(' ')) +
            '&redirect_uri=' + encodeURIComponent(redirectUri);
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
