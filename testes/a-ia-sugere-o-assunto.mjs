// A IA SUGERE O ASSUNTO NO FINALIZAR (01/11) — a metade do painel.
//
// Recomendação nº 5 de 31/10: "A IA sugere o assunto no Finalizar. A lista já
// abre com o assunto provável marcado, e a pessoa só confere." Quem fala com a
// IA é a PONTE (`POST /copiloto/assunto`, seção 88 do repo dela). O que esta
// prova guarda é o que é da tela:
//
//   1. a janela só pede quando a ponte sabe sugerir (`assunto: true`); a
//      ponte de antes e o copiloto desligado não pedem; na dúvida, pede;
//   2. a sugestão MARCA SOZINHA quando a pessoa ainda não mexeu, e diz que
//      marcou; nada é gravado sem o clique; o clique grava o que a IA sugeriu
//      junto (`sugestao_ia`, script 042), com `marcou: true`;
//   3. quem já mexeu na lista recebe a sugestão como DICA, com o botão
//      "Marcar a sugestão" — nada do que ela marcou é tirado, e `marcou` vai
//      como `false`;
//   4. desmarcar o que a IA marcou grava o assunto da pessoa, e a sugestão
//      junto (é assim que o erro da IA se mede);
//   5. "não sei" (a lista vazia) é dito, e também vai ao banco;
//   6. o id que não está entre os ativos desta janela não é marcado;
//   7. a falha é DITA, a janela funciona sem a IA, e o que falhou é pedido de
//      novo na próxima abertura;
//   8. fechar e abrir de novo não paga outra ida à IA;
//   9. na faxina, a finalização de uma conversa pede e grava; o lote não pede;
//  10. num banco sem o 042, o clique é gravado sem a coluna, e finaliza;
//  11. sem o 028 (o "Já tratei" de antes), a mesma sugestão;
//  12. no celular, a caixa cabe na janela;
//  13. duas conversas na mesma sessão: cada uma com a sua sugestão — a de A
//      não marca nada em B;
//  14. uma mensagem nova na conversa pede de novo (a guardada falaria de uma
//      conversa que já não é aquela);
//  15. a lista de assuntos que não carregou não pede à IA.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const DIA = 24 * 3600e3;
const antes = (min) => new Date(Date.now() - min * 60000).toISOString();
const haDias = (d) => new Date(Date.now() - d * DIA).toISOString();

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
/** Um atributo — GUARDADO: `getAttribute` num elemento que não existe espera
 *  30 segundos antes de desistir, e "não há caixa" é a resposta certa de
 *  metade das cenas (a lição da prova da prévia do PDF, de 29/10). */
const attr = async (loc, nome) => ((await loc.count()) ? loc.first().getAttribute(nome).catch(() => null) : null);
const normal = (s) => String(s || "").replace(/\s+/g, " ").trim();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 90000 });
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

// AS CONVERSAS PLANTADAS: seis no telefone que abre (uma por cena que
// finaliza, para uma cena não herdar a conversa finalizada da outra), e três
// PARADAS no a8, para a faxina (lá não há outra parada na bancada): uma para
// finalizar sozinha, e duas para o lote.
const contato = (id, numero, nome) =>
  ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const N = 8;
