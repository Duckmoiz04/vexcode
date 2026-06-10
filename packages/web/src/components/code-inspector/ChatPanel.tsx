import React, { useEffect, useRef } from 'react';
import { HelpCircle, Send, X } from 'lucide-react';
import type { ChatMessage } from '../../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSend: () => void;
  isChatLoading: boolean;
  findingRuleId: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  chatInput,
  onChatInputChange,
  onSend,
  isChatLoading,
  findingRuleId,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSend();
    }
  };

  return (
    <div
      className={`border-l border-card-border bg-[#161622] h-full flex flex-col shadow-2xl transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
        isOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0 border-l-0'
      }`}
    >
      {/* Chat Header */}
      <div className="px-4.5 py-3.5 border-b border-card-border/60 flex items-center justify-between bg-bg-tertiary/20 shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-accent" />
          <h4 className="text-[10.5px] text-text-primary uppercase font-bold tracking-wider">AI Assistant</h4>
        </div>
        <button
          onClick={onClose}
          aria-label="Close AI chat"
          title="Close AI chat"
          className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-secondary/60 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message Box */}
      <div className="flex-1 overflow-y-auto p-4.5 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs text-text-tertiary py-8 space-y-2 select-none">
            <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-lg shadow-sm">
              💬
            </div>
            <p className="font-semibold text-text-secondary text-[12px]">Ask AI about this finding</p>
            <span className="max-w-[240px] leading-relaxed text-[10px] text-text-tertiary/80">
              Ask questions like: "Why is this finding dangerous?", "How can I fix this manually?", or "What is the blast radius of this issue?"
            </span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col p-3 rounded-xl text-xs max-w-[85%] leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-accent/10 border border-accent/25 text-text-primary self-end ml-auto rounded-tr-none'
                  : 'bg-bg-secondary/90 border border-card-border/60 text-text-primary mr-auto rounded-tl-none'
              }`}
            >
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider mb-1 text-text-tertiary select-none">
                {msg.role === 'user' ? 'You' : 'AI Assistant'}
              </span>
              <p className="whitespace-pre-wrap font-sans text-text-primary text-[11.5px]">{msg.content}</p>
            </div>
          ))
        )}
        {isChatLoading && (
          <div className="flex items-center gap-2.5 p-3 bg-bg-secondary/90 border border-card-border/60 rounded-xl text-xs text-text-secondary animate-pulse w-max rounded-tl-none mr-auto shadow-sm">
            <span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
            <span>AI is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3.5 border-t border-card-border/65 bg-bg-primary/25 flex gap-2 shrink-0">
        <label htmlFor="ai-chat-input" className="sr-only">
          Ask AI about {findingRuleId}
        </label>
        <input
          id="ai-chat-input"
          type="text"
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isChatLoading}
          placeholder={`Ask about ${findingRuleId}...`}
          aria-label={`Ask AI about ${findingRuleId}`}
          className="flex-1 bg-bg-tertiary text-text-primary border border-card-border/80 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-accent disabled:opacity-50 transition-all placeholder:text-text-tertiary/60 shadow-inner"
        />
        <button
          onClick={onSend}
          disabled={isChatLoading || !chatInput.trim()}
          aria-label="Send chat message"
          title="Send chat message"
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent cursor-pointer transition-all shadow-md"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};