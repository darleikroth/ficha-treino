# Sistema de Rotação de Treinos — v1

Especificação para gerar novos ciclos de treino preservando a divisão de grupos
musculares e o volume semanal da ficha atual.

---

## 1. Conceito central

A ficha atual trata cada treino como uma **lista de exercícios**. Para rotacionar sem
degradar o estímulo, o modelo passa a tratar cada treino como uma **lista de slots**.

Um slot é a unidade invariante. Ele define:

- **função** (padrão de movimento + região alvo)
- **séries**
- **faixa de repetições**
- **pool de exercícios elegíveis**

O que rotaciona é apenas *qual exercício do pool ocupa o slot*. Séries, faixa de reps e
ordem permanecem fixos entre ciclos — é isso que garante que o volume semanal por grupo
não oscile quando você troca os exercícios.

---

## 2. Decisões de Design

### DD-01 — Duração do ciclo: 8 semanas
Ciclos de 6 a 10 semanas. Adotado 8. Abaixo de 6 você troca antes de esgotar a progressão
de carga; acima de 10 a variação perde utilidade prática. Semana 9 = deload (DD-09), depois
começa o ciclo seguinte.

### DD-02 — Volume por slot é imutável
O número de séries de cada slot nunca muda entre ciclos. Consequência direta: o volume
semanal por grupo muscular é invariante por construção, não por verificação manual.
Alterações de volume só acontecem via revisão explícita da estrutura (nova versão do
documento), não via geração de ciclo.

### DD-03 — Âncoras rotacionam a cada 2 ciclos; acessórios a cada ciclo
O primeiro slot de cada treino (mais os slots de composto pesado) é **âncora**. Âncoras
são os exercícios onde você mede progressão de carga absoluta, e trocar a cada 8 semanas
destrói a série histórica. Então:

- **Âncoras** (T1-S1, T1-S4, T1-S6, T2-S1, T3-S1, T5-S1, T5-S3): trocam a cada 2 ciclos (16 semanas)
- **Acessórios**: trocam a cada ciclo (8 semanas)

Isso também é o ponto onde a maioria dos apps de treino erra — randomizam tudo e o usuário
nunca sabe se está mais forte.

### DD-04 — Cooldown de 1 ciclo
Um exercício usado no ciclo *N* não pode reaparecer no ciclo *N+1*. Pode reaparecer em
*N+2*. Isso evita que pools pequenos produzam "rotações" que não rotacionam nada.

> **Correção 2026-08-01.** A primeira implementação comparava com o ciclo *N−2* em
> vez de *N−1* (off-by-one em `gerarCiclo`), fazendo 16 dos 40 slots do Ciclo 3
> repetirem o Ciclo 2 — silenciosamente, porque `validar()` só inspeciona um ciclo e
> é estruturalmente cego a cooldown. Corrigido, mais `validarSequencia()` no core
> para que a classe do erro não recorra. Ciclos 1 e 2 não mudaram; do 3 em diante a
> saída é outra.

### DD-05 — Unicidade de família intra-treino
Dois slots do mesmo treino não podem receber exercícios da mesma família de movimento
(ex.: dois supinos inclinados, duas puxadas com pegada neutra). Cada exercício do pool
carrega uma tag `familia`.

### DD-06 — Unicidade de família inter-treino nos grupos repetidos
Peito, costas, ombro lateral, bíceps e tríceps aparecem em T1/T2 **e** em T4. Nesses casos
o exercício de T4 deve pertencer a família diferente do de T1/T2 no mesmo ciclo. Mesma
regra para o slot unilateral de T3 vs. T5 e para panturrilha em pé de T3 vs. T5.

### DD-07 — Perfil de resistência por treino
Cada exercício do pool tem tag `resistencia`: `livre` | `maquina` | `cabo`.

- **T1, T3, T5** (tensão mecânica): preferência por `livre` nos slots 1-2
- **T4** (metabólico): preferência por `maquina` ou `cabo` em todos os slots

Isso preserva a intenção original da sua ficha, onde sexta é deliberadamente diferente de
segunda.

### DD-08 — Recalibração única de volume (aplicar antes do Ciclo 2)
Dois ajustes pontuais, depois o volume trava:

