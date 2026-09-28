// "ESTE CPF JÁ É DE OUTRO CADASTRO" — dito enquanto se digita.
//
// RELATO DO ESCRITÓRIO, em 08/09: "fiz um teste e está sendo permitido
// cadastrar o mesmo cliente com o mesmo CPF, sendo feito uma duplicação do
// cadastro. O ideal é que ao digitar o CPF o sistema avise que já existe o
// cadastro e se o usuário quer ver a ficha do cadastro."
//
// A TRAVA DE VERDADE ESTÁ NO VANTORO (vantoro#232): `api.editar` passou a
// recusar o CPF de outro cadastro, e é isso que impede o duplicado mesmo que
// esta tela falhe. Aqui se prova a outra metade do pedido — avisar ANTES.
//
// Recusar no fim é tarde: a pessoa preencheu nome, nascimento, endereço e
// profissão, e só então descobre que o cadastro já existia. O trabalho todo
// refeito à toa, e o cadastro certo continuando sem o que ela digitou.
//
// O QUE ESTA PROVA VIGIA, além do aviso aparecer:
//
//   * que ele NÃO aparece no meio da digitação (aviso que pisca ensina a
//     ignorar avisos);
//   * que ele NÃO aparece para o CPF do próprio cadastro aberto (alarme falso
//     na ficha inteira, o tempo todo);
//   * e que o botão busca a ficha INTEIRA antes de trocar — o resumo tem três
//     campos, e trocar com ele desenharia um cadastro que parece incompleto.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O CPF que já é de alguém, e o de quem está com a ficha aberta.
const CPF_DE_OUTRO = "39850661836";
const CPF_DESTE = "52998224725";
const perguntas = [];

const FICHA_ABERTA = {
  id: 55, nome: "JOAO DA SILVA", cpf: "", telefone: "11999991111", telefone2: "",
  processos: [], documentos: 0, ordem_servico: null, telefones: [],
};
const OUTRO_INTEIRO = {
  id: 99, nome: "MARIA DAS DORES", cpf: "398.506.618-36",
  telefone: "11977776666", telefone2: "", cidade: "SAO PAULO",
  processos: [{ id: 1, numero: "0001", tipo_acao: "X", reu: "BANCO", situacao: "Em andamento" }],
  documentos: 4, ordem_servico: null, telefones: [],
};

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());

  if (url.pathname.endsWith("/vantoro/cpf-existe")) {
    const cpf = (url.searchParams.get("cpf") || "").replace(/\D/g, "");
    perguntas.push(cpf);
    if (cpf.length !== 11 && cpf.length !== 14) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, encontrado: false, incompleto: true }) });
    }
    if (cpf === CPF_DE_OUTRO) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, encontrado: true, cliente: {
          id: 99, nome: "MARIA DAS DORES", cpf: "398.506.618-36",
          telefone: "11977776666", processos: 3, documentos: 4 } }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, encontrado: false }) });
  }

  if (/\/vantoro\/cliente\/99$/.test(url.pathname)) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, cliente: OUTRO_INTEIRO }) });
  }
  if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, cliente: FICHA_ABERTA }) });
  }
  if (url.pathname.endsWith("/vantoro/cliente")) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, clientes: [FICHA_ABERTA] }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);
await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(600);
// A FICHA JÁ NASCE ABERTA (coluna fixa, 28/09): clicar no botão a recolheria,
// e o título dele mudou para "Recolher a ficha", então o endereço antigo nem
// achava mais o elemento.
if (!(await page.locator("[data-ficha]").count())) {
  await page.locator("[data-abrir-ficha]").first().click();
}
await page.waitForTimeout(1800);

const campoCpf = page.locator('[data-campo="cpf"]');
const aviso = page.locator("[data-cpf-de-outro]");

console.log("\nEste CPF já é de outro cadastro, dito enquanto se digita");

const temCampo = (await campoCpf.count()) === 1;
ok("a ficha tem o campo do CPF", temCampo);
if (!temCampo) {
  console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
  await nav.close();
  process.exit(1);
}

// ------------------------------------------------------------
//  NO MEIO DA DIGITAÇÃO, NENHUM AVISO
//
//  Um aviso que pisca a cada tecla ensina a ignorar avisos — e aí o dia em que
//  ele estiver certo passa despercebido.
// ------------------------------------------------------------
await campoCpf.fill("398506");
await page.waitForTimeout(900);
ok("com o CPF pela metade, nenhum aviso aparece", (await aviso.count()) === 0);
ok("e nem se pergunta à ponte por um CPF incompleto",
   perguntas.every((c) => c.length === 11 || c.length === 14),
   JSON.stringify(perguntas));

