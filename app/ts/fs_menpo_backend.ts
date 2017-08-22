import { ipcRenderer } from 'electron'
import * as fs from 'fs'
import * as Path from 'path'
import * as _ from 'underscore'

import * as THREE from 'three'

import {
    extname, stripExtension
} from '../../landmarker.io/src/ts/app/lib/utils'

import { Backend } from '../../landmarker.io/src/ts/app/backend/base'
import Template from '../../landmarker.io/src/ts/app/template'
import { notify, loading } from '../../landmarker.io/src/ts/app/view/notification'
import XMLHttpRequestPromise from '../../landmarker.io/src/ts/app/lib/requests'
import { LJSONFile } from '../../landmarker.io/src/ts/app/model/landmark/group'
import { JSONLmPoint } from '../../landmarker.io/src/ts/app/model/landmark/landmark'

import OBJLoader from '../../landmarker.io/src/ts/app/lib/obj_loader'
import STLLoader from '../../landmarker.io/src/ts/app/lib/stl_loader'

import bus, * as EVENTS from './bus'

const IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png']
const MESH_EXTENSIONS = ['obj', 'stl']

// TODO: the list of annotated assets that have incorporated into the model does not persist after restart!
// TODO: deleting pickle files but leaving ljsons causes error!
// TODO: revisiting annotated assets causes a phantom change that means it needs to be saved before scrolling! is this a new issue?
// TODO: scrolling through assets that have already been done and saving them causes them to be resent to the python server!
// TODO: save completed landmark groups as they are completed and saved (in memory and storage)
// TODO: make it obvious to the user (though some ui element) that automatic annotation is in effect. In an effort to communicate what the two constraints are!

// promise-polyfill doesn't expose the 'any' function so this is a replacement
// which resolves with the first resolving promise in the array or rejects
// with all the errors (by throwing the array)
function _anyPromise (array) {

    // Record the results of promises
    const resolving = array.map(function (q) {
        return q.then(result => [true, result], error => [false, error])
    })

    return Promise.all(resolving).then(function (results) {
        let resolved, result
        const errors: any[] = []

        for (var i = 0; i < results.length; i++) {
            [resolved, result] = results[i]

            if (resolved) {
                return result
            } else {
                errors.push(result)
            }
        }

        throw errors
    })

}

function basename(path: string, removeExt=false) {
    const bn = path.split(Path.sep).pop()
    return removeExt ? bn.split('.').slice(0, -1).join('.') : bn
}

function withoutExt(path: string): string {
    return path.split('.').slice(0, -1).join('.')
}

function commonPrefix (path1, path2) {
    const arr1 = path1.split(Path.sep)
    const arr2 = path2.split(Path.sep)

    let i
    for (i = 0; i < Math.min(arr1.length, arr2.length); i++) {
        if (arr1[i] !== arr2[i]) {
            break
        }
    }

    return arr1.slice(0, i).join(Path.sep)
}

function commonPrefixFromArray (paths: string[]) {
    // Must not be empty
    let prefix = paths[0]

    let i = 0
    for (i = 1; i < paths.length; i++) {
        prefix = commonPrefix(prefix, paths[i])
        if (prefix === '') {
            break
        }
    }
    return prefix
}

function checkCompleteAnnotation(ljson): boolean {
    for (let i = 0; i < ljson.landmarks.points.length; i++) {
        if (ljson.landmarks.points[i][0] === null) {
            // Incomplete annotation
            return false
        }
    }
    return true
}

function softValidateAndCorrect(jsonFile: LJSONFile | string, template: Template, dims=2): [boolean, LJSONFile] {
    const json: LJSONFile = typeof jsonFile === 'string' ? JSON.parse(jsonFile) : jsonFile

    const ljson: LJSONFile = template.emptyLJSON(dims)
    json.landmarks.connectivity = ljson.landmarks.connectivity
    let ok: boolean

    ok = json.version === ljson.version
    ok = ok && _.isEqual(json.labels, ljson.labels)
    ok = ok && ljson.landmarks.points.every(p => p.length === dims)
    return [ok, ok ? json : ljson]
}

