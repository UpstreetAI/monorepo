import type { ReactNode, FC, Ref } from 'react';
import type { ZodTypeAny } from 'zod';

// intrinsics

declare global {
  namespace JSX {
    interface IntrinsicElements {
      agent: any;
      prompt: any;
    }
  }
}

// network

export type NetworkRealms = any;

// events

export type ExtendableMessageEvent<T> = MessageEvent<T> & {
  waitUntil: (promise: Promise<any>) => void;
  waitForFinish: () => Promise<void>;
};

// agents

export type AgentObject = EventTarget & {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  bio: string;
  previewUrl: string;
  model: string;
  address: string;
  stripeConnectAccountId: string;
};
export type AgentSpec = {
  id: string;
  name: string;
};
export type GenerativeAgentObject =  {
  agent: ActiveAgentObject;
  conversation: ConversationObject;
  generativeQueueManager: QueueManager;
  
  get location(): URL;

  embed: (text: string) => Promise<Array<number>>;
  complete: (
    messages: ChatMessages,
  ) => Promise<ChatMessage>;
  completeJson: (
    messages: ChatMessages,
    format: ZodTypeAny,
  ) => Promise<ChatMessage>;

  think: (hint?: string, thinkOpts?: AgentThinkOptions) => Promise<any>;
  generate: (hint: string, schema?: ZodTypeAny) => Promise<any>;
  generateImage: (prompt: string, opts?: SubtleAiImageOpts) => Promise<Blob>;
  say: (text: string) => Promise<any>;
  monologue: (text: string) => Promise<any>;

  addMessage: (m: PendingActionMessage) => Promise<void>;
  addAudioStream: (stream: PlayableAudioStream) => void;
};
export type AgentThinkOptions = {
  forceAction?: string;
  excludeActions?: string[];
};

// messages

export type ChatMessage = {
  role: string;
  content: string | object;
};
export type ChatMessages = Array<ChatMessage>;

export type ChatArgs = {
  endpointUrl: string;
  playerId: string;
};

// kv

export type KvArgs = {
};

// tts

export type TtsArgs = {
  voiceEndpoint?: string;
  sampleRate?: number;
}

// discord

export type DiscordBotRoomSpec = RegExp | string;
export type DiscordBotRoomSpecs = DiscordBotRoomSpec | DiscordBotRoomSpec[];
export type DiscordBotProps = {
  token: string;
  channels?: DiscordBotRoomSpecs;
  dms?: DiscordBotRoomSpecs;
  userWhitelist?: string[];
};
export type DiscordBotArgs = {
  token: string;
  channels: DiscordBotRoomSpec[];
  dms: DiscordBotRoomSpec[];
  userWhitelist: string[];
  agent: ActiveAgentObject;
};

// twitter

export type TwitterBotProps = {
  token: string;
};

// telnyx

export type TelnyxProps = {
  apiKey: string;
  phoneNumber?: string;
  message: boolean;
  voice: boolean;
};
export type TelnyxBotArgs = {
  apiKey: string;
  phoneNumber: string;
  message: boolean;
  voice: boolean;
  agent: ActiveAgentObject;
};

// actions

export type FormattedAttachment = {
  type: string;
  id: string;
};
export type Attachment = FormattedAttachment & {
  url?: string;
};
export type ActionMessage = {
  userId: string;
  name: string;
  method: string;
  args: object;
  attachments?: Attachment[];
  human: boolean; // XXX can be converted to flags
  hidden: boolean;
  timestamp: Date;
};
export type PendingActionMessage = {
  method: string;
  args: object;
  attachments?: Attachment[];
};
export type PerceptionMessage = {
  method: string;
  args: object;
  attachments?: Attachment[];
  timestamp: Date;
};
export type AgentActionMessage = {
  agent: AgentObject;
  message: ActionMessage;
};

// memory

export type Memory = {
  text: string;
  embedding: Array<number>;
  content: any;
};

// active agents

