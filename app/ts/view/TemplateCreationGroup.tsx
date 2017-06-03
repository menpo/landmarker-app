import * as React from 'react'
import { TemplateCreationLandmarkConnection, TemplateConnectionProps } from './TemplateCreationLandmarkConnection'

export interface TemplateGroupProps {
    groupId: number
    label: string
    landmarks: string
    connectivityInfoVisible: boolean
    toggleConnectivityInfo: () => void
    setLabel: (value: string) => void
    setLandmarks: (value: string) => void
    removeGroup: () => void
    addDirect: () => void
    addChained: () => void
    directConnections: TemplateConnectionProps[]
    chainedConnections: TemplateConnectionProps[]
}

export function TemplateCreationGroup(props: TemplateGroupProps) {
    let directConnections: any[] = []
    let chainedConnections: any[] = []

    for (let i = 0; i < props.directConnections.length; i++) {
        let connection: TemplateConnectionProps = props.directConnections[i]
        directConnections.push(
        <TemplateCreationLandmarkConnection key={i} first={connection.first} second={connection.second} setFirst={connection.setFirst}
        setSecond={connection.setSecond} removeConnection={connection.removeConnection}/>
        )
    }
    for (let i = 0; i < props.chainedConnections.length; i++) {
        let connection: TemplateConnectionProps = props.chainedConnections[i]
        chainedConnections.push(
        <TemplateCreationLandmarkConnection key={i} first={connection.first} second={connection.second} setFirst={connection.setFirst}
        setSecond={connection.setSecond} removeConnection={connection.removeConnection}/>
        )
    }

    return (
    <div className="TemplateCreationGroup">
        <b>Group {props.groupId + 1}</b>
        <div className="TemplateCreationField">
            <label htmlFor={`groupLabel${props.groupId}`}>Group label:</label>
            <input id={`groupLabel${props.groupId}`} value={props.label} onChange={(event) => props.setLabel(event.target.value)} type="text"/>
        </div>
        <div className="TemplateCreationField">
            <label htmlFor={`groupLandmarks${props.groupId}`}>Number of landmarks:</label>
            <input id={`groupLandmarks${props.groupId}`} value={props.landmarks} onChange={(event) => props.setLandmarks(event.target.value)} type="text"/>
        </div>
        Landark connectivity:
        <br/>
        <div className="ConnectivityInfo">
            { props.connectivityInfoVisible ?
            <i>In the form 'a b' where 'a' and 'b' are landmark indices from zero up to (but not including)
            the 'number of landmarks' value for this group. A direct connection 'a b' means that 'a' is
            connected to 'b'. A chained connection 'a b' means that 'a' is connected to 'a+1' which is
            connected to 'a+2' and so on up to 'b'.<br/></i>
            : null
            }
            <a href="#" onClick={() => {props.toggleConnectivityInfo(); return false;}}>{props.connectivityInfoVisible ? <i>Less info</i> : <i>More info...</i>}</a>
        </div>
        <br/>
        <div className="TemplateConnections">
            <div className="ConnectionsSection">
                <div>
                    {directConnections}
                </div>
                <div className="AddAction ActionButton" onClick={() => props.addDirect()}>Add direct connection</div>
            </div>
            <div className="ConnectionsSection">
                <div>
                    {chainedConnections}
                </div>
                <div className="AddAction ActionButton" onClick={() => props.addChained()}>Add chained connection</div>
            </div>
        </div>
        <div className="RemoveAction ActionButton" onClick={() => props.removeGroup()}>Remove group</div>
    </div>
    )
}