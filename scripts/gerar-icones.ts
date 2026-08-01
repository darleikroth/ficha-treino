/**
 * Rasteriza os SVG de `assets/icones/` para os PNG que o manifest exige
 * (DD-A15).
 *
 * O manifest precisa de PNG: o Chrome aceita SVG, o iOS não, e `maskable` na
 * prática exige raster. Publicar só SVG quebra a instalabilidade no iOS em
 * silêncio.
 *
 * Roda como `prebuild`, para os PNG nunca ficarem dessincronizados da arte. Os
 * PNG não são versionados; os SVG são.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGEM = join(RAIZ, "assets", "icones");
const DESTINO = join(RAIZ, "public", "icones");

/** Fundo do manifest — usado onde o alfa não pode existir. */
const FUNDO = "#0f1115";

interface Saida {
  fonte: string;
  arquivo: string;
  tamanho: number;
  /** iOS pinta o canal alfa de preto: o apple-touch-icon vai sem transparência. */
  semAlfa?: boolean;
}

const SAIDAS: Saida[] = [
  { fonte: "icone.svg", arquivo: "icone-192.png", tamanho: 192 },
  { fonte: "icone.svg", arquivo: "icone-512.png", tamanho: 512 },
  { fonte: "icone-maskable.svg", arquivo: "icone-maskable-192.png", tamanho: 192 },
  { fonte: "icone-maskable.svg", arquivo: "icone-maskable-512.png", tamanho: 512 },
  { fonte: "icone-maskable.svg", arquivo: "apple-touch-icon-180.png", tamanho: 180, semAlfa: true },
];

async function gerar({ fonte, arquivo, tamanho, semAlfa }: Saida): Promise<string> {
  const svg = join(ORIGEM, fonte);

  let pipeline = sharp(svg, { density: 384 }).resize(tamanho, tamanho, { fit: "cover" });
  if (semAlfa) pipeline = pipeline.flatten({ background: FUNDO });

  const png = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(DESTINO, arquivo), png);

  const kb = (png.byteLength / 1024).toFixed(1);
  return `  ${arquivo.padEnd(28)} ${String(tamanho).padStart(3)}px  ${kb} kB${semAlfa ? "  (sem alfa)" : ""}`;
}

async function principal(): Promise<void> {
  await mkdir(DESTINO, { recursive: true });

  const linhas = await Promise.all(SAIDAS.map(gerar));
  console.log(`Ícones gerados em public/icones/:\n${linhas.join("\n")}`);
}

principal().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
