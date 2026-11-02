// AS DUAS ABAS DA TELA "ESPERANDO RESPOSTA" (02/11).
//
// Pedido do Rodrigo: "na tela 'Esperando resposta', precisa ter duas abas para
// mudar entre 'CLIENTES SEM RESPOSTA' e 'SUAS CONVERSAS ESPERANDO HÁ 3 DIAS OU
// MAIS'". Eram duas seções, uma embaixo da outra: com os clientes sem resposta
// de um dia cheio, as suas conversas ficavam lá embaixo, depois da rolagem.
//
// O que esta prova confere:
//
//   1. as duas abas, com os nomes do pedido e o número de cada uma; a tela
//      abre nos clientes sem resposta e mostra SÓ a aba escolhida, que
//      PARECE escolhida; o clique troca; as abas ficam à vista com a lista
//      rolada; trocar de aba começa a lista do alto; as setas do teclado
//      andam entre as abas; a linha da aba abre a conversa;
//   2. sem cliente sem resposta, a tela abre nas suas conversas;
//   3. sem nada nas duas, abre na primeira, dizendo que não há ninguém;
//   4. a aba que não carregou diz que falhou, e não conta zero — e a tela
//      abre nela, quando a outra não tem ninguém;
//   5. a escolha de começo espera as DUAS leituras: com as suas conversas
//      lidas e os clientes ainda a caminho, a tela não pode se decidir pelas
//      suas conversas e esconder o cliente sem resposta. E, enquanto uma
//      lista vem, a aba dela não diz 0;
//   6. decidida, a aba não muda sozinha quando a lista esvazia;
//   7. no celular, os dois nomes inteiros, sem a tela rolar de lado, e as
//      abas com o alvo de dedo;
//   8. sem o script 041, só a aba das suas conversas.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const DIA = 24 * 3600e3;

/** Uma conversa plantada em que a sessão (u1) é a responsável. */
const minha = (id, adv, dias, extra = {}) => ({
  id, advogado_id: adv, contato_id: `${id}-ct`, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date(Date.now() - dias * DIA).toISOString(),
  esperando_desde: new Date(Date.now() - dias * DIA).toISOString(),
  ultima_mensagem: "Preciso de uma resposta", frente: null, vantoro_nome: null, digitando_ate: null,
  responsavel_id: "u1", responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null,
  contato: { nome: `CLIENTE ${id.toUpperCase()}`, numero: `5511930${String(Math.abs(hash(id))).padStart(6, "0").slice(0, 6)}`, foto_url: null },
  ...extra,
});
function hash(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

/** Uma linha do que a função do banco devolveria. */
const semResposta = (conversa_id, advogado_id, protocolo, minutos, extra = {}) => ({
  conversa_id, advogado_id, departamento_id: 1, protocolo,
  aberto_em: new Date(Date.now() - (minutos + 5) * 60e3).toISOString(),
  responsavel_id: null, minutos, limite: 30,
  contato: { nome: `CLIENTE ${protocolo}`, numero: "5511977776666" },
  ...extra,
});

const MINHAS = { conversas: [minha("esp-a1", "a1", 5), minha("esp-a3", "a3", 4)] };
const NENHUMA_MINHA = { conversas: [] };
const DOIS_CLIENTES = [
  semResposta("a1-c0", "a1", "P-SEM-DONO", 50),
  semResposta("a3-c2", "a3", "P-MEU", 95, { responsavel_id: "u1" }),
  semResposta("a1-c1", "a1", "P-DA-COLEGA", 60, { responsavel_id: "u2" }),
];
// Um dia cheio: a lista passa da altura da janela, e é aí que as abas têm de
// continuar à vista.
const MUITOS_CLIENTES = Array.from({ length: 16 }, (_, i) => semResposta(`a1-c${i}`, "a1", `P-${String(i).padStart(2, "0")}`, 40 + i * 7));
const MUITAS_MINHAS = { conversas: Array.from({ length: 16 }, (_, i) => minha(`esp-l${String(i).padStart(2, "0")}`, "a1", 4 + i)) };

/** Abre o painel com TODAS as bandeiras escritas — `addInitScript` acumula. */
async function abrir(o = {}) {
  const ctx = await nav.newContext({ viewport: o.viewport || { width: 1360, height: 700 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__DIARIO = [];
    globalThis.__ESPERA_PRIMEIRA_MS = d.primeira;
    globalThis.__ESPERA_A_CADA_MS = d.aCada;
    globalThis.__SEM_RESPOSTA = d.semResposta;
    globalThis.__SEM_AVISO_DE_ESPERA = Boolean(d.semFuncao);
    globalThis.__QUEBRAR_FUNCAO = d.quebrar ? ["zorvin_clientes_sem_resposta"] : [];
    globalThis.__QUEBRAR_AS_QUE_ESPERAM = Boolean(d.quebrarAtrasadas);
    globalThis.__ATRASO_POR_FUNCAO = d.atrasoDaFuncao ? { zorvin_clientes_sem_resposta: d.atrasoDaFuncao } : {};
    globalThis.__SEMENTE = d.semente;
    try { localStorage.setItem("zorvin_som_do_aviso", "mudo"); } catch (_) { /* */ }
  }, { primeira: o.primeira || 300, aCada: o.aCada || 600000, semResposta: o.semResposta || [],
       semFuncao: o.semFuncao, quebrar: o.quebrar, quebrarAtrasadas: o.quebrarAtrasadas,
       atrasoDaFuncao: o.atrasoDaFuncao || 0, semente: o.semente || MINHAS });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 }).catch(() => {});
  return { ctx, page, estouros };
}

