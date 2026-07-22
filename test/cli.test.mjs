import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');
const SGR = /\x1b\[[0-9;]*m/g;

function runCli(input, args = [], theme = null) {
  const testHome = mkdtempSync(join(tmpdir(), 'claude-usage-line-'));
  try {
    if (theme) {
      const themeDir = join(testHome, '.claude');
      mkdirSync(themeDir, { recursive: true });
      writeFileSync(join(themeDir, 'statusline-theme.json'), JSON.stringify(theme));
    }

    const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: testHome,
        USERPROFILE: testHome,
        LOCALAPPDATA: join(testHome, 'local'),
        XDG_CACHE_HOME: join(testHome, 'cache'),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}

function plain(output) {
  return output.replace(SGR, '');
}

test('renders standalone worktree and effort fields', () => {
  const base = { context_window: { used_percentage: 1 } };

  const worktree = plain(runCli({ ...base, workspace: { git_worktree: 'feature' } }));
  assert.match(worktree, /⑂feature/);

  const effort = plain(runCli({ ...base, effort: { level: 'high' } }));
  assert.match(effort, /\bhigh\b/);
});

test('accepts only documented effort levels', () => {
  const base = { context_window: { used_percentage: 1 } };
  for (const level of ['low', 'medium', 'high', 'xhigh', 'max']) {
    assert.match(plain(runCli({ ...base, effort: { level } })), new RegExp(`\\b${level}\\b`));
  }
  assert.doesNotMatch(plain(runCli({ ...base, effort: { level: 'auto' } })), /\bauto\b/);
});

test('rejects unsafe or oversized display text', () => {
  const base = { context_window: { used_percentage: 1 } };
  const unsafe = runCli({ ...base, workspace: { git_worktree: 'bad\x1b[2Jname' } });
  assert.doesNotMatch(unsafe, /\x1b\[2J/);
  assert.doesNotMatch(plain(unsafe), /bad.*name/);

  const multiline = plain(runCli({ ...base, workspace: { git_worktree: 'bad\nname' } }));
  assert.doesNotMatch(multiline, /bad|name/);

  const oversized = plain(runCli({ ...base, workspace: { git_worktree: 'x'.repeat(257) } }));
  assert.doesNotMatch(oversized, /x{257}/);

  const unsafeCwd = runCli({ ...base, cwd: 'bad\x1b[2Jpath' });
  assert.doesNotMatch(unsafeCwd, /\x1b\[2J/);
  assert.doesNotMatch(plain(unsafeCwd), /bad.*path/);

  const unsafeModel = runCli({ ...base, model: { display_name: 'bad\nmodel' } });
  assert.doesNotMatch(plain(unsafeModel), /bad|model/);
});

test('honours hide flags and exposes the new JSON fields', () => {
  const input = {
    context_window: { used_percentage: 1 },
    workspace: { git_worktree: 'feature' },
    effort: { level: 'high' },
  };

  const hidden = plain(runCli(input, ['--hide=worktree,effort']));
  assert.doesNotMatch(hidden, /feature|high/);

  const json = JSON.parse(runCli(input, ['--json']));
  assert.equal(json.git_worktree, 'feature');
  assert.equal(json.effort, 'high');
});

test('inherits branch and model colors when new colors are unset', () => {
  const output = runCli(
    {
      context_window: { used_percentage: 1 },
      workspace: { git_worktree: 'feature' },
      effort: { level: 'high' },
    },
    [],
    { colors: { branch: 'red', model: 'blue' } },
  );

  assert.match(output, /\x1b\[31m⑂feature/);
  assert.match(output, /\x1b\[34mhigh/);
});
