'use strict';
/* ===== Persistencia: un único documento JSON en IndexedDB ===== */
let S,dbp;
const open=()=>dbp??=new Promise((ok,ko)=>{const q=indexedDB.open('apiario',1);q.onupgradeneeded=()=>q.result.createObjectStore('s');q.onsuccess=()=>ok(q.result);q.onerror=()=>ko(q.error)});
const load=async()=>{const d=await open();return new Promise(r=>{const q=d.transaction('s').objectStore('s').get('db');q.onsuccess=()=>r(q.result)})};
const save=async()=>{const d=await open();return new Promise(r=>{const t=d.transaction('s','readwrite');t.objectStore('s').put(S,'db');t.oncomplete=r})};
const blank=()=>({v:1,locs:[],types:[],items:[],pairs:{}});

/* ===== Catálogo (editar aquí para ampliar): [categoría, tipo, prefijo código, lleva modelo, lleva código] ===== */
const CATS=['Colmenas','Herramientas','Otros'],MODELS=['Layens','Langstroth'];
const ST=['Nuevo','Usado como nuevo','Muy buen estado','Buen estado','Malo pero usable','Mal estado'];
const BASE=[['Colmenas','Colmena completa','C',1,1],['Colmenas','Cámara de cría','CC',1,1],['Colmenas','Alza','A',1,1],['Colmenas','Media alza','MA',1,1],['Colmenas','Fondo sanitario','FS',1,1],['Colmenas','Fondo normal','F',1,1],['Colmenas','Tapa','T',1,1],['Colmenas','Entretapa','ET',1,1],['Colmenas','Núcleo','N',1,1],['Colmenas','Cuadro','',1,0],
['Herramientas','Extractor','',0,0],['Herramientas','Palanca','',0,0],['Herramientas','Cepillo','',0,0],['Herramientas','Ahumador','',0,0],['Herramientas','Careta y traje','',0,0],
['Otros','Excluidor de reina','',0,0],['Otros','Rejilla de propóleo','',0,0],['Otros','Aislante de poliespán','',0,0],['Otros','Poncho','',0,0]];
const IC={res:'M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-3H4z',inv:'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',mov:'M4 8h13m-4-4l4 4-4 4M20 16H7m4-4l-4 4 4 4',fit:'M10 14a4 4 0 010-6l2-2a4 4 0 016 6l-1 1M14 10a4 4 0 010 6l-2 2a4 4 0 01-6-6l1-1',more:'M5 12h.01M12 12h.01M19 12h.01'};
const TABS=[['res','Resumen'],['inv','Inventario'],['mov','Mover'],['fit','Encajes'],['mas','Más']];
const IK={res:'res',inv:'inv',mov:'mov',fit:'fit',mas:'more'};

/* ===== Utilidades ===== */
const $=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
const sum=a=>a.reduce((s,i)=>s+i.qty,0),pk=(a,b)=>[a,b].sort().join('~');
const T=()=>[...BASE,...S.types],tinfo=(c,t)=>T().find(x=>x[0]==c&&x[1]==t)||[c,t,'',0,0];
const coded=i=>tinfo(i.cat,i.type)[4],locName=id=>S.locs.find(l=>l.id==id)?.name||'Sin ubicación';
const gkey=i=>[i.cat,i.type,i.model||'',norm(i.name||i.type)].join('|');
const groups=a=>{const m={};a.forEach(i=>(m[gkey(i)]??=[]).push(i));return Object.values(m)};
const ic=n=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${IC[n]}"/></svg>`;
const toast=m=>{const e=document.createElement('div');e.className='ts';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),2300)};
const sheet=h=>{const s=$('#sh');if(!h){s.className='';setTimeout(()=>{if(!s.className)s.innerHTML=''},300);return}
  const was=s.className=='on';s.innerHTML=`<div class="bk" data-a="close"></div><div class="pn">${h}</div>`;
  if(!was)requestAnimationFrame(()=>requestAnimationFrame(()=>s.className='on'))};
