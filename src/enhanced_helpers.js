// src/helpers.js - Enhanced with smart sorting based on artist affinity

import moment from 'moment'
import orderBy from 'lodash/orderBy'
import mergeWith from 'lodash/mergeWith'
import random from 'lodash/random'
import { colord } from 'colord'
import intersect from 'fast_array_intersect'
import * as Sentry from '@sentry/browser'
import { AlbumGroup, AlbumGroupIndex, MomentFormat, ReleasesOrder } from 'enums'

const { ISO_DATE } = MomentFormat
const NOTIFICATION_ICON = `${process.env.REACT_APP_URL}/android-chrome-192x192.png`
const VARIOUS_ARTISTS = 'Various Artist'
const VARIOUS_ARTISTS_ID = '0LyfQWJT6nXafLPZqxe9Of'

// ... (keep all existing helper functions until buildReleases)

/**
 * Promisified setTimeout
 *
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Delay function execution until UI is done updating
 *
 * @param {function} fn
 * @param {...any} [args] - Arguments to be passed to function
 */
export function defer(fn, ...args) {
  requestAnimationFrame(() => setTimeout(() => fn(...args), 0))
}

/**
 * Callback wrapper for `defer()`
 *
 * @param {function} fn
 * @param {...any} [args] - Arguments to be passed to function
 */
export function deferred(fn, ...args) {
  return () => defer(fn, ...args)
}

/**
 * Wrapper around lodash `mergeWith` that concatenates array values
 *
 * @template {Object} T
 * @param {T} object
 * @param {Object} source
 * @returns {T}
 */
export function merge(object, source) {
  return mergeWith(object, source, (objValue, srcValue) =>
    Array.isArray(objValue) ? objValue.concat(srcValue) : undefined
  )
}

/**
 * Check if value is string
 *
 * @param {any} value
 */
export function isString(value) {
  return typeof value === 'string'
}

/**
 * Check if array includes truthy value
 *
 * @param {any[]} array
 */
export function includesTruthy(array) {
  return array.some((value) => value)
}

/**
 * Get dates between `startDate` and `endDate`
 *
 * @param {Moment} startDate
 * @param {Moment} endDate
 */
export function* dateRange(startDate, endDate) {
  const current = startDate.clone()

  while (current.isSameOrBefore(endDate)) {
    yield current.format(ISO_DATE)

    current.add(1, 'day')
  }
}

/**
 * Create playlist name suggestion
 *
 * @param {Moment} [startDate]
 * @param {Moment} [endDate]
 */
export function playlistName(startDate, endDate) {
  if (!startDate || !endDate) return 'New Releases'

  const start = startDate.format('MMM D')
  const end = endDate.format('MMM D')

  if (startDate.isSame(endDate, 'day')) {
    return `${start} Releases`
  }

  return `${start} - ${end} Releases`
}

/**
 * Get release IDs released between startDate and endDate
 *
 * @param {ReleasesMap} releasesMap
 * @param {Moment} startDate
 * @param {Moment} endDate
 */
export function getReleasesBetween(releasesMap, startDate, endDate) {
  /** @type {string[]} */
  const releases = []

  for (const date of dateRange(startDate, endDate)) {
    if (date in releasesMap) {
      for (const album of releasesMap[date]) releases.push(album.id)
    }
  }

  return releases
}

/**
 * Create Spotify URI
 *
 * @param {string} id
 * @param {string} entity
 */
export function spotifyUri(id, entity) {
  return `spotify:${entity}:${id}`
}

/**
 * Create Spotify URL
 *
 * @param {string} id
 * @param {string} entity
 */
export function spotifyUrl(id, entity) {
  return `https://open.spotify.com/${entity}/${id}`
}

/**
 * Create Spotify link
 *
 * @param {string} id
 * @param {string} entity
 * @param {boolean} [uri] - Return URI link if `true`
 */
export function spotifyLink(id, entity, uri = false) {
  return uri ? spotifyUri(id, entity) : spotifyUrl(id, entity)
}

