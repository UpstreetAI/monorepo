import fs from 'fs';
import toml from '@iarna/toml';
import {
  // loginLocation,
  wranglerTomlPath,
} from './lib/locations.mjs';

const wranglerTomlString = fs.readFileSync(wranglerTomlPath, 'utf8');
const wranglerToml = toml.parse(wranglerTomlString);
export const env = wranglerToml.vars;