const opts=(a,v)=>a.map(x=>`<option${x==v?' selected':''}>${esc(x)}</option>`).join('');
const locOpts=(v,first)=>`<option value="">${first}</option>`+S.locs.map(l=>`<option value="${l.id}"${l.id==v?' selected':''}>${esc(l.name)}</option>`).join('');
const sugg=(c,t,m)=>{const x=tinfo(c,t);if(!x[4])return'';const p=x[2]+(m=='Layens'?'L':m=='Langstroth'?'S':'');
  const n=S.items.filter(i=>i.code&&i.code.startsWith(p)&&/^\d+$/.test(i.code.slice(p.length))).map(i=>+i.code.slice(p.length));return p+(Math.max(0,...n)+1)};

/* ===== Estado de UI ===== */
let view='res',F={cat:'',loc:'',q:''},MV={from:'',to:'',sel:{}},CP={a:'',t:'',ok:false},FD;

/* ===== Vistas ===== */
const V={
res(){const by=f=>{const m={};S.items.forEach(i=>{const k=f(i);m[k]=(m[k]||0)+i.qty});return Object.entries(m).sort()};
  const row=([k,v])=>`<div class="rw"><span>${esc(k)}</span><b>${v}</b></div>`,box=a=>`<div class="cd">${a.map(row).join('')||'<p class="mu c">Aún no hay material.</p>'}</div>`;
  return `<div class="kp"><div><b>${sum(S.items)}</b><small>unidades</small></div><div><b>${sum(S.items.filter(i=>!i.std))}</b><small>no estándar</small></div><div><b>${S.locs.length}</b><small>ubicaciones</small></div></div>
  <h3>Por categoría</h3>${box(by(i=>i.cat))}<h3>Por tipo</h3>${box(by(i=>i.type+(i.model?' '+i.model:'')))}<h3>Por ubicación</h3>${box(by(i=>locName(i.loc)))}`},
inv(){return `<input data-f="q" type="search" placeholder="Buscar nombre, tipo o código…" value="${esc(F.q)}"><div class="fl"><select data-f="cat"><option value="">Todas las categorías</option>${opts(CATS,F.cat)}</select><select data-f="loc"><option value="">Todas las ubicaciones</option><option value="-"${F.loc=='-'?' selected':''}>Sin ubicación</option>${S.locs.map(l=>`<option value="${l.id}"${l.id==F.loc?' selected':''}>${esc(l.name)}</option>`).join('')}</select></div><div id="lst">${invList()}</div>`},
mov(){const at=S.items.filter(i=>MV.from=='-'?!i.loc:i.loc==MV.from),co=at.filter(coded),gr=groups(at.filter(i=>!coded(i)));
  const sel=(k,v)=>`<select data-m="${k}"><option value="">Elige…</option><option value="-"${v=='-'?' selected':''}>Sin ubicación</option>${S.locs.map(l=>`<option value="${l.id}"${l.id==v?' selected':''}>${esc(l.name)}</option>`).join('')}</select>`;
  const lbl=i=>`${esc(i.type)}${i.model?' '+i.model:''}`;
  return `<div class="cd p"><label>Desde${sel('from',MV.from)}</label><label>Hasta${sel('to',MV.to)}</label></div>`+(MV.from?
   `<h3>Con código</h3><div class="cd">${co.map(i=>`<label class="ck rw"><span><b>${esc(i.code)}</b> ${lbl(i)}</span><input type="checkbox" data-c="${i.id}"${MV.sel[i.id]?' checked':''}></label>`).join('')||'<p class="mu c">Nada con código aquí.</p>'}</div>
   <h3>Por cantidad</h3><div class="cd">${gr.map(g=>`<div class="rw"><span>${esc(g[0].name||g[0].type)}${g[0].model?' · '+g[0].model:''}<small>Hay ${sum(g)}</small></span><input type="number" inputmode="numeric" min="0" max="${sum(g)}" data-g="${esc(gkey(g[0]))}" value="${MV.sel['g:'+gkey(g[0])]||0}"></div>`).join('')||'<p class="mu c">Nada por cantidad aquí.</p>'}</div>
   <button class="bt pr w100" data-a="move">Mover selección</button>`:'<p class="mu c">Elige el origen para ver el material.</p>')},
fit(){const co=S.items.filter(coded);if(!co.length)return'<p class="mu c">Añade piezas con código para registrar qué encaja con qué.</p>';
  const lab=i=>`${i.code} · ${i.type}${i.model?' '+i.model:''}${i.name?' · '+i.name:''}`,A=co.find(i=>i.id==CP.a);
  let h=`<label>Pieza<select data-p="a"><option value="">Elige pieza…</option>${co.map(i=>`<option value="${i.id}"${i.id==CP.a?' selected':''}>${esc(lab(i))}</option>`).join('')}</select></label>`;
  if(A){const ot=[...new Set(co.filter(i=>i.id!=A.id).map(i=>i.type))];
   h+=`<label>Busco<select data-p="t"><option value="">Cualquier tipo</option>${opts(ot,CP.t)}</select></label><label class="ck"><input type="checkbox" data-p="ok"${CP.ok?' checked':''}> Solo los que encajan</label><h3>Encaja con…</h3><div class="cd">`+
   (co.filter(i=>i.id!=A.id&&(!CP.t||i.type==CP.t)).map(i=>({i,r:S.pairs[pk(A.id,i.id)]||''})).filter(x=>!CP.ok||x.r=='ok').map(({i,r})=>`<div class="rw"><span><b>${esc(i.code)}</b> ${esc(i.type)}${i.model?' '+esc(i.model):''}<small>${esc(locName(i.loc))}</small></span><div class="sg" data-b="${i.id}">${[['ok','Sí'],['no','No'],['','—']].map(([v,l])=>`<button data-a="pr" data-r="${v}" class="${r==v?'on '+v:''}">${l}</button>`).join('')}</div></div>`).join('')||'<p class="mu c">Sin resultados.</p>')+'</div>'}
  return h},
mas(){return `<h3>Ubicaciones</h3><div class="cd">${S.locs.map(l=>`<button class="rc" data-a="lform" data-id="${l.id}"><div><b>${esc(l.name)}</b><small>${esc(l.kind)} · ${sum(S.items.filter(i=>i.loc==l.id))} uds</small></div>›</button>`).join('')||'<p class="mu c">Aún no hay ubicaciones.</p>'}</div><button class="bt pr w100" data-a="lform">+ Nueva ubicación</button>
  <h3>Datos</h3><div class="cd p"><button class="bt" data-a="xj">Exportar JSON (copia de seguridad)</button><button class="bt" data-a="xc">Exportar CSV</button><label class="bt">Importar JSON<input type="file" accept=".json,application/json" data-a="imp" hidden></label></div><p class="mu c">${S.items.length} registros · guardados solo en este dispositivo</p>`}};

