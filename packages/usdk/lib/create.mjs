import path from 'path';
import fs from 'fs';

import { mkdirp } from 'mkdirp';
import recursiveCopy from 'recursive-copy';
import pc from 'picocolors';
import Jimp from 'jimp';
import ansi from 'ansi-escapes';
import toml from '@iarna/toml';
import { createAgentGuid } from '../packages/upstreet-agent/packages/react-agents/util/guid-util.mjs';
import {
  getAgentToken,
} from '../packages/upstreet-agent/packages/react-agents/util/jwt-utils.mjs';
import {
  generateMnemonic,
} from '../util/ethereum-utils.mjs';
import { cleanDir } from '../lib/directory-util.mjs';
import { hasNpm, npmInstall } from '../lib/npm-util.mjs';
import { hasGit, gitInit } from '../lib/git-util.mjs';
// import {
//   makeTempDir,
// } from './file.mjs';
import {
  BASE_DIRNAME,
  // templatesDirectory,
} from './locations.mjs';
import {
  ImageRenderer,
} from '../packages/upstreet-agent/packages/react-agents/devices/video-input.mjs';
import {
  getUserIdForJwt,
  getUserForJwt,
} from '../packages/upstreet-agent/packages/react-agents/util/supabase-client.mjs';
import {
  // providers,
  getWalletFromMnemonic,
  // getConnectedWalletsFromMnemonic,
} from '../packages/upstreet-agent/packages/react-agents/util/ethereum-utils.mjs';
import { AgentInterview } from '../packages/upstreet-agent/packages/react-agents/util/agent-interview.mjs';
import {
  getAgentName,
  ensureAgentJsonDefaults,
} from '../packages/upstreet-agent/packages/react-agents/agent-defaults.mjs';
import {
  aiProxyHost,
} from '../packages/upstreet-agent/packages/react-agents/util/endpoints.mjs';
import { makeAgentSourceCode } from '../packages/upstreet-agent/packages/react-agents/util/agent-source-code-formatter.mjs';
import { consoleImagePreviewWidth, consoleImageWidth } from '../packages/upstreet-agent/packages/react-agents/constants.mjs';
import InterviewLogger from '../util/logger/interview-logger.mjs';
import ReadlineStrategy from '../util/logger/readline.mjs';
import StreamStrategy from '../util/logger/stream.mjs';
import { cwd } from '../util/directory-utils.mjs';
import { makeId } from '../packages/upstreet-agent/packages/react-agents/util/util.mjs';
import ora from 'ora';
import ImagePreviewServer from '../util/image-preview-server.mjs';
import { imagePreviewPort } from '../util/ports.mjs';

//

const agentJsonSrcFilename = 'agent.json';

//

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
const copyWithStringTransform = async (src, dst, transformFn) => {
  let s = await fs.promises.readFile(src, 'utf8');
  s = transformFn(s);
  await mkdirp(path.dirname(dst));
  await fs.promises.writeFile(dst, s);
};

