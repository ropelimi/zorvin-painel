// O RELATÓRIO POR RESPONSÁVEL — a carteira de cada pessoa, AGORA
//
// Pedido do Rodrigo em 01/10. O responsável pela conversa nasceu em 30/09
// para que desse para "cobrar a fila de alguém"; faltava onde LER a fila de
// cada um. É uma seção do Painel de números, somada no banco (script 011 da
// ponte).
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. cada pessoa tem a sua linha: conversas, quantas esperam, quantas há 3
//      dias ou mais (o vermelho da lista), a espera mais antiga e as não
//      lidas — e quem tem mais atrasada vem primeiro;
//   2. arquivada não entra na carteira;
//   3. "sem responsável" é uma linha, à vista;
//   4. a seção diz que é AGORA, e não o período escolhido;
//   5. o filtro de telefone da barra recorta;
//   6. quem não administra vê a própria carteira e a fila sem dono — e não a
//      dos colegas;
//   7. sem a função, ou sem o script 008, quem administra lê qual script
//      falta e quem atende não vê nada; com a função FALHANDO, a tela diz,
//      com o código;
//   8. e o caminho inteiro: assumir uma conversa na tela e vê-la na carteira.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira — a lição das provas do "Já tratei".
const AGORA = Date.now();
const diasAtras = (d) => new Date(AGORA - d * 86400e3).toISOString();

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

