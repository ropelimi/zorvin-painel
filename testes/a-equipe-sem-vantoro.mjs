// A TELA DA EQUIPE QUANDO NÃO HÁ VANTORO.
//
// A aba "Atendentes" lê a lista de gente do Vantoro e grava a permissão lá.
// Quem compra o Zorvin sem ter Vantoro já ENTRA e nasce administrador — e não
// tinha como cadastrar mais ninguém nem dizer o que cada pessoa alcança. Um
// sistema de atendimento em EQUIPE com uma pessoa só.
//
// A tela não ganhou uma versão paralela: ela aprende em qual dos dois mundos
// está pelo `com_vantoro` que a PONTE devolve na própria lista. Quem tem as
// variáveis do Vantoro é a ponte; uma variável própria aqui poderia ser posta
// em desacordo com as de lá, e a tela ofereceria cadastrar gente num sistema
// que manda o cadastro para outro lugar.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const EQUIPE = [
  { id: "u1", login: "rodrigo", nome: "Rodrigo", email: "rodrigo@x", admin: true, ativo: true,
    ja_entrou: true, zorvin_definido: false, zorvin_so_telefones: false, zorvin: [], zorvin_telefones: [] },
  { id: "u2", login: "maria", nome: "Maria", email: "maria@x", admin: false, ativo: true,
    ja_entrou: true, zorvin_definido: false, zorvin_so_telefones: false, zorvin: [], zorvin_telefones: [] },
];

const nav = await abrirNavegador();

/** Abre a aba dos atendentes com a ponte respondendo do jeito pedido. */
async function abrirEquipe({ comVantoro }) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));

  const pedidos = [];   // o que a tela mandou à ponte, para conferir depois
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const corpo = rota.request().postData();
    pedidos.push({ caminho: url.pathname.replace("/ponte-de-mentira", ""), corpo });

    if (url.pathname.endsWith("/permissoes/atendentes")) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, usuarios: EQUIPE, com_vantoro: comVantoro }) });
    }
    if (url.pathname.endsWith("/permissoes/pessoa")) {
      const c = JSON.parse(corpo || "{}");
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, usuario: {
          id: "u3", login: (c.email || "").split("@")[0], nome: c.nome, email: c.email,
          admin: false, ativo: true, ja_entrou: true,
          zorvin_definido: false, zorvin_so_telefones: false, zorvin: [], zorvin_telefones: [] } }) });
    }
    if (url.pathname.endsWith("/permissoes/atendente")) {
      const c = JSON.parse(corpo || "{}");
      const antes = EQUIPE.find((u) => u.id === c.usuario_id) || EQUIPE[0];
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, aplicada: true, usuario: { ...antes, ...c } }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Atendentes" }).click();
  await page.waitForTimeout(900);
  return { ctx, page, pedidos, estouros };
}

console.log("\nA equipe sem Vantoro");

// ---- 1. COM Vantoro, a tela é a de sempre ----
{
  // A metade que protege o escritório: a entrega é para quem NÃO tem Vantoro,
  // e não pode acrescentar botão nenhum a quem tem — lá, cadastrar gente por
  // aqui criaria a segunda lista de pessoas.
  const { ctx, page } = await abrirEquipe({ comVantoro: true });
  ok("com Vantoro, NÃO aparece o botão de adicionar pessoa",
     await page.locator("[data-adicionar-pessoa]").count() === 0);
  // ESCOLHER ALGUÉM PRIMEIRO, e isso saiu de uma sabotagem: as chaves só
  // existem depois de uma pessoa escolhida, então conferir a ausência delas
  // com a lista fechada passa de qualquer jeito — inclusive com a proteção
  // arrancada. A conferência não media nada.
  await page.locator('[data-pessoa-da-equipe="u2"]').click();
  await page.waitForTimeout(500);
  ok("e, com alguém escolhido, as chaves de mando também não",
     await page.locator("[data-mando-da-pessoa]").count() === 0);
  await ctx.close();
}

// ---- 2. SEM Vantoro, a tela oferece o que falta ----
{
  const { ctx, page } = await abrirEquipe({ comVantoro: false });
  ok("sem Vantoro, o botão de adicionar pessoa aparece",
     await page.locator("[data-adicionar-pessoa]").count() === 1);
  ok("e a equipe do banco está na lista",
     await page.locator('[data-pessoa-da-equipe="u2"]').count() === 1);
  await ctx.close();
}

