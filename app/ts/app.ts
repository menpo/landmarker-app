import { App, AppOptions } from '../../landmarker.io/src/ts/app/model/app'
import { notify } from '../../landmarker.io/src/ts/app/view/notification'
import { ipcRenderer } from 'electron'

interface YamlGroup {
    label: string
    points: number
    connectivity?: string[]
}

export enum AuxModalType {
    TEMPLATE_CREATION
}

export interface TemplateLandmarkConnectionState {
    first?: string
    second?: string
}

export interface TemplateGroupState {
    label?: string
    landmarks?: string
    connectivityInfoVisible: boolean
    directConnections: TemplateLandmarkConnectionState[]
    chainedConnections: TemplateLandmarkConnectionState[]
}

export interface TemplateCreationModalState {
    templateTitle?: string
    groups: TemplateGroupState[]
}

type AuxModalState = TemplateCreationModalState

export class ExtendedApp extends App {

    constructor(opts: AppOptions) {
        super(opts)
        this.set('activeAuxModalType', undefined)
        this.set('activeAuxModalState', undefined)
    }

    get activeAuxModalType(): AuxModalType | undefined {
        return this.get('activeAuxModalType')
    }

    set activeAuxModalType(activeAuxModalType: AuxModalType | undefined) {
        this.set('activeAuxModalType', activeAuxModalType)
    }

    get activeAuxModalState(): AuxModalState | undefined {
        return this.get('activeAuxModalState')
    }

    set activeAuxModalState(activeAuxModalState: AuxModalState | undefined) {
        this.set('activeAuxModalState', activeAuxModalState)
    }

    openTemplateCreationModal(): void {
        this.activeAuxModalState = {
            groups: []
        }
        this.closableModal = true
        this.onModalClose = undefined
        this.setModalOpen()
        this.activeAuxModalType = AuxModalType.TEMPLATE_CREATION
    }

