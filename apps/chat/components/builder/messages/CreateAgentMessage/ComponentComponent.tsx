import React from 'react'
import type { Component } from '@/types'


export type ComponentComponentProps = Component & {
  enabled: boolean
}


export function ComponentComponent( {
  components,
  enabled,
  name,
}: ComponentComponentProps) {
  return (
    <div>
      {
        components?.length
          ? <fieldset className="border border-solid border-gray-300 p-3">
            <legend className="text-sm">{name}</legend>

            {components.map( component => <ComponentComponent {...component} key={component.id}/> )}
          </fieldset>
          :<>
            <input type="checkbox" className="mr-2" checked={enabled}/>
            { name }
          </>
      }

    </div>
  )
}
