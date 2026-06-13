import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

// Vesper theme by Rauno Freiberg (Vercel)
// Dark theme with peach/orange accent (#FFC799) and muted grays (#A0A0A0)

export const vesperTheme: Extension = createTheme({
  theme: 'dark',
  settings: {
    background: '#0B0B0B',
    foreground: '#FFF',
    caret: '#FFC799',
    selection: '#5C6773',
    selectionMatch: '#5C677355',
    lineHighlight: '#1A1A1A',
    gutterBackground: '#0B0B0B',
    gutterForeground: '#666',
    gutterActiveForeground: '#FFF',
    gutterBorder: '1px solid #1A1A1A',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: '14px',
  },
  styles: [
    // Grays — keywords, operators, punctuation
    { tag: t.keyword, color: '#A0A0A0' },
    { tag: t.operatorKeyword, color: '#A0A0A0' },
    { tag: t.controlKeyword, color: '#A0A0A0' },
    { tag: t.operator, color: '#A0A0A0' },
    { tag: t.punctuation, color: '#A0A0A0' },
    { tag: t.angleBracket, color: '#A0A0A0' },
    { tag: t.tagName, color: '#A0A0A0' },
    { tag: t.comment, color: '#A0A0A0', fontStyle: 'italic' },
    { tag: t.docComment, color: '#A0A0A0', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#A0A0A0', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#A0A0A0', fontStyle: 'italic' },

    // Peach/orange — functions, numbers, types, constants
    { tag: t.function(t.variableName), color: '#FFC799' },
    { tag: t.number, color: '#FFC799' },
    { tag: t.bool, color: '#FFC799' },
    { tag: t.null, color: '#FFC799' },
    { tag: t.constant(t.variableName), color: '#FFC799' },
    { tag: t.self, color: '#FFC799' },
    { tag: t.labelName, color: '#FFC799' },
    { tag: t.typeName, color: '#FFC799' },
    { tag: t.className, color: '#FFC799' },
    { tag: t.definition(t.typeName), color: '#FFC799' },
    { tag: t.attributeName, color: '#FFC799' },
    { tag: t.propertyName, color: '#FFC799' },

    // White — strings, text, variable names
    { tag: t.string, color: '#FFF' },
    { tag: t.special(t.string), color: '#FFF' },
    { tag: t.variableName, color: '#FFF' },
    { tag: t.regexp, color: '#FFF' },
    { tag: t.heading, color: '#FFC799', fontWeight: 'bold' },
    { tag: t.strong, color: '#FFF', fontWeight: 'bold' },
    { tag: t.emphasis, color: '#FFF', fontStyle: 'italic' },
    { tag: t.link, color: '#FFF' },
    { tag: t.meta, color: '#A0A0A0' },
  ],
});
