"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LightConverge from "./components/LightConverge";
import WarpTunnel from "./components/WarpTunnel";
import BrandTitle from "./components/BrandTitle";
import HistorySidebar from "./components/HistorySidebar";
import ParticleReveal from "./components/ParticleReveal";
import type { Turn, EngineResponse } from "./lib/types";
import {
  type HistorySession,
  loadHistory,
  upsertSession,
  deleteSession,
  makeSessionId,
  deriveTitle,
} from "./lib/history";

const WARP_MIN_MS = 1500;
const LIGHT_GROW_MS = 2600;
const LIGHT_FADE_MS = 1700;

const SLOW_NOTICE_MS = 9000;
const REQUEST_TIMEOUT_MS = 65000;

type LightPhase = "off" | "grow" | "fade";

async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<{
  ok: boolean;
  data: any;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data: any = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { ok: response.ok, data };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(
        "応答に時間がかかりすぎています。もう一度お試しください。"
      );
    }

    throw new Error(
      "通信に失敗しました。ネットワークを確認して、もう一度お試しください。"
    );
  } finally {
    clearTimeout(timer);
  }
}

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

  const [history, setHistory] = useState<HistorySession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<
    string | null
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [depthKey, setDepthKey] = useState(0);
  const [lightPhase, setLightPhase] = useState<LightPhase>("off");
  const [lightReveal, setLightReveal] = useState(false);
  const [slow, setSlow] = useState(false);
  const [resultRun, setResultRun] = useState(0);
  const [animateResult, setAnimateResult] = useState(false);

  useEffect(() => {
    if (!animateResult) return;

    const id = requestAnimationFrame(() => {
      document
        .querySelector(".result-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => cancelAnimationFrame(id);
  }, [resultRun, animateResult]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  function persistSession(params: {
    turns: Turn[];
    result: EngineResponse | null;
    executionResult: string;
    executionHistory: string[];
  }) {
    if (params.turns.length === 0) return;

    const id = currentSessionId ?? makeSessionId();
    const existing = history.find((s) => s.id === id);

    const session: HistorySession = {
      id,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      title: deriveTitle(
        params.turns,
        params.result?.intent_summary
      ),
      turns: params.turns,
      result: params.result,
      executionResult: params.executionResult,
      executionHistory: params.executionHistory,
    };

    if (!currentSessionId) {
      setCurrentSessionId(id);
    }

    setHistory((prev) => upsertSession(prev, session));
  }

  function loadSession(id: string) {
    const session = history.find((s) => s.id === id);
    if (!session) return;

    setCurrentSessionId(id);
    setTurns(session.turns);
    setResult(session.result);
    setAnimateResult(false);
    setLightReveal(false);
    setDepthKey((k) => k + 1);
    setExecutionResult(session.executionResult);
    setExecutionHistory(session.executionHistory);

    setInitialInput("");
    setAnswer("");
    setError("");
    setExecutionError("");
    setRevisionInstruction("");
    setRevising(false);
    setShowDetails(false);
    setShowPrompt(false);
    setCopied(false);
    setSidebarOpen(false);
  }

  function handleDeleteSession(id: string) {
    setHistory((prev) => deleteSession(prev, id));

    if (id === currentSessionId) {
      reset();
    }
  }

  function handleNewSession() {
    reset();
    setSidebarOpen(false);
  }

  async function runEngine(newTurns: Turn[]) {
    setLoading(true);
    setSlow(false);
    setError("");

    const startedAt = Date.now();
    const slowTimer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);

    try {
      const { ok, data } = await postJson(
        "/api/intent",
        { turns: newTurns },
        REQUEST_TIMEOUT_MS
      );

      if (!ok || !data) {
        throw new Error(
          data?.error || "処理に失敗しました"
        );
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const remaining = WARP_MIN_MS - (Date.now() - startedAt);

      if (!reducedMotion && remaining > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, remaining)
        );
      }

      const withLight =
        data.status === "ready" && !reducedMotion;

      if (withLight) {
        setLightPhase("grow");

        await new Promise((resolve) =>
          setTimeout(resolve, LIGHT_GROW_MS)
        );
      }

      setLightReveal(withLight);
      setResult(data);
      setDepthKey((k) => k + 1);

      if (withLight) {
        setLightPhase("fade");

        setTimeout(() => {
          setLightPhase("off");
        }, LIGHT_FADE_MS);
      }

      setShowDetails(false);
      setShowPrompt(false);
      setCopied(false);

      setExecutionResult("");
      setExecutionModel("");
      setExecutionError("");

      return data as EngineResponse;
    } catch (e) {
      setLightPhase("off");
      setError(
        e instanceof Error
          ? e.message
          : "処理に失敗しました"
      );

      return null;
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
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

    const data = await runEngine(newTurns);

    if (data) {
      persistSession({
        turns: newTurns,
        result: data,
        executionResult: "",
        executionHistory: [],
      });
    } else {
      setTurns([]);
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || !result) return;

    const submittedAnswer = answer;
    const previousTurns = turns;

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

    const data = await runEngine(newTurns);

    if (data) {
      persistSession({
        turns: newTurns,
        result: data,
        executionResult: "",
        executionHistory: [],
      });
    } else {
      setTurns(previousTurns);
      setAnswer(submittedAnswer);
    }
  }

  async function executePrompt() {
    if (!result?.final_prompt) return;

    setExecuting(true);
    setExecutionError("");
    setExecutionResult("");
    setExecutionModel("");

    try {
      const { ok, data } = await postJson(
        "/api/execute",
        { prompt: result.final_prompt },
        REQUEST_TIMEOUT_MS
      );

      if (!ok || !data) {
        throw new Error(
          data?.error || "AI実行に失敗しました"
        );
      }

      const updatedHistory = executionResult.trim()
        ? [...executionHistory, executionResult]
        : executionHistory;

      setExecutionHistory(updatedHistory);
      setExecutionResult(data.result || "");
      setExecutionModel(data.model || "");
      setAnimateResult(true);
      setResultRun((k) => k + 1);

      persistSession({
        turns,
        result,
        executionResult: data.result || "",
        executionHistory: updatedHistory,
      });
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

      const { ok, data } = await postJson(
        "/api/execute",
        { prompt: revisionPrompt },
        REQUEST_TIMEOUT_MS
      );

      if (!ok || !data) {
        throw new Error(
          data?.error || "修正に失敗しました"
        );
      }

      const updatedHistory = executionResult.trim()
        ? [...executionHistory, executionResult]
        : executionHistory;

      setExecutionHistory(updatedHistory);
      setExecutionResult(data.result || "");
      setExecutionModel(data.model || "");
      setRevisionInstruction("");
      setAnimateResult(true);
      setResultRun((k) => k + 1);

      persistSession({
        turns,
        result,
        executionResult: data.result || "",
        executionHistory: updatedHistory,
      });
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

    const updatedHistory = executionHistory.slice(0, -1);

    setExecutionResult(previousResult);
    setExecutionHistory(updatedHistory);
    setRevisionInstruction("");

    persistSession({
      turns,
      result,
      executionResult: previousResult,
      executionHistory: updatedHistory,
    });
  }

  function submitOnEnter(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    action: () => void,
    disabled: boolean
  ) {
    if (
      e.key !== "Enter" ||
      e.shiftKey ||
      e.nativeEvent.isComposing ||
      e.keyCode === 229
    ) {
      return;
    }

    e.preventDefault();

    if (!disabled) {
      action();
    }
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

    setRevisionInstruction("");
    setRevising(false);

    setShowDetails(false);
    setShowPrompt(false);
    setCopied(false);

    setCurrentSessionId(null);
    setAnimateResult(false);
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

  const isReady =
    result?.status === "ready" || Boolean(executionResult);

  const intentProgress = isReady
    ? 1
    : (result?.understanding_score ?? 0) / 100;

  return (
    <>
      <LightConverge
        progress={intentProgress}
        ready={isReady}
      />

      <WarpTunnel boost={loading} />

      {loading && slow && (
        <div className="loading-note" role="status">
          AIが混み合っていて、少し時間がかかっています。
          このままお待ちください…
        </div>
      )}

      {lightPhase !== "off" && (
        <div
          className={`exit-light exit-light-${lightPhase}`}
          aria-hidden="true"
        />
      )}

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(true)}
        aria-label="履歴を開く"
      >
        ☰
      </button>

      <HistorySidebar
        sessions={history}
        currentId={currentSessionId}
        open={sidebarOpen}
        onSelect={loadSession}
        onDelete={handleDeleteSession}
        onNew={handleNewSession}
        onClose={() => setSidebarOpen(false)}
      />

      <main>
      <div className="shell">
        <header className="brand">
          <BrandTitle />

          <span className="sr-only">Noemia</span>

          <p className="brand-copy">
            うまく言葉にできなくていい。
          </p>
        </header>

        {!result && (
          <section className={`hero${loading ? " hero-out" : ""}`}>
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
                onKeyDown={(e) =>
                  submitOnEnter(
                    e,
                    start,
                    loading || !initialInput.trim()
                  )
                }
                placeholder="例：来週お客さんにプレゼンするんだけど、最近の市場について説得力ある感じで説明したい。"
              />

              <div className="input-hint">
                短くても、まとまっていなくても大丈夫です
                （Enterで送信 / Shift+Enterで改行）
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
          <div
            className={`depth-in${lightReveal ? " light-in" : ""}${loading ? " depth-out" : ""}`}
            key={depthKey}
          >
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
                    Noemia理解度
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
                    background: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div
                    style={{
                      width: `${result.understanding_score}%`,
                      height: "100%",
                      borderRadius: 999,
                      background:
                        "linear-gradient(90deg, #6ee7ff, #8f7bff)",
                      transition: "width 0.6s ease",
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
                  onKeyDown={(e) =>
                    submitOnEnter(
                      e,
                      submitAnswer,
                      loading || !answer.trim()
                    )
                  }
                  placeholder="短くても大丈夫です。"
                />

                <div className="answer-footer">
                  <span className="input-hint">
                    分かる範囲だけで大丈夫です
                    （Enterで送信 / Shift+Enterで改行）
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
                    Noemiaが理解したあなたの意図
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
                                  {assumption.text}
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

                {showPrompt && (
                  <section className="card">
                    <div className="row">
                      <strong>
                        完成プロンプト
                      </strong>

                      <button onClick={copyPrompt}>
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

                {executionError && (
                  <div className="error">
                    {executionError}
                  </div>
                )}

                {executionResult && (
                  <section className="card result-card">
                    <div className="result-header">
                      <div>
                        <div className="muted">
                          AIが作成した成果物
                        </div>

                        <h2 className="result-title">
                          AI実行結果
                        </h2>
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
                      <ParticleReveal
                        runKey={animateResult ? resultRun : 0}
                      >
                        <div className="markdown">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                          >
                            {executionResult}
                          </ReactMarkdown>
                        </div>
                      </ParticleReveal>
                    </div>

                    <div className="revision-panel">
                      <div>
                        <div className="muted">
                          追加指示で修正
                        </div>

                        <p className="revision-help">
                          今の成果物をベースに、
                          変えたいところだけ自然な言葉で入力してください。
                        </p>
                      </div>

                      <textarea
                        className="revision-textarea"
                        value={revisionInstruction}
                        onChange={(e) =>
                          setRevisionInstruction(
                            e.target.value
                          )
                        }
                        onKeyDown={(e) =>
                          submitOnEnter(
                            e,
                            reviseExecution,
                            revising ||
                              !revisionInstruction.trim()
                          )
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
              </>
            )}

            <div className="actions">
              <button onClick={reset}>
                最初から
              </button>
            </div>
          </div>
        )}
      </div>
      </main>
    </>
  );
}