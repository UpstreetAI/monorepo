import path from 'path';
import fs from 'fs';
import https from 'https';
import stream from 'stream';
import repl from 'repl';

import { program } from 'commander';
import WebSocket from 'ws';
import EventSource from 'eventsource';
import toml from '@iarna/toml';
import open from 'open';
import pc from 'picocolors';
import Jimp from 'jimp';
import dedent from 'dedent';
import { mkdirp } from 'mkdirp';

import prettyBytes from 'pretty-bytes';
import Table from 'cli-table3';
import * as ethers from 'ethers';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

import { isGuid } from './packages/upstreet-agent/packages/react-agents/util/guid-util.mjs';
import { QueueManager } from './packages/upstreet-agent/packages/queue-manager/queue-manager.mjs';
// import { lembed } from './packages/upstreet-agent/packages/react-agents/util/embedding.mjs';
import { makeId } from './packages/upstreet-agent/packages/react-agents/util/util.mjs';
import { packZip, extractZip } from './lib/zip-util.mjs';
import {
  getAgentPublicUrl,
  getCloudAgentHost,
} from './packages/upstreet-agent/packages/react-agents/agent-defaults.mjs';
import {
  localPort,
  callbackPort,
} from './util/ports.mjs';
import {
  devServerPort,
} from './packages/upstreet-agent/packages/react-agents-local/util/ports.mjs';
import {
  getLocalAgentHost,
} from './packages/upstreet-agent/packages/react-agents-local/util/hosts.mjs';
import {
  makeAnonymousClient,
  getUserForJwt,
} from './packages/upstreet-agent/packages/react-agents/util/supabase-client.mjs';
import { cwd } from './util/directory-utils.mjs';
import packageJson from './package.json' with { type: 'json' };

import {
  providers,
  getWalletFromMnemonic,
  getConnectedWalletsFromMnemonic,
} from './packages/upstreet-agent/packages/react-agents/util/ethereum-utils.mjs';
import { ReactAgentsLocalRuntime } from './packages/upstreet-agent/packages/react-agents-local/local-runtime.mjs';
import {
  deployEndpointUrl,
  chatEndpointUrl,
  workersHost,
  aiProxyHost,
  usdkDiscordUrl,
} from './packages/upstreet-agent/packages/react-agents/util/endpoints.mjs';

import { AutoVoiceEndpoint, VoiceEndpointVoicer } from './packages/upstreet-agent/packages/react-agents/lib/voice-output/voice-endpoint-voicer.mjs';
import { webbrowserActionsToText } from './packages/upstreet-agent/packages/react-agents/util/browser-action-utils.mjs';

import Worker from 'web-worker';
globalThis.Worker = Worker;

import {
  InputDevices,
} from './packages/upstreet-agent/packages/react-agents/devices/input-devices.mjs';
import {
  AudioInput,
} from './packages/upstreet-agent/packages/react-agents/devices/audio-input.mjs';
import {
  TranscribedVoiceInput,
} from './packages/upstreet-agent/packages/react-agents/devices/audio-transcriber.mjs';
import {
  ImageRenderer,
  TerminalVideoRenderer,
} from './packages/upstreet-agent/packages/react-agents/devices/video-input.mjs';
import {
  describe,
} from './packages/upstreet-agent/packages/react-agents/util/vision.mjs';
import { getLoginJwt } from './util/login-util.mjs';
import {
  loginLocation,
} from './lib/locations.mjs';
import {
  login,
  logout,
  status,
  create,
  edit,
} from './lib/commands.mjs';
import {
  env,
} from './lib/env.mjs';
import {
  consoleImageWidth,
} from './packages/upstreet-agent/packages/react-agents/constants.mjs';
import { ReactAgentsClient, ReactAgentsMultiplayerConnection } from './packages/upstreet-agent/packages/react-agents-client/react-agents-client.mjs';
import { timeAgo } from './packages/upstreet-agent/packages/react-agents/util/time-ago.mjs';
import { cleanDir } from './lib/directory-util.mjs';
import { featureSpecs } from './packages/upstreet-agent/packages/react-agents/util/agent-features.mjs';
import { AudioDecodeStream } from './packages/upstreet-agent/packages/codecs/audio-decode.mjs';
import { WebPEncoder } from './packages/upstreet-agent/packages/codecs/webp-codec.mjs';
import * as codecs from './packages/upstreet-agent/packages/codecs/ws-codec-runtime-fs.mjs';
import { npmInstall } from './lib/npm-util.mjs';
import { runJest } from './lib/jest-util.mjs';
import { logUpstreetBanner } from './util/logger/log-utils.mjs';
import { makeCorsHeaders, getServerOpts } from './util/server-utils.mjs';

