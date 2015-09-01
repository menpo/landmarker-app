'use strict';

import fs from 'fs';
import Path from 'path';

import Promise from 'promise-polyfill';
import _ from 'underscore';
import THREE from 'three';

import ipc from 'ipc';

import {
    randomString, basename, extname, stripExtension, baseUrl
} from '../../landmarker.io/src/js/app/lib/utils';

import Base from '../../landmarker.io/src/js/app/backend/base';
import Template from '../../landmarker.io/src/js/app/template';
import ImagePromise from '../../landmarker.io/src/js/app/lib/imagepromise';
import { notify, loading } from '../../landmarker.io/src/js/app/view/notification';

import OBJLoader from '../../landmarker.io/src/js/app/lib/obj_loader';
import STLLoader from '../../landmarker.io/src/js/app/lib/stl_loader';

import bus, * as EVENTS from './bus';

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png'];
const MESH_EXTENSIONS = ['obj', 'stl'];

// promise-polyfill doesn't expose the 'any' function so this is a replacement
// which resolves with the first resolving promise in the array or rejects
// with all the errors (by throwing the array)
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
    this._collection = '/ - (0)';
    this._prefix = '/';

    this._templates = Template.loadDefaultTemplates();
    this._templatesPaths = {};

    this._cfg = cfg;

    this._cfg.set({
        'BACKEND_TYPE': FSBackend.Type
    }, true);

    ipc.on('fs-backend-selected-template', this.addTemplates.bind(this));
    ipc.on('fs-backend-selected-assets', this.setAssets.bind(this));
});

export default FSBackend;

function commonPrefix (path1, path2) {
    const arr1 = path1.split(Path.sep);
    const arr2 = path2.split(Path.sep);

    let i;
    for (i = 0; i < Math.min(arr1.length, arr2.length); i++) {
        if (arr1[i] !== arr2[i]) {
            break;
        }
    }

    return arr1.slice(0, i).join(Path.sep);
}

FSBackend.prototype.computeCollection = function () {
    let prefix = this._assets[0];

    let i = 0;
    for (i = 1; i < this._assets.length; i++) {
        prefix = commonPrefix(prefix, this._assets[i]);
        if (prefix === '') {
            break;
        }
    }

    this._prefix = prefix;
    this._collection = `${prefix} - (${this._assets.length} assets)`;
    bus.emit(EVENTS.FS_CHANGED_ASSETS);

    this._cfg.set({
        FS_ASSETS: this._assets
    }, true);

};

FSBackend.prototype.idFromPath = function (path) {
    return path.replace(this._prefix, '');
};

FSBackend.prototype.pathFromId = function (assetId) {
    return this._prefix + assetId;
};

