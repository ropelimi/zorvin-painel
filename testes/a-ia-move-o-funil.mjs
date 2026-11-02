// A IA MOVE O FUNIL (02/11) — pedido do Rodrigo: "funil movido pela IA". Quem
// lê e decide é a ponte (script 044 e a rodada `moverOFunilComAIA`, com as
// conferências nas seções 91 e 92 da prova de lá); aqui fica o que a TELA faz.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. sem o 044 nada aparece: nem a chave, nem a descrição das etapas, nem o
//      "IA" nos cartões, na conversa ou no caminho — e nada quebra;
//   2. a ponte que não move o funil é DITA ao lado da chave (a de antes, sem
//      a chave da Anthropic, ou com FUNIL_IA=desligada), e a chave continua lá;
//   3. ligar, "ler todos de novo" e desligar chamam o banco com o funil certo,
//      e a frase diz o número que o banco devolveu;
//   4. a falha do banco é dita, e a chave fica como estava;
//   5. o telefone que usa o funil do departamento não tem chave; o que tem
//      funil próprio tem a dele;
//   6. a descrição da etapa grava, aparece, e vazia vira nula;
//   7. o cartão que a IA pôs diz "IA" e o porquê; uma pessoa que o move apaga
//      o motivo;
//   8. a conversa diz que foi a IA, e o menu da etapa diz o porquê;
//   9. o caminho do histórico diz "A IA moveu", com o porquê.
import { abrirNavegador, ENDERECO, guiaQueAbre } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** O telefone que o painel ABRE e o departamento dele. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    const advs = globalThis.__TABELAS.advogados || [];
    const a = c && advs.find((x) => String(x.id) === String(c.advogado_id));
    const dep = a && (globalThis.__TABELAS.departamentos || []).find((d) => d.id === a.departamento_id);
    return a ? { adv: a.id, nomeAdv: a.nome, dep: a.departamento_id, nomeDep: dep && dep.nome } : null;
  });
  await ctx.close();
  return r;
}

const ABRE = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ABRE), JSON.stringify(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, nomeAdv: NOME_ADV, dep: DEP, nomeDep: NOME_DEP } = ABRE;
const ET = (n) => `et-${DEP}-${n}`;   // as etapas que a bancada semeia, como o 017

const agora = new Date().toISOString();
const haDias = (d) => new Date(Date.now() - d * 86400000).toISOString();
const MOTIVO = "Recebeu a proposta e disse que vai pensar.";
const NOMES = { p1: "IA CLIENTE QUE A IA MOVEU", p2: "IA CLIENTE PARADO" };
const NUM = { p1: "5511970006601", p2: "5511970006602" };
const contato = (k) => ({ id: `ct-${k}`, numero: NUM[k], nome: NOMES[k], vantoro_nome: null,
                          nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k) => ({
  id: `cv-${k}`, advogado_id: ADV, contato_id: `ct-${k}`, nao_lidas: 0,
  arquivada: false, fixada: false, favorita: false, ultima_atividade: agora, ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: NUM[k], foto_url: null },
});
const SEMENTE = {
  contatos: [contato("p1"), contato("p2")],
  conversas: [conversa("p1"), conversa("p2")],
  mensagens: ["p1", "p2"].map((k) => ({ id: `m-${k}`, conversa_id: `cv-${k}`, origem: "contato",
                                        tipo: "texto", texto: "oi", criado_em: agora })),
  // O p1 A IA PÔS em "Proposta/acordo enviado" ontem; o p2 está onde entrou.
  zorvin_cartoes: [
    { id: "cartao-p1", contato_id: "ct-p1", departamento_id: DEP, advogado_id: null, etapa_id: ET(4),
      criado_em: haDias(3), movido_em: haDias(1), movido_por: null, ia_motivo: MOTIVO, ia_leu_ate: agora },
    { id: "cartao-p2", contato_id: "ct-p2", departamento_id: DEP, advogado_id: null, etapa_id: ET(1),
      criado_em: haDias(3), movido_em: haDias(3), movido_por: null, ia_motivo: null, ia_leu_ate: null },
  ],
  zorvin_movimentos: [
    { id: "mv-p1-entrou", contato_id: "ct-p1", departamento_id: DEP, advogado_id: null, de_etapa: null,
      para_etapa: ET(1), quem: null, pela_ia: false, motivo: null, quando: haDias(3) },
    { id: "mv-p1-ia", contato_id: "ct-p1", departamento_id: DEP, advogado_id: null, de_etapa: ET(1),
      para_etapa: ET(4), quem: null, pela_ia: true, motivo: MOTIVO, quando: haDias(1) },
  ],
};
// O TELEFONE COM FUNIL PRÓPRIO (043), com as etapas dele.
const SEMENTE_DO_TELEFONE = {
  ...SEMENTE,
  zorvin_funis: [{ id: "fn-tel", departamento_id: DEP, advogado_id: ADV, ativo: true, ia_ligada: false }],
};
const ESTADO = {
  atual: { ok: true, ligado: true, modelo: "claude-de-mentira", resumo: true, assunto: true, funil: true },
  antiga: { ok: true, ligado: true, modelo: "claude-de-mentira", resumo: true, assunto: true },
  semChave: { ok: true, ligado: false, modelo: "claude-de-mentira", resumo: true, assunto: true, funil: true },
  desligada: { ok: true, ligado: true, modelo: "claude-de-mentira", resumo: true, assunto: true, funil: false },
};

