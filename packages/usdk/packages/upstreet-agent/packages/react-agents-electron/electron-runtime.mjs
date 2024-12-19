import crossSpawn from 'cross-spawn';
import { devServerPort } from './util/ports.mjs';
import { electronBinPath, electronStartScriptPath } from './util/locations.mjs';
import { installAgent } from '../react-agents-node/install-agent.mjs';

//

process.addListener('SIGTERM', () => {
  process.exit(0);
});
const bindProcess = (cp) => {
  process.on('exit', () => {
    // console.log('got exit', cp.pid);
    try {
      process.kill(cp.pid, 'SIGINT');
    } catch (err) {
      // console.warn(err.stack);
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
      reject(new Error(`failed to start process: ${cp.pid}: ${code}`));
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

export class ReactAgentsElectronRuntime {
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
    // console.log('got agent dir', {
    //   dstDir,
    //   wranglerTomlPath,
    // });

    // spawn the wrangler child process
    const cp = crossSpawn(
      electronBinPath,
      [
        electronStartScriptPath,
        'run',
        directory,
        '--',
        // '--var', 'WORKER_ENV:development',
        '--ip', '0.0.0.0',
        '--port', devServerPort + portIndex,
        '--init', JSON.stringify(init),
      ].concat(debug ? [
        '--debug', JSON.stringify(debug),
      ] : []),
      {
        stdio: 'pipe',
        cwd: directory,
      },
    );
    cp.on('exit', (code) => {
      cleanupInstall();
    });
    bindProcess(cp);
    await waitForProcessIo(cp, /electron main ready/i);
    if (debug) {
      cp.stdout.pipe(process.stdout);
      cp.stderr.pipe(process.stderr);
    }
    this.cp = cp;
  }
  // open the frontend
  async open({
    room,
    width,
    height,
    jwt,
    debug,
  }) {
    if (!room) {
      throw new Error('missing room');
    }
    if (!jwt) {
      throw new Error('missing jwt');
    }

    const res = await fetch(`http://127.0.0.1:${devServerPort + this.agentSpec.portIndex}/open`, {
      method: 'POST',
      body: JSON.stringify({
        room,
        jwt,
        width,
        height,
        debug,
      }),
    });
    if (res.ok) {
      const j = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`failed to open frontend: ${res.status}: ${text}`);
    }
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
  }
}