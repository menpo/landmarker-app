'use strict';

var app = require('app');
var BrowserWindow = require('browser-window');
var dialog = require('dialog');
var ipc = require('ipc');

// report crashes to the Electron project
require('crash-reporter').start();
// adds debug features like hotkeys for triggering dev tools and reload
// require('electron-debug')();

require('electron-compile').init();

var mainWindow; // prevent window being GC'd

function createMainWindow () {
    var win = new BrowserWindow({
        width: 1200,
        height: 960,
        center: true,
        resizable: true,
        title: 'Landmarker'
    });

    win.loadUrl(`file://${__dirname}/app/index.html`);
    win.on('closed', onClosed);

    return win;
}

function onClosed () {
    // deref the window
    // for multiple windows store them in an array
    mainWindow = null;
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate-with-no-open-windows', function () {
    if (!mainWindow) {
        mainWindow = createMainWindow();
    }
});

app.on('ready', function () {
    mainWindow = createMainWindow();
});

ipc.on('fs-backend-select-assets', function () {
    dialog.showOpenDialog(mainWindow, {
        title: 'Select Assets Folder',
        properties: [ 'openDirectory' ]
    }, function (filenames) {
        if (filenames) {
            mainWindow.send('fs-backend-selected-assets', filenames);
        }
    });
});
