import React, { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { unifiedMergeView, getChunks, goToNextChunk, goToPreviousChunk, acceptChunk, rejectChunk } from '@codemirror/merge';
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
 * Build a custom Accept/Reject button for each diff chunk.
 *
 * NOTE: Inline CodeMirror merge buttons are now disabled (`mergeControls: false`).
 * Accept/Reject actions have been moved to the sticky DiffViewer header so they
 * never overlap the code. This factory is kept exported for the unit-test suite
 * and as a reference if the inline buttons are re-enabled later.
 */
export function makeMergeControlButton(
  type: 'accept' | 'reject',
  action: (e: MouseEvent) => void,
): HTMLElement {
  const isAccept = type === 'accept';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = isAccept ? 'cm-merge-btn cm-merge-btn-accept' : 'cm-merge-btn cm-merge-btn-reject';
  btn.title = isAccept ? 'Accept this change' : 'Reject this change';

  // Inline base styles (always win, regardless of theme)
  const baseBtn: Record<string, string> = {
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
  };
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
      };
  Object.assign(btn.style, baseBtn, colorStyles);

  const iconWrap = document.createElement('span');
  iconWrap.className = 'cm-merge-btn-icon';
  iconWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;';
  iconWrap.appendChild(isAccept ? makeCheckIcon() : makeXIcon());
  btn.appendChild(iconWrap);

  const label = document.createElement('span');
  label.className = 'cm-merge-btn-label';
  label.textContent = isAccept ? 'Apply' : 'Decline';
  label.style.fontSize = '11px';
  btn.appendChild(label);

  btn.addEventListener('mousedown', action);
  return btn;
}

