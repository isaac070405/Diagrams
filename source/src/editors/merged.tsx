import { mergeEditors } from './merge';
import { flow } from './flow';
import { productflow } from './pfd';
import { workflow } from './workflow';
import { prisma } from './prisma';
import { consort } from './consort';
import { pkcurve, doseresponse } from './pharm';
import { popdyn } from './popdyn';
import { enzyme } from './enzyme';
import { calib } from './calib';
import { growth } from './growth';
import { scatter } from './scatter';
import { pca } from './pca';
import { roc } from './roc';
import { blandaltman } from './blandaltman';
import { funnel } from './funnel';
import { barchart } from './barchart';
import { boxplot } from './boxplot';
import { violin } from './violin';

/* 03 + 13 + 22 */
export const flowAll = mergeEditors(
  { id: 'flow-diagram', num: '03', name: 'Flow diagram', field: 'Methods', blurb: 'Boxes and arrows for process flows, food-industry product flows with HACCP points, and step-by-step lab method figures.', modeLabel: 'Flow type' },
  [{ mode: 'general', label: 'Process', def: flow }, { mode: 'product', label: 'Product (HACCP)', def: productflow }, { mode: 'workflow', label: 'Lab method', def: workflow }]);

/* 29 + 32 */
export const reportingFlow = mergeEditors(
  { id: 'reporting-flow', num: '29', name: 'PRISMA and CONSORT flow diagram', field: 'Evidence and clinical', blurb: 'Counted-box flowcharts for a systematic review (PRISMA 2020) or a randomised trial (CONSORT).', modeLabel: 'Reporting standard' },
  [{ mode: 'prisma', label: 'PRISMA 2020', def: prisma }, { mode: 'consort', label: 'CONSORT', def: consort }]);

/* 17 + 18 + 21 + 41 + 43 + 48 */
export const curveFit = mergeEditors(
  { id: 'curve-fit', num: '17', name: 'Curve with fit', field: 'Methods', blurb: 'Points with a fitted curve: concentration over time, dose-response, population change, enzyme kinetics, standard curves and growth curves.', modeLabel: 'Curve type' },
  [{ mode: 'pk', label: 'Concentration-time', def: pkcurve }, { mode: 'dose', label: 'Dose-response', def: doseresponse }, { mode: 'pop', label: 'Population', def: popdyn },
   { mode: 'enzyme', label: 'Enzyme kinetics', def: enzyme }, { mode: 'standard', label: 'Standard curve', def: calib }, { mode: 'growth', label: 'Growth curve', def: growth }]);

/* 40 + 46 */
export const scatterAll = mergeEditors(
  { id: 'scatter-regression', num: '40', name: 'Scatter plot', field: 'Methods', blurb: 'A scatter plot with a regression line, or the scores of a principal component analysis.', modeLabel: 'Scatter type' },
  [{ mode: 'regression', label: 'Regression', def: scatter }, { mode: 'pca', label: 'PCA', def: pca }]);

/* 33 + 34 + 44 */
export const diagnosticPlots = mergeEditors(
  { id: 'diagnostic-plots', num: '33', name: 'ROC, Bland-Altman and funnel plot', field: 'Evidence and clinical', blurb: 'Test accuracy (ROC), agreement between two methods (Bland-Altman) and publication bias (funnel plot).', modeLabel: 'Plot type' },
  [{ mode: 'roc', label: 'ROC curve', def: roc }, { mode: 'ba', label: 'Bland-Altman', def: blandaltman }, { mode: 'funnel', label: 'Funnel plot', def: funnel }]);

/* 35 + 37 + violin */
export const groupCompare = mergeEditors(
  { id: 'group-comparison', num: '35', name: 'Bar chart, box plot and violin plot', field: 'Methods', blurb: 'Compare groups as means with error bars, as box plots, or as violin plots that show the whole shape of the data.', modeLabel: 'Chart type' },
  [{ mode: 'bar', label: 'Bar chart', def: barchart }, { mode: 'box', label: 'Box plot', def: boxplot }, { mode: 'violin', label: 'Violin plot', def: violin }]);