const getAgentAuthSpec = async (jwt) => {
  const [
    {
      guid,
      agentToken,
    },
    userPrivate,
  ] = await Promise.all([
    (async () => {
      const guid = await createAgentGuid({
        jwt,
      });
      const agentToken = await getAgentToken(jwt, guid);
      return {
        guid,
        agentToken,
      };
    })(),
    getUserForJwt(jwt, {
      private: true,
    }),
  ]);
  const mnemonic = generateMnemonic();
  return {
    guid,
    agentToken,
    userPrivate,
    mnemonic,
  };
};
/* const generateTemplateFromAgentJson = async (agentJson) => {
  // create a temporary directory
  const templateDirectory = await makeTempDir();

  // copy over the basic template
  const template = 'basic';
  const basicTemplateDirectory = path.join(templatesDirectory, template);
  await recursiveCopy(basicTemplateDirectory, templateDirectory);

  // write the agent jsx
  const agentJSXPath = path.join(templateDirectory, 'agent.tsx');
  const agentJSX = makeAgentSourceCode(agentJson.features ?? []);
  await fs.promises.writeFile(agentJSXPath, agentJSX);

  // write the agent json
  await fs.promises.writeFile(
    path.join(templateDirectory, agentJsonSrcFilename),
    JSON.stringify(agentJson, null, 2),
  );

  return templateDirectory;
}; */
const buildWranglerToml = (
  t,
  { name, agentJson, mnemonic, agentToken } = {},
) => {
  if (name !== undefined) {
    t.name = name;
  }
  if (agentJson !== undefined) {
    t.vars.AGENT_JSON = JSON.stringify(agentJson);
  }
  if (mnemonic !== undefined) {
    t.vars.WALLET_MNEMONIC = mnemonic;
  }
  if (agentToken !== undefined) {
    t.vars.AGENT_TOKEN = agentToken;
  }
  return t;
};
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
const makeAgentJsonInit = ({
  agentJsonString,
  features,
}) => {
  const agentJsonInit = agentJsonString ? JSON.parse(agentJsonString) : {};
  // Add user specified features to agentJsonInit being passed to the interview process for context
  if (Object.keys(features).length > 0) {
    agentJsonInit.features = {
      ...features,
    };
  }
  return agentJsonInit;
};
const loadAgentJson = (dstDir) => {
  const wranglerTomlPath = path.join(dstDir, 'wrangler.toml');
  const wranglerTomlString = fs.readFileSync(wranglerTomlPath, 'utf8');
  const wranglerToml = toml.parse(wranglerTomlString);
  const agentJsonString = wranglerToml.vars.AGENT_JSON;
  const agentJson = JSON.parse(agentJsonString);
  return agentJson;
};
const updateAgentJsonAuth = (agentJsonInit, agentAuthSpec) => {
  const {
    guid,
    // agentToken,
    userPrivate,
    mnemonic,
  } = agentAuthSpec;

  const wallet = getWalletFromMnemonic(mnemonic);

  return {
    ...agentJsonInit,
    id: guid,
    ownerId: userPrivate.id,
    address: wallet.address.toLowerCase(),
    stripeConnectAccountId: userPrivate.stripe_connect_account_id,
  };
};

//

