import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConfig } from './useConfig';
import type { Config } from '../types';

const mockShowToast = vi.fn();

describe('useConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockShowToast.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderUseConfig() {
    return renderHook(() => useConfig(mockShowToast));
  }

  it('returns null config initially', () => {
    const { result } = renderUseConfig();
    expect(result.current.config).toBeNull();
  });

  it('returns isSettingsOpen false initially', () => {
    const { result } = renderUseConfig();
    expect(result.current.isSettingsOpen).toBe(false);
  });

  it('loads config from /api/config on mount', async () => {
    const mockConfig: Config = { AI_PROVIDER: 'openai', AI_TEMPERATURE: '0.5' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      json: () => Promise.resolve(mockConfig),
    } as Response);

    const { result } = renderUseConfig();

    await waitFor(() => {
      expect(result.current.config).toEqual(mockConfig);
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/config');
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderUseConfig();

    // Config stays null on error
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(result.current.config).toBeNull();
    consoleSpy.mockRestore();
  });

  it('setIsSettingsOpen toggles settings drawer', () => {
    const { result } = renderUseConfig();

    act(() => {
      result.current.setIsSettingsOpen(true);
    });

    expect(result.current.isSettingsOpen).toBe(true);

    act(() => {
      result.current.setIsSettingsOpen(false);
    });

    expect(result.current.isSettingsOpen).toBe(false);
  });

  it('handleSaveConfig POSTs config and shows success toast', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      // initial loadConfig on mount
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ AI_PROVIDER: 'openai' }),
      } as Response)
      // POST /api/config
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      } as Response)
      // reload config after save
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ AI_PROVIDER: 'anthropic' }),
      } as Response);

    const { result } = renderUseConfig();

    // Wait for initial loadConfig to settle
    await vi.waitFor(() => {
      expect(result.current.config).not.toBeNull();
    });

    await act(async () => {
      await result.current.handleSaveConfig({ AI_PROVIDER: 'anthropic' });
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ AI_PROVIDER: 'anthropic' }),
    });

    expect(mockShowToast).toHaveBeenCalledWith('Configuration saved successfully!');
    expect(result.current.isSettingsOpen).toBe(false);
  });

  it('handleSaveConfig shows error toast on failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      // initial loadConfig on mount
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ AI_PROVIDER: 'openai' }),
      } as Response)
      // POST /api/config returns error
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'Invalid config' }),
      } as Response);

    const { result } = renderUseConfig();

    // Wait for initial loadConfig to settle
    await vi.waitFor(() => {
      expect(result.current.config).not.toBeNull();
    });

    await act(async () => {
      await result.current.handleSaveConfig({ AI_PROVIDER: '' });
    });

    expect(mockShowToast).toHaveBeenCalledWith('Invalid config', 'error');
  });

  it('handleSaveConfig shows error toast on network failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      // initial loadConfig on mount
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ AI_PROVIDER: 'openai' }),
      } as Response)
      // POST /api/config rejected
      .mockRejectedValueOnce(new Error('Offline'));

    const { result } = renderUseConfig();

    // Wait for initial loadConfig to settle
    await vi.waitFor(() => {
      expect(result.current.config).not.toBeNull();
    });

    await act(async () => {
      await result.current.handleSaveConfig({ AI_PROVIDER: 'test' });
    });

    expect(mockShowToast).toHaveBeenCalledWith('Save config failed: Offline', 'error');
  });
});