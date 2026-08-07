import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// ---- setup command ----

// The command setup writes for the binary under test.
const OWN_COMMAND = `"${process.execPath}" "${CLI_PATH}"`;

function runSetup(args = [], seedSettings = undefined) {
  const testHome = mkdtempSync(join(tmpdir(), 'claude-usage-line-'));
  try {
    const claudeDir = join(testHome, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    const settingsPath = join(claudeDir, 'settings.json');
    if (seedSettings !== undefined) {
      writeFileSync(
        settingsPath,
        typeof seedSettings === 'string' ? seedSettings : JSON.stringify(seedSettings)
      );
    }
    const result = spawnSync(process.execPath, [CLI_PATH, 'setup', ...args], {
      encoding: 'utf8',
      env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
    });
    let raw = null;
    try {
      raw = readFileSync(settingsPath, 'utf8');
    } catch {}
    let settings = null;
    try {
      settings = JSON.parse(raw);
    } catch {}
    return { result, settings, raw };
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}

function seeded(command) {
  return { statusLine: { type: 'command', command }, otherSetting: true };
}

test('setup: fresh install writes a direct node command', () => {
  const { result, settings } = runSetup();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, OWN_COMMAND);
});

test('setup: migrates legacy npx command without --force, preserving flags', () => {
  const { result, settings } = runSetup(
    [],
    seeded('npx @robmorris/claude-usage-line --hide cost')
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, `${OWN_COMMAND} --hide cost`);
  assert.equal(settings.otherSetting, true);
});

test('setup: npx package name must match on a word boundary', () => {
  const cmd = 'npx @robmorris/claude-usage-line-extra';
  const { result, settings } = runSetup([], seeded(cmd));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, cmd);
  assert.match(result.stdout, /--force/);
});

test('setup: migrates stale absolute-path command from another install', () => {
  const stale =
    '"/old/versions/node/v20.0.0/bin/node" ' +
    '"/old/lib/node_modules/@robmorris/claude-usage-line/dist/cli.js" --theme dark-vivid';
  const { result, settings } = runSetup([], seeded(stale));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, `${OWN_COMMAND} --theme dark-vivid`);
});

test('setup: recognises the documented bare bin form', () => {
  const { result, settings } = runSetup([], seeded('claude-usage-line --hide cost'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, `${OWN_COMMAND} --hide cost`);
});

test('setup: refuses foreign commands without --force', () => {
  const { result, settings } = runSetup([], seeded('my-statusline --json'));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, 'my-statusline --json');
  assert.match(result.stdout, /--force/);
});

test('setup: does not claim commands that merely mention the cli.js path', () => {
  const cmd = 'other-thing --arg /x/claude-usage-line/dist/cli.js';
  const { result, settings } = runSetup([], seeded(cmd));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(settings.statusLine.command, cmd);
  assert.match(result.stdout, /--force/);
});

test('setup: --theme replaces carried-over theme flag but keeps other flags', () => {
  const { result, settings } = runSetup(
    ['--theme', 'dark-contrast'],
    seeded('npx @robmorris/claude-usage-line --theme dark-vivid --hide cost')
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    settings.statusLine.command,
    `${OWN_COMMAND} --hide cost --theme dark-contrast`
  );
});
