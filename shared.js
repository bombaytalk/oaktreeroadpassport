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
function qrInto(el, text, logoUrl){ el.innerHTML=''; new QRCode(el,{text,width:220,height:220,colorDark:'#1E1B22',colorLight:'#ffffff',correctLevel:logoUrl?QRCode.CorrectLevel.H:QRCode.CorrectLevel.M});
  if(!logoUrl) return;
  const cv=el.querySelector('canvas'), im=el.querySelector('img'); if(!cv) return;
  const lg=new Image(); lg.crossOrigin='anonymous';
  lg.onload=()=>{ const x=cv.getContext('2d'); const S=cv.width, t=Math.round(S*0.26), p=Math.round(t*0.12), r=Math.round(t*0.18), o=(S-t)/2;
    x.fillStyle='#fff'; x.beginPath(); x.roundRect(o,o,t,t,r); x.fill(); x.drawImage(lg,o+p,o+p,t-2*p,t-2*p); if(im) im.src=cv.toDataURL('image/png'); };
  lg.src=logoUrl; }
function csv(rows){ return rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n'); }
function download(name, text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'})); a.download=name; a.click(); }

// ---- logo → clean square icon + brand color (runs on the phone) ----
async function processLogo(file){
  const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
  const c=document.createElement('canvas'); const W=Math.min(img.width,900), H=Math.round(img.height*W/img.width); c.width=W; c.height=H;
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,W,H);
  const d=x.getImageData(0,0,W,H).data;
  // bounding box of "ink": pixels that are not transparent and not near-white
  let minX=W,minY=H,maxX=0,maxY=0; const bright=v=>v>238;
  for(let y=0;y<H;y++) for(let xx=0;xx<W;xx++){ const i=(y*W+xx)*4; if(d[i+3]<30) continue; if(bright(d[i])&&bright(d[i+1])&&bright(d[i+2])) continue; if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(y<minY)minY=y; if(y>maxY)maxY=y; }
  if(maxX<=minX||maxY<=minY){ minX=0;minY=0;maxX=W-1;maxY=H-1; }
  // brand color: average of clearly colored pixels, fallback to darkest common
  let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=16){ if(d[i+3]<30) continue; const R=d[i],G=d[i+1],B=d[i+2]; const mx=Math.max(R,G,B),mn=Math.min(R,G,B); if(mx-mn<40||mx>245) continue; r+=R;g+=G;b+=B;n++; }
  if(!n){ for(let i=0;i<d.length;i+=16){ if(d[i+3]<30) continue; const R=d[i],G=d[i+1],B=d[i+2]; if(R+G+B>600) continue; r+=R;g+=G;b+=B;n++; } }
  const hex=n?'#'+[r,g,b].map(v=>Math.round(v/n).toString(16).padStart(2,'0')).join(''):'#5A2438';
  // square, padded, 256px, transparent background where the source was transparent, otherwise white
  const bw=maxX-minX+1, bh=maxY-minY+1, side=Math.max(bw,bh), pad=Math.round(side*0.12), S=256;
  const o=document.createElement('canvas'); o.width=S; o.height=S; const ox=o.getContext('2d');
  const scale=(S-2*pad*S/(side+2*pad))/side; const dw=bw*scale, dh=bh*scale;
  ox.drawImage(c,minX,minY,bw,bh,(S-dw)/2,(S-dh)/2,dw,dh);
  const blob=await new Promise(res=>o.toBlob(res,'image/png',0.92));
  return {blob, color:hex, preview:o.toDataURL('image/png')};
}
async function uploadLogo(blob){
  const name=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)+'.png';
  const {error}=await sb.storage.from('logos').upload(name, blob, {contentType:'image/png', upsert:false});
  if(error) throw new Error(error.message);
  return sb.storage.from('logos').getPublicUrl(name).data.publicUrl;
}
