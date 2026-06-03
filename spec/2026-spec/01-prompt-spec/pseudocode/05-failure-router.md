# Pseudocode — Failure Router

```ts
function routeFailure(err: unknown, ctx: TaskContext): FailureReport {
  const code = classify(err); // one of reference/02-failure-reason-codes.md
  return {
    Reason: code,
    ReasonDetail: stringifySafe(err),
    SourceFile: ctx.sourceFile,
    Phase: ctx.phase,
    Error: serializeError(err),
    SelectorAttempts: ctx.selectorAttempts ?? [],
    VariableContext:  ctx.variableContext  ?? [],
    Timestamp: nowIso()
  };
}
```

Every `catch` path MUST call `logFailure(routeFailure(err, ctx))`; never swallow.
