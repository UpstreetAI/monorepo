import path from 'path';
import fs from 'fs';
import os from 'os';

import { mkdirp } from 'mkdirp';
import pc from 'picocolors';
import { Jimp } from 'jimp';
import ansi from 'ansi-escapes';
// import toml from '@iarna/toml';
import mime from 'mime/lite';
// import dedent from 'dedent';
import ora from 'ora';
import { cleanDir } from '../lib/directory-util.mjs';
// import { hasNpm, npmInstall } from '../lib/npm-util.mjs';
import { hasGit, gitInit } from '../lib/git-util.mjs';
import {
  BASE_DIRNAME,
} from './locations.mjs';
import {
  ImageRenderer,
} from '../packages/upstreet-agent/packages/react-agents/devices/video-input.mjs';
import { AgentInterview } from '../packages/upstreet-agent/packages/react-agents/util/agent-interview.mjs';
// import {
//   getAgentName,
// } from '../packages/upstreet-agent/packages/react-agents/agent-defaults.mjs';
import {
  getAgentAuthSpec,
} from '../util/agent-auth-util.mjs';
import {
  dotenvFormat,
} from '../util/dotenv-util.mjs';
import {
  updateAgentJsonAuth,
  ensureAgentJsonDefaults,
} from '../packages/upstreet-agent/packages/react-agents/util/agent-json-util.mjs';
import { defaultAgentSourceCode } from '../packages/upstreet-agent/packages/react-agents/util/agent-source-code-formatter.mjs';
import { consoleImagePreviewWidth } from '../packages/upstreet-agent/packages/react-agents/constants.mjs';
import InterviewLogger from '../util/logger/interview-logger.mjs';
import ReadlineStrategy from '../util/logger/readline.mjs';
import StreamStrategy from '../util/logger/stream.mjs';
import { cwd } from '../util/directory-utils.mjs';
import { recursiveCopyAll } from '../util/copy-utils.mjs';
import { makeId } from '../packages/upstreet-agent/packages/react-agents/util/util.mjs';
import { CharacterCardParser, LorebookParser } from '../util/character-card.mjs';
import ImagePreviewServer from '../util/image-preview-server.mjs';
import { imagePreviewPort } from '../util/ports.mjs';
import { uploadBlob } from '../packages/upstreet-agent/packages/react-agents/util/util.mjs';

//

const homeDir = os.homedir();

const logAgentPropertyUpdate = (propertyName, newValue) => {
  // ANSI escape codes for colors
  const colors = {
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
  };

  if (typeof newValue === 'object' && newValue !== null) {
    console.log(`${colors.blue}${colors.bold}[AGENT UPDATE]${colors.reset} ${colors.cyan}${propertyName}${colors.reset}`);
    Object.entries(newValue).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        console.log(`  ${colors.dim}→${colors.reset} ${colors.yellow}${key}${colors.reset}: ${colors.green}${value}${colors.reset}`);
      }
    });
  } else {
    console.log(
      `${colors.blue}${colors.bold}[AGENT UPDATE]${colors.reset} ${colors.cyan}${propertyName}${colors.reset} ${colors.dim}→${colors.reset} ${colors.green}${newValue}${colors.reset}`
    );
  }
};

const propertyLogger = (prefix) => (e) => {
  logAgentPropertyUpdate(prefix, e.data);
};

//

const writeFile = async (dstPath, s) => {
  await mkdirp(path.dirname(dstPath));
  await fs.promises.writeFile(dstPath, s);
};
// const copyWithStringTransform = async (src, dst, transformFn) => {
//   let s = await fs.promises.readFile(src, 'utf8');
//   s = transformFn(s);
//   await mkdirp(path.dirname(dst));
//   await fs.promises.writeFile(dst, s);
// };

