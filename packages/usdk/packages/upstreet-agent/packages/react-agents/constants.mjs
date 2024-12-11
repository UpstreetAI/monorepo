export const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

export const defaultModels = [
  'openai:gpt-4o-2024-08-06',
  'anthropic:claude-3-5-sonnet-20240620',
  'openrouter:nousresearch/hermes-3-llama-3.1-405b',
  'openrouter:nousresearch/hermes-3-llama-3.1-70b',
];
export const defaultSmallModels = [
  'openai:gpt-4o-mini',
];
export const defaultLargeModels = [
  'openai:o1-preview',
];

export const defaultVisionModels = [
  'openai:gpt-4o-2024-08-06',
  'anthropic:claude-3-5-sonnet-20240620',
];

export const currencies = ['usd'];
export const intervals = ['month', 'year', 'week', 'day'];

export const consoleImageWidth = 80;
export const consoleImagePreviewWidth = 24*2;

export const SUPABASE_URL = "https://friddlbqibjnxjoxeocc.supabase.co";
export const SUPABASE_PUBLIC_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaWRkbGJxaWJqbnhqb3hlb2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDM2NjE3NDIsImV4cCI6MjAxOTIzNzc0Mn0.jnvk5X27yFTcJ6jsCkuXOog1ZN825md4clvWuGQ8DMI";

