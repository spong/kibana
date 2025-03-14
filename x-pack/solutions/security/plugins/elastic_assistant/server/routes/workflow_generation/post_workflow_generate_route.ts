/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  API_VERSIONS,
  GenerateWorkflowRequestBody,
  GenerateWorkflowResponse,
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_GENERATE_URL,
} from '@kbn/elastic-assistant-common';
import { buildRouteValidationWithZod } from '@kbn/elastic-assistant-common/impl/schemas/common';
import { IKibanaResponse } from '@kbn/core/server';
import { buildResponse } from '../../lib/build_response';
import { ElasticAssistantPluginRouter } from '../../types';
import { performChecks } from '../helpers';

const ROUTE_HANDLER_TIMEOUT = 20 * 60 * 1000; // 20 * 60 seconds = 20 minutes

/**
 * Generate workflow from prompt and actions
 * @param router
 */
export const postWorkflowGenerateRoute = (router: ElasticAssistantPluginRouter) => {
  router.versioned
    .post({
      access: 'internal',
      path: ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_GENERATE_URL,
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
            body: buildRouteValidationWithZod(GenerateWorkflowRequestBody),
          },
        },
      },
      async (context, request, response): Promise<IKibanaResponse<GenerateWorkflowResponse>> => {
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
          logger.info(`Generating workflow`);
          const exampleWorkflow: GenerateWorkflowResponse = {
            success: true,
            workflowId: 'example-workflow-id',
            message: 'Workflow generated successfully',
          };

          return response.ok({ body: exampleWorkflow });
        } catch (error) {
          return resp.error({
            body: error.message,
            statusCode: 500,
          });
        }
      }
    );
};
