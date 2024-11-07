'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { deployEndpointUrl, r2EndpointUrl } from '@/utils/const/endpoints';
import { getJWT } from '@/lib/jwt';
import { getUserIdForJwt, getUserForJwt } from '@/utils/supabase/supabase-client';
import type {
  StoreItem,
  SubscriptionProps,
  Currency,
  Interval,
} from 'react-agents/types';
import {
  createAgentGuid,
} from 'react-agents/util/guid-util.mjs';
import {
  getAgentToken,
} from 'react-agents/util/jwt-utils.mjs';
import {
  generateMnemonic,
} from '../../utils/etherium-utils.mjs';
import {
  Chat,
} from '@/components/chat/chat';
import { cn } from '@/lib/utils';
import { ensureAgentJsonDefaults } from 'react-agents/agent-defaults.mjs';
import {
  generateCharacterImage,
  generateBackgroundImage,
} from 'react-agents/util/generate-image.mjs';
import { AgentInterview } from 'react-agents/util/agent-interview.mjs';
import { 
  defaultVoices,
} from 'react-agents/util/agent-features.mjs';
import { makeAnonymousClient } from '@/utils/supabase/supabase-client';
import { env } from '@/lib/env'
import { makeAgentSourceCode } from 'react-agents/util/agent-source-code-formatter.mjs';
import { currencies, intervals } from 'react-agents/constants.mjs';
import { buildAgentSrc } from 'react-agents-builder';
import { ReactAgentsWorker } from 'react-agents-browser';
import type { FetchableWorker } from 'react-agents-browser/types';
import { IconButton } from 'ucom';

//

const maxUserMessagesDefault = 5;
const maxUserMessagesTimeDefault = 60 * 60 * 24 * 1000; // 1 day
const rateLimitMessageDefault = '';

//

type ChatMessage = {
  role: string;
  content: string;
};

type FeaturesObject = {
  tts: {
    voiceEndpoint: string;
  } | null;
  rateLimit: {
    maxUserMessages: number;
    maxUserMessagesTime: number;
    message: string;
  } | null;
  storeItems: StoreItem[] | null;
  discordBot: {
    token: string;
    channels: string;
  } | null;
  twitterBot: {
    token: string;
  } | null;
};
type AgentEditorProps = {
  user: any;
};

