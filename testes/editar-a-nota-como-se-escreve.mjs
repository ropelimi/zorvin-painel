// EDITAR A NOTA É ESCREVER A NOTA — o mesmo campo, e o processo também se troca.
//
// RELATO DE QUEM USA: "sobre a nota interna, ao editar a nota tem que seguir a
// mesma forma de escrita da nota, com a caixa de texto lá em cima, e com a
// possibilidade também de alterar o processo vinculado".
//
// O QUE HAVIA. O botão de editar fazia `setModoNota(false)`: a caixa voltava
// ao modo MENSAGEM para corrigir uma NOTA. Verde em vez de âmbar, dizendo
// "Corrija a mensagem e aperte Enter" — e, sobretudo, SEM a barra do processo,
// que só existe no modo nota.
//
// Quer dizer: não havia como trocar o processo vinculado. A única saída era
// apagar a nota e escrever outra — perdendo quem escreveu e quando, que é
// exatamente para o que a nota interna serve.
//
// AS DUAS ARMADILHAS QUE ISTO CRIA, e que esta prova vigia:
//
//  1. `enviar()` perguntava por `modoNota` ANTES de `editando`. Acender o modo
//     nota na edição faria o Enter criar uma nota NOVA e deixar a velha
//     intacta — o erro e a correção lado a lado.
//
//  2. A lista de processos do cliente vem do Vantoro, pela rede, DEPOIS de o
//     modo nota acender. Entre o clique em "editar" e a resposta dela a lista
//     está vazia — e gravar nesse instante apagaria o vínculo. Corrigir uma
//     vírgula depressa custaria o processo da nota, em silêncio, no mesmo
//     campo que já perdeu 289 notas no banco do escritório.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// A ficha do cliente, com dois processos para haver o que trocar.
// `atrasoDaFicha` é o instrumento da armadilha 2: com ele em pé, a lista
// demora a chegar e dá para apertar Enter antes.
let atrasoDaFicha = 0;
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
    if (atrasoDaFicha) await new Promise((r) => setTimeout(r, atrasoDaFicha));
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, cliente: { id: "v-901", nome: "WW Cliente",
        processos: [
          { id: 11, numero: "0001111-11.2026.8.26.0100", reu: "BANCO WW S.A.", tipo_acao: "X" },
          { id: 22, numero: "0002222-22.2026.8.26.0100", reu: "OPERADORA WW LTDA", tipo_acao: "X" },
        ] } }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

const molde = await page.evaluate(() => {
  const id = document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id");
  const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
  const m = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
  return c ? { advogado_id: c.advogado_id, mensagem: m || null } : null;
});
ok("aprendi o feitio da conversa na amostra", !!molde?.advogado_id);

const agora = Date.now();
const SEMENTE = {
  contatos: [{ id: "ct-ed", nome: "WW Nota Editavel", numero: "5521977660009",
               vantoro_cliente_id: "v-901", vantoro_nome: null, nome_zorvin: null }],
  conversas: [{
    id: "conv-ed", contato_id: "ct-ed", advogado_id: molde.advogado_id,
    fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
    ultima_mensagem: null, ultima_atividade: new Date(agora - 60000).toISOString(),
    frente: null, vantoro_nome: null, digitando_ate: null,
    atendendo_por: null, atendendo_em: null,
    contato: { nome: "WW Nota Editavel", numero: "5521977660009", foto_url: null,
               vantoro_cliente_id: "v-901", vantoro_nome: null, nome_zorvin: null },
  }],
  mensagens: [{ ...molde.mensagem, id: "msg-ed", conversa_id: "conv-ed",
                texto: "oi", criado_em: new Date(agora - 90000).toISOString() }],
  // A NOTA JÁ NASCE VINCULADA ao processo 11. É o estado de onde a correção
  // parte: sem um vínculo prévio não dá para provar que ele foi TROCADO — só
  // que foi posto, que é outra coisa.
  notas: [{ id: "n-ed", conversa_id: "conv-ed", texto: "combinado com o cliente",
            autor: "Rodrigo", autor_id: null, autor_foto: null,
            apagada_em: null, editada_em: null, editada_por: null,
            processo_id: 11, processo_numero: "0001111-11.2026.8.26.0100",
            processo_reu: "BANCO WW S.A.",
            criado_em: new Date(agora - 30000).toISOString() }],
};
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

await page.locator('[data-conversa-nome*="WW Nota Editavel"]').first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(900);

const caixa = () => page.locator("textarea").first();
const seletor = () => page.locator("[data-processo-da-nota] select");
const botaoEditar = () => page.locator('button[title="Editar nota"]').first();

const notaNoBanco = () => page.evaluate(() =>
  (globalThis.__TABELAS.notas || []).find((n) => String(n.id) === "n-ed") || null);

console.log("\nEditar a nota é escrever a nota");

ok("a nota de prova está na tela",
   (await page.locator('text="combinado com o cliente"').count()) > 0);

// ------------------------------------------------------------
//  1. O CAMPO É O DA NOTA, e não o da mensagem
// ------------------------------------------------------------
await botaoEditar().click();
await page.waitForTimeout(1200);

ok("o modo nota está aceso ao editar",
   (await page.locator("[data-nota-interna]").first().getAttribute("aria-pressed")) === "true");
