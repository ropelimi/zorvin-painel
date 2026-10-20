// A CONTABILIZAÇÃO DOS ATENDIMENTOS — os protocolos no Painel de números
//
// Pedido do Rodrigo em 20/10, depois das abas do 028: a "contabilização" do
// DataCrazy — quantos atendimentos, quanto o cliente esperou pela primeira
// resposta, quanto levou até finalizar. A conta é do banco (script 029 da
// ponte, provado num Postgres de verdade na seção 68 de lá); esta prova é a
// TELA, com a bancada fazendo a mesma conta.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. SÓ ENTRA NO TOTAL O QUE A EQUIPE COMEÇOU — a regra do DataCrazy. O
//      protocolo que ninguém respondeu nem finalizou fica à parte, em
//      "Esperando resposta", inclusive o do cliente que voltou a escrever
//      numa conversa finalizada;
//   2. as contas fecham: o total é a soma dos em atendimento com os
//      finalizados; e o período anterior compara só o total;
//   3. os tempos, em mediana, com a média ao lado;
//   4. o "por pessoa" mostra todo mundo, e o celular numa linha própria;
//   5. quem não administra vê os de que participou, e o recorte é do banco;
//   6. a barra de cima recorta (telefone, pessoa);
//   7. sem a função, quem administra lê o que falta e quem atende não vê
//      nada; com a função falhando, a tela diz — com o código;
//   8. e o caminho inteiro: finalizar na conversa e ver o protocolo entrar
//      no total. Sem esta cena, a prova passaria com a bancada inventando
//      números que a tela nunca gravou.
//
// OS PROTOCOLOS DA SEMENTE, em horas antes de agora (é deles que saem os
// números das conferências):
//   A1  ANA      o cliente em 10, o Rodrigo responde 30 min depois
//   A2  BETO     o cliente em 20, a Jenifer responde em 2 h, o Rodrigo finaliza em 16
//   A3  CAIO     o cliente em 5, e ninguém responde
//   A4  DORA     o Rodrigo começa a conversa em 30, a Jenifer finaliza em 28
//   A5  EDU      o cliente em 40, respondido pelo CELULAR em 1 h
//   A6  FABI     o cliente em 50, o Rodrigo responde em 1 h, a Jenifer finaliza
//                em 48 — e a cliente VOLTA em 3: protocolo novo, sem resposta
//   A9  GIL      no OUTRO telefone: o cliente em 12, a Jenifer responde em 1 h
//   A7  HELO     40 dias atrás, atendida — o período anterior
//   A8  IVO      100 dias atrás — fora dos dois
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira — a lição da prova do "Já tratei":
// duas chamadas a `Date.now()` para o mesmo instante caem em milissegundos
// diferentes.
const AGORA = Date.now();
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();

/** Os dois telefones: o que o painel abre, e outro qualquer. */
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
    return c && outro ? { adv: c.advogado_id, outro: outro.id, outroNome: outro.nome || outro.numero } : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefones();
