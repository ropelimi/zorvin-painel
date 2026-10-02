// O "JÁ TRATEI" EM TODA CONVERSA (02/10)
//
// Relato do Rodrigo, com foto: a conversa da BEATRIZ aberta e nenhum "Já
// tratei" no cabeçalho. Não era defeito de leiaute: o botão tinha sido feito
// para aparecer SÓ na conversa que espera resposta, e naquela a última
// mensagem era nossa. O mesmo valia para TODA conversa respondida.
//
// O "Já tratei" é também o registro do que foi feito — é dele que sai o
// relatório —, e o que se fez numa conversa respondida conta igual.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. a conversa respondida TEM o botão, no computador e no menu ⋮;
//   2. nela a janela NÃO promete tirar da fila (não há fila de onde tirar) —
//      diz que só registra;
//   3. marcar deixa o registro e NÃO mexe na conversa: nem espera, nem
//      `tratada_em` — senão o botão viraria "Voltar para a fila" numa
//      conversa que nunca esteve nela;
//   4. o contraste: na conversa que ESPERA, tudo continua como antes — a
//      janela promete tirar da fila, tira, e oferece desfazer.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const RESPONDIDA = "BEATRIZ JA RESPONDIDA";
const ESPERANDO = "OTAVIO NA FILA";

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo (ver a
 *  mesma função em `o-ja-tratei`). */
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

const conversa = (id, nome, numero, esperando, ultima) => ({
  id, advogado_id: ADV, contato_id: `ct-${id}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: ultima, esperando_desde: esperando, tratada_em: null,
  ultima_mensagem: "…", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${id}`, nome, numero, foto_url: null },
});
const SEMENTE = {
  contatos: [
    { id: "ct-cv-resp", numero: "5511948228170", nome: RESPONDIDA, vantoro_nome: null,
      nome_zorvin: null, vantoro_cliente_id: null, foto_url: null },
    { id: "ct-cv-fila", numero: "5511948220001", nome: ESPERANDO, vantoro_nome: null,
      nome_zorvin: null, vantoro_cliente_id: null, foto_url: null },
  ],
  conversas: [
    // A DA FOTO: o cliente pergunta, NÓS respondemos por último.
    conversa("cv-resp", RESPONDIDA, "5511948228170", null, diasAtras(0)),
    conversa("cv-fila", ESPERANDO, "5511948220001", diasAtras(2), diasAtras(2)),
  ],
  mensagens: [
    { id: "m-resp-1", conversa_id: "cv-resp", origem: "contato", tipo: "texto",
      texto: "Essa tem que imprimir também?", criado_em: diasAtras(1) },
    { id: "m-resp-2", conversa_id: "cv-resp", origem: "advogado", tipo: "texto",
      texto: "Sim", enviado_por: "Lucas Mesquita", enviado_por_id: "u2", criado_em: diasAtras(0) },
    { id: "m-fila-1", conversa_id: "cv-fila", origem: "contato", tipo: "texto",
      texto: "Alguma novidade?", criado_em: diasAtras(2) },
  ],
};