FSBackend.prototype.setMode = function (mode) {
    if (mode === 'image' || mode === 'mesh') {
        this.mode = mode;
    } else {
        this.mode = this.mode || 'image';
    }

    this._cfg.set({FS_MODE: this.mode}, true);
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

FSBackend.prototype.isValidAssetExtension = function (ext) {
    const exts = this.mode === 'mesh' ? MESH_EXTENSIONS : IMAGE_EXTENSIONS;
    return exts.indexOf(ext) > -1;
};

FSBackend.prototype.setAssets = function (files) {

    this._assets = [];
    this._assetsProps = {};

    const promises = [];

    const async = loading.start();

    files.forEach((path) => {
        promises.push(new Promise((resolve) => {
            fs.stat(path, (err, stats) => {
                if (stats.isDirectory()) {
                    resolve(this.setDirectoryAsset(path));
                } else {
                    const ext = extname(path);
                    if (this.isValidAssetExtension(ext)) {
                        resolve(this.setFileAsset(path));
                    }
                }
            });
        }));
    });

    return Promise.all(promises).then((results) => {
        loading.stop(async);
        if (this._assets.length) {
            this.computeCollection();
            bus.emit(EVENTS.FS_READY);
        } else {
            notify({type: 'error', msg: `No suitable asset found`});
        }
    });
};

FSBackend.prototype.setFileAsset = function (path) {
    if (this.mode === 'mesh') {
        return this._setMeshAsset(path);
    } else {
        return this._setImageAsset(path);
    }
};

FSBackend.prototype.setDirectoryAsset = function (path) {
    const async = loading.start();
    return new Promise((resolve, reject) => {
        const files = [];
        fs.readdir(path, (err, data) => {
            if (err) {
                reject(err);
            } else {
                data.forEach((fname) => {
                    const ext = extname(fname);
                    const fpath = Path.join(path,fname);
                    if (this.isValidAssetExtension(ext)) {
                        files.push(this.setFileAsset(fpath));
                    }
                });
            }

            loading.stop(async);
            resolve(Promise.all(files));
        });
    });
};

FSBackend.prototype._setMeshAsset = function (path) {
    this._assets.push(path);
    this._assetsProps[path] = {path: path};

    let ext, tpath;
    for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
        ext = IMAGE_EXTENSIONS[i];
        tpath = stripExtension(path) + '.' + ext;
        if (fs.existsSync(tpath)) {
            this._assetsProps[path].texturePath = tpath;
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
    return Promise.resolve([this._collection]);
};

FSBackend.prototype.fetchCollection = function () {
    return Promise.resolve(this._assets.map(p => this.idFromPath(p)));
};

FSBackend.prototype.fetchThumbnail = function () {
    return Promise.reject(null);
};

FSBackend.prototype.fetchImg = function (fpath) {
    const async = loading.start();
    return new Promise((resolve, reject) => {
        fs.readFile(fpath, (err, data) => {
            if (err) {
                loading.stop(async);
                reject(err);
            } else {
                const img = new Image();

                img.addEventListener('load', function () {
                    const texture = new THREE.Texture(undefined);
                    texture.sourceFile = img.src;
                    texture.minFilter = THREE.LinearFilter;
                    texture.image = img;
                    texture.needsUpdate = true;
                    loading.stop(async);
                    window.URL.revokeObjectURL(img.src);
                    resolve(new THREE.MeshBasicMaterial({map: texture}));
                });

                const encoded = data.toString('base64');
                const src = `data:image/${extname(fpath)};base64,${encoded}`;
                img.src = src;
            }
        });
    });
};

FSBackend.prototype.fetchTexture = function (assetId) {
    const assetPath = this.pathFromId(assetId);
    if (this.mode === 'mesh') {
        if (this._assetsProps[assetPath].texturePath) {
            return this.fetchImg(this._assetsProps[assetPath].texturePath);
        } else {
            return Promise.reject(null);
        }
    } else {
        return this.fetchImg(assetPath);
    }
};

FSBackend.prototype.fetchGeometry = function (assetId) {
    console.time(`FSBackend#fetchGeometry#${assetId}`);
    const assetPath = this.pathFromId(assetId);
    const q = new Promise((resolve, reject) => {
        fs.readFile(assetPath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                const ext = extname(assetPath);
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
    const fpath = `${this.pathFromId(id)}_${type}.ljson`;
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
    const fpath = `${this.pathFromId(id)}_${type}.ljson`;
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

const DROP_TYPE = {
    ASSET: 'ASSET',
    TEMPLATE: 'TEMPLATE'
}

// Handle the drag and drop logic for assets and templates:
// - only one type of files at a time (ignore anything that does not
//   match the first recognized type)
FSBackend.prototype.handleDragDrop = function (files) {

    let dropType, ext;
    const async = loading.stop(async);
    const promises = [];

    files.forEach((file, i) => {
        ext = extname(file.name);

        // Set the DROP_TYPE to the first we see, ignore anything else
        if (!dropType) {
            if (this.isValidAssetExtension(ext)) {
                dropType = DROP_TYPE.ASSET;
            } else if (ext in Template.Parsers) {
                dropType = DROP_TYPE.TEMPLATE;
            }
        }

        if (dropType === DROP_TYPE.ASSET) {
            // Ignore anything we already know about
            if (this._assets.indexOf(file.path) === -1) {
                promises.push(Promise.resolve(this.setFileAsset(file.path)));
            } else {
                notify({msg: `Asset ${file.name} already exists`});
            }
        } else if (dropType === DROP_TYPE.TEMPLATE) {
            promises.push(this.addTemplate(file.path));
        } else {
            console.log('Drag/Drop: ignoring', file.path);
        }
    });

    if (promises.length === 0) {
        console.log('Drag/Drop: nothing to do');
        return null;
    }

    // Resolve if any of the promises has resolved, after all have terminated
    _anyPromise(promises).then((result) => {
        loading.stop(async);
        if (dropType === DROP_TYPE.ASSET) {
            this.computeCollection(true);
        } else if (dropType === DROP_TYPE.TEMPLATE) {
            notify({type: 'success', msg: 'Successfully imported templates'});
            bus.emit(EVENTS.FS_NEW_TEMPLATE, result);
        }
    }, (errs) => {
        loading.stop(async);
        console.log(`Failed to process dropped content`, errs);
    });

};
