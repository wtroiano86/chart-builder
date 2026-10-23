import type { FormatDescriptor, JsonObject, Scalar } from "./types.js";
import { assertJson } from "./validation.js";

export type NamedFormatter = (
    value: Scalar,
    params: JsonObject,
    locale: string,
    timezone: string,
) => string;

export function formatValue(
    value: Scalar,
    descriptor: FormatDescriptor | undefined,
    locale: string,
    timezone: string,
    custom?: NamedFormatter,
): string {
    if (value === null) return "—";
    if (!descriptor) return String(value);
    if (descriptor.kind === "custom") {
        if (!custom)
            throw new Error(
                "Named formatter is not registered: " + descriptor.name,
            );
        return custom(value, descriptor.params, locale, timezone);
    }
    if (descriptor.kind === "date") {
        const dateOnly =
            typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
        return new Intl.DateTimeFormat(locale, {
            dateStyle: descriptor.dateStyle,
            timeStyle: descriptor.timeStyle ?? undefined,
            timeZone: dateOnly ? "UTC" : timezone,
        }).format(new Date(typeof value === "number" ? value : String(value)));
    }
    if (typeof value !== "number") return String(value);
    const decimals = descriptor.decimals;
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        ...(descriptor.kind === "currency"
            ? { style: "currency", currency: descriptor.currency }
            : {}),
        ...(descriptor.kind === "percent" ? { style: "percent" } : {}),
        ...(descriptor.kind === "number" && descriptor.compact
            ? { notation: "compact" }
            : {}),
    }).format(
        descriptor.kind === "percent" && descriptor.input === "whole"
            ? value / 100
            : value,
    );
}

export function mergeOptions(
    base: JsonObject,
    override: JsonObject,
): JsonObject {
    assertJson(base);
    assertJson(override);
    const result: JsonObject = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
            throw new Error("Unsafe option key.");
        const previous = result[key];
        result[key] =
            value &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            previous &&
            typeof previous === "object" &&
            !Array.isArray(previous)
                ? mergeOptions(previous, value)
                : value;
    }
    return result;
}

export function csvCell(value: Scalar): string {
    let text = value === null ? "" : String(value);
    if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
        text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
}
