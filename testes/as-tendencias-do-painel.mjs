// AS TENDÊNCIAS DO PAINEL (06/11) — a seção que ajuda a decidir
//
// Pedido do Rodrigo: "Sinto que ainda está muito básico, quero algo
// profissional, um dashboard inteligente e interativo de verdade, com
// informações que ajudem a estudar os números, fazer uma boa gestão e tomar
// as melhores decisões."
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   0. as contas sem tela (`src/tendencias.js`): o fluxo com e sem o 052, o
//      prazo do dia sem zero inventado, a hora que mais precisa de gente (só
//      com casos bastantes), a faísca que junta pela razão das somas, e o
//      aviso de quando os registros vieram cortados;
//   1. A FILA: a frase do fluxo com os números da semente, uma coluna por dia
//      do período, empilhada no que aconteceu com cada protocolo, a leitura
//      do mouse com todas as séries, e a tabela;
//   2. O PRAZO DIA A DIA: a frase com o pior dia, a régua do período, e o dia
//      sem cliente para julgar sem número (e não zero);
//   3. O PRAZO POR HORA: a hora que mais precisa de gente, e a hora de poucos
//      casos mais clara;
//   4. O CLIQUE NUM DIA recorta a tela inteira, pelo mouse e pelo teclado, e
//      a barra oferece a volta;
//   5. AS FAÍSCAS nos cartões da Visão geral;
//   6. a pessoa escolhida sem o prazo (ele é da equipe), e o banco sem o 052;
//   7. o tema escuro com as cores dele, o celular a 360 e a 390 sem rolar de
//      lado, e o papel (a seção vai, e sai quando desmarcada);
//   8. nenhuma ida a mais ao banco.
//
// A SEMENTE (no telefone a5, o Sucesso do Cliente da bancada, prazo de 30
// minutos; AGORA fixo às 18h de hoje, em São Paulo), feita à mão:
//   há 10 dias, 09h: 3 clientes, respondidos em 10 min e finalizados (no prazo)
//   há  5 dias, 14h: 6 clientes — 1 respondido em 10 min, 5 em 50 min (fora)
//   há  4 dias, 20h: 1 cliente respondido em 10 min (no prazo)
//   há  3 dias, 11h: 1 conversa que a EQUIPE abriu (sem prazo)
//   há  2 dias, 09h: 4 clientes — 3 em 10 min, 1 em 60 min; 2 finalizados
//   há  1 dia,  14h: 2 clientes sem resposta (prazo vencido)
//   hoje,      17h50: 1 cliente sem resposta (ainda no prazo)
// O QUE DÁ:
//   entraram 18; começados 15; finalizados 5 (28%); abertos 13; sem resposta
//   3; o dia de mais entrada: há 5 dias, com 6;
//   o prazo: 8 de 16 no prazo, 50%; o pior dia (com 3 ou mais): há 5 dias,
//   17% (1 de 6); o dia de ontem: 0 de 2;
//   por hora: 09h 6 de 7 (86%), 14h 1 de 8 (13%), 20h 1 de 1 (poucos casos);
//   a hora que mais precisa de gente: 14h.
import { abrirNavegador, abrirATela } from "./navegador.mjs";
import { fluxoPorDia, resumoDoFluxo, prazoPorDia, prazoDoPeriodo, prazoPorHora, piorHora, pontosDaFaisca, diasDoPeriodo }
  from "../src/tendencias.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (x) => JSON.stringify(x);

// O FILTRO DE CENAS, para as sabotagens: `CENAS=1,4` roda só as pedidas. Uma
// cena pedida que não existe reprova (um erro de digitação não pode terminar
// verde sem ter rodado nada).
const CENAS = (process.env.CENAS || "").split(",").map((s) => s.trim()).filter(Boolean);
const cenasDaProva = new Set();
const vale = (c) => { cenasDaProva.add(c); return !CENAS.length || CENAS.includes(c); };

