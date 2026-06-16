import { describe, it, expect } from 'vitest';
import { constructFixedFile } from './FileViewer';

describe('constructFixedFile', () => {
  it('replaces a single-line target with a multi-line replacement', () => {
    const original = 'line1\ntarget_line\nline3\nline4';
    const result = constructFixedFile(original, 2, 'target_line', 'replacement_a\nreplacement_b');
    expect(result).toBe('line1\nreplacement_a\nreplacement_b\nline3\nline4');
  });

  it('replaces a multi-line target block', () => {
    const original = 'a\nb\ntarget1\ntarget2\nc';
    const result = constructFixedFile(original, 3, 'target1\ntarget2', 'FIXED');
    expect(result).toBe('a\nb\nFIXED\nc');
  });

  it('preserves CRLF line endings', () => {
    const original = 'line1\r\ntarget\r\nline3';
    const result = constructFixedFile(original, 2, 'target', 'fixed');
    expect(result).toContain('\r\n');
    expect(result).toBe('line1\r\nfixed\r\nline3');
  });

  it('preserves original indentation when target matches after trim', () => {
    const original = 'def foo():\n    old_code()\n    pass';
    const result = constructFixedFile(original, 2, 'old_code()', 'new_code()');
    expect(result).toBe('def foo():\n    new_code()\n    pass');
  });

  it('returns original unchanged when target not found', () => {
    const original = 'a\nb\nc';
    const result = constructFixedFile(original, 2, 'does_not_exist', 'replacement');
    expect(result).toBe(original);
  });

  it('returns original unchanged for invalid line number', () => {
    const original = 'a\nb\nc';
    expect(constructFixedFile(original, 0, 'a', 'x')).toBe(original);
    expect(constructFixedFile(original, -1, 'a', 'x')).toBe(original);
    expect(constructFixedFile(original, 100, 'a', 'x')).toBe(original);
  });

  it('returns original unchanged for empty inputs', () => {
    expect(constructFixedFile('', 1, 'a', 'b')).toBe('');
    expect(constructFixedFile('abc', 1, '', 'b')).toBe('abc');
    expect(constructFixedFile('abc', 1, 'a', '')).toBe('abc');
  });

  it('handles substring match', () => {
    const original = 'prefix target_line suffix';
    const result = constructFixedFile(original, 1, 'target_line', 'REPLACED');
    expect(result).toBe('prefix REPLACED suffix');
  });

  describe('indentation normalization', () => {
    it('re-indents a no-indent replacement to match a 4-space target', () => {
      // Original is nested inside a function — 4 spaces
      const original = 'def foo():\n    exec(user_input)\n    pass';
      // AI returns the fix at indent 0
      const replacement = 'import subprocess\nsubprocess.run(["echo", user_input])';
      const result = constructFixedFile(original, 2, 'exec(user_input)', replacement);
      expect(result).toBe(
        'def foo():\n    import subprocess\n    subprocess.run(["echo", user_input])\n    pass',
      );
    });

    it('re-indents to match 8-space (nested class + method) target', () => {
      const original = 'class A:\n    def m(self):\n        old()\n        return';
      const replacement = 'new_call()\nother_call()';
      const result = constructFixedFile(original, 3, 'old()', replacement);
      expect(result).toBe('class A:\n    def m(self):\n        new_call()\n        other_call()\n        return');
    });

    it('preserves relative indentation in the replacement', () => {
      // AI snippet already has internal structure: one line base-indent, one nested
      const original = 'def f():\n    old()\n    return';
      const replacement = 'if x:\n    do_y()\nelse:\n    do_z()';
      const result = constructFixedFile(original, 2, 'old()', replacement);
      // All non-empty lines should be shifted by 4 spaces; relative structure preserved
      expect(result).toBe('def f():\n    if x:\n        do_y()\n    else:\n        do_z()\n    return');
    });

    it('leaves target with no indent unchanged', () => {
      const original = 'a\nb\nc';
      const result = constructFixedFile(original, 2, 'b', 'B');
      expect(result).toBe('a\nB\nc');
    });

    it('preserves tab-based indentation', () => {
      const original = 'function f() {\n\told();\n\treturn;\n}';
      const replacement = 'new();\ncleanup();';
      const result = constructFixedFile(original, 2, 'old();', replacement);
      expect(result).toBe('function f() {\n\tnew();\n\tcleanup();\n\treturn;\n}');
    });

    it('handles blank lines inside the replacement without indenting them', () => {
      const original = 'def f():\n    old()\n    return';
      const replacement = 'a = 1\n\nb = 2';
      const result = constructFixedFile(original, 2, 'old()', replacement);
      expect(result).toBe('def f():\n    a = 1\n\n    b = 2\n    return');
    });
  });
});