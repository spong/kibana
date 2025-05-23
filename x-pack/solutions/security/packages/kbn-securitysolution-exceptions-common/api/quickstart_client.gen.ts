/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Exceptions API client for quickstart
 *   version: Bundle (no version)
 */

import type { KbnClient } from '@kbn/test';
import { ToolingLog } from '@kbn/tooling-log';
import { ELASTIC_HTTP_VERSION_HEADER } from '@kbn/core-http-common';
import { replaceParams } from '@kbn/openapi-common/shared';
import { catchAxiosErrorFormatAndThrow } from '@kbn/securitysolution-utils';

import type {
  CreateExceptionListItemRequestBodyInput,
  CreateExceptionListItemResponse,
} from './create_exception_list_item/create_exception_list_item.gen';
import type {
  CreateExceptionListRequestBodyInput,
  CreateExceptionListResponse,
} from './create_exception_list/create_exception_list.gen';
import type {
  CreateRuleExceptionListItemsRequestParamsInput,
  CreateRuleExceptionListItemsRequestBodyInput,
  CreateRuleExceptionListItemsResponse,
} from './create_rule_exceptions/create_rule_exceptions.gen';
import type {
  CreateSharedExceptionListRequestBodyInput,
  CreateSharedExceptionListResponse,
} from './create_shared_exceptions_list/create_shared_exceptions_list.gen';
import type {
  DeleteExceptionListItemRequestQueryInput,
  DeleteExceptionListItemResponse,
} from './delete_exception_list_item/delete_exception_list_item.gen';
import type {
  DeleteExceptionListRequestQueryInput,
  DeleteExceptionListResponse,
} from './delete_exception_list/delete_exception_list.gen';
import type {
  DuplicateExceptionListRequestQueryInput,
  DuplicateExceptionListResponse,
} from './duplicate_exception_list/duplicate_exception_list.gen';
import type { ExportExceptionListRequestQueryInput } from './export_exception_list/export_exception_list.gen';
import type {
  FindExceptionListItemsRequestQueryInput,
  FindExceptionListItemsResponse,
} from './find_exception_list_items/find_exception_list_items.gen';
import type {
  FindExceptionListsRequestQueryInput,
  FindExceptionListsResponse,
} from './find_exception_lists/find_exception_lists.gen';
import type {
  ImportExceptionListRequestQueryInput,
  ImportExceptionListResponse,
} from './import_exceptions/import_exceptions.gen';
import type {
  ReadExceptionListItemRequestQueryInput,
  ReadExceptionListItemResponse,
} from './read_exception_list_item/read_exception_list_item.gen';
import type {
  ReadExceptionListSummaryRequestQueryInput,
  ReadExceptionListSummaryResponse,
} from './read_exception_list_summary/read_exception_list_summary.gen';
import type {
  ReadExceptionListRequestQueryInput,
  ReadExceptionListResponse,
} from './read_exception_list/read_exception_list.gen';
import type {
  UpdateExceptionListItemRequestBodyInput,
  UpdateExceptionListItemResponse,
} from './update_exception_list_item/update_exception_list_item.gen';
import type {
  UpdateExceptionListRequestBodyInput,
  UpdateExceptionListResponse,
} from './update_exception_list/update_exception_list.gen';

export interface ClientOptions {
  kbnClient: KbnClient;
  log: ToolingLog;
}

export class Client {
  readonly kbnClient: KbnClient;
  readonly log: ToolingLog;

