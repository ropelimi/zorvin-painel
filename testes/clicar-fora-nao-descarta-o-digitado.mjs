// SELECIONAR TEXTO ATÉ FORA DA JANELA NÃO A FECHA (auditoria de 28/10)
//
// "Departamentos e acessos" e a janela do "Já tratei" fechavam com
// `onClick={aoFechar}` no fundo escuro. Só que o navegador entrega o `click`
// ao ancestral comum de onde o botão desceu e de onde subiu: uma seleção de
// texto que COMEÇA dentro da caixa de texto e TERMINA fora da janela — o
// gesto de quem seleciona um parágrafo até o fim e passa um pouco — vira
// um clique no fundo. A janela fechava, e ia junto, sem pergunta nenhuma, o
// que estava escrito: o Manual do Copiloto (até 8.000 caracteres), o texto
// do Fora do horário ainda não salvo, a descrição do "Já tratei".
//
// O QUE ESTA PROVA GUARDA, nas duas janelas:
//   - arrastar a seleção de dentro da caixa de texto até o fundo NÃO fecha a
//     janela, e o texto continua lá;
//   - e o contraste: um clique de verdade no fundo (aperta e solta nele)
//     continua fechando. Sem ele, um conserto que nunca fechasse passaria.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** O telefone que o painel abre — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const NOME = "OTAVIO QUE ESPERA";
const ESPERA = new Date(Date.now() - 2 * 86400e3).toISOString();
const SEMENTE = {
  contatos: [{ id: "ct-fora", numero: "5511970028202", nome: NOME, vantoro_nome: null, nome_zorvin: null,
               vantoro_cliente_id: null, foto_url: null }],
  conversas: [{
    id: "cv-fora", advogado_id: ADV, contato_id: "ct-fora", nao_lidas: 0, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: ESPERA, esperando_desde: ESPERA, tratada_em: null,
    ultima_mensagem: "e então?", frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { id: "ct-fora", nome: NOME, numero: "5511970028202", foto_url: null },
  }],
  mensagens: [{ id: "m-fora-1", conversa_id: "cv-fora", origem: "contato", tipo: "texto", texto: "e então?", criado_em: ESPERA }],
};

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__SEM_COPILOTO = false;
    globalThis.__SEM_DESCRICAO = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__SEM_TRATADA = false;
  }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}
async function clicar(loc, espera = 400) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page_espera(espera);
  return true;
}
const page_espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** O GESTO: aperta dentro da caixa de texto, arrasta selecionando até o
 *  fundo escuro, à esquerda da janela, e solta lá. */
async function selecionarAteOFundo(page, seletor) {
  const caixa = await page.locator(seletor).first().boundingBox();
  if (!caixa) return false;
  await page.mouse.move(caixa.x + 20, caixa.y + 12);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, { steps: 4 });
  await page.mouse.move(30, caixa.y + caixa.height / 2, { steps: 8 });
  await page.mouse.up();
  await page_espera(500);
  return true;
}
/** UM CLIQUE DE VERDADE NO FUNDO: aperta e solta nele. */
async function clicarNoFundo(page) {
  await page.mouse.click(30, 450);
  await page_espera(500);
}

// ==================================================================
console.log("\n1. Departamentos e acessos: o Manual do Copiloto não vai embora");
{
  const { ctx, page, estouros } = await abrirPainel();
  await clicar(page.getByRole("button", { name: "Menu" }));
  await clicar(page.getByRole("button", { name: "Departamentos e acessos" }), 700);
  ok("abri a aba do Copiloto", await clicar(page.locator("[data-aba-copiloto]"), 900));
  const texto = page.locator("[data-manual-texto]");
  ok("o manual está na tela", (await texto.count()) === 1);
  const ESCRITO = "Somos um escritório de advocacia. Nunca prometemos prazo de sentença.\nRespondemos sempre com o nome do cliente.";
  await texto.fill(ESCRITO).catch(() => {});
  await page_espera(200);
  ok("escrevi no manual", (await texto.inputValue().catch(() => "")) === ESCRITO);
  ok("arrastei a seleção do manual até o fundo", await selecionarAteOFundo(page, "[data-manual-texto]"));
  ok("a janela continua aberta", (await page.locator("[data-manual-texto]").count()) === 1);
  ok("com o que escrevi", (await page.locator("[data-manual-texto]").inputValue().catch(() => "")) === ESCRITO);
  await clicarNoFundo(page);
  ok("um clique de verdade no fundo fecha a janela", (await page.locator("[data-manual-texto]").count()) === 0
     && (await page.locator("[data-aba-copiloto]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. A janela do “Já tratei”: a descrição não vai embora");
{
  const { ctx, page, estouros } = await abrirPainel();
  await clicar(page.locator(`[data-conversa-nome="${NOME}"]`), 900);
  ok("abri a janela do “Já tratei”", await clicar(page.locator('[data-ja-tratei="tratar"]'), 500));
  await clicar(page.locator('[data-assunto-do-ja-tratei="OUTROS"] input'), 300);
  const campo = page.locator("[data-ja-tratei-descricao]");
  ok("marquei OUTROS, e o campo da descrição apareceu", (await campo.count()) === 1);
  const DESCRITO = "Cliente pediu a segunda via do boleto; enviada por e-mail às 14h.";
  await campo.fill(DESCRITO).catch(() => {});
  await page_espera(200);
  ok("arrastei a seleção da descrição até o fundo", await selecionarAteOFundo(page, "[data-ja-tratei-descricao]"));
  ok("a janela continua aberta", (await page.locator("[data-ja-tratei-janela]").count()) === 1);
  ok("com a descrição", (await page.locator("[data-ja-tratei-descricao]").inputValue().catch(() => "")) === DESCRITO);
  ok("e com o OUTROS marcado", await page.locator('[data-assunto-do-ja-tratei="OUTROS"] input').isChecked().catch(() => false));
  await clicarNoFundo(page);
  ok("um clique de verdade no fundo fecha a janela", (await page.locator("[data-ja-tratei-janela]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
