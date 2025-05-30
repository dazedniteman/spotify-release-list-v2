// src/sagas/sync.js - Enhanced with top artists and Last.fm integration

import moment from 'moment'
import chunk from 'lodash/chunk'
import { call, put, select, take, race, delay, fork, cancel } from 'redux-saga/effects'
import { ArtistSource, MomentFormat } from 'enums'
import {
  getArtistAlbums,
  getFullAlbums,
  getUser,
  getUserFollowedArtistsPage,
  getUserSavedAlbumsPage,
  getUserSavedTracksPage,
  getUserTopArtistsCombined,
  LastFmApi,
  ArtistAffinityCalculator,
} from 'api'
import { getAuthData, getSyncScopes } from 'auth'
import { buildAlbumsMap, buildArtist, deleteArtists, deleteLabels, mergeAlbumsRaw } from 'helpers'
import { albumsNew, albumsHistory } from 'albums'
import {
  getSettings,
  getReleasesMaxDate,
  getSettingsBlockedArtists,
  getSettingsBlockedLabels,
} from 'state/selectors'
import {
  setFilters,
  setSyncingProgress,
  showErrorMessage,
  syncAnimationFinished,
  syncError,
  syncFinished,
  syncStart,
  setArtistAffinity,
  syncTopArtistsFinished,
  syncLastFmFinished,
} from 'state/actions'
import { authorize } from './auth'
import { withTitle } from './helpers'
import { getAllCursorPaged, getAllPaged, putRequestMessage, setupWorkers } from './request'

const { ISO_DATE } = MomentFormat
const { FOLLOWED, SAVED_ALBUMS, SAVED_TRACKS } = ArtistSource

/**
 * How much percentage of overall progress is assigned to base sync when extra data fetch is enabled
 */
const BASE_SYNC_RATIO = 0.6 // Reduced to account for top artists and Last.fm sync

/**
 * Synchronization saga with enhanced features
 *
 * @param {SyncAction} action
 */
export function* syncSaga(action) {
  try {
    /** @type {ReturnType<typeof getSettings>} */
    const { artistSources } = yield select(getSettings)
    /** @type {ReturnType<typeof getSyncScopes>} */
    const scopes = yield call(getSyncScopes, artistSources)

    /** @type {ReturnType<typeof withTitle>} */
    const titled = yield call(withTitle, 'Loading...', syncMainSaga, action)
    /** @type {ReturnType<typeof authorize>} */
    const authorized = yield call(authorize, action, scopes, titled)

    yield call(authorized)
  } catch (error) {
    yield put(showErrorMessage(error.message ?? error.toString()))
    yield put(syncError())
  }
}

/**
 * Main synchronization saga with smart features
 *
 * @param {SyncAction} action
 */
