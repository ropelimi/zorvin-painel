// AS TELAS ABREM NUMA GUIA NOVA (02/11)
//
// Pedido do Rodrigo: "Com exceção de 'Configurações' e 'Departamentos e
// acessos' que abrem como popup, todas as outras opções ao clicar devem ser
// abertas em uma nova guia." São cinco: Funil, Tarefas, Esperando resposta,
// Faxina da fila e Painel. E as duas respostas dele: a conversa clicada dentro
// de uma delas abre NOUTRA guia, já nela; e os ícones da barra lateral (o
// sino e a ampulheta) vão junto com o menu.
//
// O QUE ESTA PROVA MEDE É O GESTO, e não as telas — cada tela tem a prova
// dela, adaptada para abrir na guia nova:
//
//   1. cada item do menu ⋮ é um LINK que abre uma guia nova, no endereço da
//      tela (`?tela=…`), com o nome dela no título; a guia das conversas fica
//      onde estava;
//   2. Configurações e Departamentos e acessos continuam por cima, na mesma
//      guia;
//   3. o sino e a ampulheta da barra também abrem guia nova;
//   4. A GUIA DE UMA TELA É LEVE: não assina o tempo real, não pergunta a
//      saúde do sistema nem pelos clientes sem resposta (só a guia do
//      Esperando resposta pergunta, e a cena 6 a vê listar) — com contraste,
//      na guia das conversas, que faz as três coisas. E ela não troca o
//      telefone guardado da guia das conversas, e o Funil abre no telefone
//      que o endereço trouxe;
//   5. o Esc não tira a tela, e o X fecha a guia — ou, quando o navegador não
//      deixa fechar, volta às conversas;
//   6. a conversa clicada numa tela abre noutra guia, já nela, e o endereço é
//      limpo; o lembrete que não existe é dito;
//   7. UM AVISO SÓ, com duas guias de conversa abertas;
//   8. a conversa à vista noutra guia não avisa — e a guia escondida atrás
//      de outra não cala o aviso;
//   9. o que uma guia muda no funil, a guia das conversas relê;
//  10. um nome que não é de tela abre as conversas, e o F5 da guia de uma tela
//      continua na tela.
//
// A BANCADA MORA NA MEMÓRIA DE CADA GUIA: duas guias são dois bancos. As
// cenas que dependem do banco que as guias dividem em produção copiam as
// tabelas de uma guia para a outra (`bancoDividido`, em `navegador.mjs`).
import { abrirNavegador, ENDERECO, guiaQueAbre, bancoDividido } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const NOME_DA_ABA = "Ropelimi Zorvin";

const TELAS = [
  { tela: "funil", marca: "[data-abrir-funil]", nome: "Funil" },
  { tela: "tarefas", marca: "[data-abrir-tarefas-menu]", nome: "Tarefas" },
  { tela: "esperando", marca: "[data-abrir-esperando-menu]", nome: "Esperando resposta" },
  { tela: "faxina", marca: "[data-abrir-faxina]", nome: "Faxina da fila" },
  { tela: "painel", marca: "[data-abrir-painel]", nome: "Painel" },
];

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

