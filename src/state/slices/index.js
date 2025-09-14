// src/state/slices/index.js - Updated with enhanced slices

import * as favorites from './favorites'
import * as filters from './filters' // This now includes view mode and table sorting
import * as message from './message'
import * as playlist from './playlist'
import * as settings from './settings'
import * as sync from './sync' // This now includes affinity and Last.fm data
import * as update from './update'

const slices = [favorites, filters, message, playlist, settings, sync, update]

export default slices