ok("aprendi os dois telefones", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const NOMES = { A1: "ANA DO PRIMEIRO", A2: "BETO FINALIZADO", A3: "CAIO SEM RESPOSTA", A4: "DORA DA EQUIPE",
                A5: "EDU DO CELULAR", A6: "FABI QUE VOLTOU", A7: "HELO DO MES PASSADO", A8: "IVO DE MUITO ANTES",
                A9: "GIL DO OUTRO TELEFONE" };
const P = { A1: "2026-000501", A2: "2026-000502", A3: "2026-000503", A4: "2026-000504", A5: "2026-000505",
            A6a: "2026-000506", A6b: "2026-000507", A7: "2026-000508", A8: "2026-000509", A9: "2026-000510" };
const contato = (k, n) => ({ id: `ct-${k}`, numero: `55119700077${String(n).padStart(2, "0")}`, nome: NOMES[k],
  vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CT = Object.fromEntries(Object.keys(NOMES).map((k, i) => [k, contato(k, i + 1)]));
const conversa = (k, adv, campos) => ({
  id: `cv-${k}`, advogado_id: adv, contato_id: CT[k].id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null, esperando_desde: null,
  ultima_atividade: H(1), ultima_mensagem: "oi",
  contato: { id: CT[k].id, nome: CT[k].nome, numero: CT[k].numero, foto_url: null }, ...campos,
});
let nMsg = 0;
const msg = (k, origem, quando, por = null) => ({
  id: `m-${k}-${++nMsg}`, conversa_id: `cv-${k}`, origem, tipo: "texto", texto: origem === "contato" ? "oi" : "olá",
  criado_em: quando, id_uazapi: `CT-${k}-${nMsg}`,
  ...(origem === "advogado"
    ? (por === "WhatsApp" ? { enviado_por: "WhatsApp", enviado_por_id: null }
       : { enviado_por: por === "u1" ? "Rodrigo Sousa" : "JENIFER ALMEIDA", enviado_por_id: por })
    : {}),
});
const at = (id, protocolo, k, aberto_em, origem, resposta, fim, por) => ({
  id, protocolo, conversa_id: `cv-${k}`, aberto_em, origem, aberto_por: null,
  primeira_resposta_em: resposta, finalizado_em: fim, finalizado_por: por,
});

function semente() {
  return {
    contatos: Object.values(CT),
    conversas: [
      conversa("A1", TEL.adv, { situacao: "aberto", protocolo: P.A1, ultima_atividade: H(9.5) }),
      conversa("A2", TEL.adv, { situacao: "finalizado", protocolo: P.A2, ultima_atividade: H(16), tratada_em: H(16) }),
      conversa("A3", TEL.adv, { situacao: "aguardando", protocolo: P.A3, ultima_atividade: H(5), esperando_desde: H(5) }),
      conversa("A4", TEL.adv, { situacao: "finalizado", protocolo: P.A4, ultima_atividade: H(28), tratada_em: H(28) }),
      conversa("A5", TEL.adv, { situacao: "aberto", protocolo: P.A5, ultima_atividade: H(39) }),
      conversa("A6", TEL.adv, { situacao: "aberto", protocolo: P.A6b, ultima_atividade: H(3), esperando_desde: H(3) }),
      conversa("A7", TEL.adv, { situacao: "aberto", protocolo: P.A7, ultima_atividade: H(40 * 24 - 1) }),
      conversa("A8", TEL.adv, { situacao: "aberto", protocolo: P.A8, ultima_atividade: H(100 * 24 - 1) }),
      conversa("A9", TEL.outro, { situacao: "aberto", protocolo: P.A9, ultima_atividade: H(11) }),
    ],
    mensagens: [
      msg("A1", "contato", H(10)), msg("A1", "advogado", H(9.5), "u1"),
      msg("A2", "contato", H(20)), msg("A2", "advogado", H(18), "u-jenifer"),
      msg("A3", "contato", H(5)),
      msg("A4", "advogado", H(30), "u1"),
      msg("A5", "contato", H(40)), msg("A5", "advogado", H(39), "WhatsApp"),
      msg("A6", "contato", H(50)), msg("A6", "advogado", H(49), "u1"), msg("A6", "contato", H(3)),
      msg("A7", "contato", H(40 * 24)), msg("A7", "advogado", H(40 * 24 - 1), "u1"),
      msg("A8", "contato", H(100 * 24)), msg("A8", "advogado", H(100 * 24 - 1), "u1"),
      msg("A9", "contato", H(12)), msg("A9", "advogado", H(11), "u-jenifer"),
    ],
    zorvin_atendimentos: [
      at("at-A1", P.A1, "A1", H(10), "cliente", H(9.5), null, null),
      at("at-A2", P.A2, "A2", H(20), "cliente", H(18), H(16), "u1"),
      at("at-A3", P.A3, "A3", H(5), "cliente", null, null, null),
      at("at-A4", P.A4, "A4", H(30), "equipe", H(30), H(28), "u-jenifer"),
      at("at-A5", P.A5, "A5", H(40), "cliente", H(39), null, null),
      at("at-A6a", P.A6a, "A6", H(50), "cliente", H(49), H(48), "u-jenifer"),
      at("at-A6b", P.A6b, "A6", H(3), "cliente", null, null, null),
      at("at-A7", P.A7, "A7", H(40 * 24), "cliente", H(40 * 24 - 1), null, null),
      at("at-A8", P.A8, "A8", H(100 * 24), "cliente", H(100 * 24 - 1), null, null),
      at("at-A9", P.A9, "A9", H(12), "cliente", H(11), null, null),
    ],
  };
}

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ admin = true, semFuncao = false, semSituacao = false, falha = false, largura = 1400 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEM_CONTABILIZACAO = d.semFuncao;
    globalThis.__CONTABILIZACAO_FALHA = d.falha;
    globalThis.__SEM_SITUACAO = d.semSituacao;
    globalThis.__SEM_RELATORIO = false;
    globalThis.__RELATORIO_FALHA = false;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__CLIQUE_NAO_FINALIZA = false;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: semente(), admin, semFuncao, semSituacao, falha });
  await page.goto(ENDERECO);
  // QUEM NÃO ADMINISTRA pode não enxergar conversa nenhuma na bancada: espera-se
  // a tela, e não a lista.
  if (admin) await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  else await page.getByRole("button", { name: "Menu" }).waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  return { ctx, page, estouros };
}

