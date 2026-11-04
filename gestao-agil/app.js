/* Fluxo — Gestão Ágil de Projetos. Licença Apache-2.0. Sem dependências, sem build. */
'use strict';
(() => {
const KEY = 'fluxo.v1';

/* ---------- constantes ---------- */
const STATUS = [
  { id: 'backlog', nome: 'Backlog', ic: '◌', cor: '#8a8a85' },
  { id: 'afazer', nome: 'A fazer', ic: '○', cor: '#6b6b66' },
  { id: 'andamento', nome: 'Em andamento', ic: '◐', cor: '#e8a317' },
  { id: 'revisao', nome: 'Em revisão', ic: '◑', cor: '#3b5bdb' },
  { id: 'concluida', nome: 'Concluída', ic: '●', cor: '#2f9e44' },
  { id: 'cancelada', nome: 'Cancelada', ic: '✕', cor: '#8a8a85' },
];
const PRIO = [
  { id: 1, nome: 'Urgente', ic: '‼', cor: '#e03131' },
  { id: 2, nome: 'Alta', ic: '▲', cor: '#e8590c' },
  { id: 3, nome: 'Média', ic: '■', cor: '#e8a317' },
  { id: 4, nome: 'Baixa', ic: '▼', cor: '#6b6b66' },
  { id: 0, nome: 'Sem prioridade', ic: '–', cor: '#8a8a85' },
];
const PSTATUS = [
  { id: 'backlog', nome: 'Backlog' }, { id: 'planejado', nome: 'Planejado' },
  { id: 'andamento', nome: 'Em andamento' }, { id: 'concluido', nome: 'Concluído' },
  { id: 'cancelado', nome: 'Cancelado' },
];
const FECHADAS = ['concluida', 'cancelada'];
const COR = ['#e0703a', '#3b5bdb', '#2f9e44', '#ae3ec9', '#0c8599', '#c2255c'];

/* ---------- utilitários ---------- */
const $ = (s, e = document) => e.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = () => fmt(new Date());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDias = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const difDias = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const br = (s) => (s ? s.split('-').reverse().join('/') : '—');
const iso = () => new Date().toISOString();
const stOf = (id) => STATUS.find((s) => s.id === id) || STATUS[0];
const prOf = (id) => PRIO.find((p) => p.id === Number(id)) || PRIO[4];

/* ---------- estado ---------- */
let S;
function seed() {
  const h = hoje();
  const eu = 'u1';
  const mk = (num, titulo, extra = {}) => ({
    id: uid(), num, titulo, descricao: '', status: 'backlog', prio: 0, resp: eu, projeto: null, ciclo: null,
    prazo: '', est: 0, labels: [], checklist: [], bloqueadaPor: [], comentarios: [],
    criado: iso(), atualizado: iso(), iniciadoEm: '', concluidoEm: '', ...extra,
  });
  const p1 = { id: 'p1', nome: 'Prêmio CNJ de Qualidade — Governança', descricao: 'Monitoramento das evidências e pendências do eixo Governança.', status: 'andamento', prio: 1, lider: eu, inicio: addDias(h, -90), prazo: addDias(h, 20), fav: true };
  const p2 = { id: 'p2', nome: 'SUMAE | Aferição dos Indicadores — Prêmio TJAC de Qualidade 2026', descricao: 'Planejamento, aferição e aplicabilidade por competência.', status: 'backlog', prio: 2, lider: eu, inicio: h, prazo: '2026-12-18', fav: false };
  const c1 = { id: 'c1', nome: 'Ciclo 1', inicio: addDias(h, -4), fim: addDias(h, 9) };
  const issues = [
    mk(1, 'Levantar evidências do eixo Governança', { projeto: 'p1', status: 'concluida', prio: 2, est: 3, ciclo: 'c1', iniciadoEm: addDias(h, -30), concluidoEm: addDias(h, -3) }),
    mk(2, 'Validar pendências com as unidades', { projeto: 'p1', status: 'concluida', prio: 2, est: 2, ciclo: 'c1', iniciadoEm: addDias(h, -20), concluidoEm: addDias(h, -1) }),
    mk(3, 'Consolidar relatório de pendências', { projeto: 'p1', status: 'andamento', prio: 1, est: 3, ciclo: 'c1', prazo: addDias(h, 3), resp: 'u2', iniciadoEm: addDias(h, -2) }),
    mk(4, 'Reunião de Análise da Estratégia (RAE)', { projeto: 'p1', status: 'revisao', prio: 2, est: 2, ciclo: 'c1', prazo: addDias(h, -2) }),
    mk(5, 'Auditar alterações nos indicadores', { projeto: 'p2', prio: 2, est: 5, labels: ['dados'] }),
    mk(6, 'Tratar classificações pendentes', { projeto: 'p2', prio: 2, est: 3, labels: ['dados'] }),
    mk(7, 'Homologar relatório final', { projeto: 'p2', prio: 1, est: 2 }),
    mk(8, 'Preparar dossiê para reunião', { projeto: 'p2', prio: 3, est: 2, resp: 'u3' }),
    mk(9, 'Consolidar resultados por competência', { projeto: 'p2', prio: 3, est: 3 }),
    mk(10, 'Congelar referência oficial', { projeto: 'p2', prio: 2, est: 1, labels: ['governança'] }),
    mk(11, 'Executar ensaio de aferição', { projeto: 'p2', status: 'afazer', prio: 2, est: 3, ciclo: 'c1', labels: ['dados'] }),
    mk(12, 'Construir painel de qualidade', { projeto: 'p2', status: 'afazer', prio: 3, est: 5, ciclo: 'c1', labels: ['painel'] }),
    mk(13, 'Implementar repositório de evidências', { projeto: 'p2', prio: 3, est: 5 }),
    mk(14, 'Construir modelo de dados', { projeto: 'p2', prio: 3, est: 3, labels: ['dados'] }),
  ];
  issues[10].bloqueadaPor = [issues[9].id];
  return {
    v: 1, seq: 14, me: eu, demo: true,
    equipe: { nome: 'Gestão Estratégica', chave: 'GE' },
    users: [{ id: 'u1', nome: 'Você', cor: COR[0] }, { id: 'u2', nome: 'Ana Souza', cor: COR[1] }, { id: 'u3', nome: 'Carlos Lima', cor: COR[2] }],
    projects: [p1, p2], issues, ciclos: [c1], views: [{ id: 'v1', nome: 'Atrasadas e urgentes', f: { atrasada: '1' }, fav: false }],
    atividade: [{ ts: iso(), txt: 'Espaço de trabalho criado com dados de exemplo.' }],
    lidos: [], cfg: { tema: 'auto', wip: 3, progresso: 'pontos' },
  };
}
function load() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) { /* sem storage */ }
  return seed();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignora */ } }
