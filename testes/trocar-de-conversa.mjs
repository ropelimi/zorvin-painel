// TROCAR DE CONVERSA — sem mostrar a conversa de outro cliente no caminho.
//
// Relato do escritório: "quando mudamos de uma conversa para outra, está
// demorando para carregar a nova — isso pode ocasionar em um erro do usuário
// enviando a mensagem para a conversa errada".
//
// São dois problemas, e o segundo é o perigoso:
//
//   1. A DEMORA. As três leituras que montam a conversa — mensagens, notas e a
//      fila de erro — saíam em fila indiana, cada uma esperando a anterior
//      VOLTAR para começar. Nenhuma depende do resultado das outras: a espera
//      era só a ordem em que estavam escritas. Num 4G do fórum, três voltas de
//      rede em série são o que se sente como "demora a abrir".
//
//   2. O FANTASMA. A lista de mensagens só era trocada DEPOIS das consultas
//      voltarem. Nesse intervalo o cabeçalho já era o do contato novo, o
//      destino do envio já era o novo, e o que estava desenhado embaixo ainda
//      era a conversa ANTERIOR. Quem olha a tela para saber com quem está
//      falando lia a resposta errada — e é exatamente para isso que se olha.
//
// Esvaziar é melhor do que mostrar outra coisa: vazio ninguém confunde com o
// histórico de alguém; a conversa de outro cliente, sim.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const ATRASO = 300;   // por tabela, na bancada

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Os nomes das duas primeiras conversas da lista. */
const nomes = await page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")]
    .slice(0, 2).map((e) => e.getAttribute("data-conversa-nome")));

async function abrir(i) {
  await page.locator("[data-conversa-nome]").nth(i).click();
}
const quantasBolhas = () => page.evaluate(() =>
  document.querySelectorAll("[data-msg-id]").length);

console.log("\nAs três leituras da conversa saem JUNTAS");
{
  // Em fila indiana o custo é a soma dos atrasos (3 × 300 = 900ms+); juntas, é
  // o maior deles (300ms+). A régua fica no meio, com folga dos dois lados.
  await page.evaluate((ms) => {
    globalThis.__ATRASO_POR_TABELA = { mensagens: ms, notas: ms, fila_envio: ms };
  }, ATRASO);

  await abrir(0);
  await page.waitForTimeout(1600);          // assenta a primeira

  const t0 = await page.evaluate(() => performance.now());
  await abrir(1);
  // Espera as bolhas da nova aparecerem.
  await page.waitForFunction(() => document.querySelectorAll("[data-msg-id]").length > 0,
                             null, { timeout: 8000 }).catch(() => {});
  const gasto = await page.evaluate((t) => performance.now() - t, t0);

  console.log(`     abriu em ${gasto.toFixed(0)} ms (atraso de ${ATRASO} ms por tabela)`);
  ok("abre no tempo de UMA leitura, e não de três",
     gasto < ATRASO * 2.2,
     `${gasto.toFixed(0)} ms — três em série dariam mais de ${ATRASO * 3} ms`);

  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = {}; });
}

console.log("\nEnquanto a nova carrega, a ANTERIOR não fica na tela");
{
  // A conferência que importa. O atraso é grande de propósito: é dentro dele
  // que o atendente digita e aperta enter.
  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = { mensagens: 1500 }; });

  await abrir(0);
  await page.waitForTimeout(2500);
  const antes = await quantasBolhas();
  ok("a primeira conversa está desenhada", antes > 0, `${antes} bolhas`);

  await abrir(1);
  await page.waitForTimeout(400);           // dentro do atraso, de propósito

  const durante = await quantasBolhas();
  ok("no meio da troca, NENHUMA bolha da conversa anterior está na tela",
     durante === 0,
     `ficaram ${durante} bolhas — são as do outro cliente, embaixo do nome deste`);

  // E o cabeçalho já é o do novo: é essa combinação — nome novo, mensagens
  // velhas — que faz alguém responder a pessoa errada.
  const cabecalho = await page.evaluate(() => document.body.innerText.slice(0, 400));
  ok("e o cabeçalho já é o do contato novo",
     nomes[1] && cabecalho.includes(nomes[1]),
     `esperava "${nomes[1]}"`);

  await page.waitForTimeout(2200);
  ok("e as da conversa nova chegam depois", await quantasBolhas() >= 0);

  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = {}; });
}

console.log("\nReabrir a MESMA conversa não pisca a tela");
{
  // A busca por mensagem recarrega a conversa que já está aberta para saltar
  // até a linha achada. Esvaziar ali seria um piscar a cada busca — e o que se
  // quer evitar é mostrar OUTRA conversa, não mostrar a mesma.
  await abrir(0);
  await page.waitForTimeout(1800);
  const antes = await quantasBolhas();
  await abrir(0);                            // a mesma de novo
  await page.waitForTimeout(120);
  ok("as bolhas continuam na tela", await quantasBolhas() === antes,
     `${antes} → ${await quantasBolhas()}`);
}

ok("sem erro de JavaScript no caminho", erros.length === 0,
   erros.slice(0, 2).join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