function* syncMainSaga(action) {
  yield put(syncStart())

  /** @type {ReturnType<typeof getAuthData>} */
  const { token } = yield call(getAuthData)
  /** @type {ReturnType<typeof getSettings>} */
  const { 
    days, 
    fullAlbumData, 
    trackHistory,
    enableSmartSort,
    lastFmEnabled,
    lastFmApiKey,
    lastFmUsername,
    lastFmSyncEnabled,
    lastFmWeight
  } = yield select(getSettings)
  
  /** @type {ReturnType<typeof getSettingsBlockedLabels>} */
  const blockedLabels = yield select(getSettingsBlockedLabels)
  /** @type {ReturnType<typeof getSettingsBlockedArtists>} */
  const blockedArtists = yield select(getSettingsBlockedArtists)
  /** @type {ReturnType<typeof getReleasesMaxDate>} */
  const previousSyncMaxDate = yield select(getReleasesMaxDate)
  const minDate = moment().subtract(days, 'day').format(ISO_DATE)

  /** @type {RequestWorkers} */
  const { workers, requestChannel, responseChannel, workersFork } = yield call(setupWorkers)
  yield fork(workersFork)

  // Step 1: Get basic user and artist data
  /** @type {Await<ReturnType<typeof getUser>>} */
  const user = yield call(getUser, token)
  /** @type {Artist[]} */
  const artists = yield call(getArtists, requestChannel, responseChannel, workers.length)

  // Step 2: Sync top artists if smart sorting is enabled (15% of progress)
  let artistAffinity = {}
  if (enableSmartSort) {
    yield put(setSyncingProgress(10))
    try {
      /** @type {Await<ReturnType<typeof getUserTopArtistsCombined>>} */
      const topArtistsData = yield call(getUserTopArtistsCombined, token)
      artistAffinity = topArtistsData.affinity
      
      yield put(syncTopArtistsFinished({
        artists: topArtistsData.artists,
        affinity: artistAffinity
      }))
      
      console.log(`✅ Synced ${Object.keys(artistAffinity).length} top artists for smart sorting`)
    } catch (error) {
      console.warn('Failed to sync top artists:', error)
      // Continue without smart sorting
    }
  }

  // Step 3: Sync Last.fm data if enabled (additional 10% of progress)
  let lastFmArtists = []
  if (lastFmEnabled && lastFmApiKey && lastFmUsername && lastFmSyncEnabled) {
    yield put(setSyncingProgress(20))
    try {
      const lastFm = new LastFmApi(lastFmApiKey)
      lastFmArtists = yield call([lastFm, 'getUserTopArtists'], lastFmUsername, 'overall', 500)
      
      yield put(syncLastFmFinished({
        username: lastFmUsername,
        artists: lastFmArtists
      }))
      
      console.log(`✅ Synced ${lastFmArtists.length} Last.fm artists`)
    } catch (error) {
      console.warn('Failed to sync Last.fm data:', error)
      // Continue without Last.fm data
    }
  }

  // Step 4: Create enhanced affinity calculator
  const affinityCalculator = new ArtistAffinityCalculator(
    artistAffinity,
    lastFmArtists,
    lastFmUsername
  )

  // Step 5: Sync album data (60% of progress)
  yield put(setSyncingProgress(30))
  /** @type {AlbumRaw[]} */
  const albumsRaw = yield call(syncBaseData, artists, requestChannel, responseChannel)
  /** @type {Await<ReturnType<typeof mergeAlbumsRaw>>} */
  const mergedAlbums = yield call(mergeAlbumsRaw, albumsRaw, minDate)
  /** @type {Await<ReturnType<typeof buildAlbumsMap>>} */
  const albums = yield call(buildAlbumsMap, mergedAlbums, artists)
  
  // Apply blocklists
  yield call(deleteArtists, albums, blockedArtists)

  // Step 6: Sync extra album data if enabled (25% of progress)
  if (fullAlbumData) {
    yield call(syncExtraData, albums, requestChannel, responseChannel)
    yield call(deleteLabels, albums, blockedLabels)
  }

  // Step 7: Update combined affinity scores for all albums
  if (enableSmartSort || lastFmEnabled) {
    const enhancedAffinity = {}
    
    Object.values(albums).forEach(album => {
      const allArtists = Object.values(album.artists).flat().concat(album.otherArtists)
      
      allArtists.forEach(artist => {
        if (!enhancedAffinity[artist.id]) {
          enhancedAffinity[artist.id] = affinityCalculator.getAffinityScore(artist.id, artist.name)
        }
      })
    })
    
    yield put(setArtistAffinity(enhancedAffinity))
    console.log(`✅ Calculated affinity for ${Object.keys(enhancedAffinity).length} artists`)
  }

  // Step 8: Update history tracking
  if (trackHistory) {
    yield call(updateHistory, albums)
  }

  yield cancel(workers)
  yield put(setSyncingProgress(100))
  yield race([take(syncAnimationFinished.type), delay(1000)])
  yield put(syncFinished({ albums, user, previousSyncMaxDate, auto: action.payload?.auto }))
}

/**
 * Get artists based on selected sources
 *
 * @param {RequestChannel} requestChannel
 * @param {ResponseChannel} responseChannel
 * @param {number} workersCount
 */
