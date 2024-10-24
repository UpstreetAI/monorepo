import { app, screen, session, BrowserWindow, desktopCapturer } from 'electron';
import { Button, Key, keyboard, mouse, Point } from '@nut-tree-fork/nut-js';

console.log('electron start script!');

// const host = 'https://chat.upstreet.ai';
const host = 'http://localhost:3000';

const createOTP = async (jwt) => {
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
};

const _main = async () => {
  const room = process.argv[2];
  const jwt = process.argv[3];
  const debug = process.argv[4] === '1';

  // console.log('got args', {
  //   room,
  //   jwt,
  //   debug,
  // });

  // wait for the electron app to be ready
  await app.whenReady();

  // create the window
  {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // trade the jwt for an otp auth token
    const authToken = await createOTP(jwt);
    // construct the destination url
    const dstUrl = new URL(`${host}/rooms/${room}`);
    dstUrl.searchParams.set('desktop', 1 + '');
    // construct the final url
    const u = new URL(`${host}/login`);
    u.searchParams.set('auth_token', authToken);
    u.searchParams.set('referrer_url', dstUrl.href);

    // main window
    const win = new BrowserWindow({
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      webPreferences: {
        session: session.fromPartition('login'),
      },
    });
    if (debug) {
      win.webContents.openDevTools();
    }
    win.loadURL(u.href);
  }

  // this will start signal that the electron process has successfully started
  console.log('electron main ready');
};
_main()
  .catch((err) => {
    console.error('error in electron start script', err);
    process.exit(1);
  });