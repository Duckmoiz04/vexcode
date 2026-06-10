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

  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, provider, apiKey, baseUrl, model, temperature, maxTokens } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: messages' });
      }

      if (!provider) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: provider. Configure AI in Settings.' });
      }
      if (!baseUrl) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: baseUrl. Configure AI in Settings.' });
      }
      if (!model) {
        return res.status(400).json({ success: false, error: 'Missing required parameter: model. Configure AI in Settings.' });
      }
      if (!apiKey && provider !== '9router') {
        return res.status(400).json({ success: false, error: 'Missing required parameter: apiKey. Configure AI in Settings.' });
      }

      if (provider !== undefined && typeof provider !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid type: provider must be a string.' });
      }
      if (temperature !== undefined && typeof temperature !== 'number') {
        return res.status(400).json({ success: false, error: 'Invalid type: temperature must be a number.' });
      }

      const chatBaseUrl = baseUrl.replace(/\/$/, '');
      const chatModel = model;
      const chatTemp = temperature ?? 0.7;
      const chatMaxTokens = maxTokens ?? 2048;

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      let response;
      let responseData;

      try {
        if (provider === 'anthropic') {
          const systemMsg = messages.find(m => m.role === 'system');
          const userMsgs = messages.filter(m => m.role !== 'system');

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
              'x-api-key': apiKey || '',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(payload)
          });

          const responseBuffer = await response.arrayBuffer();
          const responseText = new TextDecoder('utf-8').decode(responseBuffer);
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
          const contents = messages
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

          response = await fetch(`${chatBaseUrl}/v1beta/models/${chatModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const responseBuffer = await response.arrayBuffer();
          const responseText = new TextDecoder('utf-8').decode(responseBuffer);
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
            messages: messages.map(m => ({ role: m.role, content: m.content })),
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
        console.error('Provider request failed:', fetchError.message);
        res.status(500).json({ success: false, error: `Provider request failed: ${fetchError.message}` });
      }
    } catch (error) {
      console.error('Chat error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}