/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * React component chart plotting data from a single time series, with or without model plot enabled,
 * annotated with anomalies.
 */

import PropTypes from 'prop-types';
import React, { Component, useContext, useMemo } from 'react';
import useObservable from 'react-use/lib/useObservable';
import { isEqual, reduce, each, get } from 'lodash';
import d3 from 'd3';
import moment from 'moment';

import { EuiPopover, useEuiTheme } from '@elastic/eui';

import { i18n } from '@kbn/i18n';
import {
  getFormattedSeverityScore,
  getSeverityWithLow,
  getThemeResolvedSeverityColor,
  ML_ANOMALY_THRESHOLD,
} from '@kbn/ml-anomaly-utils';
import { formatHumanReadableDateTimeSeconds } from '@kbn/ml-date-utils';
import { context } from '@kbn/kibana-react-plugin/public';

import { getTableItemClosestToTimestamp } from '../../../../../common/util/anomalies_table_utils';

import { formatValue } from '../../../formatters/format_value';
import {
  LINE_CHART_ANOMALY_RADIUS,
  ANNOTATION_SYMBOL_HEIGHT,
  MULTI_BUCKET_SYMBOL_SIZE,
  SCHEDULED_EVENT_SYMBOL_HEIGHT,
  drawLineChartDots,
  filterAxisLabels,
  numTicksForDateFormat,
  showMultiBucketAnomalyMarker,
  showMultiBucketAnomalyTooltip,
  getMultiBucketImpactTooltipValue,
} from '../../../util/chart_utils';
import { timeBucketsServiceFactory } from '../../../util/time_buckets_service';
import { mlTableService } from '../../../services/table_service';
import { ContextChartMask } from '../context_chart_mask';
import { timeSeriesExplorerServiceFactory } from '../../../util/time_series_explorer_service';
import { mlEscape } from '../../../util/string_utils';
import {
  ANNOTATION_MASK_ID,
  getAnnotationBrush,
  getAnnotationLevels,
  getAnnotationWidth,
  renderAnnotations,
  highlightFocusChartAnnotation,
  unhighlightFocusChartAnnotation,
  ANNOTATION_MIN_WIDTH,
} from './timeseries_chart_annotations';
import { MlAnnotationUpdatesContext } from '../../../contexts/ml/ml_annotation_updates_context';

import { LinksMenuUI } from '../../../components/anomalies_table/links_menu';
import { RuleEditorFlyout } from '../../../components/rule_editor';

const percentFocusChartHeight = 0.634;
const minSvgHeight = 350;

const focusZoomPanelHeight = 25;
const focusChartHeight = 310;
const focusHeight = focusZoomPanelHeight + focusChartHeight;
const contextChartHeight = 60;
const contextChartLineTopMargin = 3;
const chartSpacing = 25;
const swimlaneHeight = 30;
const ctxAnnotationMargin = 2;
const popoverMenuOffset = 28;
const annotationHeight = ANNOTATION_SYMBOL_HEIGHT + ctxAnnotationMargin * 2;
const margin = { top: 10, right: 10, bottom: 15, left: 40 };

const ZOOM_INTERVAL_OPTIONS = [
  { duration: moment.duration(1, 'h'), label: '1h' },
  { duration: moment.duration(12, 'h'), label: '12h' },
  { duration: moment.duration(1, 'd'), label: '1d' },
  { duration: moment.duration(1, 'w'), label: '1w' },
  { duration: moment.duration(2, 'w'), label: '2w' },
  { duration: moment.duration(1, 'M'), label: '1M' },
];

function getChartHeights(height) {
  const actualHeight = height < minSvgHeight ? minSvgHeight : height;
  const focusChartHeight = Math.round(actualHeight * percentFocusChartHeight);

  const heights = {
    focusChartHeight,
    focusHeight: focusZoomPanelHeight + focusChartHeight,
  };
  return heights;
}

function getSvgHeight(showAnnotations, incomingHeight) {
  const adjustedAnnotationHeight = showAnnotations ? annotationHeight : 0;
  const incomingHeightActual =
    incomingHeight && incomingHeight < minSvgHeight ? minSvgHeight : incomingHeight;
  const { focusHeight: focusHeightIncoming } = incomingHeight
    ? getChartHeights(incomingHeightActual)
    : {};

  return (
    (focusHeightIncoming ?? focusHeight) +
    contextChartHeight +
    swimlaneHeight +
    adjustedAnnotationHeight +
    chartSpacing +
    margin.top +
    margin.bottom
  );
}

class TimeseriesChartIntl extends Component {
  static propTypes = {
    annotation: PropTypes.object,
    anomalyColorScale: PropTypes.func.isRequired,
    autoZoomDuration: PropTypes.number,
    bounds: PropTypes.object,
    contextAggregationInterval: PropTypes.object,
    contextChartData: PropTypes.array,
    contextForecastData: PropTypes.array,
    contextChartSelected: PropTypes.func.isRequired,
    detectorIndex: PropTypes.number,
    embeddableMode: PropTypes.bool,
    focusAggregationInterval: PropTypes.object,
    focusAnnotationData: PropTypes.array,
    focusChartData: PropTypes.array,
    focusForecastData: PropTypes.array,
    modelPlotEnabled: PropTypes.bool.isRequired,
    renderFocusChartOnly: PropTypes.bool.isRequired,
    selectedJob: PropTypes.object,
    showForecast: PropTypes.bool.isRequired,
    showModelBounds: PropTypes.bool.isRequired,
    svgWidth: PropTypes.number.isRequired,
    swimlaneData: PropTypes.array,
    zoomFrom: PropTypes.object,
    zoomTo: PropTypes.object,
    zoomFromFocusLoaded: PropTypes.object,
    zoomToFocusLoaded: PropTypes.object,
    tooltipService: PropTypes.object.isRequired,
    tableData: PropTypes.object,
    sourceIndicesWithGeoFields: PropTypes.object.isRequired,
  };

  static contextType = context;
  getTimeBuckets;
  mlTimeSeriesExplorer;

  rowMouseenterSubscriber = null;
  rowMouseleaveSubscriber = null;

  constructor(props, constructorContext) {
    super(props);
    this.state = { popoverData: null, popoverCoords: [0, 0], showRuleEditorFlyout: () => {} };

    this.mlTimeSeriesExplorer = timeSeriesExplorerServiceFactory(
      constructorContext.services.uiSettings,
      constructorContext.services.mlServices.mlApi,
      constructorContext.services.mlServices.mlResultsService
    );
    this.getTimeBuckets = timeBucketsServiceFactory(
      constructorContext.services.uiSettings
    ).getTimeBuckets;
  }

  componentWillUnmount() {
    const element = d3.select(this.rootNode);
    element.html('');

    if (this.rowMouseenterSubscriber !== null) {
      this.rowMouseenterSubscriber.unsubscribe();
    }
    if (this.rowMouseleaveSubscriber !== null) {
      this.rowMouseleaveSubscriber.unsubscribe();
    }
  }

  componentDidMount() {
    const { svgWidth, svgHeight } = this.props;
    const { focusHeight: focusHeightIncoming, focusChartHeight: focusChartIncoming } = svgHeight
      ? getChartHeights(svgHeight)
      : {};

    this.vizWidth = svgWidth - margin.left - margin.right;
    const vizWidth = this.vizWidth;

    this.focusXScale = d3.time.scale().range([0, vizWidth]);
    this.focusYScale = d3.scale
      .linear()
      .range([focusHeightIncoming ?? focusHeight, focusZoomPanelHeight]);
    const focusXScale = this.focusXScale;
    const focusYScale = this.focusYScale;

    this.focusXAxis = d3.svg
      .axis()
      .scale(focusXScale)
      .orient('bottom')
      .innerTickSize(-(focusChartIncoming ?? focusChartHeight))
      .outerTickSize(0)
      .tickPadding(10);
    this.focusYAxis = d3.svg
      .axis()
      .scale(focusYScale)
      .orient('left')
      .innerTickSize(-vizWidth)
      .outerTickSize(0)
      .tickPadding(10);

    this.focusValuesLine = d3.svg
      .line()
      .x(function (d) {
        return focusXScale(d.date);
      })
      .y(function (d) {
        return focusYScale(d.value);
      })
      .defined((d) => d.value !== null);
    this.focusBoundedArea = d3.svg
      .area()
      .x(function (d) {
        return focusXScale(d.date) || 1;
      })
      .y0(function (d) {
        return focusYScale(d.upper);
      })
      .y1(function (d) {
        return focusYScale(d.lower);
      })
      .defined((d) => d.lower !== null && d.upper !== null);

    this.contextXScale = d3.time.scale().range([0, vizWidth]);
    this.contextYScale = d3.scale.linear().range([contextChartHeight, contextChartLineTopMargin]);

    this.fieldFormat = undefined;

    // Annotations Brush
    this.annotateBrush = getAnnotationBrush.call(this);

    // brush for focus brushing
    this.brush = d3.svg.brush();

    this.mask = undefined;

    // Listeners for mouseenter/leave events for rows in the table
    // to highlight the corresponding anomaly mark in the focus chart.
    const highlightFocusChartAnomaly = this.highlightFocusChartAnomaly.bind(this);
    const boundHighlightFocusChartAnnotation = highlightFocusChartAnnotation.bind(this);
    function tableRecordMousenterListener({ record, type = 'anomaly' }) {
      // do not display tooltips if the action popover is active
      if (this.state.popoverData !== null) {
        return;
      } else if (type === 'anomaly') {
        highlightFocusChartAnomaly(record);
      } else if (type === 'annotation') {
        boundHighlightFocusChartAnnotation(record);
      }
    }

    const unhighlightFocusChartAnomaly = this.unhighlightFocusChartAnomaly.bind(this);
    const boundUnhighlightFocusChartAnnotation = unhighlightFocusChartAnnotation.bind(this);
    function tableRecordMouseleaveListener({ record, type = 'anomaly' }) {
      if (type === 'anomaly') {
        unhighlightFocusChartAnomaly();
      } else {
        boundUnhighlightFocusChartAnnotation(record);
      }
    }

    this.rowMouseenterSubscriber = mlTableService.rowMouseenter$.subscribe(
      tableRecordMousenterListener.bind(this)
    );
    this.rowMouseleaveSubscriber = mlTableService.rowMouseleave$.subscribe(
      tableRecordMouseleaveListener
    );

    this.renderChart();
    this.drawContextChartSelection();
    this.renderFocusChart();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.renderFocusChartOnly === false ||
      prevProps.svgWidth !== this.props.svgWidth ||
      prevProps.showAnnotations !== this.props.showAnnotations ||
      prevProps.annotationData !== this.props.annotationData
    ) {
      this.renderChart();
      this.drawContextChartSelection();
    }

