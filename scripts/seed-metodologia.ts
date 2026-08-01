/**
 * Semeia `/metodologia/{versao}` no Realtime Database (DD-A03).
 *
 * O nó é read-only para clientes: as regras negam escrita, então o seed só roda
 * pelo Admin SDK, fora do app.
 *
 * Credencial: exporte GOOGLE_APPLICATION_CREDENTIALS com o caminho do JSON da
 * conta de serviço (Console → Configurações do projeto → Contas de serviço →
 * Gerar nova chave privada). O arquivo não deve ser versionado.
 *
 *   export GOOGLE_APPLICATION_CREDENTIALS=./chave-servico.json
 *   npm run seed                 # publica se ainda não existir
 *   npm run seed -- --forcar     # sobrescreve a versão já publicada
 *   npm run seed -- --emulador   # escreve no emulador local
 *   npm run seed -- --conferir   # só compara, não escreve
 */

import { readFileSync } from "node:fs";

import { cert, initializeApp, type App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

import { METODOLOGIA_V1, deRtdb, paraRtdb } from "../src/core/metodologia.ts";
import { criarGerador } from "../src/core/gerador.ts";

const argv = process.argv.slice(2);
const forcar = argv.includes("--forcar");
const conferir = argv.includes("--conferir");
const emulador = argv.includes("--emulador");

const PROJETO = process.env.FIREBASE_PROJECT_ID ?? "fichatreinos";
const URL_BD =
  process.env.FIREBASE_DATABASE_URL ?? `https://${PROJETO}-default-rtdb.firebaseio.com`;

function iniciarAdmin(): App {
  if (emulador) {
    process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= "127.0.0.1:9000";
    return initializeApp({ projectId: PROJETO, databaseURL: URL_BD });
  }

  const caminho = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!caminho) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS não definida. Aponte para o JSON da conta " +
        "de serviço, ou rode com --emulador.",
    );
  }

  const credencial = JSON.parse(readFileSync(caminho, "utf8"));
  return initializeApp({ credential: cert(credencial), databaseURL: URL_BD });
}

/**
 * Não publica metodologia que o próprio gerador reprova. Um catálogo com id
 * órfão ou pool curto só quebraria no cliente, offline, depois.
 */
function validarAntesDePublicar(): void {
  const g = criarGerador(METODOLOGIA_V1);

  const erros = g.validarCatalogo();
  if (erros.length) {
    throw new Error(`Catálogo inválido:\n  - ${erros.join("\n  - ")}`);
  }

  const sequencia = g.validarSequencia(12);
  if (sequencia.length) {
    throw new Error(`Sequência de ciclos inválida (DD-03/DD-04):\n  - ${sequencia.join("\n  - ")}`);
  }
}

/** Ordena chaves recursivamente — comparação de conteúdo, não de serialização. */
function normalizar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(normalizar);
  if (valor && typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(objeto)
        .sort()
        .map((chave) => [chave, normalizar(objeto[chave])]),
    );
  }
  return valor;
}

/**
 * Compara o que está publicado com o bundle **depois** de reconstruir com
 * `deRtdb`.
 *
 * Comparar o JSON cru dá falso positivo: o RTDB devolve um mapa de chaves
 * inteiras contíguas como array, então `progressao` volta como array e nunca
 * bate com o objeto que `paraRtdb` enviou. A pergunta que importa é se a
 * metodologia publicada gera os mesmos ciclos, não se os bytes coincidem.
 */
function comparar(publicado: unknown): { igual: boolean; ciclosDivergentes: number } {
  const reconstruida = deRtdb(publicado);
  const igual =
    JSON.stringify(normalizar(reconstruida)) === JSON.stringify(normalizar(METODOLOGIA_V1));

  const doRtdb = criarGerador(reconstruida);
  const doBundle = criarGerador(METODOLOGIA_V1);

  let ciclosDivergentes = 0;
  for (let n = 1; n <= 12; n++) {
    const a = JSON.stringify(doRtdb.gerarCiclo(n).porSlot);
    const b = JSON.stringify(doBundle.gerarCiclo(n).porSlot);
    if (a !== b) ciclosDivergentes++;
  }

  return { igual, ciclosDivergentes };
}

async function principal(): Promise<void> {
  validarAntesDePublicar();

  const versao = METODOLOGIA_V1.versao;
  const payload = paraRtdb(METODOLOGIA_V1);

  const app = iniciarAdmin();
  const ref = getDatabase(app).ref(`/metodologia/${versao}`);
  const atual = (await ref.get()).val();

  const destino = emulador ? "emulador local" : URL_BD;
  const resumo =
    `${Object.keys(payload.exercicios).length} exercícios · ` +
    `${Object.keys(payload.slots).length} slots · ` +
    `${Object.keys(payload.treinos).length} treinos`;

  if (conferir) {
    if (!atual) {
      console.log(`/metodologia/${versao} não existe em ${destino}.`);
      return;
    }

    const { igual, ciclosDivergentes } = comparar(atual);
    console.log(
      igual && ciclosDivergentes === 0
        ? `/metodologia/${versao} confere com o bundle (${resumo}); 12 ciclos idênticos.`
        : `/metodologia/${versao} DIVERGE do bundle` +
          (ciclosDivergentes ? ` — ${ciclosDivergentes}/12 ciclos diferentes.` : " (só na forma).") +
          ` Rode com --forcar para republicar.`,
    );
    return;
  }

  if (!atual) {
    // Sem este nó o app não funciona para ninguém: a regra de validação de
    // `config.metodologiaVersao` exige que /metodologia/{versao} exista, então
    // a primeira escrita de config de qualquer usuário novo é recusada com
    // PERMISSION_DENIED — e como a drenagem para na primeira travada, a fila
    // inteira congela sem nada sincronizar.
    console.log(`/metodologia/${versao} ainda não existe em ${destino}. Publicando…`);
  }

  if (atual && !forcar) {
    // Sobrescrever sem querer trocaria pools sob usuários com ciclo em
    // andamento, invalidando cargas em progresso (DD-A03).
    console.log(
      `/metodologia/${versao} já existe em ${destino}. Nada foi escrito.\n` +
        `Use --forcar para sobrescrever, ou --conferir para comparar.`,
    );
    return;
  }

  await ref.set(payload);
  console.log(`/metodologia/${versao} publicada em ${destino}.\n  ${resumo}`);
}

principal()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
