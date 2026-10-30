import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const consumer = resolve(process.argv[2]);
const versions = JSON.parse(
    readFileSync("package.json", "utf8"),
).devDependencies;
const manifest = JSON.parse(
    readFileSync(resolve(consumer, "package.json"), "utf8"),
);
for (const name of [
    "react",
    "react-dom",
    "@inertiajs/react",
    "@types/react",
    "@types/react-dom",
    "typescript",
    "@vitejs/plugin-react",
    "echarts",
    "recharts",
    "react-is",
])
    manifest.devDependencies[name] = versions[name];
const packed = JSON.parse(
    readFileSync(resolve(consumer, "sdk-pack.json"), "utf8"),
)[0];
manifest.devDependencies["@wtroiano/chart-builder-sdk"] =
    "file:./" + packed.filename;
writeFileSync(
    resolve(consumer, "package.json"),
    JSON.stringify(manifest, null, 4) + "\n",
);
cpSync(
    "tests/adapters/shadcn/chart.tsx",
    resolve(consumer, "resources/js/shadcn-ui.tsx"),
);
writeFileSync(
    resolve(consumer, "resources/js/app.tsx"),
    `import { createRoot } from "react-dom/client";
import { Chart, registerChartAdapter } from "./vendor/chart-builder";
import { createShadcnAdapter } from "./vendor/chart-builder/adapters/shadcn";
import shadcnResult from "./shadcn-result.json";
registerChartAdapter("shadcn", createShadcnAdapter(() => import("./shadcn-ui")));
import { assertChartResult } from "@wtroiano/chart-builder-sdk";
import result from "./chart-result.json";
assertChartResult(result);
assertChartResult(shadcnResult);
createRoot(document.getElementById("app")!).render(<Chart name="SmokeRevenueChart" propName="shadcnChart" result={shadcnResult} />);
`,
);
writeFileSync(
    resolve(consumer, "vite.config.js"),
    `import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [laravel({ input: "resources/js/app.tsx" }), react()] });
`,
);
writeFileSync(
    resolve(consumer, "tsconfig.json"),
    JSON.stringify({
        compilerOptions: {
            strict: true,
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            jsx: "react-jsx",
            noEmit: true,
            skipLibCheck: true,
            esModuleInterop: true,
            resolveJsonModule: true,
            types: ["vite/client"],
            paths: { "@/*": ["./resources/js/*"] },
        },
        include: ["resources/js"],
    }),
);
