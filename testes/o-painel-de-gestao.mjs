// O PAINEL DE GESTÃO (05/11) — a pessoa, a equipe, e o relatório impresso
//
// Pedido do Rodrigo: "Faça uma revisão completa da tela "Painel", preciso que
// essa tela seja um Dashboard interativo onde eu consiga acessar os dados mais
// relevantes sobre o atendimento individual de cada usuário, com a
// possibilidade de imprimir um relatório. O painel precisa ter gráficos,
// precisa ser visualmente agradável para a gestão."
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. A TABELA DA EQUIPE junta as quatro contas de pessoa (o Painel, os
//      protocolos, o "Já tratei" e a carteira) numa linha por pessoa, pelo
//      id: cada número é o da seção de onde ele vem; quem não aparece numa
//      fonte inteira tem zero, e o tempo de quem não respondeu é "—"; a linha
//      "pelo nome" não junta com ninguém; o celular fica fora, e é dito;
//   2. O GRÁFICO da métrica escolhida e a ORDEM da tabela andam juntos; o
//      tempo começa pelo mais rápido; a mediana da equipe conta só quem fez
//      aquilo; o vazio vai para o fim;
//   3. ESCOLHER UMA PESSOA (quem administra) abre a ficha dela, com a posição
//      e a mediana da equipe, recorta a tela e não recorta a tabela;
//   4. QUEM NÃO ADMINISTRA vê a própria ficha, sem a carteira dos colegas na
//      tabela, e não escolhe ninguém;
//   5. UMA FONTE QUE FALTA tira só as colunas dela, e a tabela diz;
//   6. UMA IDA AO BANCO POR FONTE: a tabela da equipe não lê nada de novo;
//   7. IMPRIMIR: o menu do que vai no papel, o botão que imprime, o papel no
//      tema claro, sem os controles nem as listas de registros, com o recorte
//      no alto e a tabela cabendo na folha em pé;
//   8. NO CELULAR: nada rola de lado, a barra não gruda, o ranking em duas
//      linhas e as métricas numa linha;
//   9. OS ATALHOS das seções levam a cada uma.
import { abrirNavegador, ENDERECO, abrirATela } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (x) => JSON.stringify(x);
const CENAS = (process.env.CENAS || "").split(",").map((s) => s.trim()).filter(Boolean);
const vale = (cena) => !CENAS.length || CENAS.includes(cena);
const TODAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira — a lição das provas do "Já tratei".
//
// E ESSE AGORA É HOJE ÀS 7H30 DE SÃO PAULO, com o relógio da tela parado nele
// (05/11). A bancada põe os atendimentos "de hoje" das 8h às 16h, no fuso
// desta prova, e os que ainda não aconteceram ficam fora do período: as
// medianas da equipe mudavam com a hora em que a prova rodava. Medido de hora
// em hora: o tempo de resposta da Camila e o meu davam 13 e 15 min da
// meia-noite às 8h (a "mediana da equipe: 14 min" desta prova), empatavam das
// 8h às 11h, davam 10 e 15 min das 11h às 14h ("13 min"), e empatavam de novo
// depois das 14h. A rodada do GitHub de 05/11 caiu às 11h37 e reprovou, na
// main também. Às 7h30, todos os de hoje estão no futuro, como quando a prova
// foi escrita. E a semente conta desse mesmo agora: a tela e ela concordam a
// qualquer hora do dia.
const HOJE_EM_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(Date.now());
const AGORA = Date.parse(`${HOJE_EM_SP}T07:30:00-03:00`);
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();

/** O telefone que o painel abre, e outro (a lição de `a-contabilizacao…`). */
async function telefones() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const T = globalThis.__TABELAS;
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    const outro = (T.advogados || []).find((a) => c && String(a.id) !== String(c.advogado_id) && a.ativo !== false);
    return c && outro ? { adv: c.advogado_id, outro: outro.id } : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefones();
ok("aprendi os dois telefones", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

// ------------------------------------------------------------
// A SEMENTE: cinco protocolos, três "Já tratei" e uma carteira, com as
// contas feitas à mão. O LUCAS só tem carteira: é ele que separa "zero" de
// "—" (ele não fez nada no período, e tem conversa na carteira agora).
const EU = "u1", JEN = "u-jenifer", ISA = "u-isabela", LUCAS = "u-lucas-da-prova";
const NOMES = { [EU]: "Rodrigo Sousa", [JEN]: "JENIFER ALMEIDA", [ISA]: "ISABELA GUEDES", [LUCAS]: "LUCAS DA PROVA" };
const CLI = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"];
const contato = (k, i) => ({ id: `ct-${k}`, numero: `55119700066${String(i + 1).padStart(2, "0")}`, nome: `CLIENTE ${k}`,
  vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CT = Object.fromEntries(CLI.map((k, i) => [k, contato(k, i)]));
const conversa = (k, adv, campos) => ({
  id: `cv-${k}`, advogado_id: adv, contato_id: CT[k].id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null, esperando_desde: null,
  responsavel_id: null, responsavel_em: null, responsavel_por: null,
  ultima_atividade: H(1), ultima_mensagem: "oi", situacao: "aberto", protocolo: null,
  contato: { id: CT[k].id, nome: CT[k].nome, numero: CT[k].numero, foto_url: null }, ...campos,
});
let nMsg = 0;
const msg = (k, origem, quando, por = null) => ({
  id: `m-${k}-${++nMsg}`, conversa_id: `cv-${k}`, origem, tipo: "texto", texto: origem === "contato" ? "oi" : "olá",
  criado_em: quando, id_uazapi: `GE-${k}-${nMsg}`,
  ...(origem === "advogado"
    ? (por === "WhatsApp" ? { enviado_por: "WhatsApp", enviado_por_id: null } : { enviado_por: NOMES[por], enviado_por_id: por })
    : {}),
});
const at = (k, n, aberto, resposta, fim, por) => ({
  id: `at-${k}`, protocolo: `2026-0007${String(n).padStart(2, "0")}`, conversa_id: `cv-${k}`, aberto_em: aberto,
  origem: "cliente", aberto_por: null, primeira_resposta_em: resposta, finalizado_em: fim, finalizado_por: por,
});
const tratou = (id, k, quem, h) => ({ id, conversa_id: `cv-${k}`, assunto_id: "as-1", quem, quando: H(h), esperava_desde: null });

function semente() {
  return {
    contatos: Object.values(CT),
    usuarios: [{ id: LUCAS, admin: false, nome: NOMES[LUCAS], foto_url: null, ativo: true }],
    conversas: [
      conversa("G1", TEL.adv, { situacao: "finalizado", protocolo: "2026-000701", tratada_em: H(18) }),
      conversa("G2", TEL.adv, { situacao: "finalizado", protocolo: "2026-000702", tratada_em: H(28) }),
      conversa("G3", TEL.adv, { situacao: "finalizado", protocolo: "2026-000703", tratada_em: H(38) }),
      conversa("G4", TEL.adv, { situacao: "aberto", protocolo: "2026-000704" }),
      conversa("G5", TEL.adv, { situacao: "aberto", protocolo: "2026-000705" }),
      // A CARTEIRA: duas da Jenifer (as duas há 3+ dias, a mais antiga há 10)
      // e uma do Lucas (há 4 dias). Nenhuma minha: é nela que quem não
      // administra vê a própria carteira vazia como zero, e não "—".
      conversa("G6", TEL.adv, { responsavel_id: LUCAS, responsavel_em: H(200), responsavel_por: LUCAS, esperando_desde: H(4 * 24) }),
      conversa("G7", TEL.outro, { responsavel_id: JEN, responsavel_em: H(200), responsavel_por: JEN, esperando_desde: H(10 * 24) }),
      conversa("G8", TEL.outro, { responsavel_id: JEN, responsavel_em: H(200), responsavel_por: JEN, esperando_desde: H(4 * 24) }),
    ],
    mensagens: [
      msg("G1", "contato", H(20)), msg("G1", "advogado", H(19), JEN),
      msg("G2", "contato", H(30)), msg("G2", "advogado", H(29), JEN),
      msg("G3", "contato", H(40)), msg("G3", "advogado", H(39), EU),
      msg("G4", "contato", H(50)), msg("G4", "advogado", H(49), "WhatsApp"),
      msg("G5", "contato", H(60)), msg("G5", "advogado", H(59), ISA),
      msg("G6", "contato", H(4 * 24)), msg("G7", "contato", H(10 * 24)), msg("G8", "contato", H(4 * 24)),
    ],
    zorvin_atendimentos: [
      at("G1", 1, H(20), H(19), H(18), JEN),
      at("G2", 2, H(30), H(29), H(28), EU),
      at("G3", 3, H(40), H(39), H(38), JEN),
      at("G4", 4, H(50), H(49), null, null),
      at("G5", 5, H(60), H(59), null, null),
    ],
    zorvin_tratamentos: [
      tratou("tr-g1", "G1", JEN, 18), tratou("tr-g3", "G3", JEN, 38), tratou("tr-g2", "G2", EU, 28),
    ],
  };
}
// O que a semente dá, pessoa a pessoa (as contas feitas à mão):
//   primeiras: Jenifer 2 (G1, G2), eu 1 (G3), Isabela 1 (G5), o celular 1 (G4)
//   finalizou: Jenifer 2 (G1, G3), eu 1 (G2), Isabela 0
//   "Já tratei": Jenifer 2, eu 1, Isabela 0

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ admin = true, largura = 1400, altura = 900, escuro = false, semPainel = false,
                             semTratados = false, protocolosFalham = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  await ctx.clock.setFixedTime(new Date(AGORA));
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__TEM_FUNCAO_PAINEL = !d.semPainel;
    globalThis.__SEM_RELATORIO = d.semTratados;
    globalThis.__RELATORIO_FALHA = false;
    globalThis.__SEM_CONTABILIZACAO = false;
    globalThis.__CONTABILIZACAO_FALHA = d.protocolosFalham;
    globalThis.__SEM_RELATORIO_RESP = false;
    globalThis.__RELATORIO_RESP_FALHA = false;
    globalThis.__FUNCOES_CHAMADAS = [];
    globalThis.__IMPRESSOES = 0;
    window.print = () => { globalThis.__IMPRESSOES++; };
    try { localStorage.setItem("zorvin_modo", d.escuro ? "escuro" : "claro"); } catch (_) { /* sem armazenamento */ }
  }, { semente: semente(), admin, semPainel, semTratados, protocolosFalham, escuro });
  await abrirATela(page, "painel");
  await page.waitForSelector("[data-tabela-da-equipe], [data-equipe-vazia]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, estouros };
}

/** Uma linha da tabela da equipe, como a tela a mostra. */
const linha = (page, nome) => page.evaluate((nome) => {
  const tr = [...document.querySelectorAll("[data-tabela-da-equipe] [data-equipe-linha]")]
    .find((x) => x.getAttribute("data-equipe-linha") === nome);
  if (!tr) return null;
  const cols = {};
  tr.querySelectorAll("[data-coluna]").forEach((td) => { cols[td.getAttribute("data-coluna")] = td.getAttribute("data-valor"); });
  return { cols, atendente: tr.hasAttribute("data-atendente"), escolhida: tr.getAttribute("data-escolhida") === "sim",
           texto: tr.innerText.replace(/\s+/g, " ").trim() };
}, nome);
const nomes = (page) => page.$$eval("[data-tabela-da-equipe] [data-equipe-linha]", (ns) => ns.map((n) => n.getAttribute("data-equipe-linha")));
const colunas = (page) => page.$$eval("[data-tabela-da-equipe] [data-ordenar-equipe]", (ns) => ns.map((n) => n.getAttribute("data-ordenar-equipe")));
const barras = (page) => page.$$eval("[data-barra-da-equipe]", (ns) => ns.map((n) => ({
  nome: n.getAttribute("data-barra-da-equipe"), valor: n.getAttribute("data-valor"),
  destaque: n.getAttribute("data-destaque") === "sim", botao: n.tagName === "BUTTON" })));
const metrica = (page) => page.evaluate(() => document.querySelector("[data-metrica-da-equipe][data-escolhida]")?.getAttribute("data-metrica-da-equipe") || null);
const ordemDaColuna = (page, id) => page.evaluate((id) => document.querySelector(`[data-ordenar-equipe="${id}"]`)?.closest("th")?.getAttribute("aria-sort") || null, id);
const legendaDaMediana = (page) => page.evaluate(() => (document.querySelector("[data-legenda-da-mediana]")?.innerText || "").replace(/\s+/g, " ").trim());
const notas = (page) => page.evaluate(() => (document.querySelector("[data-notas-da-equipe]")?.innerText || "").replace(/\s+/g, " ").trim());
const ficha = (page) => page.evaluate(() => {
  const f = document.querySelector("[data-ficha-da-pessoa]");
  if (!f) return null;
  const cols = {};
  f.querySelectorAll("[data-ficha-coluna]").forEach((c) => {
    cols[c.getAttribute("data-ficha-coluna")] = { valor: c.getAttribute("data-valor"),
      comparacao: (c.querySelector("[data-comparacao-da-ficha]")?.innerText || "").replace(/\s+/g, " ").trim(),
      detalhe: (c.querySelector("[data-detalhe-da-carteira]")?.innerText || "").replace(/\s+/g, " ").trim() };
  });
  return { nome: f.getAttribute("data-ficha-da-pessoa"), cols, texto: f.innerText.replace(/\s+/g, " ").trim() };
});
const filtrando = (page) => page.evaluate(() => {
  const s = [...document.querySelectorAll('[data-tela="painel"] span')].find((x) => x.textContent.trim() === "Filtrando por:");
  return s ? s.parentElement.innerText.replace(/\s+/g, " ").trim() : "";
});
/** Um clique guardado: o elemento que não existe não estoura a prova. */
async function clicar(page, sel) {
  const el = page.locator(sel).first();
  if (!(await el.count())) return false;
  await el.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(500);
  return true;
}
/** A conta da seção, pela própria tela: o que a tabela da equipe junta tem
 *  de ser o que cada seção mostra. */
const daSecao = (page) => page.evaluate(() => {
  const r = { protocolos: {}, tratados: {}, carteira: {} };
  document.querySelectorAll("[data-protocolos-por-pessoa] [data-pessoa-nos-protocolos]").forEach((tr) => {
    r.protocolos[tr.getAttribute("data-pessoa-nos-protocolos")] = {
      primeiras: tr.querySelector("[data-primeiras]")?.getAttribute("data-primeiras"),
      finalizou: tr.querySelector("[data-finalizou]")?.getAttribute("data-finalizou") };
  });
  document.querySelectorAll("[data-relatorio-por-pessoa] [data-pessoa-no-relatorio]").forEach((tr) => {
    r.tratados[tr.getAttribute("data-pessoa-no-relatorio")] = tr.querySelector("[data-tratamentos]")?.getAttribute("data-tratamentos");
  });
  document.querySelectorAll("[data-relatorio-responsaveis] [data-responsavel-no-relatorio]").forEach((tr) => {
    r.carteira[tr.getAttribute("data-responsavel-no-relatorio")] = {
      conversas: tr.querySelector("[data-conversas]")?.getAttribute("data-conversas"),
      atrasadas: tr.querySelector("[data-atrasadas]")?.getAttribute("data-atrasadas") };
  });
  return r;
});

// ==================================================================
if (vale("1")) {
  console.log("\n1. A tabela da equipe junta as quatro contas, uma linha por pessoa");
  const { ctx, page, estouros } = await abrirPainel();
  ok("a tabela da equipe está na tela", (await page.locator("[data-tabela-da-equipe]").count()) === 1);
  ok("e vem antes dos protocolos", await page.evaluate(() => {
    const e = document.querySelector("[data-tabela-da-equipe]"), p = document.querySelector("[data-relatorio-protocolos]");
    return Boolean(e && p && e.getBoundingClientRect().top < p.getBoundingClientRect().top);
  }));
  const ns = await nomes(page);
  const repetido = ns.find((n, i) => ns.indexOf(n) !== i);
  ok("uma linha por pessoa: ninguém aparece duas vezes", ns.length > 3 && !repetido, q(ns));
  ok("as nove colunas, das quatro contas", q(await colunas(page)) === q(["nome", "atendimentos", "enviadas", "resposta", "espera",
    "primeiras", "finalizou", "tratados", "carteira", "atrasadas"]), q(await colunas(page)));
  ok("o “Por atendente” de antes saiu (a tabela o substitui)",
     (await page.locator("h3", { hasText: /^Por atendente$/ }).count()) === 0);

  // O PAINEL: os números de cada pessoa são os de `por_atendente`.
  const esperado = await page.evaluate(() => globalThis.__ESPERADO.painel(30, null).por_atendente);
  const comId = esperado.filter((p) => p.id);
  const errados = [];
  for (const p of comId) {
    const l = await linha(page, p.nome);
    if (!l || Number(l.cols.atendimentos) !== Number(p.atendimentos) || Number(l.cols.enviadas) !== Number(p.enviadas)) {
      errados.push({ nome: p.nome, tela: l && l.cols, banco: { atendimentos: p.atendimentos, enviadas: p.enviadas } });
    }
  }
  ok("os atendimentos e as enviadas de cada pessoa são os do Painel", comId.length > 2 && errados.length === 0, q(errados));
  const marcados = await page.$$eval("[data-tabela-da-equipe] [data-atendente]", (ns) => ns.map((n) => n.getAttribute("data-atendente")).sort());
  ok("só quem está no ranking de atendimentos tem `data-atendente`",
     q(marcados) === q(esperado.map((p) => p.nome).sort()), q({ marcados, esperado: esperado.map((p) => p.nome) }));

  // OS PROTOCOLOS, O "JÁ TRATEI" E A CARTEIRA: as contas feitas à mão.
  const jen = await linha(page, NOMES[JEN]), eu = await linha(page, NOMES[EU]), isa = await linha(page, NOMES[ISA]);
  ok("a Jenifer: 2 primeiras respostas, 2 finalizados, 2 “Já tratei”",
     jen && jen.cols.primeiras === "2" && jen.cols.finalizou === "2" && jen.cols.tratados === "2", q(jen && jen.cols));
  ok("eu: 1, 1 e 1", eu && eu.cols.primeiras === "1" && eu.cols.finalizou === "1" && eu.cols.tratados === "1", q(eu && eu.cols));
  ok("a Isabela: 1 primeira resposta, 0 finalizados, 0 “Já tratei” (zero, e não “—”)",
     isa && isa.cols.primeiras === "1" && isa.cols.finalizou === "0" && isa.cols.tratados === "0", q(isa && isa.cols));
  const s = await daSecao(page);
  const conferir = [];
  for (const n of [NOMES[JEN], NOMES[EU], NOMES[ISA]]) {
    const l = await linha(page, n);
    const p = s.protocolos[n] || { primeiras: "0", finalizou: "0" };
    if (!l || l.cols.primeiras !== String(p.primeiras) || l.cols.finalizou !== String(p.finalizou)) conferir.push({ n, l: l && l.cols, p });
  }
  ok("e cada número é o do “Por pessoa” dos protocolos, na mesma tela", Object.keys(s.protocolos).length > 0 && conferir.length === 0, q(conferir));
  const tratadosDaTela = await Promise.all(Object.entries(s.tratados).map(async ([n, v]) => ({ n, v, l: (await linha(page, n))?.cols.tratados })));
  const tratadosErrados = tratadosDaTela.filter((x) => x.l !== String(x.v));
  ok("e o do “Por pessoa” do Já tratei", tratadosDaTela.length > 1 && tratadosErrados.length === 0, q(tratadosDaTela));
  const carteiraErrada = (await Promise.all(Object.entries(s.carteira).filter(([n]) => n !== "sem").map(async ([n, v]) => {
    const l = await linha(page, n);
    return { n, v, l: l && { c: l.cols.carteira, a: l.cols.atrasadas } };
  }))).filter((x) => !x.l || x.l.c !== String(x.v.conversas) || x.l.a !== String(x.v.atrasadas));
  ok("e o da carteira de cada responsável", Object.keys(s.carteira).length > 1 && carteiraErrada.length === 0, q(carteiraErrada));

  // O LUCAS: só carteira. Zero no que é do período, "—" no tempo.
  const lu = await linha(page, NOMES[LUCAS]);
  ok("o Lucas, que só tem carteira, tem a linha dele", Boolean(lu), q(ns));
  ok("com zero no que é do período (ele não fez nada)",
     lu && lu.cols.atendimentos === "0" && lu.cols.enviadas === "0" && lu.cols.primeiras === "0"
        && lu.cols.finalizou === "0" && lu.cols.tratados === "0", q(lu && lu.cols));
  ok("e “—” no tempo de resposta, e não zero (zero seria “respondeu na hora”)",
     lu && lu.cols.resposta === "" && lu.cols.espera === "" && /—/.test(lu.texto), q(lu));
  ok("e a carteira dele: 1 conversa, 1 há 3+ dias", lu && lu.cols.carteira === "1" && lu.cols.atrasadas === "1", q(lu && lu.cols));
  ok("o Lucas não está no ranking de atendimentos", lu && !lu.atendente, q(lu));

  // A LINHA "PELO NOME" não junta com ninguém, e não tem as outras contas.
  const antigo = await page.evaluate(() => globalThis.__ESPERADO.autorSemId);
  const la = await linha(page, antigo);
  ok("a linha “pelo nome” está lá, marcada", la && /pelo nome/.test(la.texto), q(la));
  ok("e sem os números das contas que guardam a pessoa pelo id",
     la && la.cols.primeiras === "" && la.cols.finalizou === "" && la.cols.tratados === "" && la.cols.carteira === "", q(la && la.cols));

  // O CELULAR fica fora da tabela, e é dito.
  const n1 = await notas(page);
  ok("o protocolo respondido pelo celular não vira pessoa", !(await nomes(page)).some((n) => /celular/i.test(n)), q(await nomes(page)));
  ok("e a nota diz que ele ficou fora", /Ficaram fora da tabela 1 protocolo respondido direto pelo celular/.test(n1), n1);
  ok("a carteira de cada um está na tabela: quem administra vê a dos colegas", !/só para quem administra/.test(n1), n1);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("2")) {
  console.log("\n2. O gráfico da métrica escolhida e a ordem da tabela andam juntos");
  const { ctx, page, estouros } = await abrirPainel();
  ok("o gráfico começa pelos atendimentos", (await metrica(page)) === "atendimentos", await metrica(page));
  let b = await barras(page);
  const desc = (xs) => xs.length > 1 && xs.every((x, i) => i === 0 || Number(xs[i - 1].valor) >= Number(x.valor));
  ok("as barras, do maior para o menor", desc(b), q(b));
  ok("a barra verde é a minha (ninguém escolhido)", b.filter((x) => x.destaque).map((x) => x.nome).join() === NOMES[EU], q(b.filter((x) => x.destaque)));
  // AS LINHAS "PELO NOME" (mensagens antigas, sem conta) não são pessoas
  // para escolher: a bancada tem três delas.
  const peloNome = await page.$$eval("[data-tabela-da-equipe] [data-equipe-linha]", (ns) =>
    ns.filter((n) => /pelo nome/.test(n.innerText)).map((n) => n.getAttribute("data-equipe-linha")));
  const dePessoas = b.filter((x) => !peloNome.includes(x.nome));
  ok("quem administra clica nas barras das pessoas (são botões)", dePessoas.length > 2 && dePessoas.every((x) => x.botao), q(dePessoas.slice(0, 3)));
  const dasAntigas = b.filter((x) => peloNome.includes(x.nome));
  ok("e as barras “pelo nome” não são botões (não são pessoas para escolher)",
     dasAntigas.length > 0 && dasAntigas.every((x) => !x.botao), q(dasAntigas));
  ok("a tabela está na ordem dos atendimentos", (await ordemDaColuna(page, "atendimentos")) === "descending");

  await clicar(page, '[data-metrica-da-equipe="finalizou"]');
  b = await barras(page);
  ok("escolher “Finalizou” troca o gráfico", (await metrica(page)) === "finalizou"
     && (await page.locator("[data-titulo-do-ranking]").innerText().catch(() => "")) === "Finalizou");
  ok("as barras do Finalizou, do maior para o menor, a Jenifer primeiro", desc(b) && b[0].nome === NOMES[JEN] && b[0].valor === "2", q(b));
  ok("e a tabela vai junto: ordem do Finalizou, decrescente", (await ordemDaColuna(page, "finalizou")) === "descending"
     && (await ordemDaColuna(page, "atendimentos")) === "none");
  const ordemTabela = await nomes(page);
  ok("a primeira linha da tabela é a Jenifer", ordemTabela[0] === NOMES[JEN], q(ordemTabela));
  // A MEDIANA conta só quem finalizou algum: 2 (Jenifer) e 1 (eu) → 1,5.
  ok("a mediana da equipe conta só quem fez: 1,5 (e não zero)", /mediana da equipe: 1,5/.test(await legendaDaMediana(page)), await legendaDaMediana(page));

  await clicar(page, '[data-ordenar-equipe="finalizou"]');
  ok("o cabeçalho da mesma coluna inverte a ordem", (await ordemDaColuna(page, "finalizou")) === "ascending");
  const asc = await nomes(page);
  ok("e a tabela vira do menor para o maior, com o vazio no fim",
     asc.indexOf(NOMES[JEN]) > asc.indexOf(NOMES[ISA]) && (await linha(page, asc[asc.length - 1]))?.cols.finalizou === "", q(asc));

  await clicar(page, '[data-metrica-da-equipe="resposta"]');
  b = await barras(page);
  const crescente = b.length > 1 && b.every((x, i) => i === 0 || Number(b[i - 1].valor) <= Number(x.valor));
  ok("o tempo de resposta começa pelo mais rápido", crescente && (await ordemDaColuna(page, "resposta")) === "ascending", q(b));
  ok("e quem não respondeu ninguém não tem barra (uma barra zero seria “na hora”)",
     !b.some((x) => x.nome === NOMES[LUCAS]), q(b.map((x) => x.nome)));
  const tr = await nomes(page);
  ok("na tabela, quem não tem tempo vai para o fim", tr.indexOf(NOMES[LUCAS]) > tr.indexOf(NOMES[EU]), q(tr));

  await clicar(page, '[data-ordenar-equipe="nome"]');
  const alfa = await nomes(page);
  const ordenada = [...alfa].sort((x, y) => x.localeCompare(y, "pt-BR"));
  ok("o cabeçalho “Pessoa” põe a tabela em ordem alfabética", q(alfa) === q(ordenada), q(alfa));
  ok("e o gráfico continua no tempo de resposta", (await metrica(page)) === "resposta");

  await clicar(page, '[data-metrica-da-equipe="atrasadas"]');
  b = await barras(page);
  ok("o “há 3+ dias” começa por quem tem mais atrasadas (a Jenifer, com 2)", b[0] && b[0].nome === NOMES[JEN] && b[0].valor === "2", q(b));
  const corDoAlerta = await page.evaluate((n) => {
    const tr = [...document.querySelectorAll("[data-equipe-linha]")].find((x) => x.getAttribute("data-equipe-linha") === n);
    const td = tr && tr.querySelector('[data-coluna="atrasadas"]');
    return td ? getComputedStyle(td).color : null;
  }, NOMES[JEN]);
  ok("e o número das atrasadas sai em vermelho na tabela", corDoAlerta && /rgb\(198, 40, 40\)/.test(corDoAlerta), corDoAlerta);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("3")) {
  console.log("\n3. Escolher uma pessoa abre a ficha dela, e recorta a tela (mas não a tabela)");
  const { ctx, page, estouros } = await abrirPainel();
  ok("sem ninguém escolhido, não há ficha", (await page.locator("[data-ficha-da-pessoa]").count()) === 0);
  const antes = (await nomes(page)).length;
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[JEN]}"]`).first().click().catch(() => {});
  await page.waitForSelector("[data-ficha-da-pessoa]", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const f = await ficha(page);
  ok("clicar na Jenifer abre a ficha dela", f && f.nome === NOMES[JEN], q(f && f.nome));
  ok("o filtro da barra diz o nome dela", /JENIFER ALMEIDA/.test(await filtrando(page)), await filtrando(page));
  ok("o título da seção vira “A pessoa e a equipe”", (await page.locator("[data-secao-do-painel=equipe] h3").innerText().catch(() => "")).includes("A pessoa e a equipe"));
  ok("a ficha vem antes da tabela", await page.evaluate(() => {
    const a = document.querySelector("[data-ficha-da-pessoa]"), b = document.querySelector("[data-tabela-da-equipe]");
    return Boolean(a && b && a.getBoundingClientRect().top < b.getBoundingClientRect().top);
  }));
  ok("a ficha tem os números dela: 2 finalizados, 2 “Já tratei”, 2 primeiras",
     f && f.cols.finalizou?.valor === "2" && f.cols.tratados?.valor === "2" && f.cols.primeiras?.valor === "2", q(f && f.cols));
  ok("com a posição dela: 1º de 2 no Finalizou", f && /^1º de 2 · mediana da equipe: 1,5$/.test(f.cols.finalizou?.comparacao || ""), q(f && f.cols.finalizou));
  ok("na 1ª resposta, 1º de 3 (2 contra 1 e 1), mediana 1",
     f && /^1º de 3 · mediana da equipe: 1$/.test(f.cols.primeiras?.comparacao || ""), q(f && f.cols.primeiras));
  ok("a carteira sem posição (é volume, e não desempenho), com a mediana",
     f && /^mediana da equipe: \d/.test(f.cols.carteira?.comparacao || "") && !/º de/.test(f.cols.carteira?.comparacao || ""), q(f && f.cols.carteira));
  ok("e o detalhe da carteira: quantas esperam e a mais antiga",
     f && /2 esperando · a mais antiga há 10 dias/.test(f.cols.carteira?.detalhe || ""), q(f && f.cols.carteira));
  const lj = await linha(page, NOMES[JEN]);
  ok("a linha dela fica marcada na tabela", lj && lj.escolhida, q(lj));
  ok("e a tabela continua com todo mundo", (await nomes(page)).length === antes, `${antes} → ${(await nomes(page)).length}`);
  const b = await barras(page);
  ok("a barra verde passa a ser a dela", b.filter((x) => x.destaque).map((x) => x.nome).join() === NOMES[JEN], q(b.filter((x) => x.destaque)));
  const escopo = await page.locator('[data-teste="escopo"]').innerText().catch(() => "");
  ok("o resumo do Painel diz que são os números da pessoa escolhida, e aponta a tabela da equipe",
     /pessoa escolhida/.test(escopo) && /tabela da equipe, no alto da tela/.test(escopo), escopo.slice(0, 200));

  // UMA FICHA EMPATADA: a Isabela e eu temos 1 primeira resposta cada.
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[ISA]}"]`).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const fi = await ficha(page);
  ok("trocar de pessoa troca a ficha", fi && fi.nome === NOMES[ISA], q(fi && fi.nome));
  ok("o empate divide a posição: a Isabela é 2º de 3 na 1ª resposta (com eu)",
     fi && /^2º de 3 · mediana da equipe: 1$/.test(fi.cols.primeiras?.comparacao || ""), q(fi && fi.cols.primeiras));
  ok("sem finalizar nada, ela fica fora da posição do Finalizou",
     fi && fi.cols.finalizou?.valor === "0" && /^mediana da equipe: 1,5$/.test(fi.cols.finalizou?.comparacao || ""), q(fi && fi.cols.finalizou));

  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[ISA]}"]`).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  ok("clicar de novo nela desfaz a escolha, e a ficha some", (await page.locator("[data-ficha-da-pessoa]").count()) === 0
     && (await filtrando(page)) === "", await filtrando(page));

  // O TEMPO, NA FICHA DA CAMILA (da bancada): 13 min de resposta contra os
  // meus 15 — no tempo, o menor é o primeiro. E no "Atender" nós dois temos
  // 15 min: todo mundo empatado não tem posição.
  const camila = (await page.evaluate(() => globalThis.__ESPERADO.painel(30, null).por_atendente))
    .find((p) => p.id && p.id !== "u1" && p.resposta_mediana != null);
  ok("a bancada tem com quem comparar o tempo (uma colega com tempo de resposta)", Boolean(camila), q(camila));
  if (camila) {
    await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${camila.nome}"]`).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const fc = await ficha(page);
    ok(`no tempo de resposta, o menor é o primeiro: ${camila.nome} é 1º de 2, “o mais rápido”`,
       fc && /^1º de 2 · o mais rápido · mediana da equipe: 14 min$/.test(fc.cols.resposta?.comparacao || ""), q(fc && fc.cols.resposta));
    ok("e com todo mundo empatado no “Atender”, não há posição",
       fc && /^mediana da equipe: 15 min$/.test(fc.cols.espera?.comparacao || ""), q(fc && fc.cols.espera));
    await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${camila.nome}"]`).first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  ok("a bancada tem uma colega com tempo de resposta", Boolean(camila));

  // PELO FILTRO DA BARRA, a mesma ficha.
  await clicar(page, '[data-grupo="escopo"] > button');
  await page.locator('[data-grupo="escopo"]').getByRole("button", { name: NOMES[JEN] }).first().click().catch(() => {});
  await page.waitForSelector("[data-ficha-da-pessoa]", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  ok("escolher a pessoa no filtro da barra abre a mesma ficha", (await ficha(page))?.nome === NOMES[JEN]);
  ok("e o filtro oferece quem só tem carteira (o Lucas)", await page.evaluate((n) => {
    document.querySelector('[data-grupo="escopo"] > button')?.click();
    return new Promise((r) => setTimeout(() => {
      const tem = [...document.querySelectorAll('[data-grupo="escopo"] button')].some((b) => b.innerText.trim() === n);
      document.querySelector('[data-grupo="escopo"] > button')?.click();
      r(tem);
    }, 300));
  }, NOMES[LUCAS]));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("4")) {
  console.log("\n4. Quem não administra vê a própria ficha, e não escolhe ninguém");
  const { ctx, page, estouros } = await abrirPainel({ admin: false });
  const f = await ficha(page);
  ok("a ficha é a minha, desde a abertura", f && f.nome === NOMES[EU] && /você/.test(f.texto), q(f && f.nome));
  ok("a tabela não tem a carteira dos colegas", !(await colunas(page)).includes("carteira") && !(await colunas(page)).includes("atrasadas"), q(await colunas(page)));
  ok("e diz por quê", /A carteira de cada colega é só para quem administra/.test(await notas(page)), await notas(page));
  ok("a ficha tem a minha carteira, sem a comparação com os colegas",
     f && f.cols.carteira && /a dos colegas é só para quem administra/.test(f.cols.carteira.comparacao), q(f && f.cols.carteira));
  ok("e a minha carteira vazia é zero, e não “—”: ela veio, e não há nada nela",
     f && f.cols.carteira?.valor === "0" && f.cols.atrasadas?.valor === "0",
     q(f && { carteira: f.cols.carteira, atrasadas: f.cols.atrasadas }));
  ok("as outras contas continuam comparando com a equipe", f && /mediana da equipe/.test(f.cols.finalizou?.comparacao || ""), q(f && f.cols.finalizou));
  const b = await barras(page);
  ok("as barras não são botões: quem não administra não escolhe ninguém", b.length > 0 && b.every((x) => !x.botao), q(b.slice(0, 2)));
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[JEN]}"]`).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  ok("e clicar na linha de uma colega não muda nada", (await ficha(page))?.nome === NOMES[EU]);
  ok("nem existe o filtro de atendente", (await page.locator('[data-grupo="escopo"]').count()) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("5")) {
  console.log("\n5. Uma conta que falta tira só as colunas dela, e a tabela diz");
  {
    const { ctx, page, estouros } = await abrirPainel({ semTratados: true });
    const cs = await colunas(page);
    ok("sem a função do “Já tratei”, a coluna dele não aparece", !cs.includes("tratados") && cs.includes("finalizou") && cs.includes("atendimentos"), q(cs));
    ok("e a nota diz que ela ficou de fora", /Ficaram de fora as colunas de o “Já tratei”, que não carregaram/.test(await notas(page)), await notas(page));
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
  {
    const { ctx, page, estouros } = await abrirPainel({ protocolosFalham: true });
    const cs = await colunas(page);
    ok("com os protocolos falhando, as duas colunas deles saem", !cs.includes("primeiras") && !cs.includes("finalizou") && cs.includes("tratados"), q(cs));
    ok("e a nota diz quais", /Ficaram de fora as colunas de os protocolos/.test(await notas(page)), await notas(page));
    const jen = await linha(page, NOMES[JEN]);
    ok("o resto da linha continua certo (2 “Já tratei” da Jenifer)", jen && jen.cols.tratados === "2", q(jen && jen.cols));
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
  {
    const { ctx, page, estouros } = await abrirPainel({ semPainel: true });
    const cs = await colunas(page);
    ok("sem a função do Painel, as colunas dele saem", !cs.includes("atendimentos") && !cs.includes("resposta") && cs.includes("primeiras"), q(cs));
    ok("e o gráfico vai para a primeira métrica que veio (1ª resposta)", (await metrica(page)) === "primeiras", await metrica(page));
    ok("sem `data-atendente` em ninguém (ninguém está no ranking de atendimentos)",
       (await page.locator("[data-tabela-da-equipe] [data-atendente]").count()) === 0);
    ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
    await ctx.close();
  }
}

// ==================================================================
if (vale("6")) {
  console.log("\n6. Uma ida ao banco por conta: a tabela da equipe não lê nada de novo");
  const { ctx, page, estouros } = await abrirPainel();
  const conta = () => page.evaluate(() => {
    const c = {};
    for (const x of globalThis.__FUNCOES_CHAMADAS || []) c[x.nome] = (c[x.nome] || 0) + 1;
    return c;
  });
  const FONTES = ["painel_dashboard", "zorvin_relatorio_atendimentos", "zorvin_relatorio_tratados", "zorvin_relatorio_responsaveis"];
  const DO_PERIODO = FONTES.slice(0, 3);
  const c1 = await conta();
  // No desenvolvimento o React monta a tela duas vezes (e as leituras saem
  // duas vezes): o que se confere é que as quatro saem o MESMO número de
  // vezes — a seção que lia por conta própria e a tabela não somam idas.
  const vezes = FONTES.map((f) => c1[f] || 0);
  ok("cada uma das quatro contas é perguntada o mesmo número de vezes ao abrir",
     vezes.every((v) => v > 0) && new Set(vezes).size === 1 && vezes[0] <= 2, q(c1));
  await page.locator('[data-teste="abrir-periodo"]').click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('[data-grupo="periodo"]').getByRole("button", { name: "7 dias", exact: true }).click().catch(() => {});
  await page.waitForTimeout(2500);
  const c2 = await conta();
  const mais = DO_PERIODO.map((f) => (c2[f] || 0) - (c1[f] || 0));
  ok("trocar o período pergunta cada conta do período uma vez, e só uma", mais.length === 3 && mais.every((v) => v === 1), q({ c1, c2 }));
  ok("e a carteira, que é de agora, não é perguntada de novo",
     (c2.zorvin_relatorio_responsaveis || 0) === (c1.zorvin_relatorio_responsaveis || 0), q({ c1, c2 }));
  ok("o funil continua com a leitura dele", (c2.zorvin_relatorio_funil || 0) > 0, q(c2));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("7")) {
  console.log("\n7. Imprimir o relatório");
  const { ctx, page, estouros } = await abrirPainel({ escuro: true });
  await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[JEN]}"]`).first().click().catch(() => {});
  await page.waitForSelector("[data-ficha-da-pessoa]", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1200);
  ok("o botão “Imprimir relatório” está na barra", (await page.locator("[data-barra-do-painel] [data-imprimir-relatorio]").count()) === 1);
  await clicar(page, "[data-imprimir-relatorio]");
  const secoes = await page.$$eval("[data-menu-de-impressao] [data-secao-impressa]", (ns) => ns.map((n) => ({
    id: n.getAttribute("data-secao-impressa"), marcada: n.querySelector("input").checked, texto: n.innerText.trim() })));
  ok("o menu oferece as seis seções, todas marcadas", q(secoes.map((s) => s.id)) === q(["equipe", "protocolos", "atendimentos", "carteira", "funil", "jatratei"])
     && secoes.length === 6 && secoes.every((s) => s.marcada), q(secoes));
  ok("com a pessoa escolhida, a primeira é “A pessoa e a equipe”", secoes[0] && secoes[0].texto === "A pessoa e a equipe", q(secoes[0]));
  await page.locator('[data-secao-impressa="funil"] input').click().catch(() => {});
  await page.locator('[data-secao-impressa="jatratei"] input').click().catch(() => {});
  await page.waitForTimeout(300);
  const fora = await page.$$eval("[data-secao-do-painel]", (ns) => ns.filter((n) => n.hasAttribute("data-nao-imprime")).map((n) => n.getAttribute("data-secao-do-painel")));
  ok("desmarcar o Funil e o Já tratei os tira do papel", q(fora) === q(["funil", "jatratei"]), q(fora));
  ok("e o cabeçalho do papel diz que ficaram fora, por escolha", await page.evaluate(() =>
    /Fora deste relatório, por escolha: Funil, Já tratei\./.test(document.querySelector("[data-so-impressao]")?.textContent || "")));
  await clicar(page, "[data-imprimir-agora]");
  ok("“Imprimir” chama a impressão do navegador, uma vez", (await page.evaluate(() => globalThis.__IMPRESSOES)) === 1);
  ok("e o menu fecha", (await page.locator("[data-menu-de-impressao]").count()) === 0);
  await clicar(page, "[data-imprimir-relatorio]");
  for (const s of ["equipe", "protocolos", "atendimentos", "carteira"]) await page.locator(`[data-secao-impressa="${s}"] input`).click().catch(() => {});
  await page.waitForTimeout(300);
  const nada = await page.evaluate(() => { const b = document.querySelector("[data-imprimir-agora]"); return b ? { desligado: b.disabled, texto: b.innerText.trim() } : null; });
  ok("sem nada marcado, o botão desliga e diz por quê", nada && nada.desligado && /Escolha o que imprimir/.test(nada.texto), q(nada));
  for (const s of ["equipe", "protocolos", "atendimentos", "carteira", "funil", "jatratei"]) await page.locator(`[data-secao-impressa="${s}"] input`).click().catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("o Esc fecha o menu, e não a tela", (await page.locator("[data-menu-de-impressao]").count()) === 0
     && (await page.locator('[data-tela="painel"]').count()) === 1);

  // NO PAPEL, SEMPRE O TEMA CLARO. O evento é o do navegador: o Ctrl+P passa
  // pelo mesmo caminho.
  const fundo = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-tela="painel"]')).backgroundColor);
  const tituloAntes = await page.title();
  ok("a tela está no tema escuro", (await fundo()) !== "rgb(240, 242, 245)", await fundo());
  // NO MESMO INSTANTE DO EVENTO, e não depois: o navegador monta a folha
  // logo em seguida, e um desenho agendado chegaria tarde.
  const naHora = await page.evaluate(() => {
    window.dispatchEvent(new Event("beforeprint"));
    const t = document.querySelector('[data-tela="painel"]');
    return { fundo: getComputedStyle(t).backgroundColor, marca: t.getAttribute("data-imprimindo") };
  });
  ok("na hora de imprimir, a tela troca para o tema claro, no mesmo instante do evento",
     naHora.fundo === "rgb(240, 242, 245)" && naHora.marca === "sim", q(naHora));
  ok("e o título da guia vira o nome do arquivo do PDF", /^Relatório de atendimento — JENIFER ALMEIDA — /.test(await page.title()), await page.title());
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  const papel = await page.evaluate(() => {
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && r.height > 0; };
    const tela = document.querySelector('[data-tela="painel"]');
    const cab = document.querySelector("[data-so-impressao]");
    return {
      barra: vis("[data-barra-do-painel]"), cabecalho: vis("[data-so-impressao]"),
      linhas: [...(cab ? cab.querySelectorAll("[data-linha-do-cabecalho]") : [])].map((l) => l.innerText.replace(/\s+/g, " ").trim()),
      lista: vis("[data-protocolos-lista]"), registros: vis("[data-relatorio-registros]"), metricas: vis("[data-metricas-da-equipe]"),
      tabela: vis("[data-tabela-da-equipe]"), ficha: vis("[data-ficha-da-pessoa]"),
      posicao: getComputedStyle(tela).position, rolagem: getComputedStyle(tela).overflowY,
      conversas: [...document.querySelectorAll("#root > div > *")].filter((e) => !e.matches('[data-tela="painel"]') && getComputedStyle(e).display !== "none").length,
      largura: document.documentElement.scrollWidth, janela: window.innerWidth,
      fundoDaFolha: getComputedStyle(document.documentElement).backgroundColor,
      esquema: getComputedStyle(document.documentElement).colorScheme,
    };
  });
  ok("no papel, a barra de filtros some", papel.barra === false, q(papel));
  ok("e o cabeçalho do papel aparece, com o recorte inteiro", papel.cabecalho === true
     && papel.linhas.some((l) => /^Período \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/.test(l))
     && papel.linhas.some((l) => l === "Atendente JENIFER ALMEIDA") && papel.linhas.some((l) => /^Gerado em .* por Rodrigo Sousa$/.test(l)), q(papel.linhas));
  ok("as listas de registros e os botões das métricas ficam fora do papel", papel.lista === false && papel.registros === false && papel.metricas === false, q(papel));
  ok("a ficha e a tabela da equipe vão para o papel", papel.ficha === true && papel.tabela === true, q(papel));
  ok("a tela deixa de ser um quadro fixo que rola (senão sairia só o pedaço à vista)", papel.posicao === "static" && papel.rolagem === "visible", q(papel));
  ok("e o Zorvin que mora atrás dela não vai para o papel", papel.conversas === 0, q(papel));
  ok("a margem da folha é branca (o tema escuro mora também no <html>: o fundo e o esquema de cores)",
     papel.fundoDaFolha === "rgb(255, 255, 255)" && papel.esquema === "light", q({ fundo: papel.fundoDaFolha, esquema: papel.esquema }));
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.waitForTimeout(200);
  ok("depois de imprimir, a tela volta ao tema escuro", (await fundo()) !== "rgb(240, 242, 245)"
     && (await page.locator("[data-imprimindo]").count()) === 0, await fundo());
  ok("e o título da guia volta", (await page.title()) === tituloAntes, await page.title());

  // A FOLHA EM PÉ: a tabela da equipe cabe nos 718 pontos de uma A4.
  await page.setViewportSize({ width: 718, height: 1000 });
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(400);
  const largos = await page.evaluate(() => {
    const fora = [];
    for (const e of document.querySelectorAll('[data-tela="painel"] *')) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(e).display !== "none") fora.push(`${e.tagName.toLowerCase()} ${Math.round(r.right)}`);
    }
    return fora.slice(0, 5);
  });
  ok("numa folha A4 em pé, nada passa da largura da folha", largos.length === 0, q(largos));
  // E O PDF DE VERDADE, como o "Salvar como PDF" faz. A emulação SAI antes
  // (`null`), e não vira "screen": com "screen", o Playwright imprime a tela.
  await page.emulateMedia({ media: null });
  let paginas = 0;
  try {
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    if (process.env.PDF_DA_PROVA) (await import("node:fs")).writeFileSync(process.env.PDF_DA_PROVA, pdf);
    // O NÚMERO DE FOLHAS É O `/Count` do catálogo das páginas.
    const m = pdf.toString("latin1").match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/);
    paginas = m ? Number(m[1] || m[2]) : 0;
  } catch (e) { estouros.push(`pdf: ${e.message}`); }
  ok("o PDF sai, com várias folhas", paginas >= 2, `${paginas} folhas`);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("8")) {
  console.log("\n8. No celular");
  for (const largura of [360, 390]) {
    const { ctx, page, estouros } = await abrirPainel({ largura, altura: 844 });
    await page.locator(`[data-tabela-da-equipe] [data-equipe-linha="${NOMES[JEN]}"]`).first().click().catch(() => {});
    await page.waitForSelector("[data-ficha-da-pessoa]", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const barra = document.querySelector("[data-barra-do-painel]");
      const rot = document.querySelector("[data-rotulo-de-imprimir]");
      const bt = document.querySelector("[data-imprimir-relatorio]");
      const linha = document.querySelector("[data-barra-da-equipe]");
      const nome = linha && linha.querySelector("[data-nome-do-ranking]"), trilho = linha && linha.querySelector("[data-trilho-do-ranking]");
      const met = [...document.querySelectorAll("[data-metrica-da-equipe]")].map((b) => Math.round(b.getBoundingClientRect().top));
      const tiles = [...document.querySelectorAll("[data-ficha-coluna]")].slice(0, 2).map((t) => Math.round(t.getBoundingClientRect().top));
      return {
        rolaDeLado: document.documentElement.scrollWidth > window.innerWidth + 1,
        telaRolaDeLado: (() => { const t = document.querySelector('[data-tela="painel"]'); return t.scrollWidth > t.clientWidth + 1; })(),
        barra: barra ? getComputedStyle(barra).position : null,
        rotulo: rot ? getComputedStyle(rot).display : null, botao: bt ? Math.round(bt.getBoundingClientRect().height) : 0,
        duasLinhas: Boolean(nome && trilho && trilho.getBoundingClientRect().top >= nome.getBoundingClientRect().bottom - 1),
        trilho: trilho ? Math.round(trilho.getBoundingClientRect().width) : 0,
        metricasNumaLinha: met.length > 3 && new Set(met).size === 1,
        fichaLadoALado: tiles.length === 2 && tiles[0] === tiles[1],
      };
    });
    ok(`a ${largura}: nada rola de lado`, !m.rolaDeLado && !m.telaRolaDeLado, q(m));
    ok(`a ${largura}: a barra não gruda no alto (ela cobriria um terço da tela)`, m.barra === "static", q(m));
    ok(`a ${largura}: o botão de imprimir só com o ícone, e com o alvo de dedo`, m.rotulo === "none" && m.botao >= 36, q(m));
    ok(`a ${largura}: o ranking em duas linhas, com a barra de ponta a ponta`, m.duasLinhas && m.trilho > largura * 0.6, q(m));
    ok(`a ${largura}: as métricas numa linha só, que rola de lado`, m.metricasNumaLinha, q(m));
    ok(`a ${largura}: os números da ficha lado a lado, dois por linha`, m.fichaLadoALado, q(m));
    ok(`a ${largura}: sem estouro de JavaScript`, estouros.length === 0, q(estouros));
    await ctx.close();
  }
}

