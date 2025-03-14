/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import {
  SecurityPageName,
  SECURITY_FEATURE_ID,
  WORKFLOW_GENERATION_PATH,
} from '../../common/constants';
import { WORKFLOW_GENERATION } from '../app/translations';
import type { LinkItem } from '../common/links';

export const workflowGenerationLinks: LinkItem = {
  id: SecurityPageName.workflowGeneration,
  experimentalKey: 'assistantWorkflowGenerationEnabled',
  title: WORKFLOW_GENERATION,
  description: i18n.translate('xpack.securitySolution.appLinks.workflowGenerationDescription', {
    defaultMessage: 'Generate and execute automated workflows and playbooks.',
  }),
  path: WORKFLOW_GENERATION_PATH,
  capabilities: [`${SECURITY_FEATURE_ID}.show`],
  skipUrlState: true,
  hideTimeline: true,
  globalNavPosition: 5,
  globalSearchKeywords: [
    i18n.translate('xpack.securitySolution.appLinks.workflowGenerationKeywords', {
      defaultMessage: 'Workflow Generation Playbook Automation',
    }),
  ],
  isBeta: true,
  betaOptions: {
    text: i18n.translate('xpack.securitySolution.appLinks.workflowGenerationTechnicalPreview', {
      defaultMessage: 'Technical Preview',
    }),
  },
  licenseType: 'enterprise',
};
