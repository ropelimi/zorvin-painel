// O QUAZAR À NOITE, VALENDO (18/11) — a metade do painel.
//
// Pedido do Rodrigo: *"Sobre os ensaios do Quazar, quero já começar a usar"*.
// Quem decide e manda é a PONTE (script 059, provado lá num Postgres de
// verdade). A mensagem que o Quazar manda entra em `mensagens` marcada
// `automatica` e `pelo_quazar`. O que esta prova guarda é o que é da tela:
//
//   1. a bolha do Quazar diz que é ele ("Quazar · assistente virtual"), com o
//      rosto dele, e nunca as iniciais de quem olha a tela;
//   2. o aviso automático do Vantoro continua com o robô (o contraste);
//   3. a aba Fora do horário oferece "Valendo", e escolher grava 'valendo';
//   4. as respostas enviadas aparecem na lista da aba, contadas como enviadas.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const AGORA_D = new Date("2026-10-09T11:00:00Z");
const AGORA = AGORA_D.getTime();
const iso = (minAtras) => new Date(AGORA - minAtras * 60000).toISOString();

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.count().then((n) => (n ? loc.first().innerText().catch(() => "") : ""));
const attr = (loc, a) => loc.count().then((n) => (n ? loc.first().getAttribute(a).catch(() => null) : null));

