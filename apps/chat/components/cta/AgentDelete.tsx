'use client';

import React, { ForwardedRef, forwardRef } from 'react';
import { IconButton } from 'ucom';

interface AgentDeleteProps {
  handleClick: () => void;
}

function AgentDelete({ handleClick }: AgentDeleteProps, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref}>
      <IconButton
        onClick={handleClick}
        icon="Trash"
        size="small"
        variant="primary"
      />
    </div>
  );
}

export default forwardRef(AgentDelete);
