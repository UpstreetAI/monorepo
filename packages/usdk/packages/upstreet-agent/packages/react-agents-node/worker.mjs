import path from 'path';
// import fs from 'fs';
import os from 'os';
import { program } from 'commander';
import { createServer as createViteServer } from 'vite';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

//

['uncaughtException', 'unhandledRejection'].forEach(event => {
  process.on(event, err => {
    process.send({
      method: 'error',
      args: [err.stack],
    });
  });
});
process.addListener('SIGTERM', () => {
  process.exit(0);
});

//

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

  const main = await loadModule(directory, 'entry.mjs');
  // console.log('worker loaded module', main);
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

  // console.log('worker send 1');
  process.send({
    method: 'ready',
    args: [],
  });
  // console.log('worker send 2');
};
const makeViteServer = async (directory) => {
  return await createViteServer({
    root: directory,
    server: { middlewareMode: 'ssr' },
    cacheDir: path.join(homeDir, '.usdk', 'vite'),
    // resolve,
    esbuild: {
      jsx: 'transform',
    },
    optimizeDeps: {
      entries: [
        './entry.mjs',
      ],
    },
  });
};

const main = async () => {
  let commandExecuted = false;

  program
    .command('run')
    .description('Run the agent')
    .argument(`[directory]`, `Agent directory`)
    .option('--var <vars...>', 'Environment variables in format KEY:VALUE')
    .requiredOption('--ip <ip>', 'IP address to bind to')
    .requiredOption('--port <port>', 'Port to bind to')
    .requiredOption('--init <json>', 'Initialization data')
    .option('-g, --debug [level]', 'Set debug level (default: 0)', '0')
    .action(async (directory, opts) => {
      commandExecuted = true;

      try {
        await runAgent(directory, opts);
      } catch (err) {
        console.warn(err);
        process.exit(1);
      }
    });

  const argv = process.argv.filter((arg) => arg !== '--');
  await program.parseAsync(argv);

  if (!commandExecuted) {
    console.error('Command missing');
    process.exit(1);
  }
};
main().catch(err => {
  console.error(err);
  process.exit(1);
});
