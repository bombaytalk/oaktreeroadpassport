const sb = supabase.createClient(OTR.url, OTR.key);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg, bad){ const t=$('toast'); t.textContent=msg; t.style.background=bad?'var(--bad)':'var(--ok)'; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2600); }
const fmtTime = ts => new Date(ts).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const fmtDate = ts => new Date(ts).toLocaleDateString([], {month:'short',day:'numeric'});
function param(k){ const h=new URLSearchParams(location.hash.replace(/^#/,'')), q=new URLSearchParams(location.search); return q.get(k)||h.get(k); }
async function rpc(fn, args){ const {data,error}=await sb.rpc(fn,args); if(error) throw new Error(error.message); return data; }
// ---- sign-in by email: code or magic link ----
async function sendCode(email){ const {error}=await sb.auth.signInWithOtp({email, options:{shouldCreateUser:true, emailRedirectTo: location.href.split('#')[0]}}); if(error) throw new Error(error.message); }
async function verifyCode(email, code){ const {error}=await sb.auth.verifyOtp({email, token:code.trim(), type:'email'}); if(error) throw new Error(error.message); }
async function currentUser(){ const {data}=await sb.auth.getSession(); return data.session?.user||null; }
function wireSignIn(onSignedIn){
  $('si-send').addEventListener('click', async ()=>{ const e=$('si-email').value.trim().toLowerCase(); if(!e){toast('Enter your email',true);return;}
    try{ $('si-send').disabled=true; await sendCode(e); $('si-step2').classList.remove('hidden'); toast('Check your email for the code'); }catch(err){ toast(err.message,true); } finally{ $('si-send').disabled=false; } });
  $('si-verify').addEventListener('click', async ()=>{ const e=$('si-email').value.trim().toLowerCase(); try{ await verifyCode(e,$('si-code').value); }catch(err){ toast(err.message,true); } });
  let started=false; const start=u=>{ if(u && !started){ started=true; onSignedIn(u); } };
  sb.auth.onAuthStateChange((_ev, session)=>start(session?.user));
  currentUser().then(start);
}
async function signOut(){ await sb.auth.signOut(); location.reload(); }
function qrInto(el, text){ el.innerHTML=''; new QRCode(el,{text,width:200,height:200,colorDark:'#1E1B22',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M}); }
function csv(rows){ return rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n'); }
function download(name, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'})); a.download=name; a.click(); }
