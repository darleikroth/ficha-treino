/**
 * Invariante nº 1 (DD-A01): src/core/ não importa Vue, Pinia nem Firebase.
 *
 * Não é estilo. O core é a única parte do sistema com lógica de metodologia e
 * precisa rodar sob `node --test` sem mock nenhum. Basta um import de framework
 * para a suíte inteira deixar de rodar isolada — e aí a metodologia vira algo que
 * só dá para validar pela UI.
 *
 * A regra de camadas completa é core ← db ← firebase/sync ← stores ← views.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR_CORE = dirname(dirname(fileURLToPath(import.meta.url)));
const PROIBIDOS = ["vue", "pinia", "firebase", "vue-router", "@firebase"];

function arquivosDoCore(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === "__tests__" ? [] : arquivosDoCore(caminho);
    return entrada.name.endsWith(".ts") ? [caminho] : [];
  });
}

const arquivos = arquivosDoCore(DIR_CORE);

test("o core tem os módulos esperados", () => {
  const nomes = arquivos.map((f) => f.slice(DIR_CORE.length + 1)).sort();
  assert.deepEqual(nomes, ["estrutura.ts", "exercicios.ts", "gerador.ts", "metodologia.ts", "render.ts"]);
});

test("DD-A01 · nenhum arquivo do core importa framework", () => {
  // Captura `import ... from "x"`, `export ... from "x"` e `import("x")`.
  const padrao = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const [, especificador] of fonte.matchAll(padrao)) {
      const pacote = especificador.startsWith("@")
        ? especificador.split("/").slice(0, 2).join("/")
        : especificador.split("/")[0];

      assert.ok(
        !PROIBIDOS.includes(pacote),
        `${arquivo.slice(DIR_CORE.length + 1)} importa "${especificador}"`,
      );
    }
  }
});

test("DD-A01 · o core não importa nada fora dele", () => {
  const padrao = /(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']+)["']/g;

  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const [, relativo] of fonte.matchAll(padrao)) {
      assert.ok(
        !relativo.startsWith("../"),
        `${arquivo.slice(DIR_CORE.length + 1)} alcança fora do core: "${relativo}"`,
      );
    }
  }
});

test("o core não depende de nenhum pacote de node_modules", () => {
  const padrao = /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const [, especificador] of fonte.matchAll(padrao)) {
      assert.ok(
        especificador.startsWith("."),
        `${arquivo.slice(DIR_CORE.length + 1)} importa o pacote externo "${especificador}"`,
      );
    }
  }
});
