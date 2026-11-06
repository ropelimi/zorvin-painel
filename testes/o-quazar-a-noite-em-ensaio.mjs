// O QUAZAR À NOITE, EM ENSAIO (06/11) — a metade do painel.
//
// Pedido do Rodrigo: o Quazar responde à noite quem escreve com o escritório
// fechado. Decidido com ele, começa por um ENSAIO: o cliente continua
// recebendo a mensagem pronta, e o Quazar escreve a resposta que daria, SEM
// ENVIAR. Quem escreve é a PONTE (script 055, provado lá num Postgres de
// verdade). O que esta prova guarda é o que é da tela:
//
//   1. na conversa, a resposta do ensaio aparece NO MEIO e tracejada, dizendo
//      que não foi enviada ao cliente — e não como uma bolha verde que saiu;
//   2. o "não responderia" diz o porquê;
//   3. "Boa" e "Ruim" gravam a avaliação; o mesmo botão desfaz; "Ruim" pede o
//      que estava errado; a recusa calada do banco é dita;
//   4. sem o 055, a conversa abre como antes, calada; a leitura que falha vai
//      para a faixa âmbar;
//   5. na aba Fora do horário, o modo do departamento (desligado ou ensaio) e
//      as respostas da semana, com as contas e o link que abre a conversa;
//   6. sem a coluna do 055, a seção não aparece; no celular, a bolha cabe.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const SEXTA_8H = new Date("2026-10-09T11:00:00Z");   // de manhã: a equipe lê o ensaio da noite
const AGORA = SEXTA_8H.getTime();
const iso = (minAtras) => new Date(AGORA - minAtras * 60000).toISOString();

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.count().then((n) => (n ? loc.first().innerText().catch(() => "") : ""));
const attr = (loc, a) => loc.count().then((n) => (n ? loc.first().getAttribute(a).catch(() => null) : null));

async function abrir({ semente = null, quebrar = null, sem = false, semEfeito = null, largura = 1400, altura = 900, celular = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo",
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__QUEBRAR = b.quebrar;
    globalThis.__SEM_ENSAIO_DO_QUAZAR = b.sem;
    globalThis.__ESCRITA_SEM_EFEITO = b.semEfeito;
  }, { semente, quebrar, sem, semEfeito });
  await page.clock.setFixedTime(SEXTA_8H);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** O telefone que o painel ABRE, e o departamento dele — descobertos. */
