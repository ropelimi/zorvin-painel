// De onde sai o navegador.
//
// Estava escrito à mão em cada prova, apontando para um caminho que só existe
// numa máquina — em qualquer outra, a prova não abria e o erro não dizia por
// quê. Aqui o padrão é o navegador que o próprio Playwright instalou; quem
// tiver um Chromium noutro lugar aponta por `PLAYWRIGHT_CHROMIUM`.
import { chromium } from "playwright";

export function abrirNavegador(opcoes = {}) {
  const caminho = process.env.PLAYWRIGHT_CHROMIUM;
  return chromium.launch({ ...(caminho ? { executablePath: caminho } : {}), ...opcoes });
}

export const ENDERECO = process.env.ZORVIN_BANCADA || "http://127.0.0.1:5199/";