const contar = (page, sel) => page.locator(sel).count();
const texto = async (page, sel) => ((await contar(page, sel)) ? (await page.locator(sel).first().innerText()) : "");
const attr = async (page, sel, nome) => ((await contar(page, sel)) ? page.locator(sel).first().getAttribute(nome) : null);
async function esperar(page, sel, ms = 6000) {
  try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch (_) { return false; }
}
/** CLIQUE GUARDADO: o que não existe não estoura a prova inteira. */
async function clicar(page, sel) {
  if (!(await contar(page, sel))) return false;
  try { await page.locator(sel).first().click({ timeout: 3000 }); return true; } catch (_) { return false; }
}
/** A tela, medida: as abas, qual está escolhida, e o que está pintado. */
const abas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-aba-da-espera]")].map((b) => {
  const r = b.getBoundingClientRect();
  const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const nome = b.querySelector("[data-nome-da-aba-da-espera]");
  const n = b.querySelector("[data-contagem-da-espera]");
  return {
    id: b.getAttribute("data-aba-da-espera"),
    nome: nome ? nome.innerText.replace(/\s+/g, " ").trim() : "",
    nomeInteiro: nome ? nome.scrollWidth <= nome.clientWidth + 1 : false,
    n: n ? n.getAttribute("data-contagem-da-espera") : null,
    falhou: Boolean(b.querySelector("[data-aba-da-espera-falhou]")),
    escolhida: b.getAttribute("aria-selected") === "true",
    controla: b.getAttribute("aria-controls"),
    pintada: Boolean(alvo && b.contains(alvo)),
    w: r.width, h: r.height, top: r.top, bottom: r.bottom,
  };
}));
const escolhida = async (page) => ((await abas(page)).find((a) => a.escolhida) || {}).id || null;
/** Espera a aba escolhida chegar a uma — a tela decide quando as leituras chegam. */
async function esperarAba(page, id, ms = 6000) {
  for (let t = 0; t < ms; t += 150) {
    if ((await escolhida(page)) === id) return true;
    await page.waitForTimeout(150);
  }
  return false;
}
/** A caixa que rola a lista de uma aba: o primeiro ancestral do painel com
 *  rolagem própria. */
