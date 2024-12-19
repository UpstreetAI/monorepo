import path from 'path';
import fs from 'fs';
import crossSpawn from 'cross-spawn';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
// import toml from '@iarna/toml';
import { wranglerBinPath } from './util/locations.mjs';
import { devServerPort } from './util/ports.mjs';
import { getCurrentDirname } from '../react-agents/util/path-util.mjs';
// import { recursiveCopyAll } from '../../../../util/copy-utils.mjs';
import { installAgent } from '../react-agents-node/install-agent.mjs';

//

const dirname = getCurrentDirname(import.meta, process);
const copyWithStringTransform = async (src, dst, transformFn = (s) => s) => {
  let s = await fs.promises.readFile(src, 'utf8');
  s = transformFn(s);
  await mkdirp(path.dirname(dst));
  await fs.promises.writeFile(dst, s);
};
process.addListener('SIGTERM', () => {
  process.exit(0);
});
const bindProcess = (cp) => {
  process.on('exit', () => {
    // console.log('got exit', cp.pid);
    try {
      process.kill(cp.pid, 'SIGTERM');
    } catch (err) {
      if (err.code !== 'ESRCH') {
        console.warn(err.stack);
      }
    }
  });
};
const waitForProcessIo = async (cp, matcher, timeout = 60 * 1000) => {
  const matcherFn = (() => {
    if (typeof matcher === 'string') {
      const s = matcher;
      return (s2) => s2.includes(s);
    } else if (matcher instanceof RegExp) {
      const re = matcher;
      return (s) => re.test(s);
    } else {
      throw new Error('invalid matcher');
    }
  })();
  await new Promise((resolve, reject) => {
    const bs = [];
    const onData = (d) => {
      bs.push(d);
      const s = Buffer.concat(bs).toString('utf8');
      if (matcherFn(s)) {
        cp.stdout.removeListener('data', onData);
        cp.stdout.removeListener('end', onEnd);
        clearTimeout(timeoutId);
        resolve(null);
      }
    };
    cp.stdout.on('data', onData);

    const bs2 = [];
    const onData2 = (d) => {
      bs2.push(d);
    };
    cp.stderr.on('data', onData2);

    const getDebugOutput = () =>
      Buffer.concat(bs).toString('utf8') +
      '\n' +
      Buffer.concat(bs2).toString('utf8')

    const onEnd = () => {
      reject(
        new Error('process ended without matching output: ' + getDebugOutput()),
      );
    };
    cp.stdout.on('end', onEnd);

    cp.on('exit', (code) => {
      reject(new Error(`failed to get start process: ${cp.pid}: ${code}`));
    });

    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          'timeout waiting for process output: ' +
            JSON.stringify(cp.spawnfile) +
            ' ' +
            JSON.stringify(cp.spawnargs) +
            ' ' +
            getDebugOutput(),
        ),
      );
    }, timeout);
  });
};

//

const buildWranglerToml = (
  t,
  opts = {},
) => {
  for (const k in opts) {
    t[k] = opts[k];
  }
  return t;
};

export class ReactAgentsWranglerRuntime {
  agentSpec;
  dstDir = null;
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

    // spawn the wrangler child process
    const cp = crossSpawn(
      wranglerBinPath,
      [
        'dev',
        '-c', wranglerTomlPath,
        '--var', 'WORKER_ENV:development',
        '--ip', '0.0.0.0',
        '--port', devServerPort + portIndex,
      ].concat(init ? [
        '--var', `init:${JSON.stringify(init)}`,
      ]: [])
      .concat(debug ? [
        '--var', `debug:${JSON.stringify(debug)}`,
      ]: []),
      {
        stdio: 'pipe',
        cwd: dstDir,
      },
    );
    cp.on('exit', (code) => {
      cleanupInstall();
    });
    bindProcess(cp);
    await waitForProcessIo(cp, /ready on /i);
    if (debug) {
      cp.stdout.pipe(process.stdout);
      cp.stderr.pipe(process.stderr);
    }
    this.cp = cp;
  }
  async terminate() {
    await new Promise((accept, reject) => {
      const { cp } = this;
      if (cp === null) {
        accept(null);
      } else {
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
      }
    });

    // clean up the temporary directory
    await rimraf(this.dstDir);
  }
}