# claude-usage-line

[![npm](https://img.shields.io/npm/v/claude-usage-line)](https://npmjs.com/package/claude-usage-line)
[![license](https://img.shields.io/npm/l/claude-usage-line)](LICENSE)
[![node](https://img.shields.io/node/v/claude-usage-line)](package.json)

<img width="663" height="141" alt="Screenshot 2026-03-29 at 20 19 21" src="https://github.com/user-attachments/assets/d78c061c-c263-4252-aed9-f1c4252cf94d" />

Cross-platform Claude Code statusline — session context, 5-hour & 7-day rate limits, git branch, diff stats, cost, and duration. Zero runtime dependencies, no `jq` required.

**Full output** (when Claude Code sends extended data):

```
~/dev/project → main • +123 -45 • $0.50 • ⏱ 12m
Opus 4.6 • Cx █████░░░ 62% • 5h ████░░░░ 48% ⟳3h28m • 7d █████░░░ 63% ⟳22h30m
```

**Minimal output** (backward compatible — only `context_window` provided):

```
Cx █████░░░ 62% • 5h ████░░░░ 48% ⟳3h28m • 7d █████░░░ 63% ⟳22h30m
```

## Prerequisites

- Node.js ≥ 18
- Claude Code with statusline support
- **OAuth login** — required for rate limit data (5h / 7d bars). Session bar works without it.

## Quick Start

```bash
npx claude-usage-line setup
```

With a theme:

```bash
npx claude-usage-line setup --theme dark-contrast
```

Or manually add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx claude-usage-line"
  }
}
```

With a theme and custom bar style:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx claude-usage-line --theme dark-contrast --style dot"
  }
}
```

Restart Claude Code and the statusline appears. Setup also copies an editable theme file to `~/.claude/statusline-theme.json`.

## How It Works

```
Claude Code                      claude-usage-line
    │                                   │
    │  stdin: {                         │
    │    "context_window": {...},        │
    │    "cwd": "/path",                │
    │    "model": {"display_name":".."},│
    │    "cost": {...}                  │
    │  }                                │
    ├──────────────────────────────────▶│
    │                                   ├─▶ Load theme (--theme + user file)
    │                                   ├─▶ Detect git branch (if cwd given)
    │                                   ├─▶ Read cached rate limits (60s TTL)
    │                                   ├─▶ If stale: background OAuth fetch
    │                                   │
    │  stdout: ANSI statusline          │
    │◀──────────────────────────────────┤
```

The tool accepts these fields via stdin JSON:

| Field | Required | Description |
|-------|----------|-------------|
| `context_window.used_percentage` | Yes | Session context usage % |
| `cwd` | No | Working directory → enables git branch detection |
| `model.display_name` | No | Model name shown on line 2 |
| `cost.total_lines_added` | No | Lines added (green) |
| `cost.total_lines_removed` | No | Lines removed (red) |
| `cost.total_cost_usd` | No | Session cost in USD |
| `cost.total_duration_ms` | No | Session duration |

When `cwd` or `model` is present → 2-line output. Otherwise → single-line (backward compatible).

Rate limit data comes from `https://api.anthropic.com/api/oauth/usage` via OAuth token. API key auth does not provide rate limit visibility — bars show `0%` and `--`.

## Bar Styles

| Style | Preview | Width |
|-------|---------|-------|
| `classic` (default) | `█████░░░` | 8 |
| `dot` | `●●●●●○○○` | 8 |
| `braille` | `⣿⣿⣿⣿⣿⣀⣀⣀` | 8 |
| `block` | `▰▰▰▰▰▰▱▱▱▱` | 10 |
| `ascii` | `#####-----` | 10 |
| `square` | `▪▪▪▪▪·····` | 10 |
| `pipe` | `┃┃┃┃┃╌╌╌` | 8 |

## Themes

Themes bundle colors, bar style, and hidden fields into a single file. Use `--theme` to select a shipped theme, or edit `~/.claude/statusline-theme.json` for full customization.

### Shipped themes

| Theme | Description |
|-------|-------------|
| `default` | Standard 16-color theme — works in any terminal |
| `dark-contrast` | Truecolor, dark — high-contrast palette with wider bars |
| `dark-muted` | Truecolor, dark — split-complementary with rose identity, cool grey structure, warm amber/coral status |
| `dark-vivid` | Truecolor, dark — triadic violet/orange/cyan, high saturation, bold and energetic |
| `dark-vintage` | Truecolor, dark — monochromatic warm, all colours between gold and burnt sienna |
| `dark-rainbow` | Truecolor, dark — every element its own hue, maximum colour variety at consistent brightness |
| `light-muted` | Truecolor, light — same muted palette darkened for white backgrounds |
| `light-vivid` | Truecolor, light — same triadic energy adapted for light backgrounds |
| `light-vintage` | Truecolor, light — warm monochromatic with neutral grey structure for contrast |
| `light-rainbow` | Truecolor, light — full spectrum, high saturation tuned for readability on white |

### Using themes

Select a shipped theme:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx claude-usage-line --theme dark-contrast"
  }
}
```

Or set it up automatically:

```bash
npx claude-usage-line setup --theme dark-contrast
```

### User theme file

`~/.claude/statusline-theme.json` is your personal override layer. It's created on first `setup` (a copy of your chosen theme) and always takes precedence over shipped themes.

Edit any key to customize:

```json
{
  "style": {
    "filled": "▰",
    "empty": "▱",
    "width": 10,
    "separator": "•",
    "resetIcon": "⟳"
  },
  "colors": {
    "context": "magenta",
    "five_hour": "cyan",
    "seven_day": "green",
    "cwd": "blue",
    "branch": "green",
    "model": "magenta",
    "cost": "yellow",
    "diff_add": "green",
    "diff_remove": "red",
    "duration": "blue",
    "dim": "bright_black",
    "warn": "yellow",
    "danger": "red"
  },
  "hide": ["cost", "duration"]
}
```

### Color formats

| Format | Example | Notes |
|--------|---------|-------|
| Named | `"red"`, `"bright_cyan"` | 16 standard terminal colors |
| 256-color | `"256:208"` | xterm-256 palette index |
| RGB | `"rgb:180,140,255"` | Truecolor — requires terminal support |
| Raw ANSI | `"\x1b[38;5;208m"` | Escape sequences (also `\e`, `\033`) |

### Color keys

`context`, `five_hour`, `seven_day`, `cwd`, `branch`, `model`, `cost`, `diff_add`, `diff_remove`, `duration`, `five_hour_reset`, `seven_day_reset`, `dim`, `warn`, `danger`

Each bar changes color at thresholds: **< 50%** uses the base color, **≥ 50%** uses `warn`, **≥ 80%** uses `danger`.

### Precedence

```
styles.ts defaults → --theme file → ~/.claude/statusline-theme.json → --style flag → --sep flag
```

- `--theme` sets both style and colors from a shipped preset
- User theme file (`~/.claude/statusline-theme.json`) overrides on top — user always wins
- `--style` overrides bar characters/separator (but not colors) when explicitly passed
- `--sep` overrides the separator character

## JSON Output

```bash
echo '{"context_window":{"used_percentage":62}}' | npx claude-usage-line --json
```

```json
{
  "model": null,
  "cwd": null,
  "git_branch": null,
  "session": { "utilization_pct": 62, "resets_at": null, "remaining": "--" },
  "five_hour": { "utilization_pct": 48, "resets_at": "2026-02-26T14:00:00Z", "remaining": "3h28m" },
  "seven_day": { "utilization_pct": 63, "resets_at": "2026-02-28T00:00:00Z", "remaining": "22h30m" },
  "diff": { "added": 0, "removed": 0 },
  "cost_usd": null,
  "duration_min": null
}
```

## CLI Reference

```
Usage: claude-usage-line [options]
       claude-usage-line setup [--theme <name>] [--force]

Options:
  --theme <name>  Use a shipped theme (e.g. dark-contrast)
  --style <name>  Bar style (classic, dot, braille, block, ascii, square, pipe)
  --hide <fields> Hide fields (comma-separated): cost,diff,duration,model,cwd,branch
  --sep <name>    Separator: bullet (default), pipe, dot, diamond, arrow, star
  --json          Output JSON
  --help          Show help
  --version       Show version

Setup options:
  --theme <name>  Include --theme in the statusline command and copy that theme file
  --force         Overwrite existing settings and theme file
```

### Hiding Fields

Hide parts of the output using `--hide` or the `hide` key in your theme file:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx claude-usage-line --hide cost,duration"
  }
}
```

Or in `~/.claude/statusline-theme.json`:

```json
{
  "hide": ["cost", "duration"]
}
```

Theme and CLI hide fields are combined (union of both). Available fields: `cost`, `diff`, `duration`, `model`, `cwd`, `branch`

## Credential Resolution

OAuth token lookup order:

1. `CLAUDE_CODE_OAUTH_TOKEN` env var (consumed once, deleted from env)
2. macOS Keychain (`security find-generic-password`)
3. Linux `secret-tool` (requires D-Bus session — skipped in headless/Docker)
4. Windows Credential Manager (PasswordVault API via PowerShell)
5. `~/.claude/.credentials.json` (fallback)

## Development

```bash
npm run build
echo '{"context_window":{"used_percentage":62}}' | node dist/cli.js
echo '{"cwd":"/tmp","model":{"display_name":"Opus 4.6"},"context_window":{"used_percentage":85},"cost":{"total_lines_added":42,"total_lines_removed":10,"total_cost_usd":1.23,"total_duration_ms":3720000}}' | node dist/cli.js
echo '{"context_window":{"used_percentage":55}}' | node dist/cli.js --theme dark-contrast
echo '{"context_window":{"used_percentage":55}}' | node dist/cli.js --theme dark-contrast --style ascii
```

## License

MIT
