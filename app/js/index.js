'use strict';

import remote from 'remote';
import ipc from 'ipc';

import THREE from 'three';

import Config from '../landmarker.io/src/js/app/model/config';
import KSH from '../landmarker.io/src/js/app/view/keyboard';
import { notify, AssetLoadingNotification } from '../landmarker.io/src/js/app/view/notification';

import Modal from '../landmarker.io/src/js/app/view/modal';
import App from '../landmarker.io/src/js/app/model/app';

import * as SidebarView from '../landmarker.io/src/js/app/view/sidebar';
import * as ToolbarView from '../landmarker.io/src/js/app/view/toolbar';
import * as ViewportView from '../landmarker.io/src/js/app/view/viewport';
import AssetView from '../landmarker.io/src/js/app/view/asset';
import HelpOverlay from '../landmarker.io/src/js/app/view/help';

import FSBackend from './js/fs_backend';

const cfg = Config();

let fsb, app, viewport;

function init () {

    fsb.off('ready');

    const mode = 'image';
    THREE.ImageUtils.crossOrigin = '';
    app = new App({server: fsb, mode: mode});

    new AssetLoadingNotification({model: app});
    new SidebarView.Sidebar({model: app});
    new AssetView({model: app});
    new ToolbarView.Toolbar({model: app});
    new HelpOverlay({model: app});

    viewport = new ViewportView.Viewport({model: app});
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
    fsb = new FSBackend();
    fsb.on('ready', init);
    fsb.initialize();
});
