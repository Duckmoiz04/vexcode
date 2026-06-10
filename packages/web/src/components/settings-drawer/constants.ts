export interface ProviderInfo {
  name: string;
  models: { id: string; name: string }[];
  defaultBaseUrl: string;
}

export const PROVIDERS: Record<string, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'gpt-4o', name: 'GPT-4o (Balanced)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (Advanced)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy)' }
    ],
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet (Balanced)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Advanced)' }
    ],
    defaultBaseUrl: 'https://api.anthropic.com'
  },
  google: {
    name: 'Google',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Advanced)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Latest)' }
    ],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com'
  },
  '9router': {
    name: '9router',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (Balanced)' },
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (Advanced)' },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (Fast)' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet (Balanced)' }
    ],
    defaultBaseUrl: 'http://localhost:20128/v1'
  }
};