/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { createMemoryHistory } from 'history';
import {
  coreMock,
  notificationServiceMock,
  httpServiceMock,
  docLinksServiceMock,
  applicationServiceMock,
} from '@kbn/core/public/mocks';

import type { ObjectStorageClient } from '../../../common/types';
import { HistoryMock } from '../../services/history.mock';
import { SettingsMock } from '../../services/settings.mock';
import { StorageMock } from '../../services/storage.mock';
import { AutocompleteInfoMock } from '../../services/autocomplete.mock';
import { createApi, createEsHostService } from '../lib';

import { ContextValue } from './services_context';
import { dataViewPluginMocks } from '@kbn/data-views-plugin/public/mocks';
import { licensingMock } from '@kbn/licensing-plugin/public/mocks';
import { dataPluginMock } from '@kbn/data-plugin/public/mocks';

const coreStart = coreMock.createStart();

export const serviceContextMock = {
  create: (): ContextValue => {
    const storage = new StorageMock({} as unknown as Storage, 'test');
    const http = httpServiceMock.createSetupContract();
    const api = createApi({ http });
    const esHostService = createEsHostService({ api });
    (storage.keys as jest.Mock).mockImplementation(() => []);
    return {
      ...coreStart,
      services: {
        trackUiMetric: { count: () => {}, load: () => {} },
        storage,
        esHostService,
        settings: new SettingsMock(storage),
        routeHistory: createMemoryHistory(),
        history: new HistoryMock(storage),
        notifications: notificationServiceMock.createStartContract(),
        objectStorageClient: {} as unknown as ObjectStorageClient,
        http,
        autocompleteInfo: new AutocompleteInfoMock(),
        application: applicationServiceMock.createStartContract(),
        dataViews: dataViewPluginMocks.createStartContract(),
        data: dataPluginMock.createStartContract(),
        licensing: licensingMock.createStart(),
      },
      docLinkVersion: 'NA',
      docLinks: docLinksServiceMock.createStartContract().links,
      config: {
        isDevMode: false,
      },
    };
  },
};
