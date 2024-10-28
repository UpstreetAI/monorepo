import React from 'react';
import { useState, useEffect, Component, Fragment, ReactNode } from 'react';
import ReactReconciler from 'react-reconciler';
import {
  ConcurrentRoot,
  DefaultEventPriority,
} from 'react-reconciler/constants'
import {
  SubtleAi,
} from './subtle-ai';
import { AppContext } from '../context';
import type {
  UserHandler,
  InstanceChild,
  ChatsSpecification,
} from '../types';
// import inspect from 'browser-util-inspect';

import { RenderLoader } from './render-loader';
import { QueueManager } from 'queue-manager';
import { makeAnonymousClient } from '../util/supabase-client.mjs';
import { makePromise } from '../util/util.mjs';
import { ConversationManager } from './conversation-manager';
import { AppContextValue } from './app-context-value';
import { getConnectedWalletsFromMnemonic } from '../util/ethereum-utils.mjs';
import {
  RenderRegistry,
  Instance,
  TextInstance,
} from './render-registry';

//

type ChildrenProps = {
  children?: ReactNode,
};
class ErrorBoundary extends Component<
  ChildrenProps,
  {
    hasError: boolean;
  }
> {
  localProps: ChildrenProps;
  state: {
    hasError: boolean,
  } = {
    hasError: false,
  };
  constructor(props: ChildrenProps) {
    super(props);
    this.localProps = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    // console.log('get derived state from error', error);
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.warn('renderer crashed', error, info);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (<></>);
    }

    return this.localProps.children;
  }
}
type AppComponentProps = {
  userRender: UserHandler,
  appContextValue: AppContextValue,
  topLevelRenderPromise: any
}
const AppComponent = ({
  userRender,
  appContextValue,
  topLevelRenderPromise,
}: AppComponentProps) => {
  useEffect(() => {
    topLevelRenderPromise.resolve(null);
  }, [topLevelRenderPromise]);

  const UserRenderComponent = userRender;

  return (
    <ErrorBoundary>
      <AppContext.Provider value={appContextValue}>
        {/* <ConfigurationComponent> */}
          <UserRenderComponent />
        {/* </ConfigurationComponent> */}
      </AppContext.Provider>
    </ErrorBoundary>
  )
};

//

const logError =
  typeof reportError === 'function'
    ? // In modern browsers, reportError will dispatch an error event,
      // emulating an uncaught JavaScript error.
      reportError
    : // In older browsers and test environments, fallback to console.error.
      console.error;

//

const serializeError = (error: Error) => {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
};

const logDetailedError = (errorType: string, error: Error, containerState) => {
  const errorInfo = {
    type: errorType,
    error: serializeError(error),
    containerState: containerState,
    timestamp: new Date().toISOString(),
  };
  console.error('[Reconciler Error]:', JSON.stringify(errorInfo, null, 2));
};

//

export class AgentRenderer {
  env: object;
  userRender: UserHandler;
  chatsSpecification: ChatsSpecification;
  codecs: any;

  registry: RenderRegistry;
  conversationManager: ConversationManager;
  appContextValue: AppContextValue;

  reconciler: any;
  container: any;
  root: any;
  renderLoader: RenderLoader;

  renderPromise: Promise<void> | null = null;
  renderQueueManager: QueueManager;

