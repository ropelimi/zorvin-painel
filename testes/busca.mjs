// PROVA DA BUSCA — procurar pelo nome que está na tela tem de achar.
//
// Três casos, todos reais:
//
//   1. O contato cujo nome vem do CADASTRO do Vantoro. A lista mostra
//      "MARIA DAS GRAÇAS PEREIRA"; o `nome` do contato ainda é "Deusdete", o
//      apelido que ele deixou no WhatsApp.
//   2. O contato batizado AQUI DENTRO (`nome_zorvin`) — o lead que ainda não
//      virou cadastro.
//   3. O contato que está DEPOIS da milésima conversa. A API do Supabase
//      devolve no máximo 1000 linhas e cala; uma busca feita sobre a lista que
//      está na tela não alcança ninguém que esteja além disso.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const URL = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, detalhe = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? " — " + detalhe : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(1500);

const caixa = page.locator('input[placeholder*="Buscar por nome"]');

/** Digita na busca e devolve os nomes que sobraram na lista de conversas. */
async function procurar(termo) {
  await caixa.fill("");
  await page.waitForTimeout(150);
  await caixa.fill(termo);
  // 350ms de espera da própria busca + folga para a consulta responder.
  await page.waitForTimeout(1800);
  return page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome")));
}

async function trocarTelefone(nome) {
  const alvo = page.locator(`[data-telefone="${nome}"]`);
  if (!(await alvo.count())) return false;
  await alvo.first().click();
  await page.waitForTimeout(2200);
  return true;
}

console.log("\nBusca por nome");

// ---- 1. o nome que veio do cadastro do Vantoro ----
{
  const achados = await procurar("GRAÇAS");
  ok('acha pelo nome do CADASTRO ("MARIA DAS GRAÇAS PEREIRA")',
     achados.some((n) => /GRA[ÇC]AS/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 2. o nome dado aqui dentro ----
{
  const achados = await procurar("Feira do Livro");
  ok('acha pelo nome dado no Zorvin ("Lead Feira do Livro")',
     achados.some((n) => /Feira do Livro/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 3. o nome que o WhatsApp deu continua achando ----
{
  const achados = await procurar("JOSEFA");
  ok("acha pelo nome que veio do WhatsApp",
     achados.some((n) => /JOSEFA/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 4. o apelido continua servindo, mesmo quando não é o nome mostrado ----
{
  const achados = await procurar("Deusdete");
  ok("acha pelo apelido do WhatsApp, mesmo com o cadastro por cima",
     achados.some((n) => /GRA[ÇC]AS|Deusdete/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 5. o que está depois da milésima conversa ----
{
  const nome = await page.evaluate(() => globalThis.__ESPERADO.fundo.nome);
  const foi = await trocarTelefone("Arquivo");
  ok("consigo abrir o telefone com mais de mil conversas", foi);
  if (foi) {
    const quantas = await page.evaluate(() => document.querySelectorAll("[data-conversa-nome]").length);
    console.log(`     a lista trouxe ${quantas} conversas de 1200`);
    const achados = await procurar(nome.split(" ")[0]);
    ok(`acha "${nome}", que está na conversa 1151 de 1200`,
       achados.some((n) => (n || "").includes(nome)), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
  }
}

// ---- 6. pelo TEXTO de uma mensagem, numa conversa que a lista não trouxe ----
{
  const texto = await page.evaluate(() => globalThis.__ESPERADO.fundo.texto);
  const achados = await procurar(texto);
  ok(`acha pelo que foi DITO na conversa ("${texto}")`, achados.length > 0,
     `veio: ${JSON.stringify(achados.slice(0, 5))}`);
  ok("e explica por que aquela conversa apareceu",
     /💬/.test(await page.locator('[data-conversa-nome]').first().innerText()));
}

// ---- 7. termo com parêntese não derruba a busca ----
// A vírgula e os parênteses separam condições dentro de um `or` do PostgREST:
// deixá-los passar não devolve "nada encontrado", devolve ERRO — e a busca
// inteira morria em silêncio ao procurar por um telefone escrito à mão.
{
  // De volta ao telefone onde esse contato conversa: o teste anterior trocou
  // para o "Arquivo", e a busca é por telefone — procurar aqui não acharia nada
  // por um motivo legítimo, e a conferência acusaria um defeito que não existe.
  await trocarTelefone("Acordos 1");
  const achados = await procurar("(67) 99111-0001");
  ok("procurar um telefone escrito à mão acha o contato", achados.length > 0,
     `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 8. busca curta não filtra nada, e limpar devolve a lista ----
{
  const achados = await procurar("");
  ok("apagar a busca devolve a lista inteira", achados.length > 5, `veio ${achados.length}`);
}

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
