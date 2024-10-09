import * as _utils from "./utils.js";
export const utils = {
  minFramesForTargetMS: _utils.minFramesForTargetMS,
  arrayBufferToBase64: _utils.arrayBufferToBase64,
  encodeWAV: _utils.encodeWAV
};
export * from "./non-real-time-vad.js";
export * from "./frame-processor.js";
export * from "./messages.js";
export * from "./logging.js";
export * from "./models.js";
export * from "./resampler.js";
