import { useEffect, useRef } from 'react';
import { EditorState, Compartment, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { pythonLanguage } from '@codemirror/lang-python';
import { javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from '@codemirror/lang-javascript';
import { jsonLanguage } from '@codemirror/lang-json';
import { cssLanguage } from '@codemirror/lang-css';
import { htmlLanguage } from '@codemirror/lang-html';
import type { Extension } from '@codemirror/state';
import { baseEditorTheme } from '../../utils/themes.ts';

// ─── Error line decoration (red highlight) ────────────────────────────────────
// Multi-line: a file can have many findings, so we track a Set of error lines.
// The active (selected) finding is shown in a stronger style; sibling lines in
// the same file are shown in a more subtle style.

const setErrorLines = StateEffect.define<{ active: number | null; all: Set<number> }>();
interface ErrorLinesState {
  active: number | null;
  all: Set<number>;
}
const errorLineField = StateField.define<ErrorLinesState>({
  create: () => ({ active: null, all: new Set() }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLines)) return e.value;
    }
    return value;
  },
});
const errorLineDecorations = EditorView.decorations.compute([errorLineField], (state) => {
  const { active, all } = state.field(errorLineField);
  if (all.size === 0) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  for (const line of all) {
    if (line == null || line < 1 || line > state.doc.lines) continue;
    try {
      const range = state.doc.line(line);
      const cls = line === active ? 'cm-error-line' : 'cm-error-line-sibling';
      builder.add(range.from, range.from, Decoration.line({ attributes: { class: cls } }));
    } catch {
      // ignore invalid line
    }
  }
  return builder.finish();
});
const errorLineTheme = EditorView.theme({
  // Active (selected) finding — strong red highlight
  '.cm-error-line': {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderLeft: '3px solid rgba(239, 68, 68, 0.9)',
    boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.25)',
  },
  // Sibling findings in the same file — subtle marker so they're visible
  // without competing with the active line.
  '.cm-error-line-sibling': {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderLeft: '2px solid rgba(239, 68, 68, 0.45)',
  },
});

// ─── Extension resolution ─────────────────────────────────────────────────────

const getLanguageExtension = (filePath: string | null | undefined) => {
  if (!filePath) return [];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'py':
      return pythonLanguage;
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascriptLanguage;
    case 'jsx':
      return jsxLanguage;
    case 'ts':
      return typescriptLanguage;
    case 'tsx':
      return tsxLanguage;
    case 'json':
      return jsonLanguage;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return cssLanguage;
    case 'html':
    case 'htm':
    case 'xml':
    case 'vue':
      return htmlLanguage;
    default:
      return [];
  }
};

export { getLanguageExtension };

// ─── Props ────────────────────────────────────────────────────────────────────

interface CodeMirrorEditorProps {
  content: string;
  filePath: string | null | undefined;
  onChange?: (value: string) => void;
  goToLine?: number;
  /** All error lines in this file. The active one is highlighted strongly,
   *  the rest are highlighted subtly. */
  errorLines?: number[];
  themeExtension: Extension;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  content, filePath, onChange, goToLine, errorLines, themeExtension,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const themeCompartmentRef = useRef(new Compartment());
  onChangeRef.current = onChange;

  // ── Effect 1: Create the editor when filePath or content changes ─────────
  // FIX: previous version had deps [filePath] only, which meant goToLine changes
  // would not trigger scroll. Now split: editor lifecycle (filePath, content)
  // is independent of scroll behavior (goToLine).

  useEffect(() => {
    if (!editorRef.current) return;

    const lang = getLanguageExtension(filePath);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      keymap.of(defaultKeymap),
      themeCompartmentRef.current.of(themeExtension),
      baseEditorTheme,
      errorLineTheme,
      errorLineField,
      errorLineDecorations,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
    ];

    if (Array.isArray(lang)) {
      extensions.push(...lang);
    } else if (lang) {
      extensions.push(lang);
    }

    const state = EditorState.create({ doc: content, extensions });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath, content]);

  // ── Effect 2: Scroll to active line + update error-line decorations ─
  // FIX: separate effect so editor is NOT remounted on line change.
  // This fixes the "switch finding same file → no scroll" bug.
  // Robustness: dispatch immediately + via rAF + via setTimeout fallback
  // so scrollIntoView lands even if the view was just created.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // 1. Update red error-line decorations (multi-line)
    const allSet = new Set<number>((errorLines ?? []).filter((n) => n > 0));
    const active = typeof goToLine === 'number' && goToLine > 0 ? goToLine : null;
    if (active) allSet.add(active);
    view.dispatch({
      effects: setErrorLines.of({ active, all: allSet }),
    });

    // 2. Scroll to the active line (the selected finding)
    if (typeof goToLine !== 'number' || goToLine <= 0) return;
    if (view.state.doc.lines < goToLine) return;

    const scrollToLine = () => {
      if (!viewRef.current || viewRef.current !== view) return;
      try {
        const line = view.state.doc.line(goToLine);
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        });
      } catch {
        // Silently ignore — line might not exist in doc
      }
    };
    // Try multiple times to handle cases where the view is still laying out
    requestAnimationFrame(scrollToLine);
    const timer = setTimeout(scrollToLine, 100);
    return () => clearTimeout(timer);
  }, [goToLine, errorLines]);

  // ── Effect 3: Reconfigure theme live (no editor destroy) ────────────────

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartmentRef.current.reconfigure(themeExtension),
    });
  }, [themeExtension]);

  return (
    <div
      ref={editorRef}
      className="code-mirror-editor w-full h-full border border-card-border/40 rounded-xl overflow-hidden flex flex-col min-h-0"
    />
  );
};