const fil=()=>S.items.filter(i=>(!F.cat||i.cat==F.cat)&&(!F.loc||(F.loc=='-'?!i.loc:i.loc==F.loc))&&(!F.q||norm([i.name,i.type,i.model,i.code,i.note,i.status].join(' ')).includes(norm(F.q))));
function invList(){const its=fil(),ord=i=>T().findIndex(x=>x[0]==i.cat&&x[1]==i.type);if(!its.length)return`<p class="mu c">${S.items.length?'Sin resultados.':'Pulsa + para añadir tu primer material.'}</p>`;
  its.sort((a,b)=>ord(a)-ord(b)||(a.model||'').localeCompare(b.model||''));let h='';
  CATS.forEach(c=>{const ci=its.filter(i=>i.cat==c);if(!ci.length)return;h+=`<h3>${c}<span>${sum(ci)}</span></h3>`;const bt=new Map();
   ci.forEach(i=>{const k=i.type+(i.model?' · '+i.model:'');bt.set(k,[...(bt.get(k)||[]),i])});
   bt.forEach((v,k)=>{h+=`<div class="cd" style="margin-bottom:10px"><div class="th"><b>${esc(k)}</b><span>${sum(v)}</span></div>`+groups(v).map(g=>{const m={};g.forEach(i=>m[locName(i.loc)]=(m[locName(i.loc)]||0)+i.qty);const ns=g.filter(i=>!i.std).length;
     return `<button class="gc" data-a="grp" data-k="${esc(gkey(g[0]))}"><div><b>${esc(g[0].name||g[0].type)}</b><small>${Object.entries(m).map(([a,b])=>esc(a)+' ×'+b).join(' · ')}</small>${ns?`<em>${ns} no estándar</em>`:''}</div><span>${sum(g)}</span></button>`}).join('')+'</div>'})});return h}

