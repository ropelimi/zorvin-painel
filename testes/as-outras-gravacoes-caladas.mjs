// AS OUTRAS GRAVAÇÕES CALADAS — a mesma forma, nos dezoito lugares que sobraram.
//
// A rodada de 24/09 consertou três telas (renomear contato, salvar contato,
// ligar o pré-cadastro) porque foram as três que o escritório relatou. A
// varredura daquele dia listou OUTROS DEZOITO lugares com a mesma forma, e
// esta prova é a rodada deles.
//
// ------------------------------------------------------------
// A FORMA, de novo, em uma frase
//
// Um `update` — e um `delete` — barrado pela regra de acesso NÃO devolve erro.
// A regra entra como um `where` a mais, nenhuma linha casa, e o banco responde
// "pronto, mexi em zero linhas" com `error` nulo. Quem confere só o `error`
// conclui que deu certo e segue em frente. (Num `insert` é diferente: ali a
// RLS levanta 42501 — por isso o defeito mora sempre em quem EDITA e APAGA, e
// por isso ele passa despercebido em revisão de código.)
//
// ------------------------------------------------------------
// O QUE ESTA PROVA MEDE
//
// Ela NÃO prova que as gravações funcionam — as outras provas já fazem isso.
// Ela prova que, quando o banco recusa EM SILÊNCIO, a tela DIZ; e que, quando
// o banco deixa, ela não grita à toa. Sem essa segunda metade, um conserto que
// reclamasse sempre passaria igual.
//
// `__ESCRITA_SEM_EFEITO = ["tags"]` é a bancada devolvendo exatamente o que o
// PostgREST devolve nesse caso: `{ data: [], error: null }`. Ela passou a
// valer para o DELETE também nesta rodada — antes só sabia recusar o `update`,
// e metade dos lugares desta lista apaga.
//
// ------------------------------------------------------------
// O FILME, E NÃO A FOTO
//
// A faixa de aviso mostra uma frase por vez, e a seguinte apaga a anterior.
// Ler só o que está na tela no fim aprova a tela que diz "Adicionada aos
// favoritos" antes de perguntar e a corrige um instante depois — que é
// exatamente o defeito de meia dúzia destes lugares. Por isso o espião de
// 50ms, como na prova de 24/09.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Abre o painel com as tabelas de `recusar` gravando em silêncio.
 *
 *  TODAS AS BANDEIRAS EM TODA ABERTURA: `addInitScript` ACUMULA, e uma bandeira
 *  ligada num cenário continuaria valendo nos seguintes (armadilha escrita no
 *  CLAUDE.md, já aconteceu duas vezes). A última escrita vence. */
