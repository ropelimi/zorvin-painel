// AS CONVERSAS DE FORA DAS PÁGINAS TÊM ETIQUETA (auditoria de 28/10; mudou
// em 02/11). Era `as-linhas-de-fora-tem-etiqueta`.
//
// As etiquetas de cada conversa vêm de `conversa_tags`, lidas para os ids da
// LISTA — e só dela. A busca e os filtros trazem do banco conversas que as
// páginas lidas não têm, e essas vinham sem etiqueta nenhuma: no filtro
// "Urgente", a conversa 980 entrava na lista POR SER urgente e aparecia sem o
// próprio selo "Urgente". Hoje a leitura conhece também as de fora
// (`idsDosExtras`).
//
// DESDE 02/11 A LINHA DA LISTA NÃO MOSTRA ETIQUETA, a pedido do Rodrigo (ver
// `as-etiquetas-saem-da-lista`). A leitura das de fora continua servindo ao
// ALTO DA CONVERSA ABERTA e ao menu "Etiquetas" dela: aberta a conversa 1.150
// pelo filtro ou pela busca, o alto tem de dizer "Urgente" — senão quem a
// abre conclui que ninguém a etiquetou. As conferências foram INVERTIDAS, e
// não apagadas: a linha não mostra; o alto da conversa aberta mostra.
//
// O QUE A LEITURA DAS DE FORA GUARDA HOJE É O PRIMEIRO DESENHO. Abrir uma
// conversa a põe na lista (`abrirConversa`), e a leitura das etiquetas da
// lista a pega um instante depois: sem `idsDosExtras`, o alto nasceria sem a
// etiqueta e ganharia "Urgente" logo em seguida. Medido: a sabotagem que tira
// as de fora da leitura passava por esta prova inteira enquanto ela conferia
// o alto um segundo e meio depois do clique. Hoje um vigia anota o alto no
// PRIMEIRO desenho da conversa aberta.
//
// CADA CENA NUMA JANELA NOVA: aberta numa cena, a conversa continuaria aberta
// na seguinte, e o alto já estaria desenhado antes de a cena começar.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
async function clicar(page, seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
/** As linhas da lista, cada uma dizendo se escreve “Urgente”. */
const linhas = (page) => page.locator("[data-conversa-id]").evaluateAll((els) => els.map((e) => ({
  id: e.getAttribute("data-conversa-id"), urgente: /\bUrgente\b/.test(e.innerText || ""),
})));
/** O VIGIA DO PRIMEIRO DESENHO: anota as etiquetas do alto na primeira vez que
 *  o alto de uma conversa aparece. Armado com nenhuma conversa aberta, ele vê
 *  a que a cena abre. */
const vigiarOPrimeiroDesenho = (page) => page.evaluate(() => {
  globalThis.__PRIMEIRO_ALTO = null;
  const olhar = () => {
    if (globalThis.__PRIMEIRO_ALTO !== null || !document.querySelector("[data-topo-conversa]")) return;
    const el = document.querySelector("[data-etiquetas-do-alto]");
    globalThis.__PRIMEIRO_ALTO = el ? el.innerText : "";
  };
  new MutationObserver(olhar).observe(document.body, { childList: true, subtree: true, characterData: true });
  return !document.querySelector("[data-topo-conversa]");
});
const primeiroAlto = (page) => page.evaluate(() => globalThis.__PRIMEIRO_ALTO);
/** As etiquetas do alto da conversa aberta. */
const doAlto = async (page) => ((await page.locator("[data-etiquetas-do-alto]").count())
  ? page.locator("[data-etiquetas-do-alto]").first().innerText() : "");

console.log("\n1. O filtro “Urgente”");
{
  const { ctx, page, estouros } = await abrir();
  ok("fui ao telefone de 1.200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(3000);
  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  ok("escolhi “Urgente”", await clicar(page, '[data-etiqueta-da-seta="t-urgente"]'));
  await page.waitForTimeout(3500);
  const l = await linhas(page);
  ok("as cinco estão na lista — inclusive as de fora das páginas", l.length === 5, JSON.stringify(l));
  const com = l.filter((x) => x.urgente).map((x) => x.id);
  ok("e nenhuma linha escreve a etiqueta (02/11)", l.length === 5 && com.length === 0, `escrevem: ${JSON.stringify(com)}`);
  ok("(nenhuma conversa aberta antes do clique)", await vigiarOPrimeiroDesenho(page));
  ok("abri a 1.150, que veio de fora das páginas", await clicar(page, '[data-conversa-id="a13-c1150"]'));
  await page.waitForTimeout(1500);
  const alto = await doAlto(page);
  ok("e o alto dela diz “Urgente”", /\bUrgente\b/.test(alto), alto);
  const primeiro = await primeiroAlto(page);
  ok("já no primeiro desenho, sem nascer sem a etiqueta", /\bUrgente\b/.test(primeiro || ""), JSON.stringify(primeiro));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n2. A conversa que a busca traz lá do fundo");
{
  const { ctx, page, estouros } = await abrir();
  ok("fui ao telefone de 1.200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(3000);
  await page.locator('input[placeholder*="Buscar por nome"]').first().fill("ZULMIRA");
  await page.waitForTimeout(3500);
  const l = await linhas(page);
  const zulmira = l.find((x) => x.id === "a13-c1150");
  ok("a busca achou a ZULMIRA, a conversa 1.150", Boolean(zulmira), JSON.stringify(l));
  ok("e a linha dela não escreve a etiqueta (02/11)", Boolean(zulmira && !zulmira.urgente), JSON.stringify(zulmira));
  ok("(nenhuma conversa aberta antes do clique)", await vigiarOPrimeiroDesenho(page));
  ok("abri a ZULMIRA pela busca", await clicar(page, '[data-conversa-id="a13-c1150"]'));
  await page.waitForTimeout(1500);
  const alto = await doAlto(page);
  ok("e o alto dela diz “Urgente”", /\bUrgente\b/.test(alto), alto);
  const primeiro = await primeiroAlto(page);
  ok("já no primeiro desenho, sem nascer sem a etiqueta", /\bUrgente\b/.test(primeiro || ""), JSON.stringify(primeiro));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
