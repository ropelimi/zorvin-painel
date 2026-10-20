// AGUARDANDO, EM ABERTO E FINALIZADOS — as três abas do DataCrazy (19/10)
//
// Pedido do Rodrigo: "igual existe no DataCrazy, para facilitar a
// organização". A lista ganha três abas que a SEPARAM — o cliente que a
// equipe ainda não atendeu, o que já foi atendido e não foi finalizado, e o
// finalizado —, com um protocolo por atendimento. Quem decide em qual aba cada
// conversa mora é o BANCO (script 028 da ponte); a bancada imita os gatilhos
// dele, e cada regra tem a sua conferência num Postgres de verdade, na seção
// 67 da prova da ponte. Aqui se prova a TELA:
//
//   1. as abas separam a lista, com o número de cada uma vindo do banco;
//   2. a aba vai ao BANCO — a conversa finalizada a mil páginas de distância
//      aparece em "Finalizados", e não só as que estão carregadas;
//   3. "Finalizar" é o "Já tratei": a mesma checklist, e quem finaliza é o
//      banco, na mesma gravação do registro;
//   4. o cliente que escreve depois de finalizado volta para "Em Atendimento" com
//      um protocolo NOVO, e a finalização de antes continua à vista;
//   5. "Reabrir" tem dois sentidos — continuar (protocolo novo, o registro
//      fica) e desfazer (o mesmo protocolo, o registro deixa de contar, e a
//      espera ORIGINAL volta);
//   6. o banco que recusa é DITO, e a tela não finge ter mudado de aba;
//   7. a busca atravessa as abas e diz em qual cada conversa mora;
//   8. sem o script, tudo como antes.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

// UM RELÓGIO SÓ para a semente inteira: duas chamadas a `Date.now()` para "o
// mesmo instante" de um clique podem cair em milissegundos diferentes — a
// lição da prova do histórico do "Já tratei".
const AGORA = Date.now();
const H = (n) => new Date(AGORA - n * 3600e3).toISOString();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo (a lição
 *  de `o-ja-tratei`: a conta de teste não enxerga todos os telefones). */
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

const ALICE = "ALICE DO AGUARDO";       // ninguém atendeu
const BRUNO = "BRUNO DO ABERTO";        // atendido, não finalizado
const FLAVIA = "FLAVIA DA FINALIZADA";  // finalizada pela Jenifer
const ZE = "ZE LA DO FUNDO";            // finalizado, a mil páginas de distância
const P = { ag: "2026-000901", ab: "2026-000902", fz: "2026-000903", fundo: "2026-000904" };

const contato = (id, numero, nome) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
  vantoro_cliente_id: null, foto_url: null });
