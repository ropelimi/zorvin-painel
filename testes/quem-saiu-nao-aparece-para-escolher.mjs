// QUEM SAIU NÃO APARECE PARA ESCOLHER (04/11)
//
// Relato do Rodrigo, com a foto do menu "Passar para": "A Gabriely Mota está
// desativada, ela já foi desligada da empresa e não deve mais aparecer no
// Zorvin. Ela já não está mais ativa no Vantoro, precisa ter essa comunicação
// entre ambos sistemas."
//
// A COMUNICAÇÃO JÁ EXISTIA: a ponte desliga no Zorvin quem sai do Vantoro
// (`usuarios.ativo = false`, sem permissão, com a entrada bloqueada). O que
// faltava era a TELA saber: as listas de escolher pessoa saem da vista
// `equipe`, que não dizia quem saiu. O script 047 da ponte pôs `ativo` nela.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. quem saiu não é oferecido onde se ESCOLHE alguém — "Passar para", o
//      seletor de responsáveis, o "para quem" da tarefa —, e as colegas
//      ativas continuam lá (o contraste: uma lista vazia também "não oferece");
//   2. o NOME dela continua onde é história: a mensagem que ela escreveu, a
//      conversa que ainda está com ela ("desde …"), e a tarefa dela, que a
//      janela de editar diz que é de quem não está mais na equipe;
//   3. o banco SEM o 047: a primeira leitura da equipe é recusada pela coluna
//      que falta, a lista é lida de novo sem ela, e TODO MUNDO pode ser
//      escolhido, como sempre pôde — sem faixa âmbar e sem estouro. É aqui
//      que se vê a leitura de novo: sem ela, a lista nem chegaria, e as
//      colegas sumiriam junto;
//   4. quem sai NO MEIO DO DIA: a renovação da sessão relê a equipe, e ela
//      deixa de ser oferecida — menos no seletor, se estiver escolhida lá:
//      escondida e marcada, ela recortaria a lista sem nada na tela dizendo
//      por quê, e não haveria onde desmarcá-la.
//
// Os nomes são de mentira (o repositório é público).
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
const SAIU = "u-saiu";        // a colega que saiu do escritório
const NOME_DELA = "GABI QUE SAIU";
const agora = Date.now();
const iso = (ms) => new Date(ms).toISOString();

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

// DUAS CONVERSAS, no alto da lista: uma em que ela ESCREVEU (e que é minha
// agora), e uma que ainda está COM ELA — o caso da conversa de quem saiu.
const C_ESCREVEU = { id: "cv-saiu-1", nome: "CLIENTE QUE ELA ATENDEU", dono: EU };
const C_COM_ELA = { id: "cv-saiu-2", nome: "CLIENTE QUE FICOU COM ELA", dono: SAIU };

