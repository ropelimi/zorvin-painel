// A NOTA NÃO VAI AO CLIENTE PELO RELÓGIO (auditoria de 28/10)
//
// O relógio de agendar só aparece com texto na caixa, fora da nota e fora da
// edição — agendar é mandar ESTE texto ao cliente. Mas a JANELA da hora, uma
// vez aberta, só conferia "há texto na caixa": virando a caixa para nota
// interna com a janela aberta (o botão da nota não a fecha), escolher a hora
// agendava a NOTA para o cliente. O mesmo com uma edição começada por cima:
// a correção de uma mensagem que já foi saía como mensagem nova, na hora
// marcada. `agendarTexto` não perguntava em que modo a caixa estava.
//
// Medido aqui: a janela que ficava aberta na nota subia junto com a caixa
// para o alto da conversa, quase toda acima da tela — mas o teclado a alcança.
// Na edição ela fica onde estava, inteira, com a hora já escolhida.
//
// O QUE ESTA PROVA GUARDA: a janela some quando a caixa vira nota ou edição,
// e nada do que estava nela é agendado; e, no modo de mensagem, o agendar de
// sempre continua funcionando.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const TEL = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const NOME = "RELOGIO CLIENTE PROVA";
const SEMENTE = {
  contatos: [{ id: "ct-rel", numero: "5511970006601", nome: NOME, vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-rel", advogado_id: TEL, contato_id: "ct-rel", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(),
    ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-rel", nome: NOME, numero: "5511970006601", foto_url: null } }],
  mensagens: [
    { id: "m-rel-1", conversa_id: "cv-rel", origem: "contato", tipo: "texto", texto: "oi, doutor",
      id_uazapi: "uz-m-rel-1", criado_em: new Date(AGORA - 20 * 60e3).toISOString() },
    { id: "m-rel-nossa", conversa_id: "cv-rel", origem: "advogado", tipo: "texto", texto: "Mensagem que vai ser corrigida",
      id_uazapi: "uz-m-rel-nossa", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "enviada",
      criado_em: new Date(AGORA - 3 * 60e3).toISOString() },
  ],
};

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('[data-conversa-id="cv-rel"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  return { ctx, page, estouros };
}
/** Clique GUARDADO: o que não existe (ou está coberto) não estoura a prova. */
async function clicar(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
const agendadas = (page) => page.evaluate(() => (globalThis.__TABELAS.fila_envio || [])
  .filter((f) => f.conversa_id === "cv-rel" && f.agendada_para).map((f) => f.texto));
const janela = (page) => page.locator('[data-escolher-hora][data-modo="agendar"]').count();
/** A hora escolhida ANTES de a caixa mudar de modo, e o "Agendar" apertado
 *  DEPOIS — SE a janela ainda estiver lá. É o gesto de quem escolheu a hora,
 *  lembrou de anotar algo para a equipe e voltou para confirmar. */
const escolherAHora = (page) => clicar(page, '[data-escolher-hora] [data-agenda-rapida="amanha9"]');
async function confirmar(page) {
  await clicar(page, '[data-escolher-hora] [data-agenda-confirmar]');
  await page.waitForTimeout(700);
}

// ==================================================================
console.log("\n1. Virar a caixa para nota com o relógio aberto");
{
  const { ctx, page, estouros } = await abrirPainel();
  const NOTA = "Cliente mente sobre a data, conferir antes de responder";
  await page.locator('[data-campo="mensagem"]').fill(NOTA);
  ok("abri o relógio com o texto na caixa", await clicar(page, "[data-agendar]") && (await janela(page)) === 1);
  ok("virei a caixa para nota interna", await clicar(page, "[data-nota-interna]")
     && (await page.locator('[data-campo="nota"]').count()) === 1);
  ok("a janela da hora some — nota não se agenda", (await janela(page)) === 0);
  // A JANELA QUE FICAVA subia junto com a caixa da nota, e a maior parte dela
  // ia parar acima da tela — mas o TECLADO a alcança (Tab até o atalho, Enter,
  // Tab até "Agendar", Enter). O clique vai direto nos botões, como o Enter.
  await page.evaluate(() => {
    document.querySelector('[data-escolher-hora] [data-agenda-rapida="amanha9"]')?.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.querySelector("[data-escolher-hora] [data-agenda-confirmar]")?.click(); });
  await page.waitForTimeout(700);
  ok("e a nota NÃO foi agendada para o cliente", !(await agendadas(page)).includes(NOTA),
     JSON.stringify(await agendadas(page)));
  ok("o texto continua na caixa da nota", (await page.locator('[data-campo="nota"]').inputValue().catch(() => "")) === NOTA);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Começar uma edição com o relógio aberto");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.locator('[data-campo="mensagem"]').fill("Um rascunho qualquer");
  ok("abri o relógio", await clicar(page, "[data-agendar]") && (await janela(page)) === 1);
  ok("escolhi a hora", await escolherAHora(page));
  await page.locator('[data-msg-id="m-rel-nossa"]').hover().catch(() => {});
  ok("abri o menu da nossa mensagem", await clicar(page, '[data-msg-id="m-rel-nossa"] button[aria-label="Opções da mensagem"]'));
  // O "Editar" pode ficar ATRÁS da janela da hora — o menu abre para baixo, e
  // ela ocupa o pé da coluna. O teclado o alcança; o clique vai direto nele.
  ok("cliquei em Editar", await page.evaluate(() => {
    const b = [...document.querySelectorAll("div[data-menu-msg] button")].find((x) => /Editar/.test(x.textContent || ""));
    if (b) b.click();
    return Boolean(b);
  }));
  await page.waitForTimeout(300);
  ok("a caixa está corrigindo a mensagem",
     /Corrija a mensagem/.test(await page.locator("[data-campo]").first().getAttribute("placeholder").catch(() => "")));
  ok("a janela da hora some — a correção não é mensagem nova", (await janela(page)) === 0);
  await confirmar(page);
  ok("e a correção NÃO foi agendada como mensagem nova",
     !(await agendadas(page)).includes("Mensagem que vai ser corrigida"), JSON.stringify(await agendadas(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. O contraste: no modo de mensagem, o relógio agenda como sempre");
{
  const { ctx, page, estouros } = await abrirPainel();
  const TEXTO = "Lembrete: a audiência é amanhã às 14h";
  await page.locator('[data-campo="mensagem"]').fill(TEXTO);
  ok("abri o relógio", await clicar(page, "[data-agendar]") && (await janela(page)) === 1);
  ok("escolhi a hora", await escolherAHora(page));
  await confirmar(page);
  ok("a mensagem foi agendada", (await agendadas(page)).includes(TEXTO), JSON.stringify(await agendadas(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