// const buildWranglerToml = (
//   t,
//   { name } = {},
// ) => {
//   if (name !== undefined) {
//     t.name = name;
//   }
//   return t;
// };
const interview = async (agentJson, {
  prompt,
  mode,
  inputStream,
  outputStream,
  events,
  jwt,
}) => {

  const questionLogger = new InterviewLogger(
    inputStream && outputStream
      ? new StreamStrategy(inputStream, outputStream)
      : new ReadlineStrategy(),
  );
  const imagePreviewServer = new ImagePreviewServer(imagePreviewPort);

  // setup SIGINT image preview server close handler
  process.on('SIGINT', () => {
    imagePreviewServer.stop();
  })
  
  const getAnswer = async (question) => {
    // console.log('get answer 1', {
    //   question,
    // });
    const answer = await questionLogger.askQuestion(question);
    // console.log('get answer 2', {
    //   question,
    //   answer,
    // });
    return answer;
  };
  const opts = {
    agentJson,
    prompt,
    mode,
    jwt,
  };

  const spinner = ora({
    text: '',
    spinner: {
        interval: 80,
        frames: [
            '●∙∙∙',
            '∙●∙∙',
            '∙∙●∙',
            '∙∙∙●',
            '∙∙∙∙'
        ]
    },
    discardStdin: false,
  }).stop(); // initialize as stopped

  let currentSpinnerState = false;
  const updateSpinner = (isProcessing) => {
    if (isProcessing && !currentSpinnerState) {
      currentSpinnerState = true;
      spinner.start();
    } else if (!isProcessing && currentSpinnerState) {
      currentSpinnerState = false;
      spinner.stop();
    }
  };

  const agentInterview = new AgentInterview(opts);
  agentInterview.addEventListener('processingStateChange', (event) => {
    try {
      const {
        isProcessing,
      } = event.data;
      updateSpinner(isProcessing);
    } catch (error) {
      console.error('Spinner error:', error);
    }
  });
  agentInterview.addEventListener('input', async e => {
    const {
      question,
    } = e.data;
    // console.log('agent interview input 1', {
    //   question,
    // });

    const answer = await getAnswer(question);

    // console.log('agent interview input 2', {
    //   question,
    //   answer,
    // });

    agentInterview.write(answer);
  });
  agentInterview.addEventListener('output', async e => {
    const {
      text,
    } = e.data;
    // console.log('agent interview output', {
    //   text,
    // });
    questionLogger.log(text);
  });
  agentInterview.addEventListener('change', e => {
    const {
      updateObject,
      agentJson,
    } = e.data;
    // console.log('agent interview change', updateObject);
  });
  
  if (events) {
    ['preview', 'homespace'].forEach(eventType => {
      agentInterview.addEventListener(eventType, (e) => {
        events.dispatchEvent(new MessageEvent(eventType, {
          data: e.data,
        }));
      });
    });
  } else {
    const imageLogger = (label) => async (e) => {
      const {
        result: blob,
        signal,
      } = e.data;

      const ab = await blob.arrayBuffer();
      if (signal.aborted) return;

      const b = Buffer.from(ab);
      
      // start server if not already running and update image
      if (!imagePreviewServer.server) {
          imagePreviewServer.start();
      }
      
      // normalize the label to match the server's expectations
      const normalizedLabel = label.toLowerCase().replace(/\s+updated \(preview\):$/i, '').trim();
      imagePreviewServer.updateImage(normalizedLabel, b);
      
      const jimp = await Jimp.read(b);
      if (signal.aborted) return;

      const imageRenderer = new ImageRenderer();
      const {
        text: imageText,
      } = imageRenderer.render(jimp.bitmap, consoleImagePreviewWidth, undefined);
      logAgentPropertyUpdate(label, '');
      console.log(imageText);
      console.log(`\nView image at ${imagePreviewServer.getImageUrl(normalizedLabel)}\n`);
    };
    agentInterview.addEventListener('preview', imageLogger('Avatar updated (preview):'));
    agentInterview.addEventListener('homespace', imageLogger('Homespace updated (preview):'));
    agentInterview.addEventListener('name', propertyLogger('name'));
    agentInterview.addEventListener('bio', propertyLogger('bio'));
    agentInterview.addEventListener('description', propertyLogger('description'));
    agentInterview.addEventListener('features', propertyLogger('features'));
  }
  const result = await agentInterview.waitForFinish();
  questionLogger.close();
  imagePreviewServer.stop();
  return result;
};
const getAgentJsonFromCharacterCard = async (p) => {
  const fileBuffer = await fs.promises.readFile(p);
  const fileBlob = new Blob([fileBuffer]);
  fileBlob.name = path.basename(p);

  const ccp = new CharacterCardParser();
  const parsed = await ccp.parse(fileBlob);
  const {
    name,
    description,
    personality,
    scenario,
    first_mes,
    mes_example,
    creator_notes,
    system_prompt,
    post_history_instructions,
    alternate_greetings,
    character_book,
    tags,
    creator,
    character_version,
    extensions,
  } = parsed.data;
  return {
    name,
    description,
    bio: personality,
  };
};
const addAgentJsonImage = async (agentJson, p, key, {
  jwt,
}) => {
  const fileBuffer = await fs.promises.readFile(p);
  const fileBlob = new Blob([fileBuffer]);
  fileBlob.name = path.basename(p);
  const url = await uploadImage(fileBlob, {
    jwt,
  });
  agentJson = {
    ...agentJson,
    [key]: url,
  };
};
const addAgentJsonFeatures = (agentJson, features) => {
  agentJson = {
    ...agentJson,
  };
  // Add user specified features to agentJsonInit being passed to the interview process for context
  if (Object.keys(features).length > 0) {
    agentJson.features = {
      ...features,
    };
  }
  return agentJson;
};
const loadAgentJson = (dstDir) => {
  const agentJsonPath = path.join(dstDir, 'agent.json');
  const agentJsonString = fs.readFileSync(agentJsonPath, 'utf8');
  const agentJson = JSON.parse(agentJsonString);
  return agentJson;
};
const uploadImage = async (file, {
  jwt,
}) => {
  const type = mime.getType(file.name);
  const ext = mime.getExtension(type);
  const guid = crypto.randomUUID();
  const p = ['images', guid, `image.${ext}`].join('/');
  return await uploadBlob(p, file, {
    jwt,
  });
};