const EU = "u1", JENIFER = "u-jenifer";
const conversa = (id, nome, adv, dono, espera = null, extra = {}) => ({
  id, advogado_id: adv, contato_id: `ct-${id}`, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date(AGORA - 60e3).toISOString(), esperando_desde: espera, tratada_em: null,
  responsavel_id: dono, responsavel_em: dono ? diasAtras(20) : null, responsavel_por: dono,
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${id}`, nome, numero: `55119700088${id.slice(-2)}`, foto_url: null },
  ...extra,
});
const SEMENTE = {
  contatos: ["01", "02", "03", "04", "05", "06", "07"].map((n) => ({ id: `ct-cv-r${n}`, numero: `55119700088${n}`, nome: n === "07" ? "SÉRGIO SEM DONO" : `CLIENTE ${n}` })),
  conversas: [
    // A MINHA CARTEIRA: três conversas, uma atrasada (5 dias), uma recente
    // (1 dia), uma sem espera; 2 não lidas no total.
    conversa("cv-r01", "CLIENTE 01", TEL.adv, EU, diasAtras(5), { nao_lidas: 2 }),
    conversa("cv-r02", "CLIENTE 02", TEL.adv, EU, diasAtras(1)),
    conversa("cv-r03", "CLIENTE 03", TEL.adv, EU, null),
    // A DA JENIFER, no OUTRO telefone: duas atrasadas (10 e 4 dias)…
    conversa("cv-r04", "CLIENTE 04", TEL.outro, JENIFER, diasAtras(10), { nao_lidas: 3 }),
    conversa("cv-r05", "CLIENTE 05", TEL.outro, JENIFER, diasAtras(4)),
    // …e uma ARQUIVADA, esperando há 30 dias, que não pode entrar.
    conversa("cv-r06", "CLIENTE 06", TEL.outro, JENIFER, diasAtras(30), { arquivada: true }),
    // SEM DONO, para a cena do caminho inteiro.
    // A atividade dela vem DEPOIS de tudo o que a bancada planta, para ficar
    // no alto da lista: a lista só desenha as linhas que cabem na tela.
    conversa("cv-r07", "SÉRGIO SEM DONO", TEL.adv, null, diasAtras(2),
             { ultima_atividade: new Date(AGORA + 600e3).toISOString() }),
  ],
  mensagens: ["01", "02", "03", "04", "05", "06", "07"].map((n) => ({
    id: `m-cv-r${n}`, conversa_id: `cv-r${n}`, origem: "contato", tipo: "texto", texto: "oi",
    criado_em: new Date(AGORA - 60e3).toISOString(),
  })),
};

async function abrirPainel({ admin = true, semFuncao = false, falha = false, sem008 = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEM_RELATORIO_RESP = d.semFuncao;
    globalThis.__RELATORIO_RESP_FALHA = d.falha;
    globalThis.__SEM_RESPONSAVEL = d.sem008;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: SEMENTE, admin, semFuncao, falha, sem008 });
  await page.goto(ENDERECO);
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

const S = "[data-relatorio-responsaveis]";
/** A linha de alguém, lida como a tela a mostra. */
const linhaDe = (page, chave) => page.evaluate(([S, chave]) => {
  const tr = document.querySelector(`${S} [data-responsavel-no-relatorio="${chave}"]`);
  if (!tr) return null;
  const v = (a) => tr.querySelector(`[${a}]`)?.getAttribute(a);
  return { conversas: v("data-conversas"), esperando: v("data-esperando"), atrasadas: v("data-atrasadas"),
           maisAntiga: v("data-mais-antiga"), naoLidas: v("data-nao-lidas"), texto: tr.innerText,
           corAtrasadas: getComputedStyle(tr.querySelector("[data-atrasadas]")).color };
}, [S, chave]);
const ordem = (page) => page.$$eval(`${S} [data-responsavel-no-relatorio]`,
  (ns) => ns.map((n) => n.getAttribute("data-responsavel-no-relatorio")));

// ==================================================================
console.log("\nQuem administra vê a carteira de cada um, e a fila sem dono");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irAoPainel(page);
  ok("a seção aparece", (await page.locator(S).count()) === 1);
  const eu = await linhaDe(page, "Rodrigo Sousa");
  const je = await linhaDe(page, "JENIFER ALMEIDA");
  ok("a minha linha: 3 conversas", eu?.conversas === "3", JSON.stringify(eu));
  ok("2 esperando, 1 há 3 dias ou mais", eu?.esperando === "2" && eu?.atrasadas === "1");
  ok("a mais antiga é de 5 dias", eu?.maisAntiga === "5" && /há 5 dias/.test(eu?.texto || ""), eu?.maisAntiga);
  ok("e as não lidas somam 2", eu?.naoLidas === "2");
  ok("a minha linha diz “você”", /você/.test(eu?.texto || ""));
  ok("a da Jenifer: 2 conversas — a arquivada não entra", je?.conversas === "2", JSON.stringify(je));
  ok("as duas atrasadas, a mais antiga de 10 dias", je?.atrasadas === "2" && je?.maisAntiga === "10");
  ok("atrasada é vermelha, como na lista", /229, 87, 63/.test(je?.corAtrasadas || ""), je?.corAtrasadas);
  const o = await ordem(page);
  ok("quem tem mais atrasada vem primeiro", o.indexOf("JENIFER ALMEIDA") < o.indexOf("Rodrigo Sousa"), o.join(","));
  ok("“sem responsável” é uma linha, no fim", o[o.length - 1] === "sem", o.join(","));
  const sem = await linhaDe(page, "sem");
  ok("e tem as conversas sem dono", Number(sem?.conversas) >= 1, JSON.stringify(sem));
  ok("a seção diz que é AGORA, e não o período",
     /Agora/.test(await page.locator(`${S} [data-responsaveis-escopo]`).innerText().catch(() => "")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nO filtro de telefone da barra recorta");
{
  const { ctx, page } = await abrirPainel();
  await irAoPainel(page);
  const grupo = page.locator('[data-grupo="telefone"] > button');
  if (await grupo.count()) {
    await grupo.click();
    await page.waitForTimeout(200);
    const opcao = page.locator('[data-grupo="telefone"]').getByRole("button", { name: TEL.outroNome });
    if (await opcao.count()) await opcao.first().click();
    await page.waitForTimeout(1500);
  }
  const o = await ordem(page);
  ok("no outro telefone, a Jenifer fica", o.includes("JENIFER ALMEIDA"), o.join(","));
  ok("e a minha linha sai — minhas conversas são do outro", !o.includes("Rodrigo Sousa"), o.join(","));
  await ctx.close();
}

// ==================================================================
console.log("\nQuem não administra vê a própria carteira e a fila sem dono");
{
  const { ctx, page, estouros } = await abrirPainel({ admin: false });
  await irAoPainel(page);
  const o = await ordem(page);
  ok("a própria linha aparece", o.includes("Rodrigo Sousa"), o.join(","));
  ok("a fila sem dono também", o.includes("sem"), o.join(","));
  ok("e a da colega NÃO", !o.includes("JENIFER ALMEIDA"), o.join(","));
  ok("a seção diz que é a sua carteira",
     /sua carteira/.test(await page.locator(`${S} [data-responsaveis-escopo]`).innerText().catch(() => "")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem a função, sem o 008, e com a função falhando");
{
  const { ctx, page } = await abrirPainel({ semFuncao: true });
  await irAoPainel(page);
  const t = await page.locator(`${S} [data-responsaveis-falta]`).innerText().catch(() => "");
  ok("quem administra lê qual script falta (011)", /011-o-relatorio-por-responsavel\.sql/.test(t), t);
  ok("e o resto do painel continua", (await page.locator("[data-relatorio-ja-tratei]").count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ semFuncao: true, admin: false });
  await irAoPainel(page);
  ok("quem atende não vê aviso de script nenhum", (await page.locator(S).count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ sem008: true });
  await irAoPainel(page);
  const t = await page.locator(`${S} [data-responsaveis-falta]`).innerText().catch(() => "");
  ok("sem o 008, a tela aponta o 008", /008-o-responsavel-pela-conversa\.sql/.test(t), t);
  ok("e não desenha tabela vazia", (await page.locator(`${S} [data-responsavel-no-relatorio]`).count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ falha: true });
  await irAoPainel(page);
  const t = await page.locator(`${S} [data-responsaveis-erro]`).innerText().catch(() => "");
  ok("com a função falhando, a tela diz — com o código", /57014/.test(t), t);
  ok("e não finge carteira vazia", (await page.locator(`${S} [data-responsavel-no-relatorio]`).count()) === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nO caminho inteiro: assumir na tela e ver na carteira");
{
  const { ctx, page, estouros } = await abrirPainel();
  let assumiu = false;
  const linha = page.locator('[data-conversa-nome="SÉRGIO SEM DONO"]');
  if (await linha.count()) {
    await linha.first().click();
    await page.waitForTimeout(900);
    const dono = page.locator("[data-responsavel-da-conversa]");
    if (await dono.count()) {
      await dono.first().click();
      await page.waitForTimeout(300);
      const assumir = page.locator("[data-assumir-conversa]");
      if (await assumir.count()) { await assumir.first().click(); await page.waitForTimeout(1200); assumiu = true; }
    }
  }
  ok("assumi a conversa do Sérgio", assumiu);
  await irAoPainel(page);
  const eu = await linhaDe(page, "Rodrigo Sousa");
  ok("a minha carteira passou a 4", eu?.conversas === "4", JSON.stringify(eu));
  ok("e 3 esperando", eu?.esperando === "3");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