  constructor({
    env,
    userRender,
    chatsSpecification,
    codecs,
  }: {
    env: object;
    userRender: UserHandler;
    chatsSpecification: ChatsSpecification;
    codecs: any;
  }) {
    // latch arguments
    this.env = env;
    this.userRender = userRender;
    this.chatsSpecification = chatsSpecification;
    this.codecs = codecs;

    // create the app context
    this.registry = new RenderRegistry();
    this.conversationManager = new ConversationManager({
      registry: this.registry,
    });
    const subtleAi = new SubtleAi();
    const useAgentJson = () => {
      const agentJsonString = (env as any).AGENT_JSON as string;
      const agentJson = JSON.parse(agentJsonString);
      return agentJson;
    };
    const usePersonalAssistantJson = () => {
      const personalAssistantJsonString = (env as any).PERSONAL_ASSISTANT_JSON as string;
      const personalAssistantJson = JSON.parse(personalAssistantJsonString);
      return personalAssistantJson;
    };
    const useEnvironment = () => {
      return (env as any).WORKER_ENV as string;
    };
    const useWallets = () => {
      const mnemonic = (env as any).WALLET_MNEMONIC as string;
      const wallets = getConnectedWalletsFromMnemonic(mnemonic);
      return wallets;
    };
    const useAuthToken = () => {
      return (this.env as any).AGENT_TOKEN;
    };
    const useSupabase = () => {
      const jwt = useAuthToken();
      const supabase = makeAnonymousClient(env, jwt);
      return supabase;
    };
    const useConversationManager = () => {
      return this.conversationManager;
    };
    const useChatsSpecification = () => {
      return this.chatsSpecification;
    };
    const useCodecs = () => {
      return this.codecs;
    };
    const useRegistry = () => {
      return this.registry;
    };
    this.appContextValue = new AppContextValue({
      subtleAi,
      agentJson: useAgentJson(),
      personalAssistantJson: usePersonalAssistantJson(),
      environment: useEnvironment(),
      wallets: useWallets(),
      authToken: useAuthToken(),
      supabase: useSupabase(),
      conversationManager: useConversationManager(),
      chatsSpecification: useChatsSpecification(),
      codecs: useCodecs(),
      registry: useRegistry(),
    });

    // run the module to get the result
    let currentUpdatePriority = DefaultEventPriority;
    const opts = {
      supportsMutation: true,
      isPrimaryRenderer: true,
      getRootHostContext: () => {
        return {};
      },
      getChildHostContext: (parentHostContext: any, type: string, rootContainer: any) => {
        return parentHostContext;
      },
      getCurrentEventPriority: () => {
        return DefaultEventPriority;
      },
      resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,
      getCurrentUpdatePriority: () => currentUpdatePriority,
      setCurrentUpdatePriority: (newPriority: number) => {
        currentUpdatePriority = newPriority;
      },
      maySuspendCommit: (type: string, props: object) => {
        return false;
      },
      startSuspendingCommit: () => {},
      waitForCommitToBeReady: () => null,
      prepareForCommit: () => {
        // console.log('prepare for commit');
        return null;
      },
      resetAfterCommit: () => {
        // console.log('reset after commit');
        this.registry.load(this.container);
        // console.log('registry updated:', Array.from(this.registry.agents.values()));
        // console.log('registry updated:', inspect(Array.from(this.registry.agents.values()), {
        //   depth: 3,
        // }));
      },
      scheduleTimeout: setTimeout,
      cancelTimeout: clearTimeout,
      clearContainer: (container: any) => {
        // console.log('clear container', [container]);
        container.children.length = 0;
      },
      createInstance(type: string, props: object, rootContainer: any, hostContext: any, internalHandle: any) {
        // console.log('create instance', [type, props]);
        return new Instance(type, props);
      },
      createTextInstance: (text: string, rootContainer: any, hostContext: any, internalHandle: any) => {
        // console.log('create text instance', [text]);
        return new TextInstance(text);
      },
      appendInitialChild: (parent: Instance, child: InstanceChild) => {
        parent.children.push(child);
      },
      finalizeInitialChildren: (instance: Instance, type: string, props: object, rootContainer: any, hostContext: any) => {
        return false;
      },
      commitUpdate: (instance: Instance, type: string, oldProps: object, newProps: object, internalHandle: any) => {
        // console.log('commit update', [type, oldProps, newProps]);
        instance.type = type;
        instance.props = newProps;
      },
      shouldSetTextContent: (type: string, props: object) => {
        return false;
      },
      hideInstance: (instance: Instance) => {
        instance.visible = false;
      },
      unhideInstance: (instance: Instance) => {
        instance.visible = true;
      },
      hideTextInstance: (textInstance: TextInstance) => {
        textInstance.visible = false;
      },
      unhideTextInstance: (textInstance: TextInstance) => {
        textInstance.visible = true;
      },
      detachDeletedInstance: (instance: Instance) => {
        // console.log('detach deleted instance', [instance]);
      },
      appendChild: (container: Instance, child: InstanceChild) => {
        container.children.push(child);
      },
      appendChildToContainer: (container: Instance, child: InstanceChild) => {
        container.children.push(child);
      },
      insertBefore: (parent: Instance, child: InstanceChild, beforeChild: InstanceChild) => {
        const index = parent.children.indexOf(beforeChild);
        parent.children.splice(index, 0, child);
      },
      insertInContainerBefore: (container: Instance, child: InstanceChild, beforeChild: InstanceChild) => {
        const index = container.children.indexOf(beforeChild);
        container.children.splice(index, 0, child);
      },
      removeChild: (parent: Instance, child: InstanceChild) => {
        const index = parent.children.indexOf(child);
        parent.children.splice(index, 1);
      },
      removeChildFromContainer: (container: Instance, child: InstanceChild) => {
        const index = container.children.indexOf(child);
        container.children.splice(index, 1);
      },
    };
    const reconciler = ReactReconciler(opts);
    this.reconciler = reconciler;
    this.container = new Instance('container');
    const root = reconciler.createContainer(
      this.container, // containerInfo
      ConcurrentRoot, // tag
      null, // hydrationCallbacks
      env['WORKER_ENV'] !== 'production', // isStrictMode
      null, // concurrentUpdatesByDefaultOverride
      '', // identifierPrefix
      (error: Error) => logDetailedError('Recoverable Error', error, this.container),
      null // transitionCallbacks
    );
    this.root = root;
    this.renderLoader = new RenderLoader();

    this.renderQueueManager = new QueueManager();
  }

  // rendering

  async renderProps(props: any) {
    props.topLevelRenderPromise = makePromise();
    this.renderLoader.clear();
    this.renderLoader.useLoad(props.topLevelRenderPromise);

    await new Promise((accept, reject) => {
      const element = (
        <AppComponent
          {...props}
        />
      );
      this.reconciler.updateContainer(element, this.root, null, () => {
        accept(null);
      });
    });

    await this.renderLoader.waitForLoad();
  }
  async render() {
    const {
      userRender,
      appContextValue,
    } = this;

    const props = {
      userRender,
      appContextValue,
      topLevelRenderPromise: null,
    };
    try {
      await this.renderProps(props);
    } catch (error) {
      logDetailedError('Error during render', error, this.container);
      throw error;
    }
  }

  // note: needs to be async to wait for React to resolves
  // this is used to e.g. fetch the chat history in user code
  async waitForRender() {
    if (!this.renderPromise) {
      this.renderPromise = this.render();
    }
    await this.renderPromise;
  }
  async ensureRegistry() {
    await this.waitForRender();
    return this.registry;
  }
}