const MIN_BUDGET_MS = 1500;

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

// The primary model is listed twice on purpose: its latency occasionally
// spikes (or hangs) per request, so a second parallel request to the same
// model usually returns first. The remaining models are true fallbacks, but
// on the free tier they have very small daily quotas.
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
];

type Options = {
  apiKey: string;
  models: string[];
  buildBody: (model: string) => Record<string, unknown>;
  timeoutMs: number;
  totalMs: number;
  hedgeMs: number;
  label: string;
};

async function callOnce(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  outer: AbortSignal
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();

  outer.addEventListener("abort", onAbort);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${model} error:`, response.status, errorText);
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
    outer.removeEventListener("abort", onAbort);
  }
}

// Tries models in order, but starts the next model in parallel whenever the
// current one is slow (hedgeMs) or has failed. The first success wins and the
// remaining in-flight requests are cancelled.
export function generateWithFallback({
  apiKey,
  models,
  buildBody,
  timeoutMs,
  totalMs,
  hedgeMs,
  label,
}: Options): Promise<{ data: any; model: string } | null> {
  const outer = new AbortController();
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let next = 0;
    let running = 0;
    let done = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (
      value: { data: any; model: string } | null
    ) => {
      if (done) return;

      done = true;
      clearTimeout(hedgeTimer);
      outer.abort();
      resolve(value);
    };

    const scheduleHedge = () => {
      clearTimeout(hedgeTimer);

      if (done || next >= models.length) return;

      hedgeTimer = setTimeout(() => {
        if (launch()) scheduleHedge();
      }, hedgeMs);
    };

    const launch = (): boolean => {
      if (done || next >= models.length) return false;

      const budget = Math.min(
        timeoutMs,
        totalMs - (Date.now() - startedAt)
      );

      if (budget < MIN_BUDGET_MS) return false;

      const model = models[next];
      next += 1;
      running += 1;

      console.log(`${label}: trying model ${model}`);

      callOnce(
        apiKey,
        model,
        buildBody(model),
        budget,
        outer.signal
      )
        .then((data) => finish({ data, model }))
        .catch((error: unknown) => {
          if (done) return;

          console.error(
            `${label}: model ${model} failed:`,
            error instanceof Error ? error.message : error
          );
        })
        .finally(() => {
          running -= 1;

          if (done) return;

          const launched = launch();

          if (launched) {
            scheduleHedge();
          } else if (running === 0) {
            finish(null);
          }
        });

      return true;
    };

    if (launch()) {
      scheduleHedge();
    } else {
      finish(null);
    }
  });
}
