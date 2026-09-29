// O CLIENTE É UM SÓ — a etiqueta e o histórico não param no telefone.
//
// DOIS PEDIDOS DE QUEM USA, e os dois são a mesma pergunta:
//
//   "A etiqueta que é incluída no contato deve aparecer nas conversas com o
//    contato em todos os telefones."
//
//   "Na conversa, no ícone de histórico, quero que indique de alguma forma
//    quantas conversas existem com aquele contato em outros telefones."
//
// O Zorvin parte o cliente numa caixa por telefone nosso. Isso está certo para
// as mensagens — cada aparelho recebeu o que recebeu — e errado para tudo o
// que é do CLIENTE: a etiqueta ficava presa a uma caixa, e a existência das
// outras caixas era invisível até alguém clicar num ícone mudo.
//
// AS DUAS METADES. A gravação da etiqueta e a contagem passam pela PONTE,
// porque este navegador não alcança as conversas dos outros telefones (é a
// regra de acesso, e ela está certa). Aqui se prova a metade do painel: que
// ele CHAMA a ponte, com o contato certo, e que desenha o número. A metade da
// ponte — espalhar de verdade — é a seção 39/40 da prova dela.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// A PONTE DE MENTIRA. Guarda o que recebeu — é o que prova que a etiqueta foi
// mandada para o CONTATO, e não só que a tela não quebrou.
const pedidos = [];
let quantasResponde = { ok: true, conversas: 3, telefones: 3 };
let pontePodeEtiquetar = true;
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (/\/historico\/contato\/[^/]+\/quantas$/.test(url.pathname)) {
    pedidos.push({ caminho: url.pathname, metodo: "GET" });
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(quantasResponde) });
  }
  if (url.pathname.endsWith("/etiqueta/contato")) {
    let corpo = null;
    try { corpo = JSON.parse(rota.request().postData() || "null"); } catch (_) { /* nulo */ }
    pedidos.push({ caminho: url.pathname, metodo: "POST", corpo });
    if (!pontePodeEtiquetar) {
      return rota.fulfill({ status: 502, contentType: "application/json",
        body: JSON.stringify({ ok: false, erro: "a ponte está dormindo" }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, conversas: 3, novas: 3 }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(1500);

console.log("\nO cliente é um só: a etiqueta e o histórico não param no telefone");

// ------------------------------------------------------------
//  1. O ÍCONE DE HISTÓRICO DEIXA DE SER MUDO
// ------------------------------------------------------------
ok("a tela perguntou à ponte quantas conversas o contato tem",
   pedidos.some((p) => /\/quantas$/.test(p.caminho)),
   JSON.stringify(pedidos.map((p) => p.caminho)));

// A 1280 COM A FICHA ABERTA A FILA SE RECOLHE NO ⋮ (29/09, ver
// `cabecalhoRecolhido`), e o selo vai junto para dentro do menu — é isso que
// faz "recolher" não virar "esconder". Esta prova roda justamente nessa
// largura e foi ela que pegou a falta: na primeira escrita daquela mudança o
// número ficou de fora do menu, e saber que OUTRO telefone atende o mesmo
// cliente voltaria a exigir clicar. Então aqui se procura nos dois lugares.
const tresPontos = page.locator('[aria-label="Mais opções desta conversa"]');
if (await tresPontos.count() === 1 && await page.locator("[data-outros-telefones]").count() === 0) {
  await tresPontos.click();
  await page.waitForTimeout(400);
}
const selo = page.locator("[data-outros-telefones]");
ok("o ícone de histórico mostra um número", (await selo.count()) === 1,
   "sem ele, saber que outro telefone atende o mesmo cliente exige clicar");
// TRÊS CONVERSAS MENOS A QUE ESTÁ ABERTA = 2. Dizer "3" numa tela que já
// mostra uma delas faz quem lê procurar três OUTRAS.
ok("e o número é o das OUTRAS, sem contar a que está aberta",
   (await selo.getAttribute("data-outros-telefones")) === "2",
   `disse ${await selo.getAttribute("data-outros-telefones")}`);

// ------------------------------------------------------------
//  2. UM CLIENTE DE UM TELEFONE SÓ NÃO GANHA NÚMERO
//
//  A metade que protege. Um "1" pendurado em toda conversa seria ruído em cima
//  da tela inteira — e ruído constante deixa de ser lido, inclusive no dia em
//  que virar "3".
// ------------------------------------------------------------
quantasResponde = { ok: true, conversas: 1, telefones: 1 };
await page.locator("[data-conversa-nome]").nth(1).click();
await page.waitForTimeout(1500);
ok("cliente de um telefone só não ganha número nenhum",
   (await page.locator("[data-outros-telefones]").count()) === 0);

// ------------------------------------------------------------
//  3. A ETIQUETA VAI PARA O CONTATO, PELA PONTE
// ------------------------------------------------------------
quantasResponde = { ok: true, conversas: 3, telefones: 3 };
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(1500);
const contatoAberto = await page.evaluate(() => {
  const id = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
  const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
  return c ? String(c.contato_id) : null;
});
ok("sei qual contato está aberto", !!contatoAberto);

const antes = pedidos.filter((p) => p.metodo === "POST").length;
// AS ETIQUETAS TAMBÉM MUDARAM DE ENDEREÇO A 1280 (ver `cabecalhoRecolhido`):
// com a fila recolhida, o botão solto não está no cabeçalho e o caminho é o
// item escrito do ⋮. É o mesmo menu que abre no fim — muda só por onde se
// chega nele.
const botaoSolto = page.locator('button[aria-label="Etiquetas"]');
if (await botaoSolto.count() > 0) {
  await botaoSolto.first().click();
} else {
  const tres = page.locator('[aria-label="Mais opções desta conversa"]');
  ok("com a fila recolhida, o ⋮ é o caminho das etiquetas", await tres.count() === 1);
  await tres.click();
  await page.waitForTimeout(400);
  await page.locator('[data-menu-conversa] button', { hasText: /^Etiquetas/ }).first().click();
}
await page.waitForTimeout(600);
const opcao = page.locator("[data-tag-opcao]").first();
const temMenu = (await opcao.count()) > 0;
ok("o menu de etiquetas abriu", temMenu,
   "sem ele esta prova não tem como aplicar uma etiqueta");
if (temMenu) {
  await opcao.click();
  await page.waitForTimeout(1200);

  const post = pedidos.filter((p) => p.metodo === "POST").slice(-1)[0];
  ok("aplicar a etiqueta chama a ponte, e não grava só nesta conversa",
     pedidos.filter((p) => p.metodo === "POST").length === antes + 1,
     JSON.stringify(pedidos.map((p) => p.caminho)));
  ok("e manda o CONTATO, que é a quem a etiqueta pertence",
     post && String(post.corpo?.contato_id) === contatoAberto,
     JSON.stringify(post?.corpo));
  ok("dizendo que é para APLICAR", post && post.corpo?.aplicar === true,
     JSON.stringify(post?.corpo));

  // TIRAR TAMBÉM VAI PARA O CONTATO. Uma etiqueta que se aplica em todos e sai
  // de um só é pior do que a de antes: some da sua tela e continua no filtro de
  // quem procura.
  await page.locator("[data-tag-opcao]").first().click();
  await page.waitForTimeout(1200);
  const tirar = pedidos.filter((p) => p.metodo === "POST").slice(-1)[0];
  ok("tirar a etiqueta também vai para o contato inteiro",
     tirar && tirar.corpo?.aplicar === false, JSON.stringify(tirar?.corpo));
}

ok("nenhum erro de página no caminho", erros.length === 0, erros.join(" | "));

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
await nav.close();
process.exit(falhas ? 1 : 0);