S = load();

const ui = { f: {}, mode: 'lista', group: 'status', modal: null, draft: null, pal: '' };

/* ---------- domínio ---------- */
const user = (id) => S.users.find((u) => u.id === id);
const proj = (id) => S.projects.find((p) => p.id === id);
const issue = (id) => S.issues.find((i) => i.id === id);
const ident = (i) => `${S.equipe.chave}-${i.num}`;
const aberta = (i) => !FECHADAS.includes(i.status);
const vencida = (i) => aberta(i) && i.prazo && i.prazo < hoje();
const bloqueada = (i) => i.bloqueadaPor.some((id) => { const b = issue(id); return b && aberta(b); });
const peso = (i) => (S.cfg.progresso === 'pontos' ? i.est || 1 : 1);
function log(txt) { S.atividade.unshift({ ts: iso(), txt }); S.atividade = S.atividade.slice(0, 200); }
function progresso(pid) {
  const l = S.issues.filter((i) => i.projeto === pid && i.status !== 'cancelada');
  const tot = l.reduce((a, i) => a + peso(i), 0);
  if (!tot) return 0;
  return Math.round((100 * l.filter((i) => i.status === 'concluida').reduce((a, i) => a + peso(i), 0)) / tot);
}
function saude(p) {
  const pr = progresso(p.id);
  if (['concluido', 'cancelado'].includes(p.status)) return { t: p.status === 'concluido' ? 'Concluído' : 'Cancelado', c: '' };
  if (!p.prazo) return { t: 'Sem prazo', c: '' };
  if (p.prazo < hoje() && pr < 100) return { t: 'Atrasado', c: 'bad' };
  if (!p.inicio || p.inicio >= p.prazo) return { t: 'No prazo', c: 'ok' };
  const esperado = Math.max(0, Math.min(100, (100 * difDias(p.inicio, hoje())) / difDias(p.inicio, p.prazo)));
  if (p.status !== 'backlog' && esperado - pr > 25) return { t: 'Em risco', c: 'warn' };
  return { t: 'No prazo', c: 'ok' };
}
function setStatus(i, st) {
  if (i.status === st) return;
  const antes = stOf(i.status).nome;
  i.status = st;
  if (st === 'andamento' && !i.iniciadoEm) i.iniciadoEm = hoje();
  if (st === 'concluida') { i.concluidoEm = hoje(); if (!i.iniciadoEm) i.iniciadoEm = hoje(); } else i.concluidoEm = '';
  i.atualizado = iso();
  log(`${ident(i)} “${i.titulo}”: ${antes} → ${stOf(st).nome}`);
}
function filtrar(lista, f) {
  const q = (f.q || '').toLowerCase();
  return lista.filter((i) =>
    (!q || i.titulo.toLowerCase().includes(q) || ident(i).toLowerCase().includes(q)) &&
    (!f.status || (f.status === 'abertas' ? aberta(i) : i.status === f.status)) &&
    (!f.resp || (f.resp === '-' ? !i.resp : i.resp === f.resp)) &&
    (f.prio === undefined || f.prio === '' || i.prio === Number(f.prio)) &&
    (!f.projeto || i.projeto === f.projeto) &&
    (!f.ciclo || i.ciclo === f.ciclo) &&
    (!f.label || i.labels.includes(f.label)) &&
    (!f.atrasada || vencida(i) || (i.prio === 1 && aberta(i))) &&
    (!f.bloqueada || bloqueada(i)));
}
const labels = () => [...new Set(S.issues.flatMap((i) => i.labels))].sort();

