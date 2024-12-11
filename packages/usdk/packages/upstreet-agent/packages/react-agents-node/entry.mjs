import path from 'path';
import fs from 'fs';
import toml from '@iarna/toml';
import dotenv from 'dotenv';
import { AgentMain } from './packages/upstreet-agent/packages/react-agents/entry.ts';
import * as codecs from './packages/upstreet-agent/packages/codecs/ws-codec-runtime-fs.mjs';
import userRender from './agent.tsx';
import { getCurrentDirname } from '../react-agents/util/path-util.mjs';

//

['uncaughtException', 'unhandledRejection'].forEach(event => {
  process.on(event, err => {
    console.error(err);
  });
});

//

// this file should be running from the agent's directory, so we can find the wrangler.toml file relative to it
const wranglerTomlPath = path.join(getCurrentDirname(import.meta, process), '../../../../wrangler.toml');
const envTxtPath = path.join(getCurrentDirname(import.meta, process), '../../../../.env.txt');

//

const getEnv = async () => {
  const wranglerTomlString = await fs.promises.readFile(wranglerTomlPath, 'utf8');
  const wranglerToml = toml.parse(wranglerTomlString);

  const agentJsonString = wranglerToml.vars.AGENT_JSON;
  if (!agentJsonString) {
    throw new Error('missing AGENT_JSON');
  }
  const agentJson = JSON.parse(agentJsonString);

  const env = {
    AGENT_JSON: JSON.stringify(agentJson),
    WORKER_ENV: 'development', // 'production',
  };
  return env;
};

const getAuth = async () => {
  const envTxtString = await fs.promises.readFile(envTxtPath, 'utf8');
  const envTxt = dotenv.parse(envTxtString);
  return envTxt;
};

//

const main = async ({
  init = {},
  debug = 0,
} = {}) => {
  let [
    env,
    auth,
  ] = await Promise.all([
    getEnv(),
    getAuth(),
  ]);

  let alarmTimestamp = null;
  const state = {
    userRender,
    codecs,
    storage: {
      async getAlarm() {
        return alarmTimestamp;
      },
      setAlarm(timestamp) {
        alarmTimestamp = timestamp;
      },
    },
  };
  env = {
    ...env,
    init,
    debug,
  };
  const agentMain = new AgentMain(state, env, auth);
  return agentMain;
};
export default main;