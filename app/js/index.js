'use strict';

import remote from 'remote';
import ipc from 'ipc';

import THREE from 'three';

import Config from '../landmarker.io/src/js/app/model/config';
import Server from '../landmarker.io/src/js/app/backend/server';
import KSH from '../landmarker.io/src/js/app/view/keyboard';
import { notify, AssetLoadingNotification } from '../landmarker.io/src/js/app/view/notification';

import Modal from '../landmarker.io/src/js/app/view/modal';

import App from '../landmarker.io/src/js/app/model/app';

import AssetView from '../landmarker.io/src/js/app/view/asset';

import * as SidebarView from '../landmarker.io/src/js/app/view/sidebar';
import * as ToolbarView from '../landmarker.io/src/js/app/view/toolbar';
import * as ViewportView from '../landmarker.io/src/js/app/view/viewport';

import FSBackend from './js/fs_backend';

import HelpOverlay from '../landmarker.io/src/js/app/view/help';

const cfg = Config();

function start (url) {
    // const server = new Server(url);
    // server.fetchMode().then(function (mode) {
    //     init(server, mode);
    // }, function () {
    //     notify({type: 'error', msg: 'Couldn\'t fetch mode !'});
    //     Modal.prompt('Where is your server located ?', start, null, false);
    // });
}

function init (server, mode) {
    THREE.ImageUtils.crossOrigin = '';
    const app = new App({server: server, mode: mode});

    new AssetLoadingNotification({model: app});
    new SidebarView.Sidebar({model: app});
    new AssetView({model: app});
    new ToolbarView.Toolbar({model: app});
    new HelpOverlay({model: app});

    const viewport = new ViewportView.Viewport({model: app});
    let prevAsset = null;

    app.on('change:asset', function () {
       console.log('Index: the asset has changed');
        viewport.removeMeshIfPresent();
        if (prevAsset !== null) {
            // clean up previous asset
            console.log('Before dispose: ' + viewport.memoryString());
            prevAsset.dispose();
            console.log('After dispose: ' + viewport.memoryString());
        }
        prevAsset = app.asset();
    });

    (new KSH(app, viewport)).enable();

}

document.addEventListener('DOMContentLoaded', function () {
    // Modal.prompt('Where is your server located ?', start, null, false);
    const fsb = new FSBackend();
    fsb.selectAssets();
});
