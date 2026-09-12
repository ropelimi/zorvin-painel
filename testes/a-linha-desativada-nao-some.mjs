// A LINHA DESATIVADA NÃO SOME — as conversas dela continuam alcançáveis.
//
// A ponte passou a recusar envio por um telefone desativado, e isso está certo:
// um advogado sai do escritório, a linha dele é desligada, e nada mais pode
// sair em nome dele. Só que a conta não fechava do outro lado.
//
// O painel lia `advogados` com `ativo = true`. Então as conversas daquela linha
// ficavam GRAVADAS E INVISÍVEIS: o cliente que não soube da mudança continua
// escrevendo para o número antigo, a mensagem entra no banco, e ninguém no
// escritório tem como alcançá-la. É o mesmo defeito de 04/09 noutro lugar —
// conteúdo que existe e a tela não mostra.
//
// O DESENHO TEM DUAS METADES, e as duas são medidas aqui:
//
//   1. as conversas voltam a ser alcançáveis — para quem ADMINISTRA, que é
//      quem desativou e quem vai querer saber o que ainda chega ali;
//   2. e a linha continua FORA de tudo o que a tela oferece. Escrever não é
//      oferecido, porque a ponte recusaria depois — e gesto oferecido e negado
//      no fim é a pior ordem possível.
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

// TODAS AS BANDEIRAS EM TODA ABERTURA: `addInitScript` acumula, e uma bandeira
// de um cenário continuaria valendo nos seguintes (está no CLAUDE.md).
const abrir = async ({ desativar = [], admin = true } = {}) => {
  await ctx.clearCookies();
  await page.addInitScript(([d, a]) => {
    globalThis.__DESATIVAR = d;
    globalThis.__SOU_ADMIN = a;
    // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO PARA VER ALGUMA COISA. Sem esta
    // linha o painel abre em "você não tem nenhum telefone", a lista nunca
    // aparece, e a prova morre esperando por ela — acusando um defeito que não
    // existe. Na bancada, `permissoes` nasce vazia, e vazio só funciona junto
    // com admin.
    globalThis.__SEMENTE = a === false
      ? { permissoes: [{ id: 1, usuario_id: "u1", departamento_id: 5, telefone_id: null }] }
      : null;
  }, [desativar, admin]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
};
const naBarra = () => page.locator("[data-telefone]")
  .evaluateAll((n) => n.map((x) => x.getAttribute("data-telefone")));
const desativados = () => page.locator("[data-telefone-desativado]")
  .evaluateAll((n) => n.map((x) => x.getAttribute("data-telefone-desativado")));


console.log("\n1. Sem nenhuma linha desativada, a tela não inventa seção");
{
  await abrir();
  ok("nenhuma marca de linha desativada aparece",
     (await desativados()).length === 0 && (await page.locator("[data-linhas-desativadas]").count()) === 0,
     "seção que aparece à toa vira mais um ícone para ignorar");
  ok("e os telefones do departamento continuam na barra",
     (await naBarra()).includes("Acordos 2"), JSON.stringify(await naBarra()));
}


console.log("\n2. Desativada: sai do que a tela OFERECE, e vai para o que ela deixa LER");
{
  await abrir({ desativar: ["a8"] });   // "Acordos 2", do departamento aberto
  const barra = await naBarra();
  // A PRIMEIRA METADE: ela não é mais oferecida. Desta lista sai tudo o que a
  // tela propõe — nova conversa, encaminhar —, e a ponte recusaria o envio.
  ok("a linha desativada sai da barra de quem se pode atender",
     !barra.includes("Acordos 2"), JSON.stringify(barra));
  ok("e as ativas do departamento continuam lá",
     barra.includes("Acordos 1"), JSON.stringify(barra));
  // A SEGUNDA: ela continua alcançável, separada e marcada.
  ok("mas ela aparece na seção das desativadas",
     (await desativados()).includes("Acordos 2"), JSON.stringify(await desativados()));
  ok("com um traço separando-a das que estão em serviço",
     (await page.locator("[data-linhas-desativadas]").count()) === 1);
}


console.log("\n3. Quem NÃO administra não vê a linha desativada em lugar nenhum");
{
  // Um atendente não tem o que fazer com ela: não pode responder, e não
  // escolheu desativá-la. Seria mais um ícone para aprender a ignorar.
  await abrir({ desativar: ["a8"], admin: false });
  ok("ela não está na barra de atendimento",
     !(await naBarra()).includes("Acordos 2"), JSON.stringify(await naBarra()));
  ok("nem na seção das desativadas",
     (await desativados()).length === 0, JSON.stringify(await desativados()));
}


console.log("\n4. Abrindo a conversa dela, a caixa de escrever dá lugar à explicação");
{
  await abrir({ desativar: ["a8"] });
  await page.locator("[data-telefone-desativado]").first().click();
  await page.waitForTimeout(1500);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1500);

  const aviso = page.locator("[data-linha-desativada]");
  ok("a conversa da linha desativada ABRE", (await page.locator("[data-msg-id]").count()) > 0,
     "era para isto que ela voltou a ser alcançável");
  ok("e a explicação toma o lugar da caixa de escrever", (await aviso.count()) === 1,
     "sem isto, alguém escreve uma resposta inteira para ela virar bolha vermelha depois");
  const texto = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("dizendo que nada sai por ela", /nada sai/i.test(texto), texto);
  // A FRASE TEM DE DIZER O QUE FAZER. "Está desativada" é um fato sobre o
  // sistema; quem está ali precisa saber como responder ao cliente mesmo assim.
  ok("e o que fazer: outro telefone, ou reativar",
     /outro telefone/i.test(texto) && /reativar/i.test(texto), texto);
}


console.log("\n5. Numa linha ATIVA, nada disso aparece");
{
  // A metade que segura tudo. Sem ela, bastaria mostrar a explicação sempre
  // para as conferências de cima passarem — e aí o escritório inteiro ficaria
  // sem caixa de escrever.
  await abrir({ desativar: ["a8"] });
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1500);
  ok("a caixa de escrever continua onde sempre esteve",
     (await page.locator("[data-linha-desativada]").count()) === 0,
     "a linha aberta está ativa; a explicação aqui seria mentira");
}


await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
