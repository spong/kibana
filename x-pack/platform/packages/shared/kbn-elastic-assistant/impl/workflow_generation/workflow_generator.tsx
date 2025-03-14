/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState, useCallback } from 'react';
import { Edge, Node, ReactFlow } from '@xyflow/react';
import {
  EuiResizableContainer,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiHorizontalRule,
  EuiTextArea,
  EuiTabs,
  EuiTab,
  EuiIcon,
  EuiTitle,
  EuiFieldText,
  EuiSpacer,
  EuiTextColor,
  EuiText,
} from '@elastic/eui';
import { useAssistantContext } from '../..';
import { useGenerateWorkflow } from '../assistant/api/workflow_generation/use_generate_workflow';
import { useExecuteWorkflow } from '../assistant/api/workflow_generation/use_execute_workflow';
import { useCreateWorkflowAction } from '../assistant/api/workflow_generation/use_create_workflow_action';
import { useWorkflowActions } from '../assistant/api/workflow_generation/use_workflow_actions';

interface Props {
  isEnabled?: boolean;
}

export const WorkflowGenerator: React.FC<Props> = React.memo(({ isEnabled }: Props) => {
  const { http, toasts } = useAssistantContext();
  const [prompt, setPrompt] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [actionName, setActionName] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionApiKey, setActionApiKey] = useState('');
  const [actionOpenApiSpec, setActionOpenApiSpec] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);

  const { mutate: generateWorkflow, isLoading: isGenerating } = useGenerateWorkflow({
    http,
    toasts,
  });

  const { mutate: executeWorkflow, isLoading: isExecuting } = useExecuteWorkflow({
    http,
    toasts,
  });

  const { mutate: createAction, isLoading: isCreating } = useCreateWorkflowAction({
    http,
    toasts,
  });

  const { data: actions = [] } = useWorkflowActions({
    http,
    toasts,
    enabled: true,
  });

  const handleGenerateClick = useCallback(() => {
    generateWorkflow(
      { prompt, actionIds: [] },
      {
        onSuccess: (data) => {
          if (data.workflowId) {
            setWorkflowId(data.workflowId);
          }
        },
      }
    );
  }, [generateWorkflow, prompt]);

  const handleExecuteClick = useCallback(() => {
    if (workflowId) {
      executeWorkflow({ workflowId, actionIds: [] });
    }
  }, [executeWorkflow, workflowId]);

  const handleCreateActionClick = useCallback(() => {
    createAction(
      { name: actionName, url: actionUrl, apiKey: actionApiKey, openApiSpec: actionOpenApiSpec },
      {
        onSuccess: () => {
          setActionName('');
          setActionUrl('');
          setActionApiKey('');
          setActionOpenApiSpec('');
        },
      }
    );
  }, [createAction, actionName, actionUrl, actionApiKey, actionOpenApiSpec]);

  const initialNodes: Node[] = [
    {
      id: '1',
      type: 'input',
      data: { label: 'Node 1' },
      position: { x: 250, y: 0 },
    },
    {
      id: '2',
      data: { label: 'Node 2' },
      position: { x: 250, y: 100 },
    },
    {
      id: '3',
      type: 'output',
      data: { label: 'Node 3' },
      position: { x: 250, y: 200 },
    },
  ];

  const initialEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' },
    { id: 'e2-3', source: '2', target: '3', type: 'smoothstep' },
  ];

  return (
    <>
      <EuiResizableContainer style={{ height: '100vh' }}>
        {(EuiResizablePanel, EuiResizableButton) => (
          <>
            <EuiResizablePanel mode="main" initialSize={60} minSize="50px" tabIndex={0}>
              <EuiFlexGroup direction="column" style={{ height: '100%' }}>
                <EuiFlexItem grow={false}>
                  <EuiTextArea
                    placeholder="Query slack messages for open tasks designated by 'Please Robot:' and execute all open tasks"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    fullWidth
                    compressed
                    isClearable={true}
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
                    <EuiFlexItem grow={false}>
                      <EuiButton
                        iconType="plus"
                        color={'primary'}
                        isDisabled={isGenerating}
                        onClick={handleGenerateClick}
                      >
                        {'Generate'}
                      </EuiButton>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButton
                        iconType="play"
                        color={'success'}
                        isDisabled={!workflowId || isExecuting}
                        onClick={handleExecuteClick}
                      >
                        {'Execute'}
                      </EuiButton>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={true}>
                  <EuiPanel paddingSize="l" style={{ height: '100%' }}>
                    <EuiTabs>
                      <EuiTab
                        key={0}
                        onClick={() => setSelectedTab(0)}
                        isSelected={selectedTab === 0}
                        prepend={<EuiIcon type="training" />}
                      >
                        {'Generated Workflow'}
                      </EuiTab>
                      <EuiTab
                        key={1}
                        onClick={() => setSelectedTab(1)}
                        isSelected={selectedTab === 1}
                        prepend={<EuiIcon type="editorCodeBlock" />}
                      >
                        {'Code'}
                      </EuiTab>
                    </EuiTabs>
                    <EuiSpacer size="m" />
                    {selectedTab === 0 && (
                      <div style={{ padding: '0 16px', height: '100%' }}>
                        <ReactFlow
                          nodes={initialNodes}
                          edges={initialEdges}
                          style={{ height: '100%' }}
                        />
                      </div>
                    )}
                    {selectedTab === 1 && (
                      <div style={{ padding: '0 16px' }}>{'Code view content goes here'}</div>
                    )}
                  </EuiPanel>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiResizablePanel>

            <EuiResizableButton />

            <EuiResizablePanel mode="collapsible" initialSize={40} minSize="10%">
              <EuiFlexGroup direction="column" gutterSize="m">
                <EuiFlexItem grow={false}>
                  <EuiTitle size="s">
                    <h3>{'Actions'}</h3>
                  </EuiTitle>
                  <EuiHorizontalRule />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFieldText
                    placeholder="Action Name"
                    value={actionName}
                    onChange={(e) => setActionName(e.target.value)}
                    fullWidth
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFieldText
                    placeholder="Action URL"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    fullWidth
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFieldText
                    placeholder="API Key"
                    value={actionApiKey}
                    onChange={(e) => setActionApiKey(e.target.value)}
                    fullWidth
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFieldText
                    placeholder="OpenAPI Spec (optional)"
                    value={actionOpenApiSpec}
                    onChange={(e) => setActionOpenApiSpec(e.target.value)}
                    fullWidth
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    iconType="plus"
                    color={'success'}
                    isDisabled={isCreating}
                    onClick={handleCreateActionClick}
                  >
                    {'Create Action'}
                  </EuiButton>
                </EuiFlexItem>
                <EuiFlexItem grow={true} style={{ overflowY: 'auto' }}>
                  {actions.length > 0 ? (
                    actions.map((action) => (
                      <EuiText key={action.actionId}>
                        <EuiTextColor color="subdued">{action.name}</EuiTextColor>
                      </EuiText>
                    ))
                  ) : (
                    <EuiText>
                      <EuiTextColor color="subdued">{'No actions available'}</EuiTextColor>
                    </EuiText>
                  )}
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiResizablePanel>
          </>
        )}
      </EuiResizableContainer>
    </>
  );
});

WorkflowGenerator.displayName = 'WorkflowGenerator';