function makeCheckIcon(): SVGSVGElement {
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

function makeXIcon(): SVGSVGElement {
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

// mergeButtonsTheme removed — inline CodeMirror buttons are disabled.
// Per-chunk Accept/Reject now live in the sticky header.

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
  // Position of the "current" chunk (the one the cursor is nearest to).
  // Tracked via the Prev/Next handlers; resets to 0 when the editor is
  // recreated (new filePath or new content). Used for the "1/3" indicator
  // in the header.
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

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

    // New editor → reset current-chunk index. Without this, switching
    // to a new file would keep the old `currentChunkIndex` and could
    // show "5/3" in the header.
    setCurrentChunkIndex(0);

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
      // Inline Accept/Reject buttons DISABLED — they overlap the code and
      // feel visually broken. Per-chunk and bulk actions now live in the
      // sticky DiffViewer header (Accept/Reject + Accept all/Reject all).
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
    // Reset current-chunk index whenever the editor is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const total = Math.max(chunkCount, 1);
    try {
      const moved = goToNextChunk({
        state: view.state,
        dispatch: view.dispatch.bind(view),
      });
      if (moved) {
        // Advance position indicator; wrap to 0 at the end.
        setCurrentChunkIndex((prev) => (prev + 1) % total);
      } else {
        // Wrapped to first chunk — focus the view so scrollIntoView lands
        setCurrentChunkIndex(0);
        view.focus();
      }
    } catch {
      // No more chunks or view not ready
    }
  }, [chunkCount]);

  const handlePreviousChunk = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const total = Math.max(chunkCount, 1);
    try {
      const moved = goToPreviousChunk({
        state: view.state,
        dispatch: view.dispatch.bind(view),
      });
      if (moved) {
        setCurrentChunkIndex((prev) => (prev - 1 + total) % total);
      } else {
        setCurrentChunkIndex(Math.max(total - 1, 0));
        view.focus();
      }
    } catch {
      // No more chunks or view not ready
    }
  }, [chunkCount]);

  // ── Per-chunk Accept / Reject ────────────────────────────────────────────
  // Act on the chunk at `currentChunkIndex`. After accepting or rejecting,
  // the chunk disappears — remaining chunks shift to fill the gap, so we
  // clamp `currentChunkIndex` to the new (smaller) chunk count.

  const handleAcceptCurrent = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const chunks = getChunks(view.state)?.chunks ?? [];
      const idx = Math.min(currentChunkIndex, chunks.length - 1);
      if (idx >= 0 && chunks[idx]) {
        acceptChunk(view, chunks[idx].fromB);
      }
    } catch {
      // Best effort
    }
    setCurrentChunkIndex(prev => Math.max(prev, 0));
  }, [currentChunkIndex]);

  const handleRejectCurrent = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const chunks = getChunks(view.state)?.chunks ?? [];
      const idx = Math.min(currentChunkIndex, chunks.length - 1);
      if (idx >= 0 && chunks[idx]) {
        rejectChunk(view, chunks[idx].fromB);
      }
    } catch {
      // Best effort
    }
    setCurrentChunkIndex(prev => Math.max(prev, 0));
  }, [currentChunkIndex]);

  // ── Bulk Accept / Reject ─────────────────────────────────────────────────
  // We process chunks from END → START so each `acceptChunk` / `rejectChunk`
  // call doesn't shift the positions of chunks that haven't been processed
  // yet. (Processing START → END would also work if we recomputed chunks
  // after each call, but iterating backward is simpler and equivalent.)
  //
  // `acceptChunk(view, pos)` accepts the chunk at position `pos` in the
  // new (B) document and keeps the new content. `rejectChunk` keeps the
  // old content instead. Both dispatch a transaction that the
  // useEffect's listener picks up to recompute `chunkCount` — which will
  // become 0 once all chunks are processed, at which point the header
  // automatically hides the controls (see `chunkCount > 0` guard).

  const handleAcceptAll = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const chunks = getChunks(view.state)?.chunks ?? [];
      // Process from end to start to avoid position shifts
      for (let i = chunks.length - 1; i >= 0; i--) {
        acceptChunk(view, chunks[i].fromB);
      }
    } catch {
      // Best effort — if any chunk fails, leave the rest for the user
    }
    setCurrentChunkIndex(0);
  }, []);

  const handleRejectAll = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const chunks = getChunks(view.state)?.chunks ?? [];
      for (let i = chunks.length - 1; i >= 0; i--) {
        rejectChunk(view, chunks[i].fromB);
      }
    } catch {
      // Best effort
    }
    setCurrentChunkIndex(0);
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
    // Single page scroll model: no `flex-1 min-h-0 h-full` on the root
    // (those forced the diff to fit a constrained parent, which created a
    // nested scrollbar). The diff renders at its natural content height
    // and the page-level scrollbar (on CodeInspector's center column)
    // reaches the bottom of the diff.
    <div className="diff-viewer flex flex-col border border-card-border/40 rounded-xl overflow-hidden bg-[#0a0a0f]">
      {/* Header with legend and navigation — sticky so it stays visible
          while the user scrolls the diff inside the FileViewer's 60vh
          content area. z-10 keeps it above the CodeMirror content. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-card-border/30 bg-[#0c0c14]">
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
        <div className="flex flex-wrap items-center gap-2">
          {chunkCount > 0 && (
            <>
              <span className="text-[10px] text-text-tertiary font-mono">
                {chunkCount} change{chunkCount > 1 ? 's' : ''}
              </span>
              <span className="text-text-quaternary text-[10px]">|</span>
              {/* Position indicator: "current / total" (1-based). Clamp to
                  bounds just in case currentChunkIndex briefly exceeds
                  chunkCount (e.g., a chunk is accepted between renders). */}
              <span className="text-[10px] text-text-secondary font-mono">
                {Math.min(currentChunkIndex + 1, chunkCount)}/{chunkCount}
              </span>
              <span className="text-text-quaternary text-[10px]">|</span>
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
              <span className="text-text-quaternary text-[10px]">|</span>
              {/* Per-chunk Accept / Reject — act on currentChunkIndex */}
              <button
                onClick={handleAcceptCurrent}
                disabled={chunkCount === 0}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Accept the currently selected change"
              >
                <Check size={12} />
                Accept
              </button>
              <button
                onClick={handleRejectCurrent}
                disabled={chunkCount === 0}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-900/30 border border-red-700/40 hover:bg-red-900/50 text-red-300 hover:text-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Reject the currently selected change"
              >
                <X size={12} />
                Reject
              </button>
              <span className="text-text-quaternary text-[10px]">|</span>
              {/* Bulk Accept all / Reject all */}
              <button
                onClick={handleAcceptAll}
                disabled={chunkCount === 0}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/40 hover:bg-emerald-900/50 text-emerald-300 hover:text-emerald-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Accept all changes in this file"
              >
                <Check size={12} />
                Accept all
              </button>
              <button
                onClick={handleRejectAll}
                disabled={chunkCount === 0}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-900/30 border border-red-700/40 hover:bg-red-900/50 text-red-300 hover:text-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Reject all changes in this file (keep original)"
              >
                <X size={12} />
                Reject all
              </button>
            </>
          )}
        </div>
      </div>

      {/* CodeMirror container — natural height, no internal scroll.
          `overflow-visible` (the default) lets the diff render at its full
          content height so the page-level scrollbar can reach the bottom.
          The CodeMirror `.cm-scroller` inside still has its own scroll for
          very long lines, but the container itself doesn't constrain
          height. */}
      <div
        ref={containerRef}
        className="diff-viewer-editor"
        style={{
          // `scroll-behavior: smooth` makes all scroll operations animated —
          // including those triggered by `EditorView.scrollIntoView` from
          // `goToNextChunk` / `goToPreviousChunk` and the initial auto-scroll
          // to the first chunk. Browser-native, zero-JS animation.
          scrollBehavior: 'smooth',
        }}
      />
    </div>
  );
};
