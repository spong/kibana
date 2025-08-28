/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  KnowledgeBaseStatusResponse,
  KnowledgeBaseSetupRequestQueryInput,
  KnowledgeBaseSetupResponse,
} from '@kbn/elastic-assistant-common';
import {
  API_VERSIONS,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_URL,
} from '@kbn/elastic-assistant-common';
import type { HttpSetup, IHttpFetchError } from '@kbn/core-http-browser';

/**
 * API call for getting the status of the Knowledge Base.
 *
 * @param {Object} options - The options object.
 * @param {HttpSetup} options.http - HttpSetup
 * @param {AbortSignal} [options.signal] - AbortSignal
 *
 * @returns {Promise<KnowledgeBaseStatusResponse | IHttpFetchError>}
 */
export const getKnowledgeBaseStatus = async ({
  http,
  signal,
}: {
  http: HttpSetup;
  signal?: AbortSignal | undefined;
}): Promise<KnowledgeBaseStatusResponse | IHttpFetchError> => {
  try {
    const response = await http.fetch(ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_URL, {
      method: 'GET',
      signal,
      version: API_VERSIONS.public.v1,
    });
    return response as KnowledgeBaseStatusResponse;
  } catch (error) {
    return error as IHttpFetchError;
  }
};

/**
 * API call for setting up the Knowledge Base.
 *
 * @param {Object} options - The options object.
 * @param {HttpSetup} options.http - HttpSetup
 * @param {KnowledgeBaseSetupRequestQueryInput} [options.query] - Query params for setup
 * @param {AbortSignal} [options.signal] - AbortSignal
 *
 * @returns {Promise<KnowledgeBaseSetupResponse>}
 */
export const postKnowledgeBase = async ({
  http,
  query,
  signal,
}: {
  http: HttpSetup;
  query?: KnowledgeBaseSetupRequestQueryInput;
  signal?: AbortSignal | undefined;
}): Promise<KnowledgeBaseSetupResponse> => {
  const response = await http.fetch(ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_URL, {
    method: 'POST',
    query,
    signal,
    version: API_VERSIONS.public.v1,
  });
  return response as KnowledgeBaseSetupResponse;
};
