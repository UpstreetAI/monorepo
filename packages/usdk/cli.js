import path from 'path';
import fs from 'fs';
import https from 'https';
import child_process from 'child_process';
import stream from 'stream';
import repl from 'repl';

import { program } from 'commander';
import WebSocket, { WebSocketServer } from 'ws';
import EventSource from 'eventsource';
import toml from '@iarna/toml';
import open from 'open';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import pc from 'picocolors';
import Jimp from 'jimp';
import dedent from 'dedent';
// import { doc } from 'tsdoc-extractor';

import prettyBytes from 'pretty-bytes';
import Table from 'cli-table3';
import * as ethers from 'ethers';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

import { isGuid } from './packages/upstreet-agent/packages/react-agents/util/guid-util.mjs';
import { QueueManager } from './packages/upstreet-agent/packages/react-agents/util/queue-manager.mjs';
import { lembed } from './packages/upstreet-agent/packages/react-agents/util/embedding.mjs';
import { makeId } from './packages/upstreet-agent/packages/react-agents/util/util.mjs';
import { packZip, extractZip } from './lib/zip-util.mjs';
import {
  localPort,
  callbackPort,
  devServerPort,
  getAgentName,
  getAgentPublicUrl,
  getLocalAgentHost,
  getCloudAgentHost,
  ensureAgentJsonDefaults,
} from './packages/upstreet-agent/packages/react-agents/agent-defaults.mjs';
import {
  makeAnonymousClient,
  getUserIdForJwt,
  getUserForJwt,
} from './packages/upstreet-agent/packages/react-agents/util/supabase-client.mjs';
import packageJson from './package.json' with { type: 'json' };

import {
  providers,
  getWalletFromMnemonic,
  getConnectedWalletsFromMnemonic,
} from './packages/upstreet-agent/packages/react-agents/util/ethereum-utils.mjs';
import {
  getAgentToken,
} from './packages/upstreet-agent/packages/react-agents/util/jwt-utils.mjs';
import {
  aiHost,
  metamaskHost,
  deployEndpointUrl,
  multiplayerEndpointUrl,
  r2EndpointUrl,
  chatEndpointUrl,
  workersHost,
  aiProxyHost,
} from './packages/upstreet-agent/packages/react-agents/util/endpoints.mjs';
import { NetworkRealms } from './packages/upstreet-agent/packages/react-agents/lib/multiplayer/public/network-realms.mjs'; // XXX should be a deduplicated import, in a separate npm module

import { AutoVoiceEndpoint, VoiceEndpointVoicer } from './packages/upstreet-agent/packages/react-agents/lib/voice-output/voice-endpoint-voicer.mjs';
import { AudioDecodeStream } from './packages/upstreet-agent/packages/react-agents/lib/multiplayer/public/audio/audio-decode.mjs';

// import * as codecs from './packages/upstreet-agent/packages/react-agents/lib/multiplayer/public/audio/ws-codec-runtime-worker.mjs';
// import * as codecs from './packages/upstreet-agent/packages/react-agents/lib/multiplayer/public/audio/ws-codec-runtime-edge.mjs';
import * as codecs from './packages/upstreet-agent/packages/react-agents/lib/multiplayer/public/audio/ws-codec-runtime-local.mjs';

import { webbrowserActionsToText } from './packages/upstreet-agent/packages/react-agents/util/browser-action-utils.mjs';

import Worker from 'web-worker';
globalThis.Worker = Worker;

import {
  InputDevices,
} from './packages/upstreet-agent/packages/react-agents/devices/input-devices.mjs';
import {
  AudioInput,
  TranscribedVoiceInput,
  // encodeMp3,
} from './packages/upstreet-agent/packages/react-agents/devices/audio-input.mjs';
// import {
//   transcribe,
// } from './packages/upstreet-agent/packages/react-agents/util/audio-perception.mjs';
import {
  ImageRenderer,
  TerminalVideoRenderer,
} from './packages/upstreet-agent/packages/react-agents/devices/video-input.mjs';
import {
  describe,
} from './packages/upstreet-agent/packages/react-agents/util/vision.mjs';
import {
  WebPEncoder,
} from './packages/upstreet-agent/packages/react-agents/devices/codecs.mjs';
import { getLoginJwt } from './lib/login.mjs';
import {
  loginLocation,
  certsLocalPath,
  templatesDirectory,
  wranglerBinPath,
  wranglerTomlPath,
  jestBin,
} from './lib/locations.mjs';
import {
  create,
} from './lib/commands.mjs';
import {
  makeTempDir,
  tryReadFile,
} from './lib/file.mjs';
import {
  consoleImageWidth,
} from './packages/upstreet-agent/packages/react-agents/constants.mjs';
import { timeAgo } from './packages/upstreet-agent/packages/react-agents/util/time-ago.mjs';
import { cleanDir } from './lib/directory-util.mjs';
import { npmInstall } from './lib/npm-util.mjs';
import { featureSpecs } from './packages/upstreet-agent/packages/react-agents/util/agent-features.mjs';

import { StreamVAD } from './packages/upstreet-agent/packages/react-agents/lib/vad/packages/web/src/real-time-vad.mjs';

globalThis.WebSocket = WebSocket; // polyfill for multiplayer library

const wranglerTomlString = fs.readFileSync(wranglerTomlPath, 'utf8');
const wranglerToml = toml.parse(wranglerTomlString);
const env = wranglerToml.vars;
const makeSupabase = (jwt) => makeAnonymousClient(env, jwt);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const shortName = () => uniqueNamesGenerator({
  dictionaries: [adjectives, adjectives, colors, animals],
  separator: ' ',
});
const makeName = () => capitalize(shortName());
const getAgentHost = (guid) => `https://user-agent-${guid}.${workersHost}`;
const jsonParse = (s) => {
  try {
    return JSON.parse(s);
  } catch (err) {
    return undefined;
  }
};

//

const eraseLine = '\x1b[2K\r';

//

let logFn = (...args) => {
  console.log(...args);
};
const setLogFn = (_logFn) => {
  logFn = _logFn;
};
const log = (...args) => {
  logFn(...args);
};

//

const getAgentSpecHost = (agentSpec, portIndex = 0) => !!agentSpec.directory ? getLocalAgentHost() : getCloudAgentHost(agentSpec.guid);
class TypingMap extends EventTarget {
  #internalMap = new Map(); // playerId: string -> { userId: string, name: string, typing: boolean }
  getMap() {
    return this.#internalMap;
  }
  set(playerId, spec) {
    this.#internalMap.set(playerId, spec);
    this.dispatchEvent(new MessageEvent('typingchange', {
      data: spec,
    }));
  }
  clear() {
    for (const [playerId, spec] of this.#internalMap) {
      this.dispatchEvent(new MessageEvent('typingchange', {
        data: spec,
      }));
    }
    this.#internalMap.clear();
  }
}
class SpeakerMap extends EventTarget {
  #internalMap = new Map(); // playerId: string -> boolean
  #localSpeaking = false;
  #lastSpeakers = false;
  getMap() {
    return this.#internalMap;
  }
  set(playerId, speaking) {
    this.#internalMap.set(playerId, speaking);
    this.dispatchEvent(new MessageEvent('speakingchange', {
      data: {
        playerId,
        speaking,
      },
    }));

    const currentSpeakers = Array.from(this.#internalMap.values()).some(Boolean);
    // console.log('current speakers', {
    //   currentSpeakers,
    //   lastSpeakers: this.#lastSpeakers,
    // });
    if (currentSpeakers && !this.#lastSpeakers) {
      this.dispatchEvent(new MessageEvent('playingchange', {
        data: true,
      }));
    } else if (!currentSpeakers && this.#lastSpeakers) {
      this.dispatchEvent(new MessageEvent('playingchange', {
        data: false,
      }));
    }
    this.#lastSpeakers = currentSpeakers;
  }
  getLocal() {
    return this.#localSpeaking;
  }
  setLocal(speaking) {
    this.#localSpeaking = speaking;
    this.dispatchEvent(new MessageEvent('localspeakingchange', {
      data: {
        speaking,
      },
    }));
  }
  clear() {
    for (const [playerId, speaking] of this.#internalMap) {
      this.dispatchEvent(new MessageEvent('speakingchange', {
        data: {
          playerId,
          speaking,
        },
      }));
    }
    this.#internalMap.clear();
    this.#lastSpeakers = false;
  }
}

const defaultCorsHeaders = [
  // {
  //   "key": "Access-Control-Allow-Origin",
  //   "value": "*"
  // },
  {
    key: 'Access-Control-Allow-Methods',
    value: '*',
  },
  {
    key: 'Access-Control-Allow-Headers',
    value: ['content-type'].join(', '),
  },
  {
    key: 'Access-Control-Expose-Headers',
    value: '*',
  },
  {
    key: 'Access-Control-Allow-Private-Network',
    value: 'true',
  },
  {
    key: 'Access-Control-Allow-Credentials',
    value: 'true',
  },
];
const makeCorsHeaders = (req) => {
  const headers = [...defaultCorsHeaders];
  // set Access-Control-Allow-Origin to the origin of the request
  const origin = req.headers['origin'];
  if (origin) {
    headers.push({
      key: 'Access-Control-Allow-Origin',
      value: origin,
    });
  }
  return headers;
};

// const webcamPort = 10619;
const cwd = process.cwd();

const getServerOpts = () => {
  return {
    key: tryReadFile(path.join(certsLocalPath, 'privkey.pem')) || '',
    cert: tryReadFile(path.join(certsLocalPath, 'fullchain.pem')) || '',
  };
};
/* const putFile = async (pathname, file) => {
  const u = `https://r2.upstreet.ai/${pathname}`;
  const headers = {};
  if (file.type) {
    headers['Content-Type'] = file.type;
  }
  if (file.size) {
    headers['Content-Length'] = file.size;
  }
  const res = await fetch(u, {
    method: 'PUT',
    headers,
    body: file,
    duplex: 'half',
  });
  const j = await res.json();
  return j;
}; */
const ensureLocalGuid = async () => {
  throw new Error(`move this to use the agent's guid`);
  /* const guidFile = await tryReadFileAsync(guidLocation);
  if (guidFile) {
    const o = jsonParse(guidFile);
    if (typeof o === 'object' && typeof o?.guid === 'string') {
      const { guid } = o;
      return guid;
    } else {
      throw new Error(
        'could not parse guid file: ' +
          guidLocation +
          ': ' +
          JSON.stringify(o, null, 2),
      );
    }
  } else {
    const guid = makeDevGuid();
    const o = {
      guid,
    };
    const s = JSON.stringify(o);
    await mkdirp(path.dirname(guidLocation));
    await fs.promises.writeFile(guidLocation, s);
    return guid;
  } */
};
/* const ensureLocalMnemonic = async () => {
  const walletFile = await tryReadFileAsync(walletLocation);
  if (walletFile) {
    const o = jsonParse(walletFile);
    if (typeof o === 'object' && typeof o?.mnemonic === 'string') {
      const { mnemonic } = o;
      return mnemonic;
    } else {
      throw new Error(
        'could not parse wallet file: ' + JSON.stringify(o, null, 2),
      );
    }
  } else {
    const mnemonic = generateMnemonic();
    const o = {
      mnemonic,
    };
    const s = JSON.stringify(o);
    await fs.promises.writeFile(walletLocation, s);
    return mnemonic;
  }
}; */
/* const getLocalMnemonic = async () => {
  const walletFile = await tryReadFileAsync(walletLocation);
  if (walletFile) {
    const o = jsonParse(walletFile);
    if (typeof o === 'object' && typeof o?.mnemonic === 'string') {
      const { mnemonic } = o;
      return mnemonic;
    } else {
      throw new Error(
        'could not parse wallet file: ' + JSON.stringify(o, null, 2),
      );
    }
  } else {
    return null;
  }
}; */
const getAgentMnemonic = async (supabase, agentId) => {
  const accountResult = await supabase
    .from('wallets')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();
  const { error, data } = accountResult;
  if (!error) {
    const { mnemonic } = data;
    return mnemonic;
  } else {
    throw new Error(error);
  }
};
const bindProcess = (cp) => {
  process.on('exit', () => {
    // console.log('got exit', cp.pid);
    try {
      process.kill(cp.pid, 'SIGINT');
    } catch (err) {
      // console.warn(err.stack);
    }
  });
};
const waitForProcessIo = async (cp, matcher, timeout = 60 * 1000) => {
  const matcherFn = (() => {
    if (typeof matcher === 'string') {
      const s = matcher;
      return (s2) => s2.includes(s);
    } else if (matcher instanceof RegExp) {
      const re = matcher;
      return (s) => re.test(s);
    } else {
      throw new Error('invalid matcher');
    }
  })();
  await new Promise((accept, reject) => {
    const bs = [];
    const onData = (d) => {
      bs.push(d);
      const s = Buffer.concat(bs).toString('utf8');
      if (matcherFn(s)) {
        cp.stdout.removeListener('data', onData);
        cp.stdout.removeListener('end', onEnd);
        clearTimeout(timeoutId);
        accept();
      }
    };
    cp.stdout.on('data', onData);

    const bs2 = [];
    const onData2 = (d) => {
      bs2.push(d);
    };
    cp.stderr.on('data', onData2);

    const getDebugOutput = () =>
      Buffer.concat(bs).toString('utf8') +
      '\n' +
      Buffer.concat(bs2).toString('utf8')

    const onEnd = () => {
      reject(
        new Error('process ended without matching output: ' + getDebugOutput()),
      );
    };
    cp.stdout.on('end', onEnd);

    cp.on('exit', (code) => {
      reject(new Error(`failed to get start process: ${cp.pid}: ${code}`));
    });

    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          'timeout waiting for process output: ' +
            JSON.stringify(cp.spawnfile) +
            ' ' +
            JSON.stringify(cp.spawnargs) +
            ' ' +
            getDebugOutput(),
        ),
      );
    }, timeout);
  });
};
const startDevServer = async ({ directory = cwd } = {}, portIndex = 0, {
  debug = false,
} = {}) => {
  // spawn the wrangler child process
  const cp = child_process.spawn(
    wranglerBinPath,
    ['dev', '--var', 'WORKER_ENV:development', '--ip', '0.0.0.0', '--port', devServerPort + portIndex],
    {
      stdio: 'pipe',
      // stdio: 'inherit',
      cwd: directory,
    },
  );
  bindProcess(cp);
  await waitForProcessIo(cp, /ready/i);
  if (debug) {
    cp.stdout.pipe(process.stdout);
    cp.stderr.pipe(process.stderr);
  }
  return cp;
};
/* const startMultiplayerServer = async () => {
  // spawn the wrangler child process
  const cp = child_process.spawn(
    wranglerBin,
    ['dev', '--env=local', '--ip', '0.0.0.0', '--port', multiplayerPort],
    {
      stdio: 'pipe',
      // stdio: 'inherit',
      cwd: multiplayerDirectory,
    },
  );
  bindProcess(cp);
  await waitForProcessIo(cp, /ready/i);
  return cp;
}; */
const getAssetJson = async (supabase, guid) => {
  const assetResult = await supabase
    .from('assets')
    .select('*')
    .eq('id', guid)
    .eq('type', 'npc')
    .maybeSingle();
  if (!assetResult.error) {
    if (assetResult.data) {
      const { start_url } = assetResult.data;

      const proxyRes = await fetch(start_url);
      const agentJson = await proxyRes.json();
      return agentJson;
    } else {
      throw new Error(
        JSON.stringify({
          error: `Agent not found: ${guid}`,
        }),
      );
    }
  } else {
    throw new Error(
      JSON.stringify({
        error: assetResult.error,
      }),
    );
  }
};