  constructor(options: ClientOptions) {
    this.kbnClient = options.kbnClient;
    this.log = options.log;
  }
  /**
    * An exception list groups exception items and can be associated with detection rules. You can assign exception lists to multiple detection rules.
> info
> All exception items added to the same list are evaluated using `OR` logic. That is, if any of the items in a list evaluate to `true`, the exception prevents the rule from generating an alert. Likewise, `OR` logic is used for evaluating exceptions when more than one exception list is assigned to a rule. To use the `AND` operator, you can define multiple clauses (`entries`) in a single exception item.

    */
  async createExceptionList(props: CreateExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API CreateExceptionList`);
    return this.kbnClient
      .request<CreateExceptionListResponse>({
        path: '/api/exception_lists',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',
        body: props.body,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
    * Create an exception item and associate it with the specified exception list.
> info
> Before creating exception items, you must create an exception list.

    */
  async createExceptionListItem(props: CreateExceptionListItemProps) {
    this.log.info(`${new Date().toISOString()} Calling API CreateExceptionListItem`);
    return this.kbnClient
      .request<CreateExceptionListItemResponse>({
        path: '/api/exception_lists/items',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',
        body: props.body,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Create exception items that apply to a single detection rule.
   */
  async createRuleExceptionListItems(props: CreateRuleExceptionListItemsProps) {
    this.log.info(`${new Date().toISOString()} Calling API CreateRuleExceptionListItems`);
    return this.kbnClient
      .request<CreateRuleExceptionListItemsResponse>({
        path: replaceParams('/api/detection_engine/rules/{id}/exceptions', props.params),
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',
        body: props.body,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
    * An exception list groups exception items and can be associated with detection rules. A shared exception list can apply to multiple detection rules.
> info
> All exception items added to the same list are evaluated using `OR` logic. That is, if any of the items in a list evaluate to `true`, the exception prevents the rule from generating an alert. Likewise, `OR` logic is used for evaluating exceptions when more than one exception list is assigned to a rule. To use the `AND` operator, you can define multiple clauses (`entries`) in a single exception item.

    */
  async createSharedExceptionList(props: CreateSharedExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API CreateSharedExceptionList`);
    return this.kbnClient
      .request<CreateSharedExceptionListResponse>({
        path: '/api/exceptions/shared',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',
        body: props.body,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Delete an exception list using the `id` or `list_id` field.
   */
  async deleteExceptionList(props: DeleteExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API DeleteExceptionList`);
    return this.kbnClient
      .request<DeleteExceptionListResponse>({
        path: '/api/exception_lists',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'DELETE',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Delete an exception list item using the `id` or `item_id` field.
   */
  async deleteExceptionListItem(props: DeleteExceptionListItemProps) {
    this.log.info(`${new Date().toISOString()} Calling API DeleteExceptionListItem`);
    return this.kbnClient
      .request<DeleteExceptionListItemResponse>({
        path: '/api/exception_lists/items',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'DELETE',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Duplicate an existing exception list.
   */
  async duplicateExceptionList(props: DuplicateExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API DuplicateExceptionList`);
    return this.kbnClient
      .request<DuplicateExceptionListResponse>({
        path: '/api/exception_lists/_duplicate',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Export an exception list and its associated items to an NDJSON file.
   */
  async exportExceptionList(props: ExportExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API ExportExceptionList`);
    return this.kbnClient
      .request({
        path: '/api/exception_lists/_export',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Get a list of all exception list items in the specified list.
   */
  async findExceptionListItems(props: FindExceptionListItemsProps) {
    this.log.info(`${new Date().toISOString()} Calling API FindExceptionListItems`);
    return this.kbnClient
      .request<FindExceptionListItemsResponse>({
        path: '/api/exception_lists/items/_find',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'GET',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Get a list of all exception list containers.
   */
  async findExceptionLists(props: FindExceptionListsProps) {
    this.log.info(`${new Date().toISOString()} Calling API FindExceptionLists`);
    return this.kbnClient
      .request<FindExceptionListsResponse>({
        path: '/api/exception_lists/_find',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'GET',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Import an exception list and its associated items from an NDJSON file.
   */
  async importExceptionList(props: ImportExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API ImportExceptionList`);
    return this.kbnClient
      .request<ImportExceptionListResponse>({
        path: '/api/exception_lists/_import',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'POST',
        body: props.attachment,
        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Get the details of an exception list using the `id` or `list_id` field.
   */
  async readExceptionList(props: ReadExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API ReadExceptionList`);
    return this.kbnClient
      .request<ReadExceptionListResponse>({
        path: '/api/exception_lists',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'GET',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Get the details of an exception list item using the `id` or `item_id` field.
   */
  async readExceptionListItem(props: ReadExceptionListItemProps) {
    this.log.info(`${new Date().toISOString()} Calling API ReadExceptionListItem`);
    return this.kbnClient
      .request<ReadExceptionListItemResponse>({
        path: '/api/exception_lists/items',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'GET',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Get a summary of the specified exception list.
   */
  async readExceptionListSummary(props: ReadExceptionListSummaryProps) {
    this.log.info(`${new Date().toISOString()} Calling API ReadExceptionListSummary`);
    return this.kbnClient
      .request<ReadExceptionListSummaryResponse>({
        path: '/api/exception_lists/summary',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'GET',

        query: props.query,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Update an exception list using the `id` or `list_id` field.
   */
  async updateExceptionList(props: UpdateExceptionListProps) {
    this.log.info(`${new Date().toISOString()} Calling API UpdateExceptionList`);
    return this.kbnClient
      .request<UpdateExceptionListResponse>({
        path: '/api/exception_lists',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'PUT',
        body: props.body,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
  /**
   * Update an exception list item using the `id` or `item_id` field.
   */
  async updateExceptionListItem(props: UpdateExceptionListItemProps) {
    this.log.info(`${new Date().toISOString()} Calling API UpdateExceptionListItem`);
    return this.kbnClient
      .request<UpdateExceptionListItemResponse>({
        path: '/api/exception_lists/items',
        headers: {
          [ELASTIC_HTTP_VERSION_HEADER]: '2023-10-31',
        },
        method: 'PUT',
        body: props.body,
      })
      .catch(catchAxiosErrorFormatAndThrow);
  }
}

export interface CreateExceptionListProps {
  body: CreateExceptionListRequestBodyInput;
}
export interface CreateExceptionListItemProps {
  body: CreateExceptionListItemRequestBodyInput;
}
export interface CreateRuleExceptionListItemsProps {
  params: CreateRuleExceptionListItemsRequestParamsInput;
  body: CreateRuleExceptionListItemsRequestBodyInput;
}
export interface CreateSharedExceptionListProps {
  body: CreateSharedExceptionListRequestBodyInput;
}
export interface DeleteExceptionListProps {
  query: DeleteExceptionListRequestQueryInput;
}
export interface DeleteExceptionListItemProps {
  query: DeleteExceptionListItemRequestQueryInput;
}
export interface DuplicateExceptionListProps {
  query: DuplicateExceptionListRequestQueryInput;
}
export interface ExportExceptionListProps {
  query: ExportExceptionListRequestQueryInput;
}
export interface FindExceptionListItemsProps {
  query: FindExceptionListItemsRequestQueryInput;
}
export interface FindExceptionListsProps {
  query: FindExceptionListsRequestQueryInput;
}
export interface ImportExceptionListProps {
  query: ImportExceptionListRequestQueryInput;
  attachment: FormData;
}
export interface ReadExceptionListProps {
  query: ReadExceptionListRequestQueryInput;
}
export interface ReadExceptionListItemProps {
  query: ReadExceptionListItemRequestQueryInput;
}
export interface ReadExceptionListSummaryProps {
  query: ReadExceptionListSummaryRequestQueryInput;
}
export interface UpdateExceptionListProps {
  body: UpdateExceptionListRequestBodyInput;
}
export interface UpdateExceptionListItemProps {
  body: UpdateExceptionListItemRequestBodyInput;
}