1. **Ombro posterior 3 → 6 séries.** Três séries semanais de face pull está abaixo do que
   sustenta crescimento do deltoide posterior, e é o grupo que mais destoa na sua ficha.
   Ajuste: T2-S5 vai de 3 para 4 séries, e o slot opcional de antebraço em T4-S8 passa a
   ser slot de ombro posterior (2 séries). Antebraço vira opcional real, fora da contagem.
2. **Isquiotibiais 7 → 10 séries.** Razão quadríceps:isquios de 13,5:7 é desequilibrada,
   tanto para estética quanto para saúde de joelho. Ajuste: T5-S2 vai de 3 para 4 séries,
   e T3 ganha um slot final de flexão de joelho leve (2 séries, 12-15) — trabalhar isquios
   no dia de quadríceps é aceitável porque a fadiga é de padrão oposto.

Nenhum outro grupo muda.

### DD-09 — Deload na semana 9
Semana de transição entre ciclos: mesmos exercícios do ciclo que está terminando, metade
das séries, carga em ~70%, nada próximo da falha. Serve para dissipar fadiga acumulada
antes de recomeçar com exercícios novos e cargas ainda não calibradas.

### DD-10 — Progressão dentro do ciclo
Semanas 1-2: RIR 3. Semanas 3-5: RIR 2. Semanas 6-8: RIR 1, última série de cada exercício
até a falha técnica. Carga sobe quando você atinge o topo da faixa de reps do slot em todas
as séries.

---

## 3. Estrutura de slots

Legenda: **[Â]** = âncora (DD-03) · séries × reps

### T1 — Segunda · Push (Tensão Mecânica)

| Slot | Função | Séries × Reps |
|---|---|---|
| S0 | Manguito rotador (aquecimento) | 2 × 15-20 |
| S1 **[Â]** | Peito horizontal — composto pesado | 4 × 6-10 |
| S2 | Peito inclinado — composto | 4 × 8-12 |
| S3 | Peito — adução isolada | 3 × 10-15 |
| S4 **[Â]** | Ombro — empurrar vertical | 3 × 8-12 |
| S5 | Ombro lateral — abdução | 4 × 12-15 |
| S6 **[Â]** | Tríceps — composto | 3 × 6-10 / falha |
| S7 | Tríceps — extensão com ombro flexionado (cabeça longa) | 3 × 10-15 |

### T2 — Terça · Pull (Volume e Espessura)

| Slot | Função | Séries × Reps |
|---|---|---|
| S1 **[Â]** | Costas — puxada vertical pesada | 4 × 6-10 / falha |
| S2 | Costas — remada unilateral (amplitude) | 4 × 8-12 |
| S3 | Costas — puxada vertical variação de pegada | 3 × 10-12 |
| S4 | Costas — remada bilateral (espessura) | 3 × 10-15 |
| S5 | Ombro posterior | 4 × 12-15 |
| S6 | Bíceps — flexão pesada | 3 × 8-12 |
| S7 | Bíceps — flexão em posição alongada | 3 × 10-15 |

### T3 — Quarta · Legs Quadríceps + Panturrilha

| Slot | Função | Séries × Reps |
|---|---|---|
| S1 **[Â]** | Agachamento — composto pesado | 4 × 6-10 |
| S2 | Empurrar bilateral — prensa/hack | 4 × 10-15 |
| S3 | Quadríceps unilateral | 3 × 8-12 |
| S4 | Quadríceps — extensão isolada | 3 × 12-15 |
| S5 | Adutores | 3 × 15-20 |
| S6 | Panturrilha — gastrocnêmio (joelho estendido) | 4 × 10-15 |
| S7 | Panturrilha — sóleo (joelho flexionado) | 3 × 15-20 |
| S8 | Isquios — flexão de joelho leve *(novo, DD-08)* | 2 × 12-15 |

### T4 — Sexta · Upper Metabólico (descanso 60-90s)

| Slot | Função | Séries × Reps |
|---|---|---|
| S0 | Manguito rotador (aquecimento) | 2 × 15-20 |
| S1 | Peito inclinado — máquina/cabo | 3 × 10-15 |
| S2 | Costas — puxada vertical (família ≠ T2) | 3 × 10-15 |
| S3 | Peito — adução em cabo/máquina | 3 × 12-15 |
| S4 | Costas — remada suportada | 3 × 10-15 |
| S5 | Ombro lateral (família ≠ T1) | 4 × 12-15 |
| S6 | Tríceps — extensão em cabo | 3 × 12-15 |
| S7 | Bíceps — variação (família ≠ T2) | 3 × 10-15 |
| S8 | Ombro posterior *(realocado, DD-08)* | 2 × 15-20 |
| — | Antebraço *(opcional, fora da contagem)* | 2 × 15-20 |

