/* Gabinete Dep. Marcus Alexandre — aplicativo (frontend + Supabase).
   Toda regra de acesso está no banco (RLS). Este arquivo só monta as telas. */
'use strict';
(() => {
const { ENT, MENU, MUNICIPIOS_AC } = window.GAB;
const IMP = window.Importador;
const sb = window.supabase.createClient(window.GAB_CONFIG.SUPABASE_URL, window.GAB_CONFIG.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const FUSO = 'America/Rio_Branco';

/* ---------------- utilitários ---------------- */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date());
const br = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const brDH = (ts) => (ts ? new Date(ts).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const reais = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const soDig = (s) => String(s || '').replace(/\D/g, '');
function paraInputDH(ts) {
  if (!ts) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function toast(msg, erro) {
  const t = $('#toast'); t.textContent = msg; t.className = 'on' + (erro ? ' erro' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ''; }, 3200);
}
function msgErro(e) {
  if (!e) return 'Erro desconhecido.';
  if (e.code === '23505') return 'Registro duplicado (já existe um cadastro com esse valor, ex.: CPF).';
  if (e.code === '23514') return 'Algum valor não atende às regras do cadastro.';
  if (e.code === '42501' || /row-level security/i.test(e.message || '')) return 'Seu perfil não tem permissão para esta ação.';
  if (e.code === '23503') return 'Este registro está vinculado a outro cadastro.';
  return e.message || String(e);
}
const E = (ent) => ENT[ent];
const PAPEL = () => (PERFIL ? PERFIL.papel : null);
const podeEscrever = (ent) => { const m = E(ent); if (!m || !PERFIL) return false; if (PAPEL() === 'admin') return true; return PAPEL() === 'assessor' && !m.admin && !m.adminEscrita; };
const podeVer = (ent) => !E(ent).admin || PAPEL() === 'admin';
const fk = (ent, c) => `${c.n}__r:${c.ref}!${ent}_${c.n}_fkey(${E(c.ref).titulo})`;
const selectStr = (ent) => ['*', ...E(ent).campos.filter((c) => c.t === 'ref').map((c) => fk(ent, c))].join(',');
const campoDe = (ent, n) => E(ent).campos.find((c) => c.n === n) || ({ criado_em: { n, l: 'Criado em', t: 'datetime' } }[n]) || { n, l: n, t: 'text' };
const cacheOp = {};
async function opcoes(ent) {
  if (!cacheOp[ent]) {
    const t = E(ent).titulo;
    const { data, error } = await sb.from(ent).select(`id,${t}`).order(t).limit(2000);
    if (error) throw error;
    cacheOp[ent] = data.map((r) => ({ id: r.id, rotulo: r[t] || `#${r.id}` }));
  }
  return cacheOp[ent];
}
const limparCache = (ent) => { delete cacheOp[ent]; };
function baixar(nome, texto, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvLinha = (arr) => arr.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';');
const evento = (acao, tabela, registro, detalhe) => sb.rpc('registrar_evento', { p_acao: acao, p_tabela: tabela || null, p_registro: registro == null ? null : String(registro), p_detalhe: detalhe || null }).then(() => {}, () => {});

/* ---------------- formatação ---------------- */
const COR_ST = { Atendida: 'ok', Paga: 'ok', Concluída: 'ok', 'Paga parcialmente': 'info', Empenhada: 'info', 'Em andamento': 'info', Encaminhada: 'info', Aberta: 'warn', Recebida: 'warn', Cadastrada: 'warn', 'A fazer': 'warn', 'Não atendida': 'bad', 'Arquivada / Não atendida': 'bad', Urgente: 'bad', Alta: 'warn', admin: 'info', assessor: 'ok', consulta: 'warn' };
function fmt(c, v, row = {}) {
  if (v == null || v === '') return '<span class="mut">—</span>';
  switch (c.t) {
    case 'money': return reais(v);
    case 'date': return br(v);
    case 'datetime': return brDH(v);
    case 'bool': return v ? 'Sim' : 'Não';
    case 'ref': return esc((row[c.n + '__r'] && row[c.n + '__r'][E(c.ref).titulo]) || '#' + v);
    case 'tags': return String(v).split(',').map((x) => `<span class="tag">${esc(x.trim())}</span>`).join('');
    case 'url': return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>`;
    case 'select': return ['status', 'prioridade', 'papel'].includes(c.n) ? `<span class="st ${COR_ST[v] || ''}">${esc(v)}</span>` : esc(v);
    default: return esc(v);
  }
}
const waLink = (tel, msg = '') => { let d = soDig(tel); if (d.length <= 11) d = '55' + d; return `https://wa.me/${d}${msg ? '?text=' + encodeURIComponent(msg) : ''}`; };
function tabela(itens, cols, { cartoes = true } = {}) {
  if (!itens.length) return '<p class="mut">Nada encontrado.</p>';
  return `<div class="rolagem"><table class="tab ${cartoes ? 'cards' : ''}"><thead><tr>${cols.map(([, l, , num]) => `<th class="${num ? 'num' : ''}">${esc(l)}</th>`).join('')}</tr></thead><tbody>
    ${itens.map((it) => `<tr ${it._h ? `class="clic" data-h="${esc(it._h)}"` : ''}>${cols.map(([k, l, f, num]) => `<td data-l="${esc(l)}" class="${num ? 'num' : ''}">${f ? f(it[k], it) : esc(it[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const ligarLinhas = (box) => $$('tr[data-h]', box).forEach((tr) => { tr.onclick = (e) => { if (!e.target.closest('a,button')) location.hash = tr.dataset.h; }; });
function barras(lista, chave = 'chave', valor = 'n', fmtV = (v) => v) {
  const max = Math.max(1, ...lista.map((x) => Number(x[valor]) || 0));
  return lista.length ? lista.map((x) => `<div class="linha-bar"><span>${esc(x[chave])}</span><div class="barra"><i style="width:${(100 * (Number(x[valor]) || 0)) / max}%"></i></div><span>${fmtV(x[valor] || 0)}</span></div>`).join('') : '<p class="mut">Sem dados.</p>';
}

/* ---------------- autenticação ---------------- */
let PERFIL = null; let GAB = {};
function telaLogin(modo = 'entrar', aviso = '') {
  const cadastro = modo === 'cadastro'; const nova = modo === 'nova-senha';
  $('#app').innerHTML = `<div class="login"><form id="f-auth" autocomplete="on">
    <div class="marca"><span class="selo">MA</span><span><b>Gabinete Dep. Marcus Alexandre</b><small>Sistema de gestão do mandato</small></span></div>
    ${nova ? '<h2 style="margin-top:14px">Definir nova senha</h2>' : `<div class="abas" role="tablist"><button type="button" class="${cadastro ? '' : 'on'}" data-m="entrar">Entrar</button><button type="button" class="${cadastro ? 'on' : ''}" data-m="cadastro">Solicitar acesso</button></div>`}
    ${aviso ? `<div class="aviso verde">${esc(aviso)}</div>` : ''}
    ${cadastro ? '<div class="campo"><label for="a-nome">Nome completo</label><input id="a-nome" required autocomplete="name"></div>' : ''}
    ${nova ? '' : '<div class="campo" style="margin-top:10px"><label for="a-email">E-mail</label><input id="a-email" type="email" required autocomplete="username"></div>'}
    <div class="campo" style="margin-top:10px"><label for="a-senha">${nova ? 'Nova senha' : 'Senha'}${cadastro || nova ? ' (mín. 8 caracteres)' : ''}</label><input id="a-senha" type="password" required minlength="${cadastro || nova ? 8 : 1}" autocomplete="${cadastro || nova ? 'new-password' : 'current-password'}"></div>
    <p class="campo"><span class="erro" id="a-erro"></span></p>
    <button class="btn pri" style="width:100%;justify-content:center">${nova ? 'Salvar senha' : cadastro ? 'Solicitar acesso' : 'Entrar'}</button>
    ${modo === 'entrar' ? '<p style="text-align:center;margin:12px 0 0"><button type="button" class="btn sm" id="a-esqueci" style="border:0">Esqueci minha senha</button></p>' : ''}
    <p class="mut" style="font-size:.8rem;margin-bottom:0">Acesso restrito à equipe do gabinete. Novos acessos precisam de aprovação do administrador. Todas as ações são registradas.</p></form></div>`;
  $$('[data-m]').forEach((b) => { b.onclick = () => telaLogin(b.dataset.m); });
  if ($('#a-esqueci')) $('#a-esqueci').onclick = async () => {
    const email = $('#a-email').value.trim(); if (!email) { $('#a-erro').textContent = 'Informe o e-mail.'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) $('#a-erro').textContent = msgErro(error); else telaLogin('entrar', 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
  };
  $('#f-auth').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const erro = $('#a-erro'); erro.textContent = '';
    const senha = $('#a-senha').value;
    if (nova) {
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) { erro.textContent = msgErro(error); return; }
      toast('Senha alterada'); location.hash = '#/painel'; return iniciar();
    }
    const email = $('#a-email').value.trim();
    if (cadastro) {
      const { error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: $('#a-nome').value.trim() }, emailRedirectTo: location.origin + location.pathname } });
      if (error) { erro.textContent = msgErro(error); return; }
      await sb.auth.signOut();
      return telaLogin('entrar', 'Pedido enviado. Confirme seu e-mail e aguarde o administrador aprovar o acesso.');
    }
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) { erro.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : msgErro(error); return; }
    await iniciar(true);
  });
  const f = $('#a-nome') || $('#a-email') || $('#a-senha'); if (f) f.focus();
}
function telaAguardando() {
  $('#app').innerHTML = `<div class="login"><form><div class="marca"><span class="selo">MA</span><span><b>Gabinete Dep. Marcus Alexandre</b><small>Sistema de gestão do mandato</small></span></div>
    <h2 style="margin-top:16px">Acesso aguardando aprovação</h2><p>Olá, ${esc(PERFIL ? PERFIL.nome : '')}. Seu cadastro foi recebido. Um administrador do gabinete precisa aprovar o seu acesso.</p>
    <button type="button" class="btn" id="b-sair2">Sair</button></form></div>`;
  $('#b-sair2').onclick = async () => { await sb.auth.signOut(); PERFIL = null; telaLogin(); };
}
async function iniciar(login = false) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { PERFIL = null; return telaLogin(); }
  const { data: perfil } = await sb.from('perfis').select('*').eq('id', session.user.id).maybeSingle();
  PERFIL = perfil;
  if (!perfil || !perfil.ativo) return telaAguardando();
  if (login) evento('login');
  const { data: g } = await sb.from('gabinete').select('*').eq('id', 1).maybeSingle(); GAB = g || {};
  if (!location.hash || location.hash === '#') location.hash = '#/painel';
  shell(); rota(); contarAlertas();
}
sb.auth.onAuthStateChange((evt) => {
  if (evt === 'PASSWORD_RECOVERY') telaLogin('nova-senha');
  if (evt === 'SIGNED_OUT') { PERFIL = null; telaLogin(); }
});

/* ---------------- estrutura ---------------- */
function itensMenu() {
  return MENU.map(([k, rot, ic]) => {
    if (k.startsWith('e/')) { const ent = k.slice(2); return podeVer(ent) ? [`#/${k}`, E(ent).rotulo, E(ent).icone] : null; }
    if (k === 'auditoria' && PAPEL() !== 'admin') return null;
    if (k === 'importar' && PAPEL() === 'consulta') return null;
    return [`#/${k}`, rot, ic];
  }).filter(Boolean);
}
function shell() {
  $('#app').innerHTML = `<div class="shell">
    <nav class="side" id="side" aria-label="Menu principal"><div class="marca"><span class="selo">MA</span><span><b>${esc(GAB.parlamentar || 'Gabinete')}</b><small>Deputado Estadual · ${esc(GAB.partido || '')}${GAB.uf ? '/' + esc(GAB.uf) : ''}</small></span></div>
      ${itensMenu().map(([h, r, ic]) => `<a href="${h}" data-h="${h}"><span class="ic" aria-hidden="true">${ic}</span>${esc(r)}</a>`).join('')}
    </nav>
    <div><header class="topo"><div class="barra-top">
      <button class="icbtn menu-btn" id="b-menu" aria-label="Abrir menu">☰</button>
      <div class="gab">Gabinete Dep. ${esc(GAB.parlamentar || '')}</div>
      <a class="icbtn" href="#/notificacoes" aria-label="Notificações do dia">🔔<span class="badge" id="bdg" hidden></span></a>
      <button class="icbtn" id="b-user" aria-label="Minha conta" aria-haspopup="true">${esc((PERFIL.nome || '?')[0].toUpperCase())}</button>
    </div><div class="faixa"></div></header><main id="main" tabindex="-1"></main></div></div>
    ${podeEscrever('cidadaos') ? '<button class="fab" id="fab" aria-label="Cadastro rápido">+</button>' : ''}`;
  $('#b-menu').onclick = () => $('#side').classList.toggle('aberto');
  $('#side').addEventListener('click', (e) => { if (e.target.closest('a')) $('#side').classList.remove('aberto'); });
  $('#b-user').onclick = (ev) => {
    ev.stopPropagation(); fecharPops();
    const p = document.createElement('div'); p.className = 'pop';
    p.innerHTML = `<div style="padding:8px 12px"><strong>${esc(PERFIL.nome)}</strong><br><span class="st ${COR_ST[PERFIL.papel] || ''}">${esc(PERFIL.papel)}</span></div>
      <a href="#/conta">Trocar senha</a><button id="b-sair">Sair</button>`;
    document.body.appendChild(p);
    $('#b-sair').onclick = async () => { await sb.auth.signOut(); };
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
  const { data: n } = await sb.rpc('notificacoes', {});
  if (!n) return;
  const t = n.tarefas.length + n.aniversariantes.length + n.compromissos.length + n.lembretes.length + n.demandas_vencidas.length;
  const b = $('#bdg'); if (b) { b.textContent = t > 99 ? '99+' : t; b.hidden = !t; }
}

/* ---------------- rotas ---------------- */
function parseHash() {
  const [p, q] = (location.hash.slice(1) || '/painel').split('?');
  return { partes: p.split('/').filter(Boolean), q: new URLSearchParams(q || '') };
}
async function rota() {
  if (!PERFIL || !PERFIL.ativo || !$('#main')) return;
  fecharPops();
  const { partes, q } = parseHash();
  const ativo = partes[0] === 'e' ? `#/e/${partes[1]}` : `#/${partes[0]}`;
  $$('#side a').forEach((a) => a.classList.toggle('on', a.dataset.h === ativo));
  const main = $('#main'); main.innerHTML = '<p class="mut">Carregando…</p>';
  try {
    if (partes[0] === 'e' && E(partes[1]) && podeVer(partes[1])) {
      const ent = partes[1];
      if (E(ent).unico) await pgForm(main, ent, 1, q);
      else if (partes[2] === 'novo') await pgForm(main, ent, null, q);
      else if (partes[2]) await pgForm(main, ent, /^\d+$/.test(partes[2]) ? Number(partes[2]) : decodeURIComponent(partes[2]), q);
      else await pgLista(main, ent, q);
    } else {
      const pg = { painel: pgPainel, notificacoes: pgNotificacoes, aniversarios: pgAniversarios, mapa: pgMapa, assistente: pgAssistente, importar: pgImportar, whatsapp: pgWhatsapp, auditoria: pgAuditoria, conta: pgConta }[partes[0]];
      await (pg || pgPainel)(main, q);
    }
    window.scrollTo(0, 0);
  } catch (e) { main.innerHTML = `<div class="erro-box"><strong>Não foi possível abrir.</strong><br>${esc(msgErro(e))}</div>`; }
}
window.addEventListener('hashchange', rota);

/* ---------------- lista genérica ---------------- */
function aplicaFiltros(qb, ent, p) {
  const m = E(ent);
  const termo = (p.get('q') || '').replace(/[,()*%"\\:]/g, ' ').trim();
  if (termo) qb = qb.or(m.campos.filter((c) => c.busca).map((c) => `${c.n}.ilike.*${termo}*`).join(','));
  for (const [k, v] of p.entries()) {
    if (!v || ['q', 'desloc', 'volta'].includes(k)) continue;
    const [base, op] = k.split('__'); const c = m.campos.find((x) => x.n === base) || (base === 'criado_em' ? { t: 'datetime' } : null);
    if (!c) continue;
    if (op === 'de') qb = qb.gte(base, v);
    else if (op === 'ate') qb = qb.lte(base, c.t === 'datetime' ? `${v}T23:59:59-05:00` : v);
    else if (c.t === 'tags' || c.t === 'text') qb = qb.ilike(base, `%${v}%`);
    else if (c.t === 'bool') qb = qb.eq(base, v === '1');
    else qb = qb.eq(base, v);
  }
  return qb;
}
async function pgLista(main, ent, q) {
  const m = E(ent);
  const filtros = m.campos.filter((c) => c.filtro);
  const datas = m.campos.filter((c) => ['date', 'datetime'].includes(c.t) && !c.calc).slice(0, 1);
  let campoFiltro = '';
  for (const c of filtros) campoFiltro += await filtroHTML(c, q.get(c.n));
  for (const c of datas) campoFiltro += `<div class="campo"><label for="fd-${c.n}">${esc(c.l)} de</label><input id="fd-${c.n}" type="date" data-fl="${c.n}__de" value="${esc(q.get(c.n + '__de') || '')}"></div><div class="campo"><label for="fa-${c.n}">${esc(c.l)} até</label><input id="fa-${c.n}" type="date" data-fl="${c.n}__ate" value="${esc(q.get(c.n + '__ate') || '')}"></div>`;
  const temFiltro = [...q.keys()].some((k) => !['q', 'desloc'].includes(k));
  main.innerHTML = `<div class="cab"><h1>${m.icone} ${esc(m.rotulo)}</h1>
      <button class="btn" id="b-csv">⬇ Excel (CSV)</button>
      ${podeEscrever(ent) && !m.semCriar ? `<a class="btn pri" href="#/e/${ent}/novo">+ ${esc(m.singular)}</a>` : ''}</div>
    ${ent === 'perfis' ? '<div class="aviso">Novos usuários entram pela tela de login em "Solicitar acesso" e chegam aqui <strong>desativados</strong>. Abra o cadastro, escolha o perfil e marque "Acesso aprovado".</div>' : ''}
    <div class="card"><input class="busca" type="search" id="busca" placeholder="Buscar em ${esc(m.rotulo.toLowerCase())}…" value="${esc(q.get('q') || '')}" aria-label="Buscar">
      ${campoFiltro ? `<details style="margin-top:10px" ${temFiltro ? 'open' : ''}><summary class="mut">Filtros</summary><div class="filtros" style="margin-top:10px">${campoFiltro}</div></details>` : ''}
    </div><div class="card" id="res"></div>`;
  const estado = () => {
    const p = new URLSearchParams(); const b = $('#busca').value.trim(); if (b) p.set('q', b);
    $$('[data-fl]', main).forEach((el) => { if (el.value) p.set(el.dataset.fl, el.value); });
    return p;
  };
  const cols = m.lista.map((n) => campoDe(ent, n));
  const carregar = async (desloc = 0) => {
    const p = estado();
    history.replaceState(null, '', `#/e/${ent}${p.toString() ? '?' + p : ''}`);
    const [col, asc] = m.ordem;
    let qb = sb.from(ent).select(selectStr(ent), { count: 'exact' });
    qb = aplicaFiltros(qb, ent, p).order(col, { ascending: asc, nullsFirst: false }).range(desloc, desloc + 49);
    const { data, count, error } = await qb;
    if (error) { $('#res').innerHTML = `<div class="erro-box">${esc(msgErro(error))}</div>`; return; }
    $('#res').innerHTML = data.length ? `${tabela(data.map((it) => ({ ...it, _h: `#/e/${ent}/${it.id}` })), cols.map((c) => [c.n, c.l, (v, it) => fmt(c, v, it), ['money', 'int'].includes(c.t)]))}
      <div class="pag"><span class="mut">${desloc + 1}–${desloc + data.length} de ${count}</span>
      <button class="btn sm" id="ant" ${desloc ? '' : 'disabled'} aria-label="Página anterior">‹</button><button class="btn sm" id="prox" ${desloc + 50 < count ? '' : 'disabled'} aria-label="Próxima página">›</button></div>`
      : '<div class="vazio">Nenhum registro encontrado.</div>';
    ligarLinhas($('#res'));
    if ($('#ant')) { $('#ant').onclick = () => carregar(Math.max(0, desloc - 50)); $('#prox').onclick = () => carregar(desloc + 50); }
  };
  let t; $('#busca').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => carregar(), 300); });
  main.addEventListener('change', (e) => { if (e.target.dataset.fl) carregar(); });
  $('#b-csv').onclick = () => exportarCSV(ent, estado());
  await carregar();
}
async function exportarCSV(ent, p) {
  const m = E(ent); const campos = m.campos.filter((c) => c.t !== 'file');
  const linhas = [csvLinha(['ID', ...campos.map((c) => c.l), 'Criado em'])];
  let total = 0;
  for (let ini = 0; ; ini += 1000) {
    const { data, error } = await aplicaFiltros(sb.from(ent).select(selectStr(ent)), ent, p).order('id').range(ini, ini + 999);
    if (error) { toast(msgErro(error), true); return; }
    data.forEach((r) => linhas.push(csvLinha([r.id, ...campos.map((c) => {
      const v = r[c.n]; if (v == null) return '';
      if (c.t === 'money') return Number(v).toFixed(2).replace('.', ',');
      if (c.t === 'bool') return v ? 'Sim' : 'Não';
      if (c.t === 'ref') return (r[c.n + '__r'] || {})[E(c.ref).titulo] || v;
      if (c.t === 'date') return br(v);
      if (c.t === 'datetime') return brDH(v);
      return v;
    }), brDH(r.criado_em)])));
    total += data.length; if (data.length < 1000) break;
  }
  baixar(`${ent}-${hoje()}.csv`, '\ufeff' + linhas.join('\n'), 'text/csv;charset=utf-8');
  evento('exportar', ent, null, `${total} registros`);
  toast(`${total} registros exportados (registrado na auditoria)`);
}
async function filtroHTML(c, v) {
  const id = 'f-' + c.n; let inp;
  if (c.t === 'select') inp = `<select id="${id}" data-fl="${c.n}"><option value="">Todos</option>${c.opcoes.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (c.t === 'bool') inp = `<select id="${id}" data-fl="${c.n}"><option value="">Todos</option><option value="1" ${v === '1' ? 'selected' : ''}>Sim</option><option value="0" ${v === '0' ? 'selected' : ''}>Não</option></select>`;
  else if (c.t === 'ref') { const op = await opcoes(c.ref); inp = `<select id="${id}" data-fl="${c.n}"><option value="">Todos</option>${op.map((o) => `<option value="${esc(o.id)}" ${String(o.id) === v ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}</select>`; }
  else if (c.t === 'municipio') inp = `<input id="${id}" data-fl="${c.n}" list="dl-mun" value="${esc(v || '')}"><datalist id="dl-mun">${MUNICIPIOS_AC.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
  else inp = `<input id="${id}" data-fl="${c.n}" value="${esc(v || '')}">`;
  return `<div class="campo"><label for="${id}">${esc(c.l)}</label>${inp}</div>`;
}

/* ---------------- formulário genérico ---------------- */
async function inputHTML(c, v, ro) {
  const id = 'c-' + c.n; const dis = ro || c.calc ? 'disabled' : ''; const req = c.req ? 'required aria-required="true"' : '';
  switch (c.t) {
    case 'textarea': return `<textarea id="${id}" name="${c.n}" ${dis}>${esc(v)}</textarea>`;
    case 'select': return `<select id="${id}" name="${c.n}" ${dis} ${req}><option value="">Selecione…</option>${c.opcoes.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    case 'bool': return `<input type="checkbox" id="${id}" name="${c.n}" ${v ? 'checked' : ''} ${dis}>`;
    case 'ref': { const op = await opcoes(c.ref); return `<select id="${id}" name="${c.n}" ${dis} ${req}><option value="">Selecione…</option>${op.map((o) => `<option value="${esc(o.id)}" ${String(o.id) === String(v) ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}</select>`; }
    case 'money': return `<input id="${id}" name="${c.n}" inputmode="decimal" placeholder="R$ 0,00" value="${v == null ? '' : esc(Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}" ${dis} ${req}>`;
    case 'int': return `<input id="${id}" name="${c.n}" type="number" value="${esc(v)}" ${dis} ${req}>`;
    case 'date': return `<input id="${id}" name="${c.n}" type="date" value="${esc(v)}" ${dis} ${req}>`;
    case 'datetime': return `<input id="${id}" name="${c.n}" type="datetime-local" value="${esc(paraInputDH(v))}" ${dis} ${req}>`;
    case 'phone': return `<input id="${id}" name="${c.n}" type="tel" inputmode="tel" placeholder="(68) 9 0000-0000" value="${esc(v)}" ${dis} ${req}>`;
    case 'cpf': return `<input id="${id}" name="${c.n}" inputmode="numeric" placeholder="000.000.000-00" value="${esc(v)}" ${dis}>`;
    case 'cep': return `<input id="${id}" name="${c.n}" inputmode="numeric" placeholder="00000-000" value="${esc(v)}" ${dis} data-cep>`;
    case 'email': return `<input id="${id}" name="${c.n}" type="email" value="${esc(v)}" ${dis} ${req}>`;
    case 'url': return `<input id="${id}" name="${c.n}" type="url" placeholder="https://" value="${esc(v)}" ${dis} ${req}>`;
    case 'uf': return `<input id="${id}" name="${c.n}" maxlength="2" value="${esc(v)}" ${dis} style="text-transform:uppercase">`;
    case 'municipio': return `<input id="${id}" name="${c.n}" list="dl-mun2" value="${esc(v)}" ${dis}><datalist id="dl-mun2">${MUNICIPIOS_AC.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
    case 'file': return `<input id="${id}" name="${c.n}" type="file" ${dis}>`;
    case 'tags': return `<input id="${id}" name="${c.n}" placeholder="separe por vírgula" value="${esc(v)}" ${dis}>`;
    default: return `<input id="${id}" name="${c.n}" value="${esc(v)}" ${dis} ${req}>`;
  }
}
async function pgForm(main, ent, id, q) {
  const m = E(ent); const ro = !podeEscrever(ent);
  let reg = {};
  if (id) {
    const { data, error } = await sb.from(ent).select(selectStr(ent)).eq('id', id).maybeSingle();
    if (error) throw error; if (!data) throw new Error('Registro não encontrado.');
    reg = data;
    if (ent === 'cidadaos') evento('visualizar', ent, id);
  } else {
    if (ro || m.semCriar) throw new Error('Seu perfil não pode criar este cadastro.');
    m.campos.forEach((c) => { if (c.padrao !== undefined) reg[c.n] = c.padrao === 'hoje' ? hoje() : c.padrao === 'ano' ? Number(hoje().slice(0, 4)) : c.padrao; });
    q.forEach((v, k) => { const c = m.campos.find((x) => x.n === k); if (c) reg[k] = v; });
  }
  const volta = (q.get('volta') || '').startsWith('#/') ? q.get('volta') : m.unico ? '#/painel' : `#/e/${ent}`;
  let html = '';
  for (const c of m.campos) {
    if ((c.auto || c.calc) && !id) continue;
    if (c.t === 'file' && id) continue;
    const largo = c.t === 'textarea' ? ' largo' : '';
    const disabled = c.auto || (ent === 'perfis' && c.n === 'email');
    if (c.auto) { html += `<div class="campo"><label>${esc(c.l)}</label><input value="${esc(reg[c.n])}" disabled></div>`; continue; }
    const ajuda = c.ajuda ? `<span class="ajuda">${esc(c.ajuda)}</span>` : '';
    html += c.t === 'bool'
      ? `<div class="campo chk${largo}" data-c="${c.n}">${await inputHTML(c, reg[c.n], ro || disabled)}<label for="c-${c.n}">${esc(c.l)}</label>${ajuda}<span class="erro"></span></div>`
      : `<div class="campo${largo}" data-c="${c.n}"><label for="c-${c.n}">${esc(c.l)}${c.req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${await inputHTML(c, c.calc && c.t === 'money' ? reg[c.n] || 0 : reg[c.n], ro || disabled)}${ajuda}<span class="erro"></span></div>`;
  }
  const titulo = id ? (reg[m.titulo] || m.singular) : `Novo(a) ${m.singular.toLowerCase()}`;
  const extras = [];
  if (id && ent === 'cidadaos') {
    if (reg.whatsapp || reg.telefone) extras.push(reg.consentimento ? `<a class="btn zap" target="_blank" rel="noopener noreferrer" href="${esc(waLink(reg.whatsapp || reg.telefone))}">💬 WhatsApp</a>` : '<span class="st warn">Sem autorização de contato</span>');
    extras.push('<button type="button" class="btn" id="b-titular">📄 Relatório LGPD do titular</button>');
  }
  if (id && ent === 'documentos') extras.push(`<button type="button" class="btn" id="b-baixar">⬇ Baixar ${esc(reg.arquivo_nome || 'arquivo')}</button>`);
  if (id && ent === 'emendas') {
    const p = Number(reg.valor) ? Math.min(100, Math.round((100 * Number(reg.valor_pago || 0)) / Number(reg.valor))) : 0;
    extras.push(`<div style="flex:1;min-width:220px"><div class="mut" style="font-size:.85rem">Execução financeira: <strong>${p}% pago</strong> (${reais(reg.valor_pago || 0)} de ${reais(reg.valor)})</div><div class="barra"><i style="width:${p}%"></i></div></div>`);
  }
  main.innerHTML = `<div class="cab"><a class="btn sm" href="${esc(volta)}">‹ Voltar</a><h1>${m.icone} ${esc(titulo)}</h1></div>
    ${ent === 'cidadaos' && !id ? '<div class="aviso">LGPD: registre só o necessário para o atendimento. Marque "Autoriza contato" apenas com autorização expressa. Dados do mandato não podem ser usados em campanha eleitoral (Lei 9.504/1997, art. 73).</div>' : ''}
    ${extras.length ? `<div class="acoes" style="margin:0 0 14px">${extras.join('')}</div>` : ''}
    <form class="card destaque" id="frm" novalidate><div class="form">${html}</div>
      ${id && reg.criado_em ? `<p class="mut" style="font-size:.8rem;margin:14px 0 0">Criado em ${brDH(reg.criado_em)}${reg.atualizado_em && reg.atualizado_em !== reg.criado_em ? ` · atualizado em ${brDH(reg.atualizado_em)}` : ''}</p>` : ''}
      ${ro ? '' : `<div class="acoes"><button class="btn pri">💾 Salvar</button><a class="btn" href="${esc(volta)}">Cancelar</a>
      ${id && !m.unico ? '<button type="button" class="btn danger" id="b-del" style="margin-left:auto">Excluir</button>' : ''}</div>`}
    </form><div id="filhos"></div>`;

  $$('[data-cep]', main).forEach((inp) => inp.addEventListener('blur', async () => {
    const d = soDig(inp.value); if (d.length !== 8) return;
    try {
      const j = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json(); if (j.erro) return;
      const set = (n, v) => { const el = $(`[name="${n}"]`, main); if (el && !el.value && v) el.value = v; };
      set('uf', j.uf); set('municipio', j.localidade); set('bairro', j.bairro); set('endereco', j.logradouro);
    } catch (e) { /* sem internet: preenchimento manual */ }
  }));
  if ($('#b-titular')) $('#b-titular').onclick = async () => {
    const { data, error } = await sb.rpc('titular', { cid: id });
    if (error) { toast(msgErro(error), true); return; }
    baixar(`titular-${id}-${hoje()}.json`, JSON.stringify(data, null, 2), 'application/json');
    evento('relatório do titular (LGPD)', 'cidadaos', id); toast('Relatório gerado (registrado na auditoria)');
  };
  if ($('#b-baixar')) $('#b-baixar').onclick = async () => {
    const { data, error } = await sb.storage.from('documentos').createSignedUrl(reg.arquivo_path, 60, { download: reg.arquivo_nome || true });
    if (error) { toast(msgErro(error), true); return; }
    evento('baixar arquivo', 'documentos', id); location.href = data.signedUrl;
  };
  const marcaErro = (n, msg) => { const b = $(`[data-c="${n}"]`, main); if (b) { b.classList.add('tem-erro'); $('.erro', b).textContent = msg; } };
  $('#frm').addEventListener('submit', async (ev) => {
    ev.preventDefault(); if (ro) return;
    $$('.campo .erro', main).forEach((e) => { e.textContent = ''; e.parentElement.classList.remove('tem-erro'); });
    const corpo = {}; let invalido = false; let arquivo = null;
    for (const c of m.campos) {
      if (c.auto || c.calc || (ent === 'perfis' && c.n === 'email')) continue;
      const el = $(`[name="${c.n}"]`, main); if (!el) continue;
      if (c.t === 'file') { arquivo = el.files[0] || null; if (!arquivo && !id && c.req) { marcaErro(c.n, 'obrigatório'); invalido = true; } continue; }
      let v = c.t === 'bool' ? el.checked : el.value.trim();
      if (c.t === 'bool') { corpo[c.n] = v; continue; }
      if (v === '') { if (c.req) { marcaErro(c.n, 'obrigatório'); invalido = true; } corpo[c.n] = null; continue; }
      if (c.t === 'ref' || c.t === 'int') { corpo[c.n] = Number(v); continue; }
      if (c.t === 'datetime') { corpo[c.n] = `${v}:00-05:00`; continue; }
      if (['select', 'date', 'textarea', 'text', 'municipio'].includes(c.t)) { corpo[c.n] = v; continue; }
      const r = IMP.converter(v, c, MUNICIPIOS_AC);
      if (r.aviso || r.v == null) { marcaErro(c.n, r.aviso || 'valor inválido'); invalido = true; } else corpo[c.n] = r.v;
    }
    if (arquivo && arquivo.size > 8 * 1024 * 1024) { marcaErro('arquivo', 'arquivo maior que 8 MB'); invalido = true; }
    if (invalido) { toast('Verifique os campos destacados.', true); const pr = $('.tem-erro', main); if (pr) pr.scrollIntoView({ block: 'center' }); return; }
    const botao = $('#frm .btn.pri'); botao.disabled = true;
    try {
      if (arquivo) {
        const caminho = `${crypto.randomUUID()}-${arquivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)}`;
        const { error } = await sb.storage.from('documentos').upload(caminho, arquivo, { contentType: arquivo.type || 'application/octet-stream' });
        if (error) throw error;
        Object.assign(corpo, { arquivo_path: caminho, arquivo_nome: arquivo.name, arquivo_mime: arquivo.type || null, arquivo_tamanho: arquivo.size });
      }
      const r = id ? await sb.from(ent).update(corpo).eq('id', id).select('id').single() : await sb.from(ent).insert(corpo).select('id').single();
      if (r.error) throw r.error;
      limparCache(ent); toast('Salvo com sucesso'); contarAlertas();
      if (ent === 'gabinete') { const { data: g } = await sb.from('gabinete').select('*').eq('id', 1).single(); GAB = g; shell(); }
      if (q.get('volta')) location.hash = volta;
      else if (!id) location.hash = `#/e/${ent}/${r.data.id}`;
      else rota();
    } catch (e) {
      toast(msgErro(e), true);
      if (e.code === '23505' && ent === 'cidadaos') marcaErro('cpf', 'CPF já cadastrado');
    } finally { botao.disabled = false; }
  });
  if ($('#b-del')) $('#b-del').onclick = async () => {
    if (!confirm(`Excluir este registro (${m.singular.toLowerCase()})? A exclusão fica registrada na auditoria e não pode ser desfeita.`)) return;
    const { error } = await sb.from(ent).delete().eq('id', id);
    if (error) { toast(msgErro(error), true); return; }
    if (ent === 'documentos' && reg.arquivo_path) await sb.storage.from('documentos').remove([reg.arquivo_path]);
    limparCache(ent); toast('Excluído'); location.hash = volta; contarAlertas();
  };
  if (id && m.filhos) await filhos($('#filhos'), ent, id);
}
async function filhos(box, ent, id) {
  let html = '';
  for (const [fe, col] of E(ent).filhos) {
    const fm = E(fe);
    const { data, count } = await sb.from(fe).select(selectStr(fe), { count: 'exact' }).eq(col, id).order(fm.ordem[0], { ascending: fm.ordem[1] }).limit(100);
    const cols = fm.lista.filter((n) => n !== col).map((n) => campoDe(fe, n));
    const volta = encodeURIComponent(`#/e/${ent}/${id}`);
    html += `<section class="card"><h2 style="display:flex;align-items:center;gap:8px">${fm.icone} ${esc(fm.rotulo)} <span class="mut">(${count || 0})</span>
      ${podeEscrever(fe) ? `<a class="btn sm" style="margin-left:auto" href="#/e/${fe}/novo?${col}=${id}&volta=${volta}">+ Adicionar</a>` : ''}</h2>
      ${tabela((data || []).map((it) => ({ ...it, _h: `#/e/${fe}/${it.id}?volta=${volta}` })), cols.map((c) => [c.n, c.l, (v, it) => fmt(c, v, it), c.t === 'money']))}</section>`;
  }
  box.innerHTML = html; ligarLinhas(box);
}

/* ---------------- Visão geral ---------------- */
async function pgPainel(main) {
  const { data: p, error } = await sb.rpc('painel'); if (error) throw error;
  const e = p.emendas; const pe = Number(e.indicado) ? Math.round((100 * Number(e.pago)) / Number(e.indicado)) : 0;
  main.innerHTML = `<div class="cab"><h1>Visão geral do mandato</h1><span class="mut">${new Date().toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
  <div class="grid">
    <a class="card destaque" href="#/e/cidadaos"><div class="kpi">${p.cidadaos}<small>cidadãos cadastrados · +${p.cidadaos_novos_30d} em 30 dias · ${p.liderancas} lideranças</small></div></a>
    <a class="card destaque" href="#/e/demandas?status=Aberta"><div class="kpi">${p.demandas_abertas}<small>demandas em aberto</small></div></a>
    <a class="card destaque" href="#/notificacoes"><div class="kpi ${p.demandas_atrasadas ? 'bad' : ''}">${p.demandas_atrasadas}<small>demandas com prazo vencido</small></div></a>
    <div class="card destaque"><div class="kpi">${p.taxa_resolucao == null ? '—' : p.taxa_resolucao + '%'}<small>taxa de resolução de demandas</small></div></div>
    <a class="card destaque" href="#/e/atendimentos"><div class="kpi">${p.atendimentos_30d}<small>atendimentos em 30 dias</small></div></a>
    <a class="card destaque" href="#/e/tarefas"><div class="kpi ${p.tarefas_atrasadas ? 'bad' : ''}">${p.tarefas_abertas}<small>tarefas abertas · ${p.tarefas_atrasadas} atrasadas</small></div></a>
  </div>
  <div class="card"><h2>🏷 Emendas ${p.emendas_ano} — execução financeira</h2>
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

/* ---------------- Notificações ---------------- */
async function pgNotificacoes(main, q) {
  const dia = q.get('data') || hoje();
  const { data: n, error } = await sb.rpc('notificacoes', { dia }); if (error) throw error;
  n.tarefas.forEach((x) => { x._h = `#/e/tarefas/${x.id}`; });
  n.aniversariantes.forEach((x) => { x._h = `#/e/${x.origem}/${x.id}`; });
  n.compromissos.forEach((x) => { x._h = `#/e/agenda/${x.id}`; });
  n.lembretes.forEach((x) => { x._h = `#/e/lembretes/${x.id}`; });
  n.demandas_vencidas.forEach((x) => { x._h = `#/e/demandas/${x.id}`; });
  const zap = (v, it) => ((it.whatsapp || it.telefone) && it.consentimento ? `<a class="btn sm zap" target="_blank" rel="noopener noreferrer" href="${esc(waLink(it.whatsapp || it.telefone, `Olá, ${it.nome.split(' ')[0]}! Feliz aniversário!`))}">💬 Parabenizar</a>` : esc(it.telefone || ''));
  main.innerHTML = `<div class="cab"><h1>🔔 Notificações do dia</h1><input type="date" id="dia" class="busca" style="width:auto" value="${esc(dia)}" aria-label="Dia">
    <button class="btn" id="b-exp">⬇ Exportar</button><button class="btn" data-print>🖨 PDF</button></div>
    <div class="card"><h2>✎ Tarefas do dia e atrasadas</h2>${tabela(n.tarefas, [['titulo', 'Título'], ['prazo', 'Prazo', (v) => (v < dia ? `<span class="st bad">${br(v)}</span>` : br(v))], ['responsavel', 'Responsável'], ['prioridade', 'Prioridade']])}</div>
    <div class="card"><h2>🎁 Aniversariantes do dia</h2>${tabela(n.aniversariantes, [['nome', 'Nome'], ['idade', 'Idade', (v) => (v ? v + ' anos' : '—')], ['whatsapp', 'Contato', zap]])}</div>
    <div class="card"><h2>📅 Compromissos do dia</h2>${tabela(n.compromissos, [['titulo', 'Título'], ['inicio', 'Início', brDH], ['fim', 'Fim', brDH], ['local', 'Local']])}</div>
    <div class="card"><h2>🤝 Lembretes de relacionamento</h2>${tabela(n.lembretes, [['cidadao', 'Cidadão'], ['motivo', 'Motivo'], ['data', 'Data', br], ['telefone', 'Telefone']])}</div>
    <div class="card"><h2>⚠ Demandas com prazo vencido</h2>${tabela(n.demandas_vencidas, [['protocolo', 'Protocolo'], ['titulo', 'Título'], ['prazo', 'Prazo', br], ['status', 'Status']])}</div>`;
  $('#dia').onchange = (e) => { location.hash = '#/notificacoes?data=' + e.target.value; };
  ligarLinhas(main);
  $('#b-exp').onclick = () => {
    const L = [csvLinha(['Seção', 'Item', 'Detalhe', 'Data'])];
    n.tarefas.forEach((x) => L.push(csvLinha(['Tarefa', x.titulo, x.responsavel, br(x.prazo)])));
    n.aniversariantes.forEach((x) => L.push(csvLinha(['Aniversariante', x.nome, x.telefone, br(dia)])));
    n.compromissos.forEach((x) => L.push(csvLinha(['Compromisso', x.titulo, x.local, brDH(x.inicio)])));
    n.lembretes.forEach((x) => L.push(csvLinha(['Lembrete', x.cidadao, x.motivo, br(x.data)])));
    n.demandas_vencidas.forEach((x) => L.push(csvLinha(['Demanda vencida', x.titulo, x.protocolo, br(x.prazo)])));
    baixar(`notificacoes-${dia}.csv`, '\ufeff' + L.join('\n'), 'text/csv;charset=utf-8');
    evento('exportar', 'notificacoes', null, dia);
  };
}

/* ---------------- Aniversariantes ---------------- */
async function pgAniversarios(main, q) {
  const ini = q.get('inicio') || hoje(); const fim = q.get('fim') || ini;
  const { data: lista, error } = await sb.rpc('aniversarios', { inicio: ini, fim, so_lider: q.get('lider') === '1', so_autoridade: q.get('autoridade') === '1', cadastrado_por: q.get('criado_por') || null });
  if (error) throw error;
  const usuarios = await opcoes('perfis');
  main.innerHTML = `<div class="cab"><h1>🎁 Aniversariantes</h1></div>
    <form class="card" id="f-aniv"><div class="filtros">
      <div class="campo"><label for="a-ini">Data de início</label><input type="date" id="a-ini" name="inicio" value="${esc(ini)}"></div>
      <div class="campo"><label for="a-fim">Data final</label><input type="date" id="a-fim" name="fim" value="${esc(fim)}"></div>
      <div class="campo"><label for="a-cp">Cadastrado por</label><select id="a-cp" name="criado_por"><option value="">Todos</option>${usuarios.map((u) => `<option value="${esc(u.id)}" ${u.id === q.get('criado_por') ? 'selected' : ''}>${esc(u.rotulo)}</option>`).join('')}</select></div>
      <label class="campo chk"><input type="checkbox" name="lider" value="1" ${q.get('lider') ? 'checked' : ''}> Somente lideranças</label>
      <label class="campo chk"><input type="checkbox" name="autoridade" value="1" ${q.get('autoridade') ? 'checked' : ''}> Somente autoridades</label>
    </div><div class="acoes"><button class="btn pri">Filtrar</button><button type="button" class="btn" id="a-hoje">Hoje</button><button type="button" class="btn" id="a-mes">Este mês</button>
      <button type="button" class="btn" id="a-csv">⬇ Excel (CSV)</button><button type="button" class="btn" data-print>🖨 PDF</button></div></form>
    <div class="card"><h2>${lista.length} aniversariante(s) — ${br(ini)}${fim !== ini ? ' a ' + br(fim) : ''}</h2>
    ${tabela(lista.map((x) => ({ ...x, _h: `#/e/${x.origem}/${x.id}` })), [['dia', 'Dia'], ['nome', 'Nome'], ['idade', 'Idade', (v) => (v ? v + ' anos' : '—')], ['tags', 'Tags / cargo'],
      ['telefone', 'Contato', (v, it) => (it.consentimento && (it.whatsapp || v) ? `<a class="btn sm zap" target="_blank" rel="noopener noreferrer" href="${esc(waLink(it.whatsapp || v, `Olá, ${it.nome.split(' ')[0]}! Feliz aniversário!`))}">💬 ${esc(it.whatsapp || v)}</a>` : esc(v || ''))]])}</div>`;
  const ir = (o) => { location.hash = '#/aniversarios?' + new URLSearchParams(o); };
  $('#f-aniv').onsubmit = (e) => { e.preventDefault(); const o = {}; new FormData(e.target).forEach((v, k) => { if (v) o[k] = v; }); ir(o); };
  $('#a-hoje').onclick = () => ir({ inicio: hoje(), fim: hoje() });
  $('#a-mes').onclick = () => { const h = hoje(); const d = new Date(+h.slice(0, 4), +h.slice(5, 7), 0).getDate(); ir({ inicio: h.slice(0, 8) + '01', fim: h.slice(0, 8) + String(d).padStart(2, '0') }); };
  $('#a-csv').onclick = () => { baixar(`aniversariantes-${ini}.csv`, '\ufeff' + [csvLinha(['Dia', 'Nome', 'Idade', 'Tags', 'Telefone']), ...lista.map((x) => csvLinha([x.dia, x.nome, x.idade, x.tags, x.telefone]))].join('\n'), 'text/csv;charset=utf-8'); evento('exportar', 'aniversarios', null, `${lista.length} registros`); };
  ligarLinhas(main);
}

/* ---------------- Mapa do Acre ---------------- */
let MALHA = null;
const ESCALA = ['#E3F4E9', '#A9DDBC', '#5DBF83', '#009B3A', '#0B5E33'];
async function pgMapa(main, q) {
  if (!MALHA) MALHA = await (await fetch('dados/acre.json')).json();
  const { data: d, error } = await sb.rpc('mapa'); if (error) throw error;
  const metricas = { cidadaos: ['Cidadãos cadastrados', (v) => v], demandas_abertas: ['Demandas em aberto', (v) => v], demandas: ['Demandas (total)', (v) => v], atendimentos: ['Atendimentos', (v) => v], emendas_valor: ['Valor indicado em emendas', reais], emendas_pago: ['Valor pago de emendas', reais] };
  const met = metricas[q.get('m')] ? q.get('m') : 'cidadaos'; const [rotulo, f] = metricas[met];
  const porNome = Object.fromEntries(d.map((x) => [IMP.normaliza(x.municipio), x]));
  const vals = MALHA.municipios.map((m) => Number((porNome[IMP.normaliza(m.nome)] || {})[met] || 0));
  const max = Math.max(...vals);
  const cor = (v) => (!v ? '#EEF1EF' : ESCALA[Math.min(4, Math.floor((v / max) * 5 - 1e-9))]);
  const foraDoAcre = d.filter((x) => !MALHA.municipios.some((m) => IMP.normaliza(m.nome) === IMP.normaliza(x.municipio)));
  main.innerHTML = `<div class="cab"><h1>📍 Mapa do Acre</h1>
    <select id="met" class="busca" style="width:auto" aria-label="Indicador">${Object.entries(metricas).map(([k, [l]]) => `<option value="${k}" ${k === met ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
  <div class="card destaque"><div class="mapa-wrap" id="mw"><svg viewBox="0 0 ${MALHA.largura} ${MALHA.altura}" role="img" aria-label="Mapa dos municípios do Acre: ${esc(rotulo)}">
    ${MALHA.municipios.map((m, i) => `<path d="${m.d}" fill="${cor(vals[i])}" data-i="${i}"><title>${esc(m.nome)}: ${esc(f(vals[i]))}</title></path>`).join('')}
    ${MALHA.municipios.map((m, i) => (vals[i] ? `<text x="${m.cx}" y="${m.cy}" text-anchor="middle">${esc(met.startsWith('emendas') ? '' : vals[i])}</text>` : '')).join('')}
  </svg><div class="tip" id="tip" hidden></div></div>
  <div class="legenda"><span>${esc(rotulo)}:</span><i style="background:#EEF1EF"></i>0 ${ESCALA.map((c, k) => `<i style="background:${c}"></i>${esc(f(Math.round((max * (k + 1)) / 5)))}`).join(' ')}</div>
  <p class="mut" style="font-size:.78rem;margin-bottom:0">Malha municipal: ${esc(MALHA.fonte)}. Toque em um município para ver os cidadãos cadastrados nele.</p></div>
  <div class="card">${tabela(d.map((x) => ({ ...x, _h: `#/e/cidadaos?municipio=${encodeURIComponent(x.municipio)}` })), [['municipio', 'Município'], ['cidadaos', 'Cidadãos', null, true], ['demandas', 'Demandas', (v, x) => `${v} (${x.demandas_abertas} abertas)`, true], ['atendimentos', 'Atendimentos', null, true], ['emendas', 'Emendas', null, true], ['emendas_valor', 'Indicado', reais, true], ['emendas_pago', 'Pago', reais, true]])}
  ${foraDoAcre.length ? `<p class="mut" style="font-size:.8rem">Fora do mapa (nome não corresponde a município do Acre ou não informado): ${foraDoAcre.map((x) => esc(x.municipio)).join(', ')}.</p>` : ''}</div>`;
  $('#met').onchange = (e) => { location.hash = '#/mapa?m=' + e.target.value; };
  const tip = $('#tip'); const mw = $('#mw');
  $$('path', mw).forEach((p) => {
    const i = +p.dataset.i; const m = MALHA.municipios[i];
    p.addEventListener('mousemove', (ev) => { const r = mw.getBoundingClientRect(); tip.hidden = false; tip.style.left = `${ev.clientX - r.left}px`; tip.style.top = `${ev.clientY - r.top}px`; tip.textContent = `${m.nome}: ${f(vals[i])}`; });
    p.addEventListener('mouseleave', () => { tip.hidden = true; });
    p.addEventListener('click', () => { location.hash = `#/e/cidadaos?municipio=${encodeURIComponent(m.nome)}`; });
  });
  ligarLinhas(main);
}

/* ---------------- Assistente de IA ---------------- */
function mdSimples(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^#{1,4}\s*(.+)$/gm, '<strong>$1</strong>').replace(/^\s*[-*]\s+/gm, '• ');
}
async function pgAssistente(main) {
  const exemplos = ['Qual município concentra mais demandas em aberto e o que devo priorizar?', 'Como está a execução financeira das emendas deste ano?',
    'Qual canal de atendimento mais cresceu nos últimos meses?', 'Faça um resumo do mandato para a reunião de equipe desta semana.'];
  main.innerHTML = `<div class="cab"><h1>✨ Assistente de IA</h1></div>
  <div class="aviso verde"><strong>Privacidade:</strong> a IA recebe apenas <strong>números agregados e anonimizados</strong> do gabinete (por município, status, canal, mês). Nomes, CPF, telefones, endereços, datas de nascimento, tags e textos de demandas <strong>nunca saem do banco</strong>. Grupos com menos de 3 pessoas aparecem como "&lt;3". CPF, telefone, e-mail, CEP e datas digitados na pergunta são removidos antes do envio. Não escreva nomes de cidadãos na pergunta.</div>
  <div class="card destaque"><div class="campo"><label for="ia-p">Sua pergunta sobre os dados do gabinete</label><textarea id="ia-p" maxlength="1000" placeholder="Ex.: Quantas demandas foram resolvidas este mês?"></textarea></div>
    <div class="chips">${exemplos.map((x) => `<button type="button" class="chip">${esc(x)}</button>`).join('')}</div>
    <div class="acoes"><button class="btn pri" id="ia-ir">✨ Obter análise</button><span class="mut" id="ia-st"></span></div></div>
  <div id="ia-res"></div>`;
  $$('.chip', main).forEach((b) => { b.onclick = () => { $('#ia-p').value = b.textContent; $('#ia-p').focus(); }; });
  $('#ia-ir').onclick = async () => {
    const pergunta = $('#ia-p').value.trim(); if (pergunta.length < 3) { toast('Escreva a pergunta.', true); return; }
    const bt = $('#ia-ir'); bt.disabled = true; $('#ia-st').textContent = 'Analisando…'; $('#ia-res').innerHTML = '';
    let corpo; let erro = null;
    try {
      const { data, error } = await sb.functions.invoke('assistente', { body: { pergunta } });
      corpo = data;
      if (error) { erro = error.message; try { corpo = await error.context.json(); erro = corpo.erro || erro; } catch (e) { /* sem corpo */ } }
    } catch (e) { erro = e.message; }
    bt.disabled = false; $('#ia-st').textContent = '';
    const enviado = corpo && corpo.contexto ? `<details style="margin-top:12px"><summary class="mut">Ver exatamente o que foi enviado à IA</summary><p class="mut">Pergunta enviada: <code>${esc(corpo.pergunta_enviada || '')}</code></p><pre class="json">${esc(JSON.stringify(corpo.contexto, null, 2))}</pre></details>` : '';
    $('#ia-res').innerHTML = erro
      ? `<div class="erro-box">${esc(erro)}</div>${enviado}`
      : `<div class="card"><h2>Análise</h2><div class="resposta">${mdSimples(corpo.resposta || '')}</div>${corpo.truncada ? '<p class="mut">Resposta resumida por limite de tamanho.</p>' : ''}
         <p class="mut" style="font-size:.8rem">Resposta gerada por IA a partir de dados agregados. Confira os números nos relatórios antes de usá-los em documentos oficiais.</p>${enviado}</div>`;
  };
}

/* ---------------- Importar planilhas ---------------- */
const DESTINOS = ['cidadaos', 'instituicoes', 'autoridades', 'emendas', 'demandas', 'agenda'];
async function pgImportar(main) {
  if (PAPEL() === 'consulta') throw new Error('Seu perfil é somente leitura.');
  const st = { ent: 'cidadaos', planilhas: [], idx: 0, cab: 0, mapa: [], nomeArq: '' };
  main.innerHTML = `<div class="cab"><h1>⬆ Importar planilhas</h1></div>
  <div class="aviso">Aceita <strong>.xlsx</strong> (Excel) e <strong>.csv</strong>, inclusive exportações de outros sistemas de gabinete. O arquivo é lido <strong>no seu navegador</strong>; só os registros válidos são gravados. Revise o mapeamento das colunas antes de importar.</div>
  <div class="card destaque">
    <div class="passo"><b>1</b><strong>Destino e arquivo</strong></div>
    <div class="filtros">
      <div class="campo"><label for="im-ent">Importar para</label><select id="im-ent">${DESTINOS.map((k) => `<option value="${k}">${esc(E(k).rotulo)}</option>`).join('')}</select></div>
      <div class="campo" id="im-bl-box"><label for="im-bl">Base legal (LGPD) dos cidadãos importados</label><select id="im-bl">${E('cidadaos').campos.find((c) => c.n === 'base_legal').opcoes.map((o) => `<option ${o === 'Atendimento a pedido do titular' ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
      <div class="campo"><label for="im-arq">Arquivo</label><input id="im-arq" type="file" accept=".xlsx,.csv,.txt"></div>
    </div>
    <label class="campo chk" id="im-lgpd-box"><input type="checkbox" id="im-lgpd"> Confirmo que estes dados foram obtidos no exercício do mandato e que não serão usados para fins eleitorais. "Autoriza contato" será importado como <strong>Não</strong>, salvo coluna própria.</label>
  </div><div id="im-passo2"></div><div id="im-passo3"></div>`;
  const atualizaEnt = () => { st.ent = $('#im-ent').value; const c = st.ent === 'cidadaos'; $('#im-bl-box').hidden = !c; $('#im-lgpd-box').hidden = !c; if (st.planilhas.length) passo2(); };
  $('#im-ent').onchange = atualizaEnt;
  $('#im-arq').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) { toast('Arquivo maior que 15 MB.', true); return; }
    st.nomeArq = f.name;
    try {
      const buf = await f.arrayBuffer(); const u8 = new Uint8Array(buf);
      st.planilhas = u8[0] === 0x50 && u8[1] === 0x4b ? await IMP.lerXLSX(buf) : [{ nome: f.name, linhas: IMP.lerCSV(IMP.decodificar(buf)) }];
      if (!st.planilhas.length) throw new Error('Nenhuma planilha encontrada no arquivo.');
      st.idx = 0; passo2();
    } catch (er) { toast('Não foi possível ler o arquivo: ' + er.message, true); }
  };
  function passo2() {
    const pl = st.planilhas[st.idx]; const ent = E(st.ent);
    st.cab = IMP.detectarCabecalho(pl.linhas, ent);
    st.mapa = IMP.sugerirMapa(pl.linhas[st.cab] || [], ent);
    desenhaPasso2();
  }
  function desenhaPasso2() {
    const pl = st.planilhas[st.idx]; const ent = E(st.ent); const cab = pl.linhas[st.cab] || [];
    const campos = IMP.CAMPOS_IMPORTAVEIS(ent);
    const amostra = (j) => pl.linhas.slice(st.cab + 1).map((l) => l[j]).filter((x) => String(x ?? '').trim()).slice(0, 3).map((x) => esc(String(x).slice(0, 40))).join(' · ');
    $('#im-passo2').innerHTML = `<div class="card"><div class="passo"><b>2</b><strong>Colunas da planilha → campos do sistema</strong></div>
      <div class="filtros">${st.planilhas.length > 1 ? `<div class="campo"><label for="im-pl">Aba</label><select id="im-pl">${st.planilhas.map((p, i) => `<option value="${i}" ${i === st.idx ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>` : ''}
        <div class="campo"><label for="im-cab">Linha do cabeçalho</label><input id="im-cab" type="number" min="1" max="${pl.linhas.length}" value="${st.cab + 1}"></div>
        <div class="campo"><label>Linhas no arquivo</label><input value="${pl.linhas.length}" disabled></div></div>
      ${cab.length ? `<div class="rolagem"><table class="tab"><thead><tr><th>Coluna da planilha</th><th>Exemplos</th><th>Gravar em</th></tr></thead><tbody>
      ${cab.map((h, j) => `<tr><td><strong>${esc(h || `(coluna ${j + 1})`)}</strong></td><td class="mut" style="font-size:.85rem">${amostra(j)}</td>
        <td><select data-j="${j}" class="busca" style="min-height:38px"><option value="">— ignorar —</option>${campos.map((c) => `<option value="${c.n}" ${st.mapa[j] === c.n ? 'selected' : ''}>${esc(c.l)}${c.req ? ' *' : ''}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="mut">Linha de cabeçalho vazia.</p>'}
      <div class="acoes"><button class="btn pri" id="im-prev">Conferir dados</button></div></div>`;
    $('#im-passo3').innerHTML = '';
    if ($('#im-pl')) $('#im-pl').onchange = (e) => { st.idx = +e.target.value; passo2(); };
    $('#im-cab').onchange = (e) => { st.cab = Math.max(0, +e.target.value - 1); st.mapa = IMP.sugerirMapa(pl.linhas[st.cab] || [], ent); desenhaPasso2(); };
    $$('[data-j]').forEach((s) => { s.onchange = () => { st.mapa[+s.dataset.j] = s.value; }; });
    $('#im-prev').onclick = passo3;
  }
  async function passo3() {
    const pl = st.planilhas[st.idx]; const ent = E(st.ent);
    const usados = st.mapa.filter(Boolean); const dup = usados.find((n, i) => usados.indexOf(n) !== i);
    if (dup) { toast(`O campo "${ent.campos.find((c) => c.n === dup).l}" foi escolhido para mais de uma coluna.`, true); return; }
    const r = IMP.preparar(pl.linhas, st.cab, st.mapa, ent, MUNICIPIOS_AC);
    let duplicados = 0;
    if (st.ent === 'cidadaos') {
      const chaves = new Set();
      for (let ini = 0; ; ini += 1000) {
        const { data, error } = await sb.from('cidadaos').select('cpf,nome,telefone').range(ini, ini + 999);
        if (error) { toast(msgErro(error), true); return; }
        data.forEach((x) => { if (x.cpf) chaves.add('cpf:' + x.cpf); chaves.add('nt:' + IMP.normaliza(x.nome) + '|' + soDig(x.telefone)); });
        if (data.length < 1000) break;
      }
      r.registros = r.registros.filter((x) => {
        const k1 = x.dados.cpf ? 'cpf:' + x.dados.cpf : null; const k2 = 'nt:' + IMP.normaliza(x.dados.nome) + '|' + soDig(x.dados.telefone);
        if ((k1 && chaves.has(k1)) || chaves.has(k2)) { duplicados++; return false; }
        if (k1) chaves.add(k1); chaves.add(k2); return true;
      });
    }
    const avisos = r.registros.filter((x) => x.avisos.length);
    const cols = [...new Set(r.registros.flatMap((x) => Object.keys(x.dados)))];
    $('#im-passo3').innerHTML = `<div class="card destaque"><div class="passo"><b>3</b><strong>Conferência</strong></div>
      <div class="grid"><div class="kpi">${r.registros.length}<small>prontos para importar</small></div><div class="kpi">${duplicados}<small>já existem (ignorados)</small></div>
      <div class="kpi ${r.erros.length ? 'bad' : ''}">${r.erros.length}<small>com erro (não importados)</small></div><div class="kpi">${avisos.length}<small>com avisos (campo descartado)</small></div></div>
      ${r.registros.length ? `<h2 style="margin-top:14px">Prévia (até 10 linhas)</h2>${tabela(r.registros.slice(0, 10).map((x) => ({ linha: x.linha, ...x.dados })), [['linha', 'Linha'], ...cols.map((n) => { const c = campoDe(st.ent, n); return [n, c.l, (v) => fmt(c, v)]; })], { cartoes: false })}` : ''}
      ${r.erros.length || avisos.length ? `<details style="margin-top:10px"><summary>Ver erros e avisos</summary><ul>${r.erros.slice(0, 200).map((e) => `<li>Linha ${e.linha}: ${esc(e.msg)}</li>`).join('')}${avisos.slice(0, 200).map((a) => `<li>Linha ${a.linha}: ${esc(a.avisos.join('; '))}</li>`).join('')}</ul></details>` : ''}
      <div class="acoes"><button class="btn pri" id="im-ir" ${r.registros.length ? '' : 'disabled'}>⬆ Importar ${r.registros.length} registro(s)</button>
      ${r.erros.length || avisos.length ? '<button class="btn" id="im-rel">⬇ Relatório de erros (CSV)</button>' : ''}<span class="mut" id="im-st"></span></div></div>`;
    if ($('#im-rel')) $('#im-rel').onclick = () => baixar(`erros-importacao-${hoje()}.csv`, '\ufeff' + [csvLinha(['Linha', 'Tipo', 'Mensagem']), ...r.erros.map((e) => csvLinha([e.linha, 'erro', e.msg])), ...avisos.map((a) => csvLinha([a.linha, 'aviso', a.avisos.join('; ')]))].join('\n'), 'text/csv;charset=utf-8');
    $('#im-ir').onclick = async () => {
      if (st.ent === 'cidadaos' && !$('#im-lgpd').checked) { toast('Marque a confirmação de origem dos dados (passo 1).', true); $('#im-lgpd').focus(); return; }
      const bt = $('#im-ir'); bt.disabled = true;
      const extra = st.ent === 'cidadaos' ? { base_legal: $('#im-bl').value } : {};
      const regs = r.registros.map((x) => ({ linha: x.linha, dados: { ...extra, ...x.dados } }));
      let ok = 0; const falhas = [];
      for (let i = 0; i < regs.length; i += 200) {
        const lote = regs.slice(i, i + 200);
        $('#im-st').textContent = `Gravando ${Math.min(i + 200, regs.length)} de ${regs.length}…`;
        const { error } = await sb.from(st.ent).insert(lote.map((x) => x.dados));
        if (!error) { ok += lote.length; continue; }
        for (const x of lote) { // lote falhou: tenta um a um para isolar a linha com problema
          const { error: e1 } = await sb.from(st.ent).insert(x.dados);
          if (e1) falhas.push({ linha: x.linha, msg: msgErro(e1) }); else ok++;
        }
      }
      await sb.from('importacoes').insert({ tabela: st.ent, arquivo: st.nomeArq.slice(0, 200), linhas: pl.linhas.length, inseridas: ok, ignoradas: duplicados + r.vazias, com_erro: r.erros.length + falhas.length, usuario_id: PERFIL.id });
      evento('importar', st.ent, null, `${ok} inseridos de ${st.nomeArq}`);
      limparCache(st.ent);
      $('#im-st').textContent = '';
      $('#im-passo3').insertAdjacentHTML('afterbegin', `<div class="${falhas.length ? 'erro-box' : 'aviso verde'}"><strong>${ok} registro(s) importado(s).</strong>${falhas.length ? ` ${falhas.length} recusado(s) pelo banco: ${falhas.slice(0, 10).map((f) => `linha ${f.linha} (${esc(f.msg)})`).join('; ')}` : ''} <a href="#/e/${st.ent}">Ver ${esc(E(st.ent).rotulo.toLowerCase())}</a></div>`);
      toast(`${ok} registros importados`);
    };
  }
  atualizaEnt();
}

/* ---------------- WhatsApp ---------------- */
async function pgWhatsapp(main) {
  let modelo = 'Olá, {nome}! Aqui é do gabinete do Deputado Marcus Alexandre. ';
  try { modelo = localStorage.getItem('gab.zap') || modelo; } catch (e) { /* sem storage */ }
  main.innerHTML = `<div class="cab"><h1>💬 WhatsApp</h1></div>
  <div class="aviso">Envio individual pelo seu WhatsApp (abre a conversa com a mensagem pronta). Só aparecem cidadãos com <strong>autorização de contato</strong> registrada (LGPD). Não use para propaganda eleitoral.</div>
  <div class="card"><div class="campo"><label for="z-msg">Modelo da mensagem ({nome} = primeiro nome)</label><textarea id="z-msg">${esc(modelo)}</textarea></div>
  <div class="campo" style="margin-top:10px"><label for="z-q">Buscar cidadão</label><input id="z-q" class="busca" type="search" placeholder="Nome, telefone ou tag"></div></div>
  <div class="card" id="z-res"></div>`;
  const carregar = async () => {
    const p = new URLSearchParams({ consentimento: '1' }); const b = $('#z-q').value.trim(); if (b) p.set('q', b);
    const { data, error } = await aplicaFiltros(sb.from('cidadaos').select('id,nome,telefone,whatsapp,municipio'), 'cidadaos', p).order('nome').limit(100);
    if (error) { $('#z-res').innerHTML = `<div class="erro-box">${esc(msgErro(error))}</div>`; return; }
    const msg = $('#z-msg').value;
    $('#z-res').innerHTML = data.filter((x) => x.whatsapp || x.telefone).map((x) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)"><div style="flex:1;min-width:0"><strong>${esc(x.nome)}</strong><br><span class="mut">${esc(x.whatsapp || x.telefone)} · ${esc(x.municipio || '')}</span></div>
      <a class="btn sm zap" target="_blank" rel="noopener noreferrer" href="${esc(waLink(x.whatsapp || x.telefone, msg.replaceAll('{nome}', x.nome.split(' ')[0])))}">Abrir conversa</a></div>`).join('') || '<p class="vazio">Nenhum cidadão com autorização de contato.</p>';
  };
  let t; $('#z-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(carregar, 300); });
  $('#z-msg').addEventListener('input', (e) => { try { localStorage.setItem('gab.zap', e.target.value); } catch (er) { /* */ } clearTimeout(t); t = setTimeout(carregar, 400); });
  await carregar();
}

/* ---------------- Auditoria e conta ---------------- */
async function pgAuditoria(main) {
  const { data, error } = await sb.from('auditoria').select('*').order('id', { ascending: false }).limit(300); if (error) throw error;
  main.innerHTML = `<div class="cab"><h1>🛡 Auditoria</h1></div><div class="aviso verde">Registro de acessos e alterações: quem, quando e o quê. Por minimização de dados (LGPD), guarda só os <strong>nomes</strong> dos campos alterados, nunca os valores.</div>
  <div class="card">${tabela(data, [['ts', 'Quando', brDH], ['usuario_nome', 'Usuário'], ['acao', 'Ação'], ['tabela', 'Cadastro'], ['registro_id', 'ID'], ['detalhe', 'Detalhe']])}</div>`;
}
async function pgConta(main) {
  main.innerHTML = `<div class="cab"><h1>🔑 Trocar senha</h1></div><form class="card destaque" id="f-senha" style="max-width:480px">
    <div class="campo" data-c="nova"><label for="s-n">Nova senha (mín. 8 caracteres)</label><input id="s-n" type="password" autocomplete="new-password" minlength="8" required><span class="erro"></span></div>
    <div class="campo" style="margin-top:10px"><label for="s-c">Repita a nova senha</label><input id="s-c" type="password" autocomplete="new-password" required></div>
    <div class="acoes"><button class="btn pri">Salvar</button></div></form>`;
  $('#f-senha').onsubmit = async (e) => {
    e.preventDefault();
    if ($('#s-n').value.length < 8) { toast('A senha precisa de 8 caracteres ou mais.', true); return; }
    if ($('#s-n').value !== $('#s-c').value) { toast('As senhas não conferem.', true); return; }
    const { error } = await sb.auth.updateUser({ password: $('#s-n').value });
    if (error) toast(msgErro(error), true); else { toast('Senha alterada'); location.hash = '#/painel'; }
  };
}

iniciar();
})();
