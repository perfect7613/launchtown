/** Combine abort signals without requiring the newer AbortSignal.any type. */
export function combineAbortSignals(
  first: AbortSignal,
  second: AbortSignal,
): AbortSignal {
  const controller = new AbortController();

  const forwardAbort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  for (const signal of [first, second]) {
    if (signal.aborted) {
      forwardAbort(signal);
      break;
    }
    signal.addEventListener("abort", () => forwardAbort(signal), {
      once: true,
    });
  }

  return controller.signal;
}
