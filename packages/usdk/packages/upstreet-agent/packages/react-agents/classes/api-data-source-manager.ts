import { APIDataSourceProps } from "../types/react-agents";
import { BaseDataSource } from '../types/react-agents';

export class APIDataSourceManager implements BaseDataSource {
  id: string;
  type: 'api';
  name: string;
  description: string;
  endpoint: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;

  constructor(config: APIDataSourceProps) {
    this.id = config.id;
    this.type = 'api';
    this.name = config.name || config.id;
    this.description = config.description || '';
    this.endpoint = config.endpoint;
    this.headers = config.headers;
    this.params = config.params;
  }

  async pull(args: object = {}): Promise<any> {
    try {
      const url = new URL(this.endpoint);
      const params = { ...this.params, ...args };
      
      Object.entries(params || {}).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });

      const response = await fetch(url.toString(), {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Error fetching from API ${this.id}:`, error);
      throw error;
    }
  }
}