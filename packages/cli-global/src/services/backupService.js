import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { getBackupFilePath } from './fileService.js';

/**
 * Create a backup of a file before applying a fix.
 * @param {string} filePath - Resolved absolute path to the file
 * @param {string} backupsBaseDir
 */
export function backupFile(filePath, backupsBaseDir) {
  try {
    mkdirSync(backupsBaseDir, { recursive: true });
    const content = readFileSync(filePath, 'utf8');
    writeFileSync(getBackupFilePath(filePath, backupsBaseDir), content, 'utf8');
  } catch (err) {
    console.error('Failed to create backup:', err);
  }
}

/**
 * Apply a fix to a file by replacing target content at a specific line.
 * @param {string} filePath - Resolved absolute path
 * @param {number} targetLine - 1-based line number
 * @param {string} targetContent - Content to find and replace
 * @param {string} replacementContent - Replacement content
 * @param {string} [codeText] - Optional code text for line mapping
 * @returns {{ success: boolean, error?: string }}
 */
export function applyFixToFile(filePath, targetLine, targetContent, replacementContent, codeText) {
  if (!existsSync(filePath)) {
    return { success: false, error: `File not found at ${filePath}` };
  }

  const fileContent = readFileSync(filePath, 'utf8');
  const lines = fileContent.split(/\r?\n/);
  const targetLines = targetContent.split(/\r?\n/);

  let lineToUse = parseInt(targetLine, 10);

  if (codeText) {
    let closestLine = -1;
    let minDiff = Infinity;

    for (let i = 0; i < lines.length; i++) {
      const currentLineContent = lines[i];
      if (currentLineContent.includes(codeText) || currentLineContent.trim() === codeText.trim()) {
        const lineNum = i + 1;
        const diff = Math.abs(lineNum - lineToUse);
        if (diff < minDiff) {
          minDiff = diff;
          closestLine = lineNum;
        }
      }
    }

    if (closestLine !== -1) {
      lineToUse = closestLine;
    }
  }

  if (lineToUse < 1 || lineToUse + targetLines.length - 1 > lines.length) {
    return { success: false, error: `Target line ${lineToUse} is out of file bounds.` };
  }

  const fileSegment = lines.slice(lineToUse - 1, lineToUse - 1 + targetLines.length).join('\n');

  const normalizedFileSegment = fileSegment.replace(/\r/g, '');
  const normalizedTarget = targetContent.replace(/\r/g, '');

  if (normalizedFileSegment.trim() !== normalizedTarget.trim() && !normalizedFileSegment.includes(normalizedTarget)) {
    return {
      success: false,
      error: `Target content mismatch. Expected to find: "${targetContent.trim()}" but found: "${fileSegment.trim()}"`
    };
  }

  const replacedSegment = normalizedFileSegment.replace(normalizedTarget, replacementContent);
  const replacedLines = replacedSegment.split('\n');

  lines.splice(lineToUse - 1, targetLines.length, ...replacedLines);

  const hasCRLF = fileContent.includes('\r\n');
  const newFileContent = lines.join(hasCRLF ? '\r\n' : '\n');

  writeFileSync(filePath, newFileContent, 'utf8');

  return { success: true };
}

/**
 * Rollback a file from its backup.
 * @param {string} filePath - Resolved absolute path
 * @param {string} backupsBaseDir
 * @returns {{ success: boolean, error?: string }}
 */
export function rollbackFile(filePath, backupsBaseDir) {
  const backupPath = getBackupFilePath(filePath, backupsBaseDir);
  if (!existsSync(backupPath)) {
    return { success: false, error: `No backup found for file: ${filePath}` };
  }

  const backupContent = readFileSync(backupPath, 'utf8');
  writeFileSync(filePath, backupContent, 'utf8');

  try {
    unlinkSync(backupPath);
  } catch (err) {
    console.error('Error deleting backup file:', err);
  }

  return { success: true };
}