// O RELATÓRIO DO "JÁ TRATEI"
//
// Pedido do Rodrigo em 30/09: *"preciso de algum lugar para metrificar essas
// informações, do que foi tratado, por quem"*. O "Já tratei" gravava desde
// 25/09 e não havia onde ler. Agora é uma seção do Painel de números, embaixo
// dos mesmos filtros, somada no banco (script 010 da ponte).
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. UM CLIQUE É UM "JÁ TRATEI" — marcar ACORDOS e OUTROS juntos conta um,
//      e não dois. Contar linhas diria que a equipe tratou o dobro;
//   2. O DESFEITO NÃO SOMA, e aparece à parte, marcado na lista;
//   3. o texto do OUTROS aparece no registro e vai para a planilha;
//   4. quem não administra vê só o próprio — e o "por pessoa" continua
//      mostrando todo mundo, para comparar;
//   5. os filtros da barra de cima recortam o relatório também;
//   6. sem a função no banco, quem administra lê o que falta e quem atende
//      não vê nada; com a função FALHANDO, a tela diz — com o código;
//   7. e o caminho inteiro: marcar um "Já tratei" na conversa e vê-lo no
//      relatório. Sem esta cena, a prova passaria com a bancada inventando
//      números que a tela nunca gravou.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira. Cada `Date.now()` separado cai num
// milissegundo diferente, e aí "o mesmo instante" vira dois cliques e uma
// espera de 7 dias vira 6,99999. A prova reprovava às vezes falando de um
// defeito que era dela.
const AGORA = Date.now();
const horasAtras = (h) => new Date(AGORA - h * 3600e3).toISOString();
const diasAtras = (d) => horasAtras(d * 24);

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