const CONTATOS = Array.from({ length: N }, (_, i) => contato(`ct-sug-${i + 1}`, `55119482304${String(i + 10)}`, `Cliente Sugestão ${i + 1}`));
// CADA UMA COM O SEU PROTOCOLO ABERTO, como no escritório: no 028 toda
// conversa em "Em Atendimento" tem um. Sem ele, a primeira mensagem do cliente
// que a cena 14 manda ABRIRIA um protocolo novo, e o protocolo novo pediria
// de novo sozinho — a cena passava sem medir a última atividade da chave (foi
// a sabotagem que mostrou).
const protocoloDe = (n) => `2026-0009${String(n).padStart(2, "0")}`;
const conversa = (n) => ({
  id: `cv-sug-${n}`, advogado_id: ADV, contato_id: `ct-sug-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: antes(30 + n), tratada_em: null,
  ultima_mensagem: "Queria saber do acordo", frente: null, digitando_ate: null,
  vantoro_nome: null, situacao: "aberto", protocolo: protocoloDe(n),
  responsavel_id: null, responsavel_em: null, responsavel_por: null,
  contato: CONTATOS[n - 1],
});
const CT_FX = [contato("ct-sug-fx1", "5511948230391", "Parada Um"), contato("ct-sug-fx2", "5511948230392", "Parada Dois"),
               contato("ct-sug-fx3", "5511948230393", "Parada Três")];
const parada = (id, i) => ({
  id, advogado_id: "a8", contato_id: CT_FX[i].id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: haDias(40 + i), ultima_mensagem: "Obrigado", frente: null, vantoro_nome: null, digitando_ate: null,
  responsavel_id: null, responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null,
  esperando_desde: null, tratada_em: null, contato: CT_FX[i],
});
const SEMENTE = {
  zorvin_atendimentos: Array.from({ length: N }, (_, i) => ({
    id: `at-sug-${i + 1}`, protocolo: protocoloDe(i + 1), conversa_id: `cv-sug-${i + 1}`,
    aberto_em: antes(40 + i), origem: "cliente", aberto_por: null,
    primeira_resposta_em: antes(35 + i), finalizado_em: null, finalizado_por: null })),
  contatos: [...CONTATOS, ...CT_FX],
  conversas: [...Array.from({ length: N }, (_, i) => conversa(i + 1)),
              parada("cv-sug-fx1", 0), parada("cv-sug-fx2", 1), parada("cv-sug-fx3", 2)],
  mensagens: [
    ...Array.from({ length: N }, (_, i) => [
      { id: `m-sug-${i}-a`, conversa_id: `cv-sug-${i + 1}`, origem: "contato", tipo: "texto",
        texto: "Bom dia, queria saber do acordo", criado_em: antes(40 + i) },
      { id: `m-sug-${i}-b`, conversa_id: `cv-sug-${i + 1}`, origem: "advogado", tipo: "texto",
        texto: "Bom dia! Já conferimos.", criado_em: antes(35 + i), enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
    ]).flat(),
    { id: "m-sug-fx1", conversa_id: "cv-sug-fx1", origem: "contato", tipo: "texto", texto: "Obrigado", criado_em: haDias(40) },
    { id: "m-sug-fx2", conversa_id: "cv-sug-fx2", origem: "contato", tipo: "texto", texto: "Obrigado", criado_em: haDias(41) },
    { id: "m-sug-fx3", conversa_id: "cv-sug-fx3", origem: "contato", tipo: "texto", texto: "Obrigado", criado_em: haDias(42) },
  ],
};

// A PONTE DE MENTIRA. `ponte` é trocada por cena; `pedidos` guarda cada
// pedido de sugestão.
const SUGESTAO = (ids, motivo = "O cliente perguntou do acordo, e a equipe respondeu.") =>
  ({ status: 200, demora: 0, corpo: { ok: true, assuntos: ids, motivo, mensagens: 2, notas: 0, atendimento: true } });
const ACORDOS = { id: "as-6", nome: "ACORDOS" };
const BLINDAGEM = { id: "as-1", nome: "BLINDAGEM" };
const ponte = {
  estado: { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, assunto: true } },
  assunto: () => SUGESTAO([ACORDOS]),
};
let pedidos = [];

async function abrirPagina({ largura = 1400, altura = 900, semColunas = {}, semSituacao = false, quebrar = [] } = {}) {
  pedidos = [];
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__SEM_COLUNAS = b.semColunas;
    globalThis.__SEM_SITUACAO = b.semSituacao;
    globalThis.__QUEBRAR = b.quebrar;
    globalThis.__AVISOS_DA_FAIXA = [];
  }, { semente: SEMENTE, semColunas, semSituacao, quebrar });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (url.pathname.endsWith("/copiloto/assunto")) {
      const corpo = JSON.parse(rota.request().postData() || "{}");
      pedidos.push({ corpo, autorizacao: rota.request().headers()["authorization"] || "" });
      const r = ponte.assunto(corpo.conversa_id);
      if (r.demora) await new Promise((ok_) => setTimeout(ok_, r.demora));
      return json(r.status, r.corpo);
    }
    // SEM VANTORO: a ficha fixa estreitaria a conversa sem nada a ver com isto.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 90000 });
  await page.waitForTimeout(1300);
  // UM TETO CURTO PARA O RESTO: o que esquecer a guarda espera 8 segundos, e
  // não 30 — numa sabotagem que tira a caixa, 30 por pergunta deixavam a
  // prova perto de dez minutos.
  page.setDefaultTimeout(8000);
  return { ctx, page, estouros };
}
async function abrirConversa(page, id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(700);
  return true;
}
/** Abre a janela do Finalizar pelo botão da conversa aberta. */
async function abrirJanela(page) {
  const tem = await clicar(page.locator('[data-ja-tratei="tratar"]'));
  if (tem) await page.waitForTimeout(150);
  return tem && (await page.locator("[data-ja-tratei-janela]").count()) > 0;
}
const fecharJanela = (page) => clicar(page.locator("[data-ja-tratei-janela] button", { hasText: "Cancelar" }));
const caixa = (page) => attr(page.locator("[data-sugestao-do-assunto]"), "data-sugestao-do-assunto");
const temCaixa = async (page) => (await page.locator("[data-sugestao-do-assunto]").count()) > 0;
/** Espera a caixa chegar a um estado, com teto — e diz em qual parou. */
async function esperarCaixa(page, estado, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (await temCaixa(page) && (await caixa(page)) === estado) return true;
    await page.waitForTimeout(80);
  }
  return false;
}
/** Os assuntos marcados na janela, na ordem da lista. */
const marcados = (page) => page.locator("[data-assunto-do-ja-tratei]").evaluateAll((els) =>
  els.filter((e) => e.querySelector('input[type="checkbox"]')?.checked).map((e) => e.getAttribute("data-assunto-do-ja-tratei")));
/** Os assuntos com o selo "sugerido pela IA". */
const comSelo = (page) => page.locator("[data-assunto-do-ja-tratei]").evaluateAll((els) =>
  els.filter((e) => e.querySelector("[data-sugerido-pela-ia]")).map((e) => e.getAttribute("data-assunto-do-ja-tratei")));
async function alternar(page, nome) {
  const l = page.locator(`[data-assunto-do-ja-tratei="${nome}"] input[type="checkbox"]`);
  if (!(await l.count())) return false;
  await l.first().click();
  return true;
}
const desligado = async (page) => ((await page.locator("[data-ja-tratei-confirmar]").count())
  ? page.locator("[data-ja-tratei-confirmar]").first().isDisabled() : null);
async function confirmar(page) {
  const fez = await clicar(page.locator("[data-ja-tratei-confirmar]"));
  if (fez) await page.waitForTimeout(1500);
  return fez;
}
const tratamentosDe = (page, id) => page.evaluate((cid) =>
  (globalThis.__TABELAS.zorvin_tratamentos || []).filter((t) => String(t.conversa_id) === String(cid))
    .map((t) => ({ assunto_id: t.assunto_id, sugestao_ia: t.sugestao_ia === undefined ? "AUSENTE" : t.sugestao_ia })), id);
const situacaoDe = (page, id) => page.evaluate((cid) =>
  ((globalThis.__TABELAS.conversas || []).find((c) => String(c.id) === String(cid)) || {}).situacao ?? null, id);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ==================================================================
console.log("\n1. A janela só pede quando a ponte sabe sugerir");
for (const [nome, estado, deve] of [
  ["a ponte de antes (responde sem `assunto: true`): não pede, e a janela é a de sempre",
   { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true } }, false],
  ["o copiloto desligado (sem a chave): não pede",
   { status: 200, corpo: { ok: true, ligado: false, modelo: "claude-haiku-5-5", resumo: true, assunto: true } }, false],
  ["a pergunta do estado falhou: na dúvida, PEDE (a régua de temVantoro.js)", { status: 500, corpo: {} }, true],
]) {
  ponte.estado = estado;
  ponte.assunto = () => SUGESTAO([ACORDOS]);
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-1");
  const abriu = await abrirJanela(page);
  await page.waitForTimeout(900);
  const tem = await temCaixa(page);
  ok(nome, abriu && tem === deve && (pedidos.length > 0) === deve, q({ abriu, tem, pedidos: pedidos.length }));
  if (!deve) ok("  e nada vem marcado", igual(await marcados(page), []), q(await marcados(page)));
  ok("  sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}
ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, assunto: true } };

// ==================================================================
console.log("\n2. Ninguém mexeu: a sugestão marca sozinha, e o clique grava junto");
{
  ponte.assunto = () => ({ ...SUGESTAO([ACORDOS]), demora: 1500 });
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-2");
  ok("abri a janela do Finalizar", await abrirJanela(page));
  ok("enquanto a IA lê, a caixa diz que está lendo", (await caixa(page)) === "pedindo"
     && /A IA está lendo a conversa para sugerir o assunto/.test(normal(await texto(page.locator("[data-sugestao-do-assunto]")))),
     q({ caixa: await caixa(page), texto: normal(await texto(page.locator("[data-sugestao-do-assunto]"))) }));
  ok("e o botão continua desligado (nada marcado ainda)", (await desligado(page)) === true);
  ok("a sugestão chega e diz que marcou", await esperarCaixa(page, "marcou"), q(await caixa(page)));
  ok("ACORDOS veio marcado, e só ele", igual(await marcados(page), ["ACORDOS"]), q(await marcados(page)));
  ok("com o selo da IA no item", igual(await comSelo(page), ["ACORDOS"]), q(await comSelo(page)));
  const frase = normal(await texto(page.locator("[data-sugestao-do-assunto]")));
  ok("a caixa diz o nome, que já veio marcado e que é para conferir",
     /Sugestão da IA: ACORDOS\./.test(frase) && /Já veio marcado — confira antes de finalizar/.test(frase), frase);
  ok("e o porquê da IA", /perguntou do acordo/.test(await texto(page.locator("[data-sugestao-motivo]"))));
  ok("o pedido foi DESTA conversa", pedidos.length === 1 && pedidos[0].corpo.conversa_id === "cv-sug-2", q(pedidos.map((p) => p.corpo)));
  ok("com a sessão de quem pediu", /^Bearer .+/.test(pedidos[0]?.autorizacao || ""), pedidos[0]?.autorizacao);
  ok("NADA foi gravado sem o clique", (await tratamentosDe(page, "cv-sug-2")).length === 0, q(await tratamentosDe(page, "cv-sug-2")));
  ok("o botão liga com o que veio marcado", (await desligado(page)) === false);
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-2");
  ok("o clique grava ACORDOS com o que a IA sugeriu, e que a janela marcou sozinha",
     t.length === 1 && t[0].assunto_id === "as-6" && igual(t[0].sugestao_ia, { assuntos: ["as-6"], marcou: true }), q(t));
  ok("e a conversa foi finalizada", (await situacaoDe(page, "cv-sug-2")) === "finalizado", q(await situacaoDe(page, "cv-sug-2")));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Quem já mexeu recebe a sugestão como dica, e nada do que marcou sai");
{
  ponte.assunto = () => ({ ...SUGESTAO([ACORDOS]), demora: 2500 });
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-3");
  await abrirJanela(page);
  ok("marquei BLINDAGEM antes de a sugestão chegar", await alternar(page, "BLINDAGEM"));
  ok("a sugestão chega como DICA", await esperarCaixa(page, "dica"), q(await caixa(page)));
  ok("o que marquei continua, e ACORDOS NÃO foi marcado sozinho", igual(await marcados(page), ["BLINDAGEM"]), q(await marcados(page)));
  ok("o selo da IA aparece em ACORDOS", igual(await comSelo(page), ["ACORDOS"]), q(await comSelo(page)));
  ok("a caixa não diz que marcou", !/Já veio marcado/.test(await texto(page.locator("[data-sugestao-do-assunto]"))));
  ok("e oferece marcar a sugestão", (await page.locator("[data-usar-sugestao]").count()) === 1);
  await clicar(page.locator("[data-usar-sugestao]"));
  await page.waitForTimeout(150);
  ok("“Marcar a sugestão” SOMA, sem tirar o que eu tinha marcado", igual(await marcados(page), ["BLINDAGEM", "ACORDOS"]), q(await marcados(page)));
  ok("e o botão some: não há mais o que marcar", (await page.locator("[data-usar-sugestao]").count()) === 0);
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-3");
  ok("as duas linhas do clique levam a sugestão, com `marcou: false`",
     t.length === 2 && t.every((x) => igual(x.sugestao_ia, { assuntos: ["as-6"], marcou: false })), q(t));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  ponte.assunto = () => ({ ...SUGESTAO([ACORDOS]), demora: 2500 });
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, "cv-sug-3");
  await abrirJanela(page);
  await alternar(page, "BLINDAGEM");
  await alternar(page, "BLINDAGEM");
  await esperarCaixa(page, "dica");
  ok("marcar e desmarcar também é mexer: a sugestão chega como dica, e nada vem marcado",
     (await caixa(page)) === "dica" && igual(await marcados(page), []), q({ caixa: await caixa(page), marcados: await marcados(page) }));
  ok("e o botão continua desligado", (await desligado(page)) === true);
  await ctx.close();
}

// ==================================================================
console.log("\n4. Desmarcar o que a IA marcou grava o assunto da pessoa, e a sugestão junto");
{
  ponte.assunto = () => SUGESTAO([ACORDOS]);
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, "cv-sug-4");
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  await alternar(page, "ACORDOS");
  await alternar(page, "BLINDAGEM");
  await page.waitForTimeout(150);
  ok("troquei ACORDOS por BLINDAGEM", igual(await marcados(page), ["BLINDAGEM"]), q(await marcados(page)));
  const frase = normal(await texto(page.locator("[data-sugestao-do-assunto]")));
  ok("a caixa para de dizer “já veio marcado”, e diz qual foi a sugestão", !/Já veio marcado/.test(frase) && /ACORDOS/.test(frase), frase);
  ok("e oferece marcar de novo", (await page.locator("[data-usar-sugestao]").count()) === 1);
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-4");
  ok("grava BLINDAGEM, com a sugestão de ACORDOS e `marcou: true` (a IA errou, e isso se mede)",
     t.length === 1 && t[0].assunto_id === "as-1" && igual(t[0].sugestao_ia, { assuntos: ["as-6"], marcou: true }), q(t));
  await ctx.close();
}

// ==================================================================
console.log("\n5. “Não sei” é dito, e também vai ao banco");
{
  ponte.assunto = () => SUGESTAO([], "Só há um cumprimento.");
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, "cv-sug-5");
  await abrirJanela(page);
  ok("a caixa diz que a IA não arriscou", await esperarCaixa(page, "nenhum")
     && /não arriscou um assunto/.test(await texto(page.locator("[data-sugestao-do-assunto]"))), q(await caixa(page)));
  ok("com o porquê dela", /Só há um cumprimento/.test(await texto(page.locator("[data-sugestao-motivo]"))));
  ok("nada vem marcado, e o botão fica desligado", igual(await marcados(page), []) && (await desligado(page)) === true);
  ok("e não há o que marcar pela IA", (await page.locator("[data-usar-sugestao]").count()) === 0);
  await alternar(page, "VENDA LN");
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-5");
  ok("o clique grava a lista vazia da IA", t.length === 1 && igual(t[0].sugestao_ia, { assuntos: [], marcou: false }), q(t));
  await ctx.close();
}

// ==================================================================
console.log("\n6. O id que não está entre os ativos desta janela não é marcado");
{
  ponte.assunto = () => SUGESTAO([{ id: "as-9", nome: "MUTIRÃO 2024" }, { id: "as-zz", nome: "INVENTADO" }]);
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, "cv-sug-6");
  await abrirJanela(page);
  ok("o desativado e o inventado: nada é marcado, e a caixa diz que não arriscou",
     await esperarCaixa(page, "nenhum") && igual(await marcados(page), []), q({ caixa: await caixa(page), marcados: await marcados(page) }));
  await ctx.close();
}
{
  ponte.assunto = () => SUGESTAO([{ id: "as-9", nome: "MUTIRÃO 2024" }, BLINDAGEM]);
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, "cv-sug-6");
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  ok("com um ativo entre eles, só ele é marcado", igual(await marcados(page), ["BLINDAGEM"]), q(await marcados(page)));
  ok("o selo e o nome da caixa são só dele",
     igual(await comSelo(page), ["BLINDAGEM"]) && normal(await texto(page.locator("[data-sugestao-nomes]"))) === "BLINDAGEM",
     q({ selo: await comSelo(page), nomes: await texto(page.locator("[data-sugestao-nomes]")) }));
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-6");
  ok("e o banco guarda o que a IA disse, como ela disse", t.length === 1
     && igual(t[0].sugestao_ia, { assuntos: ["as-9", "as-1"], marcou: true }), q(t));
  await ctx.close();
}

// ==================================================================
console.log("\n7. A falha é dita, a janela funciona sem a IA, e a próxima abertura pede de novo");
{
  // A FRASE DA PONTE, como ela é (seção 88 dela): já diz para marcar à mão.
  ponte.assunto = () => ({ status: 502, demora: 0, corpo: { ok: false, erro: "A IA preferiu não sugerir o assunto desta conversa. Marque à mão." } });
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-7");
  await abrirJanela(page);
  const fraseDoErro = (await esperarCaixa(page, "erro")) ? normal(await texto(page.locator("[data-sugestao-do-assunto]"))) : "";
  ok("a caixa diz que não veio, com a frase da ponte",
     /^Sem a sugestão da IA desta vez: A IA preferiu não sugerir o assunto desta conversa\. Marque à mão\.$/.test(fraseDoErro), fraseDoErro);
  ok("sem repetir o que a frase da ponte já diz", (fraseDoErro.match(/à mão/g) || []).length === 1, fraseDoErro);
  ok("e não é a faixa de erro do Finalizar: a janela funciona", (await page.locator("[data-ja-tratei-erro]").count()) === 0);
  ok("nada vem marcado", igual(await marcados(page), []));
  await fecharJanela(page);
  await page.waitForTimeout(200);
  await abrirJanela(page);
  await esperarCaixa(page, "erro");
  ok("o que falhou NÃO fica guardado: a segunda abertura pede de novo", pedidos.length === 2, String(pedidos.length));
  await alternar(page, "ACORDOS");
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-7");
  ok("finaliza à mão, sem sugestão nenhuma no registro", t.length === 1 && t[0].sugestao_ia === "AUSENTE", q(t));
  ok("e a conversa foi finalizada", (await situacaoDe(page, "cv-sug-7")) === "finalizado");
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n8. Fechar e abrir de novo não paga outra ida à IA");
{
  ponte.assunto = () => ({ ...SUGESTAO([ACORDOS]), demora: 1200 });
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-8");
  await abrirJanela(page);
  await fecharJanela(page);
  await page.waitForTimeout(200);
  ok("fechei antes de a sugestão chegar", (await page.locator("[data-ja-tratei-janela]").count()) === 0);
  await abrirJanela(page);
  ok("na janela aberta de novo, a mesma resposta marca sozinha", await esperarCaixa(page, "marcou")
     && igual(await marcados(page), ["ACORDOS"]), q({ caixa: await caixa(page), marcados: await marcados(page) }));
  ok("e foi UMA ida à IA", pedidos.length === 1, String(pedidos.length));
  await fecharJanela(page);
  await page.waitForTimeout(200);
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  ok("a terceira abertura também usa a guardada", pedidos.length === 1 && igual(await marcados(page), ["ACORDOS"]), String(pedidos.length));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n9. Na faxina: uma conversa pede e grava; o lote não pede");
{
  ponte.assunto = () => SUGESTAO([ACORDOS]);
  const { ctx, page, estouros } = await abrirPagina({ largura: 1360 });
  await clicar(page.locator('button[aria-label="Menu"]'));
  await page.waitForTimeout(250);
  ok("a faxina abriu", await clicar(page.locator("[data-abrir-faxina]")));
  await page.waitForTimeout(1200);
  const tem = await page.locator('[data-faxina-telefone] option[value="a8"]').count();
  if (tem) await page.locator("[data-faxina-telefone]").first().selectOption("a8");
  await page.waitForTimeout(1500);
  // AS TRÊS PARADAS não esperam resposta (`esperando_desde` nulo): moram no
  // grupo "a equipe falou por último".
  await clicar(page.locator('[data-faxina-grupo="equipe"]'));
  await page.waitForTimeout(1200);
  ok("as três paradas aparecem", (await page.locator('[data-faxina-linha="cv-sug-fx1"]').count()) === 1
     && (await page.locator('[data-faxina-linha="cv-sug-fx2"]').count()) === 1
     && (await page.locator('[data-faxina-linha="cv-sug-fx3"]').count()) === 1);
  await clicar(page.locator('[data-faxina-finalizar="cv-sug-fx1"]'));
  await page.waitForTimeout(200);
  ok("a finalização de uma conversa pede a sugestão, e ela marca sozinha", await esperarCaixa(page, "marcou")
     && igual(await marcados(page), ["ACORDOS"]), q({ caixa: await caixa(page), marcados: await marcados(page) }));
  ok("o pedido foi da conversa da linha", pedidos.length === 1 && pedidos[0].corpo.conversa_id === "cv-sug-fx1", q(pedidos.map((p) => p.corpo)));
  await clicar(page.locator("[data-ja-tratei-confirmar]"));
  await page.waitForTimeout(1800);
  const t = await tratamentosDe(page, "cv-sug-fx1");
  ok("e a faxina grava a sugestão junto do clique", t.length === 1 && igual(t[0].sugestao_ia, { assuntos: ["as-6"], marcou: true }), q(t));
  // O LOTE: as outras duas, marcadas uma a uma.
  const pedidosAntes = pedidos.length;
  await clicar(page.locator('[data-faxina-marcar="cv-sug-fx2"]'));
  await clicar(page.locator('[data-faxina-marcar="cv-sug-fx3"]'));
  await page.waitForTimeout(200);
  await clicar(page.locator("[data-faxina-finalizar-marcadas]"));
  await page.waitForTimeout(800);
  const lote = await attr(page.locator("[data-ja-tratei-janela]"), "data-ja-tratei-lote");
  ok("no lote a janela abre", Number(lote) === 2, q(lote));
  ok("e NÃO pede sugestão nem mostra a caixa", pedidos.length === pedidosAntes && !(await temCaixa(page)),
     q({ pedidos: pedidos.length - pedidosAntes, caixa: await caixa(page) }));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n10. Num banco sem o 042, o clique é gravado sem a coluna, e finaliza");
{
  ponte.assunto = () => SUGESTAO([ACORDOS]);
  const { ctx, page, estouros } = await abrirPagina({ semColunas: { zorvin_tratamentos: ["sugestao_ia"] } });
  await abrirConversa(page, "cv-sug-1");
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-1");
  ok("o registro entrou, sem a coluna que o banco não tem", t.length === 1 && t[0].assunto_id === "as-6" && t[0].sugestao_ia === "AUSENTE", q(t));
  ok("a conversa foi finalizada", (await situacaoDe(page, "cv-sug-1")) === "finalizado", q(await situacaoDe(page, "cv-sug-1")));
  ok("e a janela fechou sem erro", (await page.locator("[data-ja-tratei-janela]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n11. Sem o 028 (o “Já tratei” de antes), a mesma sugestão");
{
  ponte.assunto = () => SUGESTAO([ACORDOS]);
  const { ctx, page, estouros } = await abrirPagina({ semSituacao: true });
  await abrirConversa(page, "cv-sug-1");
  const abriu = await abrirJanela(page);
  const modo = await attr(page.locator("[data-ja-tratei-janela]"), "data-ja-tratei-modo");
  ok("a janela é a do “Já tratei”", abriu && modo === "tratar", q(modo));
  ok("e a sugestão marca sozinha", await esperarCaixa(page, "marcou") && igual(await marcados(page), ["ACORDOS"]),
     q({ caixa: await caixa(page), marcados: await marcados(page) }));
  ok("dizendo para conferir antes de confirmar", /confira antes de confirmar/.test(normal(await texto(page.locator("[data-sugestao-do-assunto]")))));
  await confirmar(page);
  const t = await tratamentosDe(page, "cv-sug-1");
  ok("o clique grava a sugestão", t.length === 1 && igual(t[0].sugestao_ia, { assuntos: ["as-6"], marcou: true }), q(t));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n12. No celular, a caixa cabe na janela");
{
  ponte.assunto = () => ({ ...SUGESTAO([ACORDOS], "O cliente perguntou do acordo de doze parcelas e a equipe confirmou o recebimento do comprovante."), demora: 300 });
  const { ctx, page, estouros } = await abrirPagina({ largura: 360, altura: 780 });
  await abrirConversa(page, "cv-sug-2");
  await clicar(page.getByRole("button", { name: "Mais opções desta conversa" }));
  await page.waitForTimeout(250);
  const abriu = await clicar(page.locator('[data-ja-tratei="tratar"]'));
  await page.waitForTimeout(200);
  ok("o ⋮ abre o Finalizar", abriu && (await page.locator("[data-ja-tratei-janela]").count()) === 1);
  ok("a sugestão marca sozinha também no celular", await esperarCaixa(page, "marcou") && igual(await marcados(page), ["ACORDOS"]),
     q({ caixa: await caixa(page), marcados: await marcados(page) }));
  const medida = await page.evaluate(() => {
    const cx = document.querySelector("[data-sugestao-do-assunto]")?.getBoundingClientRect();
    const janela = document.querySelector("[data-ja-tratei-janela] > div")?.getBoundingClientRect();
    return { cx: cx && { l: cx.left, r: cx.right }, janela: janela && { l: janela.left, r: janela.right },
             largura: window.innerWidth, rolaDeLado: document.documentElement.scrollWidth > window.innerWidth };
  });
  ok("a caixa fica dentro da janela, e a página não rola de lado",
     medida.cx && medida.janela && medida.cx.l >= medida.janela.l - 0.5 && medida.cx.r <= medida.janela.r + 0.5
     && medida.janela.r <= medida.largura + 0.5 && !medida.rolaDeLado, q(medida));
  await alternar(page, "ACORDOS");
  await page.waitForTimeout(150);
  const alvo = (await page.locator("[data-usar-sugestao]").count())
    ? await page.locator("[data-usar-sugestao]").first().boundingBox().catch(() => null) : null;
  ok("“Marcar a sugestão” tem o alvo de dedo de 40 pontos", alvo && alvo.height >= 39.5, q(alvo));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n13. Duas conversas na mesma sessão: cada uma com a sua sugestão");
{
  ponte.assunto = (id) => SUGESTAO(id === "cv-sug-3" ? [BLINDAGEM] : [ACORDOS]);
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-2");
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  ok("na primeira, a sugestão dela", igual(await marcados(page), ["ACORDOS"]), q(await marcados(page)));
  await fecharJanela(page);
  await abrirConversa(page, "cv-sug-3");
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  ok("na segunda, a sugestão DELA, e não a da primeira", igual(await marcados(page), ["BLINDAGEM"]), q(await marcados(page)));
  ok("um pedido para cada conversa", igual(pedidos.map((x) => x.corpo.conversa_id), ["cv-sug-2", "cv-sug-3"]),
     q(pedidos.map((x) => x.corpo.conversa_id)));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n14. Uma mensagem nova na conversa pede de novo");
{
  let vez = 0;
  ponte.assunto = () => SUGESTAO(++vez === 1 ? [ACORDOS] : [BLINDAGEM]);
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-4");
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  ok("a primeira sugestão", igual(await marcados(page), ["ACORDOS"]), q(await marcados(page)));
  await fecharJanela(page);
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("cv-sug-4", "contato", "Na verdade é sobre a blindagem."));
  await page.waitForTimeout(1500);
  ok("a mensagem nova é do mesmo atendimento: o protocolo não mudou",
     (await page.evaluate(() => (globalThis.__TABELAS.conversas.find((c) => c.id === "cv-sug-4") || {}).protocolo)) === protocoloDe(4));
  await abrirJanela(page);
  await esperarCaixa(page, "marcou");
  ok("depois da mensagem nova, a janela pede de novo", pedidos.length === 2, String(pedidos.length));
  ok("e marca a sugestão nova", igual(await marcados(page), ["BLINDAGEM"]), q(await marcados(page)));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n15. A lista de assuntos que não carregou não pede à IA");
{
  ponte.assunto = () => SUGESTAO([ACORDOS]);
  const { ctx, page, estouros } = await abrirPagina({ quebrar: ["zorvin_assuntos"] });
  await abrirConversa(page, "cv-sug-5");
  const abriu = await abrirJanela(page);
  await page.waitForTimeout(900);
  ok("a janela abre, dizendo que a lista não carregou", abriu && (await page.locator("[data-erro-dos-assuntos]").count()) === 1);
  ok("e não pede sugestão nem mostra a caixa", pedidos.length === 0 && !(await temCaixa(page)),
     q({ pedidos: pedidos.length, caixa: await caixa(page) }));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
