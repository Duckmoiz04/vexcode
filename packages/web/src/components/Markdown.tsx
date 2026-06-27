import React from 'react';

interface MarkdownProps {
  content: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  if (!content) return null;

  // Split by code blocks and think blocks
  const parts = content.split(/(```[\s\S]*?```|<think>[\s\S]*?<\/think>|<think>[\s\S]*$|<thought>[\s\S]*?<\/thought>|<thought>[\s\S]*$)/g);

  return (
    <div className="space-y-2.5 font-sans leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('```')) {
          // Code block parsing
          const lines = part.split('\n');
          const firstLine = lines[0].slice(3).trim(); // Language info
          const code = lines.slice(1, lines.length - 1).join('\n');
          return (
            <div key={index} className="my-2 rounded-lg border border-card-border/60 overflow-hidden bg-bg-tertiary shadow-inner">
              {firstLine && (
                <div className="px-3 py-1 bg-bg-secondary border-b border-card-border/40 text-[9px] font-mono text-text-tertiary uppercase tracking-wider select-none">
                  {firstLine}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-[11px] font-mono text-text-primary scrollbar-thin">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        if (part.startsWith('<think>') || part.startsWith('<thought>')) {
          const isThink = part.startsWith('<think>');
          const startTagLength = isThink ? 7 : 9;
          const endTag = isThink ? '</think>' : '</thought>';
          let innerText = part.slice(startTagLength);
          if (innerText.endsWith(endTag)) {
            innerText = innerText.slice(0, -endTag.length);
          }
          innerText = innerText.trim();
          if (!innerText) return null;
          return (
            <div key={index} className="my-2 p-3 rounded-lg bg-bg-tertiary/40 border-l-2 border-text-tertiary/40 text-[10.5px] text-text-tertiary italic">
              <div className="flex items-center gap-1.5 font-sans font-semibold not-italic text-[9px] uppercase tracking-wider text-text-tertiary/80 mb-1 select-none">
                <span>🧠</span>
                <span>Thinking Process</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed">{innerText}</div>
            </div>
          );
        }

        // Split regular text into lines to perform structured block parsing (lists, tables, paragraphs)
        const lines = part.split('\n');
        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];
          const trimmed = line.trim();

          if (!trimmed) {
            i++;
            continue;
          }

          // 0.1 Check for Headers
          const headerMatch = line.match(/^(\#{1,6})\s+(.+)$/);
          if (headerMatch) {
            const level = headerMatch[1].length;
            const headerText = headerMatch[2];
            const Tag = `h${level}` as any;
            
            const headerClasses = [
              'text-base font-bold text-text-primary mt-3.5 mb-1.5',      // h1
              'text-sm font-bold text-text-primary mt-3 mb-1.5',          // h2
              'text-xs font-semibold text-text-primary mt-2.5 mb-1',      // h3
              'text-xs font-semibold text-text-primary mt-2 mb-1',        // h4
              'text-[11px] font-medium text-text-secondary mt-1.5 mb-0.5', // h5
              'text-[10px] font-medium text-text-secondary mt-1.5 mb-0.5', // h6
            ];
            const className = headerClasses[level - 1] || 'text-xs font-bold';

            elements.push(
              <Tag key={`header-${i}`} className={className}>
                {renderInline(headerText)}
              </Tag>
            );
            i++;
            continue;
          }

          // 0.2 Check for Blockquotes
          if (trimmed.startsWith('>')) {
            const quoteText = line.replace(/^\s*>\s*/, '');
            elements.push(
              <blockquote key={`quote-${i}`} className="border-l-2 border-accent/40 pl-3 py-0.5 my-2 text-text-secondary italic text-[11px] bg-bg-tertiary/10 rounded-r">
                {renderInline(quoteText)}
              </blockquote>
            );
            i++;
            continue;
          }

          // 0.3 Check for Horizontal Rules
          if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
            elements.push(
              <hr key={`hr-${i}`} className="my-3 border-card-border/40" />
            );
            i++;
            continue;
          }

          // 1. Check for Table
          if (trimmed.startsWith('|')) {
            // Collect all consecutive lines starting with '|'
            const tableLines: string[] = [];
            let j = i;
            while (j < lines.length && lines[j].trim().startsWith('|')) {
              tableLines.push(lines[j].trim());
              j++;
            }

            // Check if it's a valid table (has at least 2 rows, and second row is separator)
            if (tableLines.length >= 2 && /^\s*\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?\s*$/.test(tableLines[1])) {
              elements.push(renderTable(tableLines, i));
              i = j;
              continue;
            }
          }

          // 2. Check for List (ordered/unordered)
          if (/^\s*([*\-+]|\d+\.)\s+/.test(line)) {
            const listLines: string[] = [];
            const isOrdered = /^\s*\d+\.\s+/.test(line);
            let j = i;
            while (j < lines.length && /^\s*([*\-+]|\d+\.)\s+/.test(lines[j])) {
              listLines.push(lines[j]);
              j++;
            }

            const ListTag = isOrdered ? 'ol' : 'ul';
            elements.push(
              <ListTag key={`list-${i}`} className={`pl-5 space-y-1.5 my-2 text-text-primary text-[11.5px] ${isOrdered ? 'list-decimal' : 'list-disc'}`}>
                {listLines.map((item, idx) => {
                  const itemText = item.replace(/^\s*([*\-+]|\d+\.)\s+/, '');
                  return (
                    <li key={idx} className="leading-relaxed">
                      {renderInline(itemText)}
                    </li>
                  );
                })}
              </ListTag>
            );
            i = j;
            continue;
          }

          // 3. Normal Paragraph
          // Collect consecutive lines until we hit a blank line, table, or list
          const paraLines: string[] = [];
          let j = i;
          while (j < lines.length) {
            const nextLine = lines[j];
            const nextTrimmed = nextLine.trim();
            if (j > i && (!nextTrimmed || nextTrimmed.startsWith('|') || /^\s*([*\-+]|\d+\.)\s+/.test(nextLine))) {
              break;
            }
            paraLines.push(nextLine);
            j++;
          }

          elements.push(
            <p key={`para-${i}`} className="text-text-primary text-[11.5px] leading-relaxed">
              {renderInline(paraLines.join(' '))}
            </p>
          );
          i = j;
        }

        return <React.Fragment key={index}>{elements}</React.Fragment>;
      })}
    </div>
  );
};

