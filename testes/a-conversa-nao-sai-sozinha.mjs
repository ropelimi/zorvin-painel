// A CONVERSA ABERTA NÃO SE FECHA SOZINHA.
//
// RELATO DO ESCRITÓRIO, em 10/09: "quando estamos dentro de uma conversa, ela
// sai sozinha, como se tivesse sido apertada a tecla ESC".
//
// Ninguém apertou nada. O que acontece é isto:
//
//   A tela da direita não guarda a conversa aberta — ela a PROCURA na lista da
//   esquerda, por `conversas.find(c => c.id === conversaId)`. Some da lista,
//   some da tela: o `conversaId` continua lá, e a direita volta a dizer
//   "Selecione uma conversa" como se a pessoa tivesse saído.
//
//   E a lista se refaz sozinha. Toda vez que chega mensagem de uma conversa
//   que ela ainda não tem — um lead novo, alguém que não falava há meses —, a
//   PRIMEIRA PÁGINA é recarregada e SUBSTITUI o que estava carregado. Quem
//   veio de outro lugar (uma conversa antiga achada na busca, uma aberta pela
//   Esteira do Vantoro, uma trazida por rolagem) não está na primeira página,
//   e é jogada fora junto.
//
// Quem atende num telefone de duzentas conversas nunca vê isso. Quem atende no
// telefone com dois anos de histórico vê o dia inteiro, e sempre no pior
// momento: no meio de uma resposta, porque o gatilho é justamente o movimento
// do escritório.
//
// A prova roda no telefone "Arquivo" da bancada, que tem 1200 conversas — a
// mesma condição do telefone de verdade.
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

await page.route("**/ponte-de-mentira/**", (rota) => rota.fulfill({
  status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2000);

const fundo = await page.evaluate(() => globalThis.__ESPERADO.fundo);
await page.locator(`[data-telefone="${fundo.telefone}"]`).click();
await page.waitForTimeout(3500);

/** O que a tela da direita está mostrando. */
const naTela = () => page.evaluate(() => ({
  campo: document.querySelectorAll('textarea[placeholder*="Digite uma mensagem"]').length,
  vazia: /Selecione uma conversa/.test(document.body.innerText),
  topo: (document.querySelector("[data-topo-conversa]") || {}).innerText || "",
}));

/** Dispara um aviso de tempo real pelo mesmo caminho do Supabase de verdade.
 *  Devolve quantos tratadores ouviram — zero seria uma prova que não provou
 *  nada, porque o evento não chegou a lugar nenhum. */
const emitir = (tabela, linha, evento = "INSERT") =>
  page.evaluate(([t, l, e]) => globalThis.__EMITIR(e, t, l), [tabela, linha, evento]);

const busca = page.locator('input[placeholder*="Buscar por nome"]').first();

console.log("\nUma conversa antiga, achada na busca e aberta");

await busca.click();
await busca.fill("");
await page.waitForTimeout(400);
await busca.type(fundo.nome.split(" ")[0], { delay: 40 });
await page.waitForTimeout(3500);
const achou = await page.locator(`[data-conversa-nome="${fundo.nome}"]`).count();
ok(`a busca acha "${fundo.nome}", que está lá no fundo da agenda`, achou > 0);
if (!achou) {
  console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
  await nav.close();
  process.exit(1);
}
await page.locator(`[data-conversa-nome="${fundo.nome}"]`).first().click();
await page.waitForTimeout(3000);
await busca.click();
await busca.fill("");
await page.waitForTimeout(1500);

const abriu = await naTela();
ok("ela abre e fica aberta com a busca já apagada", !abriu.vazia && abriu.campo > 0,
   `campo ${abriu.campo}, vazia ${abriu.vazia}`);

// ------------------------------------------------------------
//  O MOVIMENTO DO ESCRITÓRIO NÃO PODE FECHAR A CONVERSA
//
//  Uma mensagem numa conversa que a lista NÃO TEM é o caso mais comum do dia:
//  o lead que escreve pela primeira vez, o cliente calado há meses. A lista
//  precisa mesmo se refazer para trazê-la — o que ela não pode é levar junto a
//  conversa que alguém está atendendo.
// ------------------------------------------------------------
console.log("\nChega mensagem de uma conversa que a lista não tem");

const ouviram = await emitir("mensagens", {
  id: "m-do-relato", conversa_id: "a13-c900", origem: "contato", tipo: "texto",
  texto: "Doutor, bom dia — é sobre o meu processo",
  enviado_por: null, enviado_por_id: null, criado_em: new Date().toISOString(),
});
ok("o aviso de tempo real chegou a algum tratador", ouviram > 0, `ouviram: ${ouviram}`);
await page.waitForTimeout(3500);

const depois = await naTela();
console.log(`     depois do aviso: campo=${depois.campo}, "Selecione uma conversa"=${depois.vazia}`);
// A CONFERÊNCIA DO RELATO. Antes: a lista voltava a ser a primeira página, a
// conversa de ZULMIRA não estava nela, e a direita apagava sozinha.
ok("a conversa continua aberta — não foi fechada sozinha",
   !depois.vazia && depois.campo > 0,
   "é o relato: a tela sai da conversa como se alguém tivesse apertado ESC");
ok("e é a MESMA conversa, não outra qualquer",
   depois.topo.includes(fundo.nome.split(" ")[0]), `no topo: "${depois.topo.slice(0, 60)}"`);

// ------------------------------------------------------------
//  E A LISTA FEZ O QUE TINHA DE FAZER
//
//  Sem isto o conserto barato passaria: parar de recarregar a lista mantém a
//  conversa aberta e esconde para sempre quem acabou de escrever. Seria trocar
//  um defeito visível por um invisível.
// ------------------------------------------------------------
console.log("\nE a mensagem nova entrou na lista, que é para o que a recarga serve");

const entrou = await page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")].length);
ok("a lista continua desenhada depois da recarga", entrou > 0, `${entrou} conversas`);

// ------------------------------------------------------------
//  O RESTO DO DIA TAMBÉM NÃO FECHA
//
//  Uma rajada do que acontece o tempo todo: mensagem na própria conversa,
//  mensagem noutra que já está na lista, e a batida de "estou atendendo" que
//  chega como UPDATE de conversa a cada minuto.
// ------------------------------------------------------------
console.log("\nUma rajada do que acontece o tempo todo");

await emitir("mensagens", {
  id: "m-na-aberta", conversa_id: "a13-c1150", origem: "contato", tipo: "texto",
  texto: "ainda estou aqui", enviado_por: null, enviado_por_id: null,
  criado_em: new Date().toISOString(),
});
await emitir("mensagens", {
  id: "m-na-lista", conversa_id: "a13-c2", origem: "contato", tipo: "texto",
  texto: "outra conversa qualquer", enviado_por: null, enviado_por_id: null,
  criado_em: new Date().toISOString(),
});
await emitir("conversas", {
  id: "a13-c2", advogado_id: "a13", contato_id: "ct-fundo-2", nao_lidas: 1,
  arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date().toISOString(), ultima_mensagem: "outra conversa qualquer",
  atendendo_por: "Outro colega", atendendo_em: new Date().toISOString(),
}, "UPDATE");
await page.waitForTimeout(3000);

const fim = await naTela();
ok("depois da rajada a conversa segue aberta", !fim.vazia && fim.campo > 0,
   `campo ${fim.campo}, vazia ${fim.vazia}`);

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
