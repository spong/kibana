/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import type { RouteComponentProps } from 'react-router-dom';
import { WorkflowGenerator } from '@kbn/elastic-assistant/impl/workflow_generation/workflow_generator';
import { EuiHorizontalRule } from '@elastic/eui';
import { SecuritySolutionPageWrapper } from '../../common/components/page_wrapper';
import { Title } from '../../common/components/header_page/title';
import { WORKFLOW_GENERATION } from '../../app/translations';

type WorkflowGenerationPageProps = RouteComponentProps<{ workflowId?: string }>;

export const WorkflowGenerationPage: React.FC<WorkflowGenerationPageProps> = React.memo(
  ({
    match: {
      params: { workflowId },
    },
  }) => {
    return (
      <SecuritySolutionPageWrapper>
        <Title title={WORKFLOW_GENERATION} />
        <EuiHorizontalRule />
        <WorkflowGenerator />
      </SecuritySolutionPageWrapper>
    );
  }
);
WorkflowGenerationPage.displayName = 'WorkflowGenerationPage';
