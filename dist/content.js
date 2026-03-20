import{c as U,e as q,Q as M}from"./chunks/constants-CN0gik8r.js";function L(e,s){const i=e.toLowerCase(),c=s.toLowerCase();if(!i)return{score:1,matches:[]};const a=[];let l=0,g=0,y=-2;for(let t=0;t<c.length&&g<i.length;t++)c[t]===i[g]&&(a.push(t),l+=y===t-1?8:1,(t===0||/[\s\-_/.]/.test(s[t-1]))&&(l+=5),t===g&&(l+=3),y=t,g++);return g<i.length?null:{score:l/i.length,matches:a}}const _="autensa_frecency";function P(e){const s=Date.now()-e,i=36e5,c=864e5,a=6048e5;return s<i?4:s<c?2:s<a?1:.5}async function N(){return(await chrome.storage.local.get(_))[_]||{}}async function R(e){const s=await N(),i=s[e]||{count:0};s[e]={count:i.count+1,lastUsed:Date.now()},await chrome.storage.local.set({[_]:s})}async function B(){const e=await N(),s={};for(const[i,c]of Object.entries(e))s[i]=c.count*P(c.lastUsed);return s}chrome.runtime.onMessage.addListener((e,s,i)=>(e.type==="GET_PAGE_CONTEXT"?i({type:"PAGE_CONTEXT_RESULT",payload:H()}):e.type==="OPEN_COMMAND_PALETTE"&&$(),!0));function H(){var g,y,t,x,u,d;const e=window.location.href,s=document.title,i=((g=window.getSelection())==null?void 0:g.toString())||"";let c="general";e.includes("github.com")?c="github":e.includes("vercel.com")&&(c="vercel");let a="";const l={};if(c==="github"){const m=e.match(/github\.com\/([^/]+)\/([^/]+)/);m&&(l.owner=m[1],l.repo=m[2]);const k=document.querySelector(".blob-code-content, .highlight");if(k)a=((y=k.textContent)==null?void 0:y.slice(0,3e3))||"";else{const v=document.querySelector(".markdown-body");a=((t=v==null?void 0:v.textContent)==null?void 0:t.slice(0,3e3))||""}const b=e.match(/\/(pull|issues)\/(\d+)/);b&&(l[b[1]==="pull"?"pr_number":"issue_number"]=b[2])}else if(c==="vercel"){const m=document.querySelector("main");a=((x=m==null?void 0:m.textContent)==null?void 0:x.slice(0,2e3))||""}else{const m=document.querySelector("article")||document.querySelector('[role="main"]')||document.querySelector("main");m?a=((u=m.textContent)==null?void 0:u.slice(0,3e3))||"":a=((d=document.body.innerText)==null?void 0:d.slice(0,2e3))||""}return{url:e,title:s,content:a.trim(),selection:i,type:c,meta:l}}let I=!1;function O(e,s){if(!s.length)return T(e);const i=new Set(s);let c="";for(let a=0;a<e.length;a++){const l=T(e[a]);i.has(a)?c+=`<span class="match">${l}</span>`:c+=l}return c}function T(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}async function $(){if(I){E();return}I=!0;const[e,s]=await Promise.all([B(),U()]),i=document.createElement("div");i.id="autensa-palette-host";const c=i.attachShadow({mode:"closed"}),a=document.createElement("style");a.textContent=F,c.appendChild(a);const l=document.createElement("div");l.className="overlay";const g=document.createElement("div");g.className="palette";const y=document.createElement("div");y.className="input-wrap",y.innerHTML=`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  `;const t=document.createElement("input");t.type="text",t.placeholder="Ask Autensa anything...",t.setAttribute("autofocus",""),y.appendChild(t),g.appendChild(y);const x=document.createElement("div");x.className="results",g.appendChild(x),l.appendChild(g),c.appendChild(l),document.body.appendChild(i);let u=0,d=[],m=null;function k(n){const r=[],p=n.trim();for(const o of M){const f=L(p,o.label);(!p||f)&&r.push({id:o.id,icon:o.icon,label:o.label,description:o.prompt.slice(0,60),prompt:o.prompt,section:"action",fuzzyResult:f,frecency:e[o.id]||0})}const w=s.slice(0,5);for(const o of w){const f=L(p,o);(!p||f)&&(M.some(C=>C.prompt===o)||r.push({id:`recent:${o}`,icon:"🕐",label:o.length>50?o.slice(0,50)+"…":o,description:"",prompt:o,section:"recent",fuzzyResult:f,frecency:e[`recent:${o}`]||0}))}return r.sort((o,f)=>{var S,z;const h=(((S=o.fuzzyResult)==null?void 0:S.score)||1)*(1+o.frecency);return(((z=f.fuzzyResult)==null?void 0:z.score)||1)*(1+f.frecency)-h}),p&&r.push({id:"chat:free",icon:"💬",label:p,description:"Send as chat message",prompt:p,section:"chat",fuzzyResult:null,frecency:0}),r}function b(n){var w,o;d=k(n),u=Math.min(u,Math.max(0,d.length-1));let r="",p="";for(let f=0;f<d.length;f++){const h=d[f];if(h.section!==p){const D=h.section==="action"?"ACTIONS":h.section==="recent"?"RECENT":"CHAT";r+=`<div class="section-header">${D}</div>`,p=h.section}const C=f===u?" selected":"",S=(o=(w=h.fuzzyResult)==null?void 0:w.matches)!=null&&o.length?O(h.label,h.fuzzyResult.matches):T(h.label),z=h.description?`<span class="item-desc">${T(h.description)}</span>`:"";r+=`<div class="item${C}" data-index="${f}">
        <span class="item-icon">${h.icon}</span>
        <div class="item-text">
          <span class="item-label">${S}</span>
          ${z}
        </div>
      </div>`}d.length||(r='<div class="empty">No results</div>'),x.innerHTML=r,v()}function v(){const n=x.querySelector(".item.selected");n&&n.scrollIntoView({block:"nearest"})}function A(n){E();const r=n.prompt;R(n.id),q(r),chrome.runtime.sendMessage({type:"QUICK_ACTION",payload:{action:"chat"}}),chrome.runtime.sendMessage({type:"OPEN_SIDE_PANEL"}),chrome.storage.local.set({autensa_pending_message:r})}l.addEventListener("click",n=>{n.target===l&&E()}),x.addEventListener("click",n=>{const r=n.target.closest(".item");if(r){const p=parseInt(r.dataset.index||"0",10);d[p]&&A(d[p])}}),x.addEventListener("mousemove",n=>{const r=n.target.closest(".item");if(r){const p=parseInt(r.dataset.index||"0",10);p!==u&&(u=p,x.querySelectorAll(".item").forEach((w,o)=>{w.classList.toggle("selected",o===p)}))}}),t.addEventListener("keydown",n=>{n.key==="Escape"?(n.preventDefault(),E()):n.key==="ArrowDown"?(n.preventDefault(),d.length&&(u=(u+1)%d.length,b(t.value))):n.key==="ArrowUp"?(n.preventDefault(),d.length&&(u=(u-1+d.length)%d.length,b(t.value))):n.key==="Enter"&&(n.preventDefault(),d[u]?A(d[u]):t.value.trim()&&A({id:"chat:free",label:t.value.trim(),prompt:t.value.trim()}))}),t.addEventListener("input",()=>{m&&clearTimeout(m),m=setTimeout(()=>{u=0,b(t.value)},50)}),b(""),setTimeout(()=>t.focus(),30)}function E(){const e=document.getElementById("autensa-palette-host");e&&e.remove(),I=!1}document.addEventListener("keydown",e=>{e.key==="Escape"&&I&&E()});const F=`
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
