// A IA NÃO SUGERE MAIS O ASSUNTO NO FINALIZAR (04/11) — a metade do painel.
//
// Pedido do Rodrigo: "A sugestão da IA no Finalizar, pode remover. Não
// gostamos do uso dela, está mais atrapalhando do que ajudando." Ela tinha
// entrado em 01/11 (a recomendação nº 5 de 31/10), e esta prova se chamava
// `a-ia-sugere-o-assunto`. As conferências foram INVERTIDAS, e não apagadas:
// escritas ao contrário, são o que impede a sugestão de voltar numa limpeza
// ou num "desfazer" futuro.
//
// A ponte tirou a rota (`POST /copiloto/assunto`) e o `assunto: true` do
// estado (seção 88 do repo dela). O pior caso, para o painel, é a ponte de
// ANTES da remoção — publicada atrasada, como em 14/10 —, que ainda diz
// `assunto: true` e ainda responde a rota com uma sugestão. É contra ela que
// cada cena roda. O que esta prova guarda:
//
//   1. a janela do Finalizar não pede nada à IA, com a ponte de antes, com a
//      de agora e com a pergunta do estado falhando — e nada vem marcado,
//      nenhum selo, nenhuma caixa;
//   2. marcar à mão e finalizar grava só o que a pessoa marcou, sem
//      `sugestao_ia` no pedido;
//   3. na faxina, a finalização de uma conversa também não pede;
//   4. sem o 028 (o "Já tratei" de antes), também não;
//   5. no celular, também não.
import { abrirNavegador, ENDERECO, guiaQueAbre } from "./navegador.mjs";

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
/** Um atributo — GUARDADO: `getAttribute` num elemento que não existe espera
 *  30 segundos antes de desistir (a lição da prova da prévia do PDF). */
const attr = async (loc, nome) => ((await loc.count()) ? loc.first().getAttribute(nome).catch(() => null) : null);

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

// AS CONVERSAS PLANTADAS: uma por cena que finaliza no telefone que abre
// (uma cena não pode herdar a conversa finalizada da outra), e uma PARADA no
// a8, para a faxina (lá não há outra parada na bancada).
const contato = (id, numero, nome) =>
  ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const N = 6;
const CONTATOS = Array.from({ length: N }, (_, i) => contato(`ct-sug-${i + 1}`, `55119482304${String(i + 10)}`, `Cliente Sem Sugestão ${i + 1}`));
// CADA UMA COM O SEU PROTOCOLO ABERTO, como no escritório: no 028 toda
// conversa em "Em Atendimento" tem um.
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
const CT_FX = contato("ct-sug-fx1", "5511948230391", "Parada Um");
const PARADA = {
  id: "cv-sug-fx1", advogado_id: "a8", contato_id: CT_FX.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: haDias(40), ultima_mensagem: "Obrigado", frente: null, vantoro_nome: null, digitando_ate: null,
  responsavel_id: null, responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null,
  esperando_desde: null, tratada_em: null, contato: CT_FX,
};
const SEMENTE = {
  zorvin_atendimentos: Array.from({ length: N }, (_, i) => ({
    id: `at-sug-${i + 1}`, protocolo: protocoloDe(i + 1), conversa_id: `cv-sug-${i + 1}`,
    aberto_em: antes(40 + i), origem: "cliente", aberto_por: null,
    primeira_resposta_em: antes(35 + i), finalizado_em: null, finalizado_por: null })),
  contatos: [...CONTATOS, CT_FX],
  conversas: [...Array.from({ length: N }, (_, i) => conversa(i + 1)), PARADA],
  mensagens: [
    ...Array.from({ length: N }, (_, i) => [
      { id: `m-sug-${i}-a`, conversa_id: `cv-sug-${i + 1}`, origem: "contato", tipo: "texto",
        texto: "Bom dia, queria saber do acordo", criado_em: antes(40 + i) },
      { id: `m-sug-${i}-b`, conversa_id: `cv-sug-${i + 1}`, origem: "advogado", tipo: "texto",
        texto: "Bom dia! Já conferimos.", criado_em: antes(35 + i), enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
    ]).flat(),
    { id: "m-sug-fx1", conversa_id: "cv-sug-fx1", origem: "contato", tipo: "texto", texto: "Obrigado", criado_em: haDias(40) },
  ],
};

// AS TRÊS PONTES. A de antes da remoção é o pior caso: ela diz `assunto:
// true` e responde a rota com ACORDOS — se o painel ainda soubesse pedir, é
// com ela que pediria e marcaria.
const ESTADO = {
  antes: { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, assunto: true, funil: true } },
  agora: { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, funil: true } },
  falhou: { status: 500, corpo: {} },
};
const ponte = { estado: ESTADO.antes };
let pedidos = [];

