/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core-elasticsearch-server';
import type { DeleteByQueryRequest } from '@elastic/elasticsearch/lib/api/types';
import { i18n } from '@kbn/i18n';
import type { ProductDocBaseStartContract } from '@kbn/product-doc-base-plugin/server';
import type { Logger } from '@kbn/logging';
import { defaultInferenceEndpoints } from '@kbn/inference-common';
import { getResourceName } from '.';

export const getCurrentInferenceId = async ({
  esClient,
  logger,
  resourceName,
  spaceId,
}: {
  esClient: ElasticsearchClient;
  logger: Logger;
  resourceName: string;
  spaceId: string;
}): Promise<string | undefined> => {
  try {
    const dataStreamName = `${resourceName}-${spaceId}`;

    // Get data stream info to find the write index
    const dataStreamResponse = await esClient.indices.getDataStream({
      name: dataStreamName,
    });

    if (!dataStreamResponse.data_streams || dataStreamResponse.data_streams.length === 0) {
      logger.debug(`Data stream ${dataStreamName} not found`);
      return null;
    }

    const dataStream = dataStreamResponse.data_streams[0];
    const writeIndex = dataStream.indices[dataStream.indices.length - 1].index_name;

    // Get the mapping from the write index
    const mappingResponse = await esClient.indices.getMapping({
      index: writeIndex,
    });

    const mapping = mappingResponse[writeIndex]?.mappings;
    const semanticTextField = mapping?.properties?.semantic_text;

    if (semanticTextField?.type === 'semantic_text') {
      return semanticTextField.inference_id || undefined;
    }

    logger.debug(`No semantic_text field found in write index ${writeIndex} mapping`);
    return undefined;
  } catch (error) {
    logger.debug(`Data stream ${resourceName} for space ${spaceId} not found`);
    return undefined;
  }
};

export const removeLegacyQuickPrompt = async (esClient: ElasticsearchClient) => {
  try {
    const deleteQuery: DeleteByQueryRequest = {
      index: `${getResourceName('prompts')}-*`,
      query: {
        bool: {
          must: [
            {
              term: {
                name: ESQL_QUERY_GENERATION_TITLE,
              },
            },
            {
              term: {
                prompt_type: 'quick',
              },
            },
            {
              term: {
                is_default: true,
              },
            },
          ],
        },
      },
    };
    return esClient.deleteByQuery(deleteQuery);
  } catch (e) {
    // swallow any errors
    return {
      total: 0,
    };
  }
};

const ESQL_QUERY_GENERATION_TITLE = i18n.translate(
  'xpack.elasticAssistantPlugin.assistant.quickPrompts.esqlQueryGenerationTitle',
  {
    defaultMessage: 'ES|QL Query Generation',
  }
);

export const ensureProductDocumentationInstalled = async ({
  productDocManager,
  setIsProductDocumentationInProgress,
  logger,
  inferenceId = defaultInferenceEndpoints.ELSER,
}: {
  productDocManager: ProductDocBaseStartContract['management'];
  setIsProductDocumentationInProgress: (value: boolean) => void;
  logger: Logger;
  inferenceId?: string;
}) => {
  try {
    const { status } = await productDocManager.getStatus({
      inferenceId,
    });
    if (status !== 'installed') {
      logger.debug(
        `Installing product documentation for AIAssistantService with inference ID: ${inferenceId}`
      );
      setIsProductDocumentationInProgress(true);
      try {
        await productDocManager.install({
          wait: true,
          inferenceId,
        });
        logger.debug(
          `Successfully installed product documentation for AIAssistantService with inference ID: ${inferenceId}`
        );
      } catch (e) {
        logger.warn(`Failed to install product documentation for AIAssistantService: ${e.message}`);
      } finally {
        setIsProductDocumentationInProgress(false);
      }
    }
  } catch (e) {
    logger.warn(
      `Failed to get status of product documentation installation for AIAssistantService: ${e.message}`
    );
  }
};
