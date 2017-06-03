import * as React from 'react'
import { Modal, ModalProps } from '../../../landmarker.io/src/ts/app/view/components/Modal'
import { TemplateCreationGroup, TemplateGroupProps } from './TemplateCreationGroup'

export interface TemplateCreationModalProps extends ModalProps {
    templateTitle: string
    setTemplateTitle: (title: string) => void
    addGroup: () => void
    submit: () => void
    groups: TemplateGroupProps[]
}

export function TemplateCreationModal(props: TemplateCreationModalProps) {
    let groups: any[] = []
    for (let i = 0; i < props.groups.length; i++) {
        let groupProps: TemplateGroupProps = props.groups[i]
        groups.push(<TemplateCreationGroup key={i} groupId={i} label={groupProps.label} landmarks={groupProps.landmarks}
        connectivityInfoVisible={groupProps.connectivityInfoVisible} toggleConnectivityInfo={groupProps.toggleConnectivityInfo}
        setLabel={groupProps.setLabel} setLandmarks={groupProps.setLandmarks} removeGroup={groupProps.removeGroup} addDirect={groupProps.addDirect}
        addChained={groupProps.addChained} directConnections={groupProps.directConnections} chainedConnections={groupProps.chainedConnections}/>)
    }

    return (
    <Modal close={props.close} modifiers={props.modifiers} closable={props.closable} title={props.title}>
        <div className="TemplateCreationModal">
            <div className="TemplateCreationField">
                <label htmlFor="templateTitle">Template title:</label>
                <input id="templateTitle" value={props.templateTitle} onChange={(event) => props.setTemplateTitle(event.target.value)} type="text"/>
            </div>
            <div id="templateGroups">
                {groups}
            </div>
            <div className="AddAction ActionButton" onClick={() => props.addGroup()}>Add group</div>
            <div className="SubmitAction ActionButton" onClick={() => props.submit()}>Submit</div>
        </div>
    </Modal>
    )
}