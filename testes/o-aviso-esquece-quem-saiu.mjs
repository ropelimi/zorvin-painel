// O AVISO DE MENSAGEM NOVA ESQUECE QUEM SAIU (04/11)
//
// Resposta do Rodrigo à pergunta de depois da Gabriely: "Quando alguém sai,
// as conversas e tarefas abertas devem voltar para 'Sem responsável'." Quem
// devolve é a ponte (script 048). Esta prova guarda a outra metade, a do
// painel: devolver não bastava, porque o aviso tem quatro perguntas, nesta
// ordem —
//
//   1. participei da conversa       -> avisa
//   2. ela tem responsável          -> avisa só o responsável
//   3. outra pessoa participou      -> não avisa
//   4. ninguém participou, sem dono -> avisa todo mundo
//
// — e a conversa em que só quem saiu tinha respondido caía na terceira: "de
// outra pessoa". Sem responsável e sem aviso para ninguém, o cliente dela
// escreveria para o vazio. Agora:
//
//   1. QUEM SAIU NÃO CONTA como "outra pessoa participou": a conversa em que só
//      ela respondeu avisa todo mundo, como a de um cliente novo; e a conversa
//      em que uma colega ATIVA respondeu continua sem avisar (o contraste — um
//      painel que avisasse sempre passaria pela primeira metade);
//   2. O DONO QUE SAIU vale como sem dono, a segunda guarda para um banco sem
//      o 048: o aviso não vai só para quem não entra mais;
//   3. QUEM SAI NO MEIO DO DIA: a equipe é relida de dez em dez minutos (aqui,
//      encurtado), e o guardado da participação é refeito — a conversa que
//      não avisava passa a avisar, sem ninguém recarregar a página;
//   4. NUM BANCO SEM O 047 o painel não sabe quem saiu, e tudo continua como
//      antes — sem estouro.
//
// Os nomes são de mentira (o repositório é público).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);
const nav = await abrirNavegador();
const EU = "u1";                 // a sessão da bancada
const JEN = "u-jenifer";         // a colega que continua no escritório
const SAIU = "u-saiu";           // a colega que saiu

/** Abre o painel ESPIONANDO o aviso (e não silenciando). Todas as bandeiras
 *  em toda abertura — o `addInitScript` acumula entre as cenas. */
