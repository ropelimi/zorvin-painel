// O ACOMPANHAMENTO POR ETAPA (02/11) — pedido do Rodrigo: "acompanhamento por
// etapa do funil", com a escolha "Lembrar a equipe". Quando um cliente fica
// parado numa etapa sem responder, quem cuida dele recebe uma tarefa com a
// mensagem de cobrança já escrita, abre, confere e manda. Quem decide QUANDO o
// lembrete nasce é o banco (script 045 da ponte, `zorvin_acompanhar_funil`,
// com as conferências nas seções 93 e 94 da prova de lá); aqui fica o que a
// TELA faz.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. sem o 045 nada aparece — nem a dica, nem os lembretes das etapas, nem o
//      botão da mensagem pronta —, e nada quebra;
//   2. escrever uma regra grava a etapa, os dias e o texto COM AS VARIÁVEIS
//      (nunca preenchido); a variável entra onde está o cursor; a prévia e o
//      aviso da variável desconhecida aparecem; a tela confere dias e texto, e
//      o erro aparece AO LADO do botão; editar e apagar gravam; a recusa do
//      banco, calada ou com código, é dita; o Esc fecha só o formulário; a
//      etapa desativada não tem lembretes;
//   3. a leitura das regras que falha é DITA, com o código, e os lembretes não
//      são desenhados vazios; "Tentar de novo" os traz;
//   4. o funil próprio de um telefone tem os lembretes das etapas dele, e o
//      telefone que usa o funil do departamento não tem nenhum;
//   5. na tela de Tarefas, o lembrete diz que é automático e mostra a mensagem
//      pronta; o botão abre a conversa com a mensagem na caixa, PREENCHIDA
//      (o nome do alto da conversa, a saudação pela hora) e sem mandar nada;
//      o cliente que escreveu por último é dito; o grupo não ganha nome; a
//      conversa de outro telefone troca o telefone; o lembrete que se fechou
//      sozinho diz isso;
//   6. a caixa que já tem texto pergunta antes de trocar, e "não" guarda o que
//      estava escrito;
//   7. na conversa aberta, a nota vira mensagem, e uma edição em curso não é
//      trocada;
//   8. a conversa que não abre não fica com a mensagem esperando na caixa;
//   9. no celular, o botão do menu de tarefas da conversa funciona.
//
// O RELÓGIO É FIXADO (`page.clock`), no fuso de São Paulo, às 9h de uma
// terça: a saudação depende da hora — a régua de
// `as-variaveis-das-respostas-rapidas`.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.parse("2026-11-03T09:00:00-03:00");
const iso = (ms) => new Date(ms).toISOString();
const antes = (min) => iso(AGORA - min * 60e3);

/** O telefone que o painel ABRE, o departamento dele, e um SEGUNDO telefone
 *  — descobertos, e não escolhidos a dedo. */
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
    const outro = a && advs.find((x) => x.ativo !== false && String(x.id) !== String(a.id));
    return a && outro ? { adv: a.id, dep: a.departamento_id, adv2: outro.id } : null;
  });
  await ctx.close();
  return r;
}
const ABRE = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre, e um segundo", Boolean(ABRE), JSON.stringify(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, dep: DEP, adv2: ADV2 } = ABRE;
const ET = (n) => `et-${DEP}-${n}`;   // as etapas que a bancada semeia, como o 017

