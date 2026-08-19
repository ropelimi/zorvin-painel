// A TELA DE ENTRADA QUANDO A PONTE NÃO RESPONDE.
//
// O relato veio do celular: apertar Entrar, o botão girar por um minuto e
// aparecer "Load failed". Isso é o Safari dizendo, em inglês, que a conexão
// não completou — não diz o que houve nem o que fazer.
//
// E o que costuma haver é conhecido: a ponte roda no plano gratuito da Render
// e hiberna quando fica um tempo sem receber nada. A primeira entrada do dia
// acorda o servidor, e isso leva de trinta segundos a um minuto — mais do que
// o navegador do celular espera antes de desistir.
//
// Esta prova é a primeira a exercitar a tela de entrada. Ela existia desde o
// começo, é a primeira que a equipe vê todo dia, e é a única que fala com a
// ponte antes de haver sessão — e nenhuma prova passava por ela, porque a
// bancada sempre subiu logada.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const PAGINA = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 420, height: 820 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// Como a ponte vai se comportar nesta tentativa. Trocado entre uma seção e
// outra, é o que faz esta prova cobrir as três falhas diferentes sem precisar
// de três servidores.
let comoResponder = "ok";
await page.route("**/ponte-de-mentira/auth/login", async (rota) => {
  if (comoResponder === "muda")       return;            // nunca responde
  if (comoResponder === "sem-rede")   return rota.abort("failed");
  if (comoResponder === "senha-errada") {
    return rota.fulfill({ status: 401, contentType: "application/json",
      body: JSON.stringify({ ok: false, erro: "Usuário ou senha incorretos." }) });
  }
  await new Promise((r) => setTimeout(r, 300));
  rota.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, token_hash: "hash-de-mentira" }) });
});

// A bancada sobe logada. Esta bandeira faz a sessão vir vazia, que é o que põe
// a tela de entrada na frente.
await page.addInitScript(() => { globalThis.__DESLOGADO = true; });
await page.goto(PAGINA);
await page.waitForSelector('button[type="submit"]');

const botao = page.locator('button[type="submit"]');
const aviso = page.locator('[role="alert"]');
const espera = page.locator('[role="status"]');

async function tentarEntrar() {
  await page.locator("input").first().fill("rodrigo.sousa");
  await page.locator('input[type="password"]').fill("uma-senha-qualquer");
  await botao.click();
}

console.log("\nA tela de entrada aparece");
{
  const texto = await page.locator("body").innerText();
  ok("sem sessão, a tela de entrada é a que abre", /Usuário do Vantoro/i.test(texto));
  ok("e o botão está pronto", await botao.isDisabled() === false);
}

console.log("\nQuando a ponte está acordando");
{
  // O caso do relato. Enquanto se espera, a tela tem de DIZER o que está
  // havendo: um botão girando sem fim é indistinguível de um travamento, e
  // quem fecha a página perde justamente a segunda tentativa, que entraria na
  // hora.
  comoResponder = "muda";
  await tentarEntrar();
  await page.waitForTimeout(1200);
  ok("logo no começo não enche a tela de aviso",
     await espera.count() === 0,
     "a maioria das entradas responde em menos de um segundo");

  await page.waitForTimeout(3800);
  ok("passados alguns segundos, ela explica a espera", await espera.count() === 1);
  const t = (await espera.innerText()).replace(/\s+/g, " ");
  ok("e diz que é o servidor acordando", /dormindo|acordando/i.test(t), `dizia: "${t}"`);
  ok("e que da próxima vez é rápido", /rápido|minuto/i.test(t), `dizia: "${t}"`);
}

console.log("\nQuando ela não responde de jeito nenhum");
{
  // O limite é de 75 segundos em produção — mais do que a Render leva para
  // acordar. Na bancada são 6, senão esta prova levaria mais de um minuto e
  // ninguém a rodaria.
  await page.waitForTimeout(3500);
  ok("depois do tempo limite, desiste", await aviso.count() === 1,
     "sem limite, o botão gira para sempre e o navegador é que decide a mensagem");
  const t = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("em português", /servidor demorou|hiberna/i.test(t), `dizia: "${t}"`);
  ok("dizendo o que fazer", /tente de novo/i.test(t), `dizia: "${t}"`);
  ok("e o botão volta a poder ser apertado", await botao.isDisabled() === false,
     "desistir sem devolver o botão é pior do que não desistir");
  ok("o aviso da espera sai da tela", await espera.count() === 0);
}

console.log("\nQuando não há rede — o 'Load failed' do relato");
{
  comoResponder = "sem-rede";
  await tentarEntrar();
  await page.waitForTimeout(1500);
  const t = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("não mostra mais o texto do navegador",
     !/Load failed|Failed to fetch/i.test(t), `dizia: "${t}"`);
  ok("e sim uma frase em português", /não consegui falar com o servidor/i.test(t),
     `dizia: "${t}"`);
  ok("que manda conferir a conexão e a quem recorrer",
     /conexão/i.test(t) && /administra/i.test(t), `dizia: "${t}"`);
}

console.log("\nQuando a ponte responde, ela é quem fala");
{
  // O tratamento novo não pode engolir a resposta do servidor: "senha errada"
  // e "não consegui falar" mandam a pessoa fazer coisas diferentes.
  comoResponder = "senha-errada";
  await tentarEntrar();
  await page.waitForTimeout(1200);
  const t = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("a mensagem da ponte é a que aparece", /senha incorretos/i.test(t), `dizia: "${t}"`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
