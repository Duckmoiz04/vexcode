import React, { useState, useMemo, useEffect, type RefObject } from 'react';
import type { Finding, AiResolution } from '../../types';
import { CodeMirrorEditor } from './CodeMirrorEditor.tsx';
import { ThemePicker } from './ThemePicker.tsx';
import { ApplyFixButton } from './ApplyFixButton';
import { defaultTheme, themeRegistry, type ThemeDefinition } from '../../utils/themes.ts';

interface FileViewerProps {
  finding: Finding;
  fileContent: string;
  isLoading: boolean;
  error: string | null;
  resolution: AiResolution | undefined;
  activeLineRef?: RefObject<HTMLDivElement | null>;
  /** All findings in the same file — used to highlight sibling error lines. */
  allFindings?: Finding[];
  theme: 'dark' | 'light';
  onApplyFix?: (finding: Finding, remediationCode: string) => Promise<boolean>;
}

/**
 * Build a "fixed" version of the file by replacing the original block with the
 * remediation snippet at the target line. Mirrors the server-side replacement
 * logic in `applyFixToFile` so both sides of the merge view have comparable
 * full-file content (the merge view fails to align a full file vs. a snippet).
 *
 * Indentation: the AI often returns the replacement at indent level 0 even
 * though the target line is nested inside a class/function. We detect the
 * target line's indentation and re-indent the replacement so the suggested
 * fix sits at the same level as the original code.
 */
