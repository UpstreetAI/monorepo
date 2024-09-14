'use client';

import React, { useState, useMemo } from 'react'
import { z } from 'zod';
import dedent from 'dedent';
import { useSupabase } from '@/lib/hooks/use-supabase'
import { ProfileImage } from '@/components/account/profile-image'
import { Button } from '@/components/ui/button';
import { getJWT } from '@/lib/jwt';
import { blob2img } from '@/lib/blob';
import {
  generateCharacterImage,
} from 'react-agents/util/generate-image.mjs';
import {
  fetchJsonCompletion,
} from 'react-agents/util/fetch.mjs';
import { generationModel } from 'usdk/const.js';
import {
  r2EndpointUrl,
} from 'react-agents/util/endpoints.mjs';
import {
  AuxImages,
} from '@/components/aux-images';

import DevMode from '@/components/development';

export interface ProfileProps {
  user: any,
  userIsCurrentUser: boolean,
}

export function Profile({
  user: userInit,
  userIsCurrentUser,
}: ProfileProps) {
  const { supabase } = useSupabase();

  const [user, setUser] = useState(() => userInit);
  const [name, _setName] = useState<string>(user.name);
  const setName = (name: string) => {
    _setName(name);
    // user.name = name;
  };
  const [bio, _setBio] = useState<string>(user.playerSpec.bio);
  const setBio = (bio: string) => {
    _setBio(bio);
    // user.playerSpec.bio = bio;
  };
  const [visualDescription, _setVisualDescription] = useState<string>(user.playerSpec.visualDescription);
  const setVisualDescription = (visualDescription: string) => {
    _setVisualDescription(visualDescription);
    // user.playerSpec.visualDescription = visualDescription;
  };

  const saveInfo = async () => {
    const o = {
      name,
      playerSpec: {
        ...user.playerSpec,
        bio,
        visualDescription,
      },
    };
    const result = await supabase
      .from('accounts')
      .update(o)
      .eq('id', user.id);
    const { error } = result;
    if (error) {
      console.error(error)
    }
  };

  const ensureAutofill = async () => {
    const oldObject = {} as any;
    const typeObject = {} as any;
    if (name) {
      oldObject.name = name;
    } else {
      typeObject.name = z.string();
    }
    if (bio) {
      oldObject.bio = bio;
    } else {
      typeObject.bio = z.string();
    }
    if (visualDescription) {
      oldObject.visualDescription = visualDescription;
    } else {
      typeObject.visualDescription = z.string();
    }

    if (Object.keys(typeObject).length > 0) {
      const messages = [
        {
          role: 'system',
          content: dedent`\
            Generate a JSON based character profile on behalf of the user by filling in the missing fields.
            The \`visualDescription\` should be an image prompt to use for an image generator. Visually describe the character without referring to their pose or emotion.
            e.g. 'teen girl with medium blond hair and blue eyes, purple dress, green hoodie, jean shorts, sneakers'
          `,
        },
        {
          role: 'user',
          content: dedent`\
            The current state of the user profile is:
            \`\`\`
          ` + '\n' +
            JSON.stringify(oldObject, null, 2) + '\n' +
            dedent`
              \`\`\`
            `,
        }
      ];
      const format = z.object(typeObject);

      const updateObject = await fetchJsonCompletion({
        // model: 'profile',
        model: generationModel,
        messages,
        // stream: false,
        // signal: undefined,
      }, format, {
        jwt: await getJWT(),
      });
      if ('name' in updateObject) {
        setUser((user: any) => ({
          ...user,
          name: updateObject.name,
        }));
        setName(updateObject.name);
      }
      if ('bio' in updateObject) {
        setUser((user: any) => ({
          ...user,
          playerSpec: {
            ...user.playerSpec,
            bio: updateObject.bio,
          },
        }));
        setBio(updateObject.bio);
      }
      if ('visualDescription' in updateObject) {
        setUser((user: any) => ({
          ...user,
          playerSpec: {
            ...user.playerSpec,
            visualDescription: updateObject.visualDescription,
          },
        }));
        setVisualDescription(updateObject.visualDescription);
      }
    }
  };
  const generatePfp = async () => {
    await ensureAutofill();

    const prompt = visualDescription;
    const jwt = await getJWT();
    const {
      fullPrompt,
      blob,
    } = await generateCharacterImage(prompt, undefined, {
      jwt,
    });

    const img = await blob2img(blob);
    img.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 300px;
      z-index: 9999;
    `;
    document.body.appendChild(img);

    // upload the image to r2
    const guid = crypto.randomUUID();
    const res = await fetch(`${r2EndpointUrl}/${guid}/avatar.webp`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    });
    const imgUrl = await res.json();
    console.log('uploaded image', imgUrl);
    // update the rendered user
    setUser((user: any) => ({
      ...user,
      preview_url: imgUrl,
    }));
    // save the image to the account
    const result = await supabase
      .from('accounts')
      .update({
        preview_url: imgUrl,
      })
      .eq('id', user.id);
    const { error } = result;
    if (error) {
      console.error('Error updating user', error);
    }
  };

  return (
    <div className="m-auto w-full max-w-4xl">
      <div className="sm:flex sm:flex-col sm:align-center py-2 md:py-4">
        <h1 className="text-2xl font-extrabold text-white sm:text-center sm:text-4xl">
          Profile
        </h1>
        <p className="max-w-2xl m-auto md:mt-4 text-lg text-zinc-200 sm:text-center sm:text-xl">
          Update your profile information.
        </p>
      </div>
      <div className="w-full m-auto my-4 border rounded-md p border-zinc-700">
        <div className="px-5 py-4">
          <div className="mt-5 mb-4 text-xl text-center font-semibold md:flex">
            <div
              className="flex flex-col items-start"
            >
              <ProfileImage
                className='mb-2'
                user={user}
                setUser={setUser}
                userIsCurrentUser={userIsCurrentUser}
              />
              <Button
                onClick={generatePfp}
              >
                Generate
              </Button>
            </div>
            <div className='flex flex-col w-full mt-4 md:mt-0 items-end'>
              <input
                type="text"
                name="fullName"
                className="w-full p-3 rounded-md bg-zinc-800 mb-2"
                placeholder="Display name"
                maxLength={64}
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <textarea
                name="fullName"
                className="w-full h-32 p-3 rounded-md bg-zinc-800 mb-2 text-sm"
                value={bio}
                placeholder="Bio"
                onChange={e => setBio(e.target.value)}
              />
              <textarea
                name="visualDescription"
                className="w-full h-12 p-3 rounded-md bg-zinc-800 mb-2 text-sm"
                value={visualDescription}
                placeholder="Visual description"
                onChange={e => setVisualDescription(e.target.value)}
              />
              <div className="flex flex-row items-center justify-end">
                <Button
                  onClick={ensureAutofill}
                  className="mr-2"
                >
                  Autofill
                </Button>
                <Button
                  onClick={saveInfo}
                // className="mr-2"
                >
                  Save Info
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DevMode>
          <div className="p-4 border-t rounded-b-md border-zinc-700 text-zinc-500">
            <div className="flex flex-col items-start justify-start">
              <AuxImages
                user={user}
                setUser={setUser}
                visualDescription={visualDescription}
                generate
              />
            </div>
          </div>
        </DevMode>
        
      </div>
    </div>
  )
}
