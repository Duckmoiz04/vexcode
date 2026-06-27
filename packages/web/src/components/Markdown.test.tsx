import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import { Markdown } from './Markdown';

describe('Markdown Component', () => {
  it('renders normal text and paragraph correctly', () => {
    renderWithProviders(<Markdown content="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders inline formatting (bold, italic, and inline code)', () => {
    renderWithProviders(
      <Markdown content="This is **bold** text, *italic* word, _another_ italic, and `code` here." />
    );
    expect(screen.getByText('bold')).toHaveClass('font-semibold');
    expect(screen.getByText('italic')).toHaveClass('italic');
    expect(screen.getByText('another')).toHaveClass('italic');
    expect(screen.getByText('code')).toHaveClass('font-mono');
  });

  it('renders unordered and ordered lists', () => {
    renderWithProviders(
      <Markdown
        content={`- Item A
- Item B
1. First
2. Second`}
      />
    );
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders headers (h1 to h6)', () => {
    renderWithProviders(
      <Markdown
        content={`# Title 1
## Title 2
### Title 3`}
      />
    );
    const h1 = screen.getByText('Title 1').closest('h1');
    const h2 = screen.getByText('Title 2').closest('h2');
    const h3 = screen.getByText('Title 3').closest('h3');

    expect(h1).toHaveClass('text-base', 'font-bold');
    expect(h2).toHaveClass('text-sm', 'font-bold');
    expect(h3).toHaveClass('text-xs', 'font-semibold');
  });

  it('renders blockquotes and horizontal rules', () => {
    renderWithProviders(
      <Markdown
        content={`> This is a quote
---`}
      />
    );
    const quote = screen.getByText('This is a quote').closest('blockquote');
    expect(quote).toHaveClass('border-l-2', 'italic');
    expect(document.querySelector('hr')).toBeInTheDocument();
  });

  it('renders a markdown table with alignments correctly', () => {
    const tableMarkdown = `| Name | Age | Country |
| :--- | :---: | ---: |
| Alice | 24 | USA |
| Bob | 30 | Canada |`;
    renderWithProviders(<Markdown content={tableMarkdown} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Canada')).toBeInTheDocument();

    // Verify alignments
    const nameHeader = screen.getByText('Name').closest('th');
    const ageHeader = screen.getByText('Age').closest('th');
    const countryHeader = screen.getByText('Country').closest('th');

    expect(nameHeader).toHaveClass('text-left');
    expect(ageHeader).toHaveClass('text-center');
    expect(countryHeader).toHaveClass('text-right');
  });

  it('handles isolated pipe symbols and partial/streaming table inputs without freezing', () => {
    // 1. Isolated pipe
    const { rerender } = renderWithProviders(<Markdown content="This contains | a pipe character" />);
    expect(screen.getByText(/This contains \| a pipe character/)).toBeInTheDocument();

    // 2. Streaming a table (only the first header line generated)
    rerender(<Markdown content="| Header A | Header B |" />);
    expect(screen.getByText(/\| Header A \| Header B \|/)).toBeInTheDocument();

    // 3. Streaming a table (header + separator generated)
    rerender(
      <Markdown
        content={`| Header A | Header B |
| --- | --- |`}
      />
    );
    expect(screen.getByText('Header A')).toBeInTheDocument();
    expect(screen.getByText('Header B')).toBeInTheDocument();
  });

  it('renders closed and unclosed (streaming) think/thought blocks', () => {
    // 1. Closed thinking block
    const { rerender } = renderWithProviders(
      <Markdown content="<think>I need to check the math.</think>The answer is 42." />
    );
    expect(screen.getByText('Thinking Process')).toBeInTheDocument();
    expect(screen.getByText('I need to check the math.')).toBeInTheDocument();
    expect(screen.getByText('The answer is 42.')).toBeInTheDocument();

    // 2. Unclosed (streaming) thinking block
    rerender(<Markdown content="<think>Evaluating alternative algorithms..." />);
    expect(screen.getByText('Thinking Process')).toBeInTheDocument();
    expect(screen.getByText('Evaluating alternative algorithms...')).toBeInTheDocument();
  });
});
