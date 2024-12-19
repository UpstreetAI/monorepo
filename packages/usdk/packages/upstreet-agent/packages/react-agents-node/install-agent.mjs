import path from 'path';
import fs from 'fs';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import toml from '@iarna/toml';
import { getCurrentDirname } from '../react-agents/util/path-util.mjs';
import { makeId } from 'react-agents/util/util.mjs';

const dirname = getCurrentDirname(import.meta, process);
const copyWithStringTransform = async (src, dst, transformFn = (s) => s) => {
  let s = await fs.promises.readFile(src, 'utf8');
  s = transformFn(s);
  await mkdirp(path.dirname(dst));
  await fs.promises.writeFile(dst, s);
};
const buildWranglerToml = (
  t,
  opts = {},
) => {
  for (const k in opts) {
    t[k] = opts[k];
  }
  return t;
};

const upstreetAgentDir = path.join(dirname, '..', '..');

export const installAgent = async (directory) => {
  const packageJson = JSON.parse(await fs.promises.readFile(path.join(upstreetAgentDir, 'package.json'), 'utf8'));
  const dependencies = Object.keys(packageJson.dependencies);

  const agentJsonString = await fs.promises.readFile(path.join(directory, 'agent.json'), 'utf8');
  const agentJson = JSON.parse(agentJsonString);

  const srcNodeModules = path.join(upstreetAgentDir, 'node_modules');
  const dstNodeModules = path.join(directory, 'node_modules');
  await mkdirp(dstNodeModules);

  const srcEntryJs = path.join(upstreetAgentDir, 'packages', 'react-agents-node', 'entry.mjs');
  const dstEntryJs = path.join(directory, 'entry.mjs');

  const srcMainJsx = path.join(upstreetAgentDir, 'main.jsx');
  const dstMainJsx = path.join(directory, 'main.jsx');

  const srcDurableObjectTsx = path.join(upstreetAgentDir, 'durable-object.tsx');
  const dstDurableObjectTsx = path.join(directory, 'durable-object.tsx');

  const srcWranglerToml = path.join(upstreetAgentDir, 'wrangler.toml');
  const dstWranglerToml = path.join(directory, `wrangler.toml`);

  const agentPath = directory;

  // remove old dependencies in node_modules
  const removeDependencies = async () => {
    await Promise.all(dependencies.map(async (name) => {
      const d = path.dirname(name);
      if (d !== '.') { // has /
        // remove the directory
        await rimraf(path.join(dstNodeModules, d));
      } else {
        const dst = path.join(dstNodeModules, name);
        await rimraf(dst);
      }
    }));
  };
  await removeDependencies();

  // symlink node_modules deps
  const addDependencies = async () => {
    await Promise.all(dependencies.map(async (name) => {
      const d = path.dirname(name);
      if (d !== '.') { // has /
        // precreate the directory
        await mkdirp(path.join(dstNodeModules, d));
      }
      const src = path.join(srcNodeModules, name);
      const dst = path.join(dstNodeModules, name);
      await fs.promises.symlink(src, dst);
    }));
  };
  await addDependencies();

  // add new files
  await Promise.all([
    // wrangler.toml
    copyWithStringTransform(srcWranglerToml, dstWranglerToml, (s) => {
      let t = toml.parse(s);
      t = buildWranglerToml(t, {
        name: agentJson.id,
        // main: `.agents/${name}/main.jsx`,
        // main: `main.jsx`,
      });
      return toml.stringify(t);
    }),
    // main.jsx
    copyWithStringTransform(srcMainJsx, dstMainJsx),
    // durable-object.tsx
    copyWithStringTransform(srcDurableObjectTsx, dstDurableObjectTsx),
    // entry.mjs
    copyWithStringTransform(srcEntryJs, dstEntryJs),
  ]);

  const cleanup = async () => {
    await Promise.all([
      rimraf(dstWranglerToml),
      rimraf(dstMainJsx),
      rimraf(dstDurableObjectTsx),
      rimraf(dstEntryJs),
      removeDependencies(),
    ]);
  };

  return {
    agentPath,
    entryJsPath: dstEntryJs,
    wranglerTomlPath: dstWranglerToml,
    cleanup,
  };
};