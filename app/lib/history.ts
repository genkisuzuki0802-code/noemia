import type { Turn, EngineResponse } from "./types";

export type HistorySession = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  turns: Turn[];
  result: EngineResponse | null;
  executionResult: string;
  executionHistory: string[];
};

const STORAGE_KEY = "noemia:history";
const MAX_SESSIONS = 50;

export function loadHistory(): HistorySession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed as HistorySession[];
  } catch {
    return [];
  }
}

function persist(sessions: HistorySession[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions)
    );
  } catch {
    // Storage full, disabled, or unavailable (e.g. private mode).
    // History is best-effort only, so we silently skip persistence.
  }
}

export function upsertSession(
  sessions: HistorySession[],
  session: HistorySession
): HistorySession[] {
  const next = sessions.filter((s) => s.id !== session.id);

  next.unshift(session);

  const trimmed = next.slice(0, MAX_SESSIONS);

  persist(trimmed);

  return trimmed;
}

export function deleteSession(
  sessions: HistorySession[],
  id: string
): HistorySession[] {
  const next = sessions.filter((s) => s.id !== id);

  persist(next);

  return next;
}

export function makeSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveTitle(
  turns: Turn[],
  intentSummary?: string
): string {
  if (intentSummary && intentSummary.trim()) {
    return intentSummary.trim().slice(0, 40);
  }

  const firstUser = turns.find((t) => t.role === "user");

  if (firstUser?.content.trim()) {
    return firstUser.content.trim().slice(0, 40);
  }

  return "無題の会話";
}
