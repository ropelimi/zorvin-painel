// O BOTÃO QUE SOBE AS NOTAS ANTIGAS PARA O VANTORO.
//
// A nota interna escrita numa conversa vira uma linha no histórico do cliente.
// Isso passou a valer para as notas NOVAS — as que já estavam gravadas antes
// ficaram paradas, e não havia como trazê-las: o retroativo é um POST que exige
// o token de servidor do Vantoro, e esse token nunca pode passar pelo navegador.
// Quer dizer, existia um comando que ninguém do escritório tinha como executar,
// e a Render no plano gratuito não dá terminal.
//
// O QUE ESTA PROVA NÃO DEIXA PASSAR, em ordem de gravidade:
//
//   1. o laço das fatias PARAR NO MEIO achando que acabou. Ele percorre o
//      escritório em pedaços; parar antes deixa clientes sem as notas deles, e
//      isso não dá erro nenhum — só some;
//   2. o laço NÃO PARAR NUNCA. Repetir a mesma fatia para sempre prende a tela
//      e martela a ponte;
//   3. a SIMULAÇÃO mandar alguma coisa. Ela existe para a pessoa ver o número
//      antes de decidir;
//   4. um erro no meio fazer a tela dizer que tem de recomeçar do zero. O que
//      já subiu está lá, e recomeçar do zero é o que dá medo de apertar.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// A PONTE DE MENTIRA — o retroativo em fatias, como a de verdade.
//
// SETE CLIENTES EM FATIAS DE DOIS: o último grupo fica INCOMPLETO, e é no grupo
// incompleto que uma conta de fim mal feita erra — tanto parando cedo quanto
// não parando nunca.
const TOTAL = 7;
const FATIA = 2;
let chamadas = [];          // cada pedido que chegou, com o `de`
let PONTE_CAI_NA = -1;      // em qual chamada a ponte cai (-1 = nunca)
let SIMULACOES = [];
// QUANTO CADA FATIA DEMORA. Sem demora nenhuma, as quatro fatias terminam
// antes de o navegador pintar uma vez — e a prova do progresso não mediria o
// progresso, mediria a velocidade da ponte de mentira. A ponte de verdade leva
// segundos por fatia: cada nota é uma ida ao Vantoro.
let DEMORA = 0;

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());

  if (url.pathname.endsWith("/vantoro/diagnostico-notas")) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, contatos: 40, contatos_com_cadastro_no_vantoro: TOTAL,
        notas: 12, notas_que_ja_subiram: 0,
        diagnostico: "Existem 7 contato(s) com cadastro e 12 nota(s), e NENHUMA "
          + "está marcada como subida.",
      }) });
  }

  if (url.pathname.endsWith("/vantoro/notas/subir-tudo")) {
    const simular = url.searchParams.get("simular") === "1";
    if (simular) {
      SIMULACOES.push(url.search);
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, simulacao: true, subiram: 12,
          total_clientes: TOTAL, de: 0, ate: TOTAL, fim: true, com_problema: [] }) });
    }
    const de = Number(url.searchParams.get("de") || 0);
    chamadas.push(de);
    if (DEMORA) await new Promise((r) => setTimeout(r, DEMORA));
    if (chamadas.length === PONTE_CAI_NA) {
      return rota.fulfill({ status: 502, contentType: "application/json",
        body: JSON.stringify({ erro: "o Vantoro está dormindo" }) });
    }
    const ate = Math.min(de + FATIA, TOTAL);
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, simulacao: false, clientes: ate - de,
        subiram: ate - de, falharam: 0, jaEstavam: 1,
        de, ate, total_clientes: TOTAL, fim: ate >= TOTAL, com_problema: [],
      }) });
  }

  return rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

/** Abre o painel e vai até a aba das notas. */
async function abrirAba() {
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(400);
  await page.locator("[data-aba-notas]").click();
  await page.waitForSelector("[data-vantoro-notas]");
  await page.waitForTimeout(600);
}

console.log("\nA aba mostra a conta antes de qualquer botão");
{
  await abrirAba();
  ok("a aba existe e abre", await page.locator("[data-vantoro-notas]").count() === 1);
  const texto = (await page.locator("[data-vantoro-notas]").innerText()).replace(/\s+/g, " ");
  // OS NÚMEROS PRIMEIRO. Quem chega aqui precisa saber o tamanho do que vai
  // apertar; um botão sozinho é uma decisão tomada no escuro.
  ok("mostra quantas notas existem", /12/.test(texto), texto.slice(0, 200));
  ok("e quantas já estão no histórico", /Já no histórico/.test(texto), texto.slice(0, 200));
  // A FRASE VEM DA PONTE. É ela que sabe separar "ninguém tem ficha ainda" de
  // "a subida está sendo recusada" — e admite quando não sabe.
  ok("e a explicação em uma frase, vinda da ponte",
     /NENHUMA está marcada/.test(
       await page.locator("[data-vantoro-diagnostico]").innerText()));
}

