import { describe, it, expect, vi } from 'vitest';
import { makeMergeControlButton } from './DiffViewer';

describe('makeMergeControlButton', () => {
  it('returns a <button> element with the correct class for accept', () => {
    const action = vi.fn();
    const btn = makeMergeControlButton('accept', action);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toContain('cm-merge-btn');
    expect(btn.className).toContain('cm-merge-btn-accept');
  });

  it('returns a <button> element with the correct class for reject', () => {
    const action = vi.fn();
    const btn = makeMergeControlButton('reject', action);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toContain('cm-merge-btn');
    expect(btn.className).toContain('cm-merge-btn-reject');
  });

  it('renders an SVG icon and a label', () => {
    const action = vi.fn();
    const acceptBtn = makeMergeControlButton('accept', action);
    expect(acceptBtn.querySelector('svg')).toBeTruthy();
    const acceptLabel = acceptBtn.querySelector('.cm-merge-btn-label');
    expect(acceptLabel?.textContent).toBe('Apply');

    const rejectBtn = makeMergeControlButton('reject', action);
    expect(rejectBtn.querySelector('svg')).toBeTruthy();
    const rejectLabel = rejectBtn.querySelector('.cm-merge-btn-label');
    expect(rejectLabel?.textContent).toBe('Decline');
  });

  it('sets inline styles so the button always renders visibly', () => {
    const btn = makeMergeControlButton('accept', vi.fn());
    // Inline styles win over external stylesheets
    expect(btn.style.display).toBe('inline-flex');
    expect(btn.style.cursor).toBe('pointer');
    expect(btn.style.padding).toBe('4px 10px');
    expect(btn.style.fontSize).toBe('11px');
    expect(btn.style.fontWeight).toBe('600');
    expect(btn.style.borderRadius).toBe('5px');
    // Color is set inline; jsdom normalizes hsl() to rgb() so we check
    // for any non-empty value (the inline color is what reaches the DOM).
    expect(btn.style.color).toBeTruthy();
  });

  it('uses a different color for accept vs reject', () => {
    const acceptBtn = makeMergeControlButton('accept', vi.fn());
    const rejectBtn = makeMergeControlButton('reject', vi.fn());
    // Accept and reject must have visually different colors
    expect(acceptBtn.style.color).not.toBe(rejectBtn.style.color);
    expect(acceptBtn.style.color).toBeTruthy();
    expect(rejectBtn.style.color).toBeTruthy();
  });

  it('sets title for accessibility', () => {
    expect(makeMergeControlButton('accept', vi.fn()).title).toBe('Accept this change');
    expect(makeMergeControlButton('reject', vi.fn()).title).toBe('Reject this change');
  });

  it('invokes the action on mousedown', () => {
    const action = vi.fn();
    const btn = makeMergeControlButton('accept', action);
    const ev = new MouseEvent('mousedown', { bubbles: true });
    btn.dispatchEvent(ev);
    expect(action).toHaveBeenCalled();
  });
});