function equivalentLJSON(ljson1: LJSONFile, ljson2: LJSONFile): boolean {
    const nPoints: number = ljson1.landmarks.points.length
    for (let i = 0; i < nPoints; i++) {
        const point1: JSONLmPoint = ljson1.landmarks.points[i]
        const point2: JSONLmPoint = ljson2.landmarks.points[i]
        if (point1[0] !== point2[0] || point1[1] !== point2[1]) {
            return false
        }
    }
    return true
}

function postJSON(url: string, {headers={}, data={}, auth=false}={}): any {
    return XMLHttpRequestPromise(url, {
        headers,
        auth,
        responseType: 'json',
        method: 'POST',
        data: JSON.stringify(data),
        contentType: 'application/json;charset=UTF-8'
    })
}

const DROP_TYPE = {
    ASSET: 'ASSET',
    TEMPLATE: 'TEMPLATE'
}

export default class FSMenpoBackend implements Backend {

    // Used to identify backends in local storage
    static Type = 'FSMenpo'

    _assets: string[] = []
    _assetsProps = {}
    mode: string = 'image'
    _collection: string = '/ - (0)'
    _prefix: string = '/'

    _templates = Template.loadDefaultTemplates()
    _templatesPaths = {}

    _cfg
    _pickTemplateCallback: {success, error} | undefined

    url: string = 'http://localhost:5001/'

    // All fully annotated assets
    _fullyAnnotatedAssets: {[assetBaseId: string]: LJSONFile} = {}
    // Assets that have not been used to increment the deformable model yet
    _toBeTrained: string[] = []
    // The number of full annotations to activate automatic annotation
    minimumTrainingAssets: number = 10
    // Number of full annotations between each model incrementation
    automaticAnnotationInterval: number = 5
    callingMenpo: boolean = false
    menpoCallMessage: string = ''
    menpoXhr?: XMLHttpRequest

    constructor(cfg) {
        this._cfg = cfg
        this._cfg.set({
            'BACKEND_TYPE': FSMenpoBackend.Type
        }, true)

        ipcRenderer.on('fs-backend-selected-template', ((event, arg) => {this.addTemplates.call(this, arg)}).bind(this))
        ipcRenderer.on('fs-backend-selected-assets', ((event, arg) => {this.setAssets.call(this, arg)}).bind(this))
    }

    computeCollection() {
        this._prefix = commonPrefixFromArray(this._assets)
        this._collection = `${this._prefix} - (${this._assets.length} assets)`
        bus.emit(EVENTS.FS_CHANGED_ASSETS)

        this._cfg.set({
            FS_MENPO_ASSETS: this._assets
        }, true)

    }

    idFromPath(path) {
        return path.replace(this._prefix, '')
    }

    pathFromId(assetId) {
        return this._prefix + assetId
    }

    setMode(mode) {
        if (mode === 'image' || mode === 'mesh') {
            this.mode = mode
        } else {
            this.mode = this.mode || 'image'
        }

        this._cfg.set({FS_MENPO_MODE: this.mode}, true)
    }

    selectAssets() {
        ipcRenderer.send('fs-backend-select-assets')
    }

    pickTemplate(success, error) {
        if (typeof success === 'function') {
            error = error || function () {}
            this._pickTemplateCallback = {success, error}
        }
        ipcRenderer.send('fs-backend-select-template')
    }

    isValidAssetExtension(ext) {
        const exts = this.mode === 'mesh' ? MESH_EXTENSIONS : IMAGE_EXTENSIONS
        return exts.indexOf(ext) > -1
    }

    setAssets(files) {

        this._assets = []
        this._assetsProps = {}

        const promises = []

        const async = loading.start()

        files.forEach((path) => {
            promises.push(new Promise((resolve) => {
                fs.stat(path, (err, stats) => {
                    if (stats.isDirectory()) {
                        resolve(this.setDirectoryAsset(path))
                    } else {
                        const ext = extname(path)
                        if (this.isValidAssetExtension(ext)) {
                            resolve(this.setFileAsset(path))
                        }
                    }
                })
            }))
        })

        return Promise.all(promises).then((results) => {
            loading.stop(async)
            if (this._assets.length) {
                this.computeCollection()
                bus.emit(EVENTS.FS_READY)
            } else {
                notify({type: 'error', msg: `No suitable asset found`})
            }
        })
    }

