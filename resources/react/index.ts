import { registerChartAdapter } from "./core/registry";
import { echartsAdapter } from "./adapters/echarts";
registerChartAdapter("echarts", echartsAdapter);
export * from "./core";
