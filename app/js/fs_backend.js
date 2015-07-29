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
import Template from '../../landmarker.io/src/js/app/template';
import ImagePromise from '../../landmarker.io/src/js/app/lib/imagepromise';
import { notify, loading } from '../../landmarker.io/src/js/app/view/notification';

import OBJLoader from '../../landmarker.io/src/js/app/lib/obj_loader';
import STLLoader from '../../landmarker.io/src/js/app/lib/stl_loader';

import bus from './bus';
import {RESTART} from './bus';

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];
const MESH_EXTENSIONS = ['obj', 'stl'];

function _anyPromise (array) {

    // Record the results of promises
    const resolving = array.map(function (q) {
        return q.then(result => [true, result], error => [false, error]);
    });

    return Promise.all(resolving).then(function (results) {
        let resolved, result;
        const errors = [];

        for (var i = 0; i < results.length; i++) {
            [resolved, result] = results[i];

            if (resolved) {
                return result;
            } else {
                errors.push(result);
            }
        }

        throw errors;
    });

}

const FSBackend = Base.extend('FS', function (cfg) {

    this._assets = [];
    this._assetsProps = {};
    this.mode = 'image';
    this._collectionId = undefined;

    this._templates = Template.loadDefaultTemplates();
    this._templatesPaths = {};

    this._cfg = cfg;

    _.extend(this, Backbone.Events);
    ipc.on('fs-backend-selected-template', this.addTemplates.bind(this));
    ipc.on('fs-backend-selected-assets', this.setAssets.bind(this));
});

export default FSBackend;

FSBackend.prototype.initialize = function () {
    this.selectAssets();
};

FSBackend.prototype.setMode = function (mode) {
    if (mode === 'image' || mode === 'mesh') {
        this.mode = mode;
    } else {
        this.mode = this.mode || 'image';
    }
};

FSBackend.prototype.selectAssets = function () {
    ipc.send('fs-backend-select-assets');
};

FSBackend.prototype.pickTemplate = function (success, error) {
    if (typeof success === 'function') {
        error = error || function () {};
        this._pickTemplateCallback = {success, error};
    }
    ipc.send('fs-backend-select-template');
};

FSBackend.prototype.isValidExtension = function (ext) {
    const exts = this.mode === 'mesh' ? MESH_EXTENSIONS : IMAGE_EXTENSIONS;
    return exts.indexOf(ext) > -1;
};

FSBackend.prototype.setAssets = function (files) {

    this._assets = [];
    this._assetsProps = {};

    const promises = [];

    const async = loading.start();

    files.forEach((apath) => {
        promises.push(new Promise((resolve) => {
            fs.stat(apath, (err, stats) => {
                if (stats.isDirectory()) {
                    resolve(this.setDirectoryAsset(apath));
                } else {
                    const ext = extname(apath);
                    if (this.isValidExtension(ext)) {
                        resolve(this.setFileAsset(apath));
                    }
                }
            });
        }));
    });

    return Promise.all(promises).then((results) => {
        loading.stop(async);
        if (this._assets.length) {
            this._collectionId = Date.now();
            this.trigger('change:assets');
            this.trigger('ready');
        } else {
            notify({type: 'error', msg: `No suitable asset found`});
            bus.emit(RESTART);
        }
    });
};

FSBackend.prototype.setFileAsset = function (fpath) {
    if (this.mode === 'mesh') {
        return this._setMeshAsset(fpath);
    } else {
        return this._setImageAsset(fpath);
    }
};

FSBackend.prototype.setDirectoryAsset = function (dpath) {
    const async = loading.start();
    return new Promise((resolve, reject) => {
        const files = [];
        fs.readdir(dpath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                data.forEach((fname) => {
                    const ext = extname(fname);
                    const fpath = path.join(dpath,fname);
                    if (this.isValidExtension(ext)) {
                        files.push(this.setFileAsset(fpath));
                    }
                });
            }

            loading.stop(async);
            resolve(Promise.all(files));
        });
    });
};

FSBackend.prototype._setMeshAsset = function (filepath) {
    this._assets.push(filepath);
    this._assetsProps[filepath] = {path: filepath};

    let ext, tpath;
    for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
        ext = IMAGE_EXTENSIONS[i];
        tpath = stripExtension(filepath) + '.' + ext;
        if (fs.existsSync(tpath)) {
            this._assetsProps[filepath].texturePath = tpath;
            break;
        }
    }
};

FSBackend.prototype._setImageAsset = function (filepath) {
    this._assets.push(filepath);
    this._assetsProps[name] = {path: filepath};
};

FSBackend.prototype.addTemplates = function (files) {

    if (!files || !files.length) {
        return Promise.reject(null);
    }

    const async = loading.start();
    return _anyPromise(files.map(f => this.addTemplate(f))).then((name) => {
        if (this._pickTemplateCallback) {
            this._pickTemplateCallback.success(name);
        }
    }, (errors) => {
        if (this._pickTemplateCallback) {
            this._pickTemplateCallback.error(errors);
        }
    }).then(() => {
        loading.stop(async);
        this._pickTemplateCallback = undefined;
    });
};