export type SubtleAiCompleteOpts = {
  model: string;
};
export type SubtleAiImageOpts = {
  model: string;
  width: number;
  height: number;
  quality: string;
};
export type SubtleAi = {
  context: AppContextValue;
  complete: (
    messages: ChatMessages,
    opts?: SubtleAiCompleteOpts,
  ) => Promise<ChatMessage>;
  completeJson: (
    messages: ChatMessages,
    format: ZodTypeAny,
    opts?: SubtleAiCompleteOpts,
  ) => Promise<ChatMessage>;
  generateImage: (
    prompt: string,
    opts?: SubtleAiImageOpts,
  ) => Promise<Blob>;
};
export type ActionOpts = {
  conversation?: ConversationObject;
};
export type GetMemoryOpts = {
  matchThreshold?: number;
  matchCount?: number;
  signal?: AbortSignal;
};
export type QueueManager = EventTarget & {
  isIdle: () => boolean;
  waitForTurn: (fn: () => Promise<any>) => Promise<void>;
};
export type MultiQueueManager = {
  waitForTurn: (key: string, fn: () => Promise<any>) => Promise<void>;
};
export type Debouncer = EventTarget & {
  isIdle: () => boolean;
  waitForTurn: (fn: () => Promise<any>) => Promise<void>;
};

export type MessageCache = EventTarget & {
  getMessages(): ActionMessage[];
  pushMessage(message: ActionMessage): Promise<void>;
  // prependMessages(messages: ActionMessage[]): Promise<void>;
  trim(): void;
  waitForLoad(): Promise<void>;
};
export type Player = {
  playerId: string;
  playerSpec: object;
  getPlayerSpec(): object;
  setPlayerSpec(playerSpec: object): void;
};
export type GetHashFn = () => string;
export type ConversationObject = EventTarget & {
  agent: ActiveAgentObject;
  agentsMap: Map<string, Player>;
  scene: SceneObject | null;
  getHash: GetHashFn;
  messageCache: MessageCache;
  numTyping: number;

  getCachedMessages: (filter?: MessageFilter) => ActionMessage[];
  /* fetchMessages: (filter?: MessageFilter, opts?: {
    supabase: any,
    signal: AbortSignal,
  }) => Promise<ActionMessage[]>; */

  typing: (handlerAsyncFn: () => Promise<void>) => Promise<void>;
  addLocalMessage: (message: ActionMessage) => Promise<void>;
  addLocalAndRemoteMessage: (message: ActionMessage) => Promise<void>;

  addAudioStream: (audioStream: PlayableAudioStream) => void;

  getScene: () => SceneObject | null;
  setScene: (scene: SceneObject | null) => void;

  getAgent: () => ActiveAgentObject | null;
  // setAgent: (agent: ActiveAgentObject) => void;

  getAgents: () => Player[];
  addAgent: (agentId: string, player: Player) => void;
  removeAgent: (agentId: string) => void;
  getKey: () => string;
  getEmbeddingString: () => string;
};
export type ConversationManager = EventTarget & {
  registry: RenderRegistry;
  conversations: Set<ConversationObject>;
  loadedConversations: WeakMap<ConversationObject, boolean>;
  getConversations: () => ConversationObject[];
  addConversation: (conversation: ConversationObject) => Promise<void>;
  removeConversation: (conversation: ConversationObject) => Promise<void>;
  useDeferRender: (conversation: ConversationObject) => boolean;
  waitForConversationLoad: (conversation: ConversationObject) => Promise<void>;
};
export type RoomSpecification = {
  room: string;
  endpointUrl: string;
};
export type ChatsSpecification = EventTarget & {
  userId: string;
  supabase: any;
  roomSpecifications: RoomSpecification[];
  roomsQueueManager: MultiQueueManager;
  loadPromise: Promise<void>;

  waitForLoad: () => Promise<void>;
  join: (opts: RoomSpecification) => Promise<void>;
  leave: (opts: RoomSpecification) => Promise<void>;
  leaveAll: () => Promise<void>;
};
export type ChatsManager = {
  // members
  agent: ActiveAgentObject;
  chatsSpecification: ChatsSpecification;
  // state
  rooms: Map<string, NetworkRealms>;
  // incomingMessageDebouncer: Debouncer;
  roomsQueueManager: QueueManager;
  abortController: AbortController | null;

  live: () => void;
  destroy: () => void;
};
export type DiscordBot = EventTarget & {
  destroy: () => void;
};
export type DiscordManager = {
  addDiscordBot: (args: DiscordBotArgs) => DiscordBot;
  removeDiscordBot: (client: DiscordBot) => void;
  live: () => void;
  destroy: () => void;
};
export type TelnyxBot = EventTarget & {
  getPhoneNumber: () => string;
  call: (opts: {
    fromPhoneNumber: string,
    toPhoneNumber: string,
  }) => Promise<void>;
  text: (text: string | undefined, mediaUrls: string[] | undefined, opts: {
    fromPhoneNumber: string,
    toPhoneNumber: string,
  }) => Promise<void>;
  destroy: () => void;
};
export type TelnyxManager = EventTarget & {
  getTelnyxBots: () => TelnyxBot[];
  addTelnyxBot: (args: TelnyxBotArgs) => TelnyxBot;
  removeTelnyxBot: (client: TelnyxBot) => void;
  live: () => void;
  destroy: () => void;
};
export type LiveManager = {
  getTimeouts: (conversation: ConversationObject) => number[];
  useTimeouts: (conversation: ConversationObject) => number[];
  setTimeout: (updateFn: () => void, conversation: ConversationObject, timestamp: number) => void;
  process: () => void;
  getNextTimeout: () => number;
};
export type PingManager = {
  userId: string;
  supabase: any;
  interval: any;
  live: () => void;
  destroy: () => void;
};
export type ActiveAgentObject = AgentObject & {
  agentJson: AgentObject;
  appContextValue: AppContextValue;
  registry: AgentRegistry;

  conversationManager: ConversationManager;
  chatsManager: ChatsManager;
  discordManager: DiscordManager;
  telnyxManager: TelnyxManager;
  pingManager: PingManager;
  liveManager: LiveManager;
  generativeAgentsMap: WeakMap<ConversationObject, GenerativeAgentObject>;

  //

  useAuthToken: () => string;
  useSupabase: () => any;

  // useActions: () => Array<ActionProps>;
  // useFormatters: () => Array<FormatterProps>;
  // useName: () => string;
  // usePersonality: () => string;

  useWallets: () => object[];

  useEpoch: (deps: any[]) => void;

  //

  generative: ({
    conversation,
  }: {
    conversation: ConversationObject,
  }) => GenerativeAgentObject;

  getMemories: (opts?: GetMemoryOpts) => Promise<Array<Memory>>;
  getMemory: (query: string, opts?: GetMemoryOpts) => Promise<Array<Memory>>;
  addMemory: (
    text: string,
    content?: any,
  ) => Promise<Memory>;

  live: () => void;
  destroy: () => void;
}

