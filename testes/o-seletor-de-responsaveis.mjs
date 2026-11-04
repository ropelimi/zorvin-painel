// O SELETOR DE RESPONSÁVEIS, NO LUGAR DO "ATENDENDO COMO" (04/11)
//
// Pedido do Rodrigo, com a foto do alto da lista: "Excluir a mensagem
// 'ATENDENDO COMO' e ao lado no número de telefone colocar uma opção de
// selecionar o responsável pela conversa. Ao selecionar o responsável,
// aparecer apenas as conversas do responsável, mostrando em 'Novos', 'Em
// atendimento', 'Finalizados' e 'Não lidas' apenas as conversas
// correspondentes ao responsável selecionado. Precisa ter a possibilidade de
// selecionar mais de um responsável."
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. o alto da lista: o "ATENDENDO COMO" saiu, e o seletor mora na linha do
//      telefone, à direita do número, PINTADO (`elementFromPoint`), sem
//      cortar o número e sem a linha crescer;
//   2. escolher uma pessoa recorta a lista, o número de CADA aba e o da
//      pílula "Não lidas" — com os números escritos à mão para as conversas
//      plantadas, e não só "igual ao que o banco de mentira contou". E,
//      enquanto a conta dela não chega, a aba não fica com o número de todos;
//   3. mais de uma pessoa, e as conversas sem responsável — que é a fila de
//      onde todo mundo puxa trabalho;
//   4. O BANCO RECORTA, e não só a tela: no telefone de 1200 conversas, a da
//      Jenifer na posição 1150 aparece. Recortar só o que está carregado seria
//      "as da Jenifer entre as 200 mais recentes" com cara de "as da Jenifer".
//      E com 301 conversas dela, "Não lidas" pergunta ao banco já recortado:
//      o teto de 500 cortando o telefone inteiro deixaria a 1150 de fora;
//   5. a escolha vai junto quando se troca de telefone, e some ao recarregar;
//   6. a busca atravessa a escolha, como atravessa a aba;
//   7. o tempo real: a conversa passada à Jenifer ENTRA na lista dela, e a
//      que ela passou adiante SAI — com o número da aba acompanhando. E a
//      conversa que avisou ANTES de a escolha ser feita também entra;
//   8. abrir de fora (a "Nova conversa") uma conversa que a escolha esconderia
//      tira a escolha; a que ela mostra, não;
//   9. a lista vazia diz o que está escolhido — e, enquanto o banco não
//      responde à troca, diz que está carregando, e não "nenhum";
//  10. a pesquisa do menu, o Esc em degraus e o clique fora;
//  11. o celular: alvo de dedo de 40, a linha não cresce, nada rola de lado,
//      o menu cabe na tela;
//  12. o banco sem o script 046 da ponte: a aba fica SEM número, e não com o
//      do telefone inteiro — e sem acender a faixa âmbar, porque não é falha;
//  13. o banco sem o 008: nada disto aparece.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const EU = "u1";              // a sessão da bancada: Rodrigo Sousa
const JEN = "u-jenifer";      // JENIFER ALMEIDA
const ISA = "u-isabela";      // ISABELA GUEDES
const H = (horas) => new Date(Date.now() - horas * 3600e3).toISOString();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
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

// AS CONVERSAS PLANTADAS, todas no alto da lista (atividade dos últimos
// minutos). Uma por caso, com as não lidas escolhidas para a pílula ter o que
// contar em cada aba.
const P = {
  joana:  { id: "cv-joana",  nome: "JOANA DA JENIFER",   dono: JEN,  situacao: "aberto",     naoLidas: 2, h: 0.05 },
  julio:  { id: "cv-julio",  nome: "JULIO DA JENIFER",   dono: JEN,  situacao: "aguardando", naoLidas: 1, h: 0.10 },
  jaci:   { id: "cv-jaci",   nome: "JACI DA JENIFER",    dono: JEN,  situacao: "finalizado", naoLidas: 0, h: 0.15 },
  ivone:  { id: "cv-ivone",  nome: "IVONE DA ISABELA",   dono: ISA,  situacao: "aberto",     naoLidas: 0, h: 0.20 },
  rafael: { id: "cv-rafael", nome: "RAFAEL DO RODRIGO",  dono: EU,   situacao: "aberto",     naoLidas: 1, h: 0.25 },
  sebast: { id: "cv-sebast", nome: "SEBASTIAO SEM DONO", dono: null, situacao: "aguardando", naoLidas: 1, h: 0.30 },
};
const PLANTADAS = Object.values(P);
const DA_JENIFER = new Set([P.joana.nome, P.julio.nome, P.jaci.nome]);

