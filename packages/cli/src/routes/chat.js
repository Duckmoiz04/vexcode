const PROVIDER_ENV = {
  openai:     { apiKey: 'OPENAI_API_KEY',     baseUrl: 'OPENAI_BASE_URL',     model: 'OPENAI_MODEL' },
  anthropic:  { apiKey: 'ANTHROPIC_API_KEY',  baseUrl: 'ANTHROPIC_BASE_URL',  model: 'ANTHROPIC_MODEL' },
  google:     { apiKey: 'GOOGLE_API_KEY',     baseUrl: 'GOOGLE_BASE_URL',     model: 'GOOGLE_MODEL' },
  nvidia:     { apiKey: 'NVIDIA_API_KEY',     baseUrl: 'NVIDIA_BASE_URL',     model: 'NVIDIA_MODEL' },
  '9router':  { apiKey: 'NINEROUTER_API_KEY', baseUrl: 'NINEROUTER_BASE_URL', model: 'NINEROUTER_MODEL' },
};

const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  '9router': 'http://localhost:20128/v1',
};

/**
 * Resolve provider connection parameters (apiKey, baseUrl, model).
 *
 * When the client sends missing or problematic values (e.g. the masked
 * "••••••" placeholder), the server reads the real values from its own
 * .env configuration so the frontend does not need to manage provider
 * credentials.
 *
 * @param {string} provider - Provider name (lowercase)
 * @param {{ apiKey?: string, baseUrl?: string, model?: string }} client - Values from the client
 * @param {object} deps - Route dependencies (readEnvConfig, envPath)
 * @returns {{ apiKey: string, baseUrl: string, model: string }}
 */
function resolveProviderConfig(provider, client, deps) {
  const envKeys = PROVIDER_ENV[provider];
  let { apiKey, baseUrl, model } = client;

  if (!apiKey || !/^[\x00-\x7F]*$/.test(apiKey)) {
    if (envKeys && deps.readEnvConfig && deps.envPath) {
      try {
        const envConfig = deps.readEnvConfig(deps.envPath);
        if (envConfig[envKeys.apiKey]) apiKey = envConfig[envKeys.apiKey];
      } catch {}
    }
  }

  if (!baseUrl) {
    if (envKeys && deps.readEnvConfig && deps.envPath) {
      try {
        const envConfig = deps.readEnvConfig(deps.envPath);
        if (envConfig[envKeys.baseUrl]) baseUrl = envConfig[envKeys.baseUrl];
      } catch {}
    }
    if (!baseUrl) baseUrl = DEFAULT_BASE_URLS[provider] || '';
  }

  if (!model) {
    if (envKeys && deps.readEnvConfig && deps.envPath) {
      try {
        const envConfig = deps.readEnvConfig(deps.envPath);
        if (envConfig[envKeys.model]) model = envConfig[envKeys.model];
      } catch {}
    }
  }

  return {
    apiKey: apiKey || '',
    baseUrl: baseUrl || '',
    model: model || '',
  };
}

