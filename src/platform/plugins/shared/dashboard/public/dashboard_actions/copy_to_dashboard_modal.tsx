/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  EuiButton,
  EuiButtonEmpty,
  EuiFormRow,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiRadio,
  EuiSpacer,
} from '@elastic/eui';
import { EmbeddablePackageState } from '@kbn/embeddable-plugin/public';
import { LazyDashboardPicker, withSuspense } from '@kbn/presentation-util-plugin/public';
import React, { useCallback, useMemo, useState } from 'react';
import { CREATE_NEW_DASHBOARD_URL, createDashboardEditUrl } from '../utils/urls';
import { embeddableService } from '../services/kibana_services';
import { getDashboardCapabilities } from '../utils/get_dashboard_capabilities';
import { dashboardCopyToDashboardActionStrings } from './_dashboard_actions_strings';
import { CopyToDashboardAPI } from './copy_to_dashboard_action';

interface CopyToDashboardModalProps {
  api: CopyToDashboardAPI;
  closeModal: () => void;
}

const DashboardPicker = withSuspense(LazyDashboardPicker);

export function CopyToDashboardModal({ api, closeModal }: CopyToDashboardModalProps) {
  const stateTransfer = useMemo(() => embeddableService.getStateTransfer(), []);
  const { createNew: canCreateNew, showWriteControls: canEditExisting } = useMemo(
    () => getDashboardCapabilities(),
    []
  );

  const [dashboardOption, setDashboardOption] = useState<'new' | 'existing'>('existing');
  const [selectedDashboard, setSelectedDashboard] = useState<{ id: string; name: string } | null>(
    null
  );

  const dashboardId = api.parentApi.savedObjectId$.value;

  const onSubmit = useCallback(() => {
    // TODO handle getDashboardPanelFromId throw
    const panelToCopy = api.parentApi.getDashboardPanelFromId(api.uuid);

    const state: EmbeddablePackageState = {
      type: panelToCopy.type,
      serializedState: panelToCopy.serializedState,
      size: {
        width: panelToCopy.gridData.w,
        height: panelToCopy.gridData.h,
      },
    };

    const path =
      dashboardOption === 'existing' && selectedDashboard
        ? `#${createDashboardEditUrl(selectedDashboard.id, true)}`
        : `#${CREATE_NEW_DASHBOARD_URL}`;

    closeModal();
    stateTransfer.navigateToWithEmbeddablePackage('dashboards', {
      state,
      path,
    });
  }, [api, dashboardOption, selectedDashboard, closeModal, stateTransfer]);

  const titleId = 'copyToDashboardTitle';
  const descriptionId = 'copyToDashboardDescription';

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <EuiModalHeader>
        <EuiModalHeaderTitle id={titleId} component="h2">
          {dashboardCopyToDashboardActionStrings.getDisplayName()}
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>
        <>
          <EuiFormRow hasChildLabel={false}>
            <div data-test-subj="add-to-dashboard-options">
              {canEditExisting && (
                <>
                  <EuiRadio
                    checked={dashboardOption === 'existing'}
                    data-test-subj="add-to-existing-dashboard-option"
                    id="existing-dashboard-option"
                    name="dashboard-option"
                    label={dashboardCopyToDashboardActionStrings.getExistingDashboardOption()}
                    onChange={() => setDashboardOption('existing')}
                  />
                  <EuiSpacer size="s" />
                  <div>
                    <DashboardPicker
                      isDisabled={dashboardOption !== 'existing'}
                      idsToOmit={dashboardId ? [dashboardId] : undefined}
                      onChange={(dashboard) => {
                        setSelectedDashboard(dashboard);
                        setDashboardOption('existing');
                      }}
                    />
                  </div>
                  <EuiSpacer size="s" />
                </>
              )}
              {canCreateNew && (
                <>
                  <EuiRadio
                    checked={dashboardOption === 'new'}
                    data-test-subj="add-to-new-dashboard-option"
                    id="new-dashboard-option"
                    name="dashboard-option"
                    disabled={!dashboardId}
                    label={dashboardCopyToDashboardActionStrings.getNewDashboardOption()}
                    onChange={() => setDashboardOption('new')}
                  />
                  <EuiSpacer size="s" />
                </>
              )}
            </div>
          </EuiFormRow>
        </>
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButtonEmpty data-test-subj="cancelCopyToButton" onClick={() => closeModal()}>
          {dashboardCopyToDashboardActionStrings.getCancelButtonName()}
        </EuiButtonEmpty>
        <EuiButton
          fill
          data-test-subj="confirmCopyToButton"
          onClick={onSubmit}
          disabled={dashboardOption === 'existing' && !selectedDashboard}
        >
          {dashboardCopyToDashboardActionStrings.getAcceptButtonName()}
        </EuiButton>
      </EuiModalFooter>
    </div>
  );
}