    setFileAsset(path) {
        if (this.mode === 'mesh') {
            return this._setMeshAsset(path)
        } else {
            return this._setImageAsset(path)
        }
    }

    setDirectoryAsset(path) {
        const async = loading.start()
        return new Promise((resolve, reject) => {
            const files = []
            fs.readdir(path, (err, data) => {
                if (err) {
                    reject(err)
                } else {
                    data.forEach((fname) => {
                        const ext = extname(fname)
                        const fpath = Path.join(path,fname)
                        if (this.isValidAssetExtension(ext)) {
                            files.push(this.setFileAsset(fpath))
                        }
                    })
                }

                loading.stop(async)
                resolve(Promise.all(files))
            })
        })
    }

    _setMeshAsset(path) {
        this._assets.push(path)
        this._assetsProps[path] = {path: path}

        let ext, tpath
        for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
            ext = IMAGE_EXTENSIONS[i]
            tpath = stripExtension(path) + '.' + ext
            if (fs.existsSync(tpath)) {
                this._assetsProps[path].texturePath = tpath
                break
            }
        }
    }

    _setImageAsset(filepath) {
        this._assets.push(filepath)
        this._assetsProps[name] = {path: filepath}
    }

    addTemplates(files) {

        if (!files || !files.length) {
            return Promise.reject(null)
        }

        const async = loading.start()
        return _anyPromise(files.map(f => this.addTemplate(f))).then((name) => {
            if (this._pickTemplateCallback) {
                this._pickTemplateCallback.success(name)
            }
        }, (errors) => {
            if (this._pickTemplateCallback) {
                this._pickTemplateCallback.error(errors)
            }
        }).then(() => {
            loading.stop(async)
            this._pickTemplateCallback = undefined
        })
    }

    addTemplate(path) {
        // TODO: if there's a duplicate then it appends "-{i}". Is this okay?

        const ext = extname(path)
        if (!(ext in Template.Parsers)) {
            return Promise.reject(
                new Error(`Incorrect extension ${ext} for template`)
            )
        }

        return new Promise ((resolve, reject) => {

            const name = basename(path, true).split('_').pop()

            fs.readFile(path, (err, data) => {
                if (err) {
                    reject(err)
                } else if (!data) {
                    reject(`Empty file ${path}`)
                } else {
                    const tmpl = Template.Parsers[ext](data.toString())

                    let uniqueName = name, i = 1
                    while (uniqueName in this._templates) {
                        uniqueName = `${name}-${i}`
                        i++
                    }

                    this._templates[uniqueName] = tmpl
                    this._templatesPaths[uniqueName] = path
                    resolve(uniqueName)
                }
            })
        }).then((result) => {
            return result
        }, (err) => {
            notify({type: 'error', msg: `Ignored ${path} (couldn't parse)`})
            throw err
        })
    }

    fetchMode() {
        // TODO: check python backend
        return Promise.resolve(this.mode)
    }

    fetchTemplates() {
        return Promise.resolve(Object.keys(this._templates))
    }

    fetchCollections() {
        return Promise.resolve([this._collection])
    }

    fetchCollection() {
        return Promise.resolve(this._assets.map(p => this.idFromPath(p)))
    }

    fetchThumbnail() {
        return Promise.reject(null)
    }

    fetchImg(fpath) {
        const async = loading.start()
        return new Promise((resolve, reject) => {
            fs.readFile(fpath, (err, data) => {
                if (err) {
                    loading.stop(async)
                    reject(err)
                } else {
                    const img = new Image()

                    img.addEventListener('load', function () {
                        const texture = new THREE.Texture(undefined)
                        texture.sourceFile = img.src
                        texture.minFilter = THREE.LinearFilter
                        texture.image = img
                        texture.needsUpdate = true
                        loading.stop(async)
                        window.URL.revokeObjectURL(img.src)
                        resolve(new THREE.MeshBasicMaterial({map: texture}))
                    })

                    const encoded = data.toString('base64')
                    const src = `data:image/${extname(fpath)};base64,${encoded}`
                    img.src = src
                }
            })
        })
    }

    fetchTexture(assetId) {
        const assetPath = this.pathFromId(assetId)
        if (this.mode === 'mesh') {
            if (this._assetsProps[assetPath].texturePath) {
                return this.fetchImg(this._assetsProps[assetPath].texturePath)
            } else {
                return Promise.reject(null)
            }
        } else {
            return this.fetchImg(assetPath)
        }
    }

    fetchGeometry(assetId) {
        console.time(`FSMenpoBackend#fetchGeometry#${assetId}`)
        const assetPath = this.pathFromId(assetId)
        const q = new Promise((resolve, reject) => {
            fs.readFile(assetPath, (err, data) => {
                if (err) {
                    reject(err)
                } else {
                    const ext = extname(assetPath)
                    if (ext === 'obj') {
                        resolve(OBJLoader(data.toString()))
                    } else if (ext === 'stl') {
                        // Convert NativeBuffer to ArrayBuffer
                        const len = data.length
                        const ab = new ArrayBuffer(len)
                        const view = new Uint8Array(ab)
                        for (let i = 0; i < len; ++i) {
                            view[i] = data[i]
                        }
                        console.timeEnd(`FSMenpoBackend#fetchGeometry#${assetId}`)
                        resolve(STLLoader(ab))
                    } else {
                        console.timeEnd(`FSMenpoBackend#fetchGeometry#${assetId}`)
                        reject(`Unrecognized extension ${ext}`)
                    }
                }
            })
        })

        q.isGeometry = true
        return q
    }

    fetchLandmarkGroup(id, type) {
        const fpath = `${withoutExt(this.pathFromId(id))}_${type}.ljson`
        const dims = this.mode === 'mesh' ? 3 : 2
        const tmpl = this._templates[type]
        const async = loading.start()

        return new Promise((resolve) => {
            fs.readFile(fpath, (err, data) => {
                if (err) {
                    console.log(err)
                    loading.stop(async)
                    resolve(tmpl.emptyLJSON(dims))
                } else {
                    const [ok, json] = tmpl.validate(data.toString(), dims)
                    if (!ok) {
                        notify({
                            msg: 'Found invalid landmarks, falling back to empty landmarks'
                        })
                    }
                    loading.stop(async)
                    resolve(json)
                }
            })
        })
    }

    saveLandmarkGroup(id: string, type: string, json: LJSONFile) {
        const fpath = `${withoutExt(this.pathFromId(id))}_${type}.ljson`
        const async = loading.start()
        const annotationComplete: boolean = checkCompleteAnnotation(json)
        // TODO: check for changed completed annotation
        const validTrainingAnnotation: boolean = annotationComplete
            && (this._fullyAnnotatedAssets[withoutExt(id)] === undefined || !equivalentLJSON(json, this._fullyAnnotatedAssets[withoutExt(id)]))
        if (validTrainingAnnotation) {
            this._fullyAnnotatedAssets[withoutExt(id)] = json
            this._toBeTrained.push(id)
        }
        return new Promise((resolve, reject) => {
            if (this._deformableModelRefreshDue() && validTrainingAnnotation) {
                fs.writeFile(fpath, JSON.stringify(json), 'utf8', (err) => {
                    if (err) {
                        loading.stop(async)
                        reject(err)
                    } else {
                        this._refreshDeformableModel(type).then(() => {
                            loading.stop(async)
                            resolve()
                        }, (err: any) => {
                            // account for abort
                            if (!err.message || err.message !== 'Aborted') {
                                notify({type: 'error', msg: (err.message || err)})
                            }
                            if (err.message === 'Aborted') {
                                notify({type: 'success', msg: 'Deformable model refresh aborted sucessfully'})
                            }
                            loading.stop(async)
                            resolve()
                        })
                    }
                })
                return
            }
            fs.writeFile(fpath, JSON.stringify(json), 'utf8', (err) => {
                if (err) {
                    loading.stop(async)
                    reject(err)
                } else {
                    loading.stop(async)
                    resolve()
                }
            })
        })
    }

    // Handle the drag and drop logic for assets and templates:
    // - only one type of files at a time (ignore anything that does not
    //   match the first recognized type)
    handleDragDrop(files) {

        let dropType, ext
        const async = loading.stop(async)
        const promises = []

        files.forEach((file, i) => {
            ext = extname(file.name)

            // Set the DROP_TYPE to the first we see, ignore anything else
            if (!dropType) {
                if (this.isValidAssetExtension(ext)) {
                    dropType = DROP_TYPE.ASSET
                } else if (ext in Template.Parsers) {
                    dropType = DROP_TYPE.TEMPLATE
                }
            }

            if (dropType === DROP_TYPE.ASSET) {
                // Ignore anything we already know about
                if (this._assets.indexOf(file.path) === -1) {
                    promises.push(Promise.resolve(this.setFileAsset(file.path)))
                } else {
                    notify({msg: `Asset ${file.name} already exists`})
                }
            } else if (dropType === DROP_TYPE.TEMPLATE) {
                promises.push(this.addTemplate(file.path))
            } else {
                console.log('Drag/Drop: ignoring', file.path)
            }
        })

        if (promises.length === 0) {
            console.log('Drag/Drop: nothing to do')
            return
        }

        // Resolve if any of the promises has resolved, after all have terminated
        _anyPromise(promises).then((result) => {
            loading.stop(async)
            if (dropType === DROP_TYPE.ASSET) {
                this.computeCollection(true)
            } else if (dropType === DROP_TYPE.TEMPLATE) {
                notify({type: 'success', msg: 'Successfully imported templates'})
                bus.emit(EVENTS.FS_NEW_TEMPLATE, result)
            }
        }, (errs) => {
            loading.stop(async)
            console.log(`Failed to process dropped content`, errs)
        })

    }

    refreshTrainingAssets(type: string): void {
        // Initial array of training assets
        this._fetchAndSetFullyAnnotatedAssets(type).then(() => {}, (err) => {
            console.log(err.message)
        })
    }

    fetchMeanShape(type: string): Promise<LJSONFile> {
        const tmpl = this._templates[type]
        if (this.callingMenpo) {
            return new Promise<{}>((resolve, reject) => reject(new Error('Fetching mean shape failed - conflict with another Menpo call')))
        }
        const async = loading.start()
        const postPromise = postJSON(this.url + 'get_mean_shape', {data: {
                                fpath: commonPrefixFromArray(this._assets),
                                group: type
                            }})
        this.menpoXhr = postPromise.xhr()
        this.menpoCallMessage = 'Fetching initial shape...'
        this.callingMenpo = true
        return new Promise<LJSONFile>((resolve, reject) => {
            postPromise.then((json: any) => {
                json.version = 2
                // Menpofit messes with the connectivity
                const [ok, ljson] = softValidateAndCorrect(json, tmpl, 2)
                if (!ok) {
                    notify({
                        msg: 'Found invalid landmarks, falling back to empty landmarks'
                    })
                }
                loading.stop(async)
                this._closeMenpoCall()
                resolve(ljson)
            }, (err: any) => {
                // hopefully an abort
                loading.stop(async)
                this._closeMenpoCall()
                reject(err)
            })
        })
    }

    fetchFittedShape(ljsonFile: LJSONFile, imgId: string, type: string): Promise<LJSONFile> {
        const imgPath = this.pathFromId(imgId)
        const tmpl = this._templates[type]
        if (this.callingMenpo) {
            return new Promise<{}>((resolve, reject) => reject(new Error('Fetching refined shape failed - conflict with another Menpo call')))
        }
        const async = loading.start()
        const postPromise = postJSON(this.url + 'get_fit', {data: {
                                fpath: commonPrefixFromArray(this._assets),
                                path: imgPath,
                                ljson: JSON.stringify(ljsonFile),
                                group: type
                            }})
        this.menpoXhr = postPromise.xhr()
        this.menpoCallMessage = 'Fetching refined shape...'
        this.callingMenpo = true
        return new Promise<LJSONFile>((resolve, reject) => {
            postPromise.then((json: any) => {
                json.version = 2
                // Menpofit messes with the connectivity
                const [ok, ljson] = softValidateAndCorrect(json, tmpl, 2)
                if (!ok) {
                    notify({
                        msg: 'Found invalid landmarks, falling back to empty landmarks'
                    })
                }
                loading.stop(async)
                this._closeMenpoCall()
                resolve(ljson)
            }, (err: any) => {
                // hopefully an abort
                loading.stop(async)
                this._closeMenpoCall()
                reject(err)
            })
        })
    }

    _fetchAndSetFullyAnnotatedAssets(type: string): Promise<{}> {
        if (this.callingMenpo) {
            if (this.menpoCallMessage === 'Fetching completed annotations...') {
                // Fail silently. We expect these calls to step on each other at times.
                return new Promise<{}>((resolve) => resolve())
            }
            return new Promise<{}>((resolve, reject) => reject(new Error('Fetching completed annotations failed - conflict with another Menpo call')))
        }
        const async = loading.start()
        const postPromise = postJSON(this.url + 'get_completed_annotations', {data: {
                                fpath: commonPrefixFromArray(this._assets),
                                group: type
                            }})
        const tmpl = this._templates[type]
        this.menpoXhr = postPromise.xhr()
        this.menpoCallMessage = 'Fetching completed annotations...'
        this.callingMenpo = true
        return new Promise<{}>((resolve, reject) => {
            postPromise.then((json: any) => {
                for (let assetBaseId in json) {
                    let assetJson = json[assetBaseId]
                    assetJson.version = 2
                    // Menpofit messes with the connectivity
                    const [ok, ljson]: [boolean, LJSONFile] = softValidateAndCorrect(assetJson, tmpl, 2)
                    if (!ok) {
                        notify({
                            msg: 'Found invalid landmarks, skipping over annotation'
                        })
                        continue
                    }
                    this._fullyAnnotatedAssets[assetBaseId] = ljson
                }
                loading.stop(async)
                this._closeMenpoCall()
                resolve()
            }, (err: any) => {
                // hopefully an abort
                loading.stop(async)
                this._closeMenpoCall()
                reject(err)
            })
        })
    }

    _deformableModelRefreshDue(): boolean {
        return this.automaticAnnotationOn() && (Object.keys(this._fullyAnnotatedAssets).length - this.minimumTrainingAssets) % this.automaticAnnotationInterval === 0
            && this._toBeTrained.length >= 2
        // note: the last constraint is due to the backend's inability to increment deformable models with a single image
    }

    automaticAnnotationOn(): boolean {
        return Object.keys(this._fullyAnnotatedAssets).length >= this.minimumTrainingAssets
    }

    _refreshDeformableModel(type: string): Promise<{}> {
        if (this.callingMenpo) {
            return new Promise<{}>((resolve, reject) => reject(new Error('Updating deformable model failed - conflict with another Menpo call')))
        }
        const postPromise = postJSON(this.url + 'build_aam', {data: {
                                fpath: commonPrefixFromArray(this._assets),
                                paths: this._toBeTrained.map((id: string) => {return this.pathFromId(id)}),
                                group: type
                            }})
        this.menpoXhr = postPromise.xhr()
        this.menpoCallMessage = 'Updating deformable model...'
        this.callingMenpo = true
        return new Promise<{}>((resolve, reject) => {
            postPromise.then(() => {
                this._toBeTrained = []
                this._closeMenpoCall()
                resolve()
            }, (err: any) => {
                // hopefully an abort
                this._closeMenpoCall()
                reject(err)
            })
        })
    }

    _closeMenpoCall(): void {
        this.menpoCallMessage = ''
        this.callingMenpo = false
        this.menpoXhr = undefined
    }

    cancelMenpoCall(): void {
        if (!this.menpoXhr || !this.callingMenpo) {
            return
        }
        this.menpoXhr.abort()
        // 'this.menpoXhr = undefined' is covered by 'then' clauses
    }

}
