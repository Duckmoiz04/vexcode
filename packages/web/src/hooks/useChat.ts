import { useState } from 'react';
import type { Finding, CallerInfo, BlastRadiusItem, AiResolution, ChatMessage } from '../types';

function buildFindingContext(finding: Finding, resolution: AiResolution | undefined): string {
  let context = `Vulnerability Details:\n`;
  context += `- Rule ID: ${finding.rule_id}\n- Severity: ${finding.severity}\n`;
  context += `- File: ${finding.file}\n- Line: ${finding.line}\n`;
  context += `- Message: ${finding.message}\n`;

  if (finding.ast_context) {
    const ast = finding.ast_context;
    context += `\nAST Context:\n- Symbol: ${ast.symbol_name} (${ast.kind})\n`;
    if (ast.source_code) context += `- Source Code:\n\`\`\`\n${ast.source_code}\`\`\`\n`;
    if (ast.callers && ast.callers.length > 0) {
      context += `- Callers: ${ast.callers.map((c: CallerInfo) => `${c.name} in ${c.filePath}`).join(', ')}\n`;
    }
    if (ast.blast_radius && ast.blast_radius.length > 0) {
      context += `- Blast Radius: ${ast.blast_radius.length} affected symbol(s)\n`;
      ast.blast_radius.forEach((br: BlastRadiusItem) => {
        context += `  - ${br.name} (${br.relation} in ${br.filePath}, depth ${br.depth})\n`;
      });
    }
  }

  if (resolution) {
    if (resolution.ai_status === 'failed') {
      context += `\nAI Resolution Status: FAILED\n`;
      context += `Error: ${resolution.ai_error || 'Unknown error'}\n`;
      context += `Suggestion: ${resolution.suggestion || 'No AI suggestion available.'}\n`;
    } else if (resolution.ai_status === 'fallback_mock') {
      context += `\nAI Resolution Status: MOCK FALLBACK\n`;
      context += `Note: AI provider is not configured. The suggestion below is generic and may not be accurate.\n`;
      context += `AI Suggestion: ${resolution.suggestion}\n`;
    } else {
      context += `\nAI Suggestion: ${resolution.suggestion}\n`;
      if (resolution.remediation_code) context += `Remediation Code:\n\`\`\`\n${resolution.remediation_code}\`\`\`\n`;
    }
  }

  return context;
}

interface UseChatOptions {
  finding: Finding;
  resolution: AiResolution | undefined;
  selectedProvider: string;
  apiKey: string;
  apiBaseUrl: string;
  aiModel: string;
  aiTemperature: number;
  aiMaxTokens: number;
}

interface UseChatResult {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (value: string) => void;
  isChatLoading: boolean;
  handleSendChat: () => Promise<void>;
}

export function useChat({
  finding,
  resolution,
  selectedProvider,
  apiKey,
  apiBaseUrl,
  aiModel,
  aiTemperature,
  aiMaxTokens,
}: UseChatOptions): UseChatResult {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleSendChat = async () => {
    const message = chatInput.trim();
    if (!message || isChatLoading) return;

    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
    setIsChatLoading(true);

    const findingContext = buildFindingContext(finding, resolution);
    const systemMessage = {
      role: 'system',
      content: `You are an expert security engineer helping analyze vulnerabilities. You have context about the current vulnerability being reviewed:\n\n${findingContext}\n\nProvide helpful, detailed answers about this vulnerability. Explain why it's dangerous, how it affects the codebase, and best practices for fixing it. Be concise but thorough.`,
    };

    const messagesToSend = [
      systemMessage,
      ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesToSend,
          provider: selectedProvider,
          apiKey,
          baseUrl: apiBaseUrl,
          model: aiModel,
          temperature: aiTemperature,
          maxTokens: aiMaxTokens,
        }),
      });

      const data = await response.json();
      if (data.success && data.response) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        const reason = data.error || 'Sorry, I encountered an error. Please check your AI settings and try again.';
        setChatMessages((prev) => [...prev, { role: 'assistant', content: reason }]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch AI response';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errMsg}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return { chatMessages, chatInput, setChatInput, isChatLoading, handleSendChat };
}