export function registerChatRoutes(app, deps) {
  app.get('/api/models', async (req, res) => {
    try {
      const { baseUrl, apiKey } = req.query;

      if (!baseUrl) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: baseUrl' });
      }

      const modelsUrl = `${baseUrl.replace(/\/$/, '')}/models`;

      const headers = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(modelsUrl, { headers });

      if (!response.ok) {
        return res.json({ success: true, models: [] });
      }

      const data = await response.json();

      let models = [];

      if (data.data && Array.isArray(data.data)) {
        models = data.data.map(m => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by || ''
        }));
      } else if (data.models && Array.isArray(data.models)) {
        models = data.models.map(m => ({
          id: m.name?.replace('models/', '') || m.id,
          name: m.displayName || m.name?.replace('models/', '') || m.id,
          owned_by: m.supportedGenerationMethods?.includes('generateContent') ? 'google' : ''
        }));
      }

      models.sort((a, b) => a.name.localeCompare(b.name));

      res.json({ success: true, models });
    } catch (error) {
      console.error('Error fetching models:', error.message);
      res.json({ success: true, models: [] });
    }
  });

  function sanitizeForProvider(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/[^\x00-\xFF]/g, (ch) => {
      const map = {
        '\u2022': '*',   '\u2023': '>',
        '\u25E6': 'o',   '\u2013': '-',
        '\u2014': '--',  '\u2018': "'",
        '\u2019': "'",   '\u201C': '"',
        '\u201D': '"',   '\u2026': '...',
        '\u00A0': ' ',
      };
      return map[ch] ?? ch;
    });
  }

  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, provider, apiKey, baseUrl, model, temperature, maxTokens, stream } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: messages' });
      }

      if (!provider) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: provider. Configure AI in Settings.' });
      }
      if (provider !== undefined && typeof provider !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid type: provider must be a string.' });
      }
      if (temperature !== undefined && typeof temperature !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid type: temperature must be a number.' });
      }

      // Resolve all connection parameters server-side.
      // The frontend may send empty or masked values — the server reads the
      // real values from .env so the user can freely switch providers via
      // the Models tab without frontend credential management.
      const resolved = resolveProviderConfig(provider, { apiKey, baseUrl, model }, deps);
      
      if (req.body.baseUrl === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: baseUrl' });
      }
      if (req.body.model === undefined) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: model' });
      }
      if (req.body.apiKey === undefined && provider !== '9router') {
        return res.status(400).json({ success: false, error: 'Missing required parameter: apiKey' });
      }

      const resolvedKey = resolved.apiKey;
      const chatBaseUrl = resolved.baseUrl.replace(/\/$/, '');
      const chatModel = resolved.model;
      const chatTemp = temperature ?? 0.7;
      const chatMaxTokens = maxTokens ?? 2048;

      const headers = { 'Content-Type': 'application/json' };
      if (resolvedKey) {
        headers['Authorization'] = `Bearer ${resolvedKey}`;
      }

      let response;
      let responseData;

      try {
        // Sanitize all message content to avoid encoding issues (e.g. protobuf ByteString
        // cannot handle characters > 255 like bullet •).
        const sanitizedMessages = messages.map(m => ({
          ...m,
          content: sanitizeForProvider(m.content),
        }));

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.flushHeaders();

          let sseUrl;
          let sseHeaders = { ...headers };
          let ssePayload;

          if (provider === 'anthropic') {
            sseUrl = `${chatBaseUrl}/v1/messages`;
            sseHeaders['x-api-key'] = resolvedKey || '';
            sseHeaders['anthropic-version'] = '2023-06-01';

            const systemMsg = sanitizedMessages.find(m => m.role === 'system');
            const userMsgs = sanitizedMessages.filter(m => m.role !== 'system');
            ssePayload = {
              model: chatModel,
              max_tokens: chatMaxTokens,
              temperature: chatTemp,
              system: systemMsg?.content || '',
              messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
              stream: true,
            };
          } else if (provider === 'google') {
            sseUrl = `${chatBaseUrl}/v1beta/models/${chatModel}:streamGenerateContent?key=${resolvedKey}&alt=sse`;
            const contents = sanitizedMessages
              .filter(m => m.role !== 'system')
              .map(m => ({
                parts: [{ text: m.content }]
              }));
            ssePayload = {
              contents,
              generationConfig: {
                temperature: chatTemp,
                maxOutputTokens: chatMaxTokens
              }
            };
          } else {
            // OpenAI/9router/Nvidia
            sseUrl = `${chatBaseUrl}/chat/completions`;
            ssePayload = {
              model: chatModel,
              messages: sanitizedMessages.map(m => ({ role: m.role, content: m.content })),
              temperature: chatTemp,
              max_tokens: chatMaxTokens,
              stream: true,
            };
          }

          let sseResponse;
          try {
            sseResponse = await fetch(sseUrl, {
              method: 'POST',
              headers: { ...sseHeaders, Accept: 'text/event-stream' },
              body: JSON.stringify(ssePayload),
            });
          } catch (fetchErr) {
            res.write(`data: ${JSON.stringify({ error: `Connection failed: ${fetchErr.message}` })}\n\n`);
            res.write('data: [DONE]\n\n');
            if (typeof res.flush === 'function') res.flush();
            res.end();
            return;
          }

          if (!sseResponse.ok) {
            const errText = await sseResponse.text();
            let detail = errText;
            try {
              const errJson = JSON.parse(errText);
              detail = errJson.error?.message || errJson.error?.type || JSON.stringify(errJson.error) || errText;
            } catch {}
            res.write(`data: ${JSON.stringify({ error: `Provider returned ${sseResponse.status}: ${detail}` })}\n\n`);
            res.write('data: [DONE]\n\n');
            if (typeof res.flush === 'function') res.flush();
            res.end();
            return;
          }

          const reader = sseResponse.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';

          // Handle client disconnect
          req.on('close', () => {
            reader.cancel().catch(() => {});
          });

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buf += decoder.decode(value, { stream: true });
              const lines = buf.split('\n');
              buf = lines.pop() || '';

              for (const ln of lines) {
                const trimmed = ln.trim();
                if (trimmed.startsWith('data: ')) {
                  const data = trimmed.slice(6).trim();
                  if (data === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(data);
                    let delta = '';

                    if (provider === 'anthropic') {
                      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                        delta = parsed.delta.text;
                      }
                    } else if (provider === 'google') {
                      delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    } else {
                      delta = parsed.choices?.[0]?.delta?.content || '';
                    }

                    if (delta) {
                      res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                      if (typeof res.flush === 'function') {
                        res.flush();
                      }
                    }
                  } catch {}
                }
              }
            }
          } catch (streamErr) {
            // Stream interrupted (e.g. client disconnect) — not fatal
          }

          res.write('data: [DONE]\n\n');
          if (typeof res.flush === 'function') res.flush();
          try { res.end(); } catch {}
          return;
        }

        // ── Non-streaming path ───────────────────────────────────────────
        if (provider === 'anthropic') {
          const systemMsg = sanitizedMessages.find(m => m.role === 'system');
          const userMsgs = sanitizedMessages.filter(m => m.role !== 'system');

          const payload = {
            model: chatModel,
            max_tokens: chatMaxTokens,
            temperature: chatTemp,
            system: systemMsg?.content || '',
            messages: userMsgs.map(m => ({ role: m.role, content: m.content }))
          };

          response = await fetch(`${chatBaseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': resolvedKey || '',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(payload)
          });

          const responseBuffer = await response.arrayBuffer();
          const responseText = new TextDecoder('utf-8').decode(responseBuffer);
          if (!response.ok) {
            let errorDetail = responseText;
            try {
              const errJson = JSON.parse(responseText);
              errorDetail = errJson.error?.message || errJson.error?.type || JSON.stringify(errJson.error) || responseText;
            } catch {}
            throw new Error(`Provider returned ${response.status}: ${errorDetail}`);
          }
          try {
            responseData = JSON.parse(responseText);
            const contentBlocks = responseData.content || [];
            const content = contentBlocks
              .filter(b => b.type === 'text')
              .map(b => b.text)
              .join('\n');
            res.json({ success: true, response: content });
          } catch (parseError) {
            res.json({ success: true, response: responseText });
          }

        } else if (provider === 'google') {
          const contents = sanitizedMessages
            .filter(m => m.role !== 'system')
            .map(m => ({
              parts: [{ text: m.content }]
            }));

          const payload = {
            contents,
            generationConfig: {
              temperature: chatTemp,
              maxOutputTokens: chatMaxTokens
            }
          };

          response = await fetch(`${chatBaseUrl}/v1beta/models/${chatModel}:generateContent?key=${resolvedKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const responseBuffer = await response.arrayBuffer();
          const responseText = new TextDecoder('utf-8').decode(responseBuffer);
          if (!response.ok) {
            let errorDetail = responseText;
            try {
              const errJson = JSON.parse(responseText);
              errorDetail = errJson.error?.message || errJson.error?.type || JSON.stringify(errJson.error) || responseText;
            } catch {}
            throw new Error(`Provider returned ${response.status}: ${errorDetail}`);
          }
          try {
            responseData = JSON.parse(responseText);
            const candidates = responseData.candidates || [];
            const content = candidates.length > 0
              ? (candidates[0].content?.parts || []).map(p => p.text || '').join('\n')
              : '';
            res.json({ success: true, response: content });
          } catch (parseError) {
            res.json({ success: true, response: responseText });
          }

        } else {
          const payload = {
            model: chatModel,
            messages: sanitizedMessages.map(m => ({ role: m.role, content: m.content })),
            temperature: chatTemp,
            max_tokens: chatMaxTokens
          };

          response = await fetch(`${chatBaseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          const responseBuffer = await response.arrayBuffer();
          const responseText = new TextDecoder('utf-8').decode(responseBuffer);
          if (!response.ok) {
            let errorDetail = responseText;
            try {
              const errJson = JSON.parse(responseText);
              errorDetail = errJson.error?.message || errJson.error?.type || JSON.stringify(errJson.error) || responseText;
            } catch {}
            throw new Error(`Provider returned ${response.status}: ${errorDetail}`);
          }

          try {
            let cleanText = responseText.trim();

            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              cleanText = cleanText.slice(firstBrace, lastBrace + 1);
            }

            responseData = JSON.parse(cleanText);
            const content = responseData.choices?.[0]?.message?.content || '';
            res.json({ success: true, response: content });
          } catch (parseError) {
            console.log('Response is not JSON, returning raw text:', responseText.substring(0, 200));
            res.json({ success: true, response: responseText });
          }
        }
      } catch (fetchError) {
        const errMsg = fetchError?.message || String(fetchError);
        console.error('Provider request failed:', errMsg);
        console.error('Provider request stack:', fetchError?.stack);
        res.status(500).json({ success: false, error: `Provider request failed: ${errMsg}` });
      }
    } catch (error) {
      console.error('Chat error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}