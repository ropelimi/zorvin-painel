// O ZORVIN SE ATUALIZA SOZINHO, E DIZ A VERSÃO (05/11)
//
// Pedido do Rodrigo: "Preciso de alguma forma o Zorvin atualizar sozinho para
// todos os usuários, porque é ruim ficar pedindo toda hora para todos os
// usuários ficarem apertando o Ctrl+Shift+R". E: "veja se dá para em algum
// lugar colocar a informação de qual é a versão atual do Zorvin".
//
// E A SEGUNDA RODADA, do mesmo dia: "A atualização deve ser mais sútil, sem
// atrapalhar a operação" — "não quero nem sonhar em isso acontecendo". E a
// versão em centenas: a entrega 314 é a v3.14, a 400 a v4.00, com a data.
//
// O que esta prova confere — fingindo a publicação: o `versao.json` que a aba
// pergunta é trocado pela prova, e a versão que a aba "roda" é dita por
// `__VERSAO_EM_USO` (o servidor da bancada não remonta o código):
//
//   - a versão aparece no pé do menu ⋮ e na tela de entrada ("Zorvin v5.00 ·
//     04/11"), e o arquivo do servidor diz o mesmo que o código;
//   - COM A ABA À VISTA, DE DIA, NUNCA RECARREGA: há um pontinho no ⋮ e o
//     "Atualizar o Zorvin" dentro do menu, e nenhuma faixa;
//   - ESCONDIDA HÁ UM TEMPO, ela recarrega, e a volta traz a tela como estava:
//     a conversa, a aba da lista, os filtros, a busca, os responsáveis, a
//     pasta de arquivadas e o filtro de quem participou. E ela ESPERA quando a
//     volta não seria igual: a conversa rolada para cima, a lista rolada, uma
//     janela aberta por cima;
//   - DE MADRUGADA (das 0h às 6h, com a aba parada), recarrega mesmo à vista;
//   - NA VOLTA DO DESCANSO (o relógio que salta), recarrega com a aba ainda
//     escondida e ninguém tendo mexido;
//   - o que se perderia segura a recarga em qualquer momento (o texto na
//     caixa, o rascunho, o texto numa janela, o anexo, a ficha), e o
//     "Atualizar o Zorvin" pergunta antes, dizendo o quê;
//   - a recarga que não trouxe a versão nova não vira um círculo;
//   - AS MENSAGENS QUE CHEGAM NOS SEGUNDOS DA RECARGA ganham o aviso, sem
//     repetir o que a página velha já avisou;
//   - e a montagem escreve o `versao.json` com o mesmo identificador, o
//     rótulo em centenas e a data do commit.
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
const TODAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const VELHA = { id: "versao-velha-de-prova", rotulo: "v5.00", numero: 500, data: "04/11", quando: "04/11/2026 às 10:00" };
const NOVA = { id: "versao-nova-de-prova", rotulo: "v5.01", numero: 501, data: "05/11", quando: "05/11/2026 às 01:12" };
const NUMERO_DEUS = "5567992183107";
const CLIENTE = { id: "v-100", nome: "MARIA INVENTADA DA SILVA", cpf: "111.111.111-11",
                  telefone: NUMERO_DEUS, telefone2: "", ocupacao: "Costureira",
                  observacoes: "Prefere contato à tarde.", documentos: 0, processos: [], ordem_servico: null };
const JEN = "u-jenifer";
// AS MENSAGENS DA CENA 20, uma por caso.
const AVISO = {
  conversa: "a7-prova-aviso", contato: "ct-prova-aviso", rajada: "a7-prova-rajada",
  recente: "Mandei o documento agora, durante a atualização",
  adiantado: "Chegou também, com o relógio do computador adiantado",
  antiga: "Esta é de quatro minutos antes, e já tinha sido vista",
  aoVivo: "Esta chegou antes da atualização, e já avisou",
  depoisDoF5: "Esta chegou pelo tempo real, depois do F5",
  doF5: "Esta estava no banco quando a pessoa apertou F5",
};

const nav = await abrirNavegador();

/** Abre o Zorvin com os relógios da atualização encurtados.
 *  - `arquivo`: o que o `versao.json` responde — `"servidor"` (o de verdade),
 *    um objeto, `404` ou `"lixo"`; e pode ser trocado no meio (`servir`);
 *  - `pega`: a recarga traz o código novo (a aba passa a "rodar" a NOVA);
 *  - `escondida`: há quanto tempo escondida a aba das conversas recarrega;
 *  - `madrugada`: as horas da madrugada ([de, até]); `[0, 0]` é nunca, e
 *    `null` deixa as de verdade (das 0h às 6h);
 *  - `relogio`: instala o relógio de mentira (`true`, ou a hora em que ele
 *    começa), para a cena do descanso e a das horas de verdade. */
