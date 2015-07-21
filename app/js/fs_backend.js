'use strict';

import fs from 'fs';
import path from 'path';

import Backbone from 'backbone';
import Promise from 'promise-polyfill';
import _ from 'underscore';
import THREE from 'three';

import ipc from 'ipc';
import * as NativeImage from 'native-image';

import {
    randomString, basename, extname, stripExtension, baseUrl
} from '../../landmarker.io/src/js/app/lib/utils';

import Base from '../../landmarker.io/src/js/app/backend/base';
import Template from '../../landmarker.io/src/js/app/model/template';
import ImagePromise from '../../landmarker.io/src/js/app/lib/imagepromise';

import { notify } from '../../landmarker.io/src/js/app/view/notification';

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];
const MESH_EXTENSIONS = ['obj', 'stl', 'mtl'].concat(IMAGE_EXTENSIONS);
const TEMPLATE_EXTENSIONS = ['yml', 'yaml', 'ljson', 'json'];

const FSBackend = Base.extend('FS', function () {

    this._assetsPath = undefined;
    this._assets = [];
    this._templatePath = undefined;
    this._template = undefined;

    this.mode = 'image';

    _.extend(this, Backbone.Events);
    ipc.on('fs-backend-selected-template', this.setTemplate.bind(this));
    ipc.on('fs-backend-selected-assets', this.setAssets.bind(this));
});

export default FSBackend;

FSBackend.prototype.initialize = function () {
    this.selectAssets();
};

FSBackend.prototype.selectAssets = function () {
    ipc.send('fs-backend-select-assets');
};

FSBackend.prototype.selectTemplate = function () {
    ipc.send('fs-backend-select-template', Object.keys(Template.Parsers));
};

FSBackend.prototype.ready = function () {
    this.trigger('ready');
};

FSBackend.prototype.setAssets = function (files) {
    this._assetsPath = files[0];
    let ext, stats;
    fs.readdir(this._assetsPath, (err, data) => {
        data.forEach((filename) => {
            const stats = fs.statSync(path.join(this._assetsPath, filename));
            ext = extname(filename);
            if (IMAGE_EXTENSIONS.indexOf(ext) === -1) {
                return;
            }

            if (stats.isDirectory()) {
                return;
            }

            this._assets.push(filename);
        });

        this.selectTemplate();
    });
};

FSBackend.prototype.setTemplate = function (files) {
    this._templatePath = files[0];
    const ext = extname (this._templatePath);
    let data;

    if (ext in Template.Parsers) {
        data = fs.readFileSync(this._templatePath).toString();
        this._template = Template.Parsers[ext](data);
        this.ready();
    } else {
        notify({
            type: error,
            msg: `${this._templatePath} is not a valid template file`
        });
    }
};

FSBackend.prototype.fetchMode = function () {
    return Promise.resolve(this.mode);
};

FSBackend.prototype.fetchTemplates = function () {
    return Promise.resolve([basename(this._templatePath, true)]);
};

FSBackend.prototype.fetchCollections = function () {
    return Promise.resolve([this._assetsPath]);
};

FSBackend.prototype.fetchCollection = function () {
    return Promise.resolve(this._assets.map(function (assetPath) {
        return basename(assetPath, false);
    }));
};

FSBackend.prototype.fetchThumbnail = function () {
    return Promise.reject(null);
};

FSBackend.prototype.fetchImg = function (path) {
    return new Promise((resolve, reject) => {
        const nativeImage = NativeImage.createFromPath(path);
        if (nativeImage && !nativeImage.isEmpty()) {
            const img = new Image();

            img.addEventListener('load', function () {
                const texture = new THREE.Texture(undefined);
                texture.sourceFile = img.src;
                texture.minFilter = THREE.LinearFilter;
                texture.image = img;
                texture.needsUpdate = true;
                resolve(new THREE.MeshBasicMaterial({map: texture}));
            });

            img.src = nativeImage.toDataUrl();
        } else {
            reject();
        }
    });
};

FSBackend.prototype.fetchTexture = function (assetId) {
    const path = `${this._assetsPath}/${assetId}`;
    if (this.mode === 'mesh') {
        if (this._meshTextures[path]) {
            return this.fetchImg(this._meshTextures[path]);
        } else {
            return Promise.reject(null);
        }
    } else {
        return this.fetchImg(path);
    }
};

FSBackend.prototype.fetchLandmarkGroup = function (id, type) {

    const path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;
    const dim = this.mode === 'mesh' ? 3 : 2;
    return new Promise((resolve) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                resolve(this._template.emptyLJSON(dim));
            }
        });
    });
};

FSBackend.prototype.saveLandmarkGroup = function (id, type, json) {
    console.log('SAVE', id, type);
    const path = `${this._assetsPath}/landmarks/${id}_${type}.ljson`;
    return new Promise((resolve, reject) => {
        fs.writeFile(path, JSON.stringify(json), 'utf8', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
};
