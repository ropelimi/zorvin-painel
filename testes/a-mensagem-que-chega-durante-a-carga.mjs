// A MENSAGEM QUE CHEGA DURANTE A CARGA NÃO SOME (auditoria de 28/10)
//
// `carregarMensagens` termina trocando a lista inteira pelo que o banco
// devolveu (`juntas`), e só guardava as bolhas provisórias (`temp-…`). A
// consulta é uma foto do banco: o que o tempo real pôs na tela DEPOIS da foto
// e ANTES do fim da carga era jogado fora. Dois jeitos de isso acontecer:
//
//   A. o cliente escreve enquanto a conversa abre — a bolha aparece, pisca e
//      some, e só volta quando alguém sai e entra de novo;
//   B. o eco da própria mensagem chega no meio da releitura da conferência do
//      envio (12 s depois de mandar, quando o aviso se atrasou): o tratador já
//      tinha trocado a provisória pela gravada, e a carga apagava a gravada. A
//      mensagem enviada SUMIA da conversa — convite a mandar de novo, e o
//      cliente recebia duas.
//
// O QUE ESTA PROVA GUARDA: nos dois casos a linha que o tempo real trouxe
// continua na tela depois da carga, uma vez só; e a conversa trocada no meio
// não herda nada da anterior.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

/** O telefone que o painel abre — as conversas desta prova moram nele. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const TEL = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const NOMES = { a: "CARGA CLIENTE ALFA", b: "CARGA CLIENTE BETA" };
const conversa = (k, i) => ({
  id: `cv-carga-${k}`, advogado_id: TEL, contato_id: `ct-carga-${k}`, nao_lidas: 0, arquivada: false,
  fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3 - i * 1000).toISOString(),
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
  contato: { id: `ct-carga-${k}`, nome: NOMES[k], numero: `551197000880${i}`, foto_url: null },
});
const SEMENTE = {
  contatos: Object.keys(NOMES).map((k, i) => ({ id: `ct-carga-${k}`, numero: `551197000880${i + 1}`,
                                                nome: NOMES[k], vantoro_nome: null, nome_zorvin: null })),
  conversas: [conversa("a", 1), conversa("b", 2)],
  mensagens: ["a", "b"].flatMap((k) => [1, 2, 3].map((n) => ({
    id: `m-carga-${k}-${n}`, conversa_id: `cv-carga-${k}`, origem: n === 2 ? "advogado" : "contato",
    tipo: "texto", texto: `conversa ${k}, mensagem ${n}`, id_uazapi: `uz-carga-${k}-${n}`,
    criado_em: new Date(AGORA - (10 - n) * 60e3).toISOString(),
    ...(n === 2 ? { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "lida" } : {}),
  }))),
};

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__CONFERENCIA_DO_ENVIO = [900, 2200];
    globalThis.__ATRASO_POR_TABELA = {};
    globalThis.__DIARIO = null;
  }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}
/** Clique GUARDADO: o que não existe não estoura a prova inteira. */
async function clicar(page, sel) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
/** As bolhas da conversa aberta com este texto, e o que cada uma diz do envio. */
const bolhasCom = (page, texto) => page.evaluate((t) =>
  [...document.querySelectorAll("[data-msg-id]")]
    .filter((el) => (el.textContent || "").includes(t))
    .map((el) => ({
      id: el.getAttribute("data-msg-id"),
      estado: el.querySelector("[data-estado-do-envio]")?.getAttribute("data-estado-do-envio") || null,
    })), texto);
/** Espera a leitura de `mensagens` que está EM VOO — a foto já foi tirada, e
 *  a resposta ainda não voltou. É o instante exato do defeito. */
const leituraEmVoo = (page) => page.waitForFunction(() =>
  (globalThis.__DIARIO || []).some((m) => m.tabela === "mensagens" && !m.fim), null, { timeout: 8000 })
  .then(() => true, () => false);
const leiturasTerminaram = (page) => page.waitForFunction(() =>
  !(globalThis.__DIARIO || []).some((m) => m.tabela === "mensagens" && !m.fim), null, { timeout: 10000 })
  .then(() => true, () => false);
const lento = (page) => page.evaluate(() => {
  globalThis.__DIARIO = [];
  globalThis.__ATRASO_POR_TABELA = { mensagens: 1500 };
});

