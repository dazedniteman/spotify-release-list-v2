// src/state/slices/sync.js - Enhanced with stage tracking and affinity data

import {
  authorizeError,
  authorizeFinished,
  authorizeStart,
  setSyncingProgress,
  setSyncStage,
  syncCancel,
  syncError,
  syncFinished,
  syncStart,
  setArtistAffinity,
  syncTopArtistsFinished,
  syncLastFmFinished,
} from 'state/actions'
import { initialState as filtersInitialState } from './filters'

/** @type {Pick<State, 'albums' | 'user' | 'authorizing' | 'syncing' | 'syncingProgress' | 'syncStage' | 'lastSync' | 'lastAutoSync' | 'previousSyncMaxDate' | 'artistAffinity' | 'lastFmData' | 'topArtistsData'>} */
export const initialState = {
  albums: {},
  user: null,
  authorizing: false,
  syncing: false,
  syncingProgress: 0,
  syncStage: null, // { stage: string, progress: number }
  lastSync: null,
  lastAutoSync: null,
  previousSyncMaxDate: null,
  artistAffinity: {}, // Store artist affinity scores
  lastFmData: null, // Store Last.fm sync data
  topArtistsData: null, // Store top artists data
}

/** @param {ActionReducerMapBuilder} builder */
export function bind(builder) {
  builder
    .addCase(authorizeStart, (state) => {
      state.authorizing = true
    })
    .addCase(authorizeFinished, (state) => {
      state.authorizing = false
    })
    .addCase(authorizeError, (state) => {
      state.authorizing = false
    })
    .addCase(syncStart, (state) => {
      state.syncing = true
      state.syncingProgress = 0
      state.syncStage = { stage: 'Starting...', progress: 0 }
      state.filtersVisible = false
      state.editingFavorites = false
      
      // Preserve certain filter settings during sync
      const preservedFilters = {
        excludeVariousArtists: state.filters.excludeVariousArtists,
        excludeRemixes: state.filters.excludeRemixes,
        excludeDuplicates: state.filters.excludeDuplicates,
        highAffinityOnly: state.filters.highAffinityOnly,
      }
      
      state.filters = {
        ...filtersInitialState.filters,
        ...preservedFilters
      }
    })
    .addCase(syncFinished, (state, action) => {
      state.albums = action.payload.albums
      state.user = action.payload.user
      state.previousSyncMaxDate = action.payload.previousSyncMaxDate
      state[action.payload.auto ? 'lastAutoSync' : 'lastSync'] = new Date().toISOString()
      state.syncing = false
      state.syncStage = null
      state.favorites = {}
    })
    .addCase(syncError, (state) => {
      state.syncing = false
      state.syncStage = null
    })
    .addCase(syncCancel, (state) => {
      state.syncing = false
      state.syncStage = null
    })
    .addCase(setSyncingProgress, (state, action) => {
      state.syncingProgress = action.payload
    })
    .addCase(setSyncStage, (state, action) => {
      state.syncStage = action.payload
    })
    .addCase(setArtistAffinity, (state, action) => {
      state.artistAffinity = action.payload
    })
    .addCase(syncTopArtistsFinished, (state, action) => {
      state.topArtistsData = action.payload
      // Merge affinity data
      Object.assign(state.artistAffinity, action.payload.affinity)
    })
    .addCase(syncLastFmFinished, (state, action) => {
      state.lastFmData = action.payload
    })
}
