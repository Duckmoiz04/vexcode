import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { pythonLanguage } from '@codemirror/lang-python';
import { javascriptLanguage, typescriptLanguage, jsxLanguage, tsxLanguage } from '@codemirror/lang-javascript';
import { jsonLanguage } from '@codemirror/lang-json';
import { cssLanguage } from '@codemirror/lang-css';
import { htmlLanguage } from '@codemirror/lang-html';
import type { Extension } from '@codemirror/state';
import { baseEditorTheme } from '../../utils/themes.ts';

// ─── Extension resolution ─────────────────────────────────────────────────────

const getLanguageExtension = (filePath: string | null | undefined) => {
  if (!filePath) return [];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'py':
      return pythonLanguage;
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascriptLanguage;
    case 'jsx':
      return jsxLanguage;
    case 'ts':
      return typescriptLanguage;
    case 'tsx':
      return tsxLanguage;
    case 'json':
      return jsonLanguage;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return cssLanguage;
    case 'html':
    case 'htm':
    case 'xml':
    case 'vue':
      return htmlLanguage;
    default:
      return [];
  }
};

export { getLanguageExtension };

// ─── Props ────────────────────────────────────────────────────────────────────

interface CodeMirrorEditorProps {
  content: string;
  filePath: string | null | undefined;
  onChange?: (value: string) => void;
  goToLine?: number;
  themeExtension: Extension;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  content, filePath, onChange, goToLine, themeExtension,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const themeCompartmentRef = useRef(new Compartment());
  onChangeRef.current = onChange;

  // ── Create the editor when filePath changes ──────────────────────────────

  useEffect(() => {
    if (!editorRef.current) return;

    const lang = getLanguageExtension(filePath);
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      keymap.of(defaultKeymap),
      themeCompartmentRef.current.of(themeExtension),
      baseEditorTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
    ];

    if (Array.isArray(lang)) {
      extensions.push(...lang);
    } else if (lang) {
      extensions.push(lang);
    }

    const state = EditorState.create({ doc: content, extensions });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;

    // Auto-scroll to the target error line
    if (goToLine && goToLine > 0) {
      try {
        const line = view.state.doc.line(goToLine);
        requestAnimationFrame(() => {
          view.dispatch({
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
          });
        });
      } catch {
        // Line out of range or document empty — ignore
      }
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath]);

  // ── Reconfigure theme live (no editor destroy) ──────────────────────────

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartmentRef.current.reconfigure(themeExtension),
    });
  }, [themeExtension]);

  return (
    <div
      ref={editorRef}
      className="code-mirror-editor border border-card-border/40 rounded-xl overflow-hidden"
      style={{ minHeight: '250px', maxHeight: '500px', overflow: 'auto' }}
    />
  );
};