globalThis.WebSocket = WebSocket; // polyfill for multiplayer library

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

const getAgentSpecHost = (agentSpec) => !!agentSpec.directory ? getLocalAgentHost(agentSpec.portIndex) : getCloudAgentHost(agentSpec.guid);

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

//

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
const getUserProfile = async () => {
  let user = null;

  // try getting the user asset from the login
  const jwt = await getLoginJwt();
  if (jwt !== null) {
    // const supabase = makeSupabase(jwt);
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
};
// XXX break this out into react-agents-local
const startMultiplayerRepl = ({
  profile,
  realms,
  typingMap,
  speakerMap,
}) => {
  const getPrompt = () => {
    const name = profile.name;

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
    const localSpeaking = speakerMap.getLocal() > 0;
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
    updatePrompt();
    renderPrompt();
  });
  speakerMap.addEventListener('localspeakingchange', (e) => {
    updatePrompt();
    renderPrompt();
  });

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
        
        const sampleRate = AudioInput.defaultSampleRate;
        microphoneInput = inputDevices.getAudioInput(device.id, {
          sampleRate,
        });

        const onplayingchange = e => {
          const { playing } = e.data;
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
        audioStream.type = 'audio/pcm-f32-48000';
        audioStream.disposition = 'text';

        (async () => {
          console.log('start streaming audio');
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

        const cameraStream = new ReadableStream({
          start(controller) {
            cameraInput.on('image', (data) => {
              controller.enqueue(data);
            });
            cameraInput.on('close', (e) => {
              controller.close();
            });
          },
        });
        cameraStream.id = crypto.randomUUID();
        cameraStream.type = 'image/webp';
        cameraStream.disposition = 'text';

        (async () => {
          console.log('start streaming video');
          const {
            waitForFinish,
          } = realms.addVideoSource(cameraStream);
          await waitForFinish();
          realms.removeVideoSource(cameraStream);
        })();
        renderPrompt();
      } else {
        cameraInput.close();
        cameraInput = null;
        console.log('* cam disabled *');
        renderPrompt();
      }
    });
  };

  let screenInput = null;
  const screenQueueManager = new QueueManager();
  const toggleScreen = async () => {
    await screenQueueManager.waitForTurn(async () => {
      if (!screenInput) {
        const inputDevices = new InputDevices();
        const devices = await inputDevices.listDevices();
        const screenDevice = inputDevices.getDefaultScreenDevice(devices.video);

        screenInput = inputDevices.getVideoInput(screenDevice.id, {
          // width,
          // height,
          fps: 5,
        });

        const videoRenderer = new TerminalVideoRenderer({
          width: 80,
          // height: rows,
          footerHeight: 5,
        });
        screenInput.on('frame', (imageData) => {
          videoRenderer.setImageData(imageData);
          videoRenderer.render();
          renderPrompt();
        });
        console.log('* screen capture enabled *');

        const screenStream = new ReadableStream({
          start(controller) {
            screenInput.on('image', (data) => {
              controller.enqueue(data);
            });
            screenInput.on('close', (e) => {
              controller.close();
            });
          },
        });
        screenStream.id = crypto.randomUUID();
        screenStream.type = 'image/webp';
        screenStream.disposition = 'text';

        (async () => {
          console.log('start streaming video');
          const {
            waitForFinish,
          } = realms.addVideoSource(screenStream);
          await waitForFinish();
          realms.removeVideoSource(screenStream);
        })();
        renderPrompt();
      } else {
        screenInput.close();
        screenInput = null;
        console.log('* screen capture disabled *');
        renderPrompt();
      }
    });
  };

  const sendChatMessage = async (text) => {
    const userId = profile.id;
    const name = profile.name;
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

  const replServer = repl.start({
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
              case 'screen': {
                toggleScreen();
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

  replServer.on('exit', (e) => {
    process.exit(0);
  });

  return replServer;
};
const connectBrowser = ({
  room,
}) => {
  open(`${chatEndpointUrl}/rooms/${room}`)
    .catch( console.error );
};
const connectRepl = async ({
  room,
  debug,
}) => {
  let profile = await getUserProfile();
  profile = {
    ...profile,
    capabilities: [
      'human',
    ],
  };
  if (!profile) {
    throw new Error('could not get user profile');
  }

  let replServer = null;

  // set up the chat
  const multiplayerConnection = new ReactAgentsMultiplayerConnection({
    room,
    profile,
  });
  const localLogLevel = debug ? ReactAgentsMultiplayerConnection.logLevels.debug : ReactAgentsMultiplayerConnection.logLevels.info;
  const renderPrompt = () => {
    replServer && replServer.displayPrompt(true);
  };
  const mpLog = (...args) => {
    process.stdout.write(eraseLine);
    console.log(...args);
    renderPrompt();
  };
  multiplayerConnection.addEventListener('log', (e) => {
    const { args, logLevel } = e.data;
    if (localLogLevel >= logLevel) {
      mpLog(...args);
    }
  });
  multiplayerConnection.addEventListener('chat', (e) => {
    const { message } = e.data;
    const { userId: messageUserId, name, method, args } = message;
    // console.log('got message', message);
    const attachments = (message.attachments ?? []).filter(a => !!a.url);

    switch (method) {
      case 'say': {
        const { text } = args;
        if (messageUserId !== profile.id) {
          let s = `${name}: ${text}`;
          if (attachments.length > 0) {
            s += '\n[Attachments:';
            for (const attachment of attachments) {
              const { type, url } = attachment;
              s += `\n  [${type}]: ${url}`;
            }
            s += '\n]';
          }
          mpLog(s);

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
          const { text } = args;
          mpLog(text);
        }
        break;
      }
      case 'typing': {
        const { typing } = args;
        typingMap.set(messageUserId, { userId: messageUserId, name, typing });
        break;
      }
      case 'mediaPerception': {
        mpLog(`[${name} checked an attachment`);
        break;
      }
      case 'addMemory': {
        mpLog(`[${name} will remember that]`);
        break;
      }
      case 'queryMemories': {
        mpLog(`[${name} is trying to remember]`);
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
          mpLog(`[${webbrowserAction.toText(o)}]`);
        }
        // mpLog(`[${name} checked an attachment`);
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
        mpLog(`[${name} requests ${price}${subscriptionText} for ${type} ${props.name}${props.description ? `: ${props.description}` : ''}]`);
        // const { amount, currency, url, productName, productDescription, productQuantity } = args;
        // mpLog(`[${name} requests ${amount / 100} ${currency} for ${productQuantity} x ${productName}]: ${url}`);
        break;
      }
      case 'nudge':
      case 'join':
      case 'leave': {
        // nothing
        break;
      }
      default: {
        mpLog(`${name}: ${JSON.stringify(message)}`);
        break;
      }
    }
  });
  await multiplayerConnection.waitForConnect();
  const { realms, typingMap, playersMap, speakerMap } = multiplayerConnection;
  const agentJsons = Array.from(playersMap.getMap().values()).map(
    (player) => player.playerSpec,
  );
  mpLog(dedent`\
    ${profile ? `You are ${JSON.stringify(profile.name)} [${profile.id}]), chatting in ${room}.` : ''}
    In the room (${room}):
    ${agentJsons.length > 0 ?
      agentJsons
        .map((agent) => {
          return `* ${agent.name} [${agent.id}] ${agent.id === profile.id ? '(you)' : ''}`;
        })
        .join('\n')
      :
        `* no one else is here`
    }
    http://local.upstreet.ai:${devServerPort}
  `);

  replServer = startMultiplayerRepl({
    profile,
    realms,
    typingMap,
    speakerMap,
  });

  const _trackAudio = () => {
    const audioStreams = new Map();
    const audioQueueManger = new QueueManager();
    const virtualPlayers = realms.getVirtualPlayers();
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
          await audioQueueManger.waitForTurn(async ({
            signal,
          }) => {
            signal.addEventListener('abort', (e) => {
              decodeStream.abort(e.reason);
              outputStream.abort(e.reason);
            });

            try {
              speakerMap.addRemote(playerId);
              await decodeStream.readable.pipeTo(outputStream);
            } finally {
              speakerMap.removeRemote(playerId);
            }
          });
        })().catch((e) => {
          console.error('error in audio pipeline', e);
        });

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
  // dynamic import audio output module
  const audioOutput = await (async () => {
    try {
      return await import('./packages/upstreet-agent/packages/react-agents/devices/audio-output.mjs');
    } catch (err) {
      console.warn(pc.yellow(`\
⚠️  Could not run the speaker module. You may not be able to hear your Agent.
To solve this, you may need to install optional dependencies. https://docs.upstreet.ai/errors#could-not-run-the-speaker-module
For further assistance, please contact support or ask for help in our Discord community: ${usdkDiscordUrl}
        `));
      return null;
    }
  })();
  const SpeakerOutputStream = audioOutput?.SpeakerOutputStream;
  if (SpeakerOutputStream) {
    _trackAudio();
  }
};
const connect = async (args) => {
  const room = args._[0] ?? '';
  const mode = args.mode ?? 'repl';
  const debug = !!args.debug;

  if (room) {
    switch (mode) {
      case 'browser': {
        connectBrowser({
          room,
        });
        break;
      }
      case 'repl': {
        connectRepl({
          room,
          debug,
        });
        break;
      }
      default: {
        throw new Error(`unknown mode: ${mode}`);
      }
    }
  } else {
    console.log('no room name provided');
    process.exit(1);
  }
};
const getGuidFromPath = async (p) => {
  const makeEnoent = () => new Error('not an agent directory: ' + p);

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
        portIndex: 0,
      },
    ];
  } else {
    // treat each agent ref as a guid or directory
    const agentSpecsPromises = agentRefSpecs.map(async (agentRefSpec, index) => {
      if (isGuid(agentRefSpec)) {
        // if it's a cloud agent
        return {
          ref: agentRefSpec,
          guid: agentRefSpec,
          directory: null,
          portIndex: index,
        };
      } else {
        // if it's a directory agent
        const directory = agentRefSpec;
        const guid = await getGuidFromPath(directory);
        return {
          ref: directory,
          guid,
          directory,
          portIndex: index,
        };
      }
    });
    return await Promise.all(agentSpecsPromises);
  }
};
const chat = async (args) => {
  // console.log('got chat args', args);
  const agentSpecs = await parseAgentSpecs(args._[0]);
  const room = args.room ?? makeRoomName();
  const debug = !!args.debug;

  const jwt = await getLoginJwt();
  if (jwt !== null) {
    // start dev servers for the agents
    
    const startPromises = agentSpecs.map(async (agentSpec) => {
      if (agentSpec.directory) {
        const runtime = new ReactAgentsLocalRuntime(agentSpec);
        await runtime.start({
          debug,
        });
      }
    });
    await Promise.all(startPromises);

    // wait for agents to join the multiplayer room
    const agentRefs = agentSpecs.map((agentSpec) => agentSpec.ref);
    await join({
      _: [agentRefs, room],
    });

    // connect to the chat
    await connect({
      _: [room],
      mode: args.browser ? 'browser' : 'repl',
      debug: args.debug,
    });
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};
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
const makeRoomName = () => `room:` + makeId(8);
/* const search = async (args) => {
  const prompt = args._[0] ?? '';

  const jwt = await getLoginJwt();
  const userId = jwt && (await getUserIdForJwt(jwt));
  if (userId) {
    if (prompt) {
      const supabase = makeAnonymousClient(env);
      const embedding = await lembed(prompt, {
        jwt,
      });
      // call the supabase function:
      // function match_assets(
      //   embedding vector(3072),
      //   match_threshold float,
      //   match_count int
      // )
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
}; */
const test = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
  if (!agentSpecs.every((agentSpec) => !!agentSpec.directory)) {
    throw new Error('all agent specs must have directories');
  }

  const debug = !!args.debug;

  const jwt = await getLoginJwt();
  if (jwt !== null) {
    const room = makeRoomName();

    for (const agentSpec of agentSpecs) {
      const runtime = new ReactAgentsLocalRuntime(agentSpec);
      await runtime.start({
        debug,
      });

      // join
      await join({
        _: [[agentSpec.ref], room],
      });

      // run the tests
      await runJest(agentSpec.directory);

      runtime.terminate();
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
          codecs,
          jwt,
        });
        transcribedVoiceInput.addEventListener('speechstart', e => {
          console.log('capturing...');
        });
        transcribedVoiceInput.addEventListener('speechstop', e => {
          console.log('captured');
        });
        transcribedVoiceInput.addEventListener('speechcancel', e => {
          console.log('cancelled');
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

      console.log(pc.italic('Deploying agent...'));

      const uint8Array = await packZip(directory, {
        exclude: [
          /[\/\\]node_modules[\/\\]/, // linux and windows
        ],
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
  const agentSpecs = await parseAgentSpecs(args._[0]);
  const room = args._[1] ?? makeRoomName();

  try {
    const joinPromises = agentSpecs.map(async (agentSpec) => {
      const u = `${getAgentSpecHost(agentSpec)}`;
      const agentClient = new ReactAgentsClient(u);
      await agentClient.join(room, {
        only: true,
      });
    });
    await Promise.all(joinPromises);
  } catch (err) {
    console.warn('join error', err);
    process.exit(1);
  }
};
const leave = async (args) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
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

// const getTemplateNames = async () => await fs.promises.readdir(templatesDirectory);
const handleError = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.warn(err.stack);
    process.exit(1);
  }
};
export const main = async () => {
  let commandExecuted = false;
  program
    .name('usdk')
    .description('Upstreet Agents SDK')
    .exitOverride((err) => {
      if (!commandExecuted) {
        process.exit(0);
      }
    });

  program.version(packageJson.version);

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
        const loginJson = await login(args);
        await mkdirp(path.dirname(loginLocation));
        await fs.promises.writeFile(loginLocation, JSON.stringify(loginJson));
      });
    });
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
  // const templateNames = await getTemplateNames();

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
  const parseFeatures = (featuresSpec) => {
    let features = {};
    for (const featuresString of featuresSpec) {
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
    return features;
  };

  program
    .command('create')
    .description('Create a new agent, from either a prompt or template')
    .argument(`[directory]`, `Directory to create the project in`)
    .option(`-p, --prompt <string>`, `Creation prompt`)
    .option(`-j, --json <string>`, `Agent JSON string to initialize with (e.g '{"name": "Ally", "description": "She is cool"}')`)
    .option(`-y, --yes`, `Non-interactive mode`)
    .option(`-f, --force`, `Overwrite existing files`)
    .option(`-n, --no-install`, `Do not install dependencies`)
    .option(`-F, --force-no-confirm`, `Overwrite existing files without confirming\nUseful for headless environments. ${pc.red('WARNING: Data loss can occur. Use at your own risk.')}`)
    .option(`-s, --source <string>`, `Main source file for the agent. ${pc.red('REQUIRED: Agent Json string must be provided using -j option')}`)
    .option(
      `-feat, --feature <feature...>`,
      `Provide either a feature name or a JSON string with feature details. Default values are used if specifications are not provided. Supported features: ${pc.green(featureExamplesString)}`
    )
    .action(async (directory = undefined, opts = {}) => {
      logUpstreetBanner();
      console.log(`

Welcome to USDK's Agent Creation process.

${pc.cyan(`v${packageJson.version}`)}

To exit, press CTRL+C (CMD+C on macOS).

For more information, head over to https://docs.upstreet.ai/create-an-agent#step-2-complete-the-agent-interview

`);
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
        if (opts.feature) {
          args.feature = parseFeatures(opts.feature);
        }

        const jwt = await getLoginJwt();

        await create(args, {
          jwt,
        });
      });
    });
  program
    .command('edit')
    .description('Edit an existing agent')
    .argument(`[directory]`, `Directory containing the agent to edit`)
    .option(`-p, --prompt <string>`, `Edit prompt`)
    .option(
      `-af, --add-feature <feature...>`,
      `Add a feature`,
    )
    .option(
      `-rf, --remove-feature <feature...>`,
      `Remove a feature`,
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

        if (opts.addFeature) {
          args.addFeature = parseFeatures(opts.addFeature);
        }

        const jwt = await getLoginJwt();

        await edit(args, {
          jwt,
        });
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
  program
    .command('chat')
    // .alias('c')
    .description(`Chat with agents in a multiplayer room`)
    .argument(`[guids...]`, `Guids of the agents to join the room`)
    .option(`-b, --browser`, `Open the chat room in a browser window`)
    .option(`-r, --room <room>`, `The room name to join`)
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
  program
    .command('test')
    .description('Run agent tests')
    .argument(`[directories...]`, `Directories containing the agent projects to test`)
    .option('-g, --debug', 'Enable debug logging')
    .action(async (directories = [], opts = {}) => {
      await handleError(async () => {
        commandExecuted = true;
        const args = {
          _: [directories],
          ...opts,
        };
        await test(args);
      });
    });
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
  //       await join(args);
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