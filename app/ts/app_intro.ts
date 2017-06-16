import * as $ from 'jquery'

import Modal from '../../landmarker.io/src/ts/app/view/modal'

import bus, {START_WITH_FS, START_WITH_FS_SS, START_WITH_SERVER} from './bus'

import {version} from '../../package.json'

const contents = `\
<div class='Intro'>\
    <h1>Landmarker.App</h1>\
    <h3>v${version}</h3>\
    <div class='IntroItems'>\
        <div class='IntroItem IntroItem--fs3d'>\
            Load 3D files from your hard drive
        </div>\
        <div class='IntroItem IntroItem--fs2d'>\
            Load images from your hard drive
        </div>\
        <div class='IntroItem IntroItem--fs2dss'>\
            Semi-supervised image annotation
        </div>\
        <div class='IntroItem IntroItem--Server'>\
            <span class="octicon octicon-globe"></span>\
            <div>Connect to a remote server</div>\
        </div>\
    </div>\
    <a href="https://github.com/menpo/landmarker.app" class='IntroFooter'>\
        <span class="octicon octicon-mark-github"></span>\
        More info on Github\
    </a>\
</div>\
`

const Intro = Modal.extend({

    closable: false,
    modifiers: ['Small'],

    events: {
        'click .IntroItem--Server': 'startServer',
        'click .IntroItem--fs3d': 'startFS3d',
        'click .IntroItem--fs2d': 'startFS2d',
        'click .IntroItem--fs2dss': 'startFS2dSemiSupervised'
    },

    init: function ({cfg}) {
        this._cfg = cfg
    },

    content: function () {
        const $contents = $(contents)
        return $contents
    },

    startServer: function () {
        Modal.prompt('Where is your server located ?', (value) => {
            bus.emit(START_WITH_SERVER, value)
            this.close()
        }, () => {})
    },

    startFS3d: function () {
        bus.emit(START_WITH_FS, 'mesh')
        this.close()
    },

    startFS2d: function () {
        bus.emit(START_WITH_FS, 'image')
        this.close()
    },

    startFS2dSemiSupervised: function () {
        bus.emit(START_WITH_FS_SS, 'image')
        // TODO remove mesh functionality
        this.close()
    }
})

let instance
export default {
    init: function (opts) { instance = new Intro(opts) },

    open: function () {
        instance._cfg.clear()
        instance.open()
    },

    close: function () { instance.close() },
    initialized: function () { return !!instance }
}
