// src/state/slices/settings.js - Enhanced with Last.fm integration and smart sorting

import { albumsNew } from 'albums'
import { deleteLabels, deleteArtists } from 'helpers'
import { AlbumGroup, ArtistSource, GroupColorSchemes, ReleasesOrder, Theme } from 'enums'
import { getSettingsBlockedLabels, getSettingsBlockedArtists } from 'state/selectors'
import {
  applyLabelBlocklist,
  applyArtistBlocklist,
  setLabelBlocklistHeight,
  setLastSettingsPath,
  setSettings,
} from 'state/actions'

/** @type {Pick<State, 'lastSettingsPath' | 'labelBlocklistHeight' | 'artistAffinity' | 'settings'>} */
export const initialState = {
  lastSettingsPath: null,
  labelBlocklistHeight: null,
  artistAffinity: {}, // New: Store artist affinity scores
  settings: {
    artistSources: [ArtistSource.FOLLOWED],
    minimumSavedTracks: 1,
    groups: Object.values(AlbumGroup),
    groupColors: GroupColorSchemes.DEFAULT,
    days: 30,
    theme: Theme.COMPACT,
    uriLinks: false,
    covers: true,
    autoSync: false,
    autoSyncTime: '08:00',
    notifications: true,
    firstDayOfWeek: 0,
    displayTracks: false,
    fullAlbumData: false,
    displayLabels: false,
    displayPopularity: false,
    labelBlocklist: '',
    artistBlocklist: '',
    releasesOrder: ReleasesOrder.ARTIST,
    trackHistory: true,
    
    // New smart sorting features
    enableSmartSort: false, // Sort releases by user affinity
    smartSortWeight: 70, // How much to weight affinity vs other factors (0-100)
    showAffinityIndicators: true, // Show stars/hearts for high affinity artists
    affinityThreshold: 40, // Minimum affinity score to show indicator
    
    // Last.fm integration
    lastFmEnabled: false,
    lastFmApiKey: '', // User needs to get their own API key
    lastFmUsername: '',
    lastFmWeight: 40, // How much Last.fm data weights in affinity calculation (0-100)
    lastFmSyncEnabled: false, // Auto-sync Last.fm data during refresh
    
    // Advanced discovery features  
    enableSimilarArtists: false, // Show releases from similar artists
    similarArtistsWeight: 20, // Affinity boost for similar artists
    enableGenreFiltering: false, // Filter by Last.fm genres/tags
    preferredGenres: [], // User's preferred genre tags
  },
}

/** @param {ActionReducerMapBuilder} builder */
export function bind(builder) {
  builder
    .addCase(setSettings, (state, action) => {
      Object.assign(state.settings, action.payload)
      
      // If artist blocklist changed, apply it immediately without full refresh
      if (action.payload.artistBlocklist !== undefined) {
        const blockedArtists = getSettingsBlockedArtists(state)
        const deletedIds = deleteArtists(state.albums, blockedArtists)
        for (const id of deletedIds) {
          albumsNew.delete(id)
          delete state.favorites[id]
        }
      }
    })
    .addCase(setLastSettingsPath, (state, action) => {
      state.lastSettingsPath = action.payload
    })
    .addCase(applyLabelBlocklist, (state) => {
      const blockedLabels = getSettingsBlockedLabels(state)
      const deletedIds = deleteLabels(state.albums, blockedLabels)
      for (const id of deletedIds) {
        albumsNew.delete(id)
        delete state.favorites[id]
      }
    })
    .addCase(applyArtistBlocklist, (state) => {
      const blockedArtists = getSettingsBlockedArtists(state)
      const deletedIds = deleteArtists(state.albums, blockedArtists)
      for (const id of deletedIds) {
        albumsNew.delete(id)
        delete state.favorites[id]
      }
    })
    .addCase(setLabelBlocklistHeight, (state, action) => {
      state.labelBlocklistHeight = action.payload
    })
    // New action: Update artist affinity data
    .addCase('setArtistAffinity', (state, action) => {
      state.artistAffinity = action.payload
    })
    // New action: Add Last.fm similar artists to discovery
    .addCase('addSimilarArtists', (state, action) => {
      // This would add similar artists to the user's discovery pool
      // Implementation would be in the sync saga
    })
}