// abstract events

export type PendingMessageEvent<T> = MessageEvent<T> & {
  commit: () => Promise<void>;
};
export type AbortableMessageEvent<T> = MessageEvent<T> & {
  abortController: AbortController;
  abort: () => void;
};

// action events

export type PendingActionEventData = {
  agent: GenerativeAgentObject;
  message: PendingActionMessage;
};
export type PendingActionEvent = PendingMessageEvent<PendingActionEventData>;
export type AbortableActionEvent = AbortableMessageEvent<PendingActionEventData>;
export type ActionEvent = MessageEvent<PendingActionEventData>;

export type LiveTriggerEventData = {
  agent: AgentObject;
  conversation: ConversationObject;
};
export type LiveTriggerEvent = PendingMessageEvent<LiveTriggerEventData>;

export type AgentEventData = {
  agent: AgentObject;
};
export interface AgentEvent extends MessageEvent {
  data: AgentEventData;
}

export type PerceptionEventData = {
  targetAgent: GenerativeAgentObject;
  sourceAgent: AgentObject;
  message: PerceptionMessage;
};
export type PerceptionEvent = MessageEvent<PerceptionEventData>;
export type AbortablePerceptionEvent = AbortableMessageEvent<PerceptionEventData>;

export type ActionMessageEventData = {
  agent: AgentObject;
  message: ActionMessage;
};
export type ActionMessageEvent = ExtendableMessageEvent<ActionMessageEventData>;

export type ConversationChangeEventData = {
  conversation: ConversationObject;
};
export type ConversationChangeEvent = ExtendableMessageEvent<ConversationChangeEventData>;

export type ConversationEventData = {
  conversation: ConversationObject;
};

export type MessageCacheUpdateArgs = null;

export type TaskObject = {
  id: any;
  // name: string;
  // description: string;
  timestamp: Date,
};
export type TaskEventData = {
  agent: ActiveAgentObject;
  task: TaskObject;
};
export type TaskEvent = ExtendableMessageEvent<TaskEventData>;

// scenes

export interface SceneObject extends EventTarget {
  name: string;
  description: string;
}

// props

export type AgentAppProps = {
  children?: ReactNode;
};

export type AgentProps = {
  raw?: boolean;
  children?: ReactNode;
  ref?: Ref<any>;
};
export type RawAgentProps = {
  children?: ReactNode;
  ref?: Ref<any>;
};

export type ConversationProps = {
  children?: ReactNode;
};
export type ConversationInstanceProps = {
  agent: ActiveAgentObject;
  conversation: ConversationObject;
  children?: ReactNode;
  key?: any;
};

