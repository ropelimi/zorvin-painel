// O FUNIL DE CADA TELEFONE (02/11) — pedido do Rodrigo: "ideal também ter a
// opção de funil para cada telefone". A conta é do script 043 da ponte, com
// as conferências num Postgres de verdade (seção 90 da prova de lá); aqui fica
// o que a TELA faz com ela.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. sem o 043 nada muda: a conversa mostra a etapa do funil do
//      departamento, a tela de colunas e a administração só falam de
//      departamentos — e nenhuma consulta menciona a coluna do telefone (o
//      banco sem ela responderia 42703);
//   2. com o 043, a administração diz que o telefone usa o funil do
//      departamento e cria o dele: a frase sai do que o banco devolveu
//      (quantas etapas, quantos clientes), e os cartões nascem NA ETAPA DE
//      MESMO NOME;
//   3. fechada a administração, a conversa do telefone mostra a etapa do
//      funil DELE, e mudar a etapa grava no cartão dele — o do departamento
//      fica como estava;
//   4. a tela de colunas abre no funil do telefone aberto na barra, diz o
//      nome dele, e a escolha leva ao funil do departamento — sem o cliente
//      que só fala com o telefone de funil próprio;
//   5. o caminho do histórico separa os dois funis, pelo nome;
//   6. o relatório tem um bloco para cada funil;
//   7. voltar ao funil do departamento: a frase diz o que houve, e a conversa
//      volta a mostrar a etapa do departamento;
//   8. a leitura dos funis que falha é DITA — na conversa e na tela de colunas
//      — e não vira "nenhum telefone tem funil próprio".
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** O telefone que o painel ABRE, o departamento dele e um vizinho do mesmo departamento. */
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
    const vizinho = a && advs.find((x) => x.departamento_id === a.departamento_id && x.id !== a.id && x.ativo !== false);
    const dep = a && (globalThis.__TABELAS.departamentos || []).find((d) => d.id === a.departamento_id);
    return a && vizinho ? { adv: a.id, nomeAdv: a.nome, dep: a.departamento_id, nomeDep: dep && dep.nome,
                            viz: vizinho.id } : null;
  });
  await ctx.close();
  return r;
}

const ABRE = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre, e um vizinho do mesmo departamento", Boolean(ABRE), JSON.stringify(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, nomeAdv: NOME_ADV, dep: DEP, nomeDep: NOME_DEP, viz: VIZ } = ABRE;
const ET = (n) => `et-${DEP}-${n}`;   // as etapas que a bancada semeia, como o 017

const agora = new Date().toISOString();
const NOMES = { p1: "FUNIL SÓ DO PRIMEIRO", p2: "FUNIL DOS DOIS TELEFONES", p3: "FUNIL SÓ DO VIZINHO",
                p4: "FUNIL SEM CARTÃO NENHUM", p5: "FUNIL PARA TRAZER" };
const NUM = { p1: "5511970005501", p2: "5511970005502", p3: "5511970005503", p4: "5511970005504", p5: "5511970005505" };
const contato = (k) => ({ id: `ct-${k}`, numero: NUM[k], nome: NOMES[k], vantoro_nome: null,
                          nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k, tel, sufixo = "", quando = agora) => ({
  id: `cv-${k}${sufixo}`, advogado_id: tel, contato_id: `ct-${k}`, nao_lidas: 0,
  arquivada: false, fixada: false, favorita: false, ultima_atividade: quando, ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: NUM[k], foto_url: null },
});
const cartao = (k, etapa, tel = null, id = `cartao-${k}`) => ({
  id, contato_id: `ct-${k}`, departamento_id: DEP, advogado_id: tel, etapa_id: etapa,
  criado_em: agora, movido_em: agora, movido_por: "u1" });