### T5 — Sábado · Legs Posterior + Glúteo + Panturrilha

| Slot | Função | Séries × Reps |
|---|---|---|
| S1 **[Â]** | Hinge de quadril — composto pesado | 4 × 8-12 |
| S2 | Isquios — flexão de joelho | 4 × 10-15 |
| S3 **[Â]** | Glúteo — extensão de quadril | 4 × 10-12 |
| S4 | Unilateral (família ≠ T3-S3) | 3 × 8-12 |
| S5 | Panturrilha — gastrocnêmio pesado (família ≠ T3-S6) | 4 × 10-15 |
| S6 | Panturrilha — metabólico / drop set | 3 × 15-20 |
| S7 | Lombar / core posterior | 3 × 12-15 |

---

## 4. Pools de exercícios

Formato: `Exercício` · `familia` · `resistencia`

### T1

**S1 — Peito horizontal pesado [Â]**
- Supino Reto com Barra · `supino-horiz` · livre
- Supino Reto com Halteres · `supino-horiz` · livre
- Supino Reto no Smith · `supino-horiz` · maquina
- Chest Press (máquina, pegada neutra) · `press-maquina` · maquina

**S2 — Peito inclinado**
- Supino Inclinado com Halteres · `supino-incl` · livre
- Supino Inclinado com Barra · `supino-incl` · livre
- Supino Inclinado no Smith · `supino-incl` · maquina
- Supino Inclinado na Polia (banco 30°) · `press-cabo` · cabo

**S3 — Peito adução isolada**
- Peck Deck · `aducao-maquina` · maquina
- Crucifixo Reto com Halteres · `aducao-livre` · livre
- Crucifixo Inclinado com Halteres · `aducao-livre` · livre
- Crossover na Polia (altura média) · `aducao-cabo` · cabo

**S4 — Ombro empurrar vertical [Â]**
- Desenvolvimento Militar com Barra · `desenv-barra` · livre
- Desenvolvimento Sentado com Halteres · `desenv-halter` · livre
- Desenvolvimento na Máquina · `desenv-maquina` · maquina
- Desenvolvimento Arnold · `desenv-halter` · livre

**S5 — Ombro lateral**
- Elevação Lateral com Halteres (em pé) · `lateral-halter` · livre
- Elevação Lateral na Polia (unilateral) · `lateral-cabo` · cabo
- Elevação Lateral na Máquina · `lateral-maquina` · maquina
- Elevação Lateral Inclinada (deitado de lado c/ halter) · `lateral-halter` · livre

**S6 — Tríceps composto [Â]**
- Mergulho nas Paralelas · `dip` · livre
- Supino Fechado com Barra · `supino-fechado` · livre
- Mergulho na Máquina (assistido/lastro) · `dip` · maquina
- Flexão Diamante com lastro · `push-fechado` · livre

**S7 — Tríceps cabeça longa (ombro flexionado)**
- Tríceps Francês Sentado com Halter · `overhead-halter` · livre
- Extensão Overhead na Polia com Corda · `overhead-cabo` · cabo
- Tríceps Testa com Barra W · `testa` · livre
- Extensão Overhead Unilateral com Halter · `overhead-halter` · livre

### T2

**S1 — Puxada vertical pesada [Â]**
- Barra Fixa pegada pronada aberta · `barra-fixa` · livre
- Barra Fixa pegada neutra · `barra-fixa` · livre
- Graviton / Puxada Assistida · `barra-fixa` · maquina
- Puxada Frontal Pegada Aberta (carga alta) · `pulldown` · cabo

**S2 — Remada unilateral**
- Remada Serrote com Halter · `remada-uni-livre` · livre
- Remada Unilateral na Polia Baixa (sentado) · `remada-uni-cabo` · cabo
- Remada Unilateral na Máquina (apoiada) · `remada-uni-maquina` · maquina
- Remada Serrote no Banco Inclinado · `remada-uni-livre` · livre

**S3 — Puxada vertical variação**
- Puxada com Triângulo (pegada neutra) · `pulldown-neutro` · cabo
- Puxada Frontal Supinada · `pulldown-supinado` · cabo
- Pulldown Unilateral na Polia Alta · `pulldown-uni` · cabo
- Pullover na Polia Alta · `pullover` · cabo

