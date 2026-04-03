export type HiddenField = 'cost' | 'diff' | 'duration' | 'model' | 'cwd' | 'branch';

export const VALID_HIDE_FIELDS = new Set<HiddenField>(['cost', 'diff', 'duration', 'model', 'cwd', 'branch']);

export interface StatuslineInput {
  context_window: {
    used_percentage: number;
  };
  cwd?: string;
  model?: {
    display_name?: string;
  };
  cost?: {
    total_lines_added?: number;
    total_lines_removed?: number;
    total_cost_usd?: number;
    total_duration_ms?: number;
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

export interface RateLimitBucket {
  utilization: number;
  resets_at: string;
}

export interface CachedUsage {
  five_hour: RateLimitBucket | null;
  seven_day: RateLimitBucket | null;
  fetched_at: number;
}

export interface ThemeColors {
  readonly context?: string;
  readonly five_hour?: string;
  readonly seven_day?: string;
  readonly cwd?: string;
  readonly branch?: string;
  readonly model?: string;
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
  cwd: string | null;
  git_branch: string | null;
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
