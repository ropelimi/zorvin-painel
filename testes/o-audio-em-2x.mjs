// O ÁUDIO EM 2x (02/10) — pedido da equipe: "colocar x2 nos áudios do Zorvin".
//
// O QUE ESTA PROVA GUARDA:
//
//   1. toda bolha de áudio tem o botão, e ele DIZ a velocidade de agora;
//   2. ele anda 1x → 1,5x → 2x → 1x, como o do WhatsApp;
//   3. a velocidade chega ao TOCADOR, e não só ao rótulo — um botão que muda
//      o número e deixa o áudio em 1x é o pior dos dois mundos;
//   4. escolhida numa bolha, vale para TODAS as bolhas na hora;
//   5. ela sobrevive ao arquivo carregar (o navegador devolve a velocidade
//      ao padrão quando carrega o áudio, e o arquivo só carrega no play) e ao
//      F5 (fica guardada no navegador);
//   6. um valor estranho guardado volta a 1x, sem estourar.
//
// OS ÁUDIOS SÃO PLANTADOS pela prova (`__SEMENTE`), numa conversa de verdade
// da bancada: ela não tem áudio nenhum, e emprestar uma bolha de texto
// mediria outra coisa.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// MEIO SEGUNDO DE SILÊNCIO, em WAV — o menor arquivo que o navegador aceita
// carregar de verdade, para a cena do "carregou e não voltou a 1x".
function silencioWav() {
  const taxa = 8000, n = 4000;
  const b = Buffer.alloc(44 + n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(taxa, 24); b.writeUInt32LE(taxa, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write("data", 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return "data:audio/wav;base64," + b.toString("base64");
}
const AUDIO = silencioWav();

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);
const alvo = await page.evaluate(() =>
  document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id"));
ok("achei uma conversa para plantar os áudios", !!alvo);

const agora = Date.now();
await page.addInitScript((d) => {
  globalThis.__SEMENTE = { mensagens: [0, 1].map((i) => ({
    id: `audio-2x-${i}`, conversa_id: d.alvo, origem: i ? "advogado" : "contato",
    tipo: "audio", texto: null, midia_url: d.audio, midia_mime: "audio/wav",
    status: "enviada", criado_em: new Date(d.agora - (2 - i) * 1000).toISOString(),
  })) };
}, { alvo, audio: AUDIO, agora });

async function abrir() {
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await page.locator(`[data-conversa-id="${alvo}"]`).first().click();
  await page.waitForTimeout(1500);
}
const botoes = () => page.locator("[data-velocidade-audio]");
const rotulos = () => botoes().allInnerTexts();
const tocadores = () => page.evaluate(() =>
  [...document.querySelectorAll("audio")].filter((a) => a.src.startsWith("data:audio/wav"))
    .map((a) => ({ r: a.playbackRate, d: a.defaultPlaybackRate })));
/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function trocar() {
  if (!(await botoes().count())) return false;
  await botoes().first().click();
  await page.waitForTimeout(300);
  return true;
}

console.log("\n1. Toda bolha de áudio tem o botão, e ele diz 1x");
await page.evaluate(() => { try { localStorage.removeItem("zorvin_velocidade_audio"); } catch (_) {} });
await abrir();
{
  const r = await rotulos();
  ok("as duas bolhas de áudio têm o botão", r.length === 2, `achei ${r.length}`);
  ok('e os dois dizem "1x"', r.length === 2 && r.every((t) => t.trim() === "1x"), r.join(","));
  const t = await tocadores();
  ok("e os dois tocadores estão em 1x", t.length === 2 && t.every((x) => x.r === 1), JSON.stringify(t));
}

console.log("\n2. Um clique: 1,5x — no rótulo, no tocador, e nas duas bolhas");
{
  await trocar();
  const r = await rotulos();
  ok('o botão clicado diz "1,5x"', r[0]?.trim() === "1,5x", r.join(","));
  ok("e o da outra bolha também", r.length === 2 && r[1]?.trim() === "1,5x", r.join(","));
  const t = await tocadores();
  ok("e os DOIS tocadores estão em 1,5x", t.length === 2 && t.every((x) => x.r === 1.5), JSON.stringify(t));
}

console.log("\n3. Outro clique: 2x — e continua 2x depois de o arquivo carregar");
{
  await trocar();
  const r = await rotulos();
  ok('os botões dizem "2x"', r.length === 2 && r.every((t) => t.trim() === "2x"), r.join(","));
  let t = await tocadores();
  ok("os tocadores estão em 2x", t.length === 2 && t.every((x) => x.r === 2), JSON.stringify(t));
  // `load()` é o que o navegador faz ao carregar o arquivo no primeiro play:
  // devolve a velocidade ao padrão. É aí que um 2x mal posto volta a 1x.
  await page.evaluate(() => document.querySelectorAll("audio").forEach((a) => a.load()));
  await page.waitForTimeout(800);
  t = await tocadores();
  ok("e continuam em 2x depois de carregar o arquivo", t.length === 2 && t.every((x) => x.r === 2),
     JSON.stringify(t));
}

console.log("\n4. A escolha sobrevive ao F5");
{
  await abrir();
  const r = await rotulos();
  ok('depois de recarregar, os botões dizem "2x"', r.length === 2 && r.every((t) => t.trim() === "2x"),
     r.join(","));
  const t = await tocadores();
  ok("e os tocadores já nascem em 2x", t.length === 2 && t.every((x) => x.r === 2), JSON.stringify(t));
}

console.log("\n5. O terceiro clique volta a 1x");
{
  await trocar();
  const r = await rotulos();
  ok('os botões voltam a "1x"', r.length === 2 && r.every((t) => t.trim() === "1x"), r.join(","));
  const t = await tocadores();
  ok("e os tocadores também", t.length === 2 && t.every((x) => x.r === 1), JSON.stringify(t));
}

console.log("\n6. Um valor estranho guardado vira 1x, sem estourar");
{
  await page.evaluate(() => localStorage.setItem("zorvin_velocidade_audio", "17"));
  await abrir();
  const r = await rotulos();
  ok('com "17" guardado, os botões dizem "1x"', r.length === 2 && r.every((t) => t.trim() === "1x"),
     r.join(","));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
