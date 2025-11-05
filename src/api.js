import { buildUser, buildAlbumRaw, sleep } from 'helpers'

const API_URL = 'https://api.spotify.com/v1'
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/'
const HTTP_TOO_MANY_REQUESTS = 429

/**
 * Represents an error encountered during data fetching
 */
export class FetchError extends Error {
  /**
   * @param {number} status
   * @param {string} [message]
   */
  constructor(status, message) {
    super(message)
    this.name = 'FetchError'
    this.status = status
  }
}

/**
 * Return current user
 *
 * @param {string} token
 * @param {AbortSignal} [signal]
 */
export async function getUser(token, signal) {
  /** @type {SpotifyUser} */
  const userResponse = await get(apiUrl('me'), token, signal)
  return buildUser(userResponse)
}

/**
 * Get user's top artists with extended limit (up to 500)
 * 
 * @param {string} token
 * @param {'medium_term' | 'long_term'} timeRange
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ artists: SpotifyArtist[], affinity: Record<string, number> }>}
 */
export async function getUserTopArtistsExtended(token, timeRange, signal) {
  const allArtists = []
  const affinityScores = {}
  let offset = 0
  const limit = 50 // Spotify's max per request
  
  // Get up to 500 artists (10 requests of 50 each)
  while (offset < 500) {
    const params = new URLSearchParams({ 
      time_range: timeRange, 
      limit: limit.toString(), 
      offset: offset.toString() 
    })
    
    try {
      /** @type {Paged<SpotifyArtist>} */
      const response = await get(apiUrl(`me/top/artists?${params}`), token, signal)
      
      if (!response.items || response.items.length === 0) break
      
      // Calculate affinity scores based on position (higher position = higher affinity)
      response.items.forEach((artist, index) => {
        const globalPosition = offset + index
        // Score from 100 (top artist) down to 1 (500th artist)
        const affinityScore = Math.max(1, 100 - (globalPosition / 5))
        
        allArtists.push(artist)
        affinityScores[artist.id] = affinityScore
      })
      
      offset += response.items.length
      
      // If we got fewer items than requested, we've reached the end
      if (response.items.length < limit) break
      
    } catch (error) {
      console.warn(`Failed to fetch top artists at offset ${offset}:`, error)
      break
    }
  }
  
  return { artists: allArtists, affinity: affinityScores }
}

/**
 * Get combined top artists data from medium and long term
 * 
 * @param {string} token
 * @param {AbortSignal} [signal]
 */
export async function getUserTopArtistsCombined(token, signal) {
  const [mediumTerm, longTerm] = await Promise.all([
    getUserTopArtistsExtended(token, 'medium_term', signal),
    getUserTopArtistsExtended(token, 'long_term', signal)
  ])
  
  // Combine and weight the affinity scores
  const combinedAffinity = {}
  const allArtistIds = new Set([
    ...Object.keys(mediumTerm.affinity),
    ...Object.keys(longTerm.affinity)
  ])
  
  allArtistIds.forEach(artistId => {
    const mediumScore = mediumTerm.affinity[artistId] || 0
    const longScore = longTerm.affinity[artistId] || 0
    
    // Weight medium term higher (70%) than long term (30%)
    // Recent listening habits are more relevant for new releases
    combinedAffinity[artistId] = (mediumScore * 0.7) + (longScore * 0.3)
  })
  
  // Get unique artists (prioritize medium term data for artist objects)
  const artistsMap = new Map()
  mediumTerm.artists.forEach(artist => artistsMap.set(artist.id, artist))
  longTerm.artists.forEach(artist => {
    if (!artistsMap.has(artist.id)) {
      artistsMap.set(artist.id, artist)
    }
  })
  
  return {
    artists: Array.from(artistsMap.values()),
    affinity: combinedAffinity
  }
}

/**
 * Last.fm API integration for enhanced artist data
 */
export class LastFmApi {
  /**
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.apiKey = apiKey
  }
  
  /**
   * Get user's top artists from Last.fm
   * 
   * @param {string} username
   * @param {'7day' | '1month' | '3month' | '6month' | '12month' | 'overall'} period
   * @param {number} [limit=500]
   */
  async getUserTopArtists(username, period = 'overall', limit = 500) {
    const params = new URLSearchParams({
      method: 'user.gettopartists',
      user: username,
      api_key: this.apiKey,
      format: 'json',
      limit: limit.toString(),
      period
    })
    
    try {
      const response = await fetch(`${LASTFM_API_URL}?${params}`)
      const data = await response.json()
      
      if (data.error) {
        throw new Error(`Last.fm API error: ${data.message}`)
      }
      
      return data.topartists?.artist || []
    } catch (error) {
      console.warn('Last.fm API request failed:', error)
      return []
    }
  }
  
