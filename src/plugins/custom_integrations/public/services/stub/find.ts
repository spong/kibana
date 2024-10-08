/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { CustomIntegrationsFindService, filterCustomIntegrations } from '../find';
import { PluginServiceFactory } from '../types';
import { CustomIntegrationsStartDependencies } from '../../types';

/**
 * A type definition for a factory to produce the `CustomIntegrationsFindService` with stubbed output.
 */
export type CustomIntegrationsFindServiceFactory = PluginServiceFactory<
  CustomIntegrationsFindService,
  CustomIntegrationsStartDependencies
>;

/**
 * A factory to produce the `CustomIntegrationsFindService` with stubbed output.
 */
export const findServiceFactory: CustomIntegrationsFindServiceFactory = () => ({
  findAppendedIntegrations: async (params) => {
    const { integrations } = await import('./fixtures/integrations');
    return filterCustomIntegrations(integrations, params);
  },
  findReplacementIntegrations: async (params) => {
    const { integrations } = await import('./fixtures/integrations');
    return filterCustomIntegrations(integrations, params);
  },
});
