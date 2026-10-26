// O ÍCONE DO CONTROLE DE ATENDIMENTO DO VANTORO (23/10).
//
// Pedido do Rodrigo: um ícone na barra lateral que leve à tela "Controle de
// atendimento" do Vantoro (https://app.vantoro.com.br/cadastro/atendimento/).
// É um LINK para outro sistema, e esta prova confere o que faz dele um link
// certo:
//
//   1. com Vantoro ele está na barra, aponta para a tela pedida e abre numa
//      ABA NOVA — o Zorvin continua aberto onde estava;
//   2. sem Vantoro ele não aparece (a ponte diz se há Vantoro, e não uma
//      variável do painel);
//   3. quando a pergunta à ponte FALHA, ele aparece: a régua dos três estados
//      de `temVantoro.js`, a armadilha nº 2 do CLAUDE.md;
//   4. enquanto a ponte não respondeu, ele espera escondido;
//   5. no celular ele também está na barra, com o alvo de dedo de 40px;
//   6. e a ficha completa do cliente sai do MESMO endereço do Vantoro.
//
// O Vantoro de verdade não é tocado: a rede para ele é respondida aqui.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const TELA_PEDIDA = "https://app.vantoro.com.br/cadastro/atendimento/";
const CLIENTE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
                  telefone: "5567992183107", telefone2: "", ocupacao: "Costureira",
                  observacoes: "", documentos: 0, processos: [], ordem_servico: null };

const nav = await abrirNavegador();

/** Abre o painel com a ponte respondendo sobre o Vantoro do jeito pedido.
 *
 *  `status`: "tem", "nao-tem", "quebrada" (500), "sem-rede" (a chamada nem
 *  completa) ou "demora" (responde "tem" depois de `demoraMs`). */
async function abrirPainel(status, { largura = 1500, altura = 900, demoraMs = 0 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  // O VANTORO DE MENTIRA: a aba nova cai aqui, e não na internet.
  await ctx.route("https://app.vantoro.com.br/**", (rota) => rota.fulfill({
    status: 200, contentType: "text/html; charset=utf-8",
    body: "<!doctype html><title>Vantoro</title><p>Controle de atendimento (de mentira)</p>" }));
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const caminho = url.pathname.replace("/ponte-de-mentira", "");
    if (caminho === "/vantoro/status") {
      if (status === "quebrada") return rota.fulfill({ status: 500, body: "erro" });
      if (status === "sem-rede") return rota.abort("failed");
      if (status === "demora") await new Promise((r) => setTimeout(r, demoraMs));
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, configurado: status !== "nao-tem" }) });
    }
    if (caminho === "/vantoro/cliente" && rota.request().method() === "GET") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: [CLIENTE], opcoes: {} }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  return { ctx, page, estouros };
}

const icone = (page) => page.locator("[data-controle-de-atendimento]");
// A BARRA DESENHOU? O ícone das mídias mora ao lado, e existe com e sem
// Vantoro. Sem esta conferência, "o ícone não está lá" passaria numa tela que
// nem chegou a desenhar a barra.
const barraDesenhou = async (page) => (await page.locator('[title="Mídias, documentos e links"]').count()) === 1;