export function constructFixedFile(
  fileContent: string,
  targetLine: number,
  targetContent: string,
  replacementContent: string,
): string {
  if (!fileContent || !targetContent || !replacementContent) return fileContent;
  const hasCRLF = fileContent.includes('\r\n');
  const lines = fileContent.split(/\r?\n/);
  const targetLines = targetContent.split(/\r?\n/);
  const numTargetLines = targetLines.length;

  if (!Number.isFinite(targetLine) || targetLine < 1) return fileContent;
  if (targetLine + numTargetLines - 1 > lines.length) return fileContent;

  const fileSegment = lines
    .slice(targetLine - 1, targetLine - 1 + numTargetLines)
    .join('\n');

  const normalizedFile = fileSegment.replace(/\r/g, '');
  const normalizedTarget = targetContent.replace(/\r/g, '');

  let replacementLines: string[];
  if (normalizedFile === normalizedTarget) {
    replacementLines = replacementContent.split(/\r?\n/);
  } else if (normalizedFile.trim() === normalizedTarget.trim()) {
    // Match the file's existing indentation; preserve relative indents in the
    // replacement (don't call .trim() — that would flatten nested structure).
    const indentMatch = fileSegment.match(/^([ \t]*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const rawLines = replacementContent.split(/\r?\n/);
    replacementLines = indent
      ? reindentToTarget(rawLines, indent)
      : rawLines;
  } else if (normalizedFile.includes(normalizedTarget)) {
    // Substring match — fall back to direct replacement
    const newSegment = normalizedFile.replace(normalizedTarget, replacementContent);
    replacementLines = newSegment.split('\n');
  } else {
    // Cannot align — return original so the diff still shows useful info
    return fileContent;
  }

  // Re-indent the replacement so it matches the target line's indentation.
  // Strategy: detect common leading whitespace of non-empty replacement lines,
  // strip it, and prepend the target line's indentation. This handles both
  // "AI returned at indent 0" and "AI returned at wrong indent" cases.
  const targetLineText = lines[targetLine - 1] || '';
  const targetIndentMatch = targetLineText.match(/^([ \t]*)/);
  const targetIndent = targetIndentMatch ? targetIndentMatch[1] : '';
  if (targetIndent) {
    replacementLines = reindentToTarget(replacementLines, targetIndent);
  }

  lines.splice(targetLine - 1, numTargetLines, ...replacementLines);
  return lines.join(hasCRLF ? '\r\n' : '\n');
}

/**
 * Re-indent a multi-line replacement so it sits at the target indentation.
 * Strips the common leading whitespace of the replacement's non-empty lines,
 * then prepends `targetIndent` to each non-empty line. Empty/whitespace-only
 * lines are left untouched (they preserve vertical spacing).
 */
function reindentToTarget(replacementLines: string[], targetIndent: string): string[] {
  // Find the smallest indent among non-empty lines
  let minIndent: number | null = null;
  for (const line of replacementLines) {
    if (!line.trim()) continue;
    const match = line.match(/^([ \t]*)/);
    const indentLen = match ? match[1].length : 0;
    if (minIndent === null || indentLen < minIndent) minIndent = indentLen;
  }
  if (minIndent === null || minIndent === 0) {
    // No common indent to strip — just prepend targetIndent to non-empty lines
    return replacementLines.map((l) => (l.trim() ? targetIndent + l : l));
  }
  return replacementLines.map((l) => {
    if (!l.trim()) return l;
    // Strip the common indent, then prepend targetIndent
    return targetIndent + l.slice(minIndent as number);
  });
}

/**
 * Compute the list of sibling error line numbers in the same file as the
 * active finding. Siblings are findings in the same file at DIFFERENT lines
 * from the active one. Pure function — exported for unit testing.
 */
export function computeSiblingErrorLines(
  allFindings: Finding[] | undefined,
  activeFile: string,
  activeLine: number,
): number[] {
  if (!allFindings || allFindings.length === 0) return [];
  return allFindings
    .filter((f) => f.file === activeFile && f.line !== activeLine)
    .map((f) => f.line)
    .filter((n) => Number.isFinite(n) && n > 0);
}

export const FileViewer: React.FC<FileViewerProps> = ({
  finding,
  fileContent,
  isLoading,
  error,
  resolution,
  activeLineRef,
  allFindings,
  theme,
  onApplyFix,
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(defaultTheme);
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!onApplyFix || !resolution?.remediation_code) return;
    setIsApplying(true);
    await onApplyFix(finding, resolution.remediation_code);
    setIsApplying(false);
  };

  useEffect(() => {
    if (theme === 'light') {
      const lightTheme = themeRegistry.find(t => !t.dark);
      if (lightTheme) setCurrentTheme(lightTheme);
    } else {
      const darkTheme = themeRegistry.find(t => t.id === 'vexcodeMidnight');
      if (darkTheme) setCurrentTheme(darkTheme);
    }
  }, [theme]);

  // Sibling error lines in the same file (excluding the current finding's line).
  // Used to highlight ALL findings in the file so the user sees the full picture.
  const siblingErrorLines = useMemo<number[]>(() => {
    if (!allFindings || allFindings.length === 0) return [];
    return allFindings
      .filter((f) => f.file === finding.file && f.line !== finding.line)
      .map((f) => f.line)
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [allFindings, finding.file, finding.line]);

  // Build the "fixed" version of the file so the merge view can align correctly.
  const fixedFile = useMemo(() => {
    if (!fileContent || !resolution?.remediation_code) return '';
    const targetContent = finding.code_text || finding.message || '';
    if (!targetContent) return '';
    return constructFixedFile(
      fileContent,
      finding.line,
      targetContent,
      resolution.remediation_code,
    );
  }, [fileContent, finding.code_text, finding.message, finding.line, resolution?.remediation_code]);

  const hasDiff = !!(resolution?.remediation_code && fixedFile && fixedFile !== fileContent);

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
      const showFullDiff = !!(fixedFile && fixedFile !== fileContent);
      const displayCode = showFullDiff ? fixedFile : resolution.remediation_code;
      return (
        <div className="flex flex-1 min-h-0 w-full gap-4 p-1">
          {/* Left Panel: Original Source */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-xs text-text-tertiary uppercase font-bold tracking-wider px-3 py-1.5 border-b border-card-border/30 bg-bg-secondary/30 rounded-t-lg">
              Original Code
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <CodeMirrorEditor
                content={fileContent}
                filePath={finding.file}
                goToLine={finding.line}
                themeExtension={currentTheme.extension}
              />
            </div>
          </div>
          {/* Right Panel: Suggested Fix */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="text-xs text-text-tertiary uppercase font-bold tracking-wider px-3 py-1.5 border-b border-card-border/30 bg-bg-secondary/30 rounded-t-lg">
              {showFullDiff ? 'Suggested Fix' : 'Suggested Fix (snippet)'}
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <CodeMirrorEditor
                content={displayCode}
                filePath={finding.file}
                goToLine={showFullDiff ? finding.line : undefined}
                themeExtension={currentTheme.extension}
                isFix={showFullDiff}
              />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="w-full flex-1 flex flex-col min-h-0">
        <CodeMirrorEditor
          content={fileContent}
          filePath={finding.file}
          goToLine={finding.line}
          themeExtension={currentTheme.extension}
        />
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col rounded-lg border border-card-border bg-card-bg backdrop-blur-md min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 border-b border-card-border/40">
        <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">
          {resolution?.remediation_code ? 'Suggested Fix' : 'Source Viewer'}
        </span>
        <div className="flex items-center gap-3">
          {resolution?.remediation_code && onApplyFix && (
            <ApplyFixButton
              hasRemediation={true}
              isApplied={finding.status === 'applied'}
              isApplying={isApplying}
              onApply={handleApply}
            />
          )}
          <ThemePicker current={currentTheme} onChange={setCurrentTheme} />
        </div>
      </div>
      {/* Content area — fits the viewport exactly and scrolls internally. */}
      <div className="font-mono leading-[1.5] scrollbar-thin select-text bg-bg-primary border-t border-card-border/40 flex-1 min-h-0 overflow-hidden flex flex-col">
        {renderContent()}
      </div>
    </div>
  );
};