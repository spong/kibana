/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  API_VERSIONS,
  CreateActionRequestBody,
  CreateActionResponse,
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
} from '@kbn/elastic-assistant-common';
import { buildRouteValidationWithZod } from '@kbn/elastic-assistant-common/impl/schemas/common';
import { IKibanaResponse } from '@kbn/core/server';
import { buildResponse } from '../../lib/build_response';
import { ElasticAssistantPluginRouter } from '../../types';
import { performChecks } from '../helpers';

const ROUTE_HANDLER_TIMEOUT = 20 * 60 * 1000; // 20 * 60 seconds = 20 minutes

/**
 * Create Workflow Action
 * @param router
 */
export const postWorkflowActionRoute = (router: ElasticAssistantPluginRouter) => {
  router.versioned
    .post({
      access: 'internal',
      path: ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
      security: {
        authz: {
          requiredPrivileges: ['elasticAssistant'],
        },
      },
      options: {
        timeout: {
          idleSocket: ROUTE_HANDLER_TIMEOUT,
        },
      },
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v1,
        validate: {
          request: {
            body: buildRouteValidationWithZod(CreateActionRequestBody),
          },
        },
      },
      async (context, request, response): Promise<IKibanaResponse<CreateActionResponse>> => {
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
          logger.info(`Creating action`);
          const exampleAction: CreateActionResponse = {
            success: true,
            actionId: 'example-action-id',
            message: 'Action created successfully',
          };

          return response.ok({ body: exampleAction });
        } catch (error) {
          return resp.error({
            body: error.message,
            statusCode: 500,
          });
        }
      }
    );
};
