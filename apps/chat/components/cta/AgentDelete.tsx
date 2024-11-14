'use client';

import React from 'react';
import { IconButton } from 'ucom';

interface AgentDeleteProps {
  handleClick: () => void;
  loading: boolean;
}

export function AgentDelete({ handleClick, loading }: AgentDeleteProps) {
  return (
    <IconButton
      onClick={handleClick}
      icon="Trash"
      size="small"
      variant="primary"
      disabled={loading}
    />
  );
}
