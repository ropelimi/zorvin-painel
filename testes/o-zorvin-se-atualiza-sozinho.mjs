// O ZORVIN SE ATUALIZA SOZINHO, E DIZ A VERSÃO (05/11)
//
// Pedido do Rodrigo: "Preciso de alguma forma o Zorvin atualizar sozinho para
// todos os usuários, porque é ruim ficar pedindo toda hora para todos os
// usuários ficarem apertando o Ctrl+Shift+R". E: "veja se dá para em algum
// lugar colocar a informação de qual é a versão atual do Zorvin".
//
// O que esta prova confere — fingindo a publicação: o `versao.json` que a aba
// pergunta é trocado pela prova, e a versão que a aba "roda" é dita por
// `__VERSAO_EM_USO` (o servidor da bancada não remonta o código):
//
//   - a versão aparece no pé do menu ⋮ e na tela de entrada ("Zorvin v1.500");
//   - sem versão nova (o arquivo de verdade do servidor), nada acontece — e
//     isso prova que o arquivo e o código dizem o mesmo;
//   - com versão nova, a aba NÃO recarrega enquanto a pessoa mexe na tela; a
//     faixa diz que há versão nova; parada a tela, ela recarrega sozinha,
//     volta para a MESMA conversa, diz que atualizou, e não recarrega de novo;
//   - o que se perderia segura a recarga: o texto na caixa de escrever, o
//     rascunho de outra conversa, a ficha por salvar, o anexo escolhido, o
//     texto digitado numa janela. A busca escrita não segura;
//   - "Atualizar agora" pergunta antes, dizendo o que se perde; e com a ficha
//     por salvar, o navegador não pergunta de novo;
//   - a recarga que não trouxe a versão nova não vira um círculo: a faixa
//     pede o Ctrl+Shift+R, e "Tentar de novo" recarrega uma vez;
//   - o arquivo que falha não faz nada; a aba escondida conta como parada; a
//     guia de uma tela recarrega na mesma tela; no celular, a faixa cabe;
//   - e a montagem escreve o `versao.json` com o mesmo identificador que vai
//     dentro do código.
//
// Os nomes são inventados (os repositórios são públicos).
// ------------------------------------------------------------
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CENAS = (process.env.CENAS || "").split(",").map((s) => s.trim()).filter(Boolean);
const vale = (cena) => !CENAS.length || CENAS.includes(cena);

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const VELHA = { id: "versao-velha-de-prova", rotulo: "v1.500" };
const NOVA = { id: "versao-nova-de-prova", rotulo: "v1.501" };
const NUMERO_DEUS = "5567992183107";
const CLIENTE = { id: "v-100", nome: "MARIA INVENTADA DA SILVA", cpf: "111.111.111-11",
                  telefone: NUMERO_DEUS, telefone2: "", ocupacao: "Costureira",
                  observacoes: "Prefere contato à tarde.", documentos: 0, processos: [], ordem_servico: null };

const nav = await abrirNavegador();

/** Abre o Zorvin com os relógios da atualização encurtados.
 *  - `arquivo`: o que o `versao.json` responde — `"servidor"` (o de verdade),
 *    um objeto, `404` ou `"lixo"`; e pode ser trocado no meio (`servir`);
 *  - `pega`: a recarga traz o código novo (a aba passa a "rodar" a NOVA);
 *  - `parada`: quanto tempo sem mexer conta como pausa. */