function semente({ colegas = 0 } = {}) {
  const contatos = [], conversas = [], mensagens = [];
  PLANTADAS.forEach((p, i) => {
    const ct = { id: `ct-${p.id}`, numero: `55119700046${String(10 + i)}`, nome: p.nome, vantoro_nome: null,
                 nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
    contatos.push(ct);
    conversas.push({
      id: p.id, advogado_id: ADV, contato_id: ct.id, nao_lidas: p.naoLidas,
      arquivada: false, fixada: false, favorita: false, frente: null, vantoro_nome: null, digitando_ate: null,
      ultima_atividade: H(p.h), ultima_mensagem: "bom dia", situacao: p.situacao, protocolo: null,
      responsavel_id: p.dono, responsavel_em: p.dono ? H(1) : null, responsavel_por: p.dono,
      contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null },
    });
    mensagens.push({ id: `m-${p.id}`, conversa_id: p.id, origem: "contato", tipo: "texto", texto: "bom dia",
                     criado_em: H(p.h), id_uazapi: `ID-${p.id}` });
  });
  // MAIS COLEGAS, para o menu ganhar o campo de pesquisa (a partir de 7).
  const usuarios = Array.from({ length: colegas }, (_, i) => ({
    id: `u-colega-${i}`, admin: false, nome: ["BEATRIZ", "CAMILA", "DANIEL", "EDUARDO", "FABIO"][i % 5] + " COLEGA", foto_url: null,
  }));
  return { contatos, conversas, mensagens, usuarios };
}

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ largura = 1400, altura = 900, sem046 = false, sem008 = false, colegas = 0,
                             atrasoDaContagem = 0, atraso = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_CONTAGEM_POR_RESPONSAVEL = d.sem046;
    globalThis.__SEM_RESPONSAVEL = d.sem008;
    globalThis.__ATRASO_DA_CONTAGEM = d.atrasoDaContagem;
    globalThis.__ATRASO_POR_TABELA = d.atraso;
  }, { semente: semente({ colegas }), sem046, sem008, atrasoDaContagem, atraso });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: o que não existe não estoura a prova. */
async function clicar(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  await l.first().click({ timeout: 5000 }).catch(() => {});
  return true;
}
/** Espera uma condição da tela, com teto — e devolve o último valor lido. */
async function esperarAte(page, fn, arg = null, prazo = 8000) {
  const fim = Date.now() + prazo;
  let v;
  for (;;) {
    v = await page.evaluate(fn, arg);
    if (v && v.pronto) return v;
    if (Date.now() > fim) return v;
    await page.waitForTimeout(150);
  }
}

const nomesNaLista = (page) => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")].filter((e) => e.offsetParent !== null)
    .map((e) => e.getAttribute("data-conversa-nome")));
const idsNaLista = (page) => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-id]")].filter((e) => e.offsetParent !== null)
    .map((e) => e.getAttribute("data-conversa-id")));
/** O que a tela diz, num retrato só. */
const retrato = (page) => page.evaluate(() => {
  const num = (k) => {
    const el = document.querySelector(`[data-aba-da-situacao="${k}"] [data-numero-da-aba]`);
    return el ? Number(el.getAttribute("data-numero-da-aba")) : null;
  };
  const botao = document.querySelector("[data-responsaveis-botao]");
  return {
    rotulo: document.querySelector("[data-responsaveis-rotulo]")?.textContent.trim() ?? null,
    estado: botao?.getAttribute("data-responsaveis-botao") ?? null,
    titulo: botao?.getAttribute("title") ?? "",
    menu: Boolean(document.querySelector("[data-menu-responsaveis]")),
    abas: { aguardando: num("aguardando"), aberto: num("aberto"), finalizado: num("finalizado") },
    naoLidas: document.querySelector('[data-aba="naolidas"]')?.textContent.trim() ?? null,
    abaAtiva: document.querySelector('[data-aba-da-situacao][data-aba-ativa="sim"]')?.getAttribute("data-aba-da-situacao") || null,
    recado: document.querySelector("[data-recado-da-lista]")?.textContent.trim() ?? null,
    marcaDoRecado: document.querySelector("[data-recado-da-lista]")?.getAttribute("data-recado-da-lista") ?? null,
    topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
    faixa: [...document.querySelectorAll("[data-falha-de-leitura]")].map((e) => e.innerText).join(" | "),
  };
});
/** A conta que o banco faria para estes responsáveis — "" é sem dono. */
const contaNoBanco = (page, adv, donos) => page.evaluate(({ adv, donos }) => {
  const T = globalThis.__TABELAS;
  const r = { aguardando: 0, aberto: 0, finalizado: 0, nl: { aguardando: 0, aberto: 0, finalizado: 0 } };
  for (const c of T.conversas || []) {
    if (String(c.advogado_id) !== String(adv) || c.arquivada) continue;
    if (donos && !donos.includes(c.responsavel_id ? String(c.responsavel_id) : "")) continue;
    if (!(T.mensagens || []).some((m) => String(m.conversa_id) === String(c.id))) continue;
    const s = c.situacao || "aberto";
    if (!(s in r.nl)) continue;
    r[s] += 1; if ((c.nao_lidas || 0) > 0) r.nl[s] += 1;
  }
  return r;
}, { adv, donos });
const pedidas = (page) => page.evaluate(() => (globalThis.__CONTAGENS_PEDIDAS || []).map((a) => ({ ...a })));
const mesmasAbas = (a, b) => a && b && a.aguardando === b.aguardando && a.aberto === b.aberto && a.finalizado === b.finalizado;

async function abrirMenu(page) {
  if (!(await page.locator("[data-menu-responsaveis]").count())) await clicar(page, "[data-responsaveis-botao]");
  await page.waitForTimeout(300);
  return (await page.locator("[data-menu-responsaveis]").count()) > 0;
}
/** Marca (ou desmarca) uma opção do menu — abre o menu antes, se precisar. */
async function marcar(page, id) {
  await abrirMenu(page);
  const achou = await clicar(page, `[data-responsavel-opcao="${id}"]`);
  await page.waitForTimeout(400);
  return achou;
}
/** Espera a lista e os números assentarem depois de um gesto. */
async function assentar(page) {
  await page.waitForTimeout(400);
  await esperarAte(page, () => {
    const marca = document.querySelector("[data-recado-da-lista]")?.getAttribute("data-recado-da-lista") || "";
    const carregando = /^trocando|^procurando/.test(marca);
    const temNumero = Boolean(document.querySelector("[data-numero-da-aba]"));
    return { pronto: !carregando && temNumero };
  }, null, 6000);
  await page.waitForTimeout(500);
}
async function irParaAba(page, k) {
  await clicar(page, `[data-aba-da-situacao="${k}"]`);
  await assentar(page);
}