const conversa = (id, adv, ct, campos) => ({
  id, advogado_id: adv, contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null, esperando_desde: null,
  contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null }, ...campos,
});
const msg = (id, conv, origem, texto, criado_em, extra = {}) => ({ id, conversa_id: conv, origem, tipo: "texto",
  texto, criado_em, id_uazapi: `ID-${id}`, ...(origem === "advogado"
    ? { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" } : {}), ...extra });

const CT = {
  ag: contato("ct-ag", "5511970002201", ALICE), ab: contato("ct-ab", "5511970002202", BRUNO),
  fz: contato("ct-fz", "5511970002203", FLAVIA), fundo: contato("ct-fundo-ze", "5511970002204", ZE),
};

function semente() {
  return {
    contatos: Object.values(CT),
    conversas: [
      conversa("cv-ag", ADV, CT.ag, { situacao: "aguardando", protocolo: P.ag, nao_lidas: 2,
        ultima_atividade: H(2), ultima_mensagem: "Oi, alguém aí?", esperando_desde: H(2) }),
      conversa("cv-ab", ADV, CT.ab, { situacao: "aberto", protocolo: P.ab, nao_lidas: 1,
        ultima_atividade: H(3), ultima_mensagem: "e o boleto?", esperando_desde: H(3) }),
      conversa("cv-fz", ADV, CT.fz, { situacao: "finalizado", protocolo: P.fz,
        ultima_atividade: H(28), ultima_mensagem: "obrigada", tratada_em: H(27) }),
      // O FUNDO: no telefone de 1200 conversas, parado há 1300 horas — muito
      // além das 200 que a primeira página traz.
      conversa("cv-fundo-ze", "a13", CT.fundo, { situacao: "finalizado", protocolo: P.fundo,
        ultima_atividade: H(1300), ultima_mensagem: "valeu", tratada_em: H(1299) }),
    ],
    mensagens: [
      msg("ag1", "cv-ag", "contato", "Oi, alguém aí?", H(2)),
      msg("ab1", "cv-ab", "contato", "Bom dia, preciso do boleto", H(5)),
      msg("ab2", "cv-ab", "advogado", "Bom dia! Vou conferir.", H(4)),
      msg("ab3", "cv-ab", "contato", "e o boleto?", H(3)),
      msg("fz1", "cv-fz", "contato", "Preciso da guia", H(30)),
      msg("fz2", "cv-fz", "advogado", "Segue a guia.", H(29)),
      msg("fz3", "cv-fz", "contato", "obrigada", H(28)),
      msg("ze1", "cv-fundo-ze", "contato", "valeu", H(1300)),
    ],
    zorvin_atendimentos: [
      { id: "at-ag", protocolo: P.ag, conversa_id: "cv-ag", aberto_em: H(2), origem: "cliente", aberto_por: null,
        primeira_resposta_em: null, finalizado_em: null, finalizado_por: null },
      { id: "at-ab", protocolo: P.ab, conversa_id: "cv-ab", aberto_em: H(5), origem: "cliente", aberto_por: null,
        primeira_resposta_em: H(4), finalizado_em: null, finalizado_por: null },
      { id: "at-fz", protocolo: P.fz, conversa_id: "cv-fz", aberto_em: H(30), origem: "cliente", aberto_por: null,
        primeira_resposta_em: H(29), finalizado_em: H(27), finalizado_por: "u-jenifer" },
      { id: "at-fundo", protocolo: P.fundo, conversa_id: "cv-fundo-ze", aberto_em: H(1300), origem: "cliente",
        aberto_por: null, primeira_resposta_em: null, finalizado_em: H(1299), finalizado_por: "u-jenifer" },
    ],
    zorvin_tratamentos: [
      { id: "tr-fz", conversa_id: "cv-fz", assunto_id: null, quem: "u-jenifer", quando: H(27),
        esperava_desde: H(28), desfeito_em: null, desfeito_por: null, atendimento_id: "at-fz" },
    ],
  };
}

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula, e uma
 *  ligada num cenário continuaria valendo nos seguintes. */
async function abrirPainel({ semSituacao = false, erro = {}, semEfeito = [], atraso = {}, largura = 1400,
                             altura = 900, extra = null, cliqueNaoFinaliza = false, contagem = null,
                             ajustar = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const s = semente();
  if (extra) for (const [k, v] of Object.entries(extra)) s[k] = [...(s[k] || []), ...v];
  if (ajustar) ajustar(s);
  // O assunto do registro plantado é o primeiro ativo da bancada.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_SITUACAO = d.semSituacao;
    globalThis.__ERRO_NA_GRAVACAO = d.erro || {};
    globalThis.__ESCRITA_SEM_EFEITO = d.semEfeito || [];
    globalThis.__ATRASO_POR_TABELA = d.atraso || {};
    globalThis.__CONTAGEM_DAS_ABAS_FALHA = false;
    globalThis.__CONTAGEM_DAS_ABAS_FIXA = d.contagem;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__CLIQUE_NAO_FINALIZA = d.cliqueNaoFinaliza;
  }, { semente: s, semSituacao, erro, semEfeito, atraso, cliqueNaoFinaliza, contagem });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: o elemento que não existe não estoura a prova — ela
 *  reprova na conferência que diz o quê. */
async function clicar(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  await l.first().click({ timeout: 5000 }).catch(() => {});
  return true;
}
const nomesNaLista = (page) => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")].filter((e) => e.offsetParent !== null)
    .map((e) => e.getAttribute("data-conversa-nome")));
const abaAtiva = (page) => page.evaluate(() =>
  document.querySelector('[data-aba-da-situacao][data-aba-ativa="sim"]')?.getAttribute("data-aba-da-situacao") || null);
const numeroDaAba = (page, k) => page.evaluate((k) => {
  const el = document.querySelector(`[data-aba-da-situacao="${k}"] [data-numero-da-aba]`);
  return el ? { n: Number(el.getAttribute("data-numero-da-aba")), alerta: el.getAttribute("data-numero-em-alerta") === "sim" } : null;
}, k);
async function irParaAba(page, k) {
  await clicar(page, `[data-aba-da-situacao="${k}"]`);
  await page.waitForTimeout(1500);
}
async function abrirConversa(page, nome) {
  const ok = await clicar(page, `[data-conversa-nome="${nome}"]`);
  await page.waitForTimeout(1300);
  return ok;
}
/** O que o banco de mentira guarda, agora. */
const banco = (page, convId) => page.evaluate((id) => {
  const T = globalThis.__TABELAS;
  const c = (T.conversas || []).find((x) => String(x.id) === id) || {};
  return {
    situacao: c.situacao, protocolo: c.protocolo, esperando_desde: c.esperando_desde || null, tratada_em: c.tratada_em || null,
    atendimentos: (T.zorvin_atendimentos || []).filter((a) => String(a.conversa_id) === id)
      .map((a) => ({ protocolo: a.protocolo, origem: a.origem, aberto_por: a.aberto_por || null,
                     finalizado: Boolean(a.finalizado_em), finalizado_por: a.finalizado_por || null })),
    tratamentos: (T.zorvin_tratamentos || []).filter((t) => String(t.conversa_id) === id)
      .map((t) => ({ atendimento_id: t.atendimento_id || null, desfeito: Boolean(t.desfeito_em), desfeito_por: t.desfeito_por || null })),
  };
}, convId);
/** A conta que o banco faria para a aba — para comparar com o número na tela. */
const contaNoBanco = (page, adv) => page.evaluate((adv) => {
  const T = globalThis.__TABELAS;
  const r = { aguardando: 0, aberto: 0, finalizado: 0, nl: { aguardando: 0, aberto: 0, finalizado: 0 } };
  for (const c of T.conversas || []) {
    if (String(c.advogado_id) !== String(adv) || c.arquivada) continue;
    if (!(T.mensagens || []).some((m) => String(m.conversa_id) === String(c.id))) continue;
    if (!(c.situacao in r.nl)) continue;
    r[c.situacao] += 1; if ((c.nao_lidas || 0) > 0) r.nl[c.situacao] += 1;
  }
  return r;
}, adv);
/** O FILME da faixa de aviso: uma frase por vez, e a seguinte apaga a anterior
 *  — a lição da prova "a tela não diz salvei sem salvar". */
async function gravarFilme(page) {
  await page.evaluate(() => {
    globalThis.__FILME = [];
    clearInterval(globalThis.__RELOGIO_DO_FILME);
    globalThis.__RELOGIO_DO_FILME = setInterval(() => {
      const t = [...document.querySelectorAll("div")].map((d) => d.textContent || "")
        .filter((x) => /^(Finalizada|Reaberta|Desfeito|Desfiz|Registrei|Ela já)/.test(x) && x.length < 260);
      for (const x of t) if (!globalThis.__FILME.includes(x)) globalThis.__FILME.push(x);
    }, 50);
  });
}
const filme = (page) => page.evaluate(() => globalThis.__FILME || []);
const marcos = (page) => page.evaluate(() => [...document.querySelectorAll("[data-marco-do-atendimento]")]
  .map((m) => ({ p: m.getAttribute("data-marco-do-atendimento"), tipo: m.getAttribute("data-marco"),
                 texto: (m.innerText || "").replace(/\s+/g, " ").trim() })));

// ==================================================================
//  1. AS TRÊS ABAS, E O QUE MORA EM CADA UMA
// ==================================================================
console.log("\nAs três abas separam a lista, e o número de cada uma vem do banco");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abas = await page.evaluate(() => [...document.querySelectorAll("[data-aba-da-situacao]")]
    .map((b) => [b.getAttribute("data-aba-da-situacao"), (b.innerText || "").replace(/\d+/g, "").trim()]));
  ok("há as três abas, na ordem do DataCrazy",
     JSON.stringify(abas) === JSON.stringify([["aguardando", "Novos"], ["aberto", "Em Atendimento"], ["finalizado", "Finalizados"]]),
     JSON.stringify(abas));
  ok("o painel abre em “Em Atendimento”, a lista de trabalho", (await abaAtiva(page)) === "aberto", await abaAtiva(page));
  let nomes = await nomesNaLista(page);
  ok("em “Em Atendimento” está quem foi atendido e não finalizado", nomes.includes(BRUNO), JSON.stringify(nomes.slice(0, 6)));
  ok("e não está quem ninguém atendeu, nem quem foi finalizado", !nomes.includes(ALICE) && !nomes.includes(FLAVIA));

  await page.waitForTimeout(800);
  const conta = await contaNoBanco(page, ADV);
  const nAg = await numeroDaAba(page, "aguardando"), nAb = await numeroDaAba(page, "aberto");
  ok("o número de “Novos” é o do banco, e fica em alerta", nAg && nAg.n === conta.aguardando && nAg.n > 0 && nAg.alerta,
     JSON.stringify([nAg, conta.aguardando]));
  ok("o de “Em Atendimento” é o do banco, e sem alerta", nAb && nAb.n === conta.aberto && !nAb.alerta, JSON.stringify([nAb, conta.aberto]));
  ok("“Finalizados” não tem número — só cresce", (await numeroDaAba(page, "finalizado")) === null);
  const pilula = await page.evaluate(() => document.querySelector('[data-aba="naolidas"]')?.textContent || "");
  ok("a pílula “Não lidas” conta as não lidas DA ABA, e não as do telefone",
     pilula === `Não lidas ${conta.nl.aberto}` || (conta.nl.aberto === 0 && pilula === "Não lidas"),
     `${pilula} / da aba: ${conta.nl.aberto}`);

  await irParaAba(page, "aguardando");
  nomes = await nomesNaLista(page);
  ok("“Novos” mostra quem ninguém atendeu", nomes.includes(ALICE) && !nomes.includes(BRUNO), JSON.stringify(nomes.slice(0, 6)));
  const pilulaAg = await page.evaluate(() => document.querySelector('[data-aba="naolidas"]')?.textContent || "");
  ok("e a pílula passa a contar as dela", pilulaAg === `Não lidas ${conta.nl.aguardando}`, `${pilulaAg} / ${conta.nl.aguardando}`);
  await irParaAba(page, "finalizado");
  nomes = await nomesNaLista(page);
  ok("“Finalizados” mostra a finalizada, e só ela", nomes.length === 1 && nomes[0] === FLAVIA, JSON.stringify(nomes));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  1b. TROCAR DE ABA NÃO AFIRMA UMA AUSÊNCIA QUE AINDA NÃO APUROU
// ==================================================================
console.log("\nEnquanto a aba nova vem do banco, a lista diz que está carregando");
{
  const { ctx, page } = await abrirPainel({ atraso: { conversas: 1600 } });
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await clicar(page, '[data-aba-da-situacao="finalizado"]');
  await page.waitForTimeout(400);
  const recado = await page.evaluate(() => document.querySelector("[data-recado-da-lista]")?.getAttribute("data-recado-da-lista") || null);
  ok("no meio da ida ao banco: “carregando”, e não “nenhuma conversa finalizada”", recado === "trocando-de-aba", String(recado));
  ok("e as conversas da aba de antes não ficam na tela", !(await nomesNaLista(page)).includes(BRUNO));
  await page.waitForTimeout(4000);
  ok("depois, a aba nova aparece", (await nomesNaLista(page)).includes(FLAVIA), JSON.stringify(await nomesNaLista(page)));
  await ctx.close();
}

// ==================================================================
//  1c. MARCAR COMO LIDA MUDA O NÚMERO DA PÍLULA DA ABA
// ==================================================================
console.log("\nMarcar como lida muda o número da pílula da aba, e quem avisa é a própria tela");
{
  // O tempo real não diria: a lista desta tela já foi mudada antes, e o
  // aviso que volta não tem diferença nenhuma para ela.
  const { ctx, page } = await abrirPainel();
  await page.waitForTimeout(800);
  const antes = await page.evaluate(() => document.querySelector('[data-aba="naolidas"]')?.textContent || "");
  await abrirConversa(page, BRUNO);
  const marcou = await clicar(page, '[data-marcar="lida"]');
  ok("(o Bruno tinha não lida, e marquei como lida)", marcou);
  await page.waitForTimeout(3500);
  const conta = await contaNoBanco(page, ADV);
  const depois = await page.evaluate(() => document.querySelector('[data-aba="naolidas"]')?.textContent || "");
  ok("a pílula passa a dizer a conta de agora", depois !== antes
     && depois === (conta.nl.aberto ? `Não lidas ${conta.nl.aberto}` : "Não lidas"), `${antes} → ${depois} / ${conta.nl.aberto}`);
  await ctx.close();
}

// ==================================================================
//  2. A ABA VAI AO BANCO — a finalizada a mil páginas de distância
// ==================================================================
console.log("\nA aba vai ao banco: a finalizada parada há 1300 horas aparece em “Finalizados”");
{
  const { ctx, page, estouros } = await abrirPainel();
  const achou = await clicar(page, '[data-telefone="Arquivo"]');
  ok("achei o telefone de 1200 conversas", achou);
  await page.waitForTimeout(2500);
  ok("em “Em Atendimento”, ele não está (está finalizado)", !(await nomesNaLista(page)).includes(ZE));
  await irParaAba(page, "finalizado");
  const nomes = await nomesNaLista(page);
  ok("e em “Finalizados” ele aparece — a lista veio do banco recortada pela aba",
     nomes.length === 1 && nomes[0] === ZE, JSON.stringify(nomes.slice(0, 5)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  3. FINALIZAR — o "Já tratei" com outro nome, e quem finaliza é o banco
// ==================================================================
console.log("\n“Finalizar” é a checklist do “Já tratei”, e o banco finaliza na mesma gravação");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, BRUNO);
  // PELO `aria-label`, e não pelo texto: a 1400 com a ficha aberta o
  // cabeçalho aperta e o botão vira só ícone — de propósito (ver
  // `cabecalhoApertado`). O nome continua no `aria-label` e no `title`.
  const botao = page.locator('[data-ja-tratei="tratar"]');
  ok("o cabeçalho oferece “Finalizar”", (await botao.count()) > 0
     && (await botao.first().getAttribute("aria-label").catch(() => "")) === "Finalizar",
     await botao.first().getAttribute("aria-label").catch(() => null));
  ok("e o `title` diz o protocolo que vai ser fechado",
     ((await botao.first().getAttribute("title").catch(() => "")) || "").includes(P.ab));
  ok("o “Voltar para a fila” de antes não aparece", !(await page.locator('[data-ja-tratei="desfazer"]').count()));
  await clicar(page, '[data-ja-tratei="tratar"]');
  await page.waitForTimeout(400);
  const janela = await page.evaluate(() => {
    const j = document.querySelector("[data-ja-tratei-janela]");
    return j ? { modo: j.getAttribute("data-ja-tratei-modo"), texto: j.innerText,
                 protocolo: j.querySelector("[data-ja-tratei-protocolo]")?.getAttribute("data-ja-tratei-protocolo") } : null;
  });
  ok("a janela é a do “Finalizar”", janela && janela.modo === "finalizar" && /^\s*Finalizar/m.test(janela.texto), JSON.stringify(janela && janela.modo));
  ok("e diz o protocolo", janela && janela.protocolo === P.ab, JSON.stringify(janela && janela.protocolo));
  ok("e o que acontece se o cliente escrever de novo", janela && /volta para “Em Atendimento” com um protocolo novo/.test(janela.texto));
  const desligado = await page.locator("[data-ja-tratei-confirmar]").isDisabled().catch(() => null);
  ok("a marcação continua obrigatória: sem assunto, o botão fica desligado", desligado === true);
  await page.locator("[data-assunto-do-ja-tratei] input").first().check().catch(() => {});
  ok("o botão de confirmar diz “Finalizar”",
     ((await page.locator("[data-ja-tratei-confirmar]").textContent().catch(() => "")) || "").trim() === "Finalizar");
  const antesDaConta = await page.evaluate(() => globalThis.__CONTAGENS_DAS_ABAS || 0);
  await gravarFilme(page);
  await clicar(page, "[data-ja-tratei-confirmar]");
  await page.waitForTimeout(1800);

  const b = await banco(page, "cv-ab");
  ok("no banco: a conversa está finalizada, com o mesmo protocolo",
     b.situacao === "finalizado" && b.protocolo === P.ab, JSON.stringify(b));
  ok("o registro ficou preso ao atendimento, e o atendimento fechou",
     b.tratamentos.length === 1 && b.tratamentos[0].atendimento_id === "at-ab"
     && b.atendimentos.find((a) => a.protocolo === P.ab)?.finalizado
     && b.atendimentos.find((a) => a.protocolo === P.ab)?.finalizado_por === "u1", JSON.stringify(b));
  ok("e saiu da fila de espera", b.esperando_desde === null && Boolean(b.tratada_em), JSON.stringify(b));
  const f = await filme(page);
  ok("a faixa diz que finalizou, com o protocolo", f.some((x) => x.startsWith(`Finalizada — protocolo ${P.ab}`)), JSON.stringify(f));
  ok("a conversa saiu de “Em Atendimento”", !(await nomesNaLista(page)).includes(BRUNO));
  ok("e continua aberta à direita, agora com “Reabrir”", (await page.locator('[data-ja-tratei="reabrir"]').count()) > 0
     && (await page.locator('[data-ja-tratei="reabrir"]').first().getAttribute("aria-label").catch(() => "")) === "Reabrir");
  const m = await marcos(page);
  ok("o marco da finalização aparece na conversa, com quem finalizou",
     m.some((x) => x.p === P.ab && x.tipo === "finalizado" && x.texto.includes("finalizado por Rodrigo Sousa")), JSON.stringify(m));
  await page.waitForTimeout(500);
  ok("o número das abas foi pedido de novo ao banco",
     (await page.evaluate(() => globalThis.__CONTAGENS_DAS_ABAS || 0)) > antesDaConta);
  const conta = await contaNoBanco(page, ADV);
  ok("e “Em Atendimento” diz o número de agora", (await numeroDaAba(page, "aberto"))?.n === conta.aberto,
     JSON.stringify([await numeroDaAba(page, "aberto"), conta.aberto]));
  await irParaAba(page, "finalizado");
  ok("em “Finalizados” ela está", (await nomesNaLista(page)).includes(BRUNO));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. O CLIENTE ESCREVE DEPOIS DE FINALIZADO
// ==================================================================
console.log("\nO cliente que escreve depois de finalizado volta para “Em Atendimento”, com protocolo novo");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  ok("(a finalizada abre com “Reabrir”)", (await page.locator('[data-ja-tratei="reabrir"]').count()) > 0);
  let m = await marcos(page);
  ok("e com o marco de quem finalizou — a Jenifer, com o nome de hoje",
     m.some((x) => x.p === P.fz && x.tipo === "finalizado" && x.texto.includes("finalizado por JENIFER ALMEIDA")), JSON.stringify(m));
  // O MARCO VEM NA FRENTE DA MENSAGEM QUE ABRIU O PROTOCOLO: eles têm a mesma
  // hora, e a ordenação estável põe na frente quem entra primeiro na lista.
  const ordem = () => page.evaluate(() => [...document.querySelectorAll("[data-msg-id], [data-marco-do-atendimento]")]
    .map((e) => e.getAttribute("data-marco") ? `${e.getAttribute("data-marco")}:${e.getAttribute("data-marco-do-atendimento")}`
                                              : e.getAttribute("data-msg-id")));
  const aoAbrir = await ordem();
  ok("ao abrir, o marco do protocolo vem logo antes da mensagem que o abriu",
     aoAbrir.indexOf(`aberto:${P.fz}`) >= 0 && aoAbrir[aoAbrir.indexOf(`aberto:${P.fz}`) + 1] === "fz1", JSON.stringify(aoAbrir));
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("cv-fz", "contato", "voltei, preciso de outra guia"));
  await page.waitForTimeout(3000);
  const b = await banco(page, "cv-fz");
  const novo = b.protocolo;
  ok("no banco: em aberto, com um protocolo novo", b.situacao === "aberto" && novo && novo !== P.fz, JSON.stringify(b));
  ok("e a finalização de antes continua registrada", b.atendimentos.find((a) => a.protocolo === P.fz)?.finalizado
     && b.tratamentos.length === 1 && !b.tratamentos[0].desfeito, JSON.stringify(b));
  ok("na tela, ela saiu de “Finalizados”", !(await nomesNaLista(page)).includes(FLAVIA));
  ok("e o cabeçalho voltou a oferecer “Finalizar”", (await page.locator('[data-ja-tratei="tratar"]').count()) > 0);
  m = await marcos(page);
  ok("a conversa mostra os dois: o protocolo finalizado E o novo, aberto pelo cliente",
     m.some((x) => x.p === P.fz && x.tipo === "finalizado")
     && m.some((x) => x.p === novo && x.tipo === "aberto" && x.texto.includes("o cliente escreveu")), JSON.stringify(m));
  const aoReler = await ordem();
  const posNovo = aoReler.indexOf(`aberto:${novo}`);
  ok("e, relidos, o marco do protocolo novo vem logo antes da mensagem que o abriu",
     posNovo >= 0 && String(aoReler[posNovo + 1] || "").startsWith("m-ponte-"), JSON.stringify(aoReler.slice(-4)));
  await irParaAba(page, "aberto");
  ok("e em “Em Atendimento” ela está", (await nomesNaLista(page)).includes(FLAVIA));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // FORA DA LISTA: quem está em "Em Atendimento" não tem a finalizada carregada, e
  // ela tem de aparecer quando o cliente escreve.
  const { ctx, page } = await abrirPainel();
  ok("(em “Em Atendimento”, a finalizada não está)", !(await nomesNaLista(page)).includes(FLAVIA));
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("cv-fz", "contato", "oi de novo"));
  await page.waitForTimeout(3500);
  ok("o cliente escreveu: ela aparece em “Em Atendimento” sem ninguém recarregar", (await nomesNaLista(page)).includes(FLAVIA),
     JSON.stringify((await nomesNaLista(page)).slice(0, 5)));
  await ctx.close();
}

// ==================================================================
//  5. REABRIR PARA CONTINUAR — protocolo novo, e o registro fica
// ==================================================================
console.log("\n“Reabrir para continuar” abre um protocolo novo e não apaga o registro de ninguém");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  const janela = await page.evaluate(() => {
    const j = document.querySelector("[data-reabrir-janela]");
    return j ? { opcoes: [...j.querySelectorAll("[data-reabrir-opcao]")].map((o) => o.getAttribute("data-reabrir-opcao")),
                 protocolo: j.querySelector("[data-reabrir-protocolo]")?.getAttribute("data-reabrir-protocolo"),
                 finalizacao: j.querySelector("[data-reabrir-finalizacao]")?.innerText || "",
                 continuar: j.querySelector('[data-reabrir-opcao="continuar"]')?.innerText || "" } : null;
  });
  ok("a janela tem os dois caminhos, e “continuar” vem primeiro",
     janela && JSON.stringify(janela.opcoes) === JSON.stringify(["continuar", "desfazer"]), JSON.stringify(janela));
  ok("e diz o protocolo, e quem finalizou", janela && janela.protocolo === P.fz && janela.finalizacao.includes("JENIFER ALMEIDA"),
     JSON.stringify(janela));
  ok("e para qual aba a conversa volta, pelo nome de hoje", janela && /volta para “Em Atendimento” com um protocolo novo/.test(janela.continuar),
     JSON.stringify(janela && janela.continuar));
  await gravarFilme(page);
  await clicar(page, '[data-reabrir-opcao="continuar"]');
  await page.waitForTimeout(1800);
  const b = await banco(page, "cv-fz");
  const reaberto = b.atendimentos.find((a) => a.origem === "reabertura");
  ok("no banco: em aberto, com um protocolo NOVO aberto por quem reabriu",
     b.situacao === "aberto" && b.protocolo !== P.fz && reaberto && reaberto.protocolo === b.protocolo && reaberto.aberto_por === "u1",
     JSON.stringify(b));
  ok("o atendimento de antes continua finalizado, e o registro dele não foi desfeito",
     b.atendimentos.find((a) => a.protocolo === P.fz)?.finalizado && b.tratamentos.length === 1 && !b.tratamentos[0].desfeito,
     JSON.stringify(b));
  ok("a faixa diz o protocolo novo", (await filme(page)).some((x) => x.startsWith(`Reaberta, com o protocolo ${b.protocolo}`)),
     JSON.stringify(await filme(page)));
  ok("a janela fechou", !(await page.locator("[data-reabrir-janela]").count()));
  const m = await marcos(page);
  ok("o marco diz quem reabriu", m.some((x) => x.p === b.protocolo && x.texto.includes("reaberto por Rodrigo Sousa")), JSON.stringify(m));
  ok("ela saiu de “Finalizados”", !(await nomesNaLista(page)).includes(FLAVIA));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

{
  // A CORRIDA: a janela do Reabrir está aberta, e o cliente escreve antes do
  // clique. A conversa já voltou para "Em Atendimento" com um protocolo novo, e o
  // Reabrir não pode dizer que reabriu — nem abrir um terceiro.
  const { ctx, page } = await abrirPainel();
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("cv-fz", "contato", "oi, ainda estão aí?"));
  await page.waitForTimeout(400);
  await gravarFilme(page);
  await clicar(page, '[data-reabrir-opcao="continuar"]');
  await page.waitForSelector("[data-reabrir-janela]", { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  const b = await banco(page, "cv-fz");
  ok("o cliente escreveu com a janela aberta: nenhum protocolo de reabertura",
     b.atendimentos.length === 2 && !b.atendimentos.some((a) => a.origem === "reabertura"), JSON.stringify(b.atendimentos));
  const f = await filme(page);
  ok("e a faixa diz que ela já não estava finalizada, e não que reabriu",
     f.some((x) => x.startsWith("Ela já não estava finalizada")) && !f.some((x) => x.startsWith("Reaberta")), JSON.stringify(f));
  await ctx.close();
}

// ==================================================================
//  6. DESFAZER — o mesmo protocolo, e a espera ORIGINAL volta
// ==================================================================
console.log("\n“Desfazer a finalização” reabre o MESMO protocolo e devolve a espera original");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await gravarFilme(page);
  await clicar(page, '[data-reabrir-opcao="desfazer"]');
  // O DESFAZER SÃO QUATRO IDAS AO BANCO (o clique, a releitura, a fila de
  // espera, a releitura de novo), e a bancada põe 700 ms em cada leitura de
  // conversa: espera-se a janela fechar, e não um tempo fixo.
  await page.waitForSelector("[data-reabrir-janela]", { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const b = await banco(page, "cv-fz");
  ok("no banco: em aberto, com o MESMO protocolo", b.situacao === "aberto" && b.protocolo === P.fz, JSON.stringify(b));
  ok("o registro foi marcado como desfeito, por quem desfez",
     b.tratamentos.length === 1 && b.tratamentos[0].desfeito && b.tratamentos[0].desfeito_por === "u1", JSON.stringify(b.tratamentos));
  ok("e o atendimento voltou a ficar aberto", b.atendimentos.find((a) => a.protocolo === P.fz)?.finalizado === false, JSON.stringify(b));
  // A CONFERÊNCIA QUE PEGA O DEFEITO MAIS CARO, a mesma de `o-ja-tratei`: a
  // espera que volta é a DE ANTES (o "obrigada" de 28 horas atrás), e não
  // "agora" — a conversa voltaria à fila com zero dia.
  ok("a espera ORIGINAL voltou: desde o “obrigada” de 28 horas atrás",
     b.esperando_desde && Math.abs(new Date(b.esperando_desde).getTime() - new Date(H(28)).getTime()) < 1000 && b.tratada_em === null,
     JSON.stringify([b.esperando_desde, H(28), b.tratada_em]));
  ok("a faixa diz que voltou com o mesmo protocolo",
     (await filme(page)).some((x) => x.startsWith("Desfeito: a conversa voltou para “Em Atendimento”, com o mesmo protocolo.")),
     JSON.stringify(await filme(page)));
  const m = await marcos(page);
  ok("o marco da finalização sumiu da conversa, e o da abertura ficou",
     !m.some((x) => x.p === P.fz && x.tipo === "finalizado") && m.some((x) => x.p === P.fz && x.tipo === "aberto"), JSON.stringify(m));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

{
  // DOIS PROTOCOLOS, DOIS CLIQUES: o desfazer é do ÚLTIMO, e o "Finalizar" de
  // verdade do protocolo de antes continua contando no relatório.
  const GB = contato("ct-gb", "5511970002277", "GABRIEL DOS DOIS PROTOCOLOS");
  const extra = {
    contatos: [GB],
    conversas: [conversa("cv-gb", ADV, GB, { situacao: "finalizado", protocolo: "2026-000981",
      ultima_atividade: H(35), ultima_mensagem: "obrigado", tratada_em: H(30) })],
    mensagens: [msg("gb1", "cv-gb", "contato", "Preciso de ajuda", H(60)), msg("gb2", "cv-gb", "advogado", "Pronto.", H(58)),
                msg("gb3", "cv-gb", "contato", "Voltei", H(40)), msg("gb4", "cv-gb", "advogado", "Resolvido.", H(39)),
                msg("gb5", "cv-gb", "contato", "obrigado", H(35))],
    zorvin_atendimentos: [
      { id: "at-gb1", protocolo: "2026-000980", conversa_id: "cv-gb", aberto_em: H(60), origem: "cliente", aberto_por: null,
        primeira_resposta_em: H(58), finalizado_em: H(55), finalizado_por: "u-isabela" },
      { id: "at-gb2", protocolo: "2026-000981", conversa_id: "cv-gb", aberto_em: H(40), origem: "cliente", aberto_por: null,
        primeira_resposta_em: H(39), finalizado_em: H(30), finalizado_por: "u-jenifer" }],
    zorvin_tratamentos: [
      { id: "tr-gb1", conversa_id: "cv-gb", assunto_id: null, quem: "u-isabela", quando: H(55), esperava_desde: null,
        desfeito_em: null, desfeito_por: null, atendimento_id: "at-gb1" },
      { id: "tr-gb2", conversa_id: "cv-gb", assunto_id: null, quem: "u-jenifer", quando: H(30), esperava_desde: H(35),
        desfeito_em: null, desfeito_por: null, atendimento_id: "at-gb2" }],
  };
  const { ctx, page } = await abrirPainel({ extra });
  await irParaAba(page, "finalizado");
  await abrirConversa(page, "GABRIEL DOS DOIS PROTOCOLOS");
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await clicar(page, '[data-reabrir-opcao="desfazer"]');
  await page.waitForSelector("[data-reabrir-janela]", { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const b = await banco(page, "cv-gb");
  const porId = await page.evaluate(() => Object.fromEntries((globalThis.__TABELAS.zorvin_tratamentos || [])
    .filter((t) => t.conversa_id === "cv-gb").map((t) => [t.id, Boolean(t.desfeito_em)])));
  ok("dois protocolos: só o clique do último foi desfeito", porId["tr-gb2"] === true && porId["tr-gb1"] === false, JSON.stringify(porId));
  ok("e a conversa voltou para “Em Atendimento” com o protocolo do último", b.situacao === "aberto" && b.protocolo === "2026-000981",
     JSON.stringify(b));
  await ctx.close();
}
{
  // DUAS COLEGAS FINALIZARAM O MESMO PROTOCOLO: desfeito o último clique, a
  // conversa continua finalizada pelo outro, e a frase diz isso.
  const HL = contato("ct-hl", "5511970002266", "HELENA DAS DUAS COLEGAS");
  const extra = {
    contatos: [HL],
    conversas: [conversa("cv-hl", ADV, HL, { situacao: "finalizado", protocolo: "2026-000985",
      ultima_atividade: H(28), ultima_mensagem: "ok", tratada_em: H(26.5) })],
    mensagens: [msg("hl1", "cv-hl", "contato", "Bom dia", H(30)), msg("hl2", "cv-hl", "advogado", "Bom dia!", H(29)),
                msg("hl3", "cv-hl", "contato", "ok", H(28))],
    zorvin_atendimentos: [{ id: "at-hl", protocolo: "2026-000985", conversa_id: "cv-hl", aberto_em: H(30), origem: "cliente",
      aberto_por: null, primeira_resposta_em: H(29), finalizado_em: H(27), finalizado_por: "u-jenifer" }],
    zorvin_tratamentos: [
      { id: "tr-hl1", conversa_id: "cv-hl", assunto_id: null, quem: "u-jenifer", quando: H(27), esperava_desde: H(28),
        desfeito_em: null, desfeito_por: null, atendimento_id: "at-hl" },
      { id: "tr-hl2", conversa_id: "cv-hl", assunto_id: null, quem: "u-isabela", quando: H(26.5), esperava_desde: H(28),
        desfeito_em: null, desfeito_por: null, atendimento_id: "at-hl" }],
  };
  const { ctx, page } = await abrirPainel({ extra });
  await irParaAba(page, "finalizado");
  await abrirConversa(page, "HELENA DAS DUAS COLEGAS");
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await gravarFilme(page);
  await clicar(page, '[data-reabrir-opcao="desfazer"]');
  await page.waitForSelector("[data-reabrir-janela]", { state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const b = await banco(page, "cv-hl");
  ok("duas colegas no mesmo protocolo: desfeito o último, ela continua finalizada", b.situacao === "finalizado", JSON.stringify(b));
  ok("e a faixa diz que outro registro a mantém finalizada",
     (await filme(page)).some((x) => x.startsWith("Desfiz o último registro, mas a conversa continua finalizada")),
     JSON.stringify(await filme(page)));
  ok("e ela não volta para a fila de espera", b.esperando_desde === null, JSON.stringify(b));
  await ctx.close();
}

// ==================================================================
//  7. O BANCO QUE RECUSA É DITO
// ==================================================================
console.log("\nO banco que recusa é dito, e a tela não finge ter mudado de aba");
{
  // Reabrir recusado calado (a regra de acesso esconde a linha).
  const { ctx, page } = await abrirPainel({ semEfeito: ["conversas"] });
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await clicar(page, '[data-reabrir-opcao="continuar"]');
  await page.waitForTimeout(1500);
  const erro = await page.evaluate(() => document.querySelector("[data-reabrir-erro]")?.innerText || "");
  ok("recusado calado: a janela diz que o banco não deixou", erro.includes("O banco não deixou reabrir"), erro);
  const b = await banco(page, "cv-fz");
  ok("e nada mudou no banco — nem um protocolo órfão",
     b.situacao === "finalizado" && b.protocolo === P.fz && b.atendimentos.length === 1, JSON.stringify(b));
  ok("e a conversa continua em “Finalizados”", (await nomesNaLista(page)).includes(FLAVIA));
  await ctx.close();
}
{
  // Reabrir recusado COM erro: a frase leva o código.
  const { ctx, page } = await abrirPainel({ erro: { conversas: { code: "42501", message: "permission denied for table conversas" } } });
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await clicar(page, '[data-reabrir-opcao="continuar"]');
  await page.waitForTimeout(1500);
  const erro = await page.evaluate(() => document.querySelector("[data-reabrir-erro]")?.innerText || "");
  ok("recusado com erro: a janela diz que não reabriu, com o código", erro.includes("Não consegui reabrir") && erro.includes("42501"), erro);
  await ctx.close();
}
{
  // Finalizar com o registro recusado.
  const { ctx, page } = await abrirPainel({ erro: { zorvin_tratamentos: { code: "42501", message: "new row violates row-level security policy" } } });
  await abrirConversa(page, BRUNO);
  await clicar(page, '[data-ja-tratei="tratar"]');
  await page.waitForTimeout(400);
  await page.locator("[data-assunto-do-ja-tratei] input").first().check().catch(() => {});
  await clicar(page, "[data-ja-tratei-confirmar]");
  await page.waitForTimeout(1500);
  const erro = await page.evaluate(() => document.querySelector("[data-ja-tratei-erro]")?.innerText || "");
  ok("o registro recusado: a janela diz que NÃO finalizou, com o código",
     erro.includes("A conversa não foi finalizada") && erro.includes("42501"), erro);
  const b = await banco(page, "cv-ab");
  ok("e o banco continua com ela em aberto", b.situacao === "aberto" && b.tratamentos.length === 0, JSON.stringify(b));
  await ctx.close();
}
{
  // Desfazer recusado calado.
  const { ctx, page } = await abrirPainel({ semEfeito: ["zorvin_tratamentos"] });
  await irParaAba(page, "finalizado");
  await abrirConversa(page, FLAVIA);
  await clicar(page, '[data-ja-tratei="reabrir"]');
  await page.waitForTimeout(400);
  await clicar(page, '[data-reabrir-opcao="desfazer"]');
  await page.waitForTimeout(1500);
  const erro = await page.evaluate(() => document.querySelector("[data-reabrir-erro]")?.innerText || "");
  ok("o desfazer recusado é dito", erro.includes("O banco não deixou desfazer"), erro);
  const b = await banco(page, "cv-fz");
  ok("e ela continua finalizada", b.situacao === "finalizado" && !b.tratamentos[0]?.desfeito, JSON.stringify(b));
  await ctx.close();
}

{
  // O GATILHO QUE DESISTE CALADO: o registro entra, e a conversa NÃO é
  // finalizada. A tela relê a linha, e diz o que o banco fez — e não o que se
  // esperava que ele fizesse.
  const { ctx, page } = await abrirPainel({ cliqueNaoFinaliza: true });
  await abrirConversa(page, BRUNO);
  await clicar(page, '[data-ja-tratei="tratar"]');
  await page.waitForTimeout(400);
  await page.locator("[data-assunto-do-ja-tratei] input").first().check().catch(() => {});
  await gravarFilme(page);
  await clicar(page, "[data-ja-tratei-confirmar]");
  await page.waitForTimeout(2000);
  const b = await banco(page, "cv-ab");
  ok("(o registro entrou, e o banco não finalizou)", b.tratamentos.length === 1 && b.situacao === "aberto", JSON.stringify(b));
  ok("a faixa diz que o banco não finalizou, e não “Finalizada”",
     (await filme(page)).some((x) => x.startsWith("Registrei o que foi tratado, mas o banco não finalizou"))
     && !(await filme(page)).some((x) => x.startsWith("Finalizada")), JSON.stringify(await filme(page)));
  ok("e ela continua em “Em Atendimento”, com “Finalizar”", (await nomesNaLista(page)).includes(BRUNO)
     && (await page.locator('[data-ja-tratei="tratar"]').count()) > 0);
  await ctx.close();
}

// ==================================================================
//  8. A BUSCA ATRAVESSA AS ABAS
// ==================================================================
console.log("\nA busca procura nas três abas, e a linha diz em qual cada conversa mora");
{
  const { ctx, page } = await abrirPainel();
  ok("(em “Em Atendimento”, a finalizada não está)", !(await nomesNaLista(page)).includes(FLAVIA));
  await page.locator('input[placeholder^="Buscar por nome"]').fill("FLAVIA DA");
  await page.waitForTimeout(2500);
  const linha = await page.evaluate((n) => {
    const l = [...document.querySelectorAll("[data-conversa-nome]")].find((e) => e.getAttribute("data-conversa-nome") === n);
    return l ? { selo: l.querySelector("[data-selo-da-situacao]")?.textContent || null } : null;
  }, FLAVIA);
  ok("buscando, a finalizada aparece", Boolean(linha), JSON.stringify(await nomesNaLista(page)));
  ok("e a linha diz em qual aba ela mora — pelo nome da aba", linha && linha.selo === "Finalizados", JSON.stringify(linha));
  await page.locator('input[placeholder^="Buscar por nome"]').fill("BRUNO DO");
  await page.waitForTimeout(2500);
  const doBruno = await page.evaluate((n) => {
    const l = [...document.querySelectorAll("[data-conversa-nome]")].find((e) => e.getAttribute("data-conversa-nome") === n);
    return l ? Boolean(l.querySelector("[data-selo-da-situacao]")) : null;
  }, BRUNO);
  ok("a da própria aba não ganha selo — repetir o que a aba já diz é ruído", doBruno === false, String(doBruno));
  await page.locator('input[placeholder^="Buscar por nome"]').fill("");
  await page.waitForTimeout(1500);
  ok("apagada a busca, a finalizada volta para a aba dela", !(await nomesNaLista(page)).includes(FLAVIA));
  await ctx.close();
}

// ==================================================================
//  9. SEM O SCRIPT 028, TUDO COMO ANTES
// ==================================================================
console.log("\nSem o script 028: sem abas, sem protocolo, e o “Já tratei” de sempre");
{
  const { ctx, page, estouros } = await abrirPainel({ semSituacao: true });
  ok("não há abas", !(await page.locator("[data-abas-da-situacao]").count()));
  const nomes = await nomesNaLista(page);
  ok("a lista mostra todas as conversas juntas, como antes", nomes.includes(ALICE) && nomes.includes(BRUNO) && nomes.includes(FLAVIA),
     JSON.stringify(nomes.slice(0, 8)));
  await abrirConversa(page, BRUNO);
  const botao = page.locator('[data-ja-tratei="tratar"]');
  ok("o botão é o “Já tratei” de sempre", (await botao.count()) > 0
     && (await botao.first().getAttribute("aria-label").catch(() => "")) === "Já tratei",
     await botao.first().getAttribute("aria-label").catch(() => null));
  ok("e não há marco de protocolo nenhum", (await marcos(page)).length === 0);
  const faixa = await page.evaluate(() => document.querySelector("[data-falha-de-leitura]")?.innerText || "");
  ok("e a tabela que não existe não acende a faixa âmbar", !faixa.includes("protocolos"), faixa);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  10. NA PASTA DE ARQUIVADAS NÃO HÁ ABA
// ==================================================================
console.log("\nNa pasta de arquivadas não há aba: lá moram as arquivadas das três");
{
  const extra = {
    contatos: [contato("ct-arq", "5511970002299", "ARMANDO ARQUIVADO")],
    conversas: [conversa("cv-arq", ADV, contato("ct-arq", "5511970002299", "ARMANDO ARQUIVADO"),
      { situacao: "finalizado", protocolo: "2026-000950", arquivada: true, ultima_atividade: H(40), ultima_mensagem: "ok" })],
    mensagens: [msg("arq1", "cv-arq", "contato", "ok", H(40))],
  };
  const { ctx, page } = await abrirPainel({ extra });
  const atalho = page.locator('[role="button"]', { hasText: "Arquivadas" });
  ok("(há o atalho das arquivadas)", (await atalho.count()) > 0);
  if (await atalho.count()) { await atalho.first().click().catch(() => {}); await page.waitForTimeout(2000); }
  ok("dentro da pasta, as abas somem", !(await page.locator("[data-abas-da-situacao]").count()));
  ok("e a arquivada finalizada está lá, mesmo com “Em Atendimento” escolhido antes",
     (await nomesNaLista(page)).includes("ARMANDO ARQUIVADO"), JSON.stringify(await nomesNaLista(page)));
  await ctx.close();
}

// ==================================================================
//  11. O TEMPO REAL: um colega finaliza, um colega reabre
// ==================================================================
console.log("\nO tempo real: o que um colega finaliza sai da aba, e o que ele reabre entra");
{
  const { ctx, page } = await abrirPainel();
  ok("(o Bruno está em “Em Atendimento”)", (await nomesNaLista(page)).includes(BRUNO));
  const antes = await page.evaluate(() => globalThis.__CONTAGENS_DAS_ABAS || 0);
  // A JENIFER FINALIZA, noutro painel: o banco muda e o aviso chega.
  await page.evaluate((p) => {
    const T = globalThis.__TABELAS;
    const c = T.conversas.find((x) => x.id === "cv-ab");
    c.situacao = "finalizado"; c.esperando_desde = null; c.tratada_em = new Date().toISOString();
    const a = T.zorvin_atendimentos.find((x) => x.protocolo === p);
    a.finalizado_em = new Date().toISOString(); a.finalizado_por = "u-jenifer";
    const { contato, ...linha } = c;
    globalThis.__EMITIR("UPDATE", "conversas", { ...linha });
  }, P.ab);
  await page.waitForTimeout(3500);
  ok("o que a colega finalizou sai de “Em Atendimento” na hora", !(await nomesNaLista(page)).includes(BRUNO));
  ok("e o número das abas é pedido de novo", (await page.evaluate(() => globalThis.__CONTAGENS_DAS_ABAS || 0)) > antes);

  // E A JENIFER REABRE A FLAVIA, que não está nesta lista.
  ok("(a Flavia não está em “Em Atendimento”)", !(await nomesNaLista(page)).includes(FLAVIA));
  await page.evaluate(() => {
    const T = globalThis.__TABELAS;
    const c = T.conversas.find((x) => x.id === "cv-fz");
    c.situacao = "aberto"; c.protocolo = "2026-000960";
    T.zorvin_atendimentos.push({ id: "at-re", protocolo: "2026-000960", conversa_id: "cv-fz", aberto_em: new Date().toISOString(),
      origem: "reabertura", aberto_por: "u-jenifer", primeira_resposta_em: null, finalizado_em: null, finalizado_por: null });
    const { contato, ...linha } = c;
    globalThis.__EMITIR("UPDATE", "conversas", { ...linha });
  });
  await page.waitForTimeout(3500);
  ok("o que a colega reabriu entra em “Em Atendimento” sem ninguém recarregar", (await nomesNaLista(page)).includes(FLAVIA),
     JSON.stringify((await nomesNaLista(page)).slice(0, 5)));
  await ctx.close();
}

{
  // A MENSAGEM DE UMA CONVERSA DE OUTRA ABA NÃO RELÊ A LISTA. Ela não está na
  // lista de propósito — a lista vem do banco recortada pela aba —, e reler a
  // página a cada mensagem de qualquer conversa das outras duas abas seria a
  // tela "recarregando sozinha", que esta casa já consertou uma vez.
  //
  // A MARCA DA RELEITURA É A CONSULTA DAS FIXADAS, que toda leitura da
  // primeira página faz — e nada mais faz. Contar as idas a `conversas` não
  // serve: o aviso de mensagem nova já pergunta pelo dono e pela conversa, e
  // eu escrevi "no máximo 2" sem medir, e a primeira rodada mediu 4 sem
  // releitura nenhuma.
  const { ctx, page } = await abrirPainel();
  await page.waitForTimeout(800);
  await page.evaluate(() => { globalThis.__DIARIO = []; });
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("cv-ag", "contato", "ainda estou esperando"));
  await page.waitForTimeout(3500);
  const releituras = await page.evaluate(() => (globalThis.__DIARIO || [])
    .filter((x) => x.tabela === "conversas" && (x.pedidos || []).includes("fixada")).length);
  const pediuAConversa = await page.evaluate(() => (globalThis.__DIARIO || [])
    .some((x) => x.tabela === "conversas" && /situacao/.test(x.colunas || "")));
  await page.evaluate(() => { globalThis.__DIARIO = null; });
  ok("(o aviso perguntou ao banco de quem é a conversa, e em qual aba ela está)", pediuAConversa);
  ok("a mensagem nova numa conversa de “Novos” não relê a lista de “Em Atendimento”", releituras === 0,
     `${releituras} releitura(s) da lista`);
  ok("(e ela continua fora de “Em Atendimento”)", !(await nomesNaLista(page)).includes(ALICE));
  await ctx.close();
}

// ==================================================================
//  12. NO CELULAR
// ==================================================================
console.log("\nNo celular: as abas cabem, com alvo de dedo, e o “Finalizar” mora no ⋮");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  const medidas = await page.evaluate(() => [...document.querySelectorAll("[data-aba-da-situacao]")].map((b) => {
    const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), corta: b.scrollWidth > b.clientWidth + 1 };
  }));
  ok("as três abas estão lá", medidas.length === 3, JSON.stringify(medidas));
  ok("com 40px de alvo de dedo", medidas.every((m) => m.h >= 40), JSON.stringify(medidas));
  ok("e nenhuma corta o próprio rótulo", medidas.every((m) => !m.corta), JSON.stringify(medidas));
  await abrirConversa(page, BRUNO);
  await clicar(page, '[aria-label="Mais opções desta conversa"]');
  await page.waitForTimeout(400);
  const item = page.locator('[data-ja-tratei="tratar"]');
  ok("no ⋮, o item “Finalizar”, escrito", (await item.count()) > 0 && ((await item.first().textContent()) || "").includes("Finalizar"),
     await item.first().textContent().catch(() => null));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  12a. A ABA VAZIA DIZ QUAL É A ABA, E O QUE MORA NELA
// ==================================================================
console.log("\nA aba vazia diz o que mora nela, pelo nome de hoje");
{
  // A ALICE, a única que ninguém atendeu, passa a ter sido atendida: "Novos"
  // fica vazia.
  const { ctx, page, estouros } = await abrirPainel({ ajustar: (s) => {
    s.conversas.find((c) => c.id === "cv-ag").situacao = "aberto";
  } });
  await irParaAba(page, "aguardando");
  const recado = await page.evaluate(() => {
    const r = document.querySelector("[data-recado-da-lista]");
    return r ? { tipo: r.getAttribute("data-recado-da-lista"), texto: (r.innerText || "").trim() } : null;
  });
  ok("“Novos” vazia diz que não há cliente novo, e o que mora ali",
     recado && recado.tipo === "sem-conversa-aguardando"
     && recado.texto === "Nenhum cliente novo. Aqui ficam os clientes que a equipe ainda não atendeu.", JSON.stringify(recado));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  12b. OS NOMES CABEM — com os números do escritório
//
//  "Em Atendimento" é o nome mais comprido das três, e com o número das
//  conversas que ninguém finalizou (passa de mil no escritório) ele não cabe
//  num terço da fileira: 118px contra 109 no computador, 107 contra 89 num
//  Android de 360. Com os poucos números da bancada a conta não aparece, e é
//  por isso que esta cena força os de verdade.
// ==================================================================
console.log("\nOs nomes cabem inteiros, com os números do escritório (mil e tantas em atendimento)");
{
  const GRANDE = { aguardando: 214, aberto: 1523, finalizado: 900, nao_lidas: { aguardando: 12, aberto: 181, finalizado: 3 } };
  for (const [largura, altura] of [[1360, 900], [390, 844], [360, 740]]) {
    const { ctx, page, estouros } = await abrirPainel({ largura, altura, contagem: GRANDE });
    const m = await page.evaluate(() => {
      const f = document.querySelector("[data-abas-da-situacao]");
      const abas = [...document.querySelectorAll("[data-aba-da-situacao]")];
      return f ? { fileiraCabe: f.scrollWidth <= f.clientWidth + 1,
                   abasCabem: abas.every((b) => b.scrollWidth <= b.clientWidth + 1),
                   rotulos: abas.map((b) => (b.innerText || "").replace(/\s+/g, " ").trim()),
                   paginaDeLado: document.documentElement.scrollWidth > innerWidth + 1 } : null;
    });
    ok(`a ${largura}px, os três nomes inteiros, com os números`,
       Boolean(m) && JSON.stringify(m.rotulos) === JSON.stringify(["Novos 214", "Em Atendimento 1523", "Finalizados"]), JSON.stringify(m));
    ok(`a ${largura}px, nenhuma aba corta o nome, e a fileira cabe na coluna`, Boolean(m) && m.abasCabem && m.fileiraCabe, JSON.stringify(m));
    ok(`a ${largura}px, a página não rola de lado`, Boolean(m) && !m.paginaDeLado, JSON.stringify(m));
    ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
    await ctx.close();
  }
}

// ==================================================================
//  13. OS MARCOS SÓ NO TRECHO QUE ESTÁ NA TELA
// ==================================================================
console.log("\nOs marcos de um protocolo antigo só aparecem junto das mensagens dele");
{
  // 130 MENSAGENS, e a conversa abre com as 120 últimas. O primeiro protocolo
  // abriu e fechou nas primeiras dez: desenhá-lo no alto da janela diria que
  // ele começou logo antes das mensagens desta semana.
  const LONGA = contato("ct-longa", "5511970002288", "LUCAS DA CONVERSA LONGA");
  const ms = [];
  for (let i = 0; i < 130; i++) {
    ms.push(msg(`lg${i}`, "cv-longa", i % 2 ? "advogado" : "contato", `mensagem ${i}`, H(200 - i)));
  }
  const extra = {
    contatos: [LONGA],
    conversas: [conversa("cv-longa", ADV, LONGA, { situacao: "aberto", protocolo: "2026-000971", fixada: true,
      ultima_atividade: H(71), ultima_mensagem: "mensagem 129" })],
    mensagens: ms,
    zorvin_atendimentos: [
      { id: "at-lg1", protocolo: "2026-000970", conversa_id: "cv-longa", aberto_em: H(200), origem: "cliente", aberto_por: null,
        primeira_resposta_em: H(199), finalizado_em: H(195.5), finalizado_por: "u-jenifer" },
      { id: "at-lg2", protocolo: "2026-000971", conversa_id: "cv-longa", aberto_em: H(194), origem: "cliente", aberto_por: null,
        primeira_resposta_em: H(193), finalizado_em: null, finalizado_por: null },
    ],
    // UMA RESPOSTA AUTOMÁTICA E UMA NOTA DE ANTES DA JANELA. As duas são lidas
    // inteiras na abertura, e as duas eram armadilha das mensagens anteriores:
    // a resposta automática virava o ponto de partida (e pulava o que ficava
    // entre ela e a janela), e a nota ficava fora da ordem do tempo.
    zorvin_respostas_automaticas: [{ id: "ra-lg", conversa_id: "cv-longa", texto: "Recebemos sua mensagem.",
      status: "enviada", erro: null, criada_em: H(199.5), enviada_em: H(199.5), ate: null }],
    notas: [{ id: "nt-lg", conversa_id: "cv-longa", texto: "Ligar depois das 18h", autor: "Rodrigo Sousa", autor_id: "u1",
      autor_foto: null, editada_em: null, editada_por: null, apagada_em: null, apagada_por: null, apagada_por_id: null,
      criado_em: H(197.5) }],
  };
  const { ctx, page, estouros } = await abrirPainel({ extra });
  await abrirConversa(page, "LUCAS DA CONVERSA LONGA");
  ok("ao abrir, nenhum marco de fora da janela", (await marcos(page)).length === 0, JSON.stringify(await marcos(page)));
  const botao = page.locator("button", { hasText: "Carregar mensagens anteriores" });
  ok("(há as mensagens anteriores por carregar)", (await botao.count()) > 0);
  if (await botao.count()) { await botao.first().click().catch(() => {}); await page.waitForTimeout(2000); }
  // PELO ID DA BOLHA, e não pelo texto: a bolha da equipe começa pelo nome de
  // quem escreveu.
  const ordem = await page.evaluate(() => [...document.querySelectorAll("[data-msg-id], [data-marco-do-atendimento]")]
    .map((e) => e.getAttribute("data-marco") ? `${e.getAttribute("data-marco")}:${e.getAttribute("data-marco-do-atendimento")}`
                                              : e.getAttribute("data-msg-id")).slice(0, 13));
  ok("carregadas as anteriores, os marcos entram no lugar deles, na ordem do tempo",
     JSON.stringify(ordem) === JSON.stringify(["aberto:2026-000970", "lg0", "auto-ra-lg", "lg1", "lg2", "nota-nt-lg", "lg3", "lg4",
                                               "finalizado:2026-000970", "lg5", "aberto:2026-000971", "lg6", "lg7"]),
     JSON.stringify(ordem));
  const todas = await page.evaluate(() => [...document.querySelectorAll("[data-msg-id]")].map((e) => e.getAttribute("data-msg-id"))
    .filter((id) => /^lg\d+$/.test(id)));
  ok("e nenhuma mensagem ficou para trás — as 130 estão na tela", todas.length === 130, `${todas.length} na tela`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
