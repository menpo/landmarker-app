# Electron.App

This app allows the user to run [landmarker.io](https://github.com/menpo/landmarker.io) on local files.

This is an [electron](https://github.com/atom/electron) wrapper around landmarker.io with a filesystem backed implementation to work on local files.

The current version and the `FSBackend` implementation are working, with drag and drop support for assets and templates, as well as a separate server mode identical to the one available in the web app. There is no real native specific behaviors currently implemented other than using the filesystem.

## Development

+ The original landmarker code is pulled as a git submodule, `npm run submodule` will pull the latest changes.
+ We compile our code through webpack. Run `npm run build` to build once and `npm run watch` to build continuously with source maps.
+ New code goes into `app/ts`. This code is written in TypeScript, although `main.js` is written in JavaScript.
+ Build (without `watch` mode) and run the app with `npm run start`.
+ If you would like to run webpack in `watch` mode and also run the Electron app, then you should run `npm run watch` in one terminal and then run `npm run electron` in another.
+ If you are running webpack in `watch` mode at the same time, there is no need to restart the Electron app as the changes can be seen by reloading (`CMD+R`).

## Building binaries

We now use [electron-builder](https://github.com/electron-userland/electron-builder/) for building and publishing platform specific binaries.

The GitHub release page currently (0.1.0) lists zip files which were built with the previous packaging method (using electron-packager) which you can download and unpack manually. The mac version can be moved and run from anywhere, while the windows and linux version need to be run from the folder they come in. These are the compressed folder as built by electron-packager.