async function abrirPainel({ semIa = false, semente = SEMENTE, estado = ESTADO.atual, largura = 1920 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const estouros = [];
  // NO CONTEXTO, e não na página: desde 02/11 o funil abre numa guia nova, e
  // ela precisa nascer com a semente, as bandeiras e a ponte de mentira.
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => estouros.push(e.message));
    p.on("dialog", (d) => d.accept());
  });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await ctx.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_IA_DO_FUNIL = d.semIa;
    globalThis.__SEM_FUNIS_DOS_TELEFONES = false;
    globalThis.__IA_DO_FUNIL_FALHA = false;
    globalThis.__SOU_ADMIN = true;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__CHAMADAS_IA_DO_FUNIL = [];
  }, { semente, semIa });
  await ctx.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(200, estado);
    // SEM VANTORO: a ficha fixa estreitaria a conversa sem nada a ver com isto.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  if (semente === SEMENTE_DO_TELEFONE) {
    // As etapas do funil do telefone, copiadas das do departamento (o que o
    // 043 faz ao criar), plantadas depois da semente: a bancada semeia as do
    // departamento, e estas vêm por cima.
    await page.evaluate(({ dep, adv }) => {
      const base = (globalThis.__TABELAS.zorvin_etapas || []).filter((e) => String(e.departamento_id) === String(dep) && !e.advogado_id);
      base.forEach((e, i) => globalThis.__TABELAS.zorvin_etapas.push({ ...e, id: `et-tel-${i + 1}`, advogado_id: adv }));
    }, { dep: DEP, adv: ADV });
  }
  return { ctx, page, estouros };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const attr = async (loc, nome) => ((await loc.count()) ? loc.first().getAttribute(nome).catch(() => null) : null);
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
async function abrirMenuTopo(page) {
  return clicar(page.getByRole("button", { name: "Menu", exact: true }));
}
/** Abre o funil pelo menu, como quem clica: ele abre numa GUIA NOVA (02/11),
 *  e é ela que volta, já desenhada — ou `null`. */