// DUAS CONVERSAS PLANTADAS no telefone que o painel abre. A primeira tem uma
// resposta de `u1` (quem entra na bancada): é minha, e a mensagem nova dela
// avisa. E o cliente dela tem cartão no funil do departamento.
const agora = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const NOMES = { g1: "GUIA ANA PRIMEIRA", g2: "GUIA BRUNO SEGUNDO" };
const contato = (k, n) => ({ id: `ct-${k}`, numero: `55119700055${n}`, nome: NOMES[k], vantoro_nome: null,
                              nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k, n, ms) => ({
  id: `cv-${k}`, advogado_id: ADV, contato_id: `ct-${k}`, nao_lidas: 0,
  arquivada: false, fixada: false, favorita: false, ultima_atividade: iso(ms), ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: `55119700055${n}`, foto_url: null },
});
const SEMENTE = {
  contatos: [contato("g1", "01"), contato("g2", "02")],
  conversas: [conversa("g1", "01", agora - 60e3), conversa("g2", "02", agora - 120e3)],
  mensagens: [
    { id: "m-g1a", conversa_id: "cv-g1", origem: "contato", tipo: "texto", texto: "oi", criado_em: iso(agora - 300e3) },
    { id: "m-g1b", conversa_id: "cv-g1", origem: "advogado", tipo: "texto", texto: "respondi aqui",
      enviado_por_id: "u1", criado_em: iso(agora - 240e3) },
    { id: "m-g2a", conversa_id: "cv-g2", origem: "contato", tipo: "texto", texto: "bom dia", criado_em: iso(agora - 120e3) },
  ],
  zorvin_cartoes: [{ id: "cartao-g1", contato_id: "ct-g1", departamento_id: DEP, etapa_id: ET(1),
                     criado_em: iso(agora - 86400e3), movido_em: iso(agora - 86400e3), movido_por: "u1" }],
};

/** O que a função dos clientes sem resposta devolveria para uma conversa. Os
 *  minutos passam do limite há mais de 15: fica de fora do aviso na hora, que
 *  não é desta prova. */
const semResposta = (conversa_id) => ({
  conversa_id, advogado_id: ADV, departamento_id: DEP, protocolo: "P-GUIA",
  aberto_em: iso(agora - 70 * 60e3), responsavel_id: null, minutos: 65, limite: 30,
  contato: { nome: NOMES.g1, numero: "5511970005501" },
});

/** Abre o painel com TODAS as bandeiras, no CONTEXTO: as guias novas que os
 *  cliques abrem nascem com elas. O som e a notificação são ESPIONADOS, e não
 *  desligados — o que se mede é quantas guias avisam. */
async function abrir({ largura = 1360, semResposta: linhas = [], esperaPrimeiraMs = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  ctx.setDefaultTimeout(8000);
  const estouros = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => estouros.push(`${p.url()}: ${e.message}`)));
  await ctx.addInitScript((o) => {
    globalThis.__SEMENTE = o.semente;
    globalThis.__SEM_RESPOSTA = o.linhas;
    if (o.esperaPrimeiraMs != null) globalThis.__ESPERA_PRIMEIRA_MS = o.esperaPrimeiraMs;
    globalThis.__FUNCOES_CHAMADAS = [];
    globalThis.__AVISOS = [];
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
    class NotificacaoDeMentira {
      constructor(titulo, opcoes) { globalThis.__AVISOS.push({ o: "notificacao", titulo, ...(opcoes || {}) }); }
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
    }
    globalThis.Notification = NotificacaoDeMentira;
    const ACreal = globalThis.AudioContext;
    if (ACreal) {
      globalThis.AudioContext = class extends ACreal {
        createOscillator() { globalThis.__AVISOS.push({ o: "som" }); return super.createOscillator(); }
      };
    }
    // O pato e os bichos são ARQUIVO, e um arquivo não passa pelo oscilador.
    try { if (!localStorage.getItem("zorvin_som_do_aviso")) localStorage.setItem("zorvin_som_do_aviso", "toque"); } catch (_) { /* */ }
  }, { semente: SEMENTE, linhas, esperaPrimeiraMs });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => estouros.push(`principal: ${e.message}`));
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

