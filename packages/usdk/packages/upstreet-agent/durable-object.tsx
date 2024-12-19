import dotenv from 'dotenv';
import { AgentMain } from 'react-agents/entry.ts';
import * as codecs from 'codecs/ws-codec-runtime-edge.mjs';
import userRender from './agent.tsx';
import agentJson from './agent.json';
import envTxt from './.env.txt';

Error.stackTraceLimit = 300;

// CloudFlare Worker Durable Object class
export class DurableObject {
  agentMain: AgentMain;
  loadPromise: Promise<AgentMain> = null;

  constructor(state: any, env: any) {
    const config = (() => {
      try {
        if (typeof agentJson === 'string') {
          return JSON.parse(agentJson);
        } else if (typeof agentJson === 'object') {
          return agentJson;
        } else {
          throw new Error(`Invalid agent.json: ${agentJson}`);
        }
      } catch (e) {
        console.warn(`Warning: failed to parse ${agentJson}:`, e);
        return {};
      }
    })();
    const state2 = {
      ...state,
      config,
      userRender,
      codecs,
    };
    const auth2 = dotenv.parse(envTxt);
    this.loadPromise = (async() => {
      const agentMain = new AgentMain(state2, env, auth2);
      // await agentMain.waitForLoad();
      return agentMain;
    })();
  }
  async fetch(request: Request) {
    const agentMain = await this.loadPromise;
    return await agentMain.fetch(request);
  }
  async alarm() {
    const agentMain = await this.loadPromise;
    return await agentMain.alarm();
  }
}
