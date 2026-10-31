// A TRANSCRIÇÃO CHEGA SOZINHA (31/10) — desde 31/10 a ponte transcreve
// sozinha todo áudio que chega (ver o CLAUDE.md dela), e o painel tem de
// acompanhar em três lugares:
//
//   1. a bolha do áudio mostra o texto quando a ponte o grava — pelo tempo
//      real, sem ninguém clicar e sem reabrir a conversa;
//   2. a lupa da conversa procura também no que foi dito nos áudios: no banco
//      (o áudio fora da tela) e na tela, sem acento, sem contar duas vezes a
//      mesma mensagem; e se só a parte dos áudios falhar, diz isso;
//   3. a busca da lista mostra a conversa achada por um áudio com o 🎤 (o
//      motivo 'audio' do script 040 da ponte), e abre a conversa no áudio.
//
// A CONVERSA É PLANTADA pela prova (`__SEMENTE`): um áudio de 400 dias atrás
// já transcrito, 130 mensagens de enchimento depois dele (a conversa abre com
// as 120 últimas, então ele fica FORA da tela), uma mensagem escrita e um
// áudio novo, ainda sem texto.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const AUDIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const nav = await abrirNavegador();
const AGORA = Date.now();

// O TELEFONE QUE ABRE: a conversa plantada tem de ser dele, senão ela nem
// aparece na lista.
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
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

const NOME = "CLIENTE DOS AUDIOS";
const em = (minutos) => new Date(AGORA - minutos * 60e3).toISOString();
function semente() {
  const base = { conversa_id: "cv-audios", origem: "contato" };
  const s = {
    contatos: [{ id: "ct-audios", numero: "5511970008801", nome: NOME }],
    conversas: [{
      id: "cv-audios", advogado_id: TEL, contato_id: "ct-audios", nao_lidas: 0, arquivada: false,
      fixada: false, favorita: false, ultima_atividade: em(0.5), esperando_desde: null, tratada_em: null,
      situacao: "aberto", protocolo: null, ultima_mensagem: "[anexo]", frente: null,
      contato: { id: "ct-audios", nome: NOME, numero: "5511970008801", foto_url: null },
    }],
    mensagens: [
      // O ÁUDIO VELHO, já transcrito, FORA DA TELA. É ele que separa "a lupa
      // perguntou ao banco pela transcrição" de "a lupa olhou a tela".
      { ...base, id: "aud-velho", tipo: "audio", texto: null, midia_url: AUDIO, midia_mime: "audio/ogg",
        transcricao: "a conciliação do xilógrafo ficou para terça", transcrita_em: em(400 * 1440),
        criado_em: em(400 * 1440) },
    ],
  };
  for (let i = 1; i <= 130; i++) {
    s.mensagens.push({ ...base, id: `enchimento-${i}`, tipo: "texto", texto: `mensagem de enchimento ${i}`,
                       criado_em: em(300 - i) });
  }
  s.mensagens.push(
    { ...base, id: "txt-marimba", tipo: "texto", texto: "o recibo da marimba chegou", criado_em: em(2) },
    // O ÁUDIO NOVO, ainda sem texto: a ponte vai transcrevê-lo durante a prova.
    { ...base, id: "aud-novo", tipo: "audio", texto: null, midia_url: AUDIO, midia_mime: "audio/ogg",
      criado_em: em(1) },
  );
  return s;
}

async function abrirPainel({ quebrarOsAudios = false, semAColuna = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // A PONTE DE MENTIRA conta os pedidos de transcrição: a transcrição que
  // chega sozinha não pode ter passado por um clique.
  const pedidosDeTranscricao = [];
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/transcrever")) pedidosDeTranscricao.push(rota.request().postData());
    return rota.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript(({ s, quebrarOsAudios, semAColuna }) => {
    globalThis.__SEMENTE = s;
    globalThis.__QUEBRAR_A_BUSCA_NA_CONVERSA = false;
    globalThis.__QUEBRAR_A_BUSCA_NOS_AUDIOS = quebrarOsAudios;
    globalThis.__SEM_COLUNAS = semAColuna ? { mensagens: ["transcricao"] } : {};
  }, { s: semente(), quebrarOsAudios, semAColuna });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros, pedidosDeTranscricao };
}

