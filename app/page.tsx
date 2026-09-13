"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Turn = {
  role: "user" | "assistant";
  content: string;
};

type Intent = {
  task: string;
  goal: string;
  audience: string;
  desired_outcome: string;
  context: string;
  constraints: string;
  evidence: string;
  output: string;
  quality: string;
};

type Assumption = {
  text: string;
  impact: "low" | "medium" | "high";
  needs_confirmation: boolean;
};

type EngineResponse = {
  status: "ask" | "ready";
  understanding_score: number;
  intent: Intent;

  confirmed_facts?: string[];
  assumptions?: Assumption[];
  critical_gaps?: string[];
  readiness_reason?: string;

  next_question: string;
  question_reason: string;
  intent_summary: string;
  final_prompt: string;
};

export default function Home() {
  const [initialInput, setInitialInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<EngineResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [error, setError] = useState("");
  const [executionError, setExecutionError] = useState("");

  const [executionResult, setExecutionResult] = useState("");
  const [executionModel, setExecutionModel] = useState("");

const [revisionInstruction, setRevisionInstruction] = useState("");
const [revising, setRevising] = useState(false);

const [executionHistory, setExecutionHistory] = useState<string[]>([]);

  const [showDetails, setShowDetails] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  async function runEngine(newTurns: Turn[]) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turns: newTurns,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "処理に失敗しました"
        );
      }

      setResult(data);

      setShowDetails(false);
      setShowPrompt(false);
      setCopied(false);

      setExecutionResult("");
      setExecutionModel("");
      setExecutionError("");

      return data as EngineResponse;

    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "処理に失敗しました"
      );

      return null;

    } finally {
      setLoading(false);
    }
  }

  async function start() {
    if (!initialInput.trim()) return;

    const newTurns: Turn[] = [
      {
        role: "user",
        content: initialInput.trim(),
      },
    ];

    setTurns(newTurns);

    await runEngine(newTurns);
  }

  async function submitAnswer() {
    if (!answer.trim() || !result) return;

    const newTurns: Turn[] = [
      ...turns,
      {
        role: "assistant",
        content: result.next_question,
      },
      {
        role: "user",
        content: answer.trim(),
      },
    ];

    setTurns(newTurns);
    setAnswer("");

    await runEngine(newTurns);
  }

async function executePrompt() {
  if (!result?.final_prompt) return;

  setExecuting(true);
  setExecutionError("");
  setExecutionResult("");
  setExecutionModel("");

  try {
    const response = await fetch("/api/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: result.final_prompt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || "AI実行に失敗しました"
      );
    }

if (executionResult.trim()) {
  setExecutionHistory((prev) => [
    ...prev,
    executionResult,
  ]);
}

setExecutionResult(data.result || "");
setExecutionModel(data.model || "");

  } catch (e) {
    setExecutionError(
      e instanceof Error
        ? e.message
        : "AI実行に失敗しました"
    );

  } finally {
    setExecuting(false);
  }
}

async function reviseExecution() {
  if (
    !executionResult.trim() ||
    !revisionInstruction.trim()
  ) {
    return;
  }

  setRevising(true);
  setExecutionError("");

  try {
    const revisionPrompt = `
以下は現在のAI実行結果です。

--- 現在の結果 ---
${executionResult}

--- ユーザーからの追加指示 ---
${revisionInstruction}

上記の追加指示を反映して、
現在の結果を修正してください。

重要:
- 元の最終目的は維持してください。
- ただし、追加指示によって訴求軸・ターゲット・構成・枚数・優先順位が変わる場合は、既存構成にこだわらず全体を再設計してください。
- 単なる文言修正ではなく、追加指示が成果物全体に与える影響を判断してください。
- 例えば「コスト重視」と指示された場合は、構成順、見出し、各スライドの比重、クロージングまでコスト訴求中心に再構成してください。
- 「3枚にして」と指示された場合は、既存スライドを単純に削るのではなく、情報を再統合してください。
- 不明な事実を新たに作らないでください。
- 完成版のみを出力してください。
`;

    const response = await fetch("/api/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: revisionPrompt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error || "修正に失敗しました"
      );
    }

if (executionResult.trim()) {
  setExecutionHistory((prev) => [
    ...prev,
    executionResult,
  ]);
}

setExecutionResult(data.result || "");
setExecutionModel(data.model || "");
setRevisionInstruction("");

  } catch (e) {
    setExecutionError(
      e instanceof Error
        ? e.message
        : "修正に失敗しました"
    );

  } finally {
    setRevising(false);
  }
}

