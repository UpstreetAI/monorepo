import dedent from 'dedent';
import { z } from 'zod';
import {
  Interactor,
} from '../../../../../lib/interactor.js';
import {
  ValueUpdater,
} from '../../../../../lib/value-updater.js';
import {
  generateCharacterImage,
  generateBackgroundImage,
} from './generate-image.mjs';
import { makePromise, uploadBlob } from './util.mjs';
import {
  featureSpecs,
} from './agent-features.mjs';

const processFeatures = (agentJson) => {
  const userSpecifiedFeatures = new Set(Object.keys(agentJson.features || {}));
  const validFeatures = new Set(featureSpecs.map(spec => spec.name));

  // Check for invalid user-specified features and throw an error if any are found
  for (const feature of userSpecifiedFeatures) {
    if (!validFeatures.has(feature)) {
      throw new Error(`Invalid features specified: ${feature}`);
    }
  }

  // allow the agent interview to possibly utilise all if no features are specified
  const allowAll = userSpecifiedFeatures.size === 0;

  const result = {};
  for (const featureSpec of featureSpecs) {
    const { name, schema } = featureSpec;
    if (allowAll || userSpecifiedFeatures.has(name)) {
      result[name] = schema.optional();
    }
  }


  // console.log('process features', {
  //   result,
  //   userSpecifiedFeatures,
  //   allowAll,
  // });

  return {
    result,
    userSpecifiedFeatures,
    allowAll,
  };
};

// Generate feature prompt
const generateFeaturePrompt = (featureSpecs, userSpecifiedFeatures, allowAll) => {
  const prompt =  allowAll ? (
    dedent`\
      The available features are:
    ` + '\n' +
    featureSpecs.map(({ name, description }) => {
      return `# ${name}\n${description}`;
    }).join('\n') + '\n\n'
  ) : (
    dedent`\
      The agent is given the following features:
    ` + '\n' +
    Array.from(userSpecifiedFeatures).map(feature => {
      const spec = featureSpecs.find(spec => spec.name === feature);
      return spec ? `# ${spec.name}\n${spec.description}` : `# ${feature}\nDescription not available.`;
    }).join('\n') + '\n\n'
  );

  // console.log('feature prompt', prompt);
  return prompt;
};