/** Clique GUARDADO: o que não existe não estoura a prova. */
async function clicar(page, alvo) {
  const l = typeof alvo === "string" ? page.locator(alvo) : alvo;
  if (!(await l.count())) return false;
  await l.first().click({ timeout: 5000 }).catch(() => {});
  return true;
}
const abrirAConversa = async (page) => {
  const abriu = await clicar(page, '[data-conversa-id="cv-audios"]');
  await page.waitForTimeout(1500);
  return abriu;
};
const bolha = (page, id) => page.locator(`[data-msg-id="${id}"]`);
const texto = async (loc) => ((await loc.count()) ? (await loc.first().innerText().catch(() => "")) : "");
/** Abre a lupa e escreve o termo; devolve a contagem que ela mostra. */
async function procurarNaConversa(page, termo) {
  if (!(await page.locator('input[placeholder="Buscar nesta conversa"]').count())) {
    await clicar(page, page.getByRole("button", { name: "Buscar na conversa" }));
    await page.waitForTimeout(300);
  }
  const campo = page.locator('input[placeholder="Buscar nesta conversa"]');
  if (!(await campo.count())) return "(a lupa não abriu)";
  await campo.fill(termo);
  await page.waitForTimeout(1600);
  return texto(page.locator("[data-contagem-da-busca-na-conversa]"));
}
/** A bolha achada tem o contorno amarelo da busca. */
const contornada = (page, id) => page.evaluate((mid) => {
  const el = document.querySelector(`[data-msg-id="${mid}"]`);
  if (!el) return false;
  return [...el.querySelectorAll("*")].some((x) => /solid/.test(getComputedStyle(x).outlineStyle) && getComputedStyle(x).outlineWidth === "2px");
}, id);

