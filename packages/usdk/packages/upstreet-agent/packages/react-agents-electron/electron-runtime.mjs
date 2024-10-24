import child_process from 'child_process';
import { electronBinPath, electronStartScriptPath } from './util/locations.mjs';
import { cwd } from './util/directory-utils.mjs';

//

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

export class ReactAgentsElectronRuntime {
  room;
  jwt;
  cp = null;
  constructor({
    room,
    jwt,
  }) {
    if (!room || !jwt) {
      throw new Error('invalid args');
    }

    this.room = room;
    this.jwt = jwt;
  }
  async start({
    debug = false,
  } = {}) {
    // spawn the wrangler child process
    const cp = child_process.spawn(
      electronBinPath,
      [
        electronStartScriptPath,
      ]
        .concat([this.room])
        .concat([this.jwt])
        .concat([
          debug ? '1' : '0',
        ]),
      {
        stdio: 'pipe',
        cwd,
      },
    );
    bindProcess(cp);
    console.log('electron runtime wait for process io 1');
    await waitForProcessIo(cp, /electron main ready/i);
    console.log('electron runtime wait for process io 2');
    if (debug) {
      cp.stdout.pipe(process.stdout);
      cp.stderr.pipe(process.stderr);
    }
    this.cp = cp;
  }
  terminate() {
    if (this.cp) {
      this.cp.kill('SIGINT');
    }
  }
}