const rolagem = (page, aba) => page.evaluate((id) => {
  const painel = document.querySelector(`[data-secao-da-espera="${id}"]`);
  let el = painel && painel.parentElement;
  while (el && getComputedStyle(el).overflowY !== "auto") el = el.parentElement;
  return el ? el.scrollTop : null;
}, aba);
const rolarAteOFim = (page, aba) => page.evaluate((id) => {
  const painel = document.querySelector(`[data-secao-da-espera="${id}"]`);
  let el = painel && painel.parentElement;
  while (el && getComputedStyle(el).overflowY !== "auto") el = el.parentElement;
  if (!el) return null;
  el.scrollTop = el.scrollHeight;
  return { rola: el.scrollHeight > el.clientHeight + 1, topo: el.scrollTop };
}, aba);
/** Espera as contagens das abas chegarem a estas, na ordem das abas. */
async function esperarContagens(page, esperadas, ms = 8000) {
  for (let t = 0; t < ms; t += 150) {
    const ns = (await abas(page)).map((a) => a.n);
    if (JSON.stringify(ns) === JSON.stringify(esperadas)) return true;
    await page.waitForTimeout(150);
  }
  return false;
}
async function abrirATela(page) {
  await esperar(page, "[data-abrir-esperando]", 15000);
  await clicar(page, "[data-abrir-esperando]");
  return esperar(page, '[data-tela="esperando"]', 4000);
}

