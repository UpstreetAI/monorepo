import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { AgentMain } from 'react-agents/entry.ts';
import * as codecs from 'codecs/ws-codec-runtime-fs.mjs';
import userRender from './agent.tsx';
import config from './agent.json';

const dirname = path.dirname(import.meta.url.replace('file://', ''));

//

['uncaughtException', 'unhandledRejection'].forEach(event => {
  process.on(event, err => {
    console.error(err);
  });
});

//

const main = async ({
  init = {},
  debug = 0,
} = {}) => {
  const getAuth = async () => {
    const envTxtString = fs.readFileSync(path.join(dirname, '.env.txt'), 'utf8');
    const envTxt = dotenv.parse(envTxtString);
    return envTxt;
  };

  let alarmTimestamp = null;
  const state = {
    config,
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
  const env = {
    WORKER_ENV: 'development',
    init,
    debug,
  };
  const auth = await getAuth();
  const agentMain = new AgentMain(state, env, auth);
  return agentMain;
};
export default main;