async function telefoneQueAbre() {
  const { ctx, page } = await abrir();
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (globalThis.__TABELAS.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    return a ? { adv: a.id, dep: a.departamento_id } : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre, e o departamento dele", Boolean(TEL && TEL.adv && TEL.dep != null), q(TEL));
const ADV = TEL && TEL.adv, DEP = TEL && TEL.dep;

const CONTATO = { id: "ct-noite", numero: "5511944440001", nome: "Cliente da Noite", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const PRONTA = { id: "qn-1", conversa_id: "cv-noite", status: "pronta", modo: "ensaio",
                 texto: "Boa noite! Sou o assistente virtual do escritório. A equipe volta amanhã às 8h e confere o seu processo.",
                 resumo: "Quer saber do andamento do processo.", motivo: null, avaliacao: null, comentario: null,
                 ate: iso(-60), cliente_ate: iso(600), cliente_ate_id: "m-noite-1", criada_em: iso(598), pronta_em: iso(598) };
const CALADA = { id: "qn-2", conversa_id: "cv-noite", status: "calada", modo: "ensaio", texto: null,
                 resumo: "Agradeceu.", motivo: "O cliente só agradeceu.", avaliacao: null, comentario: null,
                 ate: iso(-60), cliente_ate: iso(500), cliente_ate_id: "m-noite-2", criada_em: iso(498), pronta_em: iso(498) };
const PENSANDO = { ...PRONTA, id: "qn-3", status: "pensando", texto: "AINDA-SENDO-ESCRITA", cliente_ate_id: "m-noite-3",
                   criada_em: iso(10), pronta_em: null };
// UMA CONVERSA DE OUTRO DEPARTAMENTO, com a sua resposta de ensaio: a aba de um
// departamento não pode contá-la.
const OUTRO_ADV = DEP === 5 ? "a1" : "a7";
const CONTATO_OUTRO = { ...CONTATO, id: "ct-outro", numero: "5511944440002", nome: "Cliente de Outro Departamento" };
const DO_OUTRO = { ...PRONTA, id: "qn-9", conversa_id: "cv-outro", texto: "RESPOSTA-DE-OUTRO-DEPARTAMENTO", cliente_ate_id: "m-outro-1" };
const semente = ({ ensaios = [PRONTA, CALADA, PENSANDO, DO_OUTRO], fora = null } = {}) => ({
  contatos: [CONTATO, CONTATO_OUTRO],
  conversas: [{
    id: "cv-outro", advogado_id: OUTRO_ADV, contato_id: CONTATO_OUTRO.id, nao_lidas: 0, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: iso(700), esperando_desde: null, tratada_em: null,
    ultima_mensagem: "Oi", frente: null, digitando_ate: null, vantoro_nome: null, contato: CONTATO_OUTRO,
  }, {
    id: "cv-noite", advogado_id: ADV, contato_id: CONTATO.id, nao_lidas: 2, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: iso(500), esperando_desde: iso(600), tratada_em: null,
    ultima_mensagem: "Obrigado", frente: null, digitando_ate: null, vantoro_nome: null, contato: CONTATO,
  }],
  mensagens: [
    { id: "m-noite-1", conversa_id: "cv-noite", origem: "contato", tipo: "texto", texto: "Boa noite, como está meu processo?",
      id_uazapi: "uz-noite-1", criado_em: iso(600) },
    { id: "m-noite-2", conversa_id: "cv-noite", origem: "contato", tipo: "texto", texto: "Obrigado",
      id_uazapi: "uz-noite-2", criado_em: iso(500) },
  ],
  zorvin_quazar_noturno: ensaios,
  ...(fora ? { zorvin_fora_do_horario: fora } : {}),
});
const doBanco = (page, id) => page.evaluate((x) => (globalThis.__TABELAS.zorvin_quazar_noturno || []).find((l) => l.id === x) || null, id);

// ==================================================================
console.log("\n1. Na conversa, o ensaio aparece no meio, tracejado, e diz que não saiu");
{
  const { ctx, page, estouros } = await abrir({ semente: semente() });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1300);
  const pronta = page.locator('[data-ensaio-do-quazar="pronta"]');
  ok("a resposta do ensaio aparece na conversa", (await pronta.count()) === 1);
  ok("com o texto que o Quazar escreveu", /Sou o assistente virtual do escritório/.test(await texto(pronta)), q(await texto(pronta)));
  ok("dizendo que é o ensaio do Quazar e que não foi enviada ao cliente",
     /Ensaio do Quazar à noite/.test(await texto(pronta)) && /não foi enviada ao cliente/.test(await texto(pronta)), q(await texto(pronta)));
  ok("com o resumo para a equipe", /Para a equipe: Quer saber do andamento do processo\./.test(await texto(pronta)));
  ok("e o rosto do Quazar", (await pronta.locator("[data-rosto-do-assistente]").count()) === 1);
  const geo = await page.evaluate(() => {
    const b = document.querySelector('[data-ensaio-do-quazar="pronta"] > div')?.getBoundingClientRect();
    const lista = document.querySelector('[data-ensaio-do-quazar="pronta"]')?.getBoundingClientRect();
    const estilo = b && getComputedStyle(document.querySelector('[data-ensaio-do-quazar="pronta"] > div'));
    return b && lista ? { meio: b.left + b.width / 2, meioDaFaixa: lista.left + lista.width / 2, borda: estilo.borderTopStyle } : null;
  });
  ok("no MEIO da conversa (e não à direita, como o que saiu), e tracejada",
     geo && Math.abs(geo.meio - geo.meioDaFaixa) < 3 && geo.borda === "dashed", q(geo));
  const calada = page.locator('[data-ensaio-do-quazar="calada"]');
  ok("2. o \"não responderia\" aparece, com o porquê", (await calada.count()) === 1
     && /O Quazar não responderia: O cliente só agradeceu\./.test(await texto(calada)), q(await texto(calada)));
  ok("e pergunta se ficar calado foi certo", /Ficar calado foi certo\?/.test(await texto(calada)));
  ok("a que ainda está sendo escrita não aparece", !(await page.locator("body").innerText()).includes("AINDA-SENDO-ESCRITA"));
  ok("a prévia da lista continua sendo a do cliente", /Obrigado/.test(await texto(page.locator('[data-conversa-id="cv-noite"]'))));
  ok("nenhum estouro", estouros.length === 0, q(estouros));

  // ---- 3. avaliar ----
  ok("3. \"Boa\" está lá", await clicar(pronta.locator('[data-avaliar-ensaio="boa"]')));
  await page.waitForTimeout(500);
  ok("e grava a avaliação", (await doBanco(page, "qn-1"))?.avaliacao === "boa", q(await doBanco(page, "qn-1")));
  ok("e a bolha diz que foi marcada", (await attr(pronta, "data-ensaio-avaliacao")) === "boa"
     && (await attr(pronta.locator('[data-avaliar-ensaio="boa"]'), "aria-pressed")) === "true");
  await clicar(pronta.locator('[data-avaliar-ensaio="boa"]'));
  await page.waitForTimeout(500);
  ok("o mesmo botão de novo desfaz", (await doBanco(page, "qn-1"))?.avaliacao == null && (await attr(pronta, "data-ensaio-avaliacao")) === "",
     q(await doBanco(page, "qn-1")));
  await clicar(pronta.locator('[data-avaliar-ensaio="ruim"]'));
  await page.waitForTimeout(500);
  ok("\"Ruim\" grava, e pergunta o que estava errado", (await doBanco(page, "qn-1"))?.avaliacao === "ruim"
     && (await pronta.locator("[data-ensaio-comentario]").count()) === 1);
  const campo = pronta.locator("[data-ensaio-comentario]");
  if (await campo.count()) {
    await campo.fill("Prometeu que a equipe confere o processo, e quem confere é a atendente");
    await campo.press("Enter").catch(() => {});
  }
  await page.waitForTimeout(500);
  ok("o comentário vai para o banco", /quem confere é a atendente/.test((await doBanco(page, "qn-1"))?.comentario || ""), q(await doBanco(page, "qn-1")));
  ok("e fica escrito na bolha", /O que estava errado: Prometeu/.test(await texto(pronta.locator("[data-ensaio-comentario-guardado]"))));
  ok("a calada também se avalia", await clicar(calada.locator('[data-avaliar-ensaio="boa"]')));
  await page.waitForTimeout(500);
  ok("e grava", (await doBanco(page, "qn-2"))?.avaliacao === "boa");
  await ctx.close();
}

// ==================================================================
console.log("\n3b. A recusa calada do banco é dita");
{
  const { ctx, page } = await abrir({ semente: semente(), semEfeito: ["zorvin_quazar_noturno"] });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1300);
  const pronta = page.locator('[data-ensaio-do-quazar="pronta"]');
  await clicar(pronta.locator('[data-avaliar-ensaio="boa"]'));
  await page.waitForTimeout(500);
  ok("a bolha diz que o banco não deixou", /O banco não deixou guardar a avaliação/.test(await texto(pronta.locator("[data-ensaio-erro]"))),
     q(await texto(pronta)));
  ok("e não finge que marcou", (await attr(pronta, "data-ensaio-avaliacao")) === "");
  await ctx.close();
}

// ==================================================================
console.log("\n4. Sem o 055, a conversa abre como antes; a falha de leitura é dita");
{
  const { ctx, page, estouros } = await abrir({ semente: semente(), sem: true });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1300);
  ok("sem o 055, nenhum ensaio", (await page.locator("[data-ensaio-do-quazar]").count()) === 0);
  ok("a conversa abre igual", /como está meu processo/.test(await texto(page.locator('[data-msg-id="m-noite-1"]'))));
  ok("e calada (a tabela que falta não acende a faixa âmbar)", (await page.locator("[data-falha-de-leitura]").count()) === 0,
     q(await texto(page.locator("[data-falha-de-leitura]"))));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ semente: semente(), quebrar: ["zorvin_quazar_noturno"] });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1500);
  ok("a leitura que FALHA não vira \"nenhum ensaio\": a faixa âmbar diz",
     /ensaio do Quazar/.test(await texto(page.locator("[data-falha-de-leitura]"))), q(await texto(page.locator("[data-falha-de-leitura]"))));
  ok("e a conversa abre igual", /como está meu processo/.test(await texto(page.locator('[data-msg-id="m-noite-1"]'))));
  await ctx.close();
}