**S4 — Remada bilateral**
- Remada Cavalinho (T-Bar) · `remada-tbar` · livre
- Remada Curvada com Barra (pronada) · `remada-curvada` · livre
- Remada Curvada com Barra (supinada) · `remada-curvada` · livre
- Remada Baixa na Polia (pegada fechada) · `remada-baixa` · cabo

**S5 — Ombro posterior**
- Face Pull na Polia Alta · `facepull` · cabo
- Crucifixo Inverso na Polia (crossover inverso) · `reverse-fly-cabo` · cabo
- Crucifixo Inverso com Halteres (banco inclinado) · `reverse-fly-livre` · livre
- Peck Deck Inverso · `reverse-fly-maquina` · maquina

**S6 — Bíceps flexão pesada**
- Rosca Direta com Barra Reta · `rosca-barra` · livre
- Rosca Direta com Barra W · `rosca-barra` · livre
- Rosca Martelo com Halteres · `rosca-neutra` · livre
- Rosca Direta na Polia Baixa · `rosca-cabo` · cabo

**S7 — Bíceps posição alongada**
- Rosca Inclinada (banco 45°, halteres) · `rosca-alongada-livre` · livre
- Rosca Bayesian na Polia (atrás do corpo) · `rosca-alongada-cabo` · cabo
- Rosca Spider (banco Scott invertido) · `rosca-spider` · livre
- Rosca Concentrada · `rosca-concentrada` · livre

### T3

**S1 — Agachamento pesado [Â]**
- Agachamento Frontal · `agach-livre` · livre
- Agachamento Livre (barra alta) · `agach-livre` · livre
- Hack Squat · `agach-maquina` · maquina
- Agachamento no Smith · `agach-maquina` · maquina

**S2 — Empurrar bilateral**
- Leg Press 45° (pés baixos) · `prensa` · maquina
- Hack Squat · `agach-maquina` · maquina
- Leg Press Horizontal · `prensa` · maquina
- Agachamento Pêndulo · `agach-maquina` · maquina

**S3 — Quadríceps unilateral**
- Agachamento Búlgaro · `bulgaro` · livre
- Afundo Caminhando · `afundo` · livre
- Passada / Lunge Estático · `afundo` · livre
- Step-up no Banco Alto · `stepup` · livre

**S4 — Quadríceps extensão isolada**
- Cadeira Extensora · `extensora` · maquina
- Cadeira Extensora Unilateral · `extensora-uni` · maquina
- Sissy Squat · `sissy` · livre
- Extensora com pausa isométrica no topo · `extensora` · maquina

**S5 — Adutores**
- Cadeira Adutora · `adutora-maquina` · maquina
- Adução na Polia (em pé, unilateral) · `adutora-cabo` · cabo
- Agachamento Sumô com Halter · `sumo` · livre

**S6 — Panturrilha gastrocnêmio**
- Panturrilha em Pé na Máquina · `pant-pe-maquina` · maquina
- Panturrilha no Smith · `pant-pe-livre` · livre
- Panturrilha Unilateral com Halter · `pant-pe-uni` · livre
- Panturrilha no Leg Press 45° · `pant-prensa` · maquina

**S7 — Panturrilha sóleo**
- Panturrilha Sentada na Máquina · `pant-sentada` · maquina
- Panturrilha Sentada com Barra sobre os joelhos · `pant-sentada` · livre
- Panturrilha Sentada no Leg Press (joelho flexionado) · `pant-sentada` · maquina

**S8 — Isquios leve**
- Cadeira Flexora · `flexora-sentada` · maquina
- Mesa Flexora · `flexora-deitada` · maquina
- Flexora Unilateral em Pé · `flexora-uni` · maquina

### T4 (preferência `maquina` / `cabo`, DD-07)

**S1 — Peito inclinado máquina/cabo**
- Supino Inclinado na Máquina · `press-maquina` · maquina
- Supino Inclinado no Smith · `supino-incl` · maquina
- Supino Inclinado na Polia (banco 30°) · `press-cabo` · cabo
- Chest Press Inclinado (pegada neutra) · `press-maquina` · maquina

