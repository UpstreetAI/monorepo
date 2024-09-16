'use client';

import { Button } from '@/components/ui/button';
import { aiHost } from '@/utils/const/endpoints';
import React, { useState } from 'react';
import { getJWT } from '@/lib/jwt';

const devSuffix = `_test`;

const AddCreditForm = () => {
  const [amount, setAmount] = useState(50);

  const handleAmountChange = (value: number) => {
    setAmount(value);
  };

  const handlePayment = async () => {
    console.log(`Requesting checkout session for ${amount}`);
    const jwt = await getJWT();
    const success_url = location.href;

    const res = await fetch(`${aiHost}/stripe${devSuffix}/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        amount: amount,
        args: {
          success_url,
        },
      }),
    });
    if (res.ok) {
      const j = await res.json();
      const { id, url } = j;
      location.href = url;
    } else {
      console.warn('failed to create checkout session:', res.status);
    }
  };

  return (
    <div className="flex flex-col m-auto w-full max-w-4xl mt-0 md:mt-4">
      <div className="w-full m-auto my-4 border rounded-md p border-zinc-700">
        <div className="px-5 py-4">
          <h3 className="mb-1 text-2xl font-medium">Add Credit</h3>
        </div>
        <div className="p-4 border-t rounded-b-md border-zinc-700 text-zinc-500">
          <div className="flex space-x-2 mb-4">
            <div className="flex space-x-2">
              {[25, 50, 100].map((value) => (
                <Button
                  key={value}
                  onClick={() => handleAmountChange(value)}
                  variant={amount === value ? "default" : "outline"}
                >
                  ${value}
                </Button>
              ))}
            </div>
            <div className="mb-4">
              <label htmlFor="amount" className="block text-sm font-medium text-zinc-300">
                Amount
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-zinc-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  name="amount"
                  id="amount"
                  className="bg-white text-black focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-zinc-700 rounded-md"
                  placeholder="0.00"
                  value={amount || ''}
                  onChange={(e) => handleAmountChange(Number(e.target.value.trim()))}
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                  }}
                />
              </div>
            </div>
          </div>
          <Button onClick={handlePayment} className="w-full">
            Pay with Card
          </Button>
        </div>
      </div>
    </div>
  );
};

export function TopUp() {
  return (
    <div>
      <div className="sm:flex sm:flex-col sm:align-center py-2 md:py-4">
        <h1 className="text-2xl font-extrabold text-white sm:text-center sm:text-4xl">
          Add Credit
        </h1>
        <p className="max-w-2xl m-auto md:mt-4 text-lg text-zinc-200 sm:text-center sm:text-xl">
          Top up your account balance.
        </p>
      </div>
      <AddCreditForm />
    </div>
  );
}
