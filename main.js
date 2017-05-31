'use strict';

const { app, dialog, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const request = require('request-json');
const path = require('path');
const isDev = require('electron-is-dev');
const appVersion = require('./package.json').version;

require('electron').crashReporter.start({companyName: 'menpo', submitURL: '', uploadToServer: false});

var APP_NAME = 'Landmarker';
var INDEX = 'file://' + __dirname + '/app/index.html';
var CLIENT = request.createClient('https://api.github.com/repos/menpo/landmarker-app/');
CLIENT.headers['Accept'] = 'application/vnd.github.v3+json';

autoUpdater.autoDownload = false;

const MENPO_PORT = '5001';
const MENPO_DIST_FOLDER = 'menpodist'
const MENPO_FOLDER = 'menpo'
const MENPO_MODULE = 'api'
var menpoProcess = null;

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
    //_window.openDevTools();
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
    createPyProc();
    mainWindow = createMainWindow();
});

app.on('will-quit', function () {
    exitPyProc();
});

ipcMain.on('close', function () {
    app.quit();
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

ipcMain.on('check-for-updates', function (event, notifyNoUpdates) {
    if (isDev || process.platform === 'linux' || autoUpdater === undefined
    || autoUpdater.checkForUpdates === undefined) {
        checkLatestVersion(notifyNoUpdates);
    } else {
        mainWindow.send('menu-disable-check-for-updates');
        autoUpdater.checkForUpdates().then(handleUpdateCheck.bind(null, notifyNoUpdates));
    }
});

function checkLatestVersion(notifyNoUpdates) {
    CLIENT.get('releases/latest', function(err, res, body) {
        if (err || body === undefined || body.tag_name === undefined) {
            dialog.showErrorBox('Error', 'Error encountered when checking for updates:\n\n' + (err || 'Empty response.'));
            return;
        }
        var version = body.tag_name;
        version = version.replace(/[a-zA-Z]/g, '');
        if (version === appVersion && notifyNoUpdates) {
            const options = {
                type: 'info',
                title: 'No updates available',
                message: 'There are no updates available. This is the latest version of Landmarker.'
            };
            dialog.showMessageBox(mainWindow, options);
        } else if (version !== appVersion) {
            const options = {
                type: 'question',
                title: 'Update available',
                buttons: ['Yes', 'No'],
                message: 'There is a new update available. Would you like to visit the download page now?'
            };
            const install = dialog.showMessageBox(mainWindow, options);
            if (install === 0) {
                shell.openExternal('https://github.com/menpo/landmarker-app/releases');
            }
        }
    });
}

function handleUpdateCheck(notifyNoUpdates, updateCheckResult) {
    if (updateCheckResult.downloadPromise !== undefined) {
        const options = {
            type: 'question',
            title: 'Update available',
            buttons: ['Yes', 'No'],
            message: 'There is a new update available. Would you like to download it now?'
        };
        const install = dialog.showMessageBox(mainWindow, options);
        if (install === 0) {
            mainWindow.send('menu-rename-check-for-updates', 'Downloading update...');
            autoUpdater.downloadUpdate(updateCheckResult.cancellationToken);
        } else {
            mainWindow.send('menu-reset-check-for-updates');
        }
    } else {
        if (notifyNoUpdates) {
            const options = {
                type: 'info',
                title: 'No updates available',
                message: 'There are no updates available. This is the latest version of Landmarker.'
            };
            dialog.showMessageBox(mainWindow, options);
        }
        mainWindow.send('menu-reset-check-for-updates');
    }
}

// Autoupdate listeners

autoUpdater.on('error', (ev, err) => {
    mainWindow.send('menu-reset-check-for-updates');
    dialog.showErrorBox('Error', 'Error encountered when checking for updates:\n\n' + err);
});

autoUpdater.on('download-progress', (ev, progressObj) => {
    mainWindow.send('menu-rename-check-for-updates', 'Downloading update (' + progressObj.percent + '%)');
});

autoUpdater.on('update-downloaded', (ev, info) => {
    mainWindow.send('menu-rename-check-for-updates', 'Update downloaded');
    const options = {
        type: 'question',
        buttons: ['Yes', 'No'],
        message: 'The update has finished downloading and will be installed when you quit. Would you like to restart the application now?'
    };
    const install = dialog.showMessageBox(mainWindow, options);
    if (install === 0) {
        autoUpdater.quitAndInstall();
    }
});

// Menpo child process

function getScriptPath () {
    if (isDev) {
        return path.join(__dirname, MENPO_FOLDER, MENPO_MODULE + '.py');
    }
    if (process.platform === 'win32') {
        return path.join(__dirname, MENPO_DIST_FOLDER, MENPO_MODULE, MENPO_MODULE + '.exe');
    }
    return path.join(__dirname, MENPO_DIST_FOLDER, MENPO_MODULE, MENPO_MODULE);
}

function createPyProc () {
    let port = MENPO_PORT;
    let script = getScriptPath();

    if (isDev) {
        menpoProcess = require('child_process').spawn('python', [script, port]);
    } else {
        menpoProcess = require('child_process').execFile(script, [port]);
    }
}

function exitPyProc () {
    menpoProcess.kill();
    menpoProcess = null;
}
