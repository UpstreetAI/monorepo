import { aiProxyHost } from '../endpoints.js';
import { getCleanJwt } from './jwt-util.js';
import { getAiFetch } from './ai-util.js';

const fetchChatCompletionFns = {
  openai: async ({ model, messages, stream, signal }) => {
    const jwt = getCleanJwt();
    if (!jwt) {
      throw new Error('no jwt');
    }
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

        // stop: ['\n'],

        // response_format: {
        //   type: 'json_object',
        // },
        stream,
      }),
      signal,
    });
    return res;
  },
  together: async ({ model, messages, stream, signal }) => {
    // const systemMessages = messages.filter(m => m.role === 'system');
    // const userMessages = messages.filter(m => m.role === 'user');
    // const assistantMessages = messages.filter(m => m.role === 'assistant');
    const prMessages = [];
    for (let i = 0; i < messages.length; i++) {
      let prompt = '';
      while (
        i < messages.length &&
        ['system', 'user'].includes(messages[i].role)
      ) {
        if (prompt) {
          prompt += '\n';
        }
        prompt += messages[i].content;
        i++;
      }

      const nextMessage = messages[i];
      if (nextMessage?.role === 'assistant') {
        const response = nextMessage.content;
        prMessages.push({
          prompt,
          response,
        });
      } else {
        prMessages.push({
          prompt,
          response: null,
        });
      }
    }
    // console.log('pr messages', {messages, prMessages});

    const promptSpec = (() => {
      // 'mistralai/Mistral-7B-Instruct-v0.1',
      // 'NousResearch/Nous-Hermes-Llama2-13b',
      // 'Open-Orca/Mistral-7B-OpenOrca',
      // 'teknium/OpenHermes-2-Mistral-7B',
      // 'Gryphe/MythoMax-L2-13b',

      const formatMessagesInst = (messages) =>
        messages
          .filter((m) => m.prompt && m.response)
          .map(
            (message) =>
              `<s>[INST] ${message.prompt} [/INST] ${message.response}`
          )
          .join('') +
        messages
          .filter((m) => m.prompt && !m.response)
          .map((message) => `<s>[INST] ${message.prompt} [/INST] `)
          .join('');
      const formatMessagesInstruction = (messages) =>
        messages
          .filter((m) => m.prompt && m.response)
          .map(
            (message) =>
              `### Instruction:
${message.prompt}

### Response:
${message.response}
`
          )
          .join('') +
        messages
          .filter((m) => m.prompt && !m.response)
          .map(
            (message) =>
              `### Instruction:
${message.prompt}

### Response:
`
          )
          .join('');
      const formatMessagesIm = (messages) =>
        messages
          .filter((m) => m.prompt && m.response)
          .map(
            (message) =>
              `<|im_start|>user
${message.prompt}
<|im_end|>
<|im_start|>assistant
${message.response}
`
          )
          .join('') +
        messages
          .filter((m) => m.prompt && !m.response)
          .map(
            (message) =>
              `<|im_start|>user
${message.prompt}
<|im_end|>
<|im_start|>assistant
`
          )
          .join('');

      let prompt2;
      let stop;
      switch (model) {
        case 'mistralai/Mixtral-8x7B-Instruct-v0.1': {
          prompt2 = formatMessagesInst(prMessages);
          stop = ['[/INST]', '</s>'];
          break;
        }
        case 'mistralai/Mistral-7B-Instruct-v0.1': {
          prompt2 = formatMessagesInst(prMessages);
          stop = ['[/INST]', '</s>'];
          break;
        }
        case 'mistralai/Mistral-7B-Instruct-v0.2': {
          prompt2 = formatMessagesInst(prMessages);
          stop = ['[/INST]', '</s>'];
          break;
        }
        case 'NousResearch/Nous-Hermes-Llama2-13b': {
          prompt2 = formatMessagesInstruction(prMessages);
          stop = ['###', '</s>'];
          break;
        }
        case 'Open-Orca/Mistral-7B-OpenOrca': {
          prompt2 = formatMessagesIm(prMessages);
          stop = ['<|im_end|>'];
          // stop = ['<|im_end|>', '<|im_start|>'];
          break;
        }
        case 'teknium/OpenHermes-2p5-Mistral-7B': {
          prompt2 = formatMessagesIm(prMessages);
          stop = ['<|im_end|>', '<|im_start|>'];
          break;
        }
        case 'Gryphe/MythoMax-L2-13b': {
          prompt2 = formatMessagesInstruction(prMessages);
          stop = ['</s>'];
          break;
        }
        case 'NousResearch/Nous-Hermes-2-Yi-34B': {
          prompt2 = formatMessagesInstruction(prMessages);
          stop = ['###', '</s>'];
          break;
        }
        default: {
          throw new Error('unknown model: ' + JSON.stringify(model));
        }
      }

      return {
        prompt2,
        stop,
      };
    })();

    const togetherAiTemperature = 0.7;
    const togetherAiMaxTokens = 1024;
    const jwt = getCleanJwt();
    if (!jwt) {
      throw new Error('no jwt');
    }
    const aiFetch = getAiFetch();
    const res = await aiFetch(`https://${aiProxyHost}/api/togetherAi/inference`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        model,
        prompt: promptSpec.prompt2,
        max_tokens: togetherAiMaxTokens,
        stop: promptSpec.stop,
        temperature: togetherAiTemperature,
        // "temperature":0.7,
        // "top_p":0.7,
        // "top_k":50,
        // "repetition_penalty": 1,
        stream_tokens: stream,
      }),
      signal,
    });
    return res;
  },
};
export const fetchChatCompletion = async ({
  model,
  messages,
  stream = undefined,
  signal = undefined,
}) => {
  const match = model.match(/^(.+?):/);
  if (match) {
    const modelType = match[1];
    const modelName = model.slice(match[0].length);
    const fn = fetchChatCompletionFns[modelType];
    if (fn) {
      const res = await fn({
        model: modelName,
        messages,
        stream,
        signal,
      });
      return res;
    } else {
      throw new Error('invalid model type: ' + JSON.stringify(modelType));
    }
  } else {
    throw new Error('invalid model: ' + JSON.stringify(model));
  }
};
export const getAnonUser = async () => {
  const id = crypto.randomUUID();
  // curl -X POST -H "Content-Type: application/json" -d '{"id": "lol"}' https://metamask.upstreet.ai/anon
  const res = await fetch('https://metamask.upstreet.ai/anon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
    }),
  });
  const jwtString = await res.json();
  return jwtString;
};