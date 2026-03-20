import { PageContext } from '@/shared/types';

// Respond to page context requests
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_CONTEXT') {
    sendResponse({ type: 'PAGE_CONTEXT_RESULT', payload: extractPageContext() });
  } else if (msg.type === 'OPEN_COMMAND_PALETTE') {
    injectCommandPalette();
  }
  return true;
});

function extractPageContext(): PageContext {
  const url = window.location.href;
  const title = document.title;
  const selection = window.getSelection()?.toString() || '';

  // Determine page type
  let type: PageContext['type'] = 'general';
  if (url.includes('github.com')) type = 'github';
  else if (url.includes('vercel.com')) type = 'vercel';

  // Extract content intelligently
  let content = '';
  const meta: Record<string, string> = {};

  if (type === 'github') {
    // Extract repo info
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) { meta.owner = match[1]; meta.repo = match[2]; }

    // Try to get code content
    const codeBlock = document.querySelector('.blob-code-content, .highlight');
    if (codeBlock) {
      content = codeBlock.textContent?.slice(0, 3000) || '';
    } else {
      // PR or issue body
      const body = document.querySelector('.markdown-body');
      content = body?.textContent?.slice(0, 3000) || '';
    }

    // PR number
    const prMatch = url.match(/\/(pull|issues)\/(\d+)/);
    if (prMatch) meta[prMatch[1] === 'pull' ? 'pr_number' : 'issue_number'] = prMatch[2];
  } else if (type === 'vercel') {
    const main = document.querySelector('main');
    content = main?.textContent?.slice(0, 2000) || '';
  } else {
    // General: try article, main, or body
    const article = document.querySelector('article') || document.querySelector('[role="main"]') || document.querySelector('main');
    if (article) {
      content = article.textContent?.slice(0, 3000) || '';
    } else {
      content = document.body.innerText?.slice(0, 2000) || '';
    }
  }

  return { url, title, content: content.trim(), selection, type, meta };
}

// Command palette overlay
let paletteActive = false;

function injectCommandPalette() {
  if (paletteActive) { removeCommandPalette(); return; }
  paletteActive = true;

  const host = document.createElement('div');
  host.id = 'autensa-palette-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      .overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
        display: flex; align-items: flex-start; justify-content: center;
        padding-top: 20vh; animation: fadeIn 100ms ease-out;
      }
      .palette {
        width: 560px; max-width: 90vw;
        background: #18181b; border: 1px solid #27272a;
        border-radius: 16px; overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        animation: slideDown 150ms ease-out;
      }
      .input-wrap {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 20px; border-bottom: 1px solid #27272a;
      }
      .input-wrap svg { width: 20px; height: 20px; color: #71717a; flex-shrink: 0; }
      input {
        flex: 1; background: none; border: none; outline: none;
        color: #fafafa; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      input::placeholder { color: #52525b; }
      .hint { padding: 12px 20px; color: #52525b; font-size: 12px; font-family: -apple-system, sans-serif; }
      .kbd { background: #27272a; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #a1a1aa; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideDown { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
    </style>
    <div class="overlay">
      <div class="palette">
        <div class="input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Ask Autensa anything..." autofocus />
        </div>
        <div class="hint">
          <span class="kbd">Enter</span> to send &nbsp;&middot;&nbsp;
          <span class="kbd">Esc</span> to close
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(host);

  const overlay = shadow.querySelector('.overlay') as HTMLElement;
  const input = shadow.querySelector('input') as HTMLInputElement;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeCommandPalette();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removeCommandPalette();
    } else if (e.key === 'Enter' && input.value.trim()) {
      const message = input.value.trim();
      removeCommandPalette();
      // Send to background and open side panel
      chrome.runtime.sendMessage({ type: 'QUICK_ACTION', payload: { action: 'chat' } });
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      // Small delay then send the actual message via storage
      chrome.storage.local.set({ autensa_pending_message: message });
    }
  });

  setTimeout(() => input.focus(), 50);
}

function removeCommandPalette() {
  const host = document.getElementById('autensa-palette-host');
  if (host) host.remove();
  paletteActive = false;
}

// Listen for Escape globally to close palette
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && paletteActive) removeCommandPalette();
});
