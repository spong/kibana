/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { transformError } from '@kbn/securitysolution-es-utils';

import {
  API_VERSIONS,
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
  GetActionsResponse,
} from '@kbn/elastic-assistant-common';
import { buildResponse } from '../../lib/build_response';
import { ElasticAssistantPluginRouter } from '../../types';
import { performChecks } from '../helpers';

/**
 * Get Workflow Actions
 * @param router
 */
export const getWorkflowActionsRoute = (router: ElasticAssistantPluginRouter) => {
  router.versioned
    .get({
      access: 'internal',
      path: ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
      security: {
        authz: {
          requiredPrivileges: ['elasticAssistant'],
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v1,
        validate: {},
      },
      async (context, request, response) => {
        const resp = buildResponse(response);
        const ctx = await context.resolve(['core', 'elasticAssistant', 'licensing']);
        const assistantContext = ctx.elasticAssistant;
        const logger = assistantContext.logger.get('workflowGeneration');

        // Perform license, authenticated user and evaluation FF checks
        const checkResponse = await performChecks({
          capability: 'assistantWorkflowGenerationEnabled',
          context: ctx,
          request,
          response,
        });

        if (!checkResponse.isSuccess) {
          return checkResponse.response;
        }

        try {
          logger.info('Fetching Workflow Actions');
          const exampleActions: GetActionsResponse = [
            {
              actionId: 'example-action-id-1',
              name: 'Example Action 1',
              url: 'https://example.com/action1',
              apiKey: 'example-api-key-1',
              openApiSpec: null,
            },
            {
              actionId: 'example-action-id-2',
              name: 'Example Action 2',
              url: 'https://example.com/action2',
              apiKey: 'example-api-key-2',
              openApiSpec: null,
            },
          ];
          return response.ok({ body: exampleActions });
        } catch (err) {
          logger.error(err);
          const error = transformError(err);

          return resp.error({
            body: error.message,
            statusCode: error.statusCode,
          });
        }
      }
    );
};
