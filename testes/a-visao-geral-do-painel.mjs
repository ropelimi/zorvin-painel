// A VISÃO GERAL DO PAINEL (05/11) — os indicadores, os destaques e as roscas
//
// Pedido do Rodrigo: "A tela "Painel" preciso de um dashboard de verdade, que
// seja inteligente e interativa. Com cards, gráficos de pizza, etc. Tem que
// fazer sentido também as informações que me ajudem a melhorar o
// atendimento, organizar a equipe e dar feedbacks e fazer cobranças de forma
// correta. Existe lá números sobre "Há 3+ dias", que na verdade deve ser "Há
// +2 dias"."
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. OS INDICADORES dizem os números da semente, feitos à mão: o prazo (em
//      horário de expediente, script 052 da ponte), a 1ª resposta, os
//      atendimentos, o que espera agora e a fila sem responsável. Os dois
//      "de agora" batem com a seção da carteira, linha a linha;
//   2. OS DESTAQUES dizem o que fazer, o mais urgente primeiro, cada um com o
//      ícone e a palavra do nível (nunca a cor sozinha), e o caminho até o
//      lugar de agir: a guia "Esperando resposta", a seção da carteira e o
//      departamento recortado na barra;
//   3. AS ROSCAS: as fatias com os números da semente, o desenho do tamanho
//      de cada parte, o mouse na fatia e na legenda, a tabela de cada uma, e
//      a dos departamentos clicável (e por teclado);
//   4. A COR SEGUE O DEPARTAMENTO, e não a posição na rosca;
//   5. A PESSOA ESCOLHIDA: o prazo some (é da equipe), a carteira é a dela, e
//      a ficha traz os pontos para a conversa de feedback, com o número;
//   6. QUEM NÃO ADMINISTRA vê a visão geral dele, com "a sua carteira";
//   7. O BANCO SEM O 052 E SEM O 051: o que não veio não é desenhado como
//      zero, e a régua da carteira é a que o banco usou;
//   8. A FALHA E A FALTA: o que não carregou é dito, e o resto continua;
//   9. NO CELULAR: nada rola de lado, e as roscas cabem no cartão;
//  10. O TEMA ESCURO troca as cores das categorias e guarda as do status, e
//      as palavras dos níveis passam no contraste nos dois temas;
//  11. IMPRIMIR: a Visão geral é a primeira seção do papel, sem os botões e
//      sem a frase do clique;
//  12. NENHUMA IDA A MAIS AO BANCO: a visão geral lê o que a tela já lê.
import { abrirNavegador, abrirATela, guiaQueAbre } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (x) => JSON.stringify(x);
const CENAS = (process.env.CENAS || "").split(",").map((s) => s.trim()).filter(Boolean);
const vale = (cena) => !CENAS.length || CENAS.includes(cena);
const TODAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"];

const nav = await abrirNavegador();

// UM "AGORA" SÓ, HOJE ÀS 7H30 DE SÃO PAULO, com o relógio da tela parado nele
// — a lição de `o-painel-de-gestao` (05/11): os números da bancada mudavam
// com a hora em que a prova rodava. A semente conta desse mesmo agora.
const HOJE_EM_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(Date.now());
const AGORA = Date.parse(`${HOJE_EM_SP}T07:30:00-03:00`);
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();
const M = (iso, min) => new Date(new Date(iso).getTime() + min * 60e3).toISOString();

// ------------------------------------------------------------
// A SEMENTE: protocolos em três telefones de três departamentos da bancada.
// Na bancada, o prazo é contado no relógio inteiro (é o 052 num departamento
// sem semana escrita; a conta com a semana está provada num Postgres, na
// seção 104 da prova da ponte), e cada departamento tem o prazo da aba
// "Aviso de espera": 30 minutos sem linha, 60 nas Audiências.
const TEL = { sac: "a5", aud: "a6", aco: "a7" }; // os departamentos 3, 4 e 5 da bancada
const DEP = { sac: "3", aud: "4", aco: "5" };
const EU = "u1", JEN = "u-jenifer", ISA = "u-isabela";
const NOMES = { [EU]: "Rodrigo Sousa", [JEN]: "JENIFER ALMEIDA", [ISA]: "ISABELA GUEDES" };

function semente({ acordosAMais = 0, anteriorMaior = false, carteiraGrande = false } = {}) {
  const cts = [], cvs = [], msgs = [], ats = [];
  let n = 0;
  const proto = (k, tel, { aberto, origem = "cliente", resposta = null, por = null, fim = null, finalPor = null,
                           dono = null, espera = null }) => {
    n++;
    const ct = { id: `ct-vg-${k}`, numero: `5511970${String(100000 + n)}`, nome: `CLIENTE ${k}`, vantoro_nome: null,
                 nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
    cts.push(ct);
    const p = `2026-0009${String(n).padStart(2, "0")}`;
    cvs.push({ id: `cv-vg-${k}`, advogado_id: tel, contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false,
               favorita: false, frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: fim,
               esperando_desde: espera, situacao: fim ? "finalizado" : resposta || origem !== "cliente" ? "aberto" : "aguardando",
               protocolo: p, ultima_atividade: resposta || fim || aberto, ultima_mensagem: "oi",
               responsavel_id: dono, responsavel_em: dono ? aberto : null, responsavel_por: dono,
               contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null } });
    if (origem === "cliente") msgs.push({ id: `m-vg-${k}-1`, conversa_id: `cv-vg-${k}`, origem: "contato", tipo: "texto",
                                          texto: "oi", criado_em: aberto, id_uazapi: `VG-${k}-1` });
    if (resposta) msgs.push({ id: `m-vg-${k}-2`, conversa_id: `cv-vg-${k}`, origem: "advogado", tipo: "texto", texto: "olá",
                              criado_em: resposta, id_uazapi: `VG-${k}-2`, enviado_por_id: por, enviado_por: NOMES[por] });
    ats.push({ id: `at-vg-${k}`, protocolo: p, conversa_id: `cv-vg-${k}`, aberto_em: aberto, origem, aberto_por: null,
               primeira_resposta_em: resposta, finalizado_em: fim, finalizado_por: finalPor });
  };
  // SUCESSO DO CLIENTE (o SAC), prazo de 30 minutos.
  proto("S1", TEL.sac, { aberto: H(50), resposta: M(H(50), 10.5), por: EU, dono: EU });           // no prazo
  proto("S2", TEL.sac, { aberto: H(60), resposta: M(H(60), 20.5), por: JEN, dono: JEN });         // no prazo
  proto("S3", TEL.sac, { aberto: H(70), resposta: M(H(70), 45.5), por: EU, dono: EU });           // fora do prazo
  proto("S4", TEL.sac, { aberto: H(80), fim: M(H(80), 5), finalPor: JEN });                     // finalizado no prazo
  proto("S5", TEL.sac, { aberto: H(30), espera: H(30) });                                       // sem resposta, vencido
  proto("S6", TEL.sac, { aberto: H(0.1), espera: H(0.1) });                                     // ainda no prazo
  proto("S7", TEL.sac, { aberto: H(40), origem: "equipe", resposta: H(40), por: EU });          // a equipe abriu: sem prazo
  // AUDIÊNCIAS, prazo de 60 minutos.
  proto("A1", TEL.aud, { aberto: H(90), resposta: M(H(90), 50.5), por: ISA, dono: ISA });         // no prazo
  proto("A2", TEL.aud, { aberto: H(100), resposta: M(H(100), 180.5), por: ISA, dono: ISA });      // fora do prazo
  proto("A3", TEL.aud, { aberto: H(110), resposta: M(H(110), 120.5), por: JEN, dono: JEN });      // fora do prazo
  proto("A4", TEL.aud, { aberto: H(20), espera: H(20) });                                       // sem resposta, vencido
  proto("A5", TEL.aud, { aberto: H(120), resposta: M(H(120), 10.5), por: ISA });                  // no prazo
  // ACORDOS, prazo de 30 minutos.
  proto("C1", TEL.aco, { aberto: H(130), resposta: M(H(130), 5.5), por: EU, fim: M(H(130), 90), finalPor: EU });
  proto("C2", TEL.aco, { aberto: H(140), resposta: M(H(140), 15.5), por: JEN, dono: JEN, espera: H(24 * 4) });
  for (let i = 0; i < acordosAMais; i++) {
    proto(`CX${i}`, TEL.aco, { aberto: H(150 + i), resposta: M(H(150 + i), 5), por: EU });
  }
  // O PERÍODO ANTERIOR (há 35 dias): 2 no prazo e 4 fora, 33%.
  for (let i = 0; i < 6; i++) {
    const a = H(24 * 35 + i * 5);
    proto(`P${i}`, TEL.sac, { aberto: a, resposta: M(a, i < 2 ? 10 : 90), por: EU });
  }
  // O PERÍODO ANTERIOR MAIOR (a cena 13): mais 14, todos no prazo — 16 de 20,
  // 80%, e 20 atendimentos contra os 12 de agora.
  if (anteriorMaior) {
    for (let i = 6; i < 20; i++) {
      const a = H(24 * 35 + i * 5);
      proto(`P${i}`, TEL.sac, { aberto: a, resposta: M(a, 10), por: EU });
    }
  }
  // A CARTEIRA ATRASADA DA JENIFER: esta (3 dias) e a C2 (4 dias).
  proto("J1", TEL.sac, { aberto: H(24 * 5), resposta: M(H(24 * 5), 20.5), por: JEN, dono: JEN, espera: H(24 * 3) });
  // A CARTEIRA GRANDE DA JENIFER (a cena 13): mais 12 conversas dela, sem
  // protocolo no período e sem cliente esperando — 16, contra 2 e 2.
  if (carteiraGrande) {
    for (let i = 0; i < 12; i++) {
      const ct = { id: `ct-vg-JX${i}`, numero: `5511971${String(100000 + i)}`, nome: `CLIENTE JX${i}`, vantoro_nome: null,
                   nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
      cts.push(ct);
      cvs.push({ id: `cv-vg-JX${i}`, advogado_id: TEL.sac, contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false,
                 favorita: false, frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null,
                 esperando_desde: null, situacao: "aberto", protocolo: null, ultima_atividade: H(24 * 40 + i),
                 ultima_mensagem: "ok", responsavel_id: JEN, responsavel_em: H(24 * 40 + i), responsavel_por: JEN,
                 contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null } });
    }
  }
  return {
    contatos: cts, conversas: cvs, mensagens: msgs, zorvin_atendimentos: ats,
    zorvin_aviso_de_espera: [{ departamento_id: 4, ligado: true, minutos: 60 }],
  };
}
// O QUE A SEMENTE DÁ, feito à mão (o período: os últimos 30 dias):
//   o prazo: no prazo S1 S2 S4 A1 A5 C1 C2 J1 (8), fora A2 A3 S3 (3), sem
//     resposta vencido S5 A4 (2), ainda no prazo S6 (1): 8 de 13, 62%. O
//     período anterior: 2 de 6, 33% — 28 pontos a mais;
//   a 1ª resposta (os 10 que o cliente abriu e tiveram resposta): 5 10 10
//     15 20 20 45 50 120 180 minutos de expediente, mediana 20. CADA RESPOSTA
//     TEM 30 SEGUNDOS A MAIS, e é de propósito: na bancada o expediente é o
//     relógio inteiro em minutos cheios, e sem os 30 segundos as duas contas
//     dariam o mesmo número — trocar uma pela outra passaria. No relógio, a
//     mediana é 20,5 min, e a tela escreve "21 min";
//   os atendimentos: 12 começados (2 finalizados, 10 em atendimento) e 3
//     esperando resposta (S5 S6 A4); no período anterior, 6;
//   os departamentos: Sucesso do Cliente 8, Audiências 5, Acordos 2. As
//     Audiências: 2 de 5 no prazo (40%), 10 pontos ou mais abaixo da equipe.

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ admin = true, largura = 1366, altura = 900, escuro = false, sem051 = false, sem052 = false,
                             protocolosFalham = false, carteiraFalha = false, semProtocolos = false, semCarteira = false,
                             acordosAMais = 0, anteriorMaior = false, carteiraGrande = false } = {}) {
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
    globalThis.__SEM_051 = d.sem051;
    globalThis.__SEM_052 = d.sem052;
    globalThis.__SEM_CONTABILIZACAO = d.semProtocolos;
    globalThis.__CONTABILIZACAO_FALHA = d.protocolosFalham;
    globalThis.__SEM_RELATORIO_RESP = d.semCarteira;
    globalThis.__RELATORIO_RESP_FALHA = d.carteiraFalha;
    globalThis.__FUNCOES_CHAMADAS = [];
    globalThis.__IMPRESSOES = 0;
    window.print = () => { globalThis.__IMPRESSOES++; };
    try { localStorage.setItem("zorvin_modo", d.escuro ? "escuro" : "claro"); } catch (_) { /* sem armazenamento */ }
  }, { semente: semente({ acordosAMais, anteriorMaior, carteiraGrande }), admin, escuro, sem051, sem052, protocolosFalham, carteiraFalha,
       semProtocolos, semCarteira });
  await abrirATela(page, "painel");
  await page.waitForSelector("[data-visao-geral]", { timeout: 20000 }).catch(() => {});
  // A VISÃO GERAL MONTADA: sem o "Montando…", e com a carteira e os
  // protocolos já nas seções deles (é com eles que a prova compara).
  await page.waitForFunction(() => !document.querySelector("[data-visao-carregando]")
    && (document.querySelector("[data-indicadores]") || document.querySelector("[data-visao-ficou-de-fora]")), null,
  { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, estouros };
}

