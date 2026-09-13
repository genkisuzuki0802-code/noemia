import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: false,
  prefix: "noemia:execute",
});

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModel(
  apiKey: string,
  model: string,
  prompt: string
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 25000);

const groundedPrompt = `
${prompt}

---
IMPORTANT EXECUTION RULES

Follow the user's requested task, but obey these grounding rules throughout the answer:

1. Treat only information explicitly provided in the prompt as confirmed facts about the user or their situation.

2. Do not turn general knowledge, common patterns, or plausible assumptions into facts about the user.

3. If something important is not known, say that it is unknown, unconfirmed, or something to verify.

4. You may discuss general possibilities, but clearly label them as possibilities rather than facts about this specific user.

5. Do not invent details about the user's workplace, relationships, compensation, skills, experience, promotion system, customers, company, or circumstances.

6. When an unknown materially affects the conclusion, convert it into a useful verification question, checkpoint, or next action instead of guessing.

7. Base recommendations and conclusions primarily on confirmed facts.

8. Every personalized statement about the user's current situation must be directly traceable to a confirmed fact in the prompt. If it is not, either omit it or explicitly frame it as a general possibility.

9. Do not use assumptions as personalized merits or demerits. For example, do not assume that the user has good workplace relationships, understands internal politics, knows the evaluation system, has accumulated trust, or would face a specific adaptation difficulty unless the prompt confirms it.

10. Before producing the answer, internally check each statement about the user:
- Is this explicitly confirmed?
- Is this only a general possibility?
- Is this unknown?
Only confirmed information may be stated as a fact about the user.

11. When creating business, sales, proposal, marketing, or presentation content, do not invent the reasons, mechanisms, capabilities, processes, technologies, infrastructure, certifications, performance data, or evidence behind a claimed strength.

If the prompt confirms only that something is a strength (for example, cost, speed, or quality), you may present that strength as confirmed, but you must not invent why it is a strength.

Any supporting mechanism or proof that has not been explicitly provided must be labeled as information to verify or content to add once evidence is available.

Produce the final deliverable directly. Do not explain these rules.
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: groundedPrompt,
          store: false,
          generation_config: {
            temperature: 0.4,
            max_output_tokens: 5000,
          },
        }),
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();

      console.error(`${model} execute error:`, errorText);

      const retryable =
        response.status === 429 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504 ||
        errorText.toLowerCase().includes("high demand") ||
        errorText.toLowerCase().includes("temporarily");

      if (retryable) {
        throw new Error("RETRYABLE");
      }

      throw new Error("NON_RETRYABLE");
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeout);

    if (error?.name === "AbortError") {
      throw new Error("RETRYABLE");
    }

    throw error;
  }
}

function extractText(data: any) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  return (
    data?.steps
      ?.filter((step: any) => step?.type === "model_output")
      ?.flatMap((step: any) => step?.content || [])
      ?.filter((content: any) => content?.type === "text")
      ?.map((content: any) => content?.text)
      ?.join("") || ""
  );
}

export async function POST(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      {
        error:
          "AI実行の利用回数上限に達しました。しばらく時間をおいてからお試しください。",
      },
      { status: 429 }
    );
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY が設定されていません。",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const prompt = body?.prompt;
    const MAX_PROMPT_LENGTH = 20000;

    if (
      typeof prompt === "string" &&
      prompt.length > MAX_PROMPT_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "実行する内容が長すぎます。文章を短くしてもう一度お試しください。",
        },
        { status: 413 }
      );
    }

    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      return NextResponse.json(
        {
          error: "実行するプロンプトがありません。",
        },
        { status: 400 }
      );
    }

    let data: any = null;
    let usedModel = "";

    for (const model of MODELS) {
      console.log(`Execute: trying model ${model}`);

      try {
        data = await callModel(
          apiKey,
          model,
          prompt
        );

        usedModel = model;
        break;
      } catch (error: any) {
        console.error(
          `Execute model ${model} failed:`,
          error?.message
        );

        await sleep(1000);
      }
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "現在AIが混雑しています。少し時間を置いてもう一度お試しください。",
        },
        { status: 503 }
      );
    }

    console.log(
      `Execute succeeded with model: ${usedModel}`
    );

    const text = extractText(data);

    if (!text) {
      return NextResponse.json(
        {
          error:
            "AIから有効な実行結果を取得できませんでした。",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      result: text,
      model: usedModel,
    });
  } catch (error) {
    console.error("Execute server error:", error);

    return NextResponse.json(
      {
        error:
          "AI実行中に予期しないエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}