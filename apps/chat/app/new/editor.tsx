'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import path from 'path';
import Link from 'next/link';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { deployEndpointUrl, r2EndpointUrl } from '@/utils/const/endpoints';
import { getJWT } from '@/lib/jwt';
import { getUserIdForJwt, getUserForJwt } from '@/utils/supabase/supabase-client';
import {
  defaultModels,
  defaultVisionModels,
} from 'react-agents/constants.mjs';
import {
  createAgentGuid,
} from 'react-agents/util/guid-util.mjs';
import {
  getAgentToken,
} from 'react-agents/util/jwt-utils.mjs';
// XXX this is a bad dependency, this should be moved down to the lower layer
import {
  generateMnemonic,
} from 'usdk/util/ethereum-utils.mjs';
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
// import { createBrowser, testBrowser } from 'react-agents/util/create-browser.mjs';

import * as esbuild from 'esbuild-wasm';
import {
  StoreItem,
  SubscriptionProps,
  Currency,
  Interval,
} from 'react-agents/types';
import { base64ToBlob, blobToBase64 } from 'react-agents/util/base64.mjs';
const ensureEsbuild = (() => {
  let esBuildPromise: Promise<void> | null = null;
  return () => {
    if (!esBuildPromise) {
      esBuildPromise = (async () => {
        try {
          const u = new URL('esbuild-wasm/esbuild.wasm', import.meta.url);
          await esbuild.initialize({
            worker: true,
            wasmURL: u.href,
          });
        } catch (err) {
          console.warn('failed to initialize esbuild', err);
        }
      })();
    }
    return esBuildPromise;
  };
})();

const defaultFiles = [
  {
    path: '/example.ts',
    content: `\
      export const example = 'This is an example module';
    `,
  },
];
const maxUserMessagesDefault = 5;
const maxUserMessagesTimeDefault = 60 * 60 * 24 * 1000; // 1 day
const rateLimitMessageDefault = '';
const buildAgentSrc = async (sourceCode: string, {
  files = defaultFiles,
} = {}) => {
  await ensureEsbuild();

  const fileMap = new Map(files.map(file => [file.path, file.content]));
  const filesNamespace = 'files';
  const globalImportMap = new Map(Array.from(Object.entries({
    'react': 'React',
    'zod': 'zod',
    'react-agents': 'ReactAgents',
  })));
  const globalNamespace = 'globals';

  const result = await esbuild.build({
    stdin: {
      contents: sourceCode,
      resolveDir: '/', // Optional: helps with resolving imports
      sourcefile: 'app.tsx', // Optional: helps with error messages
      loader: 'tsx', // Set the appropriate loader based on the source type
    },
    bundle: true,
    outdir: 'dist',
    format: 'esm',
    plugins: [
      {
        name: 'globals-plugin',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const p = args.path;
            const globalName = globalImportMap.get(p);
            // console.log('got resolve', {args, p, globalName});
            if (globalName) {
              return { path: p, namespace: globalNamespace };
            }
            return null; // Continue with the default resolution
          });
          build.onLoad({ filter: /.*/, namespace: globalNamespace }, (args) => {
            const p = args.path;
            const globalName = globalImportMap.get(p);
            // console.log('got load', {args, p, globalName});
            if (globalName) {
              return {
                // globalImports is initialized by the worker wrapper
                contents: `module.exports = globalImports[${JSON.stringify(globalName)}];`,
                loader: 'js',
              };
            }
            return null; // Continue with the default loading
          });
        },
      },
      {
        name: 'files-plugin',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const p = path.resolve(args.resolveDir, args.path);
            // console.log('got resolve', {args, p});
            if (fileMap.has(p)) {
              return { path: p, namespace: filesNamespace };
            }
            return null; // Continue with the default resolution
          });
          build.onLoad({ filter: /.*/, namespace: filesNamespace }, (args) => {
            // console.log('got load', args);
            const p = args.path;
            const contents = fileMap.get(p);
            if (contents) {
              return { contents, loader: 'tsx' };
            }
            return null; // Continue with the default loading
          });
        },
      },
    ],
  });
  const {
    errors = [],
    outputFiles = [],
  } = result;
  if (errors.length === 0) {
    const outputFile = outputFiles[0];
    // console.log('got output file', outputFile);
    const { contents } = outputFile;
    const textDecoder = new TextDecoder();
    const text = textDecoder.decode(contents);
    // console.log('got contents');
    // console.log(text);
    return text;
  } else {
    console.warn('build errors: ', errors);
    throw new Error('Failed to build: ' + JSON.stringify(errors));
  }
};