function undoExecution() {
  if (executionHistory.length === 0) {
    return;
  }

  const previousResult =
    executionHistory[executionHistory.length - 1];

  setExecutionResult(previousResult);

  setExecutionHistory((prev) =>
    prev.slice(0, -1)
  );

  setRevisionInstruction("");
}
  function reset() {
    setInitialInput("");
    setAnswer("");
    setTurns([]);
    setResult(null);

    setError("");
    setExecutionError("");

    setExecutionResult("");
    setExecutionModel("");
    setExecutionHistory([]);

    setShowDetails(false);
    setShowPrompt(false);
    setCopied(false);
  }

  async function copyPrompt() {
    if (!result?.final_prompt) return;

    await navigator.clipboard.writeText(
      result.final_prompt
    );

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  async function copyExecutionResult() {
    if (!executionResult) return;

    await navigator.clipboard.writeText(
      executionResult
    );
  }

  const intentEntries = result
    ? Object.entries(result.intent).filter(
        ([, value]) =>
          value &&
          value !== "unknown"
      )
    : [];

  const confirmedFacts =
    result?.confirmed_facts ?? [];

  const assumptions =
    result?.assumptions ?? [];

  return (
    <main>
      <div className="shell">

<header className="brand">
  <div className="brand-name">
    Noemia
  </div>

  <p className="brand-copy">
    うまく言葉にできなくていい。
  </p>
</header>

{!result && (
  <section className="card hero">
    <h2>何をしたいですか？</h2>

<p>
  まとまっていなくても大丈夫です。
  必要なことだけAIが質問して、
  あなたの意図を形にします。
</p>

    <div className="intent-input-wrap">
      <textarea
        className="intent-input"
        value={initialInput}
        onChange={(e) =>
          setInitialInput(e.target.value)
        }
        placeholder="例：来週お客さんにプレゼンするんだけど、最近の市場について説得力ある感じで説明したい。"
      />

      <div className="input-hint">
        短くても、まとまっていなくても大丈夫です
      </div>

      <div className="intent-input-footer">
        <div />

        <button
          className="intent-submit"
          onClick={start}
          disabled={
            loading ||
            !initialInput.trim()
          }
        >
          {loading
            ? "理解しています..."
            : "意図を整理する →"}
        </button>
      </div>
    </div>
  </section>
)}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

{result && (
  <>
{result.status === "ask" && (
<section
  className="card"
  style={{
    padding: "20px 24px",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 20,
    }}
  >
    <span className="muted">
      Intent理解度
    </span>

    <strong
      style={{
        fontSize: 18,
        lineHeight: 1,
      }}
    >
      {result.understanding_score}%
    </strong>
  </div>

  <div
    style={{
      width: "100%",
      height: 6,
      marginTop: 12,
      overflow: "hidden",
      borderRadius: 999,
      background: "#eeeeef",
    }}
  >
    <div
      style={{
        width: `${result.understanding_score}%`,
        height: "100%",
        borderRadius: 999,
        background: "#111",
        transition: "width 0.35s ease",
      }}
    />
  </div>

  <div
    style={{
      marginTop: 10,
      color: "#777",
      fontSize: 13,
      lineHeight: 1.5,
    }}
  >
    最終成果への影響が大きい点だけ確認します
  </div>
</section>
)}

{result.status === "ask" && (
  <section className="card question-card">
    <div className="muted">
      次に確認したいこと
    </div>

    <div className="question">
      {result.next_question}
    </div>

    <textarea
      className="answer-input"
      value={answer}
      onChange={(e) =>
        setAnswer(e.target.value)
      }
      placeholder="短くても大丈夫です。"
    />

    <div className="answer-footer">
      <span className="input-hint">
        分かる範囲だけで大丈夫です
      </span>

      <button
        className="answer-submit"
        onClick={submitAnswer}
        disabled={
          loading ||
          !answer.trim()
        }
      >
        {loading
          ? "再分析しています..."
          : "回答する →"}
      </button>
    </div>
  </section>
)}
            {result.status === "ready" && (
              <>
               <section className="card intent-summary-card">
  <div className="muted">
    AIが理解したあなたの意図
  </div>

  <div className="intent-summary">
    {result.intent_summary}
  </div>

  <div className="intent-summary-footer">
    <span className="muted">
      内容が合っているか確認してください
    </span>

    <button
      className="secondary-button"
      onClick={() =>
        setShowDetails((v) => !v)
      }
    >
      {showDetails
        ? "詳細を閉じる"
        : "詳細を見る"}
    </button>
  </div>
</section>

                {showDetails && (
                  <section className="card">

                    {confirmedFacts.length > 0 && (
                      <>
                        <div className="muted">
                          確認できた情報
                        </div>

                        <div className="intent-grid">
                          {confirmedFacts.map(
                            (fact, index) => (
                              <div
                                className="intent-item"
                                key={`fact-${index}`}
                              >
                                <b>CONFIRMED</b>
                                <span>{fact}</span>
                              </div>
                            )
                          )}
                        </div>

                        <div
                          style={{
                            height: 18,
                          }}
                        />
                      </>
                    )}

                    {assumptions.length > 0 && (
                      <>
                        <div className="muted">
                          AIが補完した未確認の仮説
                        </div>

                        <div className="intent-grid">
                          {assumptions.map(
                            (
                              assumption,
                              index
                            ) => (
                              <div
                                className="intent-item"
                                key={`assumption-${index}`}
                              >
                                <b>
                                  ASSUMPTION /{" "}
                                  {assumption.impact.toUpperCase()}
                                </b>

                                <span>
                                  {
                                    assumption.text
                                  }
                                </span>
                              </div>
                            )
                          )}
                        </div>

                        <div
                          style={{
                            height: 18,
                          }}
                        />
                      </>
                    )}

                    {intentEntries.length > 0 && (
                      <>
                        <div className="muted">
                          Intent構造
                        </div>

                        <div className="intent-grid">
                          {intentEntries.map(
                            ([key, value]) => (
                              <div
                                className="intent-item"
                                key={key}
                              >
                                <b>
                                  {key.replaceAll(
                                    "_",
                                    " "
                                  )}
                                </b>

                                <span>
                                  {value}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </>
                    )}

                  </section>
                )}

<section className="card">
  <strong className="ready-title">
    実行準備ができました
  </strong>

<p className="ready-copy">
  Noemiaがあなたの意図を整理しました。
  このままAIに実行できます。
</p>

  <div className="ready-actions">
    <button
      className="secondary-button"
      onClick={() =>
        setShowPrompt((v) => !v)
      }
    >
      {showPrompt
        ? "プロンプトを閉じる"
        : "完成プロンプトを見る"}
    </button>

    <button
      className="primary-action"
      onClick={executePrompt}
      disabled={executing}
    >
      {executing
        ? "AIが実行しています..."
        : "AIで実行 →"}
    </button>
  </div>
</section>

                {executionError && (
                  <div className="error">
                    {executionError}
                  </div>
                )}
{executionResult && (
  <section className="card result-card">
    <div className="result-header">
      <div>
        <div className="muted">AIが作成した成果物</div>
        <h2 className="result-title">AI実行結果</h2>

      </div>

      <div className="result-actions">
        {executionHistory.length > 0 && (
          <button
            className="secondary-button"
            onClick={undoExecution}
          >
            ← 1つ前に戻す
          </button>
        )}

        <button
          className="secondary-button"
          onClick={executePrompt}
          disabled={executing}
        >
          {executing
            ? "再生成中..."
            : "もう一度生成"}
        </button>

        <button
          className="secondary-button"
          onClick={copyExecutionResult}
        >
          コピー
        </button>
      </div>
    </div>

    <div className="result-body">
      <div className="markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {executionResult}
        </ReactMarkdown>
      </div>
    </div>

    <div className="revision-panel">
      <div>
        <div className="muted">追加指示で修正</div>
        <p className="revision-help">
          今の成果物をベースに、変えたいところだけ自然な言葉で入力してください。
        </p>
      </div>

      <textarea
        className="revision-textarea"
        value={revisionInstruction}
        onChange={(e) =>
          setRevisionInstruction(e.target.value)
        }
        placeholder="例：コストより安全性を強調して。3枚に短くして。経営層向けの表現にして。"
      />

      <div className="revision-footer">
        <span className="muted">
          元の目的は維持したまま修正します
        </span>

<button
  className="revision-button"
  onClick={reviseExecution}
  disabled={
    revising ||
    !revisionInstruction.trim()
  }
>
  {revising
    ? "修正しています..."
    : "修正する →"}
</button>
      </div>
    </div>
  </section>
)}


                {showPrompt && (
                  <section className="card">

                    <div className="row">

                      <strong>
                        完成プロンプト
                      </strong>

                      <button
                        onClick={copyPrompt}
                      >
                        {copied
                          ? "コピーしました"
                          : "コピー"}
                      </button>

                    </div>

                    <div
                      style={{
                        height: 14,
                      }}
                    />

                    <div className="prompt">
                      {result.final_prompt}
                    </div>

                  </section>
                )}
              </>
            )}

            <div className="actions">
              <button onClick={reset}>
                最初から
              </button>
            </div>
          </>
        )}

      </div>
    </main>
  );
}