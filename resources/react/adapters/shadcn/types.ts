import type {
    ComponentProps,
    ComponentType,
    ReactElement,
    ReactNode,
} from "react";
import type { Legend, Tooltip } from "recharts";

/** Structural boundary: consumers keep ownership of their shadcn components. */
export interface ShadcnChartComponents {
    ChartContainer: ComponentType<
        Omit<ComponentProps<"div">, "children"> & {
            config: Record<string, { label?: ReactNode; color?: string }>;
            children: ReactElement;
        }
    >;
    ChartTooltipContent: ComponentType<{
        formatter?: ComponentProps<typeof Tooltip>["formatter"];
        labelFormatter?: ComponentProps<typeof Tooltip>["labelFormatter"];
    }>;
    ChartLegendContent: ComponentType<{
        verticalAlign?: ComponentProps<typeof Legend>["verticalAlign"];
        className?: string;
    }>;
}
