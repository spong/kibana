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
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_EXECUTE_URL,
  ExecuteWorkflowRequestBody,
  ExecuteWorkflowResponse,
} from '@kbn/elastic-assistant-common';

const EXECUTE_WORKFLOW_MUTATION_KEY = [
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_EXECUTE_URL,
  API_VERSIONS.internal.v1,
];

export interface UseExecuteWorkflowParams {
  http: HttpSetup;
  signal?: AbortSignal;
  toasts?: IToasts;
}

/**
 * Hook for executing a workflow
 *
 * @param {Object} options - The options object
 * @param {HttpSetup} options.http - HttpSetup
 * @param {AbortSignal} [options.signal] - AbortSignal
 * @param {IToasts} [options.toasts] - IToasts
 *
 * @returns mutation hook for executing a workflow
 *
 */
export const useExecuteWorkflow = ({ http, signal, toasts }: UseExecuteWorkflowParams) => {
  return useMutation(
    EXECUTE_WORKFLOW_MUTATION_KEY,
    (requestBody: ExecuteWorkflowRequestBody) => {
      return http.post<ExecuteWorkflowResponse>(
        ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_EXECUTE_URL,
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
              title: i18n.translate('xpack.elasticAssistant.workflowGeneration.executeErrorTitle', {
                defaultMessage: 'Error executing workflow',
              }),
            }
          );
        }
      },
      onSuccess: () => {
        toasts?.addSuccess({
          title: i18n.translate('xpack.elasticAssistant.workflowGeneration.executeSuccessTitle', {
            defaultMessage: 'Workflow executed successfully',
          }),
        });
      },
    }
  );
};
