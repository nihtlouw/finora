const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const state = {
  view: 'dashboard',
  proposals: [
    {id:'p1', no:'PROP-0028', client:'Nusa Labs', total:52000000, valid:'2026-09-18', status:'Terkirim'},
    {id:'p2', no:'PROP-0027', client:'ACME Studio', total:78000000, valid:'2026-09-20', status:'Diterima'},
    {id:'p3', no:'PROP-0026', client:'Tera Living', total:31500000, valid:'2026-09-11', status:'Ditolak'},
    {id:'p4', no:'PROP-0025', client:'Kopi Utama', total:24800000, valid:'2026-09-14', status:'Draft'}
  ],
  invoices: [
    {id:'i1',no:'INV-0267',client:'ACME Studio',due:'2026-09-02',total:36000000,status:'Jatuh tempo'},
    {id:'i2',no:'INV-0265',client:'Nusa Labs',due:'2026-09-12',total:18500000,status:'Jatuh tempo'},
    {id:'i3',no:'INV-0264',client:'Tera Living',due:'2026-09-18',total:24000000,status:'Belum dibayar'},
    {id:'i4',no:'INV-0263',client:'Kopi Utama',due:'2026-09-06',total:15400000,status:'Lunas'},
    {id:'i5',no:'INV-0261',client:'Citra Works',due:'2026-09-22',total:19600000,status:'Belum dibayar'}
  ],
  clients: [
    {id:'c1',name:'ACME Studio',type:'Klien',contact:'hello@acmestudio.id',phone:'+62 811 2211 3030',invoice:114000000,status:'Aktif'},
    {id:'c2',name:'Nusa Labs',type:'Klien',contact:'finance@nusalabs.id',phone:'+62 812 3344 5511',invoice:82500000,status:'Aktif'},
    {id:'c3',name:'Tera Living',type:'Klien',contact:'ops@teraliving.id',phone:'+62 813 4499 8822',invoice:55200000,status:'Aktif'},
    {id:'c4',name:'Karya Printer',type:'Vendor',contact:'admin@karyaprinter.id',phone:'+62 815 1112 7788',invoice:0,status:'Vendor'},
    {id:'c5',name:'Cloudbox Indonesia',type:'Vendor',contact:'billing@cloudbox.id',phone:'+62 811 8899 0011',invoice:0,status:'Vendor'}
  ],
  expenses: [
    {date:'11 Sep 2026',category:'Software',vendor:'Cloudbox Indonesia',amount:5400000,status:'Menunggu',approval:'Finance Lead'},
    {date:'10 Sep 2026',category:'Payroll',vendor:'Internal',amount:28900000,status:'Disetujui',approval:'Aditya'},
    {date:'09 Sep 2026',category:'Marketing',vendor:'Karya Creative',amount:8200000,status:'Menunggu',approval:'Owner'},
    {date:'07 Sep 2026',category:'Sewa',vendor:'Gedung Merdeka',amount:12000000,status:'Disetujui',approval:'Aditya'},
    {date:'05 Sep 2026',category:'Listrik',vendor:'PLN',amount:3100000,status:'Disetujui',approval:'Finance'}
  ],
  cashflow: [
    {date:'11 Sep',category:'Payment',source:'INV-0268',type:'Pemasukan',amount:24500000},
    {date:'10 Sep',category:'Payroll',source:'Payroll Sep',type:'Pengeluaran',amount:28900000},
    {date:'09 Sep',category:'Marketing',source:'Karya Creative',type:'Pengeluaran',amount:8200000},
    {date:'08 Sep',category:'Payment',source:'INV-0266',type:'Pemasukan',amount:31000000},
    {date:'07 Sep',category:'Sewa',source:'Gedung Merdeka',type:'Pengeluaran',amount:12000000},
    {date:'04 Sep',category:'Modal',source:'Equity top-up',type:'Pendanaan',amount:60000000}
  ],
  activities: [
    ['check','Pembayaran diterima','INV-0268 dari Nusa Labs • Rp 24,5 jt','Hari ini, 14:22'],
    ['file','Proposal diterima','PROP-0027 — ACME Studio','Hari ini, 11:08'],
    ['alert','Approval diperlukan','Biaya marketing Rp 8,2 jt','Kemarin, 16:41'],
    ['spark','Forecast diperbarui','Projected month-end cash Rp 512,4 jt','Kemarin, 09:12']
  ],
  budgets: [
    ['Payroll',93000000,28900000],['Marketing',24000000,22100000],['Software',16000000,14800000],['Sewa',15000000,12000000],['Operasional',22000000,14100000],['Travel',8000000,6200000]
  ]
};

