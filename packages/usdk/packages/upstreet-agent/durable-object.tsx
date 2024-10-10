import { headers } from 'react-agents/constants.mjs';
import { makeAnonymousClient } from 'react-agents/util/supabase-client.mjs';
import { AgentRenderer } from 'react-agents/classes/agent-renderer.tsx';
import { ChatsSpecification } from 'react-agents/classes/chats-specification.ts';
import { pingRate } from 'react-agents/classes/ping-manager.ts';
import { serverHandler } from 'react-agents/routes/server.ts';
import { multiplayerEndpointUrl } from 'react-agents/util/endpoints.mjs';

import agentTsxUserRender from '../../agent.tsx'; // note: this will be overwritten by the build process
import type { ActiveAgentObject } from 'react-agents/types';

import { StreamVAD } from 'react-agents/lib/vad/packages/web/src/real-time-vad.ts';

Error.stackTraceLimit = 300;

//

/*
import { AudioInput } from 'react-agents/devices/audio-input.mjs';
import {
  OpusAudioEncoder,
  OpusAudioDecoder,
  Mp3AudioEncoder,
  Mp3AudioDecoder,
} from './packages/react-agents/lib/multiplayer/public/audio/ws-codec-local.mjs';
const makeFakeData = () => {
  const numSamples = 128 * 1024;
  // const numSamples = 1024;
  const fakeData = new Float32Array(numSamples);
  const freq = 440;
  for (let i = 0; i < numSamples; i++) {
    const t = i / AudioInput.defaultSampleRate;
    fakeData[i] = Math.sin(2 * Math.PI * freq * t);
  }
  return fakeData;
};
const _testCodecs = async () => {
  try {
    const fakeData = makeFakeData();
    console.log('got fake data', fakeData);

    const _testOpus = async () => {
      // encode 
      console.log('test 1');
      const sampleRate = AudioInput.defaultSampleRate;
      const { resolve: resolveEncode, promise: encodedPromise } = Promise.withResolvers<any[]>();
      const bs = [];
      const opusEncoder = new OpusAudioEncoder({
        sampleRate,
        output: (d: any) => {
          // console.log('output', d.data);
          if (d.data !== null) {
            // console.log('case 1');
            bs.push(d.data);
          } else {
            // console.log('case 2');
            // console.log('output done 1', bs);
            // const b = Buffer.concat(bs.map(u => Buffer.from(u)));
            // const uint8Array = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
            // console.log('output done 2', uint8Array);
            resolveEncode(bs);
            // console.log('output done 3');
          }
        },
        error: (err: any) => {
          console.log('error', err);
        },
      });
      console.log('test 2', opusEncoder);
      opusEncoder.encode({
        data: fakeData.slice(),
      });
      opusEncoder.encode({
        data: null,
      });
      console.log('test 3', opusEncoder);
      const packets = await encodedPromise;
      console.log('test 4', packets);

      // decode
      console.log('test 5');
      const opusDecoder = new OpusAudioDecoder({
        sampleRate,
        output: (d: any) => {
          console.log('output', d.data);
        },
        error: (err: any) => {
          console.log('error', err);
        },
      });
      console.log('test 6', packets);
      for (const packet of packets) {
        opusDecoder.decode(packet);
      }
      opusDecoder.decode(null);
      console.log('test 7');
    };
    await _testOpus();

    const _testMp3 = async () => { 
      console.log('test 1');
      const sampleRate = AudioInput.defaultSampleRate;
      const { resolve: resolveEncode, promise: encodedPromise } = Promise.withResolvers();
      const bs = [];
      const mp3Encoder = new Mp3AudioEncoder({
        sampleRate,
        output: (d: any) => {
          // console.log('output', d.data);
          if (d.data !== null) {
            // console.log('case 1');
            bs.push(d.data);
          } else {
            // console.log('case 2');
            // console.log('output done 1', bs);
            const b = Buffer.concat(bs.map(u => Buffer.from(u)));
            const uint8Array = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
            // console.log('output done 2', uint8Array);
            resolveEncode(uint8Array);
            // console.log('output done 3');
          }
        },
        error: (err: any) => {
          console.log('error', err);
        },
      });
      console.log('test 2', mp3Encoder);
      mp3Encoder.encode({
        data: fakeData.slice(),
      });
      mp3Encoder.encode({
        data: null,
      });
      console.log('test 3', mp3Encoder);
      const b = await encodedPromise;
      console.log('test 4', {
        b,
      });

      console.log('decoder 1');
      const mp3Decoder = new Mp3AudioDecoder({
        sampleRate,
        output: (d: any) => {
          console.log('output', d.data);
        },
        error: (err: any) => {
          console.log('error', err);
        },
      });
      console.log('decoder 2');
      mp3Decoder.decode(b);
      console.log('decoder 3');
      mp3Decoder.decode(null);
      console.log('decoder 4');
    };
    await _testMp3();
  } catch (err) {
    console.error(err);
  }
}; */

const _testVad = async () => {
  AudioNodeVAD
};

//

