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

// Load local knowledge base
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

app.post('/api/chat', async (req, res) => {
  const { query, persona, searchMode, contextDocs, context } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query in request body' });

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: set GEMINI_KEY in .env' });

  // Persona instruction
  const personaInstruction = persona === 'student'
    ? 'You are a helpful assistant for space biology. Explain concepts simply.'
    : 'You are a helpful technical assistant for space biology. Provide precise, technical answers.';

  // Context depending on mode
  let ctxText;
  if (searchMode === "local") {
    ctxText = localDocs.map(d => `Title: ${d.title}\nSummary: ${d.summary}`).join("\n\n---\n\n");
  } else {
    ctxText = Array.isArray(contextDocs) && contextDocs.length
      ? contextDocs.map(d => `Title: ${d.title}\nSummary: ${d.summary}`).join("\n\n---\n\n")
      : (context || "Use your general knowledge about space biology.");
  }

  // Payload for Gemini
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

  const model = process.env.GEMINI_MODEL || "gemini-2.5-pro";
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  try {
    const gRes = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000
    });
    const data = gRes.data;
    const answer = extractTextFromGenAIResponse(data) || 'Model returned no answer.';
    return res.json({ answer });
  } catch (err) {
    console.error('Upstream API error:', err.response ? err.response.data : err.message);
    return res.status(502).json({ error: 'Upstream API error', details: err.response ? err.response.data : err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
