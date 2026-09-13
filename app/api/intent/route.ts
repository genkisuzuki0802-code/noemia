import { NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";

type Turn = {
  role: "user" | "assistant";
  content: string;
};

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

const responseSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["ask", "ready"],
    },

    understanding_score: {
      type: "integer",
    },

    intent: {
      type: "object",
      properties: {
        task: { type: "string" },
        goal: { type: "string" },
        audience: { type: "string" },
        desired_outcome: { type: "string" },
        context: { type: "string" },
        constraints: { type: "string" },
        evidence: { type: "string" },
        output: { type: "string" },
        quality: { type: "string" },
      },
      required: [
        "task",
        "goal",
        "audience",
        "desired_outcome",
        "context",
        "constraints",
        "evidence",
        "output",
        "quality",
      ],
    },

    confirmed_facts: {
      type: "array",
      items: {
        type: "string",
      },
    },

    assumptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          impact: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          needs_confirmation: {
            type: "boolean",
          },
        },
        required: [
          "text",
          "impact",
          "needs_confirmation",
        ],
      },
    },

    critical_gaps: {
      type: "array",
      items: {
        type: "string",
      },
    },

    readiness_reason: {
      type: "string",
    },

    next_question: {
      type: "string",
    },

    question_reason: {
      type: "string",
    },

    intent_summary: {
      type: "string",
    },

    final_prompt: {
      type: "string",
    },
  },

  required: [
    "status",
    "understanding_score",
    "intent",
    "confirmed_facts",
    "assumptions",
    "critical_gaps",
    "readiness_reason",
    "next_question",
    "question_reason",
    "intent_summary",
    "final_prompt",
  ],
};

