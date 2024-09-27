import path from 'path';
import fs from 'fs';

import { mkdirp } from 'mkdirp';
import recursiveCopy from 'recursive-copy';
import pc from 'picocolors';
import Jimp from 'jimp';
import ansi from 'ansi-escapes';
import toml from '@iarna/toml';
import {
  input,
  // select,
  // checkbox,
  // confirm,
  // search,
  // password,
  // expand,
  // editor,
  // number,
  // rawlist,
} from '@inquirer/prompts';
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
  getLoginJwt,
} from './login.mjs';
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
  makeAnonymousClient,
  getUserIdForJwt,
  getUserForJwt,
} from '../packages/upstreet-agent/packages/react-agents/util/supabase-client.mjs';
import {
  providers,
  getWalletFromMnemonic,
  getConnectedWalletsFromMnemonic,
} from '../packages/upstreet-agent/packages/react-agents/util/ethereum-utils.mjs';
import { AgentInterview } from '../packages/upstreet-agent/packages/react-agents/util/agent-interview.mjs';
import {
  getAgentName,
  ensureAgentJsonDefaults,
} from '../packages/upstreet-agent/packages/react-agents/agent-defaults.mjs';
import { makeAgentSourceCode } from '../packages/upstreet-agent/packages/react-agents/util/agent-source-code-formatter.mjs';
import { consoleImageWidth } from '../packages/upstreet-agent/packages/react-agents/constants.mjs';
import InterviewLogger from '../util/logger/interview-logger.mjs';
import ReadlineStrategy from '../util/logger/readline.mjs';

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

//