//

export const create = async (args, opts) => {
  // args
  let dstDir = args._[0] ?? '';
  const prompt = args.prompt ?? '';
  const inputStream = args.inputStream ?? null;
  const outputStream = args.outputStream ?? null;
  const events = args.events ?? null;
  const inputFile = args.input ?? null;
  const pfpFile = args.profilePicture ?? null;
  const hsFile = args.homeSpace ?? null;
  const agentJsonString = args.json;
  const source = args.source;
  const features = typeof args.feature === 'string' ? JSON.parse(args.feature) : (args.feature || {});
  const yes = args.yes;
  const force = !!args.force;
  const noInstall = !!args.noInstall;
  const forceNoConfirm = !!args.forceNoConfirm;
  // opts
  const jwt = opts.jwt;
  if (!jwt) {
    console.error('You must be logged in to create an agent.');
    return;
  }

  // auth
  const agentAuthSpec = await getAgentAuthSpec(jwt);
  const {
    guid,
    agentToken,
    userPrivate,
    mnemonic,
  } = agentAuthSpec;
  if (!agentToken) {
    throw new Error('Authorization error. Please try logging in again.')
  }
  if (!userPrivate) {
    throw new Error('User not found. Please try logging in again.')
  }
  if ((+!!prompt + +!!source) > 1) {
    throw new Error('multiple mutually exclusive options --prompt and --source');
  }
  // ensure agent json string is provided when using source file
  // since agentJsonString is required for proper agentJson creation
  if (source && !agentJsonString) {
    throw new Error('The --json flag is required when using the --source flag.');
  }

  // create the destination directory if not present
  if (!dstDir) {
    const dirname = makeId(8);
    dstDir = path.join(homeDir, '.usdk', 'agents', dirname);
    await mkdirp(dstDir);
  }

  // load source file
  const sourceFile = source ?
    await fs.promises.readFile(source)
  : null;

  // remove old directory
  const _prepareDirectory = async () => {
    console.log(pc.italic('Preparing directory...'));
    await cleanDir(dstDir, {
      force,
      forceNoConfirm,
    });
    // bootstrap destination directory
    await mkdirp(dstDir);
    console.log(pc.italic('Directory prepared...'));
  };
  await _prepareDirectory();

  console.log(pc.italic('Generating Agent...'));
  // generate the agent
  let agentJson = await (async () => {
    if (agentJsonString) {
      return JSON.parse(agentJsonString);
    } else if (inputFile) {
      return await getAgentJsonFromCharacterCard(inputFile);
    } else {
      return null;
    }
  })();
  // images
  const previewImageFile = pfpFile || inputFile;
  if (previewImageFile) {
    agentJson = await addAgentJsonImage(agentJson, previewImageFile, 'previewUrl', {
      jwt,
    });
  }
  if (hsFile) {
    agentJson = await addAgentJsonImage(agentJson, hsFile, 'homespaceUrl', {
      jwt,
    });
  }
  // features
  agentJson = addAgentJsonFeatures(agentJson, features);
  // run the interview, if applicable
  if (!(inputFile || agentJsonString || source || yes)) {
    const interviewMode = prompt ? 'auto' : 'interactive';
    if (interviewMode !== 'auto') {
      console.log(pc.italic('Starting the Interview process...\n'));
    }
    agentJson = await interview(agentJson, {
      prompt,
      mode: interviewMode,
      inputStream,
      outputStream,
      events,
      jwt,
    });
  }
 
  agentJson = updateAgentJsonAuth(agentJson, agentAuthSpec);
  agentJson = ensureAgentJsonDefaults(agentJson);
  console.log(pc.italic('Agent generated...'));
  console.log(pc.green('Name:'), agentJson.name);
  console.log(pc.green('Bio:'), agentJson.bio);
  console.log(pc.green('Description:'), agentJson.description);
  console.log(pc.green('Visual Description:'), agentJson.visualDescription);
  console.log(pc.green('Preview URL:'), agentJson.previewUrl);
  console.log(pc.green('Homespace Description:'), agentJson.homespaceDescription);
  console.log(pc.green('Homespace URL:'), agentJson.homespaceUrl);
  const featuresKeys = Object.keys(agentJson.features ?? {});
  console.log(pc.green('Features:'), featuresKeys.length > 0
    ? featuresKeys.join(', ')
    : '*none*'
  );

  const agentTsx = (() => {
    if (sourceFile !== null) {
      return sourceFile;
    } else {
      return defaultAgentSourceCode;
    }
  })();

  // copy over files
  const _copyFiles = async () => {
    const upstreetAgentSrcDir = path.join(BASE_DIRNAME, 'packages', 'upstreet-agent');
    const upstreetAgentDstDir = path.join(dstDir, 'packages', 'upstreet-agent');

    const dstPackageJsonPath = path.join(dstDir, 'package.json');
    // const pnpmYamlPath = path.join(dstDir, 'pnpm-workspace.yaml');

    const dstAgentTsxPath = path.join(dstDir, 'agent.tsx');

    // const srcWranglerToml = path.join(upstreetAgentSrcDir, 'wrangler.toml');
    // const dstWranglerToml = path.join(dstDir, 'wrangler.toml');

    const srcTsconfigPath = path.join(BASE_DIRNAME, 'tsconfig.json');
    const dstTsconfigPath = path.join(dstDir, 'tsconfig.json');

    const srcGitignorePath = path.join(upstreetAgentSrcDir, 'gitignore.template');
    const dstGitignorePath = path.join(dstDir, '.gitignore');

    const agentJsonPath = path.join(dstDir, 'agent.json');
    const dstEnvTxtPath = path.join(dstDir, '.env.txt');

    // const srcJestPath = path.join(upstreetAgentSrcDir, 'jest');
    // const dstJestPath = dstDir;

    // copy over the template files
    console.log(pc.italic('Copying files...'));
    await Promise.all([
      // agent.tsx
      writeFile(dstAgentTsxPath, agentTsx),
      // package.json
      writeFile(dstPackageJsonPath, JSON.stringify({
        name: 'my-agent',
        dependencies: {
          // 'react': '19.0.0-rc-df5f2736-20240712',
          // 'react-agents': 'file:./packages/upstreet-agent/packages/react-agents'
        },
      }, null, 2)),
      // // pnpm-workspace.yaml
      // writeFile(pnpmYamlPath, dedent`\
      //   packages:
      //     - 'packages/*'
      //     - 'packages/upstreet-agent/packages/*'
      //     - 'packages/upstreet-agent/packages/codecs/*'
      //     - 'packages/upstreet-agent/packages/codecs/packages/*'
      // `),
      // root tsconfig
      recursiveCopyAll(srcTsconfigPath, dstTsconfigPath),
      // .gitignore
      recursiveCopyAll(srcGitignorePath, dstGitignorePath),
      /* // root jest config
      recursiveCopyAll(srcJestPath, dstJestPath), */
      // // wrangler.toml
      // copyWithStringTransform(srcWranglerToml, dstWranglerToml, (s) => {
      //   let t = toml.parse(s);
      //   t = buildWranglerToml(t, {
      //     name: getAgentName(guid),
      //   });
      //   return toml.stringify(t);
      // }),
      // agent.json
      writeFile(agentJsonPath, JSON.stringify(agentJson, null, 2)),
      // .env.txt
      writeFile(dstEnvTxtPath, dotenvFormat({
        AGENT_TOKEN: agentToken,
        WALLET_MNEMONIC: mnemonic,
      })),
      // upstreet-agent directory
      // recursiveCopyAll(upstreetAgentSrcDir, upstreetAgentDstDir, {
      //   filter: (src) => {
      //     // More thorough check for node_modules in the path
      //     return !src.includes('node_modules') && 
      //            !src.match(/[\\/]node_modules[\\/]/) && 
      //            path.basename(src) !== 'node_modules';
      //   },
      // }),
    ]);
  };
  await _copyFiles();

  events && events.dispatchEvent(new MessageEvent('finalize', {
    data: {
      agentJson,
    },
  }));

  // // npm install
  // if (!noInstall) {
  //   const has = await hasNpm();
  //   if (has) {
  //     console.log(pc.italic('Installing dependencies...'));
  //     try {
  //       await npmInstall(dstDir);
  //     } catch(err) {
  //       console.warn('failed to install dependencies:', err.stack);
  //     }
  //   } else {
  //     console.warn('npm not found; skipping dependecy install. Your agent may not work correctly.');
  //     console.warn('To install dependencies, run `npm install` in the agent directory.');
  //   }
  // }

  // git init
  if (!noInstall) {
    const has = await hasGit();
    if (has) {
      console.log(pc.italic('Initializing git repository...'));
      try {
        await gitInit(dstDir);
      } catch(err) {
        console.warn('failed to initialize git repository:', err.stack);
      }
    } else {
      console.warn('git not found; skipping git initialization. Your agent may not work correctly.');
      console.warn('To initialize a git repository, run `git init` in the agent directory.');
    }
  }

  console.log('\nCreated agent at', ansi.link(path.resolve(dstDir)));
  console.log();
  console.log(pc.green('To start a chat with your agent, run:'));
  console.log(pc.cyan(`  usdk chat ${dstDir}`));
  console.log(pc.green(`To edit this agent again, run:`));
  console.log(pc.cyan(`  usdk edit ${dstDir}`));
  console.log();
  console.log(pc.green(`To set up your agent with a git repository, run:`));
  console.log(pc.cyan(`  git remote add origin https://github.com/USERNAME/REPOSITORY.git`));
  console.log();
  console.log(pc.green('To learn how to customize your agent with code, see the docs: https://docs.upstreet.ai/customize-your-agent'));
  console.log();
  console.log(pc.green(`Happy building!`));

  return agentJson;
};

