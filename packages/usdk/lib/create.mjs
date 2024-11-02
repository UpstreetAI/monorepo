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
import { npmInstall } from '../lib/npm-util.mjs';
import {
  makeTempDir,
} from './file.mjs';
import {
  BASE_DIRNAME,
  templatesDirectory,
} from './locations.mjs';
import {
  ImageRenderer,
} from '../packages/upstreet-agent/packages/react-agents/devices/video-input.mjs';
import {
  // makeAnonymousClient,
  // getUserIdForJwt,
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
import { makeAgentSourceCode } from '../packages/upstreet-agent/packages/react-agents/util/agent-source-code-formatter.mjs';
import { consoleImagePreviewWidth } from '../packages/upstreet-agent/packages/react-agents/constants.mjs';
import InterviewLogger from '../util/logger/interview-logger.mjs';
import ReadlineStrategy from '../util/logger/readline.mjs';
import StreamStrategy from '../util/logger/stream.mjs';
import {
  cwd,
} from '../util/directory-utils.mjs';

//

const agentJsonSrcFilename = 'agent.json';

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
const generateTemplateFromAgentJson = async (agentJson) => {
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
};
const buildWranglerToml = (
  t,
  { name, agentJson, mnemonic, agentToken },
) => {
  t.name = name;
  t.vars.AGENT_JSON = JSON.stringify(agentJson);
  t.vars.WALLET_MNEMONIC = mnemonic;
  t.vars.AGENT_TOKEN = agentToken;
  return t;
};
const interview = async (agentJson, {
  prompt,
  stream,
  jwt,
}) => {
  const questionLogger = new InterviewLogger(
    stream ? new StreamStrategy(stream) : new ReadlineStrategy()
  );
  const getAnswer = (question) => {
    return questionLogger.askQuestion(question);
  };
  const agentInterview = new AgentInterview({
    agentJson,
    prompt,
    mode: prompt ? 'auto' : 'interactive',
    jwt,
  });
  agentInterview.addEventListener('input', async e => {
    const {
      question,
    } = e.data;
    const answer = await getAnswer(question);
    agentInterview.write(answer);
  });
  agentInterview.addEventListener('output', async e => {
    const {
      text,
    } = e.data;
    console.log(text);
  });
  agentInterview.addEventListener('change', e => {
    const {
      updateObject,
      agentJson,
    } = e.data;
    // console.log('change', updateObject);
  });
  const imageLogger = (label) => async (e) => {
    const {
      result: blob,
      signal,
    } = e.data;

    const ab = await blob.arrayBuffer();
    if (signal.aborted) return;

    const b = Buffer.from(ab);
    const jimp = await Jimp.read(b);
    if (signal.aborted) return;

    const imageRenderer = new ImageRenderer();
    const {
      text: imageText,
    } = imageRenderer.render(jimp.bitmap, consoleImagePreviewWidth, undefined);
    console.log(label);
    console.log(imageText);
  };
  agentInterview.addEventListener('preview', imageLogger('Avatar updated (preview):'));
  agentInterview.addEventListener('homespace', imageLogger('Homespace updated (preview):'));
  const result = await agentInterview.waitForFinish();
  questionLogger.close();
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
  const dstDir = args._[0] ?? cwd;
  const prompt = args.prompt ?? '';
  const stream = args.stream ?? null;
  const agentJsonString = args.json;
  const source = args.source;
  const features = typeof args.feature === 'string' ? JSON.parse(args.feature) : (args.feature || {});
  const yes = args.yes;
  const force = !!args.force;
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
    console.log(pc.italic('Starting the Interview process...\n'));
    agentJson = await interview(agentJson, {
      prompt,
      stream,
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

  console.log(pc.italic('Building agent...'));
  const srcTemplateDir = await generateTemplateFromAgentJson(agentJson);
  console.log(pc.italic('Agent built.'));

  // copy over files
  const _copyFiles = async () => {
    const upstreetAgentSrcDir = path.join(BASE_DIRNAME, 'packages', 'upstreet-agent');
    const upstreetAgentDstDir = path.join(dstDir, 'packages', 'upstreet-agent');

    const dstPackageJsonPath = path.join(dstDir, 'package.json');

    const srcWranglerToml = path.join(upstreetAgentSrcDir, 'wrangler.toml');
    const dstWranglerToml = path.join(dstDir, 'wrangler.toml');

    const srcTsconfigPath = path.join(BASE_DIRNAME, 'tsconfig.json');
    const dstTsconfigPath = path.join(dstDir, 'tsconfig.json');

    const srcJestPath = path.join(upstreetAgentSrcDir, 'jest');
    const dstJestPath = dstDir;

    // copy over the template files
    console.log(pc.italic('Copying files...'));
    await Promise.all([
      // generated template -> root
      (async () => {
        await recursiveCopy(srcTemplateDir, dstDir, {
          filter: (p) => !/^(?:package\.json|agent\.json)$/.test(p),
        });
        if (sourceFile !== null) {
          const dstAgentTsxPath = path.join(dstDir, 'agent.tsx');
          await fs.promises.writeFile(dstAgentTsxPath, sourceFile);
        }
      })(),
      // package.json
      writeFile(dstPackageJsonPath, JSON.stringify({
        name: 'my-agent',
        dependencies: {
          'upstreet-agent': 'file:./packages/upstreet-agent',
        },
      }, null, 2)),
      // root tsconfig
      recursiveCopy(srcTsconfigPath, dstTsconfigPath),
      // root jest config
      recursiveCopy(srcJestPath, dstJestPath),
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

  // npm install
  console.log(pc.italic('Installing dependencies...'));
  await npmInstall(dstDir);

  console.log('\nCreated agent at', ansi.link(path.resolve(dstDir)), '\n');
};

const updateFeatures = (agentJson, {
  addFeature,
  removeFeature,
}) => {
  agentJson = {
    ...agentJson,
  };
  console.log('add feature remove feature', {
    addFeature,
    removeFeature,
  });
  
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
  const stream = args.stream ?? null;
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
      stream,
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
