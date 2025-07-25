/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  EuiHeaderLink,
  EuiHeaderLinks,
  EuiHeaderSection,
  EuiHeaderSectionItem,
} from '@elastic/eui';
import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { i18n } from '@kbn/i18n';

import { toMountPoint } from '@kbn/react-kibana-mount';
import { DataViewManagerScopeName } from '../../../data_view_manager/constants';
import { SECURITY_FEATURE_ID } from '../../../../common';
import { useIsExperimentalFeatureEnabled } from '../../../common/hooks/use_experimental_features';
import { MlPopover } from '../../../common/components/ml_popover/ml_popover';
import { useKibana } from '../../../common/lib/kibana';
import { isDetectionsPath, isDashboardViewPath } from '../../../helpers';
import { Sourcerer } from '../../../sourcerer/components';
import { TimelineId } from '../../../../common/types/timeline';
import { timelineDefaults } from '../../../timelines/store/defaults';
import { timelineSelectors } from '../../../timelines/store';
import { useShallowEqualSelector } from '../../../common/hooks/use_selector';
import {
  getScopeFromPath,
  showSourcererByPath,
} from '../../../sourcerer/containers/sourcerer_paths';
import { useAddIntegrationsUrl } from '../../../common/hooks/use_add_integrations_url';
import { DataViewPicker } from '../../../data_view_manager/components/data_view_picker';

const BUTTON_ADD_DATA = i18n.translate('xpack.securitySolution.globalHeader.buttonAddData', {
  defaultMessage: 'Add integrations',
});

/**
 * This component uses the reverse portal to add the Add Data, ML job settings, and AI Assistant buttons on the
 * right hand side of the Kibana global header
 */
export const GlobalHeader = React.memo(() => {
  const newDataViewPickerEnabled = useIsExperimentalFeatureEnabled('newDataViewPickerEnabled');
  const portalNode = useMemo(() => createHtmlPortalNode(), []);
  const {
    theme,
    setHeaderActionMenu,
    i18n: kibanaServiceI18n,
    application: { capabilities },
  } = useKibana().services;
  const hasSearchAILakeConfigurations = capabilities[SECURITY_FEATURE_ID]?.configurations === true;
  const { pathname } = useLocation();

  const getTimeline = useMemo(() => timelineSelectors.getTimelineByIdSelector(), []);
  const showTimeline = useShallowEqualSelector(
    (state) => (getTimeline(state, TimelineId.active) ?? timelineDefaults).show
  );

  const sourcererScope = getScopeFromPath(pathname, newDataViewPickerEnabled);
  const showSourcerer = showSourcererByPath(pathname);
  const dashboardViewPath = isDashboardViewPath(pathname);

  const { href, onClick } = useAddIntegrationsUrl();

  useEffect(() => {
    if (setHeaderActionMenu) {
      setHeaderActionMenu((element) => {
        const mount = toMountPoint(<OutPortal node={portalNode} />, {
          theme,
          i18n: kibanaServiceI18n,
        });
        return mount(element);
      });

      return () => {
        /* Dashboard mounts an edit toolbar, it should be restored when leaving dashboard editing page */
        if (dashboardViewPath) {
          return;
        }
        portalNode.unmount();
        setHeaderActionMenu(undefined);
      };
    }
  }, [portalNode, setHeaderActionMenu, theme, kibanaServiceI18n, dashboardViewPath]);

  const dataViewPicker = newDataViewPickerEnabled ? (
    <DataViewPicker
      scope={sourcererScope}
      disabled={sourcererScope === DataViewManagerScopeName.detections}
    />
  ) : (
    <Sourcerer scope={sourcererScope} data-test-subj="sourcerer" />
  );

  return (
    <InPortal node={portalNode}>
      <EuiHeaderSection side="right">
        {isDetectionsPath(pathname) && (
          <EuiHeaderSectionItem>
            <MlPopover />
          </EuiHeaderSectionItem>
        )}

        <EuiHeaderSectionItem>
          <EuiHeaderLinks>
            {!hasSearchAILakeConfigurations && (
              <EuiHeaderLink
                color="primary"
                data-test-subj="add-data"
                href={href}
                iconType="indexOpen"
                onClick={onClick}
              >
                {BUTTON_ADD_DATA}
              </EuiHeaderLink>
            )}
            {showSourcerer && !showTimeline && dataViewPicker}
          </EuiHeaderLinks>
        </EuiHeaderSectionItem>
      </EuiHeaderSection>
    </InPortal>
  );
});
GlobalHeader.displayName = 'GlobalHeader';
