// A FAIXA ÂMBAR APAGA QUANDO A LEITURA VOLTA — e os selos da barra dizem
// quando não vieram (auditoria de 28/10)
//
// A faixa âmbar (`data-falha-de-leitura`) é a promessa de 04/09: o que não
// carregou é dito, e a faixa "fica até a leitura dar certo — e some sozinha
// quando der". Duas metades dela estavam quebradas:
//
//   * OS DEPARTAMENTOS E OS TELEFONES, relidos ao fechar "Departamentos e
//     acessos", eram anotados quando falhavam e nunca eram limpos — e o botão
//     "Tentar de novo" não relia nem eles, nem as figurinhas. A faixa ficava
//     para sempre, e se aprende a não ler faixa que nunca apaga.
//
//   * OS SELOS DA BARRA: a função que conta as não lidas de cada telefone,
//     falhando por qualquer motivo que não "não existe", saía com `return`
//     calado — os selos ficavam com o número de antes, com cara de número de
//     agora. E a conta das arquivadas não guardava DE QUAL telefone era: a do
//     telefone A chegando depois da do B acendia a linha "Arquivadas" no B.
//
// O QUE ESTA PROVA GUARDA: a faixa acende e APAGA (pelo "Tentar de novo")
// para os departamentos, os telefones, as figurinhas e os selos; e a linha
// "Arquivadas" de um telefone não é acesa pela conta atrasada de outro.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrir({ recusarLeitura = [], quebrarFuncao = [], atrasoDosSelosDe = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SOU_ADMIN = true;
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura;
    globalThis.__QUEBRAR_FUNCAO = d.quebrarFuncao;
    // A CONTA DOS SELOS DE UM TELEFONE SÓ, devagar: é a corrida entre a
    // resposta dele e a do telefone escolhido depois.
    globalThis.__ATRASO_POR_FUNCAO = d.atrasoDosSelosDe
      ? { nao_lidas_por_telefone: (a) => (a.p_advogado === d.atrasoDosSelosDe ? 2500 : 0) } : {};
  }, { recusarLeitura, quebrarFuncao, atrasoDosSelosDe });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
async function clicar(page, alvo) {
  const el = typeof alvo === "string" ? page.locator(alvo) : alvo;
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const faixa = (page) => page.locator("[data-falha-de-leitura]").count();
const textoDaFaixa = (page) => page.locator("[data-falha-de-leitura]").innerText().catch(() => "");

// ==================================================================
console.log("\n1. Os departamentos e os telefones de “Departamentos e acessos”");
{
  const { ctx, page, estouros } = await abrir();
  await clicar(page, page.getByRole("button", { name: "Menu", exact: true }));
  ok("abri “Departamentos e acessos”", await clicar(page, page.getByRole("button", { name: /Departamentos e acessos/ })));
  await page.waitForTimeout(800);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["advogados", "departamentos"]; });
  // PELO "X" DA TELA: é o botão de fechar que relê as listas.
  ok("fechei pelo botão da própria tela", await clicar(page, '[aria-label="Fechar"]'));
  await page.waitForTimeout(1200);
  const texto = await textoDaFaixa(page);
  ok("a faixa diz que os departamentos e os telefones não vieram", /departamentos/.test(texto) && /telefones/.test(texto), texto);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(2000);
  ok("com a leitura de volta, a faixa apaga", (await faixa(page)) === 0, await textoDaFaixa(page));
  ok("e os telefones continuam na barra", (await page.locator("[data-telefone]").count()) > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. As figurinhas guardadas");
{
  const { ctx, page, estouros } = await abrir({ recusarLeitura: ["figurinhas_favoritas"] });
  ok("a faixa diz que as figurinhas não vieram", /figurinhas/.test(await textoDaFaixa(page)), await textoDaFaixa(page));
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(2000);
  ok("com a leitura de volta, a faixa apaga", (await faixa(page)) === 0, await textoDaFaixa(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Os selos da barra: a conta que falha é dita");
{
  const { ctx, page, estouros } = await abrir({ quebrarFuncao: ["nao_lidas_por_telefone"] });
  const texto = await textoDaFaixa(page);
  ok("a faixa diz que o número de não lidas não veio", /não lidas/.test(texto), texto);
  ok("com o código do banco", /57014/.test(texto), texto);
  await page.evaluate(() => { globalThis.__QUEBRAR_FUNCAO = []; });
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(2000);
  ok("com a conta de volta, a faixa apaga", (await faixa(page)) === 0, await textoDaFaixa(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. A conta atrasada de um telefone não acende a linha “Arquivadas” de outro");
{
  // O telefone de 1.200 conversas tem uma arquivada, e a conta dele demora;
  // o "Acordos 1", onde o painel abre, não tem nenhuma.
  const { ctx, page, estouros } = await abrir({ atrasoDosSelosDe: "a13" });
  const linha = () => page.locator('text="Arquivadas"').count();
  ok("no telefone de abertura não há a linha “Arquivadas”", (await linha()) === 0);
  ok("fui ao telefone de 1.200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(300);
  ok("e voltei antes de a conta dele chegar", await clicar(page, '[data-telefone="Acordos 1"]'));
  await page.waitForTimeout(4000);
  ok("a conta atrasada do outro telefone não acendeu a linha aqui", (await linha()) === 0);
  // O CONTRASTE: no telefone de 1.200, com a conta dele na mão, a linha existe.
  await clicar(page, '[data-telefone="Arquivo"]');
  await page.waitForTimeout(4500);
  ok("no telefone que tem arquivada, a linha aparece", (await linha()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