function semente({ ativa }) {
  const conversas = [], contatos = [];
  [C_ESCREVEU, C_COM_ELA].forEach((c, i) => {
    const ct = { id: `ct-${c.id}`, numero: `55119700047${10 + i}`, nome: c.nome, vantoro_nome: null,
                 nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
    contatos.push(ct);
    conversas.push({
      id: c.id, advogado_id: ADV, contato_id: ct.id, nao_lidas: 0,
      arquivada: false, fixada: false, favorita: false, frente: null, vantoro_nome: null, digitando_ate: null,
      ultima_atividade: iso(agora - (i + 1) * 60e3), ultima_mensagem: "combinado", situacao: "aberto", protocolo: null,
      responsavel_id: c.dono, responsavel_em: iso(agora - 86400e3), responsavel_por: c.dono,
      contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null },
    });
  });
  return {
    usuarios: [{ id: SAIU, admin: false, nome: NOME_DELA, foto_url: null, ativo: ativa }],
    contatos, conversas,
    mensagens: [
      { id: "m-saiu-cliente", conversa_id: C_ESCREVEU.id, origem: "contato", tipo: "texto", texto: "bom dia",
        criado_em: iso(agora - 3 * 3600e3), id_uazapi: "ID-SAIU-1" },
      // A MENSAGEM QUE ELA ESCREVEU, quando ainda estava no escritório.
      { id: "m-saiu-dela", conversa_id: C_ESCREVEU.id, origem: "advogado", tipo: "texto", texto: "combinado, até amanhã",
        criado_em: iso(agora - 2 * 3600e3), id_uazapi: "ID-SAIU-2", status: "lida",
        enviado_por: NOME_DELA, enviado_por_id: SAIU, enviado_por_foto: null },
      { id: "m-saiu-cliente-2", conversa_id: C_COM_ELA.id, origem: "contato", tipo: "texto", texto: "oi",
        criado_em: iso(agora - 2 * 60e3), id_uazapi: "ID-SAIU-3" },
    ],
    // A TAREFA DELA, aberta, na conversa que agora é minha.
    zorvin_tarefas: [{
      id: "tf-saiu", conversa_id: C_ESCREVEU.id, texto: "Conferir o comprovante", vence_em: iso(agora + 26 * 3600e3),
      para_quem: SAIU, criada_por: EU, criada_em: iso(agora - 86400e3), feita_em: null, feita_por: null,
    }],
  };
}

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ ativa = false, sem047 = false } = {}) {
  // A 1920: a linha do número tem espaço, e o responsável é um botão com o
  // nome escrito, e não um ícone (a régua de `o-responsavel-pela-conversa`).
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_COLUNAS = d.sem047 ? { equipe: ["ativo"] } : {};
  }, { semente: semente({ ativa }), sem047 });
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
  await page.waitForTimeout(350);
  return true;
}

/** Os valores de um atributo, em todos os elementos que o têm. */
const valores = (page, attr, dentro = "") => page.evaluate(([a, d]) =>
  [...document.querySelectorAll(`${d ? d + " " : ""}[${a}]`)].map((el) => el.getAttribute(a)), [attr, dentro]);

/** Lê um atributo GUARDADO: o que não existe é null, e não 30 segundos de espera. */
async function attr(page, sel, a) {
  const l = page.locator(sel);
  if (!(await l.count())) return null;
  return l.first().getAttribute(a).catch(() => null);
}
async function texto(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return "";
  return (await l.first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
}

async function abrirConversa(page, nome) {
  // PELO `data-`, e não pelo papel (CLAUDE.md, 24/09).
  const ok_ = await clicar(page, `[data-conversa-nome="${nome}"]`);
  await page.waitForTimeout(700);
  return ok_;
}

/** O menu do responsável da conversa aberta: abre, lê quem é oferecido e fecha. */
async function quemPassarPara(page) {
  if (!(await clicar(page, "button[data-responsavel-da-conversa]"))) return { aberto: false, ids: [], origem: "" };
  const aberto = await page.locator("[data-menu-responsavel]").isVisible().catch(() => false);
  const ids = await valores(page, "data-passar-para", "[data-menu-responsavel]");
  const origem = await texto(page, "[data-responsavel-origem]");
  const assumir = (await page.locator("[data-menu-responsavel] [data-assumir-conversa]").count()) > 0;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  return { aberto, ids, origem, assumir };
}

/** O seletor de responsáveis: abre, lê as opções (e quais estão marcadas). */
async function opcoesDoSeletor(page, { fechar = true } = {}) {
  if (!(await page.locator("[data-menu-responsaveis]").count())) {
    if (!(await clicar(page, "[data-responsaveis-botao]"))) return { aberto: false, ids: [], marcados: [] };
  }
  const aberto = await page.locator("[data-menu-responsaveis]").isVisible().catch(() => false);
  const ids = await valores(page, "data-responsavel-opcao", "[data-menu-responsaveis]");
  const marcados = await page.evaluate(() => [...document.querySelectorAll("[data-menu-responsaveis] [data-responsavel-opcao]")]
    .filter((el) => el.getAttribute("aria-selected") === "true").map((el) => el.getAttribute("data-responsavel-opcao")));
  if (fechar) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); }
  return { aberto, ids, marcados };
}

