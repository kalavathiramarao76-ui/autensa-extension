const n={provider:"ollama",claudeApiKey:"",githubToken:"",vercelToken:"",maxIterations:10,model:"gpt-oss:120b",ollamaEndpoint:"https://sai.sharedllm.com/v1",theme:"system"},t={settings:"autensa_settings",sessions:"autensa_sessions",commandHistory:"autensa_cmd_history"};async function r(){const e=await chrome.storage.local.get(t.settings);return{...n,...e[t.settings]}}async function c(e){const s=await r();await chrome.storage.local.set({[t.settings]:{...s,...e}})}async function i(){return(await chrome.storage.local.get(t.sessions))[t.sessions]||[]}async function u(e){const s=await i(),a=s.findIndex(o=>o.id===e.id);a>=0?s[a]=e:s.unshift(e),await chrome.storage.local.set({[t.sessions]:s.slice(0,50)})}async function m(e){const s=await i();await chrome.storage.local.set({[t.sessions]:s.filter(a=>a.id!==e)})}async function l(){return(await chrome.storage.local.get(t.commandHistory))[t.commandHistory]||[]}async function d(e){const s=await l(),a=[e,...s.filter(o=>o!==e)].slice(0,20);await chrome.storage.local.set({[t.commandHistory]:a})}const p="https://api.anthropic.com/v1/messages",h="https://api.github.com",g="https://api.vercel.com",y=`You are Autensa, a fast and precise AI assistant embedded in the user's browser. You can perform real actions through tools — not just chat.

Key behaviors:
- Be extremely concise. No filler, no preamble.
- When you have a tool available for a task, USE it immediately. Don't ask for permission.
- Format responses in clean markdown when helpful.
- If page context is provided, use it intelligently without restating it.
- For code, always use fenced code blocks with language tags.
- When executing tasks, briefly state what you're doing, then do it.

Data display formatting:
- When displaying lists of items (issues, repos, deployments, PRs), use markdown tables for clean presentation.
- Use emoji status indicators: 🟢 open, 🔴 closed, ✅ ready, 🔄 building, ❌ error.
- Keep tables concise — truncate long values and avoid unnecessary columns.
- For single items, use clean key-value formatting with bold keys.
- Always include clickable links where available.
- Tool results are already pre-formatted as markdown tables — present them directly without wrapping in code blocks.

You have access to tools for GitHub (issues, PRs, repos) and Vercel (deployments, projects). Use them proactively when the user's request involves these platforms.`,w=[{id:"summarize",label:"Summarize Page",icon:"📄",prompt:"Summarize the current page content concisely."},{id:"github-issues",label:"List Issues",icon:"🔍",prompt:"List my recent open GitHub issues."},{id:"vercel-status",label:"Deploy Status",icon:"🚀",prompt:"Show my recent Vercel deployments and their status."},{id:"explain-code",label:"Explain Code",icon:"💡",prompt:"Explain the code on this page clearly and concisely."},{id:"create-issue",label:"Create Issue",icon:"➕",prompt:"Help me create a GitHub issue based on what I see on this page."},{id:"review-pr",label:"Review PR",icon:"👀",prompt:"Review the pull request on this page. Highlight key changes, potential issues, and suggestions."}];export{p as C,n as D,h as G,w as Q,y as S,g as V,c as a,i as b,l as c,m as d,d as e,r as g,u as s};
