'use strict';

// require('crash-reporter').start();

var app = require('app');
var BrowserWindow = require('browser-window');
var dialog = require('dialog');
var ipc = require('ipc');
var Menu = require('menu');
var MenuItem = require('menu-item');

require('electron-compile').init();

var APP_NAME = 'Landmarker';
var INDEX = 'file://' + __dirname + '/app/index.html';

var mainWindow;

function createMainWindow () {

    var _window = new BrowserWindow({
        title: APP_NAME,
        width: 1200,
        height: 960,
        center: true,
        resizable: true
    });

    _window.loadUrl(INDEX);
    _window.on('closed', onClosed);
    _window.openDevTools();
    return _window;
}

function onClosed () {
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
ipc.on('close', function () {
    app.quit()
});

ipc.on('fs-backend-select-assets', function () {
    dialog.showOpenDialog(mainWindow, {
        title: 'Select Assets Folder',
        properties: ['openDirectory']
    }, function (filenames) {
        if (filenames) {
            mainWindow.send('fs-backend-selected-assets', filenames);
        }
    });
});

ipc.on('fs-backend-select-template', function (exts) {
    dialog.showOpenDialog(mainWindow, {
        title: 'Select Template',
        properties: ['openFile']
    }, function (filenames) {
        if (filenames) {
            mainWindow.send('fs-backend-selected-template', filenames);
        }
    });
});
