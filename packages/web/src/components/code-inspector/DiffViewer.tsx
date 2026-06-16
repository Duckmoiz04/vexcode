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
 * larger, icon-bearing button; the wrapper is positioned INLINE-RIGHT (next
 * to the deleted chunk, vertically centered) by `mergeButtonsTheme` so the
 * buttons never add an extra empty line below the chunk — critical for
 * single-line fixes where the chunk itself is only one line tall.
 *
 * We set INLINE styles on the button itself so it always renders correctly
 * regardless of CSS specificity battles with CodeMirror's default theme.
 * Class names are still applied for additional styling.
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
 * Override the default CodeMirror merge-control styling.
 *
 * This is intentionally MINIMAL — we want the original CodeMirror
 * `Accept` / `Reject` text buttons (not the custom icon+label version),
 * just slightly bigger so they're easier to read. The only non-cosmetic
 * override is `position: relative !important` on `.cm-deletedChunk`,
 * which is the critical fix for the well-known "buttons float to top of
 * editor" bug. See `docs/codemirror-merge-wiki.md` § 4 "Known Bug:
 * `.cm-deletedChunk` is missing `position: relative`".
 */
const mergeButtonsTheme = EditorView.theme({
  '& .cm-deletedChunk': {
    // CRITICAL: make the chunk a positioning context so the absolutely-
    // positioned `.cm-chunkButtons` anchors to the chunk, not the editor.
    position: 'relative !important',
    // Reserve space for the buttons that sit BELOW the chunk. The merge
    // package's default button placement is `top: 100%` of the chunk
    // (i.e., immediately below the last deleted line). Without this
    // padding, the buttons would visually overlap the next line.
    paddingBottom: '24px',
  },
  '& .cm-deletedChunk .cm-chunkButtons': {
    // Default-style placement: immediately below the chunk, right-aligned.
    position: 'absolute !important',
    insetInlineEnd: '6px !important',
    top: '100% !important',
    marginTop: '4px',
    display: 'inline-flex !important',
    gap: '4px',
  },
  // The default Accept/Reject buttons (from `mergeControls: true`) are
  // tiny — `font-size: 11px`, `padding: 2px 8px`, `border-radius: 3px`.
  // Bump them up a notch so they're easier to read while still feeling
  // like the default CodeMirror style.
  '& .cm-deletedChunk button': {
    padding: '3px 10px !important',
    fontSize: '12px !important',
    fontWeight: '500 !important',
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
      // Use the default CodeMirror Accept/Reject text buttons.
      // (Swap to `makeMergeControlButton` if you want the styled
      // icon+label version — placement would need to change too.)
      // Placement and sizing are controlled by `mergeButtonsTheme` above.
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
    // Single page scroll model: no `flex-1 min-h-0 h-full` on the root
    // (those forced the diff to fit a constrained parent, which created a
    // nested scrollbar). The diff renders at its natural content height
    // and the page-level scrollbar (on CodeInspector's center column)
    // reaches the bottom of the diff.
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