export const create = async (args, opts) => {
  // args
  let dstDir = args._[0] ?? '';
  const prompt = args.prompt ?? '';
  const inputStream = args.inputStream ?? null;
  const outputStream = args.outputStream ?? null;
  const events = args.events ?? null;
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
    throw new Error('You must be logged in to create an agent.');
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
    dstDir = path.join(cwd, 'agents', dirname);
    await mkdirp(dstDir);
  }

  // load source file
  const sourceFile = source ?
    await fs.promises.readFile(source)
  : null;

  // remove old directory
  const _prepareDirectory = async () => {
    await cleanDir(dstDir, {
      force,
      forceNoConfirm,
    });
    // bootstrap destination directory
    await mkdirp(dstDir);
  };
  await _prepareDirectory();

  // generate the agent
  let agentJson = makeAgentJsonInit({
    agentJsonString,
    features,
  });
  // run the interview, if applicable
  if (!(agentJsonString || source || yes)) {
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
  else {
    console.log(pc.italic('Generating agent...'));
  }
  agentJson = updateAgentJsonAuth(agentJson, agentAuthSpec);
  ensureAgentJsonDefaults(agentJson);
  console.log(pc.italic('Agent generated.'));
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

  const agentJSX = await (async () => {
    if (sourceFile !== null) {
      return sourceFile;
    } else {
      console.log(pc.italic('Building agent...'));
      const sourceCode = makeAgentSourceCode(agentJson.features ?? []);
      console.log(pc.italic('Agent built.'));
      return sourceCode;
    }
  })();

  // copy over files
  const _copyFiles = async () => {
    const upstreetAgentSrcDir = path.join(BASE_DIRNAME, 'packages', 'upstreet-agent');
    const upstreetAgentDstDir = path.join(dstDir, 'packages', 'upstreet-agent');

    const dstPackageJsonPath = path.join(dstDir, 'package.json');

    const dstAgentTsxPath = path.join(dstDir, 'agent.tsx');

    const srcWranglerToml = path.join(upstreetAgentSrcDir, 'wrangler.toml');
    const dstWranglerToml = path.join(dstDir, 'wrangler.toml');

    const srcTsconfigPath = path.join(BASE_DIRNAME, 'tsconfig.json');
    const dstTsconfigPath = path.join(dstDir, 'tsconfig.json');

    const srcGitignorePath = path.join(upstreetAgentSrcDir, 'gitignore.template');
    const dstGitignorePath = path.join(dstDir, '.gitignore');

    const srcJestPath = path.join(upstreetAgentSrcDir, 'jest');
    const dstJestPath = dstDir;

    // copy over the template files
    console.log(pc.italic('Copying files...'));
    await Promise.all([
      // agent.tsx
      fs.promises.writeFile(dstAgentTsxPath, agentJSX),
      // package.json
      writeFile(dstPackageJsonPath, JSON.stringify({
        name: 'my-agent',
        dependencies: {
          'upstreet-agent': 'file:./packages/upstreet-agent',
        },
      }, null, 2)),
      // root tsconfig
      recursiveCopy(srcTsconfigPath, dstTsconfigPath),
      // .gitignore
      recursiveCopy(srcGitignorePath, dstGitignorePath),
      /* // root jest config
      recursiveCopy(srcJestPath, dstJestPath), */
      // root wrangler.toml
      copyWithStringTransform(srcWranglerToml, dstWranglerToml, (s) => {
        let t = toml.parse(s);
        t = buildWranglerToml(t, {
          name: getAgentName(guid),
          agentJson,
          agentToken,
          mnemonic,
        });
        return toml.stringify(t);
      }),
      // upstreet-agent directory
      recursiveCopy(upstreetAgentSrcDir, upstreetAgentDstDir),
    ]);
  };
  await _copyFiles();

  events && events.dispatchEvent(new MessageEvent('finalize', {
    data: {
      agentJson,
    },
  }));

  // npm install
  if (!noInstall) {
    const has = await hasNpm();
    if (has) {
      console.log(pc.italic('Installing dependencies...'));
      try {
        await npmInstall(dstDir);
      } catch(err) {
        console.warn('failed to install dependencies:', err.stack);
      }
    } else {
      console.warn('npm not found; skipping dependecy install. Your agent may not work correctly.');
      console.warn('To install dependencies, run `npm install` in the agent directory.');
    }
  }

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
  // // return the parsed dstWranglerToml
  // {
  //   const dstWranglerTomlString = await fs.promises.readFile(path.join(dstDir, 'wrangler.toml'), 'utf8');
  //   const dstWranglerToml = toml.parse(dstWranglerTomlString);
  //   return dstWranglerToml;
  // }
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
      (async () => {
        const wranglerTomlPath = path.join(dstDir, 'wrangler.toml');
        await copyWithStringTransform(wranglerTomlPath, wranglerTomlPath, (s) => {
          let t = toml.parse(s);
          t = buildWranglerToml(t, {
            agentJson,
          });
          return toml.stringify(t);
        });
      })(),
      // agent.tsx
      (async () => {
        const agentJSXPath = path.join(dstDir, 'agent.tsx');
        const agentJSX = makeAgentSourceCode(agentJson.features ?? []);
        await fs.promises.writeFile(agentJSXPath, agentJSX);
      })(),
    ]);
  };
  await _updateFiles();
};
export const pull = async (args, opts) => {
  const agentId = args._[0] ?? '';
  const dstDir = args._[1] ?? cwd;
  const force = !!args.force;
  const forceNoConfirm = !!args.forceNoConfirm;
  const noInstall = !!args.noInstall;
  const events = args.events ?? null;
  // opts
  const jwt = opts.jwt;
  if (!jwt) {
    throw new Error('You must be logged in to pull.');
  }

  const userId = jwt && (await getUserIdForJwt(jwt));
  if (userId) {
    // clean the old directory
    await cleanDir(dstDir, {
      force,
      forceNoConfirm,
    });

    // download the source
    console.log(pc.italic('Downloading source...'));
    const u = `https://${aiProxyHost}/agents/${agentId}/source`;
    try {
      const req = await fetch(u, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      if (req.ok) {
        const zipBuffer = await req.arrayBuffer();
        // console.log('downloaded source', zipBuffer.byteLength);

        // extract the source
        console.log(pc.italic('Extracting zip...'));
        await extractZip(zipBuffer, dstDir);

        events && events.dispatchEvent(new MessageEvent('finalize', {
          data: {
            agentJson,
          },
        }));

        console.log(pc.italic('Installing dependencies...'));
        try {
          if (!noInstall) {
            await npmInstall(dstDir);
          }
        } catch (err) {
          console.warn('npm install failed:', err.stack);
          process.exit(1);
        }
      } else {
        const text = await req.text();
        console.warn('pull request error', text);
        process.exit(1);
      }
    } catch (err) {
      console.warn('pull request failed', err);
      process.exit(1);
    }
  } else {
    console.log('not logged in');
    process.exit(1);
  }
};