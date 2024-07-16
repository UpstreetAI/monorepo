import { zodToTs, printNode } from 'zod-to-ts';

const codeBlockRegexA = /^[^\n]*?(\{[\s\S]*})[^\n]*?$/
const codeBlockRegexB = /^[\s\S]*?```\S*\s*([\s\S]*?)\s*```[\s\S]*?$/

export const abortError = new Error('aborted');

export function makeId(length) {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function shuffle(array, rng = Math.random) {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(rng() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

export const makePromise = () => {
  let resolve;
  let reject;
  const p = new Promise((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  p.resolve = resolve;
  p.reject = reject;
  return p;
};

export const parseCodeBlock = (content) => {
  const match =
    content.match(codeBlockRegexA) ||
    content.match(codeBlockRegexB);
  if (match) {
    return match[1];
  } else {
    throw new Error(
      'failed to extract JSON from LLM output: ' +
        JSON.stringify(content, null, 2),
    );
  }
};

export const retry = async (fn/*: (() => any) | (() => Promise<any>)*/, numRetries = 5) => {
  for (let i = 0; i < numRetries; i++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      console.warn('retry error', err);
      continue;
    }
  }
  throw new Error(`failed after ${numRetries} retries`);
};

const printZodNode = (z) => {
  let s = printNode(z);
  s = s.replace(/    /g, '  ');
  return s;
};
export const printZodSchema = (schema) => printZodNode(zodToTs(schema).node);