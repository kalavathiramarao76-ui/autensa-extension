# Autensa — Agentic AI Assistant with Real Tool Execution

![Version](https://img.shields.io/badge/version-1.0.0-06b6d4?style=flat-square)
![License](https://img.shields.io/badge/license-ISC-06b6d4?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-06b6d4?style=flat-square&logo=googlechrome&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)

> An agentic AI assistant that goes beyond chat — it executes real tools against GitHub and Vercel, reasons through multi-step workflows, and remembers your session context.

<p align="center">
  <img src="src/assets/icons/icon-128.png" alt="Autensa Icon" width="128" />
</p>

## Features

- :robot: **Agentic Loop** — Multi-step reasoning with automatic tool selection and execution
- :octocat: **GitHub Tools** — Search repos, list issues/PRs, browse code, create issues, and more
- :rocket: **Vercel Tools** — List projects, view deployments, trigger redeploys, check deployment status
- :brain: **Dual LLM Support** — Claude API (cloud) and Ollama (local) — switch models on the fly
- :keyboard: **Command Palette** — Quick access to tools and actions with keyboard shortcuts
- :zap: **LRU Cache** — Intelligent caching of API responses for faster repeated queries
- :scroll: **Session History** — Persistent conversation history with context carryover
- :art: **Tailwind UI** — Clean, responsive interface with dark mode support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript |
| Styling | Tailwind CSS, @tailwindcss/typography |
| Build | Vite |
| Markdown | marked |
| AI Models | Claude API, Ollama |
| Integrations | GitHub API, Vercel API |
| Platform | Chrome Extension (Manifest V3) |

## Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd autensa-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API keys**
   - Add your Claude API key and/or configure Ollama endpoint
   - Add GitHub personal access token for GitHub tools
   - Add Vercel API token for Vercel tools

4. **Build the extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the `dist` folder

## Usage

### Chat Interface
1. Open Autensa from the Chrome toolbar
2. Type a natural language request (e.g., "List open issues in my repo")
3. The agentic loop will select the right tool, execute it, and present results

### GitHub Tools
- **Search repositories** — "Find repos matching kubernetes"
- **List issues** — "Show open issues in owner/repo"
- **View pull requests** — "List PRs for owner/repo"
- **Code search** — "Search for handleError in owner/repo"

### Vercel Tools
- **List projects** — "Show my Vercel projects"
- **View deployments** — "List recent deployments for my-app"
- **Redeploy** — "Redeploy the latest deployment of my-app"

### Command Palette
- Press the keyboard shortcut to open the command palette
- Search and execute any available tool directly

## Architecture

```
autensa-extension/
├── src/
│   ├── assets/
│   │   └── icons/          # Extension icons (16, 48, 128px)
│   ├── components/         # React UI components
│   ├── tools/              # Tool definitions & executors
│   │   ├── github/         # GitHub tool implementations
│   │   └── vercel/         # Vercel tool implementations
│   ├── services/           # LLM clients (Claude, Ollama)
│   ├── agent/              # Agentic loop & reasoning engine
│   ├── cache/              # LRU cache implementation
│   ├── hooks/              # Custom React hooks
│   └── App.tsx             # Main entry point
├── manifest.json           # Chrome Manifest V3 config
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## Screenshots

<p align="center">
  <img src="src/assets/icons/icon-128.png" alt="Autensa Icon" width="128" />
</p>

| Icon | Size |
|------|------|
| ![16px](src/assets/icons/icon-16.png) | 16x16 |
| ![48px](src/assets/icons/icon-48.png) | 48x48 |
| ![128px](src/assets/icons/icon-128.png) | 128x128 |

## License

ISC
