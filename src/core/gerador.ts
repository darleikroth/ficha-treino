/**
 * Motor de geração de ciclos.
 *
 * Determinístico: para uma dada metodologia, gerarCiclo(n) sempre produz o mesmo
 * resultado. Não há estado externo nem aleatoriedade — o ciclo n é função pura de
 * (metodologia, n), porque os ciclos 1..n são recalculados em cadeia para
 * resolver o cooldown de DD-04.
 *
 * O catálogo é INJETADO (DD-A04). Nenhum import estático de exercicios.ts aqui:
 * a metodologia pode vir do RTDB, do bundle de fallback, ou de um fixture de teste.
 */

import type { Exercicio, Resistencia } from "./exercicios.ts";
import type { Slot, TreinoMeta } from "./estrutura.ts";
import type { Metodologia } from "./metodologia.ts";

export interface ItemCiclo {
  slot: Slot;
  exercicioId: string;
  exercicio: Exercicio;
  /** Restrições que precisaram ser relaxadas para preencher o slot. */
  relaxou: string[];
}

export interface TreinoGerado {
  meta: TreinoMeta;
  itens: ItemCiclo[];
}

export interface Ciclo {
  numero: number;
  metodologiaVersao: string;
  /** Semana de treino em que o ciclo começa, relativa ao Ciclo 1. */
  semanaInicial: number;
  fixado: boolean;
  treinos: TreinoGerado[];
  porSlot: Record<string, string>;
  volume: Record<string, number>;
  avisos: string[];
}

/** Overrides manuais por ciclo, ex. equipamento quebrado (DD-A06). */
export type CiclosFixos = Record<number, Record<string, string>>;

export interface OpcoesGerador {
  /** Filtro duro: ids de exercício indisponíveis. Aplicado antes de tudo. */
  indisponiveis?: string[];
  ciclosFixos?: CiclosFixos;
}