/**
 * Pick image from array of images and return its URL
 *
 * @param {SpotifyImage[]} [images]
 * @returns {string | null}
 */
export function getImage(images) {
  if (!images?.length) return null
  const image = images.find(({ width }) => width === 300)
  return image ? image.url : images[0].url
}

/**
 * Build User
 *
 * @param {SpotifyUser} source
 */
export function buildUser(source) {
  return /** @type {User} */ ({
    id: source.id,
    name: source.display_name,
    image: getImage(source.images),
  })
}

/**
 * Build Artist
 *
 * @param {SpotifyArtist} source
 */
export function buildArtist(source) {
  return /** @type {Artist} */ ({ id: source.id, name: source.name })
}

/**
 * Build AlbumRaw
 *
 * @param {SpotifyAlbum} source
 * @param {string} artistId
 */
export function buildAlbumRaw(source, artistId) {
  return /** @type {AlbumRaw} */ ({
    id: source.id,
    name: source.name,
    image: getImage(source.images),
    albumArtists: source.artists.map(buildArtist),
    releaseDate: source.release_date,
    artistIds: { [source.album_group]: [artistId] },
    totalTracks: source.total_tracks,
  })
}

/**
 * Generate random color scheme
 *
 * @param {{ rotation: () => number, saturation: () => number, lightness: () => number }} options
 */
export function randomColorScheme({ rotation, saturation, lightness }) {
  let hue = random(0, 359)

  const scheme = Object.values(AlbumGroup).reduce((scheme, group) => {
    hue += rotation()

    if (hue >= 360) {
      hue -= 360
    }

    scheme[group] = colord({ h: hue, s: saturation(), l: lightness() }).toHex()

    return scheme
  }, /** @type {GroupColorScheme} */ ({}))

  return scheme
}

/**
 * Create new notification
 *
 * @param {string} title
 * @param {string} [body]
 */
export function createNotification(title, body) {
  const notification = new Notification(title, { body, icon: NOTIFICATION_ICON })

  notification.addEventListener('click', () => {
    window.focus()
    notification.close()
  })

  return notification
}

/**
 * Check if all modals are closed
 */
export function modalsClosed() {
  return !document.documentElement.classList.contains('is-modal-open')
}

/**
 * Sentry captureException wrapper
 *
 * @param {Error & { contexts?: SentryContexts }} error
 */
export function captureException(error) {
  console.error(error)
  Sentry.captureException(error, { contexts: error.contexts })
}

/**
 * Merge album artists and filter out old albums
 *
 * @param {AlbumRaw[]} albumsRaw
 * @param {string} minDate
 */
export function mergeAlbumsRaw(albumsRaw, minDate) {
  const maxDate = moment().add(1, 'day').format(MomentFormat.ISO_DATE)
  const albumsRawMap = albumsRaw.reduce((map, album) => {
    const { id, releaseDate, artistIds } = album

    if (releaseDate < minDate || releaseDate > maxDate) return map

    if (id in map) merge(map[id].artistIds, artistIds)
    else map[id] = album

    return map
  }, /** @type {{ [id: string]: AlbumRaw }} */ ({}))

  return Object.values(albumsRawMap)
}

/**
 * Build AlbumsMap
 *
 * @param {AlbumRaw[]} albumsRaw
 * @param {Artist[]} artists
 */
export function buildAlbumsMap(albumsRaw, artists) {
  const artistsMap = artists.reduce((map, artist) => {
    map[artist.id] = artist
    return map
  }, /** @type {ArtistsMap} */ ({}))

  const albumsMap = albumsRaw.reduce((map, albumRaw) => {
    map[albumRaw.id] = buildAlbum(albumRaw, artistsMap)
    return map
  }, /** @type {AlbumsMap} */ ({}))

  return albumsMap
}

/**
 * Build Album
 *
 * @param {AlbumRaw} albumRaw
 * @param {ArtistsMap} artistsMap
 */
