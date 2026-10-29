// O PERÍODO E A PESSOA DO PAINEL DE NÚMEROS (auditoria de 28/10)
//
// Dois defeitos da barra de filtros, os dois com a tela afirmando uma coisa e
// o banco recebendo outra.
//
// 1. AS SETAS ANDAVAM EM MILISSEGUNDOS, E NÃO EM DIAS. `passear` somava
//    `fimDoDia(até) - inicioDoDia(de)` — um dia menos um milissegundo — e o
//    período seguinte terminava às 00:00 do dia de depois; o passo seguinte
//    engolia esse dia. Medido pelo revisor, no fuso de São Paulo: "Hoje" ← ←
//    mostrava "25/10/2026" cobrindo 48 h; "7 dias" ← dizia "8 dias"; ← →
//    voltava cobrindo 5,5 dias com o rótulo "7 dias"; e depois de "Ontem"
//    (alcançado pela seta) a seta → não saía do lugar. "Este ano" ← andava
//    301 dias, e não um ano.
//
// 2. A PESSOA ESCOLHIDA GANHAVA O NOME DE QUEM ADMINISTRA. Quem não estava
//    em `por_atendente` (a Jenifer, escolhida no "Por pessoa" do Já tratei;
//    ou a Camila num mês em que ela não atendeu) virava `meuNome` no
//    "Filtrando por:". E `so_meu` vale "há um recorte por pessoa" no banco,
//    então quem administra lia "Estes são os seus números" sobre os números
//    de outra pessoa.
//
// O QUE ESTA PROVA GUARDA: o período que VAI AO BANCO a cada seta (anotado
// pela bancada em `__FUNCOES_CHAMADAS`, porque o rótulo não mostra o
// milissegundo), o rótulo do botão, e o nome e as frases da pessoa
// escolhida — com o contraste de quem escolhe a si mesmo.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();

// UM "AGORA" SÓ para a semente: dois `Date.now()` caem em milissegundos
// diferentes (a lição de `o-relatorio-do-ja-tratei`).
const AGORA = Date.now();
const diasAtras = (d) => new Date(AGORA - d * 86400e3).toISOString();

async function abrirPainel({ semente = null } = {}) {
  // NO FUSO DO ESCRITÓRIO: foi nele que o revisor mediu.
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__SOU_ADMIN = true;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__FUNCOES_CHAMADAS = [];
  }, semente);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Painel" }).click();
  await page.waitForSelector('[data-tela="painel"]');
  await page.waitForSelector('[data-teste="escopo"]', { timeout: 15000 });
  return { ctx, page, estouros };
}

const rotulo = (page) => page.locator('[data-teste="abrir-periodo"]').innerText().then((t) => t.trim()).catch(() => "");
async function atalho(page, nome) {
  await page.locator('[data-teste="abrir-periodo"]').click();
  await page.waitForSelector('[data-grupo="periodo"]');
  await page.locator('[data-grupo="periodo"]').getByRole("button", { name: nome, exact: true }).click();
  await page.waitForTimeout(700);
}
async function seta(page, sentido) {
  await page.getByRole("button", { name: sentido < 0 ? "Período anterior" : "Período seguinte" }).click();
  await page.waitForTimeout(700);
}

/** O ÚLTIMO PERÍODO QUE FOI AO BANCO, lido no relógio da página: em que dia
 *  começa e termina, se começa no primeiro milissegundo do dia, se termina
 *  no último (ou "agora"), e quantos dias de calendário cobre. */
const periodoNoBanco = (page) => page.evaluate(() => {
  const chamadas = (globalThis.__FUNCOES_CHAMADAS || []).filter((c) => c.nome === "painel_dashboard");
  const ultima = chamadas[chamadas.length - 1];
  if (!ultima) return null;
  const d = new Date(ultima.args.p_desde), a = new Date(ultima.args.p_ate);
  const dia = (x) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
  const zero = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return {
    de: dia(d), ate: dia(a),
    comecaNoInicio: d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0,
    terminaNoFim: a.getHours() === 23 && a.getMinutes() === 59 && a.getSeconds() === 59 && a.getMilliseconds() === 999,
    terminaAgora: Math.abs(Date.now() - a.getTime()) < 120000,
    dias: Math.round((zero(a) - zero(d)) / 86400e3) + 1,
  };
});

