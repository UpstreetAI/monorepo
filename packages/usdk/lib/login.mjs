// import path from 'path';
// import fs from 'fs';
import https from 'https';
import readline from 'readline';

import open from 'open';
// import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import { QueueManager } from '../packages/upstreet-agent/packages/queue-manager/queue-manager.mjs';
import {
  localPort,
  callbackPort,
} from '../util/ports.mjs';
import { getLoginJwt } from '../util/login-util.mjs';
import { makeCorsHeaders, getServerOpts } from '../util/server-utils.mjs';
import { loginLocation } from './locations.mjs';

//

export const login = async (args) => {
  return await new Promise((accept, reject) => {
    let server = null;
    let rl = null;
    const handleLogin = async (j) => {
      // close the server if it's still active
      if (server) {
        server.close();
        server = null;
      }
      // terminate the rl if it's still active
      if (rl) {
        console.log('*ok*');
        rl.close();
      }
  
      const {
        id,
        jwt,
      } = j;
      const loginJson = {
        id,
        jwt,
      };
      accept(loginJson);
    };

    const serverOpts = getServerOpts();
    const requestQueueManager = new QueueManager();
    server = https.createServer(serverOpts, (req, res) => {
      requestQueueManager.waitForTurn(async () => {
        if (server) {
          // console.log('got login response 1', {
          //   method: req.method,
          //   url: req.url,
          // });

          // set cors
          const corsHeaders = makeCorsHeaders(req);
          for (const { key, value } of corsHeaders) {
            res.setHeader(key, value);
          }

          // console.log('got login response 2', {
          //   method: req.method,
          //   url: req.url,
          // });

          // handle methods
          if (req.method === 'OPTIONS') {
            res.end();
          } else if (req.method === 'POST') {
            const bs = [];
            req.on('data', (d) => {
              bs.push(d);
            });
            req.on('end', async () => {
              // respond to the page
              res.end();

              const b = Buffer.concat(bs);
              const s = b.toString('utf8');
              const j = JSON.parse(s);
              await handleLogin(j);
            });
          } else {
            res.statusCode = 405;
            res.end();
          }
        }
      });
    });
    // console.log('starting callback server on port', {
    //   callbackPort,
    // });
    server.on('error', (err) => {
      console.warn('callback server error', err);
    });
    // server.on('close', () => {
    //   console.log('callback server closed');
    // });
    server.listen(callbackPort, '0.0.0.0', (err) => {
      // console.log('callback server listening on port', {
      //   callbackPort,
      // });
      if (err) {
        console.warn(err);
      } else {
        const host = `https://login.upstreet.ai`;
        const u = new URL(`${host}/logintool`);
        u.searchParams.set('callback_url', `https://local.upstreet.ai:${callbackPort}`);
        const p = u + '';
        console.log(`Waiting for login:`);
        console.log(`  ${p}`);

        open(p);

        rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('Paste login code: ', async (input) => {
          // loginCode is a base64 encoded json string
          const loginCode = input.trim();
          if (loginCode) {
            try {
              const decoded = Buffer.from(loginCode, 'base64').toString('utf8');
              const j = JSON.parse(decoded);

              rl.close();
              rl = null;

              await handleLogin(j);
            } catch (e) {
              console.log('invalid login code');
            }
          }
        });
      }
    });
  });
};
export const logout = async (args) => {
  const jwt = await getLoginJwt();

  if (!jwt){
    console.log("No user logged in");
    return;
  }

  await rimraf(loginLocation);
  console.log('Successfully logged out.');
};