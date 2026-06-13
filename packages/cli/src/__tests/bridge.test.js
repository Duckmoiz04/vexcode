import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

function createMockChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.pid = 99999;
  return child;
}

describe('bridge.js unit tests (mock subprocess)', () => {
  let bridge;
  let mockSpawn;
  let mockExistsSync;

  beforeEach(async () => {
    vi.resetModules();

    mockSpawn = vi.fn();
    mockExistsSync = vi.fn().mockReturnValue(true);

    vi.doMock('node:child_process', () => ({
      spawn: mockSpawn
    }));

    vi.doMock('node:fs', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        existsSync: mockExistsSync
      };
    });

    bridge = await import('../bridge.js');
  });

  describe('getPythonPath()', () => {
    it('should return a string path ending with python executable', () => {
      const pythonPath = bridge.getPythonPath();
      expect(pythonPath).toBeTypeOf('string');
      expect(pythonPath).toMatch(/python(\.exe)?$/);
    });

    it('should resolve to a path under engine/.venv', () => {
      const pythonPath = bridge.getPythonPath();
      expect(pythonPath).toMatch(/engine[/\\]\.venv[/\\]/);
    });
  });

  describe('runPythonAnalysis()', () => {
    it('should resolve with stdout and stderr on exit code 0', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runPythonAnalysis('/fake/target', '/fake/report.json', true, true);

      child.stdout.emit('data', Buffer.from('{"findings":'));
      child.stdout.emit('data', Buffer.from('[{"id":1}]}'));

      setImmediate(() => child.emit('close', 0));

      const result = await promise;
      expect(result).toEqual({
        stdout: '{"findings":[{"id":1}]}',
        stderr: ''
      });
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('should reject on non-zero exit code', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runPythonAnalysis('/fake/target', '/fake/report.json', false, false);

      child.stderr.emit('data', Buffer.from('Error: something went wrong'));
      setImmediate(() => child.emit('close', 1));

      await expect(promise).rejects.toThrow('Python process exited with code 1');
      await expect(promise).rejects.toThrow('something went wrong');
    });

    it('should reject when Python venv is not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(
        bridge.runPythonAnalysis('/fake/target', '/fake/report.json')
      ).rejects.toThrow('Python interpreter not found');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should call onProgress callback with stdout lines', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);
      const onProgress = vi.fn();

      const promise = bridge.runPythonAnalysis(
        '/fake/target', '/fake/report.json', true, true, false, onProgress
      );

      child.stdout.emit('data', Buffer.from('line1\nline2\n'));
      setImmediate(() => child.emit('close', 0));

      await promise;
      expect(onProgress).toHaveBeenCalledWith({ type: 'stdout', line: 'line1' });
      expect(onProgress).toHaveBeenCalledWith({ type: 'stdout', line: 'line2' });
    });

    it('should call onProgress callback with stderr lines', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);
      const onProgress = vi.fn();

      const promise = bridge.runPythonAnalysis(
        '/fake/target', '/fake/report.json', true, true, false, onProgress
      );

      child.stderr.emit('data', Buffer.from('warning: deprecated\n'));
      setImmediate(() => child.emit('close', 0));

      await promise;
      expect(onProgress).toHaveBeenCalledWith({ type: 'stderr', line: 'warning: deprecated' });
    });

    it('should pass --fast flag when fastScan is true', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runPythonAnalysis(
        '/fake/target', '/fake/report.json', false, false, true
      );
      setImmediate(() => child.emit('close', 0));
      await promise;

      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('--fast');
    });

    it('should reject on spawn error event', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runPythonAnalysis('/fake/target', '/fake/report.json', true, true);

      setImmediate(() => child.emit('error', new Error('ENOENT')));

      await expect(promise).rejects.toThrow('ENOENT');
    });
  });

  describe('cancelActiveScan()', () => {
    it('should kill the active process and return true', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runPythonAnalysis('/fake/target', '/fake/report.json', true, true);

      const result = bridge.cancelActiveScan();
      expect(result).toBe(true);
      expect(child.kill).toHaveBeenCalledTimes(1);

      setImmediate(() => child.emit('close', 0));
      await expect(promise).rejects.toMatchObject({
        message: 'Scan cancelled by user',
        cancelled: true
      });
    });

    it('should return false when no active scan', () => {
      const result = bridge.cancelActiveScan();
      expect(result).toBe(false);
    });
  });

  describe('runRefreshAi()', () => {
    it('should resolve with stdout and stderr on exit code 0', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runRefreshAi('/fake/report.json', true);

      child.stdout.emit('data', Buffer.from('Refresh AI complete'));
      setImmediate(() => child.emit('close', 0));

      const result = await promise;
      expect(result).toEqual({
        stdout: 'Refresh AI complete',
        stderr: ''
      });
      const args = mockSpawn.mock.calls[0][1];
      expect(args).toContain('--refresh-ai');
    });

    it('should reject when Python venv is not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(
        bridge.runRefreshAi('/fake/report.json')
      ).rejects.toThrow('Python interpreter not found');
    });

    it('should reject on non-zero exit code', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);

      const promise = bridge.runRefreshAi('/fake/report.json', false);

      child.stderr.emit('data', Buffer.from('Refresh AI failed'));
      setImmediate(() => child.emit('close', 2));

      await expect(promise).rejects.toThrow('Python process exited with code 2');
    });

    it('should call onProgress callback during refresh AI', async () => {
      const child = createMockChild();
      mockSpawn.mockReturnValue(child);
      const onProgress = vi.fn();

      const promise = bridge.runRefreshAi('/fake/report.json', true, onProgress);

      child.stdout.emit('data', Buffer.from('processing...\n'));
      setImmediate(() => child.emit('close', 0));

      await promise;
      expect(onProgress).toHaveBeenCalledWith({ type: 'stdout', line: 'processing...' });
    });
  });
});