function render(keep=true){const y=scrollY;$('#nav').innerHTML=TABS.map(t=>`<button data-a="tab" data-v="${t[0]}" class="${view==t[0]?'on':''}">${ic(IK[t[0]])}<span>${t[1]}</span></button>`).join('');
  $('#top').innerHTML=`<h1>${TABS.find(t=>t[0]==view)[1]}</h1>`;$('#app').innerHTML=V[view]();$('#fab').hidden=view!='inv';scrollTo(0,keep?y:0)}

/* ===== Detalle de grupo y formulario ===== */
function grp(k){const g=S.items.filter(i=>gkey(i)==k);if(!g.length)return sheet();
  sheet(`<h2>${esc(g[0].name||g[0].type)}</h2><div class="sub">${esc(g[0].type)}${g[0].model?' · '+g[0].model:''}</div><div class="cd">`+g.map(i=>`<button class="rc" data-a="edit" data-id="${i.id}"><div><b>${i.code?esc(i.code):'×'+i.qty}</b><span class="tg">${esc(i.status)}</span>${i.std?'':'<span class="tg w">No estándar</span>'}<small>${esc(locName(i.loc))}${i.type=='Núcleo'?` · ${esc(i.n)} cuadros ${esc(i.mat)}`:''}</small>${i.note?`<small>${esc(i.note)}</small>`:''}${i.ext||i.int?`<small>Ext ${esc(i.ext||'—')} · Int ${esc(i.int||'—')}</small>`:''}</div>›</button>`).join('')+'</div><button class="bt" data-a="close">Cerrar</button>')}
function form(d){FD=d;const ti=tinfo(d.cat,d.type),names=[...new Set(S.items.filter(i=>i.type==d.type).map(i=>i.name).filter(Boolean))],f=(l,h)=>`<label>${l}${h}</label>`,cu=d.type=='Cuadro';
  sheet(`<h2>${d.id?'Editar':'Añadir'} material</h2>`+f('Categoría',`<select data-k="cat">${opts(CATS,d.cat)}</select>`)
  +f('Tipo',`<select data-k="type">${opts(T().filter(x=>x[0]==d.cat).map(x=>x[1]),d.type)}<option value="+">＋ Nuevo tipo…</option></select>`)
  +(ti[3]?f('Modelo',`<select data-k="model">${opts(MODELS,d.model)}</select>`):'')
  +f('Nombre (opcional)',`<input data-k="name" value="${esc(d.name)}" list="nm" placeholder="${esc(d.type)}"><datalist id="nm">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`)
  +(ti[4]?f('Código',`<input data-k="code" value="${esc(d.code)}" autocapitalize="characters">`):f('Cantidad',`<input data-k="qty" type="number" inputmode="numeric" min="1" value="${d.qty}">`))
  +f('Estado',`<select data-k="status">${opts(ST,d.status)}</select>`)+f('Ubicación',`<select data-k="loc">${locOpts(d.loc,'Sin ubicación')}</select>`)
  +(d.type=='Núcleo'?f('Nº de cuadros',`<input data-k="n" type="number" inputmode="numeric" value="${esc(d.n)}">`)+f('Material',`<select data-k="mat">${opts(['Madera','Plástico'],d.mat)}</select>`):'')
  +`<label class="ck"><input type="checkbox" data-k="std"${d.std?' checked':''}> Medida estándar (intercambiable)</label>`
  +(d.std?'':f('Nota',`<textarea data-k="note" rows="2">${esc(d.note)}</textarea>`)+f(cu?'Alto × ancho total':'Medidas exteriores (ancho × alto × largo)',`<input data-k="ext" value="${esc(d.ext)}">`)+(cu?'':f('Medidas interiores',`<input data-k="int" value="${esc(d.int)}">`)))
  +`<div class="ac">${d.id?'<button class="bt dg" data-a="del">Eliminar</button>':''}<button class="bt pr" data-a="ok">Guardar</button></div>`)}
