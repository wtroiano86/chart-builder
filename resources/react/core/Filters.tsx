import { useEffect, useId, useState } from "react";
import type {
    FilterDefinition,
    FilterValue,
    Json,
} from "@wtroiano/chart-builder-sdk";
import type { FilterPatch } from "./coordinator";

export function ChartFilters({
    name,
    timezone = "UTC",
    definitions,
    state,
    errors = {},
    pending,
    onApply,
    onReset,
}: {
    name: string;
    timezone?: string;
    definitions: FilterDefinition[];
    state: Record<string, Json | FilterValue>;
    errors?: Record<string, string[]>;
    pending: boolean;
    onApply: (patch: FilterPatch) => void;
    onReset: () => void;
}) {
    const id = useId();
    const [draft, setDraft] = useState<Record<string, FilterValue>>({});
    useEffect(() => {
        const next: Record<string, FilterValue> = {};
        for (const filter of definitions) {
            if (filter.kind === "date-range") {
                for (const key of [filter.fromKey, filter.untilKey]) {
                    const value = state[key];
                    if (typeof value === "string") {
                        // A date input sends an inclusive end date; normalized instants are exclusive.
                        const date = new Date(value);
                        if (
                            key === filter.untilKey &&
                            value.includes("T") &&
                            !Number.isNaN(date.getTime())
                        )
                            date.setTime(date.getTime() - 1);
                        const parts = !Number.isNaN(date.getTime())
                            ? new Intl.DateTimeFormat("en-CA", {
                                  timeZone: timezone,
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                              }).formatToParts(date)
                            : [];
                        const part = (type: string) =>
                            parts.find((item) => item.type === type)?.value;
                        next[key] =
                            value.includes("T") && parts.length
                                ? `${part("year")}-${part("month")}-${part("day")}`
                                : value.slice(0, 10);
                    } else next[key] = "";
                }
            } else {
                const value = state[filter.key];
                if (Array.isArray(value)) {
                    const selected: string[] = [];
                    for (const item of value)
                        if (typeof item === "string") selected.push(item);
                    next[filter.key] = selected;
                } else
                    next[filter.key] = typeof value === "string" ? value : "";
            }
        }
        setDraft(next);
    }, [state, definitions, timezone]);
    if (!definitions.length) return null;
    const field = (key: string, label: string) => (
        <label key={key} className="cb-field">
            <span>{label}</span>
            <input
                type="date"
                value={String(draft[key] ?? "")}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? id + key : undefined}
                onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                }
            />
            {errors[key] && (
                <span id={id + key} className="cb-field-error">
                    {errors[key].join(" ")}
                </span>
            )}
        </label>
    );
    return (
        <form
            className="cb-filters"
            aria-label={name + " filters"}
            onSubmit={(event) => {
                event.preventDefault();
                onApply(draft);
            }}
        >
            {definitions.map((filter) =>
                filter.kind === "date-range" ? (
                    <fieldset key={filter.key}>
                        <legend>{filter.label}</legend>
                        {field(filter.fromKey, "From")}
                        {field(filter.untilKey, "Until")}
                    </fieldset>
                ) : (
                    <label key={filter.key} className="cb-field">
                        <span>{filter.label}</span>
                        <select
                            multiple={filter.kind === "multiselect"}
                            value={
                                (draft[filter.key] as string | string[]) ?? ""
                            }
                            aria-invalid={!!errors[filter.key]}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    [filter.key]:
                                        filter.kind === "multiselect"
                                            ? [
                                                  ...event.target
                                                      .selectedOptions,
                                              ].map((option) => option.value)
                                            : event.target.value,
                                })
                            }
                        >
                            {filter.clearable &&
                                filter.kind !== "multiselect" && (
                                    <option value="">All</option>
                                )}
                            {filter.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        {errors[filter.key] && (
                            <span className="cb-field-error">
                                {errors[filter.key].join(" ")}
                            </span>
                        )}
                    </label>
                ),
            )}
            <button type="submit">{pending ? "Apply changes" : "Apply"}</button>
            <button type="button" onClick={onReset}>
                Reset
            </button>
        </form>
    );
}
