/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/* eslint-disable no-console */

import chalk from 'chalk';
import type { KibanaRequest } from '@kbn/core/server';
import { RequestStatus } from '@kbn/inspector-plugin/common';
import type { WrappedElasticsearchClientError } from '@kbn/observability-plugin/server';
import { getInspectResponse } from '@kbn/observability-shared-plugin/common';
import type { InspectResponse } from '@kbn/observability-plugin/typings/common';

function formatObj(obj: Record<string, any>) {
  return JSON.stringify(obj, null, 2);
}

export async function callAsyncWithDebug<T>({
  cb,
  getDebugMessage,
  debug,
  request,
  requestParams,
  operationName,
  isCalledWithInternalUser,
  inspectableEsQueriesMap = new WeakMap<KibanaRequest, InspectResponse>(),
}: {
  cb: () => Promise<T>;
  getDebugMessage: () => { body: string; title: string };
  debug: boolean;
  request?: KibanaRequest;
  requestParams: Record<string, any>;
  operationName: string;
  isCalledWithInternalUser: boolean; // only allow inspection of queries that were retrieved with credentials of the end user
  inspectableEsQueriesMap?: WeakMap<KibanaRequest, InspectResponse>;
}): Promise<T> {
  if (!debug) {
    return cb();
  }

  const hrStartTime = process.hrtime();
  const startTime = Date.now();

  let res: any;
  let esError: WrappedElasticsearchClientError | null = null;
  let esRequestStatus: RequestStatus = RequestStatus.PENDING;
  try {
    res = await cb();
    esRequestStatus = RequestStatus.OK;
  } catch (e) {
    // catch error and throw after outputting debug info
    esError = e;
    esRequestStatus = RequestStatus.ERROR;
  }

  if (debug) {
    const highlightColor = esError ? 'bgRed' : 'inverse';
    const diff = process.hrtime(hrStartTime);
    const duration = Math.round(diff[0] * 1000 + diff[1] / 1e6); // duration in ms

    const { title, body } = getDebugMessage();

    console.log(chalk.bold[highlightColor](`=== Debug: ${title} (${duration}ms) ===`));

    console.log(body);
    console.log(`\n`);

    if (request) {
      const inspectableEsQueries = inspectableEsQueriesMap.get(request);
      if (!isCalledWithInternalUser && inspectableEsQueries) {
        inspectableEsQueries.push(
          getInspectResponse({
            esError,
            esRequestParams: requestParams,
            esRequestStatus,
            esResponse: res,
            kibanaRequest: request,
            operationName,
            startTime,
          })
        );
      }
    }
  }

  if (esError) {
    throw esError;
  }

  return res;
}

export const getDebugBody = ({
  params,
  requestType,
  operationName,
}: {
  params: Record<string, any>;
  requestType: string;
  operationName: string;
}) => {
  const operationLine = `${operationName}\n`;

  if (requestType === 'search') {
    return `${operationLine}GET ${params.index}/_search\n${formatObj(params)}`;
  }

  return `${chalk.bold('ES operation:')} ${requestType}\n${chalk.bold(
    'ES query:'
  )}\n${operationLine}${formatObj(params)}`;
};

export const getDebugTitle = (request: KibanaRequest) =>
  `${request.route.method.toUpperCase()} ${request.route.path}`;