    this.renderFocusChart();

    if (this.props.annotation === null) {
      const chartElement = d3.select(this.rootNode);
      chartElement.select('g.ml-annotation__brush').call(this.annotateBrush.extent([0, 0]));
    }
  }

  renderChart() {
    const {
      contextChartData,
      contextForecastData,
      detectorIndex,
      modelPlotEnabled,
      selectedJob,
      svgWidth,
      svgHeight: incomingSvgHeight,
      showAnnotations,
    } = this.props;

    const createFocusChart = this.createFocusChart.bind(this);
    const drawContextElements = this.drawContextElements.bind(this);
    const focusXScale = this.focusXScale;
    const focusYAxis = this.focusYAxis;
    const focusYScale = this.focusYScale;

    const svgHeight = getSvgHeight(showAnnotations, incomingSvgHeight);
    const { focusHeight: focusHeightIncoming } = incomingSvgHeight
      ? getChartHeights(incomingSvgHeight)
      : {};

    // Clear any existing elements from the visualization,
    // then build the svg elements for the bubble chart.
    const chartElement = d3.select(this.rootNode);
    chartElement.selectAll('*').remove();

    if (typeof selectedJob !== 'undefined') {
      this.fieldFormat = this.context.services.mlServices.mlFieldFormatService.getFieldFormat(
        selectedJob.job_id,
        detectorIndex
      );
    } else {
      return;
    }

    if (contextChartData === undefined) {
      return;
    }

    const fieldFormat = this.fieldFormat;

    const svg = chartElement.append('svg').attr('width', svgWidth).attr('height', svgHeight);

    let contextDataMin;
    let contextDataMax;
    if (
      modelPlotEnabled === true ||
      (contextForecastData !== undefined && contextForecastData.length > 0)
    ) {
      const combinedData =
        contextForecastData === undefined
          ? contextChartData
          : contextChartData.concat(contextForecastData);

      contextDataMin = d3.min(combinedData, (d) => Math.min(d.value, d.lower));
      contextDataMax = d3.max(combinedData, (d) => Math.max(d.value, d.upper));
    } else {
      contextDataMin = d3.min(contextChartData, (d) => d.value);
      contextDataMax = d3.max(contextChartData, (d) => d.value);
    }

    // Set the size of the left margin according to the width of the largest y axis tick label.
    // The min / max of the aggregated context chart data may be less than the min / max of the
    // data which is displayed in the focus chart which is likely to be plotted at a lower
    // aggregation interval. Therefore ceil the min / max with the higher absolute value to allow
    // for extra space for chart labels which may have higher values than the context data
    // e.g. aggregated max may be 9500, whereas focus plot max may be 11234.
    const ceiledMax =
      contextDataMax > 0
        ? Math.pow(10, Math.ceil(Math.log10(Math.abs(contextDataMax))))
        : contextDataMax;

    const flooredMin =
      contextDataMin >= 0
        ? contextDataMin
        : -1 * Math.pow(10, Math.ceil(Math.log10(Math.abs(contextDataMin))));

    // Temporarily set the domain of the focus y axis to the min / max of the full context chart
    // data range so that we can measure the maximum tick label width on temporary text elements.
    focusYScale.domain([flooredMin, ceiledMax]);

    let maxYAxisLabelWidth = 0;
    const tempLabelText = svg.append('g').attr('class', 'temp-axis-label tick');
    tempLabelText
      .selectAll('text.temp.axis')
      .data(focusYScale.ticks())
      .enter()
      .append('text')
      .text((d) => {
        if (fieldFormat !== undefined) {
          return fieldFormat.convert(d, 'text');
        } else {
          return focusYScale.tickFormat()(d);
        }
      })
      .each(function () {
        maxYAxisLabelWidth = Math.max(
          this.getBBox().width + focusYAxis.tickPadding(),
          maxYAxisLabelWidth
        );
      })
      .remove();
    chartElement.select('.temp-axis-label').remove();

    margin.left = Math.max(maxYAxisLabelWidth, 40);
    this.vizWidth = Math.max(svgWidth - margin.left - margin.right, 0);
    focusXScale.range([0, this.vizWidth]);
    focusYAxis.innerTickSize(-this.vizWidth);

    if (focusHeightIncoming !== undefined) {
      focusYScale.range([focusHeightIncoming, focusZoomPanelHeight]);
    }

    const focus = svg
      .append('g')
      .attr('class', 'focus-chart')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    const context = svg
      .append('g')
      .attr('class', 'context-chart')
      .attr(
        'transform',
        'translate(' +
          margin.left +
          ',' +
          ((focusHeightIncoming ?? focusHeight) + margin.top + chartSpacing) +
          ')'
      );

    // Mask to hide annotations overflow
    const annotationsMask = svg.append('defs').append('mask').attr('id', ANNOTATION_MASK_ID);

    annotationsMask
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.vizWidth)
      .attr('height', focusHeightIncoming ?? focusHeight)
      .style('fill', 'white');

    // Draw each of the component elements.
    createFocusChart(focus, this.vizWidth, focusHeightIncoming ?? focusHeight);
    drawContextElements(
      context,
      this.vizWidth,
      contextChartHeight,
      swimlaneHeight,
      annotationHeight
    );
  }

  contextChartInitialized = false;
  drawContextChartSelection() {
    const { contextChartData, contextForecastData, zoomFrom, zoomTo } = this.props;

    if (contextChartData === undefined) {
      return;
    }

    // Make appropriate selection in the context chart to trigger loading of the focus chart.
    let focusLoadFrom;
    let focusLoadTo;
    const contextXMin = this.contextXScale.domain()[0].getTime();
    const contextXMax = this.contextXScale.domain()[1].getTime();

    let combinedData = contextChartData;
    if (contextForecastData !== undefined) {
      combinedData = combinedData.concat(contextForecastData);
    }

    if (zoomFrom) {
      focusLoadFrom = zoomFrom.getTime();
    } else {
      focusLoadFrom = reduce(
        combinedData,
        (memo, point) => Math.min(memo, point.date.getTime()),
        new Date(2099, 12, 31).getTime()
      );
    }
    focusLoadFrom = Math.max(focusLoadFrom, contextXMin);

    if (zoomTo) {
      focusLoadTo = zoomTo.getTime();
    } else {
      focusLoadTo = reduce(combinedData, (memo, point) => Math.max(memo, point.date.getTime()), 0);
    }
    focusLoadTo = Math.min(focusLoadTo, contextXMax);

    if (focusLoadFrom !== contextXMin || focusLoadTo !== contextXMax) {
      this.setContextBrushExtent(new Date(focusLoadFrom), new Date(focusLoadTo));
      const newSelectedBounds = {
        min: moment(new Date(focusLoadFrom)),
        max: moment(focusLoadFrom),
      };
      this.selectedBounds = newSelectedBounds;
    } else {
      const contextXScaleDomain = this.contextXScale.domain();
      const newSelectedBounds = {
        min: moment(new Date(contextXScaleDomain[0])),
        max: moment(contextXScaleDomain[1]),
      };
      if (!isEqual(newSelectedBounds, this.selectedBounds)) {
        this.selectedBounds = newSelectedBounds;
        this.setContextBrushExtent(
          new Date(contextXScaleDomain[0]),
          new Date(contextXScaleDomain[1])
        );
      }
    }
  }

  createFocusChart(fcsGroup, fcsWidth, fcsHeight) {
    // Split out creation of the focus chart from the rendering,
    // as we want to re-render the paths and points when the zoom area changes.

    const { contextForecastData } = this.props;
    const { focusChartHeight: focusChartIncoming } = this.props.svgHeight
      ? getChartHeights(this.props.svgHeight)
      : {};

    // Add a group at the top to display info on the chart aggregation interval
    // and links to set the brush span to 1h, 1d, 1w etc.
    const zoomGroup = fcsGroup.append('g').attr('class', 'focus-zoom');
    zoomGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', fcsWidth)
      .attr('height', focusZoomPanelHeight)
      .attr('class', 'chart-border');
    this.createZoomInfoElements(zoomGroup, fcsWidth);

    // Create the elements for annotations
    const annotateBrush = this.annotateBrush.bind(this);

    let brushX = 0;
    let brushWidth = 0;

    if (this.props.annotation !== null) {
      // If the annotation brush is showing, set it to the same position
      brushX = this.focusXScale(this.props.annotation.timestamp);
      brushWidth = getAnnotationWidth(this.props.annotation, this.focusXScale);
    }

    fcsGroup
      .append('g')
      .attr('class', 'ml-annotation__brush')
      .call(annotateBrush)
      .selectAll('rect')
      .attr('x', brushX)
      .attr('y', focusZoomPanelHeight)
      .attr('width', brushWidth)
      .attr('height', focusChartIncoming ?? focusChartHeight);

    fcsGroup.append('g').classed('ml-annotations', true);

    // Add border round plot area.
    fcsGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', focusZoomPanelHeight)
      .attr('width', fcsWidth)
      .attr('height', focusChartIncoming ?? focusChartHeight)
      .attr('class', 'chart-border');

    // Add background for x axis.
    const xAxisBg = fcsGroup.append('g').attr('class', 'x-axis-background');
    xAxisBg
      .append('rect')
      .attr('x', 0)
      .attr('y', fcsHeight)
      .attr('width', fcsWidth)
      .attr('height', chartSpacing);
    xAxisBg
      .append('line')
      .attr('x1', 0)
      .attr('y1', fcsHeight)
      .attr('x2', 0)
      .attr('y2', fcsHeight + chartSpacing);
    xAxisBg
      .append('line')
      .attr('x1', fcsWidth)
      .attr('y1', fcsHeight)
      .attr('x2', fcsWidth)
      .attr('y2', fcsHeight + chartSpacing);
    xAxisBg
      .append('line')
      .attr('x1', 0)
      .attr('y1', fcsHeight + chartSpacing)
      .attr('x2', fcsWidth)
      .attr('y2', fcsHeight + chartSpacing);

    const axes = fcsGroup.append('g');
    axes
      .append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + fcsHeight + ')');
    axes.append('g').attr('class', 'y axis');

    // Create the elements for the metric value line and model bounds area.
    fcsGroup.append('path').attr('class', 'area bounds');
    fcsGroup.append('path').attr('class', 'values-line');
    fcsGroup.append('g').attr('class', 'focus-chart-markers');

    // Create the path elements for the forecast value line and bounds area.
    if (contextForecastData) {
      fcsGroup
        .append('path')
        .attr('class', 'area forecast')
        .attr('data-test-subj', 'mlForecastArea');
      fcsGroup
        .append('path')
        .attr('class', 'values-line forecast')
        .attr('data-test-subj', 'mlForecastValuesline');
      fcsGroup
        .append('g')
        .attr('class', 'focus-chart-markers forecast')
        .attr('data-test-subj', 'mlForecastMarkers');
    }

    fcsGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', fcsWidth)
      .attr('height', fcsHeight + 24)
      .attr('class', 'chart-border chart-border-highlight');
  }

  renderFocusChart() {
    const {
      embeddableMode,
      focusAggregationInterval,
      focusAnnotationData: focusAnnotationDataOriginalPropValue,
      focusChartData,
      focusForecastData,
      modelPlotEnabled,
      selectedJob,
      showAnnotations,
      showForecast,
      showModelBounds,
      zoomFromFocusLoaded,
      zoomToFocusLoaded,
    } = this.props;

    const focusAnnotationData = Array.isArray(focusAnnotationDataOriginalPropValue)
      ? focusAnnotationDataOriginalPropValue
      : [];

    if (focusChartData === undefined) {
      return;
    }

    const data = focusChartData;

    const contextYScale = this.contextYScale;
    const showAnomalyPopover = this.showAnomalyPopover.bind(this);
    const showFocusChartTooltip = this.showFocusChartTooltip.bind(this);
    const hideFocusChartTooltip = this.props.tooltipService.hide.bind(this.props.tooltipService);

    const chartElement = d3.select(this.rootNode);
    const focusChart = chartElement.select('.focus-chart');

    // Update the plot interval labels.
    const focusAggInt = focusAggregationInterval.expression;
    const bucketSpan = selectedJob.analysis_config.bucket_span;
    chartElement.select('.zoom-aggregation-interval').text(
      i18n.translate('xpack.ml.timeSeriesExplorer.timeSeriesChart.zoomAggregationIntervalLabel', {
        defaultMessage: '(aggregation interval: {focusAggInt}, bucket span: {bucketSpan})',
        values: { focusAggInt, bucketSpan },
      })
    );

    // Render the axes.

    // Calculate the x axis domain.
    // Elasticsearch aggregation returns points at start of bucket,
    // so set the x-axis min to the start of the first aggregation interval,
    // and the x-axis max to the end of the last aggregation interval.
    if (zoomFromFocusLoaded === undefined || zoomToFocusLoaded === undefined) {
      return;
    }
    const bounds = {
      min: moment(zoomFromFocusLoaded.getTime()),
      max: moment(zoomToFocusLoaded.getTime()),
    };

    const aggMs = focusAggregationInterval.asMilliseconds();
    const earliest = moment(Math.floor(bounds.min.valueOf() / aggMs) * aggMs);
    const latest = moment(Math.ceil(bounds.max.valueOf() / aggMs) * aggMs);
    this.focusXScale.domain([earliest.toDate(), latest.toDate()]);

    // Calculate the y-axis domain.
    if (
      focusChartData.length > 0 ||
      (focusForecastData !== undefined && focusForecastData.length > 0)
    ) {
      if (this.fieldFormat !== undefined) {
        this.focusYAxis.tickFormat((d) => this.fieldFormat.convert(d, 'text'));
      } else {
        // Use default tick formatter.
        this.focusYAxis.tickFormat(null);
      }

      // Calculate the min/max of the metric data and the forecast data.
      let yMin = 0;
      let yMax = 0;

      let combinedData = data;
      if (showForecast && focusForecastData !== undefined && focusForecastData.length > 0) {
        combinedData = data.concat(focusForecastData);
      }

      yMin = d3.min(combinedData, (d) => {
        let metricValue = d.value;
        if (metricValue === null && d.anomalyScore !== undefined && d.actual !== undefined) {
          // If an anomaly coincides with a gap in the data, use the anomaly actual value.
          metricValue = Array.isArray(d.actual) ? d.actual[0] : d.actual;
        }
        if (d.lower !== undefined) {
          if (metricValue !== null && metricValue !== undefined) {
            return Math.min(metricValue, d.lower);
          } else {
            // Set according to the minimum of the lower of the model plot results.
            return d.lower;
          }
        }
        // metricValue is undefined for scheduled events when there is no source data.
        return metricValue || 0;
      });
      yMax = d3.max(combinedData, (d) => {
        let metricValue = d.value;
        if (metricValue === null && d.anomalyScore !== undefined && d.actual !== undefined) {
          // If an anomaly coincides with a gap in the data, use the anomaly actual value.
          metricValue = Array.isArray(d.actual) ? d.actual[0] : d.actual;
        }
        // metricValue is undefined for scheduled events when there is no source data.
        return d.upper !== undefined ? Math.max(metricValue, d.upper) : metricValue || 0;
      });

      if (yMax === yMin) {
        if (
          this.contextYScale.domain()[0] !== contextYScale.domain()[1] &&
          yMin >= contextYScale.domain()[0] &&
          yMax <= contextYScale.domain()[1]
        ) {
          // Set the focus chart limits to be the same as the context chart.
          yMin = contextYScale.domain()[0];
          yMax = contextYScale.domain()[1];
        } else {
          yMin -= yMin * 0.05;
          yMax += yMax * 0.05;
        }
      }

      // if annotations are present, we extend yMax to avoid overlap
      // between annotation labels, chart lines and anomalies.
      if (showAnnotations && focusAnnotationData && focusAnnotationData.length > 0) {
        const levels = getAnnotationLevels(focusAnnotationData);
        const maxLevel = d3.max(Object.keys(levels).map((key) => levels[key]));
        // TODO needs revisiting to be a more robust normalization
        yMax += Math.abs(yMax - yMin) * ((maxLevel + 1) / 5);
      }

      this.focusYScale.domain([yMin, yMax]);
    } else {
      // Display 10 unlabelled ticks.
      this.focusYScale.domain([0, 10]);
      this.focusYAxis.tickFormat('');
    }

    // Get the scaled date format to use for x axis tick labels.
    const timeBuckets = this.getTimeBuckets();
    timeBuckets.setInterval('auto');
    timeBuckets.setBounds(bounds);
    const xAxisTickFormat = timeBuckets.getScaledDateFormat();
    focusChart.select('.x.axis').call(
      this.focusXAxis
        .ticks(numTicksForDateFormat(this.vizWidth), xAxisTickFormat)
        .tickFormat((d) => {
          return moment(d).format(xAxisTickFormat);
        })
    );
    focusChart.select('.y.axis').call(this.focusYAxis);

    filterAxisLabels(focusChart.select('.x.axis'), this.vizWidth);

    // Render the bounds area and values line.
    if (modelPlotEnabled === true) {
      focusChart
        .select('.area.bounds')
        .attr('d', this.focusBoundedArea(data))
        .classed('hidden', !showModelBounds);
    }

    const { focusChartHeight: focusChartIncoming, focusHeight: focusHeightIncoming } = this.props
      .svgHeight
      ? getChartHeights(this.props.svgHeight)
      : {};

    renderAnnotations(
      focusChart,
      focusAnnotationData,
      focusZoomPanelHeight,
      focusChartIncoming ?? focusChartHeight,
      this.focusXScale,
      showAnnotations,
      showFocusChartTooltip,
      hideFocusChartTooltip,
      this.props.annotationUpdatesService
    );

    // disable brushing (creation of annotations) when annotations aren't shown or when in embeddable mode
    focusChart
      .select('.ml-annotation__brush')
      .style('display', !showAnnotations || embeddableMode ? 'none' : null);

    focusChart.select('.values-line').attr('d', this.focusValuesLine(data));
    drawLineChartDots(data, focusChart, this.focusValuesLine);

    // Render circle markers for the points.
    // These are used for displaying tooltips on mouseover.
    // Don't render dots where value=null (data gaps, with no anomalies)
    // or for multi-bucket anomalies.
    const dots = chartElement
      .select('.focus-chart-markers')
      .selectAll('.metric-value')
      .data(
        data.filter(
          (d) =>
            (d.value !== null || typeof d.anomalyScore === 'number') &&
            !showMultiBucketAnomalyMarker(d)
        )
      );

    const that = this;

    // Remove dots that are no longer needed i.e. if number of chart points has decreased.
    dots.exit().remove();
    // Create any new dots that are needed i.e. if number of chart points has increased.
    dots
      .enter()
      .append('circle')
      .attr('r', LINE_CHART_ANOMALY_RADIUS)
      .on('click', function (d) {
        d3.event.preventDefault();
        if (d.anomalyScore === undefined) return;
        showAnomalyPopover(d, this);
      })
      .on('mouseover', function (d) {
        // Show the tooltip only if the actions menu isn't active
        if (that.state.popoverData === null) {
          showFocusChartTooltip(d, this);
        }
      })
      .on('mouseout', () => this.props.tooltipService.hide());

    // Update all dots to new positions.
    dots
      .attr('cx', (d) => {
        return this.focusXScale(d.date);
      })
      .attr('cy', (d) => {
        return this.focusYScale(d.value);
      })
      .attr('data-test-subj', (d) => (d.anomalyScore !== undefined ? 'mlAnomalyMarker' : undefined))
      .attr('class', (d) => {
        let markerClass = 'metric-value';
        if (d.anomalyScore !== undefined) {
          markerClass += ` anomaly-marker ${getSeverityWithLow(d.anomalyScore).id}`;
        }
        return markerClass;
      });

    // Render cross symbols for any multi-bucket anomalies.
    const multiBucketMarkers = chartElement
      .select('.focus-chart-markers')
      .selectAll('.multi-bucket')
      .data(
        data.filter((d) => d.anomalyScore !== null && showMultiBucketAnomalyMarker(d) === true)
      );

    // Remove multi-bucket markers that are no longer needed.
    multiBucketMarkers.exit().remove();

    // Add any new markers that are needed i.e. if number of multi-bucket points has increased.
    multiBucketMarkers
      .enter()
      .append('path')
      .attr('d', d3.svg.symbol().size(MULTI_BUCKET_SYMBOL_SIZE).type('cross'))
      .on('click', function (d) {
        d3.event.preventDefault();
        if (d.anomalyScore === undefined) return;
        showAnomalyPopover(d, this);
      })
      .on('mouseover', function (d) {
        showFocusChartTooltip(d, this);
      })
      .on('mouseout', () => this.props.tooltipService.hide());

    // Update all markers to new positions.
    multiBucketMarkers
      .attr(
        'transform',
        (d) => `translate(${this.focusXScale(d.date)}, ${this.focusYScale(d.value)})`
      )
      .attr('data-test-subj', 'mlAnomalyMarker')
      .attr('class', (d) => `anomaly-marker multi-bucket ${getSeverityWithLow(d.anomalyScore).id}`);

    // Add rectangular markers for any scheduled events.
    const scheduledEventMarkers = chartElement
      .select('.focus-chart-markers')
      .selectAll('.scheduled-event-marker')
      .data(data.filter((d) => d.scheduledEvents !== undefined));

    // Remove markers that are no longer needed i.e. if number of chart points has decreased.
    scheduledEventMarkers.exit().remove();

    // Create any new markers that are needed i.e. if number of chart points has increased.
    scheduledEventMarkers
      .enter()
      .append('rect')
      .on('mouseover', function (d) {
        showFocusChartTooltip(d, this);
      })
      .on('mouseout', () => hideFocusChartTooltip())
      .attr('width', LINE_CHART_ANOMALY_RADIUS * 2)
      .attr('height', SCHEDULED_EVENT_SYMBOL_HEIGHT)
      .attr('class', 'scheduled-event-marker')
      .attr('rx', 1)
      .attr('ry', 1);

    // Update all markers to new positions.
    scheduledEventMarkers
      .attr('x', (d) => this.focusXScale(d.date) - LINE_CHART_ANOMALY_RADIUS)
      .attr('y', (d) => {
        const focusYValue = this.focusYScale(d.value);
        return isNaN(focusYValue) ? -(focusHeightIncoming ?? focusHeight) - 3 : focusYValue - 3;
      });

    // Plot any forecast data in scope.
    if (focusForecastData !== undefined) {
      focusChart
        .select('.area.forecast')
        .attr('d', this.focusBoundedArea(focusForecastData))
        .classed('hidden', !showForecast);
      focusChart
        .select('.values-line.forecast')
        .attr('d', this.focusValuesLine(focusForecastData))
        .classed('hidden', !showForecast);

      const forecastDots = chartElement
        .select('.focus-chart-markers.forecast')
        .selectAll('.metric-value')
        .data(focusForecastData);

      // Remove dots that are no longer needed i.e. if number of forecast points has decreased.
      forecastDots.exit().remove();
      // Create any new dots that are needed i.e. if number of forecast points has increased.
      forecastDots
        .enter()
        .append('circle')
        .attr('r', LINE_CHART_ANOMALY_RADIUS)
        .on('mouseover', function (d) {
          showFocusChartTooltip(d, this);
        })
        .on('mouseout', () => this.props.tooltipService.hide());

      // Update all dots to new positions.
      forecastDots
        .attr('cx', (d) => {
          return this.focusXScale(d.date);
        })
        .attr('cy', (d) => {
          return this.focusYScale(d.value);
        })
        .attr('class', 'metric-value')
        .classed('hidden', !showForecast);
    }
  }

  createZoomInfoElements(zoomGroup, fcsWidth) {
    const { autoZoomDuration, bounds, modelPlotEnabled } = this.props;

    const setZoomInterval = this.setZoomInterval.bind(this);

    // Create zoom duration links applicable for the current time span.
    // Don't add links for any durations which would give a brush extent less than 10px.
    const boundsSecs = bounds.max.unix() - bounds.min.unix();
    const minSecs = (10 / this.vizWidth) * boundsSecs;

    let xPos = 10;
    const zoomLabel = zoomGroup
      .append('text')
      .attr('x', xPos)
      .attr('y', 17)
      .attr('class', 'zoom-info-text')
      .text(
        i18n.translate('xpack.ml.timeSeriesExplorer.timeSeriesChart.zoomLabel', {
          defaultMessage: 'Zoom:',
        })
      );

    const zoomOptions = [{ durationMs: autoZoomDuration, label: 'auto' }];
    each(ZOOM_INTERVAL_OPTIONS, (option) => {
      if (option.duration.asSeconds() > minSecs && option.duration.asSeconds() < boundsSecs) {
        zoomOptions.push({ durationMs: option.duration.asMilliseconds(), label: option.label });
      }
    });
    xPos += zoomLabel.node().getBBox().width + 4;

    each(zoomOptions, (option) => {
      const text = zoomGroup
        .append('a')
        .attr('data-ms', option.durationMs)
        .attr('href', '')
        .append('text')
        .attr('x', xPos)
        .attr('y', 17)
        .attr('class', 'zoom-info-text')
        .text(option.label);

      xPos += text.node().getBBox().width + 4;
    });

    zoomGroup
      .append('text')
      .attr('x', xPos + 6)
      .attr('y', 17)
      .attr('class', 'zoom-info-text zoom-aggregation-interval')
      .text(
        i18n.translate(
          'xpack.ml.timeSeriesExplorer.timeSeriesChart.zoomGroupAggregationIntervalLabel',
          {
            defaultMessage: '(aggregation interval: , bucket span: )',
          }
        )
      );

    if (modelPlotEnabled === false) {
      const modelPlotLabel = zoomGroup
        .append('text')
        .attr('x', 300)
        .attr('y', 17)
        .attr('class', 'zoom-info-text')
        .text(
          i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.modelBoundsNotAvailableLabel',
            {
              defaultMessage: 'Model bounds are not available',
            }
          )
        );

      modelPlotLabel.attr('x', fcsWidth - (modelPlotLabel.node().getBBox().width + 10));
    }

    const chartElement = d3.select(this.rootNode);
    chartElement.selectAll('.focus-zoom a').on('click', function () {
      d3.event.preventDefault();
      setZoomInterval(this.getAttribute('data-ms'));
    });
  }

  drawContextElements(cxtGroup, cxtWidth, cxtChartHeight, swlHeight) {
    const { bounds, contextChartData, contextForecastData, modelPlotEnabled, annotationData } =
      this.props;
    const data = contextChartData;

    const focusAnnotationData = Array.isArray(annotationData)
      ? [...annotationData].sort((a, b) => a.timestamp - b.timestamp)
      : [];

    // Since there might be lots of annotations which is hard to view
    // we should merge overlapping annotations into bigger annotation "blocks"
    let mergedAnnotations = [];
    if (focusAnnotationData.length > 0) {
      mergedAnnotations = [
        {
          start: focusAnnotationData[0].timestamp,
          end: focusAnnotationData[0].end_timestamp,
          annotations: [focusAnnotationData[0]],
        },
      ];
      let lastEndTime = focusAnnotationData[0].end_timestamp;

      // Since annotations/intervals are already sorted from earliest to latest
      // we can keep checking if next annotation starts before the last merged end_timestamp
      for (let i = 1; i < focusAnnotationData.length; i++) {
        if (focusAnnotationData[i].timestamp < lastEndTime) {
          // If it overlaps with last annotation block, update block with latest end_timestamp
          const itemToMerge = mergedAnnotations.pop();
          const newMergedItem = {
            ...itemToMerge,
            end: lastEndTime,
            // and add to list of annotations for that block
            annotations: [...itemToMerge.annotations, focusAnnotationData[i]],
          };
          mergedAnnotations.push(newMergedItem);
        } else {
          // If annotation does not overlap with previous block, add it as a new block
          mergedAnnotations.push({
            start: focusAnnotationData[i].timestamp,
            end: focusAnnotationData[i].end_timestamp,
            annotations: [focusAnnotationData[i]],
          });
        }
        lastEndTime = focusAnnotationData[i].end_timestamp;
      }
    }

    const showFocusChartTooltip = this.showFocusChartTooltip.bind(this);
    const hideFocusChartTooltip = this.props.tooltipService.hide.bind(this.props.tooltipService);

    this.contextXScale = d3.time
      .scale()
      .range([0, cxtWidth])
      .domain(this.calculateContextXAxisDomain());

    const combinedData =
      contextForecastData === undefined ? data : data.concat(contextForecastData);
    const valuesRange = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };
    each(combinedData, (item) => {
      const lowerBound = item.lower ?? Number.MAX_VALUE;
      const upperBound = item.upper ?? Number.MIN_VALUE;
      valuesRange.min = Math.min(item.value, lowerBound, valuesRange.min);
      valuesRange.max = Math.max(item.value, upperBound, valuesRange.max);
    });
    let dataMin = valuesRange.min;
    let dataMax = valuesRange.max;
    const chartLimits = { min: dataMin, max: dataMax };

    if (
      modelPlotEnabled === true ||
      (contextForecastData !== undefined && contextForecastData.length > 0)
    ) {
      const boundsRange = { min: Number.MAX_VALUE, max: Number.MIN_VALUE };
      each(combinedData, (item) => {
        boundsRange.min = Math.min(item.lower, boundsRange.min);
        boundsRange.max = Math.max(item.upper, boundsRange.max);
      });
      dataMin = Math.min(dataMin, boundsRange.min);
      dataMax = Math.max(dataMax, boundsRange.max);

      // Set the y axis domain so that the range of actual values takes up at least 50% of the full range.
      if (valuesRange.max - valuesRange.min < 0.5 * (dataMax - dataMin)) {
        if (valuesRange.min > dataMin) {
          chartLimits.min = valuesRange.min - 0.5 * (valuesRange.max - valuesRange.min);
        }

        if (valuesRange.max < dataMax) {
          chartLimits.max = valuesRange.max + 0.5 * (valuesRange.max - valuesRange.min);
        }
      }
    }

    this.contextYScale = d3.scale
      .linear()
      .range([cxtChartHeight, contextChartLineTopMargin])
      .domain([chartLimits.min, chartLimits.max]);

    const borders = cxtGroup.append('g').attr('class', 'axis');
    const brushChartHeight = cxtChartHeight + swlHeight + annotationHeight;

    // Add borders left and right.
    borders.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', brushChartHeight);
    borders
      .append('line')
      .attr('x1', cxtWidth)
      .attr('y1', 0)
      .attr('x2', cxtWidth)
      .attr('y2', brushChartHeight);

    // Add bottom borders
    borders
      .append('line')
      .attr('x1', 0)
      .attr('y1', brushChartHeight)
      .attr('x2', cxtWidth)
      .attr('y2', brushChartHeight);

    // Add x axis.
    const timeBuckets = this.getTimeBuckets();
    timeBuckets.setInterval('auto');
    timeBuckets.setBounds(bounds);
    const xAxisTickFormat = timeBuckets.getScaledDateFormat();
    const xAxis = d3.svg
      .axis()
      .scale(this.contextXScale)
      .orient('top')
      .innerTickSize(-cxtChartHeight)
      .outerTickSize(0)
      .tickPadding(0)
      .ticks(numTicksForDateFormat(cxtWidth, xAxisTickFormat))
      .tickFormat((d) => {
        return moment(d).format(xAxisTickFormat);
      });

    cxtGroup.datum(data);

    const contextBoundsArea = d3.svg
      .area()
      .x((d) => {
        return this.contextXScale(d.date);
      })
      .y0((d) => {
        return this.contextYScale(Math.min(chartLimits.max, Math.max(d.lower, chartLimits.min)));
      })
      .y1((d) => {
        return this.contextYScale(Math.max(chartLimits.min, Math.min(d.upper, chartLimits.max)));
      })
      .defined((d) => d.lower !== null && d.upper !== null);

    if (modelPlotEnabled === true) {
      cxtGroup.append('path').datum(data).attr('class', 'area bounds').attr('d', contextBoundsArea);
    }

    const contextValuesLine = d3.svg
      .line()
      .x((d) => {
        return this.contextXScale(d.date);
      })
      .y((d) => {
        return this.contextYScale(d.value);
      })
      .defined((d) => d.value !== null);

    cxtGroup.append('path').datum(data).attr('class', 'values-line').attr('d', contextValuesLine);
    drawLineChartDots(data, cxtGroup, contextValuesLine, 1);

    // Add annotation markers to the context area
    cxtGroup.append('g').classed('ml-annotation__context', true);

    const [contextXRangeStart, contextXRangeEnd] = this.contextXScale.range();
    const ctxAnnotations = cxtGroup
      .select('.ml-annotation__context')
      .selectAll('g.ml-annotation__context-item')
      .data(mergedAnnotations, (d) => `${d.start}-${d.end}` || '');

    ctxAnnotations.enter().append('g').classed('ml-annotation__context-item', true);

    const ctxAnnotationRects = ctxAnnotations
      .selectAll('.ml-annotation__context-rect')
      .data((d) => [d]);

    ctxAnnotationRects
      .enter()
      .append('rect')
      .on('mouseover', function (d) {
        showFocusChartTooltip(d.annotations.length === 1 ? d.annotations[0] : d, this);
      })
      .on('mouseout', () => hideFocusChartTooltip())
      .classed('ml-annotation__context-rect', true);

    ctxAnnotationRects
      .attr('x', (item) => {
        const date = moment(item.start);
        let xPos = this.contextXScale(date);

        if (xPos - ANNOTATION_SYMBOL_HEIGHT <= contextXRangeStart) {
          xPos = 0;
        }
        if (xPos + ANNOTATION_SYMBOL_HEIGHT >= contextXRangeEnd) {
          xPos = contextXRangeEnd - ANNOTATION_SYMBOL_HEIGHT;
        }

        return xPos;
      })
      .attr('y', cxtChartHeight + swlHeight + 2)
      .attr('height', ANNOTATION_SYMBOL_HEIGHT)
      .attr('width', (d) => {
        const start = Math.max(this.contextXScale(moment(d.start)) + 1, contextXRangeStart);
        const end = Math.min(
          contextXRangeEnd,
          typeof d.end !== 'undefined'
            ? this.contextXScale(moment(d.end)) - 1
            : start + ANNOTATION_MIN_WIDTH
        );
        const width = Math.max(ANNOTATION_MIN_WIDTH, end - start);
        return width;
      });

    ctxAnnotationRects.exit().remove();

    // Create the path elements for the forecast value line and bounds area.
    if (contextForecastData !== undefined) {
      cxtGroup
        .append('path')
        .datum(contextForecastData)
        .attr('class', 'area forecast')
        .attr('d', contextBoundsArea);
      cxtGroup
        .append('path')
        .datum(contextForecastData)
        .attr('class', 'values-line forecast')
        .attr('d', contextValuesLine);
    }

    // Create and draw the anomaly swimlane.
    const swimlane = cxtGroup
      .append('g')
      .attr('class', 'swimlane')
      .attr('transform', 'translate(0,' + cxtChartHeight + ')');

    this.drawSwimlane(swimlane, cxtWidth, swlHeight);

    // Draw a mask over the sections of the context chart and swimlane
    // which fall outside of the zoom brush selection area.
    this.mask = new ContextChartMask(cxtGroup, contextChartData, modelPlotEnabled, swlHeight)
      .x(this.contextXScale)
      .y(this.contextYScale);

    // Draw the x axis on top of the mask so that the labels are visible.
    cxtGroup.append('g').attr('class', 'x axis context-chart-axis').call(xAxis);

    // Move the x axis labels up so that they are inside the contact chart area.
    cxtGroup.selectAll('.x.context-chart-axis text').attr('dy', cxtChartHeight - 5);

    filterAxisLabels(cxtGroup.selectAll('.x.context-chart-axis'), cxtWidth);

    this.drawContextBrush(cxtGroup);
  }

  drawContextBrush = (contextGroup) => {
    const { contextChartSelected } = this.props;

    const brush = this.brush;
    const contextXScale = this.contextXScale;
    const mask = this.mask;

    // Create the brush for zooming in to the focus area of interest.
    brush.x(contextXScale).on('brush', brushing).on('brushend', brushed);

    contextGroup
      .append('g')
      .attr('class', 'x brush')
      .call(brush)
      .selectAll('rect')
      .attr('y', -1)
      .attr('height', contextChartHeight + swimlaneHeight + 1)
      .attr('width', this.vizWidth);

    const handleBrushExtent = brush.extent();

    // move the left and right resize areas over to
    // be under the handles
    contextGroup.selectAll('.w rect').attr('x', -10).attr('width', 10);

    contextGroup.selectAll('.e rect').attr('transform', null).attr('width', 10);

    const topBorder = contextGroup
      .append('rect')
      .attr('class', 'top-border')
      .attr('y', -2)
      .attr('height', contextChartLineTopMargin);

    const leftHandle = contextGroup
      .append('foreignObject')
      .attr('width', 10)
      .attr('height', 90)
      .attr('class', 'brush-handle')
      .attr('x', contextXScale(handleBrushExtent[0]) - 10).html(`
        <div class="brush-handle-inner brush-handle-inner-left" style="padding-top: 27px">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="6" height="9">
            <polygon points="5,0 5,8 0,4" />
          </svg>
        </div>`);
    const rightHandle = contextGroup
      .append('foreignObject')
      .attr('width', 10)
      .attr('height', 90)
      .attr('class', 'brush-handle')
      .attr('x', contextXScale(handleBrushExtent[1]) + 0).html(`
        <div class="brush-handle-inner brush-handle-inner-right" style="padding-top: 27px">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="6" height="9">
            <polygon points="0,0 0,8 5,4" />
          </svg>
        </div>`);

    const that = this;
    function brushing() {
      const brushExtent = brush.extent();
      mask.reveal(brushExtent);

      leftHandle.attr('x', contextXScale(brushExtent[0]) - 10);
      rightHandle.attr('x', contextXScale(brushExtent[1]) + 0);

      topBorder.attr('x', contextXScale(brushExtent[0]) + 1);
      // Use Math.max(0, ...) to make sure we don't end up
      // with a negative width which would cause an SVG error.
      const topBorderWidth = Math.max(
        0,
        contextXScale(brushExtent[1]) - contextXScale(brushExtent[0]) - 2
      );
      topBorder.attr('width', topBorderWidth);

      const isEmpty = brush.empty();
      const chartElement = d3.select(that.rootNode);
      chartElement.selectAll('.brush-handle').style('visibility', isEmpty ? 'hidden' : 'visible');
    }
    brushing();

    function brushed() {
      const isEmpty = brush.empty();
      const selectedBounds = isEmpty ? contextXScale.domain() : brush.extent();
      const selectionMin = selectedBounds[0].getTime();
      const selectionMax = selectedBounds[1].getTime();

      // Avoid triggering an update if bounds haven't changed
      if (
        that.selectedBounds !== undefined &&
        that.selectedBounds.min.valueOf() === selectionMin &&
        that.selectedBounds.max.valueOf() === selectionMax
      ) {
        return;
      }

      that.selectedBounds = { min: moment(selectionMin), max: moment(selectionMax) };
      contextChartSelected({ from: selectedBounds[0], to: selectedBounds[1] });
    }
  };

  drawSwimlane = (swlGroup, swlWidth, swlHeight) => {
    const { contextAggregationInterval, swimlaneData } = this.props;

    const data = swimlaneData;

    if (typeof data === 'undefined') {
      return;
    }

    // Calculate the x axis domain.
    // Elasticsearch aggregation returns points at start of bucket, so set the
    // x-axis min to the start of the aggregation interval.
    // Need to use the min(earliest) and max(earliest) of the context chart
    // aggregation to align the axes of the chart and swimlane elements.
    const xAxisDomain = this.calculateContextXAxisDomain();
    const x = d3.time.scale().range([0, swlWidth]).domain(xAxisDomain);

    const y = d3.scale.linear().range([swlHeight, 0]).domain([0, swlHeight]);

    const xAxis = d3.svg
      .axis()
      .scale(x)
      .orient('bottom')
      .innerTickSize(-swlHeight)
      .outerTickSize(0);

    const yAxis = d3.svg
      .axis()
      .scale(y)
      .orient('left')
      .tickValues(y.domain())
      .innerTickSize(-swlWidth)
      .outerTickSize(0);

    const axes = swlGroup.append('g');

    axes
      .append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + swlHeight + ')')
      .call(xAxis);

    axes.append('g').attr('class', 'y axis').call(yAxis);

    const earliest = xAxisDomain[0].getTime();
    const latest = xAxisDomain[1].getTime();
    const swimlaneAggMs = contextAggregationInterval.asMilliseconds();
    let cellWidth = swlWidth / ((latest - earliest) / swimlaneAggMs);
    if (cellWidth < 1) {
      cellWidth = 1;
    }

    const cells = swlGroup.append('g').attr('class', 'swimlane-cells').selectAll('rect').data(data);

    cells
      .enter()
      .append('rect')
      .attr('x', (d) => {
        return x(d.date);
      })
      .attr('y', 0)
      .attr('rx', 0)
      .attr('ry', 0)
      .attr('class', (d) => {
        return d.score > 0 ? 'swimlane-cell' : 'swimlane-cell-hidden';
      })
      .attr('width', cellWidth)
      .attr('height', swlHeight)
      .style('fill', (d) => {
        return this.props.anomalyColorScale(d.score);
      });
  };

  calculateContextXAxisDomain = () => {
    const { bounds, contextAggregationInterval, swimlaneData } = this.props;
    // Calculates the x axis domain for the context elements.
    // Elasticsearch aggregation returns points at start of bucket,
    // so set the x-axis min to the start of the first aggregation interval,
    // and the x-axis max to the end of the last aggregation interval.
    // Context chart and swimlane use the same aggregation interval.
    let earliest = bounds.min.valueOf();

    if (swimlaneData !== undefined && swimlaneData.length > 0) {
      // Adjust the earliest back to the time of the first swimlane point
      // if this is before the time filter minimum.
      earliest = Math.min(swimlaneData[0].date.getTime(), bounds.min.valueOf());
    }

    const contextAggMs = contextAggregationInterval.asMilliseconds();
    const earliestMs = Math.floor(earliest / contextAggMs) * contextAggMs;
    const latestMs = Math.ceil(bounds.max.valueOf() / contextAggMs) * contextAggMs;

    return [new Date(earliestMs), new Date(latestMs)];
  };

  // Sets the extent of the brush on the context chart to the
  // supplied from and to Date objects.
  setContextBrushExtent = (from, to) => {
    const chartElement = d3.select(this.rootNode);
    const brush = this.brush;
    const brushExtent = brush.extent();

    const newExtent = [from, to];
    brush.extent(newExtent);
    brush(chartElement.select('.brush'));

    if (
      newExtent[0].getTime() !== brushExtent[0].getTime() ||
      newExtent[1].getTime() !== brushExtent[1].getTime()
    ) {
      brush.event(chartElement.select('.brush'));
    }
  };

  setZoomInterval(ms) {
    const { bounds, zoomTo } = this.props;

    const minBoundsMs = bounds.min.valueOf();
    const maxBoundsMs = bounds.max.valueOf();

    // Attempt to retain the same zoom end time.
    // If not, go back to the bounds start and add on the required millis.
    const millis = +ms;
    let to = zoomTo.getTime();
    let from = to - millis;
    if (from < minBoundsMs) {
      from = minBoundsMs;
      to = Math.min(minBoundsMs + millis, maxBoundsMs);
    }

    this.setContextBrushExtent(new Date(from), new Date(to));
  }

  showAnomalyPopover(marker, circle) {
    const anomalyTime = marker.date.getTime();

    const tableItem = getTableItemClosestToTimestamp(this.props.tableData.anomalies, anomalyTime);

    if (tableItem) {
      // Overwrite the timestamp of the possibly aggregated table item with the
      // timestamp of the anomaly clicked in the chart so we're able to pick
      // the right baseline and deviation time ranges for Log Rate Analysis.
      tableItem.source.timestamp = anomalyTime;

      // Calculate the relative coordinates of the clicked anomaly marker
      // so we're able to position the popover actions menu above it.
      const dotRect = circle.getBoundingClientRect();
      const rootRect = this.rootNode.getBoundingClientRect();
      const x = Math.round(dotRect.x + dotRect.width / 2 - rootRect.x);
      const y = Math.round(dotRect.y + dotRect.height / 2 - rootRect.y) - popoverMenuOffset;

      // Hide any active tooltip
      this.props.tooltipService.hide();
      // Set the popover state to enable the actions menu
      this.setState({ popoverData: tableItem, popoverCoords: [x, y] });
    }
  }

  showFocusChartTooltip(marker, circle) {
    const { modelPlotEnabled } = this.props;

    const fieldFormat = this.fieldFormat;
    const seriesKey = 'single_metric_viewer';

    // Show the time and metric values in the tooltip.
    // Uses date, value, upper, lower and anomalyScore (optional) marker properties.
    const formattedDate = formatHumanReadableDateTimeSeconds(marker.date);
    const tooltipData = [{ label: formattedDate }];

    if (marker.anomalyScore !== undefined) {
      const score = parseInt(marker.anomalyScore);
      tooltipData.push({
        label: i18n.translate('xpack.ml.timeSeriesExplorer.timeSeriesChart.anomalyScoreLabel', {
          defaultMessage: 'anomaly score',
        }),
        value: getFormattedSeverityScore(score),
        color: this.props.anomalyColorScale(score),
        seriesIdentifier: {
          key: seriesKey,
        },
        valueAccessor: 'anomaly_score',
      });

      if (showMultiBucketAnomalyTooltip(marker) === true) {
        tooltipData.push({
          label: i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.multiBucketAnomalyLabel',
            {
              defaultMessage: 'multi-bucket impact',
            }
          ),
          value: getMultiBucketImpactTooltipValue(marker),
          seriesIdentifier: {
            key: seriesKey,
          },
          valueAccessor: 'multi_bucket_impact',
        });
      }

      if (marker.metricFunction) {
        tooltipData.push({
          label: i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.metricActualPlotFunctionLabel',
            {
              defaultMessage: 'function',
            }
          ),
          value: marker.metricFunction,
          seriesIdentifier: {
            key: seriesKey,
          },
          valueAccessor: 'metric_function',
        });
      }

      if (modelPlotEnabled === false) {
        // Show actual/typical when available except for rare detectors.
        // Rare detectors always have 1 as actual and the probability as typical.
        // Exposing those values in the tooltip with actual/typical labels might irritate users.
        if (marker.actual !== undefined && marker.function !== 'rare') {
          // Display the record actual in preference to the chart value, which may be
          // different depending on the aggregation interval of the chart.
          tooltipData.push({
            label: i18n.translate('xpack.ml.timeSeriesExplorer.timeSeriesChart.actualLabel', {
              defaultMessage: 'actual',
            }),
            value: formatValue(marker.actual, marker.function, fieldFormat),
            seriesIdentifier: {
              key: seriesKey,
            },
            valueAccessor: 'actual',
          });
          tooltipData.push({
            label: i18n.translate('xpack.ml.timeSeriesExplorer.timeSeriesChart.typicalLabel', {
              defaultMessage: 'typical',
            }),
            value: formatValue(marker.typical, marker.function, fieldFormat),
            seriesIdentifier: {
              key: seriesKey,
            },
            valueAccessor: 'typical',
          });
        } else {
          if (marker.value !== undefined) {
            tooltipData.push({
              label: i18n.translate('xpack.ml.timeSeriesExplorer.timeSeriesChart.valueLabel', {
                defaultMessage: 'value',
              }),
              value: formatValue(marker.value, marker.function, fieldFormat),
              seriesIdentifier: {
                key: seriesKey,
              },
              valueAccessor: 'value',
            });
          }
          if (marker.byFieldName !== undefined && marker.numberOfCauses !== undefined) {
            const numberOfCauses = marker.numberOfCauses;
            // If numberOfCauses === 1, won't go into this block as actual/typical copied to top level fields.
            const byFieldName = mlEscape(marker.byFieldName);
            tooltipData.push({
              label: i18n.translate(
                'xpack.ml.timeSeriesExplorer.timeSeriesChart.moreThanOneUnusualByFieldValuesLabel',
                {
                  defaultMessage: '{numberOfCauses}{plusSign} unusual {byFieldName} values',
                  values: {
                    numberOfCauses,
                    byFieldName,
                    // Maximum of 10 causes are stored in the record, so '10' may mean more than 10.
                    plusSign: numberOfCauses < 10 ? '' : '+',
                  },
                }
              ),
              seriesIdentifier: {
                key: seriesKey,
              },
              valueAccessor: 'numberOfCauses',
            });
          }
        }
      } else {
        if (!marker.annotations) {
          tooltipData.push({
            label: i18n.translate(
              'xpack.ml.timeSeriesExplorer.timeSeriesChart.modelPlotEnabled.actualLabel',
              {
                defaultMessage: 'actual',
              }
            ),
            value: formatValue(marker.actual, marker.function, fieldFormat),
            seriesIdentifier: {
              key: seriesKey,
            },
            valueAccessor: 'actual',
          });
          tooltipData.push({
            label: i18n.translate(
              'xpack.ml.timeSeriesExplorer.timeSeriesChart.modelPlotEnabled.upperBoundsLabel',
              {
                defaultMessage: 'upper bounds',
              }
            ),
            value: formatValue(marker.upper, marker.function, fieldFormat),
            seriesIdentifier: {
              key: seriesKey,
            },
            valueAccessor: 'upper_bounds',
          });
          tooltipData.push({
            label: i18n.translate(
              'xpack.ml.timeSeriesExplorer.timeSeriesChart.modelPlotEnabled.lowerBoundsLabel',
              {
                defaultMessage: 'lower bounds',
              }
            ),
            value: formatValue(marker.lower, marker.function, fieldFormat),
            seriesIdentifier: {
              key: seriesKey,
            },
            valueAccessor: 'lower_bounds',
          });
        }
      }
    } else {
      // TODO - need better formatting for small decimals.
      if (get(marker, 'isForecast', false) === true) {
        tooltipData.push({
          label: i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.withoutAnomalyScore.predictionLabel',
            {
              defaultMessage: 'prediction',
            }
          ),
          value: formatValue(marker.value, marker.function, fieldFormat),
          seriesIdentifier: {
            key: seriesKey,
          },
          valueAccessor: 'prediction',
        });
      } else {
        if (marker.value !== undefined && marker.value !== null) {
          tooltipData.push({
            label: i18n.translate(
              'xpack.ml.timeSeriesExplorer.timeSeriesChart.withoutAnomalyScore.valueLabel',
              {
                defaultMessage: 'value',
              }
            ),
            value: formatValue(marker.value, marker.function, fieldFormat),
            seriesIdentifier: {
              key: seriesKey,
            },
            valueAccessor: 'value',
          });
        }
      }

      if (!marker.annotations && modelPlotEnabled === true) {
        tooltipData.push({
          label: i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.withoutAnomalyScoreAndModelPlotEnabled.upperBoundsLabel',
            {
              defaultMessage: 'upper bounds',
            }
          ),
          value: formatValue(marker.upper, marker.function, fieldFormat),
          seriesIdentifier: {
            key: seriesKey,
          },
          valueAccessor: 'upper_bounds',
        });
        tooltipData.push({
          label: i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.withoutAnomalyScoreAndModelPlotEnabled.lowerBoundsLabel',
            {
              defaultMessage: 'lower bounds',
            }
          ),
          value: formatValue(marker.lower, marker.function, fieldFormat),
          seriesIdentifier: {
            key: seriesKey,
          },
          valueAccessor: 'lower_bounds',
        });
      }
    }

    if (marker.scheduledEvents !== undefined) {
      marker.scheduledEvents.forEach((scheduledEvent, i) => {
        tooltipData.push({
          label: i18n.translate(
            'xpack.ml.timeSeriesExplorer.timeSeriesChart.scheduledEventsLabel',
            {
              defaultMessage: 'scheduled event{counter}',
              values: {
                counter: marker.scheduledEvents.length > 1 ? ` #${i + 1}` : '',
              },
            }
          ),
          value: scheduledEvent,
          seriesIdentifier: {
            key: seriesKey,
          },
          valueAccessor: `scheduled_events_${i + 1}`,
        });
      });
    }

    if (marker.annotation !== undefined) {
      tooltipData.length = 0;
      // header
      tooltipData.push({
        label: marker.annotation,
      });
      let timespan = moment(marker.timestamp).format('MMMM Do YYYY, HH:mm');

      if (typeof marker.end_timestamp !== 'undefined') {
        timespan += ` - ${moment(marker.end_timestamp).format('MMMM Do YYYY, HH:mm')}`;
      }
      tooltipData.push({
        label: timespan,
        seriesIdentifier: {
          key: seriesKey,
        },
        valueAccessor: 'timespan',
      });
    }

    if (marker.annotations?.length > 1) {
      marker.annotations.forEach((annotation) => {
        let timespan = moment(annotation.timestamp).format('MMMM Do YYYY, HH:mm');

        if (typeof annotation.end_timestamp !== 'undefined') {
          timespan += ` - ${moment(annotation.end_timestamp).format('HH:mm')}`;
        }
        tooltipData.push({
          label: timespan,
          value: `${annotation.annotation}`,
          seriesIdentifier: {
            key: 'anomaly_timeline',
            specId: annotation._id ?? `${annotation.annotation}-${annotation.timestamp}-label`,
          },
          valueAccessor: 'annotation',
        });
      });
    }

    let xOffset = LINE_CHART_ANOMALY_RADIUS * 2;

    // When the annotation area is hovered
    if (circle.tagName.toLowerCase() === 'rect') {
      const x = Number(circle.getAttribute('x'));
      if (x < 0) {
        // The beginning of the annotation area is outside of the focus chart,
        // hence we need to adjust the x offset of a tooltip.
        xOffset = Math.abs(x);
      }
    }

    this.props.tooltipService.show(tooltipData, circle, {
      x: xOffset,
      y: 0,
    });
  }

  highlightFocusChartAnomaly(record) {
    // Highlights the anomaly marker in the focus chart corresponding to the specified record.

    const { focusChartData, focusAggregationInterval } = this.props;

    const focusXScale = this.focusXScale;
    const focusYScale = this.focusYScale;
    const showFocusChartTooltip = this.showFocusChartTooltip.bind(this);

    // Find the anomaly marker which corresponds to the time of the anomaly record.
    // Depending on the way the chart is aggregated, there may not be
    // a point at exactly the same time as the record being highlighted.
    const anomalyTime = record.source.timestamp;
    const markerToSelect = this.mlTimeSeriesExplorer.findChartPointForAnomalyTime(
      focusChartData,
      anomalyTime,
      focusAggregationInterval
    );
    const chartElement = d3.select(this.rootNode);

    // Render an additional highlighted anomaly marker on the focus chart.
    // TODO - plot anomaly markers for cases where there is an anomaly due
    // to the absence of data and model plot is enabled.
    if (markerToSelect !== undefined) {
      const selectedMarker = chartElement
        .select('.focus-chart-markers')
        .selectAll('.focus-chart-highlighted-marker')
        .data([markerToSelect]);
      if (showMultiBucketAnomalyMarker(markerToSelect) === true) {
        selectedMarker
          .enter()
          .append('path')
          .attr('d', d3.svg.symbol().size(MULTI_BUCKET_SYMBOL_SIZE).type('cross'))
          .attr('transform', (d) => `translate(${focusXScale(d.date)}, ${focusYScale(d.value)})`)
          .attr('data-test-subj', 'mlAnomalyMarker')
          .attr(
            'class',
            (d) =>
              `anomaly-marker multi-bucket ${getSeverityWithLow(d.anomalyScore).id} highlighted`
          );
      } else {
        selectedMarker
          .enter()
          .append('circle')
          .attr('r', LINE_CHART_ANOMALY_RADIUS)
          .attr('cx', (d) => focusXScale(d.date))
          .attr('cy', (d) => focusYScale(d.value))
          .attr('data-test-subj', 'mlAnomalyMarker')
          .attr(
            'class',
            (d) =>
              `anomaly-marker metric-value ${getSeverityWithLow(d.anomalyScore).id} highlighted`
          );
      }

      // Display the chart tooltip for this marker.
      // Note the values of the record and marker may differ depending on the levels of aggregation.
      const anomalyMarker = chartElement.selectAll(
        '.focus-chart-markers .anomaly-marker.highlighted'
      );
      if (anomalyMarker.length) {
        showFocusChartTooltip(markerToSelect, anomalyMarker[0][0]);
      }
    }
  }

  unhighlightFocusChartAnomaly() {
    const chartElement = d3.select(this.rootNode);
    chartElement.select('.focus-chart-markers').selectAll('.anomaly-marker.highlighted').remove();
    this.props.tooltipService.hide();
  }

  shouldComponentUpdate() {
    return true;
  }

  setRef(componentNode) {
    this.rootNode = componentNode;
  }

  closePopover() {
    this.setState({ popoverData: null, popoverCoords: [0, 0] });
  }

  setShowRuleEditorFlyoutFunction = (func) => {
    this.setState({
      showRuleEditorFlyout: func,
    });
  };

  unsetShowRuleEditorFlyoutFunction = () => {
    this.setState({
      showRuleEditorFlyout: () => {},
    });
  };

  render() {
    return (
      <>
        <RuleEditorFlyout
          selectedJob={this.props.selectedJob}
          setShowFunction={this.setShowRuleEditorFlyoutFunction}
          unsetShowFunction={this.unsetShowRuleEditorFlyoutFunction}
        />
        {this.state.popoverData !== null && (
          <div
            style={{
              position: 'absolute',
              marginLeft: this.state.popoverCoords[0],
              marginTop: this.state.popoverCoords[1],
            }}
          >
            <EuiPopover
              isOpen={true}
              closePopover={() => this.closePopover()}
              panelPaddingSize="none"
              anchorPosition="upLeft"
            >
              <LinksMenuUI
                anomaly={this.state.popoverData}
                selectedJob={this.props.selectedJob}
                bounds={this.props.bounds}
                showMapsLink={false}
                showViewSeriesLink={false}
                isAggregatedData={this.props.tableData.interval !== 'second'}
                interval={this.props.tableData.interval}
                showRuleEditorFlyout={this.state.showRuleEditorFlyout}
                onItemClick={() => this.closePopover()}
                sourceIndicesWithGeoFields={this.props.sourceIndicesWithGeoFields}
              />
            </EuiPopover>
          </div>
        )}
        <div className="ml-timeseries-chart-react" ref={this.setRef.bind(this)} />
      </>
    );
  }
}

