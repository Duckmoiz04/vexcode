import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useAutoScroll } from './useAutoScroll';

describe('useAutoScroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls scrollIntoView on the ref element after delay when trigger changes', () => {
    const scrollIntoViewMock = vi.fn();
    const mockElement = { scrollIntoView: scrollIntoViewMock };

    const { result, rerender } = renderHook(
      ({ trigger }: { trigger: number }) => {
        const ref = useRef<HTMLDivElement | null>(null);
        // @ts-expect-error - mock ref for testing
        ref.current = mockElement;
        useAutoScroll(ref as React.RefObject<HTMLElement>, trigger);
        return ref;
      },
      { initialProps: { trigger: 1 } }
    );

    // First render: no previous trigger, should not scroll yet
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    // Change trigger
    rerender({ trigger: 42 });

    // Fast-forward past the 150ms delay
    vi.advanceTimersByTime(200);

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  });

  it('does not scroll when ref is null', () => {
    const { rerender } = renderHook(
      ({ trigger }: { trigger: number }) => {
        const ref = useRef<HTMLDivElement | null>(null);
        useAutoScroll(ref as React.RefObject<HTMLElement>, trigger);
        return ref;
      },
      { initialProps: { trigger: 1 } }
    );

    rerender({ trigger: 2 });
    vi.advanceTimersByTime(200);

    // Should not throw
    expect(true).toBe(true);
  });

  it('cleans up timeout on unmount', () => {
    const scrollIntoViewMock = vi.fn();
    const mockElement = { scrollIntoView: scrollIntoViewMock };

    const { unmount, rerender } = renderHook(
      ({ trigger }: { trigger: number }) => {
        const ref = useRef<HTMLDivElement | null>(null);
        // @ts-expect-error - mock ref for testing
        ref.current = mockElement;
        useAutoScroll(ref as React.RefObject<HTMLElement>, trigger);
        return ref;
      },
      { initialProps: { trigger: 1 } }
    );

    rerender({ trigger: 2 });
    unmount();
    vi.advanceTimersByTime(200);

    // scrollIntoView should NOT be called after unmount
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });
});