// ==================================================================
console.log("\n1. O alto da lista: sem “ATENDENDO COMO”, e o seletor ao lado do número");
{
  const { ctx, page, estouros } = await abrirPainel();
  const m = await page.evaluate(() => {
    const linha = document.querySelector("[data-atendendo-como]");
    const sel = linha?.querySelector("[data-seletor-de-responsaveis]");
    const botao = sel?.querySelector("[data-responsaveis-botao]");
    // O NÚMERO é o filho da linha que escreve dígitos.
    const numero = [...(linha?.children || [])].find((e) => /\(\d{2}\)/.test(e.textContent || "") && !e.contains(botao));
    const r = (e) => e ? e.getBoundingClientRect() : null;
    const rb = r(botao), rn = r(numero), rl = r(linha);
    const coluna = linha?.closest("[data-coluna-da-lista]") || linha?.parentElement?.parentElement;
    let pintado = false;
    if (rb) {
      const el = document.elementFromPoint(rb.left + rb.width / 2, rb.top + rb.height / 2);
      pintado = Boolean(el && botao.contains(el));
    }
    return {
      texto: linha?.innerText || "",
      temSeletor: Boolean(sel), temBotao: Boolean(botao),
      botao: rb && { left: rb.left, right: rb.right, height: rb.height },
      numero: rn && { right: rn.right, cortado: numero.scrollWidth > numero.clientWidth + 1 },
      linha: rl && { height: rl.height, right: rl.right },
      pintado,
      dentroDaColuna: Boolean(rb && rl && rb.right <= rl.right + 0.5),
    };
  });
  ok("a linha do telefone não diz mais “ATENDENDO COMO”", !/ATENDENDO\s+COMO/i.test(m.texto), m.texto);
  ok("e nenhum lugar do alto da lista diz", !(await page.evaluate(() => /ATENDENDO\s+COMO/i.test(document.body.innerText))));
  ok("o seletor mora na linha do telefone", m.temSeletor && m.temBotao);
  ok("à direita do número, sem encostar nele", Boolean(m.botao && m.numero && m.botao.left >= m.numero.right + 2),
     JSON.stringify({ botao: m.botao, numero: m.numero }));
  ok("o número aparece inteiro", Boolean(m.numero && !m.numero.cortado), JSON.stringify(m.numero));
  ok("o seletor não passa da borda da coluna", m.dentroDaColuna, JSON.stringify({ botao: m.botao, linha: m.linha }));
  ok("e está PINTADO onde se clica", m.pintado);
  ok("a linha continua com a altura de uma linha", Boolean(m.linha && m.linha.height <= 24), JSON.stringify(m.linha));
  const r = await retrato(page);
  ok("sem escolha, ele diz “Responsável”", r.rotulo === "Responsável" && r.estado === "todos", JSON.stringify(r));
  const ped = await pedidas(page);
  ok("e a conta das abas foi pedida só com o telefone, como antes",
     ped.length > 0 && ped.every((a) => !("p_responsaveis" in a) && !("p_sem_responsavel" in a)), JSON.stringify(ped));
  const todos = await contaNoBanco(page, ADV, null);
  ok("os números das abas são os do telefone inteiro", mesmasAbas(r.abas, todos), JSON.stringify({ tela: r.abas, banco: todos }));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Uma pessoa: a Jenifer — a lista, cada aba e a pílula “Não lidas”");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("o menu abre", await abrirMenu(page));
  const menu = await page.evaluate(() => {
    const m = document.querySelector("[data-menu-responsaveis]");
    return {
      texto: m?.innerText || "",
      ordem: [...(m?.querySelectorAll("[data-responsavel-opcao]") || [])].map((b) => b.getAttribute("data-responsavel-opcao")),
      todos: Boolean(m?.querySelector("[data-responsaveis-todos]")),
    };
  });
  ok("diz o que ele faz", /MOSTRAR AS CONVERSAS DE/.test(menu.texto), menu.texto.slice(0, 80));
  ok("oferece “Todos os responsáveis”", menu.todos && /Todos os responsáveis/.test(menu.texto));
  ok("“Sem responsável” vem primeiro, depois você, depois a equipe pelo nome",
     JSON.stringify(menu.ordem) === JSON.stringify(["sem", EU, ISA, JEN]), JSON.stringify(menu.ordem));
  ok("você aparece como você", /Rodrigo Sousa \(você\)/.test(menu.texto));

  ok("cheguei à Jenifer no menu", await marcar(page, JEN));
  let r = await retrato(page);
  ok("marcar NÃO fecha o menu — escolher várias é o pedido", r.menu);
  await page.keyboard.press("Escape");
  await assentar(page);
  r = await retrato(page);
  ok("o botão diz o nome dela", r.rotulo === "JENIFER" && r.estado === "escolhidos", JSON.stringify({ rotulo: r.rotulo, estado: r.estado }));
  ok("e o porquê, por extenso", /Mostrando só as conversas em que o responsável é JENIFER\./.test(r.titulo), r.titulo);
  let nomes = await nomesNaLista(page);
  ok("“Em Atendimento” mostra só as conversas dela", nomes.length === 1 && nomes[0] === P.joana.nome, JSON.stringify(nomes));
  ok("os números das abas são os dela: Novos 1, Em Atendimento 1, Finalizados 1",
     mesmasAbas(r.abas, { aguardando: 1, aberto: 1, finalizado: 1 }), JSON.stringify(r.abas));
  ok("e “Não lidas” conta só as dela nesta aba", r.naoLidas === "Não lidas 1", r.naoLidas);
  const ultima = (await pedidas(page)).pop() || {};
  ok("a conta foi pedida com a Jenifer, e sem as sem responsável",
     JSON.stringify(ultima.p_responsaveis) === JSON.stringify([JEN]) && ultima.p_sem_responsavel === false, JSON.stringify(ultima));

  await irParaAba(page, "aguardando");
  nomes = await nomesNaLista(page);
  r = await retrato(page);
  ok("“Novos” mostra só a dela", nomes.length === 1 && nomes[0] === P.julio.nome, JSON.stringify(nomes));
  ok("e “Não lidas” acompanha a aba", r.naoLidas === "Não lidas 1", r.naoLidas);
  await irParaAba(page, "finalizado");
  nomes = await nomesNaLista(page);
  r = await retrato(page);
  ok("“Finalizados” mostra só a dela", nomes.length === 1 && nomes[0] === P.jaci.nome, JSON.stringify(nomes));
  ok("e sem não lida ali, a pílula não inventa número", r.naoLidas === "Não lidas", r.naoLidas);

  // A PÍLULA LIGADA, com a escolha: só as não lidas dela.
  await irParaAba(page, "aberto");
  await clicar(page, '[data-aba="naolidas"]');
  await page.waitForTimeout(1200);
  nomes = await nomesNaLista(page);
  ok("com “Não lidas” ligada, só as dela por ler", nomes.length === 1 && nomes[0] === P.joana.nome, JSON.stringify(nomes));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2b. Enquanto a conta da Jenifer não chega, as abas não ficam com a de todos");
{
  // A CONTA DEMORA um segundo e meio, como numa manhã de banco ocupado. Nesse
  // intervalo, o número de "todos" ao lado da lista da Jenifer seria a aba
  // dizendo uma coisa e a lista outra.
  const { ctx, page, estouros } = await abrirPainel({ atrasoDaContagem: 1500 });
  await esperarAte(page, () => ({ pronto: Boolean(document.querySelector("[data-numero-da-aba]")) }), null, 8000);
  const todos = (await retrato(page)).abas;
  ok("começa com os números do telefone inteiro", todos.aberto != null && todos.aberto > 1, JSON.stringify(todos));
  await marcar(page, JEN);
  const vistos = [];
  const fim = Date.now() + 1100;
  while (Date.now() < fim) {
    vistos.push((await retrato(page)).abas.aberto);
    await page.waitForTimeout(60);
  }
  ok("no intervalo, nenhuma aba mostra o número de todos", !vistos.includes(todos.aberto), JSON.stringify(vistos));
  await page.keyboard.press("Escape");
  const v = await esperarAte(page, () => {
    const n = document.querySelector('[data-aba-da-situacao="aberto"] [data-numero-da-aba]')?.getAttribute("data-numero-da-aba");
    return { pronto: n === "1", n };
  }, null, 6000);
  ok("e, chegando a conta dela, o número é o dela", v.n === "1", `número: ${v.n}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Mais de uma pessoa, e as sem responsável");
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, ISA);
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  let r = await retrato(page);
  ok("duas pessoas: o botão diz a primeira e quantas mais", r.rotulo === "ISABELA +1", r.rotulo);
  ok("e o porquê diz as duas", /é ISABELA ou JENIFER\./.test(r.titulo), r.titulo);
  let nomes = await nomesNaLista(page);
  ok("a lista tem as das duas, e nenhuma outra",
     nomes.length === 2 && nomes.includes(P.joana.nome) && nomes.includes(P.ivone.nome), JSON.stringify(nomes));
  ok("e os números são a soma das duas", mesmasAbas(r.abas, { aguardando: 1, aberto: 2, finalizado: 1 }), JSON.stringify(r.abas));

  await marcar(page, "sem");
  await page.keyboard.press("Escape");
  await assentar(page);
  r = await retrato(page);
  ok("com as sem responsável: “ISABELA +2”", r.rotulo === "ISABELA +2", r.rotulo);
  ok("e o porquê diz “ou sem responsável”", /é ISABELA ou JENIFER, ou sem responsável\./.test(r.titulo), r.titulo);
  nomes = await nomesNaLista(page);
  const esperado = await contaNoBanco(page, ADV, ["", ISA, JEN]);
  ok("as sem responsável da bancada entram", nomes.includes("MARIA DO FILTRO"), JSON.stringify(nomes.slice(0, 6)));
  ok("as das duas continuam", nomes.includes(P.joana.nome) && nomes.includes(P.ivone.nome));
  ok("e a minha, não", !nomes.includes(P.rafael.nome));
  ok("os números são os das três escolhas", mesmasAbas(r.abas, esperado), JSON.stringify({ tela: r.abas, banco: esperado }));
  const ultima = (await pedidas(page)).pop() || {};
  ok("a conta foi pedida com as duas E com as sem responsável",
     JSON.stringify([...(ultima.p_responsaveis || [])].sort()) === JSON.stringify([ISA, JEN].sort()) && ultima.p_sem_responsavel === true,
     JSON.stringify(ultima));

  // DESFAZER TUDO DE UMA VEZ fecha o menu.
  await abrirMenu(page);
  await clicar(page, "[data-responsaveis-todos]");
  await assentar(page);
  r = await retrato(page);
  ok("“Todos os responsáveis” desfaz a escolha e fecha o menu", r.rotulo === "Responsável" && r.estado === "todos" && !r.menu,
     JSON.stringify({ rotulo: r.rotulo, menu: r.menu }));
  nomes = await nomesNaLista(page);
  ok("e a minha volta para a lista", nomes.includes(P.rafael.nome));
  const ultimaDeNovo = (await pedidas(page)).pop() || {};
  ok("e a conta volta a ser pedida só com o telefone", !("p_responsaveis" in ultimaDeNovo), JSON.stringify(ultimaDeNovo));
  ok("e os números voltam a ser os do telefone", mesmasAbas(r.abas, await contaNoBanco(page, ADV, null)), JSON.stringify(r.abas));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Só você");
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, EU);
  await page.keyboard.press("Escape");
  await assentar(page);
  const r = await retrato(page);
  ok("o botão diz “Você”, e não o seu nome", r.rotulo === "Você", r.rotulo);
  ok("e o porquê diz “você”", /é você\./.test(r.titulo), r.titulo);
  const nomes = await nomesNaLista(page);
  ok("só a sua", nomes.length === 1 && nomes[0] === P.rafael.nome, JSON.stringify(nomes));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. O telefone de 1200 conversas: a escolha vai junto, e o BANCO recorta");
{
  const { ctx, page, estouros } = await abrirPainel();
  // A DA POSIÇÃO 1150 — muito além das 200 que a primeira página traz.
  await page.evaluate((jen) => {
    for (const id of ["a13-c3", "a13-c1150"]) {
      const c = globalThis.__TABELAS.conversas.find((x) => x.id === id);
      if (c) { c.responsavel_id = jen; c.responsavel_por = jen; c.responsavel_em = new Date().toISOString(); }
    }
  }, JEN);
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  const chegou = await clicar(page, '[data-telefone="Arquivo"]');
  ok("cheguei ao telefone de 1200 conversas", chegou);
  await page.waitForTimeout(800);
  await assentar(page);
  const r = await retrato(page);
  ok("a escolha continua depois de trocar de telefone", r.rotulo === "JENIFER", r.rotulo);
  const ids = await idsNaLista(page);
  ok("a da Jenifer de perto aparece", ids.includes("a13-c3"), JSON.stringify(ids));
  ok("E A DA POSIÇÃO 1150 TAMBÉM: quem recorta é o banco", ids.includes("a13-c1150"), JSON.stringify(ids));
  ok("e nenhuma outra", ids.length === 2, JSON.stringify(ids));
  ok("o número de “Em Atendimento” é 2", r.abas.aberto === 2, JSON.stringify(r.abas));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5b. A carteira grande: “Não lidas” pergunta ao banco já recortado");
{
  // TREZENTAS CONVERSAS DA JENIFER no telefone de 1200, e mais a da posição
  // 1150. A primeira página traz as 200 mais recentes dela; com "Não lidas"
  // ligada, a pergunta ao banco tem teto de 500 — e o teto tem de cortar as
  // DELA. Cortado antes do recorte, ele pegaria as 500 não lidas mais
  // recentes do telefone inteiro, e a da posição 1150 não viria.
  const { ctx, page, estouros } = await abrirPainel();
  await page.evaluate((jen) => {
    const ids = new Set([...Array.from({ length: 300 }, (_, i) => `a13-c${i}`), "a13-c1150"]);
    for (const c of globalThis.__TABELAS.conversas) {
      if (ids.has(c.id)) { c.responsavel_id = jen; c.responsavel_por = jen; c.responsavel_em = new Date().toISOString(); }
    }
  }, JEN);
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  ok("cheguei ao telefone de 1200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(800);
  await assentar(page);
  let r = await retrato(page);
  ok("o número de “Em Atendimento” é o da carteira dela, 301", r.abas.aberto === 301, JSON.stringify(r.abas));
  ok("e “Não lidas” conta as dela por ler, 201", r.naoLidas === "Não lidas 201", r.naoLidas);
  await clicar(page, '[data-aba="naolidas"]');
  // O TOTAL DA LISTA, NO RODAPÉ ("40 de 201 conversas"), e SEM ROLAR: rolar
  // até o fim pede a página seguinte da lista, que vem recortada pelo banco e
  // traria a da posição 1150 por outro caminho. A sabotagem que tira o recorte
  // da pergunta das não lidas passou assim na primeira rodada.
  const rodape = await esperarAte(page, () => {
    const t = [...document.querySelectorAll("div")].map((d) => d.textContent || "")
      .find((x) => /^\d+ de \d+\+? conversas$/.test(x.trim()));
    const m = t && t.trim().match(/^\d+ de (\d+)/);
    return { pronto: Boolean(m && m[1] === "201"), total: m ? Number(m[1]) : null };
  }, null, 8000);
  ok("com “Não lidas”, a lista tem as 201 dela por ler — com a da posição 1150, que só a pergunta recortada traz",
     rodape.total === 201, `total no rodapé: ${rodape.total}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. A busca atravessa a escolha, como atravessa a aba");
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  const caixa = page.locator('input[placeholder^="Buscar por nome"]');
  const temCaixa = (await caixa.count()) > 0;
  ok("achei a caixa de busca", temCaixa);
  if (temCaixa) {
    await caixa.first().fill("IVONE");
    await page.waitForTimeout(2200);
    let nomes = await nomesNaLista(page);
    ok("procurando a da Isabela com a Jenifer escolhida, ela aparece", nomes.includes(P.ivone.nome), JSON.stringify(nomes));
    await caixa.first().fill("");
    await page.waitForTimeout(1500);
    nomes = await nomesNaLista(page);
    ok("apagada a busca, ela sai, e a da Jenifer volta",
       !nomes.includes(P.ivone.nome) && nomes.includes(P.joana.nome), JSON.stringify(nomes));
  }
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n7. O tempo real: a conversa passada à Jenifer entra, e a que ela passou adiante sai");
{
  const { ctx, page, estouros } = await abrirPainel();
  /** A colega passa a conversa: o banco muda, e o aviso chega pelo tempo real. */
  const passar = (id, dono) => page.evaluate(({ id, dono }) => {
    const c = globalThis.__TABELAS.conversas.find((x) => x.id === id);
    c.responsavel_id = dono; c.responsavel_por = dono; c.responsavel_em = new Date().toISOString();
    const { contato, ...linha } = c;
    return globalThis.__EMITIR("UPDATE", "conversas", { ...linha });
  }, { id, dono });
  /** Um aviso qualquer da conversa (a prévia, o "estou atendendo"), sem trocar de dono. */
  const avisar = (id) => page.evaluate((id) => {
    const c = globalThis.__TABELAS.conversas.find((x) => x.id === id);
    const { contato, ...linha } = c;
    return globalThis.__EMITIR("UPDATE", "conversas", { ...linha });
  }, id);

  // UM AVISO DA DO RAFAEL ANTES DE QUALQUER ESCOLHA: ele não pode fazer a
  // tela esquecer a conversa depois (ver a cena do Rafael, logo abaixo).
  ok("o canal está de pé", (await avisar(P.rafael.id)) > 0);
  await page.waitForTimeout(600);

  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  let nomes = await nomesNaLista(page);
  ok("começa com a Joana, e sem a Ivone", nomes.includes(P.joana.nome) && !nomes.includes(P.ivone.nome), JSON.stringify(nomes));

  await passar(P.ivone.id, JEN);
  let v = await esperarAte(page, (nome) => {
    const lista = [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-nome"));
    const n = document.querySelector('[data-aba-da-situacao="aberto"] [data-numero-da-aba]')?.getAttribute("data-numero-da-aba");
    return { pronto: lista.includes(nome) && n === "2", lista, n };
  }, P.ivone.nome, 9000);
  ok("a Ivone, passada à Jenifer por uma colega, ENTRA na lista dela", v.lista.includes(P.ivone.nome), JSON.stringify(v.lista));
  ok("e o número de “Em Atendimento” vira 2", v.n === "2", `número: ${v.n}`);

  // A CONTA QUE O PASSO DA IVONE AGENDOU sai 2,5 s depois dele. Passando a
  // Joana antes disso, aquela conta apanharia a Joana de carona, e a prova
  // não saberia dizer se a troca de dono da Joana pediu a sua. A sabotagem
  // que tira essa conta passou assim na primeira rodada.
  await page.waitForTimeout(3200);
  const contasAntesDaJoana = (await pedidas(page)).length;
  await passar(P.joana.id, ISA);
  v = await esperarAte(page, (nome) => {
    const lista = [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-nome"));
    const n = document.querySelector('[data-aba-da-situacao="aberto"] [data-numero-da-aba]')?.getAttribute("data-numero-da-aba");
    return { pronto: !lista.includes(nome) && n === "1", lista, n };
  }, P.joana.nome, 9000);
  ok("a Joana, passada à Isabela, SAI da lista da Jenifer", !v.lista.includes(P.joana.nome), JSON.stringify(v.lista));
  ok("e o número volta a 1", v.n === "1", `número: ${v.n}`);
  ok("pedido pela troca de dono da Joana, e não por carona", (await pedidas(page)).length > contasAntesDaJoana,
     `${contasAntesDaJoana} contas antes, ${(await pedidas(page)).length} depois`);

  // A CONVERSA QUE AVISOU ANTES DA ESCOLHA: o Rafael já passou pelo tempo
  // real lá em cima, e não conta mais como novo para esta tela.
  await passar(P.rafael.id, JEN);
  v = await esperarAte(page, (nome) => {
    const lista = [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-nome"));
    return { pronto: lista.includes(nome), lista };
  }, P.rafael.nome, 9000);
  ok("a conversa que avisou ANTES da escolha também entra, passada à Jenifer", v.lista.includes(P.rafael.nome), JSON.stringify(v.lista));

  // SEM ESCOLHA, a troca de dono não pede conta nenhuma. Numa conversa DA
  // LISTA: a que esta tela nunca viu pede a conta por ser nova para ela (a
  // régua da situação, de 19/10), e isso não é sobre o dono.
  await abrirMenu(page);
  await clicar(page, "[data-responsaveis-todos]");
  await assentar(page);
  await page.waitForTimeout(3200);
  const naLista = (await nomesNaLista(page)).includes(P.ivone.nome);
  ok("sem escolha, a Ivone está na lista", naLista);
  const antes = (await pedidas(page)).length;
  await passar(P.ivone.id, ISA);
  await page.waitForTimeout(3500);
  const depois = (await pedidas(page)).length;
  ok("sem escolha, trocar o dono não pede a conta das abas de novo", depois === antes, `${antes} → ${depois}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n8. Abrir de fora: a escolha que esconderia a conversa sai, e a que a mostra fica");
async function pelaNovaConversa(page, nome, ct) {
  if (!(await clicar(page, '[aria-label="Nova conversa"]'))) return false;
  await page.waitForTimeout(700);
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill(nome).catch(() => {});
  await page.waitForTimeout(1000);
  const achou = await clicar(page, `[data-contato-agenda="${ct}"]`);
  await page.waitForTimeout(2500);
  return achou;
}
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, ISA);
  await page.keyboard.press("Escape");
  await assentar(page);
  ok("cheguei à Ivone pela “Nova conversa”", await pelaNovaConversa(page, P.ivone.nome, `ct-${P.ivone.id}`));
  let r = await retrato(page);
  ok("ela abre", /IVONE/.test(r.topo), r.topo.slice(0, 60));
  ok("e a escolha da Isabela, que a mostra, FICA", r.rotulo === "ISABELA", r.rotulo);
  await ctx.close();
}
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  ok("cheguei à Ivone pela “Nova conversa”, com a Jenifer escolhida", await pelaNovaConversa(page, P.ivone.nome, `ct-${P.ivone.id}`));
  await assentar(page);
  const r = await retrato(page);
  ok("ela abre", /IVONE/.test(r.topo), r.topo.slice(0, 60));
  ok("a escolha da Jenifer, que a esconderia, SAI", r.rotulo === "Responsável" && r.estado === "todos", r.rotulo);
  const nomes = await nomesNaLista(page);
  ok("e a linha dela está na lista", nomes.includes(P.ivone.nome), JSON.stringify(nomes.slice(0, 8)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n9. A lista vazia diz o que está escolhido");
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, ISA);
  await page.keyboard.press("Escape");
  await assentar(page);
  await irParaAba(page, "aguardando");
  let r = await retrato(page);
  ok("“Novos” vazio diz que é da Isabela", r.marcaDoRecado === "sem-conversa-aguardando"
     && /Mostrando só as conversas em que o responsável é ISABELA\./.test(r.recado || ""), r.recado);
  await irParaAba(page, "aberto");
  await clicar(page, '[data-aba="naolidas"]');
  await page.waitForTimeout(1500);
  r = await retrato(page);
  ok("e “Não lidas” vazia também", r.marcaDoRecado === "sem-nao-lidas"
     && /Mostrando só as conversas em que o responsável é ISABELA\./.test(r.recado || ""), r.recado);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // E ENQUANTO O BANCO NÃO RESPONDE, ela diz que está carregando. A lista de
  // antes, recortada pela tela, diria "nenhum cliente novo" antes de a
  // pergunta voltar — a tela afirmando o que não apurou.
  const { ctx, page, estouros } = await abrirPainel({ atraso: { conversas: 1500 } });
  await irParaAba(page, "aguardando");
  await page.waitForTimeout(1800);
  await marcar(page, ISA);
  const marcas = [];
  const fim = Date.now() + 1000;
  while (Date.now() < fim) {
    marcas.push((await retrato(page)).marcaDoRecado);
    await page.waitForTimeout(60);
  }
  ok("trocando a escolha, a lista diz que está carregando", marcas.includes("trocando-de-responsavel"), JSON.stringify([...new Set(marcas)]));
  ok("e não afirma “nenhum” antes de o banco responder", !marcas.some((m) => /^sem-/.test(m || "")), JSON.stringify([...new Set(marcas)]));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n10. A pesquisa no menu, o Esc em degraus e o clique fora");
{
  const { ctx, page, estouros } = await abrirPainel({ colegas: 5 });
  // UMA CONVERSA ABERTA ATRÁS DO MENU: o Esc que fecha o menu não pode
  // fechar a conversa junto.
  await clicar(page, `[data-conversa-nome="${P.joana.nome}"]`);
  await page.waitForTimeout(1200);
  await abrirMenu(page);
  const campo = page.locator('[data-menu-responsaveis] input');
  const temCampo = (await campo.count()) > 0;
  ok("com a equipe grande, o menu tem o campo de pesquisa", temCampo);
  ok("com o cursor já nele", temCampo && await campo.first().evaluate((e) => e === document.activeElement));
  const opcoes = () => page.evaluate(() => [...document.querySelectorAll("[data-menu-responsaveis] [data-responsavel-opcao]")]
    .map((b) => b.getAttribute("data-responsavel-opcao")));
  if (temCampo) {
    await campo.first().fill("isab");
    await page.waitForTimeout(300);
    let o = await opcoes();
    ok("“isab” acha só a Isabela", JSON.stringify(o) === JSON.stringify([ISA]), JSON.stringify(o));
    ok("e “Todos os responsáveis” continua", (await page.locator("[data-menu-responsaveis] [data-responsaveis-todos]").count()) === 1);
    await campo.first().fill("sem resp");
    await page.waitForTimeout(300);
    o = await opcoes();
    ok("“sem resp” acha “Sem responsável”", o.includes("sem"), JSON.stringify(o));
    await campo.first().fill("zzz");
    await page.waitForTimeout(300);
    const nada = await page.evaluate(() => document.querySelector("[data-menu-responsaveis] [data-nada-com-a-pesquisa]")?.textContent || "");
    ok("e o que não acha ninguém diz o que foi escrito", /Ninguém/.test(nada) && /zzz/.test(nada), nada);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    ok("o primeiro Esc apaga o que foi escrito, e o menu continua", (await retrato(page)).menu
       && (await campo.first().inputValue().catch(() => "?")) === "");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    let r = await retrato(page);
    ok("o segundo Esc fecha o menu", !r.menu);
    ok("e a conversa aberta atrás dele continua aberta", /JOANA/.test(r.topo), r.topo.slice(0, 40));
    await abrirMenu(page);
    ok("aberto de novo, a pesquisa vem vazia", (await campo.first().inputValue().catch(() => "?")) === "");
  }
  // O CLIQUE FORA fecha.
  await page.mouse.click(900, 600);
  await page.waitForTimeout(300);
  ok("o clique fora fecha o menu", !(await retrato(page)).menu);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n11. Recarregar volta a mostrar todos");
{
  const { ctx, page, estouros } = await abrirPainel();
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await assentar(page);
  ok("escolhida a Jenifer", (await retrato(page)).rotulo === "JENIFER");
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await retrato(page);
  ok("depois do F5, todos de novo", r.rotulo === "Responsável" && r.estado === "todos", r.rotulo);
  ok("e a minha está na lista", (await nomesNaLista(page)).includes(P.rafael.nome));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
for (const [largura, altura] of [[360, 740], [390, 844]]) {
  console.log(`\n12. No celular, a ${largura}`);
  const { ctx, page, estouros } = await abrirPainel({ largura, altura });
  const m = await page.evaluate(() => {
    const linha = document.querySelector("[data-atendendo-como]");
    const botao = linha?.querySelector("[data-responsaveis-botao]");
    const numero = [...(linha?.children || [])].find((e) => /\(\d{2}\)/.test(e.textContent || "") && !e.contains(botao));
    const rb = botao?.getBoundingClientRect(), rn = numero?.getBoundingClientRect(), rl = linha?.getBoundingClientRect();
    let pintado = false;
    if (rb) {
      const el = document.elementFromPoint(rb.left + rb.width / 2, rb.top + rb.height / 2);
      pintado = Boolean(el && botao.contains(el));
    }
    return {
      rolaDeLado: document.documentElement.scrollWidth > window.innerWidth + 0.5,
      alvo: rb ? rb.height : 0,
      linha: rl ? rl.height : 99,
      separado: Boolean(rb && rn && rb.left >= rn.right + 2),
      numeroInteiro: Boolean(numero && numero.scrollWidth <= numero.clientWidth + 1),
      naTela: Boolean(rb && rb.right <= window.innerWidth + 0.5 && rb.left >= 0),
      pintado,
    };
  });
  ok("nada rola de lado", !m.rolaDeLado);
  ok("o botão tem os 40 pontos de alvo de dedo", m.alvo >= 40, `altura: ${m.alvo}`);
  ok("e a linha do telefone não cresce por causa dele", m.linha <= 24, `altura da linha: ${m.linha}`);
  ok("o número inteiro, e o seletor sem encostar nele", m.numeroInteiro && m.separado, JSON.stringify(m));
  ok("o seletor dentro da tela, e PINTADO", m.naTela && m.pintado, JSON.stringify(m));
  await abrirMenu(page);
  const menu = await page.evaluate(() => {
    const r = document.querySelector("[data-menu-responsaveis]")?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, cabe: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 } : null;
  });
  ok("o menu cabe na tela", Boolean(menu && menu.cabe), JSON.stringify(menu));
  await clicar(page, `[data-responsavel-opcao="${JEN}"]`);
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await assentar(page);
  const nomes = await nomesNaLista(page);
  ok("e escolher a Jenifer funciona no celular", nomes.length === 1 && nomes[0] === P.joana.nome, JSON.stringify(nomes));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n13. O banco sem o script 046 da ponte: a lista recorta, e a aba fica SEM número");
{
  const { ctx, page, estouros } = await abrirPainel({ sem046: true });
  let r = await retrato(page);
  ok("sem escolha, os números de sempre", mesmasAbas(r.abas, await contaNoBanco(page, ADV, null)), JSON.stringify(r.abas));
  await marcar(page, JEN);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);
  r = await retrato(page);
  const nomes = await nomesNaLista(page);
  ok("a lista recorta assim mesmo", nomes.length === 1 && nomes[0] === P.joana.nome, JSON.stringify(nomes));
  ok("as abas ficam sem número — e não com o do telefone inteiro",
     r.abas.aguardando === null && r.abas.aberto === null && r.abas.finalizado === null, JSON.stringify(r.abas));
  ok("e “Não lidas” também fica sem número", r.naoLidas === "Não lidas", r.naoLidas);
  ok("sem acender a faixa âmbar: não é falha, é o banco de antes", !/número de cada aba/i.test(r.faixa), r.faixa);
  await abrirMenu(page);
  await clicar(page, "[data-responsaveis-todos]");
  await assentar(page);
  r = await retrato(page);
  ok("voltando a todos, os números voltam", mesmasAbas(r.abas, await contaNoBanco(page, ADV, null)), JSON.stringify(r.abas));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n14. O banco sem o script 008: nada disto aparece");
{
  const { ctx, page, estouros } = await abrirPainel({ sem008: true });
  const m = await page.evaluate(() => ({
    seletor: document.querySelectorAll("[data-seletor-de-responsaveis]").length,
    texto: document.querySelector("[data-atendendo-como]")?.innerText || "",
  }));
  ok("sem o seletor", m.seletor === 0);
  ok("e sem o “ATENDENDO COMO” de volta", !/ATENDENDO\s+COMO/i.test(m.texto), m.texto);
  ok("a linha continua dizendo o telefone e o número", /\(\d{2}\)/.test(m.texto), m.texto);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
