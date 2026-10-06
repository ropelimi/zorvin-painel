// A MENSAGEM AGENDADA (02/10) — pedido do Rodrigo: "ter a opção de agendar
// mensagens". Texto e anexo; sai na hora marcada mesmo que o cliente escreva
// antes; qualquer pessoa da equipe pode cancelar.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. com texto na caixa aparece o relógio, e a janela da hora DIZ a hora no
//      botão de confirmar;
//   2. agendar grava UM item na fila com a hora em `agendada_para` E em
//      `tentar_em` (é o `tentar_em` que a leitura da ponte já respeita), e
//      NÃO desenha bolha na conversa — nada foi ao cliente ainda;
//   3. hora que já passou é DITA e não é aceita: aceita em silêncio, a
//      mensagem sairia agora;
//   4. a lista de agendadas mostra a hora e quem agendou, com Cancelar;
//      cancelar vira o item para 'cancelada', e o "não deu" é dito;
//   5. o anexo agenda pela mesma janela, e também sem bolha;
//   6. sem o script 013 (sem a coluna), o relógio não aparece e enviar segue
//      como sempre; e a leitura que falha é DITA, e não vira "nada agendado".
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** A conversa que o painel abre primeiro — descoberta, e não escolhida a dedo. */
async function primeiraConversa() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(1000);
  const id = await page.evaluate(() =>
    document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id"));
  await ctx.close();
  return id;
}
const ALVO = await primeiraConversa();
ok("achei a conversa da prova", Boolean(ALVO));

const AGORA = Date.now();
const DAQUI_3H = new Date(AGORA + 3 * 3600 * 1000).toISOString();

