// src/state/selectors.js - Enhanced with smart sorting, table view, and improved filtering

import { createSelector } from 'reselect'
import { createDraftSafeSelector } from '@reduxjs/toolkit'
import moment from 'moment'
import Fuse from 'fuse.js'
import intersect from 'fast_array_intersect'
import last from 'lodash/last'
import isEqual from 'lodash/isEqual'
import escapeRegExp from 'lodash/escapeRegExp'
import orderBy from 'lodash/orderBy'
import { AlbumGroup } from 'enums'
import { includesTruthy, getReleasesBetween, merge, hasVariousArtists, calculateAlbumAffinity } from 'helpers'
import { buildReleases, buildReleasesMap } from 'helpers'
import { albumsNew } from 'albums'
import { initialState } from './reducer'

// ==================== EXISTING SELECTORS ====================

/** @param {State} state */
export const getAuthorizing = (state) => state.authorizing

/** @param {State} state */
export const getUser = (state) => state.user

/** @param {State} state */
export const getSyncing = (state) => state.syncing

/** @param {State} state */
export const getSyncingProgress = (state) => state.syncingProgress

/** @param {State} state */
export const getLastSync = (state) => state.lastSync

/** @param {State} state */
export const getLastAutoSync = (state) => state.lastAutoSync

/** @param {State} state */
export const getPreviousSyncMaxDate = (state) => state.previousSyncMaxDate

/** @param {State} state */
export const getAlbums = (state) => state.albums

/** @param {State} state */
export const getSettings = (state) => state.settings

/** @param {State} state */
export const getPlaylistModalVisible = (state) => state.playlistModalVisible

/** @param {State} state */
export const getUpdatePlaylistModalVisible = (state) => state.updatePlaylistModalVisible

/** @param {State} state */
export const getFiltersVisible = (state) => state.filtersVisible

/** @param {State} state */
export const getMessage = (state) => state.message

/** @param {State} state */
export const getPlaylistForm = (state) => state.playlistForm

/** @param {State} state */
export const getPlaylistResult = (state) => state.playlistResult

/** @param {State} state */
export const getLoadingPlaylists = (state) => state.loadingPlaylists

/** @param {State} state */
export const getCreatingPlaylist = (state) => state.creatingPlaylist

/** @param {State} state */
export const getUpdatingPlaylist = (state) => state.updatingPlaylist

/** @param {State} state */
export const getPlaylists = (state) => state.playlists

/** @param {State} state */
export const getSelectedPlaylistId = (state) => state.selectedPlaylistId

/** @param {State} state */
export const getLastPlaylistsRefresh = (state) => state.lastPlaylistsRefresh

/** @param {State} state */
export const getFilters = (state) => state.filters

/** @param {State} state */
export const getUpdateReady = (state) => state.updateReady

/** @param {State} state */
export const getFavorites = (state) => state.favorites

/** @param {State} state */
export const getEditingFavorites = (state) => state.editingFavorites

/** @param {State} state */
export const getLastSettingsPath = (state) => state.lastSettingsPath

/** @param {State} state */
export const getLabelBlocklistHeight = (state) => state.labelBlocklistHeight

// ==================== NEW SMART SORTING SELECTORS ====================

/** @param {State} state */
export const getArtistAffinity = (state) => state.artistAffinity || {}

/** @param {State} state */
export const getViewMode = (state) => state.viewMode || 'cards'

/** @param {State} state */
export const getTableSort = (state) => state.tableSort || { field: 'releaseDate', direction: 'desc' }

// Individual settings selectors (existing)
export const getSettingsArtistSources = createSelector(
  getSettings,
  (settings) => settings.artistSources
)
export const getSettingsGroups = createSelector(getSettings, (settings) => settings.groups)
export const getSettingsGroupColors = createSelector(
  getSettings,
  (settings) => settings.groupColors
)
export const getSettingsDays = createSelector(getSettings, (settings) => settings.days)
export const getSettingsTheme = createSelector(getSettings, (settings) => settings.theme)
export const getSettingsUriLinks = createSelector(getSettings, (settings) => settings.uriLinks)
export const getSettingsCovers = createSelector(getSettings, (settings) => settings.covers)
export const getSettingsReleasesOrder = createSelector(
  getSettings,
  (settings) => settings.releasesOrder
)
export const getSettingsTrackHistory = createSelector(
  getSettings,
  (settings) => settings.trackHistory
)

