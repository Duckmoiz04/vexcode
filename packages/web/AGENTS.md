# packages/web

**React 19 + TypeScript + Vite SPA** — AI Code Review web dashboard.

Built from `packages/web/` and deployed into `packages/cli/src/public/` via `vite build` (output dir configured as `../cli/src/public`).

## Architecture

```
Vite Dev Server (npm run dev) → React 19 SPA → Express REST API at /api/*
              ↓
Vite Build (npm run build) → packages/cli/src/public/ (served by CLI Express server)
```

## Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `DashboardPage.tsx` | Project overview, metrics cards, severity chart, top files |
| `/issues` | `IssuesPage.tsx` | Findings list with CodeInspector detail view + AI chat assistant |
| `/onboarding` | `OnboardingPage.tsx` | Project analytics, getting started guide |

## Components

| Module | Subdir | Responsibility |
|--------|--------|----------------|
| `CodeInspector` | `code-inspector/` | Finding detail: file viewer, AI suggestion, AST context, chat |
| `CodeInspectorHeader` | `code-inspector/` | Header bar with back, open-in-IDE, chat toggle |
| `ChatPanel` | `code-inspector/` | AI assistant chat for the selected finding |
| `FileViewer` | `code-inspector/` | Syntax-highlighted source view + diff display |
| `FindingsList` | — | Filterable, searchable finding list with status badges |
| `FilterPanel` | — | Filter by severity, file, scan status, search query |
| `ScanModal` | — | Scan trigger dialog with target path and provider config |
| `SettingsDrawer` | `settings-drawer/` | AI provider config (OpenAI, Anthropic, Google, NVIDIA, 9router) |
| `ErrorBoundary` | — | React error boundary with fallback UI |
| Sidebar | `sidebar/` | Navigation sidebar with project list and history |
| Header | `header/` | Top nav bar with scan project and settings buttons |
| Dashboard | `dashboard/` | Metrics cards, severity chart, top files table |

## Conventions

- **React 19**: functional components with hooks, no class components
- **TypeScript**: strict mode via `tsconfig.app.json`; no `as any` or `@ts-ignore`
- **Vite**: fast dev server, TypeScript-only build (no Babel)
- **Vitest**: unit testing framework with `@testing-library/react`
- **Tailwind CSS v4**: utility-first styling via `@tailwindcss/vite` plugin; design tokens defined via `@theme` directive in CSS
- **lucide-react**: icon set (no img/sprites)
- **CodeMirror 6**: code viewer with syntax highlighting and merge editor
- **Error handling**: `ErrorBoundary` at top level; individual components handle their own loading/error states
- **API calls**: direct `fetch()` to `/api/*` endpoints served by the CLI's Express server

## Commands

```bash
npm install       # Install deps (Node >= 18.3)
npm run dev       # Vite dev server (HMR at localhost:5173)
npm run build     # tsc -b && vite build → ../cli/src/public/
npm test          # vitest run
npm run preview   # vite preview (serve built output)
```

## Anti-Patterns

- **Do not** add class components — this project uses React 19 functional components
- **Do not** add Redux or other state managers — React context + hooks is sufficient
- **Do not** inline SVGs — use `lucide-react` icons; add new ones via the package
- **Do not** bypass the TypeScript strict checks (`as any`, `@ts-ignore`)
- **Do not** create separate API layer — use direct `fetch()` to `/api/*` matching the CLI server's routes