/** UM CLIQUE GUARDADO: o elemento que não existe não estoura a prova inteira
 *  depois de 30 segundos, e a conferência seguinte diz o que faltou. */
async function clicar(page, sel) {
  const el = page.locator(sel).first();
  if (!(await el.count())) return false;
  await el.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

/** Os indicadores, como a tela os mostra. */
const indicadores = (page) => page.evaluate(() => [...document.querySelectorAll("[data-indicadores] [data-indicador]")].map((n) => ({
  id: n.getAttribute("data-indicador"), valor: n.getAttribute("data-valor"),
  numero: (n.querySelector("[data-valor-do-indicador]")?.innerText || "").trim(),
  texto: n.innerText.replace(/\s+/g, " ").trim(),
  agora: Boolean(n.querySelector("[data-marca-agora]")),
  atrasadas: n.querySelector("[data-atrasadas-do-indicador]")?.getAttribute("data-atrasadas-do-indicador") ?? null,
  comparacao: (n.querySelector("[data-comparacao-do-indicador]")?.innerText || "").replace(/\s+/g, " ").trim(),
})));
const ind = (lista, id) => lista.find((x) => x.id === id) || null;

/** Os destaques, na ordem da tela. */
const destaques = (page) => page.evaluate(() => [...document.querySelectorAll("[data-destaques] [data-destaque-da-visao]")].map((n) => ({
  id: n.getAttribute("data-destaque-da-visao"), nivel: n.getAttribute("data-nivel"),
  palavra: (n.querySelector("[data-nivel-do-destaque]")?.innerText || "").trim(),
  icone: Boolean(n.querySelector("[data-nivel-do-destaque] svg")),
  titulo: (n.querySelector("[data-titulo-do-destaque]")?.innerText || "").replace(/\s+/g, " ").trim(),
  detalhe: (n.querySelector("[data-detalhe-do-destaque]")?.innerText || "").replace(/\s+/g, " ").trim(),
  acao: (() => { const a = n.querySelector("[data-acao-do-destaque]"); return a ? {
    tipo: a.getAttribute("data-acao-do-destaque"), tag: a.tagName, texto: a.innerText.trim(),
    href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel") } : null; })(),
})));
const des = (lista, id) => lista.find((x) => x.id === id) || null;

/** As roscas: as fatias (com a cor e o pedaço do anel), o meio e a legenda. */
const roscas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-roscas] [data-rosca]")].map((n) => ({
  id: n.getAttribute("data-rosca"),
  titulo: (n.querySelector("[data-titulo-do-grafico]")?.innerText || "").trim(),
  fatias: [...n.querySelectorAll("[data-fatia]")].map((f) => ({
    id: f.getAttribute("data-fatia"), valor: Number(f.getAttribute("data-valor")), cor: f.getAttribute("stroke"),
    traco: Number((f.getAttribute("stroke-dasharray") || "").split(" ")[0]), r: Number(f.getAttribute("r")),
    opacidade: Number(getComputedStyle(f).opacity) })),
  centro: (n.querySelector("[data-centro-da-rosca]")?.innerText || "").trim(),
  rotuloDoCentro: (n.querySelector("[data-rotulo-do-centro]")?.innerText || "").trim(),
  legenda: [...n.querySelectorAll("[data-linha-da-legenda]")].map((l) => ({
    id: l.getAttribute("data-linha-da-legenda"), tag: l.tagName, valor: Number(l.getAttribute("data-valor")),
    texto: l.innerText.replace(/\s+/g, " ").trim(), icone: Boolean(l.querySelector("svg")) })),
  rodape: n.innerText.replace(/\s+/g, " ").trim(),
})));
const ros = (lista, id) => lista.find((x) => x.id === id) || null;