// ------------------------------------------------------------------
console.log("\nCom Vantoro, o ícone está na barra e abre a tela pedida numa aba nova");
{
  const { ctx, page, estouros } = await abrirPainel("tem");
  await page.waitForTimeout(900);
  const quantos = await icone(page).count();
  ok("o ícone está na barra lateral", quantos === 1 && await icone(page).isVisible(), `${quantos} ícones`);
  ok("ele aponta para o Controle de atendimento do Vantoro",
     (await icone(page).getAttribute("href").catch(() => null)) === TELA_PEDIDA,
     String(await icone(page).getAttribute("href").catch(() => null)));
  ok("ele abre numa aba nova, sem dar ao Vantoro acesso a esta aba",
     (await icone(page).getAttribute("target").catch(() => null)) === "_blank"
     && /noopener/.test((await icone(page).getAttribute("rel").catch(() => "")) || ""));
  ok("ele diz o que é, para quem passa o mouse e para o leitor de tela",
     /Controle de atendimento/.test((await icone(page).getAttribute("title").catch(() => "")) || "")
     && /Controle de atendimento/.test((await icone(page).getAttribute("aria-label").catch(() => "")) || ""));

  // O CLIQUE DE VERDADE. Guardado: sem o ícone, `click()` esperaria 30 s e
  // estouraria a prova inteira, e uma prova que estoura não diz QUAL
  // conferência viu o defeito.
  let aba = null;
  if (quantos === 1) {
    [aba] = await Promise.all([
      ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null),
      icone(page).click(),
    ]);
    if (aba) await aba.waitForURL(TELA_PEDIDA, { timeout: 8000 }).catch(() => {});
  }
  ok("clicar abre uma aba nova na tela pedida", aba !== null && aba.url() === TELA_PEDIDA,
     aba ? aba.url() : "nenhuma aba nova");
  ok("e o Zorvin continua aberto onde estava, com a lista de conversas",
     page.url().startsWith(ENDERECO) && await page.locator("[data-conversa-nome]").first().isVisible());
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nSem Vantoro, o ícone não aparece");
{
  const { ctx, page } = await abrirPainel("nao-tem");
  await page.waitForTimeout(900);
  ok("a barra lateral desenhou", await barraDesenhou(page));
  ok("e o ícone do Controle de atendimento não está nela", await icone(page).count() === 0);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nA pergunta à ponte que falha MOSTRA o ícone (falha não é ausência)");
for (const [nome, status] of [["a ponte respondendo 500", "quebrada"], ["a ponte sem rede", "sem-rede"]]) {
  const { ctx, page } = await abrirPainel(status);
  await page.waitForTimeout(900);
  ok(`${nome}: o ícone aparece`, await icone(page).count() === 1);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nEnquanto a ponte não respondeu, ele espera escondido");
{
  const { ctx, page } = await abrirPainel("demora", { demoraMs: 3000 });
  await page.waitForTimeout(800);
  ok("a barra lateral desenhou antes da resposta", await barraDesenhou(page));
  ok("e o ícone ainda não está nela", await icone(page).count() === 0);
  await page.waitForTimeout(3500);
  ok("quando a ponte responde que há Vantoro, ele aparece", await icone(page).count() === 1);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nNo celular, ele também está na barra, com o alvo de dedo");
{
  const { ctx, page } = await abrirPainel("tem", { largura: 390, altura: 844 });
  await page.waitForTimeout(900);
  const caixa = await icone(page).boundingBox().catch(() => null);
  ok("o ícone está na barra do celular", caixa !== null && await icone(page).isVisible());
  ok("com pelo menos 40×40px, o alvo de dedo desta tela",
     caixa !== null && caixa.width >= 40 && caixa.height >= 40,
     caixa ? `${Math.round(caixa.width)}×${Math.round(caixa.height)}` : "sem ícone");
  ok("e cabe na tela", caixa !== null && caixa.y + caixa.height <= 844 && caixa.x >= 0);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nA ficha completa sai do mesmo endereço do Vantoro");
{
  const { ctx, page } = await abrirPainel("tem");
  await page.waitForTimeout(900);
  const linha = page.locator('[data-conversa-nome*="Deus"]');
  const achou = await linha.count() > 0;
  ok("a conversa da cliente está na lista", achou);
  if (achou) {
    await linha.first().click();
    await page.waitForSelector("[data-ficha-completa]", { timeout: 8000 }).catch(() => {});
  }
  const link = await page.locator("[data-ficha-completa]").getAttribute("href").catch(() => null);
  ok("o link da ficha completa aponta para o cadastro dela no Vantoro",
     link === "https://app.vantoro.com.br/cadastro/clientes/v-100/", String(link));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