const rupiah = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n).replace('IDR','Rp');
const shortRupiah = n => { if(n>=1e9) return `Rp ${(n/1e9).toFixed(1).replace('.',',')} M`; if(n>=1e6) return `Rp ${(n/1e6).toFixed(1).replace('.',',')} jt`; return rupiah(n); };
const esc = s => String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function persist(){ localStorage.setItem('finora_state', JSON.stringify(state)); }
function load(){ try{ const raw=localStorage.getItem('finora_state'); if(raw) Object.assign(state, JSON.parse(raw)); }catch{} }

function toast(title, message){ $('#toastTitle').textContent=title; $('#toastMessage').textContent=message; $('#toast').classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>$('#toast').classList.remove('show'),2800); }

function setView(view){
  state.view=view;
  $$('.view').forEach(v=>v.classList.toggle('active', v.id===`view-${view}`));
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  const active = $(`#view-${view}`); $('#pageTitle').textContent = active?.dataset.title || view;
  if(window.innerWidth<850) $('#sidebar').classList.remove('open');
  renderView(view); window.scrollTo({top:0,behavior:'smooth'});
}
function renderView(view){
  if(view==='dashboard') renderDashboard();
  if(view==='cashflow') renderCashflow();
  if(view==='proposals') renderProposals();
  if(view==='invoices') renderInvoices();
  if(view==='expenses') renderExpenses();
  if(view==='clients') renderClients();
  if(view==='budgets') renderBudgets();
}