**S2 — Puxada vertical (≠ T2)**
- Puxada com Triângulo · `pulldown-neutro` · cabo
- Pulldown Unilateral na Polia Alta · `pulldown-uni` · cabo
- Puxada na Máquina (Lat Pulldown convergente) · `pulldown-maquina` · maquina
- Pullover na Polia Alta · `pullover` · cabo

**S3 — Peito adução cabo/máquina**
- Crossover na Polia (altura média) · `aducao-cabo` · cabo
- Peck Deck · `aducao-maquina` · maquina
- Crossover na Polia Baixa (ascendente) · `aducao-cabo` · cabo
- Crossover na Polia Alta (descendente) · `aducao-cabo` · cabo

**S4 — Remada suportada**
- Remada Baixa na Polia (pegada aberta) · `remada-baixa` · cabo
- Remada na Máquina Apoiada no Peito · `remada-maquina` · maquina
- Remada Sentada na Máquina (pegada neutra) · `remada-maquina` · maquina
- Remada Baixa Unilateral na Polia · `remada-uni-cabo` · cabo

**S5 — Ombro lateral (≠ T1)**
- Elevação Lateral Sentado com Halteres · `lateral-halter` · livre
- Elevação Lateral na Máquina · `lateral-maquina` · maquina
- Elevação Lateral na Polia (unilateral) · `lateral-cabo` · cabo
- Elevação Lateral com Halteres (em pé) · `lateral-halter` · livre

**S6 — Tríceps cabo**
- Tríceps Pulley com Corda · `triceps-corda` · cabo
- Tríceps na Polia com Barra Reta (pronada) · `triceps-barra-cabo` · cabo
- Tríceps Coice na Polia (unilateral) · `triceps-coice` · cabo
- Tríceps na Máquina (extensão sentado) · `triceps-maquina` · maquina

**S7 — Bíceps (≠ T2)**
- Rosca Scott com Barra W · `rosca-scott` · livre
- Rosca na Máquina (Bíceps Machine) · `rosca-maquina` · maquina
- Rosca Concentrada · `rosca-concentrada` · livre
- Rosca Martelo na Polia com Corda · `rosca-neutra-cabo` · cabo

**S8 — Ombro posterior**
- Peck Deck Inverso · `reverse-fly-maquina` · maquina
- Crucifixo Inverso com Halteres · `reverse-fly-livre` · livre
- Face Pull na Polia Alta · `facepull` · cabo

**Opcional — Antebraço**
- Rosca de Punho Invertida · `punho` · livre
- Rosca de Punho Direta · `punho` · livre
- Farmer's Walk · `pegada` · livre

### T5

**S1 — Hinge de quadril [Â]**
- RDL com Halteres · `rdl` · livre
- RDL com Barra · `rdl` · livre
- Stiff com Barra · `stiff` · livre
- Good Morning com Barra · `good-morning` · livre

**S2 — Isquios flexão de joelho**
- Cadeira Flexora · `flexora-sentada` · maquina
- Mesa Flexora · `flexora-deitada` · maquina
- Flexora Unilateral em Pé · `flexora-uni` · maquina
- Nordic Curl (assistido) · `nordic` · livre

**S3 — Glúteo extensão de quadril [Â]**
- Hip Thrust com Barra (pausa 2s no topo) · `hip-thrust` · livre
- Hip Thrust na Máquina · `hip-thrust` · maquina
- Elevação de Quadril no Banco (unilateral) · `hip-thrust-uni` · livre
- Extensão de Quadril na Polia (kickback em pé) · `kickback-cabo` · cabo

**S4 — Unilateral (≠ T3-S3)**
- Agachamento Búlgaro (tronco inclinado) · `bulgaro` · livre
- Afundo Caminhando · `afundo` · livre
- Step-up no Banco Alto · `stepup` · livre
- Agachamento Búlgaro no Smith · `bulgaro` · maquina

**S5 — Panturrilha gastro pesado (≠ T3-S6)**
- Panturrilha no Smith · `pant-pe-livre` · livre
- Panturrilha em Pé na Máquina · `pant-pe-maquina` · maquina
- Panturrilha Unilateral com Halter · `pant-pe-uni` · livre
- Panturrilha Burro (Donkey) · `pant-donkey` · maquina

**S6 — Panturrilha metabólico**
- Panturrilha no Leg Press 45° (drop set) · `pant-prensa` · maquina
- Panturrilha no Leg Press Horizontal · `pant-prensa` · maquina
- Panturrilha no Hack Squat · `pant-hack` · maquina
- Panturrilha em Pé com salto controlado (alta rep) · `pant-pe-livre` · livre