export type ActionProps = {
  name: string;
  description: string;
  state?: string;
  schema: ZodTypeAny;
  examples: Array<object>,
  handler?: ((e: PendingActionEvent) => void) | ((e: PendingActionEvent) => Promise<void>);
};
export type ActionPropsAux = ActionProps & {
  conversation: ConversationObject;
};
export type ActionModifierProps = {
  name: string;
  handler: ((e: AbortableActionEvent) => void) | ((e: AbortableActionEvent) => Promise<void>);
  priority?: number;
};
export type ActionModifierPropsAux = ActionModifierProps & {
  conversation: ConversationObject;
};
export type PromptProps = {
  children: ReactNode;
};
export type PromptPropsAux = PromptProps & {
  conversation: ConversationObject;
};
export type PerceptionProps = {
  type: string;
  state?: string;
  handler: ((e: PerceptionEvent) => void) | ((e: PerceptionEvent) => Promise<void>);
};
export type PerceptionPropsAux = PerceptionProps & {
  conversation: ConversationObject;
};
export type PerceptionModifierProps = {
  type: string;
  handler: ((e: AbortablePerceptionEvent) => void) | ((e: AbortablePerceptionEvent) => Promise<void>);
  priority?: number;
};
export type PerceptionModifierPropsAux = PerceptionModifierProps & {
  conversation?: ConversationObject;
};
export type UniformProps = {
  name: string;
  description: string;
  state?: string;
  schema: ZodTypeAny;
  examples: Array<object>,
  handler?: ((e: ActionEvent) => void) | ((e: ActionEvent) => Promise<void>);
};
export type UniformPropsAux = UniformProps & {
  conversation: ConversationObject;
};
export type FormatterProps = {
  schemaFn: (actions: ActionPropsAux[], uniforms: UniformPropsAux[], conversation?: ConversationObject, thinkOpts?: AgentThinkOptions) => ZodTypeAny;
  formatFn: (actions: ActionPropsAux[], uniforms: UniformPropsAux[], conversation?: ConversationObject) => string;
};
export type DeferProps = {
  children: ReactNode;
};
export type DeferPropsAux = DeferProps & {
  conversation?: ConversationObject;
};
export enum TaskResultEnum {
  Schedule = 'schedule',
  Idle = 'idle',
  Done = 'done',
}
export type TaskResult = {
  type: TaskResultEnum;
  args: object;
};
export type TaskProps = {
  // id: any;
  handler: ((e: TaskEvent) => TaskResult) | ((e: TaskEvent) => Promise<TaskResult>);
  onDone?: (e: TaskEvent) => void | Promise<void>;
};

//

export type NameProps = {
  children: string;
};
export type PersonalityProps = {
  children: string;
};

//

export type Currency = 'usd';
export type Interval = 'day' | 'week' | 'month' | 'year';
export type PaymentProps = {
  amount: number;
  currency: Currency;
  name: string;
  description?: string;
  previewUrl?: string;
};
export type SubscriptionProps = {
  amount: number;
  currency: Currency;
  name: string;
  description?: string;
  previewUrl?: string;
  interval: Interval;
  intervalCount: number;
};
export type StoreItemProps = PaymentProps | SubscriptionProps;
export type StoreItem = {
  type: string;
  props: StoreItemProps;
};
export type PaymentItem = StoreItem & {
  stripeConnectAccountId: string;
};

//

export type ServerProps = {
  children: () => void;
};

// contexts

type Compartment = {
  evaluate: (s: string) => any;
};

type Kv = {
  get: <T = any>(key: string, defaultValue?: T | (() => T)) => Promise<T | undefined>;
  set: <T = any>(key: string, value: T | ((oldValue: T | undefined) => T)) => Promise<void>;
  use: <T = any>(key: string, defaultValue?: T | (() => T)) => [T, (value: T | ((oldValue: T | undefined) => T)) => void];
}
type Tts = {
  getVoiceStream: (text: string, opts?: any) => ReadableAudioStream;
  getVoiceConversionStream: (blob: Blob, opts?: any) => ReadableAudioStream;
};

