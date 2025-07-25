/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { Spaces } from '../../../scenarios';
import type { FtrProviderContext } from '../../../../common/ftr_provider_context';
import { getEventLog, getTestRuleData, getUrlPrefix, ObjectRemover } from '../../../../common/lib';

export default function createCappedActionsTests({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const retry = getService('retry');

  describe('Capped connector type', () => {
    const objectRemover = new ObjectRemover(supertest);

    after(() => objectRemover.removeAll());

    it('should not trigger actions more than connector types limit', async () => {
      const { body: createdConnector01 } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/actions/connector`)
        .set('kbn-xsrf', 'foo')
        .send({
          name: 'MY Connector',
          connector_type_id: 'test.capped',
          config: {},
          secrets: {},
        })
        .expect(200);
      const { body: createdConnector02 } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/actions/connector`)
        .set('kbn-xsrf', 'foo')
        .send({
          name: 'MY Connector',
          connector_type_id: 'test.capped',
          config: {},
          secrets: {},
        })
        .expect(200);
      const { body: createdConnector03 } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/actions/connector`)
        .set('kbn-xsrf', 'foo')
        .send({
          name: 'MY Connector',
          connector_type_id: 'test.capped',
          config: {},
          secrets: {},
        })
        .expect(200);

      objectRemover.add(Spaces.space1.id, createdConnector01.id, 'connector', 'actions');
      objectRemover.add(Spaces.space1.id, createdConnector02.id, 'connector', 'actions');
      objectRemover.add(Spaces.space1.id, createdConnector03.id, 'connector', 'actions');

      const { body: createdRule } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestRuleData({
            name: 'should not trigger actions when connector type limit is reached',
            rule_type_id: 'test.patternFiring',
            schedule: { interval: '1s' },
            throttle: null,
            notify_when: 'onActiveAlert',
            params: {
              pattern: { instance: arrayOfTrues(100) },
            },
            actions: [
              {
                id: createdConnector01.id,
                group: 'default',
                params: {},
              },
              {
                id: createdConnector02.id,
                group: 'default',
                params: {},
              },
              {
                id: createdConnector03.id,
                group: 'default',
                params: {},
              },
            ],
          })
        )
        .expect(200);

      objectRemover.add(Spaces.space1.id, createdRule.id, 'rule', 'alerting');

      await getRuleEvents(createdRule.id);
      const [executionEvent] = await getRuleEvents(createdRule.id, 1);

      expect(
        executionEvent?.kibana?.alert?.rule?.execution?.metrics?.number_of_generated_actions
      ).to.be.eql(3, 'all the generated actions');
      expect(
        executionEvent?.kibana?.alert?.rule?.execution?.metrics?.number_of_triggered_actions
      ).to.be.eql(1, 'only 1 action was triggered');
    });
  });

  async function getRuleEvents(id: string, minActions: number = 1) {
    return await retry.try(async () => {
      return await getEventLog({
        getService,
        spaceId: Spaces.space1.id,
        type: 'alert',
        id,
        provider: 'alerting',
        actions: new Map([['execute', { gte: minActions }]]),
      });
    });
  }
}

function arrayOfTrues(length: number) {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(true);
  }
  return result;
}
