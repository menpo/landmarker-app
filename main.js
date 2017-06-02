'use strict';

const { app, dialog, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const request = require('request-json');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const isDev = require('electron-is-dev');
const appVersion = require('./package.json').version;

require('electron').crashReporter.start({companyName: 'menpo', submitURL: '', uploadToServer: false});

const APP_NAME = 'Landmarker';
const PREFERENCES_NAME = 'Preferences';
const INDEX = 'file://' + __dirname + '/app/index.html';
const PREFERENCES = 'file://' + __dirname + '/app/preferences.html';
const CLIENT = request.createClient('https://api.github.com/repos/menpo/landmarker-app/');
CLIENT.headers['Accept'] = 'application/vnd.github.v3+json';

const USER_DATA_DIR = app.getPath('userData');
const DEFAULT_TEMPLATE_DIR = path.join(USER_DATA_DIR, 'usertemplates');
const PREFERENCES_FILE = path.join(USER_DATA_DIR, 'preferences.json')
const DEFAULT_PREFERENCES = {
    templateDir: DEFAULT_TEMPLATE_DIR
}

var cachedPreferences;

// Stop autoUpdate from downloading the update without the user's permission
autoUpdater.autoDownload = false;

var mainWindow, preferencesWindow;

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
    _window.on('closed', function() {
        mainWindow = null;
    });
    //_window.openDevTools();
    return _window;
}

function createPreferencesWindow () {
    var _window = new BrowserWindow({
        title: PREFERENCES_NAME,
        width: 445,
        height: 80,
        resizable: false,
        parent: mainWindow
    });

    _window.loadURL(PREFERENCES);
    _window.on('closed', function() {
        preferencesWindow = null;
    });
    //_window.openDevTools();
    return _window;
}

function createDirIfNotPresent (dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    } else if (!fs.lstatSync(dirPath).isDirectory()) {
        fs.unlinkSync(dirPath);
        fs.mkdirSync(dirPath);
    }
}

function createPreferencesFileIfNotPresent () {
    if (!fs.existsSync(PREFERENCES_FILE)) {
        // Preferences file does not exist
        fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(DEFAULT_PREFERENCES));
        cachedPreferences = DEFAULT_PREFERENCES;
    } else {
        var preferences;
        try {
            // Check that syntax is valid
            preferences = JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8'));
            // Check that structure is valid
            if (preferences.templateDir === undefined) {
                // Add default template directory to preferences
                preferences.templateDir = DEFAULT_TEMPLATE_DIR;
                fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(preferences));
            }
            cachedPreferences = preferences;
        } catch(e) {
            // Syntax invalid - replace with defaults
            fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(DEFAULT_PREFERENCES));
            cachedPreferences = DEFAULT_PREFERENCES;
        }
    }
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
    // Use synchronous operations in initialisation
    createDirIfNotPresent(USER_DATA_DIR);
    // Create prefs file if not present and restore it to defaults if it is invalid
    createPreferencesFileIfNotPresent();
    createDirIfNotPresent(DEFAULT_TEMPLATE_DIR);
    // Check that current template directory exists
    const preferences = JSON.parse(fs.readFileSync(PREFERENCES_FILE, 'utf8'));
    createDirIfNotPresent(preferences.templateDir);
    mainWindow = createMainWindow();
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

ipcMain.on('open-preferences', function() {
    preferencesWindow = createPreferencesWindow();
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

ipcMain.on('save-template', function (event, title, yamlObj) {
    const templateFile = path.join(cachedPreferences.templateDir, title + '.yml');
    fs.exists(templateFile, (exists) => {
        if (exists) {
            mainWindow.send('template-saved', 'The template title already exists');
        } else {
            let yamlString;
            try {
                yamlString = yaml.safeDump(yamlObj);
            } catch(e) {
                mainWindow.send('template-saved', e.message);
                return;
            }
            fs.writeFile(templateFile, yaml.safeDump(yamlObj), (err) => {
                if (err) {
                    mainWindow.send('template-saved', err);
                    return;
                }
                mainWindow.send('template-saved');
            });
        }
    });
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
};

// Preferences listeners

ipcMain.on('find-template-dir', () => {
    preferencesWindow.send('template-dir-found', cachedPreferences.templateDir);
});

ipcMain.on('update-preferences', (event, prefs) => {
    // Check that the filepath is valid
    fs.exists(prefs.templateDir, (exists) => {
        if (exists) {
            fs.writeFile(PREFERENCES_FILE, JSON.stringify(prefs), () => {
                cachedPreferences = prefs;
                preferencesWindow.send('preferences-updated', prefs);
            });
        } else {
            dialog.showErrorBox('Error', 'This directory does not exist. Please enter a valid filepath.');
        }
    });
});

ipcMain.on('restore-default-prefs', () => {
    const options = {
        type: 'question',
        buttons: ['Yes', 'No'],
        message: 'Are you sure you want to restore default preferences? This operation cannot be undone.'
    };
    const install = dialog.showMessageBox(preferencesWindow, options);
    if (install === 0) {
        fs.writeFile(PREFERENCES_FILE, JSON.stringify(DEFAULT_PREFERENCES), (err) => {
            cachedPreferences = DEFAULT_PREFERENCES;
            preferencesWindow.send('preferences-updated', DEFAULT_PREFERENCES);
        });
    }
});

ipcMain.on('select-template-dir', () => {
    dialog.showOpenDialog(preferencesWindow, {
        title: 'Select User Template Directory',
        properties: ['openDirectory', 'createDirectory']
    }, function (filepaths) {
        if (filepaths) {
            preferencesWindow.send('template-dir-selected', filepaths);
        }
    });
});

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