/* ---------- componentes ---------- */
const avatar = (id) => { const u = user(id); return u ? `<span class="avatar" title="${esc(u.nome)}" style="background:${u.cor}">${esc(u.nome[0])}</span>` : '<span class="avatar" style="background:#999" title="Sem responsável">?</span>'; };
const stIc = (s) => `<span class="st" style="color:${stOf(s).cor}" title="${stOf(s).nome}">${stOf(s).ic}</span>`;
const prIc = (p) => `<span class="st" style="color:${prOf(p).cor}" title="${prOf(p).nome}">${prOf(p).ic}</span>`;
const opts = (arr, sel, vazio) => (vazio !== undefined ? `<option value="">${vazio}</option>` : '') + arr.map(([v, n]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(n)}</option>`).join('');
const stOpts = (sel) => opts(STATUS.map((s) => [s.id, s.nome]), sel);
const prOpts = (sel) => opts(PRIO.map((p) => [p.id, p.nome]), sel);
const userOpts = (sel, vazio) => opts(S.users.map((u) => [u.id, u.nome]), sel, vazio);
const projOpts = (sel, vazio) => opts(S.projects.map((p) => [p.id, p.nome]), sel, vazio);
const cicloOpts = (sel, vazio) => opts(S.ciclos.map((c) => [c.id, c.nome]), sel, vazio);
const bar = (n) => `<div class="bar" title="${n}%"><i style="width:${n}%"></i></div>`;

function linhaIssue(i) {
  const venc = vencida(i);
  return `<div class="row ${i.status === 'concluida' ? 'done' : ''}" data-act="abrir" data-id="${i.id}">
    ${prIc(i.prio)}<span class="id">${esc(ident(i))}</span>${stIc(i.status)}
    <span class="t">${esc(i.titulo)}</span>
    ${bloqueada(i) ? '<span class="chip bad" title="Bloqueada por dependência">⛔ bloqueada</span>' : ''}
    ${i.labels.map((l) => `<span class="chip hide-m">${esc(l)}</span>`).join('')}
    ${i.est ? `<span class="chip hide-m">${i.est} pt</span>` : ''}
    ${i.prazo ? `<span class="chip ${venc ? 'bad' : ''}">${venc ? '⚠ ' : ''}${br(i.prazo).slice(0, 5)}</span>` : ''}
    ${avatar(i.resp)}</div>`;
}
function cartaoIssue(i) {
  const venc = vencida(i);
  return `<div class="kcard" draggable="true" data-act="abrir" data-id="${i.id}">
    <div><span class="id" style="color:var(--mut);font-size:12px">${esc(ident(i))}</span></div>
    <div>${esc(i.titulo)}</div>
    <div class="meta">${prIc(i.prio)}${bloqueada(i) ? '<span class="chip bad">⛔</span>' : ''}
      ${i.est ? `<span class="chip">${i.est} pt</span>` : ''}
      ${i.prazo ? `<span class="chip ${venc ? 'bad' : ''}">${br(i.prazo).slice(0, 5)}</span>` : ''}
      ${i.labels.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}
      <span style="margin-left:auto">${avatar(i.resp)}</span></div></div>`;
}

/* painel de tarefas reutilizável: filtros + lista/quadro */
function painel(base, key, { fixos = [] } = {}) {
  const f = ui.f[key] || (ui.f[key] = {});
  const lista = filtrar(base, f);
  const sel = (k, h, o) => (fixos.includes(k) ? '' : `<select data-f="${key}:${k}" aria-label="${h}">${o}</select>`);
  const barra = `<div class="filters">
    <input data-f="${key}:q" placeholder="Filtrar tarefas…" value="${esc(f.q || '')}" aria-label="Filtrar">
    ${sel('status', 'Status', opts([['abertas', 'Abertas'], ...STATUS.map((s) => [s.id, s.nome])], f.status, 'Todos os status'))}
    ${sel('resp', 'Responsável', opts([['-', 'Sem responsável'], ...S.users.map((u) => [u.id, u.nome])], f.resp, 'Todos os responsáveis'))}
    ${sel('prio', 'Prioridade', opts(PRIO.map((p) => [p.id, p.nome]), f.prio, 'Qualquer prioridade'))}
    ${sel('label', 'Etiqueta', opts(labels().map((l) => [l, l]), f.label, 'Todas as etiquetas'))}
    <span class="seg"><button class="${ui.mode === 'lista' ? 'on' : ''}" data-act="modo" data-v="lista">Lista</button><button class="${ui.mode === 'quadro' ? 'on' : ''}" data-act="modo" data-v="quadro">Quadro</button></span>
    ${ui.mode === 'lista' ? `<select data-g="1" aria-label="Agrupar por">${opts([['status', 'Agrupar: status'], ['prio', 'Agrupar: prioridade'], ['resp', 'Agrupar: responsável'], ['projeto', 'Agrupar: projeto'], ['nenhum', 'Sem agrupamento']], ui.group)}</select>` : ''}
    <button class="btn sm" data-act="salvar-visao" data-key="${key}">Salvar como visão</button></div>`;
  if (!lista.length) return barra + '<div class="empty">Nenhuma tarefa encontrada.</div>';
  if (ui.mode === 'quadro') {
    const cols = STATUS.filter((s) => f.status !== 'abertas' || !FECHADAS.includes(s.id)).filter((s) => !f.status || f.status === 'abertas' || f.status === s.id);
    return barra + `<div class="board">${cols.map((s) => {
      const L = lista.filter((i) => i.status === s.id);
      const wip = s.id === 'andamento' && S.cfg.wip && L.length > S.cfg.wip;
      return `<div class="col" data-drop="${s.id}"><h4>${stIc(s.id)} ${s.nome} <span style="color:var(--mut)">${L.length}</span>${wip ? `<span class="chip warn" title="Limite de trabalho em andamento (WIP) = ${S.cfg.wip}">WIP acima do limite</span>` : ''}</h4>${L.map(cartaoIssue).join('')}</div>`;
    }).join('')}</div>`;
  }
  const g = ui.group;
  if (g === 'nenhum') return barra + `<div>${lista.map(linhaIssue).join('')}</div>`;
  const grupos = g === 'status' ? STATUS.map((s) => [s.id, s.nome, stIc(s.id)])
    : g === 'prio' ? PRIO.map((p) => [p.id, p.nome, prIc(p.id)])
    : g === 'resp' ? [...S.users.map((u) => [u.id, u.nome, avatar(u.id)]), ['', 'Sem responsável', avatar('')]]
    : [...S.projects.map((p) => [p.id, p.nome, '▣']), ['', 'Sem projeto', '▢']];
  const chave = (i) => (g === 'status' ? i.status : g === 'prio' ? i.prio : g === 'resp' ? i.resp || '' : i.projeto || '');
  return barra + grupos.map(([id, nome, ic]) => {
    const L = lista.filter((i) => chave(i) === id);
    return L.length ? `<div class="group-h">${ic} ${esc(nome)} <span class="n">${L.length}</span></div>${L.map(linhaIssue).join('')}` : '';
  }).join('');
}

/* ---------- páginas ---------- */
const top = (titulo, acoes = '') => `<div class="top"><h1>${titulo}</h1>${acoes}<button class="btn pri" data-act="nova">+ Nova tarefa</button></div>`;

function pgInbox() {
  const h = hoje(); const itens = [];
  S.issues.filter((i) => aberta(i) && (i.resp === S.me)).forEach((i) => {
    if (vencida(i)) itens.push({ k: `v:${i.id}:${i.prazo}`, i, t: `Atrasada desde ${br(i.prazo)}`, c: 'bad' });
    else if (i.prazo && difDias(h, i.prazo) <= 3) itens.push({ k: `d:${i.id}:${i.prazo}`, i, t: `Vence em ${difDias(h, i.prazo)} dia(s)`, c: 'warn' });
    if (bloqueada(i)) itens.push({ k: `b:${i.id}`, i, t: 'Bloqueada por dependência aberta', c: 'bad' });
  });
  const n = itens.filter((x) => !S.lidos.includes(x.k)).length;
  return top('Caixa de entrada', `<button class="btn" data-act="lidos">Marcar tudo como lido (${n})</button>`) +
    (itens.length ? itens.map((x) => `<div class="row ${S.lidos.includes(x.k) ? '' : 'unread'}" data-act="abrir" data-id="${x.i.id}">${stIc(x.i.status)}<span class="id">${esc(ident(x.i))}</span><span class="t">${esc(x.i.titulo)}</span><span class="chip ${x.c}">${x.t}</span></div>`).join('') : '<div class="empty">Tudo em dia. Nenhum alerta.</div>');
}

function pgMinhas() { return top('Minhas tarefas') + painel(S.issues.filter((i) => i.resp === S.me), 'minhas'); }
function pgTodas() { return top('Todas as tarefas') + painel(S.issues, 'todas'); }

function pgPulso() {
  const h = hoje(); const abertas = S.issues.filter(aberta);
  const fechadas7 = S.issues.filter((i) => i.concluidoEm && difDias(i.concluidoEm, h) <= 7 && difDias(i.concluidoEm, h) >= 0);
  const lead = S.issues.filter((i) => i.concluidoEm && i.criado);
  const ciclo = S.issues.filter((i) => i.concluidoEm && i.iniciadoEm).map((i) => Math.max(0, difDias(i.iniciadoEm, i.concluidoEm)));
  const med = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—');
  const dias = Array.from({ length: 14 }, (_, k) => addDias(h, k - 13));
  const vaz = dias.map((d) => S.issues.filter((i) => i.concluidoEm === d).length);
  const max = Math.max(1, ...vaz);
  const svg = `<svg viewBox="0 0 280 90" width="100%" role="img" aria-label="Tarefas concluídas por dia, 14 dias">${vaz.map((v, k) => `<rect x="${k * 20 + 2}" y="${70 - (60 * v) / max}" width="16" height="${(60 * v) / max}" rx="3" fill="var(--acc)"/><text x="${k * 20 + 10}" y="84" text-anchor="middle">${dias[k].slice(8)}</text>`).join('')}</svg>`;
  const emAnd = S.issues.filter((i) => i.status === 'andamento').length;
  return top('Pulso') + `<div class="grid">
    <div class="card"><div class="kpi">${abertas.length}<small>tarefas abertas</small></div></div>
    <div class="card"><div class="kpi">${fechadas7.length}<small>concluídas em 7 dias (vazão)</small></div></div>
    <div class="card"><div class="kpi">${med(ciclo)} d<small>tempo de ciclo médio (início → fim)</small></div></div>
    <div class="card"><div class="kpi">${emAnd}${S.cfg.wip ? ` / ${S.cfg.wip}` : ''}<small>em andamento (WIP)</small></div></div>
    <div class="card"><div class="kpi" style="color:var(--bad)">${S.issues.filter(vencida).length}<small>atrasadas</small></div></div>
    <div class="card"><div class="kpi">${S.issues.filter((i) => aberta(i) && bloqueada(i)).length}<small>bloqueadas</small></div></div></div>
    <div class="card"><h3>Vazão — concluídas por dia (14 dias)</h3>${svg}<small style="color:var(--mut)">Lead time médio: ${med(lead.map((i) => Math.max(0, difDias(i.criado.slice(0, 10), i.concluidoEm))))} dias</small></div>
    <div class="card"><h3>Atividade recente</h3>${S.atividade.slice(0, 15).map((a) => `<div class="chk"><span style="color:var(--mut);font-size:12px;width:92px;flex:none">${new Date(a.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>${esc(a.txt)}</div>`).join('')}</div>`;
}

function pgFavoritos() {
  const f = [...S.projects.filter((p) => p.fav).map((p) => `<div class="row" data-act="ir" data-v="#/projeto/${p.id}">▣ <span class="t">${esc(p.nome)}</span></div>`),
    ...S.views.filter((v) => v.fav).map((v) => `<div class="row" data-act="ir" data-v="#/visao/${v.id}">◫ <span class="t">${esc(v.nome)}</span></div>`),
    ...S.issues.filter((i) => i.fav).map(linhaIssue)];
  return top('Favoritos') + (f.length ? f.join('') : '<div class="empty">Marque projetos, visões ou tarefas com ★ para vê-los aqui.</div>');
}

function pgProjetos() {
  const grupos = PSTATUS.map((s) => [s, S.projects.filter((p) => p.status === s.id)]).filter(([, l]) => l.length);
  return top('Projetos', '<button class="btn" data-act="novo-proj">+ Novo projeto</button>') +
    (grupos.length ? grupos.map(([s, l]) => `<div class="group-h">${s.nome} <span class="n">${l.length}</span></div>${l.map((p) => {
      const sa = saude(p); const pr = progresso(p.id);
      return `<div class="row" data-act="ir" data-v="#/projeto/${p.id}">${prIc(p.prio)}<span class="t"><strong>${esc(p.nome)}</strong><br><small style="color:var(--mut)">${esc(p.descricao)}</small></span>
        <span class="chip ${sa.c}">${sa.t}</span><span class="chip hide-m">${br(p.prazo)}</span>${avatar(p.lider)}<span style="width:90px">${bar(pr)}</span><span style="width:34px;text-align:right">${pr}%</span></div>`;
    }).join('')}`).join('') : '<div class="empty">Nenhum projeto ainda.</div>');
}

function pgProjeto(id, aba) {
  const p = proj(id); if (!p) return top('Projeto não encontrado');
  const a = aba || 'visao'; const sa = saude(p); const pr = progresso(p.id);
  const L = S.issues.filter((i) => i.projeto === p.id);
  const tabs = `<div class="tabs">${[['visao', 'Visão geral'], ['atividade', 'Atividade'], ['tarefas', `Tarefas (${L.length})`]].map(([k, n]) => `<a href="#/projeto/${p.id}/${k}" class="${a === k ? 'on' : ''}">${n}</a>`).join('')}</div>`;
  let corpo = '';
  if (a === 'tarefas') corpo = painel(L, `proj:${p.id}`, { fixos: [] });
  else if (a === 'atividade') {
    const ids = new Set(L.map(ident));
    const ev = S.atividade.filter((x) => [...ids].some((k) => x.txt.startsWith(k)));
    corpo = ev.length ? ev.map((x) => `<div class="chk"><span style="color:var(--mut);width:110px;flex:none;font-size:12px">${new Date(x.ts).toLocaleString('pt-BR')}</span>${esc(x.txt)}</div>`).join('') : '<div class="empty">Sem atividade registrada.</div>';
  } else {
    const por = STATUS.map((s) => [s, L.filter((i) => i.status === s.id).length]);
    corpo = `<div class="card"><div class="f">
      <label>Status<select data-p="${p.id}:status">${opts(PSTATUS.map((s) => [s.id, s.nome]), p.status)}</select></label>
      <label>Prioridade<select data-p="${p.id}:prio">${prOpts(p.prio)}</select></label>
      <label>Líder<select data-p="${p.id}:lider">${userOpts(p.lider, 'Sem líder')}</select></label>
      <label>Início<input type="date" data-p="${p.id}:inicio" value="${esc(p.inicio)}"></label>
      <label>Meta (prazo)<input type="date" data-p="${p.id}:prazo" value="${esc(p.prazo)}"></label>
      <label class="wide">Descrição<textarea rows="3" data-p="${p.id}:descricao">${esc(p.descricao)}</textarea></label></div></div>
      <div class="card"><h3>Progresso ${pr}% <span class="chip ${sa.c}">${sa.t}</span></h3>${bar(pr)}
      <p style="color:var(--mut)">${S.cfg.progresso === 'pontos' ? 'Calculado por pontos de estimativa (tarefas sem estimativa valem 1).' : 'Calculado pela contagem de tarefas.'} Tarefas canceladas não entram.</p>
      <table><tr>${por.map(([s, n]) => `<th>${s.nome}</th>`).join('')}</tr><tr>${por.map(([, n]) => `<td>${n}</td>`).join('')}</tr></table></div>`;
  }
  return `<div class="top"><h1>${esc(p.nome)}</h1><button class="btn" data-act="fav-proj" data-id="${p.id}">${p.fav ? '★' : '☆'} Favorito</button><button class="btn danger" data-act="del-proj" data-id="${p.id}">Excluir</button><button class="btn pri" data-act="nova" data-proj="${p.id}">+ Nova tarefa</button></div>${tabs}${corpo}`;
}

function pgVisoes() {
  return top('Visões', '') + (S.views.length ? S.views.map((v) => `<div class="row" data-act="ir" data-v="#/visao/${v.id}">◫ <span class="t">${esc(v.nome)}</span><span class="chip">${filtrar(S.issues, v.f).length} tarefas</span><button class="btn sm ghost" data-act="del-visao" data-id="${v.id}">Excluir</button></div>`).join('') : '<div class="empty">Salve filtros como visões a partir de qualquer lista de tarefas.</div>') +
    '<p><a href="#/todas">Ver todas as tarefas</a></p>';
}
function pgVisao(id) {
  const v = S.views.find((x) => x.id === id); if (!v) return top('Visão não encontrada');
  return `<div class="top"><h1>◫ ${esc(v.nome)}</h1><button class="btn" data-act="fav-visao" data-id="${v.id}">${v.fav ? '★' : '☆'}</button><button class="btn pri" data-act="nova">+ Nova tarefa</button></div>` + painel(filtrar(S.issues, v.f), `visao:${v.id}`);
}

function burndown(c) {
  const L = S.issues.filter((i) => i.ciclo === c.id && i.status !== 'cancelada');
  const tot = L.reduce((a, i) => a + (i.est || 1), 0);
  const n = Math.max(1, difDias(c.inicio, c.fim));
  const h = hoje(); const W = 300; const H = 120;
  const x = (k) => 20 + (k * (W - 30)) / n; const y = (v) => 10 + (H - 30) * (1 - (tot ? v / tot : 0));
  const real = []; for (let k = 0; k <= n; k++) { const d = addDias(c.inicio, k); if (d > h) break; real.push([x(k), y(tot - L.filter((i) => i.concluidoEm && i.concluidoEm <= d).reduce((a, i) => a + (i.est || 1), 0))]); }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gráfico de burndown"><line x1="20" y1="${y(0)}" x2="${W - 10}" y2="${y(0)}" stroke="var(--line)"/>
    <polyline fill="none" stroke="var(--mut)" stroke-dasharray="4" points="${x(0)},${y(tot)} ${x(n)},${y(0)}"/>
    <polyline fill="none" stroke="var(--acc)" stroke-width="2" points="${real.map((p) => p.join(',')).join(' ')}"/>
    <text x="2" y="${y(tot) + 3}">${tot}</text><text x="2" y="${y(0) + 3}">0</text><text x="20" y="${H - 4}">${br(c.inicio).slice(0, 5)}</text><text x="${W - 30}" y="${H - 4}">${br(c.fim).slice(0, 5)}</text></svg>`;
}
function pgCiclos() {
  const h = hoje();
  return top('Ciclos (sprints)', '<button class="btn" data-act="novo-ciclo">+ Novo ciclo</button>') +
    (S.ciclos.length ? S.ciclos.slice().sort((a, b) => b.inicio.localeCompare(a.inicio)).map((c) => {
      const L = S.issues.filter((i) => i.ciclo === c.id); const ok = L.filter((i) => i.status === 'concluida').length;
      const pts = L.reduce((a, i) => a + (i.est || 0), 0); const ptsOk = L.filter((i) => i.status === 'concluida').reduce((a, i) => a + (i.est || 0), 0);
      const est = c.inicio <= h && h <= c.fim ? 'Ativo' : h < c.inicio ? 'Futuro' : 'Encerrado';
      return `<div class="card"><h3>${esc(c.nome)} <span class="chip ${est === 'Ativo' ? 'ok' : ''}">${est}</span> <span class="chip">${br(c.inicio)} – ${br(c.fim)}</span>
        <button class="btn sm ghost danger" data-act="del-ciclo" data-id="${c.id}">Excluir</button></h3>
        <div class="grid"><div>${burndown(c)}<small style="color:var(--mut)">Linha tracejada = ideal. Azul = real.</small></div>
        <div><div class="kpi">${ok}/${L.length}<small>tarefas concluídas</small></div><div class="kpi">${ptsOk}/${pts}<small>pontos entregues (velocidade)</small></div></div></div>
        ${L.map(linhaIssue).join('')}</div>`;
    }).join('') : '<div class="empty">Crie ciclos de 1–4 semanas e atribua tarefas a eles.</div>');
}