function renderDashboard(){
  $('#invoiceBadge').textContent = state.invoices.filter(i=>i.status!=='Lunas').length;
  $('#invoiceAttentionRows').innerHTML = state.invoices.filter(i=>i.status!=='Lunas').slice(0,4).map(i=>`<tr><td>${esc(i.no)}</td><td>${esc(i.client)}</td><td>${esc(formatDate(i.due))}</td><td>${shortRupiah(i.total)}</td><td>${statusPill(i.status)}</td></tr>`).join('');
  $('#activityList').innerHTML = state.activities.map(a=>`<div class="activity"><div class="activity-icon">${a[0]==='check'?'✓':a[0]==='file'?'▤':a[0]==='alert'?'!':'✦'}</div><div class="activity-copy"><strong>${esc(a[1])}</strong><p>${esc(a[2])}</p><p>${esc(a[3])}</p></div></div>`).join('');
  drawCashChart($('#cashChart'), false); updateKPIs();
}
function updateKPIs(){
  const unpaid = state.invoices.filter(i=>i.status!=='Lunas').reduce((s,i)=>s+i.total,0);
  $('#kpiReceivable').textContent=shortRupiah(unpaid);
}
function renderCashflow(){ $('#cashflowRows').innerHTML=state.cashflow.map(x=>`<tr><td>${x.date}</td><td>${esc(x.category)}</td><td>${esc(x.source)}</td><td>${statusPill(x.type,x.type==='Pemasukan'?'green':x.type==='Pengeluaran'?'clay':'amber')}</td><td>${x.type==='Pemasukan'?'<strong>+':''}${rupiah(x.amount)}</strong></td></tr>`).join(''); drawCashChart($('#wideCashChart'),true); }
function renderProposals(){
  const q=($('#proposalSearch')?.value||'').toLowerCase();
  $('#proposalRows').innerHTML=state.proposals.filter(p=>`${p.no} ${p.client}`.toLowerCase().includes(q)).map(p=>`<tr><td>${esc(p.no)}</td><td>${esc(p.client)}</td><td>${rupiah(p.total)}</td><td>${formatDate(p.valid)}</td><td>${statusPill(p.status)}</td><td><button class="row-action" data-proposal-action="${p.id}">${p.status==='Diterima'?'Convert ke invoice':'Detail'}</button></td></tr>`).join('');
}
function renderInvoices(){
  const q=($('#invoiceSearch')?.value||'').toLowerCase();
  $('#invoiceRows').innerHTML=state.invoices.filter(i=>`${i.no} ${i.client}`.toLowerCase().includes(q)).map(i=>`<tr><td>${esc(i.no)}</td><td>${esc(i.client)}</td><td>${formatDate(i.due)}</td><td>${rupiah(i.total)}</td><td>${statusPill(i.status)}</td><td><button class="row-action" data-invoice-action="${i.id}">${i.status==='Lunas'?'Lihat':'Tandai lunas'}</button></td></tr>`).join('');
}
function renderExpenses(){ $('#expenseRows').innerHTML=state.expenses.map((e,idx)=>`<tr><td>${e.date}</td><td>${esc(e.category)}</td><td>${esc(e.vendor)}</td><td>${rupiah(e.amount)}</td><td>${statusPill(e.status)}</td><td><button class="row-action" data-expense-action="${idx}">${e.status==='Menunggu'?'Approve':'Detail'}</button></td></tr>`).join(''); }
function renderClients(){ const q=($('#clientSearch')?.value||'').toLowerCase(); $('#clientRows').innerHTML=state.clients.filter(c=>`${c.name} ${c.contact}`.toLowerCase().includes(q)).map(c=>`<tr><td>${esc(c.name)}</td><td>${statusPill(c.type,c.type==='Klien'?'green':'blue')}</td><td>${esc(c.contact)}<br><span style="font-size:9px;color:#999">${esc(c.phone)}</span></td><td>${c.invoice?rupiah(c.invoice):'—'}</td><td>${statusPill(c.status,'gray')}</td><td><button class="row-action">Detail</button></td></tr>`).join(''); }
function renderBudgets(){ $('#budgetGrid').innerHTML=state.budgets.map(b=>{const pct=Math.round(b[2]/b[1]*100);return `<div class="budget-item"><div class="budget-item-head"><div><strong>${b[0]}</strong><span>Sep 2026</span></div><span>${pct}%</span></div><div class="budget-amount"><strong>${rupiah(b[2])}</strong><span>of ${shortRupiah(b[1])}</span></div><div class="budget-bar ${pct>=90?'warn':''}"><span style="width:${Math.min(pct,100)}%"></span></div><div class="budget-meta"><span>Sisa ${shortRupiah(Math.max(b[1]-b[2],0))}</span><span>${pct>=90?'Mendekati limit':'Aman'}</span></div></div>`}).join(''); }

function statusPill(text, kind){ kind=kind || ({'Lunas':'green','Diterima':'green','Disetujui':'green','Belum dibayar':'amber','Jatuh tempo':'clay','Terkirim':'blue','Draft':'gray','Ditolak':'clay','Menunggu':'amber','Klien':'green','Vendor':'blue','Aktif':'gray','Pemasukan':'green','Pengeluaran':'clay','Pendanaan':'amber'}[text]||'gray'); return `<span class="status ${kind}">${esc(text)}</span>`; }
function formatDate(iso){ const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}); }

