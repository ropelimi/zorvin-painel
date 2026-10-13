// O AVISO DE MENSAGEM NOVA VAI PARA O RESPONSÁVEL (13/10).
//
// Pedido do Rodrigo, logo depois da distribuição automática: "pode fazer o
// aviso só para quem recebeu". As regras de 15/09 continuam — elas estão na
// prova `o-aviso-de-mensagem-nova` —, com uma pergunta nova no meio:
//
//   1. participei da conversa       -> avisa
//   2. ela tem responsável          -> avisa só o responsável
//   3. outra pessoa participou      -> não avisa
//   4. ninguém participou, sem dono -> avisa todo mundo (o cliente novo)
//
// E A CORRIDA É O QUE ESTA PROVA MAIS GUARDA. A ponte grava a mensagem e SÓ
// DEPOIS pergunta ao banco quem a recebe: a primeira mensagem de um cliente
// novo chega aos painéis ANTES do dono. Sem a espera, ela avisaria todo mundo
// — exatamente o que o pedido quer calar. A prova faz o papel da ponte:
// manda a mensagem, e 400 ms depois grava o dono.
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
const COLEGA = "u-jenifer";
const OUTRA = "u-isabela";

/** Abre o painel ESPIONANDO o aviso (e não silenciando): o que se mede é
 *  QUANDO ele acontece. Todas as bandeiras em toda abertura. */
async function abrirPainel({ semente = {}, largura = 1400 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((s) => {
    globalThis.__AVISOS = [];
    globalThis.__SEMENTE = s;
    globalThis.__QUEBRAR = null;
    class NotificacaoDeMentira {
      constructor(titulo, opcoes) {
        globalThis.__AVISOS.push({ o: "notificacao", titulo, quando: Date.now(), ...(opcoes || {}) });
      }
      static permission = "granted";
      static requestPermission() { return Promise.resolve("granted"); }
    }
    globalThis.Notification = NotificacaoDeMentira;
  }, semente);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** O cliente escreve: a linha entra no banco e chega pelo tempo real, como a
 *  ponte faria. Devolve o instante, para medir quanto o aviso levou. */
async function chegarDoCliente(page, convId) {
  return page.evaluate((cid) => {
    const m = { id: `aviso-${cid}-${Date.now()}`, conversa_id: cid, origem: "contato", tipo: "texto",
                texto: "Bom dia, preciso de ajuda", criado_em: new Date().toISOString() };
    globalThis.__TABELAS.mensagens.push(m);
    globalThis.__EMITIR("INSERT", "mensagens", m);
    return Date.now();
  }, convId);
}
/** A PONTE DISTRIBUINDO: o dono gravado, sem "passada por" (o Zorvin pôs). */
const distribuirPara = (page, convId, dono) => page.evaluate(({ cid, d }) => {
  const cv = globalThis.__TABELAS.conversas.find((x) => x.id === cid);
  const em = new Date().toISOString();
  cv.responsavel_id = d; cv.responsavel_em = em; cv.responsavel_por = null;
  globalThis.__EMITIR("UPDATE", "conversas", { ...cv });
}, { cid: convId, d: dono });
const avisosDe = (page, convId) => page.evaluate((cid) =>
  (globalThis.__AVISOS || []).filter((a) => a.o === "notificacao" && a.tag === `zorvin-conversa-${cid}`), convId);
/** Espera o aviso chegar, até `ate` ms; devolve quando chegou (ou null). */
async function esperarAviso(page, convId, desde, ate) {
  const fim = Date.now() + ate;
  while (Date.now() < fim) {
    const a = await avisosDe(page, convId);
    if (a.length) return a[0].quando - desde;
    await page.waitForTimeout(100);
  }
  return null;
}

// ------------------------------------------------------------------
//  O TELEFONE QUE O PAINEL ABRE, e o departamento dele — descobertos, e não
//  escolhidos a dedo.
// ------------------------------------------------------------------
const sonda = await abrirPainel();
const { ADV, DEP } = await sonda.page.evaluate(() => {
  const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
  const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
  const a = c && (globalThis.__TABELAS.advogados || []).find((x) => x.id === c.advogado_id);
  return { ADV: c ? c.advogado_id : null, DEP: a ? a.departamento_id : null };
});
await sonda.ctx.close();
ok("aprendi qual telefone o painel abre, e o departamento dele", Boolean(ADV) && DEP != null, q({ ADV, DEP }));

let seq = 0;
/** Uma conversa plantada no telefone aberto, no alto da lista. */
function conversa({ dono = null, por = null, quemRespondeu = [] } = {}) {
  seq++;
  const id = `cv-aviso-${seq}`, ct = `ct-aviso-${seq}`, numero = `55119700055${String(seq).padStart(2, "0")}`;
  const agora = new Date(Date.now() - seq * 1000).toISOString();
  const nome = `CLIENTE DO AVISO ${seq}`;
  return {
    id, nome,
    contato: { id: ct, numero, nome, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null },
    conversa: { id, advogado_id: ADV, contato_id: ct, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
                ultima_atividade: agora, ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
                responsavel_id: dono, responsavel_em: dono ? agora : null, responsavel_por: por,
                contato: { id: ct, nome, numero, foto_url: null } },
    mensagens: [
      { id: `m-${id}-0`, conversa_id: id, origem: "contato", tipo: "texto", texto: "oi", criado_em: agora },
      ...quemRespondeu.map((u, i) => ({ id: `m-${id}-r${i}`, conversa_id: id, origem: "advogado", tipo: "texto",
        texto: "respondi", enviado_por_id: u, criado_em: agora })),
    ],
  };
}
const semear = (lista, extra = {}) => ({
  contatos: lista.map((c) => c.contato),
  conversas: lista.map((c) => c.conversa),
  mensagens: lista.flatMap((c) => c.mensagens),
  ...extra,
});
const DISTRIBUICAO_LIGADA = { zorvin_distribuicao: [{ departamento_id: DEP, ligada: true }] };

// ==================================================================
console.log("\n1. Com responsável, o aviso vai para ele");
{
  const paraMim = conversa({ dono: EU });                           // o Zorvin distribuiu para mim
  const paraColega = conversa({ dono: COLEGA });                    // ...e para a colega
  const respondiNaDela = conversa({ dono: COLEGA, quemRespondeu: [EU] });
  const passadaParaMim = conversa({ dono: EU, por: OUTRA, quemRespondeu: [OUTRA] });
  const { ctx, page, estouros } = await abrirPainel({ semente: semear([paraMim, paraColega, respondiNaDela, passadaParaMim]) });

  let t0 = await chegarDoCliente(page, paraMim.id);
  ok("a conversa que o Zorvin distribuiu para MIM me avisa",
     (await esperarAviso(page, paraMim.id, t0, 3000)) !== null);

  t0 = await chegarDoCliente(page, paraColega.id);
  await page.waitForTimeout(3500);
  // O PEDIDO. Antes, ninguém tendo respondido, ela avisava todo mundo.
  ok("a conversa distribuída para a COLEGA não me avisa — ninguém respondeu, e mesmo assim ela tem dono",
     (await avisosDe(page, paraColega.id)).length === 0, q(await avisosDe(page, paraColega.id)));

  t0 = await chegarDoCliente(page, respondiNaDela.id);
  ok("a conversa da colega em que EU respondi continua me avisando (a regra de 15/09 vem primeiro)",
     (await esperarAviso(page, respondiNaDela.id, t0, 3000)) !== null);

  t0 = await chegarDoCliente(page, passadaParaMim.id);
  // E O BURACO QUE FECHOU JUNTO: quem recebia uma conversa passada adiante
  // ficava calado, porque outra pessoa tinha respondido nela.
  ok("a conversa PASSADA para mim avisa, mesmo com outra pessoa tendo respondido nela",
     (await esperarAviso(page, passadaParaMim.id, t0, 3000)) !== null);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Sem responsável, a regra de antes — e sem esperar à toa");
{
  const daOutra = conversa({ quemRespondeu: [OUTRA] });
  const leadSemDistribuicao = conversa();
  const { ctx, page } = await abrirPainel({ semente: semear([daOutra, leadSemDistribuicao]) });
  let t0 = await chegarDoCliente(page, daOutra.id);
  await page.waitForTimeout(2500);
  ok("sem dono, a conversa que outra pessoa atende não me avisa",
     (await avisosDe(page, daOutra.id)).length === 0);
  t0 = await chegarDoCliente(page, leadSemDistribuicao.id);
  const levou = await esperarAviso(page, leadSemDistribuicao.id, t0, 6000);
  ok("o cliente novo, sem dono e sem distribuição ligada, avisa todo mundo", levou !== null);
  // A ESPERA É SÓ ONDE A DISTRIBUIÇÃO ESTÁ LIGADA: sem ela, o dono não vem, e
  // esperar seria atrasar o aviso de todo cliente novo por nada.
  ok("e avisa sem a espera da distribuição", levou !== null && levou < 2000, `levou ${levou} ms`);
  await ctx.close();
}

// ==================================================================
console.log("\n3. A corrida: a mensagem chega antes do dono");
{
  const vaiParaColega = conversa();
  const vaiParaMim = conversa();
  const ninguemNoRodizio = conversa();
  const { ctx, page, estouros } = await abrirPainel({ semente: semear([vaiParaColega, vaiParaMim, ninguemNoRodizio], DISTRIBUICAO_LIGADA) });
  // A BANCADA PASSA A RESPONDER EM 60 ms, e a ponte daqui leva 1 s para
  // gravar o dono. Com os 700 ms de sempre das conversas a PRIMEIRA pergunta
  // já voltaria com o dono — a bancada lê a linha ao RESPONDER, e não ao
  // perguntar —, e a cena passaria sem a espera existir. Assim, só a espera
  // separa o certo do errado: sem ela, a segunda pergunta volta aos ~240 ms,
  // antes de o dono chegar.
  await page.evaluate(() => { globalThis.__ATRASO_UNIFORME = 60; });

  // A PONTE: grava a mensagem, e 1 s depois a distribuição grava o dono.
  await chegarDoCliente(page, vaiParaColega.id);
  await page.waitForTimeout(1000);
  await distribuirPara(page, vaiParaColega.id, COLEGA);
  await page.waitForTimeout(4500);
  ok("a primeira mensagem de um cliente que a distribuição deu para a COLEGA não me avisa",
     (await avisosDe(page, vaiParaColega.id)).length === 0, q(await avisosDe(page, vaiParaColega.id)));

  let t0 = await chegarDoCliente(page, vaiParaMim.id);
  await page.waitForTimeout(1000);
  await distribuirPara(page, vaiParaMim.id, EU);
  ok("a que a distribuição deu para MIM me avisa", (await esperarAviso(page, vaiParaMim.id, t0, 7000)) !== null);

  // LIGADA E NINGUÉM RECEBEU (ninguém do rodízio vê o telefone): depois da
  // espera, todo mundo é avisado — calar seria o lead sem resposta.
  t0 = await chegarDoCliente(page, ninguemNoRodizio.id);
  const levou = await esperarAviso(page, ninguemNoRodizio.id, t0, 7000);
  ok("ligada e sem ninguém para receber, avisa todo mundo depois da espera", levou !== null, `levou ${levou}`);
  ok("(e esperou mesmo: não decidiu antes de o dono ter tempo de chegar)", levou !== null && levou >= 2400, `levou ${levou} ms`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. A espera não atrasa o cliente novo na lista");
{
  const { ctx, page } = await abrirPainel({ semente: DISTRIBUICAO_LIGADA });
  const novo = conversa();
  const t0 = await page.evaluate((c) => {
    globalThis.__TABELAS.contatos.push(c.contato);
    globalThis.__TABELAS.conversas.push(c.conversa);
    const m = { id: `m-novo-${Date.now()}`, conversa_id: c.id, origem: "contato", tipo: "texto",
                texto: "Olá, quero saber do meu processo", criado_em: new Date().toISOString() };
    globalThis.__TABELAS.mensagens.push(m);
    globalThis.__EMITIR("INSERT", "mensagens", m);
    return Date.now();
  }, novo);
  let apareceu = null;
  while (Date.now() - t0 < 6000) {
    if (await page.locator(`[data-conversa-id="${novo.id}"]`).count()) { apareceu = Date.now() - t0; break; }
    await page.waitForTimeout(100);
  }
  // A DECISÃO DO AVISO CORRE POR FORA. Esperada no tratador, ela seguraria a
  // lista os segundos da espera da distribuição — e o cliente novo apareceria
  // atrasado justamente para quem vai atendê-lo.
  ok("a conversa do cliente novo entra na lista sem esperar a distribuição", apareceu !== null && apareceu < 2400,
     `apareceu em ${apareceu} ms`);
  await ctx.close();
}

// ==================================================================
console.log("\n5. O responsável que muda vale na mensagem seguinte");
{
  const c = conversa({ dono: COLEGA });
  const { ctx, page } = await abrirPainel({ semente: semear([c]) });
  await chegarDoCliente(page, c.id);
  await page.waitForTimeout(2500);
  ok("com a colega como responsável, não me avisa", (await avisosDe(page, c.id)).length === 0);
  // PASSADA PARA MIM. O dono é perguntado a cada aviso, e não guardado: um
  // dono guardado e velho calaria a pessoa errada.
  await page.evaluate(({ cid, eu, colega }) => {
    const cv = globalThis.__TABELAS.conversas.find((x) => x.id === cid);
    cv.responsavel_id = eu; cv.responsavel_por = colega; cv.responsavel_em = new Date().toISOString();
    globalThis.__EMITIR("UPDATE", "conversas", { ...cv });
  }, { cid: c.id, eu: EU, colega: COLEGA });
  await page.waitForTimeout(300);
  const t0 = await chegarDoCliente(page, c.id);
  ok("passada para mim, a mensagem seguinte me avisa", (await esperarAviso(page, c.id, t0, 3000)) !== null);
  await ctx.close();
}

// ==================================================================
console.log("\n6. A leitura do responsável que falha avisa assim mesmo");
{
  const c = conversa({ dono: COLEGA });
  const { ctx, page } = await abrirPainel({ semente: semear([c]) });
  // SÓ AGORA, com a tela de pé: as conversas param de responder.
  await page.evaluate(() => { globalThis.__QUEBRAR = ["conversas"]; });
  const t0 = await chegarDoCliente(page, c.id);
  // SEM SABER DE QUEM É, o erro barato é um som a mais; o caro é calar a
  // mensagem de um cliente por causa de um tropeço.
  ok("sem conseguir ler o responsável, avisa", (await esperarAviso(page, c.id, t0, 3000)) !== null);
  await page.evaluate(() => { globalThis.__QUEBRAR = null; });
  await ctx.close();
}

// ==================================================================
console.log("\n7. Aberta durante a espera, a conversa não avisa");
{
  const c = conversa();
  const { ctx, page } = await abrirPainel({ semente: semear([c], DISTRIBUICAO_LIGADA) });
  await chegarDoCliente(page, c.id);
  await page.waitForTimeout(600);
  // A pessoa viu a linha subir e abriu a conversa antes de a espera acabar.
  const linha = page.locator(`[data-conversa-id="${c.id}"]`);
  if (await linha.count()) await linha.first().click();
  await page.waitForTimeout(5000);
  // SEM ESTA, a cena passaria com o clique perdido: conversa fechada e
  // distribuição ligada sem dono também... avisaria. Mas avisaria DEPOIS da
  // espera, e a conferência de baixo pegaria — o que ela não pegaria é o
  // clique que não abriu nada e um aviso que, por outro motivo, não saiu.
  const aberta = await page.locator("[data-nome-do-contato]").first().innerText().catch(() => "");
  ok("abri a conversa durante a espera", aberta.trim() === c.nome, `o alto da conversa diz ${q(aberta)}`);
  ok("e o aviso não saiu: eu já estava vendo a mensagem", (await avisosDe(page, c.id)).length === 0,
     q(await avisosDe(page, c.id)));
  await ctx.close();
}

// ==================================================================
console.log("\n8. A tela de Avisos diz a regra nova");
{
  const { ctx, page } = await abrirPainel();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Avisos" }).click();
  await page.waitForTimeout(400);
  const texto = await page.locator("[data-aba-avisos]").innerText().catch(() => "");
  // A FRASE INTEIRA, e não a palavra solta: no JSX a quebra de linha colada a
  // um `<b>` some, e a primeira escrita desta frase saía "numa conversasem
  // responsável" — com a palavra "responsável" lá, e uma busca pela palavra
  // passando.
  ok("diz que a conversa de que você é o responsável avisa", /em que você é o responsável/.test(texto), texto.slice(0, 400));
  ok("e que a conversa sem responsável e sem ninguém avisa (as palavras separadas)",
     /numa conversa sem responsável que ninguém atendeu/.test(texto), texto.slice(0, 400));
  ok("e que, com a distribuição ligada, só quem recebeu é avisado", /distribuição/i.test(texto) && /só quem o recebeu/i.test(texto),
     texto.slice(0, 400));
  await ctx.close();
}

// ==================================================================
console.log("\n9. Uma rajada de mensagens pergunta o responsável UMA vez");
{
  const c = conversa({ dono: COLEGA });
  const { ctx, page } = await abrirPainel({ semente: semear([c]) });
  // O DIÁRIO DAS IDAS AO BANCO só a partir daqui: a abertura não interessa.
  await page.evaluate(() => { globalThis.__DIARIO = []; });
  const perguntasPeloDono = () => page.evaluate(() => {
    const n = (globalThis.__DIARIO || [])
      .filter((m) => m.tabela === "conversas" && /responsavel_id/.test(m.colunas || "")).length;
    globalThis.__DIARIO = [];
    return n;
  });
  // UM CLIENTE MANDANDO DEZ FOTOS SEGUIDAS. O dono é perguntado a cada
  // aviso, e sem juntar seriam dez perguntas iguais no mesmo instante — por
  // cada pessoa da equipe. É a conta que `selos-em-rajada` existe para
  // impedir.
  await page.evaluate((cid) => {
    for (let k = 0; k < 10; k++) {
      const m = { id: `rajada-${cid}-${k}`, conversa_id: cid, origem: "contato", tipo: "imagem",
                  texto: null, criado_em: new Date().toISOString() };
      globalThis.__TABELAS.mensagens.push(m);
      globalThis.__EMITIR("INSERT", "mensagens", m);
    }
  }, c.id);
  await page.waitForTimeout(2500);
  const naRajada = await perguntasPeloDono();
  ok("dez mensagens seguidas do mesmo cliente perguntam o responsável uma vez só", naRajada === 1,
     `foram ${naRajada}`);
  // TERMINADA A PERGUNTA, a seguinte pergunta de novo: juntar não pode virar
  // guardar — o dono pode ter mudado (a cena 5).
  await chegarDoCliente(page, c.id);
  await page.waitForTimeout(2000);
  const depois = await perguntasPeloDono();
  ok("e a mensagem que chega depois pergunta de novo", depois === 1, `foram ${depois}`);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
