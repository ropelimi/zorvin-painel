// A ETIQUETA E A CONVERSA FIXADA — duas coisas que a tela decide sozinha
// olhando só para a lista que tem em mãos.
//
// A lista de conversas vem do banco em páginas de 200. Tudo o que a tela
// resolve percorrendo o array que já carregou — ordenar as fixadas, filtrar
// por etiqueta — só enxerga essas 200. Num telefone com 1.200 conversas, o
// resto simplesmente não existe para essas duas funções, e nada na tela diz
// isso: o filtro mostra uma lista curta com cara de lista inteira.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const URL = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(URL);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

// O telefone do fundo: 1.200 conversas, o bastante para a lista vir em páginas.
await page.getByRole("button", { name: "Menu" }).click().catch(() => {});
await page.keyboard.press("Escape");
const irParaOArquivo = async () => {
  // A barra lateral de telefones. "Arquivo" é o nome do telefone do fundo.
  const alvo = page.locator('[data-telefone]').filter({ hasText: "Arquivo" });
  if (await alvo.count()) { await alvo.first().click(); return true; }
  const porTitulo = page.locator('[title*="Arquivo"], [aria-label*="Arquivo"]');
  if (await porTitulo.count()) { await porTitulo.first().click(); return true; }
  return false;
};
const achou = await irParaOArquivo();
ok("o telefone com 1.200 conversas abre", achou);
await page.waitForTimeout(2500);

const nomesNaTela = () => page.locator("[data-conversa-nome]").allTextContents();

console.log("\nA conversa fixada");
{
  const nomes = await nomesNaTela();
  console.log(`     ${nomes.length} conversa(s) desenhada(s); a primeira é "${(nomes[0] || "").trim()}"`);
  // Fixar é para a conversa ficar À VISTA. Se ela só sobe quando alguém rolar
  // até a página em que ela mora, fixar não fez nada.
  ok("a conversa fixada aparece no topo, sem ninguém rolar nada",
     (nomes[0] || "").includes("CONVERSA QUE FOI FIXADA"),
     `o topo da lista é "${(nomes[0] || "").trim()}" — a fixada está na conversa `
     + "número 1.000 deste telefone, e a lista carrega 200 por vez");
}

console.log("\nO filtro por etiqueta");
{
  // A PÍLULA "Etiquetas" VIROU A SETINHA DO FIM DA FITA (16/09): a fita
  // comporta quatro pílulas, e o campo de grupos seria a quinta. A seta é a
  // gaveta dos filtros que não cabem na linha — o mesmo desenho do WhatsApp
  // Web —, e o menu que ela abre é o MESMO de antes, com as etiquetas
  // inteiras e "Grupos" no alto.
  //
  // Endereçada pela marca, e não pela palavra: o rótulo visível mudou uma vez
  // e pode mudar de novo; `data-mais-filtros` é o contrato.
  await page.locator("[data-mais-filtros]").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Urgente", exact: true }).click();
  await page.waitForTimeout(2500);

  const nomes = await nomesNaTela();
  console.log(`     filtrando por "Urgente": ${nomes.length} conversa(s) na tela`);
  ok("o filtro por etiqueta acha as cinco, e não só as das primeiras páginas",
     nomes.length === 5,
     `mostrou ${nomes.length} de 5 — as outras estão em páginas que a lista ainda `
     + "não carregou, e nada na tela diz que elas existem");

  // O contador embaixo da lista precisa dizer a mesma coisa que a lista.
  const rodape = await page.locator("text=/\\d+ de \\d+/").allTextContents().catch(() => []);
  if (rodape.length) console.log(`     rodapé: ${rodape[0].trim()}`);
}

console.log("\nUma etiqueta não é a outra");
{
  await page.getByRole("button", { name: /Urgente/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Aguardando cliente", exact: true }).click();
  await page.waitForTimeout(2500);
  const nomes = await nomesNaTela();
  ok("filtrar por outra etiqueta mostra só as dela", nomes.length === 1,
     `mostrou ${nomes.length}, esperava 1`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