function drawCashChart(target, wide){
  if(!target) return;
  const seriesA = wide ? [62,72,68,88,102,119,128,145,137,151,166,180] : [40,48,42,58,54,66];
  const seriesB = wide ? [51,54,57,63,67,75,73,78,86,89,96,101] : [25,31,28,35,33,39];
  const w=960,h=210,p=24;
  const pts=(arr)=>arr.map((v,i)=>{const x=p+i*((w-p*2)/(arr.length-1));const y=h-p-(v-Math.min(...arr))/(Math.max(...arr)-Math.min(...arr))*130;return [x,y]} );
  const path=(arr)=>pts(arr).map((p,i)=>`${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  target.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"><path d="${path(seriesA)}" fill="none" stroke="#566250" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="${path(seriesB)}" fill="none" stroke="#b46e55" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 7"/></svg>`;
}

function openModal(title, eyebrow, body, onConfirm){ $('#modalTitle').textContent=title; $('#modalEyebrow').textContent=eyebrow||'Finora'; $('#modalBody').innerHTML=body; $('#modalBackdrop').classList.add('show'); $('#modalBackdrop').setAttribute('aria-hidden','false'); window.__modalConfirm=onConfirm; }
function closeModal(){ $('#modalBackdrop').classList.remove('show'); $('#modalBackdrop').setAttribute('aria-hidden','true'); window.__modalConfirm=null; }

function formProposal(){ openModal('Proposal baru','Penjualan / Proposal',`<div class="form-grid"><div class="form-field"><label>Klien</label><select id="mClient">${state.clients.filter(c=>c.type==='Klien').map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label>Berlaku sampai</label><input id="mValid" type="date" value="2026-09-25"/></div><div class="form-field full"><label>Deskripsi jasa</label><textarea id="mDesc">Strategic finance setup + monthly advisory</textarea></div><div class="form-field"><label>Qty</label><input id="mQty" type="number" value="1" min="1"/></div><div class="form-field"><label>Harga satuan</label><input id="mPrice" type="number" value="25000000" min="0"/></div></div><div class="helper">Nomor proposal digenerate otomatis. Pajak/diskon dapat ditambahkan di tahap lanjutan.</div>`,()=>{const p={id:'p'+Date.now(),no:'PROP-'+String(29+state.proposals.length).padStart(4,'0'),client:$('#mClient').value,total:Number($('#mQty').value)*Number($('#mPrice').value),valid:$('#mValid').value,status:'Draft'};state.proposals.unshift(p);persist();renderProposals();renderDashboard();closeModal();toast('Proposal dibuat',`${p.no} tersimpan sebagai draft.`);}); }
function formExpense(){ openModal('Catat biaya','Operasional / Biaya',`<div class="form-grid"><div class="form-field"><label>Kategori</label><select id="eCat"><option>Software</option><option>Marketing</option><option>Payroll</option><option>Sewa</option><option>Listrik</option><option>Travel</option></select></div><div class="form-field"><label>Vendor</label><input id="eVendor" value="Cloudbox Indonesia"/></div><div class="form-field"><label>Nominal</label><input id="eAmt" type="number" value="2750000"/></div><div class="form-field"><label>Tanggal</label><input id="eDate" type="date" value="2026-09-11"/></div><div class="form-field full"><label>Catatan</label><textarea id="eNote">Subscription renewal</textarea></div></div><div class="confirm-card"><strong>Approval otomatis</strong>Biaya ≤ Rp 5 jt akan masuk ke approval normal; di atas threshold akan dirouting ke Owner / Finance Lead.</div>`,()=>{const amt=Number($('#eAmt').value); const e={date:new Date($('#eDate').value+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}),category:$('#eCat').value,vendor:$('#eVendor').value,amount:amt,status:amt<=5000000?'Disetujui':'Menunggu',approval:amt<=5000000?'Finance':'Owner'};state.expenses.unshift(e);state.cashflow.unshift({date:'11 Sep',category:e.category,source:e.vendor,type:'Pengeluaran',amount:amt});persist();renderExpenses();renderCashflow();renderDashboard();closeModal();toast('Biaya tercatat',`${rupiah(amt)} masuk ke cash flow.`);}); }
function formClient(){ openModal('Tambah kontak','Master Data',`<div class="form-grid"><div class="form-field"><label>Nama perusahaan</label><input id="cName" placeholder="Contoh: PT Nusantara Digital"/></div><div class="form-field"><label>Tipe</label><select id="cType"><option>Klien</option><option>Vendor</option></select></div><div class="form-field"><label>Email</label><input id="cEmail" type="email" placeholder="finance@perusahaan.id"/></div><div class="form-field"><label>Telepon</label><input id="cPhone" placeholder="+62 …"/></div></div>`,()=>{const name=$('#cName').value.trim()||'Kontak Baru';state.clients.unshift({id:'c'+Date.now(),name,type:$('#cType').value,contact:$('#cEmail').value||'—',phone:$('#cPhone').value||'—',invoice:0,status:$('#cType').value==='Klien'?'Aktif':'Vendor'});persist();renderClients();renderDashboard();closeModal();toast('Kontak ditambahkan',`${name} tersimpan di master data.`);}); }
function formInvoice(){ openModal('Invoice manual','Penjualan / Invoice',`<div class="form-grid"><div class="form-field"><label>Klien</label><select id="iClient">${state.clients.filter(c=>c.type==='Klien').map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></div><div class="form-field"><label>Jatuh tempo</label><input id="iDue" type="date" value="2026-09-25"/></div><div class="form-field"><label>Total</label><input id="iAmt" type="number" value="12500000"/></div><div class="form-field"><label>Metode pembayaran</label><select><option>Transfer bank</option><option>Payment link</option><option>Virtual account</option></select></div><div class="form-field full"><label>Item</label><textarea>Monthly advisory — September 2026</textarea></div></div>`,()=>{const inv={id:'i'+Date.now(),no:'INV-'+String(269+state.invoices.length).padStart(4,'0'),client:$('#iClient').value,due:$('#iDue').value,total:Number($('#iAmt').value),status:'Belum dibayar'};state.invoices.unshift(inv);persist();renderInvoices();renderDashboard();closeModal();toast('Invoice dibuat',`${inv.no} siap dikirim.`);}); }
function formBudget(){ openModal('Buat budget','Kontrol / Budgeting',`<div class="form-grid"><div class="form-field"><label>Kategori</label><select id="bCat"><option>Operations</option><option>Software</option><option>Marketing</option><option>Travel</option></select></div><div class="form-field"><label>Periode</label><input value="September 2026"/></div><div class="form-field full"><label>Planned amount</label><input id="bAmt" type="number" value="10000000"/></div></div>`,()=>{state.budgets.push([$('#bCat').value,Number($('#bAmt').value),0]);persist();renderBudgets();closeModal();toast('Budget dibuat','Budget baru ditambahkan untuk September 2026.');}); }