// ------------------------------------------------------------------
console.log("\n1. As duas abas: os nomes do pedido, o número de cada uma, e só a escolhida à vista");
{
  const { ctx, page, estouros } = await abrir({ semResposta: DOIS_CLIENTES });
  await esperar(page, "[data-resumo-atrasadas]", 15000);
  await esperar(page, "[data-resumo-sem-resposta]", 15000);
  await clicar(page, "[data-ver-quem-espera]");
  ok("“Ver quais” abre a tela", await esperar(page, '[data-tela="esperando"]', 4000));
  await esperar(page, "[data-sem-resposta-linha]", 4000);
  const as = await abas(page);
  ok("são duas abas, nesta ordem", as.map((a) => a.id).join(",") === "sem-resposta,atrasadas", JSON.stringify(as.map((a) => a.id)));
  ok("a primeira diz “CLIENTES SEM RESPOSTA”", as[0] && as[0].nome === "CLIENTES SEM RESPOSTA", as[0] && as[0].nome);
  ok("a segunda diz “SUAS CONVERSAS ESPERANDO HÁ 3 DIAS OU MAIS”",
     as[1] && as[1].nome === "SUAS CONVERSAS ESPERANDO HÁ 3 DIAS OU MAIS", as[1] && as[1].nome);
  ok("cada aba diz quantos há nela: 2 clientes sem resposta (o da colega não) e 2 conversas suas",
     as.length === 2 && as[0].n === "2" && as[1].n === "2", JSON.stringify(as.map((a) => a.n)));
  ok("a tela abre nos clientes sem resposta, que é o que pede ação agora", await escolhida(page) === "sem-resposta");
  ok("e mostra só a aba escolhida: os clientes, e nenhuma das suas conversas",
     (await contar(page, "[data-sem-resposta-linha]")) === 2 && (await contar(page, "[data-atrasada-linha]")) === 0
     && (await contar(page, '[data-secao-da-espera="atrasadas"]')) === 0);
  ok("a aba escolhida aponta para o painel que está à vista",
     as[0] && as[0].controla && (await contar(page, `#${as[0].controla}[data-secao-da-espera="sem-resposta"]`)) === 1,
     as[0] && as[0].controla);
  ok("as duas abas estão pintadas (nada por cima)", as.length === 2 && as.every((a) => a.pintada));
  // A ESCOLHIDA TEM DE PARECER ESCOLHIDA (o relato de 29/09, da pílula da
  // ordem): o traço embaixo e a cor do nome. A outra, nem traço nem a cor.
  const visual = await page.evaluate(() => [...document.querySelectorAll("[data-aba-da-espera]")].map((b) => {
    const st = getComputedStyle(b);
    return { id: b.getAttribute("data-aba-da-espera"), traco: st.borderBottomColor, largura: st.borderBottomWidth, cor: st.color };
  }));
  const semCor = (c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c || "");
  ok("a aba escolhida PARECE escolhida: o traço embaixo e o nome noutra cor; a outra, sem traço",
     visual.length === 2 && !semCor(visual[0].traco) && parseFloat(visual[0].largura) >= 2
     && semCor(visual[1].traco) && visual[0].cor !== visual[1].cor, JSON.stringify(visual));

  ok("o clique na segunda aba troca", await clicar(page, '[data-aba-da-espera="atrasadas"]'));
  await esperar(page, "[data-atrasada-linha]", 3000);
  ok("a segunda aba fica escolhida, e a primeira não", await escolhida(page) === "atrasadas"
     && (await attr(page, '[data-aba-da-espera="sem-resposta"]', "aria-selected")) === "false");
  ok("e agora só as suas conversas estão à vista",
     (await contar(page, "[data-atrasada-linha]")) === 2 && (await contar(page, "[data-sem-resposta-linha]")) === 0);
  ok("a aba das suas conversas não perde a frase que explica a lista",
     /em que você é o responsável/.test(await texto(page, '[data-secao-da-espera="atrasadas"]')));

  // AS SETAS DO TECLADO, como em qualquer fileira de abas.
  await page.focus('[data-aba-da-espera="atrasadas"]').catch(() => {});
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  ok("a seta para a esquerda volta para os clientes sem resposta", await escolhida(page) === "sem-resposta");
  ok("e leva o foco junto", (await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-aba-da-espera"))) === "sem-resposta");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  ok("e a seta para a direita vai para as suas conversas", await escolhida(page) === "atrasadas");

  // A LINHA DE UM CLIENTE ABRE A CONVERSA, como antes das abas.
  await clicar(page, '[data-aba-da-espera="sem-resposta"]');
  await esperar(page, '[data-sem-resposta-linha="a3-c2"]', 3000);
  await clicar(page, '[data-sem-resposta-linha="a3-c2"]');
  await esperar(page, '[data-conversa-id="a3-c2"]', 4000);
  await page.waitForTimeout(600);
  // O NOME QUE A CONVERSA TEM NA BANCADA é o da linha da lista: o da linha
  // da tela "Esperando resposta" é o que a função do banco devolveu.
  const nomeDaConversa = await attr(page, '[data-conversa-id="a3-c2"]', "data-conversa-nome");
  ok("clicar num cliente sem resposta fecha a tela e abre a conversa dele, no telefone dela",
     (await contar(page, '[data-tela="esperando"]')) === 0 && Boolean(nomeDaConversa)
     && (await texto(page, "[data-topo-conversa]")).includes(nomeDaConversa),
     `${nomeDaConversa} | ${(await texto(page, "[data-topo-conversa]")).slice(0, 80)}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n1b. Um dia cheio: as abas continuam à vista com a lista rolada, e trocar de aba começa do alto");
{
  // AS DUAS LISTAS LONGAS: com a das suas conversas curta, trocar para ela
  // levaria a rolagem a zero sozinho (o navegador encolhe a rolagem até onde
  // a lista curta deixa), e a conferência passaria sem medir a troca.
  const { ctx, page, estouros } = await abrir({ semResposta: MUITOS_CLIENTES, semente: MUITAS_MINHAS,
                                                viewport: { width: 1360, height: 600 } });
  await esperar(page, "[data-resumo-sem-resposta]", 15000);
  await abrirATela(page);
  await esperar(page, "[data-sem-resposta-linha]", 4000);
  ok("os 16 clientes estão na lista", (await contar(page, "[data-sem-resposta-linha]")) === 16);
  const rolou = await rolarAteOFim(page, "sem-resposta");
  ok("a lista passa da altura da janela, e rolei até o fim", Boolean(rolou && rolou.rola && rolou.topo > 0), JSON.stringify(rolou));
  await page.waitForTimeout(200);
  const as = await abas(page);
  ok("com a lista rolada, as duas abas continuam à vista e pintadas",
     as.length === 2 && as.every((a) => a.pintada && a.top >= 0), JSON.stringify(as.map((a) => [a.id, Math.round(a.top), a.pintada])));
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  await esperar(page, "[data-atrasada-linha]", 3000);
  await page.waitForTimeout(200);
  ok("as 16 conversas suas estão na outra aba", (await contar(page, "[data-atrasada-linha]")) === 16);
  const topoAt = await rolagem(page, "atrasadas");
  ok("trocando de aba, a outra lista começa do alto, e não da altura em que a primeira estava", topoAt === 0, String(topoAt));
  const rolouAt = await rolarAteOFim(page, "atrasadas");
  ok("(rolei a das suas conversas até o fim)", Boolean(rolouAt && rolouAt.topo > 0), JSON.stringify(rolouAt));
  await clicar(page, '[data-aba-da-espera="sem-resposta"]');
  await page.waitForTimeout(300);
  const topo = await rolagem(page, "sem-resposta");
  ok("e voltando à primeira, ela também começa do alto", topo === 0, String(topo));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Sem cliente sem resposta, a tela abre nas suas conversas");
{
  const { ctx, page, estouros } = await abrir({ semResposta: [] });
  await esperar(page, "[data-resumo-atrasadas]", 15000);
  await abrirATela(page);
  ok("abre na aba das suas conversas", await esperarAba(page, "atrasadas"));
  await esperar(page, "[data-atrasada-linha]", 3000);
  ok("mostrando as duas", (await contar(page, "[data-atrasada-linha]")) === 2);
  const as = await abas(page);
  ok("e a aba dos clientes diz 0, porque a leitura foi feita e não achou ninguém",
     as[0] && as[0].id === "sem-resposta" && as[0].n === "0", JSON.stringify(as.map((a) => [a.id, a.n])));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Nada nas duas: abre na primeira, dizendo que não há ninguém");
{
  const { ctx, page, estouros } = await abrir({ semResposta: [], semente: NENHUMA_MINHA });
  await abrirATela(page);
  await page.waitForTimeout(800);
  ok("abre nos clientes sem resposta", await esperarAba(page, "sem-resposta"));
  ok("e diz que não há nenhum", /Nenhum cliente sem resposta/.test(await texto(page, '[data-secao-da-espera="sem-resposta"]')),
     await texto(page, '[data-secao-da-espera="sem-resposta"]'));
  const as = await abas(page);
  ok("as duas abas dizem 0", as.length === 2 && as.every((a) => a.n === "0"), JSON.stringify(as.map((a) => [a.id, a.n])));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. A aba que não carregou diz que falhou, e não conta zero");
{
  const { ctx, page, estouros } = await abrir({ quebrar: true });
  await esperar(page, "[data-resumo-falhou]", 15000);
  await esperar(page, "[data-resumo-atrasadas]", 15000);
  await abrirATela(page);
  ok("a tela abre na aba que falhou, e não na outra", await esperarAba(page, "sem-resposta"));
  ok("e diz que falhou, com o código", /57014/.test(await texto(page, "[data-espera-falhou-sem-resposta]")),
     await texto(page, '[data-secao-da-espera="sem-resposta"]'));
  const as = await abas(page);
  ok("a aba dos clientes leva a marca da falha, e nenhum número",
     as[0] && as[0].falhou && as[0].n === null, JSON.stringify(as[0]));
  ok("a das suas conversas continua com o número dela", as[1] && as[1].n === "2" && !as[1].falhou, JSON.stringify(as[1]));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, estouros } = await abrir({ quebrarAtrasadas: true, semResposta: DOIS_CLIENTES });
  await esperar(page, "[data-resumo-falhou]", 15000);
  await abrirATela(page);
  ok("com clientes sem resposta, a tela abre neles mesmo com a outra aba falhando", await esperarAba(page, "sem-resposta"));
  const as = await abas(page);
  ok("e a aba das suas conversas leva a marca da falha, sem número",
     as[1] && as[1].id === "atrasadas" && as[1].falhou && as[1].n === null, JSON.stringify(as[1]));
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  ok("aberta, ela diz que falhou, e não “nenhuma conversa sua”",
     await esperar(page, "[data-espera-falhou-atrasadas]", 3000)
     && !/Nenhuma conversa sua/.test(await texto(page, '[data-secao-da-espera="atrasadas"]')),
     await texto(page, '[data-secao-da-espera="atrasadas"]'));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

{
  // SEM CLIENTE SEM RESPOSTA, E A OUTRA LEITURA FALHANDO: a tela abre na
  // falha, e não num "nenhum cliente" que esconderia que a outra aba não veio.
  const { ctx, page, estouros } = await abrir({ quebrarAtrasadas: true, semResposta: [] });
  await esperar(page, "[data-resumo-falhou]", 15000);
  await abrirATela(page);
  ok("sem cliente sem resposta, a tela abre na aba que falhou", await esperarAba(page, "atrasadas"));
  ok("e diz que falhou", await esperar(page, "[data-espera-falhou-atrasadas]", 3000),
     await texto(page, '[data-secao-da-espera="atrasadas"]'));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. A escolha de começo espera as duas leituras");
{
  // A TELA ABERTA ANTES DA PRIMEIRA PERGUNTA, e a dos clientes demorando:
  // as suas conversas chegam primeiro. Decidir ali seria abrir nas suas
  // conversas e esconder os dois clientes que chegam logo depois.
  const { ctx, page, estouros } = await abrir({ semResposta: DOIS_CLIENTES, primeira: 600000, atrasoDaFuncao: 2500 });
  ok("a tela abriu antes de a função responder", await abrirATela(page));
  await esperar(page, "[data-atrasada-linha]", 3000);
  ok("as suas conversas chegaram antes", (await contar(page, "[data-atrasada-linha]")) === 2
     && (await contar(page, '[data-aba-da-espera="sem-resposta"]')) === 0);
  ok("e, quando os clientes chegam, a tela abre neles", await esperarAba(page, "sem-resposta", 8000));
  ok("mostrando os dois", await esperar(page, "[data-sem-resposta-linha]", 3000)
     && (await contar(page, "[data-sem-resposta-linha]")) === 2);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // E QUEM ESCOLHEU UMA ABA ANTES DE A DECISÃO CHEGAR fica nela.
  const { ctx, page, estouros } = await abrir({ semResposta: DOIS_CLIENTES, primeira: 600000, atrasoDaFuncao: 2500 });
  await abrirATela(page);
  await esperar(page, "[data-atrasada-linha]", 3000);
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  await esperar(page, '[data-aba-da-espera="sem-resposta"]', 8000);
  await page.waitForTimeout(600);
  ok("quem clicou nas suas conversas antes de os clientes chegarem continua nelas", await escolhida(page) === "atrasadas");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

{
  // ENQUANTO A LISTA VEM, A ABA NÃO DIZ 0. "0" ali diria que não há conversa
  // sua esperando, antes de a pergunta voltar — e quem lê de passagem vai
  // embora achando que está em dia.
  const { ctx, page, estouros } = await abrir({ semResposta: DOIS_CLIENTES, primeira: 600000 });
  await esperar(page, "[data-abrir-esperando]", 15000);
  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = { conversas: 3000 }; });
  await clicar(page, "[data-abrir-esperando]");
  await esperar(page, '[data-aba-da-espera="sem-resposta"] [data-contagem-da-espera]', 3000);
  const durante = await abas(page);
  ok("com as suas conversas ainda a caminho, a aba delas não diz número nenhum, nem 0",
     durante.length === 2 && durante[1].id === "atrasadas" && durante[1].n === null && !durante[1].falhou,
     JSON.stringify(durante.map((a) => [a.id, a.n, a.falhou])));
  ok("e a dos clientes, que já chegou, diz 2", Boolean(durante[0] && durante[0].n === "2"), JSON.stringify(durante[0]));
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  ok("aberta, ela diz que está procurando", /Procurando/.test(await texto(page, '[data-secao-da-espera="atrasadas"]')),
     await texto(page, '[data-secao-da-espera="atrasadas"]'));
  let chegou = false;
  for (let t = 0; t < 8000 && !chegou; t += 200) {
    chegou = ((await abas(page))[1] || {}).n === "2";
    if (!chegou) await page.waitForTimeout(200);
  }
  ok("e, quando a leitura chega, a aba diz 2", chegou, JSON.stringify((await abas(page)).map((a) => [a.id, a.n])));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. Decidida, a aba não muda sozinha quando a lista esvazia");
{
  // AS DUAS LEITURAS TÊM DE TER CHEGADO, antes de esvaziar e depois. Na
  // primeira escrita, a cena esvaziava a lista com as suas conversas ainda a
  // caminho e conferia antes de elas voltarem: a tela que se decide de novo
  // só trocaria de aba DEPOIS da conferência, e a sabotagem passava por esta
  // cena. Com as duas contagens na tela ("0" e "2"), a escolha de começo já
  // diria "as suas conversas" — e é aí que a aba tem de ficar onde está.
  const { ctx, page, estouros } = await abrir({ semResposta: DOIS_CLIENTES });
  await esperar(page, "[data-resumo-sem-resposta]", 15000);
  await esperar(page, "[data-resumo-atrasadas]", 15000);
  await abrirATela(page);
  ok("(as duas leituras chegaram: 2 e 2)", await esperarContagens(page, ["2", "2"]), JSON.stringify((await abas(page)).map((a) => a.n)));
  ok("(a tela abriu nos clientes sem resposta)", await esperarAba(page, "sem-resposta"));
  await page.evaluate(() => { globalThis.__SEM_RESPOSTA = []; });
  await clicar(page, "[data-atualizar-espera]");
  ok("a lista esvaziou, e as suas conversas continuam: 0 e 2", await esperarContagens(page, ["0", "2"]),
     JSON.stringify((await abas(page)).map((a) => a.n)));
  // A releitura das suas conversas (a bancada leva 700 ms em `conversas`)
  // também volta antes da conferência.
  await page.waitForTimeout(1200);
  ok("e a tela continua na aba dos clientes, dizendo que não há nenhum",
     await escolhida(page) === "sem-resposta"
     && /Nenhum cliente sem resposta/.test(await texto(page, '[data-secao-da-espera="sem-resposta"]')),
     `${await escolhida(page)} | ${JSON.stringify((await abas(page)).map((a) => a.n))}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. No celular: os dois nomes inteiros, sem a tela rolar de lado");
for (const largura of [390, 360]) {
  const { ctx, page, estouros } = await abrir({ semResposta: DOIS_CLIENTES, viewport: { width: largura, height: 800 } });
  await esperar(page, "[data-selo-esperando]", 15000);
  await abrirATela(page);
  await esperar(page, "[data-sem-resposta-linha]", 4000);
  const as = await abas(page);
  ok(`a ${largura}: as duas abas aparecem, pintadas`, as.length === 2 && as.every((a) => a.pintada),
     JSON.stringify(as.map((a) => [a.id, a.pintada])));
  ok(`a ${largura}: os dois nomes inteiros, sem corte (o comprido quebra em linhas)`,
     as.length === 2 && as.every((a) => a.nomeInteiro) && as[1].nome === "SUAS CONVERSAS ESPERANDO HÁ 3 DIAS OU MAIS",
     JSON.stringify(as.map((a) => [a.nome, a.nomeInteiro, Math.round(a.w)])));
  ok(`a ${largura}: as abas têm o alvo de dedo (40 de altura)`, as.length === 2 && as.every((a) => a.h >= 39.5),
     JSON.stringify(as.map((a) => Math.round(a.h))));
  const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: innerWidth }));
  ok(`a ${largura}: a tela não rola de lado`, larguras.doc <= larguras.tela, JSON.stringify(larguras));
  await clicar(page, '[data-aba-da-espera="atrasadas"]');
  ok(`a ${largura}: o toque na segunda aba troca`, await esperarAba(page, "atrasadas", 2000));
  ok(`a ${largura}: sem erro de JavaScript`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. Sem o script 041: só a aba das suas conversas");
{
  const { ctx, page, estouros } = await abrir({ semFuncao: true });
  await esperar(page, "[data-resumo-atrasadas]", 15000);
  await abrirATela(page);
  await esperar(page, "[data-atrasada-linha]", 3000);
  const as = await abas(page);
  ok("uma aba só, a das suas conversas", as.length === 1 && as[0].id === "atrasadas" && as[0].escolhida,
     JSON.stringify(as.map((a) => [a.id, a.escolhida])));
  ok("com as duas conversas", (await contar(page, "[data-atrasada-linha]")) === 2);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