async function abrir(opcoes = {}) {
  const d = { arquivo: NOVA, pega: true, emUso: VELHA, largura: 1500, altura: 900,
              celular: false, deslogado: false, endereco: ENDERECO, ficha: false,
              escondida: 1500, madrugada: [0, 0], paradaMadrugada: 1500,
              batida: 300, salto: 20000, janela: 8000, relogio: null,
              espiao: false, aviso: false, rajada: false, arquivada: false, ...opcoes };
  const contexto = d.celular
    ? { viewport: { width: d.largura, height: d.altura }, isMobile: true, hasTouch: true }
    : { viewport: { width: d.largura, height: d.altura } };
  const ctx = await nav.newContext({ ...contexto, timezoneId: "America/Sao_Paulo" });
  if (d.relogio) await ctx.clock.install(d.relogio === true ? {} : { time: d.relogio });
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
        body: JSON.stringify({ ...servida, commit: "" }) }).catch(() => {});
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
    g.__TENTAR_ATUALIZAR_A_CADA_MS = 250;
    g.__ESCONDIDA_HA_MS = d.escondida;
    g.__PARADA_DA_MADRUGADA_MS = d.paradaMadrugada;
    if (d.madrugada) g.__MADRUGADA = d.madrugada;
    g.__BATIDA_MS = d.batida;
    g.__SALTO_MS = d.salto;
    g.__JANELA_DA_VOLTA_MS = d.janela;
    if (d.deslogado) g.__DESLOGADO = true;
    // A RECARGA FEITA PELO ZORVIN deixa na guia a foto da tela, com o
    // MOMENTO que a decidiu. A prova o anota antes de o painel ler a foto (e
    // apagá-la): é assim que cada cena sabe qual regra recarregou.
    let foto = null;
    try { foto = JSON.parse(sessionStorage.getItem("zorvin_volta_da_atualizacao") || "null"); } catch (_) { foto = null; }
    if (foto) {
      let lista = [];
      try { lista = JSON.parse(sessionStorage.getItem("prova_momentos") || "[]"); } catch (_) { lista = []; }
      lista.push(foto.momento || "?");
      sessionStorage.setItem("prova_momentos", JSON.stringify(lista));
    }
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
    // AS LINHAS PLANTADAS.
    const semente = { contatos: [], conversas: [], mensagens: [] };
    const conversa = (id, contato, texto, quando, extra = {}) => ({
      id, advogado_id: "a7", contato_id: contato.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
      ultima_atividade: quando, ultima_mensagem: texto, frente: null, vantoro_nome: null, digitando_ate: null,
      contato: { ...contato }, ...extra,
    });
    const mensagem = (id, conversaId, texto, quando) => ({
      id, conversa_id: conversaId, origem: "contato", tipo: "texto", texto,
      enviado_por: null, enviado_por_id: null, criado_em: quando,
    });
    if (d.arquivada) {
      const ct = { id: "ct-prova-arq", numero: "5567911112222", nome: "ARQUIVO DE PROVA INVENTADO",
                   vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
      const quando = new Date(Date.now() - 3 * 86400e3).toISOString();
      semente.contatos.push(ct);
      semente.conversas.push(conversa("a7-prova-arq", ct, "Combinado, obrigado", quando, { arquivada: true }));
      semente.mensagens.push(mensagem("m-prova-arq", "a7-prova-arq", "Combinado, obrigado", quando));
    }
    if (d.aviso) {
      const ct = { id: d.av.contato, numero: "5567933334444", nome: "CLIENTE NOVO INVENTADO",
                   vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
      const aoVivoEm = Number(sessionStorage.getItem("prova_ao_vivo_em") || 0);
      const quandoDaConversa = new Date(Date.now() - 10 * 60e3).toISOString();
      semente.contatos.push(ct);
      semente.conversas.push(conversa(d.av.conversa, ct, d.av.antiga, quandoDaConversa));
      // NO BANCO, DESDE SEMPRE: a de quatro minutos antes.
      // E O QUE CHEGOU NO MEIO DA RECARGA, só na página que nasceu dela —
      // contado do instante em que a velha saiu (a foto).
      if (foto && foto.em) {
        const em = Number(foto.em);
        semente.mensagens.push(mensagem("m-prova-antiga", d.av.conversa, d.av.antiga, new Date(em - 4 * 60e3).toISOString()));
        semente.mensagens.push(mensagem("m-prova-adiantada", d.av.conversa, d.av.adiantado, new Date(em - 60e3).toISOString()));
        semente.mensagens.push(mensagem("m-prova-recente", d.av.conversa, d.av.recente, new Date(em + 500).toISOString()));
        if (aoVivoEm) semente.mensagens.push(mensagem("m-prova-ao-vivo", d.av.conversa, d.av.aoVivo, new Date(aoVivoEm).toISOString()));
        // E UMA RAJADA DE OUTRO CLIENTE, entre 110 e 72 segundos antes: com
        // ela, passam de 50 as mensagens da janela, e só as mais recentes vêm.
        // SÓ NA JANELA QUE A PEDE (`rajada`): com ela, a de quatro minutos
        // antes ficaria fora das 50 mais recentes mesmo sem o limite para
        // trás, e a conferência dela não mediria esse limite.
        if (d.rajada) {
          const rajada = { id: "ct-prova-rajada", numero: "5567955556666", nome: "CLIENTE DA RAJADA INVENTADO",
                           vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
          semente.contatos.push(rajada);
          semente.conversas.push(conversa(d.av.rajada, rajada, "Mensagem em rajada nº 54", new Date(em - 72000).toISOString()));
          for (let i = 0; i < 55; i++) {
            semente.mensagens.push(mensagem(`m-prova-rajada-${i}`, d.av.rajada, `Mensagem em rajada nº ${i}`, new Date(em - 110000 + i * 700).toISOString()));
          }
        }
      } else {
        semente.mensagens.push(mensagem("m-prova-antiga", d.av.conversa, d.av.antiga, new Date(Date.now() - 4 * 60e3).toISOString()));
        // NO F5 DA PESSOA, uma mensagem que nenhuma página viu: conferida no
        // F5, ela avisaria. A de quatro minutos antes não serve para isso — a
        // conferência de uma abertura comum já a teria avisado (e marcado),
        // e a marca calaria a do F5.
        if (sessionStorage.getItem("prova_f5")) {
          semente.mensagens.push(mensagem("m-prova-do-f5", d.av.conversa, d.av.doF5, new Date(Date.now() - 30e3).toISOString()));
        }
      }
    }
    if (semente.contatos.length || semente.conversas.length || semente.mensagens.length) g.__SEMENTE = semente;
    // O SOM E A NOTIFICAÇÃO SÃO ESPIONADOS, e não silenciados — a régua de
    // `o-aviso-de-mensagem-nova`.
    if (d.espiao) {
      g.__AVISOS = [];
      class NotificacaoDeMentira {
        constructor(titulo, opcoes) { g.__AVISOS.push({ o: "notificacao", titulo, ...(opcoes || {}) }); }
        static permission = "granted";
        static requestPermission() { return Promise.resolve("granted"); }
      }
      g.Notification = NotificacaoDeMentira;
      const ACreal = g.AudioContext;
      if (ACreal) {
        g.AudioContext = class extends ACreal {
          createOscillator() { const o = super.createOscillator(); g.__AVISOS.push({ o: "som" }); return o; }
        };
      }
    }
  }, { ...d, arquivo: undefined, relogio: undefined, nova: NOVA, av: AVISO });
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
const momentos = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("prova_momentos") || "[]")).catch(() => null);
const conta = (page, sel) => page.locator(sel).count().catch(() => 0);
const texto = async (page, sel) => ((await conta(page, sel)) ? (await page.locator(sel).first().innerText().catch(() => "")).trim() : null);
const attr = async (page, sel, nome) => ((await conta(page, sel)) ? page.locator(sel).first().getAttribute(nome).catch(() => null) : null);
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
/** A ABA ESCONDIDA, como o navegador diz: outra guia, outro programa, a tela
 *  bloqueada. O navegador de prova está sempre à vista, e a prova o diz. */
async function esconder(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  }).catch(() => {});
}
async function mostrar(page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  }).catch(() => {});
}
const CAIXA = 'textarea[placeholder*="Digite"]';
const MENU = "[data-menu-do-topo]";
const BUSCA = 'input[placeholder^="Buscar por nome"]';
/** Abre a conversa `n` da lista (pela posição: o nome pode mudar) e devolve o id. */
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
/** Abre o ⋮ do topo (se não estiver aberto) e diz se o item de atualizar está lá. */
async function abrirMenu(page) {
  if (!(await conta(page, "[data-versao-do-zorvin]"))) await clicar(page.locator(MENU), 400);
  return conta(page, "[data-versao-do-zorvin]");
}
/** Espera a página nova assentar depois de uma recarga. */
async function depoisDaRecarga(page, sel = "[data-conversa-nome]") {
  await page.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
}
/** O que a tela pinta no centro de um elemento é ele (ou algo dentro dele)? */
const pintado = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(no && (no === el || el.contains(no) || no.contains(el)));
}, sel).catch(() => false);
const valorDaBusca = (page) => page.locator(BUSCA).first().inputValue().catch(() => null);
const avisos = (page) => page.evaluate(() => globalThis.__AVISOS || []).catch(() => []);

