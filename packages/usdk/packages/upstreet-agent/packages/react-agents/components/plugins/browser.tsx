import React, { useState, useRef, useEffect } from 'react';
import { useAuthToken } from 'react-agents';
import dedent from 'dedent';
import { z, ZodTypeAny } from 'zod';
import { printNode, zodToTs } from 'zod-to-ts';
import type {
  PendingActionEvent,
} from '../../types';
import type { Browser, BrowserContext, Page } from 'playwright-core-lite';
import { createBrowser } from '../../util/create-browser.mjs';
import {
  GenerativeAgentObject,
} from '../../classes/generative-agent-object';
import {
  Action,
} from '../core/action';
import { r2EndpointUrl } from '../../util/endpoints.mjs';
import { webbrowserActionsToText } from '../../util/browser-action-utils.mjs';

//

type AgentBrowser = Browser & {
  // sessionId: string;
  context: BrowserContext,
  destroy: () => Promise<void>;
};
type WebBrowserProps = {
  hint?: string;
  // maxSteps: number;
  // navigationTimeout: number;
};
class BrowserState {
  // sessionId: string;
  browser: AgentBrowser;
  destroySession: () => Promise<void>;
  pages = new Map<string, Page>();
  constructor({
    // sessionId,
    browser,
    destroySession,
  }: {
    // sessionId: string;
    browser: any;
    destroySession: () => Promise<void>;
  }) {
    // this.sessionId = sessionId;
    this.browser = browser;
    this.destroySession = destroySession;
  }
  toJSON() {
    return {
      pages: Array.from(this.pages.keys()),
    };
  }
  async destroy() {
    await this.destroySession();
  }
}
type WebBrowserActionHandlerOptions = {
  args: any;
  agent?: GenerativeAgentObject;
  authToken?: string;
  ensureBrowserState: () => Promise<BrowserState>;
  browserState: BrowserState;
  browserStatePromise: React.MutableRefObject<Promise<BrowserState>>;
};
type WebBrowserActionSpec = {
  method: string;
  description: string;
  schema: ZodTypeAny,
  schemaDefault: () => object,
  handle: (opts: WebBrowserActionHandlerOptions) => Promise<string>;
  toText: (opts: any) => string;
};
type WebBrowserActionObject = {
  method: string;
  args: any;
};
const webbrowserActions: WebBrowserActionSpec[] = [
  {
    method: 'createPage',
    description: 'Create a new browser page.',
    schema: z.object({}),
    schemaDefault: () => ({}),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const browserState = await opts.ensureBrowserState();
      const guid = crypto.randomUUID();
      const contexts = browserState.browser.contexts();
      const context = contexts[0];
      const page = await context.newPage();
      browserState.pages.set(guid, page);
      return JSON.stringify({
        ok: true,
        pageId: guid,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'createPage')?.toText,
  },
  {
    method: 'pageGoto',
    description: 'Navigate to a URL on a page.',
    schema: z.object({
      pageId: z.string(),
      url: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    //   url: z.string().default('https://example.com'),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
      url: 'https://example.com',
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        pageId,
        url,
      } = args as {
        pageId: string;
        url: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      await page.goto(url);

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'pageGoto')?.toText,
  },
  {
    method: 'elementClick',
    description: 'Click on an element with the given text on a page.',
    schema: z.object({
      pageId: z.string(),
      text: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    //   text: z.string().default('Next'),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
      text: 'Next',
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        pageId,
        text,
      } = args as {
        pageId: string;
        text: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      const element = await page.getByText(text);
      if (!element) {
        throw new Error(`Element with text ${text} not found.`);
      }
      await element.click();

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'elementClick')?.toText,
  },
  {
    method: 'pageScreenshot',
    description: 'Screenshot a page and send it as a message attachment.',
    schema: z.object({
      pageId: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
        authToken,
      } = opts;
      const {
        pageId,
      } = args as {
        pageId: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 70,
      });
      console.log('got screenshot', screenshot);
      const blob = new Blob([screenshot], {
        type: 'image/jpeg',
      });

      const guid = crypto.randomUUID();
      const guid2 = crypto.randomUUID();
      const keyPath = ['assets', guid, `screenshot.jpeg`].join('/');
      const u = `${r2EndpointUrl}/${keyPath}`;
      try {
        const res = await fetch(u, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: blob,
        });
        if (res.ok) {
          const screenshotUrl = await res.json();

          const m = {
            method: 'say',
            args: {
              text: '',
            },
            attachments: [
              {
                id: guid2,
                type: blob.type,
                url: screenshotUrl,
              },
            ],
          };
          // console.log('add message', m);
          await agent.addMessage(m);

          return JSON.stringify({
            ok: true,
            screenshotUrl,
          });
        } else {
          const text = await res.text();
          throw new Error(`could not upload media file: ${blob.type}: ${text}`);
        }
      } catch (err) {
        throw new Error('failed to put voice: ' + u + ': ' + err.stack);
      }
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'pageScreenshot')?.toText,
  },
  {
    method: 'pageClose',
    description: 'Close a page.',
    schema: z.object({
      pageId: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   pageId: z.string().default(crypto.randomUUID()),
    // }),
    schemaDefault: () => ({
      pageId: crypto.randomUUID(),
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        pageId,
      } = args as {
        pageId: string;
      };
      const browserState = await opts.ensureBrowserState();
      const page = browserState.pages.get(pageId);
      if (!page) {
        throw new Error(`Page with guid ${pageId} not found.`);
      }
      await page.close();
      browserState.pages.delete(pageId);

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'pageClose')?.toText,
  },
  /* {
    method: 'downloadUrl',
    description: 'Download a file via the browser.',
    schema: z.object({
      url: z.string(),
    }),
    // schemaDefault: () => z.object({
    //   url: z.string().default('https://example.com'),
    // }),
    schemaDefault: () => ({
      url: 'https://example.com',
    }),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        args,
        agent,
      } = opts;
      const {
        url,
      } = args as {
        url: string;
      };
      console.log('download url', {
        url,
      });
      // const browserState = await ensureBrowserState();
      // const page = await browserState.browser.newPage();
      // await page.goto(url);
      // const download = await page.waitForEvent('download');
      // await download.saveAs(download.suggestedFilename);
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'downloadUrl')?.toText,
  }, */
  {
    method: 'cleanup',
    description: 'Close the browser and clean up resources. Perform this as a courtesy when you are done.',
    schema: z.object({}),
    schemaDefault: () => ({}),
    handle: async (opts: WebBrowserActionHandlerOptions) => {
      const {
        // args,
        // agent,
        browserState,
        browserStatePromise,
      } = opts;
      // const browserState = await opts.ensureBrowserState();
      if (browserState) {
        browserState.destroy();
        browserStatePromise.current = null;
      }

      return JSON.stringify({
        ok: true,
      });
    },
    toText: webbrowserActionsToText.find((a: any) => a.method === 'cleanup')?.toText,
  },
];
export const WebBrowser: React.FC<WebBrowserProps> = (props: WebBrowserProps) => {
  // const agent = useAgent();
  const authToken = useAuthToken();
  const hint = props.hint ?? '';

  const [browserState, setBrowserState] = useState<BrowserState | null>(null);
  const browserStatePromise = useRef<Promise<BrowserState>>(null);
  // const randomId = useMemo(() => crypto.randomUUID(), []);

  const actionTypeUnion = z.union(webbrowserActions.map((action) => {
    return z.object({
      method: z.literal(action.method),
      args: action.schema,
    });
  }) as any);
  const examples = webbrowserActions.map((action) => {
    return {
      method: action.method,
      args: action.schemaDefault,
    };
  });

  const ensureBrowserState = async () => {
    if (!browserStatePromise.current) {
      const localPromise = (async () => {
        // console.log('create browser with jwt', authToken);
        const browser = await createBrowser(undefined, {
          jwt: authToken,
        });
        const destroySession = async () => {
          console.log('destroy browser session 1');
          await browser.destroy();
          console.log('destroy browser session 2');
        };
        if (localPromise === browserStatePromise.current) {
          // if we are still the current browser state promise, latch the state
          const browserState = new BrowserState({
            // sessionId: browser.sessionId,
            browser,
            destroySession,
          });
          setBrowserState(browserState);
          return browserState;
        } else {
          // else if we are not the current browser state promise, clean up
          // browser.destroy();
          destroySession();
        }
      })();
      browserStatePromise.current = localPromise;
    }
    return await browserStatePromise.current;
  };

  // latch cleanup
  useEffect(() => {
    if (browserState) {
      return () => {
        browserState.destroy();
      };
    }
  }, [browserState]);

  const browserAction = 'browserAction';
  return (
    <Action
      type={browserAction}
      description={
        dedent`\
          Perform a web browsing action.
        ` + '\n\n' +
        (
          browserState ? (
            dedent`\
              The current browser state is:
              \`\`\`
            ` + '\n' +
            JSON.stringify(browserState, null, 2) + '\n' +
            dedent`\
              \`\`\`
            ` + '\n\n'
          ) : (
            dedent`\
              There are no active browser sessions.
            `
          )
        ) +
        dedent`\
          The allowed methods are:
        ` + '\n\n' +
        JSON.stringify(webbrowserActions.map((action) => {
          return {
            method: action.method,
            description: action.description,
            schema: printNode(zodToTs(action.schema).node),
          };
        }), null, 2) + '\n\n' +
        hint
      }
      schema={actionTypeUnion}
      examples={examples}
      handler={async (e: PendingActionEvent) => {
        const { agent, message } = e.data;
        const webBrowserActionArgs = message.args as WebBrowserActionObject;
        const { method, args } = webBrowserActionArgs;

        const retry = () => {
          agent.act();
        };

        const webbrowserAction = webbrowserActions.find((action) => action.method === method);
        if (webbrowserAction) {
          try {
            let result: any = null;
            let error: (string | undefined) = undefined;
            try {
              const opts = {
                args,
                agent,
                authToken,
                ensureBrowserState,
                browserState,
                browserStatePromise,
              };
              console.log('execute browser action 1', {
                method,
                args,
                opts,
              });
              result = await webbrowserAction.handle(opts);
              console.log('execute browser action 2', {
                method,
                args,
                opts,
                result,
              });
            } catch (err) {
              console.log('got web browser action result', {
                result,
                err,
              }, err.stack);
              error = err.stack;
            }

            /* (async () => {
              console.log('browser test 1');
              const result = await testBrowser({
                jwt: authToken,
              });
              console.log('browser test 2', {
                result,
              });
            })(); */

            // error = 'Web browser functionality is not implemented. Do not retry, it will not work..';

            const m = {
              method: browserAction,
              args: {
                method,
                args,
                error,
                result,
              },
              // attachments?: Attachment[],
            };
            // console.log('add browser action message 1', m);
            await agent.addMessage(m);

            // XXX
            return;

            // console.log('add browser action message 2', m);
            agent.act();
          } catch (err) {
            console.warn('Failed to perform web browser action: ' + err);
            retry();
          }
        } else {
          console.warn('Unknown web browser action method: ' + method);
          retry();
        }
      }}
    />
  )
};