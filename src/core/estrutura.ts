/**
 * Estrutura de slots — a parte INVARIANTE do sistema (DD-02).
 *
 * Séries, faixa de reps e ordem nunca mudam entre ciclos. Só o exercício que
 * ocupa o slot rotaciona. Alterar volume exige editar este arquivo e bumpar a
 * versão do documento — não é decisão do gerador.
 */

import type { Resistencia } from "./exercicios.ts";

export type TreinoId = "T1" | "T2" | "T3" | "T4" | "T5";

export type Grupo =
  | "peito" | "costas" | "ombroAnterior" | "ombroLateral" | "ombroPosterior"
  | "biceps" | "triceps" | "quadriceps" | "isquios" | "gluteo"
  | "panturrilha" | "adutores" | "lombar" | "manguito" | "antebraco";

export interface Slot {
  /** Identificador estável, ex. "T1-S1". Usado como chave de histórico e de seed. */
  id: string;
  treino: TreinoId;
  /** Rótulo curto do alvo, exibido na ficha. */
  alvo: string;
  /** Descrição da função do slot (padrão de movimento). */
  funcao: string;
  series: string;
  reps: string;
  /** DD-03: âncoras rotacionam a cada 2 ciclos e não usam sorteio. */
  ancora: boolean;
  /** Não entra na contagem de volume nem nas regras de família. */
  opcional?: boolean;
  /** DD-07: preferência de perfil de resistência (filtro suave). */
  preferResistencia?: Resistencia[];
  /** DD-06: slots cujo exercício deve ter família diferente deste. */
  familiaDistintaDe?: string[];
  /** Séries creditadas por grupo. Só trabalho direto; indireto não é contado. */
  volume: Partial<Record<Grupo, number>>;
  pool: string[];
}

export interface TreinoMeta {
  id: TreinoId;
  dia: string;
  titulo: string;
  objetivo: string;
  descanso: string;
}

export const TREINOS: TreinoMeta[] = [
  { id: "T1", dia: "Segunda", titulo: "Push", objetivo: "Tensão mecânica e progressão de carga", descanso: "2-3 min nos compostos · 60-90s nos isoladores" },
  { id: "T2", dia: "Terça", titulo: "Pull", objetivo: "Volume e espessura dorsal", descanso: "2 min nos compostos · 60-90s nos isoladores" },
  { id: "T3", dia: "Quarta", titulo: "Legs — Quadríceps e Panturrilha", objetivo: "Tensão mecânica em joelho e tornozelo", descanso: "2-3 min nos compostos · 60-90s nos isoladores" },
  { id: "T4", dia: "Sexta", titulo: "Upper 2 — Híbrido", objetivo: "Volume adicional com baixo custo articular", descanso: "60-90s em todos os exercícios" },
  { id: "T5", dia: "Sábado", titulo: "Legs — Posterior, Glúteo e Panturrilha", objetivo: "Cadeia posterior e extensão de quadril", descanso: "2-3 min nos compostos · 60-90s nos isoladores" },
];

const LIVRE: Resistencia[] = ["livre"];
const MAQ_CABO: Resistencia[] = ["maquina", "cabo"];

