# CodeMirror 6 & @codemirror/merge — Project Wiki

> **Scope:** This wiki covers CodeMirror 6 fundamentals and the `@codemirror/merge` package,
> with deep focus on `unifiedMergeView` as used in the Vexcode project.
> Last updated for `@codemirror/merge@^6.12.1`.
> Last revised: 2026-06-15 — added CSS-specificity override pattern, default-button styling,
> `position: relative` bug, smooth-scroll workaround, inline-right button placement,
> `Chunk.precise` warning hook, height-chain requirement, snippet sizing, and global
> stylesheet collision warning.

---

## Table of Contents

1. [CodeMirror 6 Overview](#1-codemirror-6-overview)
2. [@codemirror/merge Package](#2-codemirrormerge-package)
3. [unifiedMergeView — Deep Dive](#3-unifiedmergeview--deep-dive)
4. [CSS Classes & Theming Reference](#4-css-classes--theming-reference)
5. [CSS Specificity & Override Patterns](#5-css-specificity--override-patterns)
6. [API Functions](#6-api-functions)
7. [Chunk Data Structure](#7-chunk-data-structure)
8. [Diffing Utilities](#8-diffing-utilities)
9. [Project Implementation](#9-project-implementation)
10. [Custom mergeControls — Implementation Reference](#10-custom-mergecontrols--implementation-reference)
11. [Smooth Scroll Workaround](#11-smooth-scroll-workaround)
12. [Known Caveats & Gotchas](#12-known-caveats--gotchas)
13. [Version History](#13-version-history)

---

## 1. CodeMirror 6 Overview

CodeMirror 6 is a modular, extensible code editor framework built on an immutable state model.

### Core Architecture

| Package | Role |
|---|---|
| `@codemirror/state` | Immutable `EditorState` — document, selection, state fields |
| `@codemirror/view` | `EditorView` — DOM rendering, `Extension`, `Decoration`, `Widget` |
| `@codemirror/commands` | Built-in commands (undo, redo, default keymaps) |
| `@codemirror/language` | Language support, syntax tree, indentation |
| `@codemirror/autocomplete` | Autocompletion framework |
| `@codemirror/lint` | Linting framework |

### Minimal Editor Example

```ts
import { EditorView, basicSetup } from "codemirror";

const view = new EditorView({
  doc: "hello world",
  extensions: [basicSetup],
  parent: document.body
});
```

### Key Concepts

- **EditorState** — immutable; updated via transactions (`state.update(...)`)
- **EditorView** — the DOM component; one view per state
- **Extension** — composable units of functionality (keymaps, themes, decorations, state fields)
- **Compartment** — a slot for swappable extensions at runtime (e.g., theme switching)
- **Decoration** — visual overlays on text (`line`, `mark`, `widget`, `replace`)
- **StateField** — custom state stored alongside the document
- **StateEffect** — signals to state fields to update their values

---

## 2. @codemirror/merge Package

Two merge modes:

### Side-by-Side (`MergeView`)

Two editors displayed side-by-side with aligned changed lines.

```ts
import { MergeView } from "@codemirror/merge";

const view = new MergeView({
  a: { doc: originalCode, extensions: basicSetup },
  b: { doc: modifiedCode, extensions: [basicSetup, EditorState.readOnly.of(true)] },
  parent: document.body
});
```

**Use when:** Comparing two complete file versions, interactive merge conflict resolution.

### Unified (`unifiedMergeView`)

A single editor showing the modified document, with deleted content displayed as inline widgets.

```ts
import { EditorView, basicSetup } from "codemirror";
import { unifiedMergeView } from "@codemirror/merge";

const view = new EditorView({
  parent: document.body,
  doc: modifiedCode,          // "B" document (editor content)
  extensions: [
    basicSetup,
    unifiedMergeView({
      original: originalCode   // "A" document (compared against)
    })
  ]
});
```

**Use when:** Showing AI-suggested fixes, code review diffs, focused change visualization.
**This is what our project uses.**

---

## 3. unifiedMergeView — Deep Dive

### Configuration Options

```ts
unifiedMergeView(config: UnifiedMergeConfig)
  → (Extension | StateField<DecorationSet>)[]
```

| Option | Type | Default | Description |
|---|---|---|---|
| `original` | `Text \| string` | **required** | The original document to compare against |
| `highlightChanges` | `boolean` | `true` | Mark inserted/deleted text within changed chunks |
| `gutter` | `boolean` | `true` | Show gutter markers next to changed lines |
| `syntaxHighlightDeletions` | `boolean` | `true` | Syntax-highlight deleted lines using editor's language |
| `syntaxHighlightDeletionsMaxLength` | `number` | `3000` | Skip syntax highlight for deletions larger than this |
| `allowInlineDiffs` | `boolean` | `false` | Show inline word-level changes for chunks with only inline modifications |
| `mergeControls` | `boolean \| Function` | `true` | Show accept/reject buttons. Pass function for custom rendering |
| `collapseUnchanged` | `{margin?, minSize?}` | — | Collapse unchanged stretches (margin=3, minSize=4) |
| `diffConfig` | `DiffConfig` | `{scanLimit: 500}` | Options for the diff algorithm |

### How It Works Internally

1. The extension adds a **StateField** that computes the diff between document B (editor content) and document A (original).
2. **Changed lines** get `Decoration.line` (`cm-changedLine`) and `Decoration.mark` (`cm-changedText`) decorations.
3. **Deleted content** (lines in A not in B) is rendered as **block widgets** (`<div class="cm-deletedChunk">`) inserted above the corresponding position.
4. **Collapsed unchanged sections** are rendered as `<div class="cm-collapsedLines">` widgets showing "N unchanged lines".
5. When `allowInlineDiffs: true`, chunks with only inline changes display deletions (`<del class="cm-deletedLine">`) and insertions (`<ins class="cm-insertedLine">`) on the same line.

### mergeControls — Custom Button Rendering (v6.11.0+)

```ts
unifiedMergeView({
  original: originalCode,
  mergeControls: (type, action) => {
    const btn = document.createElement('button');
    btn.className = `custom-${type}-btn`;
    btn.textContent = type === 'accept' ? '✓ Keep' : '✗ Revert';
    btn.addEventListener('click', action);
    return btn;
  }
})
```

The function receives:
- `type`: `"accept"` | `"reject"`
- `action`: `(e: MouseEvent) => void`

Buttons render inside `cm-chunkButtons` within each `cm-deletedChunk` widget.

---

## 4. CSS Classes & Theming Reference

### Complete Class Map

| CSS Class | Element | Applied When |
|---|---|---|
| `cm-merge-a` | `.cm-editor` | Editor is side A (not used in unified view) |
| `cm-merge-b` | `.cm-editor` | Editor is side B (unified view) |
| `cm-changedLine` | `.cm-line` | Line has changes (background tint) |
| `cm-changedText` | `<span>` | Word-level changed text (bottom gradient underline) |
| `cm-deletedLine` | `<del>` | Deleted text within inline diff |
| `cm-deletedText` | `<span>` | Deleted word-level text (red background) |
| `cm-insertedLine` | `<ins>` | Inserted text within inline diff |
| `cm-inlineChangedLine` | `.cm-line` | Line with inline-only changes |
| `cm-deletedChunk` | `<div>` widget | Block widget showing deleted lines from A |
| `cm-chunkButtons` | `<div>` | Container for accept/reject buttons |
| `cm-changedLineGutter` | `.cm-gutterElement` | Gutter marker for changed lines |
| `cm-inlineChangedLineGutter` | `.cm-gutterElement` | Gutter marker for inline-changed lines |
| `cm-collapsedLines` | `<div>` widget | Collapsed unchanged section |

### Default Colors (Base Theme)

```css
/* Side A (original) — warm tones */
.cm-merge-a .cm-changedLine     { background-color: rgba(160, 128, 100, .08) }
.cm-merge-a .cm-changedText     { background: linear-gradient(#ee443366, ...) bottom/100% 2px no-repeat }  /* light */
.cm-merge-a .cm-changedText     { background: linear-gradient(#ffaa9966, ...) bottom/100% 2px no-repeat }  /* dark */

/* Side B (modified) — green tones */
.cm-merge-b .cm-changedLine     { background-color: rgba(100, 160, 128, .08) }
.cm-merge-b .cm-changedText     { background: linear-gradient(#22bb22aa, ...) bottom/100% 2px no-repeat }  /* light */
.cm-merge-b .cm-changedText     { background: linear-gradient(#88ff88aa, ...) bottom/100% 2px no-repeat }  /* dark */
.cm-merge-b .cm-deletedText     { background: #ff000033 }

/* Inline changes — same green */
.cm-inlineChangedLine           { background-color: rgba(100, 160, 128, .08) }

/* Deleted chunk widget */
.cm-deletedChunk                { padding-left: 6px }
.cm-chunkButtons                { position: absolute; inset-inline-end: 5px }

/* Gutter markers */
.cm-merge-a .cm-changedLineGutter { background: #d75 /* light */ / #f97 /* dark */ }
.cm-merge-b .cm-changedLineGutter { background: #2b2 /* light */ / #8f8 /* dark */ }
.cm-inlineChangedLineGutter       { background: #75d /* purple */ }

/* Collapsed sections */
.cm-collapsedLines /* light */ { color: #444; background: linear-gradient(..., #f3f3f3, ...) }
.cm-collapsedLines /* dark  */ { color: #ddd; background: linear-gradient(..., #222, ...) }
```

### Default Accept/Reject Buttons (Theme)

```css
/* Inside the same baseTheme — affects EVERY button in .cm-deletedChunk */
.cm-deletedChunk button {
  border: none;
  cursor: pointer;
  color: white;
  margin: 0 2px;
  border-radius: 3px;
}
.cm-deletedChunk button[name=accept] { background: #2a2 }   /* dark green */
.cm-deletedChunk button[name=reject] { background: #d43 }   /* dark red   */
```

The default `mergeControls: true` renders plain text buttons (`Accept` / `Reject`) named
`name="accept"` and `name="reject"`. They are tiny (~16px tall) and inherit the `position: absolute;
right: 5px` of `.cm-chunkButtons` — which is the **buggy default** described below.

### ⚠️ Known Bug: `.cm-deletedChunk` is missing `position: relative`

The default base theme defines `.cm-chunkButtons { position: absolute; inset-inline-end: 5px }`
but **does not set `position: relative` on `.cm-deletedChunk`**. This means the absolutely-positioned
button container anchors to the **nearest positioned ancestor** (the editor itself), not the chunk.

Symptom: buttons render at `top: 0; right: 5px` of the **editor viewport** instead of next to the
deleted chunk. Users see them only when scrolling so the chunk is at the very top of the editor.

**Workaround** (required in any project that customizes the merge view):

```ts
const fix = EditorView.theme({
  '& .cm-deletedChunk': {
    position: 'relative !important',   // ← CRITICAL — without this, the
                                       //   absolutely-positioned .cm-chunkButtons
                                       //   floats to the top of the editor
  },
})
```

This bug is also confirmed by reading the package source at
`github.com/codemirror/merge/blob/main/src/theme.ts` (lines 65–73).

### Height Override

The base theme forces `.cm-scroller` to `height: auto !important`. If your container uses fixed height or flexbox, override:

```css
.diff-viewer .cm-editor {
  height: 100%;
}
.diff-viewer .cm-editor .cm-scroller {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
}
```

---

## 5. CSS Specificity & Override Patterns

The merge package injects its CSS via `style-mod` (CSS-in-JS) with **generated class names**
prefixed to every rule. The official guidance (from `codemirror.net/examples/styling/`):

> "The CSS rules injected by the library will be prefixed with an extra generated class name,
> so they only apply when explicitly enabled. That means that if you need to override them,
> you must take care to make your own rules **at least as specific** as the injected rules,
> for example by **prefixing them with `.cm-editor`**. They only need to be as specific,
> not more specific, because the injected rules are **placed before any other style sheets,
> and will thus have a lower default precedence** than your rules."

### Three reliable ways to override `.cm-merge-*` styles

```ts
// 1. PREFIX WITH A REAL CLASS (recommended for app-level overrides)
import { EditorView } from '@codemirror/view'

const myTheme = EditorView.theme({
  // & expands to ".generated-class"; the explicit prefix raises specificity
  // to 3 classes — same as the default `.cm-merge-b .cm-deletedChunk .cm-chunkButtons`
  // but loaded LATER in the cascade, so it wins.
  '& .cm-deletedChunk .cm-chunkButtons': {
    position: 'absolute !important',
    insetInlineEnd: '6px !important',
    top: '100% !important',
  },
})

// 2. USE BOTH `&` AND A REAL CLASS FOR EXTRA SAFETY
const saferTheme = EditorView.theme({
  '.cm-editor .cm-deletedChunk .cm-chunkButtons': {
    position: 'absolute !important',
  },
})

// 3. INLINE STYLES (bulletproof — always win)
btn.style.position = 'absolute'
btn.style.top = '100%'
```

### Specificity cheat sheet

| Selector pattern | Classes | Specificity |
|---|---|---|
| `.cm-chunkButtons` | 1 | 0,1,0 |
| `.cm-merge-b .cm-chunkButtons` | 2 | 0,2,0 |
| `.cm-merge-b .cm-deletedChunk .cm-chunkButtons` | 3 | 0,3,0 |
| `.cm-editor .cm-merge-b .cm-deletedChunk .cm-chunkButtons` | 4 | 0,4,0 |
| `.cm-editor .cm-deletedChunk .cm-chunkButtons` (our `& .`) | 3 | 0,3,0 |

Same specificity → later-in-cascade wins. Bump with `!important` if you need bulletproof override.

### What `&` expands to in `style-mod`

`EditorView.theme({ '& .cm-foo': {...} })` compiles to a rule like:

```css
.genXXXXX .cm-foo { ... }
```

`EditorView.theme({ '&.cm-bar .cm-foo': {...} })` compiles to:

```css
.genXXXXX.cm-bar .cm-foo { ... }
```

The generated class is added to the editor's outermost `.cm-editor` element, so `&` always
refers to "the editor instance".

---

## 6. API Functions

### Chunk Actions

| Function | Signature | Description |
|---|---|---|
| `acceptChunk` | `(view: EditorView, pos?: number) => boolean` | Accept chunk at `pos` (or cursor). Chunk is no longer highlighted |
| `rejectChunk` | `(view: EditorView, pos?: number) => boolean` | Reject chunk. Reverts to original content |
| `getOriginalDoc` | `(state: EditorState) => Text` | Get the original document from state |
| `originalDocChangeEffect` | `(state: EditorState, changes: ChangeSet) => StateEffect` | Update the original document being compared |
| `uncollapseUnchanged` | `StateEffectType<number>` | Expand collapsed section at position |
| `updateOriginalDoc` | `StateEffectType<{doc: Text, changes: ChangeSet}>` | Lower-level effect exposed by `originalDocChangeEffect` |

### Navigation

| Function | Type | Description |
|---|---|---|
| `goToNextChunk` | `StateCommand` | Move selection to next changed chunk |
| `goToPreviousChunk` | `StateCommand` | Move selection to previous changed chunk |

**`StateCommand` signature:** `({state: EditorState, dispatch: (tr: Transaction) => void}) => boolean`

The previous wiki said you can call `goToNextChunk(view)` directly. **This is WRONG** — it
silently does nothing because `state` ends up `undefined`. The actual contract is:

```ts
// ✅ CORRECT — pass state + dispatch
const moved = goToNextChunk({
  state: view.state,
  dispatch: view.dispatch.bind(view),
})

// ✅ CORRECT — CodeMirror calls them with the right shape when used as keymap.run
keymap.of([
  { key: 'Alt-n', run: goToNextChunk },
  { key: 'Alt-p', run: goToPreviousChunk },
])

// ❌ WRONG — these compile but silently do nothing
goToNextChunk(view);
goToNextChunk(view.state);
```

Returns `true` if a chunk was found and selection moved, `false` if there are no chunks or
the cursor was at the last chunk and the call was a no-op (no wrap-around).

### Chunk Retrieval

```ts
getChunks(state: EditorState) → {
  chunks: readonly Chunk[];
  side: "a" | "b" | null;  // null for unified view
} | null  // null if not initialized yet
```

**Important:** Returns an **object**, not a plain array. Access via `result.chunks`.

In a `unifiedMergeView`, `side` is always `"b"` because the editor IS the "b" side (it owns
the modified document; the original is in the StateField). The chunks contain positions in
both the editor's own document (`fromB`/`toB`) and the original (`fromA`/`toA`).

### Programmatic Document Update

The `originalDocChangeEffect` lets you swap the "original" document at runtime, causing the
merge view to re-diff immediately:

```ts
import { originalDocChangeEffect, getOriginalDoc } from '@codemirror/merge'
import { ChangeSet } from '@codemirror/state'

// In a transactionExtender or anywhere you have a state:
const newOriginal = Text.of(['updated original...'])
const currentOriginal = getOriginalDoc(state)
const changes = ChangeSet.of(
  { from: 0, to: currentOriginal.length, insert: newOriginal },
  currentOriginal.length
)
view.dispatch({
  effects: originalDocChangeEffect(state, changes),
})
```

**Caveat:** dispatching from a `transactionExtender` may not re-render until the next keystroke.
This is a known community-reported issue. Dispatch from a button click or effect for reliable updates.

---

## 7. Chunk Data Structure

### Chunk Class

| Property | Type | Description |
|---|---|---|
| `fromA` | `number` | Start of chunk in document A (original) |
| `toA` | `number` | End of chunk in document A |
| `fromB` | `number` | Start of chunk in document B (modified) |
| `toB` | `number` | End of chunk in document B |
| `endA` | `number` | Safe end position (guaranteed valid doc position) |
| `endB` | `number` | Safe end position for B |
| `changes` | `readonly Change[]` | Individual changes within chunk (relative to chunk start) |
| `precise` | `boolean` | `false` when diff fell back to imprecise mode |

**Static methods:**
- `Chunk.build(a, b, conf?)` — compute chunks for two documents
- `Chunk.updateA(chunks, a, b, changes, conf?)` — update for changes in A
- `Chunk.updateB(chunks, a, b, changes, conf?)` — update for changes in B

### Change Class

| Property | Type | Description |
|---|---|---|
| `fromA` | `number` | Start in document A |
| `toA` | `number` | End in document A (= fromA for insertions) |
| `fromB` | `number` | Start in document B |
| `toB` | `number` | End in document B (= fromB for deletions) |

---

## 8. Diffing Utilities

| Function | Description |
|---|---|
| `diff(a, b, config?)` | Compute difference between two strings |
| `presentableDiff(a, b, config?)` | Clean diff with word-boundary alignment |

### DiffConfig

| Option | Type | Default | Description |
|---|---|---|---|
| `scanLimit` | `number` | 500 | Depth limit for precise diff (avoids quadratic time) |
| `timeout` | `number` | — | Abort after N milliseconds, fall back to imprecise |
| `override` | `(a, b) => Change[]` | — | Custom diff algorithm (v6.12.0+) |

---

## 9. Project Implementation

### File Structure

```
packages/web/src/
  components/code-inspector/
    DiffViewer.tsx              ← unifiedMergeView component
    DiffViewer.mergeControls.test.ts ← unit tests for custom button factory
    CodeMirrorEditor.tsx        ← Main code viewer (no diff)
    CodeMirrorEditor.test.tsx   ← tests
    FileViewer.tsx              ← Orchestrates CodeMirrorEditor + DiffViewer
    FileViewer.test.tsx         ← tests
    FileViewer.fixedFile.test.ts ← constructFixedFile tests
  index.css                     ← Global styles
docs/
  codemirror-merge-wiki.md      ← this file
```

### DiffViewer.tsx — Component Architecture

```
DiffViewer
├── Header bar (legend + chunk navigation)
│   ├── Color swatches (Original / Suggested Fix)
│   ├── Chunk count display
│   ├── Prev button (goToPreviousChunk)
│   └── Next button (goToNextChunk)
└── CodeMirror editor container
    └── EditorView with unifiedMergeView extension
```

**Props:**

| Prop | Type | Description |
|---|---|---|
| `originalCode` | `string` | `finding.code_text` — the buggy original code (document A) |
| `remediationCode` | `string` | `resolution.remediation_code` — the AI fix (document B) |
| `filePath` | `string` | File path for language detection |
| `themeExtension` | `Extension` | CodeMirror theme from ThemePicker |

**Current unifiedMergeView configuration:**

```ts
unifiedMergeView({
  original: originalCode,
  gutter: true,
  highlightChanges: false,            // ← no inline red/green marks (less noisy)
  syntaxHighlightDeletions: true,
  mergeControls: makeMergeControlButton, // ← custom button factory (icon + label)
  // allowInlineDiffs: false          // not enabled — uses separate deleted/inserted lines
  // collapseUnchanged: undefined      // not configured
})
```

### Key Implementation Details

1. **Two-effect pattern:**
   - Effect 1: Creates/destroys the EditorView (deps: `originalCode`, `remediationCode`, `filePath`)
   - Effect 2: Updates theme via `Compartment` without destroying the editor (deps: `themeExtension`)

2. **Auto-scroll to first diff chunk:**
   ```ts
   requestAnimationFrame(() => {
     const result = getChunks(view.state);
     if (result && result.chunks.length > 0) {
       const first = result.chunks[0];
       const line = view.state.doc.lineAt(first.fromB);
       view.dispatch({
         selection: { anchor: line.from },
         effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
       });
     }
   });
   ```

3. **Keyboard navigation:**
   - `Alt+↓` → `goToNextChunk({state, dispatch})` (next diff)
   - `Alt+↑` → `goToPreviousChunk({state, dispatch})` (previous diff)
   - Skipped when focus is in `<input>`, `<textarea>`, or `contentEditable` elements

4. **FileViewer integration:**
   - If `resolution.remediation_code` exists AND `constructFixedFile` produces a different string
     → renders `DiffViewer`
   - Otherwise (no remediation or alignment failed) → renders `CodeMirrorEditor` (source view)
     with the remediation snippet shown below as a second editor
   - Header label: "Diff View" vs "Source Viewer"

### Data Flow

```
Finding (code_text) ──────────┐
                               ├──→ DiffViewer ──→ unifiedMergeView
AiResolution (remediation_code)┘      │
                                       ├──→ Document A = originalCode (= fixed file's original block)
                                       └──→ Document B = remediationCode (= fixed file after replacement)
```

**Why "fixed file" not "raw file":** For the diff view to align cleanly, both sides must
be complete files. The server applies the fix as a substring replacement of the original
block; the client mirrors this in `constructFixedFile` (in `FileViewer.tsx`) with the same
indentation heuristics so the two stay in sync.

### Multi-Error Highlighting

When viewing one finding, all sibling findings in the **same file** are highlighted as
subtler red markers. Implementation:

- `CodeInspector` receives `allFindings?: Finding[]` from `IssuesPage` (= `currentReport.findings`).
- `FileViewer` computes `siblingErrorLines` via pure function `computeSiblingErrorLines(allFindings, file, line)`.
- `CodeMirrorEditor` receives `errorLines?: number[]` and applies two CSS classes:
  - `.cm-error-line` (strong red) for the active finding
  - `.cm-error-line-sibling` (subtle red) for the other lines in the same file

Pure-function extraction (`computeSiblingErrorLines` is exported) allows direct unit testing
of the multi-error logic without rendering the editor (jsdom can't measure text ranges).

---

## 10. Custom mergeControls — Implementation Reference

The function passed to `mergeControls` receives `(type, action)` and returns an `HTMLElement`.
The library wraps the element in a `<div class="cm-chunkButtons">` container that has
`position: absolute; inset-inline-end: 5px` (but no `position: relative` on the parent —
see Section 4 bug).

### The complete working pattern (used in this project)

```ts
import { EditorView } from '@codemirror/view'

export function makeMergeControlButton(
  type: 'accept' | 'reject',
  action: (e: MouseEvent) => void,
): HTMLElement {
  const isAccept = type === 'accept'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = isAccept
    ? 'cm-merge-btn cm-merge-btn-accept'
    : 'cm-merge-btn cm-merge-btn-reject'
  btn.title = isAccept ? 'Accept this change' : 'Reject this change'

  // INLINE STYLES — always win over external stylesheets
  const baseStyles: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: '1.2',
    borderRadius: '5px',
    border: '1px solid',
    cursor: 'pointer',
    userSelect: 'none',
    fontFamily: 'inherit',
    transition: 'all 120ms ease',
  }
  const colorStyles: Record<string, string> = isAccept
    ? {
        color: 'hsl(142 76% 65%)',
        backgroundColor: 'hsla(142 76% 36% / 0.25)',
        borderColor: 'hsla(142 76% 50% / 0.7)',
      }
    : {
        color: 'hsl(350 85% 70%)',
        backgroundColor: 'hsla(350 85% 55% / 0.2)',
        borderColor: 'hsla(350 85% 60% / 0.6)',
      }
  Object.assign(btn.style, baseStyles, colorStyles)

  // Icon (inline SVG)
  const iconWrap = document.createElement('span')
  iconWrap.className = 'cm-merge-btn-icon'
  iconWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;'
  iconWrap.appendChild(isAccept ? makeCheckIcon() : makeXIcon())
  btn.appendChild(iconWrap)

  // Label
  const label = document.createElement('span')
  label.className = 'cm-merge-btn-label'
  label.textContent = isAccept ? 'Apply' : 'Decline'
  label.style.fontSize = '11px'
  btn.appendChild(label)

  // 'mousedown' (not 'click') — matches CodeMirror's default
  btn.addEventListener('mousedown', action)
  return btn
}
```

### Why `mousedown` and not `click`?

The library's default handler uses `onmousedown`. Using `click` would race with focus changes
(the button's mousedown would blur the editor, then the click event would be lost or
double-fire). Stick to `mousedown` for consistency.

### Companion theme — INLINE-RIGHT placement (recommended)

Placing the buttons **below** the chunk (the original approach) creates an extra empty line
under every change. For single-line diffs, this is visually noisy. The recommended placement
is **inline-right, top-aligned**: reserve ~130px on the right of each deleted chunk and pin
the buttons to the top-right corner so they remain visible regardless of chunk height.

```ts
const mergeButtonsTheme = EditorView.theme({
  // 1) Make the chunk a positioning context, reserve space for buttons,
  //    guarantee a minimum height for single-line chunks.
  '& .cm-deletedChunk': {
    position: 'relative !important',
    paddingRight: '130px !important',   // reserve gutter for buttons
    minHeight: '34px',                  // fits single-line chunks
    paddingLeft: '6px',
    paddingTop: '3px',
    paddingBottom: '3px',
  },
  // 2) Pin buttons to TOP-RIGHT (not vertical-center) so multi-line
  //    chunks keep their buttons visible at the top.
  '& .cm-deletedChunk .cm-chunkButtons': {
    position: 'absolute !important',
    insetInlineEnd: '8px !important',
    top: '4px !important',
    bottom: 'auto !important',
    transform: 'none !important',
    display: 'inline-flex !important',
    gap: '6px',
    zIndex: '5',
    marginLeft: '0 !important',
    marginTop: '0 !important',
  },
})
```

Why **top-right** instead of vertical-center?
- For tall multi-line deletions, vertical-center would float the buttons in the middle of
  a block of code, far from any natural attachment point.
- Users scan from the top-left; buttons in the top-right are the conventional placement
  for chunk actions in diff UIs (GitHub, VS Code, Bitbucket).
- Single-line chunks still fit comfortably because of the `minHeight: 34px` guarantee.

Other benefits:
- No extra empty line below each chunk.
- `paddingRight: 130px` prevents deleted text from overflowing behind the buttons.
- The buttons never push subsequent code lines down.

Companion test file: `DiffViewer.mergeControls.test.ts` — 7 unit tests covering element
type, classes, SVG/label, inline styles, color diff, accessibility, and mousedown wiring.

---

## 11. Smooth Scroll Workaround

`EditorView.scrollIntoView` accepts only `{y: "nearest" | "start" | "end" | "center", x: ...}`.
There is **no `behavior: "smooth"`** parameter. The merge package's `goToNextChunk` /
`goToPreviousChunk` use `EditorView.scrollIntoView` with no options → instant jump.

### Workaround: CSS `scroll-behavior: smooth` on the editor container

```tsx
<div
  ref={containerRef}
  className="diff-viewer-editor flex-1 min-h-0 overflow-auto"
  style={{
    maxHeight: '700px',
    scrollBehavior: 'smooth',  // ← browser-native, zero-JS animation
  }}
/>
```

This animates **every** scroll operation inside the container, including:
- Initial auto-scroll to first chunk (`EditorView.scrollIntoView`)
- Prev/Next chunk navigation
- Manual user scroll (mouse wheel, scrollbar drag)

No JavaScript needed. Works in all modern browsers. Zero performance cost.

### Alternative: JavaScript-controlled animation

If you need a custom duration or easing:

```ts
function smoothScrollTo(view: EditorView, pos: number) {
  const scroller = view.scrollDOM
  const target = view.coordsAtPos(pos)?.top ?? 0
  const start = scroller.scrollTop
  const distance = target - start
  const duration = 400
  const startTime = performance.now()

  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3) // ease-out-cubic
    scroller.scrollTop = start + distance * eased
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
```

This project uses the CSS approach for simplicity.

---

## 12. Known Caveats & Gotchas

### `getChunks` returns an object, not an array

```ts
// WRONG:
const chunks = getChunks(state);
chunks.length  // ❌ undefined

// CORRECT:
const result = getChunks(state);
result?.chunks.length  // ✓ number
```

### Base theme forces `height: auto !important`

The merge view's base theme sets `.cm-scroller` to `height: auto !important` and `overflowY: visible !important`. This can break flex layouts with fixed-height containers. Override with specific selectors.

### `originalDocChangeEffect` timing issue

When dispatching `originalDocChangeEffect` from a `transactionExtender`, the diff may not re-render immediately — it may require the next keystroke. This is a known community-reported issue.

### Large deletions may freeze the UI

Deleted blocks larger than `syntaxHighlightDeletionsMaxLength` (default 3000) skip syntax highlighting. Since v6.8.0, chunk sizes are also limited to prevent interface freezing.

### Imprecise diff fallback

When documents are very different, the diff algorithm may fall back to imprecise mode. Check `chunk.precise === false` to detect this.

### `.cm-deletedChunk` is missing `position: relative` ⚠️

The default base theme doesn't set `position: relative` on `.cm-deletedChunk`, so the
absolutely-positioned `.cm-chunkButtons` floats to the top of the **editor**, not the chunk.
**Always set `position: relative !important` in your custom theme** (see Section 4).

### `mergeControls: true` is broken without `position: relative`

The default tiny `Accept`/`Reject` buttons inherit the same positioning bug. Users only
see them at the top of the editor viewport, not next to the chunk. **Always use a custom
function** (see Section 10) and always add the `position: relative` fix.

### Button placement below the chunk adds extra vertical space

Using `top: 100%` + `paddingBottom` to push buttons below the chunk creates an extra empty
line under every change, which is visually noisy for single-line diffs. Use the inline-right
pattern from Section 10 instead.

### jsdom cannot measure text ranges

`EditorView` internally calls `textRange.getClientRects()` (for `scrollIntoView`,
`coordsAtPos`, etc.) which jsdom doesn't implement. Tests that need text measurement
will fail with `TypeError: ... getClientRects is not a function`. Workarounds:
- Extract pure logic (computation, prop building) into exported functions and test those
  directly (see `computeSiblingErrorLines` in `FileViewer.tsx`).
- Smoke-test the editor presence with `document.querySelector('.cm-editor')` only.
- Visual verification happens in the browser, not jsdom.

### Global stylesheet `.cm-chunkButtons` rules collide with `EditorView.theme()`

If your project has external CSS that already defines `.cm-chunkButtons { position: absolute;
inset-inline-end: 5px }` (a common copy-paste from CodeMirror docs), those rules **compete**
with the inline-right placement defined in `EditorView.theme()`. Both selectors resolve to
the same specificity (0,1,0), so cascade order decides the winner — and `EditorView.theme()`
rules are injected **before** your stylesheet, meaning the stylesheet wins.

Fix: either remove the duplicate rules from your stylesheet, or raise the specificity of your
theme rules with `& .cm-deletedChunk .cm-chunkButtons` so they match `.cm-editor .cm-deletedChunk
.cm-chunkButtons` (3 classes, beats 1).

### Height chain: editor needs an explicit height target

`baseEditorTheme` in this project sets `'&': { height: '100%' }` on `.cm-editor`. That only
works if every parent up the React tree also has a determinate height. The full chain that
makes the FileViewer actually scroll inside the right pane is:

```
App:               h-screen flex flex-col
  main:            flex-1 flex min-h-0
    tab content:   flex-1 flex min-h-0
      IssuesPage:  flex-1 flex min-h-0
        CodeInspector:    flex-1 flex flex-col h-full overflow-hidden
          inner row:      flex-1 flex min-h-0
            center col:   flex-1 flex flex-col min-w-0 overflow-hidden
              top cards:  shrink-0 overflow-y-auto    ← own scrollbar
              FileViewer wrapper: flex-1 min-h-0 flex flex-col
                FileViewer root:  flex-1 min-h-0 flex flex-col
                  content area:   flex-1 min-h-0 overflow-auto
                    DiffViewer:   flex-1 min-h-0 h-full flex flex-col
                      editor:     flex-1 min-h-0 overflow-auto
                        .cm-editor: height: 100%
```

Missing `min-h-0` on any flex-column parent causes the editor to grow to its content height
and push siblings off-screen, with no scrollbar appearing. Always pair `flex-1` with `min-h-0`
on flex columns that contain a scrollable editor.

### Snippet CodeMirror in a `shrink-0` parent needs an explicit `min-height`

If you render `CodeMirrorEditor` inside a `shrink-0` container (e.g., for a small "Suggested
Fix snippet" panel beneath the main editor), the editor's `flex-1` collapses to zero height
because `shrink-0` doesn't propagate a height. Wrap the snippet in a container with
`h-[220px]` (or similar fixed/responsive height) so the editor has a target to fill.

---

## 13. Version History

| Version | Date | Key Changes |
|---|---|---|
| 6.1.0 | 2023-05 | `unifiedMergeView` first introduced |
| 6.2.0 | 2023-10 | `goToNextChunk`, `goToPreviousChunk` |
| 6.3.0 | 2023-11 | Configurable `diffConfig` |
| 6.4.0 | 2023-12 | `getOriginalDoc()` |
| 6.5.0 | 2024-01 | `originalDocChangeEffect()` |
| 6.6.0 | 2024-01 | `updateOriginalDoc` effect exported |
| 6.7.0 | 2024-08 | `collapseUnchanged` for unified view |
| 6.7.5 | 2024-12 | Collapsed lines use `:before`/`:after` for customization; deleted lines as block elements |
| 6.8.0 | 2024-12 | Limit highlighted chunk sizes; export `uncollapseUnchanged` |
| 6.9.0 | 2025-03 | `timeout` diff option; `Chunk.precise` property |
| 6.10.0 | 2025-03 | `allowInlineDiffs` option |
| 6.11.0 | 2025-10 | `mergeControls` as custom render function |
| 6.12.0 | 2026-02 | `DiffConfig.override` for custom diff algorithms |
| 6.12.1 | 2026-03 | Fix chunk duplication at document start |

---

## References

- **Official docs:** https://codemirror.net/docs/ref/#merge
- **Package source:** https://code.haverbeke.berlin/codemirror/merge
- **GitHub (redirects):** https://github.com/codemirror/merge
- **Community forum:** https://discuss.codemirror.net/
- **Changelog:** https://github.com/codemirror/merge/blob/main/CHANGELOG.md