// ==================================================================
console.log("\n5. A aba Fora do horário: o modo e as respostas da semana");
const SEMANA = { seg: ["08:00", "18:00"], ter: ["08:00", "18:00"], qua: ["08:00", "18:00"], qui: ["08:00", "18:00"],
                 sex: ["08:00", "18:00"], sab: null, dom: null };
const linhaFora = (extra = {}) => ({ departamento_id: DEP, ligada: true, texto: "Recebemos sua mensagem.", semana: SEMANA,
                                     fuso: "America/Sao_Paulo", atualizada_em: iso(9000), atualizada_por: null, ...extra });
async function abrirAAba(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(700);
  if (!(await clicar(page.locator("[data-aba-fora-do-horario]")))) return false;
  await page.waitForTimeout(900);
  const escolha = page.locator("[data-fora-departamento]");
  if (await escolha.count()) { await escolha.selectOption(String(DEP)).catch(() => {}); await page.waitForTimeout(900); }
  return true;
}
{
  const { ctx, page, estouros } = await abrir({ semente: semente({ ensaios: [{ ...PRONTA, avaliacao: "ruim", comentario: "falou do processo" }, CALADA, PENSANDO, DO_OUTRO],
                                                                   fora: [linhaFora({ quazar: "ensaio" })] }) });
  ok("abri a aba Fora do horário, no departamento do telefone", await abrirAAba(page));
  const secao = page.locator("[data-quazar-a-noite]");
  ok("a seção do Quazar à noite está lá, em ensaio", (await attr(secao, "data-quazar-a-noite")) === "ensaio");
  ok("explica que no ensaio nada vai para o cliente", /No ensaio, nada vai para o cliente/.test(await texto(secao)));
  ok("e o que ele faz e não faz (assistente virtual, não promete, não pede senha, sai quando a equipe responde)",
     /assistente virtual/.test(await texto(secao)) && /não promete prazo nem valor/.test(await texto(secao))
       && /não pede senha/.test(await texto(secao)) && /ele sai da conversa/.test(await texto(secao)));
  ok("as contas da semana (sem a que ainda está sendo escrita, e sem a de outro departamento)",
     /Nos últimos 7 dias: 2 respostas de ensaio \(1 em que ele ficaria calado\) — 0 boas, 1 ruim, 1 sem avaliação\./.test(await texto(page.locator("[data-quazar-ensaio-contas]"))),
     q(await texto(page.locator("[data-quazar-ensaio-contas]"))));
  const linhas = page.locator("[data-quazar-ensaio-linha]");
  ok("uma linha por resposta do departamento, com o cliente e o que estava errado", (await linhas.count()) === 2
     && !/RESPOSTA-DE-OUTRO-DEPARTAMENTO/.test(await texto(page.locator("[data-quazar-a-noite]")))
     && /Cliente da Noite/.test(await texto(linhas)) && /O que estava errado: falou do processo/.test(await texto(page.locator('[data-quazar-ensaio-linha="qn-1"]'))),
     q(await texto(linhas)));
  const href = await attr(page.locator('[data-quazar-ensaio-linha="qn-1"] [data-quazar-ensaio-abrir]'), "href");
  const alvo = await attr(page.locator('[data-quazar-ensaio-linha="qn-1"] [data-quazar-ensaio-abrir]'), "target");
  ok("e o link que abre a conversa numa guia nova", /conversa=cv-noite/.test(href || "") && new RegExp(`linha=${ADV}`).test(href || "") && alvo === "_blank",
     q({ href, alvo }));
  ok("desligar é um clique", await clicar(page.locator('[data-quazar-modo="desligado"] input')));
  await page.waitForTimeout(800);
  const gravada = await page.evaluate((d) => (globalThis.__TABELAS.zorvin_fora_do_horario || []).find((l) => String(l.departamento_id) === String(d)), DEP);
  ok("e grava o modo, sem mexer no resto da resposta", gravada?.quazar === "desligado" && gravada?.ligada === true && gravada?.texto === "Recebemos sua mensagem.",
     q(gravada));
  ok("e a tela relê", (await attr(page.locator("[data-quazar-a-noite]"), "data-quazar-a-noite")) === "desligado");
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ semente: semente({ fora: [linhaFora()] }) });
  await abrirAAba(page);
  ok("6. sem a coluna do 055, a seção não aparece", (await page.locator("[data-quazar-a-noite]").count()) === 0
     && (await page.locator("[data-fora-do-horario]").count()) === 1);
  await ctx.close();
}

// ==================================================================
console.log("\n7. No celular, a bolha cabe");
{
  const { ctx, page } = await abrir({ semente: semente(), largura: 390, altura: 844, celular: true });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1300);
  const medida = await page.evaluate(() => {
    const b = document.querySelector('[data-ensaio-do-quazar="pronta"] > div')?.getBoundingClientRect();
    return b ? { esq: b.left, dir: b.right, largura: innerWidth, rola: document.documentElement.scrollWidth > innerWidth } : null;
  });
  ok("a bolha do ensaio cabe na tela, sem rolar de lado", medida && medida.esq >= 0 && medida.dir <= medida.largura && !medida.rola, q(medida));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