export const create = async (args, opts) => {
  const dstDir = args._[0] ?? cwd;
  const prompt = args.prompt ?? '';
  const agentJsonString = args.json;
  // const template = args.template ?? 'basic';
  const source = args.source;
  const yes = args.yes;
  const force = !!args.force;
  const forceNoConfirm = !!args.forceNoConfirm;
  const features = typeof args.features === 'string' ? JSON.parse(args.features) : (args.features || {});

  const jwt = opts?.jwt || await getLoginJwt();
  let guid = null;
  let agentToken = null;
  let userPrivate = null;
  if (jwt !== null) {
    guid = await createAgentGuid({
      jwt,
    });
    // console.log('created guid', guid);
    [agentToken, userPrivate] = await Promise.all([
      getAgentToken(jwt, guid),
      getUserForJwt(jwt, {
        private: true,
      }),
    ]);
    if (!agentToken) {
      throw new Error('Authorization error. Please try logging in again.')
    }
    if (!userPrivate) {
      throw new Error('User not found. Please try logging in again.')
    }
  } else {
    throw new Error('You must be logged in to create an agent.');
  }

  if ((+!!args.prompt + /*+!!args.template +*/ +!!args.source) > 1) {
    throw new Error('multiple mutually exclusive options --prompt, --template and --source');
  }

  // ensure agent json string is provided when using source file
  // since agentJsonString is required for proper agentJson creation
  if (source) {
    if (!agentJsonString) {
      throw new Error('The --json flag is required when using the --source flag.');
    }
  }

  const mnemonic = generateMnemonic();
  const wallet = getWalletFromMnemonic(mnemonic);
  const walletAddress = wallet.address.toLowerCase();
  const stripeConnectAccountId = userPrivate.stripe_connect_account_id;

  // load source file
  let sourceFile = null;
  if (source) {
    sourceFile = await fs.promises.readFile(source);
  }

  // remove old directory
  await cleanDir(dstDir, {
    force,
    forceNoConfirm,
  });

  // bootstrap destination directory
  await mkdirp(dstDir);

  // generate the agent if necessary
  let srcTemplateDir;
  let agentJson;
  if (jwt) {
    console.log(pc.italic('Generating agent...'));

    // run the interview
    const interview = async (agentJson) => {
      const questionLogger = new InterviewLogger(new ReadlineStrategy());
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
        } = imageRenderer.render(jimp.bitmap, consoleImageWidth, undefined);
        console.log(label);
        console.log(imageText);
      };
      agentInterview.addEventListener('preview', imageLogger('Avatar updated:'));
      agentInterview.addEventListener('homespace', imageLogger('Homespace updated:'));
      const result = await agentInterview.waitForFinish();
      questionLogger.close();
      return result;
    };
    const createAgentJson = async () => {
      // initialize
      const agentJsonInit = agentJsonString ? JSON.parse(agentJsonString) : {};
      // Add user specified features to agentJsonInit being passed to the interview process for context
      if (Object.keys(features).length > 0) {
        agentJsonInit.features = {
          ...features,
        };
      }
      // run the interview, if applicable
      const agentJson = await (async () => {
        // if the agent json is complete
        if (agentJsonString || source || yes) {
          return agentJsonInit;
        } else {
          return await interview(agentJsonInit);
        }
      })();
      // additional properties
      agentJson.id = guid;
      agentJson.ownerId = userPrivate.id;
      agentJson.stripeConnectAccountId = stripeConnectAccountId;
      agentJson.address = walletAddress;
      // ensure defaults
      ensureAgentJsonDefaults(agentJson);
      // return result
      return agentJson;
    };

    // note: this is an assignment
    agentJson = await createAgentJson();
    console.log(pc.italic('Agent generated.'));
    console.log(pc.green('Name:'), agentJson.name);
    console.log(pc.green('Bio:'), agentJson.bio);
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
    srcTemplateDir = await generateTemplateFromAgentJson(agentJson);
    console.log(pc.italic('Agent built.'));
  } else {
    throw new Error('not logged in: cannot generate agent from prompt');
  }
  const srcTemplateFilter = (p) => !/^(?:package\.json|agent\.json)$/.test(p);

  // copy over files
  const srcPackageJsonPaths = [
    path.join(BASE_DIRNAME, 'packages', 'upstreet-agent', 'package.json'), // upstreet-agent package.json
    path.join(srcTemplateDir, 'package.json'), // template package.json
  ];
  const dstPackageJsonPath = path.join(dstDir, 'package.json');

  const srcWranglerToml = path.join(BASE_DIRNAME, 'packages', 'upstreet-agent', 'wrangler.toml');
  const dstWranglerToml = path.join(dstDir, 'wrangler.toml');

  const srcSdkDir = path.join(BASE_DIRNAME, 'packages', 'upstreet-agent');
  const srcDstDir = path.join(dstDir, 'packages', 'upstreet-agent');

  const srcTsconfigPath = path.join(BASE_DIRNAME, 'tsconfig.json');
  const dstTsconfigPath = path.join(dstDir, 'tsconfig.json');

  const srcJestConfigPath = path.join(BASE_DIRNAME, 'jest.config.js');
  const dstJestConfigPath = path.join(dstDir, 'jest.config.js');

  // copy over the template files
  console.log(pc.italic('Copying files...'));
  const agentName = getAgentName(guid);
  const copyOpts = {
    // overwrite: force,
  };
  await Promise.all([
    // template -> root
    (async () => {
      await recursiveCopy(srcTemplateDir, dstDir, {
        ...copyOpts,
        filter: srcTemplateFilter,
      });
      if (sourceFile !== null) {
        const dstAgentTsxPath = path.join(dstDir, 'agent.tsx');
        await fs.promises.writeFile(dstAgentTsxPath, sourceFile);
      }
    })(),
    writeFile(dstPackageJsonPath, JSON.stringify({
      name: 'my-agent',
      description: 'My AI agent, created with the upstreet SDK!',
      dependencies: {
        'upstreet-agent': 'file:./packages/upstreet-agent',
      },
    }, null, 2)),
    /* // root package.json
    mergeJson(dstPackageJsonPath, srcPackageJsonPaths, (a, b) => {
      return {
        ...a,
        ...b,
        name: agentName,
        dependencies: {
          ...a.dependencies,
          ...b.dependencies,
        },
      };
    }), */
    // root tsconfig
    recursiveCopy(srcTsconfigPath, dstTsconfigPath, copyOpts),
    // root jest config
    recursiveCopy(srcJestConfigPath, dstJestConfigPath, copyOpts),
    // root wrangler.toml
    copyWithStringTransform(srcWranglerToml, dstWranglerToml, (s) => {
      let t = toml.parse(s);
      t = buildWranglerToml(t, { name: agentName, agentJson, mnemonic, agentToken });
      return toml.stringify(t);
    }),
    // sdk directory
    recursiveCopy(srcSdkDir, srcDstDir, copyOpts),
  ]);

  // npm install
  console.log(pc.italic('Installing dependencies...'));
  try {
    await npmInstall(dstDir);
  } catch (err) {
    console.warn('npm install failed:', err.stack);
  }

  console.log('\nCreated agent at', ansi.link(path.resolve(dstDir)), '\n');
  // console.log(pc.green('Name:'), agentJson.name);
  // // console.log(pc.green('ID:'), agentJson.id, '\n');
  // console.log(pc.green('Description:'), agentJson.description);
  // console.log(pc.green('Bio:'), agentJson.bio, '\n');
};