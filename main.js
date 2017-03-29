'use strict';

const { app, dialog, BrowserWindow, ipcMain } = require('electron');

require('electron').crashReporter.start({companyName: 'menpo', submitURL: '', uploadToServer: false});

var APP_NAME = 'Landmarker';
var INDEX = 'file://' + __dirname + '/app/index.html';

var mainWindow;

function createMainWindow () {

    var _window = new BrowserWindow({
        title: APP_NAME,
        width: 1200,
        height: 960,
        center: true,
        resizable: true,
        'web-preferences': {
            webgl: true
        }
    });

    _window.loadURL(INDEX);
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
ipcMain.on('close', function () {
    app.quit()
});

ipcMain.on('fs-backend-select-assets', function () {
    dialog.showOpenDialog(mainWindow, {
        title: 'Select Assets Folder',
        properties: ['openFile', 'openDirectory', 'multiSelections']
    }, function (filenames) {
        if (filenames) {
            mainWindow.send('fs-backend-selected-assets', filenames);
        } else {
            mainWindow.send('cancel-fs-assets-select');
        }
    });
});

ipcMain.on('fs-backend-select-template', function () {
    dialog.showOpenDialog(mainWindow, {
        title: 'Select Template',
        properties: ['openFile', 'multiSelections'],
        filters: [{
            name: 'Templates', extensions: ['yaml', 'yml', 'json', 'ljson']
        }]
    }, function (filenames) {
        if (filenames) {
            mainWindow.send('fs-backend-selected-template', filenames);
        }
    });
});
