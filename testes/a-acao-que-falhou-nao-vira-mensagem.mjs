// A REAÇÃO, A CORREÇÃO E O APAGAR QUE FALHARAM NÃO VIRAM MENSAGEM
// (auditoria de 28/10)
//
// Reagir, editar e "apagar para todos" também passam pela fila de envio
// (`tipo` = reacao, edicao, exclusao). A leitura das que não saíram trazia
// TODA linha com `status = 'erro'`, de qualquer tipo — e cada uma virava uma
// bolha nossa "não enviado · reenviar", com o emoji, o texto da correção ou
// nada dentro. O Reenviar tratava tudo o que não é texto como anexo: "Não
// consegui reenviar o anexo. Anexe o arquivo novamente." — para um 👍.
//
// Elas não são mensagens: a bolha a que se referem já diz a verdade do banco
// (a ponte só grava a reação, a correção e o apagar quando a Uazapi aceita).
//
// O QUE ESTA PROVA GUARDA: as três não viram bolha; a MENSAGEM que não saiu
// continua voltando como sempre, com o motivo e o Reenviar (o contraste —
// senão uma leitura que jogasse fora tudo passaria).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

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

const NOME = "ACAO CLIENTE PROVA";
const atras = (min) => new Date(AGORA - min * 60e3).toISOString();
const naFila = (id, tipo, texto, alvo, min) => ({ id, conversa_id: "cv-acao", tipo, texto, responder_id_uazapi: alvo,
  status: "erro", erro_motivo: "A Uazapi recusou.", erro_detalhe: "400 Bad Request",
  enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", criado_em: atras(min) });
const SEMENTE = {
  contatos: [{ id: "ct-acao", numero: "5511970005511", nome: NOME, vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-acao", advogado_id: TEL, contato_id: "ct-acao", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(),
    ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-acao", nome: NOME, numero: "5511970005511", foto_url: null } }],
  mensagens: [
    { id: "m-acao-1", conversa_id: "cv-acao", origem: "contato", tipo: "texto", texto: "Doutor, recebeu o documento?",
      id_uazapi: "uz-m-acao-1", criado_em: atras(30) },
    { id: "m-acao-2", conversa_id: "cv-acao", origem: "advogado", tipo: "texto", texto: "Recebi sim, obrigado",
      id_uazapi: "uz-m-acao-2", enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", status: "lida", criado_em: atras(25) },
  ],
  fila_envio: [
    naFila("f-acao-reacao", "reacao", "👍", "uz-m-acao-1", 20),
    naFila("f-acao-edicao", "edicao", "Recebi sim, muito obrigado — a correção que não chegou", "uz-m-acao-2", 15),
    naFila("f-acao-exclusao", "exclusao", "", "uz-m-acao-2", 10),
    // O CONTRASTE: a mensagem de verdade que não saiu.
    naFila("f-acao-texto", "texto", "Mensagem comum que não saiu", null, 5),
  ],
};

const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.addInitScript((s) => {
  globalThis.__SEMENTE = s;
  globalThis.__AVISOS_VISTOS = [];
  setInterval(() => {
    const el = document.querySelector("[data-aviso]");
    const t = el && el.innerText.trim();
    const v = globalThis.__AVISOS_VISTOS;
    if (t && v[v.length - 1] !== t) v.push(t);
  }, 50);
}, SEMENTE);
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.locator('[data-conversa-id="cv-acao"]').first().click().catch(() => {});
await page.waitForTimeout(1500);

const bolha = (id) => page.locator(`[data-msg-id="${id}"]`);

console.log("\nAs ações que falharam não viram bolha de mensagem");
ok("a conversa abriu, com as duas mensagens do banco",
   (await bolha("m-acao-1").count()) === 1 && (await bolha("m-acao-2").count()) === 1);
ok("a reação que falhou NÃO virou bolha", (await bolha("fila-f-acao-reacao").count()) === 0);
ok("a correção que falhou NÃO virou bolha", (await bolha("fila-f-acao-edicao").count()) === 0);
ok("o apagar que falhou NÃO virou bolha", (await bolha("fila-f-acao-exclusao").count()) === 0);
// O REENVIAR QUE FALAVA EM ANEXO: se a bolha da reação estiver lá, é nele que
// se clica.
if (await bolha("fila-f-acao-reacao").count()) {
  await bolha("fila-f-acao-reacao").locator("[data-reenviar]").first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);
}
const filme = await page.evaluate(() => globalThis.__AVISOS_VISTOS.join(" | "));
ok("e nada fala em reenviar anexo de uma reação", !/reenviar o anexo/i.test(filme), filme);

console.log("\nA mensagem que não saiu continua voltando, com o motivo e o Reenviar");
ok("a mensagem comum que não saiu está na conversa", (await bolha("fila-f-acao-texto").count()) === 1);
ok("com o Reenviar", (await bolha("fila-f-acao-texto").locator("[data-reenviar]").count()) === 1);
ok("e com o motivo", /A Uazapi recusou/.test(await page.evaluate(() => document.body.innerText)));
ok("a tela não estourou", !estouros.length, estouros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
