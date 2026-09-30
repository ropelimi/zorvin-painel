// O RESPONSÁVEL PELA CONVERSA — o primeiro passo do Zorvin para CRM
//
// Pedido do Rodrigo em 30/09: toda conversa ganha um DONO. Até aqui o banco
// sabia quem escreveu em cada conversa e quem está com ela aberta agora, mas
// não quem responde por aquele cliente — e sem isso não há "as minhas
// conversas", não há passar um cliente adiante, não há cobrar a fila de
// ninguém.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. sem o script 008, NADA disto aparece — nem o controle, nem o filtro,
//      nem o rosto na linha. "Minhas conversas" sem a coluna seria uma lista
//      sempre vazia, e "nenhuma conversa sua" seria mentira;
//   2. assumir, passar e tirar GRAVAM no banco — e a frase espera o banco:
//      recusado, a tela não diz "agora é sua";
//   3. quem responde primeiro ASSUME sozinho, e responder numa conversa que
//      já tem dono NÃO toma a conversa de ninguém. Esta é a metade que mais
//      importa: um "assume sempre quem responde" faria a conversa trocar de
//      dono a cada ajuda de colega, e o responsável deixaria de querer dizer
//      qualquer coisa;
//   4. "Minhas conversas" acha também a conversa que está a cinco páginas de
//      distância — senão seria "as minhas entre as 200 mais recentes" com
//      cara de "as minhas";
//   5. o tempo real que traz "sem responsável" LIMPA a tela. É `null`, e um
//      `??` no remendo da lista manteria o dono antigo;
//   6. no celular o controle mora no ⋮, e o menu aparece PINTADO — medido
//      por `elementFromPoint`, e não pelo retângulo: um ancestral com
//      `overflow: hidden` recortaria o menu sem o retângulo saber (foi o que
//      aconteceu com o menu de etiquetas em 29/09).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const EU = "u1";                       // a sessão da bancada: Rodrigo Sousa
const LIVRE = "OTAVIO SEM DONO";
const DA_JENIFER = "VALDIRENE DA JENIFER";

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo (ver o
 *  mesmo ajudante em `o-ja-tratei`: a conta de teste não vê todos). */
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

// DUAS CONVERSAS PLANTADAS, e as duas no alto da lista (atividade de agora):
// uma sem dono, e uma que já é da Jenifer. A segunda é a que separa "quem
// responde assume se não houver dono" de "quem responde assume sempre".
const agora = new Date().toISOString();
const conversa = (id, ct, nome, numero, dono) => ({
  id, advogado_id: ADV, contato_id: ct,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: agora, ultima_mensagem: "bom dia", frente: null,
  vantoro_nome: null, digitando_ate: null,
  responsavel_id: dono, responsavel_em: dono ? agora : null, responsavel_por: dono,
  contato: { id: ct, nome, numero, foto_url: null },
});
const SEMENTE = {
  contatos: [
    { id: "ct-livre", numero: "5511970003301", nome: LIVRE, vantoro_nome: null,
      nome_zorvin: null, vantoro_cliente_id: null, foto_url: null },
    { id: "ct-jen", numero: "5511970003302", nome: DA_JENIFER, vantoro_nome: null,
      nome_zorvin: null, vantoro_cliente_id: null, foto_url: null },
  ],
  conversas: [
    conversa("cv-livre", "ct-livre", LIVRE, "5511970003301", null),
    conversa("cv-jen", "ct-jen", DA_JENIFER, "5511970003302", "u-jenifer"),
  ],
  mensagens: [
    { id: "m-livre-1", conversa_id: "cv-livre", origem: "contato", tipo: "texto",
      texto: "bom dia", criado_em: agora },
    { id: "m-jen-1", conversa_id: "cv-jen", origem: "contato", tipo: "texto",
      texto: "bom dia", criado_em: agora },
  ],
};

async function abrirPainel({ semResponsavel = false, semEfeito = [], largura = 1400, altura = 900 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_RESPONSAVEL = d.semResponsavel;
    globalThis.__ESCRITA_SEM_EFEITO = d.semEfeito;
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__AVISOS_VISTOS = [];
    // O FILME, e não a foto: a faixa mostra uma frase por vez (ver
    // `a-tela-nao-diz-salvei-sem-salvar`).
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente: SEMENTE, semResponsavel, semEfeito });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}

const oFilme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));

/** O que o banco de mentira guarda sobre o dono desta conversa. */
const noBanco = (page, id) => page.evaluate((cid) => {
  const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === cid);
  return c ? { id: c.responsavel_id ?? null, por: c.responsavel_por ?? null, em: c.responsavel_em ?? null } : null;
}, id);