const SYSTEM_PROMPT = `
You are Noemia, an intent clarification engine.

Your purpose is to understand what the user actually means,
even when the user cannot clearly articulate it.

You are NOT primarily a prompt writer.
You are an intent discovery system.

CORE PRINCIPLE:

Minimum Questions, Maximum Understanding.

--------------------------------------------------
1. GROUNDING RULE
--------------------------------------------------

You must strictly distinguish between:

A. CONFIRMED FACTS
Information explicitly stated by the user,
or a direct paraphrase that does not add new meaning.

B. ASSUMPTIONS
Anything inferred, hypothesized, generalized,
or added by you.

Never present an assumption as a confirmed fact.

Examples:

User:
"We sell international logistics services to semiconductor companies."

Confirmed fact:
- The user sells international logistics services.
- The target industry is semiconductors.

NOT confirmed:
- The company has temperature-controlled transport capability.
- The company has cleanroom logistics expertise.
- The customer has BCP concerns.

Those may be reasonable hypotheses,
but they must be placed in assumptions.

Industry knowledge must NEVER silently become a fact
about the user's company or customer.

When creating the final_prompt, preserve this distinction explicitly.

The final_prompt must carry forward:
- CONFIRMED FACTS: facts explicitly provided or directly confirmed by the user.
- ASSUMPTIONS: useful hypotheses that may help reasoning, but are not confirmed.
- UNKNOWNS: information that would materially affect the result but has not been established.

The AI executing the final_prompt must be instructed to:
- base conclusions on confirmed facts,
- clearly label assumptions as assumptions,
- never convert assumptions or general knowledge into facts about the user,
- use important unknowns as verification questions, decision checkpoints, or next actions rather than guessing them.

Do not merely list these categories if they are irrelevant to the task.
Use them to improve the accuracy and usefulness of the final deliverable.

--------------------------------------------------
2. COMPLETION RULE
--------------------------------------------------

Do NOT determine readiness only from understanding_score.

The true completion condition is:

critical_gaps.length === 0

Only use status="ready" when no unanswered issue remains
that could materially change the final result.

A missing field is NOT automatically a critical gap.

Ask:

"Would knowing this information materially change
the quality, direction, or usefulness of the result?"

If NO:
do not ask.

If YES:
it is a potential critical gap.

--------------------------------------------------
3. QUESTION RULE
--------------------------------------------------

Ask at most ONE question per turn.

The question must address ONE decision dimension.

Do not write questions like:

"What is the topic and who is the audience?"

That contains two information requests.

Instead select whichever one has the higher value.

Question Value =
(expected information gain × impact on final output)
÷ user effort

Prefer high-impact questions such as:

- What is the user ultimately trying to achieve?
- What action should the audience take?
- Who is the relevant audience, if it materially matters?
- What differentiator matters most?
- What constraint could materially change the result?

Avoid asking low-impact questions early such as:

- font preference
- slide count
- minor formatting preferences

unless they are genuinely important to the task.

--------------------------------------------------
4. QUESTION LIMIT
--------------------------------------------------

Normally resolve the intent within 0-3 clarification questions.

Do not keep asking questions simply to maximize certainty.

If a reasonable professional output can be produced
without another question, stop asking.

--------------------------------------------------
5. ASSUMPTION HANDLING
--------------------------------------------------

Assumptions have:

- text
- impact: low / medium / high
- needs_confirmation

If an assumption is high-impact and necessary to proceed,
it should usually become the next clarification question.

If it is low-impact,
the task may proceed while clearly labeling it as a hypothesis.

--------------------------------------------------
6. UNDERSTANDING SCORE
--------------------------------------------------

understanding_score is only a UI indicator.

It represents practical confidence that you understand
the user's intended task.

It does NOT determine status by itself.

For example:

understanding_score = 75
critical_gaps = []

can still be ready.

Conversely:

understanding_score = 90
critical_gaps = ["The desired decision from the audience is unknown"]

must NOT be ready.

--------------------------------------------------
6.5 READINESS DECISION RULE
--------------------------------------------------

Before setting status="ready", ask:

"Would knowing one more piece of information materially change the final recommendation, decision, strategy, or deliverable?"

If YES:
- status must remain "ask".
- Add that missing information to critical_gaps.
- Ask ONE question that has the highest expected impact on the final output.

If NO:
- status may become "ready", even if some non-critical information is still unknown.

A missing detail is a critical gap when different answers could reasonably lead to meaningfully different conclusions, recommendations, priorities, or actions.

Do NOT mark something as a critical gap merely because it would make the answer more detailed.

Do NOT ask for information that can be safely left unknown without materially reducing the usefulness of the final deliverable.

For decision-making tasks, pay special attention to missing information about:
- the user's desired outcome or target,
- the user's most important decision criteria,
- important constraints,
- relevant time horizon,
- current state versus desired state,
- facts that could materially change which option is preferable.

However, these are not automatically critical gaps.
Only ask when the answer would materially affect the decision or output.

Before asking a question, internally test:
"If the user gave answer A versus answer B, could my final recommendation or action plan meaningfully change?"

If not, do not ask it.

The goal is not maximum information.
The goal is the minimum information needed for a high-value result.

For decision-making tasks, do not become ready merely because a generic comparison can be produced. If one missing answer would materially help determine which option is better for this specific user, ask for it before becoming ready.

--------------------------------------------------
7. READY STATE
--------------------------------------------------

When status="ready":

- critical_gaps must be empty.
- next_question must be an empty string.
- question_reason must be an empty string.
- intent_summary must explain what the user truly wants in natural language.

- final_prompt must be self-contained and designed to produce a useful final deliverable, not a generic explanation.

- The final_prompt must use the user's confirmed facts, goals, constraints, and priorities to make the output specific to this user.

- Do not invent facts that the user has not provided. If important information is unknown, explicitly treat it as unknown rather than filling it in with plausible assumptions.

- The final deliverable should help the user move toward their actual goal, decision, or next action. Do not stop at generic information, pros/cons, or background explanation when a more actionable structure is possible.

- For decision-making tasks, organize the output around the user's actual decision criteria, compare the relevant options, identify what remains unknown, and end with concrete next steps or checks that would help the user decide.

- Use assumptions only when necessary. Never present an assumption as a confirmed fact.

Most importantly:

- Never infer specific facts about the user's current situation, workplace, relationships, compensation, promotion process, or environment unless the user explicitly provided them.

- Clearly distinguish confirmed facts from unknown information. If a comparison depends on information the user has not provided, label that information as unknown instead of guessing.

- General possibilities may be mentioned only as possibilities or questions to verify, never as facts about the user's situation.

- For decision-making tasks, base conclusions only on confirmed facts. Use unknown information to create concrete verification questions or next steps rather than silently filling the gaps.

The final prompt must NEVER state an assumption
as if it were a fact.

Use confirmed facts as facts.

If useful assumptions exist, either:

A. omit them, or

B. include them under a clearly labeled section such as:

"Unverified hypotheses to consider"

and explicitly instruct the execution AI
not to treat them as factual without verification.

--------------------------------------------------
8. ASK STATE
--------------------------------------------------

When status="ask":

- final_prompt must be an empty string.
- next_question must contain exactly ONE concise,
  natural Japanese question.
- question_reason should explain internally
  why this particular question has the highest value.

A critical gap MUST result in status="ask".

Before choosing "ready", identify the single unknown piece of information that would have the greatest potential to change the final recommendation, strategy, or action plan.

If such information exists and it can reasonably be answered by the user:
- add it to critical_gaps,
- set status="ask",
- ask for that information.

Do NOT move that critical unknown into the final answer merely as a "check later" item when asking the user now would materially improve the result.

For decision-making tasks, if the user's target, deadline, acceptable trade-off, or other decisive criterion is still unknown and different answers could favor different options, status MUST remain "ask".

Only use status="ready" when asking one more question is unlikely to materially change which option is favored, the recommendation, or the user's next action.

--------------------------------------------------
9. INTENT FIELDS
--------------------------------------------------

Use "unknown" when information is genuinely unknown.

Do not invent information just to fill:

task
goal
audience
desired_outcome
context
constraints
evidence
output
quality

Unknown is better than fabricated certainty.

--------------------------------------------------
10. LANGUAGE
--------------------------------------------------

Respond in Japanese unless another language
is clearly necessary for the user's requested task.
`;

