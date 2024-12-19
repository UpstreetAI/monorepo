import path from 'path';
import crossSpawn from 'cross-spawn';
import { program } from 'commander';
import { createServer as createViteServer } from 'vite';
import { Debouncer } from 'debouncer';
import { getCurrentDirname } from '../react-agents/util/path-util.mjs';

//

const dirname = getCurrentDirname(import.meta, process);

// watch SIGTERM
process.on('SIGTERM', () => {
  process.exit(0);
});

const bindProcess = (cp) => {
  process.on('exit', () => {
    try {
      process.kill(cp.pid, 'SIGTERM');
    } catch (err) {
      if (err.code !== 'ESRCH') {
        console.warn(err.stack);
      }
    }
  });
};

//

let agentWorkerPromise = null;
const reloadDebouncer = new Debouncer();
let first = true;
const reloadAgentWorker = async (directory, opts) => {
  await reloadDebouncer.waitForTurn(async () => {
    const oldAgentWorkerPromise = agentWorkerPromise;
    agentWorkerPromise = (async () => {
      // wait for the old agent process to terminate
      if (oldAgentWorkerPromise) {
        const oldAgentWorker = await oldAgentWorkerPromise;
        await oldAgentWorker.terminate();
      }

      const workerPath = path.join(dirname, 'worker.mjs');

      // initialize args
      const args = [
        '--no-warnings',
        '--experimental-wasm-modules',
        '--experimental-transform-types',
        '--experimental-import-meta-resolve',
        workerPath,
        'run',
        directory,
        '--',
      ];
      // pass the opts
      if (opts.var) {
        if (Array.isArray(opts.var)) {
          for (const v of opts.var) {
            args.push('--var', v);
          }
        } else {
          args.push('--var', opts.var);
        }
      }
      if (opts.ip) {
        args.push('--ip', opts.ip);
      }
      if (opts.port) {
        args.push('--port', opts.port);
      }
      if (opts.init) {
        args.push('--init', opts.init);
      }
      if (opts.debug) {
        args.push('--debug', opts.debug);
      }

      // create the worker
      let live = true;
      const cp = crossSpawn(process.execPath, args, {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
      cp.stdout.pipe(process.stdout);
      cp.stderr.pipe(process.stderr);
      const exit = (code) => {
        if (live) {
          console.log('agent crashed with status code', code);
        }
        cleanup();
      };
      cp.on('exit', exit);
      const error = (err) => {
        process.send({
          method: 'error',
          args: ['runtime worker error: ' + err.stack],
        });
      };
      cp.on('error', error);
      const message = (e) => {
        const { method, args } = e;
        if (method === 'error') {
          const error = new Error('runtime worker error: ' + args[0]);
          process.send({
            method: 'error',
            args: [error.stack],
          });
        }
      };
      const cleanup = () => {
        cp.removeListener('exit', exit);
        cp.removeListener('error', error);
        cp.removeListener('message', message);
      };
      bindProcess(cp);
      // console.log('wait for ready 1');
      await new Promise((resolve) => {
        const message = (e) => {
          // console.log('watcher got message', e);
          cleanup2();
          resolve(null);
        };
        cp.on('message', message);
        const cleanup2 = () => {
          cp.removeListener('message', message);
        };
      });
      // console.log('wait for ready 2');

      const agentWorker = {
        async terminate() {
          live = false;
          await new Promise((accept, reject) => {
            if (cp.exitCode !== null) {
              // Process already terminated
              accept(cp.exitCode);
            } else {
              // Process is still running
              const exit = (code) => {
                accept(code);
                cleanup();
              };
              cp.on('exit', exit);
              const error = (err) => {
                reject(err);
                cleanup();
              };
              cp.on('error', error);
              const cleanup = () => {
                cp.removeListener('exit', exit);
                cp.removeListener('error', error);
              };
              cp.kill('SIGTERM');
            }
          });
        },
      };

      if (first) {
        first = false;
        process.send({
          method: 'ready',
          args: [],
        });
      }

      return agentWorker;
    })();
    await agentWorkerPromise;
  });
};
const makeViteWatcher = (directory) => {
  return createViteServer({
    root: directory,
    watch: {
      include: [
        './entry.mjs',
      ],
    },
  });
};
const listenForChanges = async (directory, opts) => {
  const viteWatcher = await makeViteWatcher(directory);
  const changeDebouncer = new Debouncer();
  viteWatcher.watcher.on('change', async () => {
    await changeDebouncer.waitForTurn(async () => {
      console.log('reloading agent...');
      await reloadAgentWorker(directory, opts);
      console.log('agent reloaded');
    });
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
    .requiredOption('--init <init>', 'Initialization data')
    .option('-g, --debug [level]', 'Set debug level (default: 0)', '0')
    .action(async (directory, opts) => {
      commandExecuted = true;

      reloadAgentWorker(directory, opts);
      listenForChanges(directory, opts);
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
