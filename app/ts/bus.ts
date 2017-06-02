/**
 * Event module for the electron app, using a singleton event emitter
 */

import { EventEmitter } from 'events'

// Event types
export const START_WITH_SERVER = 'START_WITH_SERVER'
export const START_WITH_FS = 'START_WITH_FS'
export const RESTART = 'RESTART'

export const SHOW_HELP = 'SHOW_HELP'
export const OPEN_FILES = 'OPEN_FILES'
export const OPEN_TEMPLATE = 'OPEN_TEMPLATE'
export const OPEN_TEMPLATE_MODAL = 'OPEN_TEMPLATE_MODAL'
export const SAVE = 'SAVE'
export const EXPORT = 'EXPORT'

export const FS_READY = 'FS_READY'
export const FS_CHANGED_ASSETS = 'FS_CHANGED_ASSETS'
export const FS_NEW_TEMPLATE = 'FS_NEW_TEMPLATE'

// Event bus
const bus = new EventEmitter()
export default bus
