/**
 * CLI.
 *
 *   node --experimental-strip-types ferramentas/cli.ts 2               → Ciclo 2 em Markdown
 *   node --experimental-strip-types ferramentas/cli.ts 2 --json        → Ciclo 2 em JSON
 *   node --experimental-strip-types ferramentas/cli.ts --check         → valida catálogo e simula 12 ciclos
 *   node --experimental-strip-types ferramentas/cli.ts --diff 2 3      → o que muda entre dois ciclos
 */

// O pacote de referência traz estes imports apontando para src-core/ (o layout do
// pacote). No repo o core instalado é src/core/ — reaponte após cada sincronização.
import { criarGerador } from "../src/core/gerador.ts";
import { METODOLOGIA_V1 } from "../src/core/metodologia.ts";
import { renderCiclo, renderJson } from "../src/core/render.ts";
const { gerarCiclo, validarCatalogo, validarSequencia, volumeSemanal, metodologia } = criarGerador(METODOLOGIA_V1);
const SLOTS = metodologia.slots;
const EXERCICIOS = metodologia.exercicios;

const argv = (globalThis as any).Deno?.args ?? process.argv.slice(2);
const log = console.log;

function check() {
  const erros = validarCatalogo();
  log(erros.length ? `Catálogo: ${erros.length} problema(s)` : "Catálogo: OK");
  for (const e of erros) log(`  - ${e}`);

  const vol = volumeSemanal();
  log(`\nVolume semanal (invariante): ${Object.entries(vol).map(([k, v]) => `${k}=${v}`).join(" · ")}`);

  log(`\nSimulando 12 ciclos:`);
  let totalAvisos = 0;
  const usos = new Map<string, number>();
  for (let c = 1; c <= 12; c++) {
    const ciclo = gerarCiclo(c);
    // Avisos do Ciclo 1 descrevem a ficha fixada, não escolha do gerador.
    const reais = ciclo.fixado ? [] : ciclo.avisos;
    totalAvisos += reais.length;
    log(`  Ciclo ${String(c).padStart(2)} · ${reais.length} aviso(s)${ciclo.fixado ? " (fixado)" : ""}`);
    for (const a of reais) log(`      ${a}`);
    for (const id of Object.values(ciclo.porSlot)) usos.set(id, (usos.get(id) ?? 0) + 1);
  }
  log(`\nTotal de avisos em ciclos gerados: ${totalAvisos}`);

  const seq = validarSequencia(12);
  log(seq.length ? `\nSequência (DD-03/DD-04): ${seq.length} problema(s)` : `\nSequência (DD-03/DD-04): OK`);
  for (const e of seq) log(`  - ${e}`);

  const noPool = new Set(SLOTS.flatMap((s) => s.pool));
  const nunca = [...noPool].filter((id) => !usos.has(id));
  log(`\nCobertura do catálogo em 12 ciclos: ${usos.size}/${noPool.size} exercícios usados.`);
  if (nunca.length) log(`  Nunca sorteados: ${nunca.map((id) => EXERCICIOS[id].nome).join(", ")}`);
}

function diff(a: number, b: number) {
  const ca = gerarCiclo(a), cb = gerarCiclo(b);
  log(`Ciclo ${a} → Ciclo ${b}\n`);
  let mudou = 0;
  for (const slot of SLOTS) {
    const x = ca.porSlot[slot.id], y = cb.porSlot[slot.id];
    if (x === y) continue;
    mudou++;
    const marca = slot.ancora ? " [Â]" : "";
    log(`  ${slot.id}${marca}  ${EXERCICIOS[x].nome}  →  ${EXERCICIOS[y].nome}`);
  }
  const total = SLOTS.length;
  log(`\n${mudou}/${total} slots alterados (${Math.round((mudou / total) * 100)}%).`);
}

if (argv.includes("--check")) {
  check();
} else if (argv[0] === "--diff") {
  diff(Number(argv[1]), Number(argv[2]));
} else {
  const n = Number(argv.find((a: string) => /^\d+$/.test(a)) ?? 2);
  const ciclo = gerarCiclo(n);
  log(argv.includes("--json") ? renderJson(ciclo) : renderCiclo(ciclo, metodologia.progressao));
}