function pgEquipes() {
  return top('Equipes') + `<div class="card"><h3>${esc(S.equipe.nome)} <span class="chip">${esc(S.equipe.chave)}</span></h3>
    <table><tr><th>Membro</th><th>Abertas</th><th>Em andamento</th><th>Concluídas</th></tr>${S.users.map((u) => {
      const L = S.issues.filter((i) => i.resp === u.id);
      return `<tr><td>${avatar(u.id)} ${esc(u.nome)}</td><td>${L.filter(aberta).length}</td><td>${L.filter((i) => i.status === 'andamento').length}</td><td>${L.filter((i) => i.status === 'concluida').length}</td></tr>`;
    }).join('')}</table>
    <p><button class="btn" data-act="novo-membro">+ Adicionar membro</button> <a href="#/todas">Todas as tarefas da equipe</a></p></div>`;
}

function pgConfig() {
  return top('Configurações') + `<div class="card"><h3>Preferências</h3><div class="f">
    <label>Tema<select data-c="tema">${opts([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']], S.cfg.tema)}</select></label>
    <label>Limite WIP (em andamento, 0 = sem limite)<input type="number" min="0" data-c="wip" value="${S.cfg.wip}"></label>
    <label>Progresso do projeto por<select data-c="progresso">${opts([['pontos', 'Pontos de estimativa'], ['contagem', 'Contagem de tarefas']], S.cfg.progresso)}</select></label>
    <label>Equipe<input data-c="eq-nome" value="${esc(S.equipe.nome)}"></label>
    <label>Chave dos identificadores<input data-c="eq-chave" maxlength="5" value="${esc(S.equipe.chave)}"></label></div></div>
    <div class="card"><h3>Dados</h3><p style="color:var(--mut)">Tudo fica salvo apenas neste navegador. Exporte para fazer backup ou levar para outro dispositivo.</p>
    <button class="btn" data-act="exp-json">Exportar JSON</button> <button class="btn" data-act="exp-csv">Exportar tarefas (CSV)</button>
    <label class="btn">Importar JSON<input type="file" accept="application/json" data-import hidden></label>
    <button class="btn danger" data-act="limpar">Limpar tudo</button> <button class="btn" data-act="demo">Restaurar dados de exemplo</button></div>
    <p style="color:var(--mut)">Fluxo é software livre sob licença Apache-2.0. Veja README.md e LICENSE.</p>`;
}

