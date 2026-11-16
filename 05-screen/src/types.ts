export interface TraceEvent {
  v?: number;
  ts: number;
  run: string;
  agent: string;
  parent: string | null;
  step: number;
  kind: string;
  model?: string | null;
  // every other field is optional and kind-specific; unknown fields are ignored
  [k: string]: unknown;
}

export interface RunMeta {
  run: string;
  category: string;
  task: string;
  model: string | null;
  harness: string | null;
  ok: boolean | null;
  ms: number | null;
  events: number;
  saved: boolean;
  input: string;
}

export interface TaskMeta {
  id: string;
  category: string;
  prompt: string;
}

export type Mode = 'checking' | 'server' | 'static';