async function abrir(opcoes = {}) {
  const d = { arquivo: NOVA, pega: true, parada: 1500, emUso: VELHA, largura: 1500, altura: 900,
              celular: false, deslogado: false, endereco: ENDERECO, ficha: false, ...opcoes };
  const ctx = await nav.newContext(d.celular
    ? { viewport: { width: d.largura, height: d.altura }, isMobile: true, hasTouch: true }
    : { viewport: { width: d.largura, height: d.altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const dialogos = [];
  let responder = "recusar";
  page.on("dialog", async (dl) => {
    dialogos.push({ tipo: dl.type(), texto: dl.message() });
    try { if (responder === "aceitar") await dl.accept(); else await dl.dismiss(); } catch (_) { /* já foi */ }
  });
  let servida = d.arquivo;
  if (d.arquivo !== "servidor") {
    await ctx.route("**/versao.json*", async (rota) => {
      if (servida === 404) return rota.fulfill({ status: 404, body: "não achei" }).catch(() => {});
      if (servida === "lixo") return rota.fulfill({ status: 200, contentType: "application/json", body: "isto não é JSON" }).catch(() => {});
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ...servida, numero: null, commit: "" }) }).catch(() => {});
    });
  }
  if (d.ficha) {
    await ctx.route("**/ponte-de-mentira/**", async (rota) => {
      const url = new URL(rota.request().url());
      if (url.pathname.endsWith("/vantoro/cliente") && rota.request().method() === "GET") {
        return rota.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ clientes: [{ ...CLIENTE }], opcoes: {} }) }).catch(() => {});
      }
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }).catch(() => {});
    });
  }
  await ctx.addInitScript((d) => {
    const g = globalThis;
    g.__VERSAO_A_CADA_MS = 400;
    g.__VERSAO_PRIMEIRA_MS = 300;
    g.__OCIOSO_MS = d.parada;
    g.__TENTAR_ATUALIZAR_A_CADA_MS = 250;
    g.__AVISO_DE_ATUALIZADO_MS = 1500;
    if (d.deslogado) g.__DESLOGADO = true;
    // A VERSÃO QUE A ABA "RODA": a velha, até a recarga que traz a nova.
    if (d.emUso) {
      let marca = null;
      try { marca = JSON.parse(sessionStorage.getItem("zorvin_atualizacao") || "null"); } catch (_) { /* nada */ }
      let emUso = sessionStorage.getItem("prova_versao") || d.emUso.id;
      if (d.pega && marca && marca.para === d.nova.id) emUso = d.nova.id;
      sessionStorage.setItem("prova_versao", emUso);
      g.__VERSAO_EM_USO = emUso === d.nova.id ? d.nova : d.emUso;
    }
    sessionStorage.setItem("prova_cargas", String(Number(sessionStorage.getItem("prova_cargas") || 0) + 1));
  }, { ...d, arquivo: undefined, nova: NOVA });
  await page.goto(d.endereco);
  if (!d.deslogado && !String(d.endereco).includes("tela=")) {
    await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  }
  await page.waitForTimeout(800);
  return { ctx, page, estouros, dialogos,
           servir: (v) => { servida = v; },
           responder: (r) => { responder = r; } };
}

const cargas = (page) => page.evaluate(() => Number(sessionStorage.getItem("prova_cargas") || 0)).catch(() => -1);
const conta = (page, sel) => page.locator(sel).count().catch(() => 0);
const texto = async (page, sel) => ((await conta(page, sel)) ? (await page.locator(sel).first().innerText()).trim() : null);
const visivel = async (page, sel) => ((await conta(page, sel)) ? page.locator(sel).first().isVisible().catch(() => false) : false);
/** Mexe o mouse pela tela durante `ms`: é a pessoa trabalhando. */
async function mexer(page, ms) {
  const fim = Date.now() + ms;
  let i = 0;
  while (Date.now() < fim) {
    await page.mouse.move(400 + (i % 2) * 30, 300 + (i % 3) * 20).catch(() => {});
    i++;
    await page.waitForTimeout(150);
  }
}
/** Espera uma condição, até `ms`. */
async function esperar(fn, ms = 6000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return Boolean(await fn());
}
/** Cliques GUARDADOS: num elemento que não existe, `click()` estoura a prova
 *  inteira e esconde qual conferência pegou o defeito. */
async function clicar(loc, espera = 0) {
  if (!(await loc.count().catch(() => 0))) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  if (espera) await new Promise((r) => setTimeout(r, espera));
  return true;
}
const CAIXA = 'textarea[placeholder*="Digite"]';
/** Abre a conversa `n` da lista (pela posição: o nome pode mudar) e devolve o id e o nome. */
async function abrirConversa(page, n = 0) {
  const linhas = page.locator("[data-conversa-id]");
  if ((await linhas.count()) <= n) return null;
  const id = await linhas.nth(n).getAttribute("data-conversa-id");
  await clicar(page.locator(`[data-conversa-id="${id}"]`), 1200);
  return id;
}
const nomeDoAlto = (page) => texto(page, "[data-topo-conversa] [data-nome-do-contato]");
async function escreverNaCaixa(page, t) {
  if (!(await conta(page, CAIXA))) return false;
  await page.locator(CAIXA).first().click().catch(() => {});
  await page.keyboard.type(t, { delay: 10 });
  return true;
}