async function abrirFunil(ctx, page) {
  if (!(await abrirMenuTopo(page))) return null;
  if (!(await page.locator("[data-abrir-funil]").count())) return null;
  const funil = await guiaQueAbre(ctx, () => clicar(page.locator("[data-abrir-funil]")));
  if (!funil) return null;
  if (!(await funil.waitForSelector('[data-tela="funil"]', { timeout: 20000 }).then(() => true).catch(() => false))) return null;
  await funil.waitForTimeout(1000);
  return funil;
}
async function abrirAdmin(page) {
  if (!(await abrirMenuTopo(page))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(1500);
  return true;
}
async function abrirConversa(page, nome) {
  await clicar(page.locator(`[data-conversa-nome="${nome}"]`));
  await page.waitForTimeout(1000);
}
const chamadas = (page) => page.evaluate(() => globalThis.__CHAMADAS_IA_DO_FUNIL || []);
const ultima = (page) => page.evaluate(() => globalThis.__ULTIMA_IA_DO_FUNIL || null);
const linhaDoFunil = (page, dep, tel = null) => page.evaluate(({ dep, tel }) => (globalThis.__TABELAS.zorvin_funis || [])
  .find((f) => String(f.departamento_id) === String(dep) && String(f.advogado_id || "") === String(tel || "")) || null, { dep, tel });
const estadoDaChave = (page) => attr(page.locator("[data-ia-do-funil]"), "data-ia-do-funil");
const clicarNaChave = (page) => clicar(page.locator("[data-chave-da-ia] [role=switch]"));

// ------------------------------------------------------------------
console.log("\n1. Sem o 044, nada da IA aparece, e nada quebra");
{
  const { ctx, page, estouros } = await abrirPainel({ semIa: true });
  ok("abriu a administração", await abrirAdmin(page));
  ok("a seção das etapas está lá", (await page.locator("[data-etapas-do-funil]").count()) === 1);
  ok("mas sem a chave da IA", (await page.locator("[data-ia-do-funil]").count()) === 0);
  ok("e sem descrever etapa", (await page.locator("[data-etapa-descrever]").count()) === 0);
  await clicar(page.locator('button[aria-label="Fechar"]'));
  await page.waitForTimeout(800);
  const funil = await abrirFunil(ctx, page);
  ok("abriu o funil", Boolean(funil));
  ok("o cartão não diz IA", Boolean(funil) && (await funil.locator("[data-cartao-pela-ia]").count()) === 0);
  // O FUNIL ABRE NUMA GUIA NOVA (02/11): a conversa se abre na guia das
  // conversas, que ficou onde estava.
  if (funil) await funil.close();
  await abrirConversa(page, NOMES.p1);
  ok("a conversa não diz IA", (await page.locator("[data-etapa-pela-ia]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. A ponte que não move o funil é dita, e a chave fica");
for (const [qual, re, nome] of [["antiga", /de antes desta função/, "a ponte de antes"],
                                 ["semChave", /ANTHROPIC_API_KEY/, "a ponte sem a chave da Anthropic"],
                                 ["desligada", /FUNIL_IA=desligada/, "a IA desligada na ponte"]]) {
  const { ctx, page } = await abrirPainel({ estado: ESTADO[qual] });
  await abrirAdmin(page);
  ok(`${nome}: a chave está lá`, (await page.locator("[data-chave-da-ia] [role=switch]").count()) === 1);
  ok(`${nome}: e a frase diz por que a IA não vai mover`, re.test(await texto(page.locator("[data-aviso-da-ponte-do-funil]"))),
     await texto(page.locator("[data-aviso-da-ponte-do-funil]")));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Ligar, ler de novo, desligar — e a falha");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abriu a administração", await abrirAdmin(page));
  await page.locator("[data-etapas-departamento]").selectOption(String(DEP)).catch(() => {});
  await page.waitForTimeout(800);
  ok("com a ponte atual, nenhum aviso", (await page.locator("[data-aviso-da-ponte-do-funil]").count()) === 0);
  ok("sem linha no banco, a chave está desligada", (await estadoDaChave(page)) === "desligada", String(await estadoDaChave(page)));
  ok("e diz de qual funil é", new RegExp(`clientes de ${NOME_DEP} de etapa`).test(await texto(page.locator("[data-ia-do-funil]"))));
  await clicarNaChave(page);
  await page.waitForTimeout(900);
  const c1 = (await chamadas(page)).slice(-1)[0] || {};
  ok("ligar pede ao banco o funil do departamento", String(c1.p_departamento) === String(DEP) && c1.p_telefone === null
     && c1.p_ligar === true && c1.p_de_novo === false, JSON.stringify(c1));
  const u1 = await ultima(page);
  const feito1 = await texto(page.locator("[data-ia-do-funil-feito]"));
  ok("e a frase diz o número que o banco devolveu", u1 && u1.clientes > 0
     && new RegExp(`Ligada\\. A IA vai ler os ${u1.clientes} clientes deste funil`).test(feito1), `${JSON.stringify(u1)} — ${feito1}`);
  ok("a chave fica ligada", (await estadoDaChave(page)) === "ligada", String(await estadoDaChave(page)));
  ok("e o funil do departamento ganhou a sua linha", (await linhaDoFunil(page, DEP))?.ia_ligada === true);
  await clicar(page.locator("[data-ia-ler-de-novo]"));
  await page.waitForTimeout(900);
  const c2 = (await chamadas(page)).slice(-1)[0] || {};
  ok("\"ler todos de novo\" pede com p_de_novo", c2.p_ligar === true && c2.p_de_novo === true, JSON.stringify(c2));
  ok("e a frase diz que vai ler de novo", /A IA vai ler de novo/.test(await texto(page.locator("[data-ia-do-funil-feito]"))));
  await clicarNaChave(page);
  await page.waitForTimeout(900);
  const c3 = (await chamadas(page)).slice(-1)[0] || {};
  ok("desligar pede p_ligar falso", c3.p_ligar === false, JSON.stringify(c3));
  ok("e a frase diz que o que ela fez fica", /O que ela já fez fica como está/.test(await texto(page.locator("[data-ia-do-funil-feito]"))));
  ok("a chave fica desligada", (await estadoDaChave(page)) === "desligada");
  // A FALHA: a chave fica como estava, e a frase diz, com o código.
  await page.evaluate(() => { globalThis.__IA_DO_FUNIL_FALHA = true; });
  await clicarNaChave(page);
  await page.waitForTimeout(900);
  ok("a falha do banco é dita, com o código", /Não consegui ligar a IA neste funil.*57014/.test(await texto(page.locator('[role="alert"]'))),
     await texto(page.locator('[role="alert"]')));
  ok("e a chave continua desligada", (await estadoDaChave(page)) === "desligada", String(await estadoDaChave(page)));
  await page.evaluate(() => { globalThis.__IA_DO_FUNIL_FALHA = false; });
  // O TELEFONE QUE USA O DO DEPARTAMENTO não tem funil para a IA cuidar.
  await page.locator("[data-etapas-departamento]").selectOption(`${DEP}|${ADV}`).catch(() => {});
  await page.waitForTimeout(800);
  ok("o telefone que usa o funil do departamento não tem chave",
     (await page.locator("[data-telefone-usa-o-do-departamento]").count()) === 1
     && (await page.locator("[data-ia-do-funil]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. O telefone com funil próprio tem a chave dele");
{
  const { ctx, page } = await abrirPainel({ semente: SEMENTE_DO_TELEFONE });
  await abrirAdmin(page);
  await page.locator("[data-etapas-departamento]").selectOption(`${DEP}|${ADV}`).catch(() => {});
  await page.waitForTimeout(900);
  ok("a chave do funil do telefone, com o nome dele",
     new RegExp(`clientes de ${NOME_DEP} · ${NOME_ADV} de etapa`).test(await texto(page.locator("[data-ia-do-funil]"))),
     await texto(page.locator("[data-ia-do-funil]")));
  await clicarNaChave(page);
  await page.waitForTimeout(900);
  const c = (await chamadas(page)).slice(-1)[0] || {};
  ok("ligar pede ao banco o funil do telefone", String(c.p_telefone) === String(ADV) && c.p_ligar === true, JSON.stringify(c));
  ok("e a linha do telefone fica ligada", (await linhaDoFunil(page, DEP, ADV))?.ia_ligada === true);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. A descrição da etapa");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirAdmin(page);
  await page.locator("[data-etapas-departamento]").selectOption(String(DEP)).catch(() => {});
  await page.waitForTimeout(800);
  const linha = page.locator('[data-etapa-da-config="Novo contato"]');
  ok("cada etapa em uso oferece descrever", await clicar(linha.locator("[data-etapa-descrever]")));
  await page.locator("[data-etapa-descricao-editando]").fill("O cliente   escreveu e ninguém respondeu ainda.").catch(() => {});
  await clicar(page.locator("[data-etapa-descricao-salvar]"));
  await page.waitForTimeout(800);
  const noBanco = await page.evaluate((id) => ((globalThis.__TABELAS.zorvin_etapas || []).find((e) => e.id === id) || {}).descricao, ET(1));
  ok("grava, com os espaços arrumados", noBanco === "O cliente escreveu e ninguém respondeu ainda.", String(noBanco));
  ok("e aparece embaixo do nome", /ninguém respondeu ainda/.test(await texto(linha.locator("[data-etapa-descricao]"))));
  await clicar(linha.locator("[data-etapa-descrever]"));
  await page.locator("[data-etapa-descricao-editando]").fill("   ").catch(() => {});
  await clicar(page.locator("[data-etapa-descricao-salvar]"));
  await page.waitForTimeout(800);
  const vazia = await page.evaluate((id) => ((globalThis.__TABELAS.zorvin_etapas || []).find((e) => e.id === id) || {}).descricao, ET(1));
  ok("vazia vira nula", vazia === null, JSON.stringify(vazia));
  ok("e some de baixo do nome", (await linha.locator("[data-etapa-descricao]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. O cartão que a IA pôs diz IA e o porquê; uma pessoa que o move apaga o motivo");
{
  const { ctx, page: conversas, estouros } = await abrirPainel();
  const funil = await abrirFunil(ctx, conversas);
  ok("abriu o funil", Boolean(funil));
  const page = funil || conversas;
  await page.locator("[data-funil-departamento]").selectOption(String(DEP)).catch(() => {});
  await page.waitForTimeout(900);
  const p1 = page.locator('[data-cartao-do-funil="ct-p1"]');
  ok("o cartão do p1 diz IA e o porquê", MOTIVO && (await texto(p1.locator("[data-cartao-pela-ia]"))).includes(MOTIVO),
     await texto(p1.locator("[data-cartao-pela-ia]")));
  ok("o do p2 não", (await page.locator('[data-cartao-do-funil="ct-p2"] [data-cartao-pela-ia]').count()) === 0);
  await p1.locator("[data-mover-cartao]").selectOption(ET(2)).catch(() => {});
  await page.waitForTimeout(900);
  ok("movido por uma pessoa, o cartão deixa de dizer IA", (await page.locator('[data-cartao-do-funil="ct-p1"] [data-cartao-pela-ia]').count()) === 0);
  const noBanco = await page.evaluate(() => (globalThis.__TABELAS.zorvin_cartoes || []).find((k) => k.id === "cartao-p1"));
  ok("e no banco o motivo saiu", noBanco && noBanco.etapa_id === ET(2) && noBanco.ia_motivo === null, JSON.stringify(noBanco));
  const mov = await page.evaluate(() => (globalThis.__TABELAS.zorvin_movimentos || []).slice(-1)[0]);
  ok("e o passo é de gente, e não da IA", mov && mov.pela_ia === false && mov.para_etapa === ET(2), JSON.stringify(mov));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. A conversa diz que foi a IA, e o menu diz o porquê");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, NOMES.p1);
  ok("o selo da etapa tem a marca da IA", (await page.locator("[data-etapa-pela-ia]").count()) === 1);
  await clicar(page.locator("[data-etapa-da-conversa]"));
  await page.waitForTimeout(400);
  const motivo = await texto(page.locator("[data-motivo-da-ia]"));
  ok("o menu da etapa diz o porquê, e que escolher outra o apaga",
     motivo.includes(MOTIVO) && /Escolher outra etapa apaga este motivo/.test(motivo), motivo);
  await page.keyboard.press("Escape");
  await abrirConversa(page, NOMES.p2);
  ok("a conversa do p2 não tem a marca", (await page.locator("[data-etapa-pela-ia]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. O caminho do histórico diz que foi a IA, e por quê");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, NOMES.p1);
  ok("o histórico abre", await clicar(page.locator('button[title^="Histórico de atendimento"]')));
  await page.waitForTimeout(1500);
  const passos = await page.$$eval("[data-historico-funil] [data-passo-no-caminho]", (ns) => ns.map((p) => ({
    tipo: p.getAttribute("data-passo-no-caminho"), texto: p.innerText.replace(/\s+/g, " "),
    motivo: (p.querySelector("[data-motivo-no-caminho]")?.innerText || "").replace(/\s+/g, " ") }))).catch(() => []);
  const moveu = passos.find((p) => p.tipo === "moveu") || {};
  ok("o passo diz \"A IA moveu\"", /A IA moveu de/.test(moveu.texto || ""), JSON.stringify(passos));
  ok("com o porquê", (moveu.motivo || "").includes(MOTIVO), moveu.motivo);
  const entrou = passos.find((p) => p.tipo === "entrou") || {};
  ok("e a entrada continua sendo do cliente que escreveu, sem porquê", /sozinho/.test(entrou.texto || "") && !entrou.motivo,
     JSON.stringify(entrou));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