async function irAoPainel(page) {
  await page.getByRole("button", { name: "Menu" }).click({ timeout: 5000 }).catch(() => {});
  await page.getByRole("button", { name: "Painel" }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForSelector('[data-tela="painel"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const R = "[data-relatorio-protocolos]";
const cartao = async (page, etiqueta) => {
  const el = page.locator(`${R} [data-cartao="${etiqueta}"] [data-valor]`);
  if (!(await el.count())) return null;
  return (await el.first().getAttribute("data-valor")) || "";
};
const notaDoCartao = (page, etiqueta) => page.locator(`${R} [data-cartao="${etiqueta}"]`).first().innerText().catch(() => "");
const pessoa = async (page, nome) => {
  const l = page.locator(`${R} [data-pessoa-nos-protocolos="${nome}"]`);
  if (!(await l.count())) return null;
  return { primeiras: await l.first().locator("[data-primeiras]").getAttribute("data-primeiras").catch(() => null),
           finalizou: await l.first().locator("[data-finalizou]").getAttribute("data-finalizou").catch(() => null),
           texto: ((await l.first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim() };
};
const lista = (page) => page.evaluate((r) => [...document.querySelectorAll(`${r} [data-protocolo-no-relatorio]`)].map((e) => ({
  p: e.getAttribute("data-protocolo-no-relatorio"), estado: e.getAttribute("data-estado"),
  texto: (e.innerText || "").replace(/\s+/g, " ").trim() })), R);

// ==================================================================
//  1. QUEM ADMINISTRA — o escritório inteiro
// ==================================================================
console.log("\nQuem administra vê os protocolos do escritório, e só conta o que a equipe começou");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irAoPainel(page);
  ok("a seção dos protocolos aparece no Painel", (await page.locator(R).count()) === 1);
  // VEM PRIMEIRO: é a conta que o Rodrigo pediu, e o resumo de mensagens de
  // baixo tem outro sentido de "atendimento".
  const posicoes = await page.evaluate((r) => ({
    protocolos: document.querySelector(r)?.getBoundingClientRect().top ?? null,
    resumo: document.querySelector('[data-teste="escopo"]')?.getBoundingClientRect().top ?? null,
  }), R);
  ok("e vem antes do resumo de mensagens", posicoes.protocolos != null && posicoes.resumo != null && posicoes.protocolos < posicoes.resumo,
     JSON.stringify(posicoes));
  const escopo = await page.locator(`${R} [data-protocolos-escopo]`).innerText().catch(() => "");
  ok("a seção diz a regra do total", /Só entra no total o que a equipe começou/.test(escopo), escopo);
  ok("e avisa que o “Atendimentos” de baixo é outra conta", /cartão “Atendimentos” mais abaixo é outra conta/.test(escopo), escopo);

  ok("o total: 6 (A1, A2, A4, A5, A6 e A9) — o que ninguém tocou não entra",
     (await cartao(page, "Total de atendimentos")) === "6", await cartao(page, "Total de atendimentos"));
  ok("em atendimento 3 e finalizados 3: as contas fecham",
     (await cartao(page, "Em atendimento")) === "3" && (await cartao(page, "Finalizados")) === "3",
     `${await cartao(page, "Em atendimento")} / ${await cartao(page, "Finalizados")}`);
  ok("esperando resposta: 2 (o CAIO e a FABI, que voltou)", (await cartao(page, "Esperando resposta")) === "2",
     await cartao(page, "Esperando resposta"));
  ok("o período anterior entra no total, e só nele: 1", /no período anterior: 1|que no período anterior/.test(await notaDoCartao(page, "Total de atendimentos"))
     && !/período anterior/.test(await notaDoCartao(page, "Em atendimento")), await notaDoCartao(page, "Total de atendimentos"));
  ok("até a primeira resposta: mediana de 1 h (5 casos), média de 1 h 6 min",
     (await cartao(page, "Até a primeira resposta")) === "3600"
     && /média 1 h 6 min · 5 casos/.test(await notaDoCartao(page, "Até a primeira resposta")),
     `${await cartao(page, "Até a primeira resposta")} · ${await notaDoCartao(page, "Até a primeira resposta")}`);
  ok("até finalizar: mediana de 2 h (3 casos), média de 2 h 40 min",
     (await cartao(page, "Até finalizar")) === "7200"
     && /média 2 h 40 min · 3 casos/.test(await notaDoCartao(page, "Até finalizar")),
     `${await cartao(page, "Até finalizar")} · ${await notaDoCartao(page, "Até finalizar")}`);

  const jen = await pessoa(page, "JENIFER ALMEIDA"), rod = await pessoa(page, "Rodrigo Sousa"), cel = await pessoa(page, "Pelo celular");
  ok("por pessoa: a Jenifer deu 2 primeiras respostas e finalizou 2", jen && jen.primeiras === "2" && jen.finalizou === "2", JSON.stringify(jen));
  ok("o Rodrigo deu 2 e finalizou 1, com 45 min de mediana", rod && rod.primeiras === "2" && rod.finalizou === "1" && /45 min/.test(rod.texto), JSON.stringify(rod));
  ok("a resposta pelo celular tem linha própria", cel && cel.primeiras === "1" && cel.finalizou === "0", JSON.stringify(cel));
  const ordem = await page.$$eval(`${R} [data-pessoa-nos-protocolos]`, (ls) => ls.map((l) => l.getAttribute("data-pessoa-nos-protocolos")));
  ok("quem fez mais vem primeiro", ordem.join("|") === "JENIFER ALMEIDA|Rodrigo Sousa|Pelo celular", ordem.join("|"));

  const ls = await lista(page);
  ok("a lista traz os 8 protocolos do período, do mais novo para o mais velho",
     ls.map((x) => x.p).join(",") === [P.A6b, P.A3, P.A1, P.A9, P.A2, P.A4, P.A5, P.A6a].join(","), ls.map((x) => x.p).join(","));
  const a6b = ls.find((x) => x.p === P.A6b), a5 = ls.find((x) => x.p === P.A5), a2 = ls.find((x) => x.p === P.A2),
        a4 = ls.find((x) => x.p === P.A4);
  ok("o protocolo novo da cliente que voltou espera resposta", a6b && a6b.estado === "sem_resposta" && /esperando resposta/.test(a6b.texto),
     JSON.stringify(a6b));
  ok("o do celular diz que foi respondido pelo celular", a5 && /Respondido em 1 h, pelo celular/.test(a5.texto), JSON.stringify(a5));
  ok("o finalizado diz quem respondeu, quem finalizou e em quanto tempo",
     a2 && a2.estado === "finalizado" && /Respondido em 2 h por JENIFER ALMEIDA/.test(a2.texto) && /Finalizado por Rodrigo Sousa em 4 h/.test(a2.texto),
     JSON.stringify(a2));
  ok("o começado pela equipe não finge uma espera", a4 && /a equipe começou a conversa/.test(a4.texto) && !/Respondido em/.test(a4.texto),
     JSON.stringify(a4));
  ok("nada do período anterior nem de antes na lista", !ls.some((x) => x.p === P.A7 || x.p === P.A8));

  // OS DIAS SEM NADA TAMBÉM APARECEM, como zero, e as duas séries vão juntas.
  const tabela = page.locator(`${R} button[title="Ver os números"]`).first();
  let linhas = [];
  if (await tabela.count()) {
    await tabela.click(); await page.waitForTimeout(300);
    linhas = await page.$$eval(`${R} table tbody tr`, (ts) => ts.map((t) => [...t.querySelectorAll("td")].map((c) => c.textContent.trim())));
    await page.locator(`${R} button[title="Ver o gráfico"]`).first().click().catch(() => {});
  }
  const porDia = linhas.filter((l) => l.length === 3);
  ok("o “por dia” traz o período inteiro, com as duas séries", porDia.length >= 30, `linhas: ${porDia.length}`);
  ok("e a soma dos dias bate com os cartões: 6 com atendimento e 2 esperando",
     porDia.reduce((s, l) => s + Number(l[1]), 0) === 6 && porDia.reduce((s, l) => s + Number(l[2]), 0) === 2,
     JSON.stringify(porDia.filter((l) => l[1] !== "0" || l[2] !== "0")));

  // A PLANILHA.
  const baixar = page.locator(`${R} [data-protocolos-baixar]`);
  let csv = "";
  if (await baixar.count()) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), baixar.click()]);
    if (dl) { const fs = await import("node:fs"); csv = fs.readFileSync(await dl.path(), "utf8"); }
  }
  ok("a planilha baixa, com acento (BOM) e separada por ponto e vírgula",
     csv.startsWith("\ufeff") && csv.split("\r\n")[0].includes('"Protocolo";"Aberto em"'), csv.slice(0, 80));
  ok("e leva cada protocolo, com os tempos em minutos",
     csv.split("\r\n").length === 9 && new RegExp(`"${P.A1}".*"Rodrigo Sousa";"30"`).test(csv) && /"Pelo celular";"60"/.test(csv),
     csv.split("\r\n").slice(1, 4).join(" || "));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));

  // RECORTAR NUMA PESSOA pelo "por pessoa".
  await page.locator(`${R} [data-pessoa-nos-protocolos="JENIFER ALMEIDA"]`).click().catch(() => {});
  await page.waitForTimeout(1500);
  ok("clicando na Jenifer, a seção recorta nela: 4, 1 em atendimento e 3 finalizados",
     (await cartao(page, "Total de atendimentos")) === "4" && (await cartao(page, "Em atendimento")) === "1"
     && (await cartao(page, "Finalizados")) === "3",
     `${await cartao(page, "Total de atendimentos")} / ${await cartao(page, "Em atendimento")} / ${await cartao(page, "Finalizados")}`);
  ok("e o “Esperando resposta” sai: não é de ninguém", (await cartao(page, "Esperando resposta")) === null);
  ok("o “por pessoa” continua mostrando todo mundo", Boolean(await pessoa(page, "Rodrigo Sousa")) && Boolean(await pessoa(page, "Pelo celular")));
  await ctx.close();
}

