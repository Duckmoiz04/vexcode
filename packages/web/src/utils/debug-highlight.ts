import { highlightToSegments } from './syntaxHighlight';

const tests = [
  { code: 'import React from "react";', file: 'test.js' },
  { code: 'import React from "react";', file: 'test.tsx' },
  { code: 'var x = 1;', file: 'test.js' },
  { code: 'def hello(name):', file: 'test.py' },
  { code: 'print("hi")', file: 'test.py' },
  { code: 'const x: string = "hello";', file: 'test.ts' },
];

for (const { code, file } of tests) {
  const segs = highlightToSegments(code, file);
  const withClass = segs.filter(s => s.className);
  console.log(`\n${file}: "${code}"`);
  console.log(`  ${withClass.length}/${segs.length} segments have classes`);
  for (const s of segs) {
    console.log(`  [${s.className || '(none)'}] ${JSON.stringify(s.text)}`);
  }
}