// ==================================================================
if (vale("1")) {
  console.log("\n1. A versão na tela: no pé do menu ⋮ e na tela de entrada, com a data");
  const { ctx, page, estouros } = await abrir({ arquivo: VELHA });
  ok("o menu ⋮ abriu", (await abrirMenu(page)) === 1);
  ok("o pé do menu diz a versão e a data", (await texto(page, "[data-versao-do-zorvin]")) === "Zorvin v5.00 · 04/11",
     q(await texto(page, "[data-versao-do-zorvin]")));
  ok("e o title diz a entrega e quando", (await attr(page, "[data-versao-do-zorvin]", "title")) === "Entrega 500, de 04/11/2026 às 10:00",
     q(await attr(page, "[data-versao-do-zorvin]", "title")));
  ok("e ela está à vista dentro do menu", await visivel(page, "[data-versao-do-zorvin]"));
  ok("sem versão nova, o menu não oferece atualizar", (await conta(page, "[data-atualizar-agora]")) === 0);
  ok("e o ⋮ não tem o pontinho", (await conta(page, "[data-versao-nova]")) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();

  const e = await abrir({ arquivo: VELHA, deslogado: true });
  await e.page.waitForSelector("form", { timeout: 15000 }).catch(() => {});
  ok("a tela de entrada diz a versão e a data", (await texto(e.page, "[data-versao-do-zorvin]")) === "Zorvin v5.00 · 04/11",
     q(await texto(e.page, "[data-versao-do-zorvin]")));
  ok("com o mesmo title", (await attr(e.page, "[data-versao-do-zorvin]", "title")) === "Entrega 500, de 04/11/2026 às 10:00");
  await e.ctx.close();
}

// ==================================================================
if (vale("2")) {
  console.log("\n2. Sem versão nova: o arquivo do servidor e o código dizem o mesmo, e nada acontece");
  // SEM `__VERSAO_EM_USO` e sem trocar o arquivo: o código que roda é o da
  // montagem, e o arquivo é o que o servidor serve. Se os dois discordassem,
  // a aba recarregaria aqui — e a cena a deixa no momento mais forte que há:
  // escondida, e de madrugada.
  const { ctx, page, estouros } = await abrir({ arquivo: "servidor", emUso: null, madrugada: [0, 24] });
  const v = await page.evaluate(() => fetch("/versao.json", { cache: "no-store" }).then((r) => r.json()).catch(() => null));
  ok("o servidor serve o versao.json", Boolean(v && v.id), q(v));
  ok("com o rótulo no formato da versão (centenas, ou o começo do commit)",
     Boolean(v && /^(v\d+\.\d{2}|[0-9a-f]{7})$/.test(v.rotulo || "")), q(v && v.rotulo));
  ok("e a data do commit", Boolean(v && /^\d{2}\/\d{2}$/.test(v.data || "")), q(v && v.data));
  await esconder(page);
  await page.waitForTimeout(3500);
  ok("a aba não recarregou", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("e o ⋮ não tem o pontinho", (await conta(page, "[data-versao-nova]")) === 0);
  await mostrar(page);
  await abrirMenu(page);
  ok("e o menu diz o que o arquivo diz", (await texto(page, "[data-versao-do-zorvin]")) === `Zorvin ${v && v.rotulo}${v && v.data ? ` · ${v.data}` : ""}`,
     q(await texto(page, "[data-versao-do-zorvin]")));
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("3")) {
  console.log("\n3. À vista, de dia, nunca: o pontinho no ⋮, o item no menu, e nenhuma faixa");
  const { ctx, page, estouros, dialogos } = await abrir();
  const id = await abrirConversa(page, 1);
  ok("abri uma conversa", Boolean(id), q(id));
  const nomeAntes = await nomeDoAlto(page);
  // A PESSOA LENDO: a tela parada, à vista, muito mais do que o tempo da aba
  // escondida — e nada recarrega.
  await page.waitForTimeout(5000);
  ok("com a aba à vista, parada, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("o ⋮ ganhou o pontinho", (await attr(page, "[data-versao-nova]", "data-versao-nova")) === "esperando",
     q(await attr(page, "[data-versao-nova]", "data-versao-nova")));
  const ponto = await page.evaluate(() => {
    const p = document.querySelector("[data-versao-nova]");
    const b = document.querySelector("[data-menu-do-topo]");
    const r = p && p.getBoundingClientRect();
    const rb = b && b.getBoundingClientRect();
    return { existe: Boolean(p), w: r ? r.width : 0, h: r ? r.height : 0,
             noCanto: Boolean(r && rb && r.left >= rb.left - 2 && r.right <= rb.right + 6 && r.top >= rb.top - 6 && r.bottom <= rb.bottom),
             rotulo: b ? b.getAttribute("aria-label") : null };
  });
  ok("pequeno, no canto do ⋮", ponto.existe && ponto.w <= 12 && ponto.h <= 12 && ponto.noCanto, q(ponto));
  ok("e o ⋮ diz por extenso que há uma versão nova", ponto.rotulo === "Menu (há uma versão nova do Zorvin)", q(ponto.rotulo));
  const corpo = await page.evaluate(() => document.body.innerText);
  ok("nenhuma faixa no meio da tela", !/versão nova do Zorvin|entra sozinha|atualizado para/i.test(corpo)
     && (await conta(page, "[data-zorvin-atualizado]")) === 0, corpo.slice(0, 200));
  await abrirMenu(page);
  const item = (await texto(page, "[data-atualizar-agora]")) || "";
  ok("o menu oferece atualizar, com a versão e a data", item.includes("Atualizar o Zorvin (v5.01 · 05/11)"), q(item));
  ok("e diz que se volta para onde estava, e que ela entra sozinha", /volta para onde estava/.test(item) && /entra sozinha/.test(item), q(item));
  ok("o item é o primeiro do menu", await page.evaluate(() => {
    const it = document.querySelector("[data-atualizar-agora]");
    const caixa = it && it.parentElement;
    return Boolean(caixa && caixa.firstElementChild === it);
  }));
  await clicar(page.locator("[data-atualizar-agora]"), 300);
  ok("clicado, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  ok("sem perguntar nada (não havia o que perder)", !dialogos.some((x) => x.tipo === "confirm"), q(dialogos));
  ok("e a recarga foi a pedida", q(await momentos(page)) === q(["pedida"]), q(await momentos(page)));
  await depoisDaRecarga(page);
  await esperar(async () => Boolean(await nomeDoAlto(page)), 6000);
  ok("voltou para a MESMA conversa", (await nomeDoAlto(page)) === nomeAntes, q({ antes: nomeAntes, depois: await nomeDoAlto(page) }));
  ok("e o endereço ficou limpo (o F5 não reabre a conversa)", !page.url().includes("conversa="), page.url());
  ok("sem o pontinho, com a versão nova rodando", (await conta(page, "[data-versao-nova]")) === 0);
  ok("e sem faixa nenhuma dizendo que atualizou", (await conta(page, "[data-zorvin-atualizado]")) === 0
     && !/atualizado para/i.test(await page.evaluate(() => document.body.innerText)));
  await abrirMenu(page);
  ok("o pé do menu diz a versão nova", (await texto(page, "[data-versao-do-zorvin]")) === "Zorvin v5.01 · 05/11",
     q(await texto(page, "[data-versao-do-zorvin]")));
  ok("e o menu não oferece mais atualizar", (await conta(page, "[data-atualizar-agora]")) === 0);
  await page.waitForTimeout(2000);
  ok("e a aba não recarregou de novo", (await cargas(page)) === 2, `cargas: ${await cargas(page)}`);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("4")) {
  console.log("\n4. Escondida, de dia: recarrega e volta para a mesma conversa; escondida por um instante, não");
  const { ctx, page, estouros } = await abrir({ escondida: 2500 });
  await abrirConversa(page, 1);
  const nomeAntes = await nomeDoAlto(page);
  ok("abri uma conversa", Boolean(nomeAntes), q(nomeAntes));
  // QUEM TROCA DE JANELA POR UM SEGUNDO (para copiar um CPF) volta logo.
  await esconder(page);
  await page.waitForTimeout(1000);
  await mostrar(page);
  await page.waitForTimeout(3500);
  ok("escondida por um instante, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  // QUEM SAIU PARA OUTRO PROGRAMA.
  await esconder(page);
  await page.waitForTimeout(1500);
  ok("escondida há menos do que o tempo, ainda não", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("escondida há mais tempo, recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  ok("pela regra da aba escondida", q(await momentos(page)) === q(["escondida"]), q(await momentos(page)));
  await depoisDaRecarga(page);
  await esperar(async () => Boolean(await nomeDoAlto(page)), 6000);
  ok("e voltou para a MESMA conversa", (await nomeDoAlto(page)) === nomeAntes, q({ antes: nomeAntes, depois: await nomeDoAlto(page) }));
  ok("com o endereço limpo", !page.url().includes("conversa="), page.url());
  ok("sem faixa dizendo que atualizou", (await conta(page, "[data-zorvin-atualizado]")) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("5")) {
  console.log("\n5. A volta traz a tela como estava");
  {
    console.log("   5a. a aba Finalizados e o responsável escolhido");
    const { ctx, page } = await abrir();
    await clicar(page.locator('[data-aba-da-situacao="finalizado"]'), 900);
    ok("estou nos Finalizados", (await attr(page, '[data-aba-da-situacao="finalizado"]', "aria-selected")) === "true");
    await clicar(page.locator("[data-responsaveis-botao]"), 400);
    ok("marquei a Jenifer", await clicar(page.locator(`[data-responsavel-opcao="${JEN}"]`), 500));
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);
    ok("o seletor diz a Jenifer", /jenifer/i.test((await texto(page, "[data-responsaveis-botao]")) || ""), q(await texto(page, "[data-responsaveis-botao]")));
    await esconder(page);
    ok("escondida, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await depoisDaRecarga(page, "[data-abas-da-situacao]");
    await page.waitForTimeout(600);
    ok("e volta nos Finalizados", (await attr(page, '[data-aba-da-situacao="finalizado"]', "aria-selected")) === "true",
       q(await attr(page, '[data-aba-da-situacao="finalizado"]', "aria-selected")));
    // A LISTA PODE VOLTAR VAZIA (os Finalizados da Jenifer, na bancada, não
    // têm conversa nenhuma), e o seletor tem de continuar à vista: é nele que
    // se vê, e se desfaz, a escolha que esvaziou a lista.
    await esperar(async () => (await conta(page, "[data-responsaveis-botao]")) > 0, 6000);
    ok("com a Jenifer escolhida, e o seletor à vista para desfazer",
       (await attr(page, "[data-responsaveis-botao]", "data-responsaveis-botao")) === "escolhidos"
       && /jenifer/i.test((await texto(page, "[data-responsaveis-botao]")) || "")
       && await visivel(page, "[data-responsaveis-botao]"), q(await texto(page, "[data-responsaveis-botao]")));
    // A FOTO VALE UMA VEZ: o F5 de depois abre como sempre.
    await page.reload().catch(() => {});
    await depoisDaRecarga(page, "[data-abas-da-situacao]");
    ok("o F5 de depois abre como sempre: na aba de sempre",
       (await attr(page, '[data-aba-da-situacao="aberto"]', "aria-selected")) === "true",
       q(await attr(page, '[data-aba-da-situacao="finalizado"]', "aria-selected")));
    await esperar(async () => (await conta(page, "[data-responsaveis-botao]")) > 0, 6000);
    ok("e sem responsável escolhido", (await attr(page, "[data-responsaveis-botao]", "data-responsaveis-botao")) === "todos",
       q(await texto(page, "[data-responsaveis-botao]")));
    await ctx.close();
  }
  {
    console.log("   5b. o filtro Não lidas e a busca escrita");
    const { ctx, page } = await abrir();
    await clicar(page.locator('button[data-aba="naolidas"]'), 600);
    const ativo = () => page.evaluate(() => {
      const b = document.querySelector('button[data-aba="naolidas"]');
      return b ? getComputedStyle(b).color === "rgb(255, 255, 255)" : false;
    }).catch(() => false);
    ok("o filtro Não lidas está ligado", await ativo());
    await clicar(page.locator(BUSCA), 200);
    await page.keyboard.type("zzz-prova", { delay: 10 });
    ok("escrevi na busca", (await valorDaBusca(page)) === "zzz-prova");
    await page.waitForTimeout(600);
    await esconder(page);
    ok("escondida, a aba recarrega (a busca escrita não segura)", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await depoisDaRecarga(page, BUSCA);
    ok("e a busca volta escrita", (await valorDaBusca(page)) === "zzz-prova", q(await valorDaBusca(page)));
    ok("e o filtro volta ligado", await ativo());
    await ctx.close();
  }
  {
    console.log("   5c. a pasta de arquivadas");
    const { ctx, page } = await abrir({ arquivada: true });
    const entrada = page.locator("button", { hasText: "Arquivadas" });
    ok("a entrada das arquivadas está na lista", (await entrada.count()) >= 1);
    await clicar(entrada, 900);
    ok("estou dentro das arquivadas", (await conta(page, "[data-vendo-arquivadas]")) === 1);
    await esconder(page);
    ok("escondida, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await depoisDaRecarga(page, "[data-vendo-arquivadas]");
    ok("e volta dentro das arquivadas", (await conta(page, "[data-vendo-arquivadas]")) === 1);
    await ctx.close();
  }
  {
    console.log("   5d. o filtro de quem participou");
    const { ctx, page } = await abrir();
    await clicar(page.locator('[data-grupo="quem"]'), 600);
    const opcao = page.locator("[data-quem]").first();
    const nome = (await page.locator("[data-quem]").count()) ? await opcao.getAttribute("data-quem") : null;
    ok("o menu de quem participou abriu", Boolean(nome), q(nome));
    await clicar(opcao, 600);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    const filtrando = async () => (await attr(page, '[data-grupo="quem"]', "title")) === "Filtrando por quem participou da conversa";
    ok("o filtro está ligado", await filtrando(), q(await attr(page, '[data-grupo="quem"]', "title")));
    if (await conta(page, "[data-quem]")) await clicar(page.locator('[data-grupo="quem"]'), 300);
    await esconder(page);
    ok("escondida, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await depoisDaRecarga(page, '[data-grupo="quem"]');
    await esperar(filtrando, 4000);
    ok("e o filtro volta ligado", await filtrando(), q(await attr(page, '[data-grupo="quem"]', "title")));
    await clicar(page.locator('[data-grupo="quem"]'), 500);
    ok("com a mesma pessoa marcada", nome ? (await conta(page, `[data-quem="${nome}"] svg`)) >= 1 : false, q(nome));
    await ctx.close();
  }
}

// ==================================================================
if (vale("6")) {
  console.log("\n6. De dia, a aba escondida espera quando a volta não seria igual — e de madrugada, não");
  {
    console.log("   6a. a conversa rolada para mensagens antigas");
    const { ctx, page } = await abrir();
    await clicar(page.locator('[data-conversa-id="a7-apelido"]'), 1500);
    const rolada = await page.evaluate(() => {
      const l = document.querySelector("[data-lista-mensagens]");
      if (!l) return null;
      l.scrollTop = 200;
      return { distancia: l.scrollHeight - l.scrollTop - l.clientHeight, altura: l.clientHeight };
    });
    ok("rolei a conversa para cima", Boolean(rolada && rolada.distancia > Math.max(240, rolada.altura * 0.5)), q(rolada));
    await page.waitForTimeout(300);
    await esconder(page);
    await page.waitForTimeout(4000);
    ok("com a conversa rolada para cima, a aba escondida NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await page.evaluate(() => { const l = document.querySelector("[data-lista-mensagens]"); if (l) l.scrollTop = l.scrollHeight; });
    ok("de volta ao fim, ela recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    console.log("   6b. uma janela aberta por cima");
    const { ctx, page } = await abrir();
    await abrirMenu(page);
    await clicar(page.getByRole("button", { name: "Configurações" }), 700);
    ok("as Configurações abriram", (await conta(page, '[title="Fechar"]')) >= 1);
    await esconder(page);
    await page.waitForTimeout(4000);
    ok("com a janela aberta, a aba escondida NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await page.keyboard.press("Escape").catch(() => {});
    ok("fechada a janela, ela recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    console.log("   6c. a lista de conversas rolada para baixo");
    const { ctx, page } = await abrir();
    const rolada = await page.evaluate(() => {
      const l = document.querySelector("[data-lista-de-conversas]");
      if (!l) return null;
      l.scrollTop = 600;
      return { topo: l.scrollTop, altura: l.clientHeight };
    });
    ok("rolei a lista para baixo", Boolean(rolada && rolada.topo > Math.max(240, rolada.altura * 0.5)), q(rolada));
    await page.waitForTimeout(400);
    await esconder(page);
    await page.waitForTimeout(4000);
    ok("com a lista rolada, a aba escondida NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await page.evaluate(() => { const l = document.querySelector("[data-lista-de-conversas]"); if (l) l.scrollTop = 0; });
    ok("de volta ao alto, ela recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    console.log("   6d. de madrugada, nada disso segura");
    const { ctx, page } = await abrir();
    await abrirMenu(page);
    await clicar(page.getByRole("button", { name: "Configurações" }), 700);
    ok("as Configurações abriram", (await conta(page, '[title="Fechar"]')) >= 1);
    await page.evaluate(() => { globalThis.__MADRUGADA = [0, 24]; });
    ok("de madrugada, parada, a aba recarrega mesmo com a janela aberta",
       await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    ok("pela regra da madrugada", q(await momentos(page)) === q(["madrugada"]), q(await momentos(page)));
    await ctx.close();
  }
}

// ==================================================================
if (vale("7")) {
  console.log("\n7. A madrugada de verdade: das 0h às 6h, com a aba parada, mesmo à vista");
  {
    // O RELÓGIO DE MENTIRA nas horas de verdade, no fuso do escritório.
    const { ctx, page } = await abrir({ madrugada: null, relogio: new Date("2026-11-05T03:00:00-03:00") });
    await abrirConversa(page, 1);
    const nomeAntes = await nomeDoAlto(page);
    ok("às 3h, parada e à vista, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 9000), `cargas: ${await cargas(page)}`);
    ok("pela regra da madrugada", q(await momentos(page)) === q(["madrugada"]), q(await momentos(page)));
    await depoisDaRecarga(page);
    await esperar(async () => Boolean(await nomeDoAlto(page)), 6000);
    ok("e volta para a mesma conversa", (await nomeDoAlto(page)) === nomeAntes, q({ antes: nomeAntes, depois: await nomeDoAlto(page) }));
    await ctx.close();
  }
  {
    // A PUBLICAÇÃO SAI COM ALGUÉM MEXENDO NA TELA (de madrugada, há quem
    // trabalhe): a aba abre na versão de sempre, e a nova chega no meio.
    const { ctx, page, servir } = await abrir({ arquivo: VELHA, madrugada: null, relogio: new Date("2026-11-05T03:00:00-03:00") });
    const mexendo = mexer(page, 4500);
    await page.waitForTimeout(500);
    servir(NOVA);
    await mexendo;
    ok("às 3h, com alguém mexendo, NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    ok("e o pontinho está no ⋮", (await conta(page, "[data-versao-nova]")) === 1);
    ok("parada a tela, recarrega", await esperar(async () => (await cargas(page)) === 2, 9000), `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir({ madrugada: null, relogio: new Date("2026-11-05T14:00:00-03:00") });
    await page.waitForTimeout(4500);
    ok("às 14h, parada e à vista, NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    ok("e o pontinho está no ⋮", (await conta(page, "[data-versao-nova]")) === 1);
    await ctx.close();
  }
}

// ==================================================================
if (vale("8")) {
  console.log("\n8. A volta do descanso: o computador acorda, com a aba ainda escondida");
  // A ABA ESCONDIDA SÓ RECARREGARIA DEPOIS DE UMA HORA aqui: só a regra do
  // descanso pode fazer a recarga acontecer.
  {
    const { ctx, page } = await abrir({ relogio: true, escondida: 60 * 60e3 });
    await abrirConversa(page, 1);
    const nomeAntes = await nomeDoAlto(page);
    await esconder(page);
    await page.waitForTimeout(1500);
    ok("escondida, sem o descanso, nada", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    // O COMPUTADOR DORME 25 MINUTOS: o relógio salta, e os temporizadores
    // vencidos disparam uma vez, como na volta da tampa aberta.
    await page.clock.fastForward(25 * 60e3);
    ok("na volta, ainda escondida, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
    ok("pela regra do descanso", q(await momentos(page)) === q(["descanso"]), q(await momentos(page)));
    await depoisDaRecarga(page);
    await esperar(async () => Boolean(await nomeDoAlto(page)), 6000);
    ok("e volta para a mesma conversa", (await nomeDoAlto(page)) === nomeAntes, q({ antes: nomeAntes, depois: await nomeDoAlto(page) }));
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir({ relogio: true, escondida: 60 * 60e3 });
    await page.clock.fastForward(25 * 60e3);
    await page.waitForTimeout(4000);
    ok("acordando com a aba à vista, NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    // ALGUÉM MEXEU NA ABA depois de acordar, e então a escondeu.
    await mexer(page, 500);
    await esconder(page);
    await page.waitForTimeout(4000);
    ok("e escondida depois de alguém mexer nela, também não", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir({ relogio: true, escondida: 60 * 60e3, janela: 2500 });
    await page.clock.fastForward(25 * 60e3);
    await page.waitForTimeout(3500);
    await esconder(page);
    await page.waitForTimeout(4000);
    ok("escondida depois da janela da volta, também não", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
}

// ==================================================================
if (vale("9")) {
  console.log("\n9. O texto na caixa de escrever segura a recarga, e \"Atualizar o Zorvin\" pergunta antes");
  // O MOMENTO MAIS FORTE: escondida e de madrugada. A publicação chega no
  // meio do trabalho, depois de a pessoa começar a escrever.
  const { ctx, page, dialogos, responder, servir } = await abrir({ arquivo: VELHA, madrugada: [0, 24] });
  await abrirConversa(page, 1);
  ok("escrevi na caixa de escrever", await escreverNaCaixa(page, "Olá, já te respondo"));
  servir(NOVA);
  await esconder(page);
  await page.waitForTimeout(4500);
  ok("com texto na caixa, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("o texto continua lá", ((await page.locator(CAIXA).first().inputValue().catch(() => "")) || "").includes("já te respondo"));
  ok("e o ⋮ tem o pontinho", (await conta(page, "[data-versao-nova]")) === 1);
  await abrirMenu(page);
  responder("recusar");
  await clicar(page.locator("[data-atualizar-agora]"), 800);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("\"Atualizar o Zorvin\" pergunta antes", Boolean(pergunta), q(dialogos));
  ok("e diz o que se perde", Boolean(pergunta && /o texto na caixa de escrever/.test(pergunta.texto)), q(pergunta));
  ok("recusando, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("e o texto continua lá", ((await page.locator(CAIXA).first().inputValue().catch(() => "")) || "").includes("já te respondo"));
  responder("aceitar");
  await abrirMenu(page);
  await clicar(page.locator("[data-atualizar-agora]"), 300);
  ok("aceitando, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  ok("pela regra do pedido", q(await momentos(page)) === q(["pedida"]), q(await momentos(page)));
  await ctx.close();
}

// ==================================================================
if (vale("10")) {
  console.log("\n10. O rascunho de outra conversa segura a recarga");
  const { ctx, page, dialogos, servir } = await abrir({ arquivo: VELHA, madrugada: [0, 24] });
  await abrirConversa(page, 1);
  await escreverNaCaixa(page, "Rascunho guardado para depois");
  await abrirConversa(page, 2);
  ok("na conversa nova, a caixa está vazia", ((await page.locator(CAIXA).first().inputValue().catch(() => "x")) || "") === "");
  servir(NOVA);
  await esconder(page);
  await page.waitForTimeout(4500);
  ok("com um rascunho noutra conversa, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  await abrirMenu(page);
  await clicar(page.locator("[data-atualizar-agora]"), 800);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("a pergunta diz que é o rascunho de outra conversa", Boolean(pergunta && /rascunho de outra conversa/.test(pergunta.texto)), q(pergunta));
  await ctx.close();
}

// ==================================================================
if (vale("11")) {
  console.log("\n11. O texto digitado numa janela segura; a busca escrita não");
  {
    const { ctx, page, servir } = await abrir({ arquivo: VELHA, madrugada: [0, 24] });
    await abrirMenu(page);
    await clicar(page.getByRole("button", { name: "Configurações" }), 600);
    await clicar(page.getByRole("button", { name: "Mensagens rápidas", exact: true }), 500);
    await clicar(page.getByRole("button", { name: "Nova", exact: true }), 400);
    const campo = page.locator("[data-texto-da-rapida-na-config]");
    ok("o formulário de uma rápida nova abriu", (await campo.count()) === 1);
    if (await campo.count()) { await campo.click(); await page.keyboard.type("Texto que ninguém salvou", { delay: 5 }); }
    servir(NOVA);
    await esconder(page);
    await page.waitForTimeout(4500);
    ok("com texto digitado numa janela, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
    await ctx.close();
  }
  {
    const { ctx, page, servir } = await abrir({ arquivo: VELHA, madrugada: [0, 24] });
    await clicar(page.locator(BUSCA), 200);
    await page.keyboard.type("zzzzzz", { delay: 5 });
    ok("escrevi na busca", (await valorDaBusca(page)) === "zzzzzz");
    servir(NOVA);
    await esconder(page);
    ok("com só a busca escrita, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 9000), `cargas: ${await cargas(page)}`);
    await depoisDaRecarga(page, BUSCA);
    ok("e a busca volta escrita", (await valorDaBusca(page)) === "zzzzzz", q(await valorDaBusca(page)));
    await ctx.close();
  }
}

// ==================================================================
if (vale("12")) {
  console.log("\n12. O anexo escolhido segura a recarga");
  const { ctx, page, dialogos, servir } = await abrir({ arquivo: VELHA, madrugada: [0, 24] });
  await abrirConversa(page, 1);
  const entrada = page.locator('input[type="file"][multiple]');
  if (await entrada.count()) {
    await entrada.first().setInputFiles({ name: "procuracao-de-prova-atualiza.pdf", mimeType: "application/pdf",
                                          buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  }
  ok("a prévia do anexo abriu", await esperar(async () => (await conta(page, "[data-previa-anexo]")) === 1, 4000));
  servir(NOVA);
  await esconder(page);
  await page.waitForTimeout(4500);
  ok("com o anexo escolhido, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  // O ⋮ FICA DEBAIXO DA PRÉVIA (que cobre a tela): ele e o item são
  // clicados por código.
  await page.evaluate(() => document.querySelector("[data-menu-do-topo]")?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector("[data-atualizar-agora]")?.click());
  await page.waitForTimeout(800);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("a pergunta diz que é o anexo", Boolean(pergunta && /anexo escolhido/.test(pergunta.texto)), q(pergunta));
  await ctx.close();
}

// ==================================================================
if (vale("13")) {
  console.log("\n13. A ficha por salvar segura a recarga, e o navegador não pergunta duas vezes");
  const { ctx, page, dialogos, responder, servir } = await abrir({ ficha: true, arquivo: VELHA, madrugada: [0, 24] });
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
  await esconder(page);
  await page.waitForTimeout(4500);
  ok("com a ficha por salvar, a aba NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  responder("aceitar");
  await abrirMenu(page);
  await clicar(page.locator("[data-atualizar-agora]"), 300);
  const pergunta = dialogos.find((x) => x.tipo === "confirm");
  ok("a pergunta diz que é a ficha", Boolean(pergunta && /alterações não salvas da ficha/.test(pergunta.texto)), q(pergunta));
  ok("aceitando, a aba recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  ok("e o navegador NÃO perguntou de novo (beforeunload)", !dialogos.some((x) => x.tipo === "beforeunload"), q(dialogos));
  await ctx.close();
}

// ==================================================================
if (vale("14")) {
  console.log("\n14. A recarga que não trouxe a versão nova não vira um círculo");
  // DE MADRUGADA E PARADA: o momento continua valendo depois da recarga, e
  // só a marca impede a segunda.
  const { ctx, page } = await abrir({ pega: false, madrugada: [0, 24] });
  ok("a aba recarregou uma vez", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  await depoisDaRecarga(page);
  await page.waitForTimeout(3500);
  ok("e não recarregou de novo", (await cargas(page)) === 2, `cargas: ${await cargas(page)}`);
  ok("o pontinho do ⋮ ficou âmbar", (await attr(page, "[data-versao-nova]", "data-versao-nova")) === "nao-carregou",
     q(await attr(page, "[data-versao-nova]", "data-versao-nova")));
  await abrirMenu(page);
  const item = (await texto(page, "[data-versao-nao-carregou]")) || "";
  ok("o menu diz que a versão nova não carregou", /Carregar a versão nova \(v5\.01 · 05\/11\)/.test(item), q(item));
  ok("e pede o Ctrl+Shift+R", /Ctrl\+Shift\+R/.test(item), q(item));
  await clicar(page.locator("[data-versao-nao-carregou]"), 300);
  ok("clicado, recarrega uma vez", await esperar(async () => (await cargas(page)) === 3, 8000), `cargas: ${await cargas(page)}`);
  ok("pedindo o endereço com um carimbo (o navegador não responde de memória)", /[?&]v=\d+/.test(page.url()), page.url());
  await page.waitForTimeout(3000);
  ok("e não recarrega mais sozinha", (await cargas(page)) === 3, `cargas: ${await cargas(page)}`);
  await ctx.close();
}

// ==================================================================
if (vale("15")) {
  console.log("\n15. O arquivo que falha não faz nada");
  const { ctx, page, estouros, servir } = await abrir({ arquivo: 404, madrugada: [0, 24] });
  await esconder(page);
  await page.waitForTimeout(2500);
  ok("com o arquivo em 404, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  servir("lixo");
  await page.waitForTimeout(2500);
  ok("com o arquivo que não é JSON, nada recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  ok("e o ⋮ não ganhou o pontinho", (await conta(page, "[data-versao-nova]")) === 0);
  ok("sem estouro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
if (vale("16")) {
  console.log("\n16. A guia de uma tela não recarrega escondida de dia; de madrugada, recarrega na mesma tela");
  const { ctx, page } = await abrir({ endereco: `${ENDERECO}?tela=tarefas` });
  await page.waitForSelector('[data-tela="tarefas"]', { timeout: 15000 }).catch(() => {});
  ok("a guia das Tarefas abriu", (await conta(page, '[data-tela="tarefas"]')) >= 1);
  await esconder(page);
  await page.waitForTimeout(4000);
  ok("escondida, de dia, ela NÃO recarrega", (await cargas(page)) === 1, `cargas: ${await cargas(page)}`);
  await page.evaluate(() => { globalThis.__MADRUGADA = [0, 24]; });
  ok("de madrugada, recarrega", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  await page.waitForSelector('[data-tela="tarefas"]', { timeout: 15000 }).catch(() => {});
  ok("e continua na tela das Tarefas", page.url().includes("tela=tarefas") && (await conta(page, '[data-tela="tarefas"]')) >= 1, page.url());
  await ctx.close();
}

// ==================================================================
if (vale("17")) {
  console.log("\n17. No celular, o pontinho e o item cabem");
  const { ctx, page } = await abrir({ celular: true, largura: 360, altura: 760 });
  await esperar(async () => (await conta(page, "[data-versao-nova]")) === 1, 4000);
  ok("o pontinho apareceu", (await conta(page, "[data-versao-nova]")) === 1);
  const ponto = await page.evaluate(() => {
    const p = document.querySelector("[data-versao-nova]");
    const r = p && p.getBoundingClientRect();
    return r ? { dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 0, w: r.width } : null;
  });
  ok("e está dentro da tela", Boolean(ponto && ponto.dentro), q(ponto));
  await abrirMenu(page);
  const medida = await page.evaluate(() => {
    const b = document.querySelector("[data-atualizar-agora]");
    const r = b && b.getBoundingClientRect();
    return { existe: Boolean(b), direita: r ? r.right : 0, esquerda: r ? r.left : 0, altura: r ? r.height : 0,
             rolaDeLado: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  ok("o item de atualizar está no menu", medida.existe, q(medida));
  ok("e cabe na tela", medida.esquerda >= 0 && medida.direita <= 361, q(medida));
  ok("com os 40 pontos de alvo de dedo", medida.altura >= 39.5, q(medida));
  ok("e está pintado (nada por cima dele)", await pintado(page, "[data-atualizar-agora]"));
  ok("a página não rola de lado", !medida.rolaDeLado, q(medida));
  await ctx.close();
}

// ==================================================================
if (vale("18")) {
  console.log("\n18. A montagem: o mesmo identificador, o rótulo em centenas e a data do commit");
  // AS REGRAS DA VERSÃO moram na configuração da montagem. Importadas aqui, e
  // com guarda: uma configuração sem elas (a de antes) reprova nesta cena, em
  // vez de derrubar a prova inteira antes da primeira conferência.
  const config = await import("../vite.config.js").catch(() => ({}));
  ok("a configuração da montagem diz as regras da versão",
     typeof config.rotuloDaEntrega === "function" && typeof config.rotuloDoCommit === "function" && typeof config.dataDoCommit === "function",
     q(Object.keys(config)));
  const rotuloDaEntrega = typeof config.rotuloDaEntrega === "function" ? config.rotuloDaEntrega : () => null;
  const rotuloDoCommit = typeof config.rotuloDoCommit === "function" ? config.rotuloDoCommit : () => ({});
  const dataDoCommit = typeof config.dataDoCommit === "function" ? config.dataDoCommit : () => ({});
  // A REGRA DO RÓTULO, direto na função.
  ok("a entrega 314 é a v3.14", rotuloDaEntrega(314) === "v3.14", q(rotuloDaEntrega(314)));
  ok("a 399 é a v3.99, e a 400 a v4.00", rotuloDaEntrega(399) === "v3.99" && rotuloDaEntrega(400) === "v4.00",
     q([rotuloDaEntrega(399), rotuloDaEntrega(400)]));
  ok("sempre dois números depois do ponto (v0.05, v10.05)", rotuloDaEntrega(5) === "v0.05" && rotuloDaEntrega(1005) === "v10.05",
     q([rotuloDaEntrega(5), rotuloDaEntrega(1005)]));
  // O NÚMERO SAI DA MENSAGEM DO COMMIT que o GitHub escreve ao mesclar.
  ok("a mesclagem por squash, \"… (#314)\", é a v3.14",
     q(rotuloDoCommit("Pedir uma mudança ao Copiloto, e ver o que ele aprendeu (#314)", "abcdef0123")) === q({ numero: 314, rotulo: "v3.14" }),
     q(rotuloDoCommit("Pedir uma mudança ao Copiloto, e ver o que ele aprendeu (#314)", "abcdef0123")));
  ok("\"Merge pull request #400 …\" é a v4.00", rotuloDoCommit("Merge pull request #400 from ropelimi/ramo", "x").rotulo === "v4.00",
     q(rotuloDoCommit("Merge pull request #400 from ropelimi/ramo", "x")));
  ok("sem o número, o começo do commit", q(rotuloDoCommit("Merge 1234abc into 5678def", "1234abcdef0099")) === q({ numero: null, rotulo: "1234abc" }),
     q(rotuloDoCommit("Merge 1234abc into 5678def", "1234abcdef0099")));
  // A DATA, NO FUSO DE BRASÍLIA: 02h12 em Londres ainda é 04/11 aqui.
  const madrugadaUtc = dataDoCommit("2026-11-05T02:12:00Z");
  const manhaUtc = dataDoCommit("2026-11-05T04:12:00Z");
  ok("a data é a de Brasília", madrugadaUtc.data === "04/11" && manhaUtc.data === "05/11", q([madrugadaUtc, manhaUtc]));
  ok("e a hora por extenso", manhaUtc.quando === "05/11/2026 às 01:12", q(manhaUtc.quando));
  ok("sem data, nada (e não \"Invalid Date\")", q(dataDoCommit("")) === q({ data: "", quando: "" }), q(dataDoCommit("")));

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
  ok("e o mesmo rótulo", Boolean(arquivo && arquivo.rotulo && codigo.includes(`"${arquivo.rotulo}"`)), q(arquivo && arquivo.rotulo));
  // A DATA É A DO COMMIT, e não a da montagem: medida até o minuto.
  let horaDoCommit = "";
  try { horaDoCommit = execFileSync("git", ["log", "-1", "--format=%cI"], { encoding: "utf8" }).trim(); } catch (_) { /* sem git */ }
  if (horaDoCommit) {
    ok("e a mesma data", Boolean(arquivo && /^\d{2}\/\d{2}$/.test(arquivo.data || "") && codigo.includes(`"${arquivo.data}"`)), q(arquivo && arquivo.data));
    ok("a data é a do commit, e não a da montagem", Boolean(arquivo && arquivo.quando === dataDoCommit(horaDoCommit).quando),
       q({ commit: horaDoCommit, quando: arquivo && arquivo.quando }));
  } else {
    ok("sem git, sem data", Boolean(arquivo && arquivo.data === "" && arquivo.quando === ""), q(arquivo));
  }
  ok("a hora da montagem fica fora do código (o pacote não muda a cada montagem do mesmo commit)",
     Boolean(arquivo && arquivo.montada_em && !codigo.includes(arquivo.montada_em)));
  // O RÓTULO SAI DO NÚMERO DA PR NA MENSAGEM DO COMMIT, quando há um.
  let assunto = "";
  try { assunto = execFileSync("git", ["log", "-1", "--format=%s"], { encoding: "utf8" }).trim(); } catch (_) { /* sem git */ }
  const m = /\(#(\d+)\)\s*$/.exec(assunto) || /#(\d+)/.exec(assunto);
  const n = m ? Number(m[1]) : 0;
  if (m) ok("com o número da PR do último commit, em centenas",
            Boolean(arquivo && arquivo.rotulo === `v${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`),
            q({ assunto, rotulo: arquivo && arquivo.rotulo }));
  else ok("sem número de PR no último commit, o rótulo é o começo do commit",
          Boolean(arquivo && arquivo.rotulo === "0123456"), q({ assunto, rotulo: arquivo && arquivo.rotulo }));
  rmSync(pasta, { recursive: true, force: true });
}

// ==================================================================
if (vale("19")) {
  console.log("\n19. O site fora do ar na hora de recarregar: a aba fica onde está");
  const { ctx, page, servir } = await abrir({ arquivo: VELHA });
  await abrirConversa(page, 1);
  const nomeAntes = await nomeDoAlto(page);
  const enderecoAntes = page.url();
  // O DOCUMENTO DO SITE NÃO RESPONDE (o arquivo da versão responde):
  // recarregar agora trocaria o Zorvin pela página de erro do navegador.
  await ctx.route((url) => url.pathname === "/", (rota) => rota.abort().catch(() => {}));
  servir(NOVA);
  await esconder(page);
  await page.waitForTimeout(4500);
  ok("a aba não saiu do lugar", page.url() === enderecoAntes, page.url());
  ok("e a conversa continua aberta", (await nomeDoAlto(page)) === nomeAntes, q(await nomeDoAlto(page)));
  ok("e a lista continua na tela", (await conta(page, "[data-conversa-nome]")) > 0);
  ok("e o ⋮ continua com o pontinho", (await conta(page, "[data-versao-nova]")) === 1);
  await ctx.close();
}

// ==================================================================
if (vale("20")) {
  console.log("\n20. As mensagens que chegam nos segundos da recarga ganham o aviso, sem repetir o que já avisou");
  const { ctx, page, servir } = await abrir({ arquivo: VELHA, espiao: true, aviso: true });
  await esconder(page);
  // ANTES DA RECARGA, uma mensagem chega pelo tempo real, e avisa.
  await page.evaluate((av) => {
    const em = Date.now();
    sessionStorage.setItem("prova_ao_vivo_em", String(em));
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-prova-ao-vivo", conversa_id: av.conversa, origem: "contato", tipo: "texto",
      texto: av.aoVivo, enviado_por: null, enviado_por_id: null, criado_em: new Date(em).toISOString(),
    });
  }, AVISO);
  const daConversa = async (corpo) => (await avisos(page)).filter((a) => a.o === "notificacao"
    && a.tag === `zorvin-conversa-${AVISO.conversa}` && (corpo === undefined || a.body === corpo));
  ok("a mensagem de antes da recarga avisou na hora", await esperar(async () => (await daConversa(AVISO.aoVivo)).length === 1, 6000),
     q(await avisos(page)));
  await page.waitForTimeout(800);
  ok("e a abertura de sempre não confere nada: a de quatro minutos antes, que já estava no banco, não avisou",
     (await daConversa(AVISO.antiga)).length === 0, q(await daConversa()));
  // A VERSÃO NOVA SAI, e a aba escondida recarrega.
  servir(NOVA);
  ok("a aba recarregou", await esperar(async () => (await cargas(page)) === 2, 8000), `cargas: ${await cargas(page)}`);
  await depoisDaRecarga(page);
  ok("a mensagem que chegou no meio da recarga avisou", await esperar(async () => (await daConversa(AVISO.recente)).length === 1, 8000),
     q(await avisos(page)));
  ok("e tocou o som", (await avisos(page)).some((a) => a.o === "som"));
  ok("a do relógio adiantado também (os dois minutos de folga)", await esperar(async () => (await daConversa(AVISO.adiantado)).length === 1, 3000),
     q(await daConversa()));
  await page.waitForTimeout(1500);
  ok("a de quatro minutos antes não avisou", (await daConversa(AVISO.antiga)).length === 0, q(await daConversa()));
  ok("e a que já tinha avisado antes da recarga não avisou de novo", (await daConversa(AVISO.aoVivo)).length === 0, q(await daConversa()));
  ok("um aviso por mensagem, e só esses dois", (await daConversa()).length === 2, q(await daConversa()));
  // O F5 DA PESSOA NÃO REPETE NADA: só a recarga feita pelo Zorvin confere.
  // A de quatro minutos antes continua no banco, e nunca avisou: conferida no
  // F5, ela avisaria. E A AUSÊNCIA SÓ SE CONFERE DEPOIS DE UM AVISO QUE TEM
  // DE SAIR — uma mensagem nova, pelo tempo real, passa pela mesma decisão
  // (e pela mesma espera da distribuição). Conferida com um relógio fixo, a
  // prova olharia antes de a conferência do banco ter tempo de avisar, e
  // passaria com o F5 conferindo tudo.
  await page.evaluate(() => sessionStorage.setItem("prova_f5", "1"));
  await page.reload().catch(() => {});
  await depoisDaRecarga(page);
  await page.evaluate((av) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-prova-depois-do-f5", conversa_id: av.conversa, origem: "contato", tipo: "texto",
      texto: av.depoisDoF5, enviado_por: null, enviado_por_id: null, criado_em: new Date().toISOString(),
    });
  }, AVISO);
  ok("depois de um F5, a mensagem nova do tempo real avisa", await esperar(async () => (await daConversa(AVISO.depoisDoF5)).length === 1, 8000),
     q(await avisos(page)));
  await page.waitForTimeout(800);
  const textosDoBanco = await page.evaluate(() => new Set((globalThis.__TABELAS.mensagens || [])
    .filter((m) => m.origem === "contato").map((m) => m.texto)).size);
  const deMensagem = await page.evaluate((av) => {
    const textos = new Set((globalThis.__TABELAS.mensagens || []).filter((m) => m.origem === "contato" && m.texto !== av.depoisDoF5)
      .map((m) => m.texto));
    return (globalThis.__AVISOS || []).filter((a) => a.o === "notificacao" && textos.has(a.body));
  }, AVISO);
  const temADoF5 = await page.evaluate((av) => (globalThis.__TABELAS.mensagens || []).some((m) => m.texto === av.doF5), AVISO);
  ok("e nenhuma mensagem do banco avisa (nem a que estava lá quando a pessoa apertou F5)",
     textosDoBanco > 0 && temADoF5 && deMensagem.length === 0, `${temADoF5 ? "" : "a do F5 não foi plantada; "}${q(deMensagem)}`);
  await ctx.close();

  // A RAJADA, NUMA JANELA PRÓPRIA: 57 mensagens na janela da conferência, e
  // vêm as 50 mais recentes — as que chegaram no meio da recarga são as mais
  // novas. Ela fica fora da primeira recarga de propósito (ver `rajada`, na
  // semente).
  const r = await abrir({ arquivo: VELHA, espiao: true, aviso: true, rajada: true });
  await esconder(r.page);
  r.servir(NOVA);
  ok("com a rajada, a aba recarregou", await esperar(async () => (await cargas(r.page)) === 2, 8000), `cargas: ${await cargas(r.page)}`);
  await depoisDaRecarga(r.page);
  const rajada = async (i) => (await avisos(r.page)).filter((a) => a.o === "notificacao" && a.body === `Mensagem em rajada nº ${i}`).length;
  ok("da rajada, a mais recente avisou", await esperar(async () => (await rajada(54)) === 1, 8000), String(await rajada(54)));
  await r.page.waitForTimeout(1500);
  ok("e a mais antiga, além das 50, ficou de fora", (await rajada(0)) === 0, String(await rajada(0)));
  await r.ctx.close();
}

const pedidas = CENAS.filter((c) => !TODAS.includes(c));
ok("toda cena pedida em CENAS existe", pedidas.length === 0, q(pedidas));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
