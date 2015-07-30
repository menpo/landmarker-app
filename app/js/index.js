'use strict';

import ipc from 'ipc';

import THREE from 'three';
import $ from 'jquery';
import drop from 'drag-drop';

import Config from '../../landmarker.io/src/js/app/model/config';
import KSH from '../../landmarker.io/src/js/app/view/keyboard';
import {
    notify,
    AssetLoadingNotification
} from '../../landmarker.io/src/js/app/view/notification';
import Modal from '../../landmarker.io/src/js/app/view/modal';
import App from '../../landmarker.io/src/js/app/model/app';
import Server from '../../landmarker.io/src/js/app/backend/server';
import HelpOverlay from '../../landmarker.io/src/js/app/view/help';
import * as AssetView from '../../landmarker.io/src/js/app/view/asset';
import SidebarView from '../../landmarker.io/src/js/app/view/sidebar';
import ToolbarView from '../../landmarker.io/src/js/app/view/toolbar';
import ViewportView from '../../landmarker.io/src/js/app/view/viewport';

import FSBackend from './fs_backend';
import Intro from './app_intro';
import bus, * as EVENTS from './bus';
import makeMenu from './menu';

let cfg, server, app, viewport;

// Initialise the app and standard Landmarker.io
function init (server, mode) {

    unbindIntro();

    THREE.ImageUtils.crossOrigin = '';
    app = new App({server, mode});

    new AssetLoadingNotification({model: app});
    new SidebarView({model: app});
    new AssetView.AssetPagerView({model: app});
    new AssetView.AssetNameView({model: app});
    new AssetView.AssetIndexView({model: app});
    new ToolbarView({model: app});
    new HelpOverlay({model: app});

    viewport = new ViewportView({model: app});

    let prevAsset = null;

    app.on('change:asset', function () {
        viewport.removeMeshIfPresent();
        if (prevAsset !== null) {
            // clean up previous asset
            prevAsset.dispose();
        }
        prevAsset = app.asset();
    });

    bus.on(EVENTS.FS_CHANGED_ASSETS, function (goToLast) {
        if (app) {
            app._initCollections();
        }
    });

    $('#collectionName').text(app.get('activeCollection'));
    app.on('change:activeCollection', function () {
        $('#collectionName').text(app.get('activeCollection'));
    });

    makeMenu();

    bindDragAndDrop();
    (new KSH(app, viewport)).enable();
}

// Show the backend selection screen and bind related events
function bindIntro () {

    Intro.open();
    cfg.clear();

    bus.on(EVENTS.START_WITH_SERVER, function (url) {
        server = new Server(url);
        server.fetchMode().then(function (mode) {
            $('#changeAssets').remove();
            init(server, mode);
        }, function (err) {
            console.log(err);
        })
    });

    bus.on(EVENTS.START_WITH_FS, function (mode) {
        server = new FSBackend(cfg);
        server.setMode(mode);
        $('#changeAssets').click(changeAssets);
        server.selectAssets()
    });
}

// Disable events after app has started
function unbindIntro () {
    bus.removeAllListeners(EVENTS.START_WITH_SERVER);
    bus.removeAllListeners(EVENTS.START_WITH_FS);
}

// Bind global events
// ----------------------------------------------------------------------------
//
function _changeAssets () {
    if (server) {
        cfg.clear();
        server.selectAssets();
    }
}

function changeAssets () {
    Modal.confirm(
        'Are you sure you want to change current assets collection ?', _changeAssets);
}

bus.on(EVENTS.RESTART, () => window.location.reload());

bus.on(EVENTS.OPEN_FILES, _changeAssets);

bus.on(EVENTS.OPEN_TEMPLATE, function () {

    if (!server && typeof server.pickTemplate !== 'function') return;

    server.pickTemplate((name) => {
        app.set('_activeTemplate', name);
        app._initTemplates();
    }, function (err) {
        Notification.notify({
            type: 'error', msg: 'Error picking template ' + err
        });
    }, true);
});

// Leverage the setup we have in standard landmarker by clicking on existing
// links
bus.on(EVENTS.SAVE, function () {
    if (app && app.landmarks()) $('#save').click();
});

bus.on(EVENTS.EXPORT, function () {
    if (app && app.landmarks()) $('#download').click();
});

bus.on(EVENTS.SHOW_HELP, function () {
    if (app) app.toggleHelpOverlay();
});

bus.on(EVENTS.FS_NEW_TEMPLATE, function (name) {
    if (app) {
        if (name) app.set('_activeTemplate', name);
        app._initTemplates();
    }
});

ipc.on('cancel-fs-assets-select', function () {
    if (!app) {
        unbindIntro();
        bindIntro();
    }
});

function bindDragAndDrop () {
    if (server instanceof FSBackend) {
        dragDropRemove = drop('body', server.handleDragDrop.bind(server));
    }
}

bus.on(EVENTS.FS_READY, function () {
    bus.removeAllListeners(EVENTS.FS_READY);
    init(server, server.mode);
});

document.addEventListener('DOMContentLoaded', function () {

    cfg = Config();
    cfg.load();
    Intro.init({cfg});

    if (cfg.get('BACKEND_TYPE') === FSBackend.Type) {
        server = new FSBackend(cfg);
        server.setMode(cfg.get('FS_MODE'));
        if (cfg.get('FS_ASSETS')) {
            return server.setAssets(cfg.get('FS_ASSETS')).then(function () {
                notify({type: 'success', msg: 'Restarted from cached data'});
            }, bindIntro);
        }
    }
    bindIntro();
});
