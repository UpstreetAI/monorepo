import path from 'path';
import { createRequire } from 'module';

//

const require = createRequire(import.meta.url);
function walkUpToNodeModules(modulePath) {
  let nodeModulesPath = modulePath;
  while (path.basename(nodeModulesPath) !== 'node_modules') {
    const oldNodeModulesPath = nodeModulesPath;
    nodeModulesPath = path.dirname(nodeModulesPath);
    if (nodeModulesPath === oldNodeModulesPath) {
      throw new Error('could not find node_modules');
    }
  }
  return nodeModulesPath;
}

//

const electronModulePath = require.resolve('electron');
const electronNodeModulesPath = walkUpToNodeModules(electronModulePath);
export const electronBinPath = path.join(electronNodeModulesPath, '.bin', 'electron');

const reactAgentsElectronPath = require.resolve('react-agents-electron');
const reactAgentsElectronDir = path.dirname(reactAgentsElectronPath);
export const electronStartScriptPath = path.join(reactAgentsElectronDir, 'electron-main.mjs');