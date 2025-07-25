/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IValidatedEventInternalDocInfo } from '@kbn/event-log-plugin/server';
import { getUrlPrefix } from '.';
import type { FtrProviderContext } from '../ftr_provider_context';

interface GreaterThanEqualCondition {
  gte: number;
}
interface EqualCondition {
  equal: number;
}

function isEqualCondition(
  condition: GreaterThanEqualCondition | EqualCondition
): condition is EqualCondition {
  return Number.isInteger((condition as EqualCondition).equal);
}

interface GetEventLogParams {
  getService: FtrProviderContext['getService'];
  spaceId: string;
  type: string;
  id: string;
  provider: string;
  actions: Map<string, { gte: number } | { equal: number }>;
  filter?: string;
  collapseByExecutionUUid?: boolean;
}

// Return event log entries given the specified parameters; for the `actions`
// parameter, at least one event of each action must be in the returned entries.
export async function getEventLog(
  params: GetEventLogParams
): Promise<IValidatedEventInternalDocInfo[]> {
  const { getService, spaceId, type, id, provider, actions, collapseByExecutionUUid } = params;
  const supertest = getService('supertest');

  const spacePrefix = getUrlPrefix(spaceId);
  const url = `${spacePrefix}/_test/event_log/${type}/${id}/_find?per_page=5000${
    params.filter ? `&filter=${params.filter}` : ''
  }`;

  const { body: result } = await supertest.get(url).expect(200);
  if (!result.total) {
    throw new Error('no events found yet');
  }

  // filter events to matching provider and requested actions
  const events: IValidatedEventInternalDocInfo[] = (result.data as IValidatedEventInternalDocInfo[])
    .filter((event) => event?.event?.provider === provider)
    .filter((event) => event?.event?.action)
    .filter((event) => actions.has(event?.event?.action!));

  const actionExecutionUuidMap = new Map<string, number>();
  const foundActions = events
    .map((event) => ({
      action: event?.event?.action,
      uuid: event?.kibana?.alert?.rule?.execution?.uuid,
    }))
    .reduce((actionsSum, evt) => {
      if (evt.action) {
        if (collapseByExecutionUUid === true) {
          const key = `${evt.action}${evt.uuid}`;
          if (!actionExecutionUuidMap.has(key)) {
            actionExecutionUuidMap.set(key, 1);
            actionsSum.set(evt.action, 1 + (actionsSum.get(evt.action) ?? 0));
          }
        } else {
          actionsSum.set(evt.action, 1 + (actionsSum.get(evt.action) ?? 0));
        }
      }
      return actionsSum;
    }, new Map<string, number>());

  for (const [action, condition] of actions.entries()) {
    if (
      !(
        foundActions.has(action) &&
        (isEqualCondition(condition)
          ? foundActions.get(action)! === condition.equal
          : foundActions.get(action)! >= condition.gte)
      )
    ) {
      throw new Error(
        `insufficient events found with action "${action}" (${
          foundActions.get(action) ?? 0
        } must be ${
          isEqualCondition(condition)
            ? `equal to ${condition.equal}`
            : `greater than or equal to ${condition.gte}`
        })`
      );
    }
  }

  return events;
}
