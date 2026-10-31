// QUEM ESTÁ ESPERANDO DEMAIS (31/10) — o resumo ao abrir, o número da barra,
// a tela "Esperando resposta", o aviso dos 30 minutos e a aba de configuração.
//
// Pedido do Rodrigo, da lista de recomendações de 31/10: "Ao abrir o Zorvin,
// cada pessoa vê quantas conversas dela esperam há mais de 3 dias, com um
// botão que mostra quais. E um aviso quando um cliente novo passa de X
// minutos sem resposta no expediente."
//
// OS MINUTOS DE EXPEDIENTE SÃO DO BANCO (script 041 da ponte, conferido num
// Postgres de verdade na seção 86 de lá). Aqui a prova DITA o que a função
// `zorvin_clientes_sem_resposta` responde (`__SEM_RESPOSTA`) e mede o que a
// TELA faz com cada linha: para quem avisa, uma vez só, o que escreve, o que
// diz quando não consegue ler.
//
// O SOM E A TARJA SÃO ESPIONADOS, e não silenciados — a régua de
// `o-aviso-de-mensagem-nova`: uma bancada que os desligasse aprovaria um
// painel que nunca avisa ninguém.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const DIA = 24 * 3600e3;
const A_CADA = 1200;          // a pergunta de minuto em minuto, encurtada

