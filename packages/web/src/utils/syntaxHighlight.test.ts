import { describe, it, expect } from 'vitest';
import { highlightToSegments, CodeHighlight } from './syntaxHighlight';
import React from 'react';

describe('highlightToSegments', () => {
  it('highlights JavaScript control keywords', () => {
    const segs = highlightToSegments('import React from "react";', 'test.js');
    const controlSegs = segs.filter(s => s.className === 'tok-control');
    expect(controlSegs.length).toBeGreaterThanOrEqual(1);
    expect(controlSegs.some(s => s.text === 'import')).toBe(true);
  });

  it('highlights Python keywords', () => {
    const segs = highlightToSegments('def hello(name):', 'test.py');
    const keywordSegs = segs.filter(s => s.className === 'tok-keyword');
    expect(keywordSegs.some(s => s.text === 'def')).toBe(true);
  });

  it('preserves leading whitespace in segments', () => {
    const segs = highlightToSegments('  import React from "react";', 'test.js');
    const firstSeg = segs[0];
    expect(firstSeg.text).toBe('  ');
    expect(firstSeg.className).toBe('');
  });

  it('handles unknown extension gracefully', () => {
    const segs = highlightToSegments('some plain text', 'file.unknown');
    expect(segs.length).toBe(1);
    expect(segs[0].className).toBe('');
    expect(segs[0].text).toBe('some plain text');
  });

  it('handles null filepath gracefully', () => {
    const segs = highlightToSegments('some text', null);
    expect(segs.length).toBe(1);
    expect(segs[0].className).toBe('');
  });

  it('highlights TypeScript types', () => {
    const segs = highlightToSegments('const x: string = "hello";', 'test.ts');
    expect(segs.some(s => s.className === 'tok-type')).toBe(true);
  });

  it('highlights strings', () => {
    const segs = highlightToSegments('const x = "hello";', 'test.js');
    const stringSegs = segs.filter(s => s.className === 'tok-string');
    expect(stringSegs.length).toBeGreaterThanOrEqual(1);
  });
});
