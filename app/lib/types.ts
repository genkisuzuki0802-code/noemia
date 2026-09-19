export type Turn = {
  role: "user" | "assistant";
  content: string;
};

export type Intent = {
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

export type Assumption = {
  text: string;
  impact: "low" | "medium" | "high";
  needs_confirmation: boolean;
};

export type EngineResponse = {
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
