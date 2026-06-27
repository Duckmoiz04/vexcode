export interface ProviderInfo {
  name: string;
  defaultBaseUrl: string;
}

export const PROVIDERS: Record<string, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com'
  },
  google: {
    name: 'Google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com'
  },
  '9router': {
    name: '9router',
    defaultBaseUrl: 'http://localhost:20128/v1'
  },
  nvidia: {
    name: 'NVIDIA NIM',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1'
  }
};
