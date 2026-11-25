// O "JÁ TRATEI" DO QUAZAR — a faxina da fila aparece com o nome dele
//
// Pedido do Rodrigo em 25/11: zerar o SAC, com o Quazar finalizando o que
// acabou ("e o registro dizendo que foi ele"). Quem finaliza é a ponte
// (script 064, a faxina do Quazar): ela grava o "Já tratei" SEM PESSOA
// (`quem` nulo), e o gatilho do 028 fecha o atendimento sem `finalizado_por`.
// Medido no banco em 25/11: nenhum "Já tratei" sem pessoa até ali — o painel
// sempre grava quem clicou. Daqui para a frente, sem pessoa é o Quazar.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. no histórico do cliente, o registro sem pessoa diz "O Quazar
//      finalizou", com o rosto dele — e nunca "alguém da equipe marcou";
//   2. o registro de gente continua dizendo quem marcou;
//   3. no relatório do "Já tratei", a linha sem pessoa é "Quazar", com o rosto,
//      e não "(sem nome)"; ela não é clicável (não há pessoa para recortar);
//   4. a planilha diz "Quazar" no "Quem" do registro sem pessoa;
//   5. na tabela por pessoa dos protocolos, os finalizados sem pessoa são
//      "Quazar e sem registro" (entram ali os 11 arquivados de 06/11, que o
//      banco fechou sem ninguém), e não uma linha sem nome;
//   6. e a tabela da equipe NÃO ganha o Quazar: ela compara pessoas, e o que
//      ele fez não entra na mediana de ninguém.
import { abrirNavegador, ENDERECO, abrirATela } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira: duas chamadas a `Date.now()` caem em
// milissegundos diferentes, e "o mesmo instante" viraria dois cliques.
const AGORA = Date.now();
const horasAtras = (h) => new Date(AGORA - h * 3600e3).toISOString();
const diasAtras = (d) => horasAtras(d * 24);

/** Os dois telefones: o que o painel abre, e outro qualquer. */
async function telefones() {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const T = globalThis.__TABELAS;
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    const a = (T.advogados || []).find((x) => c && String(x.id) === String(c.advogado_id));
    return c && a ? { adv: c.advogado_id, advNome: a.nome, advNumero: a.numero } : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefones();
ok("aprendi o telefone", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const QUITERIA = "QUITÉRIA DA FAXINA";
const QUINCAS = "QUINCAS SÓ AGRADECEU";
const conversa = (id, contatoId, nome, numero, extra = {}) => ({
  id, advogado_id: TEL.adv, contato_id: contatoId, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date(AGORA - 2 * 60e3).toISOString(), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "obrigada!", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: contatoId, nome, numero, foto_url: null }, ...extra,
});
const P1 = "2026-000901", P2 = "2026-000902", P3 = "2026-000903";
const SEMENTE = {
  contatos: [
    { id: "ct-qz", numero: "5511970008801", nome: QUITERIA },
    { id: "ct-qn", numero: "5511970008802", nome: QUINCAS },
  ],
  conversas: [
    // "Em aberto" de propósito: a lista abre nessa aba, e o histórico só abre
    // de uma conversa clicada. O que se mede é o registro, e não a aba.
    conversa("cv-qz", "ct-qz", QUITERIA, "5511970008801", { situacao: "aberto", protocolo: P1 }),
    conversa("cv-qn", "ct-qn", QUINCAS, "5511970008802", { situacao: "finalizado", protocolo: P2, tratada_em: diasAtras(2) }),
  ],
  mensagens: [
    { id: "m-qz1", conversa_id: "cv-qz", origem: "contato", tipo: "texto", texto: "obrigada!", criado_em: horasAtras(0.05) },
    { id: "m-qn1", conversa_id: "cv-qn", origem: "contato", tipo: "texto", texto: "valeu", criado_em: diasAtras(2.1) },
  ],
  zorvin_tratamentos: [
    // O QUAZAR (sem pessoa), com o porquê que a faxina escreve.
    { id: "tq-1", conversa_id: "cv-qz", assunto_id: "as-outros", quem: null, quando: diasAtras(1),
      observacao: "Finalizada pelo Quazar: o cliente só agradeceu." },
    // GENTE, na mesma cliente: o contraste.
    { id: "tq-2", conversa_id: "cv-qz", assunto_id: "as-1", quem: "u1", quando: diasAtras(4) },
    // O QUAZAR de novo, noutra conversa: no relatório, dois cliques dele.
    { id: "tq-3", conversa_id: "cv-qn", assunto_id: "as-6", quem: null, quando: diasAtras(2),
      observacao: "Finalizada pelo Quazar: a equipe falou por último há mais de 7 dias." },
  ],
  zorvin_atendimentos: [
    // FINALIZADO SEM PESSOA, como a faxina fecha.
    { id: "at-q1", protocolo: P2, conversa_id: "cv-qn", aberto_em: diasAtras(3), origem: "cliente", aberto_por: null,
      primeira_resposta_em: diasAtras(2.9), finalizado_em: diasAtras(2), finalizado_por: null },
    // E UM DE GENTE, no mesmo período.
    { id: "at-q2", protocolo: P3, conversa_id: "cv-qz", aberto_em: diasAtras(5), origem: "cliente", aberto_por: null,
      primeira_resposta_em: diasAtras(4.9), finalizado_em: diasAtras(4), finalizado_por: "u1" },
  ],
};

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. A ponte de
 *  mentira diz quais conversas o cliente tem (o histórico pergunta a ela). */
async function abrirPainel({ semSituacao = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = true;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEM_SITUACAO = d.semSituacao;
    globalThis.__SEM_CONTABILIZACAO = false;
    globalThis.__CONTABILIZACAO_FALHA = false;
    globalThis.__SEM_RELATORIO = false;
    globalThis.__RELATORIO_FALHA = false;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__SEM_DESCRICAO = false;
    globalThis.__RECUSAR_LEITURA = [];
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: SEMENTE, semSituacao });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const m = url.pathname.match(/\/historico\/contato\/([^/]+)(\/quantas)?$/);
    if (m) {
      const convs = SEMENTE.conversas.filter((c) => c.contato_id === decodeURIComponent(m[1]));
      if (m[2]) {
        return rota.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, conversas: convs.length, telefones: 1 }) });
      }
      const linhas = convs.map((c) => ({ conversa_id: c.id, advogado_id: c.advogado_id,
        advogado_nome: TEL.advNome, advogado_numero: TEL.advNumero, primeira: null, ultima: null }));
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, linhas }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

