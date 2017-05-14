import { ipcRenderer } from 'electron'

interface LandmarkerPreferences {
    templateDir: string
}

var templateDir: string
var templateDirField: HTMLInputElement
var prefsApplyButton: HTMLButtonElement
var restoreDefaultsButton: HTMLButtonElement
var templateDirBrowseButton: HTMLButtonElement

function init() {
    templateDirField = <HTMLInputElement>document.getElementById('template-dir-field')
    prefsApplyButton = <HTMLButtonElement>document.getElementById('apply-prefs')
    restoreDefaultsButton = <HTMLButtonElement>document.getElementById('restore-default')
    templateDirBrowseButton = <HTMLButtonElement>document.getElementById('template-dir-browse')

    // Set up ipc listeners
    ipcRenderer.on('template-dir-found', (event, templDir: string) => {
        setPreferences({templateDir: templDir})
        restoreDefaultsButton.disabled = false
        templateDirField.addEventListener('input', () => {
            prefsApplyButton.disabled = templateDirField.value === templateDir
        })
    })
    ipcRenderer.on('preferences-updated', (event, prefs: LandmarkerPreferences) => {
        setPreferences(prefs)
    })
    ipcRenderer.on('template-dir-selected', (event, filepaths: string[]) => {
        templateDirField.value = filepaths[0]
        // Check if apply button should be enabled
        prefsApplyButton.disabled = templateDirField.value === templateDir
    })
    // Set up button listeners
    prefsApplyButton.onclick = () => {
        ipcRenderer.send('update-preferences', {
            templateDir: templateDirField.value
        })
    }
    restoreDefaultsButton.onclick = () => {
        ipcRenderer.send('restore-default-prefs')
    }
    templateDirBrowseButton.onclick = () => {
        ipcRenderer.send('select-template-dir')
    }
    // Send request for initial preferences
    ipcRenderer.send('find-template-dir')
}

function setPreferences(preferences: LandmarkerPreferences) {
    templateDir = preferences.templateDir
    templateDirField.value = preferences.templateDir
    prefsApplyButton.disabled = true
}

document.addEventListener('DOMContentLoaded', () => {
    init()
})
