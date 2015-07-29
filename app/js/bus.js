'use strict';

import { EventEmitter } from 'events';

// Event types
export const START_WITH_SERVER = 'START_WITH_SERVER';
export const START_WITH_FS = 'START_WITH_FS';
export const RESTART = 'RESTART';
export const SHOW_HELP = 'SHOW_HELP';
export const OPEN_FILES = 'OPEN_FILES';
export const OPEN_TEMPLATE = 'OPEN_TEMPLATE';
export const SAVE = 'SAVE';
export const EXPORT = 'EXPORT';

// Event bus
const bus = new EventEmitter();
export default bus;
