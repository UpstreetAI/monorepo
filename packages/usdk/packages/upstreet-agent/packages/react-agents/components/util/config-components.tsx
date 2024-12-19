import React, { useRef, useState, useEffect, useMemo, useContext } from 'react';
import type {
  AgentObject,
} from '../../types';
import {
  featureRenderers,
} from '../../util/agent-features-renderer';
import {
  dataSourceRenderers,
} from '../../util/data-source-renderer';

// defaults

type ConfigAgentComponentProps = {
  config?: AgentObject;
};

/**
 * Renders the default agent components.
 * @returns The JSX elements representing the default agent components.
 */
export const ConfigAgentComponents = (props: ConfigAgentComponentProps) => {
  const features = props.config?.features ?? {};
  const dataSources = props.config?.dataSources ?? {};

  return (
    <>
      {Object.keys(features).map((key) => {
        const value = features[key];
        const FeatureRenderer = featureRenderers[key];
        return (
          <FeatureRenderer {...value} key={key} />
        );
      })}

      {Object.entries(dataSources).map(([key, config]) => {
        const DataSourceRenderer = dataSourceRenderers[config.type];
        if (!DataSourceRenderer) return null;
        return <DataSourceRenderer key={key} {...(config as any)} />;
      })}
    </>
  );
};