export const SLOTS: Slot[] = [
  // ================= T1 — Push =================
  {
    id: "T1-S0", treino: "T1", alvo: "Manguito rotador", funcao: "Aquecimento de rotadores externos",
    series: "2", reps: "15-20", ancora: false, volume: { manguito: 2 },
    pool: ["rot-int-ext-polia", "rot-externa-halter", "rot-externa-polia", "rot-externa-elastico"],
  },
  {
    id: "T1-S1", treino: "T1", alvo: "Peito (médio)", funcao: "Peito horizontal — composto pesado",
    series: "4", reps: "6-10", ancora: true, preferResistencia: LIVRE, volume: { peito: 4 },
    pool: ["supino-reto-barra", "supino-reto-halteres", "supino-reto-smith", "chest-press-maquina"],
  },
  {
    id: "T1-S2", treino: "T1", alvo: "Peito (superior)", funcao: "Peito inclinado — composto",
    series: "4", reps: "8-12", ancora: false, preferResistencia: LIVRE, volume: { peito: 4 },
    pool: ["supino-incl-halteres", "supino-incl-barra", "supino-incl-smith", "supino-incl-polia"],
  },
  {
    id: "T1-S3", treino: "T1", alvo: "Peito (isolado)", funcao: "Peito — adução isolada",
    series: "3", reps: "10-15", ancora: false, volume: { peito: 3 },
    pool: ["peck-deck", "crucifixo-reto-halteres", "crucifixo-incl-halteres", "crossover-medio"],
  },
  {
    id: "T1-S4", treino: "T1", alvo: "Ombro (anterior)", funcao: "Ombro — empurrar vertical",
    series: "3", reps: "8-12", ancora: true, volume: { ombroAnterior: 3 },
    pool: ["desenv-militar-barra", "desenv-sentado-halteres", "desenv-maquina", "desenv-arnold"],
  },
  {
    id: "T1-S5", treino: "T1", alvo: "Ombro (lateral)", funcao: "Ombro lateral — abdução",
    series: "4", reps: "12-15", ancora: false, volume: { ombroLateral: 4 },
    pool: ["elev-lateral-halteres-pe", "elev-lateral-polia", "elev-lateral-maquina", "elev-lateral-inclinada"],
  },
  {
    id: "T1-S6", treino: "T1", alvo: "Tríceps (geral)", funcao: "Tríceps — composto",
    series: "3", reps: "6-10 / falha", ancora: true, volume: { triceps: 3 },
    pool: ["mergulho-paralelas", "supino-fechado", "mergulho-maquina", "flexao-diamante"],
  },
  {
    id: "T1-S7", treino: "T1", alvo: "Tríceps (cabeça longa)", funcao: "Extensão com ombro flexionado",
    series: "3", reps: "10-15", ancora: false, volume: { triceps: 3 },
    pool: ["triceps-frances-halter", "triceps-overhead-corda", "triceps-testa-w", "triceps-overhead-uni"],
  },

  // ================= T2 — Pull =================
  {
    id: "T2-S1", treino: "T2", alvo: "Costas (largura)", funcao: "Puxada vertical pesada",
    series: "4", reps: "6-10 / falha", ancora: true, volume: { costas: 4 },
    pool: ["barra-fixa-pronada", "barra-fixa-neutra", "graviton", "puxada-aberta"],
  },
  {
    id: "T2-S2", treino: "T2", alvo: "Costas (espessura)", funcao: "Remada unilateral — amplitude",
    series: "4", reps: "8-12", ancora: false, volume: { costas: 4 },
    pool: ["remada-serrote", "remada-uni-polia", "remada-uni-maquina", "remada-serrote-incl"],
  },
  {
    id: "T2-S3", treino: "T2", alvo: "Costas (vertical)", funcao: "Puxada vertical — variação de pegada",
    series: "3", reps: "10-12", ancora: false, volume: { costas: 3 },
    pool: ["puxada-triangulo", "puxada-supinada", "pulldown-uni", "pullover-polia"],
  },
  {
    id: "T2-S4", treino: "T2", alvo: "Costas (miolo)", funcao: "Remada bilateral — espessura",
    series: "3", reps: "10-15", ancora: false, volume: { costas: 3 },
    pool: ["remada-cavalinho", "remada-curvada-pronada", "remada-curvada-supinada", "remada-baixa-fechada"],
  },
  {
    id: "T2-S5", treino: "T2", alvo: "Ombro posterior", funcao: "Abdução horizontal / retração",
    series: "4", reps: "12-15", ancora: false, volume: { ombroPosterior: 4 },
    pool: ["face-pull", "crucifixo-inv-polia", "crucifixo-inv-halteres", "peck-deck-inverso"],
  },
  {
    id: "T2-S6", treino: "T2", alvo: "Bíceps (geral)", funcao: "Flexão de cotovelo pesada",
    series: "3", reps: "8-12", ancora: false, volume: { biceps: 3 },
    pool: ["rosca-direta-reta", "rosca-direta-w", "rosca-martelo", "rosca-direta-polia"],
  },
  {
    id: "T2-S7", treino: "T2", alvo: "Bíceps (cabeça longa)", funcao: "Flexão em posição alongada",
    series: "3", reps: "10-15", ancora: false, volume: { biceps: 3 },
    pool: ["rosca-inclinada", "rosca-bayesian", "rosca-spider", "rosca-concentrada"],
  },

  // ================= T3 — Legs Quadríceps =================
  {
    id: "T3-S1", treino: "T3", alvo: "Quadríceps", funcao: "Agachamento — composto pesado",
    series: "4", reps: "6-10", ancora: true, volume: { quadriceps: 4 },
    pool: ["agach-frontal", "agach-livre-alto", "hack-squat", "agach-smith"],
  },
  {
    id: "T3-S2", treino: "T3", alvo: "Quadríceps / geral", funcao: "Empurrar bilateral — prensa/hack",
    series: "4", reps: "10-15", ancora: false, volume: { quadriceps: 4 },
    pool: ["leg-press-45", "hack-squat", "leg-press-horizontal", "agach-pendulo"],
  },
  {
    id: "T3-S3", treino: "T3", alvo: "Quadríceps (unilateral)", funcao: "Unilateral de joelho",
    series: "3", reps: "8-12", ancora: false, volume: { quadriceps: 1.5, gluteo: 1.5 },
    pool: ["bulgaro", "afundo-caminhando", "passada-estatica", "step-up"],
  },
  {
    id: "T3-S4", treino: "T3", alvo: "Quadríceps (isolado)", funcao: "Extensão de joelho isolada",
    series: "3", reps: "12-15", ancora: false, volume: { quadriceps: 3 },
    pool: ["extensora", "extensora-uni", "sissy-squat", "extensora-pausa"],
  },
  {
    id: "T3-S5", treino: "T3", alvo: "Adutores", funcao: "Adução de quadril",
    series: "3", reps: "15-20", ancora: false, volume: { adutores: 3 },
    pool: ["adutora-maquina", "aducao-polia", "agach-sumo-halter"],
  },
  {
    id: "T3-S6", treino: "T3", alvo: "Panturrilha (gastrocnêmio)", funcao: "Flexão plantar com joelho estendido",
    series: "4", reps: "10-15", ancora: false, volume: { panturrilha: 4 },
    pool: ["pant-pe-maquina", "pant-smith", "pant-uni-halter", "pant-leg-press-45"],
  },
  {
    id: "T3-S7", treino: "T3", alvo: "Panturrilha (sóleo)", funcao: "Flexão plantar com joelho flexionado",
    series: "3", reps: "15-20", ancora: false, volume: { panturrilha: 3 },
    pool: ["pant-sentada-maquina", "pant-sentada-barra", "pant-sentada-leg-press"],
  },
  {
    id: "T3-S8", treino: "T3", alvo: "Isquiotibiais", funcao: "Flexão de joelho leve (DD-08)",
    series: "2", reps: "12-15", ancora: false, volume: { isquios: 2 },
    pool: ["flexora-uni-pe", "flexora-sentada", "flexora-deitada"],
  },

  // ================= T4 — Upper 2 =================
  {
    id: "T4-S0", treino: "T4", alvo: "Manguito rotador", funcao: "Aquecimento de rotadores externos",
    series: "2", reps: "15-20", ancora: false, volume: { manguito: 2 },
    familiaDistintaDe: ["T1-S0"],
    pool: ["rot-externa-elastico", "rot-externa-polia", "rot-externa-halter", "rot-int-ext-polia"],
  },
  {
    id: "T4-S1", treino: "T4", alvo: "Peito (superior)", funcao: "Peito inclinado em máquina/cabo",
    series: "3", reps: "10-15", ancora: false, preferResistencia: MAQ_CABO,
    familiaDistintaDe: ["T1-S1", "T1-S2"], volume: { peito: 3 },
    pool: ["supino-incl-maquina", "supino-incl-smith", "supino-incl-polia", "chest-press-incl"],
  },
  {
    id: "T4-S2", treino: "T4", alvo: "Costas (largura)", funcao: "Puxada vertical (família ≠ T2)",
    series: "3", reps: "10-15", ancora: false, preferResistencia: MAQ_CABO,
    familiaDistintaDe: ["T2-S1", "T2-S3"], volume: { costas: 3 },
    pool: ["puxada-triangulo", "pulldown-uni", "pulldown-maquina", "pullover-polia"],
  },
  {
    id: "T4-S3", treino: "T4", alvo: "Peito (isolamento)", funcao: "Adução em cabo/máquina",
    series: "3", reps: "12-15", ancora: false, preferResistencia: MAQ_CABO,
    familiaDistintaDe: ["T1-S3"], volume: { peito: 3 },
    pool: ["crossover-medio", "peck-deck", "crossover-baixo", "crossover-alto"],
  },
  {
    id: "T4-S4", treino: "T4", alvo: "Costas (espessura)", funcao: "Remada suportada",
    series: "3", reps: "10-15", ancora: false, preferResistencia: MAQ_CABO,
    familiaDistintaDe: ["T2-S2", "T2-S4"], volume: { costas: 3 },
    pool: ["remada-baixa-aberta", "remada-maquina-peito", "remada-sentada-maquina", "remada-baixa-uni"],
  },
  {
    id: "T4-S5", treino: "T4", alvo: "Ombro (lateral)", funcao: "Abdução (família ≠ T1)",
    series: "4", reps: "12-15", ancora: false,
    familiaDistintaDe: ["T1-S5"], volume: { ombroLateral: 4 },
    pool: ["elev-lateral-sentado", "elev-lateral-maquina", "elev-lateral-polia", "elev-lateral-halteres-pe"],
  },
  {
    id: "T4-S6", treino: "T4", alvo: "Tríceps", funcao: "Extensão em cabo",
    series: "3", reps: "12-15", ancora: false, preferResistencia: MAQ_CABO,
    familiaDistintaDe: ["T1-S6", "T1-S7"], volume: { triceps: 3 },
    pool: ["triceps-pulley-corda", "triceps-polia-barra", "triceps-coice-polia", "triceps-maquina"],
  },
  {
    id: "T4-S7", treino: "T4", alvo: "Bíceps", funcao: "Flexão de cotovelo (família ≠ T2)",
    series: "3", reps: "10-15", ancora: false,
    familiaDistintaDe: ["T2-S6", "T2-S7"], volume: { biceps: 3 },
    pool: ["rosca-scott-w", "rosca-maquina", "rosca-concentrada", "rosca-martelo-polia", "rosca-inclinada"],
  },
  {
    id: "T4-S8", treino: "T4", alvo: "Ombro posterior", funcao: "Abdução horizontal (DD-08)",
    series: "2", reps: "15-20", ancora: false,
    familiaDistintaDe: ["T2-S5"], volume: { ombroPosterior: 2 },
    pool: ["peck-deck-inverso", "crucifixo-inv-halteres", "crucifixo-inv-polia", "face-pull"],
  },
  {
    id: "T4-S9", treino: "T4", alvo: "Antebraço", funcao: "Flexão/extensão de punho",
    series: "2", reps: "15-20", ancora: false, opcional: true, volume: { antebraco: 2 },
    pool: ["rosca-punho-invertida", "rosca-punho-direta", "farmers-walk"],
  },

  // ================= T5 — Legs Posterior =================
  {
    id: "T5-S1", treino: "T5", alvo: "Posterior / glúteo", funcao: "Hinge de quadril — composto pesado",
    series: "4", reps: "8-12", ancora: true, volume: { isquios: 2, gluteo: 2 },
    pool: ["rdl-halteres", "rdl-barra", "stiff-barra", "good-morning"],
  },
  {
    id: "T5-S2", treino: "T5", alvo: "Isquiotibiais", funcao: "Flexão de joelho",
    series: "4", reps: "10-15", ancora: false,
    familiaDistintaDe: ["T3-S8"], volume: { isquios: 4 },
    pool: ["flexora-sentada", "flexora-deitada", "flexora-uni-pe", "nordic-curl"],
  },
  {
    id: "T5-S3", treino: "T5", alvo: "Glúteo", funcao: "Extensão de quadril",
    series: "4", reps: "10-12", ancora: true, volume: { gluteo: 4 },
    pool: ["hip-thrust-barra", "hip-thrust-maquina", "elev-quadril-uni", "kickback-polia"],
  },
  {
    id: "T5-S4", treino: "T5", alvo: "Unilateral (geral)", funcao: "Unilateral (família ≠ T3)",
    series: "3", reps: "8-12", ancora: false,
    familiaDistintaDe: ["T3-S3"], volume: { gluteo: 1.5, quadriceps: 1.5 },
    pool: ["bulgaro-tronco-incl", "afundo-caminhando", "step-up", "bulgaro-smith", "bulgaro"],
  },
  {
    id: "T5-S5", treino: "T5", alvo: "Panturrilha (gastrocnêmio)", funcao: "Flexão plantar pesada (família ≠ T3)",
    series: "4", reps: "10-15", ancora: false,
    familiaDistintaDe: ["T3-S6"], volume: { panturrilha: 4 },
    pool: ["pant-smith", "pant-pe-maquina", "pant-uni-halter", "pant-donkey"],
  },
  {
    id: "T5-S6", treino: "T5", alvo: "Panturrilha (metabólico)", funcao: "Alta repetição / drop set",
    series: "3", reps: "15-20", ancora: false,
    familiaDistintaDe: ["T3-S6", "T3-S7"], volume: { panturrilha: 3 },
    pool: ["pant-leg-press-45", "pant-leg-press-horiz", "pant-hack", "pant-salto-controlado"],
  },
  {
    id: "T5-S7", treino: "T5", alvo: "Lombar / core posterior", funcao: "Extensão de tronco",
    series: "3", reps: "12-15", ancora: false, volume: { lombar: 3 },
    pool: ["elev-lombar-romano", "extensao-lombar-maquina", "reverse-hyper", "elev-pernas-romano"],
  },
];

