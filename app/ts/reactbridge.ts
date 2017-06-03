import * as ReactDom from 'react-dom'
import { ReactBridge } from '../../landmarker.io/src/ts/app/view/reactbridge'
import { ExtendedApp, AuxModalType, TemplateCreationModalState, TemplateGroupState, TemplateLandmarkConnectionState } from './app'
import { TemplateCreationModal, TemplateCreationModalProps } from './view/TemplateCreationModal'
import { TemplateGroupProps } from './view/TemplateCreationGroup'
import { TemplateConnectionProps } from './view/TemplateCreationLandmarkConnection'

export class ExtendedReactBridge extends ReactBridge {

    constructor(app: ExtendedApp) {
        super(app)

        app.on('change:activeAuxModalType', () => this.onactiveAuxModalChange())

        this.onactiveAuxModalChange()
    }

    onactiveAuxModalChange(): void {
        if ((<ExtendedApp>this.app).activeAuxModalType == AuxModalType.TEMPLATE_CREATION) {
            this.renderTemplateCreationModal()
        } else {
            this.disposeModal()
        }
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

}