const conversa = (id, nome, numero, adv, espera = null) => ({
  id, advogado_id: adv, contato_id: `ct-${id}`, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: horasAtras(1), esperando_desde: espera, tratada_em: null,
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${id}`, nome, numero, foto_url: null },
});
const UM_CLIQUE = diasAtras(1);
const SEMENTE = {
  contatos: [
    { id: "ct-cv-r1", numero: "5511970006601", nome: "ROSA DO RELATÓRIO" },
    { id: "ct-cv-r2", numero: "5511970006602", nome: "RUI DO OUTRO TELEFONE" },
    { id: "ct-cv-r3", numero: "5511970006603", nome: "RAQUEL DESFEITA" },
    { id: "ct-cv-r4", numero: "5511970006604", nome: "RENATO QUE ESPERA" },
  ],
  conversas: [
    conversa("cv-r1", "ROSA DO RELATÓRIO", "5511970006601", TEL.adv),
    conversa("cv-r2", "RUI DO OUTRO TELEFONE", "5511970006602", TEL.outro),
    conversa("cv-r3", "RAQUEL DESFEITA", "5511970006603", TEL.adv),
    conversa("cv-r4", "RENATO QUE ESPERA", "5511970006604", TEL.adv, diasAtras(3)),
  ],
  mensagens: [
    { id: "m-r4", conversa_id: "cv-r4", origem: "contato", tipo: "texto", texto: "e aí?", criado_em: diasAtras(3) },
  ],
  zorvin_tratamentos: [
    // UM CLIQUE, DOIS ASSUNTOS: mesmo instante, mesma conversa, mesma pessoa.
    // UMA constante, e não duas chamadas a `diasAtras(1)`: duas chamadas podem
    // cair em milissegundos diferentes e virar dois cliques de verdade — a
    // prova reprovaria às vezes, falando de um defeito que era da semente.
    // Achado em 01/10, pela prova irmã do histórico.
    { id: "tr-1a", conversa_id: "cv-r1", assunto_id: "as-6", quem: "u1", quando: UM_CLIQUE, esperava_desde: diasAtras(5) },
    { id: "tr-1b", conversa_id: "cv-r1", assunto_id: "as-outros", quem: "u1", quando: UM_CLIQUE, esperava_desde: diasAtras(5),
      observacao: "Pediu a segunda via do boleto; enviada por e-mail." },
    // A JENIFER, no OUTRO telefone.
    { id: "tr-2", conversa_id: "cv-r2", assunto_id: "as-1", quem: "u-jenifer", quando: diasAtras(2), esperava_desde: diasAtras(12) },
    // DESFEITO.
    { id: "tr-3", conversa_id: "cv-r3", assunto_id: "as-6", quem: "u1", quando: horasAtras(3), desfeito_em: horasAtras(2) },
    // FORA DOS 30 DIAS.
    { id: "tr-4", conversa_id: "cv-r1", assunto_id: "as-8", quem: "u-jenifer", quando: diasAtras(45) },
  ],
};

async function abrirPainel({ admin = true, semRelatorio = false, falha = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEM_RELATORIO = d.semRelatorio;
    globalThis.__RELATORIO_FALHA = d.falha;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__SEM_DESCRICAO = false;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: SEMENTE, admin, semRelatorio, falha });
  await page.goto(ENDERECO);
  // QUEM NÃO ADMINISTRA pode não enxergar conversa nenhuma na bancada (as
  // permissões dela são de administrador): espera-se a tela, e não a lista.
  if (admin) await page.waitForSelector("[data-conversa-nome]");
  else await page.getByRole("button", { name: "Menu" }).waitFor();
  await page.waitForTimeout(1000);
  return { ctx, page, estouros };
}

async function irAoPainel(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Painel" }).click();
  await page.waitForSelector('[data-tela="painel"]');
  await page.waitForTimeout(1500);
}

const R = "[data-relatorio-ja-tratei]";
const cartao = async (page, etiqueta) => {
  const el = page.locator(`${R} [data-cartao="${etiqueta}"] [data-valor]`);
  if (!(await el.count())) return null;
  return (await el.first().getAttribute("data-valor")) || "";
};
const nomesDosRegistros = (page) => page.$$eval(`${R} [data-registro-ja-tratei] b`, (ns) => ns.map((n) => n.textContent.trim()));
const vezesDoAssunto = (page, nome) => page.locator(`${R} [data-assunto-no-relatorio="${nome}"] [data-vezes]`)
  .getAttribute("data-vezes").catch(() => null);
const tratamentosDe = (page, nome) => page.locator(`${R} [data-pessoa-no-relatorio="${nome}"] [data-tratamentos]`)
  .getAttribute("data-tratamentos").catch(() => null);

// ==================================================================
console.log("\nQuem administra vê a equipe inteira, e um clique conta um");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irAoPainel(page);
  ok("a seção do “Já tratei” aparece no Painel", (await page.locator(R).count()) === 1);
  ok("fala da equipe", /a equipe/.test(await page.locator(`${R} [data-relatorio-escopo]`).innerText().catch(() => "")));
  // O CLIQUE DE DOIS ASSUNTOS CONTA UM. Contando linhas daria 3.
  ok("“Vezes Já tratei” conta cliques (2), e não linhas (3)", (await cartao(page, "Vezes “Já tratei”")) === "2",
     await cartao(page, "Vezes “Já tratei”"));
  ok("“Conversas tratadas” = 2", (await cartao(page, "Conversas tratadas")) === "2");
  ok("o desfeito fica de fora e aparece à parte (1)", (await cartao(page, "Desfeitos")) === "1");
  // (5-1) e (12-2) dias → mediana 7.
  ok("a mediana da espera é 7 dias", Number(await cartao(page, "Esperavam")) === 7, await cartao(page, "Esperavam"));
  ok("o que ficou fora dos 30 dias não entra (VENDA LN)", (await vezesDoAssunto(page, "VENDA LN")) === null);
  ok("por assunto: ACORDOS 1 (o desfeito não soma)", (await vezesDoAssunto(page, "ACORDOS")) === "1");
  ok("por assunto: OUTROS 1 e BLINDAGEM 1",
     (await vezesDoAssunto(page, "OUTROS")) === "1" && (await vezesDoAssunto(page, "BLINDAGEM")) === "1");
  ok("e a tela explica por que as marcações somam mais que os cliques",
     /Somam 3, mais que os 2/.test(await page.locator(`${R} [data-relatorio-por-assunto]`).innerText()));
  ok("por pessoa: Rodrigo 1 e Jenifer 1",
     (await tratamentosDe(page, "Rodrigo Sousa")) === "1" && (await tratamentosDe(page, "JENIFER ALMEIDA")) === "1");

  const nomes = await nomesDosRegistros(page);
  ok("os registros trazem os três do período, do mais recente para o mais antigo",
     nomes.join("|") === "RAQUEL DESFEITA|ROSA DO RELATÓRIO|RUI DO OUTRO TELEFONE", nomes.join("|"));
  ok("o desfeito vem marcado na lista", (await page.locator(`${R} [data-registro-desfeito]`).count()) === 1);
  const obs = await page.locator(`${R} [data-registro-observacao]`).allInnerTexts();
  ok("o texto do OUTROS aparece no registro", obs.some((t) => /segunda via do boleto/.test(t)), obs.join(" | "));

  // OS DIAS SEM NADA TAMBÉM APARECEM, como zero. Sem isso, trinta dias com
  // "Já tratei" em três viram três barras soltas no gráfico.
  const tabela = page.locator(`${R} button[title="Ver os números"]`).first();
  let dias = 0;
  if (await tabela.count()) {
    await tabela.click(); await page.waitForTimeout(300);
    dias = await page.locator(`${R} table tbody tr`).first().locator("xpath=ancestor::tbody").locator("tr").count();
    await page.locator(`${R} button[title="Ver o gráfico"]`).first().click();
  }
  ok("o “por dia” traz o período inteiro, com os dias sem nada", dias >= 30, `linhas: ${dias}`);

  // A PLANILHA.
  const baixar = page.locator(`${R} [data-relatorio-baixar]`);
  let csv = "";
  if (await baixar.count()) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), baixar.click()]);
    if (dl) { const fs = await import("node:fs"); csv = fs.readFileSync(await dl.path(), "utf8"); }
  }
  ok("a planilha baixa, com acento (BOM) e separada por ponto e vírgula",
     csv.startsWith("﻿") && csv.split("\r\n")[0].includes(";"), csv.slice(0, 80));
  ok("e leva o texto do OUTROS e o desfeito", /segunda via do boleto/.test(csv) && /"sim"/.test(csv));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));

  // RECORTAR NUMA PESSOA pelo "por pessoa".
  await page.locator(`${R} [data-pessoa-no-relatorio="JENIFER ALMEIDA"]`).click();
  await page.waitForTimeout(1200);
  ok("clicando na Jenifer, o relatório recorta nela",
     (await cartao(page, "Vezes “Já tratei”")) === "1"
     && (await nomesDosRegistros(page)).join("|") === "RUI DO OUTRO TELEFONE",
     (await nomesDosRegistros(page)).join("|"));
  ok("e o “por pessoa” continua mostrando os dois", (await tratamentosDe(page, "Rodrigo Sousa")) === "1");
  await ctx.close();
}

// ==================================================================
console.log("\nO filtro de telefone da barra recorta o relatório");
{
  const { ctx, page } = await abrirPainel();
  await irAoPainel(page);
  await page.locator('[data-grupo="telefone"] > button').click();
  await page.waitForTimeout(200);
  await page.locator('[data-grupo="telefone"]').getByRole("button", { name: TEL.outroNome }).first().click();
  await page.waitForTimeout(1500);
  const nomes = await nomesDosRegistros(page);
  ok("só o registro do outro telefone", nomes.join("|") === "RUI DO OUTRO TELEFONE", nomes.join("|"));
  ok("e as somas acompanham (1)", (await cartao(page, "Vezes “Já tratei”")) === "1");
  await ctx.close();
}

// ==================================================================
console.log("\nQuem não administra vê o próprio — e o “por pessoa” compara todo mundo");
{
  const { ctx, page, estouros } = await abrirPainel({ admin: false });
  await irAoPainel(page);
  ok("fala de você", /você/.test(await page.locator(`${R} [data-relatorio-escopo]`).innerText().catch(() => "")));
  ok("só o próprio clique conta (1)", (await cartao(page, "Vezes “Já tratei”")) === "1");
  const nomes = await nomesDosRegistros(page);
  ok("e só os próprios registros (o desfeito dele incluído)",
     nomes.join("|") === "RAQUEL DESFEITA|ROSA DO RELATÓRIO", nomes.join("|"));
  ok("o “por pessoa” mostra a Jenifer também", (await tratamentosDe(page, "JENIFER ALMEIDA")) === "1");
  // O RECORTE É DO BANCO: pedir "todo mundo" por fora devolve o recorte assim
  // mesmo. É o que separa recorte de sugestão.
  const forcado = await page.evaluate(async () => {
    const m = await import("/src/supabase.js");
    const { data } = await m.supabase.rpc("zorvin_relatorio_tratados", { p_quem: null, p_limite: 500 });
    return data ? { so_meu: data.so_meu, n: data.total.tratamentos } : null;
  });
  ok("pedir “todo mundo” por fora não devolve todo mundo", forcado && forcado.so_meu && forcado.n === 1,
     JSON.stringify(forcado));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem a função no banco, e com ela falhando");
{
  const a = await abrirPainel({ semRelatorio: true });
  await irAoPainel(a.page);
  ok("quem administra lê que falta o script 010",
     /010-o-relatorio-do-ja-tratei/.test(await a.page.locator(`${R} [data-relatorio-falta]`).innerText().catch(() => "")));
  // O PAINEL DE SEMPRE CONTINUA: um relatório faltando não esconde o resto.
  ok("e o resto do Painel continua lá", (await a.page.locator('[data-teste="escopo"]').count()) === 1);
  await a.ctx.close();

  const b = await abrirPainel({ semRelatorio: true, admin: false });
  await irAoPainel(b.page);
  ok("quem atende não vê aviso de SQL nenhum", (await b.page.locator(R).count()) === 0);
  await b.ctx.close();

  // FALHA NÃO É AUSÊNCIA.
  const c = await abrirPainel({ falha: true });
  await irAoPainel(c.page);
  const erro = await c.page.locator(`${R} [data-relatorio-erro]`).innerText().catch(() => "");
  ok("com a função falhando, a tela DIZ — e com o código", /Não consegui somar/.test(erro) && /57014/.test(erro), erro);
  ok("e não finge zero", (await c.page.locator(`${R} [data-cartao]`).count()) === 0);
  await c.ctx.close();
}

// ==================================================================
console.log("\nO caminho inteiro: marcar na conversa e ver no relatório");
{
  const { ctx, page, estouros } = await abrirPainel();
  const linha = page.locator('[data-conversa-nome="RENATO QUE ESPERA"]');
  if (await linha.count()) { await linha.first().click(); await page.waitForTimeout(800); }
  const botao = page.locator('[data-ja-tratei="tratar"]');
  if (await botao.count()) {
    await botao.first().click();
    await page.waitForSelector("[data-ja-tratei-janela]");
    await page.locator('[data-assunto-do-ja-tratei="VENDA CCS"] input').click();
    await page.locator('[data-assunto-do-ja-tratei="OUTROS"] input').click();
    const campo = page.locator("[data-ja-tratei-descricao]");
    if (await campo.count()) await campo.fill("Cliente confirmou o acordo por telefone.");
    await page.locator("[data-ja-tratei-confirmar]").click();
    await page.waitForTimeout(1200);
  }
  ok("(o “Já tratei” foi gravado pela tela)", await page.evaluate(() =>
    (globalThis.__TABELAS.zorvin_tratamentos || []).filter((x) => x.conversa_id === "cv-r4").length === 2));
  await irAoPainel(page);
  ok("o relatório passa a contar 3 — o clique novo conta UM, com dois assuntos",
     (await cartao(page, "Vezes “Já tratei”")) === "3", await cartao(page, "Vezes “Já tratei”"));
  ok("e ele é o primeiro da lista", (await nomesDosRegistros(page))[0] === "RENATO QUE ESPERA",
     (await nomesDosRegistros(page)).join("|"));
  const obs = await page.locator(`${R} [data-registro-observacao]`).allInnerTexts();
  ok("com o texto que foi escrito", obs.some((t) => /confirmou o acordo/.test(t)), obs.join(" | "));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
