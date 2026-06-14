import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { MergeView } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { getLanguageExtension } from './CodeMirrorEditor.tsx';
import { baseEditorTheme } from '../../utils/themes.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DiffViewSplitProps {
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

export const DiffViewSplit: React.FC<DiffViewSplitProps> = ({ original, modified, filePath, themeExtension, targetLine }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const themeCompartmentARef = useRef(new Compartment());
  const themeCompartmentBRef = useRef(new Compartment());

  // ── Create the merge view when original/modified/filePath changes ────────

  useEffect(() => {
    if (!containerRef.current) return;

    const lang = getLanguageExtension(filePath);

    const paneExtensions: Extension[] = [
      lineNumbers(),
      baseEditorTheme,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ];

    if (Array.isArray(lang)) {
      paneExtensions.push(...lang);
    } else if (lang) {
      paneExtensions.push(lang);
    }

    const mergeView = new MergeView({
      a: {
        doc: original,
        extensions: [
          themeCompartmentARef.current.of(themeExtension),
          ...paneExtensions,
        ],
      },
      b: {
        doc: modified,
        extensions: [
          themeCompartmentBRef.current.of(themeExtension),
          ...paneExtensions,
        ],
      },
      parent: containerRef.current,
    });

    mergeViewRef.current = mergeView;

    // Auto-scroll to the target error line (both panes)
    if (targetLine) {
      scrollToLine(mergeView.a, targetLine);
      scrollToLine(mergeView.b, targetLine);
    }

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
  }, [original, modified, filePath, targetLine]);

  // ── Reconfigure theme live on both panes (no merge view destroy) ─────────

  useEffect(() => {
    if (!mergeViewRef.current) return;
    mergeViewRef.current.a.dispatch({
      effects: themeCompartmentARef.current.reconfigure(themeExtension),
    });
    mergeViewRef.current.b.dispatch({
      effects: themeCompartmentBRef.current.reconfigure(themeExtension),
    });
  }, [themeExtension]);

  return (
    <div
      ref={containerRef}
      className="diff-view-container h-full"
    />
  );
};