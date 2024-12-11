import { zodResponseFormat } from 'openai/helpers/zod';
import dedent from 'dedent';
// import Together from 'together-ai';
import { aiProxyHost } from './endpoints.mjs';
// import { getAiFetch } from './ai-util.mjs';
import { defaultModel } from '../defaults.mjs';
import { NotEnoughCreditsError } from './error-utils.mjs';
import zodToJsonSchemaImpl from 'zod-to-json-schema';

const jsonParse = (s) => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
};
const jsonSchemaToTools = (jsonSchema) => {
  return jsonSchema.properties.action.anyOf.map(schema => {
    const { type } = schema;
    if (type === 'object') {
      const name = schema.properties.method.const;
      const description = schema.description || `Execute the ${name} action`;
      const parameters = schema.properties.args;
      let result = {
        name,
        description,
        parameters,
      };
      return result;
    } else {
      return null;
    }
  }).filter(Boolean);
};
const toolsToOpenai = (tools) => {
  return tools.map(tool => {
    return {
      type: 'function',
      function: tools,
    };
  });
};
const toolsToAnthropic = (tools) => {
  return tools.map(tool => {
    const {
      name,
      description,
      parameters,
    } = tool;
    return {
      name,
      description,
      input_schema: parameters,
    };
  });
};

const fetchChatCompletionFns = {
  openai: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');

    // const aiFetch = getAiFetch();
    const res = await fetch(`https://${aiProxyHost}/api/ai/chat/completions`, {
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
      let content = j.choices[0].message.content;
      if (format) {
        content = JSON.parse(content);
      }
      return content;
    } else {
      const text = await res.text();
      throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
    }
  },
  anthropic: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const o = {
      model,
      messages,
      // response_format,
      stream,
      // max_tokens: 8192, // maximum allowed for claude
      max_tokens: 2000,
    };

    const jsonSchema = zodToJsonSchemaImpl(format);
    // console.log('got json schema', JSON.stringify(jsonSchema, null, 2));
    let tools = jsonSchemaToTools(jsonSchema);
    tools = toolsToAnthropic(tools);
    tools = tools.concat([
      {
        name: 'nothing',
        description: 'Do nothing',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ]);
    o.tools = tools;
    o.tool_choice = {
      type: 'any',
    };

    const numRetries = 3;
    let i;
    let err = null;
    for (let i = 0; i < numRetries; i++) {
      const res = await fetch(`https://${aiProxyHost}/api/anthropic/messages`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },

        body: JSON.stringify(o),
        signal,
      });
      if (res.ok) {
        const j = await res.json();
        // console.log('got anthropic response', JSON.stringify(j, null, 2));
        const toolJson = j.content[0];
        // extract the content
        const method = toolJson.name;
        const args = toolJson.input;
        let content;
        // handle null action
        if (method !== 'nothing') {
          content = {
            action: {
              method,
              args,
            },
          };
        } else {
          content = null;
        }
        // console.log('got content', JSON.stringify(content, null, 2));
        // check the parse
        if (content !== null) {
          try {
            content = format.parse(content);
          } catch (e) {
            err = e;
            continue;
          }
        }
        return content;
      } else {
        const text = await res.text();
        throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
      }
    }
    // if (i === numRetries) {
      throw new Error('too many retries: ' + err.stack);
    // }
  },
  /* together: async ({ model, messages, format, stream, signal }, {
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
  lambdalabs: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const response_format = format && zodResponseFormat(format, 'result');

    const lambdaEndpointUrl = `https://${aiProxyHost}/api/lambdalabs`;
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
  }, */
  openrouter: async ({ model, messages, format, stream, signal }, {
    jwt,
  }) => {
    if (!jwt) {
      throw new Error('no jwt');
    }

    const o = {
      model,
      messages,
      stream,
    };
    const mode = (() => {
      if (format) {
        if (/hermes-3/.test(model)) {
          return 'prompt';
        } else {
          return 'structuredOutput';
        }
      } else {
        return 'none';
      }
    })();
    switch (mode) {
      case 'prompt': {
        const jsonSchema = zodToJsonSchemaImpl(format);
        // console.log('got json schema', JSON.stringify(jsonSchema, null, 2));
        o.messages = messages.slice().concat([
          {
            role: 'user',
            content: dedent`\
              Your output must match the following JSON schema:
              \`\`\`
            ` + '\n' + JSON.stringify(jsonSchema, null, 2) + '\n' + dedent`\
              \`\`\`
            `,
          },
        ]);
        o.response_format = 'json';
        // process.exit(1);
        break;
      }
      case 'tool': {
        const jsonSchema = zodToJsonSchemaImpl(format);
        let tools = jsonSchemaToTools(jsonSchema);
        tools = toolsToOpenai(tools);
        // console.log('got json schema', tools);
        o.tools = tools;
        o.tool_choice = 'required';
        break;
      }
      case 'structuredOutput': {
        const response_format = format && zodResponseFormat(format, 'result');
        o.response_format = response_format;
        break;
      }
    }

    const numRetries = 3;
    let i;
    let err = null;
    for (i = 0; i < numRetries; i++) {
      const openrouterEndpointUrl = `https://${aiProxyHost}/api/openrouter`;
      const u = `${openrouterEndpointUrl}/chat/completions`;
      const res = await fetch(u, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },

        body: JSON.stringify(o),
        signal,
      });
      if (res.ok) {
        const j = await res.json();
        // console.log('got response content', JSON.stringify(j, null, 2));
        const contentString = j.choices[0].message.content;
        if (mode === 'prompt') {
          let content = jsonParse(contentString);
          // try to parse with the zod schema, format
          // try {
          if (content !== null) {
            try {
              content = format.parse(content);
            } catch (e) {
              err = e;
              continue;
            }
          }
          // } catch (e) {
          //   console.error('error parsing content with zod schema', e);
          // }
          return content;
        } else {
          return contentString;
        }
      } else {
        const text = await res.text();
        throw new Error('error response in fetch completion: ' + res.status + ': ' + text);
      }
    }
    // if (i === numRetries) {
      throw new Error('too many retries: ' + err.stack);
    // }
  },
};

//

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

  const match = model.match(/^([^:]+?):/);
  if (match) {
    const modelType = match[1];
    const modelName = model.slice(modelType.length + 1);
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

  const match = model.match(/^([^:]+?):/);
  if (match) {
    const modelType = match[1];
    const modelName = model.slice(modelType.length + 1);
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