// A BOLHA QUE SAIU NÃO FICA VERMELHA, E O REENVIAR NÃO MANDA DUAS VEZES
// (auditoria de 27/10).
//
// Desde 26/10 a ponte confirma pelo eco do WhatsApp a mensagem que tinha dado
// tempo esgotado: o item da fila passa de `erro` a `enviada`, às vezes um
// minuto e meio depois, e a mensagem entra em `mensagens`. A frase da bolha
// manda esperar ("se ela saiu, esta bolha some"). O painel não cumpria:
//
//   - o aviso da fila "enviada" só procurava a bolha que ainda estava
//     "enviando", e a vermelha — a do item que acabou de sair — ficava;
//   - a releitura da conversa a guardava, porque a fila relida só traz os
//     itens em erro, e esse já não estava lá;
//   - e o "reenviar" gravava "descartada" POR CIMA de "enviada" e punha a
//     mensagem na fila de novo: o cliente a recebia duas vezes, o caso medido
//     em 26/10.
//
// E TRÊS VIZINHOS DA MESMA AUDITORIA, que são da mesma fila:
//
//   - a reação, a correção e o "apagar para todos" que falham viravam BOLHA
//     (um "🦩" solto, o texto corrigido repetido, uma bolha vazia vermelha);
//   - encaminhar uma foto ou um documento SEM LEGENDA mandava `texto: null`, e
//     `fila_envio.texto` não aceita nulo no banco do escritório (conferido em
//     27/10): "Não consegui encaminhar". A bancada passou a recusar igual;
//   - o "reenviar" era um texto de 15 pontos de altura, e no celular a regra
//     dos 40 pontos de alvo de dedo não o alcançava.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const CARENCIA = 300;
const PESCA = 600;
const HOST = "https://projeto-de-mentira.supabase.co";
const DOC = `${HOST}/storage/v1/object/public/anexos/recebidos/ECO0001DOC.pdf`;
const PROCURACAO = `${HOST}/storage/v1/object/public/anexos/enviados/1761600000000-Procura_o_do_eco.pdf`;
const TEMPO = "Tempo esgotado: a mensagem pode ter saído assim mesmo.";

const nav = await abrirNavegador();
const estouros = [];

/** A conversa que o painel mostra primeiro, e uma segunda — descobertas, e não
 *  escolhidas a dedo. */
async function duasConversas() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-id")));
  await ctx.close();
  return [ids[0], ids.find((x) => x && x !== ids[0])];
}
const [ALVO, OUTRA] = await duasConversas();
ok("achei a conversa da prova, e uma segunda para encaminhar", Boolean(ALVO && OUTRA && ALVO !== OUTRA));

