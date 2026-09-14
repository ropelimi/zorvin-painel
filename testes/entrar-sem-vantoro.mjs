// A ENTRADA DE QUEM NÃO TEM VANTORO.
//
// Esta prova roda num SERVIDOR PRÓPRIO, servido com `VITE_VANTORO=desligado` —
// a instalação de quem compra o Zorvin sem ter o outro sistema. Ver
// `SEM_VANTORO` em `rodar.mjs`.
//
// O QUE ELA EXISTE PARA PEGAR. Até 14/09 a tela de entrada pedia "Usuário do
// Vantoro" e mandava a senha para a ponte, que perguntava ao Vantoro. Isso não
// era uma integração faltando para quem não tem o Vantoro: era O PORTÃO. Não
// havia caminho nenhum para dentro do programa.
//
// A conferência que mais importa não é a frase na tela — é que a senha NÃO
// passa mais pela ponte. Uma tela que diz "E-mail" e continua perguntando ao
// Vantoro por baixo pareceria consertada e recusaria todo mundo.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

// TODAS AS BANDEIRAS EM TODA ABERTURA, sempre.
//
// `addInitScript` ACUMULA: cada chamada acrescenta mais um script, e todos
// rodam a cada carregamento. Uma bandeira ligada numa cena continuava valendo
// nas seguintes, e a prova passava a reprovar falando de outro assunto — já
// aconteceu duas vezes neste repositório. A saída é o ajudante escrever
// TODAS, sempre: a última escrita vence.
async function abrirEntrada({ senhaBoa = "senha-certa", authFora = false, sessaoPendurada = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 420, height: 820 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));

  // QUEM BATEU NA PORTA DA PONTE, e em qual endereço. `/ping` continua valendo
  // (o painel depois da entrada fala com a ponte para etiquetas, notas e
  // fotos); o que não pode acontecer é `/auth/login`.
  const batidas = [];
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    batidas.push(new URL(rota.request().url()).pathname);
    await rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.addInitScript(([s, a, p]) => {
    globalThis.__DESLOGADO = true;
    globalThis.__SENHA_BOA = s;
    globalThis.__AUTH_FORA = a;
    globalThis.__SESSAO_PENDURADA = p;
  }, [senhaBoa, authFora, sessaoPendurada]);

  await page.goto(ENDERECO, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  return { ctx, page, batidas, estouros };
}

console.log("\nA entrada sem Vantoro");

// ---- 1. a tela não fala de um sistema que este cliente não tem ----
{
  const { ctx, page } = await abrirEntrada();
  const texto = await page.locator("form").innerText();
  ok("a tela NÃO pede 'Usuário do Vantoro'", !/Usu[áa]rio do Vantoro/i.test(texto), texto.slice(0, 200));
  ok("ela pede e-mail", /E-mail/i.test(texto), texto.slice(0, 200));
  const tipo = await page.locator('input[autocomplete="email"]').getAttribute("type");
  ok("e o campo é de e-mail, para o navegador ajudar a conferir", tipo === "email", `veio ${tipo}`);
  await ctx.close();
}

// ---- 2. senha errada: a frase certa, e a ponte NÃO foi chamada ----
{
  const { ctx, page, batidas } = await abrirEntrada();
  await page.locator('input[autocomplete="email"]').fill("alguem@escritorio.com");
  await page.locator('input[type="password"]').fill("senha-errada");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1200);

  const texto = await page.locator("form").innerText();
  ok("senha errada diz que e-mail OU senha estão incorretos",
     /E-mail ou senha incorretos/i.test(texto), texto.slice(0, 300));

  // O CORAÇÃO DESTA PROVA. Uma tela que diz "E-mail" e continua perguntando ao
  // Vantoro por baixo pareceria consertada e recusaria todo mundo — e o relato
  // seria "mudou o nome do campo e agora ninguém entra".
  ok("a senha NÃO passou pela ponte", !batidas.some((p) => p.includes("/auth/login")),
     JSON.stringify(batidas));
  await ctx.close();
}

// ---- 3. senha certa entra no painel ----
{
  const { ctx, page, batidas, estouros } = await abrirEntrada();
  await page.locator('input[autocomplete="email"]').fill("alguem@escritorio.com");
  await page.locator('input[type="password"]').fill("senha-certa");
  await page.locator('button[type="submit"]').click();

  // A TELA DE ENTRADA TEM DE SUMIR. Conferir só "não apareceu erro" passaria
  // com a tela parada — que é exatamente como uma senha recusada se parece.
  let entrou = true;
  try {
    await page.waitForSelector('input[type="password"]', { state: "detached", timeout: 15000 });
  } catch (_e) { entrou = false; }
  ok("com a senha certa, a tela de entrada dá lugar ao painel", entrou,
     entrou ? "" : (await page.locator("form").innerText()).slice(0, 300));
  ok("e a senha continua sem passar pela ponte",
     !batidas.some((p) => p.includes("/auth/login")), JSON.stringify(batidas));
  ok("sem estouro nenhum no caminho", estouros.length === 0, estouros.join(" · "));
  await ctx.close();
}

// ---- 4. serviço fora do ar não vira "sua senha está errada" ----
{
  // Mandar alguém conferir a senha quando quem confere está fora do ar é
  // mandá-la caçar um erro que não existe. São providências opostas: uma é
  // digitar de novo, a outra é avisar quem administra.
  const { ctx, page } = await abrirEntrada({ authFora: true });
  await page.locator('input[autocomplete="email"]').fill("alguem@escritorio.com");
  await page.locator('input[type="password"]').fill("senha-certa");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1200);

  const texto = await page.locator("form").innerText();
  ok("serviço fora do ar NÃO diz que a senha está incorreta",
     !/senha incorretos/i.test(texto), texto.slice(0, 300));
  ok("diz para avisar quem administra", /avise quem administra/i.test(texto), texto.slice(0, 300));
  ok("e mostra o texto técnico, a única pista de quem for investigar",
     /Service temporarily unavailable/i.test(texto), texto.slice(0, 300));
  await ctx.close();
}

// ---- 5. o aviso do Auth calado se inverte, e tinha de se inverter ----
{
  // Com o Vantoro, quem confere a senha é ele: o Auth calado não impede
  // ninguém de entrar, e a tela manda entrar normalmente. SEM o Vantoro, quem
  // confere a senha É o Auth — a mesma frase mandaria a pessoa repetir a senha
  // certa contra um serviço fora do ar até concluir que esqueceu a senha.
  const { ctx, page } = await abrirEntrada({ sessaoPendurada: true });
  await page.waitForTimeout(2500);
  const tela = await page.locator("body").innerText();
  ok("o aviso do serviço calado aparece",
     /demorou demais para responder/i.test(tela), tela.slice(0, 400));
  ok("e NÃO diz que o login não depende dele",
     !/n[ãa]o depende desse servi[çc]o/i.test(tela), tela.slice(0, 400));
  ok("diz o contrário: é ele que confere a senha",
     /confere a sua senha/i.test(tela), tela.slice(0, 400));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
