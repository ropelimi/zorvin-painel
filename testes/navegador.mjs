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

// ============================================================
//  AS TELAS NUMA GUIA PRÓPRIA (02/11)
//
//  Funil, Tarefas, Esperando resposta e Painel abrem cada uma numa
//  guia nova (`src/guias.js`), no endereço `?tela=…`. A prova que mede a TELA,
//  e não o gesto de abri-la, abre o endereço na própria página: o gesto (o
//  link, a guia nova, a guia leve) é provado em `as-telas-abrem-numa-guia-nova`.
//
//  A BANCADA MORA NA MEMÓRIA DE CADA PÁGINA, e abrir o endereço recomeça da
//  semente. A cena que gravou alguma coisa antes — o "Já tratei", a etapa, o
//  responsável — e quer ver isso na tela LEVA as tabelas (`levar`), lidas de
//  `__TABELAS` antes de sair: em produção as duas guias leem o mesmo banco.
//  Ver `__RETRATO` em `src/bancada.js`.
// ============================================================

/** As tabelas de uma guia, copiadas (as linhas, e não os arrays de lá). */
const lerTabelas = (page, nomes) => page.evaluate((ns) => Object.fromEntries(
  ns.map((n) => [n, ((globalThis.__TABELAS || {})[n] || []).map((l) => ({ ...l }))])), nomes);

/** Abre a tela `tela` na própria página. Devolve se ela apareceu. */
export async function abrirATela(page, tela, { linha = null, levar = [], prazo = 30000 } = {}) {
  if (levar.length) {
    const retrato = await lerTabelas(page, levar);
    await page.addInitScript((r) => { globalThis.__RETRATO = r; }, retrato);
  }
  const p = new URLSearchParams({ tela });
  if (linha) p.set("linha", String(linha));
  await page.goto(`${ENDERECO}?${p.toString()}`);
  return page.waitForSelector(`[data-tela="${tela}"]`, { timeout: prazo }).then(() => true).catch(() => false);
}

/** Leva as tabelas `nomes` desta guia para as guias que o contexto abrir
 *  DEPOIS — a guia nova que um clique abre nasce da semente, e a cena que
 *  gravou alguma coisa antes quer vê-la lá. Fica valendo no contexto inteiro
 *  (`ctx.addInitScript`), também para uma página que recarregar: chamada de
 *  novo, a cópia mais nova vence. */
export async function levarParaAsGuias(ctx, page, nomes) {
  const retrato = await lerTabelas(page, nomes);
  await ctx.addInitScript((r) => { globalThis.__RETRATO = r; }, retrato);
}

/** Copia as tabelas `nomes` de uma guia para outra que JÁ está aberta: o que
 *  uma gravou passa a valer na outra, como no banco que as duas dividem em
 *  produção. A guia de destino não é avisada (não há tempo real entre as
 *  bancadas): ela vê as linhas na próxima vez que ler. */
export async function copiarTabelas(de, para, nomes) {
  const retrato = await lerTabelas(de, nomes);
  await para.evaluate((r) => {
    for (const [n, linhas] of Object.entries(r)) {
      const t = (globalThis.__TABELAS || {})[n];
      if (!Array.isArray(t)) continue;
      t.length = 0;
      t.push(...linhas);
    }
  }, retrato);
}

/** O BANCO QUE AS GUIAS DIVIDEM, para a cena em que uma guia GRAVA e AVISA a
 *  outra pelo canal `zorvin-guias` (`src/guias.js`). Em produção o banco é um
 *  só, e quando o aviso sai a gravação já vale para todas as guias; na bancada
 *  cada guia tem a sua cópia. Então o aviso de uma guia só sai depois que as
 *  tabelas `nomes` dela chegam à guia `principal` — e é a guia principal que
 *  relê, como relê em produção. O aviso que a própria principal manda sai como
 *  sempre.
 *
 *  Chamada ANTES de a guia que avisa abrir: a troca do `postMessage` entra
 *  pelo contexto (`ctx.addInitScript`). */
export async function bancoDividido(ctx, principal, nomes) {
  await ctx.exposeBinding("__antesDeAvisarAsGuias", async (origem) => {
    if (origem.page && origem.page !== principal) await copiarTabelas(origem.page, principal, nomes);
  });
  await ctx.addInitScript(() => {
    const avisar = BroadcastChannel.prototype.postMessage;
    BroadcastChannel.prototype.postMessage = function (mensagem) {
      if (this.name !== "zorvin-guias" || typeof globalThis.__antesDeAvisarAsGuias !== "function") {
        return avisar.call(this, mensagem);
      }
      const canal = this;
      Promise.resolve().then(() => globalThis.__antesDeAvisarAsGuias())
        .catch(() => {}).finally(() => avisar.call(canal, mensagem));
      return undefined;
    };
  });
}

/** A guia que o gesto abre, ou `null` se nenhuma abrir. A guia nova é de
 *  quem a abriu (`noopener`), e o Playwright a entrega pelo contexto. */
export async function guiaQueAbre(ctx, gesto, prazo = 10000) {
  const esperando = ctx.waitForEvent("page", { timeout: prazo }).catch(() => null);
  await gesto();
  const nova = await esperando;
  if (nova) await nova.waitForLoadState("domcontentloaded").catch(() => {});
  return nova;
}
