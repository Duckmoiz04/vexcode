import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { unifiedMergeView, getChunks, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { baseEditorTheme } from '../../utils/themes.ts';
import { getLanguageExtension } from './CodeMirrorEditor.tsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DiffViewerProps {
  originalCode: string;
  remediationCode: string;
  filePath: string | null | undefined;
  themeExtension: Extension;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalCode,
  remediationCode,
  filePath,
  themeExtension,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartmentRef = useRef(new Compartment());
  const [chunkCount, setChunkCount] = useState(0);

  // ── Create / recreate editor when inputs change ─────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const lang = getLanguageExtension(filePath);
    const langExt = Array.isArray(lang) ? lang : lang ? [lang] : [];

    const mergeView = unifiedMergeView({
      original: originalCode,
      gutter: true,
      highlightChanges: true,
      syntaxHighlightDeletions: true,
      mergeControls: false,
    });

    const extensions: Extension[] = [
      keymap.of(defaultKeymap),
      themeCompartmentRef.current.of(themeExtension),
      baseEditorTheme,
      lineNumbers(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      mergeView,
      ...langExt,
    ];

    const state = EditorState.create({
      doc: remediationCode,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    // Auto-scroll to first changed chunk after render
    const scrollTimeout = window.setTimeout(() => {
      try {
        const result = getChunks(view.state);
        if (result && result.chunks.length > 0) {
          setChunkCount(result.chunks.length);
          const first = result.chunks[0];
          // Scroll to start of chunk in editor B (modified side)
          const line = view.state.doc.lineAt(first.fromB);
          view.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
          });
        } else {
          setChunkCount(0);
        }
      } catch {
        setChunkCount(0);
      }
    }, 300);

    return () => {
      window.clearTimeout(scrollTimeout);
      view.destroy();
      viewRef.current = null;
    };
  }, [originalCode, remediationCode, filePath, themeExtension]);

  // ── Live update theme ────────────────────────────────────────────────────

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartmentRef.current.reconfigure(themeExtension),
    });
  }, [themeExtension]);

  // ── Chunk navigation handlers ────────────────────────────────────────────

  const handleNextChunk = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      goToNextChunk(view);
    } catch {
      // No more chunks
    }
  }, []);

  const handlePreviousChunk = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      goToPreviousChunk(view);
    } catch {
      // No more chunks
    }
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        handleNextChunk();
      } else if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        handlePreviousChunk();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextChunk, handlePreviousChunk]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="diff-viewer flex flex-col border border-card-border/40 rounded-xl overflow-hidden bg-[#0a0a0f]">
      {/* Header with legend and navigation */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-card-border/30 bg-[#0c0c14]">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[hsla(350,85%,55%,0.4)]" />
            Original
          </span>
          <span className="text-text-quaternary">&rarr;</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[hsla(142,76%,36%,0.4)]" />
            Suggested Fix
          </span>
        </div>
        <div className="flex items-center gap-2">
          {chunkCount > 0 && (
            <span className="text-[10px] text-text-tertiary font-mono">
              {chunkCount} change{chunkCount > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={handlePreviousChunk}
            disabled={chunkCount === 0}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-bg-tertiary/60 border border-card-border/40 hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary transition-all"
            title="Previous Change (Alt+&uarr;)"
          >
            <ChevronLeft size={12} />
            Prev
          </button>
          <button
            onClick={handleNextChunk}
            disabled={chunkCount === 0}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-bg-tertiary/60 border border-card-border/40 hover:bg-bg-tertiary disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary transition-all"
            title="Next Change (Alt+&darr;)"
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* CodeMirror container */}
      <div
        ref={containerRef}
        className="diff-viewer-editor flex-1 min-h-0 overflow-auto"
        style={{ maxHeight: '350px' }}
      />
    </div>
  );
};