/** A janela da tarefa nova, aberta pelo menu de tarefas da conversa: as opções de "para quem". */
async function paraQuemDaTarefa(page, { editar = null } = {}) {
  if (!(await clicar(page, "[data-tarefa-da-conversa]"))) return { aberto: false, opcoes: [] };
  if (editar) await clicar(page, `[data-editar-tarefa="${editar}"]`);
  else await clicar(page, "[data-nova-tarefa]");
  const aberto = (await page.locator("[data-janela-tarefa]").count()) > 0;
  const opcoes = await page.evaluate(() => [...document.querySelectorAll("[data-tarefa-para-quem] option")]
    .map((o) => ({ valor: o.value, texto: o.textContent.trim() })));
  const escolhido = await page.evaluate(() => document.querySelector("[data-tarefa-para-quem]")?.value ?? null);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if (await page.locator("[data-janela-tarefa]").count()) {
    // Sem o Esc da janela, fecha pelo fundo.
    await page.mouse.click(5, 5);
    await page.waitForTimeout(300);
  }
  return { aberto, opcoes, escolhido };
}

// ------------------------------------------------------------------
console.log("\n1. Com o 047: quem saiu não é oferecido para escolher");
{
  const { ctx, page, estouros } = await abrirPainel({ ativa: false });
  ok("a conversa em que ela escreveu abre", await abrirConversa(page, C_ESCREVEU.nome));

  // O NOME NA MENSAGEM DELA — é história.
  const bolha = await texto(page, '[data-msg-id="m-saiu-dela"]');
  ok("o nome dela continua na mensagem que ela escreveu", bolha.includes(NOME_DELA), bolha);

  // "PASSAR PARA"
  const passar = await quemPassarPara(page);
  ok("o menu do responsável abre", passar.aberto);
  ok("e oferece as colegas que estão no escritório (o contraste)",
     passar.ids.includes(JEN) && passar.ids.includes(ISA), JSON.stringify(passar.ids));
  ok("e NÃO oferece quem saiu", !passar.ids.includes(SAIU), JSON.stringify(passar.ids));

  // O "PARA QUEM" DA TAREFA NOVA
  const nova = await paraQuemDaTarefa(page);
  ok("a janela da tarefa nova abre", nova.aberto);
  const valoresNova = nova.opcoes.map((o) => o.valor);
  ok("e oferece eu e as colegas que estão no escritório",
     valoresNova.includes(EU) && valoresNova.includes(JEN) && valoresNova.includes(ISA), JSON.stringify(valoresNova));
  ok("e NÃO oferece quem saiu", !valoresNova.includes(SAIU), JSON.stringify(nova.opcoes));

  // A TAREFA DELA, aberta para editar: diz que é de quem não está mais na
  // equipe, e não some nem passa calada para outra pessoa.
  const dela = await paraQuemDaTarefa(page, { editar: "tf-saiu" });
  ok("a tarefa dela abre para editar", dela.aberto);
  ok("e continua sendo dela", dela.escolhido === SAIU, String(dela.escolhido));
  const opcaoDela = dela.opcoes.find((o) => o.valor === SAIU);
  ok("com a frase de quem não está mais na equipe, e não o nome oferecido como colega",
     !!opcaoDela && /não está mais na equipe/.test(opcaoDela.texto), JSON.stringify(dela.opcoes));

  // O SELETOR DE RESPONSÁVEIS
  const sel = await opcoesDoSeletor(page);
  ok("o seletor de responsáveis abre", sel.aberto);
  ok("e oferece você, as colegas e \"Sem responsável\"",
     sel.ids.includes("sem") && sel.ids.includes(EU) && sel.ids.includes(JEN) && sel.ids.includes(ISA),
     JSON.stringify(sel.ids));
  ok("e NÃO oferece quem saiu", !sel.ids.includes(SAIU), JSON.stringify(sel.ids));

  // A CONVERSA QUE AINDA ESTÁ COM ELA
  ok("a conversa que ficou com ela abre", await abrirConversa(page, C_COM_ELA.nome));
  ok("e diz que está com ela", (await attr(page, "[data-responsavel-da-conversa]", "data-responsavel-da-conversa")) === SAIU,
     String(await attr(page, "[data-responsavel-da-conversa]", "data-responsavel-da-conversa")));
  const comEla = await quemPassarPara(page);
  ok("o menu diz desde quando é dela — o nome é história", comEla.origem.includes(NOME_DELA), comEla.origem);
  ok("e oferece Assumir", comEla.assumir);
  ok("e Passar para as colegas, sem ela", comEla.ids.includes(JEN) && !comEla.ids.includes(SAIU), JSON.stringify(comEla.ids));

  ok("sem a faixa âmbar", (await page.locator("[data-falha-de-leitura]").count()) === 0,
     await texto(page, "[data-falha-de-leitura]"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. O banco sem o 047: a lista é lida de novo, e todo mundo pode ser escolhido");
{
  const { ctx, page, estouros } = await abrirPainel({ ativa: false, sem047: true });
  ok("a conversa abre", await abrirConversa(page, C_ESCREVEU.nome));
  const bolha = await texto(page, '[data-msg-id="m-saiu-dela"]');
  ok("o nome dela continua na mensagem", bolha.includes(NOME_DELA), bolha);
  const passar = await quemPassarPara(page);
  ok("a lista da equipe chegou: as colegas são oferecidas", passar.ids.includes(JEN) && passar.ids.includes(ISA),
     JSON.stringify(passar.ids));
  ok("e ela também — o banco não sabe quem saiu", passar.ids.includes(SAIU), JSON.stringify(passar.ids));
  const sel = await opcoesDoSeletor(page);
  ok("no seletor também", sel.ids.includes(SAIU) && sel.ids.includes(JEN), JSON.stringify(sel.ids));
  ok("sem a faixa âmbar: a coluna que falta não é falha", (await page.locator("[data-falha-de-leitura]").count()) === 0,
     await texto(page, "[data-falha-de-leitura]"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Quem sai no meio do dia: a renovação da sessão relê a equipe");
{
  const { ctx, page, estouros } = await abrirPainel({ ativa: true });
  ok("a conversa abre", await abrirConversa(page, C_ESCREVEU.nome));
  const antes = await quemPassarPara(page);
  ok("enquanto ela está no escritório, é oferecida (o contraste)", antes.ids.includes(SAIU), JSON.stringify(antes.ids));

  // ESCOLHO VOCÊ E ELA no seletor: a conversa aberta é minha e continua na lista.
  await opcoesDoSeletor(page, { fechar: false });
  await clicar(page, `[data-menu-responsaveis] [data-responsavel-opcao="${EU}"]`);
  await clicar(page, `[data-menu-responsaveis] [data-responsavel-opcao="${SAIU}"]`);
  const escolhidos = await opcoesDoSeletor(page);
  ok("escolhi você e ela no seletor", escolhidos.marcados.includes(EU) && escolhidos.marcados.includes(SAIU),
     JSON.stringify(escolhidos.marcados));

  // ELA SAI: o banco a desliga, e a sessão se renova (a renovação de hora em
  // hora da biblioteca, que troca o objeto da sessão).
  await page.evaluate((id) => {
    const u = (globalThis.__TABELAS.usuarios || []).find((x) => String(x.id) === id);
    if (u) u.ativo = false;
    globalThis.__ENTRADA_DA_BIBLIOTECA("u1");
  }, SAIU);
  await page.waitForTimeout(1800);

  const depois = await quemPassarPara(page);
  ok("a conversa aberta continua aberta", depois.aberto, JSON.stringify(depois));
  ok("e ela deixa de ser oferecida em Passar para", !depois.ids.includes(SAIU) && depois.ids.includes(JEN),
     JSON.stringify(depois.ids));

  const ainda = await opcoesDoSeletor(page, { fechar: false });
  ok("no seletor ela continua, MARCADA, porque está escolhida", ainda.marcados.includes(SAIU), JSON.stringify(ainda));
  await clicar(page, `[data-menu-responsaveis] [data-responsavel-opcao="${SAIU}"]`);
  const desmarcada = await opcoesDoSeletor(page);
  ok("e, desmarcada, ela sai do seletor", !desmarcada.ids.includes(SAIU), JSON.stringify(desmarcada.ids));
  ok("e você continua escolhido", desmarcada.marcados.includes(EU), JSON.stringify(desmarcada.marcados));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
if (falhas) { console.log(`${falhas} FALHA(S).`); process.exit(1); }
