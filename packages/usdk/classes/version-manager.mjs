import updateNotifier from 'update-notifier';
import packageJson from '../package.json' with { type: 'json' };

class VersionManager {
  constructor() {
    // Initialize the notifier with package info and options
    this.notifier = updateNotifier({
      pkg: packageJson,
      updateCheckInterval: 1000 * 60 * 60 * 6, // 6 hours in milliseconds
      shouldNotifyInNpmScript: true, // Show notifications in npm scripts
      distTag: process.env.CI ? false : 'latest', // Don't check in CI
    });

    // Perform initial check in background
    this.checkInBackground();
  }

  /**
   * Get the current installed version
   * @returns {string} Current version
   */
  getCurrentVersion() {
    return packageJson.version;
  }

  /**
   * Perform background version check without blocking
   * @private
   */
  checkInBackground() {
    // This runs in an unref'd child process
    this.notifier.notify({
      isGlobal: true,
      boxenOptions: {
        padding: 1,
        margin: 1,
        align: 'center',
        borderColor: 'yellow',
        borderStyle: 'round'
      },
      defer: false,
    });
  }

  /**
   * Force an immediate version check
   * @returns {Promise<{current: string, latest: string, type: string, name: string}|null>}
   */
  async checkNow() {
    try {
      const update = await this.notifier.fetchInfo();
      return update;
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Version check error:', error);
      }
      return null;
    }
  }

  /**
   * Get update information if available
   * @returns {Object|undefined} Update information or undefined if no update
   */
  getUpdateInfo() {
    return this.notifier.update;
  }
}

// Export singleton instance
export const versionManager = new VersionManager();

// Maintain existing API
export const version = () => versionManager.getCurrentVersion();