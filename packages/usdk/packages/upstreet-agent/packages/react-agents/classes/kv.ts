import { useState, useEffect } from 'react';
import type {
  ActiveAgentObject,
} from '../types';
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../util/util.mjs';
import { zbdecode, zbencode } from 'zjs/encoding.mjs';

export class Kv<T> {
  #agent: ActiveAgentObject;
  #supabase: any;
  #updateFn: () => any;

  kvCache = new Map<string, any>();
  kvLoadPromises = new Map<string, Promise<any>>();

  constructor({
    agent,
    supabase,
    updateFn,
  }: {
    agent: ActiveAgentObject;
    supabase: any;
    updateFn: () => any;
  }) {
    this.#agent = agent;
    this.#supabase = supabase;
    this.#updateFn = updateFn;
  }

  private getFullKey(key: string) {
    return `${this.#agent.id}:${key}`;
  }
  private setKvCache(key: string, value: any) {
    this.kvCache.set(key, value);
    this.#updateFn();
  }
  private async makeLoadPromise(key: string, defaultValue?: any) {
    const fullKey = this.getFullKey(key);
    const result = await this.#supabase
      .from('keys_values')
      .select('*')
      .eq('key', fullKey)
      .maybeSingle();
    const { error, data } = result;
    if (!error) {
      if (data) {
        const base64Data = data.value as string;
        const encodedData = base64ToUint8Array(base64Data);
        const value = zbdecode(encodedData);
        return value;
      } else {
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
      }
    } else {
      throw error;
    }
  };
  private ensureLoadPromise(key: string, defaultValue?: any) {
    let loadPromise = this.kvLoadPromises.get(key);
    if (!loadPromise) {
      loadPromise = this.makeLoadPromise(key, defaultValue);
      loadPromise.then((value: any) => {
        this.setKvCache(key, value);
      });
      this.kvLoadPromises.set(key, loadPromise);
    }
    return loadPromise;
  }

  async get<T>(key: string, defaultValue?: T | (() => T)) {
    const loadPromise = this.ensureLoadPromise(key, defaultValue);
    return await loadPromise as T | undefined;
  }
  async set<T>(key: string, value: T | ((oldValue: T | undefined) => T)) {
    const fullKey = this.getFullKey(key);

    if (typeof value === 'function') {
      const oldValue = await this.get<T>(fullKey);
      const newValue = (value as (oldValue: T | undefined) => T)(oldValue);
      value = newValue;
    }

    const newLoadPromise = Promise.resolve(value);
    const encodedData = zbencode(value);
    const base64Data = uint8ArrayToBase64(encodedData);

    this.kvLoadPromises.set(key, newLoadPromise);
    this.setKvCache(key, value);

    const result = await this.#supabase
      .from('keys_values')
      .upsert({
        agent_id: this.#agent.id,
        key: fullKey,
        value: base64Data,
      });
    const { error } = result;
    if (!error) {
      // nothing
    } else {
      console.error('error setting key value', error);
      throw new Error('error setting key value: ' + JSON.stringify(error));
    }
  }
  // note: key must be the same across calls, changing it is not allowed!
  use<T2>(key: string, defaultValue?: T2 | (() => T2)) {
    const ensureDefaultValue = (() => {
      let cachedDefaultValue: T2 | undefined;
      return () => {
        if (cachedDefaultValue === undefined) {
          cachedDefaultValue = typeof defaultValue === 'function' ? (defaultValue as () => T2)() : defaultValue;
        }
        return cachedDefaultValue;
      };
    })();
    const [valueEpoch, setValueEpoch] = useState(0);
    // get the fresh value each render
    const value = this.kvCache.get(key) ?? ensureDefaultValue();
    const setValue2 = async (value: T2 | ((oldValue: T2 | undefined) => T2)) => {
      // trigger re-render of the use() hook
      setValueEpoch((epoch) => epoch + 1);
      // perform the set
      return await this.set<T2>(key, value);
    };

    // trigger the initial load
    useEffect(() => {
      this.ensureLoadPromise(key, ensureDefaultValue);
    }, []);

    return [value, setValue2] as [
      T,
      (value: T | ((oldValue: T | undefined) => T)) => Promise<void>,
    ];
  }
}