// ==================================================================
console.log("\nA. O cliente escreve enquanto a conversa abre");
{
  const { ctx, page, estouros } = await abrirPainel();
  await lento(page);
  ok("abri a conversa do Alfa", await clicar(page, '[data-conversa-id="cv-carga-a"]'));
  ok("a leitura das mensagens está em voo", await leituraEmVoo(page));
  const TEXTO = "Queria saber do meu processo — escrito durante a carga";
  await page.evaluate((t) => globalThis.__MENSAGEM_PELA_PONTE("cv-carga-a", "contato", t), TEXTO);
  await page.waitForTimeout(300);
  ok("o tempo real pôs a mensagem na tela", (await bolhasCom(page, TEXTO)).length === 1,
     JSON.stringify(await bolhasCom(page, TEXTO)));
  ok("a leitura terminou", await leiturasTerminaram(page));
  await page.waitForTimeout(600);
  const depois = await bolhasCom(page, TEXTO);
  ok("depois da carga, a mensagem do cliente CONTINUA na tela", depois.length === 1, JSON.stringify(depois));
  ok("e as que vieram do banco estão lá também",
     (await bolhasCom(page, "conversa a, mensagem")).length === 3);
  const ultima = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-msg-id]")].map((el) => el.getAttribute("data-msg-id"));
    return ids[ids.length - 1] || "";
  });
  ok("e ela é a última da conversa, onde chegou", depois.length === 1 && ultima === depois[0].id,
     `a última é ${ultima}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nB. O eco da mensagem enviada chega no meio da releitura da conferência");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a conversa do Alfa", await clicar(page, '[data-conversa-id="cv-carga-a"]'));
  await page.waitForTimeout(1200);
  await lento(page);
  const TEXTO = "Segue o boleto do acordo — prova da conferência";
  const caixa = page.locator('[data-campo="mensagem"]');
  ok("a caixa de escrever está na tela", (await caixa.count()) === 1);
  await caixa.fill(TEXTO);
  await caixa.press("Enter");
  await page.waitForTimeout(200);
  const saindo = await bolhasCom(page, TEXTO);
  ok("a bolha nasce com o relógio", saindo.length === 1 && saindo[0].estado === "enviando", JSON.stringify(saindo));
  // A CONFERÊNCIA RELÊ a conversa (900 ms aqui; 12 s no escritório), e a
  // leitura demora: é dentro dela que a ponte grava e o eco chega.
  ok("a conferência está relendo a conversa", await leituraEmVoo(page));
  const gravada = await page.evaluate((t) => {
    for (const f of (globalThis.__TABELAS.fila_envio || []).filter((x) => x.texto === t)) f.status = "enviada";
    return globalThis.__MENSAGEM_PELA_PONTE("cv-carga-a", "advogado", t, new Date().toISOString(),
      { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "enviada" }).id;
  }, TEXTO);
  await page.waitForTimeout(250);
  const trocada = await bolhasCom(page, TEXTO);
  ok("o eco trocou a provisória pela gravada", trocada.length === 1 && trocada[0].id === gravada,
     JSON.stringify(trocada));
  ok("a releitura terminou", await leiturasTerminaram(page));
  await page.waitForTimeout(600);
  const depois = await bolhasCom(page, TEXTO);
  ok("depois da releitura, a mensagem enviada CONTINUA na tela", depois.length === 1, JSON.stringify(depois));
  ok("e é a gravada, com os tiques — não some, nem volta ao relógio",
     depois.length === 1 && depois[0].id === gravada && depois[0].estado === "gravada", JSON.stringify(depois));
  // A SEGUNDA CONFERÊNCIA (2,2 s aqui) não tem mais o que conferir: se a
  // gravada tivesse sumido, ninguém a traria de volta.
  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = {}; });
  await page.waitForTimeout(2200);
  ok("e continua lá depois da segunda conferência", (await bolhasCom(page, TEXTO)).length === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nC. A linha que chega para a conversa ANTERIOR não atravessa a troca");
{
  // O CONTRASTE do conserto: guardar o que o tempo real trouxe não pode virar
  // guardar o que era de outra conversa. Troca-se de Alfa para Beta com a
  // leitura de Beta em voo, e uma mensagem de Alfa chega nesse meio.
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a conversa do Alfa", await clicar(page, '[data-conversa-id="cv-carga-a"]'));
  await page.waitForTimeout(1200);
  await lento(page);
  ok("troquei para a do Beta", await clicar(page, '[data-conversa-id="cv-carga-b"]'));
  ok("a leitura de Beta está em voo", await leituraEmVoo(page));
  const DE_A = "Esta é do Alfa, e não do Beta";
  const DE_B = "Esta é do Beta, durante a carga";
  await page.evaluate(([a, b]) => {
    globalThis.__MENSAGEM_PELA_PONTE("cv-carga-a", "contato", a);
    globalThis.__MENSAGEM_PELA_PONTE("cv-carga-b", "contato", b);
  }, [DE_A, DE_B]);
  ok("a leitura terminou", await leiturasTerminaram(page));
  await page.waitForTimeout(600);
  ok("na conversa do Beta, nenhuma mensagem do Alfa", (await bolhasCom(page, DE_A)).length === 0
     && (await bolhasCom(page, "conversa a, mensagem")).length === 0);
  ok("e a do Beta que chegou durante a carga está lá", (await bolhasCom(page, DE_B)).length === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
