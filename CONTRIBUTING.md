# Contributing to claude-usage-line

Forked from [canack/claude-usage-line](https://github.com/canack/claude-usage-line). Props to Engin Acikgoz for the security-first foundation.

## Architecture

Pure stdin→stdout transformation. Claude Code pipes JSON on each statusline update, the script parses it, renders ANSI output, and exits. No network calls, no background processes. Rate limit data is cached to disk so new sessions can display the last known values before fresh data arrives.

```
Claude Code → stdin JSON → parse & validate → render → stdout ANSI
                                ↕
                        rate limit cache
```

### Source structure

| File | Responsibility |
|------|---------------|
| `cli.ts` | Entry point, arg parsing, stdin reading, input validation |
| `statusline.ts` | Rendering logic (ANSI and JSON output) |
| `bar.ts` | Progress bar rendering |
| `ansi.ts` | ANSI color functions with theme support |
| `styles.ts` | Bar style definitions |
| `types.ts` | TypeScript interfaces and shared validators |
| `cache.ts` | Rate limit cache (read/write/validate/expire) |
| `platform.ts` | OS-agnostic path resolution, atomic file writes |
| `theme.ts` | Theme loading, merging, color resolution |
| `git.ts` | Git branch detection via `execFileSync` |
| `time.ts` | Reset time formatting |
| `setup.ts` | One-time settings.json configuration |

## Input Contract

All data comes from Claude Code's stdin JSON. The full schema is documented at [code.claude.com/docs/en/statusline](https://code.claude.com/docs/en/statusline). Key fields this tool consumes:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `context_window.used_percentage` | number | Yes | Session context usage (0-100) |
| `rate_limits.five_hour.used_percentage` | number | No | 5h window (0-100). Pro/Max only. |
| `rate_limits.five_hour.resets_at` | number | No | Unix epoch seconds |
| `rate_limits.seven_day.used_percentage` | number | No | 7d window (0-100). Pro/Max only. |
| `rate_limits.seven_day.resets_at` | number | No | Unix epoch seconds |
| `cwd` | string | No | Working directory |
| `model.display_name` | string | No | Current model name |
| `cost.total_cost_usd` | number | No | Session cost |
| `cost.total_duration_ms` | number | No | Session duration |
| `cost.total_lines_added` | number | No | Lines added |
| `cost.total_lines_removed` | number | No | Lines removed |

When adding a new field: add the type to `types.ts` (`StatuslineInput` interface), add validation to `validateInput()` in `cli.ts`, then consume it in `statusline.ts`. All three steps are required — the type alone is not sufficient.

## Security Principles

This tool was chosen specifically for its security posture. These principles are non-negotiable.

### 1. Zero runtime dependencies

The entire tool compiles to a single `dist/cli.js` via tsup. No `node_modules` at runtime. Do not add runtime dependencies.

### 2. Validate all external input at the boundary

Stdin is untrusted. Every field must be validated with `typeof` checks and `Number.isFinite()` guards before use. Invalid or missing fields fall back to safe defaults. `validateInput()` in `cli.ts` is the single validation boundary — nothing downstream should trust raw input.

### 3. No shell invocation

All external commands must use `execFileSync` with array arguments, never `exec` or `execSync` with string interpolation. This eliminates command injection regardless of input content.

### 4. Safe file operations

File writes must use:
- Atomic rename pattern (write to `.tmp`, then `renameSync`)
- `O_CREAT | O_EXCL | O_NOFOLLOW` flags to prevent symlink attacks
- `0o600` file permissions, `0o700` directory permissions

### 5. No network calls, no credential access

All data comes from Claude Code's stdin JSON. Do not add network calls or credential access. If upstream data changes, the fix belongs in the stdin parsing, not in a separate API call. The only filesystem state is the rate limit cache, which follows the safe file operations in section 4.

### 6. Graceful degradation

The tool must never crash on bad input. Every failure path must produce a valid (if empty) statusline. A crashing statusline script degrades the Claude Code user experience.

## Development

```bash
# Install dev dependencies
npm install

# Build (tsup bundles to dist/cli.js)
npm run build

# Test with synthetic input
echo '{"context_window":{"used_percentage":42},"rate_limits":{"five_hour":{"used_percentage":94,"resets_at":1775460000},"seven_day":{"used_percentage":17,"resets_at":1775900000}}}' | node dist/cli.js

# Test without rate limits (graceful degradation)
echo '{"context_window":{"used_percentage":10}}' | node dist/cli.js

# Test JSON output
echo '{"context_window":{"used_percentage":42}}' | node dist/cli.js --json

# Test with theme and style
echo '{"context_window":{"used_percentage":55}}' | node dist/cli.js --theme dark-contrast --style dot
```

Build must pass clean before submitting a PR.

## Versioning

Semver. The user-facing contract is the CLI interface (flags, output format), not the internal code:

- **Patch** for bug fixes
- **Minor** for additive changes, new stdin fields, internal rewrites
- **Major** only if the CLI interface breaks (flag changes, output format changes)

## Code Standards

- **No runtime dependencies.** Dev dependencies only.
- **No unnecessary abstractions.** Three similar lines > a premature helper.
- **No comments explaining what.** Only comment non-obvious _why_ (hidden constraints, workarounds).
- **TypeScript strict mode.** All types explicit at module boundaries.
- **Build must pass clean** before commit (`npm run build`).