export type Instance = {
  type: string;
  props: any;
  children: InstanceChild[];
  visible: boolean;
  recurse(fn: (instance: Instance) => void): void;
};
export type TextInstance = {
  value: string;
  visible: boolean;
};
export type InstanceChild = Instance | TextInstance;
export type AgentRegistry = {
  prompts: PromptPropsAux[];

  actionsMap: Map<symbol, ActionPropsAux | null>;
  actionModifiersMap: Map<symbol, ActionModifierPropsAux | null>;
  perceptionsMap: Map<symbol, PerceptionPropsAux | null>;
  perceptionModifiersMap: Map<symbol, PerceptionModifierPropsAux | null>;
  uniformsMap: Map<symbol, UniformPropsAux | null>;
  formattersMap: Map<symbol, FormatterProps | null>;
  tasksMap: Map<symbol, TaskProps | null>;

  storeItemsMap: Map<symbol, StoreItem | null>;
  
  namesMap: Map<symbol, NameProps | null>;
  personalitiesMap: Map<symbol, PersonalityProps | null>;
  
  serversMap: Map<symbol, ServerProps | null>;

  get actions(): ActionPropsAux[];
  get actionModifiers(): ActionModifierPropsAux[];
  get perceptions(): PerceptionPropsAux[];
  get perceptionModifiers(): PerceptionModifierPropsAux[];
  get uniforms(): UniformPropsAux[];
  get formatters(): FormatterProps[];
  get tasks(): TaskProps[];
  get names(): NameProps[];
  get personalities(): PersonalityProps[];
  get storeItems(): StoreItem[];
  get servers(): ServerProps[];

  registerAction(key: symbol, action: ActionPropsAux): void;
  unregisterAction(key: symbol): void;
  registerActionModifier(key: symbol, action: ActionModifierPropsAux): void;
  unregisterActionModifier(key: symbol): void;
  registerPerception(key: symbol, perception: PerceptionPropsAux): void;
  unregisterPerception(key: symbol): void;
  registerPerceptionModifier(key: symbol, perception: PerceptionModifierPropsAux): void;
  unregisterPerceptionModifier(key: symbol): void;
  registerFormatter(key: symbol, formatter: FormatterProps): void;
  unregisterFormatter(key: symbol): void;
  registerDefer(key: symbol, defer: DeferPropsAux): void;
  unregisterDefer(key: symbol): void
  registerTask(key: symbol, task: TaskProps): void;
  unregisterTask(key: symbol): void;
  registerName(key: symbol, name: NameProps): void;
  unregisterName(key: symbol): void;
  registerPersonality(key: symbol, personality: PersonalityProps): void;
  unregisterPersonality(key: symbol): void;
  registerPayment(key: symbol, payment: PaymentProps): void;
  unregisterPayment(key: symbol): void;
  registerSubscription(key: symbol, subscription: SubscriptionProps): void;
  unregisterSubscription(key: symbol): void;
  registerServer(key: symbol, server: ServerProps): void;
  unregisterServer(key: symbol): void;
}
export type RenderRegistry = EventTarget & {
  agents: ActiveAgentObject[];
  load(container: Instance): void;
  waitForUpdate(): Promise<void>;
};

export type AppContextValue = {
  subtleAi: SubtleAi;

  useAgentJson: () => object;
  useEnvironment: () => string;
  useWallets: () => object[];
  useAuthToken: () => string;
  useSupabase: () => any;
  useConversationManager: () => ConversationManager;
  useChatsSpecification: () => ChatsSpecification;
  useCodecs: () => any;
  useRegistry: () => RenderRegistry;

  useKv: (opts?: KvArgs) => Kv;
  useTts: (ttsArgs: TtsArgs) => Tts;

  embed: (text: string) => Promise<Array<number>>;
  complete: (
    messages: ChatMessages,
    opts: SubtleAiCompleteOpts,
  ) => Promise<ChatMessage>;
  completeJson: (
    messages: ChatMessages,
    format: ZodTypeAny,
    opts: SubtleAiCompleteOpts,
  ) => Promise<ChatMessage>;
  generateImage: (
    text: string,
    opts: SubtleAiImageOpts,
  ) => Promise<Blob>;
};

// messages

export type AgentFilter = {
  idMatches?: string[],
  capabilityMatches?: string[],
};
export type MessageFilter = {
  agent?: AgentFilter,
  query?: string,
  before?: Date,
  after?: Date,
  limit?: number,
};
export type ActionHistoryQuery = {
  filter?: MessageFilter,
};

// media

export type ReadableAudioStream = ReadableStream & {
  type: string;
  disposition: string;
  waitForLoad: () => Promise<void>;
};
export type PlayableAudioStream = ReadableAudioStream & {
  id: string;
};

export type ReadableVideoStream = ReadableStream & {
  type: string;
  disposition: string;
  waitForLoad: () => Promise<void>;
};
export type PlayableVideoStream = ReadableAudioStream & {
  id: string;
};

// user handler

export type UserHandler = FC;