/** Uma conversa plantada em que a sessão (u1) é a responsável. */
const minha = (id, adv, dias, extra = {}) => ({
  id, advogado_id: adv, contato_id: `${id}-ct`, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date(Date.now() - dias * DIA).toISOString(),
  esperando_desde: new Date(Date.now() - dias * DIA).toISOString(),
  ultima_mensagem: "Preciso de uma resposta", frente: null, vantoro_nome: null, digitando_ate: null,
  responsavel_id: "u1", responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null,
  contato: { nome: `CLIENTE ${id.toUpperCase()}`, numero: `55119${String(Math.abs(hash(id))).padStart(8, "0").slice(0, 8)}`, foto_url: null },
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

/** Abre o painel com TODAS as bandeiras escritas — `addInitScript` acumula, e
 *  uma bandeira de uma cena não pode valer na seguinte. */
async function abrir(opcoes = {}) {
  const ctx = opcoes.ctx || await nav.newContext({ viewport: opcoes.viewport || { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((o) => {
    globalThis.__AVISOS = [];
    globalThis.__DIARIO = [];
    globalThis.__ESPERA_PRIMEIRA_MS = 300;
    globalThis.__ESPERA_A_CADA_MS = o.aCada;
    globalThis.__SEM_RESPOSTA = o.semResposta || [];
    globalThis.__SEM_AVISO_DE_ESPERA = Boolean(o.semFuncao);
    globalThis.__QUEBRAR_FUNCAO = o.quebrar ? ["zorvin_clientes_sem_resposta"] : [];
    globalThis.__QUEBRAR_AS_QUE_ESPERAM = Boolean(o.quebrarAtrasadas);
    globalThis.__QUEBRAR = o.quebrarTabela ? [o.quebrarTabela] : [];
    globalThis.__ESCRITA_SEM_EFEITO = o.semEfeito ? ["zorvin_aviso_de_espera"] : [];
    globalThis.__ERRO_NA_GRAVACAO = o.erroNaGravacao
      ? { zorvin_aviso_de_espera: { code: "42501", message: "new row violates row-level security policy" } } : {};
    globalThis.__DESATIVAR = ["a12"];
    globalThis.__SEMENTE = o.semente || undefined;
    globalThis.__FUNCOES_CHAMADAS = [];
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
    // O pato e os bichos são ARQUIVO, e um arquivo não passa pelo oscilador:
    // a prova escolhe o som sintetizado, que é o de toda máquina nova.
    try { if (!localStorage.getItem("zorvin_som_do_aviso")) localStorage.setItem("zorvin_som_do_aviso", "toque"); } catch (_) { /* */ }
  }, { aCada: A_CADA, ...opcoes, ctx: undefined });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 });
  return { ctx, page, estouros };
}

const contar = (page, sel) => page.locator(sel).count();
const visivel = async (page, sel) => (await contar(page, sel)) > 0 && page.locator(sel).first().isVisible();
const texto = async (page, sel) => ((await contar(page, sel)) ? (await page.locator(sel).first().innerText()) : "");
const attr = async (page, sel, nome) => ((await contar(page, sel)) ? page.locator(sel).first().getAttribute(nome) : null);
/** CLIQUE GUARDADO: o elemento que não existe não estoura a prova inteira
 *  depois de 30 segundos — ela diz qual conferência viu o defeito. */
async function clicar(page, sel) {
  if (!(await contar(page, sel))) return false;
  await page.locator(sel).first().click();
  return true;
}
const avisos = (page) => page.evaluate(() => globalThis.__AVISOS || []);
const notificacoes = async (page) => (await avisos(page)).filter((a) => a.o === "notificacao");
const sons = async (page) => (await avisos(page)).filter((a) => a.o === "som").length;
const perguntas = (page) => page.evaluate(() => globalThis.__PERGUNTAS_DA_ESPERA || 0);
/** Quantas vezes as MINHAS que esperam há 3 dias ou mais foram lidas, pelo
 *  diário da bancada. É o MESMO formato que a prova da pesca usa para deixar
 *  esta leitura de fora da conta dela (`a-pesca-enquanto-o-canal-esta-fora`):
 *  se a consulta mudar de forma, a cadência daqui reprova dizendo zero — e é
 *  o lembrete de mudar o formato lá também. */
const leiturasDasMinhas = (page) => page.evaluate(() => (globalThis.__DIARIO || [])
  .filter((m) => m.tabela === "conversas" && /^id, advogado_id, esperando_desde\b/.test(m.colunas || "")
    && (m.pedidos || []).includes("responsavel_id")).length);
/** Espera a pergunta ao banco andar N vezes — a régua do tempo desta prova. */
async function rodadas(page, n = 1) {
  const antes = await perguntas(page);
  for (let i = 0; i < 40 && (await perguntas(page)) < antes + n; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(250);
}
async function esperar(page, sel, ms = 6000) {
  try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch (_) { return false; }
}
/** Espera um atributo chegar a um valor — as duas leituras chegam em tempos
 *  diferentes, e contar no meio do caminho mediria a primeira só. */
async function esperarValor(page, sel, nome, valor, ms = 6000) {
  for (let t = 0; t < ms; t += 150) {
    if ((await attr(page, sel, nome)) === valor) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

const SEMENTE_DAS_MINHAS = {
  conversas: [
    minha("esp-a1", "a1", 5),
    minha("esp-a3", "a3", 4),
    minha("esp-1dia", "a1", 1),
    minha("esp-2dias", "a1", 2),
    minha("esp-outro", "a1", 5, { responsavel_id: "u2" }),
    minha("esp-arq", "a1", 5, { arquivada: true }),
    minha("esp-desat", "a12", 6),
  ],
};

// ------------------------------------------------------------------
console.log("\n1. Ao abrir: o resumo, o número da barra e a lista");
{
  const { ctx, page, estouros } = await abrir({
    semente: SEMENTE_DAS_MINHAS,
    semResposta: [
      semResposta("a1-c0", "a1", "P-SEM-DONO", 50),
      semResposta("a1-c1", "a1", "P-DA-COLEGA", 60, { responsavel_id: "u2" }),
      semResposta("a3-c2", "a3", "P-MEU", 95, { responsavel_id: "u1" }),
    ],
  });
  const apareceu = await esperar(page, "[data-resumo-da-espera]");
  ok("ao abrir, sem conversa escolhida, aparece o resumo de quem espera", apareceu);
  // AS DUAS LEITURAS CHEGAM EM TEMPOS DIFERENTES: a da função é uma ida
  // curta, e a das conversas espera a lista saber que a coluna do responsável
  // existe. A prova espera as duas antes de contar.
  await esperar(page, "[data-resumo-atrasadas]");
  await esperar(page, "[data-selo-esperando]");
  ok("com os 2 clientes sem resposta que são meus ou de ninguém (o da colega não)",
     await attr(page, "[data-resumo-sem-resposta]", "data-resumo-sem-resposta") === "2",
     await texto(page, "[data-resumo-da-espera]"));
  ok("e a frase diz o limite: “2 clientes sem resposta há mais de 30 min de expediente”",
     /2 clientes\s+sem resposta há mais de 30 min de expediente/.test(await texto(page, "[data-resumo-sem-resposta]")),
     await texto(page, "[data-resumo-sem-resposta]"));
  ok("e as 2 conversas minhas esperando há 3 dias ou mais (sem as de 1 e 2 dias, a da colega, a arquivada e a da linha desativada)",
     await attr(page, "[data-resumo-atrasadas]", "data-resumo-atrasadas") === "2"
     && /2 conversas suas\s+esperando resposta há 3 dias ou mais/.test(await texto(page, "[data-resumo-atrasadas]")),
     await texto(page, "[data-resumo-atrasadas]"));
  ok("o número da barra é a soma das duas listas (4), vermelho porque há cliente sem resposta",
     await attr(page, "[data-selo-esperando]", "data-selo-esperando") === "4"
     && await attr(page, "[data-selo-esperando]", "data-sem-resposta") === "2",
     String(await attr(page, "[data-selo-esperando]", "data-selo-esperando")));
  const corDoSelo = await page.locator("[data-selo-esperando]").first().evaluate((e) => getComputedStyle(e).backgroundColor).catch(() => "");
  ok("e o selo é vermelho", /rgb\(217, 43, 32\)/.test(corDoSelo), corDoSelo);
  ok("nada tocou: quem passou do limite há muito tempo está na lista, e não no susto",
     (await sons(page)) === 0 && (await notificacoes(page)).length === 0, JSON.stringify(await avisos(page)));

  // A CADÊNCIA: UMA LEITURA DE CADA POR RODADA, E NÃO MAIS. As minhas há 3
  // dias são a única leitura de `conversas` com relógio próprio, e a prova da
  // pesca a deixa de fora da conta dela — então é AQUI que o custo dela é
  // conferido. Uma leitura a mais por rodada, ou uma por desenho, seria a
  // conta do relógio órfão de 20/10 com outra roupa.
  {
    await rodadas(page, 1);
    const b0 = await leiturasDasMinhas(page), p0 = await perguntas(page);
    await rodadas(page, 3);
    const nb = (await leiturasDasMinhas(page)) - b0, np = (await perguntas(page)) - p0;
    ok("a pergunta ao banco anda de rodada em rodada", np >= 3, `${np} perguntas em 3 rodadas`);
    ok("e as minhas há 3 dias são lidas uma vez por rodada — nem a mais, nem nunca",
       nb === np, `${nb} leituras das minhas para ${np} perguntas`);
  }

  await clicar(page, "[data-ver-quem-espera]");
  ok("“Ver quais” abre a tela Esperando resposta", await esperar(page, '[data-tela="esperando"]', 3000));
  await esperar(page, "[data-atrasada-linha]", 4000);
  await esperar(page, "[data-sem-resposta-linha]", 4000);
  const linhasA = await page.locator("[data-sem-resposta-linha]").evaluateAll((els) => els.map((e) => e.getAttribute("data-sem-resposta-linha")));
  ok("a seção dos clientes sem resposta lista os dois meus, e não o da colega",
     linhasA.length === 2 && linhasA.includes("a1-c0") && linhasA.includes("a3-c2") && !linhasA.includes("a1-c1"), JSON.stringify(linhasA));
  ok("cada um diz quanto espera, em expediente: “sem resposta há 1 h 35 min de expediente”",
     /sem resposta há 1 h 35 min de expediente/.test(await texto(page, '[data-sem-resposta-linha="a3-c2"]')),
     await texto(page, '[data-sem-resposta-linha="a3-c2"]'));
  ok("e o sem dono diz que está sem responsável",
     /sem responsável/.test(await texto(page, '[data-sem-resposta-linha="a1-c0"]')), await texto(page, '[data-sem-resposta-linha="a1-c0"]'));
  const linhasB = await page.locator("[data-atrasada-linha]").evaluateAll((els) => els.map((e) => e.getAttribute("data-atrasada-linha")));
  ok("a seção das minhas lista as duas, a que espera há mais tempo primeiro",
     JSON.stringify(linhasB) === JSON.stringify(["esp-a1", "esp-a3"]), JSON.stringify(linhasB));
  ok("e cada uma diz há quantos dias: “esperando há 5 dias”",
     /esperando há 5 dias/.test(await texto(page, '[data-atrasada-linha="esp-a1"]')), await texto(page, '[data-atrasada-linha="esp-a1"]'));

  // ABRIR UMA DELAS, de outro telefone: a tela fecha, o telefone troca e a
  // conversa abre — o caminho do histórico (`verConversaDoHistorico`).
  await clicar(page, '[data-atrasada-linha="esp-a3"]');
  await page.waitForTimeout(1500);
  ok("clicar numa conversa de outro telefone fecha a tela", (await contar(page, '[data-tela="esperando"]')) === 0);
  ok("e abre a conversa, no telefone dela",
     /CLIENTE ESP-A3/.test(await texto(page, "[data-topo-conversa]")), (await texto(page, "[data-topo-conversa]")).slice(0, 120));

  // O Esc fecha a tela, e não a conversa que está atrás dela.
  if (await contar(page, '[data-tela="esperando"]')) await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await clicar(page, "[data-abrir-esperando]");
  await esperar(page, '[data-tela="esperando"]', 3000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("o Esc fecha a tela Esperando resposta", (await contar(page, '[data-tela="esperando"]')) === 0);
  ok("e a conversa continua aberta atrás dela", /CLIENTE ESP-A3/.test(await texto(page, "[data-topo-conversa]")));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. O aviso: uma vez só, para quem é, e não para quem está olhando");
{
  const { ctx, page, estouros } = await abrir();
  await rodadas(page, 1);
  ok("(antes de alguém passar do limite, nada tocou)", (await sons(page)) === 0 && (await notificacoes(page)).length === 0);
  await page.evaluate((linhas) => { globalThis.__SEM_RESPOSTA = linhas; }, [
    semResposta("a1-c2", "a1", "P1", 31),
    semResposta("a1-c3", "a1", "P2", 32, { responsavel_id: "u2" }),
    semResposta("a1-c4", "a1", "P3", 33, { responsavel_id: "u1" }),
    semResposta("a1-c5", "a1", "P4", 50),
  ]);
  await rodadas(page, 1);
  const n1 = await notificacoes(page);
  ok("quem acabou de passar do limite toca: o som", (await sons(page)) > 0);
  ok("e uma tarja por cliente que é meu ou de ninguém (P1 e P3)",
     n1.length === 2 && n1.every((x) => /^Sem resposta há 3[13] min$/.test(x.titulo)), JSON.stringify(n1));
  ok("o da colega não toca para mim, e o que passou do limite há tempo também não",
     !n1.some((x) => /CLIENTE P2|CLIENTE P4/.test(x.body || "")), JSON.stringify(n1));
  ok("a tarja diz quem é e por qual telefone",
     n1.some((x) => /CLIENTE P1 — Dr\. Jorge Mesquita/.test(x.body || "")), JSON.stringify(n1));
  ok("e a faixa diz quantos, e onde ver",
     /2 clientes sem resposta há mais de 30 min de expediente — veja em Esperando resposta/.test(await texto(page, "[data-aviso]")),
     await texto(page, "[data-aviso]"));

  const somAntes = await sons(page);
  await page.evaluate((linhas) => {
    globalThis.__SEM_RESPOSTA = linhas;
  }, [semResposta("a1-c2", "a1", "P1", 32), semResposta("a1-c4", "a1", "P3", 34, { responsavel_id: "u1" })]);
  await rodadas(page, 2);
  ok("na pergunta seguinte, o mesmo cliente não toca de novo",
     (await sons(page)) === somAntes && (await notificacoes(page)).length === 2, JSON.stringify(await notificacoes(page)));

  // RECARREGAR NÃO TOCA DE NOVO — a marca mora no navegador.
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 });
  await page.evaluate((linhas) => { globalThis.__SEM_RESPOSTA = linhas; },
    [semResposta("a1-c2", "a1", "P1", 33), semResposta("a1-c4", "a1", "P3", 35, { responsavel_id: "u1" })]);
  await rodadas(page, 2);
  ok("recarregada a página, os mesmos clientes não tocam de novo",
     (await sons(page)) === 0 && (await notificacoes(page)).length === 0, JSON.stringify(await avisos(page)));

  // O CLIENTE QUE VOLTA é um protocolo novo, e toca de novo.
  await page.evaluate((linhas) => { globalThis.__SEM_RESPOSTA = linhas; },
    [semResposta("a1-c2", "a1", "P1-VOLTOU", 31)]);
  await rodadas(page, 1);
  ok("o mesmo cliente com um protocolo novo toca de novo",
     (await notificacoes(page)).length === 1, JSON.stringify(await notificacoes(page)));

  // A CONVERSA ABERTA não toca: quem está olhando para ela não precisa ser
  // avisado dela.
  // O TELEFONE QUE A BANCADA ABRE PRIMEIRO é o a7 — é dele a conversa que
  // se abre aqui. (A primeira escrita abria uma do a1, que não estava na
  // lista: o clique não fazia nada, e a cena media outra coisa.)
  const nomeDaAberta = await attr(page, '[data-conversa-id="a7-c6"]', "data-conversa-nome");
  await page.locator('[data-conversa-id="a7-c6"]').first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { globalThis.__AVISOS = []; });
  await page.evaluate((linhas) => { globalThis.__SEM_RESPOSTA = linhas; },
    [semResposta("a7-c6", "a7", "P-ABERTA", 31), semResposta("a7-c7", "a7", "P-FECHADA", 31)]);
  await rodadas(page, 1);
  const n3 = await notificacoes(page);
  ok("(a conversa a7-c6 está aberta)", Boolean(nomeDaAberta) && (await texto(page, "[data-topo-conversa]")).includes(nomeDaAberta),
     `${nomeDaAberta} | ${(await texto(page, "[data-topo-conversa]")).slice(0, 60)}`);
  ok("com a conversa aberta, só a outra toca",
     n3.length === 1 && /CLIENTE P-FECHADA/.test(n3[0]?.body || ""), JSON.stringify(n3));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. A falha é dita, e nunca vira “ninguém esperando”");
{
  const { ctx, page, estouros } = await abrir({ quebrar: true, semente: SEMENTE_DAS_MINHAS });
  const apareceu = await esperar(page, "[data-resumo-falhou]");
  ok("a pergunta que falha aparece no resumo, com o código", apareceu
     && /Não consegui ler os clientes sem resposta/.test(await texto(page, "[data-resumo-falhou]"))
     && /57014/.test(await texto(page, "[data-resumo-falhou]")), await texto(page, "[data-resumo-da-espera]"));
  ok("e a faixa âmbar diz o que não carregou",
     /clientes sem resposta/.test(await texto(page, "[data-falha-de-leitura]")), await texto(page, "[data-falha-de-leitura]"));
  ok("as minhas, que vieram, continuam no resumo", await esperarValor(page, "[data-resumo-atrasadas]", "data-resumo-atrasadas", "2"));
  await clicar(page, "[data-abrir-esperando]");
  await esperar(page, '[data-tela="esperando"]', 3000);
  ok("na tela, a seção diz que falhou", await visivel(page, "[data-espera-falhou-sem-resposta]"));
  ok("e não diz “nenhum cliente sem resposta”",
     !/Nenhum cliente sem resposta/.test(await texto(page, '[data-secao-da-espera="sem-resposta"]')),
     await texto(page, '[data-secao-da-espera="sem-resposta"]'));
  ok("nem conta zero no título da seção",
     !/\(0\)/.test(await texto(page, '[data-secao-da-espera="sem-resposta"] header')), await texto(page, '[data-secao-da-espera="sem-resposta"] header'));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, estouros } = await abrir({ quebrarAtrasadas: true, semente: SEMENTE_DAS_MINHAS });
  const apareceu = await esperar(page, "[data-resumo-falhou]");
  ok("a minha carteira que não carrega também é dita, com o código", apareceu
     && /Não consegui ler as suas conversas que esperam há 3 dias ou mais/.test(await texto(page, "[data-resumo-falhou]"))
     && /57014/.test(await texto(page, "[data-resumo-falhou]")), await texto(page, "[data-resumo-da-espera]"));
  await clicar(page, "[data-abrir-esperando]");
  await esperar(page, '[data-tela="esperando"]', 3000);
  ok("e na tela não vira “nenhuma conversa sua”", await visivel(page, "[data-espera-falhou-atrasadas]")
     && !/Nenhuma conversa sua/.test(await texto(page, '[data-secao-da-espera="atrasadas"]')),
     await texto(page, '[data-secao-da-espera="atrasadas"]'));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. Sem o script 041: o aviso não existe, e as minhas continuam");
{
  const { ctx, page, estouros } = await abrir({ semFuncao: true, semente: SEMENTE_DAS_MINHAS });
  await esperar(page, "[data-resumo-atrasadas]");
  await page.waitForTimeout(A_CADA * 3);
  ok("as minhas esperando há 3 dias ou mais aparecem assim mesmo", await attr(page, "[data-resumo-atrasadas]", "data-resumo-atrasadas") === "2");
  ok("sem frase de falha e sem faixa âmbar (a função que falta não é um tropeço)",
     (await contar(page, "[data-resumo-falhou]")) === 0 && !/clientes sem resposta/.test(await texto(page, "[data-falha-de-leitura]")));
  const chamadas = await page.evaluate(() => (globalThis.__FUNCOES_CHAMADAS || []).filter((c) => c.nome === "zorvin_clientes_sem_resposta").length);
  ok("e a função que não existe é perguntada uma vez só", chamadas === 1, String(chamadas));
  ok("o número da barra é o das minhas, em âmbar", await attr(page, "[data-selo-esperando]", "data-selo-esperando") === "2"
     && await attr(page, "[data-selo-esperando]", "data-sem-resposta") === "0");
  await clicar(page, "[data-abrir-esperando]");
  await esperar(page, '[data-tela="esperando"]', 3000);
  ok("e a tela não oferece a seção dos clientes sem resposta", (await contar(page, '[data-secao-da-espera="sem-resposta"]')) === 0
     && (await contar(page, '[data-secao-da-espera="atrasadas"]')) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. No celular: a barra e o ⋮ levam à mesma tela");
{
  const { ctx, page, estouros } = await abrir({ viewport: { width: 390, height: 844 }, semente: SEMENTE_DAS_MINHAS,
    semResposta: [semResposta("a1-c0", "a1", "P-CEL", 50)] });
  ok("a ampulheta da barra aparece com o número (1 sem resposta + 2 minhas)",
     await esperarValor(page, "[data-selo-esperando]", "data-selo-esperando", "3"),
     String(await attr(page, "[data-selo-esperando]", "data-selo-esperando")));
  await page.getByRole("button", { name: "Menu" }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  ok("o ⋮ tem “Esperando resposta”, com o número", /Esperando resposta\s*3/.test(await texto(page, "[data-abrir-esperando-menu]")),
     await texto(page, "[data-abrir-esperando-menu]"));
  await clicar(page, "[data-abrir-esperando-menu]");
  ok("e abre a tela", await esperar(page, '[data-tela="esperando"]', 3000));
  const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, tela: innerWidth }));
  ok("a tela não rola de lado no celular", larguras.doc <= larguras.tela, JSON.stringify(larguras));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. A aba Aviso de espera, em Departamentos e acessos");
const SEMANA_8_18 = { seg: ["08:00", "18:00"], ter: ["08:00", "18:00"], qua: ["08:00", "18:00"],
                      qui: ["08:00", "18:00"], sex: ["08:00", "18:00"], sab: null, dom: null };
const SEMENTE_DO_HORARIO = {
  zorvin_fora_do_horario: [
    { departamento_id: 1, ligada: false, texto: "", semana: SEMANA_8_18, fuso: "America/Sao_Paulo", atualizada_em: "2026-10-30T12:00:00Z" },
    { departamento_id: 2, ligada: false, texto: "", fuso: "America/Sao_Paulo", atualizada_em: "2026-10-30T12:00:00Z",
      semana: { seg: null, ter: null, qua: null, qui: null, sex: null, sab: null, dom: null } },
  ],
};
async function abrirAba(page) {
  await page.getByRole("button", { name: "Menu" }).first().click().catch(() => {});
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Departamentos e acessos" }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  return clicar(page, "[data-aba-aviso-de-espera]");
}
{
  const { ctx, page, estouros } = await abrir({ semente: SEMENTE_DO_HORARIO });
  ok("a aba existe", await abrirAba(page));
  await esperar(page, "[data-aviso-de-espera-departamento]", 4000);
  const dep = (id) => `[data-aviso-de-espera-departamento="${id}"]`;
  ok("sem linha no banco, vale o padrão: ligado, 30 minutos",
     await attr(page, dep(3), "data-ligado") === "sim" && await attr(page, dep(3), "data-minutos") === "30");
  ok("o expediente escrito aparece: “segunda a sexta, das 08:00 às 18:00”",
     /Expediente: segunda a sexta, das 08:00 às 18:00\./.test(await texto(page, `${dep(1)} [data-aviso-de-espera-expediente]`)),
     await texto(page, `${dep(1)} [data-aviso-de-espera-expediente]`));
  ok("todos os dias fechados: diz que o aviso nunca toca",
     /nunca toca/.test(await texto(page, `${dep(2)} [data-aviso-de-espera-expediente]`)));
  ok("sem expediente escrito: diz que conta o relógio inteiro",
     /relógio inteiro/.test(await texto(page, `${dep(3)} [data-aviso-de-espera-expediente]`)));

  await page.locator(`${dep(3)} [data-minutos-do-aviso]`).fill("4");
  ok("4 minutos não se salva, e a tela diz por quê",
     (await contar(page, `${dep(3)} [data-salvar-minutos-do-aviso]`)) === 0
     && /de 5 a 480/.test(await texto(page, `${dep(3)} [data-minutos-invalidos]`)));
  await page.locator(`${dep(3)} [data-minutos-do-aviso]`).fill("45");
  await clicar(page, `${dep(3)} [data-salvar-minutos-do-aviso]`);
  await page.waitForTimeout(700);
  const linha3 = await page.evaluate(() => (globalThis.__TABELAS.zorvin_aviso_de_espera || []).find((l) => String(l.departamento_id) === "3"));
  ok("45 é gravado, com o aviso ligado", linha3 && Number(linha3.minutos) === 45 && linha3.ligado === true, JSON.stringify(linha3));
  ok("e a tela relê do banco", await attr(page, dep(3), "data-minutos") === "45");
  await page.locator(dep(3)).getByRole("switch").first().click().catch(() => {});
  await page.waitForTimeout(700);
  const linha3b = await page.evaluate(() => (globalThis.__TABELAS.zorvin_aviso_de_espera || []).find((l) => String(l.departamento_id) === "3"));
  ok("desligar grava ligado = falso, e guarda os 45", linha3b && linha3b.ligado === false && Number(linha3b.minutos) === 45, JSON.stringify(linha3b));
  ok("e o campo dos minutos fica parado", await attr(page, dep(3), "data-ligado") === "nao"
     && await page.locator(`${dep(3)} [data-minutos-do-aviso]`).isDisabled());
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ erroNaGravacao: true });
  await abrirAba(page);
  await esperar(page, "[data-aviso-de-espera-departamento]", 4000);
  await page.locator('[data-aviso-de-espera-departamento="3"] [data-minutos-do-aviso]').fill("40");
  await clicar(page, '[data-aviso-de-espera-departamento="3"] [data-salvar-minutos-do-aviso]');
  await page.waitForTimeout(700);
  ok("a recusa com erro diz a frase e o código", /Não consegui salvar os minutos de Sucesso do Cliente[\s\S]*42501/.test(await page.locator("body").innerText()));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ quebrarTabela: "zorvin_aviso_de_espera" });
  ok("a leitura que falha mostra a aba assim mesmo", await abrirAba(page));
  await page.waitForTimeout(900);
  ok("e diz que falhou, sem desenhar o padrão por cima",
     await visivel(page, "[data-aviso-de-espera-falhou]") && (await contar(page, "[data-aviso-de-espera-departamento]")) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ semFuncao: true });
  await page.getByRole("button", { name: "Menu" }).first().click().catch(() => {});
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Departamentos e acessos" }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  ok("sem o script 041, a aba não aparece", (await contar(page, "[data-aba-aviso-de-espera]")) === 0
     && (await contar(page, "[data-aba-fora-do-horario]")) === 1);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
