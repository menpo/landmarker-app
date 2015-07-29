'use strict';

import $ from 'jquery';

import Modal from '../../landmarker.io/src/js/app/view/modal';
import Backend from '../../landmarker.io/src/js/app/backend';
import { baseUrl } from '../../landmarker.io/src/js/app/lib/utils';

import bus, {START_WITH_FS, START_WITH_SERVER} from './bus';

import {version} from '../../package.json';

const contents = `\
<div class='Intro'>\
    <h1>Landmarker.App</h1>\
    <h3>v${version}</h3>\
    <div class='IntroItems'>\
        <div class='IntroItem IntroItem--fs3d'>\
            Load 3D files from your hard drive
        </div>\
        <div class='IntroItem IntroItem--fs2d'>\
            Load pictures from your hard drive
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
`;

const Intro = Modal.extend({

    closable: false,
    modifiers: ['Small'],

    events: {
        'click .IntroItem--Server': 'startServer',
        'click .IntroItem--fs3d': 'startFS3d',
        'click .IntroItem--fs2d': 'startFS2d'
    },

    init: function ({cfg}) {
        this._cfg = cfg;
    },

    content: function () {
        const $contents = $(contents);
        return $contents;
    },

    startServer: function () {
        Modal.prompt('Where is your server located ?', (value) => {
            bus.emit(START_WITH_SERVER, value);
            this.close();
        }, () => {});
    },

    startFS3d: function () {
        bus.emit(START_WITH_FS, 'mesh');
        this.close();
    },

    startFS2d: function () {
        bus.emit(START_WITH_FS, 'image');
        this.close();
    }
});

let instance;
export default {
    init: function (opts) { instance = new Intro(opts); },

    open: function () {
        instance._cfg.clear();
        instance.open();
    },

    close: function () { instance.close(); },
    initialized: function () { return !!instance; }
};
