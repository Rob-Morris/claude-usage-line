export type HiddenField = 'cost' | 'diff' | 'duration' | 'model' | 'cwd' | 'branch' | 'effort' | 'worktree';

export const VALID_HIDE_FIELDS = new Set<HiddenField>(['cost', 'diff', 'duration', 'model', 'cwd', 'branch', 'effort', 'worktree']);

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = typeof EFFORT_LEVELS[number];

const VALID_EFFORT_LEVELS: ReadonlySet<string> = new Set(EFFORT_LEVELS);

export function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && VALID_EFFORT_LEVELS.has(value);
}

export interface InputRateLimitBucket {
  used_percentage: number;
  resets_at: number; // Unix epoch seconds
}

export function parseRateLimitBucket(v: unknown): InputRateLimitBucket | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const b = v as Record<string, unknown>;
  if (typeof b.used_percentage === 'number' && Number.isFinite(b.used_percentage) &&
      typeof b.resets_at === 'number' && Number.isFinite(b.resets_at) && b.resets_at > 0) {
    return { used_percentage: b.used_percentage, resets_at: b.resets_at };
  }
  return undefined;
}

export interface StatuslineInput {
  context_window: {
    used_percentage: number;
  };
  cwd?: string;
  workspace?: {
    git_worktree?: string;
  };
  model?: {
    display_name?: string;
  };
  effort?: {
    level?: EffortLevel;
  };
  cost?: {
    total_lines_added?: number;
    total_lines_removed?: number;
    total_cost_usd?: number;
    total_duration_ms?: number;
  };
  rate_limits?: {
    five_hour?: InputRateLimitBucket | null;
    seven_day?: InputRateLimitBucket | null;
  };
}

export interface BarStyle {
  readonly name: string;
  readonly filled: string;
  readonly empty: string;
  readonly width: number;
  readonly separator: string;
  readonly resetIcon: string;
}

export interface ThemeColors {
  readonly context?: string;
  readonly five_hour?: string;
  readonly seven_day?: string;
  readonly cwd?: string;
  readonly branch?: string;
  readonly worktree?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly cost?: string;
  readonly diff_add?: string;
  readonly diff_remove?: string;
  readonly duration?: string;
  readonly five_hour_reset?: string;
  readonly seven_day_reset?: string;
  readonly dim?: string;
  readonly warn?: string;
  readonly danger?: string;
}

export interface ThemeConfig {
  readonly style?: Partial<Omit<BarStyle, 'name'>>;
  readonly colors?: ThemeColors;
  readonly hide?: readonly HiddenField[];
}

export interface JSONOutput {
  model: string | null;
  effort: EffortLevel | null;
  cwd: string | null;
  git_branch: string | null;
  git_worktree: string | null;
  session: {
    utilization_pct: number;
    resets_at: null;
    remaining: string;
  };
  five_hour: {
    utilization_pct: number;
    resets_at: string | null;
    remaining: string;
  };
  seven_day: {
    utilization_pct: number;
    resets_at: string | null;
    remaining: string;
  };
  diff: {
    added: number;
    removed: number;
  };
  cost_usd: number | null;
  duration_min: number | null;
}