// Table parser and renderer
function renderTable(tableLines: string[], keyPrefix: number): React.ReactNode {
  const parseRow = (rowStr: string) => {
    const cells = rowStr.split('|').map(c => c.trim());
    // Remove the first and last cells if they represent outer pipes
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  };

  const headers = parseRow(tableLines[0]);
  const separators = parseRow(tableLines[1]);

  // Determine alignments
  const alignments = separators.map(sep => {
    const left = sep.startsWith(':');
    const right = sep.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  const getAlignClass = (align: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  const rows = tableLines.slice(2).map(parseRow);

  return (
    <div key={`table-${keyPrefix}`} className="my-3 overflow-x-auto rounded-xl border border-card-border/60 shadow-sm bg-bg-secondary scrollbar-thin">
      <table className="min-w-full divide-y divide-card-border/50 border-collapse text-[11.5px] text-text-primary">
        <thead className="bg-bg-tertiary">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`px-3.5 py-2 font-semibold text-text-secondary text-[11px] uppercase tracking-wider ${getAlignClass(alignments[idx] || 'left')}`}
              >
                {renderInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-card-border/40">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-bg-tertiary/15 transition-colors">
              {headers.map((_, cIdx) => (
                <td
                  key={cIdx}
                  className={`px-3.5 py-2.5 text-text-primary leading-normal ${getAlignClass(alignments[cIdx] || 'left')}`}
                >
                  {renderInline(row[cIdx] || '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Inline parser for bold (**text**), italic (*text* or _text_), and inline code (`code`)
function renderInline(text: string): React.ReactNode[] {
  // Split by inline code first
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-card-border/60 text-[10px] font-mono text-accent">
          {codeText}
        </code>
      );
    }

    // Split by bold (**text**) next
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={idx}>
        {boldParts.map((bPart, bIdx) => {
          if (bPart.startsWith('**') && bPart.endsWith('**')) {
            const boldText = bPart.slice(2, -2);
            return <strong key={bIdx} className="font-semibold text-text-primary">{boldText}</strong>;
          }

          // Split by italic (*text* or _text_) next
          const italicParts = bPart.split(/(\*[^*]+\*|_[^_]+_)/g);
          return (
            <React.Fragment key={bIdx}>
              {italicParts.map((iPart, iIdx) => {
                if ((iPart.startsWith('*') && iPart.endsWith('*')) || (iPart.startsWith('_') && iPart.endsWith('_'))) {
                  const italicText = iPart.slice(1, -1);
                  return <em key={iIdx} className="italic text-text-secondary">{italicText}</em>;
                }
                return iPart;
              })}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  });
}