// New smart sorting settings selectors
export const getSettingsEnableSmartSort = createSelector(
  getSettings,
  (settings) => settings.enableSmartSort || false
)
export const getSettingsSmartSortWeight = createSelector(
  getSettings,
  (settings) => settings.smartSortWeight || 70
)
export const getSettingsShowAffinityIndicators = createSelector(
  getSettings,
  (settings) => settings.showAffinityIndicators !== false
)
export const getSettingsAffinityThreshold = createSelector(
  getSettings,
  (settings) => settings.affinityThreshold || 40
)

// Last.fm settings selectors
export const getSettingsLastFmEnabled = createSelector(
  getSettings,
  (settings) => settings.lastFmEnabled || false
)
export const getSettingsLastFmApiKey = createSelector(
  getSettings,
  (settings) => settings.lastFmApiKey || ''
)
export const getSettingsLastFmUsername = createSelector(
  getSettings,
  (settings) => settings.lastFmUsername || ''
)
export const getSettingsLastFmWeight = createSelector(
  getSettings,
  (settings) => settings.lastFmWeight || 40
)
export const getSettingsLastFmSyncEnabled = createSelector(
  getSettings,
  (settings) => settings.lastFmSyncEnabled || false
)

export const getSettingsLabelBlocklist = createSelector(
  getSettings,
  (settings) => settings.labelBlocklist
)

export const getSettingsBlockedLabels = createSelector(getSettingsLabelBlocklist, (blocklist) => {
  /** @type {BlockedLabels} */
  const labels = {}
  const matches = blocklist.matchAll(/^\s*(?:\*(\S*)\*)?\s*(.*?)\s*$/gm)
  for (const [, flags, label] of matches) {
    labels[label] = flags?.split(',')
  }
  return labels
})

export const getSettingsArtistBlocklist = createSelector(
  getSettings,
  (settings) => settings.artistBlocklist
)

export const getSettingsBlockedArtists = createSelector(getSettingsArtistBlocklist, (blocklist) => {
  /** @type {string[]} */
  const artistIds = []
  const matches = blocklist.matchAll(/^\s*([a-zA-Z0-9]{22})\s*$/gm)
  for (const match of matches) artistIds.push(match[1])
  return artistIds
})

// Individual filters selectors
export const getFiltersGroups = createSelector(getFilters, (filters) => filters.groups)
export const getFiltersSearch = createSelector(getFilters, (filters) => filters.search)
export const getFiltersStartDate = createSelector(getFilters, (filters) => filters.startDate)
export const getFiltersEndDate = createSelector(getFilters, (filters) => filters.endDate)
export const getFiltersExcludeVariousArtists = createSelector(
  getFilters,
  (filters) => filters.excludeVariousArtists
)
export const getFiltersExcludeRemixes = createSelector(
  getFilters,
  (filters) => filters.excludeRemixes
)
export const getFiltersExcludeDuplicates = createSelector(
  getFilters,
  (filters) => filters.excludeDuplicates
)
export const getFiltersFavoritesOnly = createSelector(
  getFilters,
  (filters) => filters.favoritesOnly
)
export const getFiltersNewOnly = createSelector(getFilters, (filters) => filters.newOnly)
export const getFiltersHighAffinityOnly = createSelector(getFilters, (filters) => filters.highAffinityOnly || false)

/**
 * Get relevant app data.
 *
 * @param {State} state
 */
const getAppData = createSelector(getLastSync, getSettings, (...values) => values)

/**
 * Check if any relevant app data exist. This is used to determine visibility
 * of the "Delete app data" button.
 *
 * @param {State} state
 */
export const getHasAppData = createSelector(
  getAppData,
  (appData) => !isEqual(appData, getAppData(initialState))
)

/**
 * Check if there is any async work being done
 */
export const getWorking = createSelector(
  [getSyncing, getCreatingPlaylist, getAuthorizing],
  (...values) => includesTruthy(values)
)

