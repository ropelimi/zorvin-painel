// TRANSCREVER O ÁUDIO, AO CLICAR (02/10) — pedido da equipe: "colocar
// transcrição de áudio no Zorvin". Quem vai ao Groq é a PONTE; a bolha pede.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. o áudio sem transcrição tem o botão "Transcrever", e o clique pede À
//      PONTE (`/transcrever`) pela mensagem certa;
//   2. o texto aparece NA BOLHA, e o botão some;
//   3. o áudio que já tem transcrição guardada mostra o texto direto — sem
//      botão e sem ir à ponte (quem já pagou, pagou);
//   4. o erro é DITO na bolha com a frase da ponte, e o botão fica para tentar
//      de novo;
//   5. enquanto transcreve, o botão diz "Transcrevendo…" e um segundo clique
//      não manda um segundo pedido;
//   6. áudio sem arquivo não oferece transcrever (não há o que mandar).
//
// OS ÁUDIOS SÃO PLANTADOS pela prova (`__SEMENTE`): a bancada não tem nenhum.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const AUDIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-id]");
await page.waitForTimeout(1000);
const alvo = await page.evaluate(() =>
  document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id"));
ok("achei uma conversa para plantar os áudios", Boolean(alvo));

const agora = Date.now();
await page.addInitScript((d) => {
  const base = { conversa_id: d.alvo, origem: "contato", tipo: "audio", texto: null,
                 midia_mime: "audio/ogg", status: "enviada" };
  globalThis.__SEMENTE = { mensagens: [
    { ...base, id: "aud-sem", midia_url: d.audio, criado_em: new Date(d.agora - 3000).toISOString() },
    { ...base, id: "aud-com", midia_url: d.audio, transcricao: "Já transcrito antes, pela colega.",
      criado_em: new Date(d.agora - 2000).toISOString() },
    { ...base, id: "aud-vazio", midia_url: null, criado_em: new Date(d.agora - 1000).toISOString() },
  ] };
}, { alvo, audio: AUDIO, agora });

// A PONTE DE MENTIRA. `resposta` é trocada por cena.
const pedidos = [];
let resposta = { status: 200, corpo: { ok: true, texto: "Bom dia, doutor, mandei o comprovante.", guardada: true }, demora: 0 };
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (!url.pathname.endsWith("/transcrever")) {
    return rota.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  }
  pedidos.push({ corpo: JSON.parse(rota.request().postData() || "{}"),
                 autorizacao: rota.request().headers()["authorization"] || "" });
  if (resposta.demora) await new Promise((r) => setTimeout(r, resposta.demora));
  return rota.fulfill({ status: resposta.status, contentType: "application/json",
                        body: JSON.stringify(resposta.corpo) });
});

async function abrir() {
  await page.reload();
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(1000);
  await page.locator(`[data-conversa-id="${alvo}"]`).first().click();
  await page.waitForTimeout(1300);
}
const bolha = (id) => page.locator(`[data-msg-id="${id}"]`);
/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}

console.log("\n1. O áudio sem transcrição tem o botão, e o clique pede à ponte");
await abrir();
{
  ok("o áudio sem transcrição tem o botão “Transcrever”",
     (await bolha("aud-sem").locator("[data-transcrever]").count()) === 1);
  ok("clicou", await clicar(bolha("aud-sem").locator("[data-transcrever]")));
  await page.waitForTimeout(700);
  ok("foi UM pedido à ponte", pedidos.length === 1, `foram ${pedidos.length}`);
  ok("pela mensagem certa", pedidos[0]?.corpo?.mensagem_id === "aud-sem", JSON.stringify(pedidos[0]?.corpo));
  ok("com a sessão de quem pediu", /^Bearer .+/.test(pedidos[0]?.autorizacao || ""), pedidos[0]?.autorizacao);

  console.log("\n2. O texto aparece na bolha, e o botão some");
  const texto = await bolha("aud-sem").locator("[data-transcricao]").innerText().catch(() => "");
  ok("o texto está na bolha", /mandei o comprovante/.test(texto), texto);
  ok("e o botão saiu", (await bolha("aud-sem").locator("[data-transcrever]").count()) === 0);
}

console.log("\n3. O que já foi transcrito aparece direto, sem botão e sem ir à ponte");
{
  const texto = await bolha("aud-com").locator("[data-transcricao]").innerText().catch(() => "");
  ok("o texto guardado aparece", /Já transcrito antes/.test(texto), texto);
  ok("sem botão", (await bolha("aud-com").locator("[data-transcrever]").count()) === 0);
  ok("e ninguém pediu nada à ponte por ele", !pedidos.some((p) => p.corpo?.mensagem_id === "aud-com"));
}

console.log("\n6. Áudio sem arquivo não oferece transcrever");
ok("o áudio vazio não tem o botão", (await bolha("aud-vazio").locator("[data-transcrever]").count()) === 0);

console.log("\n4. O erro é dito na bolha, e dá para tentar de novo");
pedidos.length = 0;
resposta = { status: 503, corpo: { ok: false,
  erro: "A transcrição ainda não está ligada: falta a variável GROQ_API_KEY na Render (serviço da ponte)." } };
await abrir();
{
  await clicar(bolha("aud-sem").locator("[data-transcrever]"));
  await page.waitForTimeout(700);
  const erro = await bolha("aud-sem").locator("[data-transcricao-erro]").innerText().catch(() => "");
  ok("a frase da ponte aparece na bolha", /GROQ_API_KEY/.test(erro), erro);
  ok("sem texto de transcrição inventado", (await bolha("aud-sem").locator("[data-transcricao]").count()) === 0);
  const botao = await bolha("aud-sem").locator("[data-transcrever]").innerText().catch(() => "");
  ok("e o botão fica, oferecendo tentar de novo", /de novo/i.test(botao), botao);
  resposta = { status: 200, corpo: { ok: true, texto: "Agora foi.", guardada: true } };
  await clicar(bolha("aud-sem").locator("[data-transcrever]"));
  await page.waitForTimeout(700);
  const texto = await bolha("aud-sem").locator("[data-transcricao]").innerText().catch(() => "");
  ok("na segunda tentativa, o texto aparece", /Agora foi/.test(texto), texto);
  ok("e a frase do erro some", (await bolha("aud-sem").locator("[data-transcricao-erro]").count()) === 0);
}

console.log("\n5. Enquanto transcreve: “Transcrevendo…”, e um segundo clique não pede de novo");
pedidos.length = 0;
resposta = { status: 200, corpo: { ok: true, texto: "Demorou, mas veio.", guardada: true }, demora: 1500 };
await abrir();
{
  await clicar(bolha("aud-sem").locator("[data-transcrever]"));
  await page.waitForTimeout(250);
  const rotulo = await bolha("aud-sem").locator("[data-transcrever]").innerText().catch(() => "");
  ok("o botão diz “Transcrevendo…”", /Transcrevendo/.test(rotulo), rotulo);
  ok("e está desligado", await bolha("aud-sem").locator("[data-transcrever]").isDisabled().catch(() => false));
  await bolha("aud-sem").locator("[data-transcrever]").click({ force: true, timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(1800);
  ok("foi um pedido só", pedidos.length === 1, `foram ${pedidos.length}`);
  ok("e o texto chegou", /Demorou, mas veio/.test(
    await bolha("aud-sem").locator("[data-transcricao]").innerText().catch(() => "")));
}

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
