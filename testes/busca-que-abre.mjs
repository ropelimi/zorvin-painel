// A BUSCA ACHA — E O QUE ELA ACHA TEM DE ABRIR.
//
// Dois relatos do escritório, na mesma frase: "digito e não busca no Vantoro, e
// quando aparece e eu clico no contato, a conversa não abre". São dois defeitos
// diferentes, e os dois vivem no mesmo canto: a busca sabe chegar a conversas
// que a LISTA CARREGADA não tem, e o resto da tela não sabia.
//
// 1. CLICAR NÃO ABRIA. A lista da esquerda desenha duas fontes emendadas: as
//    conversas carregadas (uma página por vez) e as que a busca foi buscar no
//    banco por não estarem na página. Mas a conversa ABERTA saía de um lugar só
//    — `conversas.find(...)` —, que não enxerga as segundas. Clicar numa delas
//    mudava o `conversaId` para um id que aquela lista não tem, `conversa`
//    virava nulo, e a tela da direita continuava dizendo "Selecione uma
//    conversa". O clique tinha funcionado; só não havia como ver.
//
// 2. O VANTORO ERA CONSULTADO E NÃO SERVIA PARA NADA. A resposta dele só
//    ANOTAVA o nome do cadastro em conversas que a busca local já tinha
//    achado. A conversa de quem o Vantoro encontrou nunca era buscada — então
//    procurar por CPF só funcionava se a pessoa já estivesse na página
//    carregada. Fora dela, o CPF certo do cliente certo devolvia lista vazia. E
//    lista vazia é uma RESPOSTA: quem lê "não achei" para de procurar.
//
// OS DOIS SÓ APARECEM EM BASE GRANDE, e é por isso que passaram tanto tempo.
// Com a conversa dentro da primeira página, tudo funciona. É preciso procurar
// alguém com quem não se fala há tempo — que é exatamente para o que a busca
// serve. Aqui o telefone "Arquivo" tem 1200 conversas e a lista traz 40.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O CPF que SÓ O CADASTRO conhece. Não está em nome de contato nem em texto de
// mensagem nenhuma — se a conversa aparecer, foi o Vantoro que a trouxe.
const CPF = "39850661836";
// O contato lá no fundo é o `ct-fundo-1150`, e a bancada monta o número dele
// como 5567920001150 — miolo 20001150.
//
// O CADASTRO GUARDA O MESMO TELEFONE ESCRITO DE OUTRO JEITO, de propósito: com
// pontuação, sem o 55 do país. É assim na vida real, e é por isso que o
// casamento é pelos últimos 8 dígitos. Escrevê-lo aqui igual ao do contato
// faria a prova passar sem provar essa parte.
const TELEFONE_NO_CADASTRO = "(67) 92000-1150";

let pediramAoVantoro = [];
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (url.pathname.endsWith("/vantoro/buscar")) {
    const q = (url.searchParams.get("q") || "").replace(/\D/g, "");
    pediramAoVantoro.push(url.searchParams.get("q"));
    const achou = q === CPF;
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, clientes: achou
        ? [{ id: 4242, nome: "ZULMIRA ANTUNES DO PRADO",
             telefone: TELEFONE_NO_CADASTRO, telefone2: "" }]
        : [] }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2000);

const nomeLaNoFundo = await page.evaluate(() => globalThis.__ESPERADO.fundo.nome);
const telefoneDoFundo = await page.evaluate(() => globalThis.__ESPERADO.fundo.telefone);

await page.locator(`[data-telefone="${telefoneDoFundo}"]`).click();
await page.waitForTimeout(3500);
const naLista = await page.evaluate(() => document.querySelectorAll("[data-conversa-nome]").length);
const total = await page.evaluate(() => globalThis.__ESPERADO.fundo.total);
console.log(`     telefone "${telefoneDoFundo}": ${naLista} conversas desenhadas, de ${total}`);
ok("a lista traz bem menos do que o telefone tem — é aqui que o defeito mora",
   naLista < total / 2, `${naLista} de ${total}`);

const busca = page.locator('input[placeholder*="Buscar por nome"]').first();

