// VARREDURA DE TELAS — abre cada uma e escuta o console.
//
// Um erro de JavaScript no console não derruba a tela inteira no React 18: ele
// mata a ÁRVORE onde aconteceu. Na prática, um botão para de responder e mais
// nada acontece — não há mensagem, não há aviso. É o tipo de defeito que só
// aparece quando alguém reclama semanas depois.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const URL = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, detalhe = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? " — " + detalhe : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(URL);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(2000);

/** FECHA O QUE ESTIVER ABERTO, e confere que fechou.
 *
 *  Antes era um `Escape` solto depois de cada tela. Isso é uma aposta: se o
 *  painel ainda não terminou de abrir, o `Escape` não fecha nada e ele fica
 *  ali — escondendo a lista de conversas e derrubando a conferência SEGUINTE,
 *  que não tem nada a ver com o defeito. Um teste que depende de o servidor
 *  responder rápido não está medindo a tela; está medindo a rede. */
async function fecharTudo() {
  for (let i = 0; i < 10; i++) {
    const aberto = await page.getByRole("button", { name: "Nova conversa" }).count() === 0;
    if (!aberto) return true;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
  }
  return false;
}

/** Abre algo, espera, e diz se o marcador esperado apareceu. */
async function tela(nome, abrir, marcador) {
  const antes = erros.length;
  try { await abrir(); } catch (e) { ok(nome, false, "não abriu: " + e.message.split("\n")[0]); return; }
  await page.waitForTimeout(900);
  const apareceu = marcador ? await page.locator(marcador).count() > 0 : true;
  const novos = erros.slice(antes);
  ok(nome, apareceu && novos.length === 0,
     !apareceu ? "não apareceu na tela" : novos.slice(0, 2).join(" | "));
}

console.log("\nTelas");

await tela("lista de conversas", async () => {}, "[data-conversa-nome]");

await tela("uma conversa aberta",
  () => page.locator("[data-conversa-nome]").first().click(),
  "textarea, [contenteditable]");

await tela("busca dentro da conversa", async () => {
  const b = page.getByRole("button", { name: "Buscar na conversa" });
  if (await b.count()) await b.first().click();
});

await tela("ficha do cliente", async () => {
  const b = page.getByRole("button", { name: /Ficha|Cliente/ });
  if (await b.count()) await b.first().click();
});
await fecharTudo();

await tela("histórico de atendimento", async () => {
  const b = page.getByRole("button", { name: /Histórico/ });
  if (await b.count()) await b.first().click();
});
ok("dá para fechar o que foi aberto", await fecharTudo(),
   "algo continuou aberto por cima da lista de conversas");

await tela("nova conversa (agenda)",
  () => page.getByRole("button", { name: "Nova conversa" }).click(),
  'input[placeholder*="Pesquisar nome"]');
await page.keyboard.press("Escape");

await tela("menu do topo",
  () => page.getByRole("button", { name: "Menu" }).click());

await tela("Painel",
  () => page.getByRole("button", { name: "Painel" }).click(),
  '[data-tela="painel"]');
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

await tela("Departamentos e acessos", async () => {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
});
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

await tela("Configurações", async () => {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
});

// "Etiquetas" — e não "Tags", que era como esta aba se chamava. A mesma
// coisa tinha dois nomes: "Etiquetas" na lista de conversas e "Tags" nas
// Configurações. Foi esta conferência que tropeçou no segundo nome.
for (const aba of ["Mensagens rápidas", "Etiquetas"]) {
  await tela(`Configurações → ${aba}`, async () => {
    // Dentro do painel de Configurações: "Etiquetas" também é o nome da pílula
    // de filtro na lista, que fica atrás do modal e nunca receberia o clique.
    const b = page.locator('[role="dialog"], div').filter({ hasText: "Importar histórico" })
      .last().getByRole("button", { name: aba, exact: true });
    if (await b.count()) await b.first().click({ timeout: 5000 });
  });
}
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

await tela("Juntar duas conversas", async () => {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Juntar duas conversas" }).click();
});
await page.keyboard.press("Escape");

// ---- o tema escuro desenha tudo? ----
await page.evaluate(() => localStorage.setItem("zorvin_modo", "escuro"));
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);
await tela("tudo de novo, no tema escuro", async () => {
  await page.locator("[data-conversa-nome]").first().click();
}, "textarea, [contenteditable]");

// ==================================================================
//  O QUE AS TELAS FAZEM, e não só se elas abrem
// ==================================================================

console.log("\nEmojis");
{
  await fecharTudo();
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(900);
  const b = page.getByRole("button", { name: /Emojis/ });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(600);

  const caixa = page.locator('input[placeholder="Pesquisar emoji"]');
  // Conta os EMOJIS desenhados, e não todos os botões do painel: as abas
  // também são botões, e contá-las faria "não achou nada" parecer "achou oito".
  const quantos = async (termo) => {
    await caixa.fill(termo);
    await page.waitForTimeout(450);
    const vazio = await page.getByText("Nenhum emoji com esse nome.").count();
    if (vazio) return 0;
    return page.locator('button[title]').filter({ hasNotText: /\w{4}/ }).count();
  };

  // "coração" é como se escreve. Os sinônimos do catálogo estão sem acento, e
  // a comparação era letra por letra — quem digitava certo não achava nada, e
  // concluía que o painel não tinha aquele emoji.
  ok('procurar "coração" acha alguma coisa', await quantos("coração") > 0,
     "os sinônimos estão escritos sem acento e a comparação era literal");
  ok('e "coracao", sem acento, também', await quantos("coracao") > 0);
  ok('"atenção" também acha', await quantos("atenção") > 0);
  ok("e uma palavra que não existe não acha nada", await quantos("xilofonezinho") === 0);
  await caixa.fill("");
  await page.keyboard.press("Escape");
}

console.log("\nDepartamentos");
{
  await fecharTudo();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(1500);

  // Um telefone posto no departamento errado precisa ter como sair de lá. A
  // lista oferecia só os telefones SEM departamento nenhum — quem errasse
  // ficava sem saída, e a única correção era mexer no banco.
  const opcoes = await page.locator("select").first().locator("option").allTextContents();
  ok("dá para trazer para cá um telefone que está em outro departamento",
     opcoes.some((o) => /hoje em /.test(o)),
     `as opções são: ${JSON.stringify(opcoes.slice(0, 4))}`);
  ok("e a opção diz de onde ele vem",
     opcoes.some((o) => /hoje em \S/.test(o)),
     "escolher da lista sem saber de onde o número sai é uma mudança às cegas");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

console.log(`\nerros de console no total: ${erros.length}`);
erros.slice(0, 6).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} telas sem erro`);
process.exit(falhas ? 1 : 0);