/** As datas de que a prova fala, no relógio da página. */
const DATAS = async (page) => page.evaluate(() => {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const desloca = (n) => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x; };
  const dia = (x) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
  const curta = (x) => dia(x).slice(0, 5);
  const ano = hoje.getFullYear();
  const diasNoAno = (a) => Math.round((new Date(a + 1, 0, 1) - new Date(a, 0, 1)) / 86400e3);
  return {
    hoje: dia(hoje), ontem: dia(desloca(-1)), anteontem: dia(desloca(-2)),
    menos6: dia(desloca(-6)), menos7: dia(desloca(-7)), menos13: dia(desloca(-13)),
    semana: `${curta(desloca(-13))} – ${curta(desloca(-7))} · 7 dias`,
    ano, anoPassado: ano - 1, diasDoAnoPassado: diasNoAno(ano - 1),
    primeiroDoAno: dia(new Date(ano, 0, 1)), primeiroDoAnoPassado: dia(new Date(ano - 1, 0, 1)),
    ultimoDoAnoPassado: dia(new Date(ano - 1, 11, 31)),
  };
});

// ==================================================================
console.log("\n1. Hoje, e um dia de cada vez para trás e para a frente");
{
  const { ctx, page, estouros } = await abrirPainel();
  const D = await DATAS(page);
  await atalho(page, "Hoje");
  ok("o atalho “Hoje” escreve Hoje", (await rotulo(page)) === "Hoje", await rotulo(page));

  await seta(page, -1);
  let p = await periodoNoBanco(page);
  ok("← de Hoje: o botão diz Ontem", (await rotulo(page)) === "Ontem", await rotulo(page));
  ok("e o banco recebe ONTEM inteiro, da meia-noite ao último milissegundo",
     Boolean(p) && p.de === D.ontem && p.ate === D.ontem && p.comecaNoInicio && p.terminaNoFim, q(p));

  // A SETA → DEPOIS DE "ONTEM" ALCANÇADO PELA SETA — era aqui que ela não
  // saía do lugar: o passo de 48 h jogava o início para depois de agora.
  await seta(page, +1);
  p = await periodoNoBanco(page);
  ok("→ de Ontem volta para Hoje", (await rotulo(page)) === "Hoje", await rotulo(page));
  ok("e o banco recebe hoje, da meia-noite até agora",
     Boolean(p) && p.de === D.hoje && p.comecaNoInicio && p.terminaAgora, q(p));

  await seta(page, -1);
  await seta(page, -1);
  p = await periodoNoBanco(page);
  ok("← ← de Hoje: o botão diz anteontem", (await rotulo(page)) === D.anteontem, `${await rotulo(page)} (esperava ${D.anteontem})`);
  ok("e o banco recebe UM dia, o de anteontem, inteiro",
     Boolean(p) && p.dias === 1 && p.de === D.anteontem && p.comecaNoInicio && p.terminaNoFim, q(p));

  await seta(page, +1);
  p = await periodoNoBanco(page);
  ok("→ volta para Ontem", (await rotulo(page)) === "Ontem", await rotulo(page));
  ok("e o banco recebe ontem inteiro de novo",
     Boolean(p) && p.de === D.ontem && p.ate === D.ontem && p.comecaNoInicio && p.terminaNoFim, q(p));
  await seta(page, +1);
  ok("e → mais uma vez chega em Hoje", (await rotulo(page)) === "Hoje", await rotulo(page));
  await seta(page, +1);
  ok("e não passa de hoje", (await rotulo(page)) === "Hoje", await rotulo(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. “7 dias”: a seta anda sete dias, e volta para o mesmo lugar");
{
  const { ctx, page } = await abrirPainel();
  const D = await DATAS(page);
  await atalho(page, "7 dias");
  const sete = await rotulo(page);
  ok("o atalho diz 7 dias", /· 7 dias$/.test(sete), sete);

  await seta(page, -1);
  let p = await periodoNoBanco(page);
  ok("← diz os sete dias anteriores, e “7 dias”", (await rotulo(page)) === D.semana, `${await rotulo(page)} (esperava ${D.semana})`);
  ok("e o banco recebe sete dias de calendário, inteiros",
     Boolean(p) && p.dias === 7 && p.de === D.menos13 && p.ate === D.menos7 && p.comecaNoInicio && p.terminaNoFim, q(p));

  await seta(page, +1);
  p = await periodoNoBanco(page);
  ok("→ volta ao rótulo do atalho", (await rotulo(page)) === sete, `${await rotulo(page)} × ${sete}`);
  // O RÓTULO CERTO NÃO BASTA: o revisor mediu 5,5 dias com "7 dias" escrito.
  ok("e ao MESMO período: do primeiro milissegundo do 7º dia atrás até agora",
     Boolean(p) && p.dias === 7 && p.de === D.menos6 && p.comecaNoInicio && p.terminaAgora, q(p));
  await ctx.close();
}

// ==================================================================
console.log("\n3. “Este ano”: a seta anda um ano civil; o mês continua de mês em mês");
{
  const { ctx, page } = await abrirPainel();
  const D = await DATAS(page);
  await atalho(page, "Este ano");
  const esteAno = await rotulo(page);
  await seta(page, -1);
  let p = await periodoNoBanco(page);
  const esperado = `${D.anoPassado} · ${D.diasDoAnoPassado} dias`;
  ok("← de Este ano diz o ano passado inteiro", (await rotulo(page)) === esperado, `${await rotulo(page)} (esperava ${esperado})`);
  ok("e o banco recebe de 1º de janeiro a 31 de dezembro dele",
     Boolean(p) && p.de === D.primeiroDoAnoPassado && p.ate === D.ultimoDoAnoPassado && p.comecaNoInicio && p.terminaNoFim, q(p));
  await seta(page, +1);
  p = await periodoNoBanco(page);
  ok("→ volta a Este ano", (await rotulo(page)) === esteAno, `${await rotulo(page)} × ${esteAno}`);
  ok("e ao período dele: de 1º de janeiro até agora",
     Boolean(p) && p.de === D.primeiroDoAno && p.comecaNoInicio && p.terminaAgora, q(p));

  // O MÊS JÁ ANDAVA CERTO, e continua: é o contraste de que a conta nova
  // não mexeu no passo que estava bom.
  await atalho(page, "Este mês");
  const mes = await rotulo(page);
  await seta(page, -1);
  p = await periodoNoBanco(page);
  ok("o mês anterior é um mês inteiro", Boolean(p) && p.de.startsWith("01/") && p.comecaNoInicio && p.terminaNoFim
     && /\/20\d\d · \d+ dias$/.test(await rotulo(page)) && (await rotulo(page)) !== mes, q({ p, rotulo: await rotulo(page) }));
  await ctx.close();
}

// ==================================================================
// A PESSOA ESCOLHIDA. A Jenifer tratou uma conversa no mês mais antigo da
// lista de meses, onde o roteiro da bancada não chega: ela está no "Por
// pessoa" do Já tratei e NÃO no "Por atendente" — é o caso em que o nome
// caía para o de quem administra.
const hojeNoNode = new Date(AGORA);
const NO_MES_MAIS_ANTIGO = new Date(hojeNoNode.getFullYear(), hojeNoNode.getMonth() - 11, 15, 12).toISOString();
const SEMENTE = {
  contatos: [{ id: "ct-jen", numero: "5511970028101", nome: "CLIENTE DA JENIFER" }],
  conversas: [{
    id: "cv-jen", advogado_id: "a1", contato_id: "ct-jen", nao_lidas: 0, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: diasAtras(2), esperando_desde: null, tratada_em: null,
    ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { id: "ct-jen", nome: "CLIENTE DA JENIFER", numero: "5511970028101", foto_url: null },
  }],
  zorvin_tratamentos: [
    { id: "tr-jen", conversa_id: "cv-jen", assunto_id: "as-1", quem: "u-jenifer", quando: NO_MES_MAIS_ANTIGO,
      esperava_desde: null },
  ],
};
/** O mês mais antigo da lista "Escolher mês". */
async function mesMaisAntigo(page) {
  await page.locator('[data-teste="abrir-periodo"]').click();
  await page.waitForSelector('[data-grupo="periodo"]');
  const meses = page.locator('[data-grupo="periodo"] button', { hasText: / de 20\d\d$/ });
  const quantos = await meses.count();
  await meses.last().click().catch(() => {});
  await page.waitForTimeout(1500);
  return quantos;
}
const filtrando = (page) => page.evaluate(() => {
  const s = [...document.querySelectorAll('[data-tela="painel"] span')].find((x) => x.textContent.trim() === "Filtrando por:");
  return s ? s.parentElement.innerText.replace(/\s+/g, " ").trim() : "";
});
const escopo = (page) => page.locator('[data-teste="escopo"]').innerText().catch(() => "");
const escopoDoJaTratei = (page) => page.locator("[data-relatorio-ja-tratei] [data-relatorio-escopo]").innerText().catch(() => "");

console.log("\n4. A Jenifer escolhida no “Por pessoa” do Já tratei é a Jenifer");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: SEMENTE });
  ok("a lista de meses está lá", (await mesMaisAntigo(page)) >= 12);
  const eu = await page.evaluate(() => globalThis.__ESPERADO.eu);
  const linha = page.locator('[data-relatorio-por-pessoa] [data-pessoa-no-relatorio="JENIFER ALMEIDA"]');
  ok("a Jenifer está no “Por pessoa” do Já tratei", (await linha.count()) === 1);
  ok("e NÃO está no “Por atendente” (é o caso do defeito)",
     (await page.locator('[data-atendente="JENIFER ALMEIDA"]').count()) === 0);
  await linha.first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const f = await filtrando(page);
  ok("o filtro diz o nome dela", /JENIFER ALMEIDA/.test(f), f);
  ok("e NÃO o de quem administra", f.length > 0 && !f.includes(eu.nome), f);
  const e = await escopo(page);
  ok("o resumo não diz que são os MEUS números", e.length > 0 && !/seus números/.test(e), e.slice(0, 160));
  ok("e diz que são os da pessoa escolhida", /pessoa escolhida/.test(e), e.slice(0, 160));
  const j = await escopoDoJaTratei(page);
  ok("o Já tratei não diz “você”", j.length > 0 && !/você/.test(j), j.slice(0, 160));
  ok("e diz a pessoa escolhida", /pessoa escolhida/.test(j), j.slice(0, 160));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n5. A colega continua a colega num mês em que ela não atendeu");
{
  const { ctx, page } = await abrirPainel();
  await atalho(page, "30 dias");
  // PELA BANCADA, e não escrito à mão (a lição do `__ESPERADO.outroAutor`).
  const { eu, outroAutor: colega } = await page.evaluate(() => globalThis.__ESPERADO);
  const linha = page.locator(`[data-atendente="${colega}"]`);
  ok(`a colega (${colega}) está no “Por atendente” dos 30 dias`, (await linha.count()) > 0);
  await linha.first().click().catch(() => {});
  await page.waitForTimeout(1000);
  ok("escolhida, o filtro diz o nome dela", (await filtrando(page)).includes(colega), await filtrando(page));
  // O MÊS MAIS ANTIGO da lista: o roteiro da bancada não chega lá.
  ok("a lista de meses está lá", (await mesMaisAntigo(page)) >= 12);
  ok("nesse mês ela não está no “Por atendente”", (await linha.count()) === 0);
  const f = await filtrando(page);
  ok("e o filtro continua dizendo o nome dela", f.includes(colega), f);
  ok("e não o de quem administra", f.length > 0 && !f.includes(eu.nome), f);
  await ctx.close();
}

console.log("\n6. Quem escolhe a si mesmo continua lendo “os seus números”");
{
  // O CONTRASTE: um conserto que dissesse "pessoa escolhida" sempre passaria
  // nas cenas de cima — e mentiria para quem se escolheu.
  const { ctx, page } = await abrirPainel();
  await atalho(page, "30 dias");
  const eu = await page.evaluate(() => globalThis.__ESPERADO.eu);
  await page.locator('[data-grupo="escopo"] > button').click();
  await page.waitForTimeout(200);
  await page.locator('[data-grupo="escopo"]').getByRole("button", { name: eu.nome }).first().click();
  await page.waitForTimeout(1000);
  ok("escolhendo a mim, o resumo diz “os seus números”", /seus números/.test(await escopo(page)), (await escopo(page)).slice(0, 120));
  ok("e o filtro diz o meu nome", (await filtrando(page)).includes(eu.nome), await filtrando(page));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