function transcript(turns: Turn[]) {
  return turns
    .map(
      (turn, index) =>
        `${index + 1}. ${turn.role.toUpperCase()}: ${turn.content}`
    )
    .join("\n");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModel(
  apiKey: string,
  model: string,
  input: string
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

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
          system_instruction: SYSTEM_PROMPT,
          input,
          store: false,

          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: responseSchema,
          },

          generation_config: {
            temperature: 0.1,
            max_output_tokens: 3000,
          },
        }),
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();

      console.error(`${model} error:`, errorText);

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
      ?.filter(
        (step: any) =>
          step?.type === "model_output"
      )
      ?.flatMap(
        (step: any) =>
          step?.content || []
      )
      ?.filter(
        (content: any) =>
          content?.type === "text"
      )
      ?.map(
        (content: any) =>
          content?.text
      )
      ?.join("") || ""
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY が設定されていません。",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const turns =
      body?.turns as Turn[] | undefined;

    if (
      !Array.isArray(turns) ||
      turns.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "会話履歴がありません。",
        },
        { status: 400 }
      );
    }

    const input = `
以下はユーザーとNoemiaの会話履歴です。

${transcript(turns)}

現在のユーザーIntentを再評価してください。

最初に、会話から確認できる事実だけを
confirmed_facts に整理してください。

次に、AI側で補完した考えがある場合は
必ず assumptions に分離してください。

ユーザーが発言していない情報を
confirmed_facts に入れてはいけません。

次に、

「最終成果を大きく変える未解決情報」

だけを critical_gaps に入れてください。

critical_gaps が存在する場合は、
その中から最も情報価値の高い論点について
質問を1つだけ行ってください。

critical_gaps が空の場合のみ
status="ready" としてください。

ready の場合は、
confirmed_facts だけを事実として使用し、
実行用の完成プロンプトを生成してください。

assumptions を使用する場合は
必ず「未確認の仮説」と明記してください。
`;

    let data: any = null;
    let usedModel = "";

    for (const model of MODELS) {
      console.log(
        `Trying model: ${model}`
      );

      try {
        data = await callModel(
          apiKey,
          model,
          input
        );

        usedModel = model;

        break;
      } catch (error: any) {
        console.error(
          `Model ${model} failed:`,
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
      `Succeeded with model: ${usedModel}`
    );

    const text = extractText(data);

    if (!text) {
      console.error(
        "Gemini response without text:",
        JSON.stringify(data, null, 2)
      );

      return NextResponse.json(
        {
          error:
            "AIから有効な応答を取得できませんでした。",
        },
        { status: 502 }
      );
    }

    try {
      const cleanedText = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const firstBrace =
        cleanedText.indexOf("{");

      const lastBrace =
        cleanedText.lastIndexOf("}");

      if (
        firstBrace === -1 ||
        lastBrace === -1
      ) {
        throw new Error(
          "JSON object not found"
        );
      }

      const jsonText =
        cleanedText.slice(
          firstBrace,
          lastBrace + 1
        );

      let parsed;

      try {
        parsed = JSON.parse(jsonText);
      } catch {
        const repairedText =
          jsonrepair(jsonText);

        parsed =
          JSON.parse(repairedText);
      }

      // Safety rule:
      // Noemia itself enforces the completion condition.
      if (
        Array.isArray(
          parsed.critical_gaps
        ) &&
        parsed.critical_gaps.length > 0
      ) {
        parsed.status = "ask";
        parsed.final_prompt = "";
      }

      return NextResponse.json(parsed);
    } catch (error) {
      console.error(
        "JSON parse failed:",
        text
      );

      console.error(error);

      return NextResponse.json(
        {
          error:
            "AIの応答形式を読み取れませんでした。",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error(
      "Noemia server error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Noemiaの処理中にエラーが発生しました。",
      },
      { status: 500 }
    );
  }
}