    setTemplateCreationTitle(title: string): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        modalState.templateTitle = title
        this.trigger('change:activeAuxModalType')
    }

    addTemplateCreationGroup(): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        let group: TemplateGroupState = {
            connectivityInfoVisible: false,
            directConnections: [],
            chainedConnections: []
        }
        modalState.groups.push(group)
        // re-render
        this.trigger('change:activeAuxModalType')
    }

    submitTemplateCreationForm(): void {
        let formErr: string | undefined = this.checkTemplateCreationForm()
        if (formErr) {
            notify({
                type: 'error',
                persist: false,
                msg: formErr
            })
            return
        }
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        const groups: YamlGroup[] = []
        for (let i = 0; i < modalState.groups.length; i++) {
            let groupState: TemplateGroupState = modalState.groups[i]
            let label: string = <string>groupState.label
            let points: number = parseInt(<string>groupState.landmarks)
            const connectivity: string[] = []
            for (let j = 0; j < groupState.directConnections.length; j++) {
                let connection = groupState.directConnections[j]
                connectivity.push(`${connection.first} ${connection.second}`)
            }
            for (let j = 0; j < groupState.chainedConnections.length; j++) {
                let connection = groupState.chainedConnections[j]
                connectivity.push(`${connection.first}:${connection.second}`)
            }
            let group: YamlGroup = {
                label,
                points
            }
            if (connectivity.length !== 0) {
                group.connectivity = connectivity
            }
            groups.push(group)
        }
        const yamlObject = {groups}
        ipcRenderer.on('template-saved', (event, errMsg?: string) => {
            ipcRenderer.removeAllListeners('template-saved')
            if (errMsg) {
                notify({
                    type: 'error',
                    persist: false,
                    msg: errMsg
                })
                return
            }
            this.closeModal()
            notify({
                type: 'success',
                persist: false,
                msg: 'Template saved'
            })
        })
        ipcRenderer.send('save-template', modalState.templateTitle, yamlObject)
    }

    checkTemplateCreationForm(): string | undefined {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        if (modalState.templateTitle === undefined || modalState.templateTitle === '') {
            return 'The template title has not been filled in'
        }
        if (/[^a-z0-9_\-\.]/gi.test(modalState.templateTitle)) {
            return 'The template title must consist only of alphanumeric characters and the following: [., _, -]'
        }
        if (modalState.groups.length === 0) {
            return 'The template must have a least one group'
        }
        let labels: string[] = modalState.groups.map((groupState: TemplateGroupState) => {
            return groupState.label !== undefined ? groupState.label : ''
        })
        for (let i = 0; i < modalState.groups.length; i++) {
            let templateGroupErr: string | undefined = this.checkTemplateGroupForm(i, modalState.groups[i], labels)
            if (templateGroupErr !== undefined) {
                return templateGroupErr
            }
        }
        return undefined
    }

    checkTemplateGroupForm(groupIndex: number, groupState: TemplateGroupState, labels: string[]): string | undefined {
        let labelsClone: string[] = labels.slice()
        labelsClone.splice(groupIndex, 1)
        if (groupState.label === undefined || groupState.label === '') {
            return `The label field for Group ${groupIndex+1} has not been filled in`
        }
        if (labelsClone.indexOf(groupState.label) > -1) {
            return `The label field for Group ${groupIndex+1} is not unique`
        }
        let landmarksErr: string | undefined = this.checkLandmarks(groupIndex, groupState)
        if (landmarksErr !== undefined) {
            return landmarksErr
        }
        for (let i = 0; i < groupState.directConnections.length; i++) {
            let connectionErr: string | undefined = this.checkTemplateConnectionForm(groupIndex, i, true, groupState, groupState.directConnections[i])
            if (connectionErr !== undefined) {
                return connectionErr
            }
        }
        for (let i = 0; i < groupState.chainedConnections.length; i++) {
            let connectionErr: string | undefined = this.checkTemplateConnectionForm(groupIndex, i, false, groupState, groupState.chainedConnections[i])
            if (connectionErr !== undefined) {
                return connectionErr
            }
        }
        return undefined
    }

    checkLandmarks(groupIndex: number, groupState: TemplateGroupState): string | undefined {
        let value = groupState.landmarks
        if (value === undefined || value === '') {
            return `The landmarks field for Group ${groupIndex+1} has not been filled in`
        }
        let landmarksNumber: number = parseInt(value)
        if (isNaN(landmarksNumber)) {
            return `The landmarks field for Group ${groupIndex+1} should be a number greater than 0`
        }
        if (landmarksNumber < 1) {
            return `The landmarks field for Group ${groupIndex+1} should be greater than 0`
        }
        return undefined
    }

    checkTemplateConnectionForm(groupIndex: number, connectionIndex: number, direct: boolean,
    groupState: TemplateGroupState, connectionState: TemplateLandmarkConnectionState): string | undefined {
        let firstFieldErr: string | undefined = this.checkTemplateConnectionField(groupIndex, connectionIndex, direct, true, groupState, connectionState)
        let secondFieldErr: string | undefined = this.checkTemplateConnectionField(groupIndex, connectionIndex, direct, false, groupState, connectionState)
        if (firstFieldErr !== undefined) {
            return firstFieldErr
        }
        if (secondFieldErr !== undefined) {
            return secondFieldErr
        }
        let first: number = parseInt(<string>connectionState.first)
        let second: number = parseInt(<string>connectionState.second)
        if (first === second) {
            return `The index values for ${direct ? 'Direct' : 'Chained'} Connection ${connectionIndex+1} in Group ${groupIndex+1} should not be equal`
        }
        if (!direct && second < first) {
            return `The first index value should be less than the second for Chained Connection ${connectionIndex+1} in Group ${groupIndex+1}`
        }
        return undefined
    }

    checkTemplateConnectionField(groupIndex: number, connectionIndex: number, direct: boolean, firstPart: boolean,
    groupState: TemplateGroupState, connectionState: TemplateLandmarkConnectionState): string | undefined {
        let value: string | undefined = firstPart ? connectionState.first : connectionState.second
        if (value === undefined || value === '') {
            return `The ${firstPart ? 'first' : 'second'} connection field for ${direct ? 'Direct' : 'Chained'} Connection ${connectionIndex+1} in Group ${groupIndex+1} has not been filled in`
        }
        let numberValue: number = parseInt(value)
        if (isNaN(numberValue)) {
            return `The ${firstPart ? 'first' : 'second'} connection value for ${direct ? 'Direct' : 'Chained'} Connection ${connectionIndex+1} in Group ${groupIndex+1} should be a number`
        }
        if (numberValue < 0 || numberValue >= parseInt(<string>groupState.landmarks)) {
            return `The ${firstPart ? 'first' : 'second'} connection value for ${direct ? 'Direct' : 'Chained'} Connection ${connectionIndex+1} in Group ${groupIndex+1} should be between 0 and the landmarks value (exclusive)`
        }
        return undefined
    }

    toggleConnectivityInfo(groupIndex: number): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        modalState.groups[groupIndex].connectivityInfoVisible = !modalState.groups[groupIndex].connectivityInfoVisible
        // re-render
        this.trigger('change:activeAuxModalType')
    }
    
    setTemplateGroupLabel(value: string, groupIndex: number): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        modalState.groups[groupIndex].label = value
        // re-render
        this.trigger('change:activeAuxModalType')
    }

    setTemplateGroupLandmarks(value: string, groupIndex: number): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        modalState.groups[groupIndex].landmarks = value
        this.trigger('change:activeAuxModalType')
    }

    removeTemplateGroup(groupIndex: number): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        modalState.groups.splice(groupIndex, 1)
        // re-render
        this.trigger('change:activeAuxModalType')
    }

    addTemplateConnection(groupIndex: number, direct: boolean): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        let groupState: TemplateGroupState = modalState.groups[groupIndex]
        let connection: TemplateLandmarkConnectionState = {}
        if (direct) {
            groupState.directConnections.push(connection)
        } else {
            groupState.chainedConnections.push(connection)
        }
        // re-render
        this.trigger('change:activeAuxModalType')
    }

    setTemplateConnection(value: string, groupIndex: number, direct: boolean, connectionIndex: number, firstPart: boolean): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        let groupState: TemplateGroupState = modalState.groups[groupIndex]
        let connectionState: TemplateLandmarkConnectionState = direct ? groupState.directConnections[connectionIndex]
            : groupState.chainedConnections[connectionIndex]
        if (firstPart) {
            connectionState.first = value
        } else {
            connectionState.second = value
        }
        this.trigger('change:activeAuxModalType')
    }

    removeTemplateConnection(groupId: number, direct: boolean, connectionIndex: number): void {
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>this.activeAuxModalState
        let groupState: TemplateGroupState = modalState.groups[groupId]
        if (direct) {
            groupState.directConnections.splice(connectionIndex, 1)
        }  else {
            groupState.chainedConnections.splice(connectionIndex, 1)
        }
        // re-render
        this.trigger('change:activeAuxModalType')
    }

    closeModal(): void {
        const wrapper: HTMLElement = <HTMLElement>document.getElementById('modalsWrapper')
        wrapper.classList.remove('ModalsWrapper--Open')
        this.activeModal = false
        this.activeModalType = undefined
        this.activeModalState = undefined
        this.activeAuxModalType = undefined
        this.activeAuxModalState = undefined
        if (this.onModalClose) {
            this.onModalClose()
        }
    }

}