function* getArtists(requestChannel, responseChannel, workersCount) {
  /** @type {ReturnType<typeof getSettings>} */
  const { artistSources } = yield select(getSettings)
  /** @type {ReturnType<typeof getSettingsBlockedArtists>} */
  const blockedArtists = yield select(getSettingsBlockedArtists)
  /** @type {Artist[]} */
  const allArtists = []
  /** @type {Record<string, Artist>} */
  const artists = {}

  if (artistSources.includes(FOLLOWED)) {
    /** @type {Artist[]} */
    const artists = yield call(getUserFollowedArtists, requestChannel, responseChannel)
    for (const artist of artists) allArtists.push(artist)
  }

  if (artistSources.includes(SAVED_TRACKS)) {
    /** @type {Artist[]} */
    const artists = yield call(
      getUserSavedTracksArtists,
      requestChannel,
      responseChannel,
      workersCount
    )
    for (const artist of artists) allArtists.push(artist)
  }

  if (artistSources.includes(SAVED_ALBUMS)) {
    /** @type {Artist[]} */
    const artists = yield call(
      getUserSavedAlbumsArtists,
      requestChannel,
      responseChannel,
      workersCount
    )
    for (const artist of artists) allArtists.push(artist)
  }

  for (const artist of allArtists) {
    if (artist.id in artists) continue
    if (blockedArtists.includes(artist.id)) continue
    artists[artist.id] = artist
  }

  return Object.values(artists)
}

/**
 * Fetch base album data with enhanced progress tracking
 *
 * @param {Artist[]} artists
 * @param {RequestChannel} requestChannel
 * @param {ResponseChannel} responseChannel
 */
function* syncBaseData(artists, requestChannel, responseChannel) {
  /** @type {AlbumRaw[]} */
  const albumsRaw = []
  /** @type {ReturnType<typeof getAuthData>} */
  const { token } = yield call(getAuthData)
  /** @type {ReturnType<typeof getSettings>} */
  const { groups, fullAlbumData } = yield select(getSettings)

  for (const artist of artists)
    yield putRequestMessage(requestChannel, [getArtistAlbums, token, artist.id, groups])

  const baseProgress = 30 // Starting progress
  const maxProgress = fullAlbumData ? 60 : 90 // End progress depending on whether we do extra data

  for (let fetched = 0; fetched < artists.length; fetched += 1) {
    /** @type {ResponseChannelMessage<Await<ReturnType<typeof getArtistAlbums>>>} */
    const response = yield take(responseChannel)

    const progress = baseProgress + ((fetched + 1) / artists.length) * (maxProgress - baseProgress)
    yield put(setSyncingProgress(progress))

    if (response.error) continue
    for (const album of response.result) albumsRaw.push(album)
  }

  return albumsRaw
}

/**
 * Fetch extra album data with enhanced progress tracking
 *
 * @param {AlbumsMap} albums
 * @param {RequestChannel} requestChannel
 * @param {ResponseChannel} responseChannel
 */
function* syncExtraData(albums, requestChannel, responseChannel) {
  /** @type {ReturnType<typeof getAuthData>} */
  const { token } = yield call(getAuthData)
  const albumIdsChunks = chunk(Object.keys(albums), 20)

  for (const albumIdsChunk of albumIdsChunks)
    yield putRequestMessage(requestChannel, [getFullAlbums, token, albumIdsChunk])

  const baseProgress = 60 // Starting progress
  const maxProgress = 90 // End progress

  for (let fetched = 0; fetched < albumIdsChunks.length; fetched += 1) {
    /** @type {ResponseChannelMessage<Await<ReturnType<typeof getFullAlbums>>>} */
    const response = yield take(responseChannel)

    const progress = baseProgress + ((fetched + 1) / albumIdsChunks.length) * (maxProgress - baseProgress)
    yield put(setSyncingProgress(progress))

    if (response.error) continue

    for (const albumFull of response.result) {
      const { id, label, popularity } = albumFull
      Object.assign(albums[id], { label, popularity })
    }
  }
}

/**
 * @param {RequestChannel} requestChannel
 * @param {ResponseChannel} responseChannel
 */
function* getUserFollowedArtists(requestChannel, responseChannel) {
  /** @type {SpotifyArtist[]} */
  const artists = yield call(
    getAllCursorPaged,
    getUserFollowedArtistsPage,
    requestChannel,
    responseChannel
  )

  return artists.map(buildArtist)
}

