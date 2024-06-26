/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KibanaRequest } from '@kbn/core/server';
import type {
  CheckPrivilegesDynamicallyWithRequest,
  CheckPrivilegesOptions,
  CheckPrivilegesPayload,
  CheckPrivilegesWithRequest,
} from '@kbn/security-plugin-types-server';

import type { SpacesService } from '../plugin';

export function checkPrivilegesDynamicallyWithRequestFactory(
  checkPrivilegesWithRequest: CheckPrivilegesWithRequest,
  getSpacesService: () => SpacesService | undefined
): CheckPrivilegesDynamicallyWithRequest {
  return function checkPrivilegesDynamicallyWithRequest(request: KibanaRequest) {
    const checkPrivileges = checkPrivilegesWithRequest(request);

    return async function checkPrivilegesDynamically(
      privileges: CheckPrivilegesPayload,
      options?: CheckPrivilegesOptions
    ) {
      const spacesService = getSpacesService();
      return spacesService
        ? await checkPrivileges.atSpace(spacesService.getSpaceId(request), privileges, options)
        : await checkPrivileges.globally(privileges, options);
    };
  };
}
