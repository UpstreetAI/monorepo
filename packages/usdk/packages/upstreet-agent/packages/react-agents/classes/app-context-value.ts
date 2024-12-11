import { useState, useEffect, useMemo, useRef } from 'react';
import type {
  ZodTypeAny,
} from 'zod';
import type {
  ActiveAgentObject,
  SubtleAi,
  TtsArgs,
  ChatArgs,
  SubtleAiCompleteOpts,
  SubtleAiImageOpts,
  ChatMessages,
  RenderRegistry,
  ReadableAudioStream,
  ConversationManager,
  ChatsSpecification,
} from '../types';
import { AutoVoiceEndpoint, VoiceEndpointVoicer } from '../lib/voice-output/voice-endpoint-voicer.mjs';
import {
  lembed,
} from '../util/embedding.mjs';
import { fetchChatCompletion, fetchJsonCompletion } from '../util/fetch.mjs';
import { fetchImageGeneration } from '../util/generate-image.mjs';
import { Kv } from './kv';
import { useAgent } from '../hooks';

//

export class AppContextValue {
  subtleAi: SubtleAi;
  agentJson: object;
  env: object;
  environment: string;
  wallets: any;
  authToken: string;
  supabase: any;
  conversationManager: ConversationManager;
  chatsSpecification: ChatsSpecification;
  codecs: any;
  init: any;
  debug: number;
  registry: RenderRegistry;

  constructor({
    subtleAi,
    agentJson,
    env,
    environment,
    wallets,
    authToken,
    supabase,
    conversationManager,
    chatsSpecification,
    codecs,
    init,
    debug,
    registry,
  }: {
    subtleAi: SubtleAi;
    agentJson: object;
    environment: string;
    env: object;
    wallets: any;
    authToken: string;
    supabase: any;
    conversationManager: ConversationManager;
    chatsSpecification: ChatsSpecification;
    codecs: any;
    init: any;
    debug: number;
    registry: RenderRegistry;
  }) {
    this.subtleAi = subtleAi;
    this.agentJson = agentJson;
    this.env = env;
    this.environment = environment;
    this.wallets = wallets;
    this.authToken = authToken;
    this.supabase = supabase;
    this.conversationManager = conversationManager;
    this.chatsSpecification = chatsSpecification;
    this.codecs = codecs;
    this.init = init;
    this.debug = debug;
    this.registry = registry;
  }

  // hooks

  useAgentJson() {
    return this.agentJson;
  }
  useEnv() {
    return this.env;
  }
  useEnvironment() {
    return this.environment;
  }
  useWallets() {
    return this.wallets;
  }
  useAuthToken() {
    return this.authToken;
  }
  useSupabase() {
    return this.supabase;
  }
  useConversationManager() {
    return this.conversationManager;
  }
  useChatsSpecification() {
    return this.chatsSpecification;
  }
  useCodecs() {
    return this.codecs;
  }
  useInit() {
    return this.init;
  }
  useDebug() {
    return this.debug;
  }
  useRegistry() {
    return this.registry;
  }

  useKv<T>() {
    const agent = useAgent();
    const supabase = agent.useSupabase();
    const [kvEpoch, setKvEpoch] = useState(0);

    const kv = useMemo(() => new Kv<T>({
      agent,
      supabase,
      updateFn: () => {
        setKvEpoch(kvEpoch => kvEpoch + 1);
      },
    }), []);

    return kv;
  }
  useTts(opts?: TtsArgs) {
    const voiceEndpointString = (() => {
      if (opts?.voiceEndpoint) {
        return opts.voiceEndpoint;
      } else {
        return (this.agentJson as any).voiceEndpoint as string;
      }
    })();
    // const sampleRate = opts?.sampleRate ?? defaultSampleRate;
    if (voiceEndpointString) {
      const match = voiceEndpointString.match(/^([^:]+?):([^:]+?):([^:]+?)$/);
      if (match) {
        const [_, model, voiceName, voiceId] = match;
        const voiceEndpoint = new AutoVoiceEndpoint({
          model,
          voiceId,
        });
        const voiceEndpointVoicer = new VoiceEndpointVoicer({
          voiceEndpoint,
          jwt: this.authToken,
          // audioManager: null,
          // sampleRate,
        });
        return {
          getVoiceStream: (text: string, opts: any) => {
            const readableStream = voiceEndpointVoicer.getVoiceStream(text, opts) as ReadableAudioStream;
            return readableStream;
          },
          getVoiceConversionStream: (blob: Blob, opts: any) => {
            const readableStream = voiceEndpointVoicer.getVoiceConversionStream(blob, opts) as ReadableAudioStream;
            return readableStream;
          },
        };
      } else {
        throw new Error('invalid voice endpoint: ' + voiceEndpointString);
      }
    } else {
      throw new Error('no voice endpoint');
    }
  }

  async embed(text: string) {
    const jwt = this.authToken;
    const embedding = await lembed(text, {
      jwt,
    });
    return embedding;
  }
  async complete(messages: ChatMessages, opts: SubtleAiCompleteOpts) {
    const { model } = opts;
    const jwt = this.authToken;
    const content = await fetchChatCompletion({
      model,
      messages,
    }, {
      jwt,
    });
    return {
      role: 'assistant',
      content,
    };
  }
  async completeJson(messages: ChatMessages, format: ZodTypeAny, opts: SubtleAiCompleteOpts) {
    const { model } = opts;
    const jwt = this.authToken;
    const content = await fetchJsonCompletion({
      model,
      messages,
    }, format, {
      jwt,
    });
    return {
      role: 'assistant',
      content,
    };
  }
  async generateImage(prompt: string, opts: SubtleAiImageOpts) {
    const jwt = this.authToken;
    return await fetchImageGeneration(prompt, opts, {
      jwt,
    });
  }
};