/**
 * Check if any filter is applied
 */
export const getFiltersApplied = createSelector(
  getFiltersGroups,
  getFiltersSearch,
  getFiltersStartDate,
  getFiltersEndDate,
  getFiltersExcludeVariousArtists,
  getFiltersExcludeRemixes,
  getFiltersExcludeDuplicates,
  getFiltersFavoritesOnly,
  getFiltersNewOnly,
  getFiltersHighAffinityOnly,
  (groups, ...rest) => Boolean(groups.length) || includesTruthy(rest)
)

/**
 * Get last sync as Date instance
 */
export const getLastSyncDate = createSelector(
  [getLastSync, getLastAutoSync],
  (lastSync, lastAutoSync) => {
    if (lastSync || lastAutoSync) {
      const newer = (lastSync || '') > (lastAutoSync || '') ? lastSync : lastAutoSync
      return new Date(newer)
    }

    return null
  }
)

/**
 * Get all albums / releases as an array
 */
export const getAlbumsArray = createSelector(getAlbums, (albums) => Object.values(albums))

/**
 * Enhanced albums array with affinity scores
 */
export const getAlbumsArrayWithAffinity = createSelector(
  [getAlbumsArray, getArtistAffinity, getSettingsShowAffinityIndicators],
  (albums, artistAffinity, showIndicators) => {
    if (!showIndicators || Object.keys(artistAffinity).length === 0) {
      return albums.map(album => ({ ...album, affinityScore: 0, affinityCategory: 'none' }))
    }
    
    return albums.map(album => {
      const affinityScore = calculateAlbumAffinity(album, artistAffinity)
      const affinityCategory = getAffinityCategory(affinityScore)
      
      return {
        ...album,
        affinityScore,
        affinityCategory
      }
    })
  }
)

/**
 * Get affinity category for UI display
 */
function getAffinityCategory(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'  
  if (score >= 10) return 'low'
  return 'none'
}

/**
 * Get all releases as a map with release dates as keys (using enhanced albums)
 */
export const getOriginalReleasesMap = createSelector(getAlbumsArrayWithAffinity, buildReleasesMap)

/**
 * Enhanced releases with smart sorting support
 */
const getOriginalReleases = createSelector(
  [
    getOriginalReleasesMap, 
    getSettingsReleasesOrder, 
    getSettingsEnableSmartSort, 
    getArtistAffinity, 
    getSettingsSmartSortWeight
  ],
  (releasesMap, releasesOrder, enableSmartSort, artistAffinity, smartSortWeight) => 
    buildReleases(releasesMap, releasesOrder, enableSmartSort, artistAffinity, smartSortWeight)
)

/**
 * Check if there are any releases
 */
export const getHasOriginalReleases = createSelector(getOriginalReleases, (releases) =>
  Boolean(releases.length)
)

/**
 * Get earliest date in current releases collection
 */
export const getReleasesMinDate = createSelector(getOriginalReleases, (releases) =>
  releases.length ? last(releases).date : null
)

/**
 * Get latest date in current releases collection
 */
export const getReleasesMaxDate = createSelector(getOriginalReleases, (releases) =>
  releases.length ? releases[0].date : null
)

/**
 * Get earliest and latest dates as Moment instances
 */
export const getReleasesMinMaxDates = createSelector(
  [getReleasesMinDate, getReleasesMaxDate],
  (minDate, maxDate) => minDate && maxDate && { minDate: moment(minDate), maxDate: moment(maxDate) }
)

/**
 * Get date range filter dates as Moment instances
 */
export const getFiltersDates = createSelector(
  [getFiltersStartDate, getFiltersEndDate],
  (startDate, endDate) =>
    startDate && endDate && { startDate: moment(startDate), endDate: moment(endDate) }
)

/**
 * Get all releases as a map with album groups as keys
 */
export const getReleasesGroupMap = createSelector(getAlbumsArrayWithAffinity, (albums) =>
  albums.reduce((map, album) => {
    const albumMap = Object.keys(album.artists).reduce((albumMap, group) => {
      albumMap[group] = [album.id]
      return albumMap
    }, /** @type {ReleasesGroupMap} */ ({}))

    return merge(map, albumMap)
  }, /** @type {ReleasesGroupMap} */ ({}))
)

