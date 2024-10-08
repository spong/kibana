/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { PanelFooter } from './flyout_panels_footer';
import { PanelHeader } from './flyout_panels_header';
import { PanelContent } from './flyout_panels_content';
import { Panel } from './flyout_panel';
import { Panels } from './flyout_panels';

export { useFlyoutPanelContext } from './flyout_panel';

export const FlyoutPanels = {
  Group: Panels,
  Item: Panel,
  Content: PanelContent,
  Header: PanelHeader,
  Footer: PanelFooter,
};