const HOJE_EM_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(Date.now());
const AGORA = Date.parse(`${HOJE_EM_SP}T18:00:00-03:00`);
/** O dia de `k` dias atrás, em São Paulo (AAAA-MM-DD). */
const diaSP = (k) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(AGORA - k * 86400e3 + 3600e3 * 0);
/** `k` dias atrás, às hh:mm de São Paulo. */
const em = (k, hh, mm = 0) => new Date(Date.parse(`${diaSP(k)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`)).toISOString();
const M = (iso, min) => new Date(new Date(iso).getTime() + min * 60e3).toISOString();
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaLongo = (k) => { const s = diaSP(k); const d = new Date(`${s}T12:00:00`); return `${SEMANA[d.getDay()]}, ${s.slice(8, 10)}/${MESES[Number(s.slice(5, 7)) - 1]}`; };

const TEL = "a5";
const EU = "u1", JEN = "u-jenifer";

function semente() {
  const cts = [], cvs = [], msgs = [], ats = [];
  let n = 0;
  const proto = (k, { aberto, origem = "cliente", resposta = null, por = EU, fim = null, espera = null }) => {
    n++;
    const ct = { id: `ct-td-${k}`, numero: `5511972${String(100000 + n)}`, nome: `CLIENTE ${k}`, vantoro_nome: null,
                 nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
    cts.push(ct);
    const p = `2026-0011${String(n).padStart(2, "0")}`;
    cvs.push({ id: `cv-td-${k}`, advogado_id: TEL, contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false,
               favorita: false, frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: fim,
               esperando_desde: espera, situacao: fim ? "finalizado" : resposta || origem !== "cliente" ? "aberto" : "aguardando",
               protocolo: p, ultima_atividade: resposta || fim || aberto, ultima_mensagem: "oi",
               responsavel_id: resposta ? por : null, responsavel_em: resposta ? aberto : null, responsavel_por: resposta ? por : null,
               contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null } });
    if (origem === "cliente") msgs.push({ id: `m-td-${k}-1`, conversa_id: `cv-td-${k}`, origem: "contato", tipo: "texto",
                                          texto: "oi", criado_em: aberto, id_uazapi: `TD-${k}-1` });
    if (resposta) msgs.push({ id: `m-td-${k}-2`, conversa_id: `cv-td-${k}`, origem: "advogado", tipo: "texto", texto: "olá",
                              criado_em: resposta, id_uazapi: `TD-${k}-2`, enviado_por_id: por, enviado_por: "x" });
    ats.push({ id: `at-td-${k}`, protocolo: p, conversa_id: `cv-td-${k}`, aberto_em: aberto, origem, aberto_por: origem === "cliente" ? null : por,
               primeira_resposta_em: resposta, finalizado_em: fim, finalizado_por: fim ? por : null });
  };
  for (let i = 0; i < 3; i++) { const a = em(10, 9, 5 + i); proto(`D10-${i}`, { aberto: a, resposta: M(a, 10), fim: M(a, 40) }); }
  for (let i = 0; i < 6; i++) { const a = em(5, 14, 5 + i); proto(`D5-${i}`, { aberto: a, resposta: M(a, i === 0 ? 10 : 50), por: i % 2 ? JEN : EU }); }
  { const a = em(4, 20, 10); proto("D4", { aberto: a, resposta: M(a, 10) }); }
  { const a = em(3, 11, 0); proto("D3", { aberto: a, origem: "equipe", resposta: a }); }
  for (let i = 0; i < 4; i++) { const a = em(2, 9, 10 + i); proto(`D2-${i}`, { aberto: a, resposta: M(a, i === 3 ? 60 : 10), fim: i < 2 ? M(a, 120) : null }); }
  for (let i = 0; i < 2; i++) { const a = em(1, 14, 20 + i); proto(`D1-${i}`, { aberto: a, espera: a }); }
  { const a = em(0, 17, 50); proto("D0", { aberto: a, espera: a }); }
  return { contatos: cts, conversas: cvs, mensagens: msgs, zorvin_atendimentos: ats };
}

