import path from 'path';
import os from 'os';
import { program } from 'commander';
import { createServer as createViteServer } from 'vite';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { app, screen, session, BrowserWindow, desktopCapturer, ipcMain } from 'electron';
import { WebSocket } from 'ws';
import { Button, Key, keyboard, mouse, Point } from '@nut-tree-fork/nut-js';
import * as debugLevels from '../react-agents/util/debug-levels.mjs';
import { fileURLToPath } from 'url';
import { updateIgnoreMouseEvents } from './lib/updateIgnoreMouseEvents.js';

//

console.log('electron start script!');

const UPDATE_INTERVAL = 1000 / 60;
['uncaughtException', 'unhandledRejection'].forEach(event => {
  process.on(event, err => {
    console.warn(err.stack);
  });
});
process.addListener('SIGTERM', () => {
  process.exit(0);
});

// electron doesn't provide a native WebSocket
// this is needed for needed for the multiplayer library
globalThis.WebSocket = WebSocket;

// agent code

const homeDir = os.homedir();

const loadModule = async (directory, p) => {
  const viteServer = await makeViteServer(directory);
  // console.log('get agent module 1');
  const entryModule = await viteServer.ssrLoadModule(p);
  // console.log('get agent module 2', entryModule);
  return entryModule.default;
};
const startAgentMainServer = async ({
  agentMain,
  ip,
  port,
}) => {
  const app = new Hono();

  let opened = false;
  app.post('/open', async (c) => {
    if (!opened) {
      opened = true;
      
      try {
        const req = c.req.raw;
        const j = await req.json();
        const {
          room,
          width,
          height,
          jwt,
          debug,
        } = j;

        await openFrontend({
          room,
          width,
          height,
          jwt,
          debug,
        });

        return new Response(JSON.stringify({
          ok: true,
        }), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (err) {
        console.warn(err);

        return new Response(JSON.stringify({
          error: err.stack,
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    } else {
      return new Response(JSON.stringify({
        error: 'already opened',
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  });
  app.all('*', (c) => {
    const req = c.req.raw;
    return agentMain.fetch(req);
  });

  // create server
  const server = serve({
    fetch: app.fetch,
    // hostname: ip,
    port: parseInt(port, 10),
  });
  // wait for server to start
  await new Promise((resolve, reject) => {
    server.on('listening', () => {
      resolve(null);
    });
    server.on('error', (err) => {
      reject(err);
    });
  });
  // console.log(`Agent server listening on http://${ip}:${port}`);
};
const runAgent = async (directory, opts) => {
  const {
    ip,
    port,
    init: initString,
  } = opts;
  const init = initString && JSON.parse(initString);
  const debug = parseInt(opts.debug, 10);

  const p = 'entry.mjs';
  const main = await loadModule(directory, p);
  // console.log('worker loaded module', {
  //   directory,
  // });
  const agentMain = await main({
    // directory,
    init,
    debug,
  });
  // console.log('agentMain', agentMain);

  // wait for first render
  // await agentMain.waitForLoad();

  await startAgentMainServer({
    agentMain,
    ip,
    port,
  });
};
const makeViteServer = (directory) => {
  return createViteServer({
    root: directory,
    server: { middlewareMode: 'ssr' },
    cacheDir: path.join(homeDir, '.usdk', 'vite'),
    esbuild: {
      jsx: 'transform',
      // jsxFactory: 'React.createElement',
      // jsxFragment: 'React.Fragment',
    },
    optimizeDeps: {
      entries: [
        './packages/upstreet-agent/packages/react-agents-node/entry.mjs',
      ],
    },
  });
};

// frontend code

// const host = 'https://upstreet.ai';
const host = 'http://127.0.0.1:3000';

/* const createOTP = async (jwt) => {
  const res = await fetch(
    `https://ai.upstreet.ai/api/register-otp?token=${jwt}`,
    {
      method: 'POST',
    },
  );

  if (res.ok) {
    return res.text();
  } else {
    throw new Error('Failed to create a one-time password.');
  }
}; */

// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reactAgentsNodeDirectory = path.join(__dirname, '..', 'react-agents-node');

const openFrontend = async ({
  room,
  debug,
  width,
  height,
  jwt,
}) => {
  // wait for the electron app to be ready
  await app.whenReady();

  // create the window
  {
    const primaryDisplay = screen.getPrimaryDisplay();
    // console.log('primary display', primaryDisplay, primaryDisplay.workAreaSize);
    const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize;

    if (debug >= debugLevels.SILLY) {
      width = displayWidth;
      height = displayHeight;
    } else {
      if (width === undefined) {
        width = 300;
      }
      if (height === undefined) {
        height = 400;
      }
    }

    // trade the jwt for an otp auth token
    // const authToken = await createOTP(jwt);
    // construct the destination url
    const dstUrl = new URL(`${host}/desktop/${room}`);
    dstUrl.searchParams.set('desktop', 1 + '');
    // // construct the final url
    // const u = new URL(`${host}/login`);
    // u.searchParams.set('auth_token', authToken);
    // u.searchParams.set('referrer_url', dstUrl.href);

    // main window
    const win = new BrowserWindow({
      width: width,
      height: height,
      x: displayWidth - width, // Position at right edge
      y: displayHeight - height, // Position at bottom edge
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      titleBarStyle: 'none',
      roundedCorners: false,
      webPreferences: {
        session: session.fromPartition('login'),
        // nodeIntegration: true,
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        enableRemoteModule: false,
      },

      // macOS
      acceptFirstMouse: true,
      hasShadow: false,
    });
    if (debug >= debugLevels.SILLY) {
      win.webContents.openDevTools();
    }

    // set the cookie on the page
    await win.webContents.session.cookies.set({
      url: host,
      name: 'auth-jwt',
      value: jwt,
    });

    setInterval(() => {
      // Allow mouse events to pass through the window.
      updateIgnoreMouseEvents( win )
    }, UPDATE_INTERVAL);

    await win.loadURL(dstUrl.href);
  }
};

// main code

const main = async () => {
  let commandExecuted = false;

  program
    .command('run')
    .description('Run the agent')
    .argument(`[directory]`, `Agent directory`)
    .requiredOption('--ip <ip>', 'IP address to bind to')
    .requiredOption('--port <port>', 'Port to bind to')
    .requiredOption('--init <json>', 'Initialization data')
    .option('-g, --debug [level]', 'Set debug level (default: 0)', '0')
    .action(async (directory, opts) => {
      commandExecuted = true;

      try {
        await runAgent(directory, opts);

        // this will start signal that the electron process has successfully started
        console.log('electron main ready');
      } catch (err) {
        console.warn(err);
        process.exit(1);
      }
    });

  const argv = process.argv.filter((arg) => arg !== '--');
  await program.parseAsync(argv, {
    from: 'electron',
  });

  if (!commandExecuted) {
    console.error('Command missing');
    process.exit(1);
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

//

ipcMain.on('app:quit', (_) => {
  console.log('Shutdown message received');
  app.quit();
})
