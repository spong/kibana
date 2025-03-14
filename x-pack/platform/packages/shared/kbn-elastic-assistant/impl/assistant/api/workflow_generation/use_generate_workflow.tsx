/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useMutation } from '@tanstack/react-query';
import type { HttpSetup, IHttpFetchError, ResponseErrorBody } from '@kbn/core-http-browser';
import type { IToasts } from '@kbn/core-notifications-browser';
import { i18n } from '@kbn/i18n';

import {
  API_VERSIONS,
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_GENERATE_URL,
  GenerateWorkflowRequestBody,
  GenerateWorkflowResponse,
} from '@kbn/elastic-assistant-common';

const GENERATE_WORKFLOW_MUTATION_KEY = [
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_GENERATE_URL,
  API_VERSIONS.internal.v1,
];

export interface UseGenerateWorkflowParams {
  http: HttpSetup;
  signal?: AbortSignal;
  toasts?: IToasts;
}

/**
 * Hook for generating a Workflow
 *
 * @param {Object} options - The options object
 * @param {HttpSetup} options.http - HttpSetup
 * @param {AbortSignal} [options.signal] - AbortSignal
 * @param {IToasts} [options.toasts] - IToasts
 *
 * @returns mutation hook for generating a Workflow
 *
 */
export const useGenerateWorkflow = ({ http, signal, toasts }: UseGenerateWorkflowParams) => {
  return useMutation(
    GENERATE_WORKFLOW_MUTATION_KEY,
    (requestBody: GenerateWorkflowRequestBody) => {
      return http.post<GenerateWorkflowResponse>(
        ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_GENERATE_URL,
        {
          body: JSON.stringify(requestBody),
          version: API_VERSIONS.internal.v1,
          signal,
        }
      );
    },
    {
      onError: (error: IHttpFetchError<ResponseErrorBody>) => {
        if (error.name !== 'AbortError') {
          toasts?.addError(
            error.body && error.body.message ? new Error(error.body.message) : error,
            {
              title: i18n.translate(
                'xpack.elasticAssistant.workflowGeneration.generateErrorTitle',
                {
                  defaultMessage: 'Error generating workflow',
                }
              ),
            }
          );
        }
      },
      onSettled: () => {
        // invalidateWorkflows();
      },
      onSuccess: () => {
        toasts?.addSuccess({
          title: i18n.translate('xpack.elasticAssistant.workflowGeneration.generateSuccessTitle', {
            defaultMessage: 'Workflow generated successfully',
          }),
        });
      },
    }
  );
};
