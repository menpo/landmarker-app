import * as ReactDom from 'react-dom'
import { ReactBridge } from '../../landmarker.io/src/ts/app/view/reactbridge'
import { ExtendedApp, AutomaticAnnotationToolboxState, AuxModalType, TemplateCreationModalState, TemplateGroupState, TemplateLandmarkConnectionState } from './app'
import FSMenpoBackend from './fs_menpo_backend'
import { TemplateCreationModal, TemplateCreationModalProps } from './view/TemplateCreationModal'
import { TemplateGroupProps } from './view/TemplateCreationGroup'
import { TemplateConnectionProps } from './view/TemplateCreationLandmarkConnection'
import { AutomaticAnnotationToolbox, AutomaticAnnotationToolboxProps } from './view/AutomaticAnnotationToolbox'

export class ExtendedReactBridge extends ReactBridge {

    constructor(app: ExtendedApp) {
        super(app)

        app.on('change:activeAuxModalType', () => this.onActiveAuxModalChange())
        app.on('change:automaticAnnotationToolboxState', () => this.onToolboxStateChange())
        app.on('change:landmarks', () => this.onLandmarksChangeAux())

        this.onActiveAuxModalChange()
        this.onToolboxStateChange()
        this.onLandmarksChangeAux()
    }

    onActiveAuxModalChange(): void {
        if ((<ExtendedApp>this.app).activeAuxModalType == AuxModalType.TEMPLATE_CREATION) {
            this.renderTemplateCreationModal()
        } else {
            this.disposeModal()
        }
    }

    onToolboxStateChange(): void {
        this.renderAutomaticAnnotationToolbox()
    }

    onLandmarksChangeAux(): void {
        if (!this.app.landmarks) {
            return
        }
        this.app.landmarks.landmarks.forEach(lm => {
            lm.on('change', () => this.renderAutomaticAnnotationToolbox())
        })
        this.app.landmarks.tracker.on('change', () => this.renderAutomaticAnnotationToolbox())
        this.renderAutomaticAnnotationToolbox()
    }

    generateTemplateLandmarkConnections(groupId: number, direct: boolean, connections: TemplateLandmarkConnectionState[]): TemplateConnectionProps[] {
        let app: ExtendedApp = <ExtendedApp>this.app
        let result: TemplateConnectionProps[] = []
        for (let i = 0; i < connections.length; i++) {
            let connectionProps: TemplateConnectionProps = {
                first: connections[i].first || '',
                second: connections[i].second || '',
                setFirst: (value: string) => app.setTemplateConnection(value, groupId, direct, i, true),
                setSecond: (value: string) => app.setTemplateConnection(value, groupId, direct, i, false),
                removeConnection: () => app.removeTemplateConnection(groupId, direct, i)
            }
            result.push(connectionProps)
        }
        return result
    }

    generateTemplateCreationGroups(groups: TemplateGroupState[]): TemplateGroupProps[] {
        let app: ExtendedApp = <ExtendedApp>this.app
        let result: TemplateGroupProps[] = []
        for (let i = 0; i < groups.length; i++) {
            let groupProps: TemplateGroupProps = {
                groupId: i,
                label: groups[i].label || '',
                landmarks: groups[i].landmarks || '',
                connectivityInfoVisible: groups[i].connectivityInfoVisible,
                toggleConnectivityInfo: () => app.toggleConnectivityInfo(i),
                setLabel: (value: string) => app.setTemplateGroupLabel(value, i),
                setLandmarks: (value: string) => app.setTemplateGroupLandmarks(value, i),
                removeGroup: () => app.removeTemplateGroup(i),
                addDirect: () => app.addTemplateConnection(i, true),
                addChained: () => app.addTemplateConnection(i, false),
                directConnections: this.generateTemplateLandmarkConnections(i, true, groups[i].directConnections),
                chainedConnections: this.generateTemplateLandmarkConnections(i, false, groups[i].chainedConnections)
            }
            result.push(groupProps)
        }
        return result
    }

    renderTemplateCreationModal(): void {
        let app: ExtendedApp = <ExtendedApp>this.app
        let modalState: TemplateCreationModalState = <TemplateCreationModalState>app.activeAuxModalState
        let modalProps: TemplateCreationModalProps = {
            templateTitle: modalState.templateTitle || '',
            setTemplateTitle: app.setTemplateCreationTitle.bind(app),
            addGroup: app.addTemplateCreationGroup.bind(app),
            submit: app.submitTemplateCreationForm.bind(app),
            groups: this.generateTemplateCreationGroups(modalState.groups),
            closable: true,
            modifiers: [],
            close: this.app.closeModal.bind(this.app),
            title: 'Create a template'
        }
        const templateCreationModal = TemplateCreationModal(modalProps)
        const el = document.getElementById('modalsWrapper')
        ReactDom.render(templateCreationModal, el)
    }

    landmarksComplete(): boolean {
        if (!this.app.landmarks) {
            return false
        }
        return !this.app.landmarks.hasEmpty()
    }

    renderAutomaticAnnotationToolbox(): void {
        let app: ExtendedApp = <ExtendedApp>this.app
        if (!(app.backend instanceof FSMenpoBackend)) {
            return
        }
        let backend: FSMenpoBackend = <FSMenpoBackend>app.backend
        let landmarksComplete: boolean = this.landmarksComplete()
        let toolboxState: AutomaticAnnotationToolboxState = <AutomaticAnnotationToolboxState>app.automaticAnnotationToolboxState
        let toolboxProps: AutomaticAnnotationToolboxProps = {
            minimumTrainingAssets: toolboxState.minimumTrainingAssets,
            automaticAnnotationInterval: toolboxState.automaticAnnotationInterval,
            editingMinimumTrainingAssets: toolboxState.editingMinimumTrainingAssets,
            editingAutomaticAnnotationInterval: toolboxState.editingAutomaticAnnotationInterval,
            initialiseEnabled: !landmarksComplete && backend.automaticAnnotationOn(),
            refineEnabled: landmarksComplete && backend.automaticAnnotationOn(),
            menpoCallActive: backend.callingMenpo,
            menpoCallMessage: backend.menpoCallMessage,
            setMinimumTrainingAssetsField: app.setMinimumTrainingAssetsField.bind(app),
            setAutomaticAnnotationIntervalField: app.setAutomaticAnnotationIntervalField.bind(app),
            updateMinimumTrainingAssets: app.updateMinimumTrainingAssets.bind(app),
            updateAutomaticAnnotationInterval: app.updateAutomaticAnnotationInterval.bind(app),
            toggleEditingMinimumTrainingAssets: app.toggleEditingMinimumTrainingAssets.bind(app),
            toggleEditingAutomaticAnnotationInterval: app.toggleEditingAutomaticAnnotationInterval.bind(app),
            initialise: app.placeMeanShape.bind(app),
            refine: app.placeFittedShape.bind(app),
            cancelMenpoCall: app.cancelMenpoCall.bind(app)
        }
        const automaticAnnotationToolbox = AutomaticAnnotationToolbox(toolboxProps)
        const el = document.getElementById('automaticAnnotationToolbox')
        ReactDom.render(automaticAnnotationToolbox, el)
    }

}