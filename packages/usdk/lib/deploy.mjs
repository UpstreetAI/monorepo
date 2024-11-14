import stream from 'stream';
import https from 'https';
import prettyBytes from 'pretty-bytes';
import pc from 'picocolors';
import {createParser} from 'eventsource-parser'
// import { getLoginJwt } from '../util/login-util.mjs';
import { packZip } from './zip-util.mjs';
import {
  parseAgentSpecs,
} from './agent-spec-utils.mjs';
import {
  deployEndpointUrl,
  workersHost,
} from '../packages/upstreet-agent/packages/react-agents/util/endpoints.mjs';
import {
  getAgentPublicUrl,
} from '../packages/upstreet-agent/packages/react-agents/agent-defaults.mjs';

const getAgentHost = (guid) => `https://user-agent-${guid}.${workersHost}`;
const logSize = (i, total) => {
  process.stdout.write(
    `\r${prettyBytes(i)} / ${prettyBytes(total)} (${((i / total) * 100).toFixed(2)}%)`,
  );
};

/* export const deploy = async (args, opts) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
  if (!agentSpecs.every((agentSpec) => !!agentSpec.directory)) {
    throw new Error('all agent specs must have directories');
  }
  const outputStream = args.outputStream ?? null;
  // opts
  const jwt = opts.jwt;
  if (!jwt) {
    throw new Error('You must be logged in to chat.');
  }

  // deploy the agents
  for (const agentSpec of agentSpecs) {
    const { directory } = agentSpec;

    console.log(pc.italic('Deploying agent...'));

    const uint8Array = await packZip(directory, {
      exclude: [
        /[\/\\]node_modules[\/\\]/, // linux and windows
      ],
    });
    // upload the agent
    const u = `${deployEndpointUrl}/agent`;
    const req = https.request(u, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/zip',
        'Content-Length': uint8Array.byteLength,
      },
    });
    // create a stream to pass to the request
    const dataStream = new stream.PassThrough();
    dataStream.pipe(req);
    // pump the loop
    (async () => {
      const chunkSize = 4 * 1024;
      for (let i = 0; i < uint8Array.byteLength; i += chunkSize) {
        logSize(i, uint8Array.byteLength);
        const slice = Buffer.from(uint8Array.slice(i, i + chunkSize));
        const ok = dataStream.write(slice);
        if (!ok) {
          await new Promise((accept) => {
            dataStream.once('drain', accept);
          });
        }
      }
      dataStream.end();

      logSize(uint8Array.length, uint8Array.byteLength);
      console.log();
    })();
    const wranglerTomlJson = await new Promise((accept, reject) => {
      req.on('response', async (res) => {
        // console.log('got response', res.statusCode);

        const b = await new Promise((accept, reject) => {
          const bs = [];
          res.on('data', (b) => {
            bs.push(b);
          });
          res.on('end', async () => {
            const b = Buffer.concat(bs);
            accept(b);
          });
          res.on('error', reject);
        });
        const s = b.toString('utf8');
        // console.log('got response output', s);

        if (res.statusCode === 200) {
          const j = JSON.parse(s);
          accept(j);
        } else {
          reject(new Error('deploy failed: ' + s));
        }
      });
      req.on('error', reject);
    });
    const agentJsonString = wranglerTomlJson.vars.AGENT_JSON;
    const agentJson = JSON.parse(agentJsonString);
    const guid = agentJson.id;
    const url = getAgentHost(guid);
    
    console.log();
    console.group(pc.green('Agent Deployed Successfully:'), '\n');
    console.log(pc.cyan('✓ Host:'), url, '\n');
    console.log(pc.cyan('✓ Public Profile:'), getAgentPublicUrl(guid), '\n');
    console.log(pc.cyan('✓ Chat using the sdk, run:'), 'usdk chat ' + guid, '\n');
  }
}; */
export const deploy = async (args, opts) => {
  const agentSpecs = await parseAgentSpecs(args._[0]);
  if (!agentSpecs.every((agentSpec) => !!agentSpec.directory)) {
    throw new Error('all agent specs must have directories');
  }

  const outputStream = args.outputStream;

  // opts
  const jwt = opts.jwt;
  if (!jwt) {
    throw new Error('You must be logged in to chat.');
  }

  // deploy the agents
  for (const agentSpec of agentSpecs) {
    const { directory } = agentSpec;

    console.log(pc.italic('Deploying agent...'));

    const uint8Array = await packZip(directory, {
      exclude: [
        /[\/\\]node_modules[\/\\]/, // linux and windows
      ],
    });

    const u = `${deployEndpointUrl}/agent`;
    const req = https.request(u, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/zip',
        'Content-Length': uint8Array.byteLength,
        'Accept': 'text/event-stream',
      },
    });

    // create a stream to pass to the request
    const dataStream = new stream.PassThrough();
    dataStream.pipe(req);
    // pump the loop
    (async () => {
      const chunkSize = 4 * 1024;
      for (let i = 0; i < uint8Array.byteLength; i += chunkSize) {
        logSize(i, uint8Array.byteLength);
        const slice = Buffer.from(uint8Array.slice(i, i + chunkSize));
        const ok = dataStream.write(slice);
        if (!ok) {
          await new Promise((accept) => {
            dataStream.once('drain', accept);
          });
        }
      }
      dataStream.end();

      logSize(uint8Array.length, uint8Array.byteLength);
      console.log();
    })();

    // process the response
    const wranglerTomlJson = await new Promise((accept, reject) => {
      let result = null;
      const parser = createParser({
        onEvent(event) {
          if (event.event === 'log') {
            if (outputStream) {
              const s = JSON.parse(event.data);
              outputStream.write(s);
            }
          } else if (event.event === 'result') {
            const data = JSON.parse(event.data);
            result = data;

            const agentJsonString = data.vars.AGENT_JSON;
            const agentJson = JSON.parse(agentJsonString);
            const guid = agentJson.id;
            const url = getAgentHost(guid);

            console.log();
            console.group(pc.green('Agent Deployed Successfully:'), '\n');
            console.log(pc.cyan('✓ Host:'), url, '\n');
            console.log(pc.cyan('✓ Public Profile:'), getAgentPublicUrl(guid), '\n');
            console.log(pc.cyan('✓ Chat using the sdk, run:'), 'usdk chat ' + guid, '\n');
          } else {
            console.error('unknown event', event);
          }
        }
      });
      req.on('response', async (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          parser.feed(chunk);
        });
        res.on('end', () => {
          if (result) {
            accept(result);
          } else {
            reject(new Error('No result received from server'));
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
    return wranglerTomlJson;
  }
};