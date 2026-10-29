// OS RÓTULOS DE DATA DOS GRÁFICOS DO PAINEL SE LEEM (auditoria de 28/10)
//
// A varredura de layout mediu, na tela "Painel" (menu do topo), os rótulos
// de data dos gráficos de colunas ("29/09", "02/10"…) em caixas de 8px de
// largura a 375px e de 21px a 768px, com o transbordamento escondido — o
// texto pede 26px. No celular sobrava "2!" e "0:"; no tablet, "29/0" e
// "02/1". A data é a única coisa que diz QUANDO aconteceu cada coluna.
//
// Cada rótulo morava numa caixa da largura de UMA coluna, e um a cada
// `ceil(n/10)` colunas tinha texto — a conta não olhava a largura que o
// gráfico tem.
//
// O QUE ESTA PROVA GUARDA, em 320, 375 e 768px:
//   - todo rótulo de data à vista está INTEIRO (a parte visível tem a
//     largura do texto), e dois rótulos vizinhos não se encostam;
//   - nenhum sai pela borda da tela;
// e, no computador (1320px), O GRÁFICO NÃO MUDA: o mesmo número de rótulos
// de antes (um a cada três dias nos 30 dias), cada um centrado na sua
// coluna, como era.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();

async function abrirPainel(largura) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript(() => { globalThis.__TEM_FUNCAO_PAINEL = true; globalThis.__SOU_ADMIN = true; });
  await page.goto(ENDERECO);
  await page.getByRole("button", { name: "Menu" }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Menu" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Painel" }).first().click();
  await page.waitForSelector('[data-teste="escopo"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** OS RÓTULOS DE DATA DOS GRÁFICOS, procurados pelo TEXTO ("29/09"), fora das
 *  tabelas e da leitura do alto: assim a prova mede o mesmo antes e depois
 *  do conserto, sem depender de como a linha é montada. Para cada um: a
 *  largura do texto, a parte dele que fica à vista (cortada por todo
 *  ancestral que esconde o que transborda), e a linha a que pertence. */
const rotulos = (page) => page.evaluate(() => {
  const raiz = document.querySelector('[data-tela="painel"]');
  if (!raiz) return [];
  const linhas = new Map();
  const saida = [];
  const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.textContent.trim();
    if (!/^\d{2}\/\d{2}$/.test(t)) continue;
    const el = n.parentElement;
    if (el.closest("table") || el.closest('[data-teste="leitura"]')) continue;
    const faixa = document.createRange();
    faixa.selectNodeContents(n);
    const r = faixa.getBoundingClientRect();
    let esq = r.left, dir = r.right;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== "visible") {
        const b = a.getBoundingClientRect();
        esq = Math.max(esq, b.left); dir = Math.min(dir, b.right);
      }
    }
    const celula = el.getBoundingClientRect();
    const linha = el.parentElement;
    if (!linhas.has(linha)) linhas.set(linha, linhas.size);
    saida.push({ t, linha: linhas.get(linha), esq: r.left, dir: r.right, texto: r.width,
                 visivel: Math.max(0, dir - esq), centro: (r.left + r.right) / 2,
                 centroDaCelula: (celula.left + celula.right) / 2 });
  }
  return saida;
});

/** Os pares de rótulos vizinhos, na mesma linha, que se encostam. */
function encostados(lista) {
  const porLinha = new Map();
  for (const r of lista) {
    if (!porLinha.has(r.linha)) porLinha.set(r.linha, []);
    porLinha.get(r.linha).push(r);
  }
  const ruins = [];
  for (const l of porLinha.values()) {
    l.sort((a, b) => a.esq - b.esq);
    for (let i = 1; i < l.length; i++) {
      if (l[i].esq - l[i - 1].dir < 2) ruins.push(`${l[i - 1].t}|${l[i].t}`);
    }
  }
  return ruins;
}

// 320px É O CELULAR PEQUENO: ali um rótulo a cada três dias já não cabe
// (25px de vão para 26 de texto), e é onde a conta pela largura se prova.
for (const largura of [320, 375, 768]) {
  console.log(`\nA ${largura}px, os rótulos se leem inteiros`);
  const { ctx, page, estouros } = await abrirPainel(largura);
  const lista = await rotulos(page);
  const linhas = new Set(lista.map((r) => r.linha)).size;
  ok("há gráficos de colunas com rótulos de data na tela", lista.length >= 4 && linhas >= 1, `${lista.length} rótulos em ${linhas} linhas`);
  const cortados = lista.filter((r) => r.visivel < r.texto - 0.5);
  ok("nenhum rótulo cortado", lista.length > 0 && cortados.length === 0,
     `${cortados.length} de ${lista.length}: ${q(cortados.slice(0, 3).map((r) => `${r.t} mostra ${Math.round(r.visivel)} de ${Math.round(r.texto)}px`))}`);
  const juntos = encostados(lista);
  ok("e nenhum encostado no vizinho", lista.length > 0 && juntos.length === 0, q(juntos.slice(0, 5)));
  // DENTRO DA TELA: o rótulo que transborda da coluna não pode sair pela
  // borda. (A tabela "Por atendente" já passa da tela a 375px, e é outro
  // assunto — por isso a régua é o rótulo, e não a rolagem da tela inteira.)
  const largo = await page.evaluate(() => window.innerWidth);
  const fora = lista.filter((r) => r.esq < 0 || r.dir > largo);
  ok("e nenhum sai pela borda da tela", lista.length > 0 && fora.length === 0, q(fora.slice(0, 3).map((r) => r.t)));
  // UM POR CADA DIA, NÃO: menos rótulos quando é estreito, mas ainda vários.
  const naPrimeira = lista.filter((r) => r.linha === 0).length;
  ok("e a primeira linha ainda tem vários (não sumiram)", naPrimeira >= 5, `${naPrimeira}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nNo computador o gráfico continua como era");
{
  const { ctx, page } = await abrirPainel(1320);
  const lista = await rotulos(page);
  const primeira = lista.filter((r) => r.linha === 0);
  ok("um rótulo a cada três dias nos 30 dias (dez na linha)", primeira.length === 10, `${primeira.length}`);
  ok("nenhum cortado", lista.length > 0 && lista.every((r) => r.visivel >= r.texto - 0.5));
  const fora = lista.filter((r) => Math.abs(r.centro - r.centroDaCelula) > 1);
  ok("cada um centrado na sua coluna", lista.length > 0 && fora.length === 0, q(fora.slice(0, 3)));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
