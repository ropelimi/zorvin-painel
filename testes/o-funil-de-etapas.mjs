// O FUNIL DE ETAPAS (06/10) — pedido do Rodrigo como segundo passo para CRM.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. sem o script 017, NADA do funil aparece: nem o item "Funil" no menu,
//      nem a etapa na conversa, nem a seção da administração;
//   2. o funil abre no departamento aberto, com as etapas ATIVAS como colunas,
//      na ordem, e cada cartão na sua coluna;
//   3. o cartão numa etapa DESATIVADA não some: vai para a coluna própria;
//   4. mover pela lista grava a etapa nova, e o arraste também;
//   5. o banco que recusa (calado ou com código) faz o cartão VOLTAR e a frase
//      dizer por quê — nunca "foi para…";
//   6. clicar no cartão abre a conversa do cliente;
//   7. a etapa aparece na linha do número da conversa, e escolher outra grava;
//      a conversa de quem não está no funil oferece "Pôr no funil";
//   8. "Trazer conversas" (só quem administra) põe na primeira etapa quem
//      conversou no período, e diz quantos;
//   9. a leitura que falha DIZ que falhou, com o código, e não vira "ninguém";
//  10. a administração lista as etapas do departamento, renomeia e desativa.
//
// OS CLIENTES DO FUNIL SÃO PLANTADOS (`__SEMENTE`), num telefone descoberto, e
// não escolhido a dedo — ver `o-responsavel-pela-conversa`.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** O telefone que o painel ABRE, e o departamento dele. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (globalThis.__TABELAS.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    return a ? { adv: a.id, dep: a.departamento_id } : null;
  });
  await ctx.close();
  return r;
}

