// EDITAR NÃO APAGA O QUE SE ESCREVIA, E A CORREÇÃO NÃO SE PERDE NA FALHA
// (auditoria de 28/10)
//
// Dois defeitos na mesma caixa de escrever:
//
//   1. COMEÇAR UMA EDIÇÃO APAGAVA O RASCUNHO. O lápis da nota e o "Editar" da
//      mensagem punham o texto antigo na caixa (`setRascunho(m.texto)`) sem
//      guardar o que estava escrito — e sair da edição, salvando ou
//      cancelando, esvaziava a caixa. A citação em curso ia junto. Quem
//      escrevia uma resposta longa, parava para corrigir uma nota e apertava
//      Enter perdia a resposta inteira;
//   2. A CORREÇÃO SUMIA QUANDO A GRAVAÇÃO FALHAVA. A edição da mensagem e a da
//      nota saíam do modo de edição ANTES de saber se tinham gravado, e a
//      janela da agendada fechava antes do `update`. Na falha, a bolha voltava
//      ao texto de antes — e o texto corrigido não estava em lugar nenhum.
//
// O QUE ESTA PROVA GUARDA: o que estava na caixa (o texto, o modo, a citação)
// volta ao sair da edição — salvando, cancelando ou com Esc —, e vira o
// rascunho da conversa quando se troca de conversa no meio dela; na falha, a
// correção continua na caixa (ou na janela), pronta para a segunda tentativa;
// e, como a caixa agora fica com a correção enquanto o banco não responde, um
// segundo Enter nesse meio não manda a mesma correção duas vezes.
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

const NOME = "EDICAO CLIENTE PROVA";
const DAQUI_3H = new Date(AGORA + 3 * 3600e3).toISOString();
const PERGUNTA = "Doutor, e o meu processo?";
const ERRADA = "Mensagem com erro de digitaçao";
const SEMENTE = {
  contatos: [{ id: "ct-ed", numero: "5511970008811", nome: NOME, vantoro_nome: null, nome_zorvin: null },
             { id: "ct-ed-2", numero: "5511970008812", nome: "EDICAO OUTRA CONVERSA", vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-ed", advogado_id: TEL, contato_id: "ct-ed", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(),
    ultima_mensagem: ERRADA, frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-ed", nome: NOME, numero: "5511970008811", foto_url: null } },
  { id: "cv-ed-2", advogado_id: TEL, contato_id: "ct-ed-2", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 590e3).toISOString(),
    ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-ed-2", nome: "EDICAO OUTRA CONVERSA", numero: "5511970008812", foto_url: null } }],
  mensagens: [
    { id: "m-ed-cliente", conversa_id: "cv-ed", origem: "contato", tipo: "texto", texto: PERGUNTA,
      id_uazapi: "uz-m-ed-cliente", criado_em: new Date(AGORA - 30 * 60e3).toISOString() },
    // NOSSA E DENTRO DO PRAZO do WhatsApp para editar (14 minutos).
    { id: "m-ed-nossa", conversa_id: "cv-ed", origem: "advogado", tipo: "texto", texto: ERRADA,
      id_uazapi: "uz-m-ed-nossa", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "enviada",
      criado_em: new Date(AGORA - 2 * 60e3).toISOString() },
    // A conversa sem mensagem nenhuma fica fora da lista.
    { id: "m-ed-2", conversa_id: "cv-ed-2", origem: "contato", tipo: "texto", texto: "oi",
      id_uazapi: "uz-m-ed-2", criado_em: new Date(AGORA - 60 * 60e3).toISOString() },
  ],
  notas: [{ id: "n-ed", conversa_id: "cv-ed", texto: "nota antiga da equipe", autor: "Rodrigo Sousa",
    autor_id: "u1", autor_foto: null, editada_em: null, editada_por: null, apagada_em: null,
    apagada_por: null, apagada_por_id: null, criado_em: new Date(AGORA - 10 * 60e3).toISOString() }],
  fila_envio: [{ id: "ag-ed", conversa_id: "cv-ed", tipo: "texto", texto: "Agendada antiga",
    status: "pendente", agendada_para: DAQUI_3H, tentar_em: DAQUI_3H, enviado_por: "Rodrigo Sousa",
    enviado_por_id: "u1", criado_em: new Date(AGORA - 60e3).toISOString() }],
};
const RECUSA = { code: "42501", message: "new row violates row-level security policy" };

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__AVISOS_VISTOS = [];
    // O FILME DOS AVISOS, e não a foto: a faixa mostra uma frase por vez.
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('[data-conversa-id="cv-ed"]').first().click().catch(() => {});
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}
/** Clique GUARDADO: o que não existe (ou está coberto) não estoura a prova. */
async function clicar(page, sel) {
  const l = typeof sel === "string" ? page.locator(sel) : sel;
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
async function menuDa(page, id, item) {
  await page.locator(`[data-msg-id="${id}"]`).hover().catch(() => {});
  if (!(await clicar(page, `[data-msg-id="${id}"] button[aria-label="Opções da mensagem"]`))) return false;
  return clicar(page, `div[data-menu-msg] button:has-text("${item}")`);
}
const caixa = (page) => page.locator("[data-campo]").first();
/** O que a caixa mostra: o modo, o texto e a dica (que diz se é edição). */
const estadoDaCaixa = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-campo]");
  return c ? { modo: c.getAttribute("data-campo"), texto: c.value, dica: c.getAttribute("placeholder") || "" } : null;
});
const citando = (page) => page.evaluate(() => /Respondendo/.test(document.body.innerText)
  && document.body.innerText.includes("Doutor, e o meu processo?") ? "sim" : "não");
