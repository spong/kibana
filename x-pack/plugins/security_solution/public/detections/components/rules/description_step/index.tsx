/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiDescriptionList,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiButtonIcon,
} from '@elastic/eui';
import { isEmpty, chunk, get, pick, isNumber } from 'lodash/fp';
import React, { memo, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import styled from 'styled-components';

import { ThreatMapping, Threats, Type } from '@kbn/securitysolution-io-ts-alerting-types';
import { DataViewBase, Filter, FilterStateStore } from '@kbn/es-query';
import { FilterManager } from '../../../../../../../../src/plugins/data/public';
import { useAppToasts } from '../../../../common/hooks/use_app_toasts';
import { DEFAULT_TIMELINE_TITLE } from '../../../../timelines/components/timeline/translations';
import { KibanaServices, useKibana } from '../../../../common/lib/kibana';
import { Rule } from '../../../containers/detection_engine/rules';
import { AboutStepRiskScore, AboutStepSeverity } from '../../../pages/detection_engine/rules/types';
import { FieldValueTimeline } from '../pick_timeline';
import { FormSchema } from '../../../../shared_imports';
import { ListItems } from './types';
import {
  buildQueryBarDescription,
  buildSeverityDescription,
  buildStringArrayDescription,
  buildThreatDescription,
  buildUnorderedListArrayDescription,
  buildUrlsDescription,
  buildNoteDescription,
  buildRiskScoreDescription,
  buildRuleTypeDescription,
  buildThresholdDescription,
  buildThreatMappingDescription,
} from './helpers';
import { buildMlJobsDescription } from './ml_job_description';
import { buildActionsDescription } from './actions_description';
import { buildThrottleDescription } from './throttle_description';
import { THREAT_QUERY_LABEL } from './translations';
import { filterEmptyThreats } from '../../../pages/detection_engine/rules/create/helpers';

const DescriptionListContainer = styled(EuiDescriptionList)`
  &.euiDescriptionList--column .euiDescriptionList__title {
    width: 30%;
  }

  &.euiDescriptionList--column .euiDescriptionList__description {
    width: 70%;
    overflow-wrap: anywhere;
  }
`;

const PackageNotInstalledEuiFlexItem = styled(EuiFlexItem)`
  filter: grayscale(100%);
`;

interface StepRuleDescriptionProps<T> {
  columns?: 'multi' | 'single' | 'singleSplit';
  data: unknown;
  indexPatterns?: DataViewBase;
  schema: FormSchema<T>;
  rule?: Rule;
}

export const useInstallPackage = (packageName: string, packageVersion: string) => {
  const { addError } = useAppToasts();

  return useQuery(
    ['installingPackage', packageName, packageVersion],
    async ({ signal }) => {
      // POST /kbn/api/fleet/epm/packages/aws/1.11.0
      //      /kbn/api/fleet/epm/package/aws/1.11.0
      const url = `/api/fleet/epm/packages/${packageName}/${packageVersion}`;
      const response = await KibanaServices.get().http.fetch(url, {
        method: 'POST',
        signal,
      });
      console.log('installResponse', response);
      return response;
    },
    {
      onError: (e) => {
        addError(e, { title: 'Its real bad, sorry!' });
      },
    }
  );
};

export const StepRuleDescriptionComponent = <T,>({
  data,
  columns = 'multi',
  indexPatterns,
  schema,
  rule,
}: StepRuleDescriptionProps<T>) => {
  const kibana = useKibana();
  const [filterManager] = useState<FilterManager>(new FilterManager(kibana.services.uiSettings));
  const [installed, setInstalled] = useState(false);

  const createPackage = useMutation(
    ({ packageName, packageVersion }: { packageName: string; packageVersion: string }) => {
      const url = `/api/fleet/epm/packages/${packageName}/${packageVersion}`;
      return KibanaServices.get().http.fetch(url, {
        method: 'POST',
      });
    },
    {
      onSuccess: (data, variables, context) => {
        setInstalled(true);
      },
    }
  );

  const deletePackage = useMutation(
    ({ packageName, packageVersion }: { packageName: string; packageVersion: string }) => {
      // http://localhost:5601/kbn/api/fleet/epm/packages/aws/1.11.0
      const url = `/api/fleet/epm/packages/${packageName}/${packageVersion}`;
      return KibanaServices.get().http.fetch(url, {
        method: 'DELETE',
      });
    },
    {
      onSuccess: (data, variables, context) => {
        setInstalled(false);
      },
    }
  );

  const packageDetails = rule?.packageDetails ?? { policy_templates: [] };
  const packageName = packageDetails?.name ?? 'emptyPackageName';
  const packageInstalled = packageDetails?.installed ?? false;
  const packageVersion = packageDetails?.version ?? 'emptyPackageVersion';

  // const usePackage = useQuery(['fleetPackage', packageName, packageVersion], () => {
  //   const url = `/api/fleet/epm/packages/${packageName}/${packageVersion}`;
  //   return KibanaServices.get().http.fetch(url, {
  //     method: 'GET',
  //   });
  // });

  // console.log('whoah!', rule);
  // console.log('columns!', columns);

  const items = useMemo(() => {
    return packageDetails?.policy_templates?.map((template, index) => {
      const icon = template?.icons?.[0] ?? { title: template.title };
      // kbn/api/fleet/epm/packages/aws/1.11.0/img/logo_cloudtrail.svg
      const iconPath = icon.src
        ? `/kbn/api/fleet/epm/packages/${packageName}/${packageVersion}${icon.src}`
        : 'package';
      return (
        index < 5 &&
        (installed ? (
          <EuiFlexItem grow={false}>
            <EuiButtonIcon
              onClick={() => {
                deletePackage.mutate({ packageName, packageVersion });
              }}
              iconType={iconPath}
              display={'empty'}
              size={'m'}
              aria-label={icon.title}
            />
          </EuiFlexItem>
        ) : (
          <PackageNotInstalledEuiFlexItem grow={false}>
            <EuiButtonIcon
              onClick={() => {
                createPackage.mutate({ packageName, packageVersion });
              }}
              iconType={iconPath}
              display={'empty'}
              size={'m'}
              aria-label={icon.title}
            />
            {/* <EuiIcon type={iconPath} size="xl" title={icon.title} />*/}
          </PackageNotInstalledEuiFlexItem>
        ))
      );
    });
  }, [
    createPackage,
    deletePackage,
    installed,
    packageDetails?.policy_templates,
    packageName,
    packageVersion,
  ]);

  const keys = Object.keys(schema);
  const listItems = keys.reduce((acc: ListItems[], key: string) => {
    if (key === 'machineLearningJobId') {
      return [
        ...acc,
        buildMlJobsDescription(
          get(key, data) as string[],
          (get(key, schema) as { label: string }).label
        ),
      ];
    }

    if (key === 'throttle') {
      return [...acc, buildThrottleDescription(get(key, data), get([key, 'label'], schema))];
    }

    if (key === 'actions') {
      return [...acc, buildActionsDescription(get(key, data), get([key, 'label'], schema))];
    }

    return [...acc, ...buildListItems(data, pick(key, schema), filterManager, indexPatterns)];
  }, []);

  if (columns === 'multi') {
    return (
      <EuiFlexGroup>
        {chunk(Math.ceil(listItems.length / 2), listItems).map((chunkListItems, index) => (
          <EuiFlexItem
            data-test-subj="listItemColumnStepRuleDescription"
            key={`description-step-rule-${index}`}
          >
            <EuiDescriptionList listItems={chunkListItems} />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    );
  }

  const packageItems = [
    { title: 'Supported Integrations', description: <EuiFlexGroup>{items}</EuiFlexGroup> },
  ];

  return (
    <>
      <EuiFlexGroup>
        <EuiFlexItem data-test-subj="listItemColumnStepRuleDescription">
          {columns === 'single' ? (
            <EuiDescriptionList listItems={[...listItems, ...packageItems]} />
          ) : (
            <DescriptionListContainer
              data-test-subj="singleSplitStepRuleDescriptionList"
              type="column"
              listItems={[...listItems, ...packageItems]}
            />
          )}
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
};

export const StepRuleDescription = memo(StepRuleDescriptionComponent);

export const buildListItems = <T,>(
  data: unknown,
  schema: FormSchema<T>,
  filterManager: FilterManager,
  indexPatterns?: DataViewBase
): ListItems[] =>
  Object.keys(schema).reduce<ListItems[]>(
    (acc, field) => [
      ...acc,
      ...getDescriptionItem(
        field,
        get([field, 'label'], schema),
        data,
        filterManager,
        indexPatterns
      ),
    ],
    []
  );

export const addFilterStateIfNotThere = (filters: Filter[]): Filter[] => {
  return filters.map((filter) => {
    if (filter.$state == null) {
      return { $state: { store: FilterStateStore.APP_STATE }, ...filter };
    } else {
      return filter;
    }
  });
};

/* eslint complexity: ["error", 21]*/
export const getDescriptionItem = (
  field: string,
  label: string,
  data: unknown,
  filterManager: FilterManager,
  indexPatterns?: DataViewBase
): ListItems[] => {
  if (field === 'queryBar') {
    const filters = addFilterStateIfNotThere(get('queryBar.filters', data) ?? []);
    const query = get('queryBar.query.query', data);
    const savedId = get('queryBar.saved_id', data);
    return buildQueryBarDescription({
      field,
      filters,
      filterManager,
      query,
      savedId,
      indexPatterns,
    });
  } else if (field === 'threat') {
    const threats: Threats = get(field, data);
    return buildThreatDescription({ label, threat: filterEmptyThreats(threats) });
  } else if (field === 'threshold') {
    const threshold = get(field, data);
    return buildThresholdDescription(label, threshold);
  } else if (field === 'references') {
    const urls: string[] = get(field, data);
    return buildUrlsDescription(label, urls);
  } else if (field === 'falsePositives') {
    const values: string[] = get(field, data);
    return buildUnorderedListArrayDescription(label, field, values);
  } else if (Array.isArray(get(field, data)) && field !== 'threatMapping') {
    const values: string[] = get(field, data);
    return buildStringArrayDescription(label, field, values);
  } else if (field === 'riskScore') {
    const values: AboutStepRiskScore = get(field, data);
    return buildRiskScoreDescription(values);
  } else if (field === 'severity') {
    const values: AboutStepSeverity = get(field, data);
    return buildSeverityDescription(values);
  } else if (field === 'timeline') {
    const timeline = get(field, data) as FieldValueTimeline;
    return [
      {
        title: label,
        description: timeline.title ?? DEFAULT_TIMELINE_TITLE,
      },
    ];
  } else if (field === 'note') {
    const val: string = get(field, data);
    return buildNoteDescription(label, val);
  } else if (field === 'ruleType') {
    const ruleType: Type = get(field, data);
    return buildRuleTypeDescription(label, ruleType);
  } else if (field === 'kibanaSiemAppUrl') {
    return [];
  } else if (field === 'threatQueryBar') {
    const filters = addFilterStateIfNotThere(get('threatQueryBar.filters', data) ?? []);
    const query = get('threatQueryBar.query.query', data);
    const savedId = get('threatQueryBar.saved_id', data);
    return buildQueryBarDescription({
      field,
      filters,
      filterManager,
      query,
      savedId,
      indexPatterns,
      queryLabel: THREAT_QUERY_LABEL,
    });
  } else if (field === 'threatMapping') {
    const threatMap: ThreatMapping = get(field, data);
    return buildThreatMappingDescription(label, threatMap);
  }

  const description: string = get(field, data);
  if (isNumber(description) || !isEmpty(description)) {
    return [
      {
        title: label,
        description,
      },
    ];
  }
  return [];
};