async function abrirPagina({ largura = 1400, altura = 900, semSituacao = false } = {}) {
  pedidos = [];
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const estouros = [];
  // NO CONTEXTO: a faxina abre numa guia nova, e ela nasce com a semente, as
  // bandeiras e a ponte de mentira.
  ctx.on("page", (p) => p.on("pageerror", (e) => estouros.push(e.message)));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários.
  await ctx.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__SEM_COLUNAS = {};
    globalThis.__SEM_SITUACAO = b.semSituacao;
    globalThis.__QUEBRAR = [];
    globalThis.__AVISOS_DA_FAIXA = [];
  }, { semente: SEMENTE, semSituacao });
  await ctx.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (url.pathname.endsWith("/copiloto/assunto")) {
      pedidos.push(JSON.parse(rota.request().postData() || "{}"));
      return json(200, { ok: true, assuntos: [{ id: "as-6", nome: "ACORDOS" }],
                         motivo: "O cliente perguntou do acordo.", mensagens: 2, notas: 0, atendimento: true });
    }
    // SEM VANTORO: a ficha fixa estreitaria a conversa sem nada a ver com isto.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 90000 });
  await page.waitForTimeout(1300);
  // UM TETO CURTO PARA O RESTO: o que esquecer a guarda espera 8 segundos, e
  // não 30.
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
/** Os assuntos marcados na janela, na ordem da lista. */
const marcados = (page) => page.locator("[data-assunto-do-ja-tratei]").evaluateAll((els) =>
  els.filter((e) => e.querySelector('input[type="checkbox"]')?.checked).map((e) => e.getAttribute("data-assunto-do-ja-tratei")));
/** O que a janela mostra da IA: a caixa da sugestão, o selo nos itens e o
 *  botão de marcar a sugestão. Tudo isso saiu, e tem de continuar fora. */
const daIa = (page) => page.evaluate(() => ({
  caixa: document.querySelectorAll("[data-sugestao-do-assunto]").length,
  selos: document.querySelectorAll("[data-sugerido-pela-ia]").length,
  botao: document.querySelectorAll("[data-usar-sugestao]").length,
  fala: /Sugestão da IA|A IA está lendo|A IA não arriscou/.test(document.querySelector("[data-ja-tratei-janela]")?.innerText || ""),
}));
const nadaDaIa = (v) => v.caixa === 0 && v.selos === 0 && v.botao === 0 && !v.fala;
async function alternar(page, nome) {
  const l = page.locator(`[data-assunto-do-ja-tratei="${nome}"] input[type="checkbox"]`);
  if (!(await l.count())) return false;
  await l.first().click();
  return true;
}
const desligado = async (page) => ((await page.locator("[data-ja-tratei-confirmar]").count())
  ? page.locator("[data-ja-tratei-confirmar]").first().isDisabled() : null);
/** As linhas do "Já tratei" de uma conversa — e se o PEDIDO levou a coluna
 *  da sugestão. A bancada guarda a linha como o painel a mandou: a chave
 *  ausente quer dizer que o painel não a mencionou. */
const tratamentosDe = (page, id) => page.evaluate((cid) =>
  (globalThis.__TABELAS.zorvin_tratamentos || []).filter((t) => String(t.conversa_id) === String(cid))
    .map((t) => ({ assunto_id: t.assunto_id, levouSugestao: Object.prototype.hasOwnProperty.call(t, "sugestao_ia") })), id);
const situacaoDe = (page, id) => page.evaluate((cid) =>
  ((globalThis.__TABELAS.conversas || []).find((c) => String(c.id) === String(cid)) || {}).situacao ?? null, id);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ==================================================================