/** A carteira, pela seção dela (a outra escrita dos mesmos números). */
const carteira = (page) => page.evaluate(() => {
  const linhas = [...document.querySelectorAll("[data-relatorio-responsaveis] [data-responsavel-no-relatorio]")].map((tr) => ({
    nome: tr.getAttribute("data-responsavel-no-relatorio"),
    conversas: Number(tr.querySelector("[data-conversas]")?.getAttribute("data-conversas")),
    esperando: Number(tr.querySelector("[data-esperando]")?.getAttribute("data-esperando")),
    atrasadas: Number(tr.querySelector("[data-atrasadas]")?.getAttribute("data-atrasadas")),
  }));
  return {
    linhas, sem: linhas.find((l) => l.nome === "sem") || null,
    esperando: linhas.reduce((n, l) => n + l.esperando, 0), atrasadas: linhas.reduce((n, l) => n + l.atrasadas, 0),
    // `textContent`, e não `innerText`: o cabeçalho da tabela é escrito em
    // maiúsculas pelo estilo, e a palavra é a do código.
    rotulo: (document.querySelector("[data-relatorio-responsaveis] [data-rotulo-das-atrasadas]")?.textContent || "").trim(),
  };
});

/** ONDE CADA FATIA TEM DE ESTAR, pelos NÚMEROS, e não pelo desenho: o anel
 *  começa às 12h e anda no sentido do relógio, uma parte depois da outra, na
 *  ordem da legenda. Devolve, para cada fatia, o ponto no meio da parte dela
 *  e o que a tela pinta ali (`elementFromPoint`). Calculado pelo atributo do
 *  desenho, o ponto acompanharia o desenho errado — foi assim que a
 *  sabotagem do deslocamento ao contrário vazou na primeira rodada. */
const ondeEstaoAsFatias = (page, rosca) => page.evaluate((rosca) => {
  const fs = [...document.querySelectorAll(`[data-rosca="${rosca}"] [data-fatia]`)];
  if (!fs.length) return [];
  const total = fs.reduce((n, f) => n + Number(f.getAttribute("data-valor")), 0);
  const svg = fs[0].ownerSVGElement.getBoundingClientRect();
  const r = Number(fs[0].getAttribute("r"));
  let andou = 0;
  return fs.map((f) => {
    const parte = Number(f.getAttribute("data-valor")) / total;
    const ang = (andou + parte / 2) * 2 * Math.PI;
    andou += parte;
    const x = svg.left + svg.width / 2 + r * Math.sin(ang), y = svg.top + svg.height / 2 - r * Math.cos(ang);
    const e = document.elementFromPoint(x, y);
    return { fatia: f.getAttribute("data-fatia"), x, y, pintada: e && e.getAttribute ? e.getAttribute("data-fatia") : null };
  });
}, rosca);
const meioDaFatia = async (page, rosca, fatia) => ((await ondeEstaoAsFatias(page, rosca)).find((x) => x.fatia === fatia) || null);

