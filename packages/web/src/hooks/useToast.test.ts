import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null toast initially', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
  });

  it('showToast sets toast message and type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Saved!', 'success');
    });

    expect(result.current.toast).toEqual({ message: 'Saved!', type: 'success' });
  });

  it('showToast defaults type to success', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Done');
    });

    expect(result.current.toast).toEqual({ message: 'Done', type: 'success' });
  });

  it('showToast with error type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Failed!', 'error');
    });

    expect(result.current.toast).toEqual({ message: 'Failed!', type: 'error' });
  });

  it('auto-dismisses toast after 3 seconds', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Will disappear');
    });

    expect(result.current.toast).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.toast).toBeNull();
  });

  it('clears previous timeout when new toast is shown', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First');
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      result.current.showToast('Second');
    });

    // After 2 more seconds (3s from first would have elapsed), second should still be visible
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.toast).toEqual({ message: 'Second', type: 'success' });

    // After 3s from second toast, it should clear
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toast).toBeNull();
  });

  it('showToast is stable across renders', () => {
    const { result, rerender } = renderHook(() => useToast());
    const firstShowToast = result.current.showToast;

    rerender();

    expect(result.current.showToast).toBe(firstShowToast);
  });
});