const contar = (page, sel) => page.locator(sel).count();
const visivel = async (page, sel) => (await contar(page, sel)) > 0 && page.locator(sel).first().isVisible();
const attr = async (page, sel, nome) => ((await contar(page, sel)) ? page.locator(sel).first().getAttribute(nome) : null);
/** CLIQUE GUARDADO: o elemento que não existe não estoura a prova inteira —
 *  ela diz qual conferência viu o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 4000 }); } catch (_) { return false; }
  return true;
}
const abrirMenu = (page) => clicar(page.getByRole("button", { name: "Menu", exact: true }));
const esperar = (page, sel, prazo = 20000) =>
  page.waitForSelector(sel, { timeout: prazo }).then(() => true).catch(() => false);
/** Abre a guia pelo link `marca` (o menu ⋮ já aberto, se for do menu). */
async function abrirPeloLink(ctx, page, marca, tela) {
  const guia = await guiaQueAbre(ctx, () => clicar(page.locator(marca)));
  if (!guia) return null;
  // A guia volta mesmo sem a tela: quem chamou confere, e diz o que viu.
  await esperar(guia, `[data-tela="${tela}"]`, 30000);
  return guia;
}
const avisos = (page) => page.evaluate(() => globalThis.__AVISOS || []);
const limpar = (page) => page.evaluate(() => { globalThis.__AVISOS = []; });
/** A mensagem do cliente chegando pelo mesmo caminho por onde o Supabase a
 *  entregaria — na guia `page`. Duas guias, dois tempos reais. */
const chegarDoCliente = (page, convId, id) => page.evaluate(({ cid, mid }) => {
  globalThis.__EMITIR("INSERT", "mensagens", {
    id: mid, conversa_id: cid, origem: "contato", tipo: "texto", texto: "Chegou agora", criado_em: new Date().toISOString(),
  });
}, { cid: convId, mid: id });

