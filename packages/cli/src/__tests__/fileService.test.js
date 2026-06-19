import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { isPathSafe, readEnvConfig, writeEnvConfig } from '../services/fileService.js';

describe('isPathSafe', () => {
  const workspace = '/home/user/project';

  it('returns true for a path inside the workspace', () => {
    expect(isPathSafe('/home/user/project/src/file.js', workspace)).toBe(true);
  });

  it('returns false for the workspace root itself', () => {
    expect(isPathSafe('/home/user/project', workspace)).toBe(false);
  });

  it('returns true for a nested subdirectory', () => {
    expect(isPathSafe('/home/user/project/src/utils/helper.js', workspace)).toBe(true);
  });

  it('returns false for a path outside the workspace', () => {
    expect(isPathSafe('/home/user/other-project', workspace)).toBe(false);
  });

  it('returns false for a path with common prefix but different directory', () => {
    expect(isPathSafe('/home/user/project-evil', workspace)).toBe(false);
  });

  it('returns false for a path escaping with ..', () => {
    expect(isPathSafe('/home/user/project/../../../etc/passwd', workspace)).toBe(false);
  });

  it('resolves relative paths before checking', () => {
    expect(isPathSafe('/home/user/project/src/../src/file.js', workspace)).toBe(true);
  });

  it('works with Windows-style paths (lowercase check)', () => {
    expect(isPathSafe('C:\\Users\\dev\\project\\src\\file.js', 'C:\\Users\\dev\\project')).toBe(true);
    expect(isPathSafe('C:\\Users\\dev\\project-evil', 'C:\\Users\\dev\\project')).toBe(false);
  });
});

describe('readEnvConfig', () => {
  it('returns empty object for non-existent path', () => {
    expect(readEnvConfig('/non/existent/path/.env')).toEqual({});
  });
});

describe('writeEnvConfig', () => {
  it('throws when writing to an invalid path', () => {
    expect(() => writeEnvConfig({}, '/invalid/path/.env')).toThrow();
  });
});