async function abrir({ semente = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((b) => { globalThis.__SEMENTE = b.semente; }, { semente });
  await page.clock.setFixedTime(AGORA_D);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

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
ok("aprendi qual telefone o painel abre", Boolean(TEL && TEL.adv && TEL.dep != null), q(TEL));
const ADV = TEL && TEL.adv, DEP = TEL && TEL.dep;

const CONTATO = { id: "ct-qv", numero: "5511944440011", nome: "Cliente Valendo", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const ENVIADA = { id: "qv-1", conversa_id: "cv-qv", status: "enviada", modo: "valendo", fila_id: "f-qv-1",
                  texto: "Boa noite! Sou o Quazar, assistente virtual do escritório. A equipe volta amanhã às 8h.",
                  resumo: "Quer saber do processo.", motivo: null, avaliacao: null, comentario: null,
                  ate: iso(-60), cliente_ate: iso(30), cliente_ate_id: "m-qv-1", criada_em: iso(29), pronta_em: iso(29) };
const SEMANA = { seg: ["08:00", "18:00"], ter: ["08:00", "18:00"], qua: ["08:00", "18:00"], qui: ["08:00", "18:00"],
                 sex: ["08:00", "18:00"], sab: null, dom: null };
const linhaFora = (extra = {}) => ({ departamento_id: DEP, ligada: true, texto: "Recebemos sua mensagem.", semana: SEMANA,
                                     fuso: "America/Sao_Paulo", atualizada_em: iso(9000), atualizada_por: null, ...extra });
const semente = ({ fora = null } = {}) => ({
  contatos: [CONTATO],
  conversas: [{
    id: "cv-qv", advogado_id: ADV, contato_id: CONTATO.id, nao_lidas: 1, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: iso(28), esperando_desde: iso(30), tratada_em: null,
    ultima_mensagem: "Boa noite! Sou o Quazar", frente: null, digitando_ate: null, vantoro_nome: null, contato: CONTATO,
  }],
  mensagens: [
    { id: "m-qv-1", conversa_id: "cv-qv", origem: "contato", tipo: "texto", texto: "Boa noite, como está meu processo?",
      id_uazapi: "uz-qv-1", criado_em: iso(30) },
    { id: "m-qv-2", conversa_id: "cv-qv", origem: "advogado", tipo: "texto", texto: ENVIADA.texto, automatica: true,
      pelo_quazar: true, enviado_por: "Quazar", enviado_por_id: null, id_uazapi: "uz-qv-2", status: "enviada", criado_em: iso(28) },
    { id: "m-qv-3", conversa_id: "cv-qv", origem: "advogado", tipo: "texto", texto: "Lembrete: sua audiência é amanhã.",
      automatica: true, pelo_quazar: false, enviado_por_id: null, id_uazapi: "uz-qv-3", status: "enviada", criado_em: iso(20) },
  ],
  zorvin_quazar_noturno: [ENVIADA],
  ...(fora ? { zorvin_fora_do_horario: fora } : {}),
});

// ==================================================================
console.log("\n1. A bolha do Quazar diz que é ele, com o rosto dele");
{
  const { ctx, page, estouros } = await abrir({ semente: semente() });
  await clicar(page.locator('[data-conversa-id="cv-qv"]'));
  await page.waitForTimeout(1300);
  const bolha = page.locator('[data-msg-id="m-qv-2"]');
  ok("a mensagem do Quazar aparece na conversa", /Sou o Quazar/.test(await texto(bolha)), q(await texto(bolha)));
  const autor = bolha.locator("[data-autor-quazar]");
  ok("a linha do autor diz \"Quazar · assistente virtual\"", /Quazar · assistente virtual/.test(await texto(autor)), q(await texto(autor)));
  ok("com o title de quem a escreveu", /assistente virtual/.test((await attr(autor, "title")) || "") && /ninguém da equipe/.test((await attr(autor, "title")) || ""),
     q(await attr(autor, "title")));
  ok("a linha do autor tem o rosto do Quazar, e não o robô", (await autor.locator("[data-rosto-do-assistente]").count()) === 1);
  const av = page.locator('[data-avatar-quazar]');
  ok("o avatar é o do Quazar", (await av.count()) >= 1 && (await av.first().locator("[data-rosto-do-assistente]").count()) === 1);
  const pintado = await page.evaluate(() => {
    const el = document.querySelector("[data-avatar-quazar]");
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { pintado: !!no && el.contains(no), tit: el.getAttribute("title"), aria: el.getAttribute("aria-label"),
             letras: el.textContent.trim() };
  });
  ok("o rosto está pintado, com title e aria-label de assistente virtual, sem iniciais",
     pintado && pintado.pintado && /assistente virtual/.test(pintado.tit || "") && /Quazar/.test(pintado.aria || "") && pintado.letras === "",
     q(pintado));
  const aviso = page.locator('[data-msg-id="m-qv-3"]');
  ok("o aviso do Vantoro continua com o robô, e não com o Quazar",
     (await aviso.locator("[data-autor-automatico]").count()) === 1 && (await aviso.locator("[data-autor-quazar]").count()) === 0
       && /Aviso automático do Vantoro/.test(await texto(aviso)), q(await texto(aviso)));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n2. A aba Fora do horário oferece Valendo");
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
  const { ctx, page, estouros } = await abrir({ semente: semente({ fora: [linhaFora({ quazar: "ensaio" })] }) });
  ok("abri a aba", await abrirAAba(page));
  const opc = page.locator('[data-quazar-modo="valendo"]');
  ok("a opção Valendo está lá, dizendo que a mensagem pronta não sai", /Valendo/.test(await texto(opc)) && /mensagem pronta não sai/.test(await texto(opc)),
     q(await texto(opc)));
  ok("a explicação diz que ele espera 1 minuto", /1 minuto/.test(await texto(page.locator("[data-quazar-a-noite]"))));
  ok("as contas dizem a enviada ao cliente", /enviadas? ao cliente/.test(await texto(page.locator("[data-quazar-ensaio-contas]"))),
     q(await texto(page.locator("[data-quazar-ensaio-contas]"))));
  ok("e a linha da resposta diz que foi enviada", /enviada/.test(await texto(page.locator('[data-quazar-ensaio-linha="qv-1"]'))),
     q(await texto(page.locator('[data-quazar-ensaio-linha="qv-1"]'))));
  ok("escolher Valendo é um clique", await clicar(page.locator('[data-quazar-modo="valendo"] input')));
  await page.waitForTimeout(800);
  const gravada = await page.evaluate((d) => (globalThis.__TABELAS.zorvin_fora_do_horario || []).find((l) => String(l.departamento_id) === String(d)), DEP);
  ok("e grava 'valendo', sem mexer no resto da resposta", gravada?.quazar === "valendo" && gravada?.texto === "Recebemos sua mensagem.", q(gravada));
  ok("e a tela relê", (await attr(page.locator("[data-quazar-a-noite]"), "data-quazar-a-noite")) === "valendo");
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
