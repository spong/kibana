/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { HttpSetup, type IHttpFetchError, type ResponseErrorBody } from '@kbn/core/public';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { IToasts } from '@kbn/core-notifications-browser';
import {
  API_VERSIONS,
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
  GetActionsResponse,
} from '@kbn/elastic-assistant-common';

import { useCallback } from 'react';
import { i18n } from '@kbn/i18n';

export interface UseWorkflowActionsParams {
  http: HttpSetup;
  signal?: AbortSignal | undefined;
  toasts?: IToasts;
  enabled?: boolean; // For disabling if FF is off
  isRefetching?: boolean; // For enabling polling
}

const WORKFLOW_ACTIONS_QUERY_KEY = [
  ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL,
  API_VERSIONS.internal.v1,
];

/**
 * Hook for fetching Workflow Actions
 *
 * @param {Object} options - The options object.
 * @param {HttpSetup} options.http - HttpSetup
 * @param {AbortSignal} [options.signal] - AbortSignal
 *
 * @returns hook for fetching Workflow Actions
 */
export const useWorkflowActions = ({
  http,
  signal,
  toasts,
  enabled = false,
  isRefetching = false,
}: UseWorkflowActionsParams) =>
  useQuery(
    WORKFLOW_ACTIONS_QUERY_KEY,
    async () =>
      http.fetch<GetActionsResponse>(ELASTIC_AI_ASSISTANT_WORKFLOW_GENERATION_ACTION_URL, {
        method: 'GET',
        version: API_VERSIONS.internal.v1,
        signal,
      }),
    {
      enabled,
      keepPreviousData: true,
      initialData: [],
      refetchInterval: isRefetching ? 30000 : false,
      onError: (error: IHttpFetchError<ResponseErrorBody>) => {
        if (error.name !== 'AbortError') {
          toasts?.addError(error, {
            title: i18n.translate('xpack.elasticAssistant.workflowGeneration.actionFetchError', {
              defaultMessage: 'Error fetching Workflow Actions',
            }),
          });
        }
      },
    }
  );

/**
 * Use this hook to invalidate the Workflow Actions cache. For example, adding,
 * editing, or deleting any Workflow Actions should lead to cache invalidation.
 *
 * @returns {Function} - Function to invalidate the Workflow Actions cache
 */
export const useInvalidateWorkflowActions = () => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries(WORKFLOW_ACTIONS_QUERY_KEY, {
      refetchType: 'active',
    });
  }, [queryClient]);
};
