import { DIFF_ADD_COLOR, DIFF_REMOVE_COLOR, COST_COLOR, CWD_COLOR, MODEL_COLOR, DIM, RST, CONTEXT_COLOR, FIVE_HOUR_COLOR, SEVEN_DAY_COLOR, FIVE_HOUR_RESET_COLOR, SEVEN_DAY_RESET_COLOR, DURATION_COLOR, BRANCH_COLOR, colorByThreshold, dim } from './ansi.js';
import { renderBar } from './bar.js';
import { formatRemainingEpoch } from './time.js';
import { getGitBranch } from './git.js';
import { homedir } from 'os';
import { sep as pathSep } from 'path';
import type { StatuslineInput, BarStyle, JSONOutput, HiddenField } from './types.js';

interface ResolvedUsage {
  sesPct: number;
  fhPct: number;
  wkPct: number;
  fhRemain: string;
  wkRemain: string;
  fhResetsAt: string | null;
  wkResetsAt: string | null;
}

function resolveUsage(input: StatuslineInput): ResolvedUsage {
  const rl = input.rate_limits;
  const fhEpoch = rl?.five_hour?.resets_at;
  const wkEpoch = rl?.seven_day?.resets_at;

  return {
    sesPct: Math.floor(input.context_window.used_percentage ?? 0),
    fhPct: Math.floor(rl?.five_hour?.used_percentage ?? 0),
    wkPct: Math.floor(rl?.seven_day?.used_percentage ?? 0),
    fhRemain: fhEpoch != null ? formatRemainingEpoch(fhEpoch * 1000) : '--',
    wkRemain: wkEpoch != null ? formatRemainingEpoch(wkEpoch * 1000) : '--',
    fhResetsAt: fhEpoch != null ? new Date(fhEpoch * 1000).toISOString() : null,
    wkResetsAt: wkEpoch != null ? new Date(wkEpoch * 1000).toISOString() : null,
  };
}

function shortenCwd(cwd: string): string {
  const home = homedir();
  if (cwd === home) return '~';
  if (cwd.startsWith(home + pathSep)) return '~' + cwd.slice(home.length).replaceAll('\\', '/');
  return cwd;
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin === 0) return ms > 0 ? '<1m' : '0m';
  if (totalMin < 60) return totalMin + 'm';
  const totalH = Math.floor(totalMin / 60);
  if (totalH < 24) {
    const m = totalMin % 60;
    return m > 0 ? `${totalH}h${m}m` : `${totalH}h`;
  }
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  return h > 0 ? `${d}d${h}h` : `${d}d`;
}

function hasExtendedInput(input: StatuslineInput): boolean {
  return !!(input.cwd || input.model);
}

function buildExtras(input: StatuslineInput, hide: Set<HiddenField>, sep: string): string[] {
  const parts: string[] = [];
  if (input.cost) {
    const { total_lines_added, total_lines_removed, total_cost_usd, total_duration_ms } = input.cost;
    if (!hide.has('diff') && (typeof total_lines_added === 'number' || typeof total_lines_removed === 'number')) {
      const added = total_lines_added ?? 0;
      const removed = total_lines_removed ?? 0;
      parts.push(DIFF_ADD_COLOR() + '+' + added + RST + ' ' + DIFF_REMOVE_COLOR() + '-' + removed + RST);
    }
    if (!hide.has('cost') && typeof total_cost_usd === 'number') {
      parts.push(COST_COLOR() + '$' + total_cost_usd.toFixed(2) + RST);
    }
    if (!hide.has('duration') && typeof total_duration_ms === 'number' && total_duration_ms > 0) {
      parts.push(DIM() + DURATION_COLOR() + '⏱ ' + formatDuration(total_duration_ms) + RST);
    }
  }
  return parts;
}

