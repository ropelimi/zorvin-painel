// A FILA NÃO SE EMBARALHA SOZINHA
//
// Relato do Rodrigo em 30/09, com duas fotos: *"Com o filtro 'Esperando'
// ativado, após eu clicar em qualquer conversa, a lista de conversas fica se
// atualizando e mudando sozinha."* Na primeira foto a fila abria em "esperando
// há 48 dias"; um clique depois, no alto estava "esperando há 7 dias".
//
// A CAUSA: o banco ordenava pela espera, e a tela reordenava por conta própria
// no TEMPO REAL — que só conhecia a ordem pela última mensagem. Abrir a
// conversa zera as não lidas, o Supabase avisa todo mundo da mudança, e o
// aviso virava a lista para "Recentes". A releitura seguinte a desvirava.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. abrir uma conversa, com a fila de espera escolhida, NÃO muda a ordem
//      de ninguém — reproduzido pelo mesmo caminho do banco: o aviso de tempo
//      real com a linha INTEIRA, como o Supabase manda;
//   2. mensagem nova de quem já está na fila também não mexe: a espera dele
//      não mudou, e pular para o alto seria a ordem de "Recentes" de novo;
//   3. quem é respondido SAI da fila na hora — a espera que chega nula pelo
//      tempo real vale, e a linha para de dizer "esperando há N dias". É o
//      contraste: sem ele, uma tela que ignorasse o tempo real inteiro
//      passaria nas duas de cima;
//   4. em "Antigas", a mesma coisa — o outro sentido também era sobrescrito.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Ao meio-dia de `n` dias atrás — não muda de dia conforme a hora da prova. */
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
const minutosAtras = (m) => new Date(Date.now() - m * 60000).toISOString();

