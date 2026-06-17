# packages/cli

**Node.js >= 18.3 ESM CLI tool** — `vexcode` binary + Express API server. The web dashboard is a separate React 19 + TypeScript + Vite SPA built from `packages/web/` and deployed into `src/public/`.

## Architecture

```
CLI (bin/cli.js) → Bridge (bridge.js) → Python engine subprocess
                 → Server (server.js) → REST API → Frontend (src/public/ — Vite build from packages/web/)
```

## Modules

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `bin/cli.js` | 299 | CLI entry; commands: `analyze`, `serve`/`ui`, `help` |
| `src/server.js` | 604 | Express server; 10+ endpoints (config, scan, reports, apply, chat) |
| `src/bridge.js` | 148 | Python process spawner; JSON stdin/stdout bridge |
| `src/index.js` | 4 | Library placeholder (`greet()` export) |
| `src/public/` | Vite build | React 19 + TypeScript + Vite dashboard (source in `packages/web/`) |

Test files (Vitest): `src/__tests__/{cli,server,bridge}.test.js` + `e2e_verify.js` (manual).

## Commands

```bash
npm install       # Install deps
npm test          # vitest run (3 suites)
node bin/cli.js   # Run directly (also: vexcode via npm link)
```

## Conventions

- **ESM only**: `import`/`export`, no `require()`. Use `fileURLToPath(import.meta.url)` for `__dirname`
- **No TypeScript**: plain JS, no build step
- **Path safety**: all file reads must pass `isPathSafe()` (case-insensitive prefix check)
- **Python bridge**: spawns `engine/.venv/Scripts/python.exe` (Win) or `.venv/bin/python` (Unix)
- **Reports**: stored at `~/.vexcode/reports/{projectName}/`
- **AI providers**: multi-provider (OpenAI, Anthropic, Google, 9router); config keys follow `{PROVIDER}_API_KEY`, `{PROVIDER}_BASE_URL`, `{PROVIDER}_MODEL`
- **Error handling**: try/catch with Express error middleware, structured JSON error responses
- **Frontend**: vanilla JS (no framework), custom CSS with dark theme

## Anti-Patterns

- **Do not** add TypeScript without explicit request (project is pure JS)
- **Do not** switch from Vitest (established test runner)
- **Never** bypass `isPathSafe()` — path traversal is the primary security boundary
- **Do not** hardcode Python paths — respect the cross-platform `.venv` convention