const readForm=()=>document.querySelectorAll('#sh [data-k]').forEach(e=>FD[e.dataset.k]=e.type=='checkbox'?e.checked:e.value);
const newItem=()=>{const t=T().find(x=>x[0]=='Colmenas'),d={cat:'Colmenas',type:'Alza',model:'Layens',name:'',code:'',qty:1,status:'Nuevo',loc:F.loc&&F.loc!='-'?F.loc:'',std:true,note:'',ext:'',int:'',n:'',mat:'Madera'};d.code=sugg(d.cat,d.type,d.model);return d};
function lform(id){const l=S.locs.find(x=>x.id==id)||{name:'',kind:'Apiario'};sheet(`<h2>${id?'Editar':'Nueva'} ubicación</h2><label>Nombre<input id="ln" value="${esc(l.name)}"></label><label>Tipo<select id="lk">${opts(['Apiario','Almacén'],l.kind)}</select></label><div class="ac">${id?`<button class="bt dg" data-a="ldel" data-id="${id}">Eliminar</button>`:''}<button class="bt pr" data-a="lok" data-id="${id||''}">Guardar</button></div>`)}

/* ===== Exportar / importar ===== */
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`};
const dl=(n,t,m)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:m}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)};
const csv=()=>{const q=v=>`"${String(v??'').replace(/"/g,'""')}"`,H=['Categoría','Tipo','Modelo','Nombre','Código','Cantidad','Estado','Ubicación','Estándar','Nota','Medidas ext','Medidas int','Nº cuadros','Material'];
  return '\ufeff'+[H,...S.items.map(i=>[i.cat,i.type,i.model,i.name,i.code,i.qty,i.status,locName(i.loc),i.std?'Sí':'No',i.note,i.ext,i.int,i.n,i.type=='Núcleo'?i.mat:''])].map(r=>r.map(q).join(';')).join('\n')};