  /**
   * Get similar artists for a given artist
   * 
   * @param {string} artistName
   * @param {number} [limit=50]
   */
  async getSimilarArtists(artistName, limit = 50) {
    const params = new URLSearchParams({
      method: 'artist.getsimilar',
      artist: artistName,
      api_key: this.apiKey,
      format: 'json',
      limit: limit.toString()
    })
    
    try {
      const response = await fetch(`${LASTFM_API_URL}?${params}`)
      const data = await response.json()
      
      if (data.error) {
        console.warn(`Last.fm similar artists error for ${artistName}:`, data.message)
        return []
      }
      
      return data.similarartists?.artist || []
    } catch (error) {
      console.warn('Last.fm similar artists request failed:', error)
      return []
    }
  }
  
  /**
   * Get artist tags (genres)
   * 
   * @param {string} artistName
   */
  async getArtistTags(artistName) {
    const params = new URLSearchParams({
      method: 'artist.gettoptags',
      artist: artistName,
      api_key: this.apiKey,
      format: 'json'
    })
    
    try {
      const response = await fetch(`${LASTFM_API_URL}?${params}`)
      const data = await response.json()
      
      if (data.error) {
        return []
      }
      
      return data.toptags?.tag || []
    } catch (error) {
      console.warn('Last.fm artist tags request failed:', error)
      return []
    }
  }
}

/**
 * Enhanced artist affinity calculator that combines Spotify and Last.fm data
 */
export class ArtistAffinityCalculator {
  /**
   * @param {Record<string, number>} spotifyAffinity
   * @param {any[]} lastFmTopArtists
   * @param {string} [lastFmUsername]
   */
  constructor(spotifyAffinity, lastFmTopArtists = [], lastFmUsername = null) {
    this.spotifyAffinity = spotifyAffinity
    this.lastFmTopArtists = lastFmTopArtists
    this.lastFmUsername = lastFmUsername
    this.lastFmAffinityMap = this.buildLastFmAffinityMap()
  }
  
  /**
   * Build affinity map from Last.fm data
   */
  buildLastFmAffinityMap() {
    const affinityMap = {}
    
    this.lastFmTopArtists.forEach((artist, index) => {
      // Convert playcount to affinity score
      const playcount = parseInt(artist.playcount) || 0
      const position = index + 1
      
      // Score based on both playcount and position
      const maxPlaycount = parseInt(this.lastFmTopArtists[0]?.playcount) || 1
      const playcountScore = (playcount / maxPlaycount) * 50 // 0-50 points from playcount
      const positionScore = Math.max(0, 50 - position) // 0-50 points from position
      
      affinityMap[artist.name.toLowerCase()] = playcountScore + positionScore
    })
    
    return affinityMap
  }
  
  /**
   * Get combined affinity score for an artist
   * 
   * @param {string} spotifyArtistId
   * @param {string} artistName
   * @returns {number} Affinity score 0-100
   */
  getAffinityScore(spotifyArtistId, artistName) {
    const spotifyScore = this.spotifyAffinity[spotifyArtistId] || 0
    const lastFmScore = this.lastFmAffinityMap[artistName.toLowerCase()] || 0
    
    // If we have both scores, weight them
    if (spotifyScore > 0 && lastFmScore > 0) {
      return (spotifyScore * 0.6) + (lastFmScore * 0.4) // Favor Spotify data slightly
    }
    
    // Return whichever score we have
    return Math.max(spotifyScore, lastFmScore)
  }
  
  /**
   * Get affinity category for UI display
   * 
   * @param {number} score
   * @returns {'high' | 'medium' | 'low' | 'none'}
   */
  getAffinityCategory(score) {
    if (score >= 70) return 'high'
    if (score >= 40) return 'medium'  
    if (score >= 10) return 'low'
    return 'none'
  }
}

/**
 * Return current user's followed artists page
 *
 * @type {CursorPagedRequest<SpotifyArtist>}
 */
export async function getUserFollowedArtistsPage(token, limit, after, signal) {
  const params = new URLSearchParams({ type: 'artist', limit: limit.toString() })
  if (after) params.set('after', after)
  /** @type {{ artists: CursorPaged<SpotifyArtist> }} */
  const response = await get(apiUrl(`me/following?${params}`), token, signal)
  return response.artists
}

/**
 * Return saved tracks page
 *
 * @type {PagedRequest<SpotifySavedTrack>}
 */
export function getUserSavedTracksPage(token, limit, offset, signal) {
  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() })
  return get(apiUrl(`me/tracks?${params}`), token, signal)
}

/**
 * Return saved albums page
 *
 * @type {PagedRequest<SpotifySavedAlbum>}
 */
export function getUserSavedAlbumsPage(token, limit, offset, signal) {
  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() })
  return get(apiUrl(`me/albums?${params}`), token, signal)
}

/**
 * Return saved playlists
 *
 * @type {PagedRequest<SpotifyPlaylist>}
 */
export function getUserSavedPlaylistsPage(token, limit, offset, signal) {
  const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() })
  return get(apiUrl(`me/playlists?${params}`), token, signal)
}

/**
 * Return an artist's albums
 *
 * @param {string} token
 * @param {string} artistId
 * @param {AlbumGroup[]} groups
 * @param {AbortSignal} [signal]
 */