// ==================================================================
if (vale("1")) {
  console.log("\n1. A versão na tela: no pé do menu ⋮ e na tela de entrada");
  const { ctx, page, estouros } = await abrir({ arquivo: VELHA });
  ok("o menu ⋮ abriu", await clicar(page.getByRole("button", { name: "Menu" }), 400));
  ok("o pé do menu diz a versão", (await texto(page, "[data-versao-do-zorvin]")) === "Zorvin v1.500",
     q(await texto(page, "[data-versao-do-zorvin]")));
  ok("e ela está à vista dentro do menu", await visivel(page, "[data-versao-do-zorvin]"));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();

  const e = await abrir({ arquivo: VELHA, deslogado: true });
  await e.page.waitForSelector("form", { timeout: 15000 }).catch(() => {});
  ok("a tela de entrada diz a versão", (await texto(e.page, "[data-versao-do-zorvin]")) === "Zorvin v1.500",
     q(await texto(e.page, "[data-versao-do-zorvin]")));
  await e.ctx.close();
}

// ==================================================================
if (vale("2")) {
  console.log("\n2. Sem versão nova: o arquivo do servidor e o código dizem o mesmo, e nada acontece");
  // SEM `__VERSAO_EM_USO` e sem trocar o arquivo: o código que roda é o da
  // montagem, e o arquivo é o que o servidor serve. Se os dois discordassem,
  // a aba recarregaria aqui, sem publicação nenhuma.
  const { ctx, page, estouros } = await abrir({ arquivo: "servidor", emUso: null });
  const v = await page.evaluate(() => fetch("/versao.json", { cache: "no-store" }).then((r) => r.json()).catch(() => null));
  ok("o servidor serve o versao.json", Boolean(v && v.id), q(v));
  ok("com o rótulo no formato da versão", Boolean(v && /^v1(\.\d+| · [0-9a-f]{7})?$/.test(v.rotulo || "")), q(v && v.rotulo));
  await page.waitForTimeout(3500);
  ok("a aba não recarregou", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("e nenhuma faixa de versão apareceu", (await conta(page, "[data-versao-nova], [data-versao-nao-carregou]")) === 0);
  await clicar(page.getByRole("button", { name: "Menu" }), 300);
  ok("e o menu diz o rótulo que o arquivo diz", (await texto(page, "[data-versao-do-zorvin]")) === `Zorvin ${v && v.rotulo}`,
     q(await texto(page, "[data-versao-do-zorvin]")));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("3")) {
  console.log("\n3. Versão nova: espera a tela parar, recarrega sozinha e volta para a mesma conversa");
  const { ctx, page, estouros } = await abrir({ parada: 2000 });
  const id = await abrirConversa(page, 1);
  ok("abri uma conversa", Boolean(id), q(id));
  const nomeAntes = await nomeDoAlto(page);
  // A PESSOA TRABALHANDO: o mouse andando, e a versão nova já publicada.
  await mexer(page, 3500);
  ok("a faixa diz que há versão nova, com o rótulo",
     /versão nova do Zorvin \(v1\.501\)/.test((await texto(page, "[data-versao-nova]")) || ""),
     q(await texto(page, "[data-versao-nova]")));
  ok("e diz que ela entra sozinha", /entra sozinha/.test((await texto(page, "[data-versao-nova]")) || ""));
  ok("enquanto a pessoa mexe, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  // A TELA PARA.
  const recarregou = await esperar(async () => (await cargas(page)) === 2, 8000);
  ok("parada a tela, a aba recarregou sozinha", recarregou, `cargas: ${await cargas(page)}`);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await esperar(async () => Boolean(await nomeDoAlto(page)), 6000);
  ok("e voltou para a MESMA conversa", (await nomeDoAlto(page)) === nomeAntes,
     q({ antes: nomeAntes, depois: await nomeDoAlto(page) }));
  ok("e o endereço ficou limpo (o F5 não reabre a conversa)", !page.url().includes("conversa="), page.url());
  ok("a faixa diz que atualizou, com o rótulo",
     /atualizado para a v1\.501/.test((await texto(page, "[data-zorvin-atualizado]")) || ""),
     q(await texto(page, "[data-zorvin-atualizado]")));
  ok("e a de versão nova sumiu", (await conta(page, "[data-versao-nova]")) === 0);
  await page.waitForTimeout(2500);
  ok("e a aba não recarregou de novo", (await cargas(page)) === 2, `cargas: ${await cargas(page)}`);
  // O "ATUALIZADO" SOME DEPOIS DO PRIMEIRO GESTO, e não antes.
  ok("o aviso continua até alguém voltar a mexer", (await conta(page, "[data-zorvin-atualizado]")) === 1);
  await mexer(page, 300);
  const sumiu = await esperar(async () => (await conta(page, "[data-zorvin-atualizado]")) === 0, 4000);
  ok("depois do primeiro gesto, ele some sozinho", sumiu);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("4")) {
  console.log("\n4. O texto na caixa de escrever segura a recarga; \"Atualizar agora\" pergunta antes");
  // A PUBLICAÇÃO CHEGA NO MEIO DO TRABALHO: a aba abre com a versão de
  // sempre, e a nova é publicada depois de a pessoa começar a escrever.
  const { ctx, page, dialogos, responder, servir } = await abrir({ arquivo: VELHA });
  await abrirConversa(page, 1);
  ok("escrevi na caixa de escrever", await escreverNaCaixa(page, "Olá, já te respondo"));
  servir(NOVA);
  await page.waitForTimeout(4500);
  ok("com texto na caixa, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("o texto continua lá", ((await page.locator(CAIXA).first().inputValue().catch(() => "")) || "").includes("já te respondo"));
  ok("a faixa oferece atualizar agora", (await conta(page, "[data-versao-nova] [data-atualizar-agora]")) === 1);
  responder("recusar");
  await clicar(page.locator("[data-atualizar-agora]"), 800);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("\"Atualizar agora\" pergunta antes", Boolean(pergunta), q(dialogos));
  ok("e diz o que se perde", Boolean(pergunta && /o texto na caixa de escrever/.test(pergunta.texto)), q(pergunta));
  ok("recusando, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("e o texto continua lá", ((await page.locator(CAIXA).first().inputValue().catch(() => "")) || "").includes("já te respondo"));
  responder("aceitar");
  await clicar(page.locator("[data-atualizar-agora]"), 300);
  ok("aceitando, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  await ctx.close();
}

// ==================================================================
if (vale("5")) {
  console.log("\n5. O rascunho de outra conversa segura a recarga");
  const { ctx, page, dialogos, servir } = await abrir({ arquivo: VELHA });
  await abrirConversa(page, 1);
  await escreverNaCaixa(page, "Rascunho guardado para depois");
  await abrirConversa(page, 2);
  ok("na conversa nova, a caixa está vazia", ((await page.locator(CAIXA).first().inputValue().catch(() => "x")) || "") === "");
  servir(NOVA);
  await page.waitForTimeout(4500);
  ok("com um rascunho noutra conversa, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  await clicar(page.locator("[data-atualizar-agora]"), 800);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("a pergunta diz que é o rascunho de outra conversa", Boolean(pergunta && /rascunho de outra conversa/.test(pergunta.texto)), q(pergunta));
  await ctx.close();
}

// ==================================================================
if (vale("6")) {
  console.log("\n6. O texto digitado numa janela segura; a busca escrita não");
  {
    const { ctx, page, servir } = await abrir({ arquivo: VELHA });
    await clicar(page.getByRole("button", { name: "Menu" }), 300);
    await clicar(page.getByRole("button", { name: "Configurações" }), 600);
    await clicar(page.getByRole("button", { name: "Mensagens rápidas", exact: true }), 500);
    await clicar(page.getByRole("button", { name: "Nova", exact: true }), 400);
    const campo = page.locator("[data-texto-da-rapida-na-config]");
    ok("o formulário de uma rápida nova abriu", (await campo.count()) === 1);
    if (await campo.count()) { await campo.click(); await page.keyboard.type("Texto que ninguém salvou", { delay: 5 }); }
    servir(NOVA);
    await page.waitForTimeout(4500);
    ok("com texto digitado numa janela, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    const { ctx, page, servir } = await abrir({ arquivo: VELHA });
    const busca = page.locator('input[placeholder^="Buscar por nome"]');
    if (await busca.count()) { await busca.click(); await page.keyboard.type("zzzzzz", { delay: 5 }); }
    ok("escrevi na busca", ((await busca.inputValue().catch(() => "")) || "") === "zzzzzz");
    servir(NOVA);
    ok("com só a busca escrita, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 9000), `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
}

// ==================================================================
if (vale("7")) {
  console.log("\n7. O anexo escolhido segura a recarga");
  const { ctx, page, dialogos, servir } = await abrir({ arquivo: VELHA });
  await abrirConversa(page, 1);
  const entrada = page.locator('input[type="file"][multiple]');
  if (await entrada.count()) {
    await entrada.first().setInputFiles({ name: "procuracao-de-prova-atualiza.pdf", mimeType: "application/pdf",
                                          buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  }
  ok("a prévia do anexo abriu", await esperar(async () => (await conta(page, "[data-previa-anexo]")) === 1, 4000));
  servir(NOVA);
  await page.waitForTimeout(4500);
  ok("com o anexo escolhido, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  // A FAIXA FICA DEBAIXO DA PRÉVIA (que cobre a tela): pergunta-se pelo
  // botão da faixa por código.
  await page.evaluate(() => document.querySelector("[data-atualizar-agora]")?.click());
  await page.waitForTimeout(800);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("a pergunta diz que é o anexo", Boolean(pergunta && /anexo escolhido/.test(pergunta.texto)), q(pergunta));
  await ctx.close();
}

// ==================================================================
if (vale("8")) {
  console.log("\n8. A ficha por salvar segura a recarga, e o navegador não pergunta duas vezes");
  const { ctx, page, dialogos, responder, servir } = await abrir({ ficha: true, arquivo: VELHA });
  const deus = page.locator(`[data-conversa-nome*="Deus"]`);
  const deusId = (await deus.count())
    ? await deus.first().evaluate((n) => n.closest("[data-conversa-id]")?.getAttribute("data-conversa-id")) : null;
  if (deusId) await clicar(page.locator(`[data-conversa-id="${deusId}"]`), 1500);
  if (!(await conta(page, "[data-ficha]"))) await clicar(page.locator("[data-abrir-ficha]"), 1200);
  const obs = page.locator('[data-campo="observacoes"]');
  ok("a ficha abriu com as observações", (await obs.count()) === 1);
  if (await obs.count()) { await obs.click(); await page.keyboard.press("End"); await page.keyboard.type(" Ligou hoje.", { delay: 5 }); }
  ok("a ficha diz que há algo por salvar",
     (await page.locator("[data-salvar-ficha]").first().getAttribute("data-salvar-ficha").catch(() => null)) === "pendente");
  servir(NOVA);
  await page.waitForTimeout(4500);
  ok("com a ficha por salvar, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  responder("aceitar");
  await clicar(page.locator("[data-atualizar-agora]"), 300);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("a pergunta diz que é a ficha", Boolean(pergunta && /alterações não salvas da ficha/.test(pergunta.texto)), q(pergunta));
  ok("aceitando, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  ok("e o navegador NÃO perguntou de novo (beforeunload)", !dialogos.some((x) => x.tipo === "beforeunload"), q(dialogos));
  await ctx.close();
}

// ==================================================================
if (vale("9")) {
  console.log("\n9. A recarga que não trouxe a versão nova não vira um círculo");
  const { ctx, page } = await abrir({ pega: false });
  ok("a aba recarregou uma vez", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  ok("e não recarregou de novo", (await cargas(page)) === 2, `cargas: ${await cargas(page)}`);
  ok("a faixa diz que a versão nova não carregou", (await conta(page, "[data-versao-nao-carregou]")) === 1);
  ok("e pede o Ctrl+Shift+R", /Ctrl\+Shift\+R/.test((await texto(page, "[data-versao-nao-carregou]")) || ""),
     q(await texto(page, "[data-versao-nao-carregou]")));
  ok("sem a faixa de \"entra sozinha\" junto", (await conta(page, "[data-versao-nova]")) === 0);
  await clicar(page.locator("[data-versao-nao-carregou] [data-atualizar-agora]"), 300);
  ok("\"Tentar de novo\" recarrega uma vez", await esperar(async () => (await cargas(page)) === 3, 8000), `cargas: ${await cargas(page)}`);
  ok("pedindo o endereço com um carimbo (o navegador não responde de memória)", /[?&]v=\d+/.test(page.url()), page.url());
  await page.waitForTimeout(3000);
  ok("e não recarrega mais sozinha", (await cargas(page)) === 3, `cargas: ${await cargas(page)}`);
  await ctx.close();
}

// ==================================================================
if (vale("10")) {
  console.log("\n10. O arquivo que falha não faz nada");
  const { ctx, page, estouros, servir } = await abrir({ arquivo: 404 });
  await page.waitForTimeout(2500);
  ok("com o arquivo em 404, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  servir("lixo");
  await page.waitForTimeout(2500);
  ok("com o arquivo que não é JSON, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("e nenhuma faixa de versão apareceu", (await conta(page, "[data-versao-nova], [data-versao-nao-carregou]")) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("11")) {
  console.log("\n11. A aba escondida conta como parada");
  // UMA PAUSA LONGA (um minuto): só a aba escondida pode fazer a recarga
  // acontecer aqui.
  const { ctx, page } = await abrir({ parada: 60000 });
  await page.waitForTimeout(2500);
  ok("com a tela à vista e a pausa longa, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  ok("escondida a aba, ela recarrega", await esperar(async () => (await cargas(page)) === 2, 6000), `cargas: ${await cargas(page)}`);
  await ctx.close();
}

// ==================================================================
if (vale("12")) {
  console.log("\n12. A guia de uma tela recarrega na mesma tela");
  const { ctx, page } = await abrir({ endereco: `${ENDERECO}?tela=tarefas` });
  await page.waitForSelector('[data-tela="tarefas"]', { timeout: 15000 }).catch(() => {});
  ok("a guia das Tarefas abriu", (await conta(page, '[data-tela="tarefas"]')) >= 1);
  ok("ela recarregou sozinha", await esperar(async () => (await cargas(page)) === 2, 9000), `cargas: ${await cargas(page)}`);
  await page.waitForSelector('[data-tela="tarefas"]', { timeout: 15000 }).catch(() => {});
  ok("e continua na tela das Tarefas", page.url().includes("tela=tarefas") && (await conta(page, '[data-tela="tarefas"]')) >= 1, page.url());
  await ctx.close();
}

// ==================================================================
if (vale("13")) {
  console.log("\n13. No celular, a faixa cabe");
  const { ctx, page, servir } = await abrir({ celular: true, largura: 360, altura: 760, arquivo: VELHA });
  await abrirConversa(page, 0);
  await escreverNaCaixa(page, "Segura a recarga");
  servir(NOVA);
  await esperar(async () => (await conta(page, "[data-versao-nova]")) === 1, 4000);
  const medida = await page.evaluate(() => {
    const f = document.querySelector("[data-versao-nova]");
    const b = f && f.querySelector("[data-atualizar-agora]");
    const r = f && f.getBoundingClientRect();
    return { existe: Boolean(f), largura: r ? r.width : 0, direita: r ? r.right : 0,
             botao: b ? b.getBoundingClientRect().height : 0,
             rolaDeLado: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  ok("a faixa apareceu", medida.existe);
  ok("e cabe na tela", medida.direita <= 361, q(medida));
  ok("a página não rola de lado", !medida.rolaDeLado, q(medida));
  ok("o botão tem os 40 pontos de alvo de dedo", medida.botao >= 39.5, q(medida));
  await ctx.close();
}

// ==================================================================
if (vale("14")) {
  console.log("\n14. A montagem escreve o versao.json com o mesmo identificador do código");
  const pasta = mkdtempSync(join(tmpdir(), "zorvin-versao-"));
  const COMMIT_DA_RENDER = "0123456789abcdef0123456789abcdef01234567";
  let montou = false;
  try {
    // COMO NA RENDER: ela diz o commit publicado em `RENDER_GIT_COMMIT`.
    execFileSync("npx", ["vite", "build", "--outDir", pasta, "--emptyOutDir", "--logLevel", "error"],
                 { stdio: "ignore", env: { ...process.env, VITE_BANCADA: "", RENDER_GIT_COMMIT: COMMIT_DA_RENDER }, timeout: 240000 });
    montou = true;
  } catch (_) { /* conferido abaixo */ }
  ok("a montagem rodou", montou);
  let arquivo = null;
  try { arquivo = JSON.parse(readFileSync(join(pasta, "versao.json"), "utf8")); } catch (_) { /* conferido abaixo */ }
  ok("o versao.json foi escrito", Boolean(arquivo && arquivo.id), q(arquivo));
  ok("e o identificador é o commit que a Render publicou", Boolean(arquivo && arquivo.id === COMMIT_DA_RENDER), q(arquivo && arquivo.id));
  const codigo = (() => {
    try {
      return readdirSync(join(pasta, "assets")).filter((n) => n.endsWith(".js"))
        .map((n) => readFileSync(join(pasta, "assets", n), "utf8")).join("\n");
    } catch (_) { return ""; }
  })();
  ok("e o código leva o MESMO identificador", Boolean(arquivo && arquivo.id && codigo.includes(arquivo.id)));
  ok("e o mesmo rótulo", Boolean(arquivo && arquivo.rotulo && codigo.includes(arquivo.rotulo)), q(arquivo && arquivo.rotulo));
  ok("a hora da montagem fica fora do código (o pacote não muda a cada montagem do mesmo commit)",
     Boolean(arquivo && arquivo.montada_em && !codigo.includes(arquivo.montada_em)));
  // O RÓTULO SAI DO NÚMERO DA PR NA MENSAGEM DO COMMIT, quando há um.
  let assunto = "";
  try { assunto = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8" }).trim(); } catch (_) { /* sem git */ }
  const m = /\(#(\d+)\)\s*$/.exec(assunto) || /#(\d+)/.exec(assunto);
  if (m) ok("com o número da PR do último commit", Boolean(arquivo && arquivo.rotulo === `v1.${m[1]}`), q({ assunto, rotulo: arquivo && arquivo.rotulo }));
  else ok("sem número de PR no último commit, o rótulo leva o começo do commit",
          Boolean(arquivo && arquivo.rotulo === "v1 · 0123456"), q({ assunto, rotulo: arquivo && arquivo.rotulo }));
  rmSync(pasta, { recursive: true, force: true });
}

// ==================================================================
if (vale("15")) {
  console.log("\n15. O site fora do ar na hora de recarregar: a aba fica onde está");
  const { ctx, page, servir } = await abrir({ arquivo: VELHA });
  await abrirConversa(page, 1);
  const nomeAntes = await nomeDoAlto(page);
  const enderecoAntes = page.url();
  // O DOCUMENTO DO SITE NÃO RESPONDE (o arquivo da versão responde): recarregar
  // agora trocaria o Zorvin pela página de erro do navegador.
  await ctx.route((url) => url.pathname === "/" && url.search !== "", (rota) => rota.abort().catch(() => {}));
  await ctx.route((url) => url.pathname === "/" && url.search === "", (rota) => rota.abort().catch(() => {}));
  servir(NOVA);
  await page.waitForTimeout(4500);
  ok("a aba não saiu do lugar", page.url() === enderecoAntes, page.url());
  ok("e a conversa continua aberta", (await nomeDoAlto(page)) === nomeAntes, q(await nomeDoAlto(page)));
  ok("e a lista continua na tela", (await conta(page, "[data-conversa-nome]")) > 0);
  ok("e a faixa continua dizendo que há versão nova", (await conta(page, "[data-versao-nova]")) === 1);
  await ctx.close();
}

const pedidas = CENAS.filter((c) => !["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"].includes(c));
ok("toda cena pedida em CENAS existe", pedidas.length === 0, q(pedidas));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