console.log("\n1. A janela do Finalizar não pede nada à IA, com qualquer ponte");
for (const [nome, estado, conv] of [
  ["a ponte de ANTES da remoção, que ainda diz `assunto: true`", ESTADO.antes, "cv-sug-1"],
  ["a ponte de agora, sem o `assunto`", ESTADO.agora, "cv-sug-1"],
  ["a pergunta do estado falhando (antes, na dúvida, a janela pedia)", ESTADO.falhou, "cv-sug-1"],
]) {
  ponte.estado = estado;
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, conv);
  const abriu = await abrirJanela(page);
  // O TEMPO DE UMA SUGESTÃO CHEGAR, se alguém ainda pedisse: a ponte de
  // mentira responde na hora.
  await page.waitForTimeout(1500);
  const v = await daIa(page);
  ok(`${nome}: a janela abre e não pede sugestão`, abriu && pedidos.length === 0, q({ abriu, pedidos: pedidos.length }));
  ok("  nenhuma caixa, selo ou botão da IA", nadaDaIa(v), q(v));
  ok("  nada vem marcado", igual(await marcados(page), []), q(await marcados(page)));
  ok("  e o botão continua desligado até a pessoa marcar", (await desligado(page)) === true);
  ok("  sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}
ponte.estado = ESTADO.antes;

// ==================================================================
console.log("\n2. Marcar à mão e finalizar grava só o que a pessoa marcou");
{
  const { ctx, page, estouros } = await abrirPagina();
  await abrirConversa(page, "cv-sug-2");
  ok("abri a janela do Finalizar", await abrirJanela(page));
  ok("marquei ACORDOS à mão", await alternar(page, "ACORDOS"));
  await page.waitForTimeout(1200);
  ok("e continua só ACORDOS: nada foi marcado por cima", igual(await marcados(page), ["ACORDOS"]), q(await marcados(page)));
  const fez = await clicar(page.locator("[data-ja-tratei-confirmar]"));
  await page.waitForTimeout(1500);
  const t = await tratamentosDe(page, "cv-sug-2");
  ok("o clique grava ACORDOS", fez && t.length === 1 && t[0].assunto_id === "as-6", q(t));
  ok("e o pedido não leva a coluna da sugestão", t.length === 1 && t[0].levouSugestao === false, q(t));
  ok("a conversa foi finalizada", (await situacaoDe(page, "cv-sug-2")) === "finalizado", q(await situacaoDe(page, "cv-sug-2")));
  ok("e nada foi pedido à IA", pedidos.length === 0, String(pedidos.length));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Na faxina, a finalização de uma conversa também não pede");
{
  const { ctx, page: conversas, estouros } = await abrirPagina({ largura: 1360 });
  await clicar(conversas.locator('button[aria-label="Menu"]'));
  await conversas.waitForTimeout(250);
  // A FAXINA ABRE NUMA GUIA NOVA (02/11).
  const faxina = (await conversas.locator("[data-abrir-faxina]").count())
    ? await guiaQueAbre(ctx, () => clicar(conversas.locator("[data-abrir-faxina]"))) : null;
  ok("a faxina abriu, numa guia nova", Boolean(faxina));
  const page = faxina || conversas;
  page.setDefaultTimeout(8000);
  await page.waitForSelector('[data-tela="faxina"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const tem = await page.locator('[data-faxina-telefone] option[value="a8"]').count();
  if (tem) await page.locator("[data-faxina-telefone]").first().selectOption("a8");
  await page.waitForTimeout(1500);
  // A PARADA não espera resposta (`esperando_desde` nulo): mora no grupo "a
  // equipe falou por último".
  await clicar(page.locator('[data-faxina-grupo="equipe"]'));
  await page.waitForTimeout(1200);
  ok("a parada aparece", (await page.locator('[data-faxina-linha="cv-sug-fx1"]').count()) === 1);
  await clicar(page.locator('[data-faxina-finalizar="cv-sug-fx1"]'));
  await page.waitForTimeout(1500);
  const abriu = (await page.locator("[data-ja-tratei-janela]").count()) === 1;
  const v = await daIa(page);
  ok("a janela abre e não pede sugestão", abriu && pedidos.length === 0, q({ abriu, pedidos: pedidos.length }));
  ok("nenhuma caixa, selo ou botão da IA, e nada marcado", nadaDaIa(v) && igual(await marcados(page), []),
     q({ ...v, marcados: await marcados(page) }));
  await alternar(page, "ACORDOS");
  await clicar(page.locator("[data-ja-tratei-confirmar]"));
  await page.waitForTimeout(1800);
  const t = await tratamentosDe(page, "cv-sug-fx1");
  ok("e a faxina grava ACORDOS, sem a coluna da sugestão",
     t.length === 1 && t[0].assunto_id === "as-6" && t[0].levouSugestao === false, q(t));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Sem o 028 (o “Já tratei” de antes), também não");
{
  const { ctx, page, estouros } = await abrirPagina({ semSituacao: true });
  await abrirConversa(page, "cv-sug-3");
  const abriu = await abrirJanela(page);
  const modo = await attr(page.locator("[data-ja-tratei-janela]"), "data-ja-tratei-modo");
  await page.waitForTimeout(1500);
  const v = await daIa(page);
  ok("a janela é a do “Já tratei”, e não pede sugestão", abriu && modo === "tratar" && pedidos.length === 0,
     q({ modo, pedidos: pedidos.length }));
  ok("nenhuma caixa, selo ou botão da IA, e nada marcado", nadaDaIa(v) && igual(await marcados(page), []),
     q({ ...v, marcados: await marcados(page) }));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n5. No celular, também não");
{
  const { ctx, page, estouros } = await abrirPagina({ largura: 360, altura: 780 });
  await abrirConversa(page, "cv-sug-4");
  await clicar(page.getByRole("button", { name: "Mais opções desta conversa" }));
  await page.waitForTimeout(250);
  const abriu = await clicar(page.locator('[data-ja-tratei="tratar"]'));
  await page.waitForTimeout(1500);
  const v = await daIa(page);
  ok("o ⋮ abre o Finalizar, e ele não pede sugestão",
     abriu && (await page.locator("[data-ja-tratei-janela]").count()) === 1 && pedidos.length === 0,
     q({ abriu, pedidos: pedidos.length }));
  ok("nenhuma caixa, selo ou botão da IA, e nada marcado", nadaDaIa(v) && igual(await marcados(page), []),
     q({ ...v, marcados: await marcados(page) }));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
