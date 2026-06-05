/**
 * Marco Extension — Condition Evaluator (Spec 18)
 *
 * Pure DOM-only module that evaluates compound boolean condition trees over
 * selector predicates. Supersedes the single-predicate `wait-for-element.ts`
 * gate while remaining shape-compatible (an `Exists` leaf condition with a
 * `TimeoutMs` is exactly the old `WaitFor`).
 *
 * No chrome.* / no messaging — fully unit-testable under jsdom and reusable
 * from the content script.
 *
 * @see spec/31-macro-recorder/18-conditional-elements.md
 * @see ./wait-for-element.ts — Single-predicate predecessor.
 */

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export type SelectorKind = "Auto" | "XPath" | "Css";

export type Matcher =
    | { readonly Kind: "Exists" }
    | { readonly Kind: "Visible" }
    | { readonly Kind: "TextEquals";   readonly Value: string; readonly CaseSensitive?: boolean }
    | { readonly Kind: "TextContains"; readonly Value: string; readonly CaseSensitive?: boolean }
    | { readonly Kind: "TextRegex";    readonly Pattern: string; readonly Flags?: string }
    | { readonly Kind: "AttrEquals";   readonly Name: string; readonly Value: string }
    | { readonly Kind: "AttrContains"; readonly Name: string; readonly Value: string }
    | { readonly Kind: "Count";        readonly Op: "eq" | "gte" | "lte"; readonly N: number };

export interface Predicate {
    readonly Selector: string;
    readonly SelectorKind?: SelectorKind;
    readonly Matcher: Matcher;
    readonly Negate?: boolean;
}

export type Condition =
    | Predicate
    | { readonly All: ReadonlyArray<Condition> }
    | { readonly Any: ReadonlyArray<Condition> }
    | { readonly Not: Condition };

export const MAX_CONDITION_DEPTH = 8;
export const MAX_PREDICATE_COUNT = 32;

export type ConditionWaitOutcome =
    | { readonly Ok: true;  readonly DurationMs: number; readonly Polls: number }
    | { readonly Ok: false; readonly DurationMs: number; readonly Polls: number;
        readonly Reason: "ConditionTimeout" | "InvalidSelector";
        readonly Detail: string;
        readonly LastEvaluation: PredicateEvaluation[] };

export interface PredicateEvaluation {
    readonly Selector: string;
    readonly Kind: "XPath" | "Css";
    readonly Matcher: string;
    readonly Result: boolean;
    readonly Detail?: string;
}

export interface EvaluateOptions {
    readonly Doc: Document;
    /** When provided, every predicate's outcome is appended for diagnostics. */
    readonly Trace?: PredicateEvaluation[];
}