// ------------------------------------------------------------------
console.log("\n1. Os cinco itens do menu ⋮ abrem cada um numa guia nova");
{
  const { ctx, page, estouros } = await abrir();
  const enderecoAntes = page.url();
  const salvo = await page.evaluate(() => localStorage.getItem("zorvin_advogado"));
  for (const t of TELAS) {
    ok(`${t.nome}: o menu ⋮ abre`, await abrirMenu(page));
    const info = (await contar(page, t.marca))
      ? await page.locator(t.marca).first().evaluate((a) => ({ tag: a.tagName, alvo: a.getAttribute("target"),
          rel: a.getAttribute("rel") || "", href: a.getAttribute("href") || "" }))
      : null;
    ok(`${t.nome}: é um LINK que abre numa guia nova, sem a guia nova alcançar esta`,
       Boolean(info) && info.tag === "A" && info.alvo === "_blank" && /noopener/.test(info.rel), JSON.stringify(info));
    const esperado = t.tela === "funil" ? `?tela=funil&linha=${salvo}` : `?tela=${t.tela}`;
    ok(`${t.nome}: o endereço diz a tela${t.tela === "funil" ? " e o telefone aberto na barra" : ""}`,
       Boolean(info) && info.href.endsWith(esperado), `${info && info.href} — esperava terminar em ${esperado}`);
    const guia = await abrirPeloLink(ctx, page, t.marca, t.tela);
    ok(`${t.nome}: o clique abre uma guia nova`, Boolean(guia));
    if (guia) {
      ok(`${t.nome}: e a guia nova mostra a tela`, await visivel(guia, `[data-tela="${t.tela}"]`));
      const titulo = await guia.title();
      ok(`${t.nome}: com o nome da tela no título da guia`, titulo === `${t.nome} · ${NOME_DA_ABA}`, titulo);
      await guia.close();
    }
    ok(`${t.nome}: a guia das conversas continua nas conversas, no mesmo endereço`,
       page.url() === enderecoAntes && (await contar(page, `[data-tela="${t.tela}"]`)) === 0
       && await visivel(page, "[data-conversa-nome]"), page.url());
    ok(`${t.nome}: e o menu ⋮ fechou`, !(await visivel(page, t.marca)));
    if (await visivel(page, t.marca)) await page.keyboard.press("Escape");
  }
  ok("sem erro de JavaScript nas guias", estouros.length === 0, estouros.slice(0, 3).join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Configurações e Departamentos e acessos continuam por cima");
{
  const { ctx, page } = await abrir();
  ok("o menu ⋮ abre", await abrirMenu(page));
  const nova1 = await guiaQueAbre(ctx, () => clicar(page.getByRole("button", { name: "Configurações" })), 1500);
  ok("Configurações não abre guia nova", !nova1);
  ok("e abre por cima, nesta guia", await visivel(page, 'button:has-text("Aparência")'));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("o menu ⋮ abre de novo", await abrirMenu(page));
  const nova2 = await guiaQueAbre(ctx, () => clicar(page.getByRole("button", { name: "Departamentos e acessos" })), 1500);
  ok("Departamentos e acessos não abre guia nova", !nova2);
  ok("e abre por cima, nesta guia", await visivel(page, 'button:has-text("Departamentos e telefones")'));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. O sino e a ampulheta da barra lateral também");
{
  const { ctx, page } = await abrir();
  for (const [marca, tela, nome] of [["[data-abrir-tarefas]", "tarefas", "o sino"], ["[data-abrir-esperando]", "esperando", "a ampulheta"]]) {
    const info = (await contar(page, marca))
      ? await page.locator(marca).first().evaluate((a) => ({ tag: a.tagName, alvo: a.getAttribute("target"),
          titulo: a.getAttribute("title") || "" }))
      : null;
    ok(`${nome}: é um link para uma guia nova, e o título diz isso`,
       Boolean(info) && info.tag === "A" && info.alvo === "_blank" && /abre numa guia nova/.test(info.titulo), JSON.stringify(info));
    const guia = await abrirPeloLink(ctx, page, marca, tela);
    ok(`${nome}: abre a tela numa guia nova`, Boolean(guia) && await visivel(guia, `[data-tela="${tela}"]`));
    if (guia) await guia.close();
  }
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. A guia de uma tela é leve, e não troca o telefone das conversas");
{
  // A PRIMEIRA PERGUNTA PELOS CLIENTES SEM RESPOSTA, na guia das conversas,
  // sai em 300 ms, e não nos cinco segundos de sempre: é o contraste da
  // conferência de baixo, e ele tem de existir dentro da espera da cena.
  const { ctx, page } = await abrir({ esperaPrimeiraMs: 300 });
  const guia = await abrirPeloLink(ctx, page, "[data-abrir-tarefas]", "tarefas");
  ok("a guia das Tarefas abriu", Boolean(guia) && await visivel(guia, '[data-tela="tarefas"]'));
  if (guia) {
    await guia.waitForTimeout(2500);
    const medir = (p) => p.evaluate(() => {
      const f = globalThis.__FUNCOES_CHAMADAS || [];
      return {
        canais: globalThis.__CANAIS || 0,
        saude: f.filter((x) => x.nome === "zorvin_saude").length,
        semResposta: f.filter((x) => x.nome === "zorvin_clientes_sem_resposta").length,
      };
    });
    const nas = await medir(page), naTela = await medir(guia);
    // O CONTRASTE: a guia das conversas faz as três coisas. Sem ele, uma
    // bancada que nunca contasse canal nenhum aprovaria qualquer guia.
    ok("a guia das conversas assina o tempo real, pergunta a saúde do sistema e os clientes sem resposta",
       nas.canais >= 1 && nas.saude >= 1 && nas.semResposta >= 1, JSON.stringify(nas));
    ok("a guia da tela NÃO assina o tempo real", naTela.canais === 0, JSON.stringify(naTela));
    ok("nem pergunta a saúde do sistema", naTela.saude === 0, JSON.stringify(naTela));
    // A GUIA DAS TAREFAS NÃO MOSTRA quem espera: de minuto em minuto, por
    // guia aberta, seria uma ida ao banco que ninguém lê.
    ok("nem pelos clientes sem resposta, que as Tarefas não mostram", naTela.semResposta === 0, JSON.stringify(naTela));
    await guia.close();
  }

  // O TELEFONE GUARDADO É O DA GUIA DAS CONVERSAS: o F5 dela abre nele. A
  // guia de uma tela abre no telefone que o endereço trouxe, e não o guarda.
  const salvo = await page.evaluate(() => localStorage.getItem("zorvin_advogado"));
  ok("a guia das conversas guardou o telefone aberto", Boolean(salvo), String(salvo));
  const outro = await page.evaluate((s) => {
    const a = (globalThis.__TABELAS.advogados || []).find((x) => x.ativo !== false && String(x.id) !== String(s));
    return a ? a.id : null;
  }, salvo);
  const g = await ctx.newPage();
  await g.goto(`${ENDERECO}?tela=tarefas&linha=${outro}`);
  ok("a guia de uma tela, aberta noutro telefone, desenha a tela", await esperar(g, '[data-tela="tarefas"]', 30000));
  await g.waitForTimeout(1500);
  const depois = await page.evaluate(() => localStorage.getItem("zorvin_advogado"));
  ok("e o telefone guardado continua o da guia das conversas", depois === salvo, `era ${salvo}, ficou ${depois} (a tela abriu em ${outro})`);

  // O FUNIL ABRE NO TELEFONE QUE O ENDEREÇO TROUXE, e não no guardado: com
  // duas guias de conversas em telefones diferentes, o Funil clicado numa
  // delas é o do telefone DELA. Um telefone de outro departamento separa os
  // dois: com o guardado, a tela abriria no departamento dele.
  const deOutroDep = await page.evaluate((s) => {
    const todos = (globalThis.__TABELAS.advogados || []).filter((x) => x.ativo !== false);
    const meu = todos.find((x) => String(x.id) === String(s));
    const a = meu && todos.find((x) => String(x.departamento_id) !== String(meu.departamento_id));
    return a ? { id: a.id, dep: String(a.departamento_id), meuDep: String(meu.departamento_id) } : null;
  }, salvo);
  const f = await ctx.newPage();
  await f.goto(`${ENDERECO}?tela=funil&linha=${deOutroDep ? deOutroDep.id : ""}`);
  const abriuOFunil = await esperar(f, "[data-funil-departamento]", 30000);
  const escolhido = abriuOFunil ? await f.locator("[data-funil-departamento]").first().inputValue().catch(() => "") : "";
  ok("o Funil aberto com o telefone de outro departamento abre no funil DELE, e não no do guardado",
     Boolean(deOutroDep) && abriuOFunil && escolhido === deOutroDep.dep,
     `abriu em “${escolhido}”, o telefone é do ${deOutroDep && deOutroDep.dep} e o guardado do ${deOutroDep && deOutroDep.meuDep}`);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. O Esc não tira a tela; o X fecha a guia");
{
  const { ctx, page } = await abrir();
  ok("o menu ⋮ abre", await abrirMenu(page));
  const guia = await abrirPeloLink(ctx, page, "[data-abrir-tarefas-menu]", "tarefas");
  ok("a guia das Tarefas abriu", Boolean(guia) && await visivel(guia, '[data-tela="tarefas"]'));
  if (guia) {
    // GUARDADO: a guia que o Esc fecha leva o teclado junto, e o `press`
    // estouraria a prova inteira em vez de dizer qual conferência viu o
    // defeito — foi o que a sabotagem do Esc que fecha a guia mostrou.
    await guia.keyboard.press("Escape").catch(() => {});
    if (!guia.isClosed()) await guia.waitForTimeout(600);
    const ficou = !guia.isClosed();
    ok("o Esc não tira a tela da guia", ficou && await visivel(guia, '[data-tela="tarefas"]'), ficou ? "" : "a guia fechou");
    if (ficou) {
      // O X EXISTE é perguntado ANTES do clique: o clique que fecha a guia
      // corre com o fechamento, e o Playwright pode dizer que falhou por a
      // página ter fechado no meio dele — que é justamente o certo.
      ok("o X da tela existe", (await contar(guia, "[data-fechar-a-guia]")) === 1);
      const fechou = guia.waitForEvent("close", { timeout: 5000 }).then(() => true).catch(() => false);
      await guia.locator("[data-fechar-a-guia]").first().click({ timeout: 4000 }).catch(() => {});
      ok("e fecha a guia", await fechou);
    }
  }
  // A GUIA QUE O NAVEGADOR NÃO DEIXA FECHAR — a pessoa navegou nela, ou abriu
  // o endereço à mão — volta às conversas: era o que o botão fazia quando a
  // tela abria por cima delas.
  const g = await ctx.newPage();
  await g.goto(ENDERECO);
  await esperar(g, "[data-conversa-nome]", 30000);
  await g.goto(`${ENDERECO}?tela=tarefas`);
  ok("a guia navegada mostra a tela", await esperar(g, '[data-tela="tarefas"]', 30000));
  await clicar(g.locator("[data-fechar-a-guia]"));
  const voltou = await esperar(g, "[data-conversa-nome]", 20000);
  ok("o X dela volta às conversas, sem a tela no endereço",
     voltou && !g.isClosed() && new URL(g.url()).search === "" && (await contar(g, '[data-tela="tarefas"]')) === 0,
     g.isClosed() ? "a guia fechou" : g.url());
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. A conversa clicada numa tela abre noutra guia, já nela");
{
  const { ctx, page, estouros } = await abrir({ semResposta: [semResposta("cv-g1")] });
  ok("o menu ⋮ abre", await abrirMenu(page));
  const tela = await abrirPeloLink(ctx, page, "[data-abrir-esperando-menu]", "esperando");
  ok("a guia de Esperando resposta abriu", Boolean(tela) && await visivel(tela, '[data-tela="esperando"]'));
  if (tela) {
    ok("e lista o cliente plantado", await esperar(tela, '[data-sem-resposta-linha="cv-g1"]', 15000));
    const conversa = await guiaQueAbre(ctx, () => clicar(tela.locator('[data-sem-resposta-linha="cv-g1"]')));
    ok("o clique no cliente abre outra guia", Boolean(conversa));
    if (conversa) {
      const abriu = await esperar(conversa, "[data-topo-conversa]", 30000);
      const topo = abriu ? await conversa.locator("[data-topo-conversa]").first().innerText() : "";
      ok("e a guia nova abre a conversa dele", /GUIA ANA PRIMEIRA/.test(topo), `topo: “${topo.slice(0, 60)}”`);
      await conversa.waitForTimeout(500);
      ok("com o endereço limpo (o F5 dela não volta sozinho para esta conversa)",
         new URL(conversa.url()).search === "", conversa.url());
    }
    ok("e a guia da tela continua na tela", !tela.isClosed() && await visivel(tela, '[data-tela="esperando"]'));
  }

  // O LEMBRETE QUE NÃO EXISTE: a conversa abre assim mesmo, e a frase diz o
  // que faltou — a caixa vazia se leria como "o lembrete não tinha mensagem".
  const g = await ctx.newPage();
  await g.goto(`${ENDERECO}?conversa=cv-g2&linha=${ADV}&tarefa=nao-existe`);
  const abriu = await esperar(g, "[data-topo-conversa]", 30000);
  const topo = abriu ? await g.locator("[data-topo-conversa]").first().innerText() : "";
  ok("o endereço de uma conversa com um lembrete que não existe abre a conversa", /GUIA BRUNO SEGUNDO/.test(topo),
     `topo: “${topo.slice(0, 60)}”`);
  await g.waitForTimeout(1200);
  const vistos = await g.evaluate(() => globalThis.__AVISOS_VISTOS || []);
  ok("e diz que a mensagem do lembrete não veio",
     vistos.some((t) => /mensagem do lembrete não veio/.test(t)), JSON.stringify(vistos));
  const caixa = (await contar(g, "textarea")) ? await g.locator("textarea").first().inputValue() : null;
  ok("com a caixa de escrever vazia", caixa === "", JSON.stringify(caixa));
  ok("sem erro de JavaScript nas guias", estouros.length === 0, estouros.slice(0, 3).join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. Um aviso só, com duas guias de conversa abertas");
{
  const { ctx, page: a } = await abrir();
  const b = await ctx.newPage();
  await b.goto(ENDERECO);
  await esperar(b, "[data-conversa-nome]", 60000);
  await b.waitForTimeout(1500);
  // AS DUAS GUIAS RECEBEM A MESMA MENSAGEM, como em produção: cada guia de
  // conversa tem o seu tempo real.
  await limpar(a); await limpar(b);
  await Promise.all([chegarDoCliente(a, "cv-g1", "m-aviso-1"), chegarDoCliente(b, "cv-g1", "m-aviso-1")]);
  await a.waitForTimeout(2500);
  const da = await avisos(a), db = await avisos(b);
  const comSom = [da, db].filter((l) => l.some((x) => x.o === "som")).length;
  const notificacoes = [...da, ...db].filter((x) => x.o === "notificacao").length;
  ok("a mesma mensagem nas duas guias toca o som numa guia só", comSom === 1, `tocaram ${comSom} guias`);
  ok("e mostra uma notificação só", notificacoes === 1, `${notificacoes} notificações`);
  // E A MARCA É DA MENSAGEM, e não da conversa: a próxima avisa de novo.
  await limpar(a); await limpar(b);
  await Promise.all([chegarDoCliente(a, "cv-g1", "m-aviso-2"), chegarDoCliente(b, "cv-g1", "m-aviso-2")]);
  await a.waitForTimeout(2500);
  const ea = await avisos(a), eb = await avisos(b);
  ok("a mensagem seguinte avisa de novo, uma vez",
     [...ea, ...eb].filter((x) => x.o === "notificacao").length === 1,
     JSON.stringify([ea.length, eb.length]));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. A conversa à vista noutra guia não avisa");
{
  const { ctx, page: a } = await abrir();
  const b = await ctx.newPage();
  await b.goto(ENDERECO);
  await esperar(b, "[data-conversa-nome]", 60000);
  await b.waitForTimeout(1200);
  ok("a guia A abre a conversa", await clicar(a.locator('[data-conversa-id="cv-g1"]')));
  await a.waitForTimeout(1200);
  const vista = await a.evaluate(() => !document.hidden);
  ok("e a guia A está à vista, para haver o que medir", vista);
  // A MENSAGEM CHEGA NA GUIA B, que não tem a conversa aberta. Sem a vista da
  // guia A, B tocaria o aviso da conversa que a pessoa está lendo em A.
  await limpar(b);
  await chegarDoCliente(b, "cv-g1", "m-vista-1");
  await b.waitForTimeout(2500);
  const nb = await avisos(b);
  ok("a guia B não avisa da conversa que a guia A está mostrando",
     !nb.some((x) => x.o === "som" || x.o === "notificacao"), JSON.stringify(nb));
  // A GUIA ESCONDIDA ATRÁS DE OUTRA NÃO ESTÁ MOSTRANDO NADA A NINGUÉM: ela
  // deixa de calar o aviso. Sem isso, uma guia esquecida aberta numa conversa
  // calaria os avisos dela enquanto existisse. O navegador da prova não
  // esconde guia nenhuma, e por isso a prova finge o que ele diria.
  const verA = (escondida) => a.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, escondida);
  await verA(true);
  await a.waitForTimeout(300);
  await limpar(b);
  await chegarDoCliente(b, "cv-g1", "m-vista-escondida");
  await b.waitForTimeout(2500);
  const nbE = await avisos(b);
  ok("escondida a guia A, a guia B volta a avisar daquela conversa", nbE.some((x) => x.o === "notificacao"), JSON.stringify(nbE));
  // E DE VOLTA À VISTA, a guia A volta a calar: o anúncio acompanha a vista,
  // e não só a troca de conversa.
  await verA(false);
  await a.waitForTimeout(300);
  await limpar(b);
  await chegarDoCliente(b, "cv-g1", "m-vista-de-volta");
  await b.waitForTimeout(2500);
  const nbV = await avisos(b);
  ok("e de volta à vista, a guia A volta a calar o aviso dela",
     !nbV.some((x) => x.o === "som" || x.o === "notificacao"), JSON.stringify(nbV));
  // O CONTRASTE: a guia A troca de conversa, e a mesma conversa volta a avisar.
  ok("a guia A abre outra conversa", await clicar(a.locator('[data-conversa-id="cv-g2"]')));
  await a.waitForTimeout(1200);
  await limpar(b);
  await chegarDoCliente(b, "cv-g1", "m-vista-2");
  await b.waitForTimeout(2500);
  const nb2 = await avisos(b);
  ok("e a guia B passa a avisar dela", nb2.some((x) => x.o === "notificacao"), JSON.stringify(nb2));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n9. O que uma guia muda no funil, a guia das conversas relê");
{
  const { ctx, page } = await abrir({ largura: 1600 });
  ok("a guia das conversas abre a conversa do cliente que tem cartão", await clicar(page.locator('[data-conversa-id="cv-g1"]')));
  const antes = await esperar(page, '[data-etapa-da-conversa="Novo contato"]', 15000);
  ok("e diz a etapa dele: Novo contato", antes, String(await attr(page, "[data-etapa-da-conversa]", "data-etapa-da-conversa")));
  // O BANCO QUE AS DUAS GUIAS DIVIDEM: o que a guia do funil grava chega à das
  // conversas antes do aviso — ver `bancoDividido`.
  await bancoDividido(ctx, page, ["zorvin_cartoes", "zorvin_movimentos"]);
  ok("o menu ⋮ abre", await abrirMenu(page));
  const funil = await abrirPeloLink(ctx, page, "[data-abrir-funil]", "funil");
  ok("a guia do funil abriu", Boolean(funil) && await visivel(funil, '[data-tela="funil"]'));
  if (funil) {
    await esperar(funil, '[data-cartao-do-funil="ct-g1"]', 15000);
    const mover = funil.locator('[data-cartao-do-funil="ct-g1"] [data-mover-cartao]');
    let moveu = false;
    if (await mover.count()) moveu = await mover.first().selectOption({ label: "Acordo fechado" }).then(() => true).catch(() => false);
    ok("a guia do funil move o cartão para Acordo fechado", moveu);
    const relida = await esperar(page, '[data-etapa-da-conversa="Acordo fechado"]', 8000);
    ok("e a guia das conversas passa a dizer Acordo fechado, sem recarregar", relida,
       String(await attr(page, "[data-etapa-da-conversa]", "data-etapa-da-conversa")));
  }
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n10. Um nome que não é de tela abre as conversas; o F5 da tela continua nela");
{
  const { ctx, page } = await abrir();
  const g = await ctx.newPage();
  await g.goto(`${ENDERECO}?tela=nada`);
  ok("?tela=nada abre as conversas", await esperar(g, "[data-conversa-nome]", 30000));
  ok("sem a guia de tela nenhuma por cima", (await contar(g, "[data-tela-da-guia]")) === 0);
  const titulo = await g.title();
  ok("e com o título de sempre", /Ropelimi Zorvin$/.test(titulo) && !titulo.includes(" · "), titulo);
  await g.close();

  ok("o menu ⋮ abre", await abrirMenu(page));
  const guia = await abrirPeloLink(ctx, page, "[data-abrir-faxina]", "faxina");
  ok("a guia da Faxina abriu", Boolean(guia) && await visivel(guia, '[data-tela="faxina"]'));
  if (guia) {
    await guia.reload();
    ok("o F5 da guia da Faxina continua na Faxina", await esperar(guia, '[data-tela="faxina"]', 30000));
    ok("com o mesmo título", (await guia.title()) === `Faxina da fila · ${NOME_DA_ABA}`, await guia.title());
  }
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
