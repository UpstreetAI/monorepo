import { getLoginJwt } from '../util/login-util.mjs';
import {
  makeAnonymousClient,
  getUserIdForJwt,
} from '../packages/upstreet-agent/packages/react-agents/util/supabase-client.mjs';
import {
  env,
} from './env.mjs';

export const status = async (args) => {
  const jwt = await getLoginJwt();
  if (jwt !== null) {
    const userId = await getUserIdForJwt(jwt);

    const supabase = makeAnonymousClient(env, jwt);
    const result = await supabase
      .from('accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    const { error, data } = result;
    if (!error) {
      console.log('user', data);

      const { active_asset } = data;
      if (active_asset) {
        // print the currently worn character
        const assetResult = await supabase
          .from('assets')
          .select('*')
          .eq('id', active_asset)
          .eq('type', 'npc')
          .maybeSingle();
        const { error, data } = assetResult;
        if (!error) {
          if (data) {
            console.log('wearing', data);
          } else {
            console.warn('failed to fetch worn avatar', active_asset);
          }
        } else {
          console.log(`could not get asset ${userId}: ${error}`);
        }
      } else {
        console.log('not wearing an avatar');
      }
    } else {
      console.log(`could not get account ${userId}: ${error}`);
    }
  } else {
    console.log('not logged in');
  }
};