export interface WaitOptions {
    readonly Doc: Document;
    readonly TimeoutMs: number;
    readonly PollMs?: number;
    readonly Sleep?: (ms: number) => Promise<void>;
    readonly Now?: () => number;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export function validateCondition(condition: Condition): void {
    let predicateCount = 0;
    walk(condition, 0, "");

    function walk(node: Condition, depth: number, path: string): void {
        if (depth > MAX_CONDITION_DEPTH) {
            throw new Error(
                `InvalidSelector: condition tree exceeds depth ${MAX_CONDITION_DEPTH} at ${path || "<root>"}`,
            );
        }
        if ("All" in node) {
            node.All.forEach((child, i) => walk(child, depth + 1, joinPath(path, `All[${i}]`)));
            return;
        }
        if ("Any" in node) {
            node.Any.forEach((child, i) => walk(child, depth + 1, joinPath(path, `Any[${i}]`)));
            return;
        }
        if ("Not" in node) { walk(node.Not, depth + 1, joinPath(path, "Not")); return; }
        predicateCount++;
        if (predicateCount > MAX_PREDICATE_COUNT) {
            throw new Error(
                `InvalidSelector: condition exceeds ${MAX_PREDICATE_COUNT} predicates at ${joinPath(path, node.Matcher.Kind)}`,
            );
        }
        validateMatcher(node, joinPath(path, node.Matcher.Kind));
    }
}

function joinPath(prefix: string, segment: string): string {
    return prefix.length === 0 ? segment : `${prefix}.${segment}`;
}

function validateMatcher(predicate: Predicate, path: string): void {
    const matcher = predicate.Matcher;
    if (matcher.Kind === "TextRegex") {
        try { new RegExp(matcher.Pattern, matcher.Flags ?? ""); }
        catch (caughtError) {
            const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
            throw new Error(`InvalidSelector: bad regex /${matcher.Pattern}/ at ${path} — ${message}`);
        }
        return;
    }
    if ((matcher.Kind === "AttrEquals" || matcher.Kind === "AttrContains") && matcher.Name.length === 0) {
        throw new Error(`InvalidSelector: ${matcher.Kind} requires non-empty Name at ${path}`);
    }
    if (matcher.Kind === "Count" && matcher.N < 0) {
        throw new Error(`InvalidSelector: Count.N must be >= 0 at ${path} (got ${matcher.N})`);
    }
}

/* ------------------------------------------------------------------ */
/*  Evaluation                                                         */
/* ------------------------------------------------------------------ */

export function evaluateCondition(condition: Condition, options: EvaluateOptions): boolean {
    if ("All" in condition) {
        for (const child of condition.All) {
            if (evaluateCondition(child, options) === false) return false;
        }
        return true;
    }
    if ("Any" in condition) {
        for (const child of condition.Any) {
            if (evaluateCondition(child, options)) return true;
        }
        return false;
    }
    if ("Not" in condition) return evaluateCondition(condition.Not, options) === false;

    const result = evaluatePredicate(condition, options);
    return condition.Negate === true ? result === false : result;
}

function evaluatePredicate(predicate: Predicate, options: EvaluateOptions): boolean {
    const kind = resolveSelectorKind(predicate.SelectorKind ?? "Auto", predicate.Selector);

    if (predicate.Matcher.Kind === "Count") {
        const count = locateAll(predicate.Selector, kind, options.Doc).length;
        const result = compareCount(count, predicate.Matcher.Op, predicate.Matcher.N);
        recordTrace(options, predicate, kind, result, `count=${count}`);
        return result;
    }

    const element = locateFirst(predicate.Selector, kind, options.Doc);
    if (element === null) {
        recordTrace(options, predicate, kind, predicate.Matcher.Kind === "Exists" ? false : false, "no match");
        return false;
    }

    const result = applyMatcher(element, predicate.Matcher);
    recordTrace(options, predicate, kind, result);
    return result;
}

function recordTrace(
    options: EvaluateOptions,
    predicate: Predicate,
    kind: "XPath" | "Css",
    result: boolean,
    detail?: string,
): void {
    if (options.Trace === undefined) return;
    options.Trace.push({
        Selector: predicate.Selector,
        Kind: kind,
        Matcher: predicate.Matcher.Kind,
        Result: predicate.Negate === true ? result === false : result,
        Detail: detail,
    });
}

function applyMatcher(element: Element, matcher: Matcher): boolean {
    switch (matcher.Kind) {
        case "Exists":
            return true;
        case "Visible":
            return isVisible(element);
        case "TextEquals": {
            const actualText = (element.textContent ?? "").trim();
            const expectedText = matcher.Value;
            return matcher.CaseSensitive === false
                ? actualText.toLowerCase() === expectedText.toLowerCase()
                : actualText === expectedText;
        }
        case "TextContains": {
            const actualText = element.textContent ?? "";
            const expectedText = matcher.Value;
            return matcher.CaseSensitive === false
                ? actualText.toLowerCase().includes(expectedText.toLowerCase())
                : actualText.includes(expectedText);
        }
        case "TextRegex": {
            const regex = new RegExp(matcher.Pattern, matcher.Flags ?? "");
            return regex.test(element.textContent ?? "");
        }
        case "AttrEquals": {
            const value = element.getAttribute(matcher.Name);
            return value !== null && value === matcher.Value;
        }
        case "AttrContains": {
            const value = element.getAttribute(matcher.Name);
            return value !== null && value.includes(matcher.Value);
        }
        case "Count":
            return false; // handled above
    }
}

function isVisible(element: Element): boolean {
    const windowObject = element.ownerDocument?.defaultView;
    if (windowObject === null || windowObject === undefined) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const styles = windowObject.getComputedStyle(element);
    if (styles.display === "none") return false;
    if (styles.visibility === "hidden") return false;
    return true;
}

function compareCount(count: number, op: "eq" | "gte" | "lte", n: number): boolean {
    if (op === "eq") return count === n;
    if (op === "gte") return count >= n;
    return count <= n;
}

/* ------------------------------------------------------------------ */
/*  Selector locators                                                  */
/* ------------------------------------------------------------------ */

export function resolveSelectorKind(kind: SelectorKind, expression: string): "XPath" | "Css" {
    if (kind === "XPath") return "XPath";
    if (kind === "Css") return "Css";
    const trimmed = expression.trimStart();
    return trimmed.startsWith("/") || trimmed.startsWith("(") ? "XPath" : "Css";
}

function locateFirst(expression: string, kind: "XPath" | "Css", doc: Document): Element | null {
    if (kind === "XPath") {
        const r = doc.evaluate(expression, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = r.singleNodeValue;
        return node instanceof Element ? node : null;
    }
    return doc.querySelector(expression);
}

function locateAll(expression: string, kind: "XPath" | "Css", doc: Document): Element[] {
    if (kind === "XPath") {
        const r = doc.evaluate(expression, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const out: Element[] = [];
        for (let i = 0; i < r.snapshotLength; i++) {
            const node = r.snapshotItem(i);
            if (node instanceof Element) out.push(node);
        }
        return out;
    }
    return Array.from(doc.querySelectorAll(expression));
}

/* ------------------------------------------------------------------ */
/*  Wait loop                                                          */
/* ------------------------------------------------------------------ */

export async function waitForCondition(
    condition: Condition,
    options: WaitOptions,
): Promise<ConditionWaitOutcome> {
    try { validateCondition(condition); }
    catch (err) {
        return {
            Ok: false,
            DurationMs: 0,
            Polls: 0,
            Reason: "InvalidSelector",
            Detail: err instanceof Error ? err.message : String(err),
            LastEvaluation: [],
        };
    }

    const sleep = options.Sleep ?? defaultSleep;
    const now = options.Now ?? defaultNow;
    const pollMs = Math.max(1, options.PollMs ?? 50);
    const started = now();
    const deadline = started + Math.max(0, options.TimeoutMs);
    let polls = 0;
    let lastTrace: PredicateEvaluation[] = [];
    let lastError: string | null = null;

    for (;;) {
        polls++;
        const trace: PredicateEvaluation[] = [];
        let result: boolean;
        try {
            result = evaluateCondition(condition, { Doc: options.Doc, Trace: trace });
        } catch (err) {
            return {
                Ok: false,
                DurationMs: now() - started,
                Polls: polls,
                Reason: "InvalidSelector",
                Detail: err instanceof Error ? err.message : String(err),
                LastEvaluation: trace,
            };
        }
        lastTrace = trace;
        lastError = null;

    if (result) return { Ok: true, DurationMs: now() - started, Polls: polls };
        if (polls >= 2 && now() >= deadline) {
            return {
                Ok: false,
                DurationMs: now() - started,
                Polls: polls,
                Reason: "ConditionTimeout",
                Detail: lastError ?? `Condition not met within ${options.TimeoutMs}ms`,
                LastEvaluation: lastTrace,
            };
        }
        await sleep(pollMs);
    }
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        timeoutId = setTimeout(() => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            resolve();
        }, ms);
    });
}

function defaultNow(): number {
    return Date.now();
}