async function abrirPainel({ semente = {}, semColunas = null, releituraMs = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript(({ s, sc, rm }) => {
    globalThis.__AVISOS = [];
    globalThis.__SEMENTE = s;
    globalThis.__QUEBRAR = null;
    globalThis.__SEM_COLUNAS = sc;
    if (rm) globalThis.__RELER_A_EQUIPE_MS = rm;
    class NotificacaoDeMentira {
      constructor(titulo, opcoes) {
        globalThis.__AVISOS.push({ o: "notificacao", titulo, quando: Date.now(), ...(opcoes || {}) });
      }
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
    }
    globalThis.Notification = NotificacaoDeMentira;
  }, { s: semente, sc: semColunas, rm: releituraMs });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** O cliente escreve: a linha entra no banco e chega pelo tempo real, como a
 *  ponte faria. */
const chegarDoCliente = (page, convId) => page.evaluate((cid) => {
  const m = { id: `aviso-${cid}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, conversa_id: cid,
              origem: "contato", tipo: "texto", texto: "Boa tarde, alguém aí?", criado_em: new Date().toISOString() };
  globalThis.__TABELAS.mensagens.push(m);
  globalThis.__EMITIR("INSERT", "mensagens", m);
}, convId);
const avisosDe = (page, convId) => page.evaluate((cid) =>
  (globalThis.__AVISOS || []).filter((a) => a.o === "notificacao" && a.tag === `zorvin-conversa-${cid}`).length, convId);
/** Espera um aviso a mais que `antes`, até `ate` ms. */
async function avisou(page, convId, antes, ate = 5000) {
  const fim = Date.now() + ate;
  while (Date.now() < fim) {
    if ((await avisosDe(page, convId)) > antes) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

// ------------------------------------------------------------------
//  O TELEFONE QUE O PAINEL ABRE — descoberto, e não escolhido a dedo.
// ------------------------------------------------------------------
const sonda = await abrirPainel();
const ADV = await sonda.page.evaluate(() => {
  const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
  const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
  return c ? c.advogado_id : null;
});
await sonda.ctx.close();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

let seq = 0;
/** Uma conversa plantada no telefone aberto, no alto da lista. */
function conversa({ dono = null, quemRespondeu = [] } = {}) {
  seq++;
  const id = `cv-saiu-aviso-${seq}`, ct = `ct-saiu-aviso-${seq}`, numero = `55119700048${String(seq).padStart(2, "0")}`;
  const quando = new Date(Date.now() - seq * 1000).toISOString();
  const nome = `CLIENTE DE QUEM SAIU ${seq}`;
  return {
    id, nome,
    contato: { id: ct, numero, nome, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null },
    conversa: { id, advogado_id: ADV, contato_id: ct, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
                ultima_atividade: quando, ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
                responsavel_id: dono, responsavel_em: dono ? quando : null, responsavel_por: dono,
                contato: { id: ct, nome, numero, foto_url: null } },
    mensagens: [
      { id: `m-${id}-0`, conversa_id: id, origem: "contato", tipo: "texto", texto: "oi", criado_em: quando },
      ...quemRespondeu.map((u, i) => ({ id: `m-${id}-r${i}`, conversa_id: id, origem: "advogado", tipo: "texto",
        texto: "respondi", enviado_por_id: u, criado_em: quando })),
    ],
  };
}
/** A semente: as conversas, e a colega que saiu (`ativo` falso). */
const semear = (lista) => ({
  usuarios: [{ id: SAIU, admin: false, nome: "GABI QUE SAIU", foto_url: null, ativo: false }],
  contatos: lista.map((c) => c.contato),
  conversas: lista.map((c) => c.conversa),
  mensagens: lista.flatMap((c) => c.mensagens),
});

/** A colega que sai no meio do dia: o banco a desliga com a página aberta. */
const ativo = (page, uid, valor) => page.evaluate(({ id, v }) => {
  const u = (globalThis.__TABELAS.usuarios || []).find((x) => String(x.id) === id);
  if (u) u.ativo = v;
  return Boolean(u);
}, { id: uid, v: valor });

// ==================================================================
console.log("\n1. A conversa em que só quem saiu respondeu avisa todo mundo");
{
  const soDela = conversa({ quemRespondeu: [SAIU] });
  const daColega = conversa({ quemRespondeu: [JEN] });
  const { ctx, page, estouros } = await abrirPainel({ semente: semear([soDela, daColega]) });
  const temASaiu = await page.evaluate((id) => (globalThis.__TABELAS.usuarios || [])
    .some((u) => String(u.id) === id && u.ativo === false), SAIU);
  ok("a bancada tem a colega que saiu, desligada", temASaiu);

  await chegarDoCliente(page, soDela.id);
  ok("o cliente que só ela atendia escreve, e eu sou avisado (ninguém da equipe está com ele)",
     await avisou(page, soDela.id, 0), q(await page.evaluate(() => globalThis.__AVISOS)));

  await chegarDoCliente(page, daColega.id);
  ok("o cliente que a colega ativa atende escreve, e eu NÃO sou avisado (o contraste: é dela)",
     !(await avisou(page, daColega.id, 0, 3500)), q(await page.evaluate(() => globalThis.__AVISOS)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. O dono que saiu vale como sem dono (o banco sem o 048)");
{
  const comEla = conversa({ dono: SAIU, quemRespondeu: [SAIU] });
  const comAColega = conversa({ dono: JEN, quemRespondeu: [JEN] });
  // NO NOME DELA, MAS A JENIFER TAMBÉM RESPONDEU: sem dono que valha, quem
  // decide é a participação — e ela é da Jenifer. Avisar todo mundo aqui seria
  // tratar o dono que saiu como "conversa de ninguém", e não como "sem dono".
  const comElaEAJen = conversa({ dono: SAIU, quemRespondeu: [SAIU, JEN] });
  const { ctx, page, estouros } = await abrirPainel({ semente: semear([comEla, comAColega, comElaEAJen]) });

  await chegarDoCliente(page, comEla.id);
  ok("a conversa que ficou no nome de quem saiu avisa todo mundo, e não só ela",
     await avisou(page, comEla.id, 0), q(await page.evaluate(() => globalThis.__AVISOS)));
  await chegarDoCliente(page, comAColega.id);
  ok("a da colega ativa continua avisando só a colega (o contraste)",
     !(await avisou(page, comAColega.id, 0, 3500)), q(await page.evaluate(() => globalThis.__AVISOS)));
  await chegarDoCliente(page, comElaEAJen.id);
  ok("e a que ficou no nome dela, mas que a Jenifer também atendeu, não me avisa: segue a participação",
     !(await avisou(page, comElaEAJen.id, 0, 3500)), q(await page.evaluate(() => globalThis.__AVISOS)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Quem sai no meio do dia: a equipe é relida sozinha, e o aviso volta");
{
  const daJen = conversa({ quemRespondeu: [JEN] });
  const { ctx, page, estouros } = await abrirPainel({ semente: semear([daJen]), releituraMs: 1500 });

  await chegarDoCliente(page, daJen.id);
  ok("enquanto a Jenifer está no escritório, o cliente dela não me avisa",
     !(await avisou(page, daJen.id, 0, 3000)), q(await page.evaluate(() => globalThis.__AVISOS)));

  // ELA SAI: o banco a desliga. Nada de recarregar a página, nem de renovar a
  // sessão — quem relê é o relógio da equipe. A marca na janela é o que prova
  // que a página não foi recarregada: um F5 a apagaria.
  await page.evaluate(() => { globalThis.__SEM_RECARREGAR = true; });
  ok("a Jenifer foi desligada no banco", await ativo(page, JEN, false));
  await page.waitForTimeout(3500);
  await chegarDoCliente(page, daJen.id);
  ok("depois da releitura, o cliente dela me avisa (o guardado da participação foi refeito)",
     await avisou(page, daJen.id, 0), q(await page.evaluate(() => globalThis.__AVISOS)));
  ok("e a releitura não precisou de recarregar a página",
     (await page.evaluate(() => globalThis.__SEM_RECARREGAR === true)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Num banco sem o 047, nada muda");
{
  const soDela = conversa({ quemRespondeu: [SAIU] });
  const { ctx, page, estouros } = await abrirPainel({ semente: semear([soDela]), semColunas: { equipe: ["ativo"] } });
  await chegarDoCliente(page, soDela.id);
  ok("sem como saber quem saiu, a conversa dela continua sendo \"de outra pessoa\", como antes",
     !(await avisou(page, soDela.id, 0, 3500)), q(await page.evaluate(() => globalThis.__AVISOS)));
  ok("e a lista de conversas continua aparecendo", (await page.locator("[data-conversa-nome]").count()) > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
if (falhas) { console.log(`${falhas} FALHA(S).`); process.exit(1); }