function markInvoicePaid(id){const inv=state.invoices.find(i=>i.id===id);if(!inv)return;inv.status='Lunas';state.cashflow.unshift({date:'11 Sep',category:'Payment',source:inv.no,type:'Pemasukan',amount:inv.total});persist();renderInvoices();renderCashflow();renderDashboard();toast('Invoice lunas',`${inv.no} tercatat sebagai pembayaran masuk.`);}
function approveExpense(idx){const e=state.expenses[idx]; if(!e)return;e.status='Disetujui';e.approval='Aditya';persist();renderExpenses();toast('Biaya disetujui',`${rupiah(e.amount)} sudah approved.`);}
function convertProposal(id){const p=state.proposals.find(x=>x.id===id);if(!p)return;const inv={id:'i'+Date.now(),no:'INV-'+String(269+state.invoices.length).padStart(4,'0'),client:p.client,due:'2026-09-25',total:p.total,status:'Belum dibayar'};p.status='Diterima';state.invoices.unshift(inv);persist();renderProposals();renderInvoices();renderDashboard();toast('Proposal dikonversi',`${p.no} → ${inv.no}.`);}

function aiReply(prompt){
  const p=prompt.toLowerCase();
  if(p.includes('margin')) return 'Margin bersih September berjalan sekitar <strong>50,2%</strong> (Rp 93,4 jt laba bersih / Rp 186,2 jt pendapatan). Naik dari 46,1% bulan lalu.';
  if(p.includes('tagih')||p.includes('invoice')) return 'Prioritas pertama: <strong>INV-0267 — ACME Studio</strong> (terlambat 9 hari, Rp 36 jt). Kedua: INV-0265 — Nusa Labs (jatuh tempo besok, Rp 18,5 jt).';
  if(p.includes('budget')) return '<strong>Marketing (92%)</strong> dan <strong>Software (93%)</strong> mendekati limit September. Saya sarankan review 3 transaksi terbesar sebelum menambah spend.';
  return 'Berdasarkan data workspace saat ini, kas Rp 428,6 jt dengan proyeksi akhir bulan Rp 512,4 jt. Cash position relatif sehat, sementara piutang jatuh tempo menjadi area perhatian utama.';
}
function sendAI(){const input=$('#aiInput');const text=input.value.trim();if(!text)return;const box=$('#aiMessages');box.insertAdjacentHTML('beforeend',`<div class="ai-msg user"><span>Anda</span><p>${esc(text)}</p></div>`);setTimeout(()=>{box.insertAdjacentHTML('beforeend',`<div class="ai-msg assistant"><span>Finora AI</span><p>${aiReply(text)}</p></div>`);box.scrollTop=box.scrollHeight;},300);input.value='';}