/* ===== Eventos ===== */
document.addEventListener('click',async e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,id=b.dataset.id;
  if(a=='tab'){view=b.dataset.v;render(false)}else if(a=='close')sheet();else if(a=='add')form(newItem());
  else if(a=='grp')grp(b.dataset.k);else if(a=='edit')form({...S.items.find(i=>i.id==id)});
  else if(a=='ok'){readForm();const d=FD,t=tinfo(d.cat,d.type),cd=t[4];d.name=d.name.trim().replace(/\s+/g,' ');d.code=d.code.trim().toUpperCase();
    if(cd){if(!d.code)return toast('Falta el código');if(S.items.some(i=>i.code==d.code&&i.id!=d.id))return toast('Ese código ya existe');d.qty=1}else{d.qty=Math.max(1,parseInt(d.qty)||1);d.code=''}
    if(!t[3])d.model='';if(d.id)S.items[S.items.findIndex(i=>i.id==d.id)]=d;else S.items.push({...d,id:uid()});await save();sheet();render()}
  else if(a=='del'){if(confirm('¿Eliminar este registro?')){S.items=S.items.filter(i=>i.id!=FD.id);Object.keys(S.pairs).forEach(k=>k.split('~').includes(FD.id)&&delete S.pairs[k]);await save();sheet();render()}}
  else if(a=='lform')lform(id);
  else if(a=='lok'){const n=$('#ln').value.trim();if(!n)return toast('Falta el nombre');const k=$('#lk').value;if(id){Object.assign(S.locs.find(l=>l.id==id),{name:n,kind:k})}else S.locs.push({id:uid(),name:n,kind:k});await save();sheet();render()}
  else if(a=='ldel'){if(confirm('¿Eliminar ubicación? Su material quedará sin ubicación.')){S.locs=S.locs.filter(l=>l.id!=id);S.items.forEach(i=>i.loc==id&&(i.loc=''));await save();sheet();render()}}
  else if(a=='move'){if(!MV.to||MV.to==MV.from)return toast('Elige un destino distinto');const to=MV.to=='-'?'':MV.to;let n=0;
    Object.entries(MV.sel).forEach(([k,v])=>{if(k.startsWith('g:')){let r=+v;if(!r)return;for(const i of S.items.filter(x=>gkey(x)==k.slice(2)&&(MV.from=='-'?!x.loc:x.loc==MV.from))){if(!r)break;const q=Math.min(r,i.qty);r-=q;n+=q;if(q==i.qty)i.loc=to;else{i.qty-=q;S.items.push({...i,id:uid(),qty:q,loc:to})}}}
     else if(v){const i=S.items.find(x=>x.id==k);if(i){i.loc=to;n++}}});
    if(!n)return toast('Nada seleccionado');await save();MV.sel={};MV.from='';toast(n+' movido(s)');render()}
  else if(a=='pr'){const o=b.closest('[data-b]').dataset.b,k=pk(CP.a,o);b.dataset.r?S.pairs[k]=b.dataset.r:delete S.pairs[k];await save();render()}
  else if(a=='xj')dl(`inventario-apicola_${stamp()}.json`,JSON.stringify(S,null,1),'application/json');
  else if(a=='xc')dl(`inventario-apicola_${stamp()}.csv`,csv(),'text/csv')});
document.addEventListener('change',async e=>{const t=e.target,d=t.dataset;
  if(d.k){const old={...FD};readForm();if(['cat','type','model','std'].includes(d.k)){
    if(d.k=='cat'){FD.type=T().find(x=>x[0]==FD.cat)[1]}
    if(FD.type=='+'){const n=(prompt('Nombre del nuevo tipo')||'').trim();if(n){S.types.push([FD.cat,n,'',0,0]);FD.type=n;await save()}else FD.type=old.type}
    const ti=tinfo(FD.cat,FD.type);if(ti[3]&&!FD.model)FD.model='Layens';if(d.k!='std')FD.code=sugg(FD.cat,FD.type,FD.model);form(FD)}}
  else if(d.m){MV[d.m]=t.value;MV.sel={};render()}else if(d.c)MV.sel[d.c]=t.checked;
  else if(d.g)MV.sel['g:'+d.g]=Math.max(0,Math.min(+t.max,+t.value||0));
  else if(d.p){CP[d.p]=t.type=='checkbox'?t.checked:t.value;if(d.p=='a')CP.t='';render()}
  else if(d.f&&d.f!='q'){F[d.f]=t.value;render()}
  else if(d.a=='imp'&&t.files[0]){try{const o=JSON.parse(await t.files[0].text());if(!Array.isArray(o.items)||!Array.isArray(o.locs))throw 0;
    if(confirm(`Esto reemplaza todos los datos actuales por los del archivo (${o.items.length} registros). ¿Continuar?`)){S={...blank(),...o};await save();render();toast('Datos importados')}}catch{toast('Archivo no válido')}t.value=''}});
document.addEventListener('input',e=>{if(e.target.dataset.f=='q'){F.q=e.target.value;$('#lst').innerHTML=invList()}});

(async()=>{S={...blank(),...(await load()||{})};render();navigator.storage?.persist?.();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')})();
