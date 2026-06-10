import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { ChatPanel } from './ChatPanel';
import type { ChatMessage } from '../../types';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ChatPanel', () => {
  const mockMessages: ChatMessage[] = [
    { role: 'user', content: 'What is this vulnerability?' },
    { role: 'assistant', content: 'This is a SQL injection vulnerability.' },
  ];

  it('renders empty state when no messages', () => {
    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={[]}
        chatInput=""
        onChatInputChange={vi.fn()}
        onSend={vi.fn()}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    expect(screen.getByText(/ask ai about this finding/i)).toBeInTheDocument();
  });

  it('renders messages with role badges', () => {
    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={mockMessages}
        chatInput=""
        onChatInputChange={vi.fn()}
        onSend={vi.fn()}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getAllByText('AI Assistant').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('What is this vulnerability?')).toBeInTheDocument();
    expect(screen.getByText('This is a SQL injection vulnerability.')).toBeInTheDocument();
  });

  it('shows loading indicator when isChatLoading is true', () => {
    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={mockMessages}
        chatInput=""
        onChatInputChange={vi.fn()}
        onSend={vi.fn()}
        isChatLoading={true}
        findingRuleId="rules.test.injection"
      />
    );

    expect(screen.getByText(/ai is thinking/i)).toBeInTheDocument();
  });

  it('calls onSend when send button is clicked', () => {
    const onSend = vi.fn();

    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={[]}
        chatInput="test message"
        onChatInputChange={vi.fn()}
        onSend={onSend}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    fireEvent.click(screen.getByTitle('Send chat message'));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onSend when Enter is pressed in input', () => {
    const onSend = vi.fn();

    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={[]}
        chatInput="test message"
        onChatInputChange={vi.fn()}
        onSend={onSend}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    const input = screen.getByPlaceholderText(/ask about rules.test.injection/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('calls onChatInputChange when input value changes', () => {
    const onChatInputChange = vi.fn();

    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={[]}
        chatInput=""
        onChatInputChange={onChatInputChange}
        onSend={vi.fn()}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    const input = screen.getByPlaceholderText(/ask about rules.test.injection/i);
    fireEvent.change(input, { target: { value: 'new message' } });
    expect(onChatInputChange).toHaveBeenCalledWith('new message');
  });

  it('disables send button when input is empty', () => {
    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={vi.fn()}
        messages={[]}
        chatInput=""
        onChatInputChange={vi.fn()}
        onSend={vi.fn()}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    const sendButton = screen.getByTitle('Send chat message');
    expect(sendButton).toBeDisabled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();

    renderWithProviders(
      <ChatPanel
        isOpen={true}
        onClose={onClose}
        messages={[]}
        chatInput=""
        onChatInputChange={vi.fn()}
        onSend={vi.fn()}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    fireEvent.click(screen.getByTitle('Close AI chat'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides panel when isOpen is false', () => {
    const { container } = renderWithProviders(
      <ChatPanel
        isOpen={false}
        onClose={vi.fn()}
        messages={[]}
        chatInput=""
        onChatInputChange={vi.fn()}
        onSend={vi.fn()}
        isChatLoading={false}
        findingRuleId="rules.test.injection"
      />
    );

    const panel = container.firstElementChild;
    expect(panel?.className).toContain('w-0');
  });
});