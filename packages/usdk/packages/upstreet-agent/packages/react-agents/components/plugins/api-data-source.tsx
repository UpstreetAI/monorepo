import {
    BaseDataSource,
    DataSourceType,
    APIDataSourceProps,
} from '../../types/react-agents';
import React, { useEffect } from 'react';
import { useAgent } from '../../hooks';
import { APIDataSourceManager } from '../../classes/api-data-source-manager';


export const APIDataSource: React.FC<APIDataSourceProps> = (props) => {
  const agent = useAgent();

  useEffect(() => {
    const dataSource = new APIDataSourceManager(props);
    agent.dataSourceManager.addDataSource(dataSource);
    return () => {
      agent.dataSourceManager.removeDataSource(dataSource.id);
    };
  }, [props.endpoint, JSON.stringify(props.headers), JSON.stringify(props.params)]);

  return null;
};