const updateFeatures = (agentJson, {
  addFeature,
  removeFeature,
}) => {
  agentJson = {
    ...agentJson,
  };
  // console.log('add feature remove feature', {
  //   addFeature,
  //   removeFeature,
  // });
  
  if (removeFeature) {
    for (const feature of removeFeature) {
      delete agentJson.features[feature];
    }
  }
  
  if (addFeature) {
    if (!agentJson.features) {
      agentJson.features = {};
    }
    agentJson.features = {
      ...agentJson.features,
      ...addFeature,
    };
  }

  return agentJson;
};
export const edit = async (args, opts) => {
  // args
  const dstDir = args._[0] ?? cwd;
  const prompt = args.prompt ?? '';
  const inputFile = args.input ?? null;
  const pfpFile = args.profilePicture ?? null;
  const hsFile = args.homeSpace ?? null;
  const inputStream = args.inputStream ?? null;
  const outputStream = args.outputStream ?? null;
  const events = args.events ?? null;
  const addFeature = args.addFeature;
  const removeFeature = args.removeFeature;
  // opts
  const jwt = opts.jwt;
  if (!jwt) {
    throw new Error('You must be logged in to edit an agent.');
  }

  let agentJson = loadAgentJson(dstDir);

  // update character card
  if (inputFile) {
    const update = await getAgentJsonFromCharacterCard(inputFile);
    agentJson = {
      ...agentJson,
      ...update,
    };
  };

  // update images
  const previewImageFile = pfpFile || inputFile;
  if (previewImageFile) {
    agentJson = await addAgentJsonImage(agentJson, previewImageFile, 'previewUrl', {
      jwt,
    });
  }
  if (hsFile) {
    agentJson = await addAgentJsonImage(agentJson, hsFile, 'homespaceUrl', {
      jwt,
    });
  }

  // update features
  agentJson = updateFeatures(agentJson, {
    addFeature,
    removeFeature,
  });

  // run the interview, if applicable
  if (!(addFeature || removeFeature)) {
    agentJson = await interview(agentJson, {
      prompt,
      mode: prompt ? 'auto' : 'edit',
      inputStream,
      outputStream,
      events,
      jwt,
    });
  }

  const _updateFiles = async () => {
    await Promise.all([
      // wrangler.toml
      // (async () => {
      //   const wranglerTomlPath = path.join(dstDir, 'wrangler.toml');
      //   await copyWithStringTransform(wranglerTomlPath, wranglerTomlPath, (s) => {
      //     let t = toml.parse(s);
      //     t = buildWranglerToml(t, {
      //       agentJson,
      //     });
      //     return toml.stringify(t);
      //   });
      // })(),
      // agent.json
      (async () => {
        const agentJsonPath = path.join(dstDir, 'agent.json');
        await fs.promises.writeFile(agentJsonPath, JSON.stringify(agentJson, null, 2));
      })(),
      // agent.tsx
      // (async () => {
      //   const agentJSXPath = path.join(dstDir, 'agent.tsx');
      //   const agentJSX = makeAgentSourceCode(agentJson.features ?? []);
      //   await fs.promises.writeFile(agentJSXPath, agentJSX);
      // })(),
    ]);
  };
  await _updateFiles();
};