import { remote, shell, ipcRenderer } from 'electron'
const { Menu } = remote

import bus, * as EVENTS from './bus'

const emptyMenuTemplate = [{
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
        label: 'Hide others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
    }, {
        label: 'Show all',
        selector: 'unhideAllApplications:'
    }, {
        type: 'separator'
    }, {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: function() {
            remote.getCurrentWindow().close()
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

const mainMenuTemplate = [{
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
        label: 'Hide others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
    }, {
        label: 'Show all',
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
            remote.getCurrentWindow().close()
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
        label: 'Open template',
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
    }, {
        // Warning! If the position of the 'Help' menu item or the position of this submenu changes,
        // then the code below that references this item needs to be altered.
        label: 'Check for updates',
        click: function() {
            ipcRenderer.send('check-for-updates', true)
        }
    }]
}]

const emptyMenu = Menu.buildFromTemplate(emptyMenuTemplate)
const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)

// Warning! This code is dependent on the exact position of this menu item!
const checkForUpdatesMenuItem = mainMenu.items[2].submenu.items[2]

Menu.setApplicationMenu(emptyMenu)

ipcRenderer.on('menu-reset-check-for-updates', function() {
    checkForUpdatesMenuItem.enabled = true
    checkForUpdatesMenuItem.label = 'Check for updates'
})

ipcRenderer.on('menu-disable-check-for-updates', function() {
    checkForUpdatesMenuItem.enabled = false
    checkForUpdatesMenuItem.label = 'Checking for updates...'
})

ipcRenderer.on('menu-rename-check-for-updates', function(label) {
    checkForUpdatesMenuItem.label = label
})

export default function() {
    Menu.setApplicationMenu(mainMenu)
}
