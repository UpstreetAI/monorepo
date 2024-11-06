export const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

export const defaultModels = [
  'openai:gpt-4o-2024-08-06',
  'anthropic:claude-3-5-sonnet-20240620',
  'lambdalabs:hermes-3-llama-3.1-405b-fp8',
  // 'lambdalabs:hermes-3-llama-3.1-405b-fp8-128k',
];

export const defaultVisionModels = [
  'openai:gpt-4o-2024-08-06',
  'anthropic:claude-3-5-sonnet-20240620',
];

export const currencies = ['usd'];
export const intervals = ['month', 'year', 'week', 'day'];

export const consoleImageWidth = 80;

const fallbackTerminalWidth = 24 * 3; // 24 width is too small, use multiplier
const terminalWidth = process.stdout.columns || fallbackTerminalWidth; // fallback to 24 * 3 = 72 in case of stdout.columns is undefined
export const consoleImagePreviewWidth = Math.min(terminalWidth / 2, fallbackTerminalWidth);
