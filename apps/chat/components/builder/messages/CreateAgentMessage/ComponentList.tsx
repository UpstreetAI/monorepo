import React from 'react'
import { ComponentComponent } from '@/components/builder/messages/CreateAgentMessage/ComponentComponent'
import type { Component } from '@/types'

export type ComponentListProps = {
  components: Component[]
}

export function ComponentList({
  components
}: ComponentListProps) {
  return (
    <div>
      { components.map( component =>
        <ComponentComponent {...component} key={component.id}/>
      )}
    </div>
  )
}
