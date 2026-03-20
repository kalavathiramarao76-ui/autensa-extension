import { PageContext } from '@/shared/types';
import { QUICK_ACTIONS } from '@/shared/constants';
import { fuzzyMatch, FuzzyResult } from '@/shared/fuzzy';
import { getFrecencyScores, updateFrecency } from '@/shared/frecency';
import { getCommandHistory, addCommandHistory } from '@/shared/storage';

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

  let type: PageContext['type'] = 'general';
  if (url.includes('github.com')) type = 'github';
  else if (url.includes('vercel.com')) type = 'vercel';

  let content = '';
  const meta: Record<string, string> = {};

  if (type === 'github') {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) { meta.owner = match[1]; meta.repo = match[2]; }
    const codeBlock = document.querySelector('.blob-code-content, .highlight');
    if (codeBlock) {
      content = codeBlock.textContent?.slice(0, 3000) || '';
    } else {
      const body = document.querySelector('.markdown-body');
      content = body?.textContent?.slice(0, 3000) || '';
    }
    const prMatch = url.match(/\/(pull|issues)\/(\d+)/);
    if (prMatch) meta[prMatch[1] === 'pull' ? 'pr_number' : 'issue_number'] = prMatch[2];
  } else if (type === 'vercel') {
    const main = document.querySelector('main');
    content = main?.textContent?.slice(0, 2000) || '';
  } else {
    const article = document.querySelector('article') || document.querySelector('[role="main"]') || document.querySelector('main');
    if (article) {
      content = article.textContent?.slice(0, 3000) || '';
    } else {
      content = document.body.innerText?.slice(0, 2000) || '';
    }
  }

  return { url, title, content: content.trim(), selection, type, meta };
}

// ─── Command Palette ───────────────────────────────────────────────

let paletteActive = false;

interface PaletteItem {
  id: string;
  icon: string;
  label: string;
  description: string;
  prompt: string;
  section: 'action' | 'recent' | 'chat';
  fuzzyResult: FuzzyResult | null;
  frecency: number;
}

