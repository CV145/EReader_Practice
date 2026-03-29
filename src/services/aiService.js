const MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro'
];

export const listModels = async (apiKey) => {
  if (!apiKey) throw new Error('API Key missing');
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
      console.log("--- AVAILABLE GEMINI MODELS ---");
      data.models.forEach(m => console.log(`- ${m.name.replace('models/', '')}`));
      console.log("-------------------------------");
      return data.models;
    }
  } catch (e) {
    console.error("Failed to list models:", e);
  }
  return [];
};

export const chatWithGemini = async (apiKey, chapterText, history, userPrompt) => {
  if (!apiKey) throw new Error('API Key is missing. Please set it in Settings.');

  // Auto-detect valid model from ListModels
  let availableModels = await listModels(apiKey);
  
  // Filter for models that support generateContent and are Gemini models
  const validModels = availableModels
    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
    .map(m => m.name.replace('models/', ''));

  if (validModels.length === 0) {
    throw new Error('Your API Key does not have access to any Gemini models that support generateContent.');
  }

  // Priority list for auto-selection
  const priority = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];
  let selectedModel = validModels.find(m => priority.includes(m)) || validModels[0];

  console.log(`Auto-selected Gemini model: ${selectedModel}`);
  
  try {
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

    // Prepare contents with history
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const systemContext = `You are a helpful reading assistant. You are currently helping the user read a specific chapter from an E-Book. 
    CONTEXT (Current Chapter Text):
    """${chapterText}"""
    Use this context to answer questions accurately. If the user asks for a summary, provide a concise one.`;

    contents.push({
      role: 'user',
      parts: [{ text: `${systemContext}\n\nUSER QUESTION: ${userPrompt}` }]
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      }),
    });

    const data = await response.json();
    clearTimeout(timeoutId);

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (error) {
    console.error(`AI Error with ${selectedModel}:`, error.message);
    throw error;
  }

  throw new Error(`Failed to get a response from ${selectedModel}.`);
};
