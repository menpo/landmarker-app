// include all our style information
require('../scss/main.scss')

// Polyfill promise if it's not globally definted
if (typeof window.Promise !== 'function') {
  require('es6-promise').polyfill()
}

import { ipcRenderer } from 'electron'

import * as THREE from 'three'
import * as $ from 'jquery'
import * as drop from 'drag-drop'

import Config from '../../landmarker.io/src/ts/app/model/config'
import { KeyboardShortcutsHandler } from '../../landmarker.io/src/ts/app/view/keyboard'
import { notify } from '../../landmarker.io/src/ts/app/view/notification'
import Modal from '../../landmarker.io/src/ts/app/view/modal'
import { App, AppOptions } from '../../landmarker.io/src/ts/app/model/app'
import * as Asset from '../../landmarker.io/src/ts/app/model/asset'
import { Backend, Server } from '../../landmarker.io/src/ts/app/backend'
import * as AssetView from '../../landmarker.io/src/ts/app/view/asset'

import { ReactBridge } from '../../landmarker.io/src/ts/app/view/reactbridge'
import { BackboneViewport } from '../../landmarker.io/src/ts/app/view/bbviewport'

import FSBackend from './fs_backend'
import Intro from './app_intro'
import bus, * as EVENTS from './bus'
import makeMenu from './menu'

let cfg, server, app

// Initialise the app and standard Landmarker.io
function init (backend: Backend, mode: 'image' | 'mesh') {

    unbindIntro()

    THREE.ImageUtils.crossOrigin = ''
    const appInit: AppOptions = { backend, mode }
    app = new App(appInit)

    new ReactBridge(app)

    new AssetView.AssetNameView({model: app})
    new AssetView.AssetIndexView({model: app})

    var bbviewport = new BackboneViewport(document.getElementById('viewportContainer'), app)
    var viewport = bbviewport.viewport

    let prevAsset: Asset.Image | null = null

    app.on('change:asset', function () {
        viewport.removeMeshIfPresent()
        if (prevAsset !== null) {
            // clean up previous asset
            prevAsset.dispose()
        }
        prevAsset = app.asset
    })

    bus.on(EVENTS.FS_CHANGED_ASSETS, function (goToLast) {
        if (app) {
            app._initCollections()
        }
    })

    // Custom collection name
    $('#collectionName').text(app.activeCollection)

    app.on('change:activeCollection', function () {
        $('#collectionName').text(app.activeCollection)
    })

    $('#changeAssets').click(() => {
        if (typeof server.selectAssets === 'function') {
            changeAssets()
        }
    })

    makeMenu()

    bindDragAndDrop()
    const keyboard = new KeyboardShortcutsHandler(app, viewport)
    keyboard.enable()

    ipcRenderer.send('check-for-updates', false)
}

// Show the backend selection screen and bind related events
function bindIntro () {

    Intro.open()
    cfg.clear()

    bus.on(EVENTS.START_WITH_SERVER, function (url) {
        server = new Server(url)
        server.fetchMode().then(function (mode) {
            $('#changeAssets').remove()
            init(server, mode)
        }, function (err) {
            console.log(err)
        })
    })

    bus.on(EVENTS.START_WITH_FS, function (mode) {
        server = new FSBackend(cfg)
        server.setMode(mode)
        server.selectAssets()
    })
}

// Disable events after app has started
function unbindIntro () {
    bus.removeAllListeners(EVENTS.START_WITH_SERVER)
    bus.removeAllListeners(EVENTS.START_WITH_FS)
}

// Bind global events
// ----------------------------------------------------------------------------
//
function _changeAssets () {
    if (server) {
        cfg.clear()
        server.selectAssets()
    }
}

function changeAssets () {
    Modal.confirm(
        'Are you sure you want to change current assets collection ?', _changeAssets)
}

bus.on(EVENTS.RESTART, () => {
    cfg.clear()
    window.location.reload()
})

bus.on(EVENTS.OPEN_FILES, _changeAssets)

bus.on(EVENTS.OPEN_TEMPLATE, function () {

    if (!server && typeof server.pickTemplate !== 'function') {
        return
    }

    server.pickTemplate((name) => {
        app._activeTemplate = name
        app._initTemplates()
    }, function (err) {
        notify({
            type: 'error', msg: 'Error picking template ' + err
        })
    }, true)
})

// Leverage the setup we have in standard landmarker by clicking on existing
// links
bus.on(EVENTS.SAVE, function () {
    if (app && app.landmarks) {
        $('#save').click()
    }
})

bus.on(EVENTS.EXPORT, function () {
    if (app && app.landmarks) {
        $('#download').click()
    }
})

bus.on(EVENTS.SHOW_HELP, function () {
    if (app) {
        app.toggleHelpOverlay()
    }
})

bus.on(EVENTS.FS_NEW_TEMPLATE, function (name) {
    if (app) {
        if (name) {
            app._activeTemplate = name
        }
        app._initTemplates()
    }
})

ipcRenderer.on('cancel-fs-assets-select', function () {
    if (!app) {
        unbindIntro()
        bindIntro()
    }
})

function bindDragAndDrop () {
    if (server instanceof FSBackend) {
        drop('body', server.handleDragDrop.bind(server))
    }
}

bus.on(EVENTS.FS_READY, function () {
    bus.removeAllListeners(EVENTS.FS_READY)
    init(server, server.mode)
})

document.addEventListener('DOMContentLoaded', function () {
    cfg = Config()
    cfg.load()
    Intro.init({cfg})
    bindIntro()
})
