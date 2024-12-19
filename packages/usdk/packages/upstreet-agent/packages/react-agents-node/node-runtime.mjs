import path from 'path';
import crossSpawn from 'cross-spawn';
import { devServerPort } from './util/ports.mjs';
import { getCurrentDirname} from '../react-agents/util/path-util.mjs'
import { installAgent } from '../react-agents-node/install-agent.mjs';

//

const localDirectory = getCurrentDirname(import.meta, process);

//

process.addListener('SIGTERM', () => {
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

export class ReactAgentsNodeRuntime {
  agentSpec;
  cp = null;
  constructor(agentSpec) {
    this.agentSpec = agentSpec;
  }
  async start({
    init = {},
    debug = 0,
  } = {}) {
    const {
      directory,
      portIndex,
    } = this.agentSpec;

    const {
      agentPath: dstDir,
      wranglerTomlPath,
      cleanup: cleanupInstall,
    } = await installAgent(directory);

    const watcherPath = path.join(localDirectory, 'watcher.mjs');
    const cp = crossSpawn(
      'node',
      [
        '--no-warnings',
        '--experimental-wasm-modules',
        '--experimental-transform-types',
        '--experimental-import-meta-resolve',
        watcherPath,
        'run',
        directory,
        '--',
        '--ip', '0.0.0.0',
        '--port', devServerPort + portIndex,
        '--init', JSON.stringify(init),
      ].concat(debug ? [
        '--debug', JSON.stringify(debug),
      ] : []),
      {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      },
    );
    cp.stdout.pipe(process.stdout);
    cp.stderr.pipe(process.stderr);
    bindProcess(cp);
    const error = (err) => {
      console.warn('node runtime watcher error', err);
    };
    cp.on('error', error);
    const exit = (code) => {
      console.warn('node runtime watcher exit', code);
      cleanup();
    };
    cp.on('exit', exit);
    const message = (e) => {
      const { method, args } = e;
      if (method === 'error') {
        const error = new Error('node runtime watcher error: ' + args[0]);
        console.warn(error.stack);
      }
    };
    cp.on('message', message);
    const cleanup = () => {
      cleanupInstall();
      cp.removeListener('error', error);
      cp.removeListener('exit', exit);
      cp.removeListener('message', message);
    };
    // console.log('node runtime wait 1');
    await new Promise((resolve) => {
      const message = (e) => {
        const { method } = e;
        if (method === 'ready') {
          resolve(null);
          cleanup2();
        }
      };
      cp.on('message', message);
      const cleanup2 = () => {
        cp.removeListener('message', message);
      };
    });
    // console.log('node runtime wait 2');
    this.cp = cp;
  }
  async terminate() {
    await new Promise((accept, reject) => {
      if (this.cp === null) {
        accept(null);
      } else {
        if (this.cp.exitCode !== null) {
          // Process already terminated
          accept(this.cp.exitCode);
        } else {
          // Process is still running
          this.cp.on('exit', (code) => {
            accept(code);
          });
          this.cp.on('error', (err) => {
            reject(err);
          });
          this.cp.kill('SIGTERM');
        }
      }
    });
  }
}