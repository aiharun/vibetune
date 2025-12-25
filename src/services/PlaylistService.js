/**
 * PlaylistService - Multi-Platform Playlist Analysis
 * 
 * Supports: Spotify, YouTube Music, Apple Music, Deezer, SoundCloud
 * For non-Spotify platforms, uses AI to analyze based on playlist metadata
 */

import spotifyService from './SpotifyService';

class PlaylistService {
    constructor() {
        this.platforms = {
            spotify: {
                name: 'Spotify',
                color: '#1DB954',
                patterns: [
                    /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/,
                    /spotify:playlist:([a-zA-Z0-9]+)/
                ]
            },
            youtube: {
                name: 'YouTube Music',
                color: '#FF0000',
                patterns: [
                    /music\.youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
                    /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/
                ]
            },
            apple: {
                name: 'Apple Music',
                color: '#FC3C44',
                patterns: [
                    /music\.apple\.com\/.*\/playlist\/.*\/pl\.([a-zA-Z0-9]+)/,
                    /music\.apple\.com\/.*\/playlist\/([a-zA-Z0-9-]+)/
                ]
            },
            deezer: {
                name: 'Deezer',
                color: '#FEAA2D',
                patterns: [
                    /deezer\.com\/.*\/playlist\/(\d+)/,
                    /deezer\.page\.link/
                ]
            },
            soundcloud: {
                name: 'SoundCloud',
                color: '#FF5500',
                patterns: [
                    /soundcloud\.com\/([a-zA-Z0-9_-]+)\/sets\/([a-zA-Z0-9_-]+)/
                ]
            }
        };
    }

    /**
     * Detect which platform the URL belongs to
     * @param {string} url - Playlist URL
     * @returns {object|null} - Platform info or null
     */
    detectPlatform(url) {
        if (!url) return null;

        for (const [key, platform] of Object.entries(this.platforms)) {
            for (const pattern of platform.patterns) {
                if (pattern.test(url)) {
                    return {
                        id: key,
                        name: platform.name,
                        color: platform.color,
                        pattern: pattern
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract playlist ID from URL
     * @param {string} url - Playlist URL
     * @param {string} platformId - Platform identifier
     * @returns {string|null} - Playlist ID
     */
    extractPlaylistId(url, platformId) {
        const platform = this.platforms[platformId];
        if (!platform) return null;

        for (const pattern of platform.patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1] || match[2] || url;
            }
        }

        return null;
    }

    /**
     * Get tracks from playlist - uses Spotify API for Spotify, returns metadata for others
     * @param {string} url - Playlist URL
     * @returns {Promise<object>} - Tracks data and platform info
     */
    async getPlaylistData(url) {
        const platform = this.detectPlatform(url);

        if (!platform) {
            throw new Error('Desteklenmeyen platform. Spotify, YouTube Music, Apple Music, Deezer veya SoundCloud linki girin.');
        }

        if (platform.id === 'spotify') {
            // Use existing Spotify service
            const tracks = await spotifyService.getPlaylistTracks(url);
            return {
                platform,
                tracks,
                trackData: spotifyService.createPromptFromTracks(tracks),
                isDirectFetch: true
            };
        }

        // For other platforms, return metadata for AI analysis
        const playlistId = this.extractPlaylistId(url, platform.id);

        return {
            platform,
            playlistUrl: url,
            playlistId,
            tracks: [],
            trackData: '',
            isDirectFetch: false,
            aiPromptContext: this.createAIContext(platform, url, playlistId)
        };
    }

    /**
     * Create context for AI to analyze non-Spotify playlists
     * @param {object} platform - Platform info
     * @param {string} url - Playlist URL
     * @param {string} playlistId - Playlist ID
     * @returns {string} - AI context prompt
     */
    createAIContext(platform, url, playlistId) {
        return `
Platform: ${platform.name}
Playlist URL: ${url}
Playlist ID: ${playlistId}

Note: This playlist is from ${platform.name}. Since we cannot directly access the track list via API, 
please analyze this playlist based on:
1. Any publicly available information about famous playlists
2. The platform's typical user patterns
3. Ask the user to describe what kind of music is in the playlist

Please provide your best analysis and recommendations based on available context.
`;
    }

    /**
     * Create AI prompt for multi-platform analysis
     * @param {object} playlistData - Data from getPlaylistData
     * @param {string} userDescription - Optional user description of the playlist
     * @returns {string} - Complete prompt for AI
     */
    createAnalysisPrompt(playlistData, userDescription = '') {
        if (playlistData.isDirectFetch) {
            // Spotify - we have actual track data
            return playlistData.trackData;
        }

        // Other platforms - use context + user description
        let prompt = `I have a playlist from ${playlistData.platform.name}.\n`;
        prompt += `Playlist URL: ${playlistData.playlistUrl}\n\n`;

        if (userDescription) {
            prompt += `The user describes their playlist as: "${userDescription}"\n\n`;
        }

        prompt += `Based on this information, please analyze the music taste and provide recommendations.`;

        return prompt;
    }
}

// Singleton instance
const playlistService = new PlaylistService();
export default playlistService;