// ==================================================================
//  2. A BARRA DE CIMA RECORTA
// ==================================================================
console.log("\nO filtro de telefone da barra recorta os protocolos");
{
  const { ctx, page } = await abrirPainel();
  await irAoPainel(page);
  await page.locator('[data-grupo="telefone"] > button').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.locator('[data-grupo="telefone"]').getByRole("button", { name: TEL.outroNome }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const ls = await lista(page);
  ok("só o protocolo do outro telefone", ls.map((x) => x.p).join(",") === P.A9, ls.map((x) => x.p).join(","));
  ok("e as contas acompanham: 1, em atendimento, e ninguém esperando",
     (await cartao(page, "Total de atendimentos")) === "1" && (await cartao(page, "Esperando resposta")) === "0",
     `${await cartao(page, "Total de atendimentos")} / ${await cartao(page, "Esperando resposta")}`);
  await ctx.close();
}

// ==================================================================
//  3. QUEM NÃO ADMINISTRA — os de que participou
// ==================================================================
console.log("\nQuem não administra vê os protocolos de que participou — e o “por pessoa” compara todo mundo");
{
  const { ctx, page, estouros } = await abrirPainel({ admin: false });
  await irAoPainel(page);
  const escopo = await page.locator(`${R} [data-protocolos-escopo]`).innerText().catch(() => "");
  ok("a seção fala de você, e do que conta como seu", /você/.test(escopo) && /deu a primeira resposta, finalizou ou reabriu/.test(escopo), escopo);
  ok("os seus: 4 (respondeu A1, A4 e A6; finalizou A2), 1 em atendimento e 3 finalizados",
     (await cartao(page, "Total de atendimentos")) === "4" && (await cartao(page, "Em atendimento")) === "1"
     && (await cartao(page, "Finalizados")) === "3",
     `${await cartao(page, "Total de atendimentos")} / ${await cartao(page, "Em atendimento")} / ${await cartao(page, "Finalizados")}`);
  ok("o “Esperando resposta” não aparece para quem atende", (await cartao(page, "Esperando resposta")) === null);
  ok("os tempos são os seus: 45 min até responder, em 2 casos; 4 h até finalizar, em 1",
     (await cartao(page, "Até a primeira resposta")) === "2700" && /2 casos/.test(await notaDoCartao(page, "Até a primeira resposta"))
     && (await cartao(page, "Até finalizar")) === "14400" && /1 caso\b/.test(await notaDoCartao(page, "Até finalizar")),
     `${await cartao(page, "Até a primeira resposta")} · ${await cartao(page, "Até finalizar")}`);
  ok("a lista tem os seus 4", (await lista(page)).length === 4, JSON.stringify((await lista(page)).map((x) => x.p)));
  ok("o “por pessoa” mostra a Jenifer e o celular também",
     Boolean(await pessoa(page, "JENIFER ALMEIDA")) && Boolean(await pessoa(page, "Pelo celular")));
  // O RECORTE É DO BANCO: pedir "todo mundo" por fora devolve o recorte assim
  // mesmo. É o que separa recorte de sugestão.
  const forcado = await page.evaluate(async () => {
    const m = await import("/src/supabase.js");
    const { data } = await m.supabase.rpc("zorvin_relatorio_atendimentos", { p_quem: null, p_limite: 500 });
    return data ? { so_meu: data.so_meu, n: data.total.atendimentos, esperando: data.total.sem_resposta } : null;
  });
  ok("pedir “todo mundo” por fora não devolve todo mundo", forcado && forcado.so_meu && forcado.esperando === null,
     JSON.stringify(forcado));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. SEM A FUNÇÃO, SEM O 028, E COM A FUNÇÃO FALHANDO
// ==================================================================
console.log("\nSem a função, sem o 028, e com a função falhando");
{
  const a = await abrirPainel({ semFuncao: true });
  await irAoPainel(a.page);
  const falta = await a.page.locator(`${R} [data-protocolos-falta]`).innerText().catch(() => "");
  ok("quem administra lê que falta a atualização 029, e onde conferir",
     (await a.page.locator(`${R} [data-protocolos-falta="029"]`).count()) === 1 && /029/.test(falta) && /Atualizações do banco/.test(falta), falta);
  ok("e o resto do Painel continua lá", (await a.page.locator('[data-teste="escopo"]').count()) === 1);
  await a.ctx.close();

  const b = await abrirPainel({ semFuncao: true, admin: false });
  await irAoPainel(b.page);
  ok("quem atende não vê aviso de atualização nenhum", (await b.page.locator(R).count()) === 0);
  await b.ctx.close();

  const c = await abrirPainel({ semSituacao: true });
  await irAoPainel(c.page);
  ok("sem o 028, a seção diz que os protocolos ainda não existem",
     (await c.page.locator(`${R} [data-protocolos-falta="028"]`).count()) === 1
     && /028/.test(await c.page.locator(`${R} [data-protocolos-falta]`).innerText().catch(() => "")));
  await c.ctx.close();

  // FALHA NÃO É AUSÊNCIA.
  const d = await abrirPainel({ falha: true });
  await irAoPainel(d.page);
  const erro = await d.page.locator(`${R} [data-protocolos-erro]`).innerText().catch(() => "");
  ok("com a função falhando, a tela DIZ — e com o código", /Não consegui somar os protocolos/.test(erro) && /57014/.test(erro), erro);
  ok("e não finge zero", (await d.page.locator(`${R} [data-cartao]`).count()) === 0);
  await d.ctx.close();
}

// ==================================================================
//  5. O CAMINHO INTEIRO — finalizar na conversa e ver no Painel
// ==================================================================
console.log("\nO caminho inteiro: finalizar o protocolo que esperava e vê-lo entrar no total");
{
  const { ctx, page, estouros } = await abrirPainel();
  // O CAIO está em "Novos": ninguém o atendeu.
  await page.locator('[data-aba-da-situacao="aguardando"]').click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator(`[data-conversa-nome="${NOMES.A3}"]`).first().click().catch(() => {});
  await page.waitForTimeout(1300);
  await page.locator('[data-ja-tratei="tratar"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator("[data-assunto-do-ja-tratei] input").first().check().catch(() => {});
  await page.locator("[data-ja-tratei-confirmar]").first().click().catch(() => {});
  await page.waitForTimeout(1800);
  const fim = await page.evaluate((p) => (globalThis.__TABELAS.zorvin_atendimentos || []).find((a) => a.protocolo === p)?.finalizado_em || null, P.A3);
  ok("(o protocolo do CAIO foi finalizado pela tela)", Boolean(fim), String(fim));
  await irAoPainel(page);
  ok("o total passa a 7: finalizar é a equipe começando (e terminando)",
     (await cartao(page, "Total de atendimentos")) === "7" && (await cartao(page, "Finalizados")) === "4",
     `${await cartao(page, "Total de atendimentos")} / ${await cartao(page, "Finalizados")}`);
  ok("e só a FABI continua esperando resposta", (await cartao(page, "Esperando resposta")) === "1", await cartao(page, "Esperando resposta"));
  const a3 = (await lista(page)).find((x) => x.p === P.A3);
  ok("na lista, ele diz quem finalizou", a3 && a3.estado === "finalizado" && /Finalizado por Rodrigo Sousa/.test(a3.texto), JSON.stringify(a3));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
