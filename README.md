# NASA Chatbot Proxy (local setup)

This project wraps your existing `index.html` with a small Node.js backend that securely calls the Google Generative Language (Gemini) API so you don't expose your API key in the browser.

## Files created
- `public/index.html` (patched copy of your uploaded index.html)
- `server.js` (Express proxy that calls the Generative Language API)
- `package.json`
- `.env.example` (copy and set real GEMINI_KEY here)
- `.gitignore`

## Step-by-step setup (on your machine)

1. Open a terminal and navigate to where you want the project stored.
2. Copy or move the created folder `nasa-chatbot-proxy` (this folder) to your machine if needed.
   - In this environment the project lives at `/mnt/data/nasa-chatbot-proxy`.
3. Enter the project folder:
   ```bash
   cd nasa-chatbot-proxy
   ```
4. Install node dependencies:
   ```bash
   npm install
   ```
5. Create a real `.env` file based on `.env.example` and add your Google Generative Language API key:
   ```bash
   cp .env.example .env
   # Then open .env and replace GEMINI_KEY=YOUR_GOOGLE_API_KEY_HERE with your key
   ```
   Make sure the API is enabled and billing is configured in your Google Cloud project.
6. Start the server:
   ```bash
   node server.js
   # or for dev with automatic reload (if you installed nodemon): npx nodemon server.js
   ```
7. Open your browser to `http://localhost:3000` and try the chatbot in the dashboard. The frontend now POSTs to `/api/chat` which forwards requests to Google securely.

## Troubleshooting
- If you see `Server not configured` when using the chat, ensure `.env` exists and `GEMINI_KEY` is set.
- If the server logs show upstream 401/403, check your Google API key, enabled APIs, and billing settings.
- Use browser DevTools -> Network to inspect POST `/api/chat` requests and responses.

## Security notes
- Do not commit `.env` or your API key to version control.
- For production, add authentication, rate-limiting, and request logging/monitoring.
