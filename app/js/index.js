'use strict';

import ipc from 'ipc';

import THREE from 'three';
import $ from 'jquery';

import Config from '../landmarker.io/src/js/app/model/config';
import KSH from '../landmarker.io/src/js/app/view/keyboard';
import { notify, AssetLoadingNotification } from '../landmarker.io/src/js/app/view/notification';

import Modal from '../landmarker.io/src/js/app/view/modal';
import App from '../landmarker.io/src/js/app/model/app';
import Server from '../landmarker.io/src/js/app/backend/server';
import HelpOverlay from '../landmarker.io/src/js/app/view/help';
import * as AssetView from '../landmarker.io/src/js/app/view/asset';
import SidebarView from '../landmarker.io/src/js/app/view/sidebar';
import ToolbarView from '../landmarker.io/src/js/app/view/toolbar';
import ViewportView from '../landmarker.io/src/js/app/view/viewport';

import FSBackend from './js/fs_backend';
import Intro from './js/app_intro';
import bus, * as EVENTS from './js/bus';
import makeMenu from './js/menu';

const cfg = Config();

let server, app, viewport;

function init (server, mode) {

    console.log('init');

    unbindAfterStartup();
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
       console.log('Index: the asset has changed');
        viewport.removeMeshIfPresent();
        if (prevAsset !== null) {
            // clean up previous asset
            prevAsset.dispose();
        }
        prevAsset = app.asset();
    });

    server.on('change:assets', function () {
        if (app) app._initCollections();
    });

    makeMenu();

    bus.on(EVENTS.SHOW_HELP, function () {
        if (app) app.toggleHelpOverlay();
    });

    (new KSH(app, viewport)).enable();
}

function bindForStartup () {

    bus.on(EVENTS.START_WITH_SERVER, function (url) {
        server = new Server(url);
        server.fetchMode().then(function (mode) {
            init(server, mode);
        }, function (err) {
            console.log(err);
        })
    });

    bus.on(EVENTS.START_WITH_FS, function (mode) {
        server = new FSBackend();
        server.setMode(mode);

        server.on('ready', function () {
            console.log('ready');
            server.off('ready');
            init(server, mode);
        });

        server.initialize();
    });

}

function unbindAfterStartup () {
    bus.removeAllListeners(EVENTS.START_WITH_SERVER);
    bus.removeAllListeners(EVENTS.START_WITH_FS);
}

function _changeAssets () {
    if (server) server.selectAssets();
}

function changeAssets () {
    Modal.confirm(
        'Are you sure you want to change current assets collection ?', _changeAssets);
}

document.addEventListener('DOMContentLoaded', function () {
    Intro.init({cfg});
    bindForStartup();
    $('#changeAssets').click(changeAssets);
    Intro.open();
});

bus.on(EVENTS.RESTART, function () {
    window.location.reload();
});

bus.on(EVENTS.OPEN_FILES, _changeAssets);

bus.on(EVENTS.OPEN_TEMPLATE, function () {

    if (!server) return;

    server.pickTemplate((name) => {
        app.set('_activeTemplate', name);
        app._initTemplates();
    }, function (err) {
        Notification.notify({
            type: 'error', msg: 'Error picking template ' + err
        });
    }, true);
});

bus.on(EVENTS.SAVE, function () {
    if (app && app.landmarks()) {
        $('#save').click();
    }
});

bus.on(EVENTS.EXPORT, function () {
    if (app && app.landmarks()) {
        $('#download').click();
    }
});

ipc.on('cancel-fs-assets-select', function () {
    if (!app) Intro.open();
});