// ==================================================================
if (vale("9")) {
  console.log("\n9. Os atalhos das seções");
  const { ctx, page, estouros } = await abrirPainel();
  await page.waitForTimeout(800);
  const atalhos = await page.$$eval("[data-nav-do-painel] [data-ir-para]", (ns) => ns.map((n) => n.getAttribute("data-ir-para")));
  ok("os atalhos das seis seções estão na barra", q(atalhos) === q(["equipe", "protocolos", "atendimentos", "carteira", "funil", "jatratei"]), q(atalhos));
  await clicar(page, '[data-ir-para="jatratei"]');
  await page.waitForTimeout(900);
  // Guardado: sem a seção ou sem a barra, a conferência reprova dizendo o
  // que faltou, em vez de a prova parar aqui sem dizer as seguintes.
  const pos = await page.evaluate(() => {
    const s = document.querySelector('[data-secao-do-painel="jatratei"]'), b = document.querySelector("[data-barra-do-painel]");
    if (!s || !b) return { secao: s ? "existe" : null, barra: b ? "existe" : null };
    return { secao: Math.round(s.getBoundingClientRect().top), barra: Math.round(b.getBoundingClientRect().bottom) };
  });
  ok("o atalho do Já tratei leva a seção para logo abaixo da barra",
     typeof pos.secao === "number" && typeof pos.barra === "number" && pos.secao >= pos.barra - 2 && pos.secao <= pos.barra + 40, q(pos));
  await clicar(page, '[data-ir-para="equipe"]');
  await page.waitForTimeout(900);
  ok("e o da equipe volta ao alto", (await page.evaluate(() => document.querySelector('[data-tela="painel"]').scrollTop)) < 40);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

const pedidas = CENAS.filter((c) => !TODAS.includes(c));
ok("toda cena pedida em CENAS existe", pedidas.length === 0, q(pedidas));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