const filme = (page) => page.evaluate(() => globalThis.__AVISOS_VISTOS.join(" | "));
const falhar = (page, tabela) => page.evaluate(([t, r]) => { globalThis.__ERRO_NA_GRAVACAO = t ? { [t]: r } : {}; },
  [tabela, RECUSA]);
const textoDaBolha = (page, id) => page.evaluate((i) =>
  document.querySelector(`[data-msg-id="${i}"]`)?.innerText || "", id);

// ==================================================================
console.log("\n1. O lápis da nota não apaga a resposta que estava sendo escrita");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("cliquei em Responder na pergunta do cliente", await menuDa(page, "m-ed-cliente", "Responder"));
  const RASCUNHO = "Resposta longa ao cliente: o processo está na fase de perícia, e a audiência fica para março.";
  await caixa(page).fill(RASCUNHO);
  ok("a resposta está na caixa, citando a pergunta",
     (await estadoDaCaixa(page))?.texto === RASCUNHO && (await citando(page)) === "sim");
  ok("cliquei no lápis da nota", await clicar(page, 'button[title="Editar nota"]'));
  await page.waitForTimeout(300);
  const editando = await estadoDaCaixa(page);
  ok("a caixa virou a da nota, com o texto dela",
     editando?.modo === "nota" && editando?.texto === "nota antiga da equipe", JSON.stringify(editando));
  await caixa(page).fill("nota corrigida pela equipe");
  await caixa(page).press("Enter");
  await page.waitForTimeout(1200);
  const nota = await page.evaluate(() => (globalThis.__TABELAS.notas || []).find((n) => n.id === "n-ed"));
  ok("a nota foi corrigida no banco", nota?.texto === "nota corrigida pela equipe", JSON.stringify(nota));
  const depois = await estadoDaCaixa(page);
  ok("e a RESPOSTA voltou para a caixa", depois?.texto === RASCUNHO, JSON.stringify(depois));
  ok("no modo de mensagem, e não no de nota", depois?.modo === "mensagem", JSON.stringify(depois));
  ok("e a citação da pergunta voltou junto", (await citando(page)) === "sim");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Cancelar a edição (Esc) devolve o rascunho");
{
  const { ctx, page, estouros } = await abrirPainel();
  const RASCUNHO = "Rascunho de antes do Editar";
  await caixa(page).fill(RASCUNHO);
  ok("cliquei em Editar na nossa mensagem", await menuDa(page, "m-ed-nossa", "Editar"));
  const editando = await estadoDaCaixa(page);
  ok("a caixa mostra a mensagem a corrigir", editando?.texto === ERRADA && /Corrija/.test(editando?.dica || ""),
     JSON.stringify(editando));
  await caixa(page).press("Escape");
  await page.waitForTimeout(300);
  const depois = await estadoDaCaixa(page);
  ok("Esc cancelou a edição e o rascunho voltou", depois?.texto === RASCUNHO && !/Corrija/.test(depois?.dica || ""),
     JSON.stringify(depois));
  ok("e a conversa continua aberta", (await page.locator("[data-topo-conversa]").count()) === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2b. Trocar de conversa no meio da edição guarda o rascunho de antes dela");
{
  // A edição não atravessa a troca (auditoria de 07/10), e o texto DELA não
  // vira rascunho. Mas o que ela tirou da caixa era o rascunho desta conversa.
  const { ctx, page, estouros } = await abrirPainel();
  const RASCUNHO = "Rascunho que a troca de conversa não pode levar";
  await caixa(page).fill(RASCUNHO);
  ok("cliquei em Editar na nossa mensagem", await menuDa(page, "m-ed-nossa", "Editar"));
  ok("troquei de conversa", await clicar(page, '[data-conversa-id="cv-ed-2"]'));
  await page.waitForTimeout(900);
  const la = await estadoDaCaixa(page);
  ok("na outra conversa, a caixa está vazia e sem edição", la?.texto === "" && !/Corrija/.test(la?.dica || ""),
     JSON.stringify(la));
  ok("voltei", await clicar(page, '[data-conversa-id="cv-ed"]'));
  await page.waitForTimeout(900);
  const volta = await estadoDaCaixa(page);
  ok("de volta, o rascunho de antes da edição está na caixa",
     volta?.texto === RASCUNHO && volta?.modo === "mensagem" && !/Corrija/.test(volta?.dica || ""), JSON.stringify(volta));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. A correção da mensagem que o banco recusa fica na caixa; a que grava devolve o rascunho");
{
  const { ctx, page, estouros } = await abrirPainel();
  const RASCUNHO = "Rascunho que espera a correção terminar";
  await caixa(page).fill(RASCUNHO);
  ok("cliquei em Editar na nossa mensagem", await menuDa(page, "m-ed-nossa", "Editar"));
  const CERTA = "Mensagem com erro de digitação — corrigida";
  await caixa(page).fill(CERTA);
  await falhar(page, "fila_envio");
  await caixa(page).press("Enter");
  await page.waitForTimeout(900);
  const naFalha = await estadoDaCaixa(page);
  ok("na recusa, a correção CONTINUA na caixa", naFalha?.texto === CERTA, JSON.stringify(naFalha));
  ok("e a caixa continua editando a mensagem", /Corrija a mensagem/.test(naFalha?.dica || ""), JSON.stringify(naFalha));
  ok("a tela diz que não deu, com o código", /Não consegui editar/.test(await filme(page)) && /42501/.test(await filme(page)),
     await filme(page));
  ok("e a bolha voltou ao texto de antes", (await textoDaBolha(page, "m-ed-nossa")).includes(ERRADA),
     await textoDaBolha(page, "m-ed-nossa"));
  await falhar(page, null);
  // A FILA DEMORA, e o Enter é apertado duas vezes: a caixa agora fica com a
  // correção até o banco responder, e o segundo Enter não pode mandá-la de novo.
  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = { fila_envio: 700 }; });
  await caixa(page).press("Enter");
  await page.waitForTimeout(150);
  await caixa(page).press("Enter");
  await page.waitForTimeout(1500);
  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = {}; });
  const edicao = await page.evaluate((t) => (globalThis.__TABELAS.fila_envio || [])
    .filter((f) => f.tipo === "edicao" && f.texto === t), CERTA);
  ok("a segunda tentativa grava UMA correção na fila, mesmo com dois Enter", edicao.length === 1,
     JSON.stringify(edicao));
  const depois = await estadoDaCaixa(page);
  ok("e o rascunho de antes volta para a caixa", depois?.texto === RASCUNHO && !/Corrija/.test(depois?.dica || ""),
     JSON.stringify(depois));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. A correção da nota que o banco recusa fica na caixa");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("cliquei no lápis da nota", await clicar(page, 'button[title="Editar nota"]'));
  await page.waitForTimeout(300);
  await falhar(page, "notas");
  await caixa(page).fill("nota que o banco recusa");
  await caixa(page).press("Enter");
  await page.waitForTimeout(900);
  const naFalha = await estadoDaCaixa(page);
  ok("na recusa, a nota corrigida CONTINUA na caixa", naFalha?.texto === "nota que o banco recusa",
     JSON.stringify(naFalha));
  ok("na caixa da nota, ainda editando", naFalha?.modo === "nota" && /Corrija a nota/.test(naFalha?.dica || ""),
     JSON.stringify(naFalha));
  ok("a tela diz que não deu", /Não consegui editar a nota/.test(await filme(page)), await filme(page));
  await falhar(page, null);
  await caixa(page).press("Enter");
  await page.waitForTimeout(900);
  const nota = await page.evaluate(() => (globalThis.__TABELAS.notas || []).find((n) => n.id === "n-ed"));
  ok("a segunda tentativa grava", nota?.texto === "nota que o banco recusa", JSON.stringify(nota));
  const depois = await estadoDaCaixa(page);
  ok("e a caixa volta ao que era: mensagem, vazia", depois?.modo === "mensagem" && depois?.texto === "",
     JSON.stringify(depois));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. A agendada editada que o banco recusa: a janela fica, com o texto");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a edição da agendada", await clicar(page, '[data-agendada="ag-ed"] [data-editar-agendada]'));
  const janela = '[data-escolher-hora][data-modo="editar"]';
  const NOVO = "Agendada corrigida — o banco recusa a primeira";
  await page.locator(`${janela} [data-agenda-texto]`).fill(NOVO).catch(() => {});
  await clicar(page, `${janela} [data-agenda-rapida="amanha14"]`);
  await falhar(page, "fila_envio");
  ok("cliquei em salvar", await clicar(page, `${janela} [data-agenda-confirmar]`));
  await page.waitForTimeout(800);
  ok("a tela diz que não deu", /Não deu para editar/.test(await filme(page)), await filme(page));
  ok("a janela CONTINUA aberta", (await page.locator("[data-editar-agendada-janela]").count()) === 1);
  ok("com o texto corrigido dentro",
     (await page.locator(`${janela} [data-agenda-texto]`).inputValue().catch(() => "")) === NOVO);
  await falhar(page, null);
  ok("cliquei em salvar de novo", await clicar(page, `${janela} [data-agenda-confirmar]`));
  await page.waitForTimeout(800);
  const item = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).find((f) => f.id === "ag-ed"));
  ok("a segunda tentativa grava o texto novo", item?.texto === NOVO, JSON.stringify(item));
  ok("e agora a janela fecha", (await page.locator("[data-editar-agendada-janela]").count()) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