export function buildAlbum(albumRaw, artistsMap) {
  const { artistIds, albumArtists, ...albumBase } = albumRaw

  const artistIdsArray = Object.values(artistIds).flat()
  const artistIdsEntries = orderBy(Object.entries(artistIds), ([group]) => AlbumGroupIndex[group])
  const artistsEntries = artistIdsEntries.map(([group, artistIds]) => {
    const artists = orderBy(
      artistIds.map((id) => artistsMap[id]),
      'name'
    )

    return /** @type {[group: AlbumGroup, artists: Artist[]]} */ ([group, artists])
  })

  const artists = Object.fromEntries(artistsEntries)
  const otherArtists = albumArtists.filter((artist) => !artistIdsArray.includes(artist.id))

  return /** @type {Album} */ ({ ...albumBase, artists, otherArtists })
}

/**
 * Build ReleasesMap
 *
 * @param {Album[]} albums
 */
export function buildReleasesMap(albums) {
  return albums.reduce(
    (map, album) => merge(map, { [album.releaseDate]: [album] }),
    /** @type {ReleasesMap} */ ({})
  )
}

/**
 * Calculate artist affinity score for an album
 * 
 * @param {Album} album
 * @param {Record<string, number>} artistAffinity
 * @returns {number} Combined affinity score (0-100)
 */
export function calculateAlbumAffinity(album, artistAffinity) {
  const allArtists = Object.values(album.artists).flat().concat(album.otherArtists)
  
  if (allArtists.length === 0) return 0
  
  // Get affinity scores for all artists on the album
  const affinityScores = allArtists
    .map(artist => artistAffinity[artist.id] || 0)
    .filter(score => score > 0)
  
  if (affinityScores.length === 0) return 0
  
  // Use the highest affinity score (main artist typically has highest)
  const maxAffinity = Math.max(...affinityScores)
  
  // Give a small bonus if multiple artists on the album have affinity
  const collaborationBonus = affinityScores.length > 1 ? 5 : 0
  
  return Math.min(100, maxAffinity + collaborationBonus)
}

/**
 * Get affinity category for UI indicators
 * 
 * @param {number} score
 * @returns {'high' | 'medium' | 'low' | 'none'}
 */
export function getAffinityCategory(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'  
  if (score >= 10) return 'low'
  return 'none'
}

/**
 * Enhanced Build Releases with smart sorting support
 *
 * @param {ReleasesMap} releasesMap
 * @param {ReleasesOrder} releasesOrder
 * @param {boolean} [enableSmartSort=false] - Whether to use affinity-based sorting
 * @param {Record<string, number>} [artistAffinity={}] - Artist affinity scores
 * @param {number} [smartSortWeight=70] - How much to weight affinity (0-100)
 */
export function buildReleases(releasesMap, releasesOrder, enableSmartSort = false, artistAffinity = {}, smartSortWeight = 70) {
  const releasesUnordered = Object.entries(releasesMap).map(([date, albums]) => ({ date, albums }))
  const releasesOrderedByDate = orderBy(releasesUnordered, 'date', 'desc')

  /** @type {Releases} */
  const releases = releasesOrderedByDate.map((releaseDay) => {
    /** @param {Album} album */
    const orderByAlbumGroup = (album) => AlbumGroupIndex[Object.keys(album.artists).shift()]
    
    /** @param {Album} album */
    const orderByArtistName = (album) =>
      Object.values(album.artists).flat().shift().name.toLowerCase()
    
    /** @param {Album} album */
    const orderByAffinity = (album) => {
      if (!enableSmartSort) return 0
      return -calculateAlbumAffinity(album, artistAffinity) // Negative for descending order
    }

    /** @type {Array<((album: Album) => string | number) | string>} */
    const orders = []
    const directions = []
    
    // Smart sort: Primary sort by affinity if enabled and weight is high
    if (enableSmartSort && smartSortWeight >= 50) {
      orders.push(orderByAffinity)
      directions.push('asc') // Already negative, so asc gives us descending affinity
    }
    
    // Secondary sorts based on user preference
    if (releasesOrder === ReleasesOrder.ALBUM_GROUP) {
      orders.push(orderByAlbumGroup)
      directions.push('asc')
    }
    
    orders.push(orderByArtistName, 'name')
    directions.push('asc', 'asc')
    
    // If smart sort is enabled but weight is low, add affinity as final tiebreaker
    if (enableSmartSort && smartSortWeight < 50) {
      orders.push(orderByAffinity)
      directions.push('asc')
    }

    releaseDay.albums = orderBy(releaseDay.albums, orders, directions)

    return releaseDay
  })

  return releases
}

