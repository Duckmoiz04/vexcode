import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { unifiedMergeView } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { getLanguageExtension } from './CodeMirrorEditor.tsx';
import { baseEditorTheme } from '../../utils/themes.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DiffViewInlineProps {
  original: string;
  modified: string;
  filePath: string | null | undefined;
  themeExtension: Extension;
  targetLine?: number;
}

// ─── Scroll Helper ────────────────────────────────────────────────────────────

function scrollToLine(view: EditorView, line: number) {
  if (!view || line < 1) return;
  try {
    const docLine = view.state.doc.line(line);
    requestAnimationFrame(() => {
      view.dispatch({
        effects: EditorView.scrollIntoView(docLine.from, { y: 'center' }),
      });
    });
  } catch {
    // line out of range — ignore
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const DiffViewInline: React.FC<DiffViewInlineProps> = ({ original, modified, filePath, themeExtension, targetLine }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());

  // ── Create the editor when original/modified/filePath changes ───────────

  useEffect(() => {
    if (!containerRef.current) return;

    const lang = getLanguageExtension(filePath);

    const extensions: Extension[] = [
      lineNumbers(),
      themeCompartmentRef.current.of(themeExtension),
      baseEditorTheme,
      unifiedMergeView({
        original,
        gutter: true,
        highlightChanges: true,
      }),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ];

    if (Array.isArray(lang)) {
      extensions.push(...lang);
    } else if (lang) {
      extensions.push(lang);
    }

    const state = EditorState.create({ doc: modified, extensions });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Auto-scroll to the target error line
    if (targetLine) {
      scrollToLine(view, targetLine);
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [original, modified, filePath, targetLine]);

  // ── Reconfigure theme live (no editor destroy) ──────────────────────────

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartmentRef.current.reconfigure(themeExtension),
    });
  }, [themeExtension]);

  return (
    <div
      ref={containerRef}
      className="diff-view-container h-full"
    />
  );
};
