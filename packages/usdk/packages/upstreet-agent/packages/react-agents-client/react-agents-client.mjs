import {
  multiplayerEndpointUrl,
} from '../react-agents/util/endpoints.mjs';
import { NetworkRealms } from './packages/multiplayer/public/network-realms.mjs'; // XXX should be a deduplicated import, in a separate npm module
// import { webbrowserActionsToText } from './packages/upstreet-agent/packages/react-agents/util/browser-action-utils.mjs';
import {
  Player,
} from './util/player.mjs';
import {
  PlayersMap,
  TypingMap,
  SpeakerMap,
} from './util/maps.mjs';

export class ReactAgentsClient {
  url;
  constructor(url) {
    this.url = url;
  }
  async join(room, {
    only = false,
  } = {}) {
    const u = `${this.url}/join`;
    try {
      const opts = {
        room,
        only,
      };
      // console.log('join opts', opts);
      const joinReq = await fetch(u, {
        method: 'POST',
        body: JSON.stringify(opts),
      });
      if (joinReq.ok) {
        const joinJson = await joinReq.json();
        // console.log('join json', joinJson);
      } else if (joinReq.status === 404) {
        throw new Error('agent not found');
      } else {
        const text = await joinReq.text();
        throw new Error(
          'failed to join, status code: ' + joinReq.status + ': ' + text,
        );
      }
    } catch (err) {
      console.warn('join fetch failed', err);
      await new Promise((accept, reject) => {
        setTimeout(accept, 10000000);
      });
      throw err;
    }
  }
}

export class ReactAgentsMultiplayerConnection extends EventTarget {
  static logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };
  static defaultLogLevel = ReactAgentsMultiplayerConnection.logLevels.info;
  room;
  profile;
  metadata;
  playersMap = new PlayersMap();
  typingMap = new TypingMap();
  speakerMap = new SpeakerMap();
  realms;
  connectPromise;
  constructor({
    room,
    profile,
    metadata = {},
  }) {
    super();

    this.room = room;
    this.profile = profile;
    this.metadata = metadata;

    this.connectPromise = this.connect();
  }
  log(...args) {
    this.dispatchEvent(new MessageEvent('log', {
      data: {
        args,
        logLevel: ReactAgentsMultiplayerConnection.logLevels.info,
      },
    }));
  }
  async connect() {
    const {
      room,
      profile,
      playersMap,
      typingMap,
      speakerMap,
    } = this;
    const userId = profile.id;

    // join the room
    const realms = new NetworkRealms({
      endpointUrl: multiplayerEndpointUrl,
      playerId: userId,
    });
    this.realms = realms;
  
    // const virtualWorld = realms.getVirtualWorld();
    const virtualPlayers = realms.getVirtualPlayers();
  
    // this.log('waiting for initial connection...');
  
    let connected = false;
    const {
      promise: realmsConnectPromise,
      resolve: realmsConnectResolve,
      reject: realmsConnectReject,
    } = Promise.withResolvers();
    const onConnect = async (e) => {
      // this.log('on connect...');

      const existingAgentIds = Array.from(playersMap.getMap().keys());
      if (existingAgentIds.includes(userId)) {
        this.log('your character is already in the room! disconnecting.');
        realms.disconnect();
        return;
      }

      // initialize the local player
      const localPlayer = new Player(userId, profile);

      // push the local player to the network
      {
        const realmKey = e.data.rootRealmKey;
        realms.localPlayer.initializePlayer(
          {
            realmKey,
          },
          {},
        );
        realms.localPlayer.setKeyValue(
          'playerSpec',
          localPlayer.getPlayerSpec(),
        );
      }

      // add the local player to the players map
      playersMap.add(userId, localPlayer);

      connected = true;

      realmsConnectResolve();
    };
    realms.addEventListener('connect', onConnect);
  
    const _trackRemotePlayers = () => {
      virtualPlayers.addEventListener('join', (e) => {
        const { playerId, player } = e.data;
        const playerSpec = player.getKeyValue('playerSpec');
        if (connected) {
          // this.log('react agents client: remote player joined:', playerId);
        // } else {
        //   this.log('remote player joined before connection', playerId);
        //   throw new Error('remote player joined before connection: ' + playerId);
        }
  
        const remotePlayer = new Player(playerId, playerSpec);
        // do not add the player until it has the playerSpec set
        // we listen for the 'update' event below to handle this case
        // this can be implemented more synchronously, but it would require multiplayer server changes to initialize the player spec at join time
        if (remotePlayer.getPlayerSpec()) {
          playersMap.add(playerId, remotePlayer);
        }

        // Handle remote player state updates
        player.addEventListener('update', e => {
          const { key, val } = e.data;
          if (key === 'playerSpec') {
            remotePlayer.setPlayerSpec(val);
            if (!playersMap.has(playerId)) {
              playersMap.add(playerId, remotePlayer);
            }
          }
        });

        this.dispatchEvent(new MessageEvent('join', {
          data: e.data,
        }));
      });
      virtualPlayers.addEventListener('leave', e => {
        const { playerId } = e.data;
        if (connected) {
          // this.log('react agents client: remote player left:', playerId);
        // } else {
        //   this.log('remote player left before connection', playerId);
        //   throw new Error('remote player left before connection: ' + playerId);
        }
  
        // remove remote player
        const remotePlayer = playersMap.get(playerId);
        if (remotePlayer) {
          playersMap.remove(playerId);
        } else {
          this.log('remote player not found', playerId);
          throw new Error('remote player not found');
        }

        this.dispatchEvent(new MessageEvent('leave', {
          data: e.data,
        }));
      });
      // map multimedia events virtualPlayers -> playersMap
      [
        'audio',
        'audiostart',
        'audioend',
        'video',
        'videostart',
        'videoend',
      ].forEach(eventName => {
        virtualPlayers.addEventListener(eventName, e => {
          playersMap.dispatchEvent(new MessageEvent(eventName, {
            data: e.data,
          }));
          this.dispatchEvent(new MessageEvent(eventName, {
            data: e.data,
          }));
        });
      });
    };
    _trackRemotePlayers();
  
    const _bindMultiplayerChat = () => {
      const onchat = (e) => {
        this.dispatchEvent(new MessageEvent('chat', {
          data: e.data,
        }));
      };
      realms.addEventListener('chat', onchat);

      realms.addEventListener('disconnect', (e) => {
        this.dispatchEvent(new MessageEvent('disconnect', {
          data: e.data,
        }));

        playersMap.clear();
        typingMap.clear();
        speakerMap.clear();
      });
    };
    _bindMultiplayerChat();
  
    await realms.updateRealmsKeys({
      realmsKeys: [room],
      rootRealmKey: room,
    });

    await realmsConnectPromise;

    this.dispatchEvent(new MessageEvent('connect', {
      data: null,
    }));
  }
  disconnect() {
    this.realms.disconnect();
  }
  async waitForConnect() {
    return await this.connectPromise;
  }
  sendChatMessage(message) {
    return this.realms.sendChatMessage(message);
  }
  addAudioSource(audioSource) {
    return this.realms.addAudioSource(audioSource);
  }
  removeAudioSource(audioSource) {
    return this.realms.removeAudioSource(audioSource);
  }
  addVideoSource(videoSource) {
    return this.realms.addVideoSource(videoSource);
  }
  removeVideoSource(videoSource) {
    return this.realms.removeVideoSource(videoSource);
  }
}
export const connect = async ({
  room,
  profile,
}) => {
  const connection = new ReactAgentsMultiplayerConnection({
    room,
    profile,
  });
  await connection.waitForConnect();
  return connection;
};