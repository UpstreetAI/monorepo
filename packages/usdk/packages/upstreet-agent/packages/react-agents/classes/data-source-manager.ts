import type { BaseDataSource } from '../types/react-agents';

export class DataSourceManager {
  private dataSources: Map<string, BaseDataSource>;

  constructor() {
    this.dataSources = new Map();
  }

  addDataSource(dataSource: BaseDataSource): void {
    this.dataSources.set(dataSource.id, dataSource);
  }

  removeDataSource(id: string): boolean {
    return this.dataSources.delete(id);
  }

  getDataSource(id: string): BaseDataSource | undefined {
    return this.dataSources.get(id);
  }

  getAllDataSources(): BaseDataSource[] {
    return Array.from(this.dataSources.values());
  }

  pullFromDataSource(id: string, args: object): Promise<any> {
    const source = this.getDataSource(id);
    if (!source) {
      throw new Error(`Data source ${id} not found`);
    }
    return source.pull(args);
  }
}

