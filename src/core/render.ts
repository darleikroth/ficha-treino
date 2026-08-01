/**
 * Renderização de um ciclo em Markdown, no mesmo formato das páginas atuais
 * da ficha (uma tabela por treino).
 */

import type { Ciclo } from "./gerador.ts";
import type { FaseProgressao } from "./metodologia.ts";

const ROTULO_GRUPO: Record<string, string> = {
  peito: "Peito", costas: "Costas", ombroAnterior: "Ombro anterior",
  ombroLateral: "Ombro lateral", ombroPosterior: "Ombro posterior",
  biceps: "Bíceps", triceps: "Tríceps", quadriceps: "Quadríceps",
  isquios: "Isquiotibiais", gluteo: "Glúteo", panturrilha: "Panturrilha",
  adutores: "Adutores", lombar: "Lombar",
};

const ORDEM_GRUPO = [
  "peito", "costas", "ombroAnterior", "ombroLateral", "ombroPosterior",
  "biceps", "triceps", "quadriceps", "isquios", "gluteo", "panturrilha",
  "adutores", "lombar",
];

export function renderTreino(ciclo: Ciclo, treinoId: string): string {
  const t = ciclo.treinos.find((x) => x.meta.id === treinoId);
  if (!t) throw new Error(`Treino inexistente: ${treinoId}`);

  const linhas = t.itens.map((item, i) => {
    const nome = item.slot.opcional ? `${item.exercicio.nome} *(opcional)*` : `**${item.exercicio.nome}**`;
    const marca = item.slot.ancora ? " **[Â]**" : "";
    const ordem = item.slot.id.endsWith("-S0") ? "0" : String(i);
    return `| ${ordem} | ${item.slot.alvo} | ${nome}${marca} | ${item.slot.series} | ${item.slot.reps} |`;
  });

  return [
    `### ${t.meta.dia} · Treino ${t.meta.id.slice(1)}: ${t.meta.titulo}`,
    ``,
    `**Objetivo:** ${t.meta.objetivo}  `,
    `**Descanso:** ${t.meta.descanso}  `,
    `**Ciclo:** ${ciclo.numero} (semanas ${ciclo.semanaInicial}-${ciclo.semanaInicial + 7})`,
    ``,
    `| # | Alvo | Exercício | Séries | Reps |`,
    `| :--- | :--- | :--- | :--- | :--- |`,
    ...linhas,
    ``,
    `**[Â]** = âncora · rotaciona a cada 2 ciclos, é onde você mede progressão de carga.`,
  ].join("\n");
}

export function renderCiclo(ciclo: Ciclo, progressao: FaseProgressao[] = []): string {
  const out: string[] = [
    `# Ciclo ${ciclo.numero} — semanas ${ciclo.semanaInicial} a ${ciclo.semanaInicial + 7} · metodologia ${ciclo.metodologiaVersao}`,
    ``,
    ciclo.fixado
      ? `> Ciclo fixado manualmente (ficha em uso). Não é saída do gerador.`
      : `> Gerado deterministicamente. \`gerarCiclo(${ciclo.numero})\` sempre produz este resultado.`,
    ``,
  ];

  for (const t of ciclo.treinos) out.push(renderTreino(ciclo, t.meta.id), ``, `---`, ``);

  out.push(`## Progressão dentro do ciclo (DD-10)`, ``, `| Semanas | Alvo | Nota |`, `| :--- | :--- | :--- |`);
  for (const p of progressao) out.push(`| ${p.semanas} | ${p.rir} | ${p.nota} |`);
  out.push(``, `---`, ``);

  out.push(
    `## Volume semanal por grupo`,
    ``,
    `Só trabalho direto. Manguito e antebraço fora da contagem.`,
    ``,
    `| Grupo | Séries/semana |`,
    `| :--- | :--- |`,
  );
  for (const g of ORDEM_GRUPO) {
    if (ciclo.volume[g] === undefined) continue;
    out.push(`| ${ROTULO_GRUPO[g]} | ${ciclo.volume[g]} |`);
  }

  if (ciclo.avisos.length) {
    out.push(``, `---`, ``, `## Avisos`, ``);
    for (const a of ciclo.avisos) out.push(`- ${a}`);
  }

  return out.join("\n");
}

/** JSON pronto para consumo pelo front-end. */
export function renderJson(ciclo: Ciclo): string {
  return JSON.stringify({
    ciclo: ciclo.numero,
    semanaInicial: ciclo.semanaInicial,
    fixado: ciclo.fixado,
    volume: ciclo.volume,
    avisos: ciclo.avisos,
    treinos: ciclo.treinos.map((t) => ({
      id: t.meta.id,
      dia: t.meta.dia,
      titulo: t.meta.titulo,
      objetivo: t.meta.objetivo,
      descanso: t.meta.descanso,
      exercicios: t.itens.map((i) => ({
        slot: i.slot.id,
        alvo: i.slot.alvo,
        funcao: i.slot.funcao,
        exercicio: i.exercicio.nome,
        familia: i.exercicio.familia,
        resistencia: i.exercicio.resistencia,
        series: i.slot.series,
        reps: i.slot.reps,
        ancora: i.slot.ancora,
        opcional: !!i.slot.opcional,
      })),
    })),
  }, null, 2);
}