export const TimeseriesChart = (props) => {
  const annotationUpdatesService = useContext(MlAnnotationUpdatesContext);
  const annotationProp = useObservable(annotationUpdatesService.isAnnotationInitialized$());
  const { euiTheme } = useEuiTheme();

  const anomalyColorScale = useMemo(
    () =>
      d3.scale
        .threshold()
        .domain([
          ML_ANOMALY_THRESHOLD.WARNING,
          ML_ANOMALY_THRESHOLD.MINOR,
          ML_ANOMALY_THRESHOLD.MAJOR,
          ML_ANOMALY_THRESHOLD.CRITICAL,
        ])
        .range([
          getThemeResolvedSeverityColor(ML_ANOMALY_THRESHOLD.LOW, euiTheme),
          getThemeResolvedSeverityColor(ML_ANOMALY_THRESHOLD.WARNING, euiTheme),
          getThemeResolvedSeverityColor(ML_ANOMALY_THRESHOLD.MINOR, euiTheme),
          getThemeResolvedSeverityColor(ML_ANOMALY_THRESHOLD.MAJOR, euiTheme),
          getThemeResolvedSeverityColor(ML_ANOMALY_THRESHOLD.CRITICAL, euiTheme),
        ]),
    [euiTheme]
  );

  if (annotationProp === undefined) {
    return null;
  }

  return (
    <TimeseriesChartIntl
      annotation={annotationProp}
      anomalyColorScale={anomalyColorScale}
      {...props}
      annotationUpdatesService={annotationUpdatesService}
    />
  );
};
