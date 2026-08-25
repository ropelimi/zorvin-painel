// DOIS CLIENTES NO MESMO NÚMERO — mãe e filho, marido e mulher, o telefone de
// uma empresa. Um número serve mais de um cliente, e isso é normal.
//
// A ficha ficava com `clientes[0]` e jogava fora o resto, sem dizer nada. A API
// sempre devolveu até CINCO cadastros, exatamente porque isso acontece — e a
// ordem dela é pelo cadastro mais recente, quer dizer, "quem foi cadastrado por
// último". Isso não é uma resposta: é um sorteio.
//
// E O SORTEIO DECIDIA PARA QUEM IAM AS NOTAS INTERNAS. O vínculo escolhido é
// gravado no contato, e é por ele que a nota escrita naquela conversa sobe para
// uma ficha. Errar aqui põe o caso de um cliente no histórico de outro — numa
// banca isso não é defeito de software, é incidente com o cliente.
//
// O QUE ESTA PROVA NÃO DEIXA PASSAR:
//
//   1. escolher sozinho quando há mais de um. É o defeito;
//   2. PERGUNTAR quando só existe um. A imensa maioria dos números tem um
//      cadastro só; uma pergunta ali seria um estorvo em cada atendimento;
//   3. perguntar de novo depois de já ter sido respondido. A escolha fica
//      gravada — e uma pergunta que volta todo dia é uma pergunta que ninguém
//      lê;
//   4. o aviso SUMIR depois da escolha. Quem abrir a conversa amanhã precisa
//      saber que o número serve outra pessoa também, senão anota na ficha
//      errada achando que só existe uma.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// A MÃE E O FILHO, no mesmo número. Em ordem de "cadastro mais recente
// primeiro", que é como a API do Vantoro devolve — então `[0]` seria o FILHO.
// É de propósito: a prova precisa poder distinguir "escolheu certo" de "pegou
// o primeiro".
const MAE = { id: "v-mae", nome: "MARIA DAS GRACAS PEREIRA", cpf: "111.111.111-11",
              telefone: "5567992183107", documentos: 0, processos: [], ordem_servico: null };
const FILHO = { id: "v-filho", nome: "JOAO PEREIRA NETO", cpf: "222.222.222-22",
                telefone: "5567992183107", documentos: 0, processos: [], ordem_servico: null };

let QUANTOS = 2;                 // 2 = mãe e filho; 1 = só a mãe
let VINCULO_GRAVADO = null;      // o que o contato já tem gravado

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (url.pathname.endsWith("/vantoro/cliente")) {
    const lista = QUANTOS === 1 ? [MAE] : [FILHO, MAE];   // o mais novo primeiro
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ clientes: lista, opcoes: {} }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

// O VÍNCULO JÁ GRAVADO no contato. A bancada guarda os contatos em memória;
// aqui só se escreve o campo antes de abrir a ficha, que é o estado de "alguém
// já respondeu esta pergunta antes".
async function plantarVinculo(id) {
  VINCULO_GRAVADO = id;
  await page.evaluate((v) => {
    const t = globalThis.__TABELAS;
    if (!t || !t.contatos) return;
    for (const c of t.contatos) c.vantoro_cliente_id = v;
  }, id);
}

async function abrirConversaEFicha() {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1000);
  const b = page.getByRole("button", { name: /Ficha no Vantoro/ });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(1400);
}

async function recomecar() {
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1400);
}

console.log("\nCom dois cadastros no número, a ficha PERGUNTA");
{
  QUANTOS = 2;
  await recomecar();
  await plantarVinculo(null);
  await abrirConversaEFicha();

  ok("aparece o seletor de cadastro",
     await page.locator("[data-escolher-cadastro]").count() === 1);
  ok("com os dois nomes",
     /MARIA DAS GRACAS/.test(await page.locator("body").innerText())
     && /JOAO PEREIRA NETO/.test(await page.locator("body").innerText()));

  // A CONFERÊNCIA QUE IMPORTA: nenhum dos dois foi adotado sozinho. Antes,
  // `clientes[0]` (o FILHO) virava o dono da conversa sem ninguém decidir.
  const camposEditaveis = await page.locator('input[value="JOAO PEREIRA NETO"]').count();
  ok("e NENHUM dos dois é adotado sozinho", camposEditaveis === 0,
     "a ficha abriu já preenchida com um deles — foi um sorteio, não uma escolha");
}

console.log("\nEscolhendo, a ficha abre naquele cadastro");
{
  await page.locator('[data-candidato="v-mae"]').click();
  await page.waitForTimeout(900);
  const texto = await page.locator("body").innerText();
  ok("a ficha passa a ser a da mãe", /MARIA DAS GRACAS/.test(texto));

  // O AVISO FICA. Quem abrir amanhã precisa saber que o número serve outra
  // pessoa também — senão anota na ficha errada achando que só existe uma.
  ok("e o aviso de que há outro cadastro CONTINUA na tela",
     await page.locator("[data-outro-cadastro]").count() === 1);
  ok("com o botão de trocar",
     await page.locator("[data-trocar-cadastro]").count() === 1);
}

console.log("\nRespondido uma vez, não pergunta de novo");
{
  QUANTOS = 2;
  await recomecar();
  await plantarVinculo("v-mae");
  await abrirConversaEFicha();

  ok("não mostra o seletor",
     await page.locator("[data-escolher-cadastro]").count() === 0,
     "uma pergunta que volta todo dia é uma pergunta que ninguém lê");
  ok("e abre direto no cadastro escolhido",
     /MARIA DAS GRACAS/.test(await page.locator("body").innerText()));
  // E NÃO NO PRIMEIRO DA LISTA. Sem a memória, seria o filho de novo.
  ok("e não no primeiro da lista",
     await page.locator('input[value="JOAO PEREIRA NETO"]').count() === 0);
}

console.log("\nDá para trocar depois, se a escolha foi errada");
{
  await page.locator("[data-trocar-cadastro]").click();
  await page.waitForTimeout(500);
  ok("o seletor volta", await page.locator("[data-escolher-cadastro]").count() === 1);
  await page.locator('[data-candidato="v-filho"]').click();
  await page.waitForTimeout(900);
  ok("e a ficha passa a ser a do filho",
     /JOAO PEREIRA NETO/.test(await page.locator("body").innerText()));
}

console.log("\nCom um cadastro só, NADA muda");
{
  // A imensa maioria dos números tem um cadastro só. Uma pergunta ali seria um
  // estorvo em cada atendimento, todo dia — e é assim que uma proteção boa vira
  // a coisa que todo mundo aprende a ignorar.
  QUANTOS = 1;
  await recomecar();
  await plantarVinculo(null);
  await abrirConversaEFicha();

  ok("não pergunta nada", await page.locator("[data-escolher-cadastro]").count() === 0);
  ok("não avisa de outro cadastro", await page.locator("[data-outro-cadastro]").count() === 0);
  ok("e abre a ficha direto",
     /MARIA DAS GRACAS/.test(await page.locator("body").innerText()));
}

ok("sem erro de JavaScript no caminho", erros.length === 0,
   erros.slice(0, 2).join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