/** Hash determinístico (cyrb53) — escolha estável sem PRNG com estado. */
function hash(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function criarGerador(m: Metodologia, opts: OpcoesGerador = {}) {
  const indisponiveis = new Set(opts.indisponiveis ?? []);
  const ciclosFixos = opts.ciclosFixos ?? {};
  const slotPorId = new Map(m.slots.map((s) => [s.id, s]));

  const fam = (id: string): string => {
    const ex = m.exercicios[id];
    if (!ex) throw new Error(`Exercício desconhecido: "${id}"`);
    return ex.familia;
  };

  /** Pool do slot menos os exercícios indisponíveis. Nunca devolve vazio. */
  const poolDisponivel = (slot: Slot): string[] => {
    const filtrado = slot.pool.filter((id) => !indisponiveis.has(id));
    return filtrado.length > 0 ? filtrado : slot.pool;
  };

  function escolher(
    slot: Slot,
    ciclo: number,
    anterior: Record<string, string>,
    escolhidos: Record<string, string>,
  ): { id: string; relaxou: string[] } {
    const relaxou: string[] = [];
    const base = poolDisponivel(slot);
    if (base.length !== slot.pool.length) relaxou.push("equipamento indisponível");

    // DD-03: âncora não sorteia — avança 1 posição no pool a cada 2 ciclos.
    if (slot.ancora) {
      return { id: base[Math.floor((ciclo - 1) / 2) % base.length], relaxou };
    }

    let cand = [...base];
    const aplicar = (fn: (id: string) => boolean, rotulo: string) => {
      const f = cand.filter(fn);
      if (f.length > 0) cand = f;
      else relaxou.push(rotulo);
    };

    // DD-05: nenhuma família repetida dentro do mesmo treino.
    const famsNoTreino = new Set(
      m.slots
        .filter((s) => s.treino === slot.treino && s.id !== slot.id && escolhidos[s.id] && !s.opcional)
        .map((s) => fam(escolhidos[s.id])),
    );
    aplicar((id) => !famsNoTreino.has(fam(id)), "DD-05 família intra-treino");

    // DD-06: família distinta de slots vinculados em outros treinos.
    if (slot.familiaDistintaDe?.length) {
      const vinculadas = new Set(
        slot.familiaDistintaDe.filter((sid) => escolhidos[sid]).map((sid) => fam(escolhidos[sid])),
      );
      aplicar((id) => !vinculadas.has(fam(id)), "DD-06 família inter-treino");
    }

    // DD-04: cooldown de 1 ciclo.
    const usadoAntes = anterior[slot.id];
    if (usadoAntes) aplicar((id) => id !== usadoAntes, "DD-04 cooldown");

    // DD-07: preferência de perfil de resistência (filtro suave, sem aviso).
    if (slot.preferResistencia?.length) {
      const pref = slot.preferResistencia as Resistencia[];
      const f = cand.filter((id) => pref.includes(m.exercicios[id].resistencia));
      if (f.length > 0) cand = f;
    }

    return { id: cand[hash(`${slot.id}:${ciclo}`) % cand.length], relaxou };
  }

  /** Reporta violações de DD-05/DD-06 num mapeamento de ciclo. */
  function validar(porSlot: Record<string, string>): string[] {
    const avisos: string[] = [];

    for (const t of m.treinos) {
      const vistos = new Map<string, string>();
      for (const s of m.slots.filter((x) => x.treino === t.id && !x.opcional)) {
        const id = porSlot[s.id];
        if (!id) continue;
        const f = fam(id);
        if (vistos.has(f)) {
          avisos.push(`DD-05: ${s.id} (${m.exercicios[id].nome}) repete a família "${f}" de ${vistos.get(f)} no mesmo treino.`);
        } else vistos.set(f, s.id);
      }
    }

    for (const s of m.slots) {
      const id = porSlot[s.id];
      if (!id || !s.familiaDistintaDe?.length) continue;
      for (const outro of s.familiaDistintaDe) {
        const idOutro = porSlot[outro];
        if (idOutro && fam(id) === fam(idOutro)) {
          avisos.push(`DD-06: ${s.id} (${m.exercicios[id].nome}) tem a mesma família de ${outro} (${m.exercicios[idOutro].nome}).`);
        }
      }
    }
    return avisos;
  }

  /** Volume semanal por grupo — invariante por construção (DD-02). */
  function volumeSemanal(): Record<string, number> {
    const vol: Record<string, number> = {};
    for (const slot of m.slots) {
      if (slot.opcional) continue;
      for (const [g, n] of Object.entries(slot.volume)) {
        if (g === "manguito" || g === "antebraco") continue;
        vol[g] = (vol[g] ?? 0) + (n as number);
      }
    }
    return vol;
  }

  function montar(numero: number, porSlot: Record<string, string>, fixado: boolean): Ciclo {
    return {
      numero,
      metodologiaVersao: m.versao,
      semanaInicial: (numero - 1) * m.semanasPorCiclo + 1,
      fixado,
      treinos: m.treinos.map((meta) => ({
        meta,
        itens: m.slots
          .filter((s) => s.treino === meta.id)
          .map((slot) => ({
            slot,
            exercicioId: porSlot[slot.id],
            exercicio: m.exercicios[porSlot[slot.id]],
            relaxou: [] as string[],
          })),
      })),
      porSlot,
      volume: volumeSemanal(),
      avisos: validar(porSlot),
    };
  }

  /** Gera o ciclo n. Ciclo 1 é fixado; 2+ derivam em cadeia. */
  function gerarCiclo(n: number): Ciclo {
    if (n < 1 || !Number.isInteger(n)) throw new Error(`Ciclo inválido: ${n}`);

    const ciclo1 = { ...m.ciclo1, ...(ciclosFixos[1] ?? {}) };
    if (n === 1) return montar(1, ciclo1, true);

    let atual = ciclo1;
    let relaxamentos: Record<string, string[]> = {};

    for (let c = 2; c <= n; c++) {
      const fixo = ciclosFixos[c];
      const escolhidos: Record<string, string> = {};
      const rlx: Record<string, string[]> = {};

      for (const slot of m.slots) {
        if (fixo?.[slot.id]) {
          escolhidos[slot.id] = fixo[slot.id];
          continue;
        }
        // `atual` guarda o ciclo c-1 neste ponto da iteração. Usar `anterior`
        // aqui compararia com c-2 e violaria DD-04 silenciosamente.
        const r = escolher(slot, c, atual, escolhidos);
        escolhidos[slot.id] = r.id;
        if (r.relaxou.length) rlx[slot.id] = r.relaxou;
      }

      atual = escolhidos;
      if (c === n) relaxamentos = rlx;
    }

    const temFixo = !!ciclosFixos[n];
    const ciclo = montar(n, atual, temFixo);
    for (const t of ciclo.treinos) {
      for (const item of t.itens) item.relaxou = relaxamentos[item.slot.id] ?? [];
    }
    for (const [sid, motivos] of Object.entries(relaxamentos)) {
      ciclo.avisos.push(`Restrição relaxada em ${sid}: ${motivos.join(", ")}.`);
    }
    return ciclo;
  }

  /** Sanidade do catálogo: ids órfãos, pools curtos, ciclo 1 inconsistente. */
  function validarCatalogo(): string[] {
    const erros: string[] = [];
    for (const slot of m.slots) {
      if (slot.pool.length === 0) erros.push(`${slot.id}: pool vazio.`);
      for (const id of slot.pool) {
        if (!m.exercicios[id]) erros.push(`${slot.id}: id inexistente "${id}".`);
      }
      if (new Set(slot.pool).size !== slot.pool.length) erros.push(`${slot.id}: pool com duplicatas.`);
      if (!slot.ancora && slot.pool.length < 3) {
        erros.push(`${slot.id}: pool com ${slot.pool.length} opções — cooldown + família podem travar. Mínimo: 3.`);
      }
      if (slot.familiaDistintaDe?.some((sid) => !slotPorId.has(sid))) {
        erros.push(`${slot.id}: familiaDistintaDe aponta para slot inexistente.`);
      }
    }
    for (const [sid, eid] of Object.entries(m.ciclo1)) {
      const slot = slotPorId.get(sid);
      if (!slot) erros.push(`ciclo1: slot "${sid}" não existe.`);
      else if (!slot.pool.includes(eid)) erros.push(`ciclo1: "${eid}" não está no pool de ${sid}.`);
    }
    for (const slot of m.slots) {
      if (!m.ciclo1[slot.id]) erros.push(`ciclo1: falta entrada para ${slot.id}.`);
    }
    return erros;
  }

  /**
   * Valida DD-04 ao longo de uma sequência de ciclos.
   *
   * Existe porque `validar()` recebe o mapeamento de UM ciclo e é estruturalmente
   * cego a cooldown, que é propriedade entre ciclos. Foi essa cegueira que deixou
   * um off-by-one no cooldown passar silencioso: 93 repetições N→N+1 em 12 ciclos
   * sem um único aviso. Rode isto em teste, não só `validar()`.
   *
   * Repetições esperadas e já reportadas via `ciclo.avisos` não contam como erro.
   */
  function validarSequencia(ate = 12): string[] {
    const erros: string[] = [];
    const ciclos = Array.from({ length: ate }, (_, i) => gerarCiclo(i + 1));

    for (let i = 1; i < ate; i++) {
      const ant = ciclos[i - 1], atu = ciclos[i];
      for (const slot of m.slots) {
        if (slot.ancora) continue; // âncoras usam índice, não cooldown (DD-03)
        if (ant.porSlot[slot.id] !== atu.porSlot[slot.id]) continue;
        const reportado = atu.avisos.some((a) => a.includes(slot.id) && a.includes("cooldown"));
        if (!reportado) {
          erros.push(
            `DD-04: ${slot.id} repete "${m.exercicios[atu.porSlot[slot.id]].nome}" ` +
            `do ciclo ${i} no ciclo ${i + 1} sem emitir aviso.`,
          );
        }
      }
    }

    // DD-03: âncora deve mudar exatamente a cada 2 ciclos.
    for (const slot of m.slots.filter((x) => x.ancora)) {
      for (let i = 1; i < ate; i++) {
        const mudou = ciclos[i - 1].porSlot[slot.id] !== ciclos[i].porSlot[slot.id];
        const deveriaMudar = Math.floor(i / 2) !== Math.floor((i - 1) / 2);
        if (mudou !== deveriaMudar && slot.pool.length > 1) {
          erros.push(
            `DD-03: âncora ${slot.id} ${mudou ? "mudou" : "não mudou"} entre os ciclos ` +
            `${i} e ${i + 1}, mas deveria ${deveriaMudar ? "mudar" : "permanecer"}.`,
          );
        }
      }
    }
    return erros;
  }

  return { gerarCiclo, validar, validarCatalogo, validarSequencia, volumeSemanal, metodologia: m };
}

export type Gerador = ReturnType<typeof criarGerador>;