// OS CLIENTES. A Joana escreveu por último ("ok, mando amanhã"); com o Renato
// fomos nós; o grupo tem nome, e o nome não pode ir num "{nome}"; o Otávio
// fala por OUTRO telefone. A conversa da Joana tem uma mensagem nossa de dois
// minutos atrás — dentro do prazo do WhatsApp para editar.
const NOMES = { j: "JOANA PEREIRA DA SILVA", r: "RENATO ALVES COSTA", g: "Mutirão de Teste", o: "OTÁVIO LIMA" };
const NUM = { j: "5511970045501", r: "5511970045502", g: "grupo:120363999000000777", o: "5511970045504" };
const contato = (k) => ({ id: `ct-ac${k}`, numero: NUM[k], nome: NOMES[k], vantoro_nome: null,
                          nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k, adv, min) => ({
  id: `cv-ac${k}`, advogado_id: adv, contato_id: `ct-ac${k}`, nao_lidas: 0, arquivada: false,
  fixada: false, favorita: false, ultima_atividade: antes(min), ultima_mensagem: "…",
  esperando_desde: null, tratada_em: null, frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-ac${k}`, nome: NOMES[k], numero: NUM[k], foto_url: null },
});
const msg = (id, cv, origem, texto, min, extra = {}) => ({
  id, conversa_id: cv, origem, tipo: "texto", texto, id_uazapi: `uz-${id}`, criado_em: antes(min), ...extra,
});
const NOSSA = { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "enviada" };
const TEXTO_DO_LEMBRETE = "Acompanhar o cliente em “Aguardando cliente” (lembrete de 3 dias).";
const lembrete = (id, k, mensagem, extra = {}) => ({
  id, conversa_id: `cv-ac${k}`, texto: TEXTO_DO_LEMBRETE, mensagem, vence_em: antes(30), para_quem: "u1",
  criada_por: null, criada_em: antes(31), feita_em: null, feita_por: null, ...extra,
});
const MSG = {
  j: "{saudacao}, {nome}! Conseguiu ver a proposta que mandamos?",
  r: "Oi {nome}, tudo certo por aí?",
  g: "{saudacao}, {nome}! Alguma novidade do mutirão?",
  o: "Olá, {nome}!",
};
const ESPERADO = {
  j: "Bom dia, Joana! Conseguiu ver a proposta que mandamos?",
  r: "Oi Renato, tudo certo por aí?",
  g: "Bom dia! Alguma novidade do mutirão?",
  o: "Olá, Otávio!",
};
const SEMENTE = {
  contatos: ["j", "r", "g", "o"].map(contato),
  conversas: [conversa("j", ADV, 1), conversa("r", ADV, 2), conversa("g", ADV, 3), conversa("o", ADV2, 4)],
  mensagens: [
    msg("m-acj-nossa", "cv-acj", "advogado", "Mandei a proposta, dá uma olhada.", 2, NOSSA),
    msg("m-acj-cliente", "cv-acj", "contato", "ok, mando amanhã", 1),
    msg("m-acr-cliente", "cv-acr", "contato", "Bom dia", 5),
    msg("m-acr-nossa", "cv-acr", "advogado", "Bom dia! Vou conferir e já retorno.", 2, NOSSA),
    msg("m-acg", "cv-acg", "contato", "oi pessoal", 3),
    msg("m-aco", "cv-aco", "contato", "oi", 4),
  ],
  zorvin_tarefas: [
    lembrete("t-acj", "j", MSG.j),
    lembrete("t-acr", "r", MSG.r),
    lembrete("t-acg", "g", MSG.g),
    lembrete("t-aco", "o", MSG.o),
    // O QUE SE FECHOU SOZINHO: o Zorvin criou, e terminou sem quem fez.
    lembrete("t-acfeito", "r", "Ainda precisa de ajuda?", { feita_em: antes(120) }),
    // E O QUE UMA PESSOA CONCLUIU: um lembrete, mas feito por gente.
    lembrete("t-acfeito-gente", "j", "Deu certo?", { feita_em: antes(90), feita_por: "u1" }),
    // AS DE GENTE: sem mensagem pronta, e com quem criou.
    { id: "t-pessoa", conversa_id: "cv-acr", texto: "Ligar para o Renato", vence_em: antes(10), para_quem: "u1",
      criada_por: "u1", criada_em: antes(600), feita_em: null, feita_por: null, mensagem: null },
    { id: "t-pessoa-feita", conversa_id: "cv-acr", texto: "Mandar o boleto", vence_em: antes(200), para_quem: "u1",
      criada_por: "u1", criada_em: antes(600), feita_em: antes(100), feita_por: "u1", mensagem: null },
  ],
};
const SEMENTE_DO_TELEFONE = {
  ...SEMENTE,
  zorvin_funis: [{ id: "fn-tel", departamento_id: DEP, advogado_id: ADV, ativo: true, ia_ligada: false }],
};

async function abrirPainel({ semente = SEMENTE, semAcompanhamento = false, recusarLeitura = [], largura = 1920 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  const dialogos = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // A RESPOSTA ÀS PERGUNTAS DA TELA (`window.confirm`) é escolhida por cena.
  page.__responder = "aceitar";
  page.on("dialog", (d) => {
    dialogos.push(d.message());
    if (page.__responder === "aceitar") d.accept(); else d.dismiss();
  });
  await page.clock.setFixedTime(new Date(AGORA));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_ACOMPANHAMENTO = d.semAcompanhamento;
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__SOU_ADMIN = true;
    try { localStorage.setItem("zorvin_ficha_fixa", "nao"); } catch (_) { /* sem armazenamento */ }
    // OS LEMBRETES NA TELA DAS ETAPAS, vigiados a cada mudança do documento
    // (e não de tempos em tempos): num banco sem o 045 eles não podem aparecer
    // nem por um instante. A bancada responde "a tabela não existe" na hora, e
    // o piscar dura um desenho só — um relógio de 20 ms não o veria. O
    // documento existe desde já, e é nele que se vigia: o `<html>` ainda não.
    globalThis.__VIU_LEMBRETES = false;
    new MutationObserver(() => {
      if (!globalThis.__VIU_LEMBRETES && document.querySelector("[data-acomp-novo], [data-dica-do-acompanhamento]")) {
        globalThis.__VIU_LEMBRETES = true;
      }
    }).observe(document, { childList: true, subtree: true });
    // A NOTIFICAÇÃO É ESPIONADA, e não desligada.
    globalThis.__NOTIFICACOES = [];
    globalThis.Notification = class {
      constructor(titulo, opc) { globalThis.__NOTIFICACOES.push({ titulo, corpo: opc && opc.body }); }
      static get permission() { return "granted"; }
      static requestPermission() { return Promise.resolve("granted"); }
    };
    // O FILME DOS AVISOS, e não a foto: a faixa mostra uma frase por vez.
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { semente, semAcompanhamento, recusarLeitura });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    // SEM VANTORO: a ficha fixa estreitaria a conversa sem nada a ver com isto.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  if (semente === SEMENTE_DO_TELEFONE) {
    // As etapas do funil do telefone, copiadas das do departamento (o que o
    // 043 faz ao criar), plantadas por cima das que a bancada semeia.
    await page.evaluate(({ dep, adv }) => {
      const base = (globalThis.__TABELAS.zorvin_etapas || []).filter((e) => String(e.departamento_id) === String(dep) && !e.advogado_id);
      base.forEach((e, i) => globalThis.__TABELAS.zorvin_etapas.push({ ...e, id: `et-tel-${i + 1}`, advogado_id: adv }));
    }, { dep: DEP, adv: ADV });
  }
  return { ctx, page, estouros, dialogos };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
/** `fill` GUARDADO, pela mesma razão. */
async function preencher(loc, valor) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(valor, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
const valor = async (loc) => ((await loc.count()) ? loc.first().inputValue().catch(() => null) : null);
async function abrirAdmin(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu", exact: true })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(1500);
  return true;
}
async function escolherFunil(page, chave) {
  await page.locator("[data-etapas-departamento]").selectOption(chave).catch(() => {});
  await page.waitForTimeout(900);
}
const blocoDa = (page, etapa) => page.locator(`[data-acompanhamento-da-etapa="${etapa}"]`);
const regras = (page) => page.evaluate(() => (globalThis.__TABELAS.zorvin_acompanhamentos || []).map((r) => ({ ...r })));
const erroDoBloco = (page, etapa) => texto(blocoDa(page, etapa).locator("[data-acomp-erro]"));
async function abrirTarefas(page) {
  if (!(await clicar(page.locator("[data-abrir-tarefas]")))) return false;
  await page.waitForTimeout(1300);
  return (await page.locator('[data-tela="tarefas"]').count()) === 1;
}
async function abrirConversa(page, k) {
  await clicar(page.locator(`[data-conversa-id="cv-ac${k}"]`));
  await page.waitForTimeout(1200);
}
/** Abre o menu das tarefas da conversa SÓ se estiver fechado. */
async function menuDasTarefas(page) {
  if (await page.locator("[data-menu-tarefas]").isVisible().catch(() => false)) return true;
  const r = await clicar(page.locator("[data-tarefa-da-conversa]"));
  await page.waitForTimeout(400);
  return r;
}
/** O que a caixa de escrever mostra: o modo, o texto e a dica. */
const caixa = (page) => page.evaluate(() => {
  const c = document.querySelector("[data-campo]");
  return c ? { modo: c.getAttribute("data-campo"), texto: c.value, dica: c.getAttribute("placeholder") || "" } : null;
});
const topo = (page) => texto(page.locator("[data-topo-conversa]"));
const filme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));
const zerarFilme = (page) => page.evaluate(() => { globalThis.__AVISOS_VISTOS = []; });
/** A FAIXA DE ANTES SUMIR, antes de conferir que um gesto NÃO avisou: o aviso
 *  do gesto anterior dura oito segundos, e o filme o leria de novo. */
const esperarAFaixaSumir = (page) => page.waitForFunction(() => {
  const el = document.querySelector("[data-aviso]");
  return !el || !el.innerText.trim();
}, null, { timeout: 15000 }).catch(() => {});
const fila = (page) => page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).length);
const notas = (page) => page.evaluate(() => (globalThis.__TABELAS.notas || []).length);
const ESCREVEU_POR_ULTIMO = /O cliente escreveu por último: leia a conversa antes de mandar a mensagem do lembrete/;

// ------------------------------------------------------------------
console.log("\n1. Sem o 045, nada aparece, e nada quebra");
{
  const { ctx, page, estouros } = await abrirPainel({ semAcompanhamento: true });
  ok("abriu a administração", await abrirAdmin(page));
  await escolherFunil(page, String(DEP));
  await page.waitForTimeout(1200);
  ok("a seção das etapas está lá", (await page.locator("[data-etapas-do-funil]").count()) === 1);
  ok("sem a dica dos lembretes", (await page.locator("[data-dica-do-acompanhamento]").count()) === 0);
  ok("e sem lembretes nas etapas", (await page.locator("[data-acomp-novo]").count()) === 0);
  ok("nem por um instante, enquanto a pergunta não voltava", (await page.evaluate(() => globalThis.__VIU_LEMBRETES)) === false);
  await clicar(page.locator('button[aria-label="Fechar"]'));
  await page.waitForTimeout(600);
  ok("a tela de tarefas abre", await abrirTarefas(page));
  ok("e mostra as tarefas", (await page.locator('[data-tarefa-da-tela="t-acj"]').count()) === 1);
  ok("sem o botão da mensagem pronta", (await page.locator("[data-usar-mensagem-pronta]").count()) === 0);
  ok("nem o selo de lembrete automático", (await page.locator("[data-lembrete-automatico]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Escrever, conferir, editar e apagar um lembrete");
{
  const { ctx, page, estouros, dialogos } = await abrirPainel();
  // A ETAPA DESATIVADA e uma regra que JÁ EXISTE no banco (com a conta de
  // antes), plantadas antes de abrir a administração.
  await page.evaluate((d) => {
    const t = globalThis.__TABELAS;
    t.zorvin_etapas.find((e) => e.id === d.encerrado).ativo = false;
    t.zorvin_acompanhamentos.push({ id: "ac-velha", etapa_id: d.proposta, dias: 10, texto: "Seguimos à disposição.",
      criado_em: "2026-10-01T12:00:00Z", criado_por: "u-jenifer", vale_desde: "2026-10-01T12:00:00Z",
      mudado_em: null, mudado_por: null });
  }, { encerrado: ET(7), proposta: ET(4) });
  ok("abriu a administração", await abrirAdmin(page));
  await escolherFunil(page, String(DEP));
  ok("a dica diz que nada sai sozinho", /nada sai para o cliente sozinho/.test(await texto(page.locator("[data-dica-do-acompanhamento]"))));
  ok("cada etapa EM USO oferece um lembrete", (await page.locator("[data-acomp-novo]").count()) === 6,
     String(await page.locator("[data-acomp-novo]").count()));
  ok("a desativada não", (await blocoDa(page, "Encerrado").count()) === 0);
  // E O VIGIA DA CENA 1 VÊ: com o 045 os lembretes aparecem, e ele diz que
  // viu. Sem isto, um vigia que nunca dispara aprovaria qualquer piscar.
  ok("o vigia do piscar vê os lembretes quando eles existem", (await page.evaluate(() => globalThis.__VIU_LEMBRETES)) === true);
  ok("o lembrete que já existe aparece na etapa dele",
     /Depois de 10 dias sem resposta do cliente.*Seguimos à disposição/s.test(await texto(blocoDa(page, "Proposta/acordo enviado"))),
     await texto(blocoDa(page, "Proposta/acordo enviado")));

  const bloco = blocoDa(page, "Aguardando cliente");
  ok("abriu o formulário", await clicar(bloco.locator("[data-acomp-novo]")));
  ok("começa em 3 dias", (await valor(bloco.locator("[data-acomp-dias]"))) === "3");
  // A VARIÁVEL ENTRA ONDE ESTÁ O CURSOR: o texto já tem o fim, e o nome vai
  // depois de "Olá, ".
  await preencher(bloco.locator("[data-acomp-texto]"), "Olá, ! Conseguiu ver a proposta?");
  await bloco.locator("[data-acomp-texto]").evaluate((c) => { c.focus(); c.setSelectionRange(5, 5); }).catch(() => {});
  await clicar(bloco.locator('[data-acomp-variavel="nome"]'));
  await page.waitForTimeout(200);
  ok("a variável entra onde está o cursor", (await valor(bloco.locator("[data-acomp-texto]"))) === "Olá, {nome}! Conseguiu ver a proposta?",
     String(await valor(bloco.locator("[data-acomp-texto]"))));
  ok("a prévia preenche com a cliente de exemplo", (await texto(bloco.locator("[data-acomp-previa-texto]"))) === "Olá, Maria! Conseguiu ver a proposta?",
     await texto(bloco.locator("[data-acomp-previa-texto]")));
  await preencher(bloco.locator("[data-acomp-texto]"), "Olá, {nome}! Conseguiu ver a proposta? {processo}");
  ok("a variável que o Zorvin não conhece é avisada", /\{processo\}.*com as chaves/s.test(await texto(bloco.locator("[data-acomp-variavel-desconhecida]"))),
     await texto(bloco.locator("[data-acomp-variavel-desconhecida]")));
  await preencher(bloco.locator("[data-acomp-texto]"), "Olá, {nome}! Conseguiu ver a proposta?");
  ok("e o aviso some quando ela sai", (await bloco.locator("[data-acomp-variavel-desconhecida]").count()) === 0);
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(900);
  const r1 = (await regras(page)).find((r) => r.etapa_id === ET(3));
  ok("gravou a etapa, os dias e o texto", r1 && Number(r1.dias) === 3 && r1.etapa_id === ET(3), JSON.stringify(r1));
  ok("o texto vai COM A VARIÁVEL, e não preenchido", r1 && r1.texto === "Olá, {nome}! Conseguiu ver a proposta?", JSON.stringify(r1));
  ok("e o banco anotou quem criou", r1 && r1.criado_por === "u1" && Boolean(r1.vale_desde), JSON.stringify(r1));
  ok("o formulário fechou, e a regra aparece na etapa",
     (await bloco.locator("[data-acomp-formulario]").count()) === 0
     && /Depois de 3 dias sem resposta do cliente/.test(await texto(bloco.locator('[data-regra-de-acompanhamento="3"]'))));

  // A TELA CONFERE, e o erro aparece AO LADO DO BOTÃO — à vista.
  await clicar(bloco.locator("[data-acomp-novo]"));
  await preencher(bloco.locator("[data-acomp-dias]"), "0");
  await preencher(bloco.locator("[data-acomp-texto]"), "Alguma novidade?");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(400);
  ok("zero dias não vale, e o erro diz por quê", /Os dias vão de 1 a 60/.test(await erroDoBloco(page, "Aguardando cliente")),
     await erroDoBloco(page, "Aguardando cliente"));
  ok("e o erro está à vista, ao lado do botão", await bloco.locator("[data-acomp-erro]").isVisible().catch(() => false));
  await preencher(bloco.locator("[data-acomp-dias]"), "61");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(300);
  ok("61 dias também não", /Os dias vão de 1 a 60/.test(await erroDoBloco(page, "Aguardando cliente")));
  await preencher(bloco.locator("[data-acomp-dias]"), "3");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(300);
  ok("os mesmos dias na mesma etapa, não", /Já existe um lembrete de 3 dias nesta etapa/.test(await erroDoBloco(page, "Aguardando cliente")));
  await preencher(bloco.locator("[data-acomp-dias]"), "5");
  await preencher(bloco.locator("[data-acomp-texto]"), "   ");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(300);
  ok("sem mensagem, não", /Escreva a mensagem pronta/.test(await erroDoBloco(page, "Aguardando cliente")));
  ok("e nada disso gravou", (await regras(page)).filter((r) => r.etapa_id === ET(3)).length === 1);
  // O ESC FECHA SÓ O FORMULÁRIO, e não a administração.
  await bloco.locator("[data-acomp-texto]").press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  ok("o Esc fecha o formulário", (await bloco.locator("[data-acomp-formulario]").count()) === 0);
  ok("e a administração continua aberta", (await page.locator("[data-etapas-do-funil]").count()) === 1);

  // OS MESMOS DIAS CRIADOS POR OUTRA PESSOA NO MEIO: o banco recusa (23505).
  await page.evaluate((et) => globalThis.__TABELAS.zorvin_acompanhamentos.push({ id: "ac-outra", etapa_id: et, dias: 7,
    texto: "Escrito por outra pessoa", criado_em: "2026-11-03T11:59:00Z", criado_por: "u-jenifer",
    vale_desde: "2026-11-03T11:59:00Z", mudado_em: null, mudado_por: null }), ET(3));
  await clicar(bloco.locator("[data-acomp-novo]"));
  await preencher(bloco.locator("[data-acomp-dias]"), "7");
  await preencher(bloco.locator("[data-acomp-texto]"), "E aí, deu certo?");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(800);
  ok("a recusa do banco pelos mesmos dias é dita", /Já existe um lembrete de 7 dias nesta etapa/.test(await erroDoBloco(page, "Aguardando cliente")),
     await erroDoBloco(page, "Aguardando cliente"));
  ok("e não gravou um segundo de 7 dias", (await regras(page)).filter((r) => r.etapa_id === ET(3) && Number(r.dias) === 7).length === 1);
  await clicar(bloco.locator("[data-acomp-cancelar]"));
  await page.waitForTimeout(300);

  // EDITAR: a mesma linha, e mudar os dias recomeça a conta (o gatilho).
  const velha = blocoDa(page, "Proposta/acordo enviado");
  ok("o lápis abre a regra com o que ela tem", await clicar(velha.locator("[data-regra-editar]"))
     && (await valor(velha.locator("[data-acomp-dias]"))) === "10"
     && (await valor(velha.locator("[data-acomp-texto]"))) === "Seguimos à disposição.");
  await preencher(velha.locator("[data-acomp-texto]"), "Seguimos à disposição, {nome}.");
  await clicar(velha.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(800);
  const r2 = (await regras(page)).find((r) => r.id === "ac-velha");
  ok("editar só o texto grava na mesma linha", r2 && r2.texto === "Seguimos à disposição, {nome}." && Number(r2.dias) === 10, JSON.stringify(r2));
  ok("e a conta da regra continua a mesma", r2 && r2.vale_desde === "2026-10-01T12:00:00Z" && r2.criado_por === "u-jenifer", JSON.stringify(r2));
  await clicar(velha.locator("[data-regra-editar]"));
  await preencher(velha.locator("[data-acomp-dias]"), "12");
  await clicar(velha.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(800);
  const r3 = (await regras(page)).find((r) => r.id === "ac-velha");
  ok("mudar os dias grava, e recomeça a conta", r3 && Number(r3.dias) === 12 && r3.vale_desde !== "2026-10-01T12:00:00Z"
     && r3.mudado_por === "u1", JSON.stringify(r3));
  ok("e a tela relê", /Depois de 12 dias/.test(await texto(velha.locator('[data-regra-de-acompanhamento="12"]'))));
  ok("sem linha a mais", (await regras(page)).length === 3, String((await regras(page)).length));

  // A RECUSA CALADA (zero linhas) e a recusa com código são ditas.
  await page.evaluate(() => { globalThis.__ESCRITA_SEM_EFEITO = ["zorvin_acompanhamentos"]; });
  await clicar(velha.locator("[data-regra-editar]"));
  await preencher(velha.locator("[data-acomp-texto]"), "Outro texto");
  await clicar(velha.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(800);
  ok("a edição que o banco não deixou é dita", /Não salvou: o banco não deixou/.test(await erroDoBloco(page, "Proposta/acordo enviado")),
     await erroDoBloco(page, "Proposta/acordo enviado"));
  ok("e o formulário continua aberto, com o que foi escrito",
     (await valor(velha.locator("[data-acomp-texto]"))) === "Outro texto");
  await clicar(velha.locator("[data-acomp-cancelar]"));
  page.__responder = "aceitar";
  await clicar(velha.locator("[data-regra-apagar]"));
  await page.waitForTimeout(800);
  ok("apagar que o banco não deixou é dito", /Não apagou: o banco não deixou/.test(await erroDoBloco(page, "Proposta/acordo enviado")),
     await erroDoBloco(page, "Proposta/acordo enviado"));
  ok("e a regra continua", (await regras(page)).some((r) => r.id === "ac-velha"));
  await page.evaluate(() => {
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = { zorvin_acompanhamentos: { code: "42501", message: "permission denied for table zorvin_acompanhamentos" } };
  });
  await clicar(bloco.locator("[data-acomp-novo]"));
  await preencher(bloco.locator("[data-acomp-dias]"), "5");
  await preencher(bloco.locator("[data-acomp-texto]"), "Alguma novidade?");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(800);
  ok("a recusa com erro é dita, com o código", /Não consegui criar o lembrete.*42501/s.test(await erroDoBloco(page, "Aguardando cliente")),
     await erroDoBloco(page, "Aguardando cliente"));
  await clicar(bloco.locator("[data-acomp-cancelar]"));
  await page.evaluate(() => { globalThis.__ERRO_NA_GRAVACAO = {}; });

  // APAGAR pergunta antes, e diz que os lembretes que já nasceram ficam.
  const antesDeApagar = dialogos.length;
  await clicar(velha.locator("[data-regra-apagar]"));
  await page.waitForTimeout(800);
  ok("apagar pergunta antes, e diz que as tarefas ficam", dialogos.length === antesDeApagar + 1
     && /continuam nas tarefas/.test(dialogos[dialogos.length - 1] || ""), dialogos[dialogos.length - 1]);
  ok("e apaga", !(await regras(page)).some((r) => r.id === "ac-velha"));
  ok("e some da etapa", (await velha.locator("[data-regra-de-acompanhamento]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. A leitura das regras que falha é dita");
{
  const { ctx, page, estouros } = await abrirPainel({ recusarLeitura: ["zorvin_acompanhamentos"] });
  await abrirAdmin(page);
  await escolherFunil(page, String(DEP));
  const t = await texto(page.locator("[data-falha-dos-lembretes]"));
  ok("a falha é dita", /Não consegui ler os lembretes de acompanhamento/.test(t), t);
  ok("com o código", /PGRST301/.test(t), t);
  ok("e os lembretes não são desenhados vazios", (await page.locator("[data-acomp-novo]").count()) === 0);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await clicar(page.locator("[data-reler-lembretes]"));
  await page.waitForTimeout(800);
  ok("\"Tentar de novo\" traz os lembretes", (await page.locator("[data-falha-dos-lembretes]").count()) === 0
     && (await page.locator("[data-acomp-novo]").count()) === 7, String(await page.locator("[data-acomp-novo]").count()));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. O funil de cada telefone");
{
  const { ctx, page } = await abrirPainel();
  await abrirAdmin(page);
  await escolherFunil(page, `${DEP}|${ADV}`);
  ok("o telefone que usa o funil do departamento não tem lembretes",
     (await page.locator("[data-telefone-usa-o-do-departamento]").count()) === 1
     && (await page.locator("[data-acomp-novo]").count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ semente: SEMENTE_DO_TELEFONE });
  await abrirAdmin(page);
  await escolherFunil(page, `${DEP}|${ADV}`);
  ok("o funil próprio do telefone tem os lembretes das etapas dele", (await page.locator("[data-acomp-novo]").count()) === 7,
     String(await page.locator("[data-acomp-novo]").count()));
  const bloco = blocoDa(page, "Aguardando cliente");
  await clicar(bloco.locator("[data-acomp-novo]"));
  await preencher(bloco.locator("[data-acomp-texto]"), "Oi {nome}, conseguiu ver?");
  await clicar(bloco.locator("[data-acomp-salvar]"));
  await page.waitForTimeout(800);
  const r = (await regras(page))[0];
  ok("e o lembrete grava na etapa do telefone", r && r.etapa_id === "et-tel-3", JSON.stringify(r));
  await escolherFunil(page, String(DEP));
  ok("e não aparece no funil do departamento", (await page.locator("[data-regra-de-acompanhamento]").count()) === 0);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. O lembrete na tela de Tarefas, e a mensagem pronta na caixa");
{
  const { ctx, page, estouros } = await abrirPainel();
  const notifs = await page.evaluate(() => (globalThis.__NOTIFICACOES || []).map((n) => n.titulo));
  ok("o lembrete que venceu tocou para quem o recebeu", notifs.some((t) => t.includes(TEXTO_DO_LEMBRETE)), JSON.stringify(notifs));
  ok("a tela de tarefas abre", await abrirTarefas(page));
  const lj = page.locator('[data-tarefa-da-tela="t-acj"]');
  ok("o lembrete diz que é automático", (await lj.locator("[data-lembrete-automatico]").count()) === 1);
  ok("e mostra a mensagem pronta, como foi escrita", (await texto(lj.locator("[data-mensagem-pronta]"))).includes(MSG.j),
     await texto(lj.locator("[data-mensagem-pronta]")));
  const lp = page.locator('[data-tarefa-da-tela="t-pessoa"]');
  ok("a tarefa de gente não diz automático, nem tem o botão",
     (await lp.count()) === 1 && (await lp.locator("[data-lembrete-automatico]").count()) === 0
     && (await lp.locator("[data-usar-mensagem-pronta]").count()) === 0);
  await clicar(page.locator("[data-ver-feitas]"));
  await page.waitForTimeout(300);
  ok("o que se fechou sozinho diz isso",
     /fechou sozinho .*: a conversa andou/.test(await texto(page.locator('[data-tarefa-da-tela="t-acfeito"] [data-quando-da-tarefa]'))),
     await texto(page.locator('[data-tarefa-da-tela="t-acfeito"] [data-quando-da-tarefa]')));
  ok("e não oferece a mensagem", (await page.locator('[data-usar-mensagem-pronta="t-acfeito"]').count()) === 0);
  ok("o lembrete que uma pessoa concluiu diz \"feita\", e não \"sozinho\"",
     /^· feita /.test((await texto(page.locator('[data-tarefa-da-tela="t-acfeito-gente"] [data-quando-da-tarefa]'))).trim()),
     await texto(page.locator('[data-tarefa-da-tela="t-acfeito-gente"] [data-quando-da-tarefa]')));
  ok("a feita por gente continua dizendo \"feita\"",
     /^· feita /.test((await texto(page.locator('[data-tarefa-da-tela="t-pessoa-feita"] [data-quando-da-tarefa]'))).trim()),
     await texto(page.locator('[data-tarefa-da-tela="t-pessoa-feita"] [data-quando-da-tarefa]')));

  const naFila = await fila(page);
  await zerarFilme(page);
  ok("o botão está lá", await clicar(page.locator('[data-usar-mensagem-pronta="t-acj"]')));
  await page.waitForTimeout(1800);
  ok("a tela de tarefas fecha", (await page.locator('[data-tela="tarefas"]').count()) === 0);
  ok("e a conversa da Joana abre", (await topo(page)).includes(NOMES.j), await topo(page));
  const c1 = await caixa(page);
  ok("com a mensagem na caixa, PREENCHIDA", c1 && c1.texto === ESPERADO.j, JSON.stringify(c1));
  ok("na caixa de mensagem, e não na de nota", c1 && c1.modo === "mensagem", JSON.stringify(c1));
  ok("e nada foi mandado", (await fila(page)) === naFila, `${naFila} → ${await fila(page)}`);
  ok("o cliente que escreveu por último é dito", ESCREVEU_POR_ULTIMO.test(await filme(page)), await filme(page));

  // COM O RENATO, FOMOS NÓS POR ÚLTIMO: sem o aviso.
  await esperarAFaixaSumir(page);
  await abrirTarefas(page);
  await zerarFilme(page);
  await clicar(page.locator('[data-usar-mensagem-pronta="t-acr"]'));
  await page.waitForTimeout(1800);
  ok("a conversa do Renato abre com a mensagem dele", (await caixa(page))?.texto === ESPERADO.r, JSON.stringify(await caixa(page)));
  ok("e sem o aviso de quem escreveu por último", !ESCREVEU_POR_ULTIMO.test(await filme(page)), await filme(page));

  // O GRUPO não tem "o cliente": o nome sai, levando a vírgula.
  await abrirTarefas(page);
  await clicar(page.locator('[data-usar-mensagem-pronta="t-acg"]'));
  await page.waitForTimeout(1800);
  ok("no grupo, a mensagem sai sem nome", (await caixa(page))?.texto === ESPERADO.g, JSON.stringify(await caixa(page)));

  // A CONVERSA DE OUTRO TELEFONE: o telefone troca, e a mensagem vai junto.
  await abrirTarefas(page);
  await clicar(page.locator('[data-usar-mensagem-pronta="t-aco"]'));
  await page.waitForTimeout(2200);
  ok("a conversa de outro telefone abre", (await topo(page)).includes(NOMES.o), await topo(page));
  ok("com a mensagem dela na caixa", (await caixa(page))?.texto === ESPERADO.o, JSON.stringify(await caixa(page)));
  ok("e nada foi mandado em nenhuma das quatro", (await fila(page)) === naFila);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. A caixa que já tem texto pergunta antes de trocar");
{
  const { ctx, page, estouros, dialogos } = await abrirPainel();
  const ESCRITO = "Texto que eu estava escrevendo para o Renato";
  await abrirConversa(page, "r");
  await preencher(page.locator("[data-campo]"), ESCRITO);
  await abrirConversa(page, "j");   // o que estava escrito vira o rascunho do Renato
  ok("o rascunho do Renato ficou guardado", (await caixa(page))?.texto === "");
  await abrirTarefas(page);
  page.__responder = "recusar";
  const d0 = dialogos.length;
  await clicar(page.locator('[data-usar-mensagem-pronta="t-acr"]'));
  await page.waitForTimeout(1800);
  ok("a pergunta aparece", dialogos.length === d0 + 1 && /Trocar pela mensagem do lembrete/.test(dialogos[dialogos.length - 1] || ""),
     JSON.stringify(dialogos.slice(d0)));
  ok("\"não\": a conversa abre com o que estava escrito", (await topo(page)).includes(NOMES.r)
     && (await caixa(page))?.texto === ESCRITO, JSON.stringify(await caixa(page)));
  // DE NOVO, PELO MENU DE TAREFAS DA CONVERSA ABERTA, e agora "sim".
  page.__responder = "aceitar";
  ok("o menu de tarefas da conversa abre", await menuDasTarefas(page));
  const item = page.locator('[data-tarefa-da-conversa-item="t-acr"]');
  ok("o lembrete diz que é automático, ali também", (await item.locator("[data-lembrete-automatico]").count()) === 1);
  ok("e mostra a mensagem pronta", (await texto(item.locator("[data-mensagem-pronta]"))).includes(MSG.r));
  const d1 = dialogos.length;
  await clicar(item.locator("[data-usar-mensagem-pronta]"));
  await page.waitForTimeout(900);
  ok("pergunta de novo, e \"sim\" troca", dialogos.length === d1 + 1 && (await caixa(page))?.texto === ESPERADO.r,
     JSON.stringify(await caixa(page)));
  ok("e o menu fecha", !(await page.locator("[data-menu-tarefas]").isVisible().catch(() => false)));
  // COM A MESMA MENSAGEM JÁ NA CAIXA, não há o que perguntar.
  await menuDasTarefas(page);
  const d2 = dialogos.length;
  await clicar(page.locator('[data-tarefa-da-conversa-item="t-acr"] [data-usar-mensagem-pronta]'));
  await page.waitForTimeout(700);
  ok("com a mesma mensagem na caixa, não pergunta", dialogos.length === d2, JSON.stringify(dialogos.slice(d2)));
  // O LEMBRETE QUE SE FECHOU SOZINHO, no menu da conversa.
  await menuDasTarefas(page);
  ok("no menu, o que se fechou sozinho diz isso",
     /fechou sozinho .*: a conversa andou/.test(await texto(page.locator('[data-tarefa-da-conversa-item="t-acfeito"] [data-quando-da-tarefa]'))),
     await texto(page.locator('[data-tarefa-da-conversa-item="t-acfeito"] [data-quando-da-tarefa]')));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. Na conversa aberta: a nota vira mensagem, e a edição não é trocada");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirConversa(page, "j");
  await clicar(page.locator("[data-nota-interna]"));
  await page.waitForTimeout(300);
  ok("a caixa está na nota", (await caixa(page))?.modo === "nota", JSON.stringify(await caixa(page)));
  const nNotas = await notas(page);
  await menuDasTarefas(page);
  await clicar(page.locator('[data-tarefa-da-conversa-item="t-acj"] [data-usar-mensagem-pronta]'));
  await page.waitForTimeout(800);
  const c = await caixa(page);
  ok("a mensagem pronta vira MENSAGEM, e não nota", c && c.modo === "mensagem" && c.texto === ESPERADO.j, JSON.stringify(c));
  ok("e nenhuma nota foi gravada", (await notas(page)) === nNotas);
  // A EDIÇÃO EM CURSO: a cobrança não pode sair como correção.
  await preencher(page.locator("[data-campo]"), "");
  await page.locator('[data-msg-id="m-acj-nossa"]').hover().catch(() => {});
  await clicar(page.locator('[data-msg-id="m-acj-nossa"] button[aria-label="Opções da mensagem"]'));
  await page.waitForTimeout(250);
  ok("comecei a editar a nossa mensagem", await clicar(page.locator('div[data-menu-msg] button:has-text("Editar")')));
  await page.waitForTimeout(400);
  const editando = await caixa(page);
  ok("a caixa está na edição", editando && /Corrija a mensagem/.test(editando.dica), JSON.stringify(editando));
  await zerarFilme(page);
  await menuDasTarefas(page);
  await clicar(page.locator('[data-tarefa-da-conversa-item="t-acj"] [data-usar-mensagem-pronta]'));
  await page.waitForTimeout(600);
  ok("a edição não é trocada, e a tela diz por quê", /Termine ou cancele a edição/.test(await filme(page)), await filme(page));
  ok("a caixa continua com a edição", (await caixa(page))?.texto === editando?.texto, JSON.stringify(await caixa(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. A conversa que não abre não fica com a mensagem esperando");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirTarefas(page);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["conversas"]; });
  await zerarFilme(page);
  await clicar(page.locator('[data-usar-mensagem-pronta="t-aco"]'));
  await page.waitForTimeout(1500);
  ok("a falha ao abrir é dita", /Não consegui abrir esta conversa/.test(await filme(page)), await filme(page));
  ok("e o telefone não trocou", !(await topo(page)).includes(NOMES.o), await topo(page));
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await abrirTarefas(page);
  await clicar(page.locator('[data-tarefa-da-tela="t-aco"] [data-abrir-tarefa]'));
  await page.waitForTimeout(2200);
  ok("aberta depois, pelo caminho de sempre", (await topo(page)).includes(NOMES.o), await topo(page));
  ok("a caixa está vazia: nenhuma cobrança ficou esperando", (await caixa(page))?.texto === "", JSON.stringify(await caixa(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n9. No celular, pelo ⋮ da conversa");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 390 });
  await abrirConversa(page, "j");
  await clicar(page.locator('[aria-label="Mais opções desta conversa"]'));
  await page.waitForTimeout(300);
  await clicar(page.locator("[data-menu-tarefa-item]"));
  await page.waitForTimeout(500);
  const botao = page.locator('[data-tarefa-da-conversa-item="t-acj"] [data-usar-mensagem-pronta]');
  const caixaDoBotao = await botao.first().boundingBox().catch(() => null);
  ok("o botão aparece no menu de tarefas", Boolean(caixaDoBotao), JSON.stringify(caixaDoBotao));
  ok("com os 40 pontos de alvo de dedo", caixaDoBotao && caixaDoBotao.height >= 40, JSON.stringify(caixaDoBotao));
  ok("e cabe na tela", caixaDoBotao && caixaDoBotao.x >= 0 && caixaDoBotao.x + caixaDoBotao.width <= 390, JSON.stringify(caixaDoBotao));
  await clicar(botao);
  await page.waitForTimeout(800);
  ok("e põe a mensagem na caixa", (await caixa(page))?.texto === ESPERADO.j, JSON.stringify(await caixa(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