export default function AgentEditor({
  user,
}: AgentEditorProps) {
  // state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [visualDescription, setVisualDescription] = useState('');
  const [homespaceDescription, setHomespaceDescription] = useState('');

  // const [model, setModel] = useState(defaultModels[0]);
  // const [visionModel, setVisionModel] = useState(defaultVisionModels[0]);

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const [homespaceBlob, setHomespaceBlob] = useState<Blob | null>(null);
  const [homespaceUrl, setHomespaceUrl] = useState('');

  const [deploying, setDeploying] = useState(false);
  const [room, setRoom] = useState('');
  const [starting, setStarting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [worker, setWorker] = useState<FetchableWorker | null>(null);

  const [builderPrompt, setBuilderPrompt] = useState('');

  const agentInterviewPromiseRef = useRef<Promise<AgentInterview> | null>(null);
  const [builderMessages, setBuilderMessages] = useState<ChatMessage[]>([]);

  const builderForm = useRef<HTMLFormElement>(null);
  const editorForm = useRef<HTMLFormElement>(null);

  const [voices, setVoices] = useState(() => defaultVoices.slice());
  const [features, setFeatures] = useState<FeaturesObject>({
    tts: null,
    rateLimit: null,
    storeItems: null,
    discordBot: null,
    twitterBot: null,
  });
  const [sourceCode, setSourceCode] = useState(() => makeAgentSourceCode(features));

  const monaco = useMonaco();

  // effects
  // sync previewBlob -> previewUrl
  useEffect(() => {
    if (previewBlob) {
      const url = URL.createObjectURL(previewBlob);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl('');
    }
  }, [previewBlob]);
  // sync homespaceBlob -> homespaceUrl
  useEffect(() => {
    if (homespaceBlob) {
      const url = URL.createObjectURL(homespaceBlob);
      setHomespaceUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setHomespaceUrl('');
    }
  }, [homespaceBlob]);
  // load custom voices from account
  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    (async () => {
      const jwt = await getJWT();
      const supabase = makeAnonymousClient(env, jwt);
      const result = await supabase
        .from('assets')
        .select('*')
        .eq( 'user_id', user.id )
        .eq( 'type', 'voice' );
      if (signal.aborted) return;

      const error = result.error as any;
      const data = result.data as any;
      if (!error) {
        // console.log('got voices data 1', data);
        const userVoices = await Promise.all(data.map(async (voice: any) => {
          const res = await fetch(voice.start_url);
          const j = await res.json();
          return j;
        }));
        if (signal.aborted) return;

        // console.log('got voices data 2', userVoices);
        setVoices(voices => {
          return [
            ...userVoices,
            ...voices,
          ];
        });
      } else {
        console.warn('error loading voices', error);
      }
    })();
  }, []);
  // sync source code to editor
  useEffect(() => {
    if (monaco) {
      const model = getEditorModel(monaco);
      if (model) {
        const editorValue = getEditorValue(monaco);
        if (editorValue !== sourceCode) {
          model.setValue(sourceCode);
        }
      }
    }
  }, [monaco, sourceCode]);
  // sync features to source code
  useEffect(() => {
    setSourceCode(makeAgentSourceCode(features));
  }, [features]);

  // helpers
  const makeDefaultTts = () => ({
    voiceEndpoint: voices[0].voiceEndpoint,
  });
  const makeDefaultRateLimit = () => ({
    maxUserMessages: maxUserMessagesDefault,
    maxUserMessagesTime: maxUserMessagesTimeDefault,
    message: rateLimitMessageDefault,
  });
  const makeDefaultDiscordBot = () => ({
    token: '',
    channels: '',
  });
  const makeDefaultTwitterBot = () => ({
    token: '',
  });
  const makeEmptyStoreItems = () => [
    makeEmptyStoreItem(),
  ];
  const makeEmptyStoreItem = () => ({
    type: 'payment',
    props: {
      name: '',
      description: '',
      amount: 100,
      currency: currencies[0] as Currency,
      interval: intervals[0] as Interval,
      intervalCount: 1,
    },
  });
  const getCloudPreviewUrl = async (previewBlob: Blob | null) => {
    if (previewBlob) {
      const jwt = await getJWT();
      const guid = crypto.randomUUID();
      const keyPath = ['assets', guid, 'avatar.jpg'].join('/');
      const u = `${r2EndpointUrl}/${keyPath}`;
      const res = await fetch(u, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
        body: previewBlob,
      });
      if (res.ok) {
        const j = await res.json();
        return j;
      } else {
        const text = await res.text();
        throw new Error(`could not upload avatar file: ${text}`);
      }
    } else {
      return null;
    }
  };
  const getEditorModel = (m = monaco) => m?.editor.getModels()[0] ?? null;
  const getEditorValue = (m = monaco) => getEditorModel(m)?.getValue() ?? '';
  async function startAgent({
    sourceCode = getEditorValue(),
  }: {
    sourceCode?: string;
  } = {}) {
    stopAgent();

    setStarting(true);

    const jwt = await getJWT();
    try {
      if (jwt) {
        console.log('building agent src...', { monaco, sourceCode });
        const agentSrc = await buildAgentSrc(sourceCode);
        console.log('built agent src:', { agentSrc });

        const [
          userPrivate,
          {
            id,
            agentToken,
          },
          previewUrl,
          homespaceUrl,
        ] = await Promise.all([
          getUserForJwt(jwt, { private: true }),
          (async () => {
            console.log('getting agent id...');
            const id = await createAgentGuid({ jwt });
            console.log('got agent id:', id);
            console.log('getting agent token...');
            const agentToken = await getAgentToken(jwt, id);
            console.log('got agent token:', agentToken);
            return {
              id,
              agentToken,
            };
          })(),
          (async () => {
            console.log('uploading agent preview...', { previewBlob });
            const previewUrl = await getCloudPreviewUrl(previewBlob);
            console.log('got agent preview url:', { previewUrl });
            return previewUrl;
          })(),
          (async () => {
            console.log('uploading agent homespace...', { homespaceBlob });
            const homespaceUrl = await getCloudPreviewUrl(homespaceBlob);
            console.log('got agent homespace url:', { homespaceUrl });
            return homespaceUrl;
          })(),
        ]);
        const {
          id: ownerId,
          stripe_connect_account_id: stripeConnectAccountId,
        } = userPrivate;
        const agentJson = {
          id,
          ownerId,
          name: name || undefined,
          bio: bio || undefined,
          visualDescription: visualDescription || undefined,
          previewUrl,
          homespaceUrl,
          stripeConnectAccountId,
        };
        ensureAgentJsonDefaults(agentJson);

        // initialize the agent worker
        const mnemonic = generateMnemonic();
        const newWorker = new ReactAgentsWorker({
          agentJson,
          agentSrc,
          apiKey: agentToken,
          mnemonic,
        });
        setWorker(newWorker);

        const newRoom = `rooms:${id}:browser`;
        setRoom(newRoom);
        setConnecting(true);

        // call the join request on the agent
        const agentHost = `${location.protocol}//${location.host}`;
        const joinReq = await newWorker.fetch(`${agentHost}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            room: newRoom,
            only: true,
          }),
        });
        if (joinReq.ok) {
          const j = await joinReq.json();
          console.log('agent join response json', j);
        } else {
          const text = await joinReq.text();
          console.error('agent failed to join room', joinReq.status, text);
        }
      } else {
        throw new Error('not logged in');
      } 
    } finally {
      setStarting(false);
    }
  }
  const stopAgent = () => {
    if (worker) {
      worker.terminate();
      setWorker(null);
    }
    if (room) {
      setRoom('');
    }
  };
  const toggleAgent = async () => {
    if (!worker) {
      await startAgent();
    } else {
      stopAgent();
    }
  };
  const ensureAgentInterview = () => {
    if (!agentInterviewPromiseRef.current) {
      agentInterviewPromiseRef.current = (async () => {
        const jwt = await getJWT();

        const agentJson = {};
        const agentInterview = new AgentInterview({
          agentJson,
          mode: 'manual',
          jwt,
        });
        agentInterview.addEventListener('input', (e: any) => {
          const {
            question,
          } = e.data;
          setBuilderMessages((builderMessages) => [
            ...builderMessages,
            {
              role: 'assistant',
              content: question,
            },
          ]);
        });
        agentInterview.addEventListener('output', (e: any) => {
          const {
            text,
          } = e.data;
          setBuilderMessages((builderMessages) => [
            ...builderMessages,
            {
              role: 'assistant',
              content: text,
            },
          ]);
        });
        agentInterview.addEventListener('change', (e: any) => {
          const {
            // updateObject,
            agentJson,
          } = e.data;
          setName(agentJson.name);
          setBio(agentJson.bio);
          setVisualDescription(agentJson.visualDescription);
          setHomespaceDescription(agentJson.homespaceDescription);
          setFeatures(agentJson.features);
        });
        agentInterview.addEventListener('preview', (e: any) => {
          const {
            result,
            signal,
          } = e.data;
          console.log('got preview data', e.data);
          setPreviewBlob(result);
        });
        agentInterview.addEventListener('finish', (e: any) => {
          // clean up
          agentInterviewPromiseRef.current = null;
        });
        return agentInterview;
      })();
    }
    return agentInterviewPromiseRef.current;
  };
  const builderSubmit = () => {
    builderForm.current?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };

  // render
  return (
    <div className="flex flex-1 h-screen overflow-hidden">

      <div className='absolute z-[100] left-2 top-2'>
        <IconButton size='small' href={"/"} icon={'BackArrow'}  />
      </div>

      {/* builder */}
      <div className="flex flex-col h-screen flex-1 bg-zinc-900 z-[50]">
        <div className="flex flex-col flex-1 bg-primary/10 overflow-scroll pt-14">
          {builderMessages.map((message, index) => (
            <div key={index} className={cn("p-2", message.role === 'assistant' ? 'bg-primary/10' : '')}>
              {message.content}
            </div>
          ))}
        </div>
        <form
          className="flex"
          onSubmit={async e => {
            e.preventDefault();
            e.stopPropagation();

            if (builderPrompt) {
              const agentInterview = await ensureAgentInterview();
              agentInterview.write(builderPrompt);

              setBuilderMessages((builderMessages) => [
                ...builderMessages,
                {
                  role: 'user',
                  content: builderPrompt,
                },
              ]);
              setBuilderPrompt('');
            }
          }}
          ref={builderForm}
        >
          <input
            type="text"
            className="flex-1 px-4"
            value={builderPrompt}
            onKeyDown={e => {
              switch (e.key) {
                case 'Enter': {
                  e.preventDefault();
                  e.stopPropagation();

                  builderSubmit();
                  break;
                }
              }
            }}
            onChange={e => setBuilderPrompt(e.target.value)}
          />
          <Button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();

              agentInterviewPromiseRef.current = null;
              setBuilderMessages([]);
            }}
          >Clear</Button>
          <Button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();

              builderSubmit();
            }}
          >Send</Button>
        </form>
      </div>
      <Chat
        room={room}
        onConnect={(connected) => {
          if (connected) {
            setConnecting(false);
          }
        }}
      />
      {/* editor */}
      <form className="relative z-[50] flex flex-col h-screen bg-zinc-900 px-4 flex-1" ref={editorForm} onSubmit={e => {
        e.preventDefault();

        // check if the form is validated
        const valid = builderForm.current?.checkValidity();
        if (valid) {
          (async () => {
            try {
              setDeploying(true);

              // get the value from monaco editor
              const value = getEditorValue();
              console.log('deploy 1', {
                name,
                bio,
                visualDescription,
                previewBlob,
                value,
              });

              const jwt = await getJWT();
              if (jwt) {
                const [
                  userPrivate,
                  id,
                  previewUrl,
                  homespaceUrl,
                ] = await Promise.all([
                  getUserForJwt(jwt, { private: true }),
                  createAgentGuid({ jwt }),
                  getCloudPreviewUrl(previewBlob),
                  getCloudPreviewUrl(homespaceBlob),
                ]);
                const {
                  id: ownerId,
                  stripe_connect_account_id: stripeConnectAccountId,
                } = userPrivate;
                const agentJson = {
                  id,
                  ownerId,
                  name,
                  bio,
                  visualDescription,
                  previewUrl,
                  homespaceUrl,
                  stripeConnectAccountId,
                };
                console.log('deploy 2', {
                  agentJson,
                });

                const res = await fetch(`${deployEndpointUrl}/agent`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/javascript',
                    Authorization: `Bearer ${jwt}`,
                    'Agent-Json': JSON.stringify(agentJson),
                  },
                  body: value,
                });
                if (res.ok) {
                  const j = await res.json();
                  console.log('deploy 3', j);
                  const agentJsonOutputString = j.vars.AGENT_JSON;
                  const agentJsonOutput = JSON.parse(agentJsonOutputString);
                  const guid = agentJsonOutput.id;
                  location.href = `/agents/${guid}`;
                } else {
                  console.error('failed to deploy agent', res);
                }
              } else {
                throw new Error('not logged in');
              }
            } finally {
              setDeploying(false);
            }
          })();
        }
      }}>
        <div className="flex my-4">
          <div className="flex flex-col">
            {previewUrl ? <Link
              href={previewUrl}
              target="_blank"
            >
              <img
                src={previewUrl}
                className='w-20 h-20 mr-2 bg-primary/10 rounded'
              />
            </Link> : <div
              className='w-20 h-20 mr-2 bg-primary/10 rounded'
            />}
            <Button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();

                console.log('generate character click', { visualDescription });
                if (visualDescription) {
                  (async () => {
                    const jwt = await getJWT();
                    const result = await generateCharacterImage(visualDescription, undefined, {
                      jwt,
                    });
                    const {
                      blob,
                    } = result;
                    setPreviewBlob(blob);
                  })();
                }
              }}
            >Generate</Button>
          </div>
          <div
            className="flex flex-col flex-1 mr-2"
          >
            <input type="text" className="px-2" value={name} placeholder="Name" onChange={e => {
              setName(e.target.value);
            }} />
            <input type="text" className="px-2" value={bio} placeholder="Bio" onChange={e => {
              setBio(e.target.value);
            }} />
            <input type="text" className="px-2" value={visualDescription} placeholder="Visual description" onChange={e => {
              setVisualDescription(e.target.value);
            }} />
            <input type="text" className="px-2" value={homespaceDescription} placeholder="Homespace description" onChange={e => {
              setHomespaceDescription(e.target.value);
            }} />
            {/* <label className="flex">
              <div className="w-36 mr-2">
                Text model
              </div>
              <select
                className="w-24"
                value={model}
                onChange={e => {
                  setModel(e.target.value);
                }}
              >
                {defaultModels.map(model => {
                  return (
                    <option value={model} key={model}>{model}</option>
                  );
                })}
              </select>
            </label>
            <label className="flex">
              <div className="w-36 mr-2">
                Vision model
              </div>
              <select
                className="w-24"
                value={visionModel}
                onChange={e => {
                  setVisionModel(e.target.value);
                }}
              >
                {defaultVisionModels.map(model => {
                  return (
                    <option value={model} key={model}>{model}</option>
                  );
                })}
              </select>
            </label> */}
          </div>
          <div
            className="flex flex-col w-20"
          >
            <Button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();

                toggleAgent();
              }}
              disabled={starting || connecting}
            >{(() => {
              if (starting) {
                return 'Starting...';
              } else if (connecting) {
                return 'Connecting...';
              } else if (worker) {
                return 'Stop';
              } else {
                return 'Start';
              }
            })()}</Button>
            <Button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();

                editorForm.current?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }}
              disabled={deploying}
            >{!deploying ? `Deploy` : 'Deploying...'}</Button>
          </div>
        </div>
        <div className="flex flex-col">
          {homespaceUrl ? <Link
            href={homespaceUrl}
            target="_blank"
          >
            <img
              src={homespaceUrl}
              className='w-full h-32 bg-primary/10 object-cover rounded'
            />
          </Link> : <div
            className='w-full h-32 bg-primary/10 rounded'
          />}
          <Button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();

              console.log('generate homespace click', { homespaceDescription });
              if (homespaceDescription) {
                (async () => {
                  const jwt = await getJWT();
                  const result = await generateBackgroundImage(homespaceDescription, undefined, {
                    jwt,
                  });
                  const {
                    blob,
                  } = result;
                  setHomespaceBlob(blob);
                })();
              }
            }}
          >Generate</Button>
        </div>
        <div className="flex flex-col">
          <div>Features</div>
          {/* voices */}
          <div className="flex flex-col">
            <label className="flex">
              <input type="checkbox" checked={!!features.tts} onChange={e => {
                setFeatures({
                  ...features,
                  tts: e.target.checked ? makeDefaultTts() : null,
                });
              }} />
              <div className="px-2">TTS</div>
            </label>
            {features.tts && <label className="flex">
              <div className="mr-2">Voice</div>
              <select value={features.tts?.voiceEndpoint ?? ''} onChange={e => {
                setFeatures(features => (
                  {
                    ...features,
                    tts: {
                      voiceEndpoint: e.target.value,
                    },
                  }
                ));
              }}>
                {voices.map(voice => {
                  return (
                    <option key={voice.voiceEndpoint} value={voice.voiceEndpoint}>{voice.name}</option>
                  );
                })}
              </select>
            </label>}
          </div>
          {/* rate limit */}
          <div className="flex flex-col">
            <label className="flex">
              <input type="checkbox" checked={!!features.rateLimit} onChange={e => {
                setFeatures({
                  ...features,
                  rateLimit: e.target.checked ? makeDefaultRateLimit() : null,
                });
              }} />
              <div className="px-2">Rate limit</div>
            </label>
            {features.rateLimit && <div className="flex flex-col">
              <label className="flex">
                <div className="mr-2 min-w-32"># messages</div>
                <input type="number" value={features.rateLimit?.maxUserMessages ?? ''} onChange={e => {
                  setFeatures(features => {
                    features = {
                      ...features,
                      rateLimit: {
                        maxUserMessages: parseInt(e.target.value, 10) || 0,
                        maxUserMessagesTime: features.rateLimit?.maxUserMessagesTime ?? 0,
                        message: features.rateLimit?.message ?? rateLimitMessageDefault,
                      },
                    };
                    e.target.value = (features.rateLimit as any).maxUserMessages + '';
                    return features;
                  });
                }} min={0} step={1} placeholder={maxUserMessagesDefault + ''} />
              </label>
              <label className="flex">
                <div className="mr-2 min-w-32">time (ms)</div>
                <input type="number" value={features.rateLimit?.maxUserMessagesTime ?? ''} onChange={e => {
                  setFeatures(features => {
                    features = {
                      ...features,
                      rateLimit: {
                        maxUserMessages: features.rateLimit?.maxUserMessages ?? 0,
                        maxUserMessagesTime: parseInt(e.target.value, 10) || 0,
                        message: features.rateLimit?.message ?? rateLimitMessageDefault,
                      },
                    };
                    e.target.value = (features.rateLimit as any).maxUserMessagesTime + '';
                    return features;
                  });
                }} min={0} step={1} placeholder={maxUserMessagesTimeDefault + ''} />
              </label>
              <label className="flex">
                <div className="mr-2 min-w-32">message</div>
                <input type="text" value={features.rateLimit?.message ?? ''} onChange={e => {
                  setFeatures(features => (
                    {
                      ...features,
                      rateLimit: {
                        maxUserMessages: features.rateLimit?.maxUserMessages ?? 0,
                        maxUserMessagesTime: features.rateLimit?.maxUserMessagesTime ?? 0,
                        message: e.target.value,
                      },
                    }
                  ));
                }} placeholder="Rate limit message" />
              </label>
            </div>}
          </div>
          {/* discord bot */}
          <div className="flex flex-col">
            <label className="flex">
              <input type="checkbox" checked={!!features.discordBot} onChange={e => {
                setFeatures({
                  ...features,
                  discordBot: e.target.checked ? makeDefaultDiscordBot() : null,
                });
              }} />
              <div className="px-2">Discord bot</div>
            </label>
            {features.discordBot && <div className="flex flex-col">
              {/* token */}
              <label className="flex">
                <div className="mr-2 min-w-32">Token</div>
                <input type="text" value={features.discordBot.token} onChange={e => {
                  setFeatures(features => ({
                    ...features,
                    discordBot: {
                      token: e.target.value,
                      channels: features.discordBot?.channels ?? '',
                    },
                  }));
                }} placeholder="<bot token>" required />
              </label>
              {/* channels */}
              <label className="flex">
                <div className="mr-2 min-w-32">Channels</div>
                <input type="text" value={features.discordBot.channels} onChange={e => {
                  setFeatures(features => ({
                    ...features,
                    discordBot: {
                      token: features.discordBot?.token ?? '',
                      channels: e.target.value,
                    },
                  }));
                }} placeholder="text, voice" required />
              </label>
            </div>}
          </div>
          {/* twitter bot */}
          <div className="flex flex-col">
            <label className="flex">
              <input type="checkbox" checked={!!features.twitterBot} onChange={e => {
                setFeatures({
                  ...features,
                  twitterBot: e.target.checked ? makeDefaultTwitterBot() : null,
                });
              }} />
              <div className="px-2">Twitter bot</div>
            </label>
            {features.twitterBot && <div className="flex flex-col">
              {/* token */}
              <label className="flex">
                <div className="mr-2 min-w-32">Token</div>
                <input type="text" value={features.twitterBot.token} onChange={e => {
                  setFeatures(features => ({
                    ...features,
                    twitterBot: {
                      token: e.target.value,
                    },
                  }));
                }} placeholder="<bot token>" required />
              </label>
            </div>}
          </div>
          {/* store */}
          <div className="flex flex-col">
            <label className="flex">
              <input type="checkbox" checked={!!features.storeItems} onChange={e => {
                setFeatures({
                  ...features,
                  storeItems: e.target.checked ? makeEmptyStoreItems() : null,
                });
              }} />
              <div className="px-2">Store</div>
            </label>
            {features.storeItems && <div className="flex flex-col">
              {features.storeItems.map((item, index) => {
                const {
                  type,
                  props,
                } = item;
                const setStoreItem = (fn: (storeItem: StoreItem) => void) => {
                  setFeatures(features => {
                    const storeItems = features.storeItems ?? [];
                    const newStoreItems = [...storeItems];
                    const newStoreItem = { ...item };
                    fn(newStoreItem);
                    newStoreItems[index] = newStoreItem;
                    return {
                      ...features,
                      storeItems: newStoreItems,
                    };
                  });
                };
                return (
                  <div className="flex" key={index}>
                    {props.previewUrl ?
                      <img
                        src={props.previewUrl}
                        className="w-16 h-16 mr-2 bg-primary/10 rounded"
                      />
                    :
                      <div
                        className="w-16 h-16 mr-2 bg-primary/10 rounded"
                      />
                    }
                    <div className="flex flex-col">
                      <select value={type} onChange={e => {
                        setStoreItem((storeItem) => {
                          storeItem.type = e.target.value;
                        });
                      }}>
                        <option value="payment">payment</option>
                        <option value="subscription">subscription</option>
                      </select>
                      <input type="text" className="flex" value={props.name} onChange={e => {
                        setStoreItem((storeItem) => {
                          storeItem.props.name = e.target.value;
                        });
                      }} placeholder="Name" />
                      <input type="text" className="flex" value={props.description} onChange={e => {
                        setStoreItem((storeItem) => {
                          storeItem.props.description = e.target.value;
                        });
                      }} placeholder="Description" />
                      <input type="number" value={props.amount} onChange={e => {
                        setStoreItem((storeItem) => {
                          storeItem.props.amount = parseFloat(e.target.value);
                        });
                      }} placeholder="Amount" />
                      <select value={props.currency} onChange={e => {
                        setStoreItem((storeItem) => {
                          storeItem.props.currency = e.target.value as Currency;
                        });
                      }}>
                        {currencies.map(currency => {
                          return (
                            <option value={currency} key={currency}>{currency}</option>
                          );
                        })}
                      </select>
                      {type === 'subscription' && <>
                        {/* interval */}
                        <select value={(props as SubscriptionProps).interval} onChange={e => {
                          setStoreItem((storeItem) => {
                            (storeItem.props as SubscriptionProps).interval = e.target.value as Interval;
                          });
                        }}>
                          <option value="day">day</option>
                          <option value="week">week</option>
                          <option value="month">month</option>
                          <option value="year">year</option>
                        </select>
                        {/* intervalCount */}
                        <input type="number" value={(props as SubscriptionProps).intervalCount} onChange={e => {
                          setStoreItem((storeItem) => {
                            (storeItem.props as SubscriptionProps).intervalCount = parseFloat(e.target.value);
                          });
                        }} placeholder="Interval count" />
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        </div>
        <Editor
          theme="vs-dark"
          defaultLanguage="javascript"
          defaultValue={sourceCode}
          options={{
            readOnly: deploying,
          }}
          onMount={(editor, monaco) => {
            (editor as any)._domElement.parentNode.style.flex = 1;

            const model = editor.getModel();
            if (model) {
              model.onDidChangeContent(() => {
                const s = getEditorValue(monaco);
                setSourceCode(s);
              });
            } else {
              console.warn('no model', editor);
            }

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              startAgent({
                sourceCode: getEditorValue(monaco),
              });
            });
          }}
        />
      </form>
      
    </div>
  );
};
