/**
 * Catálogo de exercícios.
 *
 * `familia` agrupa exercícios que competem entre si como estímulo — usada pelas
 * regras DD-05 (unicidade intra-treino) e DD-06 (unicidade inter-treino).
 * `resistencia` alimenta a preferência por perfil de treino (DD-07).
 */

export type Resistencia = "livre" | "maquina" | "cabo";

export interface Exercicio {
  nome: string;
  familia: string;
  resistencia: Resistencia;
}

export const EXERCICIOS: Record<string, Exercicio> = {
  // ---------- Manguito rotador ----------
  "rot-int-ext-polia": { nome: "Rotação Interna/Externa na Polia", familia: "manguito-cabo", resistencia: "cabo" },
  "rot-externa-polia": { nome: "Rotação Externa na Polia", familia: "manguito-cabo", resistencia: "cabo" },
  "rot-externa-halter": { nome: "Rotação Externa Deitado com Halter", familia: "manguito-livre", resistencia: "livre" },
  "rot-externa-elastico": { nome: "Rotação Externa com Elástico", familia: "manguito-elastico", resistencia: "cabo" },

  // ---------- Peito ----------
  "supino-reto-barra": { nome: "Supino Reto com Barra", familia: "supino-horiz", resistencia: "livre" },
  "supino-reto-halteres": { nome: "Supino Reto com Halteres", familia: "supino-horiz", resistencia: "livre" },
  "supino-reto-smith": { nome: "Supino Reto no Smith", familia: "supino-horiz", resistencia: "maquina" },
  "chest-press-maquina": { nome: "Chest Press (máquina, pegada neutra)", familia: "press-maquina", resistencia: "maquina" },
  "supino-incl-halteres": { nome: "Supino Inclinado com Halteres", familia: "supino-incl", resistencia: "livre" },
  "supino-incl-barra": { nome: "Supino Inclinado com Barra", familia: "supino-incl", resistencia: "livre" },
  "supino-incl-smith": { nome: "Supino Inclinado no Smith", familia: "supino-incl", resistencia: "maquina" },
  "supino-incl-polia": { nome: "Supino Inclinado na Polia (banco 30°)", familia: "press-cabo", resistencia: "cabo" },
  "supino-incl-maquina": { nome: "Supino Inclinado na Máquina", familia: "press-maquina", resistencia: "maquina" },
  "chest-press-incl": { nome: "Chest Press Inclinado (pegada neutra)", familia: "press-maquina", resistencia: "maquina" },
  "peck-deck": { nome: "Peck Deck", familia: "aducao-maquina", resistencia: "maquina" },
  "crucifixo-reto-halteres": { nome: "Crucifixo Reto com Halteres", familia: "aducao-livre", resistencia: "livre" },
  "crucifixo-incl-halteres": { nome: "Crucifixo Inclinado com Halteres", familia: "aducao-livre", resistencia: "livre" },
  "crossover-medio": { nome: "Crossover na Polia (altura média)", familia: "aducao-cabo-medio", resistencia: "cabo" },
  "crossover-baixo": { nome: "Crossover na Polia Baixa (ascendente)", familia: "aducao-cabo-baixo", resistencia: "cabo" },
  "crossover-alto": { nome: "Crossover na Polia Alta (descendente)", familia: "aducao-cabo-alto", resistencia: "cabo" },

  // ---------- Ombro ----------
  "desenv-militar-barra": { nome: "Desenvolvimento Militar com Barra", familia: "desenv-barra", resistencia: "livre" },
  "desenv-sentado-halteres": { nome: "Desenvolvimento Sentado com Halteres", familia: "desenv-halter", resistencia: "livre" },
  "desenv-maquina": { nome: "Desenvolvimento na Máquina", familia: "desenv-maquina", resistencia: "maquina" },
  "desenv-arnold": { nome: "Desenvolvimento Arnold", familia: "desenv-halter", resistencia: "livre" },
  "elev-lateral-halteres-pe": { nome: "Elevação Lateral com Halteres (em pé)", familia: "lateral-halter", resistencia: "livre" },
  "elev-lateral-sentado": { nome: "Elevação Lateral Sentado com Halteres", familia: "lateral-halter", resistencia: "livre" },
  "elev-lateral-polia": { nome: "Elevação Lateral na Polia (unilateral)", familia: "lateral-cabo", resistencia: "cabo" },
  "elev-lateral-maquina": { nome: "Elevação Lateral na Máquina", familia: "lateral-maquina", resistencia: "maquina" },
  "elev-lateral-inclinada": { nome: "Elevação Lateral Inclinada (deitado de lado)", familia: "lateral-halter", resistencia: "livre" },
  "face-pull": { nome: "Face Pull na Polia Alta", familia: "facepull", resistencia: "cabo" },
  "crucifixo-inv-polia": { nome: "Crucifixo Inverso na Polia", familia: "reverse-fly-cabo", resistencia: "cabo" },
  "crucifixo-inv-halteres": { nome: "Crucifixo Inverso com Halteres (banco inclinado)", familia: "reverse-fly-livre", resistencia: "livre" },
  "peck-deck-inverso": { nome: "Peck Deck Inverso", familia: "reverse-fly-maquina", resistencia: "maquina" },

  // ---------- Tríceps ----------
  "mergulho-paralelas": { nome: "Mergulho nas Paralelas", familia: "dip", resistencia: "livre" },
  "supino-fechado": { nome: "Supino Fechado com Barra", familia: "supino-fechado", resistencia: "livre" },
  "mergulho-maquina": { nome: "Mergulho na Máquina (assistido/lastro)", familia: "dip", resistencia: "maquina" },
  "flexao-diamante": { nome: "Flexão Diamante com lastro", familia: "push-fechado", resistencia: "livre" },
  "triceps-frances-halter": { nome: "Tríceps Francês Sentado com Halter", familia: "overhead-halter", resistencia: "livre" },
  "triceps-overhead-corda": { nome: "Extensão Overhead na Polia com Corda", familia: "overhead-cabo", resistencia: "cabo" },
  "triceps-testa-w": { nome: "Tríceps Testa com Barra W", familia: "testa", resistencia: "livre" },
  "triceps-overhead-uni": { nome: "Extensão Overhead Unilateral com Halter", familia: "overhead-halter", resistencia: "livre" },
  "triceps-pulley-corda": { nome: "Tríceps Pulley com Corda", familia: "triceps-corda", resistencia: "cabo" },
  "triceps-polia-barra": { nome: "Tríceps na Polia com Barra Reta (pronada)", familia: "triceps-barra-cabo", resistencia: "cabo" },
  "triceps-coice-polia": { nome: "Tríceps Coice na Polia (unilateral)", familia: "triceps-coice", resistencia: "cabo" },
  "triceps-maquina": { nome: "Tríceps na Máquina (extensão sentado)", familia: "triceps-maquina", resistencia: "maquina" },

  // ---------- Costas ----------
  "barra-fixa-pronada": { nome: "Barra Fixa pegada pronada aberta", familia: "barra-fixa", resistencia: "livre" },
  "barra-fixa-neutra": { nome: "Barra Fixa pegada neutra", familia: "barra-fixa", resistencia: "livre" },
  "graviton": { nome: "Graviton / Puxada Assistida", familia: "barra-fixa", resistencia: "maquina" },
  "puxada-aberta": { nome: "Puxada Frontal Pegada Aberta", familia: "pulldown", resistencia: "cabo" },
  "remada-serrote": { nome: "Remada Serrote com Halter", familia: "remada-uni-livre", resistencia: "livre" },
  "remada-uni-polia": { nome: "Remada Unilateral na Polia Baixa (sentado)", familia: "remada-uni-cabo", resistencia: "cabo" },
  "remada-uni-maquina": { nome: "Remada Unilateral na Máquina (apoiada)", familia: "remada-uni-maquina", resistencia: "maquina" },
  "remada-serrote-incl": { nome: "Remada Serrote no Banco Inclinado", familia: "remada-uni-livre", resistencia: "livre" },
  "puxada-triangulo": { nome: "Puxada com Triângulo (pegada neutra)", familia: "pulldown-neutro", resistencia: "cabo" },
  "puxada-supinada": { nome: "Puxada Frontal Supinada", familia: "pulldown-supinado", resistencia: "cabo" },
  "pulldown-uni": { nome: "Pulldown Unilateral na Polia Alta", familia: "pulldown-uni", resistencia: "cabo" },
  "pullover-polia": { nome: "Pullover na Polia Alta", familia: "pullover", resistencia: "cabo" },
  "pulldown-maquina": { nome: "Puxada na Máquina (convergente)", familia: "pulldown-maquina", resistencia: "maquina" },
  "remada-cavalinho": { nome: "Remada Cavalinho (T-Bar)", familia: "remada-tbar", resistencia: "livre" },
  "remada-curvada-pronada": { nome: "Remada Curvada com Barra (pronada)", familia: "remada-curvada", resistencia: "livre" },
  "remada-curvada-supinada": { nome: "Remada Curvada com Barra (supinada)", familia: "remada-curvada", resistencia: "livre" },
  "remada-baixa-fechada": { nome: "Remada Baixa na Polia (pegada fechada)", familia: "remada-baixa", resistencia: "cabo" },
  "remada-baixa-aberta": { nome: "Remada Baixa na Polia (pegada aberta)", familia: "remada-baixa", resistencia: "cabo" },
  "remada-maquina-peito": { nome: "Remada na Máquina Apoiada no Peito", familia: "remada-maquina", resistencia: "maquina" },
  "remada-sentada-maquina": { nome: "Remada Sentada na Máquina (pegada neutra)", familia: "remada-maquina", resistencia: "maquina" },
  "remada-baixa-uni": { nome: "Remada Baixa Unilateral na Polia", familia: "remada-uni-cabo", resistencia: "cabo" },

  // ---------- Bíceps / antebraço ----------
  "rosca-direta-reta": { nome: "Rosca Direta com Barra Reta", familia: "rosca-barra", resistencia: "livre" },
  "rosca-direta-w": { nome: "Rosca Direta com Barra W", familia: "rosca-barra", resistencia: "livre" },
  "rosca-martelo": { nome: "Rosca Martelo com Halteres", familia: "rosca-neutra", resistencia: "livre" },
  "rosca-direta-polia": { nome: "Rosca Direta na Polia Baixa", familia: "rosca-cabo", resistencia: "cabo" },
  "rosca-inclinada": { nome: "Rosca Inclinada (banco 45°)", familia: "rosca-alongada-livre", resistencia: "livre" },
  "rosca-bayesian": { nome: "Rosca Bayesian na Polia", familia: "rosca-alongada-cabo", resistencia: "cabo" },
  "rosca-spider": { nome: "Rosca Spider", familia: "rosca-spider", resistencia: "livre" },
  "rosca-concentrada": { nome: "Rosca Concentrada", familia: "rosca-concentrada", resistencia: "livre" },
  "rosca-scott-w": { nome: "Rosca Scott com Barra W", familia: "rosca-scott", resistencia: "livre" },
  "rosca-maquina": { nome: "Rosca na Máquina", familia: "rosca-maquina", resistencia: "maquina" },
  "rosca-martelo-polia": { nome: "Rosca Martelo na Polia com Corda", familia: "rosca-neutra-cabo", resistencia: "cabo" },
  "rosca-punho-invertida": { nome: "Rosca de Punho Invertida", familia: "punho", resistencia: "livre" },
  "rosca-punho-direta": { nome: "Rosca de Punho Direta", familia: "punho", resistencia: "livre" },
  "farmers-walk": { nome: "Farmer's Walk", familia: "pegada", resistencia: "livre" },

  // ---------- Quadríceps / adutores ----------
  "agach-frontal": { nome: "Agachamento Frontal", familia: "agach-livre", resistencia: "livre" },
  "agach-livre-alto": { nome: "Agachamento Livre (barra alta)", familia: "agach-livre", resistencia: "livre" },
  "hack-squat": { nome: "Hack Squat", familia: "agach-maquina", resistencia: "maquina" },
  "agach-smith": { nome: "Agachamento no Smith", familia: "agach-maquina", resistencia: "maquina" },
  "agach-pendulo": { nome: "Agachamento Pêndulo", familia: "agach-maquina", resistencia: "maquina" },
  "leg-press-45": { nome: "Leg Press 45° (pés baixos)", familia: "prensa", resistencia: "maquina" },
  "leg-press-horizontal": { nome: "Leg Press Horizontal", familia: "prensa", resistencia: "maquina" },
  "bulgaro": { nome: "Agachamento Búlgaro", familia: "bulgaro", resistencia: "livre" },
  "bulgaro-tronco-incl": { nome: "Agachamento Búlgaro (tronco inclinado)", familia: "bulgaro", resistencia: "livre" },
  "bulgaro-smith": { nome: "Agachamento Búlgaro no Smith", familia: "bulgaro", resistencia: "maquina" },
  "afundo-caminhando": { nome: "Afundo Caminhando", familia: "afundo", resistencia: "livre" },
  "passada-estatica": { nome: "Passada / Lunge Estático", familia: "afundo", resistencia: "livre" },
  "step-up": { nome: "Step-up no Banco Alto", familia: "stepup", resistencia: "livre" },
  "extensora": { nome: "Cadeira Extensora", familia: "extensora", resistencia: "maquina" },
  "extensora-uni": { nome: "Cadeira Extensora Unilateral", familia: "extensora-uni", resistencia: "maquina" },
  "extensora-pausa": { nome: "Cadeira Extensora com pausa isométrica", familia: "extensora", resistencia: "maquina" },
  "sissy-squat": { nome: "Sissy Squat", familia: "sissy", resistencia: "livre" },
  "adutora-maquina": { nome: "Cadeira Adutora", familia: "adutora-maquina", resistencia: "maquina" },
  "aducao-polia": { nome: "Adução na Polia (em pé, unilateral)", familia: "adutora-cabo", resistencia: "cabo" },
  "agach-sumo-halter": { nome: "Agachamento Sumô com Halter", familia: "sumo", resistencia: "livre" },

  // ---------- Panturrilha ----------
  "pant-pe-maquina": { nome: "Panturrilha em Pé na Máquina", familia: "pant-pe-maquina", resistencia: "maquina" },
  "pant-smith": { nome: "Panturrilha no Smith", familia: "pant-pe-livre", resistencia: "livre" },
  "pant-uni-halter": { nome: "Panturrilha Unilateral com Halter", familia: "pant-pe-uni", resistencia: "livre" },
  "pant-salto-controlado": { nome: "Panturrilha em Pé com salto controlado", familia: "pant-pe-livre", resistencia: "livre" },
  "pant-leg-press-45": { nome: "Panturrilha no Leg Press 45°", familia: "pant-prensa", resistencia: "maquina" },
  "pant-leg-press-horiz": { nome: "Panturrilha no Leg Press Horizontal", familia: "pant-prensa", resistencia: "maquina" },
  "pant-hack": { nome: "Panturrilha no Hack Squat", familia: "pant-hack", resistencia: "maquina" },
  "pant-donkey": { nome: "Panturrilha Burro (Donkey)", familia: "pant-donkey", resistencia: "maquina" },
  "pant-sentada-maquina": { nome: "Panturrilha Sentada na Máquina", familia: "pant-sentada", resistencia: "maquina" },
  "pant-sentada-barra": { nome: "Panturrilha Sentada com Barra sobre os joelhos", familia: "pant-sentada", resistencia: "livre" },
  "pant-sentada-leg-press": { nome: "Panturrilha Sentada no Leg Press", familia: "pant-sentada", resistencia: "maquina" },

  // ---------- Isquios / glúteo / hinge ----------
  "rdl-halteres": { nome: "RDL com Halteres", familia: "rdl", resistencia: "livre" },
  "rdl-barra": { nome: "RDL com Barra", familia: "rdl", resistencia: "livre" },
  "stiff-barra": { nome: "Stiff com Barra", familia: "stiff", resistencia: "livre" },
  "good-morning": { nome: "Good Morning com Barra", familia: "good-morning", resistencia: "livre" },
  "flexora-sentada": { nome: "Cadeira Flexora", familia: "flexora-sentada", resistencia: "maquina" },
  "flexora-deitada": { nome: "Mesa Flexora", familia: "flexora-deitada", resistencia: "maquina" },
  "flexora-uni-pe": { nome: "Flexora Unilateral em Pé", familia: "flexora-uni", resistencia: "maquina" },
  "nordic-curl": { nome: "Nordic Curl (assistido)", familia: "nordic", resistencia: "livre" },
  "hip-thrust-barra": { nome: "Hip Thrust com Barra (pausa 2s)", familia: "hip-thrust", resistencia: "livre" },
  "hip-thrust-maquina": { nome: "Hip Thrust na Máquina", familia: "hip-thrust", resistencia: "maquina" },
  "elev-quadril-uni": { nome: "Elevação de Quadril no Banco (unilateral)", familia: "hip-thrust-uni", resistencia: "livre" },
  "kickback-polia": { nome: "Extensão de Quadril na Polia", familia: "kickback-cabo", resistencia: "cabo" },

  // ---------- Lombar ----------
  "elev-lombar-romano": { nome: "Elevação Lombar no Banco Romano", familia: "hiperextensao", resistencia: "livre" },
  "extensao-lombar-maquina": { nome: "Extensão Lombar na Máquina", familia: "hiperextensao-maquina", resistencia: "maquina" },
  "reverse-hyper": { nome: "Reverse Hyperextension", familia: "reverse-hyper", resistencia: "maquina" },
  "elev-pernas-romano": { nome: "Elevação de Pernas no Banco Romano", familia: "reverse-hyper", resistencia: "livre" },
};