// ==================================================================
console.log("\nNo histórico da cliente, o registro sem pessoa é do Quazar");
{
  const { ctx, page, estouros } = await abrirPainel({ semSituacao: true });
  const linha = page.locator(`[data-conversa-nome="${QUITERIA}"]`);
  let abriu = false;
  if (await linha.count()) {
    await linha.first().click();
    await page.waitForTimeout(900);
    const botao = page.locator('button[title^="Histórico de atendimento"]');
    if (await botao.count()) { await botao.first().click(); await page.waitForTimeout(1500); abriu = true; }
  }
  ok("o histórico abre", abriu);
  const S = "[data-historico-ja-tratei]";
  const regs = await page.$$eval(`${S} [data-registro-no-historico]`, (ns) => ns.map((n) => ({
    texto: n.innerText.replace(/\s+/g, " ").trim(),
    quazar: n.hasAttribute("data-registro-do-quazar"),
    rosto: Boolean(n.querySelector("svg[data-rosto-do-assistente]")),
    rostoNome: n.querySelector("svg[data-rosto-do-assistente]")?.getAttribute("aria-label") || "",
  }))).catch(() => []);
  ok("dois registros", regs.length === 2, `vieram ${regs.length}`);
  const [q, gente] = regs;
  ok("o mais recente é o do Quazar, marcado", q && q.quazar, q?.texto);
  ok("e diz “O Quazar finalizou”", q && /O Quazar finalizou/.test(q.texto), q?.texto);
  ok("e NÃO diz “alguém da equipe”", q && !/alguém da equipe/i.test(q.texto), q?.texto);
  ok("e NÃO diz “marcou”", q && !/marcou/i.test(q.texto), q?.texto);
  ok("com o rosto do Quazar no lugar da foto", q && q.rosto, q?.texto);
  ok("e o rosto se chama Quazar para quem não vê", q && q.rostoNome === "Quazar", q?.rostoNome);
  ok("o porquê da faxina aparece", q && /o cliente só agradeceu/.test(q.texto), q?.texto);
  ok("o registro de gente continua dizendo quem marcou",
     gente && !gente.quazar && /Rodrigo Sousa marcou “Já tratei”/.test(gente.texto), gente?.texto);
  ok("e sem o rosto do Quazar", gente && !gente.rosto);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
// O PAINEL ABRE NUMA GUIA PRÓPRIA desde 02/11 (`?tela=painel`): a prova abre
// o endereço dela na própria página.
const R = "[data-relatorio-ja-tratei]";
function lerCsv(csv) {
  const linhas = csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  const campos = (l) => [...l.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
  const cab = linhas.length ? campos(linhas[0]) : [];
  return linhas.slice(1).map((l) => { const c = campos(l); return Object.fromEntries(cab.map((k, i) => [k, c[i] ?? ""])); });
}

console.log("\nNo relatório do “Já tratei”, a linha sem pessoa é o Quazar");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirATela(page, "painel", { prazo: 10000 });
  await page.waitForTimeout(2000);
  const linhaQ = page.locator(`${R} [data-quazar-no-relatorio]`);
  ok("a linha do Quazar aparece, uma só", (await linhaQ.count()) === 1, `vieram ${await linhaQ.count()}`);
  ok("com o nome Quazar", (await linhaQ.first().getAttribute("data-pessoa-no-relatorio").catch(() => null)) === "Quazar");
  ok("com os dois cliques dele",
     (await linhaQ.first().locator("[data-tratamentos]").getAttribute("data-tratamentos").catch(() => null)) === "2");
  ok("com o rosto dele", (await linhaQ.first().locator("svg[data-rosto-do-assistente]").count()) === 1);
  ok("e nenhuma linha “(sem nome)”",
     (await page.locator(`${R} [data-pessoa-no-relatorio="(sem nome)"]`).count()) === 0);
  const cursores = await page.evaluate((r) => {
    const q = document.querySelector(`${r} [data-quazar-no-relatorio]`);
    const g = document.querySelector(`${r} [data-pessoa-no-relatorio="Rodrigo Sousa"]`);
    return { q: q && getComputedStyle(q).cursor, g: g && getComputedStyle(g).cursor };
  }, R);
  ok("a linha do Quazar não é clicável (não há pessoa para recortar)", cursores.q === "default", JSON.stringify(cursores));
  ok("e a de gente continua sendo", cursores.g === "pointer", JSON.stringify(cursores));

  const b = page.locator(`${R} [data-relatorio-baixar]`);
  let regs = [];
  if (await b.count()) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), b.first().click().catch(() => {})]);
    if (dl) { const fs = await import("node:fs"); regs = lerCsv(fs.readFileSync(await dl.path(), "utf8")); }
  }
  const doQuazar = regs.filter((x) => x["Quem"] === "Quazar");
  ok("a planilha diz “Quazar” nos dois registros sem pessoa", doQuazar.length === 2,
     regs.map((x) => `${x["Quem"]}/${x["Cliente"]}`).join(" | "));
  ok("e o porquê da faxina vai junto", doQuazar.some((x) => /o cliente só agradeceu/.test(x["O que foi tratado"] || "")));
  ok("e o de gente continua com o nome", regs.some((x) => x["Quem"] === "Rodrigo Sousa"));

  // OS PROTOCOLOS: os finalizados sem pessoa.
  const P = "[data-relatorio-protocolos]";
  const linhaP = page.locator(`${P} [data-pessoa-nos-protocolos="Quazar e sem registro"]`);
  ok("nos protocolos, a linha “Quazar e sem registro” aparece", (await linhaP.count()) === 1,
     (await page.$$eval(`${P} [data-pessoa-nos-protocolos]`, (ns) => ns.map((n) => n.getAttribute("data-pessoa-nos-protocolos"))).catch(() => [])).join(" | "));
  ok("com o finalizado dele",
     (await linhaP.first().locator("[data-finalizou]").getAttribute("data-finalizou").catch(() => null)) === "1");
  ok("e diz o porquê no title",
     /faxina/.test((await linhaP.first().getAttribute("title").catch(() => "")) || ""));
  ok("e nenhuma linha sem nome nos protocolos",
     (await page.$$eval(`${P} [data-pessoa-nos-protocolos]`, (ns) => ns.filter((n) => !(n.getAttribute("data-pessoa-nos-protocolos") || "").trim()).length).catch(() => 1)) === 0);

  // A EQUIPE compara pessoas: o Quazar não entra.
  const equipe = await page.locator("[data-tabela-da-equipe]").first().innerText().catch(() => "");
  ok("a tabela da equipe aparece", equipe.length > 0);
  ok("e não tem o Quazar", !/Quazar/.test(equipe), equipe.slice(0, 300));
  ok("nem uma linha “(sem nome)”", !/\(sem nome\)/.test(equipe));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
