// Testes do importador de planilhas.  Rode:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
require('../web/entidades.js');
const I = require('../web/importar.js');
const { ENT, MUNICIPIOS_AC } = globalThis.GAB;

// monta um .xlsx mínimo (ZIP com deflate) em memória
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(arquivos) {
  const partes = []; const central = []; let off = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const dados = Buffer.from(texto); const comp = zlib.deflateRawSync(dados); const n = Buffer.from(nome);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc32(dados), 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(dados.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc32(dados), 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(dados.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    partes.push(lh, n, comp); central.push(ch, n); off += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(central); const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(central.length / 2, 8); fim.writeUInt16LE(central.length / 2, 10);
  fim.writeUInt32LE(cd.length, 12); fim.writeUInt32LE(off, 16);
  const b = Buffer.concat([...partes, cd, fim]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}

test('lê XLSX no formato da exportação de aniversariantes', async () => {
  const s = ['Aniversariantes do dia', 'CIDADÃO', 'TELEFONE', 'DATA DE ANIVERSÁRIO', 'Maria da Silva', '68999998888', 'Nenhum aniversariante encontrado.'];
  const ss = `<sst>${s.map((x) => `<si><t>${x}</t></si>`).join('')}</sst>`;
  const sheet = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c></row>
    <row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c><c r="C3"><v>30000</v></c></row>
    <row r="4"><c r="A4" t="inlineStr"><is><t>João &amp; Cia</t></is></c><c r="B4"><v>6832241234</v></c><c r="C4" t="inlineStr"><is><t>05/03/1990</t></is></c></row>
    <row r="5"><c r="A5" t="s"><v>6</v></c></row></sheetData></worksheet>`;
  const buf = zip({
    'xl/workbook.xml': '<workbook><sheets><sheet name="worksheet" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': ss, 'xl/worksheets/sheet1.xml': sheet,
  });
  const [pl] = await I.lerXLSX(buf);
  assert.equal(pl.nome, 'worksheet');
  const ent = ENT.cidadaos;
  const cab = I.detectarCabecalho(pl.linhas, ent);
  assert.equal(cab, 1);
  const mapa = I.sugerirMapa(pl.linhas[cab], ent);
  assert.deepEqual(mapa, ['nome', 'telefone', 'nascimento']);
  const r = I.preparar(pl.linhas, cab, mapa, ent, MUNICIPIOS_AC);
  assert.equal(r.registros.length, 2);
  assert.equal(r.vazias, 1); // "Nenhum aniversariante encontrado." ignorado
  assert.deepEqual(r.registros[0].dados, { nome: 'Maria da Silva', telefone: '(68) 99999-8888', nascimento: '1982-02-18' });
  assert.equal(r.registros[1].dados.nome, 'João & Cia');
  assert.equal(r.registros[1].dados.nascimento, '1990-03-05');
});

test('CSV com ; aspas e acentos (Excel brasileiro)', () => {
  const txt = 'Secretaria/Ministério;Destino/Objeto;Valor;Status;Cidade\n"SESACRE";"Ambulância; UTI";"R$ 350.000,00";paga;rio branco\nSEE;Reforma;1000.5;Arquivada;Xapuri\n;Sem órgão;10;;';
  const linhas = I.lerCSV(txt);
  assert.equal(linhas[1][1], 'Ambulância; UTI');
  const ent = ENT.emendas;
  const mapa = I.sugerirMapa(linhas[0], ent);
  assert.deepEqual(mapa, ['orgao', 'objeto', 'valor', 'status', 'municipio']);
  const r = I.preparar(linhas, 0, mapa, ent, MUNICIPIOS_AC);
  assert.equal(r.registros.length, 2);
  assert.deepEqual(r.registros[0].dados, { orgao: 'SESACRE', objeto: 'Ambulância; UTI', valor: 350000, status: 'Paga', municipio: 'Rio Branco' });
  assert.equal(r.registros[1].dados.status, 'Arquivada / Não atendida');
  assert.equal(r.registros[1].dados.valor, 1000.5);
  assert.equal(r.erros.length, 1);
  assert.match(r.erros[0].msg, /Secretaria/);
});

test('conversões e validações', () => {
  const c = (t, v, extra = {}) => I.converter(v, { t, l: 'X', ...extra }, MUNICIPIOS_AC);
  assert.equal(c('cpf', '52998224725').v, '529.982.247-25');
  assert.equal(c('cpf', '111.111.111-11').v, null);
  assert.ok(c('cpf', '123').aviso);
  assert.equal(c('phone', '99999-8888').v, '(68) 99999-8888');
  assert.equal(c('phone', '+55 (68) 3224-1234').v, '(68) 3224-1234');
  assert.equal(c('date', '31/02/2020').v, null);
  assert.equal(c('date', '1/2/85').v, '1985-02-01');
  assert.equal(c('uf', 'Acre').v, 'AC');
  assert.equal(c('municipio', 'CRUZEIRO DO SUL').v, 'Cruzeiro do Sul');
  assert.equal(c('bool', 'X').v, true);
  assert.equal(c('money', 'R$ 1.234,56').v, 1234.56);
  assert.equal(c('tags', 'saúde; rural, saúde').v, 'saúde, rural');
  assert.equal(c('datetime', '17/11/2026 14:30').v, '2026-11-17T14:30:00-05:00');
});

test('texto em Windows-1252 é decodificado', () => {
  const bytes = new Uint8Array([0x4a, 0x6f, 0x73, 0x75, 0xe9]); // "Josué" em latin-1
  assert.equal(I.decodificar(bytes.buffer), 'Josué');
});
