import React from 'react';
import {
  Agent,
  AgentAppProps,
  DefaultAgentComponents,
  DefaultActions,
  DefaultPrompts,
  DefaultParsers,
  DefaultPerceptions,
  DefaultSchedulers,
  DefaultServers,
  TTS,
} from 'react-agents';

//

export default function MyAgent(props) {
  return (
    <Agent>
      <TTS />
    </Agent>
  );
}