const cachedGet = (fn: () => any) => {
  let value = null;
  let ran = false;
  return function() {
    if (!ran) {
      value = fn.call(this);
      ran = true;
    }
    return value;
  };
};

// CloudFlare Worker Durable Object class
export class DurableObject extends EventTarget {
  state: any;
  env: any;
  supabase: any;
  chatsSpecification: ChatsSpecification;
  agentRenderer: AgentRenderer;
  loadPromise: Promise<void>;

  constructor(state: any, env: any) {
    super();
    
    this.state = state;
    this.env = env;
    this.supabase = makeAnonymousClient(env, env.AGENT_TOKEN);

    this.chatsSpecification = new ChatsSpecification({
      userId: this.#getId(),
      supabase: this.supabase,
    });
    const userRender = state.userRender ?? agentTsxUserRender;
    this.agentRenderer = new AgentRenderer({
      env,
      userRender,
      chatsSpecification: this.chatsSpecification,
    });
    const bindAlarm = () => {
      const updatealarm = () => {
        this.updateAlarm();
      };
      this.agentRenderer.registry.addEventListener('updatealarm', updatealarm);
    };
    bindAlarm();

    this.loadPromise = this.agentRenderer.waitForRender();

    // initial alarm
    (async () => {
      await this.alarm();
    })();

    // _testCodecs();
  }

  waitForLoad() {
    return this.loadPromise;
  }

  //