FSBackend.prototype.addTemplate = function (path) {

    const ext = extname(path);
    if (!(ext in Template.Parsers)) {
        return Promise.reject(
            new Error(`Incorrect extension ${ext} for template`)
        );
    }

    return new Promise ((resolve, reject) => {

        const name = basename(path, true).split('_').pop();

        fs.readFile(path, (err, data) => {
            if (err) {
                reject(err);
            } else if (!data) {
                reject(`Empty file ${path}`);
            } else {
                const tmpl = Template.Parsers[ext](data.toString());

                let uniqueName = name, i = 1;
                while (uniqueName in this._templates) {
                    uniqueName = `${name}-${i}`;
                    i++;
                }

                this._templates[uniqueName] = tmpl;
                this._templatesPaths[uniqueName] = path;
                resolve(uniqueName);
            }
        });
    }).then((result) => {
        return result;
    }, (err) => {
        notify({type: 'error', msg: `Ignored ${path} (couldn't parse)`});
        throw err;
    });
}

FSBackend.prototype.fetchMode = function () {
    return Promise.resolve(this.mode);
};

FSBackend.prototype.fetchTemplates = function () {
    return Promise.resolve(Object.keys(this._templates));
};

FSBackend.prototype.fetchCollections = function () {
    return Promise.resolve([this._collectionId]);
};

FSBackend.prototype.fetchCollection = function () {
    return Promise.resolve(this._assets);
};

FSBackend.prototype.fetchThumbnail = function () {
    return Promise.reject(null);
};

FSBackend.prototype.fetchImg = function (fpath) {
    const async = loading.start();
    return new Promise((resolve, reject) => {
        console.time(`FSBackend#fetchImg#${fpath}`);
        const nativeImage = NativeImage.createFromPath(fpath);
        if (nativeImage && !nativeImage.isEmpty()) {
            const img = new Image();

            img.addEventListener('load', function () {
                const texture = new THREE.Texture(undefined);
                texture.sourceFile = img.src;
                texture.minFilter = THREE.LinearFilter;
                texture.image = img;
                texture.needsUpdate = true;
                loading.stop(async);
                console.timeEnd(`FSBackend#fetchImg#${fpath}`);
                resolve(new THREE.MeshBasicMaterial({map: texture}));
            });

            img.src = nativeImage.toDataUrl();
        } else {
            loading.stop(async);
            console.timeEnd(`FSBackend#fetchImg#${fpath}`);
            reject();
        }
    });
};

FSBackend.prototype.fetchTexture = function (assetId) {
    if (this.mode === 'mesh') {
        if (this._assetsProps[assetId].texturePath) {
            return this.fetchImg(this._assetsProps[assetId].texturePath);
        } else {
            return Promise.reject(null);
        }
    } else {
        return this.fetchImg(assetId);
    }
};

FSBackend.prototype.fetchGeometry = function (assetId) {
    console.time(`FSBackend#fetchGeometry#${assetId}`);
    const q = new Promise((resolve, reject) => {
        fs.readFile(assetId, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const ext = extname(assetId);
                window.meshData = data;
                if (ext === 'obj') {
                    resolve(OBJLoader(data.toString()));
                } else if (ext === 'stl') {
                    // Convert NativeBuffer to ArrayBuffer
                    const len = data.length;
                    const ab = new ArrayBuffer(len);
                    const view = new Uint8Array(ab);
                    for (let i = 0; i < len; ++i) {
                        view[i] = data[i];
                    }
                    console.timeEnd(`FSBackend#fetchGeometry#${assetId}`);
                    resolve(STLLoader(ab));
                } else {
                    console.timeEnd(`FSBackend#fetchGeometry#${assetId}`);
                    reject(`Unrecognized extension ${ext}`);
                }
            }
        });
    });

    q.isGeometry = true;
    return q;
};

FSBackend.prototype.fetchLandmarkGroup = function (id, type) {

    const fpath = `${id}_${type}.ljson`;
    const dims = this.mode === 'mesh' ? 3 : 2;
    const tmpl = this._templates[type];
    const async = loading.start();

    return new Promise((resolve) => {
        fs.readFile(fpath, (err, data) => {
            if (err) {
                console.log(err);
                loading.stop(async);
                resolve(tmpl.emptyLJSON(dims));
            } else {
                const [ok, json] = tmpl.validate(data.toString(), dims);
                if (!ok) {
                    notify({
                        msg: 'Found invalid landmarks, falling back to empty landmarks'
                    });
                }
                loading.stop(async);
                resolve(json);
            }
        });
    });
};

FSBackend.prototype.saveLandmarkGroup = function (id, type, json) {
    const fpath = `${id}_${type}.ljson`;
    const async = loading.start();
    return new Promise((resolve, reject) => {
        fs.writeFile(fpath, JSON.stringify(json), 'utf8', (err) => {
            if (err) {
                loading.stop(async);
                reject(err);
            } else {
                loading.stop(async);
                resolve();
            }
        })
    });
};
