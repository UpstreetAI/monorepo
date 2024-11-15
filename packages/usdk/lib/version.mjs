import { execSync } from 'child_process';
import pc from 'picocolors';
import packageJson from '../package.json' with { type: 'json' };

// Get the current version
export const version = () => packageJson.version;
// Get the latest version
export function getLatestVersion() {
  try {
    const latestVersion = execSync(`npm show ${packageJson.name} version`).toString().trim();
    return latestVersion;
  } catch (error) {
   // console.log(pc.red('Error checking version. '), error.message);
    console.log(pc.red('Error checking latest usdk version on the registry.'));
  }
}