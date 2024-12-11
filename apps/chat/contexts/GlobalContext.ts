'use client'

import { createContainer } from 'react-tracked';
import { env } from '@/lib/env';
import React, { useState } from 'react';
import { GlobalState } from '@/lib/types';

const initialGlobalState: GlobalState = {
    isDevMode: env.NEXT_PUBLIC_ENVIRONMENT === 'development' ? true : false,
    mode: null, // Ex: { name: 'desktop', mainBackgroundClass: '' }
};

const useGlobalStateInternal = () => useState<GlobalState>(initialGlobalState);

export const {
    Provider: GlobalStateProvider,
    useTracked: useGlobalState
} = createContainer(useGlobalStateInternal);