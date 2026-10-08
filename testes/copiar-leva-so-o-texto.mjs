// COPIAR LEVA SÓ O TEXTO (08/10) — relato do Rodrigo: "quando eu copio uma
// mensagem do Zorvin e colo em um documento do Word, a formatação fica com o
// fundo verde".
//
// O botão "Copiar" do menu da mensagem já copiava texto puro. O defeito era o
// outro caminho, o de todo dia: selecionar com o mouse e apertar Ctrl+C. Aí o
// navegador manda o texto E um HTML com as cores da tela, e o Word cola o HTML
// — a bolha verde vai junto.
//
// O QUE ESTA PROVA GUARDA, com Ctrl+C DE VERDADE e lendo a área de
// transferência do navegador (e não um evento fingido, que provaria o
// ouvinte e não o que o Word recebe):
//
//   1. a mensagem copiada chega como TEXTO, e nada de HTML;
//   2. o texto é o da mensagem, com as quebras de linha;
//   3. duas bolhas selecionadas juntas chegam em duas linhas, e não coladas;
//   4. vale para a tela inteira, e não só para as bolhas (o nome no alto da
//      conversa);
//   5. copiar de dentro da caixa de escrever continua funcionando.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';
const RECEBIDA = "Recebi, obrigada!";
const ENVIADA = "Seu acordo foi registrado.\nO boleto chega amanhã.";

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const agora = Date.now();
const CONTATO = { id: "ct-copia", numero: "5511948230201", nome: "Cliente da Cópia", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const SEMENTE = {
  contatos: [CONTATO],
  conversas: [{
    id: "cv-copia", advogado_id: ADV, contato_id: CONTATO.id,
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: new Date(agora - 60000).toISOString(), esperando_desde: null, tratada_em: null,
    ultima_mensagem: "…", frente: null, digitando_ate: null, vantoro_nome: null, contato: CONTATO,
  }],
  mensagens: [
    { id: "m-cp-1", conversa_id: "cv-copia", origem: "contato", tipo: "texto", texto: RECEBIDA,
      criado_em: new Date(agora - 180000).toISOString() },
    { id: "m-cp-2", conversa_id: "cv-copia", origem: "advogado", tipo: "texto", texto: ENVIADA,
      status: "enviada", criado_em: new Date(agora - 120000).toISOString() },
  ],
};

const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(ENDERECO).origin });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
await page.addInitScript((semente) => { globalThis.__SEMENTE = semente; }, SEMENTE);
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Seleciona, na tela, do começo do texto `de` ao fim do texto `ate` — como
 *  quem arrasta o mouse. Devolve se achou os dois. */
const selecionar = (de, ate) => page.evaluate(({ de, ate }) => {
  const acha = (t) => {
    const ida = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = ida.nextNode(); n; n = ida.nextNode()) {
      const i = n.data.indexOf(t);
      if (i >= 0) return { n, i };
    }
    return null;
  };
  const a = acha(de), b = acha(ate);
  if (!a || !b) return false;
  const r = document.createRange();
  r.setStart(a.n, a.i);
  r.setEnd(b.n, b.i + ate.length);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  return true;
}, { de, ate });

/** Limpa a área de transferência, aperta Ctrl+C e lê o que ficou lá: os
 *  tipos (é o "text/html" que leva o fundo verde para o Word) e o texto. */
async function copiarELer() {
  await page.evaluate(() => navigator.clipboard.writeText("(nada copiado)"));
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const itens = await navigator.clipboard.read();
    const tipos = itens.flatMap((i) => i.types);
    let html = "";
    for (const i of itens) {
      if (i.types.includes("text/html")) html = await (await i.getType("text/html")).text();
    }
    return { tipos, html, texto: await navigator.clipboard.readText() };
  });
}

const linha = page.locator('[data-conversa-id="cv-copia"]');
ok("a conversa plantada está na lista", (await linha.count()) > 0);
if (await linha.count()) { await linha.first().click(); await page.waitForTimeout(1000); }

console.log("\n1. Uma mensagem enviada, a da bolha verde");
{
  ok("selecionei o texto da bolha verde", await selecionar("Seu acordo", "chega amanhã."));
  const c = await copiarELer();
  const fundo = (c.html.match(/background(-color)?:[^;"]*/) || [""])[0];
  ok("chega à área de transferência como texto, sem HTML", !c.tipos.includes("text/html"),
     `tipos ${q(c.tipos)}${fundo ? " — e o HTML levava o fundo: " + fundo : ""}`);
  ok("e o texto é o da mensagem, com a quebra de linha", c.texto === ENVIADA, q(c.texto));
}

console.log("\n2. Duas bolhas de uma vez");
{
  ok("selecionei das duas bolhas", await selecionar("Recebi,", "registrado."));
  const c = await copiarELer();
  ok("sem HTML também", !c.tipos.includes("text/html"), q(c.tipos));
  ok("as duas mensagens chegam, cada uma na sua linha",
     /Recebi, obrigada!/.test(c.texto) && /\n[\s\S]*Seu acordo foi registrado\./.test(c.texto)
     && !/obrigada!Seu/.test(c.texto), q(c.texto));
}

console.log("\n3. Fora das bolhas: o nome no alto da conversa");
{
  ok("selecionei o nome do alto", await selecionar("Cliente da Cópia", "Cliente da Cópia"));
  const c = await copiarELer();
  ok("sem HTML fora das bolhas também", !c.tipos.includes("text/html"), q(c.tipos));
  ok("e o texto é o nome", c.texto.trim() === "Cliente da Cópia", q(c.texto));
}

console.log("\n4. A caixa de escrever continua copiando");
{
  const caixa = page.locator(CAMPO);
  ok("achei a caixa de escrever", (await caixa.count()) === 1);
  if (await caixa.count()) {
    await caixa.fill("texto escrito na caixa");
    await caixa.evaluate((el) => { el.focus(); el.setSelectionRange(0, 5); });
  }
  const c = await copiarELer();
  ok("Ctrl+C na caixa copia o que foi selecionado nela", c.texto === "texto", q(c.texto));
}

console.log("\n5. Ctrl+C sem nada selecionado");
{
  // O QUE ESTAVA COPIADO NÃO PODE SUMIR. Um Ctrl+C sem querer, sem nada
  // selecionado, não fazia nada; trocar a cópia por texto não pode virar
  // "apaga a área de transferência".
  await page.evaluate(() => { getSelection().removeAllRanges(); document.activeElement?.blur?.(); });
  await page.evaluate(() => navigator.clipboard.writeText("o que estava copiado antes"));
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(300);
  const depois = await page.evaluate(() => navigator.clipboard.readText());
  ok("não apaga o que estava copiado", depois === "o que estava copiado antes", q(depois));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