**S7 — Lombar / core posterior**
- Elevação Lombar no Banco Romano · `hiperextensao` · livre
- Extensão Lombar na Máquina · `hiperextensao-maquina` · maquina
- Reverse Hyperextension · `reverse-hyper` · maquina
- Elevação de Pernas no Banco Romano · `reverse-hyper` · livre

---

## 5. Ciclo 2 — gerado

Aplicando DD-03 (âncoras mantidas, acessórios rotacionados), DD-04 (cooldown), DD-05/06
(unicidade de família) e DD-08 (recalibração). Âncoras marcadas **[Â]** — mesmas do Ciclo 1,
rotacionam no Ciclo 3.

### T1 — Segunda · Push

| # | Alvo | Exercício | Séries × Reps |
|---|---|---|---|
| 0 | Manguito | Rotação Externa Deitado c/ Halter | 2 × 15-20 |
| 1 | Peito horizontal | **Supino Reto com Barra** **[Â]** | 4 × 6-10 |
| 2 | Peito superior | Supino Inclinado com Barra | 4 × 8-12 |
| 3 | Peito adução | Crucifixo Reto com Halteres | 3 × 10-15 |
| 4 | Ombro anterior | **Desenvolvimento Militar com Barra** **[Â]** | 3 × 8-12 |
| 5 | Ombro lateral | Elevação Lateral na Polia (unilateral) | 4 × 12-15 |
| 6 | Tríceps | **Mergulho nas Paralelas** **[Â]** | 3 × falha |
| 7 | Tríceps longa | Extensão Overhead na Polia com Corda | 3 × 10-15 |

### T2 — Terça · Pull

| # | Alvo | Exercício | Séries × Reps |
|---|---|---|---|
| 1 | Costas largura | **Barra Fixa pegada pronada aberta** **[Â]** | 4 × falha |
| 2 | Costas espessura | Remada Unilateral na Polia Baixa (sentado) | 4 × 8-12 |
| 3 | Costas vertical | Puxada Frontal Supinada | 3 × 10-12 |
| 4 | Costas miolo | Remada Curvada com Barra (pronada) | 3 × 10-15 |
| 5 | Ombro posterior | Crucifixo Inverso na Polia | 4 × 12-15 |
| 6 | Bíceps | Rosca Martelo com Halteres | 3 × 8-12 |
| 7 | Bíceps longa | Rosca Bayesian na Polia | 3 × 10-15 |

### T3 — Quarta · Legs Quadríceps

| # | Alvo | Exercício | Séries × Reps |
|---|---|---|---|
| 1 | Quadríceps | **Agachamento Frontal** **[Â]** | 4 × 6-10 |
| 2 | Quad/geral | Hack Squat | 4 × 10-15 |
| 3 | Quad unilateral | Afundo Caminhando | 3 × 8-12 |
| 4 | Quad isolado | Sissy Squat | 3 × 12-15 |
| 5 | Adutores | Adução na Polia (em pé) | 3 × 15-20 |
| 6 | Gastrocnêmio | Panturrilha Unilateral com Halter | 4 × 10-15 |
| 7 | Sóleo | Panturrilha Sentada na Máquina | 3 × 15-20 |
| 8 | Isquios (novo) | Cadeira Flexora | 2 × 12-15 |

### T4 — Sexta · Upper Metabólico (descanso 60-90s)

| # | Alvo | Exercício | Séries × Reps |
|---|---|---|---|
| 0 | Manguito | Rotação Externa na Polia | 2 × 15-20 |
| 1 | Peito superior | Supino Inclinado no Smith | 3 × 10-15 |
| 2 | Costas largura | Pulldown Unilateral na Polia Alta | 3 × 10-15 |
| 3 | Peito adução | Peck Deck | 3 × 12-15 |
| 4 | Costas espessura | Remada na Máquina Apoiada no Peito | 3 × 10-15 |
| 5 | Ombro lateral | Elevação Lateral na Máquina | 4 × 12-15 |
| 6 | Tríceps | Tríceps na Polia com Barra Reta (pronada) | 3 × 12-15 |
| 7 | Bíceps | Rosca Scott com Barra W | 3 × 10-15 |
| 8 | Ombro posterior (novo) | Peck Deck Inverso | 2 × 15-20 |
| — | Antebraço *(opcional)* | Rosca de Punho Direta | 2 × 15-20 |