/** O contraste entre duas cores "rgb(…)" (a régua da WCAG). */
function contraste(a, b) {
  const lum = (c) => {
    const [r, g, bl] = (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number).map((v) => {
      const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ==================================================================
if (vale("1")) {
  console.log("\n1. Os indicadores dizem os números da semente");
  const { ctx, page, estouros } = await abrirPainel();
  const secoes = await page.$$eval("[data-secao-do-painel]", (ns) => ns.map((n) => n.getAttribute("data-secao-do-painel")));
  ok("a Visão geral é a primeira seção da tela", secoes[0] === "visao", q(secoes));
  ok("e o primeiro atalho da barra leva a ela", (await page.$$eval("[data-ir-para]", (ns) => ns.map((n) => n.getAttribute("data-ir-para"))))[0] === "visao");
  const escopo = (await page.locator("[data-visao-escopo]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("o alto diz o período e o que é de agora", /30 dias/.test(escopo) && /agora/.test(escopo), escopo);
  const L = await indicadores(page);
  ok("os cinco indicadores, nesta ordem", q(L.map((x) => x.id)) === q(["prazo", "primeira-resposta", "atendimentos", "esperando-agora", "sem-responsavel"]), q(L.map((x) => x.id)));

  const pz = ind(L, "prazo") || {};
  ok("o prazo: 8 de 13 clientes, 62%", Math.abs(Number(pz.valor) - 8 / 13) < 1e-9 && pz.numero === "62%", q(pz));
  ok("com o prazo dos departamentos, em expediente", /8 de 13 clientes/.test(pz.texto) && /prazo de 30 a 60 min de expediente/.test(pz.texto), pz.texto);
  ok("e 28 pontos acima do período anterior (33%)", /↑ 28 pontos que no período anterior \(33%\)/.test(pz.comparacao), pz.comparacao);

  const pr = ind(L, "primeira-resposta") || {};
  ok("a 1ª resposta: a mediana de 10 clientes, 20 min de expediente", pr.valor === "1200" && pr.numero === "20 min"
     && /de expediente · a mediana de 10 clientes/.test(pr.texto), q(pr));
  ok("e o relógio ao lado (com os 30 segundos de cada resposta)", pr.comparacao === "no relógio: 21 min", pr.comparacao);

  const at = ind(L, "atendimentos") || {};
  ok("os atendimentos: 12, com 2 finalizados e 10 em atendimento", at.valor === "12" && /2 finalizados · 10 em atendimento/.test(at.texto), q(at));
  ok("e o período anterior pelo número, que com 6 a porcentagem enganaria", at.comparacao === "no período anterior: 6", at.comparacao);

  const C = await carteira(page);
  const es = ind(L, "esperando-agora") || {};
  ok("o que espera agora é o total da carteira, linha a linha", C.linhas.length >= 2 && Number(es.valor) === C.esperando, q({ es, C }));
  ok("e as atrasadas também, com a régua de 2 dias", Number(es.atrasadas) === C.atrasadas && /há \+2 dias/.test(es.texto), q({ es: es.texto, C: C.atrasadas }));
  const sd = ind(L, "sem-responsavel") || {};
  ok("a fila sem responsável é a linha “Sem responsável” da carteira", C.sem && Number(sd.valor) === C.sem.conversas
     && new RegExp(`${C.sem.esperando.toLocaleString("pt-BR")} esperando resposta`).test(sd.texto), q({ sd, sem: C.sem }));
  ok("só os dois de agora têm a marca “agora”", q(L.filter((x) => x.agora).map((x) => x.id)) === q(["esperando-agora", "sem-responsavel"]), q(L.map((x) => [x.id, x.agora])));
  ok("e a seção da carteira escreve a mesma régua: “Há +2 dias”", C.rotulo === "Há +2 dias", C.rotulo);
  ok("a tabela da equipe ganha a 1ª resposta em expediente, ao lado da do relógio",
     (await page.$$eval("[data-tabela-da-equipe] [data-ordenar-equipe]", (ns) => ns.map((n) => n.getAttribute("data-ordenar-equipe"))))
       .join(",").includes("primeiras,primeiraExpediente,"));

  // OS NÚMEROS NA MESMA ALTURA: o rótulo de cada cartão cabe numa linha, e
  // o número do vizinho não desce.
  const topos = await page.$$eval("[data-indicadores] [data-valor-do-indicador]", (ns) => ns.map((n) => Math.round(n.getBoundingClientRect().top)));
  ok("a 1366, os cinco números lado a lado e na mesma altura", topos.length === 5 && Math.max(...topos) - Math.min(...topos) <= 1, q(topos));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("2")) {
  console.log("\n2. Os destaques dizem o que fazer, o mais urgente primeiro");
  const { ctx, page, estouros } = await abrirPainel();
  const D = await destaques(page);
  const C = await carteira(page);
  ok("os destaques, na ordem do mais urgente", q(D.map((d) => d.id)) === q(["sem-acao", "carteira-atrasada", "sem-responsavel", "departamento", "prazo", "primeira-resposta"]), q(D.map((d) => d.id)));
  ok("os níveis: urgente, atenção, bom sinal, para saber", q(D.map((d) => d.nivel)) === q(["critico", "atencao", "atencao", "atencao", "bom", "info"]), q(D.map((d) => d.nivel)));
  ok("cada nível com o ícone e a palavra, e nunca a cor sozinha", D.length === 6 && D.every((d) => d.icone)
     && q(D.map((d) => d.palavra)) === q(["Urgente", "Atenção", "Atenção", "Atenção", "Bom sinal", "Para saber"]), q(D.map((d) => [d.palavra, d.icone])));

  const sa = des(D, "sem-acao") || {};
  ok("urgente: 2 clientes passaram do prazo sem resposta", sa.titulo === "2 clientes passaram do prazo sem resposta", sa.titulo);
  ok("com o prazo por extenso", /\(30 a 60 min de expediente\)/.test(sa.detalhe), sa.detalhe);
  ok("e o caminho é a guia “Esperando resposta”, como link de verdade", sa.acao && sa.acao.tag === "A" && /tela=esperando/.test(sa.acao.href || "")
     && sa.acao.target === "_blank" && /noopener/.test(sa.acao.rel || ""), q(sa.acao));

  const ca = des(D, "carteira-atrasada") || {};
  ok("a carteira atrasada: o total da carteira, com a régua de 2 dias",
     ca.titulo === `${C.atrasadas.toLocaleString("pt-BR")} conversas esperam resposta há 2 dias ou mais`, q({ titulo: ca.titulo, C: C.atrasadas }));
  ok("e o nome de quem tem conversa atrasada, e a fila sem dono",
     /JENIFER ALMEIDA: 2/.test(ca.detalhe) && C.sem && new RegExp(`sem responsável: ${C.sem.atrasadas.toLocaleString("pt-BR")}`).test(ca.detalhe), ca.detalhe);
  const sr = des(D, "sem-responsavel") || {};
  ok("a fila sem responsável: as que esperam resposta", C.sem && sr.titulo === `${C.sem.esperando.toLocaleString("pt-BR")} conversas sem responsável esperam resposta`, q({ sr: sr.titulo, sem: C.sem }));
  const dp = des(D, "departamento") || {};
  ok("o departamento que puxa o prazo para baixo: Audiências, 40%", dp.titulo === "Audiências: 40% no prazo"
     && dp.detalhe === "A equipe toda: 62%. Lá, 3 clientes ficaram fora do prazo.", q(dp));
  const pz = des(D, "prazo") || {};
  ok("bom sinal: o prazo melhorou, com o período anterior ao lado", pz.titulo === "O prazo melhorou: 62% dos clientes foram atendidos no prazo"
     && pz.detalhe === "No período anterior eram 33% (28 pontos a mais).", q(pz));
  const pr = des(D, "primeira-resposta") || {};
  ok("para saber: a 1ª resposta em expediente, e o relógio", pr.titulo === "Metade dos clientes recebeu a 1ª resposta em até 20 min de expediente"
     && /No relógio, contando noites, fins de semana e feriados: 21 min\./.test(pr.detalhe), q(pr));
  ok("e nada do que não é o caso: o volume (o anterior teve 6) e as carteiras desiguais (4, 2 e 2)",
     !des(D, "volume") && !des(D, "carteiras-desiguais"), q(D.map((d) => d.id)));

  // O LINK ABRE A GUIA NOVA, como os outros da tela.
  const nova = await guiaQueAbre(ctx, () => page.locator('[data-destaque-da-visao="sem-acao"] [data-acao-do-destaque]').first().click({ timeout: 4000 }).catch(() => {}));
  ok("o clique abre a guia “Esperando resposta”", nova && /tela=esperando/.test(nova.url()), nova ? nova.url() : "nenhuma guia");
  if (nova) await nova.close();

  // "VER A CARTEIRA" leva à seção dela, logo abaixo da barra.
  await clicar(page, '[data-destaque-da-visao="carteira-atrasada"] [data-acao-do-destaque]');
  await page.waitForTimeout(900);
  const pos = await page.evaluate(() => {
    const s = document.querySelector('[data-secao-do-painel="carteira"]'), b = document.querySelector("[data-barra-do-painel]");
    if (!s || !b) return null;
    return { secao: Math.round(s.getBoundingClientRect().top), barra: Math.round(b.getBoundingClientRect().bottom) };
  });
  ok("“Ver a carteira” leva a seção da carteira para logo abaixo da barra",
     pos && pos.secao >= pos.barra - 2 && pos.secao <= pos.barra + 40, q(pos));

  // "VER SÓ ESTE DEPARTAMENTO" recorta a tela inteira nas Audiências.
  // GUARDADO: com o link abrindo na mesma aba, a tela do Painel já saiu daqui,
  // e a prova tem de dizer as conferências seguintes em vez de parar.
  await page.evaluate(() => { const t = document.querySelector('[data-tela="painel"]'); if (t) t.scrollTop = 0; });
  await clicar(page, '[data-destaque-da-visao="departamento"] [data-acao-do-destaque]');
  await page.waitForFunction(() => {
    const t = document.querySelector('[data-indicador="prazo"]');
    return t && Math.abs(Number(t.getAttribute("data-valor")) - 0.4) < 1e-9;
  }, null, { timeout: 8000 }).catch(() => {});
  const barra = (await page.locator('[data-grupo="departamento"] > button').first().innerText().catch(() => "")).trim();
  ok("o departamento escolhido na barra é Audiências", barra === "Audiências", barra);
  const L = await indicadores(page);
  const pzA = ind(L, "prazo") || {};
  ok("e o prazo passa a ser o de lá: 2 de 5, com o prazo de 60 min", Math.abs(Number(pzA.valor) - 0.4) < 1e-9
     && /2 de 5 clientes · prazo de 60 min de expediente/.test(pzA.texto), q(pzA));
  ok("sem comparação: no período anterior, ninguém das Audiências foi julgado", pzA.comparacao === "", q(pzA.comparacao));
  ok("a rosca dos departamentos some (seria uma fatia só)", !ros(await roscas(page), "departamentos"));
  ok("e o destaque do departamento também", !des(await destaques(page), "departamento"));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("3")) {
  console.log("\n3. As roscas");
  const { ctx, page, estouros } = await abrirPainel();
  const R = await roscas(page);
  ok("três roscas: o prazo, os protocolos e os departamentos", q(R.map((r) => r.id)) === q(["prazo", "situacao", "departamentos"]), q(R.map((r) => r.id)));
  const pz = ros(R, "prazo") || { fatias: [], legenda: [] };
  ok("o prazo: 8 no prazo, 3 fora, 2 sem resposta", q(pz.fatias.map((f) => [f.id, f.valor])) === q([["no_prazo", 8], ["atrasados", 3], ["sem_acao", 2]]), q(pz.fatias));
  ok("o meio diz 62%, no prazo", pz.centro === "62%" && pz.rotuloDoCentro === "no prazo", q([pz.centro, pz.rotuloDoCentro]));
  ok("a legenda diz o número e a parte, com o ícone de cada desfecho", pz.legenda.length === 3
     && q(pz.legenda.map((l) => l.texto)) === q(["No prazo 8 62%", "Atendidos fora do prazo 3 23%", "Sem resposta, prazo vencido 2 15%"])
     && pz.legenda.every((l) => l.icone && l.tag === "DIV"), q(pz.legenda));
  ok("e embaixo, quem ainda está dentro do prazo e fica fora da conta", /1 cliente ainda está dentro do prazo/.test(pz.rodape), pz.rodape);
  // O ANEL É A CONTA: cada pedaço do tamanho da parte, menos o respiro de 2.
  const anel = (r) => r.fatias.every((f) => Math.abs(f.traco - ((f.valor / r.fatias.reduce((n, x) => n + x.valor, 0)) * 2 * Math.PI * f.r - 2)) < 0.01);
  ok("cada fatia do anel tem o tamanho da parte dela", pz.fatias.length === 3 && anel(pz), q(pz.fatias.map((f) => [f.valor, f.traco])));
  ok("as três com as cores do status, diferentes entre si", new Set(pz.fatias.map((f) => f.cor)).size === 3, q(pz.fatias.map((f) => f.cor)));

  const si = ros(R, "situacao") || { fatias: [], legenda: [] };
  ok("os protocolos: 10 em atendimento, 2 finalizados, 3 esperando", q(si.fatias.map((f) => [f.id, f.valor])) === q([["em_atendimento", 10], ["finalizados", 2], ["sem_resposta", 3]]), q(si.fatias));
  ok("o meio diz 15 protocolos", si.centro === "15" && si.rotuloDoCentro === "protocolos", q([si.centro, si.rotuloDoCentro]));
  ok("e o anel também é a conta", si.fatias.length === 3 && anel(si));

  const dp = ros(R, "departamentos") || { fatias: [], legenda: [] };
  ok("os departamentos: Sucesso do Cliente 8, Audiências 5, Acordos 2", q(dp.fatias.map((f) => [f.id, f.valor])) === q([[DEP.sac, 8], [DEP.aud, 5], [DEP.aco, 2]]), q(dp.fatias));
  ok("cada departamento com uma cor só dele", new Set(dp.fatias.map((f) => f.cor)).size === 3, q(dp.fatias.map((f) => f.cor)));
  ok("a legenda dos departamentos é feita de botões (é por ela que o teclado chega)", dp.legenda.length === 3 && dp.legenda.every((l) => l.tag === "BUTTON"), q(dp.legenda));
  ok("e nenhum desenho pega o foco do teclado", (await page.locator("[data-roscas] [data-desenho-da-rosca] [tabindex]").count()) === 0);

  // CADA FATIA PINTADA NO LUGAR DA PARTE DELA, nas três roscas. A rosca vem
  // antes para a vista: só se pergunta o que está pintado onde a tela mostra.
  for (const id of ["prazo", "situacao", "departamentos"]) {
    await page.locator(`[data-rosca="${id}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    const lugares = await ondeEstaoAsFatias(page, id);
    ok(`a rosca “${id}”: cada fatia pintada no lugar da parte dela, a partir das 12h`, lugares.length === 3
       && lugares.every((x) => x.pintada === x.fatia), q(lugares.map((x) => [x.fatia, x.pintada])));
  }
  // O MOUSE NA FATIA: o meio diz o número dela, e as outras esmaecem.
  await page.locator('[data-rosca="departamentos"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  const p = await meioDaFatia(page, "departamentos", DEP.aud);
  if (p) await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(400);
  let d2 = ros(await roscas(page), "departamentos") || { fatias: [] };
  ok("o mouse na fatia das Audiências: o meio diz 5, Audiências", p && d2.centro === "5" && d2.rotuloDoCentro === "Audiências", q([p, d2.centro, d2.rotuloDoCentro]));
  ok("e as outras esmaecem", d2.fatias.length === 3 && d2.fatias.every((f) => (f.id === DEP.aud ? f.opacidade === 1 : f.opacidade < 0.5)), q(d2.fatias.map((f) => [f.id, f.opacidade])));
  await page.mouse.move(5, 890);
  await page.waitForTimeout(400);
  d2 = ros(await roscas(page), "departamentos") || {};
  ok("o mouse fora: o meio volta ao total", d2.centro === "15" && d2.rotuloDoCentro === "protocolos", q([d2.centro, d2.rotuloDoCentro]));
  // O MOUSE NA LEGENDA faz o mesmo.
  await page.locator('[data-rosca="situacao"] [data-linha-da-legenda="finalizados"]').first().hover({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
  const s2 = ros(await roscas(page), "situacao") || {};
  ok("o mouse na linha da legenda: o meio diz 2, Finalizados", s2.centro === "2" && s2.rotuloDoCentro === "Finalizados", q([s2.centro, s2.rotuloDoCentro]));

  // A TABELA de cada rosca: os números que o desenho não escreve.
  await clicar(page, '[data-rosca="departamentos"] button[title="Ver os números"]');
  const tab = await page.evaluate(() => {
    const t = document.querySelector('[data-rosca="departamentos"] table');
    if (!t) return null;
    return { cab: [...t.querySelectorAll("th")].map((x) => x.textContent.trim()),
             linhas: [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.trim())) };
  });
  ok("a tabela dos departamentos tem o prazo e o tempo de cada um",
     tab && q(tab.cab) === q(["Departamento", "Protocolos", "Sem resposta", "No prazo", "1ª resp. (exped.)"]), q(tab && tab.cab));
  const linhaDe = (nome) => (tab ? tab.linhas.find((l) => l[0] === nome) : null);
  ok("Sucesso do Cliente: 8, 2 sem resposta, 4 de 6 no prazo, 20 min", q(linhaDe("Sucesso do Cliente")) === q(["Sucesso do Cliente", "8", "2", "67% (4 de 6)", "20 min"]), q(linhaDe("Sucesso do Cliente")));
  ok("Audiências: 5, 1 sem resposta, 2 de 5 no prazo, 1 h 25 min", q(linhaDe("Audiências")) === q(["Audiências", "5", "1", "40% (2 de 5)", "1 h 25 min"]), q(linhaDe("Audiências")));
  ok("Acordos: 2, nenhum sem resposta, 2 de 2 no prazo, 10 min", q(linhaDe("Acordos")) === q(["Acordos", "2", "0", "100% (2 de 2)", "10 min"]), q(linhaDe("Acordos")));
  await clicar(page, '[data-rosca="departamentos"] button[title="Ver o gráfico"]');

  // O TECLADO: a linha do departamento é um botão, e o Enter recorta a tela.
  await page.locator(`[data-rosca="departamentos"] [data-linha-da-legenda="${DEP.aco}"]`).first().focus().catch(() => {});
  const foco = await page.evaluate(() => document.activeElement?.getAttribute("data-linha-da-legenda") ?? null);
  ok("a linha de Acordos recebe o foco do teclado", foco === DEP.aco, q(foco));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const barra = (await page.locator('[data-grupo="departamento"] > button').first().innerText().catch(() => "")).trim();
  ok("e o Enter escolhe Acordos na barra do alto", barra === "Acordos", barra);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("4")) {
  console.log("\n4. A cor segue o departamento, e não a posição na rosca");
  const coresDe = async (opcoes) => {
    const { ctx, page, estouros } = await abrirPainel(opcoes);
    const dp = ros(await roscas(page), "departamentos") || { fatias: [] };
    await ctx.close();
    return { ordem: dp.fatias.map((f) => [f.id, f.valor]), cor: Object.fromEntries(dp.fatias.map((f) => [f.id, f.cor])), estouros };
  };
  const antes = await coresDe({});
  // DEZ PROTOCOLOS A MAIS EM ACORDOS: ele passa para a primeira fatia.
  const depois = await coresDe({ acordosAMais: 10 });
  ok("com 2, Acordos é a última fatia", q(antes.ordem) === q([[DEP.sac, 8], [DEP.aud, 5], [DEP.aco, 2]]), q(antes.ordem));
  ok("com 12, Acordos vira a primeira", q(depois.ordem) === q([[DEP.aco, 12], [DEP.sac, 8], [DEP.aud, 5]]), q(depois.ordem));
  const mesma = (id) => Boolean(antes.cor[id]) && antes.cor[id] === depois.cor[id];
  ok("e cada departamento continua com a cor que tinha", mesma(DEP.sac) && mesma(DEP.aud) && mesma(DEP.aco), q({ antes: antes.cor, depois: depois.cor }));
  ok("sem estouro de JavaScript", antes.estouros.length === 0 && depois.estouros.length === 0, q([antes.estouros, depois.estouros]));
}

// ==================================================================
if (vale("5")) {
  console.log("\n5. A pessoa escolhida: o prazo é da equipe, a carteira é dela, e a ficha traz o feedback");
  const { ctx, page, estouros } = await abrirPainel();
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[JEN]}"]`).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForSelector("[data-ficha-da-pessoa]", { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-indicador="prazo"]') && document.querySelector('[data-indicador="atendimentos"]'),
    null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  const escopo = (await page.locator("[data-visao-escopo]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("o alto diz quem foi escolhido, e por que o prazo não aparece",
     /Recortada em JENIFER ALMEIDA/.test(escopo) && /a carteira de JENIFER ALMEIDA, agora/.test(escopo) && /O prazo não aparece com uma pessoa escolhida/.test(escopo), escopo);
  const L = await indicadores(page);
  ok("três indicadores: sem o prazo e sem a fila sem responsável", q(L.map((x) => x.id)) === q(["primeira-resposta", "atendimentos", "esperando-agora"]), q(L.map((x) => x.id)));
  const pr = ind(L, "primeira-resposta") || {};
  ok("a 1ª resposta dela: a mediana de 4, 20 min (15 20 20 120)", pr.valor === "1200" && /a mediana de 4 clientes/.test(pr.texto), q(pr));
  const at = ind(L, "atendimentos") || {};
  ok("os atendimentos de que ela participou: 5, com 1 finalizado", at.valor === "5" && /1 finalizado · 4 em atendimento/.test(at.texto), q(at));
  const es = ind(L, "esperando-agora") || {};
  ok("a carteira dela: 2 esperando, as 2 há +2 dias", es.valor === "2" && es.atrasadas === "2" && /2 há \+2 dias · na carteira de JENIFER ALMEIDA/.test(es.texto), es.texto);

  const D = await destaques(page);
  ok("os destaques são dela: a carteira e a 1ª resposta", q(D.map((d) => d.id)) === q(["carteira-atrasada", "primeira-resposta"]), q(D.map((d) => d.id)));
  const ca = des(D, "carteira-atrasada") || {};
  ok("“2 conversas da carteira de JENIFER ALMEIDA esperam resposta há 2 dias ou mais”",
     ca.titulo === "2 conversas da carteira de JENIFER ALMEIDA esperam resposta há 2 dias ou mais"
     && ca.detalhe === "Na carteira de JENIFER ALMEIDA há 4 conversas, 2 esperando resposta.", q(ca));
  const p1 = des(D, "primeira-resposta") || {};
  ok("“Metade das primeiras respostas de JENIFER ALMEIDA saiu em até 20 min de expediente”",
     p1.titulo === "Metade das primeiras respostas de JENIFER ALMEIDA saiu em até 20 min de expediente", p1.titulo);
  const R = await roscas(page);
  ok("as roscas: sem a do prazo", q(R.map((r) => r.id)) === q(["situacao", "departamentos"]), q(R.map((r) => r.id)));
  ok("os protocolos dela: 4 em atendimento e 1 finalizado, sem a fatia dos que esperam",
     q((ros(R, "situacao") || { fatias: [] }).fatias.map((f) => [f.id, f.valor])) === q([["em_atendimento", 4], ["finalizados", 1]]));

  // A FICHA: os pontos para a conversa de feedback.
  const pontos = () => page.evaluate(() => {
    const b = document.querySelector("[data-pontos-da-ficha]");
    if (!b) return null;
    const g = (k) => [...b.querySelectorAll(`[data-pontos="${k}"] [data-ponto]`)].map((li) => [li.getAttribute("data-ponto"), li.innerText.trim()]);
    return { fortes: g("fortes"), atencao: g("atencao"), vazio: Boolean(b.querySelector("[data-pontos-vazios]")) };
  });
  let P = await pontos();
  ok("a ficha dela: a carteira atrasada é ponto de atenção, com o número",
     P && q(P.atencao) === q([["carteira", "2 conversas da carteira esperam resposta há 2 dias ou mais."]]) && P.fortes.length === 0, q(P));
  // A ISABELA RESPONDE DEVAGAR (50 min contra os 20 da equipe) e tem a carteira em dia.
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[ISA]}"]`).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForFunction((n) => document.querySelector("[data-ficha-da-pessoa]")?.getAttribute("data-ficha-da-pessoa") === n, NOMES[ISA], { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  P = await pontos();
  ok("a da Isabela: a 1ª resposta demora mais que a da equipe, com os dois números",
     P && q(P.atencao) === q([["tempo", "A 1ª resposta demora mais que a da equipe: 1ª resposta em 50 min de expediente (mediana da equipe: 20 min)."]]), q(P));
  ok("e a carteira em dia é ponto forte", P && q(P.fortes) === q([["carteira", "Carteira em dia: nenhuma conversa esperando há 2 dias ou mais."]]), q(P));
  // EU RESPONDO RÁPIDO (10 min contra 20).
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[EU]}"]`).first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForFunction((n) => document.querySelector("[data-ficha-da-pessoa]")?.getAttribute("data-ficha-da-pessoa") === n, NOMES[EU], { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  P = await pontos();
  ok("a minha: responde rápido, e a carteira em dia", P && q(P.fortes) === q([
    ["tempo", "Responde rápido: 1ª resposta em 10 min de expediente (mediana da equipe: 20 min)."],
    ["carteira", "Carteira em dia: nenhuma conversa esperando há 2 dias ou mais."]]) && P.atencao.length === 0, q(P));
  const p2 = des(await destaques(page), "primeira-resposta") || {};
  ok("e os destaques falham comigo como “suas”", p2.titulo === "Metade das suas primeiras respostas saiu em até 10 min de expediente", p2.titulo);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("6")) {
  console.log("\n6. Quem não administra vê a visão geral dele");
  const { ctx, page, estouros } = await abrirPainel({ admin: false });
  const escopo = (await page.locator("[data-visao-escopo]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("o alto diz “você” e “a sua carteira”", /Recortada em você/.test(escopo) && /a sua carteira, agora/.test(escopo), escopo);
  const L = await indicadores(page);
  ok("três indicadores, sem o prazo da equipe", q(L.map((x) => x.id)) === q(["primeira-resposta", "atendimentos", "esperando-agora"]), q(L.map((x) => x.id)));
  ok("a minha 1ª resposta: a mediana de 3, 10 min (5 10 45)", (ind(L, "primeira-resposta") || {}).valor === "600"
     && /a mediana de 3 clientes/.test((ind(L, "primeira-resposta") || {}).texto), q(ind(L, "primeira-resposta")));
  ok("os meus atendimentos: 4, com 1 finalizado", (ind(L, "atendimentos") || {}).valor === "4"
     && /1 finalizado · 3 em atendimento/.test((ind(L, "atendimentos") || {}).texto), q(ind(L, "atendimentos")));
  const es = ind(L, "esperando-agora") || {};
  ok("a minha carteira: nada esperando, “na sua carteira”", es.valor === "0" && /0 há \+2 dias · na sua carteira/.test(es.texto), es.texto);
  const D = await destaques(page);
  ok("um destaque só: a minha 1ª resposta", q(D.map((d) => d.id)) === q(["primeira-resposta"])
     && D[0].titulo === "Metade das suas primeiras respostas saiu em até 10 min de expediente", q(D));
  ok("e nada ficou de fora", (await page.locator("[data-visao-ficou-de-fora]").count()) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("7")) {
  console.log("\n7. O banco sem o 052 e sem o 051");
  {
    const { ctx, page, estouros } = await abrirPainel({ sem052: true });
    const L = await indicadores(page);
    ok("sem o 052, o prazo não aparece (nada de 0%)", !ind(L, "prazo"), q(L.map((x) => x.id)));
    const pr = ind(L, "primeira-resposta") || {};
    ok("e a 1ª resposta é a do relógio, e diz isso", pr.valor === "1230" && pr.numero === "21 min"
       && /no relógio, contando noite e fim de semana · a mediana de 10 clientes/.test(pr.texto), q(pr));
    const R = await roscas(page);
    ok("as roscas do prazo e dos departamentos não aparecem", q(R.map((r) => r.id)) === q(["situacao"]), q(R.map((r) => r.id)));
    const D = await destaques(page);
    ok("nem os destaques que dependem do prazo e do expediente",
       !["sem-acao", "prazo", "departamento", "primeira-resposta"].some((id) => des(D, id)) && des(D, "carteira-atrasada"), q(D.map((d) => d.id)));
    const cols = await page.$$eval("[data-tabela-da-equipe] [data-ordenar-equipe]", (ns) => ns.map((n) => n.getAttribute("data-ordenar-equipe")));
    ok("e a tabela da equipe fica sem a coluna do expediente, que o banco não mandou",
       cols.includes("primeiras") && !cols.includes("primeiraExpediente"), q(cols));
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
  {
    const { ctx, page, estouros } = await abrirPainel({ sem051: true });
    const C = await carteira(page);
    const es = ind(await indicadores(page), "esperando-agora") || {};
    ok("sem o 051, a régua é a de antes: “há +3 dias”, no indicador e na carteira", /há \+3 dias/.test(es.texto) && C.rotulo === "Há +3 dias", q({ es: es.texto, rotulo: C.rotulo }));
    ok("e o número é o que o banco contou", Number(es.atrasadas) === C.atrasadas, q({ es: es.atrasadas, C: C.atrasadas }));
    const ca = des(await destaques(page), "carteira-atrasada") || {};
    ok("o destaque diz “há 3 dias ou mais”", / há 3 dias ou mais$/.test(ca.titulo), ca.titulo);
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
}

// ==================================================================
if (vale("8")) {
  console.log("\n8. A falha e a falta: o que não carregou é dito, e o resto continua");
  const ficou = async (page) => (await page.locator("[data-visao-ficou-de-fora]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  {
    const { ctx, page, estouros } = await abrirPainel({ protocolosFalham: true });
    const L = await indicadores(page);
    ok("os protocolos falham: ficam os dois de agora", q(L.map((x) => x.id)) === q(["esperando-agora", "sem-responsavel"]), q(L.map((x) => x.id)));
    ok("sem roscas", (await roscas(page)).length === 0);
    ok("os destaques da carteira continuam", des(await destaques(page), "carteira-atrasada") !== null);
    ok("e a tela diz o que ficou de fora, e onde está o motivo", /Ficou de fora da visão geral o que vem dos protocolos: o motivo está na seção dos protocolos/.test(await ficou(page)), await ficou(page));
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
  {
    const { ctx, page, estouros } = await abrirPainel({ carteiraFalha: true });
    const L = await indicadores(page);
    ok("a carteira falha: ficam os três do período", q(L.map((x) => x.id)) === q(["prazo", "primeira-resposta", "atendimentos"]), q(L.map((x) => x.id)));
    ok("as roscas continuam", (await roscas(page)).length === 3);
    const D = await destaques(page);
    ok("sem os destaques da carteira, e com os do prazo", !des(D, "carteira-atrasada") && !des(D, "sem-responsavel") && des(D, "sem-acao"), q(D.map((d) => d.id)));
    ok("e a tela diz que a carteira ficou de fora", /o que vem da carteira: o motivo está na seção da carteira/.test(await ficou(page)), await ficou(page));
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
  {
    const { ctx, page, estouros } = await abrirPainel({ protocolosFalham: true, carteiraFalha: true });
    ok("as duas falham: nada de indicador, de destaque ou de rosca, e nenhum zero desenhado",
       (await page.locator("[data-indicadores], [data-destaques], [data-roscas]").count()) === 0);
    ok("e a tela diz que as duas ficaram de fora", /dos protocolos e da carteira: o motivo está na seção de cada um/.test(await ficou(page)), await ficou(page));
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
  {
    const { ctx, page, estouros } = await abrirPainel({ semProtocolos: true });
    ok("a função que falta é dita a quem administra", /o que vem dos protocolos/.test(await ficou(page)), await ficou(page));
    await ctx.close();
    const b = await abrirPainel({ semProtocolos: true, admin: false });
    ok("e não a quem atende, que não tem o que fazer com isso", (await b.page.locator("[data-visao-ficou-de-fora]").count()) === 0);
    ok("que continua vendo a sua carteira", ind(await indicadores(b.page), "esperando-agora") !== null);
    ok("sem estouro de JavaScript", estouros.length === 0 && b.estouros.length === 0, q([estouros, b.estouros]));
    await b.ctx.close();
  }
}

// ==================================================================
if (vale("9")) {
  console.log("\n9. No celular");
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  const m = await page.evaluate(() => {
    const t = document.querySelector('[data-tela="painel"]');
    const v = document.querySelector("[data-visao-geral]");
    // SEM A VISÃO GERAL (o painel de antes), as conferências reprovam dizendo
    // que ela não está lá, em vez de a prova parar aqui.
    if (!t || !v) return { rola: t ? t.scrollWidth - t.clientWidth : null, larguras: [], visao: 0, legendas: [], aneis: [], acoes: [] };
    const dentro = (sel) => [...document.querySelectorAll(sel)].map((n) => {
      const c = n.closest("[data-rosca]") || n.closest("[data-destaques]") || v;
      const a = n.getBoundingClientRect(), b = c.getBoundingClientRect();
      return a.left >= b.left - 1 && a.right <= b.right + 1;
    });
    return {
      rola: t.scrollWidth - t.clientWidth,
      larguras: [...document.querySelectorAll("[data-indicadores] [data-indicador]")].map((n) => Math.round(n.getBoundingClientRect().width)),
      visao: Math.round(v.getBoundingClientRect().width),
      legendas: dentro("[data-legenda-da-rosca]"), aneis: dentro("[data-desenho-da-rosca]"), acoes: dentro("[data-acao-do-destaque]"),
    };
  });
  ok("a tela não rola de lado", m.rola <= 0, q(m.rola));
  ok("os indicadores, um embaixo do outro, na largura da tela", m.larguras.length === 5 && m.larguras.every((w) => Math.abs(w - m.visao) <= 2), q(m));
  ok("cada rosca e cada legenda dentro do cartão dela", m.aneis.length === 3 && m.legendas.length === 3 && [...m.aneis, ...m.legendas].every(Boolean), q(m));
  ok("e os botões dos destaques dentro do cartão", m.acoes.length >= 4 && m.acoes.every(Boolean), q(m.acoes));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("10")) {
  console.log("\n10. O tema escuro, e as palavras que se leem nos dois temas");
  const medir = (page) => page.evaluate(() => {
    const fundo = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return "rgb(255, 255, 255)"; };
    const R = (id) => Object.fromEntries([...document.querySelectorAll(`[data-rosca="${id}"] [data-fatia]`)].map((f) => [f.getAttribute("data-fatia"), f.getAttribute("stroke")]));
    return {
      situacao: R("situacao"), prazo: R("prazo"),
      palavras: [...document.querySelectorAll("[data-destaques] [data-nivel-do-destaque]")].map((n) => ({
        nivel: n.closest("[data-destaque-da-visao]").getAttribute("data-nivel"), cor: getComputedStyle(n).color, fundo: fundo(n) })),
    };
  });
  const claro = await abrirPainel();
  const a = await medir(claro.page);
  await claro.ctx.close();
  const escuro = await abrirPainel({ escuro: true });
  const b = await medir(escuro.page);
  // O AZUL E O VERDE DA SITUAÇÃO são os da tela, e mudam com o tema; o âmbar
  // dos que esperam é o do aviso, igual nos dois.
  ok("no escuro, o azul e o verde da situação são os do tema escuro",
     Object.keys(a.situacao).length === 3 && Object.keys(b.situacao).length === 3
     && a.situacao.em_atendimento !== b.situacao.em_atendimento && a.situacao.finalizados !== b.situacao.finalizados,
     q({ a: a.situacao, b: b.situacao }));
  ok("e as do status são as mesmas nos dois temas", Object.keys(a.prazo).length === 3 && q(a.prazo) === q(b.prazo), q({ a: a.prazo, b: b.prazo }));
  const passa = (lista) => lista.length === 6 && lista.every((p) => contraste(p.cor, p.fundo) >= 4.5);
  ok("a palavra de cada nível passa no contraste no tema claro", passa(a.palavras), q(a.palavras.map((p) => [p.nivel, contraste(p.cor, p.fundo).toFixed(2)])));
  ok("e no escuro", passa(b.palavras), q(b.palavras.map((p) => [p.nivel, contraste(p.cor, p.fundo).toFixed(2)])));
  ok("sem estouro de JavaScript", claro.estouros.length === 0 && escuro.estouros.length === 0, q([claro.estouros, escuro.estouros]));
  await escuro.ctx.close();
}

// ==================================================================
if (vale("11")) {
  console.log("\n11. Imprimir: a Visão geral vai primeiro, sem os botões");
  const { ctx, page, estouros } = await abrirPainel();
  await clicar(page, "[data-imprimir-relatorio]");
  const secoes = await page.$$eval("[data-menu-de-impressao] [data-secao-impressa]", (ns) => ns.map((n) => ({
    id: n.getAttribute("data-secao-impressa"), marcada: n.querySelector("input").checked, texto: n.innerText.trim() })));
  ok("o menu de imprimir começa pela Visão geral, marcada", secoes[0] && secoes[0].id === "visao" && secoes[0].texto === "Visão geral" && secoes[0].marcada, q(secoes[0]));
  await page.locator('[data-secao-impressa="visao"] input').click().catch(() => {});
  await page.waitForTimeout(300);
  ok("desmarcada, ela sai do papel", (await page.locator('[data-secao-do-painel="visao"][data-nao-imprime]').count()) === 1);
  await page.locator('[data-secao-impressa="visao"] input').click().catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);
  const papel = await page.evaluate(() => {
    const vis = (n) => n && getComputedStyle(n).display !== "none" && n.getBoundingClientRect().height > 0;
    const rodape = document.querySelector('[data-rosca="departamentos"]');
    return {
      visao: vis(document.querySelector("[data-visao-geral]")),
      acoes: [...document.querySelectorAll("[data-acao-do-destaque]")].filter(vis).length,
      tabelas: [...document.querySelectorAll('[data-roscas] button[title="Ver os números"]')].filter(vis).length,
      clique: rodape ? /Clique num departamento/.test(rodape.innerText) : null,
      inteiros: [...document.querySelectorAll("[data-roscas] [data-rosca], [data-destaques]")].map((n) => getComputedStyle(n).breakInside),
    };
  });
  ok("no papel, a Visão geral está lá", papel.visao === true, q(papel));
  ok("sem os botões dos destaques nem os de “Tabela”", papel.acoes === 0 && papel.tabelas === 0, q(papel));
  ok("e sem a frase do clique, que no papel não se faz", papel.clique === false, q(papel));
  ok("cada rosca e os destaques inteiros numa folha", papel.inteiros.length === 4 && papel.inteiros.every((b) => b === "avoid"), q(papel.inteiros));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("12")) {
  console.log("\n12. Nenhuma ida a mais ao banco");
  const { ctx, page, estouros } = await abrirPainel();
  const conta = () => page.evaluate(() => {
    const c = {};
    for (const x of globalThis.__FUNCOES_CHAMADAS || []) c[x.nome] = (c[x.nome] || 0) + 1;
    return c;
  });
  const c1 = await conta();
  // No desenvolvimento o React monta a tela duas vezes: o que se confere é que
  // os protocolos e a carteira saem o MESMO número de vezes que o Painel de
  // sempre — a visão geral não pergunta nada por si.
  const vezes = ["painel_dashboard", "zorvin_relatorio_atendimentos", "zorvin_relatorio_responsaveis"].map((f) => c1[f] || 0);
  ok("os protocolos e a carteira são perguntados tantas vezes quanto o Painel de sempre", vezes[0] > 0 && new Set(vezes).size === 1 && vezes[0] <= 2, q(c1));
  await clicar(page, `[data-rosca="departamentos"] [data-linha-da-legenda="${DEP.aud}"]`);
  await page.waitForTimeout(1500);
  const c2 = await conta();
  const mais = ["zorvin_relatorio_atendimentos", "zorvin_relatorio_responsaveis"].map((f) => (c2[f] || 0) - (c1[f] || 0));
  ok("escolher um departamento pela rosca pergunta cada conta uma vez", mais[0] === 1 && mais[1] === 1, q({ c1, c2 }));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("13")) {
  console.log("\n13. O prazo que piorou, o volume que mudou e a carteira desigual");
  // O período anterior com 20 atendimentos, 16 no prazo (80%), e a carteira
  // da Jenifer com 16 conversas: os três destaques que a semente de sempre
  // não mostra (a cena 2 confere que eles NÃO aparecem lá).
  const { ctx, page, estouros } = await abrirPainel({ anteriorMaior: true, carteiraGrande: true });
  const D = await destaques(page);
  const L = await indicadores(page);
  const C = await carteira(page);
  ok("os destaques, na ordem do mais urgente: o prazo que piorou é atenção, e vem antes do departamento",
     q(D.map((d) => d.id)) === q(["sem-acao", "carteira-atrasada", "sem-responsavel", "prazo", "departamento",
                                  "carteiras-desiguais", "primeira-resposta", "volume"]), q(D.map((d) => [d.id, d.nivel])));
  const pz = des(D, "prazo") || {};
  ok("o prazo piorou: atenção, com o período anterior ao lado", pz.nivel === "atencao" && pz.palavra === "Atenção"
     && pz.titulo === "O prazo piorou: 62% dos clientes foram atendidos no prazo"
     && pz.detalhe === "No período anterior eram 80% (18 pontos a menos).", q(pz));
  const pzI = ind(L, "prazo") || {};
  ok("e o cartão do prazo diz a queda, em pontos", pzI.comparacao === "↓ 18 pontos que no período anterior (80%)", q(pzI.comparacao));
  const at = ind(L, "atendimentos") || {};
  ok("os atendimentos comparam em porcentagem, com 10 ou mais no período anterior",
     at.comparacao === "↓ 40% que no período anterior", q(at.comparacao));
  const vo = des(D, "volume") || {};
  ok("o volume que mudou muito: 12 atendimentos, 40% a menos que os 20 de antes", vo.nivel === "info"
     && vo.titulo === "12 atendimentos no período, −40% que no anterior" && vo.detalhe === "No período anterior foram 20.", q(vo));
  const jen = C.linhas.find((l) => l.nome === NOMES[JEN]) || {};
  const cd = des(D, "carteiras-desiguais") || {};
  ok("a carteira desigual: a da Jenifer, com o número dela e a mediana da equipe", jen.conversas === 16 && cd.nivel === "info"
     && cd.titulo === "A carteira de JENIFER ALMEIDA tem 16 conversas; a mediana da equipe é 2", q({ cd, jen }));
  ok("e o caminho é a seção da carteira", Boolean(cd.acao) && cd.acao.tipo === "secao" && cd.acao.texto === "Ver a carteira", q(cd.acao));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

const pedidas = CENAS.filter((c) => !TODAS.includes(c));
ok("toda cena pedida em CENAS existe", pedidas.length === 0, q(pedidas));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
