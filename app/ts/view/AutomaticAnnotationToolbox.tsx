import * as React from 'react'
import { Button, ButtonProps } from '../../../landmarker.io/src/ts/app/view/components/Button'

enum AAField {
    MINIMUM,
    INTERVAL
}

function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, fieldType: AAField, toolboxProps: AutomaticAnnotationToolboxProps) {
    if (event.keyCode === 27) { // ESC
        if (fieldType === AAField.MINIMUM) {
            toolboxProps.toggleEditingMinimumTrainingAssets()
            toolboxProps.updateMinimumTrainingAssets(true)

        } else if (fieldType === AAField.INTERVAL) {
            toolboxProps.toggleEditingAutomaticAnnotationInterval()
            toolboxProps.updateAutomaticAnnotationInterval(true)
        }
        event.stopPropagation()
        event.preventDefault()
    } else if (event.keyCode === 13) { // ENTER
        if (fieldType === AAField.MINIMUM) {
            toolboxProps.toggleEditingMinimumTrainingAssets()
            toolboxProps.updateMinimumTrainingAssets(false)
        } else if (fieldType === AAField.INTERVAL) {
            toolboxProps.toggleEditingAutomaticAnnotationInterval()
            toolboxProps.updateAutomaticAnnotationInterval(false)
        }
        event.stopPropagation()
        event.preventDefault()
    }
}

export interface AutomaticAnnotationToolboxProps {
    minimumTrainingAssets: string
    automaticAnnotationInterval: string
    editingMinimumTrainingAssets: boolean
    editingAutomaticAnnotationInterval: boolean
    initialiseEnabled: boolean
    refineEnabled: boolean
    setMinimumTrainingAssetsField: (value: string) => void
    setAutomaticAnnotationIntervalField: (value: string) => void
    updateMinimumTrainingAssets: (revert: boolean) => void
    updateAutomaticAnnotationInterval: (revert: boolean) => void
    toggleEditingMinimumTrainingAssets: () => void
    toggleEditingAutomaticAnnotationInterval: () => void
    initialise: () => void
    refine: () => void
}

export function AutomaticAnnotationToolbox(props: AutomaticAnnotationToolboxProps) {
    return (
    <div>
        <div className="AAToolbox-Row">
            <div className="AAToolbox-Row-Item">
                <Button label="Initialise" enabled={props.initialiseEnabled} onClick={props.initialise}/>
            </div>
            <div className="AAToolbox-Row-Item">
                <Button label="Refine" enabled={props.refineEnabled} onClick={props.refine}/>
            </div>
        </div>
        <div className="AAToolbox-Row">
            <div className="AAToolbox-Row-Item">
                Minimum
            </div>
            <div className="AAToolbox-Row-Item">
                { props.editingMinimumTrainingAssets ?
                <input type="text" value={props.minimumTrainingAssets} onChange={(event) => props.setMinimumTrainingAssetsField(event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, AAField.MINIMUM, props)}/>
                : <div className="AAToolbox-Field" onClick={() => props.toggleEditingMinimumTrainingAssets()}>{props.minimumTrainingAssets}</div> }
            </div>
        </div>
        <div className="AAToolbox-Row">
            <div className="AAToolbox-Row-Item">
                Interval
            </div>
            <div className="AAToolbox-Row-Item">
                { props.editingAutomaticAnnotationInterval ?
                <input type="text" value={props.automaticAnnotationInterval} onChange={(event) => props.setAutomaticAnnotationIntervalField(event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, AAField.INTERVAL, props)}/>
                : <div className="AAToolbox-Field" onClick={() => props.toggleEditingAutomaticAnnotationInterval()}>{props.automaticAnnotationInterval}</div> }
            </div>
        </div>
    </div>
    )
}