// src/state/slices/filters.js - Enhanced with view mode, table sorting, and instant filters

import { 
  resetFilters, 
  setFilters, 
  toggleFiltersVisible,
  setViewMode,
  toggleViewMode,
  setTableSort,
  setInstantArtistFilter,
  addToArtistFilter,
  removeFromArtistFilter,
  clearInstantFilters
} from 'state/actions'

/** @type {Pick<State, 'filtersVisible' | 'filters' | 'viewMode' | 'tableSort' | 'instantFilters'>} */
export const initialState = {
  filtersVisible: false,
  viewMode: 'cards', // 'cards' | 'table'
  tableSort: {
    field: 'releaseDate',
    direction: 'desc'
  },
  instantFilters: {
    artistIds: [],
    excludeArtistIds: []
  },
  filters: {
    groups: [],
    search: '',
    startDate: null,
    endDate: null,
    excludeVariousArtists: false,
    excludeRemixes: false,
    excludeDuplicates: false,
    favoritesOnly: false,
    newOnly: false,
    highAffinityOnly: false, // New filter for smart sorting
  },
}

/** @param {ActionReducerMapBuilder} builder */
export function bind(builder) {
  builder
    .addCase(setFilters, (state, action) => {
      Object.assign(state.filters, action.payload)
    })
    .addCase(resetFilters, (state) => {
      Object.assign(state.filters, initialState.filters)
      state.instantFilters = { ...initialState.instantFilters }
    })
    .addCase(toggleFiltersVisible, (state) => {
      state.filtersVisible = !state.filtersVisible
    })
    .addCase(setViewMode, (state, action) => {
      state.viewMode = action.payload
    })
    .addCase(toggleViewMode, (state) => {
      state.viewMode = state.viewMode === 'cards' ? 'table' : 'cards'
    })
    .addCase(setTableSort, (state, action) => {
      state.tableSort = action.payload
    })
    .addCase(setInstantArtistFilter, (state, action) => {
      state.instantFilters.artistIds = action.payload
    })
    .addCase(addToArtistFilter, (state, action) => {
      const newIds = action.payload.filter(id => !state.instantFilters.artistIds.includes(id))
      state.instantFilters.artistIds.push(...newIds)
    })
    .addCase(removeFromArtistFilter, (state, action) => {
      state.instantFilters.artistIds = state.instantFilters.artistIds.filter(
        id => !action.payload.includes(id)
      )
    })
    .addCase(clearInstantFilters, (state) => {
      state.instantFilters = { ...initialState.instantFilters }
    })
}
