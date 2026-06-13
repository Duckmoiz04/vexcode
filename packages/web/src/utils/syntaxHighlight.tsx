import React from 'react';
import { tags as t, tagHighlighter, highlightCode, type Highlighter } from '@lezer/highlight';
import type { Tree } from '@lezer/common';
import { pythonLanguage } from '@codemirror/lang-python';
import { javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from '@codemirror/lang-javascript';
import { jsonLanguage } from '@codemirror/lang-json';
import { cssLanguage } from '@codemirror/lang-css';
import { htmlLanguage } from '@codemirror/lang-html';

// ─── Vesper Theme → tagHighlighter ───────────────────────────────────────────
// Mirrors vesperTheme.ts colors for inline highlight consistency

const vesperHighlighter: Highlighter = tagHighlighter([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.atom, t.bool, t.standard(t.name), t.standard(t.tagName), t.special(t.brace), t.color, t.constant(t.name), t.special(t.variableName)], class: 'tok-keyword' },
  { tag: [t.controlKeyword, t.moduleKeyword], class: 'tok-control' },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.propertyName, t.variableName, t.labelName, t.definition(t.name)], class: 'tok-definition' },
  { tag: t.heading, class: 'tok-heading' },
  { tag: [t.typeName, t.className, t.tagName, t.changed, t.annotation, t.self, t.namespace], class: 'tok-type' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-func' },
  { tag: [t.number], class: 'tok-number' },
  { tag: [t.operator, t.punctuation, t.separator, t.url, t.escape, t.regexp], class: 'tok-operator' },
  { tag: [t.regexp], class: 'tok-regexp' },
  { tag: [t.special(t.string), t.processingInstruction, t.string, t.inserted], class: 'tok-string' },
  { tag: [t.angleBracket], class: 'tok-angle' },
  { tag: t.strong, class: 'tok-strong' },
  { tag: t.emphasis, class: 'tok-emphasis' },
  { tag: t.strikethrough, class: 'tok-strikethrough' },
  { tag: [t.meta, t.comment], class: 'tok-comment' },
  { tag: t.link, class: 'tok-link' },
  { tag: t.invalid, class: 'tok-invalid' },
]);

// ─── Language Resolution ─────────────────────────────────────────────────────

const getParser = (filePath: string | null | undefined): { parse(code: string): Tree } | null => {
  if (!filePath) return null;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'py':
      return pythonLanguage.parser;
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascriptLanguage.parser;
    case 'jsx':
      return jsxLanguage.parser;
    case 'ts':
      return typescriptLanguage.parser;
    case 'tsx':
      return tsxLanguage.parser;
    case 'json':
      return jsonLanguage.parser;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return cssLanguage.parser;
    case 'html':
    case 'htm':
    case 'xml':
    case 'vue':
      return htmlLanguage.parser;
    default:
      return null;
  }
};

// ─── Highlight to Segments ───────────────────────────────────────────────────

export interface Segment {
  text: string;
  className: string;
}

/**
 * Parse and highlight a code chunk using CodeMirror's lezer parser and the
 * Vesper theme. Returns an array of { text, className } segments.
 * Falls back to unstyled plain text if no parser is available.
 */
export function highlightToSegments(code: string, filePath: string | null | undefined): Segment[] {
  const parser = getParser(filePath);
  if (!parser) {
    return [{ text: code, className: '' }];
  }

  try {
    const tree = parser.parse(code);
    const segments: Segment[] = [];

    highlightCode(
      code,
      tree,
      vesperHighlighter,
      (text: string, cls: string) => {
        segments.push({ text, className: cls || '' });
      },
      () => {
        segments.push({ text: '\n', className: '' });
      },
    );

    return segments;
  } catch {
    return [{ text: code, className: '' }];
  }
}

// ─── React Component ─────────────────────────────────────────────────────────

interface CodeHighlightProps {
  code: string;
  filePath: string | null | undefined;
}

/**
 * Renders a code string with CodeMirror/lezer syntax highlighting.
 * Uses the Vesper theme colors. This is a drop-in replacement for
 * react-syntax-highlighter for inline code rendering.
 */
export const CodeHighlight: React.FC<CodeHighlightProps> = ({ code, filePath }) => {
  const segments = highlightToSegments(code, filePath);

  return (
    <>
      {/* Inline <style> to prevent Tailwind v4 Lightning CSS from tree-shaking these rules */}
      <style>{`
.tok-keyword   { color: #A0A0A0; }
.tok-control   { color: #A0A0A0; }
.tok-definition { color: #FFF; }
.tok-heading   { color: #FFC799; font-weight: bold; }
.tok-type      { color: #FFC799; }
.tok-func      { color: #FFC799; }
.tok-number    { color: #FFC799; }
.tok-operator  { color: #A0A0A0; }
.tok-regexp    { color: #FFF; }
.tok-string    { color: #FFF; }
.tok-angle     { color: #A0A0A0; }
.tok-strong     { font-weight: bold; }
.tok-emphasis   { font-style: italic; }
.tok-strikethrough { text-decoration: line-through; }
.tok-comment   { color: #A0A0A0; font-style: italic; }
.tok-link      { color: #A0A0A0; text-decoration: underline; }
.tok-invalid   { color: #FF0000; }
`}</style>
      <span style={{ fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', whiteSpace: 'pre' }}>
        {segments.map((seg, i) =>
          seg.className ? (
            <span key={i} className={seg.className}>{seg.text}</span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </span>
    </>
  );
};