function globalSearch(q){const query=q.toLowerCase().trim();const targets=[...state.proposals.map(p=>({label:p.no,sub:`Proposal • ${p.client}`,view:'proposals'})),...state.invoices.map(i=>({label:i.no,sub:`Invoice • ${i.client}`,view:'invoices'})),...state.clients.map(c=>({label:c.name,sub:`${c.type} • ${c.contact}`,view:'clients'})),{label:'Dashboard',sub:'Overview',view:'dashboard'},{label:'Cash Flow',sub:'Overview',view:'cashflow'},{label:'Laporan Keuangan',sub:'Analisis',view:'reports'},{label:'AI Assistant',sub:'Workspace',view:'ai'}];const rs=$('#searchResults');rs.innerHTML=(query?targets.filter(x=>(x.label+' '+x.sub).toLowerCase().includes(query)):targets.slice(-4)).map(x=>`<button class="search-result" data-search-view="${x.view}"><strong>${esc(x.label)}</strong><span>${esc(x.sub)}</span></button>`).join('');}

// Events
load();
$$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$$('[data-view-target]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewTarget)));
$('#modalClose').addEventListener('click',closeModal);$('#modalCancel').addEventListener('click',closeModal);$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});$('#modalConfirm').addEventListener('click',()=>window.__modalConfirm?.());
$('#globalSearchBtn').addEventListener('click',()=>{$('#searchOverlay').classList.add('show');$('#globalSearchInput').focus();globalSearch('');});$('#searchClose').addEventListener('click',()=>$('#searchOverlay').classList.remove('show'));$('#searchOverlay').addEventListener('click',e=>{if(e.target.id==='searchOverlay')$('#searchOverlay').classList.remove('show')});$('#globalSearchInput').addEventListener('input',e=>globalSearch(e.target.value));
$('#notificationBtn').addEventListener('click',()=>toast('3 notifikasi','2 invoice perlu follow-up dan 1 biaya menunggu approval.'));
$('#userMenuBtn').addEventListener('click',()=>toast('Profil','Anda masuk sebagai Owner / Admin.'));
$('#workspaceSwitcher').addEventListener('click',()=>toast('Workspace','Arunika Creative adalah workspace aktif.'));

