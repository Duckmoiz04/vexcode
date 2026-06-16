import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { unifiedMergeView, getChunks, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { baseEditorTheme } from '../../utils/themes.ts';
import { getLanguageExtension } from './CodeMirrorEditor.tsx';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Props ──────────────────────────────────────────────────────────────────

interface DiffViewerProps {
  originalCode: string;
  remediationCode: string;
  filePath: string | null | undefined;
  themeExtension: Extension;
}

/**
 * Build a custom Accept/Reject button for each diff chunk. CodeMirror wraps
 * the returned element in a `.cm-chunkButtons` container that is
 * `position: absolute; inset-inline-end: 5px` by default. We provide a
 * larger, icon-bearing button; the wrapper is positioned below the chunk
 * by `mergeButtonsTheme` so the buttons don't sit on the code line.
 */
function makeMergeControlButton(
  type: 'accept' | 'reject',
  action: (e: MouseEvent) => void,
): HTMLElement {
  const isAccept = type === 'accept';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = isAccept ? 'cm-merge-btn cm-merge-btn-accept' : 'cm-merge-btn cm-merge-btn-reject';
  btn.title = isAccept ? 'Accept this change' : 'Reject this change';

  const iconWrap = document.createElement('span');
  iconWrap.className = 'cm-merge-btn-icon';
  iconWrap.appendChild(isAccept ? makeCheckIcon() : makeXIcon());
  btn.appendChild(iconWrap);

  const label = document.createElement('span');
  label.className = 'cm-merge-btn-label';
  label.textContent = isAccept ? 'Apply' : 'Decline';
  btn.appendChild(label);

  btn.addEventListener('mousedown', action);
  return btn;
}

function makeCheckIcon(): HTMLElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(ns, 'polyline');
  path.setAttribute('points', '20 6 9 17 4 12');
  svg.appendChild(path);
  return svg;
}

function makeXIcon(): HTMLElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const l1 = document.createElementNS(ns, 'line');
  l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6');
  l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
  const l2 = document.createElementNS(ns, 'line');
  l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6');
  l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
  svg.appendChild(l1);
  svg.appendChild(l2);
  return svg;
}

/**
 * Override the default CodeMirror merge-control positioning. By default the
 * `.cm-chunkButtons` wrapper is `position: absolute; right: 5px; top: 0`
 * which puts the small button on the right edge of the deleted chunk,
 * possibly increasing the line height when we make the button larger.
 *
 * We move the wrapper to `top: 100%` (just below the chunk), keep it
 * `position: absolute` (so it overlays without affecting flow), and add
 * enough padding so the buttons look prominent but stay out of the way.
 */
const mergeButtonsTheme = EditorView.theme({
  '.cm-deletedChunk': {
    // Extra space at the bottom of the deleted chunk so the buttons below
    // it don't visually collide with the next line.
    paddingBottom: '28px',
  },
  '.cm-deletedChunk .cm-chunkButtons': {
    position: 'absolute',
    insetInlineEnd: '6px',
    top: '100%',
    marginTop: '4px',
    display: 'inline-flex',
    gap: '6px',
    zIndex: '5',
  },
  '.cm-merge-btn': {
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
  },
  '.cm-merge-btn-accept': {
    color: 'hsl(142 76% 60%)',
    backgroundColor: 'hsla(142 76% 36% / 0.18)',
    borderColor: 'hsla(142 76% 36% / 0.5)',
  },
  '.cm-merge-btn-accept:hover': {
    backgroundColor: 'hsla(142 76% 36% / 0.32)',
    borderColor: 'hsla(142 76% 36% / 0.8)',
  },
  '.cm-merge-btn-reject': {
    color: 'hsl(350 85% 65%)',
    backgroundColor: 'hsla(350 85% 55% / 0.15)',
    borderColor: 'hsla(350 85% 55% / 0.45)',
  },
  '.cm-merge-btn-reject:hover': {
    backgroundColor: 'hsla(350 85% 55% / 0.28)',
    borderColor: 'hsla(350 85% 55% / 0.75)',
  },
  '.cm-merge-btn-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  '.cm-merge-btn-label': {
    fontSize: '11px',
  },
});

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

  // ── Effect 1: Create / recreate editor when filePath or content changes ─
  // FIX: removed themeExtension from deps to prevent editor destroy on theme change.
  // Theme is now handled by Effect 2 via Compartment.

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
      // Disable bright red/green inline highlighting — the column structure +
      // merge controls are enough indication. Keeps the diff readable.
      highlightChanges: false,
      // Keep deleted lines syntax-highlighted so the diff stays readable
      // (otherwise deletions appear as plain gray blocks).
      syntaxHighlightDeletions: true,
      // Custom bigger Accept/Reject buttons. CodeMirror wraps our element in
      // a `.cm-chunkButtons` div that is `position: absolute`. We provide
      // the button content; the positioning (below the chunk) is done in
      // `mergeButtonsTheme` via the wrapper class.
      mergeControls: makeMergeControlButton,
    });

    const extensions: Extension[] = [
      keymap.of(defaultKeymap),
      themeCompartmentRef.current.of(themeExtension),
      baseEditorTheme,
      mergeButtonsTheme,
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

    // Query chunks after view is fully rendered
    // FIX: was using setTimeout(300) inside effect cleanup path — moved to rAF
    // to avoid React warnings about state updates during unmount
    requestAnimationFrame(() => {
      if (viewRef.current !== view) return; // editor was replaced
      try {
        const result = getChunks(view.state);
        const count = result?.chunks.length || 0;
        setChunkCount(count);
        // Auto-scroll to first chunk if present
        if (result && result.chunks.length > 0) {
          const first = result.chunks[0];
          try {
            const line = view.state.doc.lineAt(first.fromB);
            view.dispatch({
              selection: { anchor: line.from },
              effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
            });
          } catch {
            // line invalid, ignore
          }
        }
      } catch {
        setChunkCount(0);
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [originalCode, remediationCode, filePath]);   // ← NO themeExtension

  // ── Effect 2: Update theme live (no editor destroy) ─────────────────────
  // FIX: separate effect, uses Compartment to reconfigure theme
  // This fixes the "theme switch causes flicker / giao diện nhảy lung tung" bug.

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
    // goToNextChunk is a StateCommand — signature is ({state, dispatch}).
    // The previous version called it with just `view`, so it got
    // state=undefined and silently did nothing. Pass the proper pair.
    try {
      const moved = goToNextChunk({
        state: view.state,
        dispatch: view.dispatch.bind(view),
      });
      if (!moved) {
        // Wrapped to first chunk — focus the view so the scrollIntoView effect lands
        view.focus();
      }
    } catch {
      // No more chunks or view not ready
    }
  }, []);

  const handlePreviousChunk = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const moved = goToPreviousChunk({
        state: view.state,
        dispatch: view.dispatch.bind(view),
      });
      if (!moved) view.focus();
    } catch {
      // No more chunks or view not ready
    }
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  // FIX: skip Alt+ArrowDown if focus is in input/textarea/contenteditable
  // (was triggering chunk nav even when typing in chat input)

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
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