async function abrirPainel(largura = 1400) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((semente) => {
    globalThis.__SEMENTE = semente;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__SEM_RECONTAGEM = false;
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__SEM_ESPERA = false;
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}
async function abrir(page, nome) {
  const linha = page.locator(`[data-conversa-nome="${nome}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const estado = (page, id) => page.evaluate((id) => {
  const T = globalThis.__TABELAS;
  const c = (T.conversas || []).find((x) => String(x.id) === id);
  return {
    esperando_desde: c ? c.esperando_desde : "SEM CONVERSA",
    tratada_em: c ? c.tratada_em : "SEM CONVERSA",
    tratamentos: (T.zorvin_tratamentos || []).filter((x) => String(x.conversa_id) === id).length,
  };
}, id);
/** Marca ACORDOS e confirma — com os cliques GUARDADOS: num elemento que não
 *  existe, `click()` estoura a prova inteira, e prova que estoura não diz
 *  QUAL conferência viu o defeito. */
async function marcarEConfirmar(page) {
  const a = page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input');
  if (!(await a.count())) return false;
  await a.click();
  await page.locator("[data-ja-tratei-confirmar]").click();
  await page.waitForTimeout(1300);
  return true;
}
async function abrirJanela(page) {
  const b = page.locator('[data-ja-tratei="tratar"]');
  if (!(await b.count())) return null;
  await b.first().click();
  await page.waitForTimeout(500);
  const j = page.locator("[data-ja-tratei-janela]");
  return (await j.count()) ? j.first().innerText() : null;
}

console.log("\n1. A conversa que NÓS respondemos por último tem o “Já tratei”");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("achei a conversa respondida", await abrir(page, RESPONDIDA));
  const antes = await estado(page, "cv-resp");
  ok("ela não está esperando (é o caso da foto)", antes.esperando_desde === null, JSON.stringify(antes));
  ok("e o botão “Já tratei” está no cabeçalho",
     (await page.locator('[data-ja-tratei="tratar"]').count()) > 0);

  console.log("\n2. A janela não promete tirar da fila — diz que só registra");
  const texto = await abrirJanela(page);
  ok("a janela abre", texto !== null);
  ok("e diz que só registra", /só registra/i.test(texto || ""), (texto || "").slice(0, 200));
  ok('e NÃO diz "Tira esta conversa da fila"', !/Tira esta conversa da fila/i.test(texto || ""),
     (texto || "").slice(0, 200));

  console.log("\n3. Marcar deixa o registro e não mexe na conversa");
  await page.evaluate(() => { globalThis.__AVISOS_VISTOS = []; });
  ok("marquei ACORDOS e confirmei", await marcarEConfirmar(page));
  const depois = await estado(page, "cv-resp");
  ok("ficou o registro", depois.tratamentos === antes.tratamentos + 1, JSON.stringify(depois));
  ok("a conversa continua sem espera", depois.esperando_desde === null, JSON.stringify(depois));
  ok("e sem `tratada_em` — não há fila de onde ela tenha saído", !depois.tratada_em, JSON.stringify(depois));
  ok("a janela fechou", (await page.locator("[data-ja-tratei-janela]").count()) === 0);
  const filme = await page.evaluate(() => globalThis.__AVISOS_VISTOS.join(" | "));
  ok('o aviso diz que registrou', /Registrei o que foi tratado/.test(filme), filme);
  ok('e não diz que tirou da fila', !/Tirada da fila/.test(filme), filme);
  ok("o botão continua “Já tratei”, e não “Voltar para a fila”",
     (await page.locator('[data-ja-tratei="tratar"]').count()) > 0
     && (await page.locator('[data-ja-tratei="desfazer"]').count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n4. O contraste: na conversa que ESPERA, tudo como antes");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("achei a conversa da fila", await abrir(page, ESPERANDO));
  const texto = await abrirJanela(page);
  ok('a janela diz "Tira esta conversa da fila"', /Tira esta conversa da fila/i.test(texto || ""),
     (texto || "").slice(0, 200));
  ok("marquei ACORDOS e confirmei", await marcarEConfirmar(page));
  const d = await estado(page, "cv-fila");
  ok("saiu da fila e ficou marcada como tratada", d.esperando_desde === null && Boolean(d.tratada_em),
     JSON.stringify(d));
  ok("e o botão virou “Voltar para a fila”", (await page.locator('[data-ja-tratei="desfazer"]').count()) > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n5. No celular, o menu ⋮ da conversa respondida também oferece");
{
  const { ctx, page, estouros } = await abrirPainel(390);
  ok("a conversa abre no celular", await abrir(page, RESPONDIDA));
  const menu = page.locator('[aria-label="Mais opções desta conversa"]');
  if (await menu.count()) { await menu.first().click(); await page.waitForTimeout(400); }
  ok("o menu ⋮ tem o “Já tratei”", (await page.locator('[data-ja-tratei="tratar"]').count()) > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