// ---- 3. cadastrar alguém ----
{
  const { ctx, page, pedidos } = await abrirEquipe({ comVantoro: false });
  await page.locator("[data-adicionar-pessoa]").click();
  await page.waitForSelector("[data-form-pessoa]");
  await page.locator("[data-pessoa-nome]").fill("Nova Pessoa");
  await page.locator("[data-pessoa-email]").fill("nova@escritorio.com");
  await page.locator("[data-pessoa-senha]").fill("senha-boa-123");
  // QUANTAS LEITURAS DA LISTA JÁ HOUVE ANTES DO CLIQUE.
  //
  // Contar o TOTAL não serve, e isso saiu de uma sabotagem: em
  // desenvolvimento o React chama todo efeito DUAS vezes, de propósito, para
  // caçar efeito que não sabe ser repetido. Só de abrir a aba já há duas
  // leituras — um teto de "pelo menos 2" passa com a releitura arrancada. O
  // que prova alguma coisa é a DIFERENÇA depois do cadastro.
  const lidasAntes = pedidos.filter((p) => p.caminho === "/permissoes/atendentes").length;
  await page.locator("[data-pessoa-salvar]").click();
  await page.waitForTimeout(900);

  const criar = pedidos.find((p) => p.caminho === "/permissoes/pessoa");
  ok("a tela pede o cadastro à ponte", Boolean(criar), JSON.stringify(pedidos.map((p) => p.caminho)));
  ok("com nome, e-mail e senha", criar && /Nova Pessoa/.test(criar.corpo)
     && /nova@escritorio\.com/.test(criar.corpo) && /senha-boa-123/.test(criar.corpo), criar && criar.corpo);
  // A LISTA É RELIDA DO SERVIDOR, e a pessoa nova não é só encaixada na tela.
  // Encaixar à mão mostraria alguém que talvez não tenha entrado na lista de
  // verdade — e o erro só apareceria na próxima abertura, longe da causa.
  ok("e a lista é relida da ponte DEPOIS do cadastro",
     pedidos.filter((p) => p.caminho === "/permissoes/atendentes").length > lidasAntes,
     `${lidasAntes} antes, ${pedidos.filter((p) => p.caminho === "/permissoes/atendentes").length} depois`);
  ok("o formulário se fecha", await page.locator("[data-form-pessoa]").count() === 0);
  await ctx.close();
}

// ---- 4. promover e desativar ----
{
  const { ctx, page, pedidos } = await abrirEquipe({ comVantoro: false });
  await page.locator('[data-pessoa-da-equipe="u2"]').click();
  await page.waitForSelector("[data-mando-da-pessoa]");
  ok("escolhendo alguém, as duas chaves aparecem",
     await page.locator("[data-mando-da-pessoa]").count() === 1);

  await page.getByRole("switch", { name: "Administra o Zorvin" }).click();
  await page.waitForTimeout(600);
  const promover = pedidos.filter((p) => p.caminho === "/permissoes/atendente").pop();
  ok("promover manda `admin: true`", promover && /"admin":true/.test(promover.corpo), promover && promover.corpo);
  // O ID VAI JUNTO. Sem Vantoro o login nasce do pedaço do e-mail antes do
  // arroba, e duas pessoas de domínios diferentes podem ter o mesmo — mexer na
  // permissão da pessoa errada é o engano que ninguém percebe olhando a tela.
  ok("e o id da pessoa vai junto do login",
     promover && /"usuario_id":"u2"/.test(promover.corpo), promover && promover.corpo);

  await page.getByRole("switch", { name: "Conta ativa" }).click();
  await page.waitForTimeout(600);
  const desativar = pedidos.filter((p) => p.caminho === "/permissoes/atendente").pop();
  ok("desativar manda `ativo: false`", desativar && /"ativo":false/.test(desativar.corpo),
     desativar && desativar.corpo);
  await ctx.close();
}

// ---- 5. a frase da administradora não manda ninguém ao Vantoro ----
{
  const { ctx, page } = await abrirEquipe({ comVantoro: false });
  await page.locator('[data-pessoa-da-equipe="u1"]').click();
  await page.waitForTimeout(500);
  const texto = await page.locator("body").innerText();
  ok("sem Vantoro, a tela NÃO manda tirar o superusuário no Vantoro",
     !/superusu[áa]rio dela no Vantoro/i.test(texto));
  ok("e diz onde restringir de verdade", /desligue a chave acima/i.test(texto),
     texto.slice(0, 600));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
