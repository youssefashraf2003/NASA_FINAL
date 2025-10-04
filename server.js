// server.js
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Load local knowledge base from data.json
const dataPath = path.join(__dirname, 'data.json');
let localDocs = [];
if (fs.existsSync(dataPath)) {
  localDocs = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

// Helper: extract clean text from Gemini API response
function extractTextFromGenAIResponse(data) {
  try {
    if (!data) return null;
    if (Array.isArray(data.candidates) && data.candidates.length) {
      const cand = data.candidates[0];
      if (cand.content?.parts?.length) {
        return cand.content.parts.map(p => p.text || '').join("\n\n");
      }
    }
    return JSON.stringify(data, null, 2);
  } catch (err) {
    return null;
  }
}

// Endpoint for performing web searches
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Missing query' });
  }
  try {
    const searchResults = await google_search.search(queries=[query]);
    if (searchResults && searchResults[0].results) {
      const formattedResults = searchResults[0].results.map(r => ({
        Title: r.source_title,
        URL: r.url,
        Summary: r.snippet
      }));
      return res.json(formattedResults);
    }
    res.json([]);
  } catch (error) {
    console.error('Web search error:', error);
    res.status(500).json({ error: 'Failed to perform web search' });
  }
});


app.post('/api/chat', async (req, res) => {
  const { query, persona, searchMode, contextDocs } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query in request body' });

  // Handle off-topic greetings
  const lowerCaseQuery = query.toLowerCase().trim();
  const greetings = ['hello', 'hi', 'hey', 'howdy'];
  if (greetings.includes(lowerCaseQuery)) {
    return res.json({ answer: 'Hello! I am a chatbot designed to answer questions about space biology. Ask me anything about the subject.', sources: [] });
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: set GEMINI_KEY in .env' });

  const personaInstruction = persona === 'student'
    ? 'You are a helpful assistant for space biology. Explain concepts simply and keep your entire response brief. After your response, you MUST list the URLs of the sources you used from the context under a "Sources:" heading.'
    : 'You are a helpful technical assistant for space biology. Provide a comprehensive, precise, and detailed technical answer. After your response, you MUST list the URLs of the sources you used from the context under a "Sources:" heading.';

  let ctxText = "Use your general knowledge about space biology.";
  let sources = [];

  // **FIXED LOGIC**: This block now correctly processes the context sent from the browser for both local and web searches.
  if (Array.isArray(contextDocs) && contextDocs.length > 0) {
      // Normalize the keys from the browser (handles 'title'/'Title', 'pubUrl'/'URL', etc.)
      const normalizedDocs = contextDocs.map(doc => ({
          Title: doc.title || doc.Title || 'Unknown Source',
          URL: doc.pubUrl || doc.URL,
          Summary: doc.summary || doc.Summary || ''
      })).filter(doc => doc.URL); // Only include docs that have a URL

      if (normalizedDocs.length > 0) {
        ctxText = normalizedDocs.map(d => `Title: ${d.Title}\nURL: ${d.URL}\nSummary: ${d.Summary}`).join("\n\n---\n\n");
        sources = normalizedDocs.map(d => ({ URL: d.URL, Title: d.Title }));
      }
  }

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${personaInstruction}\n\nContext:\n${ctxText}\n\nUser Query: ${query}`
          }
        ]
      }
    ]
  };

  const model = process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  try {
    const gRes = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000 
    });
    const data = gRes.data;
    const answer = extractTextFromGenAIResponse(data) || 'Model returned no answer.';
    // Return the answer and the correctly populated sources array
    return res.json({ answer, sources });
  } catch (err) {
    console.error('Upstream API error:', err.response ? err.response.data : err.message);
    if (err.code === 'ECONNABORTED') {
        return res.status(504).json({ error: 'Upstream API request timed out.', details: 'The model took too long to respond.' });
    }
    return res.status(502).json({ error: 'Upstream API error', details: err.response ? err.response.data : err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});