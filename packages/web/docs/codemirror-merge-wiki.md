# CodeMirror 6 & @codemirror/merge — Project Wiki

> **Scope:** This wiki covers CodeMirror 6 fundamentals and the `@codemirror/merge` package,
> with deep focus on `unifiedMergeView` as used in the Vexcode project.
> Last updated for `@codemirror/merge@^6.12.1`.

---

## Table of Contents

1. [CodeMirror 6 Overview](#1-codemirror-6-overview)
2. [@codemirror/merge Package](#2-codemirrormerge-package)
3. [unifiedMergeView — Deep Dive](#3-unifiedmergeview--deep-dive)
4. [CSS Classes & Theming Reference](#4-css-classes--theming-reference)
5. [API Functions](#5-api-functions)
6. [Chunk Data Structure](#6-chunk-data-structure)
7. [Diffing Utilities](#7-diffing-utilities)
8. [Project Implementation](#8-project-implementation)
9. [Known Caveats & Gotchas](#9-known-caveats--gotchas)
10. [Version History](#10-version-history)

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

### Important: Height Override

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

## 5. API Functions

### Chunk Actions

| Function | Signature | Description |
|---|---|---|
| `acceptChunk` | `(view, pos?) => boolean` | Accept chunk at `pos` (or cursor). Chunk is no longer highlighted |
| `rejectChunk` | `(view, pos?) => boolean` | Reject chunk. Reverts to original content |
| `getOriginalDoc` | `(state) => Text` | Get the original document from state |
| `originalDocChangeEffect` | `(state, changes) => StateEffect` | Update the original document being compared |
| `uncollapseUnchanged` | `StateEffectType<number>` | Expand collapsed section at position |

### Navigation

| Function | Type | Description |
|---|---|---|
| `goToNextChunk` | `StateCommand` | Move selection to next changed chunk |
| `goToPreviousChunk` | `StateCommand` | Move selection to previous changed chunk |

**Usage:** These are `StateCommand` functions, not plain functions. They accept an `EditorView` directly:

```ts
// Correct:
goToNextChunk(view);
goToPreviousChunk(view);

// As keybinding:
keymap.of([
  { key: "Alt-n", run: goToNextChunk },
  { key: "Alt-p", run: goToPreviousChunk }
])
```

### Chunk Retrieval

```ts
getChunks(state: EditorState) → {
  chunks: readonly Chunk[];
  side: "a" | "b" | null;  // null for unified view
} | null  // null if not initialized yet
```

**Important:** Returns an **object**, not a plain array. Access via `result.chunks`.

---

## 6. Chunk Data Structure

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

## 7. Diffing Utilities

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

## 8. Project Implementation

### File Structure

```
packages/web/src/
  components/code-inspector/
    DiffViewer.tsx          ← unifiedMergeView component
    CodeMirrorEditor.tsx    ← Main code viewer (no diff)
    FileViewer.tsx          ← Orchestrates CodeMirrorEditor + DiffViewer
  index.css                 ← Global styles
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
  highlightChanges: true,
  syntaxHighlightDeletions: true,
  mergeControls: false,           // read-only, no accept/reject
  // allowInlineDiffs: false      // not enabled — uses separate deleted/inserted lines
  // collapseUnchanged: undefined  // not configured
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
   - `Alt+↓` → `goToNextChunk(view)` (next diff)
   - `Alt+↑` → `goToPreviousChunk(view)` (previous diff)
   - Skipped when focus is in `<input>`, `<textarea>`, or `contentEditable` elements

4. **FileViewer integration:**
   - If `resolution.remediation_code` exists → renders `DiffViewer`
   - Otherwise → renders standard `CodeMirrorEditor`
   - Header label: "Diff View" vs "Source Viewer"

### Data Flow

```
Finding (code_text) ──────────┐
                               ├──→ DiffViewer ──→ unifiedMergeView
AiResolution (remediation_code)┘      │
                                       ├──→ Document A = originalCode
                                       └──→ Document B = remediationCode
```

---

## 9. Known Caveats & Gotchas

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

### `goToNextChunk` is a StateCommand

It requires `{state, dispatch}` — pass an `EditorView` directly, not raw state/dispatch objects.

---

## 10. Version History

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