$('[data-action="quick-add"]').addEventListener('click',()=>openModal('Tambah transaksi','Quick Action',`<div class="form-grid"><div class="form-field full"><label>Pilih alur</label><select id="quickType"><option value="expense">Biaya Operasional</option><option value="invoice">Invoice</option><option value="cash">Transaksi Cash Flow</option><option value="client">Klien / Vendor</option></select></div></div><div class="confirm-card"><strong>Finora akan membuka form sesuai pilihan.</strong>Semua perubahan langsung masuk ke state demo browser ini.</div>`,()=>{const t=$('#quickType').value;closeModal();if(t==='expense')formExpense();if(t==='invoice')formInvoice();if(t==='client')formClient();if(t==='cash')openModal('Transaksi Cash Flow','Overview',`<div class="form-grid"><div class="form-field"><label>Jenis</label><select id="cfType"><option>Pemasukan</option><option>Pengeluaran</option><option>Pendanaan</option></select></div><div class="form-field"><label>Nominal</label><input id="cfAmt" type="number" value="5000000"/></div><div class="form-field full"><label>Kategori</label><input id="cfCat" value="Manual adjustment"/></div></div>`,()=>{state.cashflow.unshift({date:'11 Sep',category:$('#cfCat').value,source:'Manual',type:$('#cfType').value,amount:Number($('#cfAmt').value)});persist();renderCashflow();renderDashboard();closeModal();toast('Transaksi ditambahkan','Cash flow berhasil diperbarui.');});}));
$$('[data-action="new-proposal"]').forEach(b=>b.addEventListener('click',formProposal));
$$('[data-action="new-expense"]').forEach(b=>b.addEventListener('click',formExpense));
$$('[data-action="new-client"]').forEach(b=>b.addEventListener('click',formClient));
$$('[data-action="new-invoice"]').forEach(b=>b.addEventListener('click',formInvoice));
$$('[data-action="new-budget"]').forEach(b=>b.addEventListener('click',formBudget));
$$('[data-action="ai-proposal"]').forEach(b=>b.addEventListener('click',()=>openModal('AI proposal draft','AI Layer',`<div class="form-field"><label>Brief singkat</label><textarea id="aiBrief">Website redesign untuk startup SaaS, 8 minggu, 2 milestone, termasuk discovery dan handoff design.</textarea></div><div class="confirm-card"><strong>AI akan menyiapkan draft item & estimasi harga.</strong>Hasil tetap perlu dikonfirmasi sebelum proposal disimpan permanen.</div>`,()=>{closeModal();toast('Draft AI siap','Proposal draft dibuat dan siap ditinjau.');})));
$$('[data-action="upload-receipt"]').forEach(b=>b.addEventListener('click',()=>toast('Document AI','Demo OCR siap — pada produksi hubungkan ke Tesseract.js / Document AI.')));
$$('[data-action="import-contacts"]').forEach(b=>b.addEventListener('click',()=>toast('Import siap','Hubungkan CSV/Excel untuk mengisi master data.')));
$$('[data-action="manual-cash"]').forEach(b=>b.addEventListener('click',()=>$('#view-dashboard [data-action="quick-add"]').click()));
$$('[data-action="convert-first"]').forEach(b=>b.addEventListener('click',()=>{const p=state.proposals.find(x=>x.status==='Diterima')||state.proposals[0]; if(p) convertProposal(p.id);}));
$$('[data-action="export-report"]').forEach(b=>b.addEventListener('click',()=>downloadCSV('finora-laporan.csv','Metric,Value\nPendapatan,186200000\nBeban Operasional,50400000\nLaba Bersih,93400000')));
$$('[data-action="export-pdf"]').forEach(b=>b.addEventListener('click',()=>toast('Export PDF','Prototype menyiapkan dokumen laporan; sambungkan generator PDF di backend produksi.')));

$('#proposalSearch')?.addEventListener('input',renderProposals);$('#invoiceSearch')?.addEventListener('input',renderInvoices);$('#clientSearch')?.addEventListener('input',renderClients);

document.addEventListener('click',e=>{
  const p=e.target.closest('[data-proposal-action]'); if(p){const item=state.proposals.find(x=>x.id===p.dataset.proposalAction); if(item?.status==='Diterima') convertProposal(item.id);else toast('Proposal','Detail proposal dibuka pada versi produksi.');}
  const i=e.target.closest('[data-invoice-action]'); if(i){const inv=state.invoices.find(x=>x.id===i.dataset.invoiceAction); if(inv?.status!=='Lunas') markInvoicePaid(inv.id); else toast('Invoice lunas',`${inv.no} sudah tercatat lunas.`);}
  const ex=e.target.closest('[data-expense-action]'); if(ex){approveExpense(Number(ex.dataset.expenseAction));}
  const sv=e.target.closest('[data-search-view]'); if(sv){$('#searchOverlay').classList.remove('show');setView(sv.dataset.searchView);}
  const ap=e.target.closest('[data-ai-prompt]'); if(ap){$('#aiInput').value=ap.dataset.aiPrompt;sendAI();}
});
$('#aiSend')?.addEventListener('click',sendAI);$('#aiInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendAI()});
$$('.cash-card .segmented button').forEach(b=>b.addEventListener('click',()=>{$$('.cash-card .segmented button').forEach(x=>x.classList.remove('active'));b.classList.add('active');drawCashChart($('#cashChart'),b.dataset.cashPeriod==='12M')}));
$$('.report-tabs button').forEach(b=>b.addEventListener('click',()=>{$$('.report-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');toast('Tab laporan',`${b.textContent} dipilih.`)}));

function downloadCSV(filename, text){const blob=new Blob([text],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}

renderDashboard();