ok("o campo é o da NOTA, e não o da mensagem",
   (await caixa().getAttribute("data-campo")) === "nota");
const dica = await caixa().getAttribute("placeholder");
ok("e a dica fala em nota, não em mensagem",
   /nota/i.test(dica || "") && !/mensagem/i.test(dica || ""), `dizia: "${dica}"`);
ok("o texto da nota já está na caixa",
   (await caixa().inputValue()) === "combinado com o cliente");

// ------------------------------------------------------------
//  2. A BARRA DO PROCESSO APARECE, JÁ NO PROCESSO DA NOTA
//
//  Vir em branco seria pior do que não vir: quem salvasse sem mexer estaria
//  desvinculando sem saber.
// ------------------------------------------------------------
ok("a barra do processo aparece na edição",
   (await seletor().count()) === 1,
   "sem ela não há como trocar o processo — era o pedido");
ok("e vem apontando para o processo QUE A NOTA TEM",
   (await seletor().inputValue()) === "11",
   `veio "${await seletor().inputValue()}" — em branco significaria desvincular sem querer`);

// ------------------------------------------------------------
//  3. TROCAR O PROCESSO E O TEXTO, DE UMA VEZ
// ------------------------------------------------------------
await seletor().selectOption("22");
await page.waitForTimeout(300);
await caixa().fill("combinado com o cliente na segunda ação");
await caixa().press("Enter");
await page.waitForTimeout(1500);

const depois = await notaNoBanco();
ok("o texto corrigido foi gravado",
   depois && depois.texto === "combinado com o cliente na segunda ação",
   JSON.stringify(depois));
ok("e o processo TROCADO foi gravado junto",
   depois && String(depois.processo_id) === "22",
   `ficou processo_id=${depois && depois.processo_id}`);
ok("com o número e o réu do processo novo",
   depois && /0002222-22/.test(depois.processo_numero || "")
   && /OPERADORA WW/.test(depois.processo_reu || ""),
   JSON.stringify(depois));

// A NOTA CONTINUA SENDO UMA SÓ. É a armadilha 1: com `modoNota` sendo
// perguntado antes de `editando`, o Enter criaria uma nota NOVA e deixaria a
// velha — o erro e a correção lado a lado na conversa.
// DESTA CONVERSA, e não da bancada inteira: ela nasce com dezenas de notas
// noutras conversas, e contar todas media o cenário em vez de medir o
// conserto — a primeira volta desta prova reprovou dizendo "ficaram 35".
const quantas = await page.evaluate(() => (globalThis.__TABELAS.notas || [])
  .filter((n) => String(n.conversa_id) === "conv-ed").length);
ok("e continua havendo UMA nota, não duas",
   quantas === 1, `ficaram ${quantas}`);

// ------------------------------------------------------------
//  4. DESVINCULAR É POSSÍVEL, e grava nulo
// ------------------------------------------------------------
await botaoEditar().click();
await page.waitForTimeout(1200);
await seletor().selectOption("");
await page.waitForTimeout(300);
await caixa().press("Enter");
await page.waitForTimeout(1500);
const semProcesso = await notaNoBanco();
ok("escolher 'nota geral' desvincula de verdade",
   semProcesso && (semProcesso.processo_id === null || semProcesso.processo_id === undefined),
   `ficou processo_id=${JSON.stringify(semProcesso && semProcesso.processo_id)}`);

// ------------------------------------------------------------
//  5. A CORRIDA: salvar ANTES de a lista de processos chegar
//
//  Este é o caso que apagaria o vínculo por causa da velocidade de quem
//  digita. Com a ficha demorando 3 segundos, o Enter acontece com a lista
//  ainda vazia — e o processo TEM de continuar onde estava.
// ------------------------------------------------------------
await page.evaluate(() => {
  const n = (globalThis.__TABELAS.notas || []).find((x) => String(x.id) === "n-ed");
  if (n) { n.processo_id = 11; n.processo_numero = "0001111-11.2026.8.26.0100";
           n.processo_reu = "BANCO WW S.A."; }
});
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);
await page.locator('[data-conversa-nome*="WW Nota Editavel"]').first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(900);

atrasoDaFicha = 3000;
await botaoEditar().click();
await page.waitForTimeout(400);   // curto DE PROPÓSITO: a lista ainda não chegou
ok("a lista de processos ainda não chegou (é o instante do risco)",
   (await seletor().count()) === 0,
   "sem esse instante a conferência abaixo não prova nada");
await caixa().fill("correção rápida, antes da lista");
await caixa().press("Enter");
await page.waitForTimeout(1800);

const naCorrida = await notaNoBanco();
ok("o texto foi corrigido mesmo com a lista ausente",
   naCorrida && naCorrida.texto === "correção rápida, antes da lista",
   JSON.stringify(naCorrida));
ok("e o processo NÃO foi apagado pela pressa",
   naCorrida && String(naCorrida.processo_id) === "11",
   `ficou processo_id=${JSON.stringify(naCorrida && naCorrida.processo_id)}`);
atrasoDaFicha = 0;

ok("nenhum erro de página no caminho", erros.length === 0, erros.join(" | "));

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
await nav.close();
process.exit(falhas ? 1 : 0);
