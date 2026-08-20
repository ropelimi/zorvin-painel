// O ARQUIVO QUE CHEGA DEPOIS DA BOLHA.
//
// Relato de quem usa: "ao enviar ou receber algum arquivo, está demorando para
// aparecer o arquivo na conversa".
//
// A causa estava na ponte: ela esperava o download inteiro da Uazapi — e a
// subida para o Storage — ANTES de gravar a mensagem. Enquanto isso a conversa
// ficava vazia. Não era o arquivo que demorava a aparecer: era a mensagem que
// ainda não existia. Medido na bancada da ponte: com o download demorando
// 1200ms, a bolha nascia em 1287ms.
//
// A ponte foi invertida. A mensagem nasce na hora com a MINIATURA que já vem
// embutida no webhook, e o arquivo de verdade entra no lugar quando chega.
//
// ESTA PROVA VIGIA O OUTRO LADO DA INVERSÃO, que é onde ela pode virar um
// defeito novo: a troca acontece no banco, mas precisa acontecer NA TELA de
// quem está com a conversa aberta. O tratador de UPDATE do painel copiava só
// `status` e `reacoes` — a miniatura borrada ficaria ali até alguém recarregar
// a página, e teríamos trocado "demora para aparecer" por "aparece borrada e
// nunca melhora", que é pior: o primeiro passa, o segundo não.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Manda um aviso de tempo real, igualzinho ao que o Supabase mandaria. */
async function chegou(tabela, linha, evento = "INSERT") {
  return page.evaluate(([t, l, e]) => globalThis.__EMITIR(e, t, l), [tabela, linha, evento]);
}

// Uma miniatura de verdade: 1 pixel, para o navegador de fato carregá-la e o
// `src` valer como prova. Uma string inventada seria imagem quebrada, e imagem
// quebrada também "aparece" — a conferência passaria sem querer.
const MINIATURA = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const ARQUIVO_DE_VERDADE = "http://127.0.0.1:5199/storage/v1/object/public/anexos/recebidos/tardio-1.jpg";

// Abre a primeira conversa: a troca só precisa acontecer na tela de quem está
// com ela ABERTA, que é justamente quem está esperando a foto.
await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(800);
const conversa = await page.evaluate(() =>
  document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));

const ID = "tardio-1";

/** O `src` da imagem da nossa bolha, e quantas bolhas com esse id existem. */
async function bolha() {
  return page.evaluate((id) => {
    const imgs = [...document.querySelectorAll("img")]
      .filter((i) => i.getAttribute("data-msg-id") === id
                  || (i.closest("[data-msg-id]")
                      && i.closest("[data-msg-id]").getAttribute("data-msg-id") === id));
    const donos = [...document.querySelectorAll(`[data-msg-id="${id}"]`)];
    return { src: imgs[0] ? imgs[0].getAttribute("src") : null, quantas: donos.length };
  }, ID);
}

console.log("\nA bancada entrega os avisos de tempo real");
{
  // Sem isto tudo abaixo seria teatro: os eventos sairiam e ninguém ouviria.
  const quantos = await page.evaluate(() =>
    typeof globalThis.__EMITIR === "function"
      ? globalThis.__EMITIR("INSERT", "mensagens", { id: "nada", conversa_id: "x", tipo: "texto" })
      : -1);
  ok("o painel está mesmo ouvindo as mensagens", quantos > 0,
     quantos === -1 ? "a bancada não expõe o gatilho" : `${quantos} tratadores ouvindo`);
}

console.log("\nA foto aparece na hora, ainda como miniatura");
{
  await chegou("mensagens", {
    id: ID, conversa_id: conversa, tipo: "imagem", origem: "contato",
    texto: "segue a certidão", midia_url: MINIATURA, midia_mime: "image/jpeg",
    criado_em: new Date().toISOString(),
  });
  await page.waitForTimeout(700);

  const b = await bolha();
  ok("a bolha nasce sem esperar o arquivo", b.quantas === 1,
     `achei ${b.quantas} bolha(s) com o id ${ID}`);
  ok("e já mostra alguma coisa, em vez de um quadrado vazio",
     String(b.src || "").startsWith("data:image/"),
     `src: "${String(b.src || "").slice(0, 40)}"`);

  // A LEGENDA. Ela vinha em `caption` e a ponte não lia esse campo no
  // recebimento ao vivo — só na importação de histórico. O cliente mandava a
  // foto com "essa é a de casamento" e a frase sumia.
  const texto = await page.evaluate((id) => {
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    return el ? el.innerText : "";
  }, ID);
  ok("com a legenda que o cliente escreveu", /segue a certidão/i.test(texto),
     `a bolha dizia: "${String(texto).replace(/\s+/g, " ").slice(0, 80)}"`);
}

console.log("\nE quando o arquivo de verdade chega, ele entra no lugar");
{
  // É EXATAMENTE ISTO que o tratador de UPDATE não fazia. O evento é o mesmo
  // que o Supabase manda quando a ponte troca a coluna.
  await chegou("mensagens", {
    id: ID, conversa_id: conversa, tipo: "imagem", origem: "contato",
    texto: "segue a certidão", midia_url: ARQUIVO_DE_VERDADE, midia_mime: "image/jpeg",
    criado_em: new Date().toISOString(),
  }, "UPDATE");
  await page.waitForTimeout(700);

  const b = await bolha();
  ok("a imagem passa a apontar para o arquivo, sem recarregar a página",
     String(b.src || "").includes("/storage/"),
     `src continuou "${String(b.src || "").slice(0, 45)}" — `
     + "quem está com a conversa aberta ficaria com a miniatura borrada");
  ok("e continua sendo UMA bolha, não duas", b.quantas === 1,
     `viraram ${b.quantas}`);
}

console.log("\nE um UPDATE que não fala de mídia não apaga a que já está lá");
{
  // O tiquinho de "entregue" chega como UPDATE e não traz `midia_url`. Se a
  // cópia fosse cega, o recibo de entrega apagaria a foto da tela — um defeito
  // muito pior do que o que veio consertar, e que só apareceria em produção.
  await chegou("mensagens", {
    id: ID, conversa_id: conversa, status: "lida",
  }, "UPDATE");
  await page.waitForTimeout(500);

  const b = await bolha();
  ok("a foto continua na tela depois do recibo de entrega",
     String(b.src || "").includes("/storage/"),
     `src virou "${String(b.src || "").slice(0, 45)}"`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
