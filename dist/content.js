chrome.runtime.onMessage.addListener((e,a,i)=>(e.type==="GET_PAGE_CONTEXT"?i({type:"PAGE_CONTEXT_RESULT",payload:g()}):e.type==="OPEN_COMMAND_PALETTE"&&b(),!0));function g(){var p,u,m,f,y,x;const e=window.location.href,a=document.title,i=((p=window.getSelection())==null?void 0:p.toString())||"";let n="general";e.includes("github.com")?n="github":e.includes("vercel.com")&&(n="vercel");let t="";const s={};if(n==="github"){const o=e.match(/github\.com\/([^/]+)\/([^/]+)/);o&&(s.owner=o[1],s.repo=o[2]);const h=document.querySelector(".blob-code-content, .highlight");if(h)t=((u=h.textContent)==null?void 0:u.slice(0,3e3))||"";else{const d=document.querySelector(".markdown-body");t=((m=d==null?void 0:d.textContent)==null?void 0:m.slice(0,3e3))||""}const l=e.match(/\/(pull|issues)\/(\d+)/);l&&(s[l[1]==="pull"?"pr_number":"issue_number"]=l[2])}else if(n==="vercel"){const o=document.querySelector("main");t=((f=o==null?void 0:o.textContent)==null?void 0:f.slice(0,2e3))||""}else{const o=document.querySelector("article")||document.querySelector('[role="main"]')||document.querySelector("main");o?t=((y=o.textContent)==null?void 0:y.slice(0,3e3))||"":t=((x=document.body.innerText)==null?void 0:x.slice(0,2e3))||""}return{url:e,title:a,content:t.trim(),selection:i,type:n,meta:s}}let c=!1;function b(){if(c){r();return}c=!0;const e=document.createElement("div");e.id="autensa-palette-host";const a=e.attachShadow({mode:"closed"});a.innerHTML=`
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
  `,document.body.appendChild(e);const i=a.querySelector(".overlay"),n=a.querySelector("input");i.addEventListener("click",t=>{t.target===i&&r()}),n.addEventListener("keydown",t=>{if(t.key==="Escape")r();else if(t.key==="Enter"&&n.value.trim()){const s=n.value.trim();r(),chrome.runtime.sendMessage({type:"QUICK_ACTION",payload:{action:"chat"}}),chrome.runtime.sendMessage({type:"OPEN_SIDE_PANEL"}),chrome.storage.local.set({autensa_pending_message:s})}}),setTimeout(()=>n.focus(),50)}function r(){const e=document.getElementById("autensa-palette-host");e&&e.remove(),c=!1}document.addEventListener("keydown",e=>{e.key==="Escape"&&c&&r()});
