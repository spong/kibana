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
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
  CreateActionRequestBody,
  CreateActionResponse,
} from '@kbn/elastic-assistant-common';
import { useInvalidateWorkflowActions } from './use_workflow_actions';

const CREATE_ACTION_MUTATION_KEY = [
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
  API_VERSIONS.internal.v1,
];

export interface UseCreateActionParams {
  http: HttpSetup;
  signal?: AbortSignal;
  toasts?: IToasts;
}

/**
 * Hook for creating a Workflow Action
 *
 * @param {Object} options - The options object
 * @param {HttpSetup} options.http - HttpSetup
 * @param {AbortSignal} [options.signal] - AbortSignal
 * @param {IToasts} [options.toasts] - IToasts
 *
 * @returns mutation hook for creating an Action
 *
 */
export const useCreateWorkflowAction = ({ http, signal, toasts }: UseCreateActionParams) => {
  const invalidateActions = useInvalidateWorkflowActions();

  return useMutation(
    CREATE_ACTION_MUTATION_KEY,
    (action: CreateActionRequestBody) => {
      return http.post<CreateActionResponse>(ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL, {
        body: JSON.stringify(action),
        version: API_VERSIONS.internal.v1,
        signal,
      });
    },
    {
      onError: (error: IHttpFetchError<ResponseErrorBody>) => {
        if (error.name !== 'AbortError') {
          toasts?.addError(
            error.body && error.body.message ? new Error(error.body.message) : error,
            {
              title: i18n.translate(
                'xpack.elasticAssistant.workflowGeneration.actionCreateErrorTitle',
                {
                  defaultMessage: 'Error creating Action',
                }
              ),
            }
          );
        }
      },
      onSettled: () => {
        invalidateActions();
      },
      onSuccess: () => {
        toasts?.addSuccess({
          title: i18n.translate(
            'xpack.elasticAssistant.workflowGeneration.actionCreateSuccessTitle',
            {
              defaultMessage: 'Action created',
            }
          ),
        });
      },
    }
  );
};
