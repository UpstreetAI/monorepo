import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs'


export function Output() {
  return (
    <div className={'bg-gray-700 flex-1'}>
      <SyntaxHighlighter
        className="h-full"
        language="tsx"
        style={vs2015}
      >
        {`<Agent>
  <InputText />
  <InputImage />
  <InputAudio />
  <ExampleActionA />
  <ExampleActionB />
  <OutputText />
  <OutputImage resolution="medium"/>
  <OutputText />
</Agent>`}
      </SyntaxHighlighter>
    </div>
  )
}
