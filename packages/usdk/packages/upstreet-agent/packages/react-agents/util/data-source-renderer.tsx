import React from 'react';
import { APIDataSource } from '../components/plugins/api-data-source';

export const dataSourceRenderers = {
  api: ({ id, name, description, endpoint, headers, params }) => {
    if (endpoint) {
      return (
        <APIDataSource
          id={id}
          name={name}
          description={description}
          endpoint={endpoint}
          headers={headers}
          params={params}
        />
      );
    }
    return null;
  },
};