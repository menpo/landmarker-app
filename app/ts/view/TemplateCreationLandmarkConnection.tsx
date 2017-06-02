import * as React from 'react'

export interface TemplateConnectionProps {
    first: string
    second: string
    setFirst: (value: string) => void
    setSecond: (value: string) => void
    removeConnection: () => void
}

export function TemplateCreationLandmarkConnection(props: TemplateConnectionProps) {
    return (
    <div>
        <input value={props.first} onChange={(event) => props.setFirst(event.target.value)} type="text"/>
        <input value={props.second} onChange={(event) => props.setSecond(event.target.value)} type="text"/>
        <button onClick={() => props.removeConnection()}>&times;</button>
    </div>
    )
}