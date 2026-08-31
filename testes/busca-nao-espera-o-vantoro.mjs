// A BUSCA NÃO PODE FICAR REFÉM DO VANTORO.
//
// RELATO DE QUEM USA, 31/08, com foto: "está lento para pesquisar clientes,
// nunca aparece". Na foto, a caixa de busca com um nome digitado e, embaixo,
// "Procurando…" — parado ali.
//
// O QUE ACONTECIA. A busca faz duas perguntas em lugares diferentes:
//
//   1. ao BANCO (Supabase), que responde em milissegundos e é quem acha as
//      conversas;
//   2. ao CADASTRO (Vantoro, atrás da ponte), que só ACRESCENTA o nome do
//      cliente às conversas já achadas — e que oferece começar conversa com
//      quem ainda não tem uma.
//
// A segunda vinha ANTES de desenhar a primeira:
//
//     const doCadastro = await procurarNoVantoro(...);   // ← espera aqui
//     ...
//     setExtras(...);        // as conversas que o BANCO já tinha achado
//     setBuscando(false);    // e o "Procurando…" só saía aqui
//
// O Vantoro e a ponte rodam no plano free da Render e HIBERNAM. A primeira
// chamada depois de um tempo parado leva perto de um minuto — e este `fetch`
// era o único do painel feito por fora do `ponte.js`, portanto o único SEM
// prazo nenhum. Se não voltasse, não voltava nunca.
//
// Resultado: o banco tinha a resposta na mão e a tela dizia "Procurando…".
//
// Agora são dois tempos. O que é do banco aparece de imediato; o que vem do
// cadastro chega depois, se chegar — e desiste em trinta segundos.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O VANTORO DORMINDO. A chamada não é recusada nem responde: fica pendurada,
// que é exatamente o que a Render faz enquanto acorda o serviço. Se a busca
// esperar por ela, esta prova reprova.
let pedidosAoVantoro = 0;
await page.route("**/vantoro/buscar*", async (rota) => {
  pedidosAoVantoro += 1;
  await new Promise((r) => setTimeout(r, 60000));   // mais do que a prova espera
  rota.abort();
});

await page.goto(ENDERECO);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(1800);

const caixa = page.locator('input[placeholder*="Buscar por nome"]');
const naLista = () => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome")));
const dizProcurando = async () =>
  /Procurando…/.test(await page.locator("body").innerText());

// O ALVO TEM DE SER ALGUÉM QUE SÓ O BANCO ACHA.
//
// A primeira versão desta prova procurava um nome que já estava na lista
// carregada. O painel filtra a lista em memória, então ele aparecia sem o
// banco precisar responder — e o "Procurando…" nem chegava a ser desenhado
// (ele só aparece quando a lista filtrada fica vazia). A prova passava com o
// conserto E sem ele: uma prova que não conseguia reprovar, escrita por mim,
// na semana em que passei varrendo exatamente isso. A sabotagem denunciou.
//
// "ZULMIRA ANTUNES DO PRADO" é a conversa 1151 de 1200 do telefone Arquivo, e
// a lista carrega 40. Não há como ela aparecer sem o banco responder.
const ALVO = "ZULMIRA";

console.log("\n1. Com o Vantoro pendurado, o que o banco achou aparece assim mesmo");
{
  // O TELEFONE COM MIL E DUZENTAS CONVERSAS. É o único lugar da bancada onde
  // "não está na lista carregada" é verdade.
  const alvoTel = page.locator('[data-telefone="Arquivo"]');
  ok("achei o telefone com mais de mil conversas", await alvoTel.count() > 0);
  await alvoTel.first().click();
  await page.waitForTimeout(2500);

  const carregadas = await naLista();
  ok("e a lista dele NÃO traz a conversa procurada",
     !carregadas.some((n) => (n || "").toUpperCase().includes(ALVO)),
     `a lista já tinha ${ALVO} — esta prova não mediria nada`);

  await caixa.fill("");
  await page.waitForTimeout(200);
  await caixa.fill(ALVO);

  // TRÊS SEGUNDOS. São 350 ms de espera da própria busca mais folga larga para
  // o banco responder — e MUITO menos do que o minuto que a chamada ao Vantoro
  // vai levar. É essa distância que a prova mede: sem o conserto, aqui ainda
  // estaria escrito "Procurando…".
  await page.waitForTimeout(3000);

  const nomes = await naLista();
  ok("a busca chegou a perguntar ao Vantoro", pedidosAoVantoro > 0,
     "não perguntou — a prova não está medindo o que diz medir");
  ok("o 'Procurando…' saiu da tela", !(await dizProcurando()),
     "a busca continua pendurada esperando o cadastro");
  ok("e a conversa achada pelo banco está na lista",
     nomes.some((n) => (n || "").toUpperCase().includes(ALVO)),
     `veio: ${JSON.stringify(nomes.slice(0, 6))}`);
}

console.log("\n2. E a busca continua servindo para outra coisa depois");
{
  // A TRAVA CONTRA O CONSERTO PELA METADE: adiantar o desenho e deixar a busca
  // num estado quebrado seria trocar um defeito por outro. Apagar o termo tem
  // de devolver a lista inteira, com o Vantoro ainda pendurado.
  await caixa.fill("");
  await page.waitForTimeout(1500);
  const nomes = await naLista();
  ok("apagar a busca devolve a lista de conversas", nomes.length > 3,
     `sobraram ${nomes.length}`);
  ok("e não ficou nenhum 'Procurando…' preso", !(await dizProcurando()));
}

console.log("\n3. Uma busca sem resultado diz que não achou, e não fica procurando");
{
  // "Nada encontrado" e "Procurando…" são respostas opostas, e a segunda é a
  // que faz a pessoa esperar. Sem o conserto, esta busca também ficaria presa.
  await caixa.fill("ZZZZNINGUEMZZZZ");
  await page.waitForTimeout(3000);
  const texto = await page.locator("body").innerText();
  ok("a tela diz que não achou nada", /Nada encontrado/i.test(texto),
     texto.slice(0, 200));
  ok("e não continua dizendo que está procurando", !/Procurando…/.test(texto));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
