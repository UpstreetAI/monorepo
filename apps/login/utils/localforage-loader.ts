import localforage from 'localforage';
import { QueueManager } from 'queue-manager';

export class LocalforageLoader<T> {
  key: string;
  defaultValue: () => T;
  queueManager = new QueueManager();

  constructor({
    key,
    defaultValue,
  }: {
    key: string,
    defaultValue: () => T,
  }) {
    this.key = key;
    this.defaultValue = defaultValue;
  }

  async load({
    signal,
  }: {
    signal?: AbortSignal,
  } = {}): Promise<T> {
    return await this.queueManager.waitForTurn(async () => {
      let live = true;
      if (signal) {
        signal.addEventListener('abort', () => {
          live = false;
        });
      }

      let v: T | null = await localforage.getItem(this.key);
      // console.log('get item 1', this.key, v);
      if (v === null) {
        v = this.defaultValue();
      }
      // console.log('get item 2', this.key, v);

      return v;
    });
  }
  async save(v: T = this.defaultValue(), {
    signal,
  }: {
    signal?: AbortSignal,
  } = {}): Promise<void> {
    return await this.queueManager.waitForTurn(async () => {
      let live = true;
      if (signal) {
        signal.addEventListener('abort', () => {
          live = false;
        });
      }

      await localforage.setItem(this.key, v);
      if (!live) return;
    });
  }
}