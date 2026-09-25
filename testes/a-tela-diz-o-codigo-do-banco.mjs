// A TELA DIZ O CÓDIGO DO BANCO — e distingue "recusou" de "não cheguei lá".
//
// RELATO DE 24/09, no dia seguinte ao conserto que fez a tela parar de dizer
// "salvei" sem ter salvo. Renomear um cliente passou a mostrar:
//
//     "Não consegui salvar o nome. Tente de novo."
//
// Aquilo diz QUE falhou e não diz NADA do porquê. O `error` que o banco
// devolveu era jogado fora — sem nem um `console.error`.
//
// ------------------------------------------------------------
// O QUE ISSO CUSTOU, MEDIDO
//
// Uma rodada inteira de scripts no Supabase para descobrir o que o navegador
// sabia no primeiro segundo. E os scripts inocentaram todo mundo: as políticas
// de `contatos` liberam UPDATE para `authenticated` com condição `true`, não
// há gatilho na tabela, todas as colunas (inclusive `nome_zorvin`) têm
// permissão de UPDATE, e o mesmo UPDATE rodado no papel de quem entra no
// painel PASSOU. O erro vinha de antes do banco — e o único lugar que o tinha
// visto foi o único que não o guardou.
//
// ------------------------------------------------------------
// SÃO TRÊS DESFECHOS, E ELES PEDEM TRÊS FRASES
//
//   o banco recusou com erro    -> a frase MAIS o código (42501, PGRST301…)
//   o banco aceitou e não mexeu -> "o banco não deixou" (e NÃO um código,
//                                   porque não houve erro nenhum)
//   o pedido não chegou ao banco-> "não consegui falar com o banco"
//
// Misturar os dois últimos manda a pessoa procurar defeito no lugar errado:
// um é permissão, o outro é conexão.
//
// `__ERRO_NA_GRAVACAO` é a bancada recusando com erro; `__ESCRITA_SEM_EFEITO`
// é ela aceitando sem mexer em nada. Uma prova que só soubesse fazer a segunda
// aprovaria a tela de hoje inteira.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Abre o painel com a gravação em `tabela` falhando do jeito pedido.
 *
 *  TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` ACUMULA, e uma
 *  bandeira ligada num cenário continuaria valendo nos seguintes. */
async function abrirPainel({ erro = null, semEfeito = [], tabela = "contatos", semente = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__ERRO_NA_GRAVACAO = d.erro ? { [d.tabela]: d.erro } : {};
    globalThis.__ESCRITA_SEM_EFEITO = d.semEfeito;
    if (d.semente) globalThis.__SEMENTE = d.semente;
    globalThis.__AVISOS_VISTOS = [];
    // Um relógio, e não um `MutationObserver`: `addInitScript` roda ANTES de
    // existir documento, e `observe(document.documentElement)` estoura ali.
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { erro, semEfeito, tabela, semente });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const oFilme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));

/** Abre uma conversa cujo contato NÃO tem cadastro no Vantoro — só nessas o
 *  lápis de renomear aparece (quem tem ficha é chamado pelo nome dela). */
async function abrirUmaRenomeavel(page) {
  const linhas = page.locator("[data-conversa-nome]");
  const quantas = Math.min(await linhas.count(), 8);
  for (let i = 0; i < quantas; i++) {
    await linhas.nth(i).click();
    await page.waitForTimeout(700);
    if (await page.locator("[data-renomear-contato]").count()) return true;
  }
  return false;
}

async function renomear(page) {
  await page.locator("[data-renomear-contato]").click();
  await page.waitForTimeout(300);
  await page.keyboard.type("NOME DE PROVA");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1300);
}

// ==================================================================
//  1. O BANCO RECUSOU COM ERRO -> a frase leva o código
// ==================================================================
async function cenaComCodigo() {
  const { ctx, page, estouros } = await abrirPainel({
    erro: { code: "PGRST301", message: "JWT expired" } });
  const achou = await abrirUmaRenomeavel(page);
  ok("achei uma conversa com o lápis de renomear", achou);
  if (!achou) { ok("cheguei a renomear", false); await ctx.close(); return; }
  await renomear(page);

  const filme = await oFilme(page);
  // O CÓDIGO É O PONTO. Sem ele a frase manda "tentar de novo" para sempre, e
  // quem for consertar recomeça adivinhando — foi assim que este defeito
  // custou uma rodada de scripts.
  ok("a tela mostra o código que o banco devolveu",
     /PGRST301/.test(filme), filme);
  ok("e continua dizendo, em português, o que falhou",
     /não consegui salvar o nome/i.test(filme), filme);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  2. O PEDIDO NÃO CHEGOU AO BANCO -> outra frase, e outra ação
// ==================================================================
async function cenaSemCodigo() {
  const { ctx, page, estouros } = await abrirPainel({
    erro: { message: "TypeError: Failed to fetch" } });
  const achou = await abrirUmaRenomeavel(page);
  ok("achei uma conversa com o lápis de renomear", achou);
  if (!achou) { ok("cheguei a renomear", false); await ctx.close(); return; }
  await renomear(page);

  const filme = await oFilme(page);
  ok("a tela diz que não falou com o banco",
     /não consegui falar com o banco/i.test(filme), filme);
  // "erro undefined" ou "erro null" é o que sai de um código que não existe, e
  // é pior do que não dizer nada: parece um código e não é.
  ok("e não inventa um código que não veio",
     !/erro (undefined|null|sem código)/i.test(filme), filme);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  3. O BANCO ACEITOU E NÃO MEXEU -> continua sem código, e é certo
//
//  Não houve erro nenhum: não há código para mostrar. Pôr um aqui (um
//  "undefined", ou o código da tentativa anterior) faria a recusa silenciosa
//  parecer uma falha de banco, que é outra investigação.
// ==================================================================
async function cenaRecusaCalada() {
  const { ctx, page, estouros } = await abrirPainel({ semEfeito: ["contatos"] });
  const achou = await abrirUmaRenomeavel(page);
  ok("achei uma conversa com o lápis de renomear", achou);
  if (!achou) { ok("cheguei a renomear", false); await ctx.close(); return; }
  await renomear(page);

  const filme = await oFilme(page);
  ok("a tela diz que o banco não deixou", /não deixou/i.test(filme), filme);
  ok("e NÃO fala em código nenhum, porque não houve erro",
     !/\(erro /i.test(filme), filme);
  ok("nem manda conferir a conexão, que está boa",
     !/confira a conexão/i.test(filme), filme);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. O CAMINHO NORMAL -> nada disso aparece
//
//  Sem esta cena, um conserto que gritasse SEMPRE passaria nas três de cima.
// ==================================================================
async function cenaNormal() {
  const { ctx, page, estouros } = await abrirPainel({});
  const achou = await abrirUmaRenomeavel(page);
  ok("achei uma conversa com o lápis de renomear", achou);
  if (!achou) { ok("cheguei a renomear", false); await ctx.close(); return; }
  await renomear(page);

  const filme = await oFilme(page);
  ok("no caminho normal a tela não fala em falha nenhuma",
     !/não consegui|não deixou|confira a conexão/i.test(filme), filme);
  const nome = await page.locator("[data-nome-do-contato]").innerText();
  ok("e o nome novo fica na tela", nome.trim() === "NOME DE PROVA", nome);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  5. NÃO É SÓ O CONTATO: a nota também conta o código
//
//  A régua vale para toda gravação. Uma prova que só medisse o lugar
//  relatado deixaria os outros voltarem ao "Tente de novo." no dia seguinte.
// ==================================================================
async function cenaDaNota() {
  const { ctx, page } = await abrirPainel({});
  const base = await page.evaluate(() => {
    const id = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
    const m = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
    return c ? { advogado_id: c.advogado_id, mensagem: m || null } : null;
  });
  await ctx.close();
  ok("aprendi o feitio de uma conversa de verdade", !!base?.advogado_id);
  if (!base?.advogado_id) return;

  const agora = Date.now();
  const TEXTO = "combinado: cliente paga dia 10";
  const semente = {
    contatos: [{ id: "ct-cd", nome: "ZZ Codigo Da Nota", numero: "5521977440022",
                 vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null }],
    conversas: [{ id: "conv-cd", contato_id: "ct-cd", advogado_id: base.advogado_id,
                  fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
                  ultima_mensagem: "oi", ultima_atividade: new Date(agora - 60000).toISOString(),
                  frente: null, vantoro_nome: null, digitando_ate: null,
                  atendendo_por: null, atendendo_em: null,
                  contato: { nome: "ZZ Codigo Da Nota", numero: "5521977440022", foto_url: null,
                             vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null } }],
    mensagens: [{ ...(base.mensagem || {}), id: "msg-cd", conversa_id: "conv-cd",
                  texto: "oi", criado_em: new Date(agora - 90000).toISOString() }],
    notas: [{ id: "n-cd", conversa_id: "conv-cd", texto: TEXTO,
              autor: "Rodrigo", autor_id: null, autor_foto: null,
              apagada_em: null, editada_em: null, editada_por: null,
              processo_id: null, processo_numero: null, processo_reu: null,
              criado_em: new Date(agora - 30000).toISOString() }],
  };

  const a = await abrirPainel({ erro: { code: "42501", message: "permission denied for table notas" },
                                tabela: "notas", semente });
  const linha = a.page.locator('[data-conversa-nome*="ZZ Codigo Da Nota"]');
  const abriu = (await linha.count()) > 0;
  ok("a conversa com a nota abre", abriu);
  if (abriu) {
    await linha.first().click();
    await a.page.waitForSelector("[data-topo-conversa]").catch(() => {});
    await a.page.waitForTimeout(900);
  }
  const temLapis = abriu && (await a.page.locator('button[title="Editar nota"]').count()) > 0;
  ok("o lápis de editar a nota está na bolha", temLapis);
  if (temLapis) {
    await a.page.locator('button[title="Editar nota"]').first().click();
    await a.page.waitForTimeout(800);
    const caixa = a.page.locator("textarea").first();
    await caixa.fill("combinado: cliente paga dia 20");
    await caixa.press("Enter");
    await a.page.waitForTimeout(1500);
    const filme = await oFilme(a.page);
    ok("a nota também mostra o código do banco", /42501/.test(filme), filme);
    ok("e diz, em português, que não editou", /não consegui editar a nota/i.test(filme), filme);
  } else {
    ok("cheguei a editar a nota", false);
    ok("a nota também mostra o código do banco", false);
  }
  ok("sem erro de JavaScript no caminho", a.estouros.length === 0, a.estouros.join(" | "));
  await a.ctx.close();
}

// ==================================================================
console.log("\nO banco recusou com erro: a frase leva o código");
await cenaComCodigo();

console.log("\nO pedido não chegou ao banco: outra frase, e outra ação");
await cenaSemCodigo();

console.log("\nO banco aceitou e não mexeu: continua sem código, e é certo");
await cenaRecusaCalada();

console.log("\nE no caminho normal nada disso aparece");
await cenaNormal();

console.log("\nA régua vale para toda gravação, não só para o contato");
await cenaDaNota();

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