/**
 * Enhanced album with affinity data for UI display
 * 
 * @param {Album} album
 * @param {Record<string, number>} artistAffinity
 * @returns {Album & { affinityScore: number, affinityCategory: string }}
 */
export function enhanceAlbumWithAffinity(album, artistAffinity) {
  const affinityScore = calculateAlbumAffinity(album, artistAffinity)
  const affinityCategory = getAffinityCategory(affinityScore)
  
  return {
    ...album,
    affinityScore,
    affinityCategory
  }
}

/**
 * Check if album contains Various Artists
 *
 * @param {Album} album
 */
export function hasVariousArtists(album) {
  return Object.values(album.artists)
    .flat()
    .concat(album.otherArtists)
    .some((artist) => artist.name === VARIOUS_ARTISTS || artist.id === VARIOUS_ARTISTS_ID)
}

/**
 * Delete albums from specified labels and return deleted IDs. Mutates `albumsMap`.
 *
 * @param {AlbumsMap | Draft<AlbumsMap>} albumsMap
 * @param {BlockedLabels} blockedLabels
 */
export function deleteLabels(albumsMap, blockedLabels) {
  if (Object.keys(blockedLabels).length === 0) return []

  /** @type {string[]} */
  const deletedIds = []

  /** @param {Album} album */
  const shouldDelete = (album) => {
    if (album.label in blockedLabels) {
      if (blockedLabels[album.label] === undefined) return true
      if (blockedLabels[album.label].includes('VA') && hasVariousArtists(album)) return true
    }

    return false
  }

  for (const album of Object.values(albumsMap)) {
    if (shouldDelete(album)) {
      deletedIds.push(album.id)
      delete albumsMap[album.id]
    }
  }

  return deletedIds
}

/**
 * Delete albums from specified artists and return deleted IDs. Mutates `albumsMap`.
 *
 * @param {AlbumsMap | Draft<AlbumsMap>} albumsMap
 * @param {string[]} blockedArtists
 */
export function deleteArtists(albumsMap, blockedArtists) {
  if (blockedArtists.length === 0) return []

  /** @type {string[]} */
  const deletedIds = []

  /** @param {Album} album */
  const shouldDelete = (album) => {
    const albumArtists = Object.values(album.artists)
      .flat()
      .concat(album.otherArtists)
      .map((artist) => artist.id)
    const common = intersect([albumArtists, blockedArtists])
    return common.length > 0
  }

  for (const album of Object.values(albumsMap)) {
    if (shouldDelete(album)) {
      deletedIds.push(album.id)
      delete albumsMap[album.id]
    }
  }

  return deletedIds
}

/**
 * Calculate approximate page size based on viewport size
 *
 * @param {number} width
 * @param {number} height
 */
export function calculatePageSize(width, height) {
  const estimate = Math.round((width * height) / 20_000)
  return Math.max(20, Math.min(100, estimate))
}

/**
 * @param {string | null | undefined} value
 */
export function sanitizeCsvValue(value) {
  if (value?.match(/[\s,"]/)) return `"${value.replace(/"/g, '""')}"`
  return value ?? ''
}

/**
 * @param {Blob} blob
 * @param {string} name
 */
export function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}