# ADO Assistant

An AI-powered Azure DevOps assistant grounded in live Microsoft Docs.

## Files

```
ado-assistant/
├── index.html       ← the chat UI
├── api/
│   └── chat.js      ← serverless function (keeps API key secure)
├── vercel.json      ← Vercel routing config
└── README.md
```

## Deploy to Vercel

### Step 1 — Push to GitHub
1. Go to https://github.com and sign in (or create a free account)
2. Click **New repository** → name it `ado-assistant` → click **Create repository**
3. Upload all files (drag and drop the entire folder)

### Step 2 — Deploy on Vercel
1. Go to https://vercel.com and sign in with your GitHub account
2. Click **Add New Project**
3. Select your `ado-assistant` repo → click **Import**
4. Before clicking Deploy, go to **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your key from https://console.anthropic.com
5. Click **Deploy**

### Step 3 — Share
Your bot will be live at `https://ado-assistant.vercel.app` (or similar).
Share that URL with your colleagues — no login required.

## Getting an Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key — you only see it once!