/**
 * Ciclo 1 fixado: é a ficha real em uso, não uma saída do gerador (DD-11).
 * Serve como base de cooldown para o Ciclo 2 e preserva o histórico de cargas.
 * Contém conflitos de família pré-existentes que o validador reporta — isso é
 * intencional: é o problema que DD-06 resolve a partir do Ciclo 2.
 */
export const CICLO_1_FIXO: Record<string, string> = {
  "T1-S0": "rot-int-ext-polia",
  "T1-S1": "supino-reto-barra",
  "T1-S2": "supino-incl-halteres",
  "T1-S3": "peck-deck",
  "T1-S4": "desenv-militar-barra",
  "T1-S5": "elev-lateral-halteres-pe",
  "T1-S6": "mergulho-paralelas",
  "T1-S7": "triceps-frances-halter",
  "T2-S1": "barra-fixa-pronada",
  "T2-S2": "remada-serrote",
  "T2-S3": "puxada-triangulo",
  "T2-S4": "remada-cavalinho",
  "T2-S5": "face-pull",
  "T2-S6": "rosca-direta-reta",
  "T2-S7": "rosca-inclinada",
  "T3-S1": "agach-frontal",
  "T3-S2": "leg-press-45",
  "T3-S3": "bulgaro",
  "T3-S4": "extensora",
  "T3-S5": "adutora-maquina",
  "T3-S6": "pant-pe-maquina",
  "T3-S7": "pant-sentada-maquina",
  "T3-S8": "flexora-uni-pe",
  "T4-S0": "rot-externa-elastico",
  "T4-S1": "supino-incl-maquina",
  "T4-S2": "puxada-triangulo",
  "T4-S3": "crossover-medio",
  "T4-S4": "remada-baixa-aberta",
  "T4-S5": "elev-lateral-sentado",
  "T4-S6": "triceps-pulley-corda",
  "T4-S7": "rosca-inclinada",
  "T4-S8": "peck-deck-inverso",
  "T4-S9": "rosca-punho-invertida",
  "T5-S1": "rdl-halteres",
  "T5-S2": "flexora-sentada",
  "T5-S3": "hip-thrust-barra",
  "T5-S4": "bulgaro",
  "T5-S5": "pant-smith",
  "T5-S6": "pant-leg-press-45",
  "T5-S7": "elev-lombar-romano",
};

export const PROGRESSAO = [
  { semanas: "1-2", rir: "RIR 3", nota: "Calibração de carga. Nenhuma série próxima da falha." },
  { semanas: "3-5", rir: "RIR 2", nota: "Carga sobe quando você atinge o topo da faixa em todas as séries." },
  { semanas: "6-8", rir: "RIR 1", nota: "Falha técnica apenas na última série de isoladores e máquinas." },
  { semanas: "9", rir: "Deload", nota: "Metade das séries, ~70% da carga, longe da falha." },
];