const ABRE = await telefoneQueAbre();
ok("aprendi qual telefone e departamento o painel abre", Boolean(ABRE && ABRE.dep != null), JSON.stringify(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, dep: DEP } = ABRE;
const ET = (n) => `et-${DEP}-${n}`;   // as etapas que a bancada semeia, como o script

const agora = new Date().toISOString();
const NOMES = { f1: "FUNIL ANA PRIMEIRA", f2: "FUNIL BRUNO TERCEIRA", f3: "FUNIL CARLA ANTIGA", f4: "FUNIL DIEGO DE FORA" };
const contato = (k, n) => ({ id: `ct-${k}`, numero: `55119700044${n}`, nome: NOMES[k], vantoro_nome: null,
                              nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k, n) => ({
  id: `cv-${k}`, advogado_id: ADV, contato_id: `ct-${k}`, nao_lidas: k === "f1" ? 2 : 0,
  arquivada: false, fixada: false, favorita: false, ultima_atividade: agora, ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: `55119700044${n}`, foto_url: null },
});
const cartao = (k, etapa) => ({ id: `cartao-${k}`, contato_id: `ct-${k}`, departamento_id: DEP, etapa_id: etapa,
                                 criado_em: agora, movido_em: agora, movido_por: "u1" });
const SEMENTE = {
  contatos: [contato("f1", "01"), contato("f2", "02"), contato("f3", "03"), contato("f4", "04")],
  conversas: [conversa("f1", "01"), conversa("f2", "02"), conversa("f3", "03"), conversa("f4", "04")],
  mensagens: ["f1", "f2", "f3", "f4"].map((k) => ({ id: `m-${k}`, conversa_id: `cv-${k}`, origem: "contato",
                                                   tipo: "texto", texto: "oi", criado_em: agora })),
  // UMA ETAPA DESATIVADA com um cliente dentro: é o caso que separa "o funil
  // mostra as etapas" de "o funil some com quem está numa etapa velha".
  zorvin_etapas: [{ id: "et-velha", departamento_id: DEP, nome: "Etapa Velha", ordem: 5, ativo: false, cor: "#999" }],
  zorvin_cartoes: [cartao("f1", ET(1)), cartao("f2", ET(3)), cartao("f3", "et-velha")],
};

async function abrirPainel({ semFunil = false, semEfeito = [], erroNaGravacao = {}, recusarLeitura = [],
                             souAdmin = true, largura = 1400 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_FUNIL = d.semFunil;
    globalThis.__ESCRITA_SEM_EFEITO = d.semEfeito;
    globalThis.__ERRO_NA_GRAVACAO = d.erroNaGravacao;
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura;
    globalThis.__SOU_ADMIN = d.souAdmin;
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente: souAdmin ? SEMENTE
          // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO: sem nenhuma linha em
          // `permissoes` ela não alcança telefone nenhum, e a prova mediria uma
          // tela vazia em vez do funil de quem atende este departamento.
          : { ...SEMENTE, permissoes: [{ id: 901, usuario_id: "u1", departamento_id: DEP, telefone_id: null }] },
        semFunil, semEfeito, erroNaGravacao, recusarLeitura, souAdmin });
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
async function abrirMenuTopo(page) {
  return clicar(page.getByRole("button", { name: "Menu", exact: true }));
}
async function abrirFunil(page) {
  if (!(await abrirMenuTopo(page))) return false;
  if (!(await clicar(page.locator("[data-abrir-funil]")))) return false;
  await page.waitForTimeout(900);
  return true;
}
const colunaDe = (page, k) => page.locator(`[data-cartao-do-funil="ct-${k}"]`).first()
  .evaluate((el) => el.closest("[data-coluna-do-funil]")?.getAttribute("data-coluna-do-funil")).catch(() => null);
const etapaNoBanco = (page, k) => page.evaluate((ct) =>
  ((globalThis.__TABELAS.zorvin_cartoes || []).find((c) => c.contato_id === ct) || {}).etapa_id ?? null, `ct-${k}`);
const textoDoAvisoDoFunil = (page) => page.locator("[data-aviso-do-funil]").innerText().catch(() => "");
async function abrirConversa(page, nome) {
  await clicar(page.locator(`[data-conversa-nome="${nome}"]`));
  await page.waitForTimeout(900);
}

// ------------------------------------------------------------------
console.log("\n1. Sem o script 017, nada do funil aparece");
{
  const { ctx, page } = await abrirPainel({ semFunil: true });
  await abrirMenuTopo(page);
  ok("o menu do topo não oferece o Funil", (await page.locator("[data-abrir-funil]").count()) === 0);
  ok("e o menu abriu de verdade (o Painel está lá)",
     (await page.getByRole("button", { name: "Painel", exact: true }).count()) > 0);
  await page.keyboard.press("Escape");
  await abrirConversa(page, NOMES.f1);
  ok("a conversa não mostra etapa", (await page.locator("[data-etapa-da-conversa]").count()) === 0);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. O funil: as etapas ativas são as colunas, e cada cartão na sua");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abriu o funil pelo menu", await abrirFunil(page));
  const colunas = await page.locator("[data-coluna-do-funil]").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-coluna-do-funil")));
  ok("as sete etapas sugeridas, na ordem, e a das desativadas no fim",
     JSON.stringify(colunas) === JSON.stringify(["Novo contato", "Em atendimento", "Aguardando cliente",
       "Proposta/acordo enviado", "Acordo fechado", "Em execução", "Encerrado", "Em etapas desativadas"]),
     JSON.stringify(colunas));
  ok("a etapa desativada NÃO vira coluna", !colunas.includes("Etapa Velha"));
  ok("Ana está em Novo contato", (await colunaDe(page, "f1")) === "Novo contato", await colunaDe(page, "f1"));
  ok("Bruno está em Aguardando cliente", (await colunaDe(page, "f2")) === "Aguardando cliente", await colunaDe(page, "f2"));
  ok("Carla, da etapa desativada, NÃO sumiu: está na coluna própria",
     (await colunaDe(page, "f3")) === "Em etapas desativadas", await colunaDe(page, "f3"));
  ok("Diego, que não está no funil, não tem cartão",
     (await page.locator('[data-cartao-do-funil="ct-f4"]').count()) === 0);
  const nome = await page.locator('[data-cartao-do-funil="ct-f1"] [data-nome-no-cartao]').innerText().catch(() => "");
  ok("o cartão diz o nome do cliente", nome === NOMES.f1, nome);
  ok("e as não lidas da conversa", /\b2\b/.test(await page.locator('[data-cartao-do-funil="ct-f1"]').innerText().catch(() => "")));

  console.log("\n3. Mover pela lista grava, e diz para onde foi");
  await page.locator('[data-cartao-do-funil="ct-f1"] [data-mover-cartao]').selectOption({ label: "Acordo fechado" });
  await page.waitForTimeout(600);
  ok("Ana foi para Acordo fechado na tela", (await colunaDe(page, "f1")) === "Acordo fechado", await colunaDe(page, "f1"));
  ok("e no banco", (await etapaNoBanco(page, "f1")) === ET(5), await etapaNoBanco(page, "f1"));
  ok("e a frase diz para onde", /Acordo fechado/.test(await textoDoAvisoDoFunil(page)), await textoDoAvisoDoFunil(page));

  console.log("\n4. Arrastar também move");
  // PELO MOUSE, passo a passo, e para uma coluna À VISTA. `dragTo` numa coluna
  // fora da tela não dispara nem o `dragstart` (medido: zero eventos), e a
  // prova mediria a ferramenta, e não o painel. Quem arrasta de verdade arrasta
  // para o que está vendo.
  const origem = page.locator('[data-cartao-do-funil="ct-f2"]').first();
  const destino = page.locator('[data-coluna-do-funil="Em atendimento"]').first();
  const a = await origem.boundingBox().catch(() => null);
  const b = await destino.boundingBox().catch(() => null);
  if (a && b) {
    await page.mouse.move(a.x + 6, a.y + 6);
    await page.mouse.down();
    await page.mouse.move(a.x + 30, a.y + 30, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + 200, { steps: 10 });
    await page.mouse.up();
  }
  await page.waitForTimeout(700);
  ok("Bruno arrastado para Em atendimento", (await colunaDe(page, "f2")) === "Em atendimento", await colunaDe(page, "f2"));
  ok("e no banco", (await etapaNoBanco(page, "f2")) === ET(2), await etapaNoBanco(page, "f2"));

  console.log("\n5. Clicar no cartão abre a conversa do cliente");
  await clicar(page.locator('[data-cartao-do-funil="ct-f2"] [data-abrir-cartao]'));
  await page.waitForTimeout(1200);
  ok("o funil fechou", (await page.locator('[data-tela="funil"]').count()) === 0);
  const topo = await page.locator("[data-topo-conversa]").innerText().catch(() => "");
  ok("e a conversa do Bruno está aberta", topo.includes(NOMES.f2), topo.slice(0, 80));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. O banco que recusa: o cartão VOLTA, e a frase diz por quê");
{
  const { ctx, page } = await abrirPainel({ semEfeito: ["zorvin_cartoes"] });
  await abrirFunil(page);
  await page.locator('[data-cartao-do-funil="ct-f1"] [data-mover-cartao]').selectOption({ label: "Encerrado" });
  await page.waitForTimeout(700);
  ok("recusa calada: Ana voltou para Novo contato", (await colunaDe(page, "f1")) === "Novo contato", await colunaDe(page, "f1"));
  const t = await textoDoAvisoDoFunil(page);
  ok("e a frase diz que o banco não deixou", /não deixou/.test(t), t);
  ok("e NÃO diz que foi", !/foi para/.test(t), t);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ erroNaGravacao: { zorvin_cartoes: { code: "42501", message: "permission denied" } } });
  await abrirFunil(page);
  await page.locator('[data-cartao-do-funil="ct-f1"] [data-mover-cartao]').selectOption({ label: "Encerrado" });
  await page.waitForTimeout(700);
  ok("recusa com erro: Ana voltou para Novo contato", (await colunaDe(page, "f1")) === "Novo contato");
  const t = await textoDoAvisoDoFunil(page);
  ok("e a frase leva o código", /42501/.test(t), t);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. A etapa na conversa — e escolher outra grava");
{
  // A 1920, e não a 1400: a 1400 com a ficha aberta a linha do número só tem
  // espaço para os selos em ÍCONE (desde 06/10, ver "Tarefas e lembretes" no
  // CLAUDE.md), e a cena 8 lê a PALAVRA "Pôr no funil" escrita no selo.
  const { ctx, page, estouros } = await abrirPainel({ largura: 1920 });
  await abrirConversa(page, NOMES.f1);
  const chip = page.locator("[data-etapa-da-conversa]");
  ok("a linha do número diz a etapa", (await chip.getAttribute("data-etapa-da-conversa").catch(() => null)) === "Novo contato");
  await clicar(chip);
  await page.waitForTimeout(300);
  ok("o menu lista as etapas ativas",
     (await page.locator("[data-menu-etapa] [data-escolher-etapa]").count()) === 7);
  ok("e não oferece a desativada", (await page.locator('[data-escolher-etapa="Etapa Velha"]').count()) === 0);
  await clicar(page.locator('[data-escolher-etapa="Em atendimento"]'));
  await page.waitForTimeout(700);
  ok("gravou no banco", (await etapaNoBanco(page, "f1")) === ET(2), await etapaNoBanco(page, "f1"));
  ok("a linha passou a dizer a etapa nova",
     (await chip.getAttribute("data-etapa-da-conversa").catch(() => null)) === "Em atendimento");
  const filme = await page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));
  ok("e a frase confirma", /Etapa: Em atendimento/.test(filme), filme);

  console.log("\n8. A conversa de quem não está no funil oferece pôr");
  await abrirConversa(page, NOMES.f4);
  const chip4 = page.locator("[data-etapa-da-conversa]");
  ok("a linha oferece 'Pôr no funil'", /Pôr no funil/.test(await chip4.innerText().catch(() => "")));
  await clicar(chip4);
  await page.waitForTimeout(300);
  await clicar(page.locator('[data-escolher-etapa="Novo contato"]'));
  await page.waitForTimeout(700);
  const novo = await page.evaluate(() => (globalThis.__TABELAS.zorvin_cartoes || []).find((c) => c.contato_id === "ct-f4") || null);
  ok("o cartão nasceu, com o cliente, o departamento e a etapa",
     novo && String(novo.departamento_id) === String(DEP) && novo.etapa_id === ET(1), JSON.stringify(novo));
  ok("a linha diz a etapa", (await chip4.getAttribute("data-etapa-da-conversa").catch(() => null)) === "Novo contato");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n9. Trazer conversas: só quem administra, e diz quantos");
{
  const { ctx, page } = await abrirPainel();
  await abrirFunil(page);
  const antes = await page.evaluate(() => (globalThis.__TABELAS.zorvin_cartoes || []).length);
  ok("quem administra vê o botão", (await page.locator("[data-trazer-para-o-funil]").count()) === 1);
  await clicar(page.locator("[data-trazer-para-o-funil]"));
  await page.waitForTimeout(1200);
  const depois = await page.evaluate(() => (globalThis.__TABELAS.zorvin_cartoes || []).length);
  const t = await textoDoAvisoDoFunil(page);
  const n = Number((t.match(/(\d+)/) || [])[1] || -1);
  ok("vieram clientes para o funil", depois > antes, `${antes} → ${depois}`);
  ok("e a frase diz QUANTOS, o mesmo número do banco", n === depois - antes, `${t} (${depois - antes})`);
  ok("Diego entrou na primeira etapa", (await colunaDe(page, "f4")) === "Novo contato", await colunaDe(page, "f4"));
  ok("e quem já estava não mudou de lugar", (await colunaDe(page, "f2")) === "Aguardando cliente", await colunaDe(page, "f2"));
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ souAdmin: false });
  await abrirFunil(page);
  ok("quem não administra abre o funil", (await page.locator('[data-tela="funil"]').count()) === 1);
  ok("mas não vê o botão de trazer", (await page.locator("[data-trazer-para-o-funil]").count()) === 0);
  ok("e vê os cartões do departamento que atende", (await page.locator("[data-cartao-do-funil]").count()) >= 2,
     String(await page.locator("[data-cartao-do-funil]").count()));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n10. A leitura que falha diz que falhou, e não vira 'ninguém'");
{
  const { ctx, page } = await abrirPainel({ recusarLeitura: ["zorvin_cartoes"] });
  await abrirFunil(page);
  const t = await page.locator("[data-falha-do-funil]").innerText().catch(() => "");
  ok("a faixa diz que não leu", /Não consegui ler/.test(t), t);
  ok("com o código", /\(erro /.test(t), t);
  ok("e não diz que o funil está vazio", (await page.locator("[data-funil-vazio]").count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Esc fecha o funil", (await page.locator('[data-tela="funil"]').count()) === 0);
  ok("e a lista de conversas continua lá", (await page.locator("[data-conversa-nome]").count()) > 0);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n11. A administração: as etapas do departamento");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirMenuTopo(page);
  await clicar(page.getByRole("button", { name: "Departamentos e acessos" }));
  await page.waitForTimeout(1200);
  const secao = page.locator("[data-etapas-do-funil]");
  ok("a seção está na aba Estrutura", (await secao.count()) === 1);
  await secao.locator("[data-etapas-departamento]").selectOption(String(DEP)).catch(() => {});
  await page.waitForTimeout(600);
  const linhas = await secao.locator("[data-etapa-da-config]").evaluateAll((els) => els.map((e) => e.getAttribute("data-etapa-da-config")));
  ok("lista as sete e a desativada por último", linhas.length === 8 && linhas[7] === "Etapa Velha", JSON.stringify(linhas));
  // RENOMEAR
  const linha = secao.locator('[data-etapa-da-config="Aguardando cliente"]');
  await clicar(linha.locator("[data-etapa-renomear]"));
  await secao.locator("[data-etapa-editando]").fill("Aguardando documentos").catch(() => {});
  await clicar(secao.locator("[data-etapa-salvar]"));
  await page.waitForTimeout(700);
  const nomeNoBanco = await page.evaluate((id) => ((globalThis.__TABELAS.zorvin_etapas || []).find((e) => e.id === id) || {}).nome, ET(3));
  ok("renomear grava", nomeNoBanco === "Aguardando documentos", nomeNoBanco);
  // DESATIVAR
  await clicar(secao.locator('[data-etapa-da-config="Encerrado"] [data-etapa-ativa]'));
  await page.waitForTimeout(700);
  const ativo = await page.evaluate((id) => ((globalThis.__TABELAS.zorvin_etapas || []).find((e) => e.id === id) || {}).ativo, ET(7));
  ok("parar de usar desativa (e não apaga)", ativo === false, String(ativo));
  ok("a etapa continua listada, fora de uso",
     (await secao.locator('[data-etapa-da-config="Encerrado"]').count()) === 1);
  // SUBIR
  await clicar(secao.locator('[data-etapa-da-config="Em atendimento"] [data-etapa-subir]'));
  await page.waitForTimeout(900);
  const ordem = await page.evaluate((ids) => ids.map((id) => ((globalThis.__TABELAS.zorvin_etapas || []).find((e) => e.id === id) || {}).ordem), [ET(1), ET(2)]);
  ok("subir troca a ordem com a vizinha", ordem[1] < ordem[0], JSON.stringify(ordem));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ semFunil: true });
  await abrirMenuTopo(page);
  await clicar(page.getByRole("button", { name: "Departamentos e acessos" }));
  await page.waitForTimeout(1200);
  ok("sem o script, a seção das etapas não aparece", (await page.locator("[data-etapas-do-funil]").count()) === 0);
  ok("e a aba Estrutura abriu (os assuntos estão lá)", (await page.locator("[data-assuntos-do-ja-tratei]").count()) === 1);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
