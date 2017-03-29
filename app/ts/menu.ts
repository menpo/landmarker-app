import { remote, shell } from 'electron'
const { Menu } = remote

import bus, * as EVENTS from './bus'

const emptyMenu = [{
    label: 'Landmarker',
    submenu: [{
        label: 'About',
        click: function() {
            shell.openExternal('https://github.com/menpo/landmarker-app')
        }
    }, {
        type: 'separator'
    }, {
        label: 'Services',
        submenu: []
    }, {
        type: 'separator'
    }, {
        label: 'Hide window',
        accelerator: 'Command+H',
        selector: 'hide:'
    }, {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
    }, {
        label: 'Show All',
        selector: 'unhideAllApplications:'
    }, {
        type: 'separator'
    }, {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: function() {
            remote.require('app').quit()
        }
    }]
}, {
    label: 'Help',
    submenu: [{
        label: 'User Guide',
        click: function() {
            shell.openExternal('https://github.com/menpo/landmarker.io/wiki/User-guide')
        }
    }]
}]

const mainMenu = [{
    label: 'Landmarker',
    submenu: [{
        label: 'About',
        click: function() {
            shell.openExternal('https://github.com/menpo/landmarker-app')
        }
    }, {
        type: 'separator'
    }, {
        label: 'Services',
        submenu: []
    }, {
        type: 'separator'
    }, {
        label: 'Hide window',
        accelerator: 'Command+H',
        selector: 'hide:'
    }, {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
    }, {
        label: 'Show All',
        selector: 'unhideAllApplications:'
    }, {
        type: 'separator'
    }, {
        label: 'Restart',
        accelerator: 'Super+R',
        click: () => bus.emit(EVENTS.RESTART)
    }, {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: function() {
            remote.require('app').quit()
        }
    }]
}, {
    label: 'File',
    submenu: [{
        label: 'Open files',
        accelerator: 'Super+O',
        click: () => bus.emit(EVENTS.OPEN_FILES)
    }, {
        label: 'Save',
        accelerator: 'Super+S',
        click: () => bus.emit(EVENTS.SAVE)
    }, {
        label: 'Export',
        accelerator: 'Super+Shift+S',
        click: () => bus.emit(EVENTS.EXPORT)
    }, {
        label: 'Open Template',
        accelerator: 'Super+T',
        click: () => bus.emit(EVENTS.OPEN_TEMPLATE)
    }]
}, {
    label: 'Help',
    submenu: [{
        label: 'Keyboard Shortcuts',
        click: () => bus.emit(EVENTS.SHOW_HELP)
    }, {
        label: 'User Guide',
        click: function() {
            shell.openExternal('https://github.com/menpo/landmarker.io/wiki/User-guide')
        }
    }]
}]

Menu.setApplicationMenu(Menu.buildFromTemplate(emptyMenu))

export default function() {
    Menu.setApplicationMenu(Menu.buildFromTemplate(mainMenu))
}