  #getId = cachedGet(function() {
    return this.#getAgentJson().id;
  })
  #getOwnerId = cachedGet(function() {
    return this.#getAgentJson().ownerId;
  })
  #getAgentJson = cachedGet(function() {
    const agentJsonString = this.env.AGENT_JSON;
    const agentJson = JSON.parse(agentJsonString);
    return agentJson;
  })

  //

  // Handle HTTP requests from clients.
  async fetch(request: Request) {
    try {
      const u = new URL(request.url);
      console.log('worker request', request.method, u.href);

      await this.waitForLoad();

      // parse the url
      let match;
      if ((match = u.pathname.match(/^\/([^/]*)/))) {
        const subpath = match[1];
        const guid = this.#getId();

        /* const handleAgentJson = async () => {
          const agentJson = this.#getAgentJson();
          const s = JSON.stringify(agentJson);
          return new Response(s, {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
          });
        }; */
        /* const handleWs = async () => {
          // Expect to receive a WebSocket Upgrade request.
          // If there is one, accept the request and return a WebSocket Response.
          const upgradeHeader = request.headers.get('Upgrade');
          if (upgradeHeader === 'websocket') {
            console.log('got websocket open', {
              guid,
            });

            // Creates two ends of a WebSocket connection.
            const webSocketPair = new globalThis.WebSocketPair();
            const [client, server] = Object.values(webSocketPair) as [any, any];

            // Calling `accept()` informs the runtime that this WebSocket is to begin terminating
            // request within the Durable Object. It has the effect of "accepting" the connection,
            // and allowing the WebSocket to send and receive messages.
            server.accept();

            // input from the websocket
            server.addEventListener('message', async (event) => {
              const j = JSON.parse(event.data);
              const { method, args } = j;
              switch (method) {
                case 'join': {
                  const {
                    room,
                    endpointUrl = multiplayerEndpointUrl,
                    only = false,
                  } = args;
                  if (only) {
                    await this.chatsSpecification.leaveAll();
                  }
                  await this.chatsSpecification.join({
                    room,
                    endpointUrl,
                  });
                  break;
                }
                case 'leave': {
                  const {
                    room,
                    endpointUrl = multiplayerEndpointUrl,
                  } = args;
                  await this.chatsSpecification.leave({
                    room,
                    endpointUrl,
                  });
                  break;
                }
                // case 'leaveAll': {
                //   await this.chatsSpecification.leaveAll();
                //   break;
                // }
              }
            });

            // // output to the websocket
            // const onmessage = (e) => {
            //   // skip recursive chat messages coming from the socket
            //   server.send(JSON.stringify(e.data));
            // };
            // this.conversationContext.addEventListener('message', onmessage);
            server.addEventListener('close', (e) => {
              console.log('got websocket close', {
                guid,
              });

              // this.conversationContext.removeEventListener(
              //   'message',
              //   onmessage,
              // );

              server.close(1001, 'Durable Object is closing WebSocket');
            });

            return new Response(null, {
              status: 101,
              headers,
              webSocket: client,
            });
          } else {
            // expected upgrade header. respond with upgrade required status code.
            return new Response('durable object: upgrade required', {
              status: 426,
              headers,
            });
          }
        }; */
        /* const handleEvents = async () => {
          throw new Error('not implemented');

          // output to the event stream
          const message = (e) => {
            const s = JSON.stringify(e.data);
            const b = textEncoder.encode(`data: ${s}\n\n`);
            controller.enqueue(b);
          };
          this.conversationContext.addEventListener('message', message);
          this.addEventListener('error', message);
          const cleanup = () => {
            this.conversationContext.removeEventListener('message', message);
            this.removeEventListener('error', message);
          };

          // response stream
          let controller = null;
          const readable = new ReadableStream({
            start(_controller) {
              controller = _controller;

              const j = {
                ok: true,
              };
              const s = JSON.stringify(j);
              const b = textEncoder.encode(`data: ${s}\n\n`);
              controller.enqueue(b);
            },
            cancel() {
              cleanup();
            },
          });

          const res = new Response(readable, {
            headers: {
              ...headers,
              'Content-Type': 'text/event-stream',
            },
          });
          return res;
        }; */
        /* const handleStatus = async () => {
          const registry = this.agentRenderer.registry;

          const agents = registry.agents.map((agent) => {
            const {
              name,
              description,
              bio,
            } = agent;

            const agentRealms = Array.from(agent.rooms.values());
            const rooms = agentRealms.map((realms) => {
              const { conversation } = realms.metadata;
              const { room, endpointUrl } = conversation;
              return {
                room,
                endpointUrl,
              };
            });

            return {
              name,
              description,
              bio,
              rooms,
            };
          });

          return new Response(JSON.stringify({
            agents,
          }), {
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
          });
        }; */
        /* const handleWebhook = async () => {
          if (request.method === 'POST') {
            const jsonPromise = request.json();

            const authorizationHeader = request.headers['authorization'];
            const bearerMatch = authorizationHeader?.match(/^Bearer ([\s\S]+)$/i);
            const jwt = bearerMatch?.[1];
            const userId = jwt && await getUserIdForJwt(jwt);
            const ownerId = this.#getOwnerId();

            if (userId === ownerId) {
              const json = await jsonPromise;

              console.log('got webhook payload', json);

              return new Response(JSON.stringify({
                userId,
                json,
              }), {
                headers,
              });
            } else {
              console.log('unauthorized webhook', {
                userId,
                ownerId,
              });

              return new Response(JSON.stringify({
                error: 'unauthorized',
              }), {
                status: 401,
                headers,
              });
            }
          } else {
            return new Response(JSON.stringify({
              error: 'method not allowed',
            }), {
              status: 405,
              headers,
            });
          }
        }; */
        const handleJoin = async () => {
          // read the body json
          const body = await request.json();
          const {
            room,
            endpointUrl = multiplayerEndpointUrl,
            only = false,
          } = body ?? {};
          if (typeof room === 'string') {
            if (only) {
              await this.chatsSpecification.leaveAll();
            }

            await this.chatsSpecification.join({
              room,
              endpointUrl,
            });

            return new Response(JSON.stringify({ ok: true }), {
              headers,
            });
          } else {
            return new Response(JSON.stringify({
              error: 'invalid request',
            }), {
              status: 400,
              headers,
            });
          }
        };
        const handleLeave = async () => {
          const body = await request.json();
          const {
            room,
            endpointUrl = multiplayerEndpointUrl,
          } = body ?? {};
          if (typeof room === 'string') {
            await this.chatsSpecification.leave({
              room,
              endpointUrl,
            });

            return new Response(JSON.stringify({ ok: true }), {
              headers,
            });
          } else {
            return new Response(JSON.stringify({
              error: 'invalid request',
            }), {
              status: 400,
              headers,
            });
          }
        };
        const handleDefaultRequest = async () => {
          const serverResponse = await serverHandler(request, {
            agentRenderer: this.agentRenderer,
            env: this.env,
          });
          return serverResponse;
        };

        switch (subpath) {
          // case 'agent.json':
          //   return await handleAgentJson();
          // case 'status':
          //   return await handleStatus();
          // case 'ws':
          //   return await handleWs();
          // case 'events':
          //   return await handleEvents();
          // case 'webhook':
          //   return await handleWebhook();
          case 'join':
            return await handleJoin();
          case 'leave':
            return await handleLeave();
          default:
            return await handleDefaultRequest();
        }
      } else {
        return new Response('durable object: path not found', {
          headers,
          status: 404,
        });
      }
    } catch (err) {
      console.warn(err);

      return new Response(JSON.stringify({ error: err.stack }), {
        headers,
        status: 500,
      });
    }
  }
  async updateAlarm() {
    // get the next timeout
    const agents = this.agentRenderer.registry.agents as ActiveAgentObject[];
    const timeouts = agents.map((agent) =>
      agent.liveManager.getNextTimeout()
    );
    {
      const now = Date.now();
      const pingTimeout = now + pingRate;
      timeouts.push(pingTimeout);
    }
    {
      const oldAlarm = await this.state.storage.getAlarm();
      if (oldAlarm !== null) {
        timeouts.push(oldAlarm);
      }
    }
    const minTimeout = Math.min(...timeouts);

    // set the next alarm
    this.state.storage.setAlarm(minTimeout);
  }
  async alarm() {
    // wait for load just in case
    await this.waitForLoad();

    // process the agent's live managers
    const agents = this.agentRenderer.registry.agents as ActiveAgentObject[];
    const processPromises = agents.map(async (agent) => {
      agent.liveManager.process();
    });
    await Promise.all(processPromises);

    this.updateAlarm();
  }
}