// ------------------------------------------------------------
//  COMPLETO, E DE OUTRA PESSOA: O AVISO
// ------------------------------------------------------------
await campoCpf.fill("398.506.618-36");
await page.waitForTimeout(1400);
ok("com o CPF completo de outra pessoa, o aviso aparece", (await aviso.count()) === 1);
const texto = ((await aviso.first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
ok("e diz de QUEM é o cadastro", /MARIA DAS DORES/.test(texto), `dizia: "${texto}"`);
ok("com o que faz reconhecê-lo — quantas ações e documentos",
   /3 ação/.test(texto) && /4 documento/.test(texto), `dizia: "${texto}"`);
ok("e diz POR QUE isso importa",
   /partem o histórico em dois/i.test(texto), `dizia: "${texto}"`);

// ------------------------------------------------------------
//  UM CPF QUE NÃO É DE NINGUÉM NÃO GERA AVISO
// ------------------------------------------------------------
await campoCpf.fill("529.982.247-25");
await page.waitForTimeout(1400);
ok("um CPF livre não gera aviso nenhum", (await aviso.count()) === 0);

// ------------------------------------------------------------
//  A PONTE FORA DO AR NÃO INVENTA AVISO
//
//  Ela hiberna no plano free. Sem resposta, nenhum aviso — e a gravação
//  continua recusando o duplicado do lado do Vantoro, que é a trava de verdade.
// ------------------------------------------------------------
await page.route("**/ponte-de-mentira/vantoro/cpf-existe*", (r) => r.abort());
// LIMPAR ANTES DE PREENCHER, sempre. Preencher o campo com o valor que ele já
// tem não dispara mudança nenhuma, o efeito não roda, e a conferência passa a
// medir o estado da etapa ANTERIOR. Foi assim que duas destas conferências
// nasceram vazias: uma dizia que o botão não existia (existia, só não tinha
// sido pedido) e a outra aprovava um aviso que nunca chegou a ser tentado.
await campoCpf.fill("");
await page.waitForTimeout(200);
await campoCpf.fill("398.506.618-36");
await page.waitForTimeout(1400);
ok("com a ponte fora do ar, a tela não inventa aviso", (await aviso.count()) === 0);
await page.unroute("**/ponte-de-mentira/vantoro/cpf-existe*");

// ------------------------------------------------------------
//  O BOTÃO ABRE O CADASTRO — INTEIRO
// ------------------------------------------------------------
await campoCpf.fill("");
await page.waitForTimeout(200);
await campoCpf.fill("398.506.618-36");
await page.waitForTimeout(1400);
const botao = page.locator("[data-ver-cadastro]");
const temBotao = (await botao.count()) === 1;
ok("o aviso oferece abrir o cadastro que já existe", temBotao,
   "avisar sem oferecer o caminho faz a pessoa desistir e duplicar por outro lado");
if (temBotao) {
  await botao.click();
  await page.waitForTimeout(1500);
  const corpo = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  ok("clicando, a ficha passa a ser a do outro cadastro",
     /MARIA DAS DORES/.test(corpo), corpo.slice(0, 160));
  // A FICHA INTEIRA, e não o resumo de poucos campos: o resumo desenharia um
  // cadastro com tudo vazio, parecendo incompleto — e a pessoa preencheria de
  // novo o que já existe.
  //
  // A CIDADE ESTÁ NUMA SEÇÃO FECHADA, e por isso ela é aberta antes: o texto
  // da página não mostra o que não está desenhado, e a conferência passaria a
  // dizer "não veio a ficha" para uma ficha que veio inteira.
  await page.locator('[data-secao="endereco"]').click();
  await page.waitForTimeout(400);
  const cidade = await page.locator('[data-campo="cidade"]').inputValue().catch(() => "");
  ok("e é a ficha INTEIRA, com o que só vem da ficha completa",
     cidade === "SAO PAULO", `a cidade veio "${cidade}" — o resumo não a tem`);
  ok("e o aviso some depois de aberto", (await aviso.count()) === 0);
}

// ------------------------------------------------------------
//  O CPF DO PRÓPRIO CADASTRO NÃO É AVISO
//
//  Sem isto, abrir a ficha de alguém mostraria "este CPF já existe" apontando
//  para ele mesmo — alarme falso na ficha inteira, o tempo todo.
// ------------------------------------------------------------
await campoCpf.fill("");
await page.waitForTimeout(200);
await campoCpf.fill("398.506.618-36");
await page.waitForTimeout(1400);
ok("o CPF do cadastro que está aberto não gera aviso", (await aviso.count()) === 0,
   "seria alarme falso em toda ficha que tem CPF");

ok("nenhum erro de página no caminho", erros.length === 0, erros.join(" | "));

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
await nav.close();
process.exit(falhas ? 1 : 0);
