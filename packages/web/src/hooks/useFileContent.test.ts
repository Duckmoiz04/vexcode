import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFileContent } from './useFileContent';

vi.mock('../utils/apiClient', () => ({
  apiFetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => init ? fetch(input, init) : fetch(input)),
  getApiKey: () => Promise.resolve('test-key'),
}));

describe('useFileContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loading=true initially, then content on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, content: 'line1\nline2\nline3' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useFileContent('/test/file.ts'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.content).toBe('');
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.content).toBe('line1\nline2\nline3');
    expect(result.current.error).toBeNull();
  });

  it('returns error when API response success=false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useFileContent('/test/file.ts'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.content).toBe('');
    expect(result.current.error).toBe('Failed to load file content');
  });

  it('returns error when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useFileContent('/test/file.ts'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.content).toBe('');
    expect(result.current.error).toBe('Network error');
  });

  it('returns empty content for null filePath', () => {
    const { result } = renderHook(() => useFileContent(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.content).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('aborts previous request when filePath changes', async () => {
    const abortSpy = vi.fn();
    const origAbortController = globalThis.AbortController;

    class MockAbortController {
      signal = 'mock-signal';
      abort = abortSpy;
    }
    // @ts-expect-error - mock AbortController
    globalThis.AbortController = MockAbortController;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, content: 'content' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result, rerender } = renderHook(
      ({ filePath }: { filePath: string | null }) => useFileContent(filePath),
      { initialProps: { filePath: '/test/a.ts' } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ filePath: '/test/b.ts' });

    expect(abortSpy).toHaveBeenCalled();

    globalThis.AbortController = origAbortController;
  });
});