// O p1 fala só com o telefone que abre; o p2, com os dois; o p3, só com o
// vizinho. Os três estão no funil do departamento, cada um numa etapa. O p4 e
// o p5 falam só com o telefone que abre e não estão em funil nenhum: o p4 é
// posto pela conversa, e o p5 entra pelo "Trazer conversas".
const SEMENTE = {
  contatos: [contato("p1"), contato("p2"), contato("p3"), contato("p4"), contato("p5")],
  // A conversa do p2 pelo vizinho é a MAIS ANTIGA das duas: é ela que o
  // cartão do funil do departamento tem de abrir, e não a mais recente.
  conversas: [conversa("p1", ADV), conversa("p2", ADV), conversa("p2", VIZ, "b", new Date(Date.now() - 3600000).toISOString()),
              conversa("p3", VIZ),
              conversa("p4", ADV), conversa("p5", ADV)],
  mensagens: ["p1", "p2", "p2b", "p3", "p4", "p5"].map((k) => ({ id: `m-${k}`, conversa_id: `cv-${k}`, origem: "contato",
                                                                 tipo: "texto", texto: "oi", criado_em: agora })),
  zorvin_cartoes: [cartao("p1", ET(3)), cartao("p2", ET(4)), cartao("p3", ET(1))],
  // O PASSO DE QUANDO O p1 ENTROU NO FUNIL DO DEPARTAMENTO, como o gatilho do
  // 017 o escreve. É ele que o caminho do histórico tem de continuar
  // mostrando depois que o telefone ganha funil próprio.
  zorvin_movimentos: [{ id: "mv-p1-dep", contato_id: "ct-p1", departamento_id: DEP, advogado_id: null,
                        de_etapa: null, para_etapa: ET(3), quem: null,
                        quando: new Date(Date.now() - 5 * 86400000).toISOString() }],
};