async function abrirPainel({ recusar = [], semente = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // O "Apagar esta etiqueta?" é um `window.confirm`: sem isto o Playwright o
  // recusa sozinho e a prova mediria o cancelamento, não a gravação.
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await page.addInitScript((d) => {
    globalThis.__ESCRITA_SEM_EFEITO = d.recusar;
    if (d.semente) globalThis.__SEMENTE = d.semente;
    globalThis.__AVISOS_VISTOS = [];
    // UM RELÓGIO, e não um `MutationObserver`: `addInitScript` roda ANTES de
    // existir documento, e `observe(document.documentElement)` estoura ali com
    // "parameter 1 is not of type 'Node'".
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { recusar, semente });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const oFilme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));

/** Configurações → a aba pedida. */
async function abrirConfig(page, aba) {
  // PELO MENU, e não direto: o botão de Configurações mora dentro do menu ⋮ do
  // topo, e clicar às cegas fazia a prova ESTOURAR em vez de reprovar —
  // levando embora a rodada inteira, como já aconteceu na prova de 24/09.
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(600);
  // A ÚLTIMA, e não a primeira: atrás desta janela ficou a fita de filtros, que
  // também tem um botão chamado "Etiquetas".
  await page.getByRole("button", { name: aba, exact: true }).last().click();
  await page.waitForTimeout(700);
}

// ==================================================================
//  1. RENOMEAR UMA ETIQUETA  (tags, update)
// ==================================================================
async function cenaRenomearEtiqueta(recusa) {
  const { ctx, page, estouros } = await abrirPainel({ recusar: recusa ? ["tags"] : [] });
  await abrirConfig(page, "Etiquetas");

  const linha = page.locator('[data-etiqueta-da-config="Urgente"]');
  const achei = (await linha.count()) === 1;
  ok("a etiqueta de prova está na lista", achei);
  if (!achei) { ok("cheguei a renomear a etiqueta", false); await ctx.close(); return; }
  await linha.locator("[data-editar-etiqueta]").click();
  await page.waitForTimeout(400);
  const campo = page.locator('input[placeholder^="Ex.:"]').first();
  await campo.fill("Urgentíssimo");
  await page.locator("[data-salvar-etiqueta]").click();
  await page.waitForTimeout(1200);

  const filme = await oFilme(page);
  if (recusa) {
    // A TELA TEM DE DIZER. Sem isto ela fechava o formulário com "Tag salva!" e
    // a releitura trazia a etiqueta com o nome VELHO de volta à lista — quem
    // renomeou conclui que errou o clique, e renomeia de novo.
    ok("a tela diz que o banco não deixou", /não deixou/i.test(filme), filme);
    ok('e em momento nenhum diz "Tag salva!"', !/Tag salva/i.test(filme), filme);
    ok("e o formulário continua aberto, com o que foi escrito",
       (await page.locator("[data-salvar-etiqueta]").count()) === 1);
  } else {
    // O CONTRASTE. Sem ele, um conserto que recusasse SEMPRE passaria acima.
    ok('no caminho normal a tela diz "Tag salva!"', /Tag salva/i.test(filme), filme);
    ok("e não fala em recusa nenhuma", !/não deixou/i.test(filme), filme);
    ok("e a lista passa a mostrar o nome novo",
       (await page.locator('[data-etiqueta-da-config="Urgentíssimo"]').count()) === 1);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  2. APAGAR UMA ETIQUETA  (tags, delete)
// ==================================================================
async function cenaApagarEtiqueta(recusa) {
  const { ctx, page, estouros } = await abrirPainel({ recusar: recusa ? ["tags"] : [] });
  await abrirConfig(page, "Etiquetas");

  const linha = () => page.locator('[data-etiqueta-da-config="Aguardando cliente"]');
  const achei = (await linha().count()) === 1;
  ok("a etiqueta a apagar está na lista", achei);
  if (!achei) { ok("cheguei a apagar a etiqueta", false); await ctx.close(); return; }
  await linha().locator("[data-apagar-etiqueta]").click();
  await page.waitForTimeout(1200);

  const filme = await oFilme(page);
  if (recusa) {
    // O DELETE FALHA IGUAL AO UPDATE, e é onde o silêncio mais se vê: a
    // etiqueta que a pessoa confirmou apagar reaparece na releitura, sem uma
    // palavra explicando a volta.
    ok("a tela diz que o banco não deixou apagar",
       /não deixou apagar esta etiqueta/i.test(filme), filme);
    ok("e a etiqueta continua na lista, como está no banco",
       (await linha().count()) === 1);
  } else {
    ok("no caminho normal a etiqueta sai da lista", (await linha().count()) === 0);
    ok("e a tela não fala em recusa", !/não deixou/i.test(filme), filme);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  A CONVERSA COM NOTA, para as duas cenas da nota
// ==================================================================
async function molde() {
  const { ctx, page } = await abrirPainel({});
  const m = await page.evaluate(() => {
    const id = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
    const msg = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
    return c ? { advogado_id: c.advogado_id, mensagem: msg || null } : null;
  });
  await ctx.close();
  return m;
}

const TEXTO_DA_NOTA = "combinado: cliente paga dia 10";
function sementeDaNota(base) {
  const agora = Date.now();
  return {
    contatos: [{ id: "ct-nc", nome: "ZZ Nota Calada", numero: "5521977550011",
                 vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null }],
    conversas: [{ id: "conv-nc", contato_id: "ct-nc", advogado_id: base.advogado_id,
                  fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
                  ultima_mensagem: "oi", ultima_atividade: new Date(agora - 60000).toISOString(),
                  frente: null, vantoro_nome: null, digitando_ate: null,
                  atendendo_por: null, atendendo_em: null,
                  contato: { nome: "ZZ Nota Calada", numero: "5521977550011", foto_url: null,
                             vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null } }],
    mensagens: [{ ...(base.mensagem || {}), id: "msg-nc", conversa_id: "conv-nc",
                  texto: "oi", criado_em: new Date(agora - 90000).toISOString() }],
    notas: [{ id: "n-nc", conversa_id: "conv-nc", texto: TEXTO_DA_NOTA,
              autor: "Rodrigo", autor_id: null, autor_foto: null,
              apagada_em: null, editada_em: null, editada_por: null,
              processo_id: null, processo_numero: null, processo_reu: null,
              criado_em: new Date(agora - 30000).toISOString() }],
  };
}

async function abrirAConversaDaNota(page) {
  const linha = page.locator('[data-conversa-nome*="ZZ Nota Calada"]');
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForSelector("[data-topo-conversa]").catch(() => {});
  await page.waitForTimeout(900);
  return true;
}

// ==================================================================
//  3. MARCAR A CONVERSA COMO NÃO LIDA  (conversas, update)
//
//  As quatro marcas da conversa (não lida, favorita, fixada, arquivada) passam
//  pelo MESMO caminho (`gravarMarcaDaConversa`), e as quatro diziam o sucesso
//  ANTES de perguntar ao banco. O acerto visual continua vindo na frente — é o
//  que faz o clique parecer instantâneo —, mas a FRASE é a tela afirmando um
//  fato do banco, e afirmar antes de saber é o defeito.
//
//  A cena usa o botão do cabeçalho (`data-marcar`), e não o menu ⋮ da lista:
//  medido, o clique no ⋮ da lista abre a conversa em vez do menu, e a prova
//  mediria outra coisa. O caminho gravado é o mesmo.
// ==================================================================
async function cenaMarcaDaConversa(base, recusa) {
  const { ctx, page, estouros } = await abrirPainel({
    recusar: recusa ? ["conversas"] : [], semente: sementeDaNota(base) });
  const abriu = await abrirAConversaDaNota(page);
  ok("a conversa de prova abre", abriu);
  const botao = page.locator('[data-marcar="nao-lida"]');
  const achei = abriu && (await botao.count()) === 1;
  ok('o botão "Marcar como não lida" está no cabeçalho', achei);
  if (!achei) { ok("cheguei a marcar a conversa", false); await ctx.close(); return; }
  await botao.click();
  await page.waitForTimeout(1500);

  const filme = await oFilme(page);
  if (recusa) {
    ok("a tela diz que o banco não deixou marcar",
       /não deixou marcar/i.test(filme), filme);
    // NO FILME INTEIRO, e não na última frase: a versão antiga mostrava o
    // sucesso PRIMEIRO, antes de perguntar. Quem estava olhando leu "Marcada
    // como não lida" e foi embora — e o selo não existia para ninguém.
    ok('e em momento nenhum diz "Marcada como não lida"',
       !/Marcada como não lida/i.test(filme), filme);
  } else {
    ok('no caminho normal a tela diz "Marcada como não lida"',
       /Marcada como não lida/i.test(filme), filme);
    ok("e não fala em recusa", !/não deixou/i.test(filme), filme);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. EDITAR UMA NOTA  (notas, update)
//
//  É o que mais dói perder calado desta lista toda: TEXTO QUE ALGUÉM ESCREVEU.
// ==================================================================
async function cenaEditarNota(base, recusa) {
  const { ctx, page, estouros } = await abrirPainel({
    recusar: recusa ? ["notas"] : [], semente: sementeDaNota(base) });
  const abriu = await abrirAConversaDaNota(page);
  ok("a conversa com a nota abre", abriu);
  const temNota = abriu && (await page.locator(`text="${TEXTO_DA_NOTA}"`).count()) > 0;
  ok("a nota está na tela", temNota);
  const temLapis = temNota && (await page.locator('button[title="Editar nota"]').count()) > 0;
  if (!temLapis) { ok("cheguei a editar a nota", false); await ctx.close(); return; }
  await page.locator('button[title="Editar nota"]').first().click();
  await page.waitForTimeout(800);
  const caixa = page.locator("textarea").first();
  await caixa.fill("combinado: cliente paga dia 20");
  await caixa.press("Enter");
  await page.waitForTimeout(1500);

  const filme = await oFilme(page);
  if (recusa) {
    ok("a tela diz que o banco não deixou editar a nota",
       /não deixou editar esta nota/i.test(filme), filme);
    // E DESFAZ. O texto novo foi pintado antes da resposta; recusado, ele volta
    // — senão a correção fica na tela e some no F5.
    ok("e o texto volta ao que era",
       (await page.locator(`text="${TEXTO_DA_NOTA}"`).count()) > 0,
       "a nota ficou com o texto novo, que o banco não tem");
  } else {
    ok("no caminho normal o texto corrigido fica gravado",
       (await page.evaluate(() => (globalThis.__TABELAS.notas || [])
         .find((n) => String(n.id) === "n-nc")?.texto)) === "combinado: cliente paga dia 20");
    ok("e a tela não fala em recusa", !/não deixou/i.test(filme), filme);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  5. APAGAR UMA NOTA  (notas, update)
//
//  Zero linhas é pior aqui do que um erro: a nota some da tela de quem apagou e
//  continua na de todo mundo — e apagar uma nota é, quase sempre, tirar da
//  vista alguma coisa que não devia ter sido escrita ali.
// ==================================================================
async function cenaApagarNota(base, recusa) {
  const { ctx, page, estouros } = await abrirPainel({
    recusar: recusa ? ["notas"] : [], semente: sementeDaNota(base) });
  const abriu = await abrirAConversaDaNota(page);
  ok("a conversa com a nota abre", abriu);
  const temLixeira = abriu && (await page.locator('button[title="Apagar nota"]').count()) > 0;
  if (!temLixeira) { ok("cheguei a apagar a nota", false); await ctx.close(); return; }
  await page.locator('button[title="Apagar nota"]').first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Apagar a nota" }).click();
  await page.waitForTimeout(1500);

  const filme = await oFilme(page);
  if (recusa) {
    ok("a tela diz que o banco não deixou apagar a nota",
       /não deixou apagar esta nota/i.test(filme), filme);
    ok("e a nota continua na conversa, como está no banco",
       (await page.locator(`text="${TEXTO_DA_NOTA}"`).count()) > 0);
  } else {
    ok("no caminho normal a nota fica marcada como apagada no banco",
       Boolean(await page.evaluate(() => (globalThis.__TABELAS.notas || [])
         .find((n) => String(n.id) === "n-nc")?.apagada_em)));
    ok("e a tela não fala em recusa", !/não deixou/i.test(filme), filme);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  6. APAGAR UMA MENSAGEM RÁPIDA  (mensagens_rapidas, delete)
// ==================================================================
const RAPIDA = { id: "mr-zz", titulo: "ZZ Atalho de prova",
                 texto: "Bom dia! Já estamos com o seu processo em análise." };

async function cenaApagarRapida(recusa) {
  const { ctx, page, estouros } = await abrirPainel({
    recusar: recusa ? ["mensagens_rapidas"] : [], semente: { mensagens_rapidas: [RAPIDA] } });
  await abrirConfig(page, "Mensagens rápidas");

  const linha = () => page.locator(`[data-rapida-da-config="${RAPIDA.titulo}"]`);
  const achei = (await linha().count()) === 1;
  ok("a mensagem rápida de prova está na lista", achei);
  if (!achei) { ok("cheguei a apagar a mensagem rápida", false); await ctx.close(); return; }
  await linha().locator("[data-apagar-rapida]").click();
  await page.waitForTimeout(1200);

  const filme = await oFilme(page);
  if (recusa) {
    ok("a tela diz que o banco não deixou apagar",
       /não deixou apagar esta mensagem rápida/i.test(filme), filme);
    ok("e ela continua na lista", (await linha().count()) === 1);
  } else {
    ok("no caminho normal ela sai da lista", (await linha().count()) === 0);
    ok("e a tela não fala em recusa", !/não deixou/i.test(filme), filme);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nEtiqueta renomeada: o banco recusa calado, e a tela diz");
await cenaRenomearEtiqueta(true);
console.log("\nE com o banco deixando, ela salva e não reclama de nada");
await cenaRenomearEtiqueta(false);

console.log("\nEtiqueta apagada: o DELETE recusado calado também é dito");
await cenaApagarEtiqueta(true);
console.log("\nE com o banco deixando, ela sai da lista");
await cenaApagarEtiqueta(false);

const base = await molde();
ok("aprendi o feitio de uma conversa de verdade", !!base?.advogado_id);

console.log("\nMarca da conversa: a frase de sucesso não sai antes da resposta");
await cenaMarcaDaConversa(base, true);
console.log("\nE com o banco deixando, a frase de sucesso sai");
await cenaMarcaDaConversa(base, false);

console.log("\nNota editada: a correção que o banco recusou não fica na tela");
await cenaEditarNota(base, true);
console.log("\nE com o banco deixando, a correção fica gravada");
await cenaEditarNota(base, false);

console.log("\nNota apagada: a nota que o banco não apagou continua à vista");
await cenaApagarNota(base, true);
console.log("\nE com o banco deixando, ela é marcada como apagada");
await cenaApagarNota(base, false);

console.log("\nMensagem rápida apagada: a recusa calada é dita");
await cenaApagarRapida(true);
console.log("\nE com o banco deixando, ela sai da lista");
await cenaApagarRapida(false);

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
