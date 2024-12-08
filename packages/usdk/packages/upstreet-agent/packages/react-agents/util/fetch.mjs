import { zodResponseFormat } from 'openai/helpers/zod';
// import Together from 'together-ai';
import { aiProxyHost } from './endpoints.mjs';
import { getAiFetch } from './ai-util.mjs';
import { defaultModel } from '../defaults.mjs';
import { NotEnoughCreditsError } from './error-utils.mjs';

const fetchChatCompletionFns = {
  openai: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');

    const aiFetch = getAiFetch();
    const res = await aiFetch(`https://${aiProxyHost}/api/ai/chat/completions`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        // 'OpenAI-Beta': 'assistants=v1',
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        model,
        messages,
        response_format,
        stream,
      }),
      signal,
    });
    if (res.ok) {
      const j = await res.json();
      const content = j.choices[0].message.content;
      return content;
    } else {
      const text = await res.text();
      throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
    }
  },
  anthropic: async ({ model, max_tokens, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');
    if (response_format) {
      throw new Error('response_format not supported for anthropic');
    }

    const res = await aiFetch(`https://${aiProxyHost}/api/claude/messages`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        model,
        max_tokens,
        messages,
        // response_format,
        stream,
      }),
      signal,
    });
    if (res.ok) {
      const j = await res.json();
      const text = j.content[0].text;
      return text;
    } else {
      const text = await res.text();
      throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
    }
  },
  together: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');

    const togetherEndpointUrl = `https://${aiProxyHost}/api/together`;
    const res = await fetch(`${togetherEndpointUrl}/chat/completions`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        model,
        messages,
        response_format,
        stream,
      }),
      signal,
    });
    if (res.ok) {
      const j = await res.json();
      const content = j.choices[0].message.content;
      return content;
    } else {
      const text = await res.text();
      throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
    }
  },
  lambda: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');

    const lambdaEndpointUrl = `https://${aiProxyHost}/api/lambda`;
    const res = await fetch(`${lambdaEndpointUrl}/chat/completions`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        model,
        messages,
        response_format,
        stream,
      }),
      signal,
    });
    if (res.ok) {
      const j = await res.json();
      const content = j.choices[0].message.content;
      return content;
    } else {
      const text = await res.text();
      throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
    }
  },
  openrouter: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');

    const openrouterEndpointUrl = `https://${aiProxyHost}/api/openrouter`;
    const res = await fetch(`${openrouterEndpointUrl}/chat/completions`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        model,
        messages,
        response_format,
        stream,
      }),
      signal,
    });
    if (res.ok) {
      const j = await res.json();
      const content = j.choices[0].message.content;
      return content;
    } else {
      const text = await res.text();
      throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
    }
  },
};
export const fetchChatCompletion = async ({
  model = defaultModel,
  messages,
  stream = undefined,
  signal = undefined,
}, {
  jwt,
} = {}) => {
  if (!jwt) {
    throw new Error('no jwt');
  }

  const match = model.match(/^(.+?):/);
  if (match) {
    const modelType = match[1];
    const modelName = model.slice(match[0].length);
    const fn = fetchChatCompletionFns[modelType];
    if (fn) {
      const result = await fn({
        model: modelName,
        messages,
        stream,
        signal,
      }, {
        jwt,
      });
      return result;
    } else {
      throw new Error('invalid model type: ' + JSON.stringify(modelType));
    }
  } else {
    if (res.status === 402) {
      throw new NotEnoughCreditsError();
    }
    const text = await res.text();
    throw new Error('invalid status code: ' + res.status + ': ' + text);
  }
};
export const fetchJsonCompletion = async ({
  model = defaultModel,
  messages,
  stream = undefined,
  signal = undefined,
}, format, {
  jwt,
} = {}) => {
  if (!jwt) {
    throw new Error('no jwt');
  }

  const match = model.match(/^(.+?):/);
  if (match) {
    const modelType = match[1];
    const modelName = model.slice(match[0].length);
    const fn = fetchChatCompletionFns[modelType];
    if (fn) {
      const result = await fn({
        model: modelName,
        messages,
        format,
        stream,
        signal,
      }, {
        jwt,
      });
      return result;
    } else {
      throw new Error('invalid model type: ' + JSON.stringify(modelType));
    }
  } else {
    if (res.status === 402) {
      throw new NotEnoughCreditsError();
    }
    const text = await res.text();
    throw new Error('invalid status code: ' + res.status + ': ' + text);
  }
};