### T5 — Sábado · Legs Posterior + Glúteo

| # | Alvo | Exercício | Séries × Reps |
|---|---|---|---|
| 1 | Posterior/glúteo | **RDL com Halteres** **[Â]** | 4 × 8-12 |
| 2 | Isquios | Mesa Flexora | 4 × 10-15 |
| 3 | Glúteo | **Hip Thrust com Barra (pausa 2s)** **[Â]** | 4 × 10-12 |
| 4 | Unilateral | Agachamento Búlgaro (tronco inclinado) | 3 × 8-12 |
| 5 | Gastro pesado | Panturrilha no Smith | 4 × 10-15 |
| 6 | Panturrilha metabólico | Panturrilha no Leg Press 45° (drop set) | 3 × 15-20 |
| 7 | Lombar | Reverse Hyperextension | 3 × 12-15 |

### Auditoria de volume — Ciclo 2

| Grupo | Ciclo 1 | Ciclo 2 |
|---|---|---|
| Peito | 16,5 | 16 |
| Costas | 19 | 20 |
| Ombro lateral | 7,5 | 8 |
| Ombro posterior | 3 | 6 |
| Bíceps | 9 | 9 |
| Tríceps | 9 | 9 |
| Quadríceps | 13,5 | 14 |
| Isquiotibiais | 7 | 10 |
| Glúteo | ~10 | ~11 |
| Panturrilha | 14 | 14 |

---

## 6. Ciclo 3 — o que muda nas âncoras

No Ciclo 3 (semana 18+) os acessórios rotacionam normalmente e as âncoras trocam:

| Slot | Ciclo 1-2 | Ciclo 3-4 |
|---|---|---|
| T1-S1 | Supino Reto com Barra | Supino Reto com Halteres |
| T1-S4 | Desenvolvimento Militar com Barra | Desenvolvimento Sentado com Halteres |
| T1-S6 | Mergulho nas Paralelas | Supino Fechado com Barra |
| T2-S1 | Barra Fixa pronada aberta | Barra Fixa pegada neutra |
| T3-S1 | Agachamento Frontal | Agachamento Livre (barra alta) |
| T5-S1 | RDL com Halteres | RDL com Barra |
| T5-S3 | Hip Thrust com Barra | Hip Thrust na Máquina |

Ao trocar âncora, recalibre a carga: comece o ciclo com ~85% do que você estimaria, porque
o padrão novo tem custo de aprendizado motor nas primeiras 2 semanas.

---

## 7. Ajustes de conteúdo em relação à ficha atual

Quatro pontos onde as orientações da ficha divergem do que a literatura sustenta. Não
mudam a estrutura, mudam a execução:

1. **Excêntrica de 3 segundos em tudo.** Não há evidência de que excêntricas prescritas
   longas superem cadência controlada natural, e elas reduzem carga e volume total. Use
   controle deliberado (~2s na descida) sem cronometrar. Mantenha excêntrica lenta apenas
   onde ela serve outro propósito — ex.: alongamento sob carga na rosca inclinada.

2. **"Dano muscular como gatilho da síntese proteica".** O consenso atual é que dano
   muscular é subproduto do treino, não driver de hipertrofia — e dano excessivo atrapalha
   a recuperação e o volume da sessão seguinte. O driver é tensão mecânica com proximidade
   da falha. Isso não muda seu treino, muda o critério: sentir dor no dia seguinte não é
   métrica de qualidade.

3. **"Estresse metabólico" como pilar separado (T4).** A evidência de que estresse
   metabólico seja um mecanismo independente é fraca. Isso *não* invalida o T4 — ele
   continua útil, mas por outra razão: adiciona volume com baixo custo de fadiga
   articular e trabalha os grupos em famílias de movimento diferentes. Vale manter o
   descanso curto por densidade/tempo, não por "pump".

4. **Falha total nas últimas séries de todo exercício (T4 e T5).** Falha frequente em
   compostos aumenta fadiga sem ganho claro de hipertrofia. Reserve falha real para
   isoladores e máquinas; em compostos pare em RIR 1. O DD-10 já implementa isso.

Ponto onde sua ficha está à frente do senso comum: a **pausa na posição alongada da
panturrilha**. Treino em posições alongadas é uma das áreas com evidência recente mais
promissora. Mantenha.
