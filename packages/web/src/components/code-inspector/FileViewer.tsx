import React, { useState, type RefObject } from 'react';
import type { Finding, AiResolution } from '../../types';
import { CodeMirrorEditor } from './CodeMirrorEditor.tsx';
import { DiffViewer } from './DiffViewer.tsx';
import { ThemePicker } from './ThemePicker.tsx';
import { defaultTheme, type ThemeDefinition } from '../../utils/themes.ts';

interface FileViewerProps {
  finding: Finding;
  fileContent: string;
  isLoading: boolean;
  error: string | null;
  resolution: AiResolution | undefined;
  activeLineRef?: RefObject<HTMLDivElement | null>;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  finding,
  fileContent,
  isLoading,
  error,
  resolution,
  activeLineRef,
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(defaultTheme);

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center py-8 text-text-tertiary italic">Loading file content...</div>;
    }
    if (error) {
      return <div className="text-center py-8 text-danger italic">Error: {error}</div>;
    }
    if (!fileContent) {
      return <div className="text-center py-8 text-text-tertiary italic">No file content available.</div>;
    }
    if (resolution?.remediation_code) {
      return (
        <DiffViewer
          originalCode={fileContent}
          remediationCode={resolution.remediation_code}
          filePath={finding.file}
          themeExtension={currentTheme.extension}
        />
      );
    }
    return (
      <CodeMirrorEditor
        content={fileContent}
        filePath={finding.file}
        goToLine={finding.line}
        themeExtension={currentTheme.extension}
      />
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-card-border bg-card-bg backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-card-border/40">
        <span className="text-[10px] text-text-tertiary uppercase font-bold tracking-wider">
          {resolution?.remediation_code ? 'Diff View' : 'Source Viewer'}
        </span>
        <div className="flex items-center gap-3">
          <ThemePicker current={currentTheme} onChange={setCurrentTheme} />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto font-mono leading-[1.5] scrollbar-thin select-text bg-[#0a0a0f] border-t border-card-border/40">
        {renderContent()}
      </div>
    </div>
  );
};