const nav = await abrirNavegador();

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ admin = true, largura = 1366, altura = 900, escuro = false, sem052 = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  await ctx.clock.setFixedTime(new Date(AGORA));
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEM_RELATORIO = false;
    globalThis.__RELATORIO_FALHA = false;
    globalThis.__SEM_051 = false;
    globalThis.__SEM_052 = d.sem052;
    globalThis.__SEM_CONTABILIZACAO = false;
    globalThis.__CONTABILIZACAO_FALHA = false;
    globalThis.__SEM_RELATORIO_RESP = false;
    globalThis.__RELATORIO_RESP_FALHA = false;
    globalThis.__FUNCOES_CHAMADAS = [];
    globalThis.__IMPRESSOES = 0;
    window.print = () => { globalThis.__IMPRESSOES++; };
    try { localStorage.setItem("zorvin_modo", d.escuro ? "escuro" : "claro"); } catch (_) { /* sem armazenamento */ }
  }, { semente: semente(), admin, escuro, sem052 });
  await abrirATela(page, "painel");
  await page.waitForSelector("[data-visao-geral]", { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector("[data-visao-carregando]")
    && document.querySelector("[data-indicadores]"), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, estouros };
}

const T = "[data-tendencias]";
const texto = async (page, sel) => {
  const l = page.locator(sel);
  if (!(await l.count())) return "";
  return ((await l.first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
};
const attr = async (page, sel, a) => {
  const l = page.locator(sel);
  if (!(await l.count())) return null;
  return l.first().getAttribute(a).catch(() => null);
};
const valorDoIndicador = (page, id) => attr(page, `[data-indicador="${id}"]`, "data-valor");

// ==================================================================
//  0. AS CONTAS SEM TELA
// ==================================================================
if (vale("0")) {
  console.log("\n0. As contas sem tela (src/tendencias.js)");
  // DE 01 A 03/10 NO RELÓGIO LOCAL do Node: a conta dos dias é a do relógio
  // de quem olha, e o da máquina das provas pode estar em UTC.
  const de = new Date(2026, 9, 1, 0, 0).toISOString(), ate = new Date(2026, 9, 3, 23, 59).toISOString();
  ok("os dias do período: um por dia, no calendário de quem olha", q(diasDoPeriodo(de, ate)) === q(["2026-10-01", "2026-10-02", "2026-10-03"]),
     q(diasDoPeriodo(de, ate)));
  const com = fluxoPorDia([{ quando: "2026-10-02", atendimentos: 5, sem_resposta: 2, finalizados: 3, no_prazo: 2, prazo_julgados: 4 }], de, ate);
  ok("com o 052: o dia se divide em finalizados, em atendimento e esperando, e os dias sem nada são zero",
     com.com052 && q(com.dias.map((d) => [d.entraram, d.finalizados, d.em_atendimento, d.sem_resposta])) === q([[0, 0, 0, 0], [7, 3, 2, 2], [0, 0, 0, 0]]),
     q(com.dias));
  const sem = fluxoPorDia([{ quando: "2026-10-02", atendimentos: 5, sem_resposta: 2 }], de, ate);
  ok("sem o 052: não inventa finalizados", !sem.com052 && sem.dias[1].finalizados === null && sem.dias[1].em_atendimento === 5, q(sem.dias[1]));
  ok("o resumo sem o 052 não diz quantos saíram", resumoDoFluxo(sem).finalizados === null && resumoDoFluxo(sem).entraram === 7, q(resumoDoFluxo(sem)));
  const r = resumoDoFluxo(com);
  ok("o resumo com o 052: 7 entraram, 3 saíram (43%), 4 abertos, e o pico é o dia 02", r.finalizados === 3 && r.abertos === 4 && r.pct === 43
     && r.pico && r.pico.quando === "2026-10-02", q(r));
  const pd = prazoPorDia([{ quando: "2026-10-02", no_prazo: 2, prazo_julgados: 4 }], de, ate);
  ok("o prazo do dia sem cliente julgado fica sem número, e não zero", pd.existe && pd.dias[0].pct === null && pd.dias[1].pct === 50, q(pd.dias));
  ok("com uma pessoa escolhida (o banco manda nulo), o prazo não existe", !prazoPorDia([{ quando: "2026-10-02", no_prazo: null, prazo_julgados: null }], de, ate).existe);
  ok("o prazo do período sai da soma dos dias", q(prazoDoPeriodo([{ julgados: 4, noPrazo: 2 }, { julgados: 6, noPrazo: 6 }])) === q({ julgados: 10, noPrazo: 8, pct: 80 }));
  // AS HORAS SÃO AS DO RELÓGIO DE QUEM RODA (o navegador, na tela): aqui,
  // montadas no relógio local do Node, para a conta não depender do fuso da máquina.
  const as = (h) => new Date(2026, 9, 2, h, 10).toISOString();
  const regs = [
    ...Array.from({ length: 6 }, (_, i) => ({ aberto_em: as(14), prazo: i ? "atrasado" : "no_prazo" })),
    ...Array.from({ length: 5 }, () => ({ aberto_em: as(9), prazo: "no_prazo" })),
    { aberto_em: as(20), prazo: "sem_acao" },                                                  // 20h, um só
    { aberto_em: as(10), prazo: "aguardando" }, { aberto_em: as(10), prazo: null },            // não julgados
  ];
  const ph = prazoPorHora(regs, regs.length);
  ok("por hora: 14h 1 de 6, 09h 5 de 5, 20h 0 de 1, e os não julgados ficam de fora",
     ph.horas[14].julgados === 6 && ph.horas[14].noPrazo === 1 && ph.horas[9].pct === 100 && ph.horas[20].julgados === 1
     && ph.horas[10].julgados === 0 && ph.julgados === 12, q([ph.horas[14], ph.horas[9], ph.horas[20], ph.horas[10]]));
  ok("a hora que mais precisa de gente: 14h — a de 20h tem poucos casos e não conta", piorHora(ph.horas, 5)?.hora === 14, q(piorHora(ph.horas, 5)));
  ok("os registros completos dizem que são completos", ph.completo === true);
  ok("e os cortados dizem que foram cortados", prazoPorHora(regs, 1000).completo === false && prazoPorHora(regs, 1000).vieram === regs.length);
  const dias40 = Array.from({ length: 40 }, (_, i) => ({ quando: `d${i}`, iniciados: 1, noPrazo: i < 20 ? 1 : 0, julgados: i < 20 ? 1 : 3 }));
  const f = pontosDaFaisca(dias40, "iniciados", { teto: 20 });
  ok("a faísca de 40 dias vira 20 pontos de 2 dias, somados", f.length === 20 && f.every((p) => p.v === 2), q(f.slice(0, 2)));
  const fr = pontosDaFaisca([{ quando: "a", noPrazo: 1, julgados: 1 }, { quando: "b", noPrazo: 0, julgados: 9 }], null, { teto: 1, razao: ["noPrazo", "julgados"] });
  ok("a faísca do prazo junta pela razão das somas (1 de 10), e não pela média das porcentagens (50%)", fr.length === 1 && fr[0].v === 10, q(fr));
}

// ==================================================================
//  1-5. QUEM ADMINISTRA, no computador
// ==================================================================
// O painel de quem administra abre na primeira cena que precisa dele, e
// serve às cinco: com `CENAS`, só abre se alguma delas foi pedida.
let doAdmin = null;
const painelDoAdmin = async () => (doAdmin ??= await abrirPainel());
{
  if (vale("1")) {
    const { page } = await painelDoAdmin();
    console.log("\n1. A fila: entrada e saída, dia a dia");
    ok("a seção das tendências aparece", (await page.locator(T).count()) === 1);
    const ordem = await page.evaluate(() => [...document.querySelectorAll("[data-secao-do-painel]")].map((s) => s.getAttribute("data-secao-do-painel")));
    ok("logo depois da Visão geral, antes da equipe", ordem[0] === "visao" && ordem[1] === "tendencias" && ordem[2] === "equipe", q(ordem));
    const resumo = await texto(page, `${T} [data-resumo-do-fluxo]`);
    ok("a frase do fluxo diz os números: 18 entraram, 5 finalizados (28%), 13 abertos, 3 sem resposta",
       resumo.includes("Entraram 18 protocolos; 5 já foram finalizados (28%) e 13 continuam abertos — 3 sem nenhuma resposta ainda."), resumo);
    ok("e o dia de mais entrada, com o número", resumo.includes(`O dia de mais entrada foi ${diaLongo(5)}, com 6.`), resumo);
    const colunas = await page.$$eval(`${T} [data-colunas="fluxo"] [data-coluna]`, (cs) => cs.map((c) => ({ d: c.getAttribute("data-coluna"), v: c.getAttribute("data-valor-da-coluna") })));
    ok("uma coluna por dia do período (30)", colunas.length === 30, `${colunas.length}`);
    const c5 = colunas.find((c) => c.d === diaSP(5)), c2 = colunas.find((c) => c.d === diaSP(2));
    ok("a coluna de há 5 dias vale 6, e a de há 2 dias, 4", c5 && c5.v === "6" && c2 && c2.v === "4", q([c5, c2]));
    const fatias = await page.$$eval(`${T} [data-colunas="fluxo"] [data-coluna="${diaSP(2)}"] [data-fatia]`, (fs) => fs.map((f) => ({
      s: f.getAttribute("data-fatia"), h: Math.round(f.getBoundingClientRect().height) })));
    ok("a coluna de há 2 dias se divide em finalizados e em atendimento, metade cada",
       fatias.length === 2 && fatias[0].s === "finalizados" && fatias[1].s === "em_atendimento" && Math.abs(fatias[0].h - fatias[1].h) <= 2, q(fatias));
    const gap = await page.evaluate((d) => {
      const fs = [...document.querySelectorAll(`[data-tendencias] [data-colunas="fluxo"] [data-coluna="${d}"] [data-fatia]`)];
      if (fs.length < 2) return null;
      const a = fs[0].getBoundingClientRect(), b = fs[1].getBoundingClientRect();
      return Math.round(a.top - b.bottom);
    }, diaSP(2));
    ok("com o vão de 2px entre as fatias da pilha", gap === 2, `${gap}`);
    const largura = await page.evaluate(() => Math.max(...[...document.querySelectorAll("[data-tendencias] [data-colunas] [data-fatia]")].map((f) => f.getBoundingClientRect().width)));
    ok("nenhuma coluna passa de 24px de largura", largura > 0 && largura <= 24.5, `${largura}`);
    // O MOUSE NUM DIA lê todas as séries dele.
    const alvo = page.locator(`${T} [data-colunas="fluxo"] [data-coluna="${diaSP(2)}"]`);
    if (await alvo.count()) await alvo.hover().catch(() => {});
    await page.waitForTimeout(150);
    const leitura = await texto(page, `${T} [data-colunas="fluxo"] [data-leitura-das-colunas]`);
    ok("o mouse num dia lê o dia, o total e cada série", leitura.includes(diaLongo(2)) && leitura.includes("4 entraram")
       && /2 já finalizados/.test(leitura) && /2 em atendimento/.test(leitura) && /0 esperando resposta/.test(leitura), leitura);
    // A TABELA.
    const botao = page.locator(`${T} [data-grafico-fluxo] button[title="Ver os números"]`);
    let linhas = [];
    if (await botao.count()) {
      await botao.click().catch(() => {}); await page.waitForTimeout(200);
      linhas = await page.$$eval(`${T} [data-grafico-fluxo] table tbody tr`, (ts) => ts.map((t) => [...t.querySelectorAll("td")].map((c) => c.textContent.trim())));
      await page.locator(`${T} [data-grafico-fluxo] button[title="Ver o gráfico"]`).click().catch(() => {});
    }
    const l5 = linhas.find((l) => l[0] === diaLongo(5));
    ok("a tabela tem os 30 dias, e o de há 5 dias: 6 entraram, 0 finalizados, 6 em atendimento", linhas.length === 30
       && l5 && q(l5.slice(1)) === q(["6", "0", "6", "0"]), q([linhas.length, l5]));
  }

  if (vale("2")) {
    const { page } = await painelDoAdmin();
    console.log("\n2. O prazo, dia a dia");
    const resumo = await texto(page, `${T} [data-resumo-do-prazo-dia]`);
    ok("a frase do prazo: 50% no período (8 de 16)", resumo.includes("No período, 50% dos clientes foram atendidos no prazo (8 de 16)."), resumo);
    ok("e o pior dia, com 3 clientes ou mais: há 5 dias, 17% em 6", resumo.includes(`O pior dia foi ${diaLongo(5)}: 17%, em 6 clientes.`), resumo);
    ok("a régua do período está desenhada em 50%", (await attr(page, `${T} [data-colunas="prazo-dia"] [data-referencia-das-colunas]`, "data-referencia-das-colunas")) === "50");
    const rot = async (k) => attr(page, `${T} [data-colunas="prazo-dia"] [data-coluna="${diaSP(k)}"]`, "aria-label");
    ok("o dia sem cliente para julgar fica sem número (e não 0%)", /sem número/.test(await rot(7) || ""), await rot(7));
    ok("ontem, com 2 clientes e nenhum no prazo, é 0% de verdade", /No prazo 0%/.test(await rot(1) || ""), await rot(1));
    ok("e há 10 dias, 100%", /No prazo 100%/.test(await rot(10) || ""), await rot(10));
  }

  if (vale("3")) {
    const { page } = await painelDoAdmin();
    console.log("\n3. O prazo pela hora em que o cliente escreveu");
    const resumo = await texto(page, `${T} [data-resumo-do-prazo-hora]`);
    ok("a hora que mais precisa de gente: 14h, 13% em 8 clientes",
       resumo.includes("A hora que mais precisa de gente: 14h — 13% no prazo, em 8 clientes que escreveram entre 14h e 15h."), resumo);
    ok("com os registros completos, sem o aviso de corte", (await page.locator(`${T} [data-prazo-hora-cortado]`).count()) === 0);
    const lbl = async (h) => attr(page, `${T} [data-colunas="prazo-hora"] [data-coluna="${h}"]`, "aria-label");
    ok("às 09h, 86%", /No prazo 86%/.test(await lbl(9) || ""), await lbl(9));
    const opac = async (h) => page.evaluate((hh) => {
      const c = document.querySelector(`[data-tendencias] [data-colunas="prazo-hora"] [data-coluna="${hh}"] > div`);
      return c ? getComputedStyle(c).opacity : null;
    }, String(h));
    ok("a coluna das 20h (1 cliente só) é mais clara", (await opac(20)) === "0.35", await opac(20));
    ok("e a das 14h (8 clientes), não", (await opac(14)) === "1", await opac(14));
  }

  if (vale("5")) {
    const { page } = await painelDoAdmin();
    console.log("\n5. As faíscas nos cartões da Visão geral");
    const fp = page.locator('[data-indicador="prazo"] [data-faisca="prazo"]');
    const fa = page.locator('[data-indicador="atendimentos"] [data-faisca="atendimentos"]');
    ok("o cartão do prazo tem a faísca do prazo, dia a dia", (await fp.count()) === 1);
    ok("e o dos atendimentos, a dos atendimentos", (await fa.count()) === 1);
    const titulos = await page.$$eval('[data-indicador="atendimentos"] [data-faisca] title', (ts) => ts.map((t) => t.textContent));
    const d5 = `${diaSP(5).slice(8, 10)}/${diaSP(5).slice(5, 7)}`;
    ok("um ponto por dia, e o mouse lê o dia e o número (há 5 dias: 6 atendimentos)",
       titulos.length === 30 && titulos.includes(`${d5}: 6 atendimentos`), q(titulos.filter((t) => !/: 0 /.test(t))));
    const rotulo = await attr(page, '[data-indicador="prazo"] [data-faisca]', "aria-label");
    ok("a faísca tem rótulo para quem não vê", /no prazo, dia a dia/.test(rotulo || ""), rotulo);
  }

  if (vale("4")) {
    const { page } = await painelDoAdmin();
    console.log("\n4. O clique num dia recorta a tela inteira, e a barra oferece a volta");
    ok("antes: 15 atendimentos no cartão", (await valorDoIndicador(page, "atendimentos")) === "15", await valorDoIndicador(page, "atendimentos"));
    const col = page.locator(`${T} [data-colunas="fluxo"] [data-coluna="${diaSP(5)}"]`);
    ok("a coluna é um botão", (await attr(page, `${T} [data-colunas="fluxo"] [data-coluna="${diaSP(5)}"]`, "role")) === "button");
    if (await col.count()) await col.click().catch(() => {});
    await page.waitForTimeout(1500);
    const faixa = await texto(page, "[data-recorte-do-dia]");
    const dataBR = `${diaSP(5).slice(8, 10)}/${diaSP(5).slice(5, 7)}/${diaSP(5).slice(0, 4)}`;
    ok("a barra diz o dia clicado e oferece a volta para os 30 dias", faixa.includes(`Vendo só ${dataBR}`) && /Voltar para .*30 dias/.test(faixa), faixa);
    ok("e a tela inteira recorta: o cartão passa a 6 atendimentos", (await valorDoIndicador(page, "atendimentos")) === "6", await valorDoIndicador(page, "atendimentos"));
    ok("num dia só, as colunas não são mais clicáveis", (await page.locator(`${T} [data-colunas] [role="button"]`).count()) === 0);
    await page.locator("[data-voltar-do-dia]").click().catch(() => {});
    await page.waitForTimeout(1500);
    ok("voltando, os 30 dias de antes: 15 atendimentos, e a faixa some",
       (await valorDoIndicador(page, "atendimentos")) === "15" && (await page.locator("[data-recorte-do-dia]").count()) === 0, await valorDoIndicador(page, "atendimentos"));
    // PELO TECLADO: o foco na coluna e o Enter.
    const c2 = page.locator(`${T} [data-colunas="prazo-dia"] [data-coluna="${diaSP(2)}"]`);
    if (await c2.count()) { await c2.focus().catch(() => {}); await page.keyboard.press("Enter").catch(() => {}); }
    await page.waitForTimeout(1500);
    ok("pelo teclado (Enter na coluna do prazo), também: há 2 dias, 4 atendimentos",
       (await valorDoIndicador(page, "atendimentos")) === "4" && (await page.locator("[data-recorte-do-dia]").count()) === 1, await valorDoIndicador(page, "atendimentos"));
    // ESCOLHER OUTRO PERÍODO NA BARRA esquece a volta: ela é do clique.
    await page.locator("[data-voltar-do-dia]").click().catch(() => {});
    await page.waitForTimeout(800);
  }
  ok("sem erro de JavaScript no caminho", !doAdmin || doAdmin.estouros.length === 0, (doAdmin?.estouros || []).join(" | "));
  if (doAdmin) await doAdmin.ctx.close();
}

// ==================================================================
//  6. A PESSOA ESCOLHIDA, E O BANCO SEM O 052
// ==================================================================
if (vale("6")) {
  console.log("\n6. A pessoa escolhida (o prazo é da equipe), e o banco sem o 052");
  const a = await abrirPainel({ admin: false });
  ok("para quem atende, a seção aparece com o fluxo dela", (await a.page.locator(`${T} [data-grafico-fluxo]`).count()) === 1);
  ok("e sem o prazo dia a dia nem por hora", (await a.page.locator(`${T} [data-grafico-prazo-dia]`).count()) === 0
     && (await a.page.locator(`${T} [data-grafico-prazo-hora]`).count()) === 0);
  ok("nem a faísca do prazo", (await a.page.locator("[data-faisca=\"prazo\"]").count()) === 0);
  await a.ctx.close();

  const b = await abrirPainel({ sem052: true });
  const resumo = await texto(b.page, `${T} [data-resumo-do-fluxo]`);
  ok("sem o 052, a frase não diz quantos saíram", resumo.startsWith("Entraram 18 protocolos") && !/finalizad/.test(resumo), resumo);
  const leg = await b.page.$$eval(`${T} [data-grafico-fluxo] span`, (ss) => ss.map((s) => s.textContent.trim()).filter(Boolean));
  ok("e as séries são “com atendimento” e “esperando”, sem “já finalizados”", leg.includes("Com atendimento") && !leg.includes("Já finalizados"), q(leg.slice(0, 6)));
  ok("o rodapé diz por quê", /atualização 052/.test(await texto(b.page, `${T} [data-grafico-fluxo]`)));
  ok("e não há prazo para desenhar", (await b.page.locator(`${T} [data-grafico-prazo-dia]`).count()) === 0);
  await b.ctx.close();
}

// ==================================================================
//  7. O TEMA ESCURO, O CELULAR E O PAPEL
// ==================================================================
if (vale("7")) {
  console.log("\n7. O tema escuro, o celular e o papel");
  const e = await abrirPainel({ escuro: true });
  const cor = await e.page.evaluate(() => {
    const f = document.querySelector('[data-tendencias] [data-colunas="fluxo"] [data-fatia="finalizados"]');
    return f ? getComputedStyle(f).backgroundColor : null;
  });
  ok("no escuro, os finalizados têm o verde do escuro (#00a884)", cor === "rgb(0, 168, 132)", cor);
  await e.ctx.close();

  for (const largura of [360, 390]) {
    const m = await abrirPainel({ largura, altura: 800 });
    const medida = await m.page.evaluate(() => {
      const tela = document.querySelector('[data-tela="painel"]');
      const sec = document.querySelector("[data-tendencias]");
      const graficos = [...document.querySelectorAll("[data-tendencias] [data-colunas]")].map((g) => g.getBoundingClientRect());
      return { rola: tela ? tela.scrollWidth > tela.clientWidth + 1 : null, janela: window.innerWidth,
               sec: sec ? Math.round(sec.getBoundingClientRect().right) : null,
               graficos: graficos.map((r) => [Math.round(r.left), Math.round(r.right)]) };
    });
    ok(`(${largura}) a tela não rola de lado`, medida.rola === false, q(medida));
    ok(`(${largura}) os três gráficos cabem na tela`, medida.graficos.length === 3 && medida.graficos.every(([l, r]) => l >= 0 && r <= medida.janela), q(medida));
    await m.ctx.close();
  }

  const p = await abrirPainel();
  await p.page.emulateMedia({ media: "print" });
  await p.page.waitForTimeout(300);
  const papel = await p.page.evaluate(() => {
    const s = document.querySelector('[data-secao-do-painel="tendencias"]');
    const tab = document.querySelector('[data-tendencias] button[title="Ver os números"]');
    return { secao: s ? getComputedStyle(s).display !== "none" && s.getBoundingClientRect().height > 0 : null,
             botao: tab ? getComputedStyle(tab).display !== "none" : null };
  });
  ok("no papel, as tendências vão, sem os botões de tabela", papel.secao === true && papel.botao === false, q(papel));
  await p.page.emulateMedia({ media: null });
  // DESMARCADA NO MENU, sai do papel.
  const abrir = p.page.locator("[data-imprimir-relatorio]").first();
  if (await abrir.count()) await abrir.click().catch(() => {});
  await p.page.waitForTimeout(200);
  const rotulo = await texto(p.page, '[data-menu-de-impressao] [data-secao-impressa="tendencias"]');
  ok("o menu de imprimir oferece as tendências, marcadas", /Tendências do período/.test(rotulo)
     && (await p.page.locator('[data-secao-impressa="tendencias"] input:checked').count()) === 1, rotulo);
  const caixa = p.page.locator('[data-secao-impressa="tendencias"] input').first();
  if (await caixa.count()) await caixa.click().catch(() => {});
  await p.page.waitForTimeout(200);
  const marcada = await attr(p.page, '[data-secao-do-painel="tendencias"]', "data-nao-imprime");
  ok("desmarcada no menu, a seção sai do papel", marcada === "", `${marcada}`);
  await p.ctx.close();
}

// ==================================================================
//  8. NENHUMA IDA A MAIS AO BANCO
// ==================================================================
if (vale("8")) {
  console.log("\n8. Nenhuma ida a mais ao banco");
  const { ctx, page } = await abrirPainel();
  const c = await page.evaluate(() => {
    const c = {};
    for (const x of globalThis.__FUNCOES_CHAMADAS || []) c[x.nome] = (c[x.nome] || 0) + 1;
    return c;
  });
  // O React de desenvolvimento monta tudo duas vezes: a régua é a das outras
  // leituras da tela, e não um número escrito aqui.
  ok("os protocolos são lidos tantas vezes quanto as outras leituras (a Visão geral, as tendências e a seção deles dividem uma)",
     c.zorvin_relatorio_atendimentos >= 1 && c.zorvin_relatorio_atendimentos === c.zorvin_relatorio_responsaveis
     && c.zorvin_relatorio_atendimentos === c.painel_dashboard, q(c));
  await ctx.close();
}

ok("as cenas pedidas em CENAS existem nesta prova", !CENAS.length || CENAS.every((c) => cenasDaProva.has(c)),
   `não existem: ${CENAS.filter((c) => !cenasDaProva.has(c)).join(", ")}`);
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
