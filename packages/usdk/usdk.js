#!/usr/bin/env -S node --no-warnings --experimental-wasm-modules
import { main } from './cli.js';

// Execute CLI
(async () => {
  try {
    await main();
  } catch (err) {
    console.warn(err.stack);
    process.exit(1);
  }
})();