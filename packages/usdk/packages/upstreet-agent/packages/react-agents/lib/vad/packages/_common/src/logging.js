export const LOG_PREFIX = "[VAD]";
const levels = ["error", "debug", "warn"];
function getLog(level) {
  return (...args) => {
    console[level](LOG_PREFIX, ...args);
  };
}
const _log = levels.reduce((acc, level) => {
  acc[level] = getLog(level);
  return acc;
}, {});
export const log = _log;