async function abrirPainel({ semFunis = false, recusarLeitura = [], semente = SEMENTE, largura = 1920 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_FUNIS_DOS_TELEFONES = d.semFunis;
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura;
    globalThis.__SOU_ADMIN = true;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente, semFunis, recusarLeitura });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
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
async function abrirFunil(page) {
  if (!(await abrirMenuTopo(page))) return false;
  if (!(await clicar(page.locator("[data-abrir-funil]")))) return false;
  await page.waitForTimeout(1000);
  return true;
}
async function abrirAdmin(page) {
  if (!(await abrirMenuTopo(page))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(1300);
  return true;
}
async function fecharAdmin(page) {
  await clicar(page.locator('[role="dialog"] button[aria-label="Fechar"], button[aria-label="Fechar"]'));
  await page.waitForTimeout(1200);
}
async function abrirConversa(page, nome) {
  await clicar(page.locator(`[data-conversa-nome="${nome}"]`));
  await page.waitForTimeout(1000);
}
const etapaDaConversa = (page) => attr(page.locator("[data-etapa-da-conversa]"), "data-etapa-da-conversa");
const colunaDe = (page, k) => page.locator(`[data-cartao-do-funil="ct-${k}"]`).first()
  .evaluate((el) => el.closest("[data-coluna-do-funil]")?.getAttribute("data-coluna-do-funil")).catch(() => null);
const cartoesNoBanco = (page, k) => page.evaluate((ct) => (globalThis.__TABELAS.zorvin_cartoes || [])
  .filter((c) => c.contato_id === ct)
  .map((c) => ({ tel: c.advogado_id || null,
                 etapa: ((globalThis.__TABELAS.zorvin_etapas || []).find((e) => e.id === c.etapa_id) || {}).nome })), `ct-${k}`);
// ------------------------------------------------------------------
console.log("\n1. Sem o 043, tudo como antes");
{
  const { ctx, page, estouros } = await abrirPainel({ semFunis: true });
  await abrirConversa(page, NOMES.p1);
  ok("a conversa mostra a etapa do funil do departamento", (await etapaDaConversa(page)) === "Aguardando cliente",
     String(await etapaDaConversa(page)));
  ok("sem frase de erro no menu da etapa", !(await page.locator("[data-etapa-da-conversa]").count())
     || !/Não consegui/.test(await texto(page.locator("[data-etapa-da-conversa]"))));
  ok("abriu o funil", await abrirFunil(page));
  ok("a escolha do alto não oferece funil de telefone",
     (await page.locator('[data-funil-departamento] option[data-opcao-de-funil="telefone"]').count()) === 0);
  ok("e o p1 está na coluna dele", (await colunaDe(page, "p1")) === "Aguardando cliente", String(await colunaDe(page, "p1")));
  ok("nem aviso de falha dos funis", (await page.locator("[data-falha-dos-funis]").count()) === 0);
  // NO BANCO SEM O 043 a bancada responde 42703 a quem pedir a coluna do
  // telefone: a leitura do funil sem falha nenhuma é a prova de que nenhuma
  // consulta a mencionou.
  ok("e a leitura do funil não falhou (nenhuma consulta pediu a coluna do telefone)",
     (await page.locator("[data-falha-do-funil]").count()) === 0, await texto(page.locator("[data-falha-do-funil]")));
  await clicar(page.getByRole("button", { name: "Voltar" }));
  await page.waitForTimeout(500);
  ok("abriu a administração", await abrirAdmin(page));
  const secao = page.locator("[data-etapas-do-funil]");
  ok("a seção das etapas está lá", (await secao.count()) === 1);
  ok("e a escolha é só de departamentos (nenhum telefone na lista)",
     (await secao.locator("[data-etapas-departamento] optgroup").count()) === 0
     && (await secao.locator("[data-opcao-telefone]").count()) === 0);
  ok("nem o botão de criar o funil de um telefone", (await page.locator("[data-criar-funil-do-telefone]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Com o 043: a administração cria o funil do telefone");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, NOMES.p1);
  ok("antes, a conversa mostra a etapa do funil do departamento", (await etapaDaConversa(page)) === "Aguardando cliente",
     String(await etapaDaConversa(page)));
  ok("abriu a administração", await abrirAdmin(page));
  const secao = page.locator("[data-etapas-do-funil]");
  ok("a escolha agrupa por departamento, com os telefones dentro",
     (await secao.locator("[data-etapas-departamento] optgroup").count()) > 1);
  await secao.locator("[data-etapas-departamento]").selectOption(`${DEP}|${ADV}`).catch(() => {});
  await page.waitForTimeout(700);
  const usa = await texto(secao.locator("[data-telefone-usa-o-do-departamento]"));
  ok("o telefone sem funil próprio diz que usa o do departamento", new RegExp(`usa o\\s+funil do departamento ${NOME_DEP}`).test(usa.replace(/\s+/g, " ")), usa);
  ok("e não lista etapas (não é um funil sem etapas)", (await secao.locator("[data-etapa-da-config]").count()) === 0);
  ok("criou", await clicar(secao.locator("[data-criar-funil-do-telefone]")));
  await page.waitForTimeout(1000);
  const feito = (await texto(secao.locator("[data-funil-do-telefone-feito]"))).replace(/\s+/g, " ");
  ok("a frase diz o que o banco fez: sete etapas copiadas e dois clientes trazidos",
     new RegExp(`Funil próprio criado para ${NOME_ADV}: 7 etapas copiadas do departamento, e 2 clientes`).test(feito), feito);
  const etapasDele = await secao.locator("[data-etapa-da-config]").evaluateAll((els) => els.map((e) => e.getAttribute("data-etapa-da-config")));
  ok("as etapas do funil novo aparecem, copiadas", etapasDele.length === 7 && etapasDele[0] === "Novo contato", JSON.stringify(etapasDele));
  ok("e o botão de voltar ao funil do departamento", (await secao.locator("[data-voltar-ao-funil-do-departamento]").count()) === 1);
  const k1 = await cartoesNoBanco(page, "p1"), k2 = await cartoesNoBanco(page, "p2"), k3 = await cartoesNoBanco(page, "p3");
  ok("o p1 ganhou o cartão do telefone na etapa de MESMO NOME, e o do departamento ficou",
     k1.length === 2 && k1.some((k) => k.tel === ADV && k.etapa === "Aguardando cliente") && k1.some((k) => k.tel === null),
     JSON.stringify(k1));
  ok("o p2 também (“Proposta/acordo enviado”)", k2.some((k) => k.tel === ADV && k.etapa === "Proposta/acordo enviado"), JSON.stringify(k2));
  ok("o p3, que só fala com o vizinho, não", k3.length === 1 && k3[0].tel === null, JSON.stringify(k3));
  ok("criar uma etapa no funil do telefone leva o telefone junto", await (async () => {
    await secao.locator("[data-etapa-nova]").fill("Só deste telefone").catch(() => {});
    await clicar(secao.locator("[data-etapa-criar]"));
    await page.waitForTimeout(700);
    return page.evaluate((tel) => (globalThis.__TABELAS.zorvin_etapas || [])
      .some((e) => e.nome === "Só deste telefone" && e.advogado_id === tel), ADV);
  })());

  console.log("\n3. Fechada a administração, a conversa mostra o funil DELE");
  await fecharAdmin(page);
  await abrirConversa(page, NOMES.p2);
  await abrirConversa(page, NOMES.p1);
  ok("a etapa é a do cartão do telefone", (await etapaDaConversa(page)) === "Aguardando cliente", String(await etapaDaConversa(page)));
  await clicar(page.locator("[data-etapa-da-conversa]"));
  await page.waitForTimeout(300);
  ok("o menu lista as etapas do funil dele (com a nova)",
     (await page.locator('[data-menu-etapa] [data-escolher-etapa="Só deste telefone"]').count()) === 1);
  await clicar(page.locator('[data-escolher-etapa="Em atendimento"]'));
  await page.waitForTimeout(700);
  const depois = await cartoesNoBanco(page, "p1");
  ok("mudar a etapa grava no cartão do telefone", depois.some((k) => k.tel === ADV && k.etapa === "Em atendimento"), JSON.stringify(depois));
  ok("e o do departamento fica como estava", depois.some((k) => k.tel === null && k.etapa === "Aguardando cliente"), JSON.stringify(depois));
  // PÔR NO FUNIL pela conversa: o cartão nasce no funil do telefone.
  await abrirConversa(page, NOMES.p4);
  await clicar(page.locator("[data-etapa-da-conversa]"));
  await page.waitForTimeout(300);
  await clicar(page.locator('[data-escolher-etapa="Novo contato"]'));
  await page.waitForTimeout(700);
  const k4 = await cartoesNoBanco(page, "p4");
  ok("pôr no funil pela conversa cria o cartão NO FUNIL DO TELEFONE", k4.length === 1 && k4[0].tel === ADV
     && k4[0].etapa === "Novo contato", JSON.stringify(k4));

  console.log("\n4. A tela de colunas abre no funil do telefone");
  ok("abriu o funil", await abrirFunil(page));
  const escolhido = await page.locator("[data-funil-departamento]").evaluate((s) => s.options[s.selectedIndex]?.text || "").catch(() => "");
  ok("no funil do telefone aberto na barra, pelo nome", escolhido === `${NOME_DEP} · ${NOME_ADV}`, escolhido);
  ok("o p1 está em “Em atendimento”", (await colunaDe(page, "p1")) === "Em atendimento", String(await colunaDe(page, "p1")));
  ok("o p2 em “Proposta/acordo enviado”", (await colunaDe(page, "p2")) === "Proposta/acordo enviado", String(await colunaDe(page, "p2")));
  ok("e o p3, do vizinho, não está aqui", (await page.locator('[data-cartao-do-funil="ct-p3"]').count()) === 0);
  // TRAZER CONVERSAS no funil do telefone traz para ELE. O telefone da
  // bancada tem outras conversas recentes, e elas vêm junto: a frase tem de
  // dizer o número do BANCO, e não um número escrito aqui.
  const noFunilDoTelefone = () => page.evaluate((adv) => (globalThis.__TABELAS.zorvin_cartoes || [])
    .filter((k) => k.advogado_id === adv).length, ADV);
  const antesDeTrazer = await noFunilDoTelefone();
  await clicar(page.locator("[data-trazer-para-o-funil]"));
  await page.waitForTimeout(1000);
  const trazidos = (await noFunilDoTelefone()) - antesDeTrazer;
  const k5 = await cartoesNoBanco(page, "p5");
  ok("“Trazer conversas” no funil do telefone traz o p5 para ele", k5.length === 1 && k5[0].tel === ADV, JSON.stringify(k5));
  const fraseDeTrazer = await texto(page.locator("[data-aviso-do-funil]"));
  ok("e a frase diz quantos, o mesmo número do banco", trazidos > 0
     && new RegExp(`(^|\\D)${trazidos} (cliente entrou|clientes entraram)`).test(fraseDeTrazer),
     `${trazidos} no banco — ${fraseDeTrazer}`);
  ok("o p5 aparece na primeira coluna", (await colunaDe(page, "p5")) === "Novo contato", String(await colunaDe(page, "p5")));
  await page.locator("[data-funil-departamento]").selectOption(String(DEP)).catch(() => {});
  await page.waitForTimeout(1000);
  ok("no funil do departamento, o p3 e o p2 estão", (await colunaDe(page, "p3")) === "Novo contato"
     && (await colunaDe(page, "p2")) === "Proposta/acordo enviado", `${await colunaDe(page, "p3")} / ${await colunaDe(page, "p2")}`);
  ok("e o p1, que só fala com o telefone de funil próprio, não aparece (o cartão dele fica guardado)",
     (await page.locator('[data-cartao-do-funil="ct-p1"]').count()) === 0);
  // O CLIQUE NO CARTÃO DO FUNIL DO DEPARTAMENTO abre a conversa por um
  // telefone DESTE funil: o p2 fala com os dois, e aqui é a do vizinho.
  await clicar(page.locator('[data-cartao-do-funil="ct-p2"] [data-abrir-cartao]'));
  await page.waitForTimeout(1500);
  ok("o clique no cartão do p2 abre a conversa pelo vizinho (a lista é a dele)",
     (await page.locator(`[data-conversa-nome="${NOMES.p3}"]`).count()) > 0
     && (await page.locator(`[data-conversa-nome="${NOMES.p1}"]`).count()) === 0);
  await clicar(page.locator(`[data-telefone="${NOME_ADV}"]`));
  await page.waitForTimeout(1200);

  console.log("\n5. O caminho do histórico separa os dois funis");
  await abrirConversa(page, NOMES.p1);
  await clicar(page.locator('button[title^="Histórico de atendimento"]'));
  await page.waitForTimeout(1500);
  const nomes = await page.$$eval("[data-historico-funil] [data-nome-do-caminho]", (ns) => ns.map((n) => n.innerText.trim()));
  ok("um caminho com o nome do funil do telefone, e um com o do departamento",
     nomes.includes(`${NOME_DEP} · ${NOME_ADV}`) && nomes.includes(NOME_DEP), JSON.stringify(nomes));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  console.log("\n6. O relatório tem um bloco para cada funil");
  await abrirMenuTopo(page);
  await clicar(page.getByRole("button", { name: "Painel", exact: true }));
  await page.waitForTimeout(1800);
  const blocos = await page.$$eval("[data-relatorio-funil] [data-funil-departamento]", (ns) => ns.map((n) => ({
    dep: n.getAttribute("data-funil-departamento"), tel: n.getAttribute("data-funil-telefone"),
    agora: n.querySelector("[data-funil-agora]")?.getAttribute("data-funil-agora") ?? null,
    nome: (n.querySelector("[data-nome-do-bloco]") || n.firstElementChild)?.innerText?.trim() })));
  const bTel = blocos.find((b) => b.tel === NOME_ADV) || {};
  const bDep = blocos.find((b) => b.dep === NOME_DEP && !b.tel) || {};
  ok("o bloco do funil do telefone, com o nome dele", bTel.nome === `${NOME_DEP} · ${NOME_ADV}`, JSON.stringify(blocos));
  // O FUNIL DO TELEFONE tem o p1 e o p2 (copiados ao criar), o p4 (posto pela
  // conversa) e quem o "Trazer conversas" trouxe — o número sai do banco.
  const noTelefone = await page.evaluate((adv) => (globalThis.__TABELAS.zorvin_cartoes || [])
    .filter((k) => k.advogado_id === adv).length, ADV);
  ok("conta os clientes do funil do telefone, o mesmo número do banco",
     noTelefone >= 4 && String(bTel.agora) === String(noTelefone), `${noTelefone} no banco — ${JSON.stringify(bTel)}`);
  ok("e o do departamento conta os dois que se veem lá (o guardado não)", String(bDep.agora) === "2", JSON.stringify(bDep));
  await page.keyboard.press("Escape");
  await clicar(page.getByRole("button", { name: "Voltar" }));
  await page.waitForTimeout(500);

  console.log("\n7. Voltar ao funil do departamento");
  ok("abriu a administração de novo", await abrirAdmin(page));
  const secao2 = page.locator("[data-etapas-do-funil]");
  await secao2.locator("[data-etapas-departamento]").selectOption(`${DEP}|${ADV}`).catch(() => {});
  await page.waitForTimeout(700);
  ok("voltou", await clicar(secao2.locator("[data-voltar-ao-funil-do-departamento]")));
  await page.waitForTimeout(1000);
  const feito2 = (await texto(secao2.locator("[data-funil-do-telefone-feito]"))).replace(/\s+/g, " ");
  ok("a frase diz que voltou, e que o funil dele ficou guardado",
     new RegExp(`${NOME_ADV} voltou a usar o funil do departamento\\..*O funil dele ficou guardado`).test(feito2), feito2);
  ok("e agora ele oferece voltar a usar o funil próprio",
     /Voltar a usar o funil próprio/.test(await texto(secao2.locator("[data-criar-funil-do-telefone]"))));
  await fecharAdmin(page);
  await abrirConversa(page, NOMES.p2);
  await abrirConversa(page, NOMES.p1);
  ok("a conversa volta a mostrar a etapa do funil do departamento", (await etapaDaConversa(page)) === "Aguardando cliente",
     String(await etapaDaConversa(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. A leitura dos funis que falha é dita");
{
  const { ctx, page, estouros } = await abrirPainel({
    recusarLeitura: ["zorvin_funis"],
    // Um funil próprio que JÁ EXISTE: com a leitura falhando, mostrar a etapa
    // do departamento seria mostrar o cartão errado.
    semente: {
      ...SEMENTE,
      zorvin_funis: [{ id: "fn-1", departamento_id: DEP, advogado_id: ADV, ativo: true, criado_em: agora }],
      zorvin_etapas: [{ id: "et-tel-1", departamento_id: DEP, advogado_id: ADV, nome: "Do telefone", ordem: 10, ativo: true, cor: "#123456" }],
      zorvin_cartoes: [...SEMENTE.zorvin_cartoes, cartao("p1", "et-tel-1", ADV, "cartao-p1-tel")],
    },
  });
  await abrirConversa(page, NOMES.p1);
  ok("a conversa NÃO mostra a etapa do funil do departamento", (await etapaDaConversa(page)) !== "Aguardando cliente",
     String(await etapaDaConversa(page)));
  await clicar(page.locator("[data-etapa-da-conversa]"));
  await page.waitForTimeout(300);
  const menu = await texto(page.locator("[data-menu-etapa]"));
  ok("e o menu diz por quê, com o código", /quais telefones têm funil próprio/.test(menu), menu.slice(0, 200));
  ok("sem oferecer etapa nenhuma", (await page.locator("[data-menu-etapa] [data-escolher-etapa]").count()) === 0);
  await page.keyboard.press("Escape");
  ok("abriu o funil", await abrirFunil(page));
  const aviso = await texto(page.locator("[data-falha-dos-funis]"));
  ok("a tela de colunas avisa que os funis dos telefones não estão na lista", /funis próprios dos telefones não estão na lista/.test(aviso), aviso);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
