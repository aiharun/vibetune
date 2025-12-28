
const RAP_BLACKLIST = ['uzi', 'çakal', 'lvbel c5', 'motive', 'ati242', 'batuflex', 'murda', 'ezhel', 'khontkar', 'şehinşah', 'ceza', 'sagopa', 'gazapizm', 'ben fero', 'mero', 'cakal', 'reckol', 'sefo', 'blok3'];

async function processCandidateTracks(intentData, spotifyService) {
    const { moods = [], explicit_genres = [], language = 'mixed', explicit_artists = [], prompt_language } = intentData || {};

    // STAGE B: POOL EXPANSION (Build Massive Candidate Pool)
    console.log('Stage B: Expanding Candidate Pool...');
    const allCandidates = [];
    const seenIds = new Set();
    const seenSignatures = new Set(); // Prevent duplicates by Name+Artist
    const requestedArtistNames = (explicit_artists || []).map(a => a.toLowerCase());

    const addTracks = (tracks, sourceName) => {
        if (!tracks) return;
        let added = 0;
        tracks.forEach(t => {
            if (!t || !t.id) return;
            // Create a unique signature based on name and artist to filter duplicates (e.g. Album vs Single version)
            const signature = `${t.name.toLowerCase().trim()}-${(t.artistPrimary || t.artist || '').toLowerCase().trim()}`;

            if (!seenIds.has(t.id) && !seenSignatures.has(signature)) {
                seenIds.add(t.id);
                seenSignatures.add(signature);
                // Tag track with source for fallback logic
                t._source = sourceName;

                // Double check if this track belongs to a requested artist (even if found via search)
                // And tag specifically WHICH artist it matches for Quota distribution
                const matchedArtist = requestedArtistNames.find(ra => (t.artistPrimary || t.artist || '').toLowerCase().includes(ra));
                if (matchedArtist) {
                    t._isRequestedArtist = true;
                    if (!t._explicitArtistName) {
                        t._explicitArtistName = matchedArtist;
                    }
                }

                allCandidates.push(t);
                added++;
            }
        });
        console.log(`Added ${added} tracks from ${sourceName}`);
    };

    const mainMood = moods[0] || 'general';
    // Bias towards prompt language if mixed/unsure
    const effectiveLang = language === 'mixed' ? (prompt_language || 'en') : language;
    const langTerm = effectiveLang === 'tr' ? 'türkçe' : (effectiveLang === 'en' ? 'eng' : '');

    // --- SOURCE 1: Search Queries (Expanded) ---
    const searchQueries = [];
    if (effectiveLang === 'tr' && moods.includes('slow')) {
        // Targeted "Pool Builder" queries for TR Slow
        searchQueries.push('türkçe slow hits');
        searchQueries.push('türkçe damar');
        searchQueries.push('türkçe duygusal');
        searchQueries.push('türkçe akustik');
        searchQueries.push('türkçe piyano');
        searchQueries.push('sakin türkçe');
        searchQueries.push('aşk şarkıları türkçe');
    }
    // Add generic mood/genre queries
    const genreBases = explicit_genres.length > 0 ? explicit_genres : ['pop'];
    genreBases.forEach(g => {
        // STRICT LANGUAGE ENFORCEMENT:
        // If effectiveLang is 'tr', ONLY search for Turkish/Local content.
        // Do NOT add generic non-prefixed queries (e.g. "Rock Slow") which fetch global results.

        if (effectiveLang === 'tr') {
            searchQueries.push(`${langTerm} ${g} ${mainMood}`);
            searchQueries.push(`yerli ${g} ${mainMood}`);
            // Also add just "Turkish [Genre]" for broader coverage
            searchQueries.push(`türkçe ${g}`);
        } else {
            // For English/Mixed, stick to standard queries
            searchQueries.push(`${langTerm} ${g} ${mainMood}`);
            searchQueries.push(`${g} ${mainMood}`);
        }
    });
    // Don't add artist queries here if we handle them specifically in Source 4, 
    // but keeping them helps finding collaborations or deep cuts.
    if (explicit_artists) explicit_artists.forEach(a => searchQueries.push(`artist:${a}`));

    const searchPromise = spotifyService.searchMultipleQueries(searchQueries.slice(0, 15));

    // --- SOURCE 2: Recommendations API (Targeted Features) ---
    // Ground truth from Spotify's own math - VERY TRUSTED SOURCE
    let recsPromise = Promise.resolve([]);
    if (mainMood === 'slow') {
        recsPromise = spotifyService.getRecommendationsAdvanced({
            seed_genres: 'turkish,pop,acoustic',
            market: 'TR',
            target_energy: 0.3,
            max_energy: 0.55,
            target_tempo: 100,
            max_tempo: 120
        });
    } else if (mainMood === 'energetic') {
        recsPromise = spotifyService.getRecommendationsAdvanced({
            seed_genres: 'turkish,pop,dance',
            market: 'TR',
            target_energy: 0.8,
            min_energy: 0.6
        });
    }

    // --- SOURCE 3: Playlist Mining (Curated Lists) ---
    // Curated playlists are also TRUSTED SOURCES for the mood
    let playlistPromise = Promise.resolve([]);
    if (effectiveLang === 'tr') {
        const playlistQuery = moods.includes('slow') ? 'Türkçe Slow' :
            (moods.includes('energetic') ? 'Türkçe Pop Hareketli' : 'Türkçe Pop');
        playlistPromise = spotifyService.searchPlaylists(playlistQuery, 3) // Increased to 3
            .then(async (playlists) => {
                if (!playlists || playlists.length === 0) return [];
                // Get tracks from ALL found playlists (up to 3) to maximize pool
                const validPlaylists = playlists.filter(p => p && p.id);
                const tracksPromises = validPlaylists.map(p => spotifyService.getPlaylistTracks(p.id));
                const results = await Promise.all(tracksPromises);
                return results.flat();
            });
    }

    // --- SOURCE 4: Targeted Artists (ARTIST-FIRST PIPELINE) ---
    let artistPromise = Promise.resolve([]);
    if (explicit_artists && explicit_artists.length > 0) {
        console.log(`Fetching tracks for requested artists: ${explicit_artists.join(', ')}`);
        const artistChecks = explicit_artists.map(async (name) => {
            // A) Resolve Artist ID
            const artist = await spotifyService.searchArtist(name);
            if (!artist) return [];

            // B) Get Top Tracks
            const topTracks = await spotifyService.getArtistTopTracks(artist.id);

            // Explicitly tag these tracks with the artist name for Round-Robin distribution
            topTracks.forEach(t => t._explicitArtistName = name.toLowerCase());

            return topTracks;
        });
        artistPromise = Promise.all(artistChecks).then(results => results.flat());
    }

    // Wait for all sources
    const [searchResults, recsResults, playlistResults, artistResults] = await Promise.all([
        searchPromise, recsPromise, playlistPromise, artistPromise
    ]);

    addTracks(searchResults, 'Search API');
    addTracks(recsResults, 'Recommendations API');
    addTracks(playlistResults, 'Playlist Mining');
    addTracks(artistResults, 'Artist Target'); // These automatically get _isRequestedArtist = true

    console.log(`Total Candidates: ${allCandidates.length}`);

    // --- Statistics for Debugging ---
    const stats = {
        total: allCandidates.length,
        audioMissing: 0,
        languageFiltered: 0,
        genreFiltered: 0,
        audioFiltered: 0,
        passedStrict: 0,
        passedRelaxed: 0
    };

    if (allCandidates.length === 0) return { selected: [], stats };

    // STAGE D: HARD FILTERING
    const audioFeaturesMap = await spotifyService.getAudioFeatures(allCandidates.map(t => t.id));

    const applyFilter = (strictness) => {
        const MAX_ENERGY = strictness === 'strict' ? 0.45 : 0.50;
        const MAX_TEMPO = strictness === 'strict' ? 110 : 112;

        return allCandidates.filter(track => {
            const nameLower = track.name.toLowerCase();
            const artistLower = track.artist.toLowerCase();

            // 1. Language Hard Filter 
            if (language === 'tr') {
                const hasTR = /[şŞıİğĞüÜöÖçÇ]/.test(track.name) || /[şŞıİğĞüÜöÖçÇ]/.test(track.artist);
                // Not discarding purely on missing chars if source is trusted (e.g. TR playlist)
                // But still useful for ranking
            }

            // 2. Genre/Blacklist Hard Filter (ALWAYS APPLY)
            if (moods.includes('slow')) {
                // If user specifically asked for "Uzi", don't blacklist him (Override blacklist with explicit intent)
                // But generally retain structure.
                const isRequestedArtist = requestedArtistNames.some(ra => artistLower.includes(ra));
                if (!isRequestedArtist) {
                    // Rap & Remixes are NEVER slow, even if audio data missing
                    if (RAP_BLACKLIST.some(bad => artistLower.includes(bad)) || /remix|club|mix|dance|techno|drill|trap/i.test(nameLower)) {
                        if (strictness === 'strict') stats.genreFiltered++;
                        return false;
                    }
                }
            }

            // 3. Audio Features Hard Filter (SMART FALLBACK)
            const f = audioFeaturesMap[track.id];

            if (!f) {
                // DATA MISSING CASE
                stats.audioMissing++;
                // TRUST if from Targeted Artist
                if (track._isRequestedArtist) return true;

                // Smart Fallback Strategy:
                // TRUST if from 'Recommendations API' (already pre-filtered by Spotify)
                // TRUST if from 'Playlist Mining' (curated human list)
                // TRUST if name contains 'acoustic', 'slow', 'piano'

                const isTrustedSource = track._source === 'Recommendations API' || track._source === 'Playlist Mining';
                const hasSafeKeywords = /acoustic|akustik|piyano|piano|slow|ballad/i.test(nameLower);

                // If trusted source OR safe keyword, allow pass (since we already filtered blacklisted genres above)
                if (isTrustedSource || hasSafeKeywords) return true;

                // If from generic search and no safe keywords -> Discard to be safe
                return false;
            }

            // DATA PRESENT CASE
            if (moods.includes('slow')) {
                if (f.energy > MAX_ENERGY || f.tempo > MAX_TEMPO || f.danceability > 0.58) {
                    if (strictness === 'strict') stats.audioFiltered++;
                    return false;
                }
            }
            if (moods.includes('energetic')) {
                if (f.energy < 0.60) {
                    if (strictness === 'strict') stats.audioFiltered++;
                    return false;
                }
            }

            return true;
        });
    };

    // Attempt 1: Strict Energy Level
    let validTracks = applyFilter('strict');
    stats.passedStrict = validTracks.length;
    console.log(`Strict Filter Passed: ${validTracks.length}`);

    // Attempt 2: Tiny Relaxation
    if (validTracks.length < 5 && moods.includes('slow')) {
        console.log('Pool empty, applying micro-relaxation...');
        validTracks = applyFilter('relaxed');
        stats.passedRelaxed = validTracks.length;
    }

    // STAGE E: Diversity with Artist Priority Round-Robin
    const selected = [];
    const artistCounts = {};
    const TOTAL_QUOTA = 6; // ~40% of 15

    // Group priority tracks by the artist explicitly requested
    const priorityGroups = {};
    requestedArtistNames.forEach(name => priorityGroups[name] = []);

    // Filter valid tracks into groups
    const otherTracks = [];

    validTracks.forEach(t => {
        if (t._isRequestedArtist && t._explicitArtistName) {
            // Add to specific artist bucket
            if (priorityGroups[t._explicitArtistName]) {
                priorityGroups[t._explicitArtistName].push(t);
            } else {
                // Should not happen if logic matches, but fallback
                otherTracks.push(t);
            }
        } else {
            otherTracks.push(t);
        }
    });

    // Round-Robin Selection to fill Quota
    // This ensures if user asked for "A, B, C", we pick A1, B1, C1, A2, B2...
    let slotsFilled = 0;

    while (slotsFilled < TOTAL_QUOTA) {
        let addedInRound = 0;

        for (const artistName of requestedArtistNames) {
            if (slotsFilled >= TOTAL_QUOTA) break;

            const group = priorityGroups[artistName];
            if (group && group.length > 0) {
                // Pick best remaining track from this artist
                const track = group.shift();

                selected.push(track);
                slotsFilled++;
                addedInRound++;

                // Update counts
                const realArtist = track.artistPrimary || track.artist || 'Unknown';
                artistCounts[realArtist] = (artistCounts[realArtist] || 0) + 1;
            }
        }

        // If no artist could provide a track in this full round, we are done with priority
        if (addedInRound === 0) break;
    }

    console.log(`Priority Quota Filled: ${slotsFilled}/${TOTAL_QUOTA}`);

    // Shuffle remaining other tracks
    const shuffledOthers = otherTracks.sort(() => Math.random() - 0.5);

    // 2. Fill Remainder from General Pool
    for (const track of shuffledOthers) {
        if (selected.length >= 15) break;
        const artist = track.artistPrimary || 'Unknown';

        // Stricter diversity for non-requested artists (max 1 per artist)
        // Unless it's a requested artist who fell into "other" bin for some reason
        const maxAllowed = track._isRequestedArtist ? 4 : 1;

        if ((artistCounts[artist] || 0) >= maxAllowed) continue;

        selected.push(track);
        artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    }

    // 3. Backfill attempt (if still under 15, try to squeeze more from priority groups)
    if (selected.length < 15) {
        for (const artistName of requestedArtistNames) {
            const group = priorityGroups[artistName];
            while (group && group.length > 0 && selected.length < 15) {
                const track = group.shift();
                // Check if already in (shouldn't be, as we shifted)
                if (!selected.some(s => s.id === track.id)) { // extra safety
                    selected.push(track);
                }
            }
        }
    }

    // Shuffle final selection so artist tracks aren't all at top
    // But keep them in the set.
    const finalSelection = selected.sort(() => Math.random() - 0.5);

    // CALCULATE VIBE STATS (Ground Truth)
    // We already have audioFeaturesMap. Let's compute averages for the final selection.
    let totalEnergy = 0;
    let totalValence = 0;
    let totalInstrumental = 0;
    let totalDance = 0;
    let count = 0;

    finalSelection.forEach(t => {
        const f = audioFeaturesMap[t.id];
        if (f) {
            totalEnergy += f.energy;
            totalValence += f.valence;
            totalInstrumental += f.instrumentalness;
            totalDance += f.danceability;
            count++;
        }
    });

    const vibeStats = count > 0 ? {
        energyLevel: Math.round((totalEnergy / count) * 10),
        melancholyLevel: Math.round((1 - (totalValence / count)) * 10), // Low valence = High melancholy
        instrumentalIntensity: Math.round((totalInstrumental / count) * 10),
        danceability: Math.round((totalDance / count) * 10)
    } : {
        // Defaults if audio features missing
        energyLevel: 5, melancholyLevel: 5, instrumentalIntensity: 5, danceability: 5
    };

    return { selected: finalSelection, stats, vibeStats };
}

export default {
    processCandidateTracks
};
