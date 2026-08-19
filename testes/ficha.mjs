// A FICHA DO CLIENTE — a coluna que mostra o cadastro do Vantoro ao lado da
// conversa.
//
// Ela nunca tinha sido exercitada: a bancada não tem ponte, então `chamarPonte`
// desistia na primeira linha e a tela passava no teste MOSTRANDO A MENSAGEM DE
// ERRO. Aqui o endereço da ponte existe e quem responde por ele é este teste,
// interceptando a rede — o código do painel roda inteiro, sem saber.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const PAGINA = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Dois clientes bem diferentes, para não haver dúvida sobre qual apareceu.
// A senha do SERASA está aqui de propósito: é o tipo de dado que esta tela
// mostra, e trocar um cliente pelo outro não é um detalhe de layout.
const CLIENTES = {
  "5567992183107": { id: "v-100", nome: "ANDREIA CRISTINA MARTINS",
                     cpf: "111.111.111-11", senha_serasa: "senha-da-andreia",
                     documentos: 3, processos: [], ordem_servico: null },
  "5567991110001": { id: "v-200", nome: "MARIA DAS GRACAS PEREIRA",
                     cpf: "222.222.222-22", senha_serasa: "senha-da-maria",
                     documentos: 1, processos: [], ordem_servico: null },
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// A PONTE DE MENTIRA. A ficha do primeiro cliente demora; a do segundo é
// instantânea. É essa diferença que revela quem escreve por último.
let SEM_PENDENCIAS = false;
const pedidos = [];
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  pedidos.push(url.pathname + url.search);
  if (url.pathname.endsWith("/vantoro/cliente")) {
    const tel = (url.searchParams.get("telefone") || "").replace(/\D/g, "");
    let achado = CLIENTES[tel];
    // Uma ordem de serviço SEM a lista de pendências: é uma forma que o Vantoro
    // pode mandar, e a tela precisa aguentar.
    if (achado && SEM_PENDENCIAS) achado = { ...achado, ordem_servico: { status: "EM ANDAMENTO" } };
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ clientes: achado ? [achado] : [], opcoes: {} }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(PAGINA);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

async function abrir(nomeDaConversa) {
  await page.locator(`[data-conversa-nome*="${nomeDaConversa}"]`).first().click();
  await page.waitForTimeout(1200);
}
async function abrirFicha() {
  const b = page.getByRole("button", { name: /Ficha no Vantoro/ });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(1500);
}
const textoDaFicha = () => page.locator('input[value], div').first().evaluate(() => document.body.innerText);

console.log("\n1. A ficha mostra o cadastro");
{
  await abrir("Deus");
  await abrirFicha();
  const texto = await page.locator("body").innerText();
  ok("a ficha traz o cliente deste número",
     /ANDREIA CRISTINA MARTINS/i.test(texto),
     `pedidos: ${JSON.stringify(pedidos.slice(-2))}`);
}

console.log("\n2. Uma ordem de serviço sem pendências não derruba a tela");
// ------------------------------------------------------------------
// `cliente.ordem_servico.pendencias.length` — sem conferir se `pendencias`
// existe. O Vantoro manda a ordem de serviço; se um dia mandar uma sem a lista
// (ou com ela nula), isto estoura. E no React 18 um erro assim não mostra
// mensagem nenhuma: ele MATA a árvore onde aconteceu. A ficha inteira some, e
// o que sobra é uma coluna em branco ao lado da conversa.
{
  SEM_PENDENCIAS = true;
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  const antes = erros.length;
  await abrir("Deus");
  await abrirFicha();
  const texto = await page.locator("body").innerText();
  ok("a ficha continua de pé",
     /ANDREIA CRISTINA MARTINS/i.test(texto) && erros.length === antes,
     erros.slice(antes).join(" | ").slice(0, 160) || "a ficha sumiu da tela");
  SEM_PENDENCIAS = false;
}

console.log("\n3. O que foi digitado não se perde sem aviso");
// ------------------------------------------------------------------
// A ficha é um formulário com CPF, endereço, nascimento, senhas. Fechar
// descartava tudo o que tinha sido digitado, calado. Quem preencheu meia ficha
// e tocou no X sem querer perdia o trabalho e não recebia nem um aviso.
{
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();

  // Pelo NOME do campo, e não pela posição na página: a posição muda com
  // qualquer mexida de layout, e um teste que quebra por isso não está medindo
  // nada.
  const cpf = page.locator('[data-campo="cpf"]');
  if (await cpf.count()) {
    await cpf.fill("999.888.777-66");
    await page.waitForTimeout(300);
    let perguntou = false;
    page.once("dialog", (d) => { perguntou = true; d.dismiss(); });
    const fechar = page.getByRole("button", { name: "Fechar" });
    if (await fechar.count()) await fechar.first().click();
    await page.waitForTimeout(900);
    const aindaAberta = await page.getByRole("button", { name: /Salvar no Vantoro/ }).count() > 0;
    ok("fechar a ficha com alteração não gravada pergunta antes",
       perguntou && aindaAberta,
       perguntou ? "perguntou, mas fechou assim mesmo"
                 : "fechou e levou junto o que tinha sido digitado, sem perguntar nada");
  } else {
    ok("fechar a ficha com alteração não gravada pergunta antes", false, "campo não encontrado");
  }
}

console.log("\n4. Sem nada digitado, fechar é fechar");
{
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();
  let perguntou = false;
  page.once("dialog", (d) => { perguntou = true; d.accept(); });
  const fechar = page.getByRole("button", { name: "Fechar" });
  if (await fechar.count()) await fechar.first().click();
  await page.waitForTimeout(900);
  const fechou = await page.getByRole("button", { name: /Salvar no Vantoro/ }).count() === 0;
  ok("sem alteração, fechar não pergunta nada", fechou && !perguntou,
     perguntou ? "perguntou sem haver o que perder — vira um aviso que se aprende a ignorar"
               : "a ficha não fechou");
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
