import packageJson from '../../../../../package.json' with { type: 'json' };
import {
  defaultModels,
  defaultSmallModels,
  defaultLargeModels,
} from '../constants.mjs';
import {
  getCloudAgentHost,
} from '../agent-defaults.mjs';
import {
  getWalletFromMnemonic,
} from './ethereum-utils.mjs';

export const ensureAgentJsonDefaults = (spec) => {
  spec = {
    ...spec,
  };

  if (typeof spec.name !== 'string') {
    spec.name = 'AI Agent';
  }
  if (typeof spec.description !== 'string') {
    spec.description = 'Created by the AI Agent SDK';
  }
  if (typeof spec.bio !== 'string') {
    spec.bio = 'A cool AI';
  }
  if (typeof spec.ownerId !== 'string') {
    spec.ownerId = '';
  }
  if (typeof spec.model !== 'string') {
    spec.model = defaultModels[0];
  }
  if (typeof spec.smallModel !== 'string') {
    spec.smallModel = defaultSmallModels[0];
  }
  if (typeof spec.largeModel !== 'string') {
    spec.largeModel = defaultLargeModels[0];
  }
  if (typeof spec.startUrl !== 'string') {
    spec.startUrl = getCloudAgentHost(spec.id);
  }
  if (typeof spec.previewUrl !== 'string') {
    spec.previewUrl = '';
  }
  if (typeof spec.homespaceUrl !== 'string') {
    spec.homespaceUrl = '';
  }
  if (typeof spec.avatarUrl !== 'string') {
    spec.avatarUrl = '';
  }
  if (typeof spec.voiceEndpoint !== 'string') {
    spec.voiceEndpoint = 'elevenlabs:scillia:kNBPK9DILaezWWUSHpF9';
  }
  if (typeof spec.voicePack !== 'string') {
    spec.voicePack = 'ShiShi voice pack';
  }
  if (typeof spec.stripeConnectAccountId !== 'string') {
    spec.stripeConnectAccountId = '';
  }
  if (typeof spec.address !== 'string') {
    spec.address = '';
  }
  if (!Array.isArray(spec.capabilities)) {
    spec.capabilities = [];
  }
  if (typeof spec.version !== 'string') {
    spec.version = packageJson.version;
  }

  return spec;
};

export const updateAgentJsonAuth = (agentJsonInit, agentAuthSpec) => {
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

// export const updateAgentJsonVersionHash = (spec, versionHash) => {
//   spec.versionHash = versionHash;
//   return spec;
// };