console.log("\nA simulação conta, e não manda nada");
{
  chamadas = []; SIMULACOES = [];
  await page.locator("[data-vantoro-simular]").click();
  await page.waitForSelector("[data-vantoro-simulacao]");
  ok("diz quantas subiriam",
     /12/.test(await page.locator("[data-vantoro-simulacao]").innerText()));
  // NADA SAIU. A simulação não pode ter chamado o caminho que envia.
  ok("e nenhuma subida de verdade aconteceu", chamadas.length === 0,
     JSON.stringify(chamadas));
  // `quantos=tudo`: um número parcial aqui seria pior que número nenhum, porque
  // é ele que a pessoa usa para decidir se aperta.
  ok("a simulação pergunta pelo total, e não por uma fatia",
     SIMULACOES.every((q) => /quantos=tudo/.test(q)), JSON.stringify(SIMULACOES));
}

console.log("\nSubir de verdade percorre TODAS as fatias, e para no fim");
{
  chamadas = []; PONTE_CAI_NA = -1;
  await page.locator("[data-vantoro-subir]").click();
  await page.waitForSelector("[data-vantoro-fim]", { timeout: 15000 });

  // A CONFERÊNCIA QUE IMPORTA: o laço cobriu o escritório inteiro. Parar antes
  // deixaria clientes sem as notas deles, e isso não dá erro nenhum.
  ok("pediu as quatro fatias, começando onde a anterior parou",
     JSON.stringify(chamadas) === JSON.stringify([0, 2, 4, 6]),
     JSON.stringify(chamadas));

  // E PAROU. Um laço que não termina prende a tela e martela a ponte; aqui ele
  // já teria feito uma quinta chamada.
  await page.waitForTimeout(1200);
  ok("e parou quando a ponte disse que acabou", chamadas.length === 4,
     JSON.stringify(chamadas));

  const fim = (await page.locator("[data-vantoro-fim]").innerText()).replace(/\s+/g, " ");
  // O TOTAL É A SOMA DAS FATIAS, e não o número da última. Mostrar "1 nota
  // subiu" no fim de um retroativo de sete faria parecer que quase nada foi
  // feito — e alguém apertaria de novo à toa.
  ok("o resultado soma todas as fatias", /7 nota/.test(fim), fim);
  ok("e conta as que já estavam lá", /4 já/.test(fim), fim);
}

console.log("\nO progresso aparece enquanto anda, em vez de uma tela parada");
{
  // Tela parada por minutos é indistinguível de tela travada, e quem está
  // olhando fecha. O marcador guarda até onde foi na última fatia desenhada.
  chamadas = [];
  DEMORA = 200;      // a ponte de verdade leva segundos por fatia
  const vistos = [];
  await page.locator("[data-vantoro-subir]").click();
  for (let i = 0; i < 120; i += 1) {
    const n = await page.locator("[data-vantoro-progresso]").getAttribute("data-vantoro-progresso")
      .catch(() => null);
    if (n && !vistos.includes(n)) vistos.push(n);
    if (await page.locator("[data-vantoro-fim]").count()) break;
    await page.waitForTimeout(50);
  }
  ok("o progresso foi desenhado mais de uma vez pelo caminho", vistos.length >= 2,
     JSON.stringify(vistos));
  // E ELE ANDA PARA A FRENTE. Um contador que fica em "2" a viagem toda é uma
  // barra de progresso que mente — pior que nenhuma.
  ok("e cada vez mais adiante",
     vistos.map(Number).every((v, i, a) => i === 0 || v > a[i - 1]),
     JSON.stringify(vistos));
  DEMORA = 0;
}

console.log("\nA ponte caindo no meio não manda ninguém recomeçar do zero");
{
  chamadas = []; PONTE_CAI_NA = 2;   // a segunda fatia cai
  await page.locator("[data-vantoro-subir]").click();
  await page.waitForSelector("[data-vantoro-erro]", { timeout: 15000 });
  const texto = (await page.locator("[data-vantoro-erro]").innerText()).replace(/\s+/g, " ");
  ok("a tela diz que falhou", /dormindo|não consegui|demorou/i.test(texto), texto);
  // O QUE JÁ SUBIU NÃO SE PERDE, e a tela precisa dizer isso: quem lê só "deu
  // erro" acha que tem de recomeçar, e recomeçar é o que dá medo de apertar.
  ok("e que o que já subiu continua lá", /já subiu está lá/.test(texto), texto);
  ok("e que apertar de novo continua de onde parou",
     /continua de onde parou/.test(texto), texto);
  // NÃO INSISTIU SOZINHA. Uma ponte fora do ar sendo martelada por um laço é
  // pior do que uma parada: ela não volta mais depressa, e a tela nunca sai.
  const antes = chamadas.length;
  await page.waitForTimeout(1500);
  ok("e o laço parou em vez de martelar a ponte", chamadas.length === antes,
     JSON.stringify(chamadas));
}

ok("sem erro de JavaScript no caminho todo", erros.length === 0,
   erros.slice(0, 2).join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
