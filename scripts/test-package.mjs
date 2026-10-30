import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
mkdirSync(resolve(root, "tmp"), { recursive: true });
const consumer = mkdtempSync(resolve(tmpdir(), "chart-builder-sdk-consumer-"));
const run = (command, args, cwd = root) =>
    execFileSync(command, args, { cwd, stdio: "inherit" });
try {
    run("npm", ["run", "build:sdk"]);
    const packed = JSON.parse(
        execFileSync(
            "npm",
            [
                "pack",
                "--workspace=@wtroiano/chart-builder-sdk",
                "--json",
                "--pack-destination=" + consumer,
            ],
            { cwd: root, encoding: "utf8" },
        ),
    )[0];
    for (const required of [
        "dist/index.js",
        "dist/index.d.ts",
        "schemas/chart-payload.v1.json",
        "README.md",
        "LICENSE",
    ])
        if (!packed.files.some((file) => file.path === required))
            throw new Error("SDK archive is missing " + required);
    if (
        packed.files.some((file) =>
            /^(src|node_modules|tests)\//.test(file.path),
        )
    )
        throw new Error("SDK archive includes development files.");
    // Respect npm's installed React/Inertia matrix, including --no-save overrides.
    const development = Object.fromEntries(
        Object.keys(
            JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))
                .devDependencies,
        ).map((name) => [
            name,
            JSON.parse(
                readFileSync(
                    resolve(root, "node_modules", name, "package.json"),
                    "utf8",
                ),
            ).version,
        ]),
    );
    console.log(
        `Packed consumer: React ${development.react}, Inertia ${development["@inertiajs/react"]}.`,
    );
    writeFileSync(
        resolve(consumer, "package.json"),
        JSON.stringify({
            name: "chart-builder-independent-consumer",
            private: true,
            type: "module",
            dependencies: {
                "@wtroiano/chart-builder-sdk": "file:./" + packed.filename,
                "@inertiajs/react": development["@inertiajs/react"],
                react: development.react,
                "react-dom": development["react-dom"],
                "@types/react": development["@types/react"],
                "@types/react-dom": development["@types/react-dom"],
                "@types/node": development["@types/node"],
                typescript: development.typescript,
                vite: development.vite,
            },
        }),
    );
    cpSync(resolve(root, "resources/react/core"), resolve(consumer, "core"), {
        recursive: true,
    });
    cpSync(
        resolve(root, "tests/adapters/fixture/src"),
        resolve(consumer, "fixture/src"),
        { recursive: true },
    );
    cpSync(
        resolve(root, "tests/adapters/fixture/manifest.json"),
        resolve(consumer, "fixture/manifest.json"),
    );
    writeFileSync(
        resolve(consumer, "entry.ts"),
        'export * from "./core";\nexport { fixtureAdapter } from "./fixture/src";\n',
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
                resolveJsonModule: true,
                esModuleInterop: true,
                types: ["react", "node", "vite/client"],
            },
            include: ["entry.ts", "core", "fixture"],
        }),
    );
    writeFileSync(
        resolve(consumer, "vite.config.mjs"),
        `
import { defineConfig } from "vite";
export default defineConfig({
    build: { lib: { entry: "entry.ts", formats: ["es"], fileName: "core" } },
    plugins: [{ name: "no-rendering-engine", generateBundle() {
        for (const id of this.getModuleIds()) if (/node_modules[\\\\/](echarts|zrender|recharts)[\\\\/]/.test(id)) throw new Error("Engine leaked into core bundle: " + id);
    } }],
});
`,
    );
    run("npm", ["install", "--no-audit", "--no-fund"], consumer);
    run("npx", ["tsc", "--noEmit"], consumer);
    run("npx", ["vite", "build"], consumer);
    run(
        "node",
        [
            "--input-type=module",
            "-e",
            'import { assertChartResult } from "@wtroiano/chart-builder-sdk"; import { readFileSync } from "node:fs"; assertChartResult(JSON.parse(readFileSync(process.argv[1], "utf8")));',
            resolve(root, "tests/react/fixtures/revenue.json"),
        ],
        consumer,
    );
    console.log(
        "SDK archive, independent adapter types and engine-free core production bundle passed.",
    );
    cpSync(
        resolve(root, "resources/react/adapters/shadcn"),
        resolve(consumer, "shadcn"),
        { recursive: true },
    );
    cpSync(
        resolve(root, "tests/adapters/shadcn/chart.tsx"),
        resolve(consumer, "chart.tsx"),
    );
    writeFileSync(
        resolve(consumer, "entry.ts"),
        `
export * from "./core";
import { registerChartAdapter } from "./core";
import { createShadcnAdapter } from "./shadcn";
registerChartAdapter("shadcn", createShadcnAdapter(() => import("./chart")));
`,
    );
    writeFileSync(
        resolve(consumer, "vite.config.mjs"),
        `
import { defineConfig } from "vite";
export default defineConfig({
    build: { lib: { entry: "entry.ts", formats: ["es"], fileName: "shadcn" } },
    plugins: [{ name: "lazy-shadcn-engine", generateBundle(_, bundle) {
        const chunks = Object.values(bundle).filter(chunk => chunk.type === "chunk");
        const hasEngine = chunk => Object.keys(chunk.modules).some(id => /node_modules[\\\\/]recharts[\\\\/]/.test(id));
        if (chunks.some(chunk => chunk.isEntry && hasEngine(chunk))) throw new Error("Recharts leaked into entry bundle.");
        if (!chunks.some(chunk => !chunk.isEntry && hasEngine(chunk))) throw new Error("Missing lazy Recharts chunk.");
        for (const id of this.getModuleIds()) if (/node_modules[\\\\/](echarts|zrender)[\\\\/]/.test(id)) throw new Error("ECharts leaked into shadcn consumer.");
    } }],
});
`,
    );
    run(
        "npm",
        [
            "install",
            "--no-audit",
            "--no-fund",
            "recharts@" + development.recharts,
            "react-is@" + development["react-is"],
        ],
        consumer,
    );
    run("npx", ["tsc", "--noEmit"], consumer);
    run("npx", ["vite", "build"], consumer);
    console.log(
        "Independent shadcn consumer types, production build and lazy engine boundary passed.",
    );
} finally {
    rmSync(consumer, { recursive: true, force: true });
}