// ==================================================================
console.log("\n1. A transcrição que a ponte grava aparece na bolha, sem clicar e sem reabrir");
{
  const { ctx, page, estouros, pedidosDeTranscricao } = await abrirPainel();
  ok("a conversa plantada abriu", await abrirAConversa(page));
  ok("o áudio novo ainda não tem texto: tem o botão “Transcrever”",
     (await bolha(page, "aud-novo").locator("[data-transcrever]").count()) === 1
       && (await bolha(page, "aud-novo").locator("[data-transcricao]").count()) === 0);
  await page.evaluate(() => globalThis.__TRANSCRICAO_PELA_PONTE("aud-novo", "mandei o recibo da zabumba agora"));
  await page.waitForTimeout(800);
  const dito = await texto(bolha(page, "aud-novo").locator("[data-transcricao]"));
  ok("a transcrição aparece na bolha sozinha, pelo tempo real", /recibo da zabumba/.test(dito), dito);
  ok("e o botão sai", (await bolha(page, "aud-novo").locator("[data-transcrever]").count()) === 0);
  ok("sem nenhum pedido de transcrição à ponte (ninguém clicou)", pedidosDeTranscricao.length === 0,
     `foram ${pedidosDeTranscricao.length}`);

  // ================================================================
  console.log("\n2. A lupa da conversa procura no que foi dito nos áudios");
  ok("o áudio velho está FORA da tela (a conversa abre com as 120 últimas)",
     (await bolha(page, "aud-velho").count()) === 0);
  const contagem = await procurarNaConversa(page, "xilografo");
  ok("a lupa acha, sem acento, o que foi dito num áudio fora da tela", /^1 de 1$/.test(contagem.trim()), contagem);
  await page.waitForTimeout(1500);
  ok("e leva até ele: o áudio velho entra na tela", (await bolha(page, "aud-velho").count()) === 1);
  ok("com o contorno da busca", await contornada(page, "aud-velho"));
  const naTela = await procurarNaConversa(page, "zabumba");
  ok("o que foi dito no áudio da tela também é achado — uma vez só, e não duas (banco e tela)",
     /^1 de 1$/.test(naTela.trim()), naTela);
  ok("com o contorno da busca na bolha do áudio", await contornada(page, "aud-novo"));
  const escrito = await procurarNaConversa(page, "marimba");
  ok("o que foi escrito continua sendo achado", /^1 de 1$/.test(escrito.trim()), escrito);
  ok("e nenhuma frase de falha aparece",
     (await page.locator("[data-busca-so-na-tela], [data-busca-sem-os-audios]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Só a parte dos áudios falha: a lupa diz isso, e procura os áudios da tela");
{
  const { ctx, page, estouros } = await abrirPainel({ quebrarOsAudios: true });
  await abrirAConversa(page);
  await page.evaluate(() => globalThis.__TRANSCRICAO_PELA_PONTE("aud-novo", "mandei o recibo da zabumba agora"));
  await page.waitForTimeout(600);
  const velho = await procurarNaConversa(page, "xilografo");
  const frase = await texto(page.locator("[data-busca-sem-os-audios]"));
  ok("a frase diz que o escrito foi procurado e os áudios fora da tela não",
     /não no que foi dito nos áudios fora da tela/.test(frase), frase);
  ok("com o código do banco", /57014/.test(frase), frase);
  ok("e NÃO diz que procurou só na tela (o texto foi procurado inteiro)",
     (await page.locator("[data-busca-so-na-tela]").count()) === 0);
  ok("o áudio fora da tela não foi achado (a frase explica por quê)", /^0$/.test(velho.trim()), velho);
  const daTela = await procurarNaConversa(page, "zabumba");
  ok("o áudio que está na tela é achado assim mesmo", /^1 de 1$/.test(daTela.trim()), daTela);
  const escrito = await procurarNaConversa(page, "marimba");
  ok("e o escrito continua achado pelo banco", /^1 de 1$/.test(escrito.trim()), escrito);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Num banco sem a coluna da transcrição, a lupa procura no texto, calada");
{
  const { ctx, page, estouros } = await abrirPainel({ semAColuna: true });
  await abrirAConversa(page);
  const escrito = await procurarNaConversa(page, "marimba");
  ok("o que foi escrito é achado", /^1 de 1$/.test(escrito.trim()), escrito);
  ok("e nenhuma frase de falha aparece — a coluna que falta não é uma falha",
     (await page.locator("[data-busca-so-na-tela], [data-busca-sem-os-audios]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. A busca da lista mostra o 🎤 para a conversa achada por um áudio, e abre nele");
{
  const { ctx, page, estouros } = await abrirPainel();
  const busca = page.locator('input[placeholder^="Buscar"]').first();
  ok("achei a busca da lista", (await busca.count()) === 1);
  await busca.fill("xilografo");
  await page.waitForTimeout(1800);
  const linha = page.locator('[data-conversa-id="cv-audios"]').first();
  const dito = await texto(linha);
  ok("a conversa aparece com o trecho do que foi dito", /conciliação do xilógrafo/.test(dito), dito);
  ok("com o 🎤 na frente", /🎤 a conciliação do xilógrafo/.test(dito), dito);
  ok("e sem o 💬 junto", !/💬/.test(dito), dito);
  await clicar(page, linha);
  await page.waitForTimeout(2200);
  ok("clicar abre a conversa NO áudio", (await bolha(page, "aud-velho").count()) === 1);

  await busca.fill("marimba");
  await page.waitForTimeout(1800);
  const escrito = await texto(page.locator('[data-conversa-id="cv-audios"]').first());
  ok("a achada por mensagem escrita continua com o 💬", /💬 o recibo da marimba/.test(escrito), escrito);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
