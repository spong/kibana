/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { Routes, Route } from '@kbn/shared-ux-router';

import type { SecuritySubPluginRoutes } from '../app/types';
import { WORKFLOW_GENERATION_PATH, SecurityPageName } from '../../common/constants';
import { PluginTemplateWrapper } from '../common/components/plugin_template_wrapper';
import { SecurityRoutePageWrapper } from '../common/components/security_route_page_wrapper';
import { WorkflowGenerationPage } from './pages';

export const WorkflowGenerationRoutes = () => {
  return (
    <PluginTemplateWrapper>
      <SecurityRoutePageWrapper pageName={SecurityPageName.workflowGeneration}>
        <Routes>
          <Route
            path={`${WORKFLOW_GENERATION_PATH}/:workflowId?`}
            component={WorkflowGenerationPage}
          />
        </Routes>
      </SecurityRoutePageWrapper>
    </PluginTemplateWrapper>
  );
};

export const routes: SecuritySubPluginRoutes = [
  {
    path: WORKFLOW_GENERATION_PATH,
    component: WorkflowGenerationRoutes,
  },
];
