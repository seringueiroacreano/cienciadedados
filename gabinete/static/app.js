/* Mandato — Gestão de Gabinete. Frontend sem dependências.
   Telas genéricas (lista/formulário) são montadas a partir de /api/meta. */
'use strict';
(() => {
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const br = (d) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
const brDH = (d) => (d ? `${br(d)} ${d.slice(11, 16)}` : '');
const reais = (c) => (c == null ? '' : (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const centavos = (s) => { if (s == null || String(s).trim() === '') return null; const n = Number(String(s).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const soDig = (s) => String(s || '').replace(/\D/g, '');

let META = null; let USER = null;
const cacheOp = {};

/* ---------------- API ---------------- */
async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch('/api/' + caminho, {
    method: metodo, credentials: 'same-origin',
    headers: { 'X-Requested-With': 'fetch', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
  if (r.status === 401 && caminho !== 'login') { META = null; telaLogin(); throw new Error('Sessão expirada'); }
  if (!r.ok) { const e = new Error((dados && dados.erro) || 'Erro'); e.campos = (dados && dados.campos) || {}; throw e; }
  return dados;
}
function toast(msg, erro) {
  const t = $('#toast'); t.textContent = msg; t.className = 'on' + (erro ? ' erro' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ''; }, 2800);
}
const E = (ent) => META.entidades[ent];
const podeEscrever = (ent) => { const m = E(ent); if (!m) return false; if (USER.papel === 'admin') return true; return USER.papel === 'assessor' && !m.admin && !m.admin_escrita; };
const campo = (ent, n) => E(ent).campos.find((c) => c.n === n) || (E(ent).calc && E(ent).calc[n] && { n, l: E(ent).calc[n][0], t: E(ent).calc[n][1] }) || ({ criado_em: { n, l: 'Criado em', t: 'datetime' } }[n]) || { n, l: n, t: 'text' };
async function opcoes(ent) { if (!cacheOp[ent]) cacheOp[ent] = await api('opcoes/' + ent); return cacheOp[ent]; }
const limparCache = (ent) => { delete cacheOp[ent]; };

/* ---------------- formatação ---------------- */
const COR_ST = { Atendida: 'ok', Paga: 'ok', Concluída: 'ok', 'Paga parcialmente': 'info', Empenhada: 'info', 'Em andamento': 'info', Encaminhada: 'info', Aberta: 'warn', Recebida: 'warn', Cadastrada: 'warn', 'A fazer': 'warn', 'Não atendida': 'bad', 'Arquivada / Não atendida': 'bad', Urgente: 'bad', Alta: 'warn' };
function fmt(c, v, row = {}) {
  if (v == null || v === '') return '<span class="mut">—</span>';
  switch (c.t) {
    case 'money': return reais(v);
    case 'date': return br(v);
    case 'datetime': return brDH(v);
    case 'bool': return v ? 'Sim' : 'Não';
    case 'ref': return esc(row[c.n + '__rotulo'] || '#' + v);
    case 'tags': return String(v).split(',').map((x) => `<span class="tag">${esc(x.trim())}</span>`).join('');
    case 'file': return esc(v.nome);
    case 'url': return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`;
    case 'select': return ['status', 'prioridade'].includes(c.n) ? `<span class="st ${COR_ST[v] || ''}">${esc(v)}</span>` : esc(v);
    default: return esc(v);
  }
}
const waLink = (tel, msg = '') => { let d = soDig(tel); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}${msg ? '?text=' + encodeURIComponent(msg) : ''}`; };

/* ---------------- login ---------------- */
function telaLogin() {
  $('#app').innerHTML = `<div class="login"><form id="f-login" autocomplete="on">
    <div class="marca"><span class="selo">M</span> Mandato</div>
    <p class="mut">Gestão de Gabinete Parlamentar</p>
    <div class="campo"><label for="l-email">E-mail</label><input id="l-email" name="email" type="email" required autocomplete="username"></div>
    <div class="campo" style="margin-top:10px"><label for="l-senha">Senha</label><input id="l-senha" name="senha" type="password" required autocomplete="current-password"></div>
    <p id="l-erro" class="campo"><span class="erro"></span></p>
    <button class="btn pri" style="width:100%;justify-content:center">Entrar</button>
    <p class="mut" style="font-size:.8rem;margin-bottom:0">Acesso restrito à equipe do gabinete. Todas as ações são registradas.</p></form></div>`;
  $('#f-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await api('login', { metodo: 'POST', corpo: { email: $('#l-email').value, senha: $('#l-senha').value } }); await iniciar(); } catch (e) { $('#l-erro .erro').textContent = e.message; }
  });
  $('#l-email').focus();
}

/* ---------------- estrutura ---------------- */
async function iniciar() {
  try { META = await api('meta'); } catch (e) { return; }
  USER = META.usuario;
  if (!location.hash) location.hash = '#/painel';
  shell(); rota(); contarAlertas();
}
function itensMenu() {
  return META.menu.map(([k, rot, ic]) => {
    if (rot) { if (k === 'auditoria' && USER.papel !== 'admin') return null; return [`#/${k}`, rot, ic]; }
    const m = E(k); if (!m) return null; return [`#/e/${k}`, m.rotulo, m.icone];
  }).filter(Boolean);
}
function shell() {
  const g = META.gabinete || {};
  $('#app').innerHTML = `<div class="shell">
    <nav class="side" id="side" aria-label="Menu principal"><div class="marca"><span class="selo">M</span> Mandato</div>
      ${itensMenu().map(([h, r, ic]) => `<a href="${h}" data-h="${h}"><span class="ic">${ic}</span>${esc(r)}</a>`).join('')}
    </nav>
    <div><header class="topo">
      <button class="icbtn menu-btn" id="b-menu" aria-label="Abrir menu">☰</button>
      <div class="gab">${esc(g.parlamentar || 'Gabinete')}${g.partido ? ` <span class="mut">· ${esc(g.partido)}/${esc(g.uf || '')}</span>` : ''}</div>
      <a class="icbtn" href="#/notificacoes" aria-label="Notificações do dia">🔔<span class="badge" id="bdg" hidden></span></a>
      <button class="icbtn" id="b-user" aria-label="Minha conta" aria-haspopup="true">${esc((USER.nome || '?')[0])}</button>
    </header><main id="main"></main></div></div>
    ${podeEscrever('cidadaos') ? '<button class="fab" id="fab" aria-label="Cadastro rápido">+</button>' : ''}`;
  $('#b-menu').onclick = () => $('#side').classList.toggle('aberto');
  $('#side').addEventListener('click', (e) => { if (e.target.closest('a')) $('#side').classList.remove('aberto'); });
  $('#b-user').onclick = (ev) => {
    ev.stopPropagation(); fecharPops();
    const p = document.createElement('div'); p.className = 'pop';
    p.innerHTML = `<div style="padding:8px 12px"><strong>${esc(USER.nome)}</strong><br><span class="mut">${esc(USER.papel)}</span></div>
      <a href="#/conta">Trocar senha</a><button id="b-sair">Sair</button>`;
    document.body.appendChild(p);
    $('#b-sair').onclick = async () => { await api('logout', { metodo: 'POST' }).catch(() => {}); META = null; telaLogin(); };
  };
  const fab = $('#fab');
  if (fab) fab.onclick = (ev) => {
    ev.stopPropagation(); fecharPops();
    const p = document.createElement('div'); p.className = 'fab-menu pop-fab';
    p.innerHTML = ['atendimentos', 'cidadaos', 'demandas', 'emendas', 'agenda', 'tarefas'].filter(podeEscrever)
      .map((k) => `<a href="#/e/${k}/novo">${E(k).icone} Novo(a) ${esc(E(k).singular.toLowerCase())}</a>`).join('');
    document.body.appendChild(p);
  };
}
function fecharPops() { $$('.pop,.pop-fab').forEach((p) => p.remove()); }
document.addEventListener('click', (e) => { if (!e.target.closest('.pop,.pop-fab')) fecharPops(); if (e.target.closest('[data-print]')) window.print(); });
async function contarAlertas() {
  try {
    const n = await api('notificacoes');
    const t = n.tarefas.length + n.aniversariantes.length + n.compromissos.length + n.lembretes.length + n.demandas_vencidas.length;
    const b = $('#bdg'); if (b) { b.textContent = t > 99 ? '99+' : t; b.hidden = !t; }
  } catch (e) { /* silencioso */ }
}

/* ---------------- rotas ---------------- */
function parseHash() {
  const [p, q] = (location.hash.slice(1) || '/painel').split('?');
  return { partes: p.split('/').filter(Boolean), q: new URLSearchParams(q || '') };
}
async function rota() {
  if (!META) return;
  fecharPops();
  const { partes, q } = parseHash();
  const ativo = partes[0] === 'e' ? `#/e/${partes[1]}` : `#/${partes[0]}`;
  $$('#side a').forEach((a) => a.classList.toggle('on', a.dataset.h === ativo));
  const main = $('#main'); if (!main) return;
  main.innerHTML = '<p class="mut">Carregando…</p>';
  try {
    if (partes[0] === 'e' && E(partes[1])) {
      const ent = partes[1];
      if (E(ent).unico) await pgForm(main, ent, 1, q);
      else if (partes[2] === 'novo') await pgForm(main, ent, null, q);
      else if (partes[2]) await pgForm(main, ent, Number(partes[2]), q);
      else await pgLista(main, ent, q);
    } else {
      const pg = { painel: pgPainel, notificacoes: pgNotificacoes, aniversarios: pgAniversarios, mapa: pgMapa, whatsapp: pgWhatsapp, auditoria: pgAuditoria, conta: pgConta }[partes[0]];
      await (pg || pgPainel)(main, q);
    }
    main.focus?.();
  } catch (e) { if (e.message !== 'Sessão expirada') main.innerHTML = `<div class="card"><h2>Não foi possível abrir</h2><p>${esc(e.message)}</p></div>`; }
}
window.addEventListener('hashchange', rota);

/* ---------------- lista genérica ---------------- */
async function pgLista(main, ent, q) {
  const m = E(ent);
  const filtros = m.campos.filter((c) => c.filtro);
  const datas = m.campos.filter((c) => ['date', 'datetime'].includes(c.t)).slice(0, 1);
  let campoFiltro = '';
  for (const c of filtros) campoFiltro += await filtroHTML(c, q.get(c.n));
  for (const c of datas) campoFiltro += `<div class="campo"><label>${esc(c.l)} de</label><input type="date" data-fl="${c.n}__de" value="${esc(q.get(c.n + '__de') || '')}"></div><div class="campo"><label>${esc(c.l)} até</label><input type="date" data-fl="${c.n}__ate" value="${esc(q.get(c.n + '__ate') || '')}"></div>`;
  main.innerHTML = `<div class="cab"><h1>${m.icone} ${esc(m.rotulo)}</h1>
      <a class="btn" id="b-csv" href="#">⬇ Excel (CSV)</a>
      ${podeEscrever(ent) ? `<a class="btn pri" href="#/e/${ent}/novo">+ ${esc(m.singular)}</a>` : ''}</div>
    <div class="card"><input class="busca" type="search" id="busca" placeholder="Buscar ${esc(m.rotulo.toLowerCase())}…" value="${esc(q.get('q') || '')}" aria-label="Buscar">
      ${campoFiltro ? `<details style="margin-top:10px" ${[...q.keys()].some((k) => k !== 'q' && k !== 'desloc') ? 'open' : ''}><summary class="mut">Filtros</summary><div class="filtros" style="margin-top:10px">${campoFiltro}</div></details>` : ''}
    </div><div class="card" id="res"></div>`;
  const estado = () => {
    const p = new URLSearchParams();
    const b = $('#busca').value.trim(); if (b) p.set('q', b);
    $$('[data-fl]', main).forEach((el) => { const v = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value; if (v) p.set(el.dataset.fl, v); });
    return p;
  };
  const carregar = async (desloc = 0) => {
    const p = estado();
    history.replaceState(null, '', `#/e/${ent}${p.toString() ? '?' + p : ''}`);
    $('#b-csv').href = `/api/exportar/${ent}.csv?${p}`;
    p.set('limite', 50); p.set('desloc', desloc);
    const r = await api(`${ent}?${p}`);
    const cols = m.lista.map((n) => campo(ent, n));
    $('#res').innerHTML = r.itens.length ? `<table class="tab"><thead><tr>${cols.map((c) => `<th class="${['money', 'int'].includes(c.t) ? 'num' : ''}">${esc(c.l)}</th>`).join('')}</tr></thead><tbody>
      ${r.itens.map((it) => `<tr class="clic" data-id="${it.id}">${cols.map((c) => `<td data-l="${esc(c.l)}" class="${['money', 'int'].includes(c.t) ? 'num' : ''}">${fmt(c, it[c.n], it)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div class="pag"><span class="mut">${desloc + 1}–${desloc + r.itens.length} de ${r.total}</span>
      <button class="btn sm" id="ant" ${desloc ? '' : 'disabled'}>‹</button><button class="btn sm" id="prox" ${desloc + 50 < r.total ? '' : 'disabled'}>›</button></div>`
      : '<div class="vazio">Nenhum registro encontrado.</div>';
    $$('#res tr.clic').forEach((tr) => { tr.onclick = () => { location.hash = `#/e/${ent}/${tr.dataset.id}`; }; });
    if ($('#ant')) { $('#ant').onclick = () => carregar(Math.max(0, desloc - 50)); $('#prox').onclick = () => carregar(desloc + 50); }
  };
  let t; $('#busca').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => carregar(), 300); });
  main.addEventListener('change', (e) => { if (e.target.dataset.fl) carregar(); });
  await carregar(Number(q.get('desloc')) || 0);
}
async function filtroHTML(c, v) {
  const id = 'f-' + c.n; let inp;
  if (c.t === 'select') inp = `<select id="${id}" data-fl="${c.n}"><option value="">Todos</option>${c.opcoes.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (c.t === 'bool') inp = `<select id="${id}" data-fl="${c.n}"><option value="">Todos</option><option value="1" ${v === '1' ? 'selected' : ''}>Sim</option><option value="0" ${v === '0' ? 'selected' : ''}>Não</option></select>`;
  else if (c.t === 'ref') { const op = await opcoes(c.ref); inp = `<select id="${id}" data-fl="${c.n}"><option value="">Todos</option>${op.map((o) => `<option value="${o.id}" ${String(o.id) === v ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}</select>`; }
  else if (c.t === 'municipio') inp = `<input id="${id}" data-fl="${c.n}" list="dl-mun" value="${esc(v || '')}"><datalist id="dl-mun">${META.municipios.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
  else inp = `<input id="${id}" data-fl="${c.n}" value="${esc(v || '')}">`;
  return `<div class="campo"><label for="${id}">${esc(c.l)}</label>${inp}</div>`;
}

/* ---------------- formulário genérico ---------------- */
async function inputHTML(c, v, ro) {
  const id = 'c-' + c.n; const dis = ro || c.somente_leitura ? 'disabled' : '';
  const req = c.req ? 'required' : '';
  switch (c.t) {
    case 'textarea': return `<textarea id="${id}" name="${c.n}" ${dis}>${esc(v)}</textarea>`;
    case 'select': return `<select id="${id}" name="${c.n}" ${dis} ${req}><option value="">Selecione…</option>${c.opcoes.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    case 'bool': return `<input type="checkbox" id="${id}" name="${c.n}" ${v ? 'checked' : ''} ${dis}>`;
    case 'ref': { const op = await opcoes(c.ref); return `<select id="${id}" name="${c.n}" ${dis} ${req}><option value="">Selecione…</option>${op.map((o) => `<option value="${o.id}" ${o.id === v ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}</select>`; }
    case 'money': return `<input id="${id}" name="${c.n}" inputmode="decimal" placeholder="R$ 0,00" value="${v == null ? '' : esc((v / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}" ${dis} ${req}>`;
    case 'int': return `<input id="${id}" name="${c.n}" type="number" value="${esc(v)}" ${dis} ${req}>`;
    case 'date': return `<input id="${id}" name="${c.n}" type="date" value="${esc(v)}" ${dis} ${req}>`;
    case 'datetime': return `<input id="${id}" name="${c.n}" type="datetime-local" value="${esc(v ? v.slice(0, 16) : '')}" ${dis} ${req}>`;
    case 'phone': return `<input id="${id}" name="${c.n}" type="tel" inputmode="tel" placeholder="(68) 9 0000-0000" value="${esc(v)}" ${dis} ${req}>`;
    case 'cpf': return `<input id="${id}" name="${c.n}" inputmode="numeric" placeholder="000.000.000-00" value="${esc(v)}" ${dis}>`;
    case 'cep': return `<input id="${id}" name="${c.n}" inputmode="numeric" placeholder="00000-000" value="${esc(v)}" ${dis} data-cep>`;
    case 'email': return `<input id="${id}" name="${c.n}" type="email" value="${esc(v)}" ${dis} ${req}>`;
    case 'url': return `<input id="${id}" name="${c.n}" type="url" placeholder="https://" value="${esc(v)}" ${dis} ${req}>`;
    case 'password': return `<input id="${id}" name="${c.n}" type="password" autocomplete="new-password" ${dis}>`;
    case 'uf': return `<input id="${id}" name="${c.n}" maxlength="2" value="${esc(v)}" ${dis} style="text-transform:uppercase">`;
    case 'municipio': return `<input id="${id}" name="${c.n}" list="dl-mun2" value="${esc(v)}" ${dis}><datalist id="dl-mun2">${META.municipios.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
    case 'file': return `<input id="${id}" name="${c.n}" type="file" ${dis}>${v ? `<span class="ajuda">Atual: ${esc(v.nome)} (${Math.ceil((v.tamanho || 0) / 1024)} KB)</span>` : ''}`;
    case 'tags': return `<input id="${id}" name="${c.n}" placeholder="separe por vírgula" value="${esc(v)}" ${dis}>`;
    default: return `<input id="${id}" name="${c.n}" value="${esc(v)}" ${dis} ${req}>`;
  }
}
async function pgForm(main, ent, id, q) {
  const m = E(ent); const ro = !podeEscrever(ent);
  let reg = {};
  if (id) reg = await api(m.unico ? ent : `${ent}/${id}`);
  else {
    if (ro) throw new Error('Seu perfil é somente leitura.');
    m.campos.forEach((c) => { if (c.padrao !== undefined) reg[c.n] = c.padrao === 'hoje' ? hoje() : c.padrao === 'ano' ? new Date().getFullYear() : c.padrao; });
    q.forEach((v, k) => { const c = m.campos.find((x) => x.n === k); if (c) reg[k] = c.t === 'ref' || c.t === 'int' ? Number(v) : v; });
  }
  const volta = (q.get('volta') || '').startsWith('#/') ? q.get('volta') : `#/e/${ent}`;
  let html = '';
  for (const c of m.campos) {
    if (c.auto && !id) continue;
    const largo = ['textarea'].includes(c.t) ? ' largo' : '';
    const ajuda = c.t === 'password' && id ? 'Deixe em branco para manter a senha atual.' : c.ajuda;
    if (c.auto) { html += `<div class="campo"><label>${esc(c.l)}</label><input value="${esc(reg[c.n])}" disabled></div>`; continue; }
    html += c.t === 'bool'
      ? `<div class="campo chk${largo}" data-c="${c.n}">${await inputHTML(c, reg[c.n], ro)}<label for="c-${c.n}">${esc(c.l)}</label>${ajuda ? `<span class="ajuda">${esc(ajuda)}</span>` : ''}<span class="erro"></span></div>`
      : `<div class="campo${largo}" data-c="${c.n}"><label for="c-${c.n}">${esc(c.l)}${c.req ? ' <span class="req">*</span>' : ''}</label>${await inputHTML(c, reg[c.n], ro)}${ajuda ? `<span class="ajuda">${esc(ajuda)}</span>` : ''}<span class="erro"></span></div>`;
  }
  const calc = Object.entries(m.calc || {}).map(([n, [l, t]]) => `<div class="campo"><label>${esc(l)}</label><input value="${esc(t === 'money' ? reais(reg[n] || 0) : br(reg[n]))}" disabled></div>`).join('');
  const titulo = id ? (reg[m.titulo] || m.singular) : `Novo(a) ${m.singular.toLowerCase()}`;
  const extras = [];
  if (id && ent === 'cidadaos') {
    if (reg.whatsapp || reg.telefone) extras.push(reg.consentimento ? `<a class="btn zap" target="_blank" rel="noopener noreferrer" href="${waLink(reg.whatsapp || reg.telefone)}">💬 WhatsApp</a>` : '<span class="st warn" title="Sem autorização de contato registrada">Sem autorização de contato</span>');
    extras.push('<button type="button" class="btn" id="b-titular">📄 Relatório LGPD do titular</button>');
  }
  if (id && ent === 'documentos' && reg.arquivo) extras.push(`<a class="btn" href="/api/documentos/${id}/arquivo">⬇ Baixar arquivo</a>`);
  if (id && ent === 'emendas') {
    const p = reg.valor ? Math.min(100, Math.round((100 * (reg.valor_pago || 0)) / reg.valor)) : 0;
    extras.push(`<div style="flex:1;min-width:200px"><div class="mut" style="font-size:.85rem">Execução financeira: ${p}% pago (${reais(reg.valor_pago || 0)} de ${reais(reg.valor)})</div><div class="barra"><i style="width:${p}%"></i></div></div>`);
  }
  main.innerHTML = `<div class="cab"><a class="btn sm" href="${esc(volta)}" aria-label="Voltar">‹ Voltar</a><h1>${m.icone} ${esc(titulo)}</h1></div>
    ${ent === 'cidadaos' && !id ? '<div class="aviso">LGPD: registre só o necessário para o atendimento. Marque "Autoriza contato" apenas com autorização expressa do cidadão. Dados do mandato não podem ser usados em campanha eleitoral.</div>' : ''}
    ${extras.length ? `<div class="acoes" style="margin:0 0 14px;align-items:center">${extras.join('')}</div>` : ''}
    <form class="card" id="frm" novalidate><div class="form">${html}${calc}</div>
      ${id ? `<p class="mut" style="font-size:.8rem;margin:14px 0 0">Criado em ${brDH(reg.criado_em)}${reg.atualizado_em && reg.atualizado_em !== reg.criado_em ? ` · atualizado em ${brDH(reg.atualizado_em)}` : ''}</p>` : ''}
      ${ro ? '' : `<div class="acoes"><button class="btn pri">💾 Salvar</button><a class="btn" href="${esc(volta)}">Cancelar</a>
      ${id && !m.unico ? '<button type="button" class="btn danger" id="b-del" style="margin-left:auto">Excluir</button>' : ''}</div>`}
    </form><div id="filhos"></div>`;
  const arquivos = {};
  $$('input[type=file]', main).forEach((inp) => inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('Arquivo maior que 8 MB', true); inp.value = ''; return; }
    const rd = new FileReader(); rd.onload = () => { arquivos[inp.name] = { nome: f.name, base64: String(rd.result).split(',')[1] }; }; rd.readAsDataURL(f);
  }));
  $$('[data-cep]', main).forEach((inp) => inp.addEventListener('blur', async () => {
    const d = soDig(inp.value); if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const j = await r.json(); if (j.erro) return;
      const set = (n, v) => { const el = $(`[name=${n}]`, main); if (el && !el.value && v) el.value = v; };
      set('uf', j.uf); set('municipio', j.localidade); set('bairro', j.bairro); set('endereco', j.logradouro);
    } catch (e) { /* sem internet: preenchimento manual */ }
  }));
  if ($('#b-titular')) $('#b-titular').onclick = async () => {
    const rel = await api(`cidadaos/${id}/titular`);
    baixar(`titular-${id}-${hoje()}.json`, JSON.stringify(rel, null, 2), 'application/json');
    toast('Relatório gerado (acesso registrado na auditoria)');
  };
  $('#frm').addEventListener('submit', async (ev) => {
    ev.preventDefault(); if (ro) return;
    const corpo = {}; let invalido = false;
    $$('.campo .erro', main).forEach((e) => { e.textContent = ''; e.parentElement.classList.remove('tem-erro'); });
    for (const c of m.campos) {
      if (c.auto || c.somente_leitura) continue;
      const el = $(`[name="${c.n}"]`, main); if (!el) continue;
      if (c.t === 'file') { if (arquivos[c.n]) corpo[c.n] = arquivos[c.n]; continue; }
      if (c.t === 'password') { if (el.value) corpo[c.n] = el.value; continue; }
      let v = c.t === 'bool' ? el.checked : el.value;
      if (c.t === 'money') { v = centavos(v); if (Number.isNaN(v)) { marcaErro(c.n, 'valor inválido'); invalido = true; } }
      if (c.t === 'ref' || c.t === 'int') v = v === '' ? null : Number(v);
      corpo[c.n] = v;
    }
    if (invalido) return;
    try {
      const salvo = id ? await api(m.unico ? `${ent}/1` : `${ent}/${id}`, { metodo: 'PUT', corpo }) : await api(ent, { metodo: 'POST', corpo });
      limparCache(ent); toast('Salvo com sucesso'); contarAlertas();
      if (ent === 'gabinete') { META = await api('meta'); shell(); }
      if (q.get('volta')) location.hash = volta;
      else if (!id) location.hash = `#/e/${ent}/${salvo.id}`;
      else rota();
    } catch (e) {
      Object.entries(e.campos || {}).forEach(([n, msg]) => marcaErro(n, msg));
      toast(e.message, true); const pr = $('.tem-erro', main); if (pr) pr.scrollIntoView({ block: 'center' });
    }
  });
  function marcaErro(n, msg) { const b = $(`[data-c="${n}"]`, main); if (b) { b.classList.add('tem-erro'); $('.erro', b).textContent = msg; } }
  if ($('#b-del')) $('#b-del').onclick = async () => {
    if (!confirm(`Excluir este registro de ${m.singular.toLowerCase()}? A ação fica registrada na auditoria e não pode ser desfeita.`)) return;
    try { await api(`${ent}/${id}`, { metodo: 'DELETE' }); limparCache(ent); toast('Excluído'); location.hash = volta; contarAlertas(); } catch (e) { toast(e.message, true); }
  };
  if (id && m.filhos) await filhos($('#filhos'), ent, id);
}
async function filhos(box, ent, id) {
  let html = '';
  for (const [fe, col] of E(ent).filhos) {
    const fm = E(fe); if (!fm) continue;
    const r = await api(`${fe}?${col}=${id}&limite=100`);
    const cols = fm.lista.filter((n) => n !== col).map((n) => campo(fe, n));
    const volta = encodeURIComponent(`#/e/${ent}/${id}`);
    html += `<section class="card secao"><h2>${fm.icone} ${esc(fm.rotulo)} <span class="mut">(${r.total})</span>
      ${podeEscrever(fe) ? `<a class="btn sm" style="margin-left:auto" href="#/e/${fe}/novo?${col}=${id}&volta=${volta}">+ Adicionar</a>` : ''}</h2>
      ${r.itens.length ? `<table class="tab"><thead><tr>${cols.map((c) => `<th class="${c.t === 'money' ? 'num' : ''}">${esc(c.l)}</th>`).join('')}</tr></thead><tbody>${r.itens.map((it) => `<tr class="clic" data-h="#/e/${fe}/${it.id}?volta=${volta}">${cols.map((c) => `<td data-l="${esc(c.l)}" class="${c.t === 'money' ? 'num' : ''}">${fmt(c, it[c.n], it)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p class="mut">Nenhum registro.</p>'}</section>`;
  }
  box.innerHTML = html;
  $$('tr[data-h]', box).forEach((tr) => { tr.onclick = () => { location.hash = tr.dataset.h; }; });
}
function baixar(nome, texto, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- páginas especiais ---------------- */
function barras(lista, chave = 'chave', valor = 'n', fmtV = (v) => v) {
  const max = Math.max(1, ...lista.map((x) => x[valor] || 0));
  return lista.length ? lista.map((x) => `<div class="linha-bar"><span>${esc(x[chave])}</span><div class="barra"><i style="width:${(100 * (x[valor] || 0)) / max}%"></i></div><span>${fmtV(x[valor] || 0)}</span></div>`).join('') : '<p class="mut">Sem dados.</p>';
}
async function pgPainel(main) {
  const p = await api('painel');
  const e = p.emendas; const pe = e.indicado ? Math.round((100 * e.pago) / e.indicado) : 0;
  main.innerHTML = `<div class="cab"><h1>Visão geral</h1><span class="mut">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
  <div class="grid">
    <a class="card" href="#/e/cidadaos" style="text-decoration:none;color:inherit"><div class="kpi">${p.cidadaos}<small>cidadãos cadastrados · +${p.cidadaos_novos_30d} em 30 dias</small></div></a>
    <a class="card" href="#/e/demandas?status=Aberta" style="text-decoration:none;color:inherit"><div class="kpi">${p.demandas_abertas}<small>demandas em aberto</small></div></a>
    <a class="card" href="#/notificacoes" style="text-decoration:none;color:inherit"><div class="kpi ${p.demandas_atrasadas ? 'bad' : ''}">${p.demandas_atrasadas}<small>demandas com prazo vencido</small></div></a>
    <div class="card"><div class="kpi">${p.taxa_resolucao == null ? '—' : p.taxa_resolucao + '%'}<small>taxa de resolução de demandas</small></div></div>
    <a class="card" href="#/e/atendimentos" style="text-decoration:none;color:inherit"><div class="kpi">${p.atendimentos_30d}<small>atendimentos em 30 dias</small></div></a>
    <a class="card" href="#/e/tarefas" style="text-decoration:none;color:inherit"><div class="kpi ${p.tarefas_atrasadas ? 'bad' : ''}">${p.tarefas_abertas}<small>tarefas abertas · ${p.tarefas_atrasadas} atrasadas</small></div></a>
  </div>
  <div class="card"><h2>🏷 Emendas ${p.emendas_ano} — execução</h2>
    <div class="grid"><div class="kpi">${reais(e.indicado)}<small>${e.n} emendas indicadas</small></div><div class="kpi">${reais(e.empenhado)}<small>empenhado</small></div><div class="kpi">${reais(e.pago)}<small>pago (${pe}% do indicado)</small></div></div>
    <div class="barra" style="margin:12px 0"><i style="width:${pe}%"></i></div>
    ${barras(p.emendas_por_status, 'chave', 'valor', reais)}</div>
  <div class="grid">
    <div class="card"><h2>Demandas por status</h2>${barras(p.demandas_por_status)}</div>
    <div class="card"><h2>Demandas por área</h2>${barras(p.demandas_por_categoria)}</div>
    <div class="card"><h2>Atendimentos por canal (30 dias)</h2>${barras(p.atendimentos_por_canal)}</div>
    <div class="card"><h2>📅 Próximos 7 dias</h2>${p.proximos_compromissos.length ? p.proximos_compromissos.map((c) => `<p style="margin:6px 0"><strong>${brDH(c.inicio)}</strong> · <a href="#/e/agenda/${c.id}">${esc(c.titulo)}</a><br><span class="mut">${esc([c.local, c.municipio].filter(Boolean).join(' — '))}</span></p>`).join('') : '<p class="mut">Nenhum compromisso.</p>'}</div>
  </div>`;
}
function tabelaSimples(itens, cols) {
  if (!itens.length) return '<p class="mut">Nada para hoje.</p>';
  return `<table class="tab"><thead><tr>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${itens.map((it) => `<tr ${it._h ? `class="clic" data-h="${it._h}"` : ''}>${cols.map(([k, l, f]) => `<td data-l="${esc(l)}">${f ? f(it[k], it) : esc(it[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function pgNotificacoes(main, q) {
  const dia = q.get('data') || hoje();
  const n = await api('notificacoes?data=' + dia);
  n.tarefas.forEach((x) => { x._h = `#/e/tarefas/${x.id}`; });
  n.aniversariantes.forEach((x) => { x._h = `#/e/${x.origem}/${x.id}`; });
  n.compromissos.forEach((x) => { x._h = `#/e/agenda/${x.id}`; });
  n.lembretes.forEach((x) => { x._h = `#/e/lembretes/${x.id}`; });
  n.demandas_vencidas.forEach((x) => { x._h = `#/e/demandas/${x.id}`; });
  const zap = (v, it) => (v && it.consentimento ? `<a class="btn sm zap" target="_blank" rel="noopener noreferrer" href="${waLink(v, `Olá, ${it.nome.split(' ')[0]}! Feliz aniversário!`)}">💬 Parabenizar</a>` : esc(it.telefone || ''));
  main.innerHTML = `<div class="cab"><h1>🔔 Notificações</h1><input type="date" id="dia" class="busca" style="width:auto" value="${dia}" aria-label="Dia">
    <button class="btn" id="b-exp">⬇ Exportar</button><button class="btn" data-print>🖨 PDF</button></div>
    <div class="card"><h2>✎ Tarefas do dia e atrasadas</h2>${tabelaSimples(n.tarefas, [['titulo', 'Título'], ['prazo', 'Prazo', (v) => (v < dia ? `<span class="st bad">${br(v)}</span>` : br(v))], ['responsavel', 'Responsável'], ['prioridade', 'Prioridade']])}</div>
    <div class="card"><h2>🎁 Aniversariantes do dia</h2>${tabelaSimples(n.aniversariantes, [['nome', 'Nome'], ['idade', 'Idade', (v) => (v ? v + ' anos' : '—')], ['whatsapp', 'Contato', zap]])}</div>
    <div class="card"><h2>📅 Compromissos do dia</h2>${tabelaSimples(n.compromissos, [['titulo', 'Título'], ['inicio', 'Início', brDH], ['fim', 'Fim', brDH], ['local', 'Local']])}</div>
    <div class="card"><h2>🤝 Lembretes de relacionamento</h2>${tabelaSimples(n.lembretes, [['cidadao', 'Cidadão'], ['motivo', 'Motivo'], ['data', 'Data', br], ['telefone', 'Telefone']])}</div>
    <div class="card"><h2>⚠ Demandas com prazo vencido</h2>${tabelaSimples(n.demandas_vencidas, [['protocolo', 'Protocolo'], ['titulo', 'Título'], ['prazo', 'Prazo', br], ['status', 'Status']])}</div>`;
  $('#dia').onchange = (e) => { location.hash = '#/notificacoes?data=' + e.target.value; };
  $$('tr[data-h]', main).forEach((tr) => { tr.onclick = (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.h; }; });
  $('#b-exp').onclick = () => {
    const L = [['Seção', 'Item', 'Detalhe', 'Data']];
    n.tarefas.forEach((x) => L.push(['Tarefa', x.titulo, x.responsavel || '', br(x.prazo)]));
    n.aniversariantes.forEach((x) => L.push(['Aniversariante', x.nome, x.telefone || '', br(dia)]));
    n.compromissos.forEach((x) => L.push(['Compromisso', x.titulo, x.local || '', brDH(x.inicio)]));
    n.lembretes.forEach((x) => L.push(['Lembrete', x.cidadao, x.motivo, br(x.data)]));
    n.demandas_vencidas.forEach((x) => L.push(['Demanda vencida', x.titulo, x.protocolo, br(x.prazo)]));
    baixar(`notificacoes-${dia}.csv`, '﻿' + L.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  };
}
async function pgAniversarios(main, q) {
  const ini = q.get('inicio') || hoje(); const fim = q.get('fim') || ini;
  const p = new URLSearchParams({ inicio: ini, fim });
  ['lider', 'autoridade', 'criado_por'].forEach((k) => { if (q.get(k)) p.set(k, q.get(k)); });
  const lista = await api('aniversarios?' + p);
  const usuarios = await opcoes('usuarios');
  main.innerHTML = `<div class="cab"><h1>🎁 Aniversariantes</h1></div>
    <form class="card" id="f-aniv"><div class="filtros">
      <div class="campo"><label for="a-ini">Data de início</label><input type="date" id="a-ini" name="inicio" value="${ini}"></div>
      <div class="campo"><label for="a-fim">Data final</label><input type="date" id="a-fim" name="fim" value="${fim}"></div>
      <div class="campo"><label for="a-cp">Cadastrado por</label><select id="a-cp" name="criado_por"><option value="">Todos</option>${usuarios.map((u) => `<option value="${u.id}" ${String(u.id) === q.get('criado_por') ? 'selected' : ''}>${esc(u.rotulo)}</option>`).join('')}</select></div>
      <label class="campo chk"><input type="checkbox" name="lider" value="1" ${q.get('lider') ? 'checked' : ''}> Somente lideranças</label>
      <label class="campo chk"><input type="checkbox" name="autoridade" value="1" ${q.get('autoridade') ? 'checked' : ''}> Somente autoridades</label>
    </div><div class="acoes"><button class="btn pri">Filtrar</button><button type="button" class="btn" id="a-hoje">Hoje</button><button type="button" class="btn" id="a-mes">Este mês</button>
      <button type="button" class="btn" id="a-csv">⬇ Excel (CSV)</button><button type="button" class="btn" data-print>🖨 PDF</button></div></form>
    <div class="card"><h2>${lista.length} aniversariante(s) — ${br(ini)}${fim !== ini ? ' a ' + br(fim) : ''}</h2>
    ${tabelaSimples(lista.map((x) => ({ ...x, _h: `#/e/${x.origem}/${x.id}` })), [['dia', 'Dia'], ['nome', 'Nome'], ['idade', 'Idade', (v) => (v ? v + ' anos' : '—')], ['tags', 'Tags/cargo'],
      ['telefone', 'Contato', (v, it) => (it.consentimento && (it.whatsapp || v) ? `<a class="btn sm zap" target="_blank" rel="noopener noreferrer" href="${waLink(it.whatsapp || v, `Olá, ${it.nome.split(' ')[0]}! Feliz aniversário!`)}">💬 ${esc(it.whatsapp || v)}</a>` : esc(v || ''))]])}</div>`;
  const ir = (o) => { location.hash = '#/aniversarios?' + new URLSearchParams(o); };
  $('#f-aniv').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); const o = {}; f.forEach((v, k) => { if (v) o[k] = v; }); ir(o); };
  $('#a-hoje').onclick = () => ir({ inicio: hoje(), fim: hoje() });
  $('#a-mes').onclick = () => { const h = hoje(); const d = new Date(+h.slice(0, 4), +h.slice(5, 7), 0).getDate(); ir({ inicio: h.slice(0, 8) + '01', fim: h.slice(0, 8) + String(d).padStart(2, '0') }); };
  $('#a-csv').onclick = () => baixar(`aniversariantes-${ini}.csv`, '﻿Dia;Nome;Idade;Tags;Telefone\n' + lista.map((x) => [x.dia, x.nome, x.idade ?? '', x.tags ?? '', x.telefone ?? ''].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  $$('tr[data-h]', main).forEach((tr) => { tr.onclick = (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.h; }; });
}
async function pgMapa(main) {
  const d = await api('mapa');
  const maxC = Math.max(1, ...d.map((x) => x.cidadaos));
  main.innerHTML = `<div class="cab"><h1>📍 Presença por município</h1></div>
  <div class="aviso">Visão territorial do mandato: cidadãos cadastrados, demandas (abertas) e emendas por município. Use para planejar agendas de visita e equilibrar a destinação de emendas.</div>
  <div class="card">${d.length ? `<table class="tab"><thead><tr><th>Município</th><th>Cidadãos</th><th class="num">Demandas (abertas)</th><th class="num">Emendas</th><th class="num">Valor indicado</th><th class="num">Pago</th></tr></thead><tbody>
  ${d.map((x) => `<tr class="clic" data-m="${esc(x.municipio)}"><td data-l="Município">${esc(x.municipio)}</td><td data-l="Cidadãos"><div style="display:flex;gap:8px;align-items:center"><div class="barra" style="flex:1;min-width:60px"><i style="width:${(100 * x.cidadaos) / maxC}%"></i></div>${x.cidadaos}</div></td>
  <td data-l="Demandas" class="num">${x.demandas} (${x.demandas_abertas})</td><td data-l="Emendas" class="num">${x.emendas}</td><td data-l="Indicado" class="num">${reais(x.emendas_valor)}</td><td data-l="Pago" class="num">${reais(x.emendas_pago)}</td></tr>`).join('')}</tbody></table>` : '<p class="vazio">Sem dados.</p>'}</div>`;
  $$('tr[data-m]', main).forEach((tr) => { tr.onclick = () => { location.hash = `#/e/cidadaos?municipio=${encodeURIComponent(tr.dataset.m)}`; }; });
}
async function pgWhatsapp(main) {
  let modelo = 'Olá, {nome}! Aqui é do gabinete. ';
  try { modelo = localStorage.getItem('mandato.zap') || modelo; } catch (e) { /* sem storage */ }
  main.innerHTML = `<div class="cab"><h1>💬 WhatsApp</h1></div>
  <div class="aviso">Envio individual pelo seu WhatsApp (abre a conversa com a mensagem pronta). Só aparecem cidadãos com <strong>autorização de contato</strong> registrada (LGPD). Não use para propaganda eleitoral.</div>
  <div class="card"><div class="campo"><label for="z-msg">Modelo da mensagem ({nome} = primeiro nome)</label><textarea id="z-msg">${esc(modelo)}</textarea></div>
  <div class="campo" style="margin-top:10px"><label for="z-q">Buscar cidadão</label><input id="z-q" class="busca" type="search" placeholder="Nome, telefone ou tag"></div></div>
  <div class="card" id="z-res"></div>`;
  const carregar = async () => {
    const p = new URLSearchParams({ consentimento: '1', limite: 100 }); const b = $('#z-q').value.trim(); if (b) p.set('q', b);
    const r = await api('cidadaos?' + p); const msg = $('#z-msg').value;
    $('#z-res').innerHTML = r.itens.filter((x) => x.whatsapp || x.telefone).map((x) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)"><div style="flex:1"><strong>${esc(x.nome)}</strong><br><span class="mut">${esc(x.whatsapp || x.telefone)} · ${esc(x.municipio || '')}</span></div>
      <a class="btn sm zap" target="_blank" rel="noopener noreferrer" href="${waLink(x.whatsapp || x.telefone, msg.replaceAll('{nome}', x.nome.split(' ')[0]))}">Abrir conversa</a></div>`).join('') || '<p class="vazio">Nenhum cidadão com autorização de contato.</p>';
  };
  let t; $('#z-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(carregar, 300); });
  $('#z-msg').addEventListener('input', (e) => { try { localStorage.setItem('mandato.zap', e.target.value); } catch (er) { /* */ } clearTimeout(t); t = setTimeout(carregar, 400); });
  await carregar();
}
async function pgAuditoria(main) {
  const l = await api('auditoria?limite=300');
  main.innerHTML = `<div class="cab"><h1>🛡 Auditoria</h1></div><div class="aviso">Registro de acessos e alterações (quem, quando, o quê). Por minimização de dados, guarda apenas os nomes dos campos alterados, nunca os valores.</div>
  <div class="card">${tabelaSimples(l, [['ts', 'Quando', brDH], ['usuario_nome', 'Usuário'], ['acao', 'Ação'], ['entidade', 'Cadastro'], ['registro_id', 'ID'], ['detalhe', 'Detalhe']])}</div>`;
}
async function pgConta(main) {
  main.innerHTML = `<div class="cab"><h1>🔑 Trocar senha</h1></div><form class="card" id="f-senha" style="max-width:480px">
    <div class="campo" data-c="atual"><label for="s-a">Senha atual</label><input id="s-a" type="password" autocomplete="current-password" required><span class="erro"></span></div>
    <div class="campo" data-c="nova" style="margin-top:10px"><label for="s-n">Nova senha (mín. 8 caracteres)</label><input id="s-n" type="password" autocomplete="new-password" minlength="8" required><span class="erro"></span></div>
    <div class="acoes"><button class="btn pri">Salvar</button></div></form>`;
  $('#f-senha').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('minha-senha', { metodo: 'PUT', corpo: { atual: $('#s-a').value, nova: $('#s-n').value } }); toast('Senha alterada'); location.hash = '#/painel'; } catch (er) { toast(er.message, true); }
  };
}

iniciar();
})();