export async function getArtistAlbums(token, artistId, groups, signal) {
  /** @type {AlbumRaw[]} */
  const albums = []
  const params = new URLSearchParams({ limit: '50', include_groups: groups.join(',') })
  let next = apiUrl(`artists/${artistId}/albums?${params}`)

  while (next) {
    /** @type {Paged<SpotifyAlbum>} */
    const response = await get(next, token, signal)
    for (const item of response.items) albums.push(buildAlbumRaw(item, artistId))
    next = response.next
  }

  return albums
}

/**
 * Return an album's track IDs
 *
 * @param {string} token
 * @param {string[]} albumIds
 * @param {AbortSignal} [signal]
 */
export async function getFullAlbums(token, albumIds, signal) {
  const params = new URLSearchParams({ ids: albumIds.join(',') })
  /** @type {{ albums: SpotifyAlbumFull[] }} */
  const response = await get(apiUrl(`albums?${params}`), token, signal)
  return response.albums
}

/**
 * Return an album's track IDs
 *
 * @param {string} token
 * @param {string[]} albumIds
 * @param {AbortSignal} [signal]
 */
export async function getAlbumsTrackIds(token, albumIds, signal) {
  /** @type {string[]} */
  const trackIds = []
  const albums = await getFullAlbums(token, albumIds, signal)

  for (const album of albums) {
    if (!album) continue

    const albumTrackIds = album.tracks.items.map((track) => track.id)
    let next = album.tracks.next

    while (next) {
      /** @type {Paged<SpotifyTrack>} */
      const response = await get(next, token, signal)
      for (const track of response.items) albumTrackIds.push(track.id)
      next = response.next
    }

    for (const id of albumTrackIds) trackIds.push(id)
  }

  return trackIds
}

/**
 * Create a new playlist
 *
 * @param {string} token
 * @param {string} userId
 * @param {PlaylistForm} form
 * @param {AbortSignal} [signal]
 * @returns {Promise<SpotifyPlaylist>}
 */
export function createPlaylist(token, userId, form, signal) {
  return post(
    apiUrl(`users/${userId}/playlists`),
    token,
    { name: form.name, description: form.description, public: form.isPublic },
    signal
  )
}

/**
 * Add tracks to an existing playlist
 *
 * @param {string} token
 * @param {string} playlistId
 * @param {string[]} trackUris
 * @param {AbortSignal} [signal]
 * @returns {Promise<SpotifyPlaylistSnapshot>}
 */
export function addTracksToPlaylist(token, playlistId, trackUris, signal) {
  return post(apiUrl(`playlists/${playlistId}/tracks`), token, { uris: trackUris }, signal)
}

/**
 * Clears all tracks from playlist
 *
 * @param {string} token
 * @param {string} playlistId
 * @param {AbortSignal} [signal]
 * @returns {Promise<SpotifyPlaylistSnapshot>}
 */
export function clearPlaylist(token, playlistId, signal) {
  return put(
    apiUrl(`playlists/${playlistId}/tracks`),
    token,
    { uris: [], range_start: 0, range_length: 99999 },
    signal
  )
}

/**
 * Create full API url
 *
 * @param {string} endpoint
 */
function apiUrl(endpoint) {
  return `${API_URL}/${endpoint}`
}

/**
 * Fire GET request
 *
 * @template T
 * @param {string} endpoint
 * @param {string} token
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
function get(endpoint, token, signal) {
  return request({ endpoint, token, signal, method: 'GET' })
}

/**
 * Fire POST request
 *
 * @template T
 * @param {string} endpoint
 * @param {string} token
 * @param {Record<string, unknown>} body
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
function post(endpoint, token, body, signal) {
  return request({
    endpoint,
    token,
    signal,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Fire PUT request
 *
 * @template T
 * @param {string} endpoint
 * @param {string} token
 * @param {Record<string, unknown>} body
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
function put(endpoint, token, body, signal) {
  return request({
    endpoint,
    token,
    signal,
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Spotify API request wrapper
 *
 * @template T
 * @param {{
 *   endpoint: string
 *   token: string
 *   method: import('workbox-routing/utils/constants').HTTPMethod
 *   headers?: Record<string, string>
 *   body?: string
 *   signal?: AbortSignal
 * }} payload
 * @returns {Promise<T>}
 */
async function request(payload) {
  const { endpoint, token, method, headers = {}, body, signal } = payload
  const defaultHeaders = { authorization: `Bearer ${token}`, accept: 'application/json' }

  const response = await fetch(endpoint, {
    headers: { ...defaultHeaders, ...headers },
    method,
    body,
    signal,
  })

  if (response.ok) return response.json()

  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    const retryAfter = Number(response.headers.get('Retry-After'))
    await sleep((retryAfter + 1) * 1000)
    return request(payload)
  }

  let message = `HTTP Error ${response.status}`

  try {
    const json = await response.json()
    if (json.error?.message) message = json.error.message
  } catch {}

  throw new FetchError(response.status, message)
}
