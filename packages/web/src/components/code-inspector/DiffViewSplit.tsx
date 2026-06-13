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
}

// ─── Component ──────────────────────────────────────────────────────────────

export const DiffViewSplit: React.FC<DiffViewSplitProps> = ({ original, modified, filePath, themeExtension }) => {
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

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
  }, [original, modified, filePath]);

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
      className="diff-view-container border border-card-border/40 rounded-xl overflow-hidden"
      style={{ minHeight: '250px', maxHeight: '500px', overflow: 'auto' }}
    />
  );
};