function buildBarParts(style: BarStyle, usage: ResolvedUsage): string[] {
  const { sesPct, fhPct, wkPct, fhRemain, wkRemain } = usage;
  return [
    'Cx ' + renderBar(sesPct, CONTEXT_COLOR(), style),
    '5h ' + renderBar(fhPct, FIVE_HOUR_COLOR(), style) + ' ' + DIM() + (FIVE_HOUR_RESET_COLOR() || colorByThreshold(fhPct, FIVE_HOUR_COLOR())) + style.resetIcon + fhRemain + RST,
    '7d ' + renderBar(wkPct, SEVEN_DAY_COLOR(), style) + ' ' + DIM() + (SEVEN_DAY_RESET_COLOR() || colorByThreshold(wkPct, SEVEN_DAY_COLOR())) + style.resetIcon + wkRemain + RST,
  ];
}

function renderBarsLine(input: StatuslineInput, style: BarStyle, usage: ResolvedUsage, hide: Set<HiddenField>): string {
  const sep = ' ' + dim(style.separator) + ' ';
  const extras = buildExtras(input, hide, sep);
  const bars = buildBarParts(style, usage).join(sep);

  if (extras.length === 0) return bars;
  return extras.join(sep) + '\n' + bars;
}

export function renderStatusline(input: StatuslineInput, style: BarStyle, hide: Set<HiddenField> = new Set()): string {
  const usage = resolveUsage(input);

  if (!hasExtendedInput(input)) {
    return renderBarsLine(input, style, usage, hide);
  }

  const sep = ' ' + dim(style.separator) + ' ';
  const showCwd = !hide.has('cwd') && !!input.cwd;
  const showBranch = !hide.has('branch') && !!input.cwd;
  const branch = showBranch ? getGitBranch(input.cwd!) : null;

  // Line 1: cwd/branch + extras
  const line1Parts: string[] = [];
  if (showCwd) {
    let cwdPart = CWD_COLOR() + shortenCwd(input.cwd!) + RST;
    if (branch) cwdPart += ' → ' + BRANCH_COLOR() + branch + RST;
    line1Parts.push(cwdPart);
  } else if (branch) {
    line1Parts.push(BRANCH_COLOR() + branch + RST);
  }
  line1Parts.push(...buildExtras(input, hide, sep));

  // Line 2: model + bars
  const line2Parts: string[] = [];
  if (!hide.has('model') && input.model?.display_name) {
    line2Parts.push(MODEL_COLOR() + input.model.display_name + RST);
  }
  line2Parts.push(...buildBarParts(style, usage));

  const lines: string[] = [];
  if (line1Parts.length > 0) lines.push(line1Parts.join(sep));
  lines.push(line2Parts.join(sep));
  return lines.join('\n');
}

export function buildJSONOutput(input: StatuslineInput, hide: Set<HiddenField> = new Set()): JSONOutput {
  const { sesPct, fhPct, wkPct, fhRemain, wkRemain, fhResetsAt, wkResetsAt } = resolveUsage(input);
  const branch = !hide.has('branch') && input.cwd ? getGitBranch(input.cwd) : null;

  return {
    model: !hide.has('model') ? (input.model?.display_name ?? null) : null,
    cwd: !hide.has('cwd') ? (input.cwd ?? null) : null,
    git_branch: branch,
    session: {
      utilization_pct: sesPct,
      resets_at: null,
      remaining: '--',
    },
    five_hour: {
      utilization_pct: fhPct,
      resets_at: fhResetsAt,
      remaining: fhRemain,
    },
    seven_day: {
      utilization_pct: wkPct,
      resets_at: wkResetsAt,
      remaining: wkRemain,
    },
    diff: {
      added: !hide.has('diff') ? (input.cost?.total_lines_added ?? 0) : 0,
      removed: !hide.has('diff') ? (input.cost?.total_lines_removed ?? 0) : 0,
    },
    cost_usd: !hide.has('cost') ? (input.cost?.total_cost_usd ?? null) : null,
    duration_min: !hide.has('duration') && typeof input.cost?.total_duration_ms === 'number'
      ? Math.floor(input.cost.total_duration_ms / 60_000)
      : null,
  };
}