export class AgentInterview extends EventTarget {
  constructor(opts) {
    super();

    let {
      agentJson, // object
      prompt, // string
      mode, // 'auto' | 'interactive' | 'manual'
      jwt,
    } = opts;

    const { result: featureSchemas, userSpecifiedFeatures, allowAll } = processFeatures(agentJson);

    // generate the feature prompt
    const featurePrompt = generateFeaturePrompt(featureSpecs, userSpecifiedFeatures, allowAll);

    // character image generator
    const visualDescriptionValueUpdater = new ValueUpdater(async (visualDescription, {
      signal,
    }) => {
      const {
        blob,
      } = await generateCharacterImage(visualDescription, undefined, {
        jwt,
      });
      return blob;
    });
    visualDescriptionValueUpdater.addEventListener('change', async (e) => {
      this.dispatchEvent(new MessageEvent('preview', {
        data: e.data,
      }));
    });

    // homespace image generator
    const homespaceDescriptionValueUpdater = new ValueUpdater(async (homespaceDescription, {
      signal,
    }) => {
      const {
        blob,
      } = await generateBackgroundImage(undefined, homespaceDescription, {
        jwt,
      });
      return blob;
    });
    homespaceDescriptionValueUpdater.addEventListener('change', async (e) => {
      this.dispatchEvent(new MessageEvent('homespace', {
        data: e.data,
      }));
    });

    const pumpIo = (response = '') => {
      this.dispatchEvent(new MessageEvent('input', {
        data: {
          question: response,
        },
      }));
    };
    const sendOutput = (text) => {
      this.dispatchEvent(new MessageEvent('output', {
        data: {
          text,
        },
      }));
    };
    this.loadPromise = makePromise();

    // initialize
    if (agentJson.previewUrl) {
      visualDescriptionValueUpdater.setResult(agentJson.previewUrl);
    }
    if (agentJson.homespaceUrl) {
      homespaceDescriptionValueUpdater.setResult(agentJson.homespaceUrl);
    }

    // interaction loop
    this.interactor = new Interactor({
      prompt: dedent`\
          Generate and configure an AI agent character.
          \`name\`, \`bio\`, and \`visualDescription\` describe the character.

          Do not use placeholder values for fields. Instead, make up something appropriate.
          Try to fill out all fields before finishing.

          Use \`visualDescription\` to visually describe the character without referring to their pose or emotion. This is an image prompt to use for an image generator. Update it whenever the character's visual description changes.
          e.g. 'teen girl with medium blond hair and blue eyes, purple dress, green hoodie, jean shorts, sneakers'

          Use \`homespaceDescription\` to visually describe the character's homespace. This is also an image prompt, meant to describe the natural habitat of the character. Update it whenever the character's homespace changes.
          e.g. 'neotokyo, sakura trees, neon lights, path, ancient ruins, jungle, lush curved vine plants'
        ` + '\n\n' +
        featurePrompt +
        (prompt ? ('The user has provided the following prompt:\n' + prompt) : ''),
      object: agentJson,
      objectFormat: z.object({
        name: z.string().optional(),
        bio: z.string().optional(),
        visualDescription: z.string().optional(),
        homespaceDescription: z.string().optional(),
        features: z.object(featureSchemas).optional(),
      }),
      jwt,
    });
    this.interactor.addEventListener('message', async (e) => {
      const o = e.data;
      const {
        response,
        updateObject,
        done,
        object,
      } = o;

      // external handling
      agentJson = object;
      if (updateObject) {
        this.dispatchEvent(new MessageEvent('change', {
          data: {
            updateObject,
            agentJson,
          },
        }));
      }

      // internal handling
      if (updateObject?.visualDescription) {
        visualDescriptionValueUpdater.set(updateObject.visualDescription);
      }
      if (updateObject?.homespaceDescription) {
        homespaceDescriptionValueUpdater.set(updateObject.homespaceDescription);
      }

      // console.log('agent interview done', {
      //   done,
      //   response,
      // });
      if (!done) {
        // pump i/o
        pumpIo(response);
      } else {
        sendOutput(response);

        const getPreviewUrl = async (valueUpdater) => {
          const result = await valueUpdater.waitForLoad();

          if (typeof result === 'string') {
            return result;
          } else if (result instanceof Blob) {
            const guid = crypto.randomUUID();
            const p = ['avatars', guid, `image.jpg`].join('/');
            return await uploadBlob(p, result, {
              jwt,
            });
          } else if (result === null) {
            return null;
          } else {
            console.warn('invalid result type', result);
            throw new Error('invalid result type: ' + typeof result);
          }
        };

        // return result
        [
          agentJson.previewUrl,
          agentJson.homespaceUrl,
        ] = await Promise.all([
          getPreviewUrl(visualDescriptionValueUpdater),
          getPreviewUrl(homespaceDescriptionValueUpdater),
        ]);
        this.loadPromise.resolve(agentJson);
      }
    });
    if (mode === 'auto') {
      // automatically run the interview to completion
      this.interactor.end();
    } else if (mode === 'interactive') {
      /* // XXX debugging hack: listen for the user pressing the tab key
      {
        process.stdin.setRawMode(true);
        process.stdin.setEncoding('utf8');
        process.stdin.resume();
        process.stdin.on('data', (key) => {
          if (key === '\u0009') { // tab
            console.log('got tab');
          }
          if (key === '\u0003') { // ctrl-c
            console.log('got ctrl-c');
            process.exit();
          }
        });
      } */

      // initiate the interview
      this.interactor.write();
    } else if (mode === 'manual') {
      // pump the interview loop
      pumpIo();
    } else {
      throw new Error(`invalid mode: ${mode}`)
    }
  }
  write(response) {
    this.interactor.write(response);
  }
  async waitForFinish() {
    return await this.loadPromise;
  }
}