async function abrir(page, nome) {
  // PELO `data-`, e não pelo papel: a linha da conversa também é um botão e
  // o nome acessível dela engole tudo o que está dentro (ver CLAUDE.md, 24/09).
  const linha = page.locator(`[data-conversa-nome="${nome}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(800);
  return true;
}

/** O controle na linha do número: o texto que ele escreve, e se existe. */
const controle = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-responsavel-da-conversa]");
  return el ? { dono: el.getAttribute("data-responsavel-da-conversa"), txt: el.innerText.trim() } : null;
});

/** O menu está PINTADO? Pergunta ao ponto do meio de cada item. */
const pintado = (page, seletor) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(topo && (topo === el || el.contains(topo)));
}, seletor);

async function clicarSeExiste(page, seletor) {
  // GUARDADO: `click()` num elemento que não existe estoura a prova inteira
  // depois de 30 segundos, e uma prova que estoura não diz QUAL conferência
  // pegou o defeito (ver CLAUDE.md, "o cabeçalho não corta").
  const l = page.locator(seletor);
  if (!(await l.count())) return false;
  await l.first().click();
  await page.waitForTimeout(700);
  return true;
}

// ==================================================================
//  1. SEM O SCRIPT 008, NADA DISTO APARECE
// ==================================================================
console.log("\nSem a coluna no banco, o painel não oferece o que não pode gravar");
{
  const { ctx, page, estouros } = await abrirPainel({ semResponsavel: true });
  await abrir(page, LIVRE);
  ok("o controle do responsável não aparece", (await controle(page)) === null);
  ok("nem o rosto do dono na linha da conversa",
     (await page.locator("[data-responsavel-na-linha]").count()) === 0);
  await clicarSeExiste(page, "[data-mais-filtros]");
  ok("nem a opção “Minhas conversas” no menu de filtros",
     (await page.locator("[data-minhas-opcao]").count()) === 0);
  // O CONTRASTE: o menu abriu de verdade. Sem esta, a de cima passaria num
  // menu que não abriu.
  ok("(o menu de filtros abriu — Grupos está lá)",
     (await page.locator("[data-grupos-opcao]").count()) > 0);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  2. ASSUMIR, PASSAR, TIRAR
// ==================================================================
console.log("\nAssumir, passar para uma colega e deixar sem dono — e o banco acompanha");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("achei a conversa sem dono", await abrir(page, LIVRE));

  const antes = await controle(page);
  ok("a linha do número oferece “Assumir”", antes && antes.dono === "" && /Assumir/.test(antes.txt),
     JSON.stringify(antes));

  await clicarSeExiste(page, "[data-responsavel-da-conversa]");
  ok("o menu do responsável abre", (await page.locator("[data-menu-responsavel]").count()) > 0);
  ok("e está PINTADO, e não recortado por quem o contém",
     await pintado(page, "[data-assumir-conversa]"));
  const origem = await page.locator("[data-responsavel-origem]").innerText().catch(() => "");
  ok("e diz que ninguém é dono ainda", /Ninguém ainda/.test(origem), origem);
  // A FRASE INTEIRA, e não "Quem responder primeiro assu": a linha de onde o
  // menu pende é `nowrap`, e a frase herdava isso.
  const cabe = await page.evaluate(() => {
    const el = document.querySelector("[data-responsavel-origem]");
    return el ? el.scrollWidth <= el.clientWidth + 1 : false;
  });
  ok("e a frase cabe inteira, sem ser cortada", cabe);

  await clicarSeExiste(page, "[data-assumir-conversa]");
  await page.waitForTimeout(400);
  let b = await noBanco(page, "cv-livre");
  ok("assumindo, o banco grava EU como dono", b && b.id === EU, JSON.stringify(b));
  ok("e grava quem pôs (eu mesmo) e quando", b && b.por === EU && Boolean(b.em), JSON.stringify(b));
  let c = await controle(page);
  ok("o controle passa a dizer “Você”", c && c.dono === EU && /Você/.test(c.txt), JSON.stringify(c));
  ok("a linha da conversa ganha o meu rosto",
     (await page.locator(`[data-conversa-id="cv-livre"] [data-responsavel-na-linha="${EU}"]`).count()) === 1);
  ok("e a tela diz que a conversa é minha", /agora é sua/.test(await oFilme(page)), await oFilme(page));

  // PASSAR PARA A JENIFER
  await clicarSeExiste(page, "[data-responsavel-da-conversa]");
  const lista = await page.$$eval("[data-passar-para]", (ns) => ns.map((n) => n.getAttribute("data-passar-para")));
  ok("a lista de “Passar para” traz a equipe", lista.includes("u-jenifer") && lista.includes("u-isabela"),
     lista.join(", "));
  ok("e não me oferece a mim mesmo", !lista.includes(EU), lista.join(", "));
  ok("sendo o dono, “Assumir” sai do menu",
     (await page.locator("[data-assumir-conversa]").count()) === 0);
  await clicarSeExiste(page, '[data-passar-para="u-jenifer"]');
  await page.waitForTimeout(400);
  b = await noBanco(page, "cv-livre");
  ok("passando, o banco grava a Jenifer como dona", b && b.id === "u-jenifer", JSON.stringify(b));
  // QUEM PASSOU. É a primeira pergunta de quem recebe um cliente no meio.
  ok("e grava que fui EU quem passou", b && b.por === EU, JSON.stringify(b));
  c = await controle(page);
  ok("o controle escreve o primeiro nome dela", c && /JENIFER/.test(c.txt) && !/ALMEIDA/.test(c.txt),
     JSON.stringify(c));
  ok("e a tela diz para quem foi", /agora é de JENIFER/.test(await oFilme(page)), await oFilme(page));

  await clicarSeExiste(page, "[data-responsavel-da-conversa]");
  const origem2 = await page.locator("[data-responsavel-origem]").innerText().catch(() => "");
  ok("o menu conta quem passou a conversa", /passada por Rodrigo/.test(origem2), origem2);

  // TIRAR
  await clicarSeExiste(page, "[data-tirar-responsavel]");
  await page.waitForTimeout(400);
  b = await noBanco(page, "cv-livre");
  ok("deixando sem responsável, o banco limpa as três colunas",
     b && b.id === null && b.por === null && b.em === null, JSON.stringify(b));
  c = await controle(page);
  ok("e o controle volta a oferecer “Assumir”", c && c.dono === "" && /Assumir/.test(c.txt), JSON.stringify(c));
  ok("e o rosto sai da linha",
     (await page.locator('[data-conversa-id="cv-livre"] [data-responsavel-na-linha]').count()) === 0);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  3. O BANCO RECUSANDO CALADO, A TELA NÃO DIZ QUE ASSUMIU
// ==================================================================
console.log("\nO banco recusa sem erro — a tela não afirma o que não aconteceu");
{
  const { ctx, page, estouros } = await abrirPainel({ semEfeito: ["conversas"] });
  await abrir(page, LIVRE);
  await clicarSeExiste(page, "[data-responsavel-da-conversa]");
  await clicarSeExiste(page, "[data-assumir-conversa]");
  await page.waitForTimeout(1500);
  const filme = await oFilme(page);
  ok("a tela diz que o banco não deixou", /não deixou trocar o responsável/.test(filme), filme);
  ok("e em momento nenhum diz que a conversa é minha", !/agora é sua/.test(filme), filme);
  const c = await controle(page);
  // A RELEITURA DESFAZ: sem ela, a tela ficaria dizendo "Você" sobre uma
  // conversa que no banco não tem dono — e ninguém mais a assumiria.
  ok("e o controle volta a dizer “Assumir”", c && c.dono === "", JSON.stringify(c));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. QUEM RESPONDE PRIMEIRO ASSUME — e só se não houver dono
// ==================================================================
console.log("\nResponder assume a conversa sem dono, e não toma a de ninguém");
{
  const { ctx, page, estouros } = await abrirPainel();
  const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';

  await abrir(page, LIVRE);
  await page.fill(CAMPO, "Bom dia! Já vou ver para você.");
  await page.press(CAMPO, "Enter");
  await page.waitForTimeout(1500);
  let b = await noBanco(page, "cv-livre");
  ok("respondendo a conversa sem dono, ela passa a ser minha", b && b.id === EU, JSON.stringify(b));
  const c = await controle(page);
  ok("e a tela mostra isso sem precisar recarregar", c && c.dono === EU, JSON.stringify(c));
  // ASSUMIR POR RESPONDER É CALADO: a pessoa respondeu um cliente, e uma
  // faixa "esta conversa agora é sua" a cada primeira resposta do dia seria
  // um aviso que não pede ação — o que se aprende a não ler.
  ok("e sem faixa de aviso por isso", !/agora é sua/.test(await oFilme(page)), await oFilme(page));

  await abrir(page, DA_JENIFER);
  await page.fill(CAMPO, "Oi! A Jenifer já te retorna.");
  await page.press(CAMPO, "Enter");
  await page.waitForTimeout(1500);
  b = await noBanco(page, "cv-jen");
  ok("respondendo a conversa da Jenifer, ela CONTINUA da Jenifer", b && b.id === "u-jenifer",
     JSON.stringify(b));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4b. A CORRIDA — a colega assumiu, e o aviso ainda não chegou aqui
// ==================================================================
console.log("\nDuas pessoas respondendo juntas: quem chegou primeiro fica");
{
  // A TELA AINDA ACHA QUE A CONVERSA NÃO TEM DONO; o banco já sabe que é da
  // Isabela, que respondeu dois segundos antes. É o que o `.is(…, null)` na
  // gravação existe para resolver — conferir a lista local antes não basta,
  // porque a lista local é justamente o que está atrasado.
  const { ctx, page, estouros } = await abrirPainel();
  const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';
  await abrir(page, LIVRE);
  const c = await controle(page);
  ok("a tela ainda mostra a conversa sem dono", c && c.dono === "", JSON.stringify(c));
  await page.evaluate(() => {
    const cv = globalThis.__TABELAS.conversas.find((x) => x.id === "cv-livre");
    cv.responsavel_id = "u-isabela"; cv.responsavel_por = "u-isabela";
    cv.responsavel_em = new Date().toISOString();
  });
  await page.fill(CAMPO, "Bom dia!");
  await page.press(CAMPO, "Enter");
  await page.waitForTimeout(1500);
  const b = await noBanco(page, "cv-livre");
  ok("a minha resposta NÃO toma a conversa de quem assumiu primeiro", b && b.id === "u-isabela",
     JSON.stringify(b));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  5. "MINHAS CONVERSAS" — e a que está a cinco páginas de distância
// ==================================================================
console.log("\n“Minhas conversas” mostra só as minhas — inclusive a que não está carregada");
{
  const { ctx, page, estouros } = await abrirPainel();
  // A MINHA DESTE TELEFONE: assumida pelo caminho da tela, e não plantada.
  await abrir(page, LIVRE);
  await clicarSeExiste(page, "[data-responsavel-da-conversa]");
  await clicarSeExiste(page, "[data-assumir-conversa]");
  await page.waitForTimeout(500);

  await clicarSeExiste(page, "[data-mais-filtros]");
  const tinha = await clicarSeExiste(page, "[data-minhas-opcao]");
  ok("o menu de filtros oferece “Minhas conversas”", tinha);
  await page.waitForTimeout(1200);
  const ids = await page.$$eval("[data-conversa-id]", (ns) => ns.map((n) => n.getAttribute("data-conversa-id")));
  ok("a lista traz a minha", ids.includes("cv-livre"), ids.join(", "));
  ok("e não traz a da Jenifer", !ids.includes("cv-jen"), ids.join(", "));
  const donos = await page.evaluate((ids) => ids.map((id) =>
    (globalThis.__TABELAS.conversas.find((x) => String(x.id) === id) || {}).responsavel_id ?? null), ids);
  ok("e SÓ traz conversas minhas", donos.length > 0 && donos.every((d) => d === "u1"), JSON.stringify(donos));
  const pilula = await page.locator("[data-mais-filtros]").first().innerText().catch(() => "");
  ok("a pílula da fita escreve “Minhas”", /Minhas/.test(pilula), pilula);

  // O TELEFONE DE 1200 CONVERSAS. Uma delas, na posição ~1150, passa a ser
  // minha — pelo banco, como se um colega a tivesse passado ontem.
  const alvo = await page.evaluate(() => {
    const T = globalThis.__TABELAS;
    const adv = (T.advogados || []).find((a) => a.nome === "Arquivo");
    if (!adv) return null;
    const dele = T.conversas.filter((c) => String(c.advogado_id) === String(adv.id))
      .sort((a, b) => String(b.ultima_atividade).localeCompare(String(a.ultima_atividade)));
    const c = dele[1150];
    if (!c) return null;
    c.responsavel_id = "u1"; c.responsavel_em = new Date().toISOString(); c.responsavel_por = "u-jenifer";
    return String(c.id);
  });
  ok("plantei uma conversa minha no fundo do telefone de 1200", Boolean(alvo));
  // TROCAR DE TELEFONE ZERA O FILTRO (é de propósito — `trocarAdvogado`).
  await clicarSeExiste(page, '[data-telefone="Arquivo"]');
  await page.waitForTimeout(2500);
  const carregadas = await page.$$eval("[data-conversa-id]", (ns) => ns.map((n) => n.getAttribute("data-conversa-id")));
  // O RETRATO DE ANTES: sem ele, a de baixo passaria num telefone em que a
  // conversa estava na tela desde o começo.
  ok("a conversa do fundo NÃO está entre as carregadas", alvo && !carregadas.includes(alvo),
     `${carregadas.length} carregadas`);
  await clicarSeExiste(page, "[data-mais-filtros]");
  await clicarSeExiste(page, "[data-minhas-opcao]");
  await page.waitForTimeout(2500);
  const minhas = await page.$$eval("[data-conversa-id]", (ns) => ns.map((n) => n.getAttribute("data-conversa-id")));
  ok("e mesmo assim ela aparece em “Minhas conversas”", alvo && minhas.includes(alvo), minhas.join(", "));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  6. O TEMPO REAL QUE TRAZ "SEM DONO" LIMPA A TELA
// ==================================================================
console.log("\nUm colega tira o dono noutra tela — esta acompanha");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrir(page, DA_JENIFER);
  let c = await controle(page);
  ok("a conversa abre dizendo que é da Jenifer", c && c.dono === "u-jenifer", JSON.stringify(c));
  await page.evaluate(() => {
    const cv = globalThis.__TABELAS.conversas.find((x) => x.id === "cv-jen");
    cv.responsavel_id = null; cv.responsavel_em = null; cv.responsavel_por = null;
    globalThis.__EMITIR("UPDATE", "conversas", {
      id: "cv-jen", responsavel_id: null, responsavel_em: null, responsavel_por: null,
    });
  });
  await page.waitForTimeout(600);
  c = await controle(page);
  // O NULO É A NOTÍCIA. Um `??` no remendo da lista trataria "sem dono" como
  // "não veio nada" e manteria a Jenifer na tela.
  ok("o nulo que chega pelo tempo real tira o dono da tela", c && c.dono === "", JSON.stringify(c));
  ok("e o rosto sai da linha",
     (await page.locator('[data-conversa-id="cv-jen"] [data-responsavel-na-linha]').count()) === 0);

  // E UM AVISO QUE NÃO FALA DO DONO NÃO O APAGA: a presença (`atendendo_por`)
  // e as não lidas chegam pelo mesmo canal, sem as colunas do responsável.
  await page.evaluate(() => {
    const cv = globalThis.__TABELAS.conversas.find((x) => x.id === "cv-livre");
    cv.responsavel_id = "u-isabela";
    globalThis.__EMITIR("UPDATE", "conversas", { id: "cv-livre", responsavel_id: "u-isabela",
      responsavel_em: new Date().toISOString(), responsavel_por: "u-isabela" });
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    globalThis.__EMITIR("UPDATE", "conversas", { id: "cv-livre", nao_lidas: 2 });
  });
  await page.waitForTimeout(500);
  ok("um aviso sem as colunas do dono não apaga o dono",
     (await page.locator('[data-conversa-id="cv-livre"] [data-responsavel-na-linha="u-isabela"]').count()) === 1);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  7. NO CELULAR, PELO ⋮
// ==================================================================
console.log("\nNo celular o controle mora no ⋮, e o menu aparece inteiro");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  await abrir(page, LIVRE);
  let c = await controle(page);
  ok("a linha do número escreve “sem responsável”", c && /sem responsável/.test(c.txt), JSON.stringify(c));
  const abriuMenu = await clicarSeExiste(page, '[aria-label="Mais opções desta conversa"]');
  const item = page.locator("[data-menu-responsavel-item]");
  ok("o ⋮ tem o item do responsável", abriuMenu && (await item.count()) > 0);
  if (await item.count()) { await item.first().click(); await page.waitForTimeout(500); }
  ok("e ele abre o menu do responsável, pintado na tela",
     await pintado(page, "[data-assumir-conversa]"));
  const caixa = await page.evaluate(() => {
    const r = document.querySelector("[data-menu-responsavel]")?.getBoundingClientRect();
    return r ? { l: r.left, r: r.right } : null;
  });
  ok("e o menu cabe na largura do aparelho", caixa && caixa.l >= 0 && caixa.r <= 390, JSON.stringify(caixa));
  await clicarSeExiste(page, "[data-assumir-conversa]");
  await page.waitForTimeout(400);
  const b = await noBanco(page, "cv-livre");
  ok("assumir pelo celular grava no banco", b && b.id === EU, JSON.stringify(b));
  c = await controle(page);
  ok("e a linha passa a dizer “com você”", c && /com você/.test(c.txt), JSON.stringify(c));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