async function abrirPainel({ largura = 1400, bandeiras = {}, semente = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript(({ b, semente }) => {
    globalThis.__SEMENTE = semente;
    globalThis.__SEM_COLUNAS = b.semColunas || {};
    globalThis.__ESCRITA_SEM_EFEITO = b.semEfeito || [];
    globalThis.__QUEBRAR = b.quebrar || [];
    globalThis.__ERRO_NA_GRAVACAO = b.erroNaGravacao || {};
    globalThis.__DEPOSITO_COM_ENDERECO = true;
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { b: bandeiras, semente });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(1000);
  await page.locator(`[data-conversa-id="${ALVO}"]`).first().click();
  await page.waitForTimeout(900);
  return { ctx, page, estouros };
}
const fila = (page) => page.evaluate((alvo) =>
  (globalThis.__TABELAS.fila_envio || []).filter((x) => String(x.conversa_id) === String(alvo)), ALVO);
const filme = (page) => page.evaluate(() => globalThis.__AVISOS_VISTOS.join(" | "));
async function escrever(page, texto) {
  const caixa = page.locator('[data-campo="mensagem"]');
  await caixa.click();
  await caixa.fill(texto);
  await page.waitForTimeout(150);
}
/** Clique GUARDADO: num elemento que não existe — ou que está COBERTO por
 *  outro —, `click()` estoura a prova inteira depois de 30 segundos, e prova
 *  que estoura não diz QUAL conferência viu o defeito. Foi um clique coberto
 *  que achou o botão "Ir para o fim" pousado em cima do Cancelar. */
async function clicar(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
const bolhasCom = (page, texto) => page.evaluate((t) =>
  [...document.querySelectorAll("[data-msg-id], [data-bolha]")].filter((b) => b.innerText.includes(t)).length, texto);
/** O instante de "amanhã às H:00" na hora local do navegador da prova. */
const amanhaAs = (page, h) => page.evaluate((h) => {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d.toISOString();
}, h);

console.log("\n1. Com texto na caixa, o relógio; a janela diz a hora no botão");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("sem texto, nada de relógio", (await page.locator("[data-agendar]").count()) === 0);
  await escrever(page, "Lembrete: audiência amanhã às 14h");
  ok("com texto, o relógio aparece", (await page.locator("[data-agendar]").count()) === 1);
  ok("abri a janela da hora", await clicar(page, "[data-agendar]"));
  ok("a janela está na tela", await page.locator("[data-escolher-hora]").isVisible().catch(() => false));
  const desligado = await page.locator("[data-agenda-confirmar]").isDisabled().catch(() => false);
  ok("sem hora escolhida, o botão nasce desligado", desligado);

  console.log("\n3. Hora que já passou é dita, e não é aceita");
  await page.locator("[data-agenda-dia]").fill("2020-01-01");
  await page.locator("[data-agenda-hora]").fill("09:00");
  await page.waitForTimeout(150);
  ok("a janela diz que a hora já passou",
     /já passou/.test(await page.locator("[data-agenda-problema]").innerText().catch(() => "")));
  ok("e o botão continua desligado", await page.locator("[data-agenda-confirmar]").isDisabled().catch(() => false));

  console.log("\n2. Agendar grava a hora nos dois lugares, e não desenha bolha");
  ok("escolhi “Amanhã às 9h”", await clicar(page, '[data-agenda-rapida="amanha9"]'));
  const rotulo = await page.locator("[data-agenda-confirmar]").innerText().catch(() => "");
  ok("o botão escreve a hora: “Agendar para amanhã às 09:00”", /Agendar para amanhã às 09:00/.test(rotulo), rotulo);
  const antes = (await fila(page)).length;
  ok("confirmei", await clicar(page, "[data-agenda-confirmar]"));
  await page.waitForTimeout(700);
  const depois = await fila(page);
  const nova = depois.find((x) => x.texto === "Lembrete: audiência amanhã às 14h");
  const esperado = await amanhaAs(page, 9);
  ok("entrou UM item na fila", depois.length === antes + 1 && Boolean(nova), JSON.stringify(depois.slice(-1)));
  ok("com a hora marcada em `agendada_para`", nova && nova.agendada_para === esperado,
     `${nova && nova.agendada_para} ≠ ${esperado}`);
  ok("e a MESMA hora em `tentar_em` (é o que a ponte já respeita)", nova && nova.tentar_em === esperado,
     String(nova && nova.tentar_em));
  ok("pendente, e com quem agendou", nova && nova.status === "pendente" && Boolean(nova.enviado_por_id),
     JSON.stringify(nova));
  ok("a caixa de escrever ficou vazia", (await page.locator('[data-campo="mensagem"]').inputValue()) === "");
  ok("NENHUMA bolha na conversa — nada foi ao cliente ainda",
     (await bolhasCom(page, "Lembrete: audiência amanhã às 14h")) === 0);
  ok("o aviso diz para quando ficou", /agendada para amanhã às 09:00/i.test(await filme(page)), await filme(page));

  console.log("\n4. A lista das agendadas, e o Cancelar");
  const linha = page.locator("[data-agendada]");
  ok("a agendada aparece acima da caixa", (await linha.count()) === 1);
  const texto = await linha.first().innerText().catch(() => "");
  ok("dizendo a hora e quem agendou", /amanhã às 09:00/.test(texto) && /por você/.test(texto), texto);
  ok("cancelei", await clicar(page, "[data-cancelar-agendada]"));
  await page.waitForTimeout(600);
  const cancelada = (await fila(page)).find((x) => x.id === nova?.id);
  ok("o item virou 'cancelada'", cancelada && cancelada.status === "cancelada", JSON.stringify(cancelada));
  ok("com quem cancelou", cancelada && Boolean(cancelada.cancelada_por) && Boolean(cancelada.cancelada_em));
  ok("e sumiu da lista", (await page.locator("[data-agendada]").count()) === 0);
  ok("o aviso diz que não vai sair", /não vai sair/.test(await filme(page)), await filme(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n4b. O que um colega agendou aparece, e a que está na hora não oferece cancelar");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: { fila_envio: [
    { id: "ag-colega", conversa_id: ALVO, tipo: "texto", texto: "Bom dia! Segue o boleto.",
      status: "pendente", agendada_para: DAQUI_3H, tentar_em: DAQUI_3H,
      enviado_por: "Jenifer", enviado_por_id: "u-jenifer", criado_em: new Date(AGORA - 60000).toISOString() },
    { id: "ag-saindo", conversa_id: ALVO, tipo: "texto", texto: "Esta já está na hora",
      status: "pendente", agendada_para: new Date(AGORA - 5000).toISOString(),
      tentar_em: new Date(AGORA - 5000).toISOString(),
      enviado_por: "Jenifer", enviado_por_id: "u-jenifer", criado_em: new Date(AGORA - 120000).toISOString() },
    { id: "comum", conversa_id: ALVO, tipo: "texto", texto: "Pendente comum, sem hora",
      status: "pendente", criado_em: new Date(AGORA - 1000).toISOString() },
  ] } });
  const linhas = await page.locator("[data-agendada]").allInnerTexts();
  ok("as duas agendadas aparecem, e a pendente comum não", linhas.length === 2, JSON.stringify(linhas));
  ok("a do colega diz quem agendou", linhas.some((t) => /por Jenifer/.test(t) && /boleto/.test(t)), JSON.stringify(linhas));
  const saindo = page.locator('[data-agendada="ag-saindo"]');
  ok("a que está na hora diz “Saindo agora”", /Saindo agora/.test(await saindo.innerText().catch(() => "")));
  ok("e não oferece Cancelar", (await saindo.locator("[data-cancelar-agendada]").count()) === 0);
  ok("a outra oferece", (await page.locator('[data-agendada="ag-colega"] [data-cancelar-agendada]').count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n4c. Cancelar que o banco não deixa: a tela DIZ, e não finge");
{
  const { ctx, page } = await abrirPainel({ bandeiras: { semEfeito: ["fila_envio"] }, semente: { fila_envio: [
    { id: "ag-preso", conversa_id: ALVO, tipo: "texto", texto: "Não vai cancelar",
      status: "pendente", agendada_para: DAQUI_3H, tentar_em: DAQUI_3H,
      enviado_por: "Jenifer", enviado_por_id: "u-jenifer", criado_em: new Date(AGORA - 60000).toISOString() },
  ] } });
  ok("cliquei em Cancelar", await clicar(page, "[data-cancelar-agendada]"));
  await page.waitForTimeout(600);
  const f = await filme(page);
  ok("a tela diz que não deu", /Não deu para cancelar/.test(f), f);
  ok("e NÃO diz que cancelou", !/Agendamento cancelado/.test(f), f);
  ok("a agendada continua na lista", (await page.locator('[data-agendada="ag-preso"]').count()) === 1);
  await ctx.close();
}

console.log("\n4d. Editar a agendada: o texto e a hora (pedido de 05/10)");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: { fila_envio: [
    { id: "ag-editar", conversa_id: ALVO, tipo: "texto", texto: "Texto antigo do lembrete",
      status: "pendente", agendada_para: DAQUI_3H, tentar_em: DAQUI_3H,
      enviado_por: "Jenifer", enviado_por_id: "u-jenifer", criado_em: new Date(AGORA - 60000).toISOString() },
    { id: "ag-quase", conversa_id: ALVO, tipo: "texto", texto: "Sai em meio minuto",
      status: "pendente", agendada_para: new Date(AGORA + 40000).toISOString(),
      tentar_em: new Date(AGORA + 40000).toISOString(), criado_em: new Date(AGORA - 60000).toISOString() },
  ] } });
  ok("a agendada tem o botão Editar", (await page.locator('[data-agendada="ag-editar"] [data-editar-agendada]').count()) === 1);
  ok("a que sai em menos de um minuto NÃO oferece editar",
     (await page.locator('[data-agendada="ag-quase"] [data-editar-agendada]').count()) === 0);
  ok("abri a edição", await clicar(page, '[data-agendada="ag-editar"] [data-editar-agendada]'));
  const janela = page.locator('[data-escolher-hora][data-modo="editar"]');
  ok("a janela de editar abriu", (await janela.count()) === 1);
  ok("com o texto de agora na caixa",
     (await janela.locator("[data-agenda-texto]").inputValue().catch(() => "")) === "Texto antigo do lembrete");
  const resumo = await janela.locator("[data-agenda-resumo]").innerText().catch(() => "");
  ok("e com a hora que estava marcada já escolhida", /Sai/.test(resumo), resumo);
  // TEXTO VAZIO NÃO SE SALVA: para não mandar, é o Cancelar.
  await janela.locator("[data-agenda-texto]").fill("   ");
  ok("texto vazio desliga o salvar", await janela.locator("[data-agenda-confirmar]").isDisabled().catch(() => false));
  await janela.locator("[data-agenda-texto]").fill("Texto NOVO do lembrete");
  await clicar(page, '[data-escolher-hora][data-modo="editar"] [data-agenda-rapida="amanha14"]');
  const esperado = await amanhaAs(page, 14);
  ok("salvei", await clicar(page, '[data-escolher-hora][data-modo="editar"] [data-agenda-confirmar]'));
  await page.waitForTimeout(700);
  const item = (await fila(page)).find((x) => x.id === "ag-editar");
  ok("o texto mudou na fila", item && item.texto === "Texto NOVO do lembrete", JSON.stringify(item));
  ok("e a hora mudou nos DOIS lugares", item && item.agendada_para === esperado && item.tentar_em === esperado,
     JSON.stringify(item));
  ok("continua pendente, e com quem editou", item && item.status === "pendente" && Boolean(item.editada_por),
     JSON.stringify(item));
  ok("a janela fechou", (await page.locator("[data-editar-agendada-janela]").count()) === 0);
  const linha = await page.locator('[data-agendada="ag-editar"]').innerText().catch(() => "");
  ok("a faixa mostra o texto e a hora novos", /Texto NOVO/.test(linha) && /amanhã às 14:00/.test(linha), linha);
  ok("o aviso diz que alterou", /alterada/.test(await filme(page)), await filme(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n4e. Editar que o banco recusa: a tela DIZ, com o código, e nada muda");
{
  const { ctx, page } = await abrirPainel({ bandeiras: { erroNaGravacao: { fila_envio: {
      code: "42501", message: "new row violates row-level security policy for table \"fila_envio\"" } } },
    semente: { fila_envio: [
      { id: "ag-recusa", conversa_id: ALVO, tipo: "texto", texto: "Não muda",
        status: "pendente", agendada_para: DAQUI_3H, tentar_em: DAQUI_3H, criado_em: new Date(AGORA - 60000).toISOString() },
    ] } });
  await clicar(page, '[data-agendada="ag-recusa"] [data-editar-agendada]');
  await page.locator('[data-escolher-hora][data-modo="editar"] [data-agenda-texto]').fill("Tentativa");
  await clicar(page, '[data-escolher-hora][data-modo="editar"] [data-agenda-confirmar]');
  await page.waitForTimeout(700);
  const f = await filme(page);
  ok("a tela diz que não deu, com o código", /Não deu para editar/.test(f) && /42501/.test(f), f);
  ok("e não diz que alterou", !/alterada/.test(f), f);
  ok("e o texto continua o de antes",
     (await fila(page)).find((x) => x.id === "ag-recusa")?.texto === "Não muda");
  await ctx.close();
}

console.log("\n5. O anexo agenda pela mesma janela, sem bolha");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "contrato-agendado-7731.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prova"),
  });
  await page.waitForTimeout(400);
  ok("a prévia do anexo abriu", (await page.locator("[data-previa-anexo]").count()) === 1);
  ok("ela tem o relógio", await clicar(page, "[data-agendar-anexo]"));
  ok("a janela da hora abriu sobre a prévia", await page.locator("[data-escolher-hora]").isVisible().catch(() => false));
  // Esc fecha a JANELA, e não o lote que a pessoa montou.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("Esc fecha a janela da hora", (await page.locator("[data-escolher-hora]").count()) === 0);
  ok("e a prévia continua aberta", (await page.locator("[data-previa-anexo]").count()) === 1);
  await clicar(page, "[data-agendar-anexo]");
  await clicar(page, '[data-agenda-rapida="amanha14"]');
  await clicar(page, "[data-agenda-confirmar]");
  await page.waitForTimeout(900);
  const item = (await fila(page)).find((x) => x.midia_nome === "contrato-agendado-7731.pdf");
  const esperado = await amanhaAs(page, 14);
  ok("o anexo entrou na fila, agendado", item && item.agendada_para === esperado && item.tentar_em === esperado,
     JSON.stringify(item));
  ok("como documento, com o endereço do depósito", item && item.tipo === "documento" && /deposito/.test(item.midia_url || ""),
     JSON.stringify(item));
  ok("a prévia fechou", (await page.locator("[data-previa-anexo]").count()) === 0);
  ok("nenhuma bolha do anexo na conversa", (await bolhasCom(page, "contrato-agendado-7731.pdf")) === 0);
  ok("e ele aparece na lista das agendadas",
     /contrato-agendado-7731\.pdf/.test((await page.locator("[data-agendadas]").innerText().catch(() => ""))));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n6. Sem o script 013: nada de relógio, e enviar segue como sempre");
{
  const { ctx, page, estouros } = await abrirPainel({ bandeiras: { semColunas: { fila_envio: ["agendada_para"] } } });
  await escrever(page, "Mensagem comum sem a coluna");
  ok("sem a coluna, o relógio não aparece", (await page.locator("[data-agendar]").count()) === 0);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const item = (await fila(page)).find((x) => x.texto === "Mensagem comum sem a coluna");
  ok("e Enter envia como sempre", item && !item.agendada_para, JSON.stringify(item));
  ok("sem faixa de falha por causa disso",
     !/agendadas/.test(await page.locator("[data-falha-de-leitura]").innerText().catch(() => "")));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ bandeiras: { quebrar: ["fila_envio"] } });
  const faixa = await page.locator("[data-falha-de-leitura]").innerText().catch(() => "");
  ok("a leitura das agendadas que falha é DITA na faixa", /agendadas/.test(faixa), faixa);
  await ctx.close();
}

console.log("\n7. No celular, a janela da hora cabe na tela");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 360 });
  await escrever(page, "Do celular");
  ok("o relógio aparece no celular", await clicar(page, "[data-agendar]"));
  const caixa = await page.locator("[data-escolher-hora]").boundingBox().catch(() => null);
  ok("e a janela fica inteira dentro dos 360px", caixa && caixa.x >= 0 && caixa.x + caixa.width <= 360,
     JSON.stringify(caixa));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
