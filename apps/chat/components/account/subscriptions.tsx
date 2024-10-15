'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import React, { useState } from 'react'
import { getJWT } from '@/lib/jwt';
import { cn } from '@/lib/utils'
import { LoginButton } from '../ui/Header/login-button';
import { createSession, cancelPlan } from 'react-agents/util/stripe-utils.mjs';

//

export interface AccountPrivateUiProps {
  user: any
  userPrivate: any
}

//

const plans = [
  {
    name: 'free',
    value: 0,
    currency: `$`,
    interval: 'mo'
  },
  {
    name: 'hobby',
    value: 20,
    currency: `$`,
    interval: 'mo'
  },
  {
    name: 'developer',
    value: 50,
    currency: `$`,
    interval: 'mo'
  },
  {
    name: 'business',
    value: 200,
    currency: `$`,
    interval: 'mo'
  },
];
const creditUnit = 1000; // is multiplied by the value in plans array

//

const SubscriptionPlans = ({
  user,
  userPrivate,
  setUserPrivate,
}: {
  user: any;
  userPrivate: any;
  setUserPrivate: (userPrivate: any) => void;
}) => {
  const {
    plan: currentPlan,
  }: {
    plan: string;
  } = userPrivate;
  const [selectedPlan, setSelectedPlan] = useState(() => currentPlan);

  return (
    <div>
      <div className="mt-4 md:mt-8 space-y-4 sm:mt-8 sm:space-y-0 md:flex md:flex-wrap justify-center gap-6 lg:mx-auto xl:max-w-none xl:mx-0">
        {plans.map((plan, i) => {
          const {
            name,
            currency,
            value,
            interval
          } = plan;
          return (
            <div
              key={i}
              className={cn(
                'flex flex-col shadow-sm divide-y divide-zinc-600 bg-zinc-900 border rounded-md border-zinc-700',
                {
                  'border border-pink-500': name === selectedPlan || !selectedPlan && name === 'free',
                },
                'flex-1',
                'basis-1/6',
                'md:max-w-xs'
              )}
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold leading-6 text-white capitalize">
                  {name}
                </h2>
                <p className="mt-4 text-zinc-300">{value ? (value * creditUnit) + ' Credits' : '5000 Credits'}</p>
                <p className="mt-8">
                  <span className="text-5xl font-extrabold white">
                    {value > 0 ? `${currency}${value}` : '$0'}
                  </span>
                  <span className="text-base font-medium text-zinc-100">
                    {value > 0 ? `/${interval}` : '/mo'}
                  </span>
                </p>
                {value > 0 ?
                  <Button
                    className='w-full mt-8'
                    disabled={currentPlan === name}
                    onClick={async (e) => {
                      const jwt = await getJWT();
                      const success_url = location.href;
                      const j = await createSession({
                        plan: name,
                        args: {
                          success_url,
                        },
                      }, {
                        jwt,
                      });
                      const {
                        // id,
                        url,
                      } = j;
                      location.href = url;
                    }}
                  >
                    {currentPlan !== name ? 'Subscribe' : 'Current'}
                  </Button>
                  :
                  (currentPlan && <Button
                    className='w-full mt-8'
                    onClick={async (e) => {
                      const jwt = await getJWT();
                      await cancelPlan({
                        jwt,
                      });
                      setUserPrivate((userPrivate: object) => {
                        return {
                          ...userPrivate,
                          stripe_subscription_id: null,
                          plan: null,
                        };
                      });
                    }}
                  >
                    Cancel
                  </Button>)
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SubscriptionPlansPublic = () => {
  return (
    <div>
      <div className="mt-4 md:mt-8 space-y-4 sm:mt-8 sm:space-y-0 md:flex md:flex-wrap justify-center gap-6 lg:mx-auto xl:max-w-none xl:mx-0">
        {plans.map((plan, i) => {
          const { name, currency, value, interval } = plan;
          return (
            <div
              key={i}
              className={cn(
                'md:w-[25%] flex flex-col shadow-sm divide-y divide-zinc-600 bg-zinc-900 border rounded-md border-zinc-700',
                'flex-1',
                'basis-1/6',
                'md:max-w-xs'
              )}
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold leading-6 text-white capitalize">
                  {name}
                </h2>
                <p className="mt-4 text-zinc-300">{value ? (value * creditUnit) + ' Credits' : '5000 Credits'}</p>
                <p className="mt-8">
                  <span className="text-5xl font-extrabold white">
                    {value > 0 ? `${currency}${value}` : '$0'}
                  </span>
                  <span className="text-base font-medium text-zinc-100">
                    {value > 0 ? `/${interval}` : '/m'}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
        <div className='w-full text-center'>
          <LoginButton className='text-xl' text="Login to you account to subscribe!" />
        </div>
      </div>
    </div>
  );
};

const Subscriptions = ({
  user,
  userPrivate,
  setUserPrivate,
}: {
  user: any,
  userPrivate: any,
  setUserPrivate: (userPrivate: any) => void;
}) => {
  return (
    <>
      <div className="sm:flex sm:flex-col sm:align-center py-2 md:py-4">
        <h1 className="text-2xl font-extrabold text-white sm:text-center sm:text-4xl">
          Subscription Plans
        </h1>
        <p className="max-w-2xl m-auto md:mt-4 text-lg text-zinc-200 sm:text-center sm:text-xl">
          Subscribe to a plan to get monthly credits.
        </p>
      </div>
      {user ?
        <SubscriptionPlans user={user} userPrivate={userPrivate} setUserPrivate={setUserPrivate} />
        :
        <SubscriptionPlansPublic />
      }
    </>
  );
}

export function AccountSubscriptions({
  user,
  userPrivate: initUserPrivate,
}: AccountPrivateUiProps) {
  const [userPrivate, setUserPrivate] = useState(() => initUserPrivate);
  return (
    <div className='w-full'>
      <Subscriptions user={user} userPrivate={userPrivate} setUserPrivate={setUserPrivate} />
    </div>
  );
}
