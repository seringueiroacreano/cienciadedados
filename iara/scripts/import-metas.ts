/**
 * Importa os datasets brutos (data/raw/*.csv + src/data/iara-unidades.json) para o Supabase.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run scripts/import-metas.ts
 *
 * Requer a service role key (não a publishable key) porque grava em massa,
 * ignorando RLS. Rode as migrations em supabase/migrations antes de importar.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const BATCH = 1000;

function parseCsv(filePath: string): Record<string, string>[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = lines[0].split(";");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = cols[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}

async function insertBatches(table: string, rows: any[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`Erro inserindo em ${table} (lote ${i}-${i + chunk.length}):`, error.message);
      process.exit(1);
    }
    process.stdout.write(`\r${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  console.log();
}

async function importMetaFile(file: string, table: string) {
  console.log(`Lendo ${file}…`);
  const rows = parseCsv(path.join(ROOT, "data/raw", file));
  const mapped = rows.map((r) => ({
    id_processo: r.id_processo ? Number(r.id_processo) : null,
    grau: r.grau,
    classe: r.classe || null,
    nome_natureza: r.nome_natureza || null,
    id_orgao_julgador: r.id_orgao_julgador ? Number(r.id_orgao_julgador) : null,
    nome_orgao_julgador: r.nome_orgao_julgador || null,
    nome_municipio: r.nome_municipio || null,
    flg_juizo_100_digital: r.flg_juizo_100_digital || null,
    dt_evento: r.dt_evento ? r.dt_evento.slice(0, 10) : null,
    var: r.var,
    sistema: r.sistema || null,
  })).filter((r) => r.dt_evento && r.var && r.grau);
  await insertBatches(table, mapped);
}

async function importUnidades() {
  const raw = readFileSync(path.join(ROOT, "src/data/iara-unidades.json"), "utf-8");
  const list = JSON.parse(raw) as { unidade: string; grau: string; arquivos: string }[];
  const mapped = list
    .filter((u) => u.unidade)
    .map((u) => ({ unidade: u.unidade, grau: u.grau, arquivos: Number(u.arquivos) || 0 }));
  await insertBatches("iara_unidades_judiciais", mapped);
}

async function main() {
  await importUnidades();
  await importMetaFile("meta_01.csv", "iara_meta1_eventos");
  await importMetaFile("meta_02.csv", "iara_meta2_eventos");
  console.log("Importação concluída.");
}

main();