class Player {
  playerId;
  playerSpec;
  constructor(playerId = '', playerSpec = null) {
    this.playerId = playerId;
    this.playerSpec = playerSpec;
  }
  setPlayerSpec(playerSpec) {
    this.playerSpec = playerSpec;
  }
}

//

const status = async (args) => {
  const jwt = await getLoginJwt();
  if (jwt !== null) {
    const userId = await getUserIdForJwt(jwt);

    const supabase = makeSupabase(jwt);
    const result = await supabase
      .from('accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    const { error, data } = result;
    if (!error) {
      console.log('user', data);

      const { active_asset } = data;
      if (active_asset) {
        // print the currently worn character
        const assetResult = await supabase
          .from('assets')
          .select('*')
          .eq('id', active_asset)
          .eq('type', 'npc')
          .maybeSingle();
        const { error, data } = assetResult;
        if (!error) {
          if (data) {
            console.log('wearing', data);
          } else {
            console.warn('failed to fetch worn avatar', active_asset);
          }
        } else {
          console.log(`could not get asset ${userId}: ${error}`);
        }
      } else {
        console.log('not wearing an avatar');
      }
    } else {
      console.log(`could not get account ${userId}: ${error}`);
    }
  } else {
    console.log('not logged in');
  }

  // const localGuid = await ensureLocalGuid();
  // console.log(`local guid is ${localGuid}`);
};
const login = async (args) => {
  const local = !!args.local;

  const handleLogin = async (j) => {
    const {
      id,
      jwt,
    } = j;
    await mkdirp(path.dirname(loginLocation));
    await fs.promises.writeFile(loginLocation, JSON.stringify({
      id,
      jwt,
    }));
    console.log('Successfully logged in.');
  };

  // if (!anonymous) {
    await new Promise((accept, reject) => {
      const serverOpts = getServerOpts();
      const server = https.createServer(serverOpts, (req, res) => {
        // console.log('got login response 1', {
        //   method: req.method,
        //   url: req.url,
        // });

        // set cors
        const corsHeaders = makeCorsHeaders(req);
        for (const { key, value } of corsHeaders) {
          res.setHeader(key, value);
        }

        // console.log('got login response 2', {
        //   method: req.method,
        //   url: req.url,
        // });

        // handle methods
        if (req.method === 'OPTIONS') {
          res.end();
        } else if (req.method === 'POST') {
          const bs = [];
          req.on('data', (d) => {
            bs.push(d);
          });
          req.on('end', async () => {
            // respond to the page
            res.end();

            // close the server
            server.close();

            const b = Buffer.concat(bs);
            const s = b.toString('utf8');
            const j = JSON.parse(s);
            await handleLogin(j);

            accept();
          });
        } else {
          res.statusCode = 405;
          res.end();
        }
      });
      // console.log('starting callback server on port', {
      //   callbackPort,
      // });
      server.on('error', (err) => {
        console.warn('callback server error', err);
      });
      // server.on('close', () => {
      //   console.log('callback server closed');
      // });
      server.listen(callbackPort, '0.0.0.0', (err) => {
        // console.log('callback server listening on port', {
        //   callbackPort,
        // });
        if (err) {
          console.warn(err);
        } else {
          const host = local ? `http://local.upstreet.ai:${localPort}` : `https://login.upstreet.ai`;
          const u = new URL(`${host}/logintool`);
          u.searchParams.set('callback_url', `https://local.upstreet.ai:${callbackPort}`);
          const p = u + '';
          console.log(`Waiting for login from ${p}`);
          open(p);
        }
      });
    });
  // } else {
  //   const j = await getAnonUser();
  //   await handleLogin(j);
  // }
};
const logout = async (args) => {

  const jwt = await getLoginJwt();

  if (!jwt){
    console.log("No user logged in");
    return;
  }

  await rimraf(loginLocation);
  console.log('Successfully logged out.');
};
const authorize = async (args) => {
  const appDirectory = args._[0] ?? cwd;

  const wranglerTomlPath = path.join(appDirectory, 'wrangler.toml');
  let s = await fs.promises.readFile(wranglerTomlPath, 'utf8');

  const jwt = await getLoginJwt();
  if (jwt) {
    let t = toml.parse(s);

    const guid = t.vars.GUID;
    const agentToken = await getAgentToken(jwt, guid);
    if (agentToken) {
      t = setWranglerTomlAgentToken(t, { agentToken });
      s = toml.stringify(t);

      await fs.promises.writeFile(wranglerTomlPath, s);

      console.log('agent authorized');
    } else {
      console.warn('could not get agent token');
      process.exit(1);
    }
  } else {
    console.warn('you are not logged in!');
    process.exit(1);
  }
};
/* const wear = async (args) => {
  const guid = args._[0] ?? '';

  if (guid) {
    const jwt = await getLoginJwt();
    if (jwt !== null) {
      const userId = await getUserIdForJwt(jwt);
      const supabase = makeSupabase(jwt);

      // get the asset to wear
      const getAssetResult = await supabase
        .from('assets')
        .select('*')
        .eq('id', guid)
        .eq('type', 'npc')
        .maybeSingle();
      if (getAssetResult.data) {
        const { type, start_url } = getAssetResult.data;

        if (type === 'npc') {
          const updateResult = await supabase
            .from('accounts')
            .update({
              active_asset: guid,
            })
            .eq('id', userId)
            .maybeSingle();
          const { error, data } = updateResult;
          if (!error || !data) {
            console.log(`wearing ${guid}`);
          } else {
            console.log(`${userId} could not wear character ${guid}: ${JSON.stringify(error)} ${JSON.stringify(data)}`);
            process.exit(1);
          }
        } else {
          console.log(`asset ${guid} is not an npc`);
          process.exit(1);
        }
      } else {
        console.log(`could not find asset ${guid}`);
        process.exit(1);
      }
    } else {
      console.log('not logged in');
      process.exit(1);
    }
  } else {
    console.log('no guid provided');
    process.exit(1);
  }
};
const unwear = async (args) => {
  const jwt = await getLoginJwt();
  if (jwt !== null) {
    const userId = await getUserIdForJwt(jwt);
    const supabase = makeSupabase(jwt);

    const updateResult = await supabase
      .from('accounts')
      .update({
        active_asset: null,
      })
      .eq('id', userId)
      .maybeSingle();
    const { error, data } = updateResult;
    if (!error && data) {
      console.log(`cleared worn character`);
    } else {
      console.log(`${userId} could not wear character ${guid}: ${JSON.stringify(error)} ${JSON.stringify(data)}`);
      process.exit(1);
    }
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const getUserWornAssetFromJwt = async (supabase, jwt) => {
  const userData = await getUserForJwt(jwt);
  if (userData) {
    const { active_asset } = userData;
    if (active_asset) {
      const assetResult = await supabase
        .from('assets')
        .select('*')
        .eq('id', active_asset)
        .eq('type', 'npc')
        .maybeSingle();
      const { error, data } = assetResult;
      if (!error) {
        if (data) {
          // console.log('wearing', data);
          return data;
        } else {
          // console.warn('failed to fetch worn avatar', active_asset);
          // throw new Error('failed to fetch worn avatar');
          return null;
        }
      } else {
        // console.log(`could not get asset ${userId}: ${error}`);
        // throw new Error('could not get asset');
        return null;
      }
    } else {
      // console.log('not wearing an avatar');
      // throw new Error('not wearing an avatar');
      return null;
    }
  } else {
    // throw new Error('could not get user');
    return null;
  }
}; */
const connectMultiplayer = async ({ room, anonymous, media, debug }) => {
  // dynamic import audio output module
  const audioOutput = await (async () => {
    try {
      return await import('./packages/upstreet-agent/packages/react-agents/devices/audio-output.mjs');
    } catch (err) {
      return null;
    }
  })();
  const SpeakerOutputStream = audioOutput?.SpeakerOutputStream;

  const getUserAsset = async () => {
    if (!anonymous) {
      let user = null;

      // try getting the user asset from the login
      const jwt = await getLoginJwt();
      if (jwt !== null) {
        const supabase = makeSupabase(jwt);
        // userAsset = await getUserWornAssetFromJwt(supabase, jwt);
        user = await getUserForJwt(jwt);
      }

      // use a default asset spec
      if (!user) {
        const userId = crypto.randomUUID();
        user = {
          id: userId,
          name: makeName(),
          description: '',
        };
        // ensureAgentJsonDefaults(userAsset);
      }

      return user;
    } else {
      return null;
    }
  };
  const userAsset = await getUserAsset();
  const userId = userAsset?.id;
  const name = userAsset?.name;

  // join the room
  const realms = new NetworkRealms({
    endpointUrl: multiplayerEndpointUrl,
    playerId: !anonymous ? userId : null,
    audioManager: null,
  });
  const playersMap = new Map(); // Map<string, Player>
  const typingMap = new TypingMap();
  const speakerMap = new SpeakerMap();

  const virtualWorld = realms.getVirtualWorld();
  const virtualPlayers = realms.getVirtualPlayers();
  // console.log('got initial players', virtualPlayers.getKeys());

  // log('waiting for initial connection...');

  let connected = false;
  const onConnect = async (e) => {
    // log('on connect...');
    e.waitUntil(
      (async () => {
        const realmKey = e.data.rootRealmKey;

        const existingAgentIds = Array.from(playersMap.keys());
        if (existingAgentIds.includes(userId)) {
          log('your character is already in the room! disconnecting.');
          process.exit(1);
        }

        if (!anonymous) {
          // Initialize network realms player.
          const localPlayer = new Player(userId, {
            id: userId,
            name,
            capabilities: [
              'human',
            ],
          });
          const _pushInitialPlayer = () => {
            realms.localPlayer.initializePlayer(
              {
                realmKey,
              },
              {},
            );
            realms.localPlayer.setKeyValue(
              'playerSpec',
              localPlayer.playerSpec,
            );
          };
          _pushInitialPlayer();
        }

        connected = true;

        const agentJsons = Array.from(playersMap.values()).map(
          (player) => player.playerSpec,
        );
        log(dedent`
          ${userAsset ? `You are ${JSON.stringify(name)} [${userId}]), chatting in ${room}.` : ''}
          In the room (${room}):
          ${agentJsons.length > 0 ?
            agentJsons
              .map((agent) => {
                return `* ${agent.name} [${agent.id}] ${agent.id === userId ? '(you)' : ''}`;
              })
              .join('\n')
            :
              `* no one else is here`
          }
          http://local.upstreet.ai:${devServerPort}
        `,
        );
      })(),
    );
  };
  realms.addEventListener('connect', onConnect);

  const _trackRemotePlayers = () => {
    virtualPlayers.addEventListener('join', (e) => {
      const { playerId, player } = e.data;
      if (connected) {
        log('remote player joined:', playerId);
      }

      const remotePlayer = new Player(playerId);
      playersMap.set(playerId, remotePlayer);

      // apply initial remote player state
      {
        const playerSpec = player.getKeyValue('playerSpec');
        if (playerSpec) {
          remotePlayer.setPlayerSpec(playerSpec);
        }
      }

      // Handle remote player state updates
      player.addEventListener('update', e => {
        const { key, val } = e.data;

        if (key === 'playerSpec') {
          remotePlayer.setPlayerSpec(val);
        }
      });
    });
    virtualPlayers.addEventListener('leave', e => {
      const { playerId } = e.data;
      if (connected) {
        log('remote player left:', playerId);
      }

      // remove remote player
      const remotePlayer = playersMap.get(playerId);
      if (remotePlayer) {
        playersMap.delete(playerId);
      } else {
        log('remote player not found', playerId);
        debugger;
      }

      // remove dangling audio streams
      for (const [streamId, stream] of Array.from(audioStreams.entries())) {
        if (stream.metadata.playerId === playerId) {
          stream.close();
          audioStreams.delete(streamId);
        }
      }
    });
  };
  _trackRemotePlayers();

  const audioStreams = new Map();
  const _trackAudio = () => {
    virtualPlayers.addEventListener('audiostart', e => {
      const {
        playerId,
        streamId,
        type,
        disposition,
      } = e.data;

      if (disposition === 'audio') {
        const outputStream = new SpeakerOutputStream();
        const { sampleRate } = outputStream;

        // decode stream
        const decodeStream = new AudioDecodeStream({
          type,
          sampleRate,
          codecs,
          format: 'i16',
        });
        (async () => {
          speakerMap.set(playerId, true);
          try {
            await decodeStream.readable.pipeTo(outputStream);
          } finally {
            speakerMap.set(playerId, false);
          }
        })();

        const writer = decodeStream.writable.getWriter();
        writer.metadata = {
          playerId,
        };
        audioStreams.set(streamId, writer);
      }
    });
    virtualPlayers.addEventListener('audio', e => {
      const {
        playerId,
        streamId,
        data,
      } = e.data;

      const stream = audioStreams.get(streamId);
      if (stream) {
        stream.write(data);
      } else {
        // throw away unmapped data
        // console.warn('dropping audio data', e.data);
      }
    });
    virtualPlayers.addEventListener('audioend', e => {
      const {
        playerId,
        streamId,
        data,
      } = e.data;

      const stream = audioStreams.get(streamId);
      if (stream) {
        stream.close();
        audioStreams.delete(streamId);
      } else {
        // throw away unmapped data
        console.warn('dropping audioend data', e.data);
      }
    });
  };
  if (media && SpeakerOutputStream) {
    _trackAudio();
  }

  const _bindMultiplayerChat = () => {
    const onchat = (e) => {
      const { message } = e.data;
      const { userId: messageUserId, name, method, args } = message;
      // console.log('got message', message);
      const attachments = (message.attachments ?? []).filter(a => !!a.url);

      switch (method) {
        case 'say': {
          const { text } = args;
          if (messageUserId !== userId) {
            let s = `${name}: ${text}`;
            if (attachments.length > 0) {
              s += '\n[Attachments:';
              for (const attachment of attachments) {
                const { type, url } = attachment;
                s += `\n  [${type}]: ${url}`;
              }
              s += '\n]';
            }
            log(s);

            // read attachments and print them to the console if we can
            if (attachments) {
              for (const attachment of attachments) {
                if (attachment.type.startsWith('image/')) {
                  (async () => {
                    const { url } = attachment;

                    const res = await fetch(url);
                    const ab = await res.arrayBuffer();

                    const b = Buffer.from(ab);
                    const jimp = await Jimp.read(b);

                    const imageRenderer = new ImageRenderer();
                    const {
                      text: imageText,
                    } = imageRenderer.render(jimp.bitmap, consoleImageWidth, undefined);
                    console.log(`${url}:`);
                    console.log(imageText);
                  })();
                }
              }
            }
           }
          break;
        }
        case 'log': {
          if (debug) {
            // console.log('got log message', JSON.stringify(args, null, 2));
            // const { userId, name, text } = args;
            // console.log(`\r${name}: ${text}`);
            // renderPrompt();
            const { text } = args;
            log(text);
            // console.log(eraseLine + JSON.stringify(args2, null, 2));
          }
          break;
        }
        case 'typing': {
          const { typing } = args;
          typingMap.set(messageUserId, { userId: messageUserId, name, typing });
          break;
        }
        case 'mediaPerception': {
          log(`[${name} checked an attachment`);
          break;
        }
        case 'addMemory': {
          log(`[${name} will remember that]`);
          break;
        }
        case 'queryMemories': {
          log(`[${name} is trying to remember]`);
          break;
        }
        case 'browserAction': {
          const {
            method: method2,
            args: args2,
            result,
            error,
          } = args;
          const webbrowserAction = webbrowserActionsToText.find((action) => action.method === method2);
          if (webbrowserAction) {
            // get the agent from the player spec
            const player = playersMap.get(messageUserId);
            // console.log('got player', player);
            let agent = player?.playerSpec;
            // console.log('got agent', agent);
            if (!agent) {
              console.warn('no agent for browserAction message user id', messageUserId);
              // debugger;
              agent = {};
            }
            const o = {
              // get the agent from the local player spec
              agent,
              method: method2,
              args: args2,
              result,
              error,
            };
            log(`[${webbrowserAction.toText(o)}]`);
          }
          // log(`[${name} checked an attachment`);
          break;
        }
        case 'paymentRequest': {
          const {
            type,
            props,
          } = args;
          const {
            amount,
            currency,
            interval,
            intervalCount,
          } = props;
          const price = (() => {
            const v = amount / 100;
            if (currency === 'usd') {
              return `$${v}`;
            } else {
              return `${v} ${currency.toUpperCase()}`;
            }
          })();
          const subscriptionText = type === 'subscription' ? ` per ${interval}${intervalCount !== 1 ? 's' : ''}` : '';
          log(`[${name} requests ${price}${subscriptionText} for ${type} ${props.name}${props.description ? `: ${props.description}` : ''}]`);
          // const { amount, currency, url, productName, productDescription, productQuantity } = args;
          // log(`[${name} requests ${amount / 100} ${currency} for ${productQuantity} x ${productName}]: ${url}`);
          break;
        }
        case 'nudge':
        case 'join':
        case 'leave': {
          // nothing
          break;
        }
        default: {
          // if (debug) {
            // console.log('got log message', JSON.stringify(args, null, 2));
            // const { userId, name, text } = args;
            // console.log(`\r${name}: ${text}`);
            // renderPrompt();
            log(`${name}: ${JSON.stringify(message)}`);
            // console.log(eraseLine + JSON.stringify(args2, null, 2));
          // }
          break;
        }
      }
    };
    realms.addEventListener('chat', onchat);
    const cleanup = () => {
      realms.removeEventListener('chat', onchat);
      typingMap.clear();
    };
    realms.addEventListener('disconnect', () => {
      cleanup();
    });
  };
  _bindMultiplayerChat();

  // console.log('update realms keys 1');
  await realms.updateRealmsKeys({
    realmsKeys: [room],
    rootRealmKey: room,
  });
  // console.log('update realms keys 2');

  return {
    userAsset,
    realms,
    playersMap,
    typingMap,
    speakerMap,
  };
};
/* const nudge = async (realms, targetPlayerId) => {
  const o = {
    method: 'nudge',
    args: {
      targetPlayerId,
    },
  };
  await realms.sendChatMessage(o);
}; */
const startMultiplayerListener = ({
  userAsset,
  realms,
  playersMap,
  typingMap,
  speakerMap,
  // local,
  startRepl,
}) => {
  const getPrompt = () => {
    const name = userAsset.name;

    let s = `${name} (you): `;
    
    // typing
    const tm = typingMap.getMap();
    const specs = Array.from(tm.values()).filter((spec) => spec.typing);
    if (specs.length > 0) {
      const names = specs.map((spec) => spec.name);
      const typingLine = `[${names.join(', ')} ${specs.length > 1 ? 'are' : 'is'} typing...] `;
      s = typingLine + s;
    }

    // speaking
    const localSpeaking = speakerMap.getLocal();
    if (localSpeaking) {
      s = `[🎤] ` + s;
    }

    return s;
  };
  const updatePrompt = () => {
    replServer.setPrompt(getPrompt());
  };
  const renderPrompt = () => {
    replServer.displayPrompt(true);
  };
  typingMap.addEventListener('typingchange', (e) => {
    if (replServer) {
      updatePrompt();
      renderPrompt();
    }
  });
  speakerMap.addEventListener('localspeakingchange', (e) => {
    if (replServer) {
      updatePrompt();
      renderPrompt();
    }
  });

  let replServer = null;
  if (startRepl) {
    /* const ensureJwt = (() => {
      let jwtPromise = null;
      return () => {
        if (jwtPromise === null) {
          jwtPromise = getLoginJwt();
        }
        return jwtPromise;
      };
    })(); */
    const getDoc = () => {
      const headRealm = realms.getClosestRealm(realms.lastRootRealmKey);
      const { networkedCrdtClient } = headRealm;
      const doc = networkedCrdtClient.getDoc();
      return doc;
    };

    let microphoneInput = null;
    const microphoneQueueManager = new QueueManager();
    const toggleMic = async () => {
      await microphoneQueueManager.waitForTurn(async () => {
        if (!microphoneInput) {
          const jwt = await getLoginJwt();
          if (!jwt) {
            throw new Error('not logged in');
          }

          const inputDevices = new InputDevices();
          const devices = await inputDevices.listDevices();
          const device = inputDevices.getDefaultMicrophoneDevice(devices.audio);
          
          const sampleRate = TranscribedVoiceInput.transcribeSampleRate;
          microphoneInput = inputDevices.getAudioInput(device.id, {
            sampleRate,
          });

          const onplayingchange = e => {
            const playing = e.data;
            // console.log('playing change', playing);
            if (playing) {
              microphoneInput.pause();
            } else {
              microphoneInput.resume();
            }
          };
          speakerMap.addEventListener('playingchange', onplayingchange);
          microphoneInput.on('close', e => {
            speakerMap.removeEventListener('playingchange', onplayingchange);
          });

          await new Promise((accept, reject) => {
            microphoneInput.on('start', e => {
              accept();
            });
          });
          console.log('* mic enabled *');

          const audioStream = new ReadableStream({
            start(controller) {
              microphoneInput.on('data', (data) => {
                controller.enqueue(data);
              });
              microphoneInput.on('end', (e) => {
                controller.close();
              });
            },
          });
          audioStream.id = crypto.randomUUID();
          audioStream.type = 'audio/pcm-f32';
          audioStream.disposition = 'text';

          (async () => {
            console.log('start streaming');
            const {
              waitForFinish,
            } = realms.addAudioSource(audioStream);
            await waitForFinish();
            realms.removeAudioSource(audioStream);
          })();
          renderPrompt();
        } else {
          microphoneInput.close();
          microphoneInput = null;
          console.log('* mic disabled *');
          renderPrompt();
        }
      });
    };
    let cameraInput = null;
    const cameraQueueManager = new QueueManager();
    const toggleCam = async () => {
      await cameraQueueManager.waitForTurn(async () => {
        if (!cameraInput) {
          const inputDevices = new InputDevices();
          const devices = await inputDevices.listDevices();
          const cameraDevice = inputDevices.getDefaultCameraDevice(devices.video);

          cameraInput = inputDevices.getVideoInput(cameraDevice.id, {
            // width,
            // height,
            fps: 5,
          });
          const videoRenderer = new TerminalVideoRenderer({
            width: 80,
            // height: rows,
            footerHeight: 5,
          });
          cameraInput.on('frame', (imageData) => {
            videoRenderer.setImageData(imageData);
            videoRenderer.render();
            renderPrompt();
          });
          console.log('* cam enabled *');
          renderPrompt();
        } else {
          cameraInput.close();
          cameraInput = null;
          console.log('* cam disabled *');
          renderPrompt();
        }
      });
    };
    const sendChatMessage = async (text) => {
      const userId = userAsset.id;
      const name = userAsset.name;
      await realms.sendChatMessage({
        method: 'say',
        userId,
        name,
        args: {
          text,
        },
        timestamp: Date.now(),
      });
    };

    replServer = repl.start({
      prompt: getPrompt(),
      eval: async (cmd, context, filename, callback) => {
        let error = null;
        try {
          cmd = cmd.replace(/;?\s*$/, '');

          if (cmd) {
            const cmdSplit = cmd.split(/\s+/);
            const commandMatch = (cmdSplit[0] ?? '').match(/^\/(\S+)/);
            if (commandMatch) {
              const command = commandMatch ? commandMatch[1] : null;
              switch (command) {
                case 'get': {
                  const key = cmdSplit[1];

                  const doc = getDoc();
                  if (key) {
                    const text = doc.getText(key);
                    const s = text.toString();
                    console.log(s);
                  } else {
                    const j = doc.toJSON();
                    console.log(j);
                  }
                  break;
                }
                case 'set': {
                  const key = cmdSplit[1];
                  const value = cmdSplit[2];

                  if (key && value) {
                    const doc = getDoc();
                    doc.transact(() => {
                      const text = doc.getText(key);
                      text.delete(0, text.length);
                      text.insert(0, value);
                    });
                  } else {
                    throw new Error('expected 2 arguments');
                  }
                  break;
                }
                case 'mic': {
                  toggleMic();
                  break;
                }
                case 'cam': {
                  toggleCam();
                  break;
                }
                default: {
                  console.log('unknown command', command);
                  break;
                }
              }
            } else {
              await sendChatMessage(cmd);
            }
          }
        } catch (err) {
          error = err;
        }
        callback(error);
      },
      ignoreUndefined: true,
    });
  }
  const exit = (e) => {
    process.exit(0);
  };
  if (replServer) {
    replServer.on('exit', exit);
  }

  const _bindRealmsLogging = () => {
    setLogFn((...args) => {
      process.stdout.write(eraseLine);
      console.log(...args);
      if (replServer) {
        renderPrompt();
      }
    });
  };
  _bindRealmsLogging();
};
const connect = async (args) => {
  const room = args._[0] ?? '';
  const local = !!args.local;
  const debug = !!args.debug;
  const browser = !!args.browser;
  const media = !!args.media;
  const startRepl = typeof args.repl === 'boolean' ? args.repl : !browser;

  if (room) {
    // set up the chat
    const { userAsset, realms, playersMap, typingMap, speakerMap } =
      await connectMultiplayer({
        room,
        media,
        debug,
      });
    if (browser) {
      const _chatEndpointUrl = local
        ? `http://localhost:3000`
        : chatEndpointUrl;
      open(`${_chatEndpointUrl}/rooms/${room}`)
        .catch( console.error );
    }
    if (startRepl) {
      startMultiplayerListener({
        userAsset,
        realms,
        playersMap,
        typingMap,
        speakerMap,
        startRepl: true,
      });
    }

    return {
      userAsset,
      realms,
      playersMap,
      typingMap,
      speakerMap,
    };
  } else {
    console.log('no room name provided');
    process.exit(1);
  }
};
const getGuidFromPath = async (p) => {
  const makeEnoent = () => new Error('not in an agent directory');

  const wranglerTomlPath = path.join(p, 'wrangler.toml');
  try {
    const wranglerTomString = await fs.promises.readFile(wranglerTomlPath, 'utf8');
    const wranglerToml = toml.parse(wranglerTomString);
    const agentJsonString = wranglerToml.vars.AGENT_JSON;
    const agentJson = agentJsonString && JSON.parse(agentJsonString);
    const id = agentJson?.id;
    if (id) {
      return id;
    } else {
      throw makeEnoent();
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw makeEnoent();
    } else {
      throw err;
    }
  }
};
/*
returns: [{ guid: string, directory: string | null }]
*/
const parseAgentSpecs = async (agentRefSpecs = []) => {
  if (!Array.isArray(agentRefSpecs)) {
    throw new Error('expected agent ref specs to be an array; got ' + JSON.stringify(agentRefSpecs));
  }
  if (!agentRefSpecs.every((agentRefSpec) => typeof agentRefSpec === 'string')) {
    throw new Error('expected agent ref specs to be strings; got ' + JSON.stringify(agentRefSpecs));
  }

  if (agentRefSpecs.length === 0) {
    // if no agent refs are provided, use the current directory
    const directory = cwd;
    const guid = await getGuidFromPath(directory);
    return [
      {
        ref: directory,
        guid,
        directory,
      },
    ];
  } else {
    // treat each agent ref as a guid or directory
    const agentSpecsPromises = agentRefSpecs.map(async (agentRefSpec) => {
      if (isGuid(agentRefSpec)) {
        // if it's a cloud agent
        return {
          ref: agentRefSpec,
          guid: agentRefSpec,
          directory: null,
        };
      } else {
        // if it's a directory agent
        const directory = agentRefSpec;
        const guid = await getGuidFromPath(directory);
        return {
          ref: directory,
          guid,
          directory,
        };
      }
    });
    return await Promise.all(agentSpecsPromises);
  }
};
const chat = async (args) => {
  // console.log('got chat args', JSON.stringify(args));
  const agentSpecs = await parseAgentSpecs(args._[0]);
  // const dev = !!args.dev;
  const room = args.room ?? makeRoomName();
  const debug = !!args.debug;

  const jwt = await getLoginJwt();
  if (jwt !== null) {
    // start dev servers for the agents
    const devServerPromises = agentSpecs
      .map(async (agentSpec, index) => {
        if (agentSpec.directory) {
          const cp = await startDevServer(agentSpec, index, {
            debug,
          });
          return cp;
        } else {
          return null;
        }
      })
      .filter(Boolean);
    await Promise.all(devServerPromises);

    // wait for agents to join the multiplayer room
    await Promise.all(
      agentSpecs.map(async (agentSpec) => {
        await join({
          _: [agentSpec.ref, room],
          // dev,
          // debug,
        });
      }),
    );

    // connect to the chat
    await connect({
      _: [room],
      browser: args.browser,
      media: !args.browser,
      debug: args.debug,
      local: args.local,
    });

    // return {
    //   // ws: webSockets[0],
    //   close: () => {
    //     for (const ws of webSockets) {
    //       ws.close();
    //     }
    //   },
    // };
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
/* const simulate = async (args) => {
  let guidsOrDevPathIndexes = args._[0] ?? [];
  const dev = !!args.dev;
  const room = args.room ?? makeRoomName();
  const debug = !!args.debug;

  // ensure guids
  if (guidsOrDevPathIndexes.length === 0) {
    if (!dev) {
      const guid = await getGuidFromPath(cwd);
      guidsOrDevPathIndexes = [guid];
    } else {
      guidsOrDevPathIndexes = [{
        agentDirectory: cwd,
        portIndex: 0,
      }];
    }
  } else {
    if (!dev) {
      guidsOrDevPathIndexes = await Promise.all(guidsOrDevPathIndexes.map(async (guidOrDevPathIndex) => {
        if (isGuid(guidOrDevPathIndex)) {
          return guidOrDevPathIndex;
        } else {
          const guid = await getGuidFromPath(guidOrDevPathIndex);
          return guid;
        }
      }));
    }
  }

  // wait for agents to join the multiplayer room
  const wsPromises = Promise.all(
    guidsOrDevPathIndexes.map(async (guidOrDevPathIndex) => {
      return await join({
        _: [guidOrDevPathIndex, room],
        local: args.local,
        dev,
        debug,
      })
    }),
  );
  const webSockets = await wsPromises;

  const { userAsset, realms, playersMap, typingMap } =
    await connectMultiplayer({
      room,
      anonymous: true,
      debug,
    });
  startMultiplayerListener({
    userAsset,
    realms,
    playersMap,
    typingMap,
    // startRepl: false,
  });

  // collect the guids
  const guids = await Promise.all(
    guidsOrDevPathIndexes.map(async (guidOrDevPathIndex) => {
      if (isGuid(guidOrDevPathIndex)) {
        return guidOrDevPathIndex;
      } else {
        const guid = await getGuidFromPath(guidOrDevPathIndex.agentDirectory);
        return guid;
      }
    }),
  );

  // nudge a random agent
  const _nudge = async () => {
    const agentId = shuffle(guids)[0];
    await nudge(realms, agentId);
  };
  await _nudge();

  return {
    // ws: webSockets[0],
    close: () => {
      for (const ws of webSockets) {
        ws.close();
      }
    },
  };
}; */
const logs = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);

  const jwt = await getLoginJwt();
  if (jwt) {
    const eventSources = agentSpecs.map((agentSpec) => {
      const { directory } = agentSpec;
      const u = `${deployEndpointUrl}/agents/${directory}/logs`;
      const eventSource = new EventSource(u, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      });
      eventSource.addEventListener('message', (e) => {
        const j = JSON.parse(e.data);
        if (typeof j === 'string') {
          process.stdout.write(j);
        } else {
          console.log(j);
        }
      });
      eventSource.addEventListener('error', (e) => {
        console.warn('error', e);
      });
      eventSource.addEventListener('close', (e) => {
        process.exit(0);
      });
    });

    return {
      close: () => {
        for (const eventSource of eventSources) {
          eventSource.close();
        }
      },
    };
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const listen = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
  const dev = !!args.dev;
  const debug = !!args.debug;

  const localAgentSpecs = agentSpecs.filter((agentSpec) => !!agentSpec.directory);
  const cloudAgentSpecs = agentSpecs.filter((agentSpec) => !agentSpec.directory);

  let webSockets = [];
  if (dev) {
    // wait for agents to join the multiplayer 
    const room = makeRoomName();
    await Promise.all(
      localAgentSpecs.map(async (agentSpec) => {
        await join({
          _: [agentSpec.ref, room],
          local: args.local,
          // dev,
          debug,
        })/* .then(() => {
          console.log('join promise ok');
        }).catch((err) => {
          console.warn('join promise error', err);
        }); */
      }),
    );
  }

  const connectEventSource = (src) => {
    const eventSource = new EventSource(src);
    eventSource.addEventListener('message', (e) => {
      const j = JSON.parse(e.data);
      console.log('event source', j);
    });
    eventSource.addEventListener('error', (e) => {
      console.warn('error', e);
    });
    eventSource.addEventListener('close', (e) => {
      process.exit(0);
    });
    return eventSource;
  }

  const eventsPath = `/events`;
  const eventSources = localAgentSpecs.map((agentSpec, index) =>
    connectEventSource(`${getLocalAgentHost(index)}${eventsPath}`)
  ).concat(cloudAgentSpecs.map((agentSpec) =>
    connectEventSource(`${getCloudAgentHost(agentSpec.guid)}${eventsPath}`)
  ));

  return {
    // ws: webSockets[0],
    close: () => {
      for (const ws of webSockets) {
        ws.close();
      }
      for (const eventSource of eventSources) {
        eventSource.close();
      }
    },
  };
};
// XXX rename command to charge or refill
const fund = async (args) => {
  const local = !!args.local;
  const dev = !!args.dev;
  let guid = await (async () => {
    if (!dev) {
      return args._[0] ?? '';
    } else {
      return await ensureLocalGuid(); // XXX use the agent's local guid
    }
  })();
  let amount = parseFloat(args._[1]) || 0;
  if (!guid) {
    console.warn('need guid');
    process.exit(1);
  }

  const result = await new Promise((accept, reject) => {
    const serverOpts = getServerOpts();
    const server = https.createServer(serverOpts, (req, res) => {
      // set cors
      const corsHeaders = makeCorsHeaders(req);
      for (const { key, value } of corsHeaders) {
        res.setHeader(key, value);
      }

      // handle methods
      if (req.method === 'OPTIONS') {
        res.end();
      } else if (req.method === 'POST') {
        const bs = [];
        req.on('data', (d) => {
          bs.push(d);
        });
        req.on('end', async () => {
          // respond to the page
          res.end();

          // close the server
          server.close();

          const b = Buffer.concat(bs);
          const s = b.toString('utf8');
          const j = JSON.parse(s);
          accept(j);
        });
      } else {
        res.statusCode = 405;
        res.end();
      }
    });
    server.listen(callbackPort, (err) => {
      if (err) {
        console.warn(err);
      } else {
        const _loginHost = local
          ? `https://local.upstreet.ai:4443`
          : `https://login.upstreet.ai`;
        const p = `${_loginHost}/wallettool?method=${'fund'}&dstGuid=${guid}&amount=${amount}`;
        console.log(`Waiting for funding at ${p}`);
        open(p);
      }
    });
  });
  console.log('got funding result', result);
  process.exit(0);
};
const deposit = async (args) => {
  const local = !!args.local;
  const dev = !!args.dev;
  const network = args.network;
  let guid = await (async () => {
    if (!dev) {
      return args._[0] ?? '';
    } else {
      return await ensureLocalGuid(); // XXX use the agent's local guid
    }
  })();
  let amount = parseFloat(args._[1]) || 0;

  const address = await (async () => {
    const jwt = await getLoginJwt();
    if (jwt) {
      const supabase = makeSupabase(jwt);
      const agentJson = await getAssetJson(supabase, guid);
      if (agentJson) {
        return agentJson.address;
      } else {
        console.warn('no agent found: ' + guid);
        process.exit(1);
      }
    } else {
      console.log('not logged in');
      process.exit(1);
    }
  })();

  const result = await new Promise((accept, reject) => {
    const serverOpts = getServerOpts();
    const server = https.createServer(serverOpts, (req, res) => {
      // set cors
      const corsHeaders = makeCorsHeaders(req);
      for (const { key, value } of corsHeaders) {
        res.setHeader(key, value);
      }

      // handle methods
      if (req.method === 'OPTIONS') {
        res.end();
      } else if (req.method === 'POST') {
        const bs = [];
        req.on('data', (d) => {
          bs.push(d);
        });
        req.on('end', async () => {
          // respond to the page
          res.end();

          // close the server
          server.close();

          const b = Buffer.concat(bs);
          const s = b.toString('utf8');
          const j = JSON.parse(s);
          accept(j);
        });
      } else {
        res.statusCode = 405;
        res.end();
      }
    });
    server.listen(callbackPort, (err) => {
      if (err) {
        console.warn(err);
      } else {
        const host = local
          ? `https://local.upstreet.ai:4443`
          : `https://login.upstreet.ai`;
        const p = `${host}/wallettool?method=${'deposit'}&dstAddress=${address}&network=${network}&amount=${amount}`;
        console.log(`Waiting for deposit at ${p}`);
        open(p);
      }
    });
  });
  console.log('got deposit result', result);
};
const withdraw = async (args) => {
  const guid = args._[0] ?? '';
  const amount = parseFloat(args._[1]) || 0;
  const destinationAddress = args._[2] ?? '';
  const network = args.network ?? Object.keys(providers)[0];
  if (!guid) {
    console.warn('need guid');
    process.exit(1);
  }
  if (!destinationAddress) {
    console.warn('need destination address');
    process.exit(1);
  }

  const jwt = await getLoginJwt();
  if (jwt) {
    const supabase = makeSupabase(jwt);

    const mnemonic = await getAgentMnemonic(supabase, guid);
    const wallets = getConnectedWalletsFromMnemonic(mnemonic);
    const wallet = wallets[network];

    // send
    const wei = BigInt(amount * 1e18);
    console.log('send transaction', {
      to: destinationAddress,
      value: '0x' + wei.toString(16),
    });
    const tx = await wallet.sendTransaction({
      to: destinationAddress,
      value: '0x' + wei.toString(16),
    });
    console.log('got tx', { tx });

    // wait for the tx receipt
    const receipt = await tx.wait();
    console.log('got receipt', { receipt });
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
/* const generateAgentJsonFromPrompt = async (prompt, style = 'Simple 2d anime style with strong lines and bold colors.') => {
  const jwt = await getLoginJwt();
  if (jwt) {
    const numRetries = 5;
    for (let i = 0; i < numRetries; i++) {
      const messages = [
        {
          role: 'system',
          content: dedent`
            You are an AI agent profile generator. The user will specify a prompt, and you will generate an agent profile based on it.
            Agents are not chatbots, apps, or assistants. They are simulated characters with unique personalities, backgrounds, and abilities.
            Respond in proper JSON! You must escape newlines (i.e. \n)!
            The format is:
            \`\`\`
            {
              "name": "A name for the agent",
              "description": "A short description of the agent. This will be used in search results, meta tags, and profile pages. It can be a few sentences long.",
              "bio": "A more in-depth simulated biography for the agent. It can be up to a few paragraphs long.",
              "visualDescription": "A visual description of what the agent looks like, as a short image prompt.",
            }
            \`\`\`
          `,
        },
        {
          role: 'user',
          content: `Generate an agent for the following prompt:\n${prompt}`,
        },
      ];
      try {
        const content = await fetchChatCompletion({
          model: defaultModels[0],
          messages,
        }, {
          jwt,
        });
        const codeBlock = parseCodeBlock(content);
        const j = JSON.parse(codeBlock);
        j.visualDescription = `${style} ${prompt}`;
        return j;
      } catch (err) {
        console.warn('chat completion error', err);
        continue;
      }
    }
  } else {
    throw new Error('not logged in');
  }
};
const generateImage = async (prompt) => {
  const jwt = await getLoginJwt();
  if (jwt) {
    const blob = await fetchImageGeneration(prompt);
    return blob;
  } else {
    throw new Error('not logged in');
  }
};
const getCodeGenContext = async () => {
  // load the component jsdoc nodes
  const nodes = await (async () => {
    // generate new components based on the actions the agent should be allowed to take
    const defaultComponentsPath = path.join(
      BASE_DIRNAME,
      'sdk',
      'src',
      'default-components.tsx',
    );
    const componentsPath = path.join(
      BASE_DIRNAME,
      'sdk',
      'src',
      'components.tsx',
    );
    const paths = [
      defaultComponentsPath,
      componentsPath,
    ];
    
    const nodes = [];
    for (const p of paths) {
      // read the file
      let s = await fs.promises.readFile(p, 'utf8');
      // remove everything up to and including the line "// END IMPORTS", including newlines
      s = s.replace(/[\s\S]*?\/\/ END IMPORTS\n/, '');
      // write the file to tmp dir
      const tmpDir = await makeTempDir();
      const p2 = path.join(tmpDir, path.basename(p));
      await fs.promises.writeFile(p2, s);
      // convert to data url
      // console.log('got doc nodes 1', { p2 });
      let ns = await doc(`file://${p2}`);
      // console.log('got doc nodes 2', nodes);
      // filter to only documented nodes
      ns = ns.filter((node) => !!node.jsDoc);
      ns.splice(
        ns.findIndex(node => node.name === 'DefaultAgentComponents'),
        1,
      );
      ns = ns.map((node) => ({
        ...node.jsDoc,
        name: node.name,
      }));
      // add to the nodes
      nodes.push(...ns);
      await rimraf(tmpDir);
    }
    // console.log('got doc nodes 3', JSON.stringify(nodes, null, 2));

    return nodes;
  })();
  // console.log('got nodes', JSON.stringify(nodes, null, 2));

  return {
    nodes,
  };
}; */
/* const generateTemplateFromPrompt = async (prompt) => {
  // create a temporary directory
  const templateDirectory = await makeTempDir();

  // copy over the basic template
  const basicTemplateDirectory = path.join(templatesDirectory, 'empty');
  await recursiveCopy(basicTemplateDirectory, templateDirectory);

  // generate the agent json
  const agentJson = await generateAgentJsonFromPrompt(prompt);

  console.log(pc.italic('Generating code...'));
  const agentJSXPath = path.join( templateDirectory, 'agent.tsx' );
  const codeGenContext = await getCodeGenContext();
  const { imports } = await modifyAgentJSXWithGeneratedCode({
    agentJSXPath,
    prompt,
    codeGenContext,
  });
  console.log('\nUsing components:');
  console.log(
    imports
      .map(x => '- ' + pc.cyan(x))
      .join('\n')
      .trim() + '\n'
  );

  console.log(pc.italic('Generating avatar...'));
  // generate the agent preview_url
  const blob = await generateImage(agentJson.visualDescription);
  // upload to r2
  const imageGuid = crypto.randomUUID();
  const previewUrl = await putFile(`previews/${imageGuid}.png`, blob);
  // set the agentJson preview url
  agentJson.previewUrl = previewUrl;

  // write back the generated the agent json
  await fs.promises.writeFile(
    path.join(templateDirectory, agentJsonSrcFilename),
    JSON.stringify(agentJson, null, 2),
  );

  return {
    templateDirectory,
    agentJson,
  };
}; */
const setWranglerTomlAgentToken = (
  t,
  { agentToken },
) => {
  t.vars.AGENT_TOKEN = agentToken;
  return t;
};
const makeRoomName = () => `room:` + makeId(8);
/* const dev = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
  const debug = !!args.debug;

  // start dev servers for the agents
  const devServerPromises = agentSpecs
    .map(async (agentSpec, index) => {
      if (agentSpec.directory) {
        const cp = await startDevServer(agentSpec, index, {
          debug,
        });
        return cp;
      } else {
        return null;
      }
    })
    .filter(Boolean);
  await Promise.all(devServerPromises);
}; */
const search = async (args) => {
  const prompt = args._[0] ?? '';

  const jwt = await getLoginJwt();
  const userId = jwt && (await getUserIdForJwt(jwt));
  if (userId) {
    if (prompt) {
      const supabase = makeAnonymousClient(env);
      const embedding = await lembed(prompt, {
        jwt,
      });
      /*
        call the supabase function:
        function match_assets(
          embedding vector(3072),
          match_threshold float,
          match_count int
        )
      */
      const result = await supabase.rpc('match_assets', {
        query_embedding: embedding,
        match_threshold: 0.2,
        match_count: 10,
      });
      const { error, data } = result;
      if (!error) {
        const assets = data.map((asset) => {
          return `${asset.id}: ${asset.name ?? ''}: ${asset.description ?? ''}`;
        });
        console.log(assets.join('\n'));
      } else {
        console.warn(error);
        process.exit(1);
      }
    } else {
      throw new Error('no prompt');
    }
  } else {
    throw new Error('not logged in');
  }
};
const getNpmRoot = async () => {
  const { stdout } = await execFile('npm', ['root', '--quiet', '-g']);
  return stdout.trim();
};
const ensureNpmRoot = (() => {
  let npmRootPromise = null;
  return () => {
    if (npmRootPromise === null) {
      npmRootPromise = getNpmRoot();
    }
    return npmRootPromise;
  };
})();
const runJest = async (directory) => {
  const npmRoot = await ensureNpmRoot();
  await execFile(process.argv[0], ['--experimental-vm-modules', jestBin], {
    stdio: 'inherit',
    cwd: directory,
    env: {
      NODE_PATH: npmRoot, // needed to import usdk
    },
  });
};
const test = async (args) => {
  const all = !!args.all;
  const dev = true;
  const debug = !!args.debug;

  const jwt = await getLoginJwt();
  if (jwt !== null) {
    const runAgentTest = async (agentSpec, index) => {
      // console.log('got chat args', JSON.stringify(args));

      // start the dev agents
      const cp = await startDevServer(agentSpec, index, {
        debug,
      });

      // wait for agents to join the multiplayer room
      const room = makeRoomName();
      await join({
        _: [guidOrDevPathIndex, room],
        // dev,
        // debug,
      });

      // connect to the chat
      const {
        realms,
      } = await connect({
        _: [room],
        browser: false,
        media: false,
        repl: false,
        debug,
        local: false,
      });

      // run tests
      try {
        await runJest(agentSpec.directory);
      } finally {
        // clean up
        realms.disconnect();
        process.kill(cp.pid, 'SIGTERM');
      }
    };
    const testTemplate = async (template) => {
      console.log('running template test: ' + template);

      // create the template
      const testDirectory = await makeTempDir();
      await create({
        _: [testDirectory],
        template,
      });

      await runAgentTest(testDirectory);
    };

    if (all) {
      const templateNames = await getTemplateNames();
      for (const template of templateNames) {
        await testTemplate(template);
      }
    } else {
      const agentSpecs = await parseAgentSpecs(args._[0]);
      for (let i = 0; i < agentSpecs.length; i++) {
        const agentSpec = agentSpecs[i];
        await runAgentTest(agentSpec, i);
      }
    }
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const ensureWebpEncoder = (() => {
  let webpEncoder = null;
  return () => {
    if (webpEncoder === null) {
      webpEncoder = new WebPEncoder();
    }
    return webpEncoder;
  }
})();
const capture = async (args) => {
  const microphone = args.microphone;
  const camera = args.camera;
  const screen = args.screen;
  const width = args.width;
  const height = args.height;
  const rows = args.rows;
  const cols = args.cols ?? 80;
  const query = args.query;
  const execute = !!args.execute;

  if (camera && screen) {
    throw new Error('camera and screen are mutually exclusive');
  }

  const inputDevices = new InputDevices();
  const devices = await inputDevices.listDevices();

  if (
    microphone ||
    camera ||
    screen
  ) {
    const jwt = await getLoginJwt();
    if (jwt !== null) {
      // console.log('got devices', devices);
      const cameraDevice = typeof camera === 'boolean' ? inputDevices.getDefaultCameraDevice(devices.video) : devices.video.find(d => d.id === camera);
      const screenDevice = typeof screen === 'boolean' ? inputDevices.getDefaultScreenDevice(devices.video) : devices.video.find(d => d.id === screen);
      const microphoneDevice = typeof microphone === 'boolean' ? inputDevices.getDefaultMicrophoneDevice(devices.audio) : devices.audio.find(d => d.id === microphone);
      
      if (microphone) {
        if (!microphoneDevice) {
          throw new Error('invalid microphone device');
        }

        const sampleRate = AudioInput.defaultSampleRate;
        const microphoneInput = inputDevices.getAudioInput(microphoneDevice.id, {
          sampleRate,
        });
        microphoneInput.on('start', e => {
          console.log('listening...');
        });

        const transcribedVoiceInput = new TranscribedVoiceInput({
          audioInput: microphoneInput,
          sampleRate,
          jwt,
        });
        transcribedVoiceInput.addEventListener('speechstart', e => {
          console.log('capturing...');
        });
        transcribedVoiceInput.addEventListener('speechstop', e => {
          console.log('captured');
        });
        transcribedVoiceInput.addEventListener('transcription', async (e) => {
          console.log('transcription', e.data);
        });
      }
      
      if (camera) {
        if (!cameraDevice) {
          throw new Error('invalid camera device');
        }

        const cameraQueueManager = new QueueManager();
        
        const cameraInput = inputDevices.getVideoInput(cameraDevice.id, {
          width,
          height,
          fps: 5,
        });
        const videoRenderer = new TerminalVideoRenderer({
          width: cols,
          height: rows,
        });
        cameraInput.on('frame', async (imageData) => {
          videoRenderer.setImageData(imageData);
          videoRenderer.render();

          if (execute) {
            await cameraQueueManager.waitForTurn(async () => {
              // encode to webp
              const webpEncoder = ensureWebpEncoder();
              const frame = await webpEncoder.encode(imageData);
              const blob = new Blob([frame], { type: 'image/webp' });

              // describe the image
              let text = await describe(blob, query, {
                jwt,
              });
              text = text.replace(/[\r\n]/g, ' ');
              videoRenderer.setDescription(text);
              videoRenderer.render();
            });
          }
        });
      } else if (screen) {
        if (!screenDevice) {
          throw new Error('invalid screen device');
        }

        const screenQueueManager = new QueueManager();

        const screenInput = inputDevices.getVideoInput(screenDevice.id, {
          width,
          height,
          fps: 5,
        });
        const videoRenderer = new TerminalVideoRenderer({
          width: cols,
          height: rows,
        });
        screenInput.on('frame', async (imageData) => {
          // console.log('got screen frame', imageData);
          videoRenderer.setImageData(imageData);
          videoRenderer.render();

          if (execute) {
            await screenQueueManager.waitForTurn(async () => {
              // encode to webp
              const webpEncoder = ensureWebpEncoder();
              const frame = await webpEncoder.encode(imageData);
              const blob = new Blob([frame], { type: 'image/webp' });

              // describe the image
              let text = await describe(blob, query, {
                jwt,
              });
              text = text.replace(/[\r\n]/g, ' ');
              videoRenderer.setDescription(text);
              videoRenderer.render();
            });
          }
        });
      }
    } else {
      console.log('not logged in');
      process.exit(1);
    }
  } else {
    // console.log('devices:');
    console.log(devices);
  }
};
const deploy = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
  if (!agentSpecs.every((agentSpec) => !!agentSpec.directory)) {
    throw new Error('all agent specs must have directories');
  }

  // log in
  const jwt = await getLoginJwt();
  if (jwt) {
    for (const agentSpec of agentSpecs) {
      const { directory } = agentSpec;

      const uint8Array = await packZip(directory, {
        exclude: [/\/node_modules\//],
      });
      // upload the agent
      const u = `${deployEndpointUrl}/agent`;
      const req = https.request(u, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/zip',
          'Content-Length': uint8Array.byteLength,
        },
      });
      // create a stream to pass to the request
      const dataStream = new stream.PassThrough();
      dataStream.pipe(req);
      // dataStream.on('data', (b) => {
      // });
      // dataStream.on('end', (b) => {
      // });
      // pump the loop
      (async () => {
        const chunkSize = 4 * 1024;
        const logSize = (i) => {
          process.stdout.write(
            `\r${prettyBytes(i)} / ${prettyBytes(uint8Array.byteLength)} (${((i / uint8Array.byteLength) * 100).toFixed(2)}%)`,
          );
        };
        for (let i = 0; i < uint8Array.byteLength; i += chunkSize) {
          logSize(i);
          const slice = Buffer.from(uint8Array.slice(i, i + chunkSize));
          const ok = dataStream.write(slice);
          if (!ok) {
            await new Promise((accept) => {
              dataStream.once('drain', accept);
            });
          }
        }
        dataStream.end();

        logSize(uint8Array.length);
        console.log();
      })();
      const wranglerTomlJson = await new Promise((accept, reject) => {
        req.on('response', async (res) => {
          // console.log('got response', res.statusCode);

          const b = await new Promise((accept, reject) => {
            const bs = [];
            res.on('data', (b) => {
              bs.push(b);
            });
            res.on('end', async () => {
              const b = Buffer.concat(bs);
              accept(b);
            });
            res.on('error', reject);
          });
          const s = b.toString('utf8');
          // console.log('got response output', s);

          if (res.statusCode === 200) {
            const j = JSON.parse(s);
            accept(j);
          } else {
            reject(new Error('deploy failed: ' + s));
          }
        });
        req.on('error', reject);
      });
      const agentJsonString = wranglerTomlJson.vars.AGENT_JSON;
      const agentJson = JSON.parse(agentJsonString);
      const guid = agentJson.id;
      const url = getAgentHost(guid);
      
      console.log();
      console.group(pc.green('Agent Deployed Successfully:'), '\n');
      console.log(pc.cyan('✓ Host:'), url, '\n');
      console.log(pc.cyan('✓ Public Profile:'), getAgentPublicUrl(guid), '\n');
      console.log(pc.cyan('✓ Chat using the sdk, run:'), 'usdk chat ' + guid, '\n');
    }
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const pull = async (args) => {
  const agentId = args._[0] ?? '';
  const dstDir = args._[1] ?? cwd;
  const force = !!args.force;
  const forceNoConfirm = !!args.forceNoConfirm;

  const jwt = await getLoginJwt();
  const userId = jwt && (await getUserIdForJwt(jwt));
  if (userId) {
    // clean the old directory
    await cleanDir(dstDir, {
      force,
      forceNoConfirm,
    });

    // download the source
    console.log(pc.italic('Downloading source...'));
    const u = `https://${aiProxyHost}/agents/${agentId}/source`;
    try {
      const req = await fetch(u, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (req.ok) {
        const zipBuffer = await req.arrayBuffer();
        // console.log('downloaded source', zipBuffer.byteLength);

        // extract the source
        console.log(pc.italic('Extracting zip...'));
        await extractZip(zipBuffer, dstDir);

        console.log(pc.italic('Installing dependencies...'));
        try {
          await npmInstall(dstDir);
        } catch (err) {
          console.warn('npm install failed:', err.stack);
          process.exit(1);
        }
      } else {
        const text = await req.text();
        console.warn('pull request error', text);
        process.exit(1);
      }
    } catch (err) {
      console.warn('pull request failed', err);
      process.exit(1);
    }
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const ls = async (args) => {
  const network = args.network ?? Object.keys(providers)[0];
  // const local = !!args.local;
  // const dev = !!args.dev;

  const queueManager = new QueueManager({
    parallelism: 8,
  });

  const listAssets = async (supabase, agentAssets) => {
    const table = new Table({
      head: [
        'id',
        'name',
        'enabled',
        'address',
        'location',
        'balance',
        'battery',
        // 'bio',
        'server',
        'created',
      ],
      colWidths: [38, 20, 9, 44, 10, 10, 10, /*40,*/ 73, 10],
    });
    const promises = [];
    for (let i = 0; i < agentAssets.length; i++) {
      const agent = agentAssets[i];
      const agentHost = getCloudAgentHost(agent.id);
      const p = queueManager.waitForTurn(async () => {
        const statusPromise = (async () => {
          const u = `${agentHost}/status`;
          const proxyRes = await fetch(u);
          if (proxyRes.ok) {
            const j = await proxyRes.json();
            return j;
          } else {
            return null;
          }
        })();
        const creditsPromise = (async () => {
          const creditsResult = await supabase
            .from('credits')
            .select('credits')
            .eq('agent_id', agent.id)
            .maybeSingle();
          const { error, data } = creditsResult;
          if (!error) {
            return data?.credits ?? 0;
          } else {
            throw new Error(
              `could not get credits for agent ${agent.id}: ${error}`,
            );
          }
        })();

        const res = await fetch(`${agent.start_url}/agent.json`);
        if (res.ok) {
          const agentJson = await res.json();
          if (
            agentJson.id &&
            agentJson.name &&
            agentJson.address &&
            agentJson.bio
          ) {
            const balancePromise = (async () => {
              const provider = providers[network];
              const balance = await provider.getBalance(agentJson.address);
              const ethBalance = ethers.formatEther(balance);
              return ethBalance;
            })();
            const [status, credits, balance] = await Promise.all([
              statusPromise,
              creditsPromise,
              balancePromise,
            ]);

            const serverUrl = agentHost;

            table.push([
              agentJson.id,
              agentJson.name,
              status?.enabled ?? false,
              agentJson.address,
              status?.room ?? '',
              balance,
              credits,
              // agentJson.bio,
              serverUrl,
              timeAgo(new Date(agent.created_at)),
            ]);
          // } else {
          //   console.warn('skipping agent', agentJson);
          }
        } else {
          console.warn('could not get agent json', agent.start_url);
        }
      });
      promises.push(p);
    }
    await Promise.all(promises);
    console.log(table.toString());
  };

  const jwt = await getLoginJwt();
  const userId = jwt && (await getUserIdForJwt(jwt));
  if (userId) {
    const supabase = makeSupabase(jwt);

    // if (!dev) {
      // list agents in the account
      const assetsResult = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'npc');
      const { error, data } = assetsResult;
      if (!error) {
        // console.log('got remote data', data);
        await listAssets(supabase, data);
        process.exit(0);
      } else {
        throw new Error(`could not get assets for user ${userId}: ${error}`);
      }
    /* } else {
      // use the local development guid
      const guid = await ensureLocalGuid();
      const user_id = makeZeroGuid();
      const created_at = new Date().toISOString();
      const agent = {
        start_url: devAgentJsonUrl,
        created_at,
        user_id,
        name: '',
        id: guid,
        preview_url: '',
        type: 'npc',
        description: '',
        rarity: null,
        slots: null,
        hero_urls: null,
        address: null,
        enabled: false,
        character_name: null,
      };
      await listAssets(supabase, [agent]);
      process.exit(0);
    } */
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const rm = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);

  const jwt = await getLoginJwt();
  if (jwt) {
    for (const agentSpec of agentSpecs) {
      const { guid } = agentSpec;
      const u = `${deployEndpointUrl}/agent`;
      const req = await fetch(u, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/zip',
          // 'Content-Length': uint8Array.byteLength,
        },
        body: JSON.stringify({
          guid,
        }),
      });
      if (req.ok) {
        await req.json();
        console.log(`deleted agent ${guid}`);
      } else {
        const text = await req.text();
        console.warn(`could not delete agent ${guid}: ${text}`);
      }
    }
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
const join = async (args) => {
  const agentSpecs = await parseAgentSpecs([args._[0] ?? '']); // first arg is assumed to be a string
  const room = args._[1] ?? makeRoomName();

  if (agentSpecs.length === 1) {
    const _joinAgent = async (agentSpec, room) => {
      const u = `${getAgentSpecHost(agentSpec)}/join`;
      const joinReq = await fetch(u, {
        method: 'POST',
        body: JSON.stringify({
          room,
          only: true,
        }),
      });
      if (joinReq.ok) {
        const joinJson = await joinReq.json();
        // console.log('join json', joinJson);
      } else {
        const text = await joinReq.text();
        console.warn(
          'failed to join, status code: ' + joinReq.status + ': ' + text,
        );
        process.exit(1);
      }
    };

    if (room) {
      return await _joinAgent(agentSpecs[0], room);
    } else {
      console.log('no room name provided');
      process.exit(1);
    }
  } else {
    console.log('expected 1 agent argument');
    process.exit(1);
  }
};
const leave = async (args) => {
  const agentSpecs = await parseAgentSpecs([args._[0] ?? '']); // first arg is assumed to be a string
  const room = args._[1] ?? '';

  if (agentSpecs.length === 1) {
    if (room) {
      const _leaveAgent = async (agentSpec, room) => {
        const u = `${getAgentSpecHost(agentSpec)}/leave`;
        const leaveReq = await fetch(u, {
          method: 'POST',
          body: JSON.stringify({
            room,
          }),
        });
        const leaveJson = await leaveReq.json();
        // console.log('leave json', leaveJson);
      };

      return await _leaveAgent(agentSpecs[0], room);
    } else {
      console.log('no room name provided');
      process.exit(1);
    }
  } else {
    console.log('expected 1 agent argument');
    process.exit(1);
  }
};
const voice = async (args) => {
  const subcommand = args._[0] ?? '';
  const subcommandArgs = args._[1] ?? [];

  const jwt = await getLoginJwt();
  if (jwt !== null) {
    const userId = await getUserIdForJwt(jwt);

    const voicesEndpointApiUrl = `https://${aiProxyHost}/api/ai-voice/voices`;
    const addVoice = async (name, files, {
      jwt,
    }) => {
      const fd = new FormData();
      fd.append('name', name);
      for (const file of files) {
        fd.append('files', file, file.name);
      }

      const res = await fetch(`${voicesEndpointApiUrl}/add`, {
        method: 'POST',
        body: fd,
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (res.ok) {
        const j = await res.json();
        // console.log('got add response', j);
        return j;
      } else {
        const text = await res.text();
        throw new Error(`failed to get voice response: ${res.status}: ${text}`);
      }
    };
    const removeVoice = async (id, {
      jwt,
    }) => {
      const u = `${voicesEndpointApiUrl}/${id}`;
      const res = await fetch(u, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (res.ok) {
        const j = await res.json();
        // console.log('got remove response', j);
        return j;
      } else {
        if (res.status === 404) {
          console.log(`voice not found: ${id}`);
        } else {
          const text = await res.text();
          throw new Error(`failed to get voice response: ${u}: ${res.status}: ${text}`);
        }
      }
    };

    switch (subcommand) {
      case 'ls': {
        const supabase = makeSupabase(jwt);
        const result = await supabase.from('assets')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'voice');
        const { error, data } = result;
        if (!error) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.warn('error getting voices:', error);
          process.exit(1);
        }
        break;
      }
      case 'get': {
        const voiceName = subcommandArgs[0] ?? '';
        if (voiceName) {
          const supabase = makeSupabase(jwt);
          const result = await supabase.from('assets')
            .select('*')
            .eq('name', voiceName)
            .eq('user_id', userId)
            .eq('type', 'voice')
            .maybeSingle();
          const { error, data } = result;
          if (!error) {
            console.log(JSON.stringify(data, null, 2));
            if (data) {
              const { start_url } = data;
              const res = await fetch(start_url);
              if (res.ok) {
                const assetJson = await res.json();
                console.log(JSON.stringify(assetJson, null, 2));
              } else {
                console.warn('could not get voice json:', res.status);
              }
            }
          } else {
            console.warn('error getting voice:', error);
            process.exit(1);
          }
        } else {
          console.warn('invalid arguments');
          process.exit(1);
        }
        break;
      }
      case 'play': {
        const voiceName = subcommandArgs[0] ?? '';
        const text = subcommandArgs[1] ?? '';
        if (voiceName && text) {
          const supabase = makeSupabase(jwt);
          const result = await supabase.from('assets')
            .select('*')
            .eq('name', voiceName)
            .eq('user_id', userId)
            .eq('type', 'voice')
            .maybeSingle();
          const { error, data } = result;
          if (!error) {
            // console.log(JSON.stringify(data, null, 2));
            if (data) {
              const { start_url } = data;
              const res = await fetch(start_url);
              if (res.ok) {
                const voiceJson = await res.json();
                // console.log(JSON.stringify(voiceJson, null, 2));

                const { voiceEndpoint: voiceEndpointString } = voiceJson;
                const match = voiceEndpointString.match(/^([^:]+?):([^:]+?):([^:]+?)$/);
                if (match) {
                  const [_, model, voiceName, voiceId] = match;

                  // output stream
                  const outputStream = new SpeakerOutputStream();
                  const { sampleRate } = outputStream;

                  // voice stream
                  const voiceEndpoint = new AutoVoiceEndpoint({
                    model,
                    voiceId,
                  });
                  const voiceEndpointVoicer = new VoiceEndpointVoicer({
                    voiceEndpoint,
                    sampleRate,
                    jwt,
                  });
                  const voiceStream = voiceEndpointVoicer.getStream(text);
                  const { type } = voiceStream;

                  // decode stream
                  const decodeStream = new AudioDecodeStream({
                    type,
                    sampleRate,
                    format: 'i16',
                    codecs,
                  });

                  console.log('playing...')
                  voiceStream
                    .pipeThrough(decodeStream)
                    .pipeTo(outputStream)
                    .then(() => {
                      console.log('done');
                    });

                  await voiceStream.waitForLoad();
                } else {
                  console.warn('invalid voice endpoint:', voiceEndpointString);
                  process.exit(1);
                }
              } else {
                console.warn('could not get voice json:', res.status);
                process.exit(1);
              }
            } else {
              console.warn('no such voice: ' + voiceName);
              process.exit(1);
            }
          } else {
            console.warn('error getting voice:', error);
            process.exit(1);
          }
        } else {
          console.warn('invalid arguments');
          process.exit(1);
        }
        break;
      }
      case 'add': {
        const voiceName = subcommandArgs[0] ?? '';
        const voiceFilePaths = subcommandArgs.slice(1);
        if (voiceName && voiceFilePaths.length > 0) {
          const voiceFiles = await Promise.all(voiceFilePaths.map(async (p, i) => {
            const data = await fs.promises.readFile(p);
            const blob = new Blob([data], { type: 'audio/mp3' });
            blob.name = `${voiceName}-${i}-${path.basename(p)}`;
            return blob;
          }));

          const result = await addVoice(voiceName, voiceFiles, {
            jwt,
          });
          console.log('got result', result);
        } else {
          console.warn('invalid arguments');
          process.exit(1);
        }
        break;
      }
      case 'remove': {
        const id = subcommandArgs[0] ?? '';
        if (id) {
          await removeVoice(id, {
            jwt,
          });
        } else {
          console.warn('invalid arguments');
          process.exit(1);
        }
        break;
      }
      default: {
        console.warn(`unknown subcommand: ${subcommand}`);
        process.exit(1);
      }
    }
  }
};

const getTemplateNames = async () => await fs.promises.readdir(templatesDirectory);
const handleError = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.warn(err.stack);
    process.exit(1);
  }
};
const main = async () => {
  const vad = new StreamVAD();
  await vad.waitForLoad();

  let commandExecuted = false;
  program
    .name('usdk')
    .description('Upstreet Agents SDK')
    .exitOverride((err) => {
      if (!commandExecuted) {
        process.exit(0);
      }
    });

  program
  .version(packageJson.version);

  // misc
  program
    .command('version')
    .description('Print the version of the SDK')
    .action(async () => {
      await handleError(async () => {
        commandExecuted = true;
        console.log(pc.cyan(packageJson.version));
      });
    });
  /* program
    .command('-h')
    .description('Display help')
    .action(() => {
      program.help();
    }); */
  program
    .command('login')
    .description('Log in to the SDK')
    // .option(`-l, --local`, `Connect to localhost app server instead of hosted`)
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await login(args);
      });
    });
  // program
  //   .command('authorize')
  //   .description('Authorize an agent of the SDK')
  //   .argument(`[directory]`, `The directory to create the project in`)
  //   .action(async (directory = '',opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       const args = {
  //         _: [directory],
  //         ...opts,
  //       };
  //       await authorize(args);
  //     });
  //   });
  program
    .command('logout')
    .description('Log out of the SDK')
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await logout(args);
      });
    });

    // account
  program
  .command('status')
  .description('Print the current login status of the SDK')
  // .argument('<string>', 'string to split')
  .action(async (opts = {}) => {
    await handleError(async () => {
      commandExecuted = true;
      const args = {
        _: [],
        ...opts,
      };
      await status(args);
    });
  });
  /* program
    .command('wear')
    .description('Wear the character with the given guid')
    .argument('<guid>', 'The guid of the agent to wear')
    .action(async (guid = '', opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        let args;
        if (typeof guid === 'string') {
          args = {
            _: [guid],
            ...opts,
          };
        } else {
          opts = guid;
          guid = undefined;
          args = {
            _: [],
            ...opts,
          };
        }
        await wear(args);
      });
    });*/
  /* program
    .command('unwear')
    .description('Unwear the currently worn character')
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        // console.log('got args', JSON.stringify(args));
        // const args = {
        //   _: [guid],
        // };
        const args = {
          _: [],
          ...opts,
        };
        await unwear(args);
      });
    });*/

  // agents
  const templateNames = await getTemplateNames();

  // Generate the JSON string dynamically based on the examples in featureSpecs
  const featureExamples = featureSpecs.reduce((acc, feature) => {
    acc[feature.name] = feature.examples;
    return acc;
  }, {});
  const featureExamplesString = Object.entries(featureExamples)
    .map(([name, examples]) => {
      const exampleString = examples.map(example => JSON.stringify(example)).join(', ');
      return `"${name}", example using json ${exampleString}`;
    })
    .join('. ');

  program
    .command('create')
    .description('Create a new agent, from either a prompt or template')
    .argument(`[directory]`, `The directory to create the project in`)
    .option(`-p, --prompt <string>`, `Creation prompt`)
    .option(`-j, --json <string>`, `Agent JSON string to initialize with (e.g '{"name": "Ally", "description": "She is cool"}')`)
    .option(`-y, --yes`, `Non-interactive mode`)
    .option(`-f, --force`, `Overwrite existing files`)
    .option(`-F, --force-no-confirm`, `Overwrite existing files without confirming\nUseful for headless environments. ${pc.red('WARNING: Data loss can occur. Use at your own risk.')}`)
    .option(`-s, --source <string>`, `Main source file for the agent. ${pc.red('REQUIRED: Agent Json string must be provided using -j option')}`)
    .option(
      `-t, --template <string>`,
      `The template to use for the new project; one of: ${JSON.stringify(templateNames)} (default: ${JSON.stringify(templateNames[0])})`,
    )
    .option(
      `-feat, --features <feature...>`,
      `Provide either a feature name or a JSON string with feature details. Default values are used if specifications are not provided. Supported features: ${pc.green(featureExamplesString)}`
    )
    .action(async (directory = undefined, opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        let args;
        if (typeof directory === 'string') {
          args = {
            _: [directory],
            ...opts,
          };
        } else {
          args = {
            _: [],
            ...opts,
          };
        }

        // if features flag used, check if the feature is a valid JSON string, if so parse accordingly, else use default values
        if (opts.features) {
          let features = {};
          for (const featuresString of opts.features) {
            const parsedJson = jsonParse(featuresString);
            if (parsedJson !== undefined) {
              features = {
                ...features,
                ...parsedJson,
              };
            } else {
              features[featuresString] = featureExamples[featuresString][0];
            }
          }
          args.features = features;
        }
        
        await create(args);
      });
    });
  program
    .command('pull')
    .description('Download source of deployed agent')
    .argument('<guid>', 'Guid of the agent')
    .argument(`[directory]`, `The directory to create the project in`)
    .option(`-f, --force`, `Overwrite existing files`)
    .option(`-F, --force-no-confirm`, `Overwrite existing files without confirming\nUseful for headless environments. ${pc.red('WARNING: Data loss can occur. Use at your own risk.')}`)
    .action(async (guid = undefined, directory = undefined, opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        let args;
        if (typeof directory === 'string') {
          args = {
            _: [guid, directory],
            ...opts,
          };
        } else {
          args = {
            _: [guid],
            ...opts,
          };
        }
        await pull(args);
      });
    });
  /* const devSubcommands = [
    'chat',
    // 'simulate',
    // 'listen',
    // 'ls',
    // 'fund',
    // 'deposit',
  ]; */
  /* program
    .command('dev')
    .description(
      'Start a dev server for the agent in the current directory, and optionally run a subcommand',
    )
    .argument(`[guids...]`, `Guids of the agents to connect to`)
    .option(`-g, --debug`, `Enable debug logging`)
    .action(async (guids = [], opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [guids],
          ...opts,
        };
        await dev(args);
      });
    }); */
  program
    .command('chat')
    .description(`Chat with agents in a multiplayer room`)
    .argument(`[guids...]`, `Guids of the agents to join the room`)
    .option(`-b, --browser`, `Open the chat room in a browser window`)
    .option(`-r, --room <room>`, `The room name to join`)
    // .option(
    //   `-d, --dev`,
    //   `Chat with a local development agent`,
    // )
    .option(`-g, --debug`, `Enable debug logging`)
    .action(async (guids = [], opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        let args;
        args = {
          _: [guids],
          ...opts,
        };
        await chat(args);
      });
    });
    
  // program
  //   .command('search')
  //   .description(
  //     'Find an agent to do something',
  //   )
  //   .argument(
  //     `[query]`,
  //     `Prompt to search for`,
  //   )
  //   // .option(`-g, --debug`, `Enable debug logging`)
  //   .action(async (prompt = '', opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       let args;
  //       args = {
  //         _: [prompt],
  //         ...opts,
  //       };
  //       await search(args);
  //     });
  //   });
  // program
  //   .command('test')
  //   .description('Run agent tests')
  //   .argument(`[directories...]`, `Directories containing the agent projects to test`)
  //   .option('-a, --all', 'Run all tests')
  //   .option('-g, --debug', 'Enable debug logging')
  //   .action(async (directories = [], opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       const args = {
  //         _: [directories],
  //         ...opts,
  //       };
  //       await test(args);
  //     });
  //   });
  // program
  //   .command('capture')
  //   .description('Test display functionality; with no arguments, list available devices')
  //   .option('-m, --microphone [id]', 'Enable microphone')
  //   .option('-c, --camera [id]', 'Enable camera')
  //   .option('-s, --screen [id]', 'Enable screen capture')
  //   .option('-w, --width <width>', 'Render width')
  //   .option('-h, --height <height>', 'Render height')
  //   .option('-r, --rows <rows>', 'Render rows')
  //   .option('-l, --cols <cols>', 'Render cols')
  //   .option('-x, --execute', 'Execute inference')
  //   .option('-q, --query <string>', 'Inference query for video')
  //   .action(async (opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       const args = {
  //         _: [],
  //         ...opts,
  //       };
  //       await capture(args);
  //     });
  //   });
  program
    .command('deploy')
    .description('Deploy an agent to the network')
    .argument(`[guids...]`, `Guids of the agents to deploy`)
    // .argument(
    //   `[type]`,
    //   `Type of deployment to perform, one of ${JSON.stringify([deploymentTypes])}`,
    // )
    .action(async (agentRefs, opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;

        let args;
        args = {
          _: [agentRefs],
          ...opts,
        };

        await deploy(args);
      });
    });
  // const networkOptions = ['baseSepolia', 'opMainnet'];
  /* program
    .command('ls')
    .description('List the currently deployed agents')
    .option(
      `-n, --network <networkId>`,
      `The blockchain network to use for querying agent wallets; one of ${JSON.stringify(networkOptions)}`,
    )
    .option(
      `-l, --local`,
      `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
    )
    .option(
      `-d, --dev`,
      `List local development agents instead of account agents (requires running cli dev server)`,
    )
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await ls(args);
      });
    });*/
  program
    .command('rm')
    .description('Remove a deployed agent from the network')
    .argument(`[guids...]`, `Guids of the agents to delete`)
    .action(async (guids = '', opts) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [guids],
          ...opts,
        };
        await rm(args);
      });
    });
  // program
  //   .command('join')
  //   .description(`Make an agent join a multiplayer room`)
  //   .argument(`<guid>`, `Guid of the agent`)
  //   .argument(`<room>`, `Name of the room to join`)
  //   .option(
  //     `-l, --local`,
  //     `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
  //   )
  //   .action(async (opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       const args = {
  //         _: [],
  //         ...opts,
  //       };
  //       await rm(args);
  //     });
  //   });
  // program
  //   .command('leave')
  //   .description(`Make an agent leave a multiplayer room`)
  //   .argument(`<guid>`, `Guid of the agent`)
  //   .option(
  //     `-l, --local`,
  //     `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
  //   )
  //   .action(async (opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       const args = {
  //         _: [],
  //         ...opts,
  //       };
  //       await leave(args);
  //     });
  //   });
  /* program
    .command('enable')
    .description(`Enable an agent for autonomous operation`)
    .argument(`<guid>`, `Guid of the agent`)
    .option(
      `-l, --local`,
      `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
    )
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        }
        await enable(args);
      });
    });
  program
    .command('disable')
    .description(`Disable an agent for autonomous operation`)
    .argument(`<guid>`, `Guid of the agent`)
    .option(
      `-l, --local`,
      `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
    )
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await disable(args);
      });
    }); */
    const voiceSubCommands = [
      {
        name: 'ls',
        description: 'Lists all available voices for the current user.',
        usage: 'usdk voice ls'
      },
      {
        name: 'get',
        description: 'Retrieves details about a specific voice.',
        usage: 'usdk voice get <voice_name>'
      },
      {
        name: 'play',
        description: 'Plays the given text using the specified voice.',
        usage: 'usdk voice play <voice_name> <text>'
      },
      {
        name: 'add',
        description: 'Adds new audio files to create or update a voice.',
        usage: 'usdk voice add <voice_name> <file1.mp3> [file2.mp3] ...'
      },
      {
        name: 'remove',
        description: 'Removes a voice from the user\'s account.',
        usage: 'usdk voice remove <voice_id>'
      }
    ];

  // program
  //   .command('voice')
  //   .description(
  //     'Manage agent voices',
  //   )
  //   .argument(
  //     `[subcommand]`,
  //     `What voice action to perform; one of [${voiceSubCommands.map(cmd => cmd.name).join(', ')}]`,
  //   )
  //   .argument(
  //     `[args...]`,
  //     `Arguments to pass to the subcommand`,
  //   )
  //   .action(async (subcommand = '', args = [], opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       args = {
  //         _: [subcommand, args],
  //         ...opts,
  //       };
  //       await voice(args);
  //     });
  //   })
  //   .addHelpText('after', `\nSubcommands:\n${voiceSubCommands.map(cmd => `  ${cmd.name}\t${cmd.description}\n\t\t${cmd.usage}`).join('\n')}`);

    
  // program
  //   .command('connect')
  //   .description(`Connect to a multiplayer room`)
  //   .argument(`<room>`, `Name of the room to join`)
  //   .option(
  //     `-l, --local`,
  //     `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
  //   )
  //   .option(
  //     `-d, --dev`,
  //     `Use the local development guid instead of your account guid`,
  //   )
  //   .option(`-g, --debug`, `Enable debug logging`)
  //   .action(async (room = '', opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       let args;
  //       if (typeof room === 'string') {
  //         args = {
  //           _: [room],
  //           ...opts,
  //         };
  //         await connect(args);
  //       } else {
  //         console.warn(`invalid arguments: ${room}`);
  //       }
  //     });
  //   });

  /* program
    .command('simulate')
    .description('Simulate an interaction between agents')
    .argument(`[guids...]`, `The guids of the agents to simulate`)
    .option(`-r, --room`, `The room name to join`)
    // .option(
    //   `-d, --dev`,
    //   `Chat with a local development agent`,
    // )
    .option(`-g, --debug`, `Enable debug logging`)
    .action(async (guids = [], opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        if (guids.every((guid) => typeof guid === 'string')) {
          let args;
          args = {
            _: guids,
            ...opts,
          };
          await simulate(args);
        } else {
          console.warn(`invalid arguments: ${guids}`);
          process.exit(1);
        }
      });
    }); */
  // program
  //   .command('logs')
  //   .description(`Stream an agent's logs`)
  //   .argument(`[guids...]`, `The guids of the agents to listen to`)
  //   // .option(
  //   //   `-d, --dev`,
  //   //   `Chat with a local development agent`,
  //   // )
  //   .action(async (guids = [], opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       let args;
  //       args = {
  //         _: [guids],
  //         ...opts,
  //       };
  //       await logs(args);
  //     });
  //   });
  // program
  //   .command('listen')
  //   .description(`Stream an agent's action events`)
  //   .argument(`[guids...]`, `The guids of the agents to listen to`)
  //   // .option(
  //   //   `-d, --dev`,
  //   //   `Chat with a local development agent`,
  //   // )
  //   .action(async (guids = [], opts = {}) => {
  //     await handleError(async () => {
  //       commandExecuted = true;
  //       let args;
  //       args = {
  //         _: guids,
  //         ...opts,
  //       };
  //       await listen(args);
  //     });
  //   });

  // wallet
  /* program
    .command('fund')
    .description('Fund an agent on the network')
    .argument(`<guid>`, `Guid of the agent to deposit to`)
    .argument(`<amount>`, `Amount of funds to deposit`)
    .option(
      `-l, --local`,
      `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
    )
    .option(
      `-d, --dev`,
      `Use the local development guid instead of your account guid`,
    )
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await fund(args);
      });
    });*/
  /*program
    .command('deposit')
    .description('Deposit funds to an agent on the network')
    .argument(`<guid>`, `Guid of the agent to deposit to`)
    .argument(`<amount>`, `Amount of funds to deposit`)
    .option(
      `-l, --local`,
      `Connect to localhost servers for development instead of remote (requires running local agent backend)`,
    )
    .option(
      `-d, --dev`,
      `Use the local development guid instead of your account guid`,
    )
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await deposit(args);
      });
    });*/
  /*program
    .command('withdraw')
    .description('Withdraw funds from an agent on the network')
    .argument(`<guid>`, `Guid of the agent to withdraw from`)
    .argument(`<amount>`, `Amount of funds to withdraw`)
    .argument(`<destination>`, `Destination address to withdraw to`)
    .option(
      `-n, --network <networkId>`,
      `The blockchain network to use for querying agent wallets; one of ${JSON.stringify(networkOptions)}`,
    )
    .action(async (opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [],
          ...opts,
        };
        await withdraw(args);
      });
    });*/
  await program.parseAsync();
};

// main module
const isMainModule = process.argv[1].endsWith('/usdk') || import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  // handle uncaught exceptions
  const handleGlobalError = (err, err2) => {
    console.log('cli uncaught exception', err, err2);
    process.exit(1);
  };
  process.on('uncaughtException', handleGlobalError);
  process.on('unhandledRejection', handleGlobalError);

  // run main
  (async () => {
    try {
      await main();
    } catch (err) {
      console.warn(err.stack);
    }
  })();
}