async function procurar(termo) {
  await busca.click();
  await busca.fill("");
  await page.waitForTimeout(500);
  await busca.type(termo, { delay: 50 });
  await page.waitForTimeout(3500);
  return page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome")));
}

/** O que a tela da direita mostra depois de um clique. */
const conversaAberta = () => page.evaluate(() => ({
  bolhas: document.querySelectorAll("[data-msg-id]").length,
  campo: document.querySelectorAll('textarea[placeholder*="Digite uma mensagem"]').length,
  vazia: /Selecione uma conversa/.test(document.body.innerText),
}));

console.log("\nClicar num achado que a lista não tinha ABRE a conversa");
{
  const achados = await procurar(nomeLaNoFundo.split(" ")[0]);
  ok(`a busca acha "${nomeLaNoFundo}", que está lá no fundo`,
     achados.some((n) => (n || "").includes(nomeLaNoFundo)),
     `veio: ${JSON.stringify(achados.slice(0, 4))}`);

  await page.locator(`[data-conversa-nome="${nomeLaNoFundo}"]`).first().click();
  await page.waitForTimeout(4000);
  const tela = await conversaAberta();
  console.log(`     depois do clique: ${tela.bolhas} bolha(s), campo=${tela.campo}, tela vazia=${tela.vazia}`);
  // A CONFERÊNCIA QUE PEGA O DEFEITO. Antes: 0 bolhas, campo nenhum, e a tela
  // da direita ainda no "Selecione uma conversa".
  ok("a conversa abre de verdade — não fica no 'Selecione uma conversa'", !tela.vazia);
  ok("e o campo de digitar aparece, que é o que diz que dá para atender", tela.campo > 0);
}

console.log("\nE ela CONTINUA aberta quando a busca é apagada");
{
  // Apagar a busca esvazia os achados do banco. Se a conversa aberta dependesse
  // deles, ela sumiria debaixo de quem está atendendo — que é o mesmo defeito
  // com outra roupa.
  await busca.click();
  await busca.fill("");
  await page.waitForTimeout(2500);
  const tela = await conversaAberta();
  ok("a conversa segue na tela depois de limpar a busca", !tela.vazia && tela.campo > 0,
     `bolhas ${tela.bolhas}, campo ${tela.campo}, vazia ${tela.vazia}`);
}

console.log("\nProcurar pelo CPF acha a conversa — mesmo fora da página carregada");
{
  // Volta para o fim da lista para não estar com a conversa já aberta.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  pediramAoVantoro = [];
  const achados = await procurar(CPF);
  ok("a tela chegou a perguntar ao Vantoro", pediramAoVantoro.length > 0,
     `pedidos: ${JSON.stringify(pediramAoVantoro)}`);
  // AQUI ESTÁ O SEGUNDO DEFEITO. O CPF não existe em contato nem em mensagem
  // nenhuma: só o cadastro sabe de quem é. Antes, a lista vinha vazia.
  ok(`o CPF acha "${nomeLaNoFundo}", que só o cadastro sabia`,
     achados.some((n) => (n || "").includes(nomeLaNoFundo)),
     `veio: ${JSON.stringify(achados.slice(0, 4))}`);

  if (achados.some((n) => (n || "").includes(nomeLaNoFundo))) {
    await page.locator(`[data-conversa-nome="${nomeLaNoFundo}"]`).first().click();
    await page.waitForTimeout(4000);
    const tela = await conversaAberta();
    ok("e clicar nela também abre", !tela.vazia && tela.campo > 0,
       `bolhas ${tela.bolhas}, campo ${tela.campo}, vazia ${tela.vazia}`);
  }
}

console.log("\nUm CPF que não é de ninguém continua não achando nada");
{
  // A conferência que impede o conserto preguiçoso: trazer conversa demais é
  // tão ruim quanto não trazer nenhuma — pior, porque parece que funcionou.
  const achados = await procurar("11122233396");
  ok("CPF sem dono não traz conversa nenhuma", achados.length === 0,
     `veio: ${JSON.stringify(achados.slice(0, 4))}`);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