function highlightMatches(text: string, matches: number[]): string {
  if (!matches.length) return escapeHtml(text);
  const set = new Set(matches);
  let html = '';
  for (let i = 0; i < text.length; i++) {
    const ch = escapeHtml(text[i]);
    if (set.has(i)) {
      html += `<span class="match">${ch}</span>`;
    } else {
      html += ch;
    }
  }
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function injectCommandPalette() {
  if (paletteActive) { removeCommandPalette(); return; }
  paletteActive = true;

  // Pre-fetch data
  const [frecencyScores, commandHistory] = await Promise.all([
    getFrecencyScores(),
    getCommandHistory(),
  ]);

  const host = document.createElement('div');
  host.id = 'autensa-palette-host';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = PALETTE_CSS;
  shadow.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const palette = document.createElement('div');
  palette.className = 'palette';

  // Input area
  const inputWrap = document.createElement('div');
  inputWrap.className = 'input-wrap';
  inputWrap.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  `;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Ask Autensa anything...';
  input.setAttribute('autofocus', '');
  inputWrap.appendChild(input);
  palette.appendChild(inputWrap);

  // Results container
  const results = document.createElement('div');
  results.className = 'results';
  palette.appendChild(results);

  overlay.appendChild(palette);
  shadow.appendChild(overlay);
  document.body.appendChild(host);

  // State
  let selectedIndex = 0;
  let currentItems: PaletteItem[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function buildItems(query: string): PaletteItem[] {
    const items: PaletteItem[] = [];
    const q = query.trim();

    // Quick actions
    for (const action of QUICK_ACTIONS) {
      const fr = fuzzyMatch(q, action.label);
      if (!q || fr) {
        items.push({
          id: action.id,
          icon: action.icon,
          label: action.label,
          description: action.prompt.slice(0, 60),
          prompt: action.prompt,
          section: 'action',
          fuzzyResult: fr,
          frecency: frecencyScores[action.id] || 0,
        });
      }
    }

    // Recent commands
    const recentCmds = commandHistory.slice(0, 5);
    for (const cmd of recentCmds) {
      const fr = fuzzyMatch(q, cmd);
      if (!q || fr) {
        // Skip if it duplicates an action label
        const isAction = QUICK_ACTIONS.some(a => a.prompt === cmd);
        if (!isAction) {
          items.push({
            id: `recent:${cmd}`,
            icon: '🕐',
            label: cmd.length > 50 ? cmd.slice(0, 50) + '…' : cmd,
            description: '',
            prompt: cmd,
            section: 'recent',
            fuzzyResult: fr,
            frecency: frecencyScores[`recent:${cmd}`] || 0,
          });
        }
      }
    }

    // Sort by combined score
    items.sort((a, b) => {
      const scoreA = (a.fuzzyResult?.score || 1) * (1 + a.frecency);
      const scoreB = (b.fuzzyResult?.score || 1) * (1 + b.frecency);
      return scoreB - scoreA;
    });

    // Chat fallback when query exists and typed something
    if (q) {
      items.push({
        id: 'chat:free',
        icon: '💬',
        label: q,
        description: 'Send as chat message',
        prompt: q,
        section: 'chat',
        fuzzyResult: null,
        frecency: 0,
      });
    }

    return items;
  }

  function render(query: string) {
    currentItems = buildItems(query);
    selectedIndex = Math.min(selectedIndex, Math.max(0, currentItems.length - 1));

    let html = '';
    let lastSection = '';

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];

      // Section header
      if (item.section !== lastSection) {
        const label = item.section === 'action' ? 'ACTIONS' : item.section === 'recent' ? 'RECENT' : 'CHAT';
        html += `<div class="section-header">${label}</div>`;
        lastSection = item.section;
      }

      const selected = i === selectedIndex ? ' selected' : '';
      const labelHtml = item.fuzzyResult?.matches?.length
        ? highlightMatches(item.label, item.fuzzyResult.matches)
        : escapeHtml(item.label);
      const descHtml = item.description ? `<span class="item-desc">${escapeHtml(item.description)}</span>` : '';

      html += `<div class="item${selected}" data-index="${i}">
        <span class="item-icon">${item.icon}</span>
        <div class="item-text">
          <span class="item-label">${labelHtml}</span>
          ${descHtml}
        </div>
      </div>`;
    }

    if (!currentItems.length) {
      html = '<div class="empty">No results</div>';
    }

    results.innerHTML = html;
    scrollSelectedIntoView();
  }

  function scrollSelectedIntoView() {
    const el = results.querySelector('.item.selected') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function selectItem(item: PaletteItem) {
    removeCommandPalette();
    const message = item.prompt;

    // Update frecency and history
    updateFrecency(item.id);
    addCommandHistory(message);

    // Send to background
    chrome.runtime.sendMessage({ type: 'QUICK_ACTION', payload: { action: 'chat' } });
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    chrome.storage.local.set({ autensa_pending_message: message });
  }

  // Event: overlay click to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeCommandPalette();
  });

  // Event: click on items
  results.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (el) {
      const idx = parseInt(el.dataset.index || '0', 10);
      if (currentItems[idx]) selectItem(currentItems[idx]);
    }
  });

  // Event: hover to select
  results.addEventListener('mousemove', (e) => {
    const el = (e.target as HTMLElement).closest('.item') as HTMLElement | null;
    if (el) {
      const idx = parseInt(el.dataset.index || '0', 10);
      if (idx !== selectedIndex) {
        selectedIndex = idx;
        results.querySelectorAll('.item').forEach((item, i) => {
          item.classList.toggle('selected', i === idx);
        });
      }
    }
  });

  // Event: keyboard
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      removeCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentItems.length) {
        selectedIndex = (selectedIndex + 1) % currentItems.length;
        render(input.value);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentItems.length) {
        selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
        render(input.value);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentItems[selectedIndex]) {
        selectItem(currentItems[selectedIndex]);
      } else if (input.value.trim()) {
        // Fallback: send as free text
        selectItem({
          id: 'chat:free',
          icon: '💬',
          label: input.value.trim(),
          description: '',
          prompt: input.value.trim(),
          section: 'chat',
          fuzzyResult: null,
          frecency: 0,
        });
      }
    }
  });

  // Event: input with debounce
  input.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      selectedIndex = 0;
      render(input.value);
    }, 50);
  });

  // Initial render
  render('');
  setTimeout(() => input.focus(), 30);
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

// ─── Palette CSS ───────────────────────────────────────────────────

const PALETTE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  .overlay {
    position: fixed; inset: 0; z-index: 2147483647;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 20vh;
    animation: fadeIn 100ms ease-out;
  }

  .palette {
    width: 560px; max-width: 90vw;
    background: #18181b; border: 1px solid #27272a;
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    animation: scaleIn 150ms cubic-bezier(0.16,1,0.3,1);
    transform-origin: top center;
  }

  .input-wrap {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 20px; border-bottom: 1px solid #27272a;
  }
  .input-wrap svg { width: 20px; height: 20px; color: #71717a; flex-shrink: 0; }

  input {
    flex: 1; background: none; border: none; outline: none;
    color: #fafafa; font-size: 18px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.4;
  }
  input::placeholder { color: #52525b; }

  .results {
    max-height: 400px; overflow-y: auto;
    padding: 4px 0;
  }

  .results::-webkit-scrollbar { width: 4px; }
  .results::-webkit-scrollbar-track { background: transparent; }
  .results::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }

  .section-header {
    padding: 8px 20px 4px;
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: #52525b;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .item {
    display: flex; align-items: center; gap: 12px;
    height: 40px; padding: 0 20px;
    cursor: pointer; user-select: none;
    border-radius: 0;
    transition: background-color 60ms ease;
  }
  .item:hover, .item.selected {
    background: #27272a;
  }
  .item.selected {
    background: rgba(99,102,241,0.12);
  }

  .item-icon {
    font-size: 16px; width: 24px; text-align: center; flex-shrink: 0;
    line-height: 1;
  }

  .item-text {
    display: flex; align-items: baseline; gap: 8px;
    min-width: 0; flex: 1; overflow: hidden;
  }

  .item-label {
    color: #e4e4e7; font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .item-desc {
    color: #52525b; font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex-shrink: 1;
  }

  .match {
    color: #6366f1;
    font-weight: 600;
  }

  .empty {
    padding: 24px 20px; text-align: center;
    color: #52525b; font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.97) translateY(-8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
`;
