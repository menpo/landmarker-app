'use strict';

import fs from 'fs';
import path from 'path';

import ipc from 'ipc';

import Base from '../../landmarker.io/src/js/app/backend/base';

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];
const MESH_EXTENSIONS = ['obj', 'stl', 'mtl'].concat(IMAGE_EXTENSIONS);

const FSBackend = Base.extend('FS', function () {
    this._assetsPath = undefined;
    this._templatesPath = undefined;
});

export default FSBackend;

FSBackend.prototype.selectAssets = function (bw) {
    ipc.send('fs-backend-select-assets');
}

ipc.on('fs-backend-selected-assets', function (files) {
    this._assetsPath = files[0];
    fs.readdir(this._assetsPath, (err, data) => {
        console.log(
            data.map((fn) => {
                const stats = fs.statSync(path.join(this._assetsPath, fn));
                return [fn, stats.isDirectory()];
            })
        );
    });
});
