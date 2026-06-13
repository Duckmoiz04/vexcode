import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';
import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// ─── Theme Definition ────────────────────────────────────────────────────────

export interface ThemeDefinition {
  id: string;
  name: string;
  extension: Extension;
  dark: boolean;
}

// ─── Compartment helpers ─────────────────────────────────────────────────────

export const themeCompartment = new Compartment();

export const reconfigureTheme = (view: { dispatch: (spec: { effects: unknown }) => void } | null, theme: Extension) => {
  if (!view) return;
  view.dispatch({
    effects: themeCompartment.reconfigure(theme),
  });
};

// ─── Base editor styling (shared across themes) ──────────────────────────────

export const baseEditorTheme = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace' },
  '.cm-line': {
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '22px',
    fontVariantLigatures: 'normal',
  },
});

// ─── 1. Vesper ───────────────────────────────────────────────────────────────
// Dark theme with peach/orange accent by Rauno Freiberg (Vercel)

const vesper = createTheme({
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

// ─── 2. One Dark ─────────────────────────────────────────────────────────────

const oneDark = createTheme({
  theme: 'dark',
  settings: {
    background: '#282C34',
    foreground: '#ABB2BF',
    caret: '#528BFF',
    selection: '#3E4451',
    selectionMatch: '#3E445155',
    lineHighlight: '#2C313A',
    gutterBackground: '#282C34',
    gutterForeground: '#636D83',
    gutterActiveForeground: '#ABB2BF',
    gutterBorder: '1px solid #2C313A',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: '14px',
  },
  styles: [
    { tag: t.keyword, color: '#C678DD' },
    { tag: t.operatorKeyword, color: '#C678DD' },
    { tag: t.controlKeyword, color: '#C678DD' },
    { tag: t.operator, color: '#56B6C2' },
    { tag: t.punctuation, color: '#ABB2BF' },
    { tag: t.angleBracket, color: '#ABB2BF' },
    { tag: t.tagName, color: '#E06C75' },
    { tag: t.comment, color: '#5C6370', fontStyle: 'italic' },
    { tag: t.docComment, color: '#5C6370', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#5C6370', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#5C6370', fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: '#61AFEF' },
    { tag: t.number, color: '#D19A66' },
    { tag: t.bool, color: '#D19A66' },
    { tag: t.null, color: '#D19A66' },
    { tag: t.constant(t.variableName), color: '#D19A66' },
    { tag: t.self, color: '#E5C07B' },
    { tag: t.labelName, color: '#E5C07B' },
    { tag: t.typeName, color: '#E5C07B' },
    { tag: t.className, color: '#E5C07B' },
    { tag: t.definition(t.typeName), color: '#E5C07B' },
    { tag: t.attributeName, color: '#E5C07B' },
    { tag: t.propertyName, color: '#E5C07B' },
    { tag: t.string, color: '#98C379' },
    { tag: t.special(t.string), color: '#98C379' },
    { tag: t.variableName, color: '#E06C75' },
    { tag: t.regexp, color: '#98C379' },
    { tag: t.heading, color: '#61AFEF', fontWeight: 'bold' },
    { tag: t.strong, color: '#E06C75', fontWeight: 'bold' },
    { tag: t.emphasis, color: '#E06C75', fontStyle: 'italic' },
    { tag: t.link, color: '#61AFEF' },
    { tag: t.meta, color: '#5C6370' },
  ],
});

// ─── 3. GitHub Light ─────────────────────────────────────────────────────────

const githubLight = createTheme({
  theme: 'light',
  settings: {
    background: '#FFF',
    foreground: '#24292F',
    caret: '#0969DA',
    selection: '#0366D622',
    selectionMatch: '#0366D622',
    lineHighlight: '#F6F8FA',
    gutterBackground: '#FFF',
    gutterForeground: '#6E7681',
    gutterActiveForeground: '#24292F',
    gutterBorder: '1px solid #D0D7DE',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: '14px',
  },
  styles: [
    { tag: t.keyword, color: '#CF222E' },
    { tag: t.operatorKeyword, color: '#CF222E' },
    { tag: t.controlKeyword, color: '#CF222E' },
    { tag: t.operator, color: '#0550AE' },
    { tag: t.punctuation, color: '#24292F' },
    { tag: t.angleBracket, color: '#24292F' },
    { tag: t.tagName, color: '#116329' },
    { tag: t.comment, color: '#6E7781', fontStyle: 'italic' },
    { tag: t.docComment, color: '#6E7781', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#6E7781', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#6E7781', fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: '#8250DF' },
    { tag: t.number, color: '#0550AE' },
    { tag: t.bool, color: '#0550AE' },
    { tag: t.null, color: '#0550AE' },
    { tag: t.constant(t.variableName), color: '#0550AE' },
    { tag: t.self, color: '#953800' },
    { tag: t.labelName, color: '#953800' },
    { tag: t.typeName, color: '#953800' },
    { tag: t.className, color: '#953800' },
    { tag: t.definition(t.typeName), color: '#953800' },
    { tag: t.attributeName, color: '#953800' },
    { tag: t.propertyName, color: '#953800' },
    { tag: t.string, color: '#0A3069' },
    { tag: t.special(t.string), color: '#0A3069' },
    { tag: t.variableName, color: '#953800' },
    { tag: t.regexp, color: '#0A3069' },
    { tag: t.heading, color: '#0550AE', fontWeight: 'bold' },
    { tag: t.strong, color: '#24292F', fontWeight: 'bold' },
    { tag: t.emphasis, color: '#24292F', fontStyle: 'italic' },
    { tag: t.link, color: '#0969DA' },
    { tag: t.meta, color: '#6E7781' },
  ],
});

// ─── 4. Nord ─────────────────────────────────────────────────────────────────

const nord = createTheme({
  theme: 'dark',
  settings: {
    background: '#2E3440',
    foreground: '#D8DEE9',
    caret: '#88C0D0',
    selection: '#434C5E',
    selectionMatch: '#434C5E55',
    lineHighlight: '#3B4252',
    gutterBackground: '#2E3440',
    gutterForeground: '#616E88',
    gutterActiveForeground: '#D8DEE9',
    gutterBorder: '1px solid #3B4252',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: '14px',
  },
  styles: [
    { tag: t.keyword, color: '#81A1C1' },
    { tag: t.operatorKeyword, color: '#81A1C1' },
    { tag: t.controlKeyword, color: '#81A1C1' },
    { tag: t.operator, color: '#88C0D0' },
    { tag: t.punctuation, color: '#D8DEE9' },
    { tag: t.angleBracket, color: '#D8DEE9' },
    { tag: t.tagName, color: '#81A1C1' },
    { tag: t.comment, color: '#616E88', fontStyle: 'italic' },
    { tag: t.docComment, color: '#616E88', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#616E88', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#616E88', fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: '#88C0D0' },
    { tag: t.number, color: '#B48EAD' },
    { tag: t.bool, color: '#B48EAD' },
    { tag: t.null, color: '#B48EAD' },
    { tag: t.constant(t.variableName), color: '#B48EAD' },
    { tag: t.self, color: '#8FBCBB' },
    { tag: t.labelName, color: '#8FBCBB' },
    { tag: t.typeName, color: '#8FBCBB' },
    { tag: t.className, color: '#8FBCBB' },
    { tag: t.definition(t.typeName), color: '#8FBCBB' },
    { tag: t.attributeName, color: '#8FBCBB' },
    { tag: t.propertyName, color: '#8FBCBB' },
    { tag: t.string, color: '#A3BE8C' },
    { tag: t.special(t.string), color: '#A3BE8C' },
    { tag: t.variableName, color: '#D8DEE9' },
    { tag: t.regexp, color: '#A3BE8C' },
    { tag: t.heading, color: '#88C0D0', fontWeight: 'bold' },
    { tag: t.strong, color: '#D8DEE9', fontWeight: 'bold' },
    { tag: t.emphasis, color: '#D8DEE9', fontStyle: 'italic' },
    { tag: t.link, color: '#88C0D0' },
    { tag: t.meta, color: '#616E88' },
  ],
});

// ─── 5. Dracula ──────────────────────────────────────────────────────────────

const dracula = createTheme({
  theme: 'dark',
  settings: {
    background: '#282A36',
    foreground: '#F8F8F2',
    caret: '#F8F8F2',
    selection: '#44475A',
    selectionMatch: '#44475A55',
    lineHighlight: '#313347',
    gutterBackground: '#282A36',
    gutterForeground: '#6272A4',
    gutterActiveForeground: '#F8F8F2',
    gutterBorder: '1px solid #313347',
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontSize: '14px',
  },
  styles: [
    { tag: t.keyword, color: '#FF79C6' },
    { tag: t.operatorKeyword, color: '#FF79C6' },
    { tag: t.controlKeyword, color: '#FF79C6' },
    { tag: t.operator, color: '#FF79C6' },
    { tag: t.punctuation, color: '#F8F8F2' },
    { tag: t.angleBracket, color: '#F8F8F2' },
    { tag: t.tagName, color: '#FF79C6' },
    { tag: t.comment, color: '#6272A4', fontStyle: 'italic' },
    { tag: t.docComment, color: '#6272A4', fontStyle: 'italic' },
    { tag: t.lineComment, color: '#6272A4', fontStyle: 'italic' },
    { tag: t.blockComment, color: '#6272A4', fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: '#50FA7B' },
    { tag: t.number, color: '#BD93F9' },
    { tag: t.bool, color: '#BD93F9' },
    { tag: t.null, color: '#BD93F9' },
    { tag: t.constant(t.variableName), color: '#BD93F9' },
    { tag: t.self, color: '#50FA7B' },
    { tag: t.labelName, color: '#F1FA8C' },
    { tag: t.typeName, color: '#8BE9FD' },
    { tag: t.className, color: '#8BE9FD' },
    { tag: t.definition(t.typeName), color: '#8BE9FD' },
    { tag: t.attributeName, color: '#50FA7B' },
    { tag: t.propertyName, color: '#66D9EF' },
    { tag: t.string, color: '#F1FA8C' },
    { tag: t.special(t.string), color: '#F1FA8C' },
    { tag: t.variableName, color: '#F8F8F2' },
    { tag: t.regexp, color: '#F1FA8C' },
    { tag: t.heading, color: '#BD93F9', fontWeight: 'bold' },
    { tag: t.strong, color: '#FF79C6', fontWeight: 'bold' },
    { tag: t.emphasis, color: '#FF79C6', fontStyle: 'italic' },
    { tag: t.link, color: '#8BE9FD' },
    { tag: t.meta, color: '#6272A4' },
  ],
});

// ─── Registry ────────────────────────────────────────────────────────────────

export const themeRegistry: ThemeDefinition[] = [
  { id: 'vesper', name: 'Vesper', extension: vesper, dark: true },
  { id: 'oneDark', name: 'One Dark', extension: oneDark, dark: true },
  { id: 'nord', name: 'Nord', extension: nord, dark: true },
  { id: 'dracula', name: 'Dracula', extension: dracula, dark: true },
  { id: 'githubLight', name: 'GitHub Light', extension: githubLight, dark: false },
];

export const defaultTheme = themeRegistry[0];