type FetchOpts = {
  method?: string;
  headers?: object | Headers;
  body?: string | ArrayBuffer;
};
type FetchableWorker = Worker & {
  fetch: (url: string, opts: FetchOpts) => Promise<Response>;
};

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
};
type AgentEditorProps = {
  user: any;
};

const clearLocalStorage = () => {
  localStorage.removeItem('name');
  localStorage.removeItem('bio');
  localStorage.removeItem('visualDescription');
  localStorage.removeItem('homespaceDescription');
  localStorage.removeItem('previewUrl');
  localStorage.removeItem('homespaceUrl');
  localStorage.removeItem('previewBlob');
  localStorage.removeItem('homespaceBlob');
  localStorage.removeItem('features');
};

export default function AgentEditor({
  user,
}: AgentEditorProps) {
  // state
  const [name, setName] = useState(localStorage.getItem('name') || '');
  const [bio, setBio] = useState(localStorage.getItem('bio') || '');
  const [visualDescription, setVisualDescription] = useState(localStorage.getItem('visualDescription') || '');
  const [homespaceDescription, setHomespaceDescription] = useState(localStorage.getItem('homespaceDescription') || '');

  const [model, setModel] = useState(defaultModels[0]);
  const [visionModel, setVisionModel] = useState(defaultVisionModels[0]);

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(() => {
    const base64 = localStorage.getItem('previewBlob');
    return base64 ? base64ToBlob(base64) : null;
  });

  const [previewUrl, setPreviewUrl] = useState(localStorage.getItem('previewUrl') || '');

  const [homespaceBlob, setHomespaceBlob] = useState<Blob | null>(() => {
    const base64 = localStorage.getItem('homespaceBlob');
    return base64 ? base64ToBlob(base64) : null;
  });
  const [homespaceUrl, setHomespaceUrl] = useState(localStorage.getItem('homespaceUrl') || '');

  const [deploying, setDeploying] = useState(false);
  const [room, setRoom] = useState('');
  const [starting, setStarting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [worker, setWorker] = useState<FetchableWorker | null>(null);

  const [builderPrompt, setBuilderPrompt] = useState('');
  // const [agentPrompt, setAgentPrompt] = useState('');

  const agentInterviewPromiseRef = useRef<Promise<AgentInterview> | null>(null);
  const [builderMessages, setBuilderMessages] = useState<ChatMessage[]>([]);

  const builderForm = useRef<HTMLFormElement>(null);
  // const agentForm = useRef<HTMLFormElement>(null);
  const editorForm = useRef<HTMLFormElement>(null);

  const [voices, setVoices] = useState(() => defaultVoices.slice());
  const [features, setFeatures] = useState<FeaturesObject>(() => {
    const savedFeatures = localStorage.getItem('features');
    return savedFeatures ? JSON.parse(savedFeatures) : {
      tts: null,
      rateLimit: null,
      storeItems: null,
    };
  });
  const [sourceCode, setSourceCode] = useState(() => makeAgentSourceCode(features));

  const monaco = useMonaco();

  useEffect(() => {
    console.log('set name', name);
    localStorage.setItem('name', name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem('bio', bio);
  }, [bio]);

  useEffect(() => {
    localStorage.setItem('visualDescription', visualDescription);
  }, [visualDescription]);

  useEffect(() => {
    localStorage.setItem('homespaceDescription', homespaceDescription);
  }, [homespaceDescription]);

  useEffect(() => {
    console.log('set previewUrl', previewUrl);
    localStorage.setItem('previewUrl', previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    localStorage.setItem('homespaceUrl', homespaceUrl);
  }, [homespaceUrl]);

  useEffect(() => {
    if (previewBlob) {
      blobToBase64(previewBlob).then(base64 => {
        localStorage.setItem('previewBlob', base64);
      });
    } else {
      localStorage.removeItem('previewBlob');
    }
  }, [previewBlob]);

  useEffect(() => {
    if (homespaceBlob) {
      blobToBase64(homespaceBlob).then(base64 => {
        localStorage.setItem('homespaceBlob', base64);
      });
    } else {
      localStorage.removeItem('homespaceBlob');
    }
  }, [homespaceBlob]);

  useEffect(() => {
    localStorage.setItem('features', JSON.stringify(features));
  }, [features]);

  // useEffect(() => {
  //   (async () => {
  //     const jwt = await getJWT();
  //     (globalThis as any).testBrowser = async () => {
  //       return await testBrowser({
  //         jwt,
  //       });
  //     };
  //     console.log('test initialized');
  //   })();
  // }, []);

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

      const { error, data } = result;
      if (!error) {
        // console.log('got voices data 1', data);
        const userVoices = await Promise.all(data.map(async voice => {
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
        const mnemonic = generateMnemonic();
        const env = {
          AGENT_JSON: JSON.stringify(agentJson),
          AGENT_TOKEN: agentToken,
          WALLET_MNEMONIC: mnemonic,
          SUPABASE_URL: "https://friddlbqibjnxjoxeocc.supabase.co",
          SUPABASE_PUBLIC_API_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaWRkbGJxaWJqbnhqb3hlb2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM2NjE3NDIsImV4cCI6MjAxOTIzNzc0Mn0.jnvk5X27yFTcJ6jsCkuXOog1ZN825md4clvWuGQ8DMI",
          WORKER_ENV: 'development', // 'production',
        };
        console.log('starting worker with env:', env);

        // initialize the agent worker
        const newWorker = new Worker(new URL('upstreet-agent/worker.tsx', import.meta.url)) as FetchableWorker;
        newWorker.postMessage({
          method: 'initDurableObject',
          args: {
            env,
            agentSrc,
          },
        });
        newWorker.addEventListener('error', e => {
          console.warn('got error', e);
        });
        // augment the agent worker
        newWorker.fetch = async (url: string, opts: FetchOpts) => {
          const requestId = crypto.randomUUID();
          const {
            method, headers, body,
          } = opts;
          newWorker.postMessage({
            method: 'request',
            args: {
              id: requestId,
              url,
              method,
              headers,
              body,
            },
          }, []);
          const res = await new Promise<Response>((accept, reject) => {
            const onmessage = (e: MessageEvent) => {
              // console.log('got worker message data', e.data);
              try {
                const { method } = e.data;
                switch (method) {
                  case 'response': {
                    const { args } = e.data;
                    const {
                      id: responseId,
                    } = args;
                    if (responseId === requestId) {
                      cleanup();

                      const {
                        error, status, headers, body,
                      } = args;
                      if (!error) {
                        const res = new Response(body, {
                          status,
                          headers,
                        });
                        accept(res);
                      } else {
                        reject(new Error(error));
                      }
                    }
                    break;
                  }
                  default: {
                    console.warn('unhandled worker message method', e.data);
                    break;
                  }
                }
              } catch (err) {
                console.error('failed to handle worker message', err);
                reject(err);
              }
            };
            newWorker.addEventListener('message', onmessage);

            const cleanup = () => {
              newWorker.removeEventListener('message', onmessage);
            };
          });
          return res;
        };
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

  const handleClear = (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    clearLocalStorage();
    setName('');
    setBio('');
    setVisualDescription('');
    setHomespaceDescription('');
    setPreviewBlob(null);
    setPreviewUrl('');
    setHomespaceBlob(null);
    setHomespaceUrl('');
    setFeatures({
      tts: null,
      rateLimit: null,
      storeItems: null,
    });
    setSourceCode('');
    setBuilderMessages([]);
  }

  // render
  return (
    <div className="flex flex-1">
      {/* builder */}
      <div className="flex flex-col flex-1 max-h-[calc(100vh_-_64px)]">
        <div className="flex flex-col flex-1 bg-primary/10 overflow-scroll">
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
      <form className="relative flex flex-col flex-1" ref={editorForm} onSubmit={e => {
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
                  clearLocalStorage();
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
            <Button onClick={handleClear} disabled={deploying}>Clear</Button>
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
                  tts: e.target.checked ? {
                    voiceEndpoint: voices[0].voiceEndpoint,
                  } : null,
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
                  rateLimit: e.target.checked ? {
                    maxUserMessages: maxUserMessagesDefault,
                    maxUserMessagesTime: maxUserMessagesTimeDefault,
                    message: rateLimitMessageDefault,
                  } : null,
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
          {/* store */}
          <div className="flex flex-col">
            <label className="flex">
              <input type="checkbox" checked={!!features.storeItems} onChange={e => {
                setFeatures({
                  ...features,
                  storeItems: e.target.checked ? [makeEmptyStoreItem()] : null,
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