const ha = (min) => new Date(Date.now() - min * 60e3).toISOString();
/** O que esta prova planta, ANTES de a página abrir (`__SEMENTE`). */
function semente() {
  return {
    fila_envio: [
      { id: 9101, conversa_id: ALVO, tipo: "reacao", texto: "🦩", status: "erro", criado_em: ha(9),
        erro_motivo: "O WhatsApp recusou a reação.", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
      { id: 9102, conversa_id: ALVO, tipo: "edicao", texto: "Texto corrigido da prova do eco", status: "erro",
        criado_em: ha(8), erro_motivo: "O WhatsApp recusou a correção.", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
      { id: 9103, conversa_id: ALVO, tipo: "exclusao", texto: "", status: "erro", criado_em: ha(7),
        erro_motivo: "O WhatsApp recusou apagar.", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
      { id: 9104, conversa_id: ALVO, tipo: "texto", texto: "Prova do eco 5, a que saiu depois", status: "erro",
        criado_em: ha(2), erro_motivo: TEMPO, erro_detalhe: "This operation was aborted",
        enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
      { id: 9107, conversa_id: ALVO, tipo: "documento", texto: "", status: "erro", criado_em: ha(3),
        midia_url: PROCURACAO, midia_mime: "application/pdf", midia_nome: "Procuração do eco.pdf",
        erro_motivo: "O WhatsApp recusou o arquivo.", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
    ],
    mensagens: [
      { id: "eco-doc", conversa_id: ALVO, origem: "contato", tipo: "documento", texto: null,
        midia_url: DOC, midia_mime: "application/pdf", midia_nome: "Contrato do eco.pdf",
        criado_em: ha(1), status: "entregue", id_uazapi: "ECO-DOC-1" },
    ],
  };
}

/** Uma janela nova por cena: `addInitScript` ACUMULA, e uma bandeira de uma
 *  cena continuaria valendo na seguinte. */
async function abrir({ largura = 1400, altura = 900, celular = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, isMobile: celular, hasTouch: celular });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript(([s, c, p]) => {
    globalThis.__SEMENTE = s;
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__CADENCIA_DA_PESCA = p;
    // A conferência do envio (12 e 40 s) fica fora do caminho: as cenas medem
    // o aviso da fila e a releitura, e não ela.
    globalThis.__CONFERENCIA_DO_ENVIO = [600000, 600000];
    globalThis.__DEMORA_DO_CANAL = 30;
    // O FILME DA FAIXA DE AVISO: ela mostra uma frase por vez, e a que importa
    // pode ser coberta pela seguinte.
    globalThis.__FILME = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el ? el.innerText : "";
      if (t && globalThis.__FILME[globalThis.__FILME.length - 1] !== t) globalThis.__FILME.push(t);
    }, 50);
  }, [semente(), CARENCIA, PESCA]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page };
}

async function clicar(page, seletor) {
  const alvo = page.locator(seletor).first();
  if (!(await alvo.count())) return false;
  await alvo.click();
  return true;
}

async function abrirAlvo(page) {
  const foi = await clicar(page, `[data-conversa-nome][data-conversa-id="${ALVO}"]`);
  await page.waitForSelector('textarea[placeholder*="Digite uma mensagem"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1300);
  return foi;
}

async function enviar(page, texto) {
  const caixa = page.locator('textarea[placeholder*="Digite uma mensagem"]').first();
  if (!(await caixa.count())) return false;
  await caixa.fill(texto);
  await caixa.press("Enter");
  await page.waitForTimeout(700);
  return true;
}

/** As bolhas com este texto, e o que cada uma diz do envio. */
const bolhas = (page, texto) => page.evaluate((t) =>
  [...document.querySelectorAll("[data-msg-id]")]
    .filter((el) => (el.textContent || "").includes(t))
    .map((el) => ({
      id: el.getAttribute("data-msg-id"),
      estado: el.querySelector("[data-estado-do-envio]")?.getAttribute("data-estado-do-envio") || null,
      reenviar: Boolean(el.querySelector("[data-reenviar]")),
    })), texto);

const filaCom = (page, texto) => page.evaluate((t) =>
  (globalThis.__TABELAS.fila_envio || []).filter((f) => f.texto === t)
    .map((f) => ({ id: f.id, status: f.status })), texto);

/** A ponte dizendo que o item falhou por tempo esgotado. */
const marcarErro = (page, texto) => page.evaluate(([t, motivo]) => {
  const f = (globalThis.__TABELAS.fila_envio || []).filter((x) => x.texto === t).pop();
  if (!f) return null;
  f.status = "erro"; f.erro_motivo = motivo; f.erro_detalhe = "This operation was aborted";
  globalThis.__EMITIR("UPDATE", "fila_envio", { ...f });
  return f.id;
}, [texto, TEMPO]);

/** O eco do WhatsApp chegando à ponte: o item vira `enviada` e a mensagem entra
 *  em `mensagens`, nesta ordem — a de `confirmarPeloEco`. `emitir: false` é o
 *  tempo real que se perdeu. */
const ecoConfirma = (page, texto, emitir = true) => page.evaluate(([t, e]) => {
  const f = (globalThis.__TABELAS.fila_envio || []).filter((x) => x.texto === t).pop();
  if (!f) return null;
  const quando = new Date().toISOString();
  f.status = "enviada"; f.enviado_em = quando;
  f.erro_detalhe = `o WhatsApp confirmou depois que a mensagem saiu (ECO-${f.id})`;
  const m = { id: `eco-msg-${f.id}`, conversa_id: f.conversa_id, origem: "advogado", tipo: f.tipo || "texto",
    texto: t, criado_em: quando, status: "enviada", id_uazapi: `ECO-${f.id}`,
    enviado_por: f.enviado_por || "Rodrigo Sousa", enviado_por_id: f.enviado_por_id || "u1" };
  globalThis.__TABELAS.mensagens.push(m);
  if (e) {
    globalThis.__EMITIR("UPDATE", "fila_envio", { ...f });
    globalThis.__EMITIR("INSERT", "mensagens", { ...m });
  }
  return f.id;
}, [texto, emitir]);

/** Uma releitura da conversa aberta, pelo caminho de verdade: o canal cai, a
 *  pesca relê, e o canal volta. */
async function releitura(page) {
  await page.evaluate(() => globalThis.__DERRUBAR_TEMPO_REAL && globalThis.__DERRUBAR_TEMPO_REAL());
  await page.waitForTimeout(CARENCIA + PESCA + 500);
  await page.evaluate(() => globalThis.__LEVANTAR_TEMPO_REAL && globalThis.__LEVANTAR_TEMPO_REAL());
  await page.waitForTimeout(1200);
}

const filme = (page) => page.evaluate(() => globalThis.__FILME || []);

// ------------------------------------------------------------------
console.log("\n1. O eco confirma pelo tempo real: a vermelha vira enviada");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const T = "Prova do eco 1, pelo tempo real";
  ok("mandei a mensagem", await enviar(page, T));
  ok("ela entrou na fila", (await filaCom(page, T)).length === 1, JSON.stringify(await filaCom(page, T)));
  ok("a ponte disse que deu tempo esgotado", Boolean(await marcarErro(page, T)));
  await page.waitForTimeout(700);
  const vermelha = await bolhas(page, T);
  ok("a bolha ficou vermelha, com o reenviar", vermelha.length === 1 && vermelha[0].estado === "erro" && vermelha[0].reenviar,
     JSON.stringify(vermelha));
  ok("o eco chegou", Boolean(await ecoConfirma(page, T, true)));
  await page.waitForTimeout(1000);
  const depois = await bolhas(page, T);
  ok("sobra UMA bolha com o texto — a mensagem de verdade", depois.length === 1, JSON.stringify(depois));
  ok("e ela não está mais vermelha", depois.length > 0 && depois.every((b) => b.estado !== "erro"), JSON.stringify(depois));
  ok("nem oferece reenviar", depois.every((b) => !b.reenviar), JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. O eco sem tempo real: a releitura tira a vermelha");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const T = "Prova do eco 2, sem tempo real";
  ok("mandei a mensagem", await enviar(page, T));
  ok("a ponte disse que deu tempo esgotado", Boolean(await marcarErro(page, T)));
  await page.waitForTimeout(700);
  ok("a bolha ficou vermelha", (await bolhas(page, T)).some((b) => b.estado === "erro"), JSON.stringify(await bolhas(page, T)));
  ok("o eco confirmou, calado", Boolean(await ecoConfirma(page, T, false)));
  await releitura(page);
  const depois = await bolhas(page, T);
  ok("depois da releitura, UMA bolha com o texto", depois.length === 1, JSON.stringify(depois));
  ok("e não vermelha", depois.length > 0 && depois.every((b) => b.estado !== "erro"), JSON.stringify(depois));

  // O CONTRASTE: a que falhou de verdade continua vermelha na releitura —
  // senão um painel que apagasse toda vermelha passaria acima.
  const F = "Prova do eco 2b, que falhou mesmo";
  ok("mandei outra", await enviar(page, F));
  ok("e a ponte disse que ela falhou", Boolean(await marcarErro(page, F)));
  await page.waitForTimeout(600);
  await releitura(page);
  const falhou = await bolhas(page, F);
  ok("a que falhou de verdade continua vermelha, uma só", falhou.length === 1 && falhou[0].estado === "erro",
     JSON.stringify(falhou));

  // E QUEM REMANDOU À MÃO: a vermelha e a segunda bolha com o mesmo texto. A
  // linha nova é da SEGUNDA, e a vermelha continua vermelha.
  const R = "Prova do eco 2c, mandada duas vezes";
  ok("mandei", await enviar(page, R));
  ok("falhou", Boolean(await marcarErro(page, R)));
  await page.waitForTimeout(500);
  ok("mandei de novo, à mão", await enviar(page, R));
  const segunda = await page.evaluate((t) => {
    const f = (globalThis.__TABELAS.fila_envio || []).filter((x) => x.texto === t && x.status === "pendente").pop();
    if (!f) return null;
    const quando = new Date().toISOString();
    f.status = "enviada"; f.enviado_em = quando;
    globalThis.__TABELAS.mensagens.push({ id: `seg-${f.id}`, conversa_id: f.conversa_id, origem: "advogado",
      tipo: "texto", texto: t, criado_em: quando, status: "enviada", id_uazapi: `SEG-${f.id}`,
      enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" });
    return f.id;
  }, R);
  ok("a segunda saiu, calada", Boolean(segunda));
  await releitura(page);
  const duas = await bolhas(page, R);
  ok("ficam as duas: a de verdade e a vermelha", duas.length === 2, JSON.stringify(duas));
  ok("uma delas continua vermelha", duas.filter((b) => b.estado === "erro").length === 1, JSON.stringify(duas));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Reenviar o que já saiu não manda de novo");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const T = "Prova do eco 3, reenviada depois de sair";
  ok("mandei a mensagem", await enviar(page, T));
  const id = await marcarErro(page, T);
  ok("a ponte disse que deu tempo esgotado", Boolean(id));
  await page.waitForTimeout(700);
  // O eco confirma SEM tempo real nenhum: a vermelha continua na tela, que é o
  // instante em que alguém toca em reenviar.
  ok("o item saiu, sem a tela saber", await page.evaluate((i) => {
    const f = globalThis.__TABELAS.fila_envio.find((x) => x.id === i);
    if (!f) return false;
    f.status = "enviada"; f.enviado_em = new Date().toISOString();
    return true;
  }, id));
  ok("toquei em reenviar", await clicar(page, `[data-msg-id]:has-text("${T}") [data-reenviar]`));
  await page.waitForTimeout(1500);
  const fila = await filaCom(page, T);
  ok("NENHUM item novo entrou na fila", fila.length === 1, JSON.stringify(fila));
  ok("e o item que saiu continua enviada, e não descartada", fila[0]?.status === "enviada", JSON.stringify(fila));
  const recado = (await filme(page)).join(" | ");
  ok("a faixa diz que ela já tinha saído", /já tinha saído/.test(recado), recado);
  const depois = await bolhas(page, T);
  ok("e a bolha deixa de ser vermelha", depois.length === 1 && depois[0].estado !== "erro", JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. Reenviar o que falhou de verdade continua reenviando");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const T = "Prova do eco 4, que falhou mesmo";
  ok("mandei a mensagem", await enviar(page, T));
  ok("a ponte disse que falhou", Boolean(await marcarErro(page, T)));
  await page.waitForTimeout(700);
  ok("toquei em reenviar", await clicar(page, `[data-msg-id]:has-text("${T}") [data-reenviar]`));
  await page.waitForTimeout(1500);
  const fila = await filaCom(page, T);
  ok("a tentativa velha foi aposentada", fila.some((f) => f.status === "descartada"), JSON.stringify(fila));
  ok("e uma nova entrou na fila", fila.filter((f) => f.status === "pendente").length === 1, JSON.stringify(fila));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4b. Sem saber se saiu, o reenviar não manda");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));

  // O PEDIDO QUE NÃO CHEGOU AO BANCO: sem código, é a conexão. Não se sabe se
  // o item saiu, e mandar às cegas é o cliente recebendo duas vezes.
  const T = "Prova do eco 4b, sem conexão";
  ok("mandei a mensagem", await enviar(page, T));
  ok("a ponte disse que falhou", Boolean(await marcarErro(page, T)));
  await page.waitForTimeout(600);
  // SÓ A ALTERAÇÃO FALHA: a inserção da tentativa nova passaria, e é esse o
  // caso que mandaria a mensagem duas vezes.
  await page.evaluate(() => {
    globalThis.__ERRO_NA_GRAVACAO = { fila_envio: { message: "Failed to fetch", apenas: "alteracao" } };
  });
  ok("toquei em reenviar", await clicar(page, `[data-msg-id]:has-text("${T}") [data-reenviar]`));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { globalThis.__ERRO_NA_GRAVACAO = {}; });
  let fila = await filaCom(page, T);
  ok("nada entrou na fila", fila.length === 1 && fila[0].status === "erro", JSON.stringify(fila));
  let recado = (await filme(page)).join(" | ");
  ok("a faixa diz que não conferiu e não mandou", /não a mandei de novo/.test(recado), recado);
  ok("e a bolha continua vermelha, para tentar de novo", (await bolhas(page, T)).some((b) => b.estado === "erro"),
     JSON.stringify(await bolhas(page, T)));

  // REENVIADA POR UMA COLEGA: o item já está "descartada" (ela aposentou a
  // tentativa velha e mandou de novo), e nesta tela a bolha continua vermelha.
  const C = "Prova do eco 4b, reenviada pela colega";
  ok("mandei outra", await enviar(page, C));
  const idC = await marcarErro(page, C);
  ok("e ela falhou", Boolean(idC));
  await page.waitForTimeout(600);
  ok("a colega a reenviou, sem esta tela saber", await page.evaluate((i) => {
    const f = globalThis.__TABELAS.fila_envio.find((x) => x.id === i);
    if (!f) return false;
    f.status = "descartada";
    return true;
  }, idC));
  ok("toquei em reenviar", await clicar(page, `[data-msg-id]:has-text("${C}") [data-reenviar]`));
  await page.waitForTimeout(1500);
  fila = await filaCom(page, C);
  ok("nenhum item novo: a colega já tinha mandado", fila.length === 1 && fila[0].status === "descartada", JSON.stringify(fila));
  recado = (await filme(page)).join(" | ");
  ok("a faixa diz que alguém da equipe já resolveu", /Alguém da equipe já reenviou ou dispensou/.test(recado), recado);
  ok("e a bolha vermelha sai desta tela", (await bolhas(page, C)).length === 0, JSON.stringify(await bolhas(page, C)));

  // AINDA SAINDO: a ponte pegou o item de novo (uma tentativa automática).
  const S = "Prova do eco 4b, ainda saindo";
  ok("mandei mais uma", await enviar(page, S));
  const idS = await marcarErro(page, S);
  ok("e ela falhou", Boolean(idS));
  await page.waitForTimeout(600);
  ok("a ponte a pegou de novo", await page.evaluate((i) => {
    const f = globalThis.__TABELAS.fila_envio.find((x) => x.id === i);
    if (!f) return false;
    f.status = "enviando";
    return true;
  }, idS));
  ok("toquei em reenviar", await clicar(page, `[data-msg-id]:has-text("${S}") [data-reenviar]`));
  await page.waitForTimeout(1500);
  fila = await filaCom(page, S);
  ok("nenhum item novo enquanto ela está saindo", fila.length === 1 && fila[0].status === "enviando", JSON.stringify(fila));
  recado = (await filme(page)).join(" | ");
  ok("a faixa manda esperar", /ainda está saindo/.test(recado), recado);

  // E SE ELA FALHAR DE NOVO, a bolha vermelha volta ao reabrir a conversa: o
  // reenviar que desistiu não pode ter marcado a tentativa como dispensada.
  await page.evaluate((i) => {
    const f = globalThis.__TABELAS.fila_envio.find((x) => x.id === i);
    if (f) { f.status = "erro"; f.erro_motivo = "Falhou de novo."; }
  }, idS);
  ok("abri outra conversa", await clicar(page, `[data-conversa-nome][data-conversa-id="${OUTRA}"]`));
  await page.waitForTimeout(1200);
  ok("e voltei para esta", await abrirAlvo(page));
  const deNovo = await bolhas(page, S);
  ok("a falha de agora aparece vermelha ao reabrir", deNovo.some((b) => b.estado === "erro"), JSON.stringify(deNovo));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. A bolha que veio da fila também sai do vermelho");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const T = "Prova do eco 5, a que saiu depois";
  const antes = await bolhas(page, T);
  ok("a falha da fila aparece vermelha ao abrir", antes.length === 1 && antes[0].id === "fila-9104" && antes[0].estado === "erro",
     JSON.stringify(antes));
  ok("o eco chegou", Boolean(await ecoConfirma(page, T, true)));
  await page.waitForTimeout(1000);
  const depois = await bolhas(page, T);
  ok("sobra UMA bolha, a de verdade", depois.length === 1 && depois[0].id === "eco-msg-9104", JSON.stringify(depois));
  ok("e ela não é vermelha", depois.length > 0 && depois[0].estado !== "erro", JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5b. O documento que não saiu guarda o nome do arquivo");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const texto = await page.evaluate(() => document.querySelector('[data-msg-id="fila-9107"]')?.innerText || "");
  ok("a bolha vermelha do documento aparece", Boolean(texto), "não achei a bolha fila-9107");
  ok("e diz o nome do arquivo, e não só “Documento”", texto.includes("Procuração do eco.pdf"), texto);
  ok("toquei em reenviar", await clicar(page, '[data-msg-id="fila-9107"] [data-reenviar]'));
  await page.waitForTimeout(1500);
  const nova = await page.evaluate((url) => (globalThis.__TABELAS.fila_envio || [])
    .filter((f) => f.midia_url === url && f.status === "pendente"), PROCURACAO);
  ok("o documento voltou para a fila", nova.length === 1, JSON.stringify(nova));
  ok("com o nome de verdade, que o cliente vê no WhatsApp", nova[0]?.midia_nome === "Procuração do eco.pdf",
     JSON.stringify(nova[0]));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. Reação, correção e apagar que falham não viram bolha");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  const fantasmas = await page.evaluate(() => ["fila-9101", "fila-9102", "fila-9103"]
    .filter((id) => document.querySelector(`[data-msg-id="${id}"]`)));
  ok("nenhuma das três falhas virou bolha", fantasmas.length === 0, JSON.stringify(fantasmas));
  ok("nem o 🦩 da reação aparece solto", (await bolhas(page, "🦩")).length === 0, JSON.stringify(await bolhas(page, "🦩")));
  ok("nem o texto da correção que não saiu", (await bolhas(page, "Texto corrigido da prova do eco")).length === 0);
  // O CONTRASTE: a mensagem de texto que falhou continua vermelha ao lado.
  ok("e a mensagem de texto que falhou continua lá", (await bolhas(page, "Prova do eco 5")).length === 1);

  // NA HORA: a reação que falha agora é dita na faixa, e não vira bolha.
  await page.evaluate((c) => {
    const f = { id: 9105, conversa_id: c, tipo: "reacao", texto: "🐙", status: "erro", criado_em: new Date().toISOString(),
      erro_motivo: "O WhatsApp recusou a reação.", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" };
    globalThis.__TABELAS.fila_envio.push(f);
    globalThis.__EMITIR("UPDATE", "fila_envio", { ...f });
  }, ALVO);
  await page.waitForTimeout(1500);
  const recado = (await filme(page)).join(" | ");
  ok("a faixa diz que a reação não chegou ao cliente", /A reação não chegou ao cliente/.test(recado), recado);
  ok("com o motivo", /recusou a reação/.test(recado), recado);
  ok("e a reação que falhou não virou bolha", !(await page.locator('[data-msg-id="fila-9105"]').count())
     && (await bolhas(page, "🐙")).length === 0);
  await page.evaluate((c) => {
    const f = { id: 9106, conversa_id: c, tipo: "edicao", texto: "Outra correção da prova", status: "erro",
      criado_em: new Date().toISOString(), erro_motivo: "", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" };
    globalThis.__TABELAS.fila_envio.push(f);
    globalThis.__EMITIR("UPDATE", "fila_envio", { ...f });
  }, ALVO);
  await page.waitForTimeout(1500);
  const recado2 = (await filme(page)).join(" | ");
  ok("e a correção que falhou também é dita", /A correção da mensagem não chegou ao cliente/.test(recado2), recado2);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. Encaminhar um documento sem legenda");
{
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirAlvo(page));
  await page.locator('[data-msg-id="eco-doc"]').hover().catch(() => {});
  ok("abri o menu do documento", await clicar(page, '[data-msg-id="eco-doc"] button[aria-label="Opções da mensagem"]'));
  ok("Encaminhar", await clicar(page, 'div[data-menu-msg] button:has-text("Encaminhar")'));
  ok("para a outra conversa", await clicar(page, `[data-encaminhar-para="${OUTRA}"]`));
  await page.waitForTimeout(1200);
  const foi = await page.evaluate(([c, url]) => (globalThis.__TABELAS.fila_envio || [])
    .filter((f) => f.conversa_id === c && f.midia_url === url), [OUTRA, DOC]);
  ok("o documento entrou na fila da outra conversa", foi.length === 1, JSON.stringify(foi));
  ok("com o texto vazio, e não nulo (a coluna não aceita nulo)", foi[0]?.texto === "", JSON.stringify(foi[0]));
  const recado = (await filme(page)).join(" | ");
  ok("a faixa diz que foi encaminhada", /Encaminhada para/.test(recado), recado);
  ok("e não diz que falhou", !/Não consegui encaminhar/.test(recado), recado);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. No celular, o reenviar é um botão com alvo de dedo");
{
  const { ctx, page } = await abrir({ largura: 390, altura: 844, celular: true });
  ok("abri a conversa", await abrirAlvo(page));
  const T = "Prova do eco 8, no celular";
  ok("mandei a mensagem", await enviar(page, T));
  ok("a ponte disse que falhou", Boolean(await marcarErro(page, T)));
  await page.waitForTimeout(800);
  const alvo = page.locator(`[data-msg-id]:has-text("${T}") [data-reenviar]`).first();
  const tem = (await alvo.count()) > 0;
  ok("a bolha vermelha tem o reenviar", tem);
  const medida = tem ? await alvo.evaluate((el) => ({
    tag: el.tagName, h: el.getBoundingClientRect().height,
    linha: el.closest("[data-estado-do-envio]")?.getBoundingClientRect().height ?? null,
  })) : null;
  ok("ele é um BOTÃO", medida?.tag === "BUTTON", JSON.stringify(medida));
  ok("com pelo menos 40 pontos de altura", (medida?.h || 0) >= 40, JSON.stringify(medida));
  // A LINHA CRESCE COM ELE: presa em 15 pontos, o botão de 40 vazaria por cima
  // da bolha de baixo.
  ok("e a linha do envio cresce junto, sem o botão vazar", medida?.linha != null && medida.linha >= medida.h - 1,
     JSON.stringify(medida));
  await ctx.close();
}

ok("nada estourou na tela", estouros.length === 0, estouros.slice(0, 3).join(" | "));
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