/**
 * @param {RequestChannel} requestChannel
 * @param {ResponseChannel} responseChannel
 * @param {number} workersCount
 */
function* getUserSavedTracksArtists(requestChannel, responseChannel, workersCount) {
  /** @type {ReturnType<typeof getSettings>} */
  const { minimumSavedTracks } = yield select(getSettings)
  /** @type {Record<string, { count: number; artist: Artist}>} */
  const artists = {}

  /** @type {SpotifySavedTrack[]} */
  const tracks = yield call(
    getAllPaged,
    getUserSavedTracksPage,
    requestChannel,
    responseChannel,
    workersCount
  )

  for (const item of tracks) {
    for (const artist of item.track.artists) {
      if (artist.id in artists) {
        artists[artist.id].count++
        continue
      }

      artists[artist.id] = { count: 1, artist }
    }
  }

  return Object.values(artists)
    .filter(({ count }) => count >= minimumSavedTracks)
    .map(({ artist }) => buildArtist(artist))
}

/**
 * @param {RequestChannel} requestChannel
 * @param {ResponseChannel} responseChannel
 * @param {number} workersCount
 */
function* getUserSavedAlbumsArtists(requestChannel, responseChannel, workersCount) {
  /** @type {Record<string, Artist>} */
  const artists = {}

  /** @type {SpotifySavedAlbum[]} */
  const albums = yield call(
    getAllPaged,
    getUserSavedAlbumsPage,
    requestChannel,
    responseChannel,
    workersCount
  )

  for (const item of albums) {
    for (const artist of item.album.artists) {
      if (artist.id in artists) continue
      artists[artist.id] = artist
    }
  }

  return Object.values(artists).map(buildArtist)
}

/** @param {AlbumsMap} albums */
function* updateHistory(albums) {
  albumsHistory.append(albumsNew)
  yield call(albumsNew.clear)

  for (const id of Object.keys(albums)) {
    if (albumsHistory.has(id)) continue
    albumsNew.add(id)
  }

  yield call(albumsNew.persist)
  yield call(albumsHistory.persist)

  if (albumsNew.size > 0 && albumsHistory.size > 0) {
    yield put(setFilters({ newOnly: true }))
  }
}

/**
 * Saga for syncing just top artists data (can be called independently)
 */
export function* syncTopArtistsSaga() {
  try {
    /** @type {ReturnType<typeof getAuthData>} */
    const { token } = yield call(getAuthData)
    
    /** @type {Await<ReturnType<typeof getUserTopArtistsCombined>>} */
    const topArtistsData = yield call(getUserTopArtistsCombined, token)
    
    yield put(setArtistAffinity(topArtistsData.affinity))
    yield put(syncTopArtistsFinished({
      artists: topArtistsData.artists,
      affinity: topArtistsData.affinity
    }))
    
    console.log(`✅ Independently synced ${Object.keys(topArtistsData.affinity).length} top artists`)
  } catch (error) {
    console.error('Failed to sync top artists:', error)
    yield put(showErrorMessage('Failed to sync listening preferences'))
  }
}

/**
 * Saga for syncing just Last.fm data (can be called independently)
 */
export function* syncLastFmSaga() {
  try {
    /** @type {ReturnType<typeof getSettings>} */
    const { lastFmApiKey, lastFmUsername } = yield select(getSettings)
    
    if (!lastFmApiKey || !lastFmUsername) {
      throw new Error('Last.fm credentials not configured')
    }
    
    const lastFm = new LastFmApi(lastFmApiKey)
    const lastFmArtists = yield call([lastFm, 'getUserTopArtists'], lastFmUsername, 'overall', 500)
    
    yield put(syncLastFmFinished({
      username: lastFmUsername,
      artists: lastFmArtists
    }))
    
    console.log(`✅ Independently synced ${lastFmArtists.length} Last.fm artists`)
  } catch (error) {
    console.error('Failed to sync Last.fm data:', error)
    yield put(showErrorMessage(`Failed to sync Last.fm data: ${error.message}`))
  }
}