/**
 * Get current Fuse.js instance (enhanced with affinity data)
 */
const getFuseInstance = createSelector(
  getAlbumsArrayWithAffinity,
  (albums) =>
    new Fuse(albums, {
      threshold: 0.1,
      keys: Object.values(AlbumGroup)
        .map((group) => `artists.${group}.name`)
        .concat('name', 'label'),
    })
)

/**
 * Get all non-"Various Artists" album IDs
 */
const getNonVariousArtistsAlbumIds = createSelector(getAlbumsArrayWithAffinity, (albums) =>
  albums.reduce((ids, album) => {
    if (!hasVariousArtists(album)) ids.push(album.id)
    return ids
  }, /** @type {string[]} */ ([]))
)

/**
 * Get all non-"Remix" album IDs
 */
const getNonRemixAlbumIds = createSelector(getAlbumsArrayWithAffinity, (albums) =>
  albums.reduce((ids, album) => {
    if (!/remix/i.test(album.name)) ids.push(album.id)
    return ids
  }, /** @type {string[]} */ ([]))
)

/**
 * Get album IDs with duplicates removed
 */
const getNoDuplicatesAlbumIds = createSelector(getOriginalReleases, (releases) => {
const charsMap = { '[': '(', ']': ')' };
const escapedChars = escapeRegExp(Object.keys(charsMap).join(''));
const charsRegex = new RegExp(`([${escapedChars}])`, 'g');

  return releases.reduce((ids, { albums }) => {
    /** @type {Record<string, string>} */
    const namesMap = {}

    for (const album of albums) {
      const unifiedName = album.name.replace(charsRegex, (key) => charsMap[key]).toLowerCase()
      if (unifiedName in namesMap) continue
      namesMap[unifiedName] = album.id
    }

    return ids.concat(Object.values(namesMap))
  }, /** @type {string[]} */ ([]))
})

/**
 * Get favorite album ids
 */
const getFavoriteAlbumIds = createSelector(getFavorites, (favorites) =>
  Object.entries(favorites).reduce((ids, [id, selected]) => {
    if (selected) ids.push(id)
    return ids
  }, [])
)

/**
 * Get new album ids
 */
const getNewAlbumIds = createSelector(getAlbumsArrayWithAffinity, (albums) =>
  albums.filter((album) => albumsNew.has(album.id)).map((album) => album.id)
)

/**
 * Get high-affinity album IDs (new filter option)
 */
const getHighAffinityAlbumIds = createSelector(
  [getAlbumsArrayWithAffinity, getSettingsAffinityThreshold],
  (albums, threshold) =>
    albums
      .filter((album) => album.affinityScore >= threshold)
      .map((album) => album.id)
)

/**
 * Get album IDs based on search filter
 */
const getSearchFiltered = createSelector(
  [getFiltersSearch, getFuseInstance],
  (query, fuse) => query && fuse.search(query.trim()).map((result) => result.item.id)
)

/**
 * Get album IDs based on date range filter
 */
const getDateRangeFiltered = createSelector(
  [getFiltersDates, getOriginalReleasesMap],
  (dates, releasesMap) => dates && getReleasesBetween(releasesMap, dates.startDate, dates.endDate)
)

/**
 * Get album IDs based on album groups filter
 */
const getAlbumGroupsFiltered = createSelector(
  [getFiltersGroups, getReleasesGroupMap],
  (groups, groupMap) =>
    groups.length &&
    groups.reduce((ids, group) => ids.concat(groupMap[group]), /** @type {string[]} */ ([]))
)

/**
 * Get album IDs based on Various Artists filter
 */
const getVariousArtistsFiltered = createSelector(
  [getFiltersExcludeVariousArtists, getNonVariousArtistsAlbumIds],
  (exclude, ids) => exclude && ids
)

/**
 * Get album IDs based on remix filter
 */
const getRemixFiltered = createSelector(
  [getFiltersExcludeRemixes, getNonRemixAlbumIds],
  (exclude, ids) => exclude && ids
)

/**
 * Get albums IDs based on duplicates filter
 */
const getDuplicatesFiltered = createSelector(
  [getFiltersExcludeDuplicates, getNoDuplicatesAlbumIds],
  (exclude, ids) => exclude && ids
)

/**
 * Get favorite album ids based on favorites filter
 */
const getFavoritesFiltered = createSelector(
  [getFiltersFavoritesOnly, getFavoriteAlbumIds],
  (favoritesOnly, ids) => favoritesOnly && ids
)

/**
 * Get new album ids if new filter and history tracking are enabled
 */
const getNewFiltered = createSelector(
  [getSettingsTrackHistory, getFiltersNewOnly, getNewAlbumIds],
  (trackHistory, newOnly, ids) => trackHistory && newOnly && ids
)

/**
 * Get high affinity album ids based on filter
 */
const getHighAffinityFiltered = createSelector(
  [getFiltersHighAffinityOnly, getHighAffinityAlbumIds],
  (highAffinityOnly, ids) => highAffinityOnly && ids
)

/**
 * Intersect all filtered results and return albums as an array
 */
export const getFilteredAlbumsArray = createSelector(
  getAlbums,
  getSearchFiltered,
  getDateRangeFiltered,
  getAlbumGroupsFiltered,
  getVariousArtistsFiltered,
  getRemixFiltered,
  getDuplicatesFiltered,
  getFavoritesFiltered,
  getNewFiltered,
  getHighAffinityFiltered,
  (albums, ...filtered) => {
    const validFilters = filtered.filter(Array.isArray)
    if (validFilters.length === 0) return Object.values(albums)
    
    return intersect(validFilters).map((id) => albums[id]).filter(Boolean)
  }
)

/**
 * Get filtered releases as a map with release dates as keys
 */
const getFilteredReleasesMap = createSelector(getFilteredAlbumsArray, buildReleasesMap)

/**
 * Get filtered releases as ordered array of { date, albums } objects
 */
const getFilteredReleases = createSelector(
  [getFilteredReleasesMap, getSettingsReleasesOrder, getSettingsEnableSmartSort, getArtistAffinity, getSettingsSmartSortWeight],
  (releasesMap, releasesOrder, enableSmartSort, artistAffinity, smartSortWeight) => 
    buildReleases(releasesMap, releasesOrder, enableSmartSort, artistAffinity, smartSortWeight)
)

/**
 * Final releases selector that returns either filtered or original releases
 */
export const getReleases = createSelector(
  [getFiltersApplied, getFilteredReleases, getOriginalReleases],
  (filtersApplied, filtered, original) => (filtersApplied ? filtered : original)
)

/**
 * Get final releases array (flat list for table view)
 */
export const getReleasesArray = createDraftSafeSelector(
  [getFiltersApplied, getFilteredAlbumsArray, getAlbumsArrayWithAffinity],
  (filtersApplied, filtered, original) => (filtersApplied ? filtered : original)
)

/**
 * Get table-sorted releases array
 */
export const getTableSortedReleases = createSelector(
  [getReleasesArray, getTableSort],
  (albums, tableSort) => {
    if (!albums || albums.length === 0) return []
    
    const { field, direction } = tableSort
    
    const sortFunction = (album) => {
      switch (field) {
        case 'artist':
          return Object.values(album.artists).flat()[0]?.name?.toLowerCase() || ''
        case 'album':
          return album.name.toLowerCase()
        case 'releaseDate':
          return album.releaseDate
        case 'affinity':
          return album.affinityScore || 0
        case 'totalTracks':
          return album.totalTracks
        case 'popularity':
          return album.popularity || 0
        default:
          return album.releaseDate
      }
    }
    
    return orderBy(albums, [sortFunction], [direction])
  }
)

/**
 * Check if there are any releases currently displayed
 */
export const getHasReleases = createSelector(getReleasesArray, (albums) => Boolean(albums.length))

/**
 * Get final releases track count
 */
export const getReleasesTrackCount = createSelector(getReleasesArray, (albums) =>
  albums.reduce((count, album) => count + album.totalTracks, 0)
)

/** @param {State} state */
export const getAnyModalVisible = createSelector(
  [getPlaylistModalVisible, getUpdatePlaylistModalVisible],
  (...values) => includesTruthy(values)
)
