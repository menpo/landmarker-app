# Electron.App

Run [landmarker.io](https://github.com/menpo/landmarker.io) on local files.

This is an [electron-shell](https://github.com/atom/electron) wrapper around the landmarker too with a filesystem backed implementation to work on local files.

The current version and the `FSBackend` implementation are working, with drag and drop support for assets and templates, as well as a separate server mode identical to the one available in the web app. There is no real native specific behaviors currently implemented other than using the filesystem.

## Development

+ The original landmarker code is pulled as a git submodule, `npm run submodule` will pull the latest changes.
+ We compile our code through browserify and exclude node modules as they are available from the electron environment. Run `npm run build:js` to build once and `npm run watch:js` to build continuously with source maps.
+ New code goes into `app/js`
+ Run the app with 'npm start', if you are running watchify at the same time, there is no need to restart as the changes can be seen by reloading (`CMD+R`).

## Building binaries

We use [electron-packager](https://github.com/maxogden/electron-packager) for building platform specific binaries.

The `package.json` exposes the build scripts, but we haven't implemented any step to build installers, signing the files and auto updates (or at least updates notifications).

The github release page currently (0.1.0) lists zip files which you can download and unpack manually. The mac version can be moved and run from anywhere, while the windows and linux version need to be run from the folder they come in.
