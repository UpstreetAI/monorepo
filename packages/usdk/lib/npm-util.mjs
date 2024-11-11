import path from 'path';
import fs from 'fs';
import spawn from 'cross-spawn';

const pnpmPackageJsonPath = import.meta.resolve('pnpm').replace('file://', '');
const pnpmPackageJsonString = fs.readFileSync(pnpmPackageJsonPath, 'utf8');
const pnpmPackageJson = JSON.parse(pnpmPackageJsonString);
const pnpmPath = path.resolve(path.dirname(pnpmPackageJsonPath), pnpmPackageJson.bin.pnpm);

export const npmInstall = async (dstDir) => {
  await new Promise((resolve, reject) => {
    const child = spawn(pnpmPath, ['install'], {
      cwd: dstDir,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pnpm install failed with code ${code}`));
      } else {
        resolve();
      }
    });
  });
};

const getNpmRoot = async () => {
  const { stdout } = await new Promise((resolve, reject) => {
    const child = spawn(pnpmPath, ['root', '--quiet', '-g']);

    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pnpm root failed with code ${code}`));
      } else {
        resolve({ stdout: output });
      }
    });
  });
  return stdout.trim();
};

export const ensureNpmRoot = (() => {
  let npmRootPromise = null;
  return () => {
    if (npmRootPromise === null) {
      npmRootPromise = getNpmRoot();
    }
    return npmRootPromise;
  };
})();