async function abrirPainel(semente = null) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente || undefined;
    globalThis.__SEM_ESPERA = false;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** O telefone que o painel abre — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const { ctx, page } = await abrirPainel();
  const adv = await page.evaluate(() => {
    const id = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

// A FORMA DO RELATO: a espera e a última mensagem em ordens OPOSTAS. Quem
// espera há mais tempo escreveu há mais tempo também, menos um — o que
// escreveu agora há pouco e espera há 30 dias. Com as duas ordens iguais, a
// fila e "Recentes" dariam a mesma lista e a prova não veria nada.
function conversa(id, nome, numero, ultima, espera, naoLidas = 1) {
  return {
    id, contato_id: `ct-${id}`, advogado_id: ADV,
    fixada: false, arquivada: false, favorita: false, nao_lidas: naoLidas,
    ultima_mensagem: "oi", ultima_atividade: ultima, esperando_desde: espera,
    frente: null, vantoro_nome: null, digitando_ate: null,
    atendendo_por: null, atendendo_em: null,
    contato: { id: `ct-${id}`, nome, numero,
               foto_url: null, vantoro_nome: null, nome_zorvin: null },
  };
}
const PLANTADAS = [
  conversa("cv-f48", "YY Quarenta e Oito", "5511960048480", minutosAtras(600), diasAtras(48)),
  conversa("cv-f30", "YY Trinta Recente", "5511960030300", minutosAtras(1), diasAtras(30)),
  conversa("cv-f20", "YY Vinte", "5511960020200", minutosAtras(300), diasAtras(20)),
  conversa("cv-f07", "YY Sete", "5511960007070", minutosAtras(2), diasAtras(7)),
];
const SEMENTE = {
  contatos: PLANTADAS.map((c) => ({ ...c.contato })),
  conversas: PLANTADAS,
  mensagens: PLANTADAS.map((c, i) => ({ id: `m-${c.id}`, conversa_id: c.id, origem: "contato",
    tipo: "texto", texto: "oi", criado_em: minutosAtras(3 + i) })),
};

const ordemNaTela = (page) => page.$$eval("[data-conversa-id]",
  (ns) => ns.map((n) => n.getAttribute("data-conversa-id")));
const soAsPlantadas = (ids) => ids.filter((id) => id.startsWith("cv-f"));

async function escolherOrdem(page, chave) {
  await page.locator("[data-ordem]").first().click();
  await page.waitForTimeout(300);
  const opcao = page.locator(`[data-ordem-opcao="${chave}"]`);
  if (!(await opcao.count())) return false;
  await opcao.first().click();
  await page.waitForTimeout(1800);
  return true;
}

/** O aviso que o Supabase manda quando a linha muda: a linha INTEIRA, depois
 *  da mudança — é assim que o `postgres_changes` entrega um UPDATE. */
const avisarMudanca = (page, id, mudanca) => page.evaluate(([cid, m]) => {
  const c = globalThis.__TABELAS.conversas.find((x) => x.id === cid);
  Object.assign(c, m);
  const { contato, ...linha } = c;
  return globalThis.__EMITIR("UPDATE", "conversas", { ...linha });
}, [id, mudanca]);

/** A lista está na ordem da espera? Quem espera, da mais antiga para a mais
 *  nova; quem não espera, depois. Conferido na lista INTEIRA da tela, e não
 *  só nas plantadas: o defeito embaralhava todo mundo. */
const naOrdemDaEspera = (page) => page.evaluate(() => {
  const T = globalThis.__TABELAS.conversas;
  const ids = [...document.querySelectorAll("[data-conversa-id]")].map((n) => n.getAttribute("data-conversa-id"));
  const esp = ids.map((id) => {
    const c = T.find((x) => String(x.id) === id);
    if (!c || c.fixada) return null;          // fixadas têm régua própria
    return c.esperando_desde ? new Date(c.esperando_desde).getTime() : Infinity;
  }).filter((x) => x !== null);
  for (let i = 1; i < esp.length; i++) if (esp[i] < esp[i - 1]) return { certo: false, onde: i, total: esp.length };
  return { certo: true, total: esp.length };
});

// ==================================================================
console.log("\nCom “Esperando”, abrir uma conversa não mexe na fila");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE);
  ok("a ordem “Esperando” é oferecida", await escolherOrdem(page, "esperando"));
  const antes = await ordemNaTela(page);
  ok("as quatro plantadas estão na fila, da espera mais antiga para a mais nova",
     soAsPlantadas(antes).join(",") === "cv-f48,cv-f30,cv-f20,cv-f07", soAsPlantadas(antes).join(","));
  const r0 = await naOrdemDaEspera(page);
  ok("e a lista inteira está na ordem da espera", r0.certo, JSON.stringify(r0));

  // O GESTO DO RELATO: clicar numa conversa do meio. O painel zera as não
  // lidas no banco, e o banco avisa todo mundo pelo tempo real.
  await page.locator('[data-conversa-id="cv-f20"]').first().click();
  await page.waitForTimeout(700);
  const ouviram = await avisarMudanca(page, "cv-f20", { nao_lidas: 0 });
  ok("(o painel está ouvindo as mudanças de conversa)", ouviram > 0, `ouvintes: ${ouviram}`);
  await page.waitForTimeout(600);
  const depois = await ordemNaTela(page);
  ok("abrir a conversa não mudou a posição de NINGUÉM na lista",
     depois.join(",") === antes.join(","),
     `antes ${soAsPlantadas(antes).join(",")} · depois ${soAsPlantadas(depois).join(",")}`);
  const r1 = await naOrdemDaEspera(page);
  ok("e a lista continua na ordem da espera", r1.certo, JSON.stringify(r1));

  // CHEGOU MENSAGEM de quem já espera há 7 dias: a última atividade vira
  // agora, a espera não muda. Em "Recentes" ela subiria; aqui, fica.
  await avisarMudanca(page, "cv-f07", { ultima_mensagem: "alguém aí?",
                                         ultima_atividade: new Date().toISOString(), nao_lidas: 2 });
  await page.waitForTimeout(600);
  const comMensagem = await ordemNaTela(page);
  ok("mensagem nova de quem já estava na fila não o faz pular de lugar",
     soAsPlantadas(comMensagem).join(",") === "cv-f48,cv-f30,cv-f20,cv-f07",
     soAsPlantadas(comMensagem).join(","));

  // O CONTRASTE: respondemos a de 48 dias. O banco zera a espera, e o tempo
  // real traz NULO — é a notícia, e tem de valer.
  await avisarMudanca(page, "cv-f48", { esperando_desde: null, ultima_atividade: new Date().toISOString(),
                                         ultima_mensagem: "Bom dia! Já verifiquei." });
  await page.waitForTimeout(600);
  const respondida = soAsPlantadas(await ordemNaTela(page));
  ok("a conversa respondida sai do alto da fila e vai para depois de quem espera",
     respondida.indexOf("cv-f48") > respondida.indexOf("cv-f07"), respondida.join(","));
  const selo = await page.evaluate(() =>
    document.querySelector('[data-conversa-id="cv-f48"] [data-espera]')?.innerText || null);
  ok("e a linha dela para de dizer “esperando há 48 dias”", selo === null, `selo: ${selo}`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nEm “Antigas”, abrir uma conversa também não vira a lista");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE);
  ok("a ordem “Antigas” é oferecida", await escolherOrdem(page, "antigas"));
  const antes = await ordemNaTela(page);
  // A ORDEM EM SI, e não só "não mexeu": uma tela que desenhasse "Recentes"
  // com a pílula dizendo "Antigas" continuaria parada depois do clique — e
  // passaria na de baixo. A sabotagem que esquecia o sentido vazou por aqui.
  const crescente = await page.evaluate(() => {
    const T = globalThis.__TABELAS.conversas;
    const t = [...document.querySelectorAll("[data-conversa-id]")].map((n) => {
      const c = T.find((x) => String(x.id) === n.getAttribute("data-conversa-id"));
      return c && !c.fixada ? new Date(c.ultima_atividade).getTime() : null;
    }).filter((x) => x !== null);
    return t.length > 2 && t.every((v, i) => i === 0 || v >= t[i - 1]);
  });
  ok("a lista está da mensagem mais antiga para a mais nova", crescente);
  const alvo = antes[Math.min(3, antes.length - 1)];
  await page.locator(`[data-conversa-id="${alvo}"]`).first().click();
  await page.waitForTimeout(700);
  await avisarMudanca(page, alvo, { nao_lidas: 0 });
  await page.waitForTimeout(600);
  const depois = await ordemNaTela(page);
  ok("a lista continua a mesma, na mesma ordem", depois.join(",") === antes.join(","),
     `antes ${antes.slice(0, 6).join(",")} · depois ${depois.slice(0, 6).join(",")}`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