/* ---------- roteamento ---------- */
const NAV = [['#/inbox', '📥', 'Caixa de entrada'], ['#/minhas', '🎯', 'Minhas tarefas'], ['#/pulso', '⚡', 'Pulso'], ['#/favoritos', '☆', 'Favoritos'], ['#/projetos', '▣', 'Projetos'], ['#/ciclos', '⟳', 'Ciclos'], ['#/visoes', '◫', 'Visões'], ['#/equipes', '👥', 'Equipes'], ['#/config', '⚙', 'Configurações']];
function rota() { const p = (location.hash || '#/inbox').split('/'); return { base: p[1] || 'inbox', id: p[2], aba: p[3] }; }
function inboxN() { const h = hoje(); return S.issues.filter((i) => aberta(i) && i.resp === S.me && ((i.prazo && difDias(h, i.prazo) <= 3) || bloqueada(i))).length; }
function render() {
  save();
  document.documentElement.dataset.theme = S.cfg.tema === 'auto' ? '' : S.cfg.tema;
  const r = rota();
  const pag = { inbox: pgInbox, minhas: pgMinhas, todas: pgTodas, pulso: pgPulso, favoritos: pgFavoritos, projetos: pgProjetos, ciclos: pgCiclos, visoes: pgVisoes, equipes: pgEquipes, config: pgConfig }[r.base];
  const html = r.base === 'projeto' ? pgProjeto(r.id, r.aba) : r.base === 'visao' ? pgVisao(r.id) : (pag || pgInbox)();
  const cur = `#/${r.base === 'projeto' ? 'projetos' : r.base === 'visao' ? 'visoes' : r.base}`;
  const keep = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.f;
  const pos = keep ? document.activeElement.selectionStart : 0;
  $('#app').innerHTML = `<div class="shell"><nav class="side" aria-label="Principal"><div class="brand"><span class="logo">F</span> Fluxo</div>
    <button class="nav" data-act="paleta"><span>🔍</span> Buscar <span class="n">Ctrl K</span></button>
    ${NAV.map(([h, ic, n]) => `<a class="nav ${cur === h ? 'on' : ''}" href="${h}"><span>${ic}</span> ${n}${h === '#/inbox' && inboxN() ? `<span class="n">${inboxN()}</span>` : ''}</a>`).join('')}
    <h6>Favoritos</h6>${S.projects.filter((p) => p.fav).map((p) => `<a class="nav hide-m" href="#/projeto/${p.id}">▣ ${esc(p.nome.slice(0, 24))}</a>`).join('')}</nav>
    <main class="main">${S.demo ? '<div class="chip warn" style="margin-top:10px">Dados de exemplo — edite à vontade ou use Configurações › Limpar tudo</div>' : ''}${html}</main></div>`;
  if (keep) { const el = document.querySelector(`[data-f="${keep}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* select */ } } }
  renderModal();
}

/* ---------- modais ---------- */
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 1800); }
function fechar() { ui.modal = null; ui.draft = null; $('#modal-root').innerHTML = ''; }
function renderModal() {
  const root = $('#modal-root'); const m = ui.modal;
  if (!m) { root.innerHTML = ''; return; }
  if (m === 'issue') {
    const d = ui.draft; const novo = !d._existe;
    root.innerHTML = `<div class="modal-bg" data-act="fundo"><div class="modal" role="dialog" aria-modal="true" aria-label="Tarefa">
      <input class="title-in" data-d="titulo" placeholder="Título da tarefa" value="${esc(d.titulo)}" autofocus>
      <div class="f"><label class="wide">Descrição<textarea rows="3" data-d="descricao" placeholder="Contexto, critérios de aceite…">${esc(d.descricao)}</textarea></label>
      <label>Status<select data-d="status">${stOpts(d.status)}</select></label>
      <label>Prioridade<select data-d="prio">${prOpts(d.prio)}</select></label>
      <label>Responsável<select data-d="resp">${userOpts(d.resp, 'Sem responsável')}</select></label>
      <label>Projeto<select data-d="projeto">${projOpts(d.projeto, 'Sem projeto')}</select></label>
      <label>Ciclo<select data-d="ciclo">${cicloOpts(d.ciclo, 'Sem ciclo')}</select></label>
      <label>Prazo<input type="date" data-d="prazo" value="${esc(d.prazo)}"></label>
      <label>Estimativa (pontos)<select data-d="est">${opts([0, 1, 2, 3, 5, 8, 13].map((n) => [n, n || 'Sem estimativa']), d.est)}</select></label>
      <label>Etiquetas (separadas por vírgula)<input data-d="labels" value="${esc(d.labels.join(', '))}"></label>
      <label class="wide">Bloqueada por<select data-d="bloq" multiple size="3">${S.issues.filter((i) => i.id !== d.id).map((i) => `<option value="${i.id}"${d.bloqueadaPor.includes(i.id) ? ' selected' : ''}>${esc(ident(i))} — ${esc(i.titulo)}</option>`).join('')}</select></label></div>
      <h3 style="font-size:14px">Checklist</h3>${d.checklist.map((c, k) => `<div class="chk"><input type="checkbox" data-ck="${k}" ${c.ok ? 'checked' : ''}> <span>${esc(c.t)}</span> <button class="btn sm ghost" data-act="ck-del" data-k="${k}" aria-label="Remover">✕</button></div>`).join('')}
      <div class="chk"><input data-new="ck" placeholder="Novo item (Enter)" style="flex:1;border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:5px 8px"></div>
      ${novo ? '' : `<h3 style="font-size:14px">Comentários</h3>${d.comentarios.map((c) => `<div class="cm"><small>${esc(c.autor)} · ${new Date(c.ts).toLocaleString('pt-BR')}</small><div>${esc(c.t)}</div></div>`).join('')}
      <div class="chk"><input data-new="cm" placeholder="Comentar (Enter)" style="flex:1;border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:5px 8px"></div>`}
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn pri" data-act="salvar">${novo ? 'Criar tarefa' : 'Salvar'}</button><button class="btn" data-act="cancelar">Cancelar</button>
      ${novo ? '' : `<button class="btn" data-act="fav-issue">${d.fav ? '★' : '☆'}</button><button class="btn danger" style="margin-left:auto" data-act="del-issue">Excluir</button>`}</div></div></div>`;
  } else if (m === 'paleta') {
    const q = ui.pal.toLowerCase();
    const ac = [['Nova tarefa', 'nova'], ['Ir para Projetos', '#/projetos'], ['Ir para Minhas tarefas', '#/minhas'], ['Ir para Pulso', '#/pulso'], ['Ir para Ciclos', '#/ciclos']].filter(([n]) => n.toLowerCase().includes(q));
    const is = q ? S.issues.filter((i) => (ident(i) + ' ' + i.titulo).toLowerCase().includes(q)).slice(0, 8) : [];
    const ps = q ? S.projects.filter((p) => p.nome.toLowerCase().includes(q)).slice(0, 4) : [];
    root.innerHTML = `<div class="modal-bg" data-act="fundo"><div class="modal palette" role="dialog" aria-label="Busca"><input data-pal placeholder="Buscar tarefas, projetos ou ações…" value="${esc(ui.pal)}" autofocus>
      ${ac.map(([n, v]) => `<div class="pal-i" data-act="pal" data-v="${v}">⏎ ${n}</div>`).join('')}
      ${ps.map((p) => `<div class="pal-i" data-act="pal" data-v="#/projeto/${p.id}">▣ ${esc(p.nome)}</div>`).join('')}
      ${is.map((i) => `<div class="pal-i" data-act="pal" data-v="issue:${i.id}">${stIc(i.status)} ${esc(ident(i))} ${esc(i.titulo)}</div>`).join('')}</div></div>`;
  } else if (m.form) {
    root.innerHTML = `<div class="modal-bg" data-act="fundo"><form class="modal" data-form="${m.form}"><h2>${m.titulo}</h2><div class="f">${m.campos}</div>
      <div style="display:flex;gap:8px"><button class="btn pri" type="submit">Criar</button><button class="btn" type="button" data-act="cancelar">Cancelar</button></div></form></div>`;
  }
  const af = root.querySelector('[autofocus]'); if (af) { af.focus(); const l = af.value.length; try { af.setSelectionRange(l, l); } catch (e) { /* tipo */ } }
}
function abrirIssue(id, preset = {}) {
  const i = id ? issue(id) : null;
  ui.draft = i ? { ...JSON.parse(JSON.stringify(i)), _existe: true }
    : { id: uid(), titulo: '', descricao: '', status: 'afazer', prio: 0, resp: S.me, projeto: null, ciclo: null, prazo: '', est: 0, labels: [], checklist: [], bloqueadaPor: [], comentarios: [], ...preset };
  ui.modal = 'issue'; renderModal();
}
function salvarIssue() {
  const d = ui.draft;
  if (!d.titulo.trim()) { toast('Informe um título'); return; }
  d.titulo = d.titulo.trim();
  if (d._existe) {
    const o = issue(d.id); const antes = { resp: o.resp, prio: o.prio, status: o.status };
    const { _existe, ...rest } = d; Object.assign(o, rest, { status: antes.status });
    setStatus(o, d.status);
    if (antes.resp !== o.resp) log(`${ident(o)}: responsável → ${user(o.resp)?.nome || 'ninguém'}`);
    if (antes.prio !== o.prio) log(`${ident(o)}: prioridade → ${prOf(o.prio).nome}`);
    o.atualizado = iso();
  } else {
    const { _existe, ...rest } = d; const st = rest.status; rest.status = 'backlog';
    S.seq += 1; const n = { ...rest, num: S.seq, criado: iso(), atualizado: iso(), iniciadoEm: '', concluidoEm: '' };
    S.issues.push(n); setStatus(n, st === 'backlog' ? 'x' : st); if (st === 'backlog') n.status = 'backlog';
    log(`${ident(n)} “${n.titulo}” criada`);
  }
  S.demo = false; save(); fechar(); render(); toast('Salvo');
}
function abrirForm(form, titulo, campos) { ui.modal = { form, titulo, campos }; renderModal(); }

/* ---------- ações ---------- */
function exportar(nome, txt, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: tipo })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
const A = {
  abrir: (e) => abrirIssue(e.dataset.id),
  nova: (e) => abrirIssue(null, e.dataset.proj ? { projeto: e.dataset.proj } : {}),
  ir: (e) => { location.hash = e.dataset.v; },
  modo: (e) => { ui.mode = e.dataset.v; render(); },
  lidos: () => { const h = hoje(); S.issues.filter((i) => aberta(i) && i.resp === S.me).forEach((i) => { S.lidos.push(`v:${i.id}:${i.prazo}`, `d:${i.id}:${i.prazo}`, `b:${i.id}`); }); save(); render(); },
  fundo: (e, ev) => { if (ev.target === e) { fechar(); } },
  cancelar: () => fechar(),
  salvar: () => salvarIssue(),
  'ck-del': (e) => { ui.draft.checklist.splice(Number(e.dataset.k), 1); renderModal(); },
  'del-issue': () => { if (confirm('Excluir esta tarefa?')) { S.issues = S.issues.filter((i) => i.id !== ui.draft.id); S.issues.forEach((i) => { i.bloqueadaPor = i.bloqueadaPor.filter((b) => b !== ui.draft.id); }); save(); fechar(); render(); } },
  'fav-issue': () => { ui.draft.fav = !ui.draft.fav; renderModal(); },
  paleta: () => { ui.pal = ''; ui.modal = 'paleta'; renderModal(); },
  pal: (e) => { const v = e.dataset.v; fechar(); if (v === 'nova') abrirIssue(); else if (v.startsWith('issue:')) abrirIssue(v.slice(6)); else location.hash = v; },
  'novo-proj': () => abrirForm('proj', 'Novo projeto', `<label class="wide">Nome<input name="nome" required autofocus></label><label class="wide">Descrição<textarea name="descricao" rows="2"></textarea></label><label>Meta (prazo)<input type="date" name="prazo"></label><label>Prioridade<select name="prio">${prOpts(3)}</select></label>`),
  'novo-ciclo': () => abrirForm('ciclo', 'Novo ciclo', `<label class="wide">Nome<input name="nome" required autofocus value="Ciclo ${S.ciclos.length + 1}"></label><label>Início<input type="date" name="inicio" required value="${hoje()}"></label><label>Fim<input type="date" name="fim" required value="${addDias(hoje(), 13)}"></label>`),
  'novo-membro': () => abrirForm('membro', 'Novo membro', '<label class="wide">Nome<input name="nome" required autofocus></label>'),
  'fav-proj': (e) => { const p = proj(e.dataset.id); p.fav = !p.fav; save(); render(); },
  'fav-visao': (e) => { const v = S.views.find((x) => x.id === e.dataset.id); v.fav = !v.fav; save(); render(); },
  'del-proj': (e) => { if (confirm('Excluir o projeto? As tarefas ficarão sem projeto.')) { S.issues.forEach((i) => { if (i.projeto === e.dataset.id) i.projeto = null; }); S.projects = S.projects.filter((p) => p.id !== e.dataset.id); save(); location.hash = '#/projetos'; render(); } },
  'del-ciclo': (e, ev) => { ev.stopPropagation(); if (confirm('Excluir o ciclo?')) { S.issues.forEach((i) => { if (i.ciclo === e.dataset.id) i.ciclo = null; }); S.ciclos = S.ciclos.filter((c) => c.id !== e.dataset.id); save(); render(); } },
  'del-visao': (e, ev) => { ev.stopPropagation(); S.views = S.views.filter((v) => v.id !== e.dataset.id); save(); render(); },
  'salvar-visao': (e) => { const f = { ...(ui.f[e.dataset.key] || {}) }; const nome = prompt('Nome da visão:'); if (nome) { S.views.push({ id: uid(), nome, f, fav: false }); save(); toast('Visão salva'); render(); } },
  'exp-json': () => exportar(`fluxo-${hoje()}.json`, JSON.stringify(S, null, 2), 'application/json'),
  'exp-csv': () => {
    const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['id', 'titulo', 'status', 'prioridade', 'responsavel', 'projeto', 'ciclo', 'prazo', 'estimativa', 'etiquetas', 'criado', 'concluido']];
    S.issues.forEach((i) => rows.push([ident(i), i.titulo, stOf(i.status).nome, prOf(i.prio).nome, user(i.resp)?.nome, proj(i.projeto)?.nome, S.ciclos.find((x) => x.id === i.ciclo)?.nome, i.prazo, i.est, i.labels.join(';'), i.criado.slice(0, 10), i.concluidoEm]));
    exportar(`tarefas-${hoje()}.csv`, '﻿' + rows.map((r) => r.map(c).join(',')).join('\n'), 'text/csv');
  },
  limpar: () => { if (confirm('Apagar TODOS os dados deste navegador?')) { S = { ...seed(), demo: false, issues: [], projects: [], ciclos: [], views: [], atividade: [], seq: 0 }; save(); render(); } },
  demo: () => { if (confirm('Substituir tudo pelos dados de exemplo?')) { S = seed(); save(); render(); } },
};
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-act]'); if (!t) return;
  const f = A[t.dataset.act]; if (f) f(t, ev);
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.f) { const [k, c] = t.dataset.f.split(/:(?=[^:]*$)/); (ui.f[k] ||= {})[c] = t.value; if (t.tagName === 'INPUT') render(); return; }
  if (t.dataset.d === 'titulo' || t.dataset.d === 'descricao' || t.dataset.d === 'labels') {
    ui.draft[t.dataset.d] = t.dataset.d === 'labels' ? t.value.split(',').map((x) => x.trim()).filter(Boolean) : t.value;
  }
  if (t.dataset.pal !== undefined) { ui.pal = t.value; const p = t.selectionStart; renderModal(); const n = $('[data-pal]'); n.focus(); n.setSelectionRange(p, p); }
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset.f) { const [k, c] = t.dataset.f.split(/:(?=[^:]*$)/); (ui.f[k] ||= {})[c] = t.value; render(); return; }
  if (t.dataset.g) { ui.group = t.value; render(); return; }
  if (t.dataset.ck !== undefined) { ui.draft.checklist[Number(t.dataset.ck)].ok = t.checked; return; }
  if (t.dataset.d) {
    const k = t.dataset.d; const v = t.value;
    if (k === 'bloq') ui.draft.bloqueadaPor = [...t.selectedOptions].map((o) => o.value);
    else if (k === 'prio' || k === 'est') ui.draft[k] = Number(v);
    else if (['projeto', 'ciclo', 'resp'].includes(k)) ui.draft[k] = v || null;
    else if (k !== 'titulo' && k !== 'descricao' && k !== 'labels') ui.draft[k] = v;
    return;
  }
  if (t.dataset.p) { const [id, c] = t.dataset.p.split(':'); const p = proj(id); p[c] = c === 'prio' ? Number(t.value) : t.value; save(); render(); return; }
  if (t.dataset.c) {
    const c = t.dataset.c;
    if (c === 'tema') S.cfg.tema = t.value; else if (c === 'wip') S.cfg.wip = Math.max(0, Number(t.value) || 0);
    else if (c === 'progresso') S.cfg.progresso = t.value; else if (c === 'eq-nome') S.equipe.nome = t.value || S.equipe.nome;
    else if (c === 'eq-chave') S.equipe.chave = (t.value || 'GE').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GE';
    save(); render(); return;
  }
  if (t.dataset.import !== undefined && t.files[0]) {
    t.files[0].text().then((x) => { try { const j = JSON.parse(x); if (!j.issues || !j.projects) throw new Error(); S = j; save(); render(); toast('Importado'); } catch (e) { toast('Arquivo inválido'); } });
  }
});
document.addEventListener('keydown', (ev) => {
  const t = ev.target; const dig = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); A.paleta(); return; }
  if (ev.key === 'Escape' && ui.modal) { fechar(); return; }
  if (ev.key === 'Enter' && t.dataset.new) {
    ev.preventDefault(); const v = t.value.trim(); if (!v) return;
    if (t.dataset.new === 'ck') ui.draft.checklist.push({ t: v, ok: false });
    else ui.draft.comentarios.push({ t: v, ts: iso(), autor: user(S.me)?.nome || 'Você' });
    renderModal(); return;
  }
  if (ev.key === 'Enter' && t.dataset.pal !== undefined) { const p = $('.pal-i'); if (p) p.click(); return; }
  if (!dig && !ui.modal && !ev.ctrlKey && !ev.metaKey && ev.key === 'c') { ev.preventDefault(); abrirIssue(); }
});
document.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form]'); if (!f) return; ev.preventDefault();
  const d = Object.fromEntries(new FormData(f)); const k = f.dataset.form;
  if (k === 'proj') S.projects.push({ id: uid(), nome: d.nome, descricao: d.descricao, status: 'planejado', prio: Number(d.prio), lider: S.me, inicio: hoje(), prazo: d.prazo, fav: false });
  if (k === 'ciclo') { if (d.fim < d.inicio) { toast('Fim antes do início'); return; } S.ciclos.push({ id: uid(), nome: d.nome, inicio: d.inicio, fim: d.fim }); }
  if (k === 'membro') S.users.push({ id: uid(), nome: d.nome, cor: COR[S.users.length % COR.length] });
  S.demo = false; save(); fechar(); render();
});
/* arrastar e soltar no quadro */
document.addEventListener('dragstart', (ev) => { const c = ev.target.closest && ev.target.closest('.kcard'); if (c) { ev.dataTransfer.setData('text/plain', c.dataset.id); ev.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (ev) => { const c = ev.target.closest && ev.target.closest('[data-drop]'); if (c) { ev.preventDefault(); c.classList.add('over'); } });
document.addEventListener('dragleave', (ev) => { const c = ev.target.closest && ev.target.closest('[data-drop]'); if (c) c.classList.remove('over'); });
document.addEventListener('drop', (ev) => {
  const c = ev.target.closest && ev.target.closest('[data-drop]'); if (!c) return; ev.preventDefault();
  const i = issue(ev.dataTransfer.getData('text/plain')); if (i) { setStatus(i, c.dataset.drop); save(); render(); }
});
window.addEventListener('hashchange', render);
render();
})();
