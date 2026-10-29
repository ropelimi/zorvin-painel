// A AUDITORIA DE 27/10 — o que uma varredura inteira achou, e que não tem
// prova própria (a bolha que saiu e o reenviar estão em
// `a-bolha-que-saiu-nao-fica-vermelha`).
//
// Cada cena reproduz um defeito achado lendo o código e conferido na bancada:
//
//   1. a ficha fixa espremia a conversa entre 768 e 1170 pontos — a 1024 a
//      caixa de escrever ficava com uma letra por linha. Ali ela vira uma
//      gaveta por cima da conversa, com a lista à vista;
//   2. sem Vantoro, a conta da largura descontava a ficha que não existe;
//   3. o áudio gravado em A aparecia na caixa de B, e "Enviar" mandava para A;
//   4. a etapa do funil do cliente de antes aparecia na conversa seguinte;
//   5. o Esc no menu do "/" e no de departamentos fechava a CONVERSA;
//   6. Configurações → Contatos não carregava a agenda;
//   7. a seleção de mensagens atravessava a troca de conversa;
//   8. a faixa de aviso ficava por baixo das Mídias;
//   9. a janela de agendar da prévia de anexos saía da tela no celular;
//  10. "Respondendo você mesmo" para mensagem que não era sua;
//  11. a importação oferecia telefones que a pessoa não alcança;
//  8b. a seta de opções de um PDF recebido ficava por baixo da prévia (num
//      Chrome com leitor de PDF, o menu dele não abria);
//  12. o Painel de números: as setas esticavam o período (7 → 8 → 9 dias), o
//      filtro escrevia o nome de quem olha sobre os números de outra pessoa,
//      um erro de dentro da função virava "falta uma atualização", e um nome
//      começando com "=" virava fórmula na planilha;
//  13. o que falha é dito: a equipe, Fora do horário, o contato que não deu
//      para conferir, a lista vazia de um filtro, a frase da Distribuição;
//  13b. os filtros de grupos, das minhas, das tarefas e de quem atende, que
//      falhavam calados — e o "Tentar de novo" passou a refazê-los;
//  13c. a aba que não veio ficava em "Carregando…" para sempre;
//  13d. a releitura da administração acendia a faixa e nunca a apagava;
//  13e. a conversa que o filtro traz de fora da lista vinha sem etiqueta;
//  13f. a citação e o avatar do alto usavam o nome cru do WhatsApp;
//  13g. o nome salvo pela agenda sumia na mensagem seguinte do cliente;
//  13h. o pré-cadastro criado não mostrava os telefones dele, e "conversar por
//      este" colava "55" em dígitos que já tinham o 55;
//  13i. o rascunho da ficha aparecia para a próxima pessoa que entrasse.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { campoDaPlanilha } from "../src/planilha.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
// SÓ AS CENAS PEDIDAS, quando se pede: `CENAS=13b,13c node testes/a-auditoria-de-27-10.mjs`.
// É para a rodada de sabotagens, em que cada sabotagem só mexe no que uma ou
// duas cenas medem. Sem a variável, roda tudo — que é como a suíte a roda.
const CENAS = (process.env.CENAS || "").split(",").map((c) => c.trim()).filter(Boolean);
// As cenas que a prova perguntou: no fim, uma cena pedida em CENAS que não
// existe (um erro de digitação) reprova, em vez de a prova terminar verde sem
// ter rodado o que foi pedido.
const cenasDaProva = new Set();
const vale = (cena) => (cenasDaProva.add(cena), !CENAS.length || CENAS.includes(cena));

const nav = await abrirNavegador({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const estouros = [];
const AGORA = Date.now();
const ha = (min) => new Date(AGORA - min * 60e3).toISOString();
const HOST = "https://deposito-da-auditoria.supabase.co";

/** As conversas da prova, descobertas, e não escolhidas a dedo. */
async function descobrir() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-id"));
    const T = globalThis.__TABELAS;
    const alvo = (T.conversas || []).find((c) => String(c.id) === String(ids[0]));
    const grupo = (T.conversas || []).find((c) => c.contato_id === "ct-grupo-perto"
      && alvo && String(c.advogado_id) === String(alvo.advogado_id));
    const naoEhGrupo = ids.filter((id) => {
      const c = (T.conversas || []).find((x) => String(x.id) === String(id));
      return c && !String((T.contatos || []).find((k) => k.id === c.contato_id)?.numero || "").startsWith("grupo:");
    });
    return { alvo: naoEhGrupo[0], outra: naoEhGrupo[1], grupo: grupo ? grupo.id : null,
             adv: alvo ? alvo.advogado_id : null };
  });
  await ctx.close();
  return r;
}
const D = await descobrir();
ok("achei duas conversas de cliente e o grupo do mesmo telefone", Boolean(D.alvo && D.outra && D.grupo), JSON.stringify(D));

/** Uma janela nova por cena — `addInitScript` ACUMULA. */
async function abrir({ largura = 1400, altura = 900, celular = false, vantoro = "tem", bandeiras = {}, semente = null,
                       rotas = null, permissoes = [], ponte = {}, espera = "[data-conversa-nome]" } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, isMobile: celular, hasTouch: celular,
                                     acceptDownloads: true, permissions: permissoes });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const caminho = url.pathname.replace("/ponte-de-mentira", "");
    if (caminho === "/vantoro/status") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, configurado: vantoro === "tem" }) });
    }
    if (ponte[caminho]) {
      const r = ponte[caminho];
      return rota.fulfill({ status: r.status || 200, contentType: "application/json", body: JSON.stringify(r.corpo || {}) });
    }
    if (caminho.startsWith("/vantoro/cliente")) {
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ clientes: [], opcoes: {} }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  if (rotas) await rotas(ctx);
  await page.addInitScript(([b, s]) => {
    globalThis.__SEMENTE = s || undefined;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__ERRO_NO_PAINEL = null;
    globalThis.__ATRASO_POR_TABELA = {};
    globalThis.__CONFERENCIA_DO_ENVIO = [600000, 600000];
    for (const [k, v] of Object.entries(b || {})) globalThis[k] = v;
    globalThis.__FILME = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el ? el.innerText : "";
      if (t && globalThis.__FILME[globalThis.__FILME.length - 1] !== t) globalThis.__FILME.push(t);
    }, 50);
  }, [bandeiras, semente]);
  await page.goto(ENDERECO);
  await page.waitForSelector(espera);
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const filme = (page) => page.evaluate(() => (globalThis.__FILME || []).join(" | "));

async function clicar(page, seletor) {
  const alvo = page.locator(seletor).first();
  if (!(await alvo.count())) return false;
  await alvo.scrollIntoViewIfNeeded().catch(() => {});
  await alvo.click();
  return true;
}
async function abrirConversa(page, id, espera = 1300) {
  const foi = await clicar(page, `[data-conversa-nome][data-conversa-id="${id}"]`);
  await page.waitForTimeout(espera);
  return foi;
}
const caixa = 'textarea[placeholder*="Digite uma mensagem"]';
const temCaixa = async (page) => (await page.locator(caixa).count()) > 0 && (await page.locator(caixa).first().isVisible());
const larguraDaCaixa = (page) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? Math.round(el.getBoundingClientRect().width) : null;
}, caixa);
const listaVisivel = async (page) => {
  const l = page.locator("[data-conversa-nome]").first();
  return (await l.count()) > 0 && (await l.isVisible());
};
const ficha = (page) => page.evaluate(() => {
  const f = document.querySelector("[data-ficha]");
  if (!f) return null;
  const r = f.getBoundingClientRect();
  return { sobreposta: f.getAttribute("data-ficha-sobreposta"), esquerda: Math.round(r.left), direita: Math.round(r.right),
           largura: Math.round(r.width) };
});

/** Abre a ficha pela barra da conversa — ou pelo ⋮, quando a barra recolheu
 *  (é o que ela faz nas janelas médias, onde a conversa tem ~600 pontos). */
async function abrirFicha(page) {
  const botao = page.locator("[data-abrir-ficha]").first();
  if ((await botao.count()) && (await botao.isVisible())) { await botao.click(); return true; }
  if (!(await clicar(page, '[data-topo-conversa] [aria-label="Mais opções desta conversa"]'))) return false;
  await page.waitForTimeout(250);
  return clicar(page, "[data-menu-ficha]");
}

// ==================================================================
if (vale("1")) console.log("\n1. A ficha só é coluna onde cabe; abaixo disso, é uma gaveta");
if (vale("1")) for (const L of [1024, 900]) {
  const { ctx, page } = await abrir({ largura: L });
  ok(`(${L}) abri a conversa`, await abrirConversa(page, D.alvo));
  ok(`(${L}) a ficha não nasce aberta por cima da conversa`, (await ficha(page)) === null, JSON.stringify(await ficha(page)));
  const antes = await larguraDaCaixa(page);
  // A CAIXA DE ESCREVER TEM ONDE ESCREVER: o defeito era ela com uma letra
  // por linha. A conversa tem a largura toda menos a barra e a lista.
  ok(`(${L}) a caixa de escrever tem largura de gente (${antes}px)`, antes != null && antes >= 200, `largura ${antes}`);
  ok(`(${L}) abri a ficha (pela barra, ou pelo ⋮ quando a barra recolhe)`, await abrirFicha(page));
  await page.waitForTimeout(700);
  const f = await ficha(page);
  ok(`(${L}) ela abre como GAVETA, por cima`, f && f.sobreposta === "sim", JSON.stringify(f));
  ok(`(${L}) encostada na borda direita da tela`, f && Math.abs(f.direita - L) <= 1, JSON.stringify(f));
  ok(`(${L}) e a lista de conversas continua à vista`, await listaVisivel(page));
  ok(`(${L}) a conversa não encolheu por baixo dela`, (await larguraDaCaixa(page)) === antes,
     `antes ${antes}, agora ${await larguraDaCaixa(page)}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok(`(${L}) o Esc fecha a gaveta`, (await ficha(page)) === null);
  ok(`(${L}) e a conversa continua aberta`, await temCaixa(page));
  ok(`(${L}) abri de novo`, await abrirFicha(page));
  await page.waitForTimeout(500);
  ok(`(${L}) troquei de conversa`, await abrirConversa(page, D.outra));
  ok(`(${L}) e a gaveta fechou junto`, (await ficha(page)) === null, JSON.stringify(await ficha(page)));
  await ctx.close();
}
if (vale("1")) {
  const { ctx, page } = await abrir({ largura: 1280 });
  ok("(1280) abri a conversa", await abrirConversa(page, D.alvo));
  const f = await ficha(page);
  ok("(1280) a ficha é coluna, aberta sozinha", f && f.sobreposta == null && f.largura >= 330 && f.largura <= 331, JSON.stringify(f));
  const c = await larguraDaCaixa(page);
  ok(`(1280) e a conversa encolhe para dar lugar a ela (${c}px)`, c != null && c < 500, `largura ${c}`);
  // A GAVETA NÃO MUDA A PREFERÊNCIA: abrir e fechar a gaveta numa janela
  // média, e voltar para a larga, devolve a coluna.
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(600);
  ok("(1280 → 1024) a coluna some ao estreitar", (await ficha(page)) === null, JSON.stringify(await ficha(page)));
  await abrirFicha(page);
  await page.waitForTimeout(500);
  await clicar(page, "[data-recolher-ficha]");
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(600);
  const f2 = await ficha(page);
  ok("(1024 → 1280) e volta coluna ao alargar", f2 && f2.sobreposta == null, JSON.stringify(f2));
  await ctx.close();
}

// ==================================================================
if (vale("2")) console.log("\n2. Sem Vantoro, a conta da largura não desconta ficha nenhuma");
if (vale("2")) {
  const tresPontos = (page) => page.locator('[data-topo-conversa] [aria-label="Mais opções desta conversa"]').count();
  const com = await abrir({ largura: 1366, vantoro: "tem" });
  await abrirConversa(com.page, D.alvo);
  const comVantoro = await tresPontos(com.page);
  await com.ctx.close();
  const sem = await abrir({ largura: 1366, vantoro: "nao" });
  await abrirConversa(sem.page, D.alvo);
  ok("sem Vantoro não há ficha", (await ficha(sem.page)) === null);
  const semVantoro = await tresPontos(sem.page);
  ok("com Vantoro, a 1366, a barra da conversa recolhe no ⋮ (a ficha ocupa 330)", comVantoro === 1, `⋮: ${comVantoro}`);
  ok("sem Vantoro, a barra vem solta: a conversa tem a largura toda", semVantoro === 0, `⋮: ${semVantoro}`);
  await sem.ctx.close();
}

// ==================================================================
if (vale("3")) console.log("\n3. O áudio gravado fica na conversa onde foi gravado");
if (vale("3")) {
  const { ctx, page } = await abrir({ permissoes: ["microphone"], bandeiras: { __DEPOSITO_COM_ENDERECO: true } });
  ok("abri a conversa A", await abrirConversa(page, D.alvo));
  ok("comecei a gravar", await clicar(page, 'button[title="Gravar áudio"]'));
  await page.waitForTimeout(1500);
  ok("a barra de gravação está na caixa de A", (await page.locator('button[title="Concluir gravação"]').count()) === 1);
  ok("troquei para B no meio da gravação", await abrirConversa(page, D.outra, 1500));
  ok("a caixa de B é a de escrever, e não a gravação de A",
     (await temCaixa(page)) && (await page.locator('button[title="Concluir gravação"]').count()) === 0
     && (await page.locator('button[title="Enviar áudio"]').count()) === 0);
  // O ESC EM B NÃO APAGA O ÁUDIO DE A: ele não está na tela.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("voltei para A", await abrirConversa(page, D.alvo));
  ok("e o áudio de A está lá, pronto para ouvir e enviar", (await page.locator('button[title="Enviar áudio"]').count()) === 1);
  const antes = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).length);
  ok("enviei", await clicar(page, 'button[title="Enviar áudio"]'));
  await page.waitForTimeout(2000);
  const novos = await page.evaluate((n) => (globalThis.__TABELAS.fila_envio || []).slice(n)
    .map((f) => ({ conversa: f.conversa_id, tipo: f.tipo })), antes);
  ok("o áudio foi para a fila de A", novos.length === 1 && String(novos[0].conversa) === String(D.alvo) && novos[0].tipo === "audio",
     JSON.stringify(novos));
  await ctx.close();
}

// ==================================================================
if (vale("4")) console.log("\n4. A etapa do funil do cliente de antes não aparece na conversa seguinte");
if (vale("4")) {
  // A LEITURA DO CARTÃO DE A DEMORA: a resposta chega com o GRUPO aberto, que
  // não tem funil — e a guarda pela chave do estado (nulo) a deixava passar.
  const { ctx, page } = await abrir({ bandeiras: { __ATRASO_POR_TABELA: { zorvin_cartoes: [1800, 0] } } });
  ok("abri a conversa A", await abrirConversa(page, D.alvo, 200));
  ok("e logo o grupo, antes de a etapa de A chegar", await abrirConversa(page, D.grupo, 200));
  await page.waitForTimeout(2600);
  const selos = await page.locator("[data-etapa-da-conversa]").count();
  ok("o grupo não mostra a etapa de ninguém", selos === 0, `selos de etapa: ${selos}`);
  ok("voltei para A", await abrirConversa(page, D.alvo, 1500));
  ok("e A mostra a etapa dela", (await page.locator("[data-etapa-da-conversa]").count()) > 0);
  await ctx.close();
}

// ==================================================================
if (vale("5")) console.log("\n5. O Esc desiste do menu, e não da conversa");
if (vale("5")) {
  const { ctx, page } = await abrir({ semente: { mensagens_rapidas: [
    { id: "r-aud-1", titulo: "Boas-vindas", texto: "Olá! Seja bem-vindo.", criado_em: "2026-10-01T12:00:00Z" },
    { id: "r-aud-2", titulo: "Documentos", texto: "Ainda faltam o RG e o comprovante.", criado_em: "2026-10-01T12:00:00Z" },
  ] } });
  ok("abri a conversa", await abrirConversa(page, D.alvo));
  await page.locator(caixa).first().fill("/");
  await page.waitForTimeout(500);
  ok("o menu do “/” abriu", (await page.getByText("Boas-vindas").count()) > 0);
  await page.locator(caixa).first().press("Escape");
  await page.waitForTimeout(400);
  ok("o Esc no menu do “/” apaga o “/”", (await page.locator(caixa).first().inputValue().catch(() => "x")) === "");
  ok("e a conversa continua aberta", await temCaixa(page));
  if (!(await temCaixa(page))) await abrirConversa(page, D.alvo);
  ok("abri o menu de departamentos", await clicar(page, 'button[title="Trocar de departamento"]'));
  await page.waitForTimeout(400);
  const aberto = await page.locator('button[title="Trocar de departamento"]').first().getAttribute("aria-expanded").catch(() => null);
  ok("ele abriu", aberto === "true", `aria-expanded ${aberto}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const depois = await page.locator('button[title="Trocar de departamento"]').first().getAttribute("aria-expanded").catch(() => null);
  ok("o Esc fecha o menu de departamentos", depois === "false", `aria-expanded ${depois}`);
  ok("e a conversa continua aberta", await temCaixa(page));
  await ctx.close();
}

// ==================================================================
if (vale("6")) console.log("\n6. Configurações → Contatos carrega a agenda sozinha");
if (vale("6")) {
  const { ctx, page } = await abrir();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  ok("abri as Configurações", await clicar(page, 'button:has-text("Configurações")'));
  await page.waitForTimeout(500);
  const abaContatos = page.getByRole("button", { name: "Contatos", exact: true });
  ok("e a aba Contatos", (await abaContatos.count()) > 0 && (await abaContatos.first().click(), true));
  await page.waitForTimeout(1500);
  const linhas = await page.locator('button[title="Abrir conversa"]').count();
  ok("a agenda aparece, sem precisar abrir a Nova conversa antes", linhas > 0, `contatos na aba: ${linhas}`);
  await ctx.close();
}

// ==================================================================
if (vale("7")) console.log("\n7. A seleção de mensagens fica na conversa dela");
if (vale("7")) {
  const { ctx, page } = await abrir();
  ok("abri a conversa", await abrirConversa(page, D.alvo));
  const bolha = page.locator("[data-msg-id]").last();
  await bolha.hover().catch(() => {});
  ok("abri o menu de uma mensagem", await clicar(page, '[data-msg-id] button[aria-label="Opções da mensagem"]'));
  ok("Apagar (liga a seleção)", await clicar(page, 'div[data-menu-msg] button:has-text("Apagar")'));
  await page.waitForTimeout(400);
  ok("a barra da seleção aparece", (await page.locator('button[title="Apagar as selecionadas"]').count()) === 1);
  ok("troquei de conversa", await abrirConversa(page, D.outra));
  ok("e na outra está a caixa de escrever, e não a seleção de antes",
     (await page.locator('button[title="Apagar as selecionadas"]').count()) === 0 && (await temCaixa(page)));
  await ctx.close();
}

// ==================================================================
if (vale("8")) console.log("\n8. A faixa de aviso fica por cima das Mídias");
if (vale("8")) {
  const DOC = `${HOST}/storage/v1/object/public/anexos/recebidos/AUD0000NAOEXISTE.pdf`;
  const { ctx, page } = await abrir({
    semente: { mensagens: [{ id: "aud-doc", conversa_id: D.alvo, origem: "contato", tipo: "documento", texto: null,
      midia_url: DOC, midia_mime: "application/pdf", midia_nome: "Sumiu do depósito.pdf", criado_em: ha(2),
      status: "entregue", id_uazapi: "AUD-DOC-1" }] },
    rotas: (c) => c.route(new RegExp("^" + HOST.replace(/[.]/g, "\\.") + "/"), (r) => r.fulfill({
      status: 404, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found" }) })),
  });
  ok("abri as Mídias", await clicar(page, '[title="Mídias, documentos e links"]'));
  ok("e os Documentos", await clicar(page, '[data-aba-das-midias="documentos"]'));
  await page.waitForTimeout(900);
  ok("cliquei no documento que o depósito não tem",
     await clicar(page, '[data-documento-do-acervo][data-nome-ao-baixar="Sumiu do depósito.pdf"]'));
  await page.waitForTimeout(1500);
  const visto = await page.evaluate(() => {
    const a = document.querySelector("[data-aviso]");
    if (!a) return { tem: false };
    const r = a.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tem: true, texto: a.innerText, pintado: Boolean(topo && a.contains(topo)) };
  });
  ok("a faixa diz que não deu", visto.tem && /Não consegui baixar/.test(visto.texto || ""), JSON.stringify(visto));
  ok("e ela está PINTADA por cima das Mídias", visto.pintado === true, JSON.stringify(visto));
  await ctx.close();
}

// ==================================================================
if (vale("8b")) console.log("\n8b. A seta de opções do PDF recebido fica por cima da prévia");
if (vale("8b")) {
  // O NAVEGADOR DAS PROVAS NÃO TEM LEITOR DE PDF, e sem leitor a prévia nem é
  // desenhada — por isso o defeito passou: ele só existe num Chrome com
  // leitor, que é o do escritório. A cena diz ao painel que há leitor; a
  // prévia é desenhada (no navegador sem leitor, o quadro de dentro baixa o
  // arquivo em silêncio, e isso não muda nada aqui), e a seta tem de estar
  // PINTADA por cima dela.
  //
  // DESDE 29/10 A PRÉVIA É A FOTO da primeira página, desenhada pelo pdf.js
  // com ou sem leitor (`a-previa-do-pdf`), e mora num botão próprio, acima
  // da linha do nome. A seta tem de continuar por cima dela do mesmo jeito; a
  // cena segue dizendo ao painel que há leitor, que é o mundo do escritório.
  const PDF = Buffer.from("JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+", "base64");
  const URL_DO_PDF = `${HOST}/storage/v1/object/public/anexos/recebidos/AUD0000COMPREVIA.pdf`;
  const { ctx, page } = await abrir({
    semente: { mensagens: [{ id: "aud-pdf", conversa_id: D.alvo, origem: "contato", tipo: "documento", texto: null,
      midia_url: URL_DO_PDF, midia_mime: "application/pdf", midia_nome: "Procuração assinada.pdf", criado_em: ha(1),
      status: "entregue", id_uazapi: "AUD-PDF-1" }] },
    rotas: async (c) => {
      await c.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => true, configurable: true });
      });
      await c.route(new RegExp("^" + HOST.replace(/[.]/g, "\\.") + "/"), (r) => r.fulfill({
        status: 200, contentType: "application/pdf", headers: { "access-control-allow-origin": "*" }, body: PDF }));
    },
  });
  ok("abri a conversa", await abrirConversa(page, D.alvo, 1800));
  // A prévia só pergunta o tipo quando a bolha chega perto da tela.
  await page.locator('[data-msg-id="aud-pdf"]').scrollIntoViewIfNeeded().catch(() => {});
  const previa = page.locator('[data-msg-id="aud-pdf"] [data-previa-do-pdf="pronta"]');
  await previa.first().waitFor({ timeout: 8000 }).catch(() => {});
  ok("a prévia do PDF foi desenhada — hoje a foto da primeira página (é ela que fica embaixo da seta)",
     (await previa.count()) === 1);
  await page.locator('[data-msg-id="aud-pdf"]').hover().catch(() => {});
  await page.waitForTimeout(300);
  const seta = await page.evaluate(() => {
    const b = document.querySelector('[data-msg-id="aud-pdf"] button[aria-label="Opções da mensagem"]');
    if (!b) return { tem: false };
    const r = b.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tem: true, pintada: Boolean(no && (no === b || b.contains(no))),
             quem: no ? (no.closest("[data-previa-arquivo], [data-previa-do-pdf]") ? "a prévia" : no.tagName) : null };
  });
  ok("a seta está PINTADA por cima da prévia", seta.tem && seta.pintada === true, JSON.stringify(seta));
  ok("e o clique nela abre o menu", await clicar(page, '[data-msg-id="aud-pdf"] button[aria-label="Opções da mensagem"]')
     && (await page.waitForTimeout(300), (await page.locator("[data-abrir-numa-aba]").count()) === 1));
  await ctx.close();
}

// ==================================================================
if (vale("9")) console.log("\n9. No celular, a janela de agendar o anexo cabe na tela");
if (vale("9")) {
  const { ctx, page } = await abrir({ largura: 360, altura: 740, celular: true });
  ok("abri a conversa", await abrirConversa(page, D.alvo));
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "agendar-no-celular.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  await page.waitForTimeout(800);
  ok("a prévia do anexo abriu", (await page.locator("[data-previa-anexo]").count()) === 1);
  ok("abri o agendar", await clicar(page, "[data-agendar-anexo]"));
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const el = document.querySelector("[data-escolher-hora]");
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { esquerda: Math.round(b.left), direita: Math.round(b.right) };
  });
  ok("a janela começa dentro da tela", r && r.esquerda >= 0, JSON.stringify(r));
  ok("e termina dentro dela", r && r.direita <= 360, JSON.stringify(r));
  // TOCAR AO LADO DA JANELA NÃO FECHA A PRÉVIA: a faixa que a centraliza não
  // recebe toque, e o toque fora da janela vai para o fundo da prévia — que é
  // o gesto de desistir dela, como antes.
  await ctx.close();
}

// ==================================================================
if (vale("9b")) console.log("\n9b. Os anexos mandados juntos chegam na ordem da prévia");
if (vale("9b")) {
  // O GRANDE PRIMEIRO, o pequeno depois: o pequeno termina de subir antes, e
  // era nessa hora que ele entrava na fila — na frente do grande.
  const { ctx, page } = await abrir({ bandeiras: { __DEPOSITO_COM_ENDERECO: true, __SUBIDA_POR_KB: 6 } });
  ok("abri a conversa", await abrirConversa(page, D.alvo));
  await page.setInputFiles('input[type="file"][multiple]', [
    { name: "1-video-grande.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(300 * 1024, 7) },
    { name: "2-procuracao-pequena.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") },
  ]);
  await page.waitForTimeout(800);
  ok("a prévia abriu com os dois", (await page.locator("[data-previa-anexo]").count()) === 1);
  const antes = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).length);
  ok("enviei os dois", await clicar(page, '[data-previa-anexo] button[title="Enviar os 2"]'));
  await page.waitForTimeout(4000);
  const ordem = await page.evaluate((n) => (globalThis.__TABELAS.fila_envio || []).slice(n).map((f) => f.midia_nome), antes);
  ok("os dois entraram na fila", ordem.length === 2, JSON.stringify(ordem));
  ok("na ordem da prévia: o grande primeiro, mesmo subindo por último",
     ordem[0] === "1-video-grande.mp4" && ordem[1] === "2-procuracao-pequena.pdf", JSON.stringify(ordem));
  await ctx.close();
}

// ==================================================================
if (vale("10")) console.log("\n10. “Respondendo você mesmo” só quando é você");
if (vale("10")) {
  const { ctx, page } = await abrir({
    semente: { mensagens: [
      { id: "aud-celular", conversa_id: D.alvo, origem: "advogado", tipo: "texto", texto: "Mandada pelo celular do escritório",
        criado_em: ha(3), status: "entregue", id_uazapi: "AUD-CEL-1", enviado_por: "WhatsApp", enviado_por_id: null },
      { id: "aud-antiga", conversa_id: D.alvo, origem: "advogado", tipo: "texto", texto: "Antiga, só com o nome",
        criado_em: ha(2), status: "entregue", id_uazapi: "AUD-ANT-1", enviado_por: "Jenifer Almeida", enviado_por_id: null },
    ] },
  });
  ok("abri a conversa", await abrirConversa(page, D.alvo));
  const responder = async (id) => {
    await page.locator(`[data-msg-id="${id}"]`).hover().catch(() => {});
    if (!(await clicar(page, `[data-msg-id="${id}"] button[aria-label="Opções da mensagem"]`))) return null;
    if (!(await clicar(page, 'div[data-menu-msg] button:has-text("Responder")'))) return null;
    await page.waitForTimeout(300);
    return page.evaluate(() => [...document.querySelectorAll("div")].map((d) => d.textContent)
      .find((t) => /^Respondendo /.test(t || "") && t.length < 80) || "");
  };
  const cel = await responder("aud-celular");
  ok("a mandada pelo celular não é “você mesmo”", cel != null && !/você mesmo/.test(cel) && /pelo celular/.test(cel), cel);
  const antiga = await responder("aud-antiga");
  ok("a antiga diz o nome de quem escreveu", antiga != null && /Jenifer Almeida/.test(antiga), antiga);
  await ctx.close();
}

// ==================================================================
if (vale("11")) console.log("\n11. A importação oferece só os telefones que a pessoa alcança");
if (vale("11")) {
  const { ctx, page } = await abrir({ semente: { advogados: [
    { id: "adv-aud-desligada", nome: "Linha Desligada da Auditoria", numero: "5511900002710", ativo: false,
      departamento_id: 1, foto_url: null },
  ] } });
  const desativados = await page.evaluate(() => (globalThis.__TABELAS.advogados || [])
    .filter((a) => a.ativo === false).map((a) => a.nome));
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  await clicar(page, 'button:has-text("Configurações")');
  await page.waitForTimeout(400);
  const abaImportar = page.getByRole("button", { name: "Importar histórico", exact: true });
  ok("abri Importar histórico", (await abaImportar.count()) > 0 && (await abaImportar.first().click(), true));
  await page.waitForTimeout(500);
  const opcoes = await page.evaluate(() => {
    const s = [...document.querySelectorAll("select")].find((x) => /Escolha/.test(x.options[0]?.text || ""));
    return s ? [...s.options].slice(1).map((o) => o.text) : null;
  });
  ok("a lista de telefones existe", Array.isArray(opcoes) && opcoes.length > 0, JSON.stringify(opcoes));
  ok("e não oferece linha desativada",
     desativados.length > 0 && Array.isArray(opcoes) && !opcoes.some((o) => desativados.includes(o)),
     `desativados: ${JSON.stringify(desativados)} · oferecidos: ${JSON.stringify(opcoes)}`);
  await ctx.close();
}

// ==================================================================
if (vale("12b")) console.log("\n12b. No celular, a etapa e a tarefa viram ícone; o responsável continua escrito");
if (vale("12b")) for (const L of [360, 390]) {
  const { ctx, page } = await abrir({ largura: L, altura: 800, celular: true });
  ok(`(${L}) abri a conversa`, await abrirConversa(page, D.alvo, 1600));
  const m = await page.evaluate(() => {
    const ler = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      return { texto: (el.textContent || "").trim(), compacto: el.getAttribute("data-selo-compacto"),
               rotulo: el.getAttribute("aria-label") || el.getAttribute("title") || "",
               cortado: el.scrollWidth > el.clientWidth + 1 };
    };
    return { resp: ler("[data-responsavel-da-conversa]"), etapa: ler("[data-etapa-da-conversa]"),
             tarefa: ler("[data-tarefa-da-conversa]") };
  });
  ok(`(${L}) o responsável continua escrito`, m.resp && /responsável|com /.test(m.resp.texto), JSON.stringify(m.resp));
  ok(`(${L}) a etapa vira ícone, com o nome no rótulo`, m.etapa && m.etapa.compacto === "sim" && m.etapa.texto === ""
     && /funil/i.test(m.etapa.rotulo), JSON.stringify(m.etapa));
  ok(`(${L}) a tarefa vira ícone, com o rótulo`, m.tarefa && m.tarefa.compacto === "sim" && m.tarefa.texto === ""
     && /tarefa/i.test(m.tarefa.rotulo), JSON.stringify(m.tarefa));
  await ctx.close();
}
if (vale("12b")) {
  const { ctx, page } = await abrir({ largura: 700, altura: 900, celular: true });
  ok("(700) abri a conversa", await abrirConversa(page, D.alvo, 1600));
  const etapa = await page.evaluate(() => {
    const el = document.querySelector("[data-etapa-da-conversa]");
    return el ? { texto: (el.textContent || "").trim(), compacto: el.getAttribute("data-selo-compacto") } : null;
  });
  ok("(700) com espaço, a etapa continua escrita", etapa && etapa.compacto === "nao" && etapa.texto.length > 0, JSON.stringify(etapa));
  await ctx.close();
}

// ==================================================================
if (vale("12c")) console.log("\n12c. O botão das abas das Configurações não fica debaixo do X");
if (vale("12c")) for (const [L, celular] of [[1400, false], [390, true]]) {
  const { ctx, page } = await abrir({ largura: L, altura: 860, celular });
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  await clicar(page, 'button:has-text("Configurações")');
  await page.waitForTimeout(500);
  for (const aba of ["Contatos", "Mensagens rápidas", "Etiquetas"]) {
    const botaoAba = page.getByRole("button", { name: aba, exact: true });
    const abaExiste = (await botaoAba.count()) > 0;
    ok(`(${L}) ${aba}: a aba existe`, abaExiste);
    if (!abaExiste) continue;
    await botaoAba.first().click();
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const acao = document.querySelector("[data-cabecalho-da-aba] > button");
      const x = [...document.querySelectorAll('button[title="Fechar"]')].find((b) => b.offsetParent);
      if (!acao || !x) return { acao: !!acao, x: !!x };
      const a = acao.getBoundingClientRect(); const f = x.getBoundingClientRect();
      const cruza = !(a.right <= f.left || f.right <= a.left || a.bottom <= f.top || f.bottom <= a.top);
      // O QUE ESTÁ PINTADO na ponta direita do botão: é ele, e não o X.
      const ponta = document.elementFromPoint(a.right - 3, a.top + a.height / 2);
      return { cruza, folga: Math.round(f.left - a.right), pontaEhBotao: Boolean(ponta && acao.contains(ponta)) };
    });
    ok(`(${L}) ${aba}: o botão da aba e o X não se cruzam`, m.cruza === false, JSON.stringify(m));
    ok(`(${L}) ${aba}: a ponta do botão é dele, e não do X`, m.pontaEhBotao === true, JSON.stringify(m));
  }
  await ctx.close();
}

// ==================================================================
if (vale("12")) console.log("\n12. O Painel de números");
async function irAoPainel(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Painel" }).click();
  await page.waitForSelector('[data-tela="painel"]');
  await page.waitForTimeout(1200);
}
const rotuloDoPeriodo = (page) => page.locator('[data-teste="abrir-periodo"]').innerText();
const diasDoRotulo = (t) => Number((/· (\d+) dias/.exec(t || "") || [])[1] || 0);
const dataDoRotulo = (t) => (/(\d{2}\/\d{2}) – (\d{2}\/\d{2})/.exec(t || "") || []).slice(1);
if (vale("12")) {
  const { ctx, page } = await abrir();
  await irAoPainel(page);
  await clicar(page, '[data-teste="abrir-periodo"]');
  await page.waitForSelector('[data-grupo="periodo"]');
  await page.locator('[data-grupo="periodo"]').getByRole("button", { name: "7 dias", exact: true }).click();
  await page.waitForTimeout(600);
  const r0 = await rotuloDoPeriodo(page);
  ok("“7 dias” diz 7 dias", diasDoRotulo(r0) === 7, r0);
  const vistos = [r0];
  for (let i = 0; i < 3; i++) {
    await clicar(page, 'button[aria-label="Período anterior"]');
    await page.waitForTimeout(500);
    vistos.push(await rotuloDoPeriodo(page));
  }
  ok("três cliques para trás, e continuam sendo 7 dias", vistos.length === 4 && vistos.every((t) => diasDoRotulo(t) === 7), vistos.join(" | "));
  // E OS PERÍODOS ENCOSTAM UM NO OUTRO: o fim de cada um é a véspera do
  // começo do seguinte — nenhum dia pulado, nenhum contado duas vezes.
  const encostam = vistos.slice(1).every((t, i) => {
    const [, fim] = dataDoRotulo(t); const [inicioDoSeguinte] = dataDoRotulo(vistos[i]);
    if (!fim || !inicioDoSeguinte) return false;
    const [d1, m1] = fim.split("/").map(Number); const [d2, m2] = inicioDoSeguinte.split("/").map(Number);
    const a = new Date(2026, m1 - 1, d1); const b = new Date(2026, m2 - 1, d2);
    if (b < a) b.setFullYear(2027);
    return Math.round((b - a) / 86400e3) === 1;
  });
  ok("cada semana termina na véspera da seguinte", encostam, vistos.join(" | "));
  for (let i = 0; i < 3; i++) { await clicar(page, 'button[aria-label="Período seguinte"]'); await page.waitForTimeout(400); }
  ok("e de volta para a frente, a semana de hoje outra vez", (await rotuloDoPeriodo(page)) === r0, await rotuloDoPeriodo(page));

  // O FILTRO DE ATENDENTE ESCREVE O NOME DE QUEM FOI ESCOLHIDO.
  const botaoEscopo = page.locator('[data-grupo="escopo"] > button');
  ok("abri o filtro de atendentes", (await botaoEscopo.count()) === 1 && (await botaoEscopo.click(), true));
  await page.waitForTimeout(300);
  const opcoes = await page.locator('[data-grupo="escopo"] div button').allInnerTexts();
  const colega = opcoes.map((t) => t.trim()).find((t) => t && !/Todos os atendentes|\(você\)/.test(t));
  ok("há uma colega na lista", Boolean(colega), JSON.stringify(opcoes));
  if (colega) await page.locator('[data-grupo="escopo"] div button', { hasText: colega }).first().click();
  await page.waitForTimeout(700);
  await clicar(page, '[data-teste="abrir-periodo"]');
  await page.waitForSelector('[data-grupo="periodo"]');
  await page.locator('[data-grupo="periodo"]').getByRole("button", { name: "Ano passado", exact: true }).click();
  await page.waitForTimeout(900);
  const escrito = (await botaoEscopo.innerText().catch(() => "")).trim();
  ok("num período sem os números dela, o filtro continua escrevendo o NOME DELA", colega && escrito === colega,
     `escolhida: ${colega} · escrito: ${escrito}`);
  ok("e não o de quem está olhando", !/Rodrigo Sousa/.test(escrito) || /Rodrigo Sousa/.test(colega || ""), escrito);
  await ctx.close();
}
if (vale("12")) {
  // UM ERRO DE DENTRO DA FUNÇÃO NÃO É "FALTA UMA ATUALIZAÇÃO".
  const { ctx, page } = await abrir({ bandeiras: { __ERRO_NO_PAINEL: {
    code: "42703", message: 'column m.enviado_por_foto does not exist' } } });
  await irAoPainel(page);
  await page.waitForTimeout(800);
  const texto = await page.locator('[data-tela="painel"]').innerText();
  ok("o erro de dentro da função aparece com a frase e o código", /enviado_por_foto does not exist/.test(texto) && /42703/.test(texto),
     texto.slice(0, 300));
  await ctx.close();
}
if (vale("12")) {
  // A PLANILHA: um nome que começa com "=" sai como TEXTO.
  ok("campoDaPlanilha: o “=” ganha o apóstrofo", campoDaPlanilha('=HIPERLINK("x";"y")') === '"\'=HIPERLINK(""x"";""y"")"',
     campoDaPlanilha('=HIPERLINK("x";"y")'));
  const comecosDeFormula = ["+55 cobrança", "-Maria", "@cliente"];
  ok("campoDaPlanilha: o “+”, o “-” e o “@” também", comecosDeFormula.length === 3
     && comecosDeFormula.every((v) => campoDaPlanilha(v).startsWith(`"'`)));
  ok("campoDaPlanilha: número negativo continua número", campoDaPlanilha("-3") === '"-3"' && campoDaPlanilha(-3) === '"-3"');
  ok("campoDaPlanilha: o resto, como sempre", campoDaPlanilha("ANA") === '"ANA"' && campoDaPlanilha(null) === '""');

  const contato = { id: "ct-aud-formula", numero: "5511970007701", nome: "=1+2 CLIENTE" };
  const { ctx, page } = await abrir({ semente: {
    contatos: [contato],
    conversas: [{ id: "cv-aud-formula", advogado_id: D.adv, contato_id: contato.id, nao_lidas: 0, arquivada: false,
      fixada: false, favorita: false, ultima_atividade: ha(60), esperando_desde: null, tratada_em: null,
      ultima_mensagem: "oi", contato }],
    zorvin_tratamentos: [{ id: "tr-aud-formula", conversa_id: "cv-aud-formula", assunto_id: "as-6", quem: "u1",
      quando: ha(120), esperava_desde: ha(600) }],
  } });
  await irAoPainel(page);
  await page.waitForTimeout(800);
  const baixar = page.locator("[data-relatorio-ja-tratei] [data-relatorio-baixar]");
  let csv = "";
  if (await baixar.count()) {
    await baixar.scrollIntoViewIfNeeded().catch(() => {});
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 6000 }).catch(() => null), baixar.click()]);
    if (dl) { const fs = await import("node:fs"); csv = fs.readFileSync(await dl.path(), "utf8"); }
  }
  ok("a planilha do “Já tratei” baixou", csv.length > 0);
  ok("o nome que começa com “=” vai como texto", csv.includes(`"'=1+2 CLIENTE"`), csv.split("\r\n").find((l) => /1\+2/.test(l)) || "");
  ok("e nunca como fórmula", !/(^|;)"=1\+2/m.test(csv));
  await ctx.close();
}

// ==================================================================
if (vale("13")) console.log("\n13. O que falha é dito, e não vira ausência");
async function abrirAdmin(page, aba) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  await clicar(page, 'button:has-text("Departamentos e acessos")');
  await page.waitForTimeout(800);
  if (aba) {
    const b = page.getByRole("button", { name: aba, exact: true });
    if (!(await b.count())) return false;
    await b.first().click();
    await page.waitForTimeout(900);
  }
  return true;
}
if (vale("13")) {
  // A EQUIPE QUE NÃO CARREGOU não é "ninguém com esse nome".
  const { ctx, page } = await abrir({ ponte: { "/permissoes/atendentes": { status: 500, corpo: { erro: "A ponte tropeçou ao ler a equipe." } } } });
  ok("abri Atendentes", await abrirAdmin(page, "Atendentes"));
  const falha = await page.locator("[data-equipe-nao-carregou]").count();
  ok("a falha da equipe é dita, com o tentar de novo", falha === 1
     && (await page.locator("[data-equipe-nao-carregou] button", { hasText: "Tentar de novo" }).count()) === 1);
  ok("e não diz “Ninguém com esse nome”", (await page.getByText("Ninguém com esse nome.").count()) === 0);
  await ctx.close();
}
if (vale("13")) {
  const { ctx, page } = await abrir({ ponte: { "/permissoes/atendentes": { corpo: { usuarios: [], com_vantoro: true } } } });
  ok("abri Atendentes de uma equipe vazia", await abrirAdmin(page, "Atendentes"));
  const t = await page.locator("[data-equipe-vazia]").innerText().catch(() => "");
  ok("sem pesquisa, a lista vazia diz que a equipe está vazia — e não “com esse nome”", /Ninguém na equipe ainda/.test(t), t);
  await ctx.close();
}
if (vale("13")) {
  // FORA DO HORÁRIO QUE NÃO CARREGOU não vira formulário em branco.
  const { ctx, page } = await abrir({ bandeiras: { __RECUSAR_LEITURA: ["zorvin_fora_do_horario"] } });
  ok("abri Fora do horário", await abrirAdmin(page, null) && await clicar(page, "[data-aba-fora-do-horario]"));
  await page.waitForTimeout(1000);
  ok("a falha da leitura é dita", (await page.locator("[data-fora-falha-de-leitura]").count()) === 1);
  ok("e não há formulário para salvar por cima", (await page.locator("[data-fora-salvar]").count()) === 0);
  await ctx.close();
}
if (vale("13")) {
  // O CONTATO QUE NÃO DEU PARA CONFERIR não é criado de novo.
  const { ctx, page } = await abrir({ bandeiras: { __RECUSAR_LEITURA: ["contatos"] } });
  const antes = await page.evaluate(() => (globalThis.__TABELAS.contatos || []).length);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  await clicar(page, 'button:has-text("Configurações")');
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Contatos", exact: true }).first().click();
  await page.waitForTimeout(600);
  ok("abri o novo contato", await clicar(page, "[data-cabecalho-da-aba] > button"));
  await page.locator('input[placeholder="Ex.: João Silva"]').fill("Cliente da Auditoria");
  await page.locator('input[placeholder="5511999999999"]').fill("5571992590399");
  ok("salvei", await clicar(page, 'button:has-text("Salvar")'));
  await page.waitForTimeout(1200);
  const depois = await page.evaluate(() => (globalThis.__TABELAS.contatos || []).length);
  ok("nenhum contato foi criado sem conferir", depois === antes, `antes ${antes}, depois ${depois}`);
  const f = await filme(page);
  ok("e a faixa diz que não conferiu", /Não consegui conferir se este número já é um contato/.test(f), f);
  await ctx.close();
}
if (vale("13")) {
  // A LISTA VAZIA DE UM FILTRO fala do filtro.
  const { ctx, page } = await abrir();
  const fav = page.getByRole("button", { name: "Favoritas", exact: true });
  ok("liguei o filtro Favoritas", (await fav.count()) > 0 && (await fav.first().click(), true));
  await page.waitForTimeout(800);
  const recado = await page.locator("[data-recado-da-lista]").first().getAttribute("data-recado-da-lista").catch(() => null);
  ok("a lista vazia diz que não há favorita, e não “Nenhuma conversa ainda”", recado === "sem-favoritas", recado);
  await ctx.close();
}
if (vale("13")) {
  // A ABA DISTRIBUIÇÃO DIZ A REGRA DE HOJE DO AVISO.
  const { ctx, page } = await abrir();
  ok("abri Distribuição", await abrirAdmin(page, null) && await clicar(page, "[data-aba-distribuicao]"));
  await page.waitForTimeout(800);
  const t = await page.locator("[data-distribuicao]").first().innerText().catch(() => "");
  ok("a frase diz que o aviso vai para quem recebeu", /vai só para quem recebeu/.test(t), t.slice(0, 300));
  ok("e não a regra de antes", !/não muda: até alguém responder/.test(t));
  await ctx.close();
}

// ==================================================================
if (vale("13b")) console.log("\n13b. Os filtros que falham dizem que falharam, e o “Tentar de novo” os refaz");
const faixa = (page) => page.locator("[data-falha-de-leitura]").innerText().catch(() => "");
if (vale("13b")) {
  // OS GRUPOS: calada, a lista ficava com os grupos que por acaso estavam
  // carregados, com cara de todos.
  const { ctx, page } = await abrir();
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["contatos"]; });
  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  ok("liguei o filtro de grupos", await clicar(page, "[data-grupos-opcao]"));
  await page.waitForTimeout(1500);
  const f1 = await faixa(page);
  ok("a falha dos grupos é dita na faixa", /todos os grupos deste telefone/.test(f1), f1);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(2000);
  const f2 = await faixa(page);
  ok("e ele refaz o filtro: a faixa deixa de falar dos grupos", !/grupos/.test(f2), f2);
  await ctx.close();
}
if (vale("13b")) {
  // AS MINHAS: era só um `console.error`.
  const { ctx, page } = await abrir();
  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  const temMinhas = (await page.locator("[data-minhas-opcao]").count()) > 0;
  ok("o filtro “Minhas conversas” existe nesta bancada", temMinhas);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["conversas"]; });
  if (temMinhas) await clicar(page, "[data-minhas-opcao]");
  await page.waitForTimeout(1500);
  const f1 = await faixa(page);
  ok("a falha das minhas é dita na faixa", /todas as conversas que são suas/.test(f1), f1);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(2000);
  const f2 = await faixa(page);
  ok("e o “Tentar de novo” as refaz", !/que são suas/.test(f2), f2);
  await ctx.close();
}
if (vale("13b")) {
  // AS TAREFAS: a segunda ida (as conversas com tarefa fora das páginas
  // lidas) era só o console.
  const semente = { zorvin_tarefas: [{ id: "tar-aud", conversa_id: D.alvo, texto: "ligar para o cliente",
                                       vence_em: ha(60), para_quem: null, criada_em: ha(120), feita_em: null }] };
  const { ctx, page } = await abrir({ semente });
  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  const temTarefas = (await page.locator("[data-tarefas-opcao]").count()) > 0;
  ok("o filtro “Com tarefa para hoje” existe nesta bancada", temTarefas);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["conversas"]; });
  if (temTarefas) await clicar(page, "[data-tarefas-opcao]");
  await page.waitForTimeout(1500);
  const f1 = await faixa(page);
  ok("a falha da segunda ida das tarefas é dita na faixa", /as conversas com tarefa para hoje/.test(f1), f1);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(2000);
  const f2 = await faixa(page);
  ok("e o “Tentar de novo” refaz as tarefas", !/tarefa para hoje/.test(f2), f2);
  await ctx.close();
}
if (vale("13b")) {
  // QUEM ATENDE O TELEFONE: sem a função, o botão some calado (o recurso não
  // existe); a função que FALHA é dita, e o “Tentar de novo” traz o botão.
  const botaoQuem = '[aria-label="Filtrar por quem participou"]';
  const sem = await abrir({ bandeiras: { __SEM_FILTRO_DE_ATENDENTE: true } });
  ok("sem a função no banco, o botão não aparece", (await sem.page.locator(botaoQuem).count()) === 0);
  ok("e a faixa não acende por isso", !/quem atende este telefone/.test(await faixa(sem.page)));
  await sem.ctx.close();
  const { ctx, page } = await abrir({ bandeiras: { __FUNCAO_FALHA: ["atendentes_do_telefone"] } });
  ok("com a função falhando, o botão também não aparece", (await page.locator(botaoQuem).count()) === 0);
  const f1 = await faixa(page);
  ok("mas a falha é dita na faixa", /a lista de quem atende este telefone/.test(f1), f1);
  await page.evaluate(() => { globalThis.__FUNCAO_FALHA = []; });
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(2000);
  ok("e o “Tentar de novo” traz o botão de volta", (await page.locator(botaoQuem).count()) === 1);
  ok("e a faixa sai", !/quem atende este telefone/.test(await faixa(page)));
  await ctx.close();
}

// ==================================================================
if (vale("13c")) console.log("\n13c. A aba que não veio diz que não veio, e não fica em “Carregando…”");
if (vale("13c")) {
  const { ctx, page } = await abrir();
  const temAbas = (await page.locator('[data-aba-da-situacao="finalizado"]').count()) === 1;
  ok("a bancada tem as abas", temAbas);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["conversas"]; });
  if (temAbas) await clicar(page, '[data-aba-da-situacao="finalizado"]');
  await page.waitForTimeout(2000);
  const recado = await page.locator("[data-recado-da-lista]").first().getAttribute("data-recado-da-lista").catch(() => null);
  ok("a lista diz que a aba não carregou", recado === "falhou-aba", String(recado));
  const texto = await page.locator("[data-recado-da-lista]").first().innerText().catch(() => "");
  ok("com a frase da aba e o caminho", /Não consegui carregar as conversas desta aba/.test(texto) && /Tentar de novo/.test(texto), texto);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(2000);
  const depois = await page.locator("[data-recado-da-lista]").first().getAttribute("data-recado-da-lista").catch(() => null);
  ok("e o “Tentar de novo” traz a aba", depois !== "falhou-aba" && depois !== "trocando-de-aba", String(depois));
  await ctx.close();
}

// ==================================================================
if (vale("13d")) console.log("\n13d. Fechar a administração com a releitura falhando: a faixa sai quando a releitura dá certo");
if (vale("13d")) {
  const { ctx, page } = await abrir();
  ok("abri a administração", await abrirAdmin(page, null));
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["advogados", "departamentos"]; });
  ok("fechei pelo X", await clicar(page, '[aria-label="Fechar"]'));
  await page.waitForTimeout(1200);
  const f1 = await faixa(page);
  ok("a falha dos telefones e dos departamentos é dita", /os departamentos/.test(f1) && /os telefones/.test(f1), f1);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(2000);
  const f2 = await faixa(page);
  ok("e o “Tentar de novo” os relê: a faixa sai", !/os departamentos|os telefones/.test(f2), f2);
  await ctx.close();
}

// ==================================================================
if (vale("13e")) console.log("\n13e. A conversa que o filtro traz de fora da lista vem com a etiqueta");
if (vale("13e")) {
  // A "Urgente" da bancada está em cinco conversas do telefone do fundo, três
  // delas depois da primeira página: elas entram na lista pelo filtro, e a
  // leitura das etiquetas só conhecia a lista.
  const { ctx, page } = await abrir();
  ok("troquei para o telefone do fundo", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(2500);
  const longe = ["a13-c700", "a13-c980", "a13-c1150"];
  const antes = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-conversa-id="${id}"]`)), longe);
  ok("as três do fundo não estão na lista carregada", antes.length === 0, JSON.stringify(antes));
  await clicar(page, "[data-mais-filtros]");
  await page.waitForTimeout(300);
  ok("filtrei pela Urgente", await clicar(page, '[data-etiqueta-da-seta="t-urgente"]'));
  await page.waitForTimeout(3000);
  const linhas = await page.evaluate((ids) => ids.map((id) => {
    const el = document.querySelector(`[data-conversa-id="${id}"]`);
    const chips = el && el.querySelector("[data-etiquetas-da-linha]");
    return { id, na: Boolean(el), etiquetas: chips ? chips.innerText : "" };
  }), longe);
  ok("as três aparecem pelo filtro", linhas.every((l) => l.na) && linhas.length === 3, JSON.stringify(linhas));
  ok("e com a etiqueta na linha", linhas.length === 3 && linhas.every((l) => /Urgente/.test(l.etiquetas)), JSON.stringify(linhas));
  await ctx.close();
}

// ==================================================================
if (vale("13f")) console.log("\n13f. O nome que se vê é o mesmo na citação e no avatar");
if (vale("13f")) {
  // A conversa da bancada cujo WhatsApp diz "Deusdete" e o cadastro diz
  // MARIA DAS GRAÇAS PEREIRA — e sem foto, para o avatar desenhar a inicial.
  const ctDeus = await (async () => {
    const t = await abrir();
    const r = await t.page.evaluate(() => {
      const T = globalThis.__TABELAS;
      const ct = (T.contatos || []).find((c) => c.id === "ct-do-vantoro");
      const cv = ct && (T.conversas || []).find((c) => c.contato_id === ct.id);
      return ct && cv ? { conv: String(cv.id), nome: ct.nome, ficha: ct.vantoro_nome || ct.nome_zorvin || null } : null;
    });
    await t.ctx.close();
    return r;
  })();
  ok("achei a conversa do “Deusdete”, com um nome da casa diferente do WhatsApp", Boolean(ctDeus && ctDeus.ficha && ctDeus.ficha !== ctDeus.nome), JSON.stringify(ctDeus));
  if (ctDeus && ctDeus.ficha) {
    const semente = { mensagens: [
      { id: "aud-q-1", conversa_id: ctDeus.conv, origem: "contato", tipo: "texto", texto: "a pergunta do cliente", id_uazapi: "AUD-Q-1", criado_em: ha(30) },
      { id: "aud-q-2", conversa_id: ctDeus.conv, origem: "advogado", tipo: "texto", texto: "respondendo a ela", id_uazapi: "AUD-Q-2",
        resposta_previa: "a pergunta do cliente", resposta_autor: "contato", responder_id_uazapi: "AUD-Q-1", criado_em: ha(29) },
    ] };
    const { ctx, page } = await abrir({ semente });
    await page.locator(`[data-conversa-id="${ctDeus.conv}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
    ok("abri a conversa", await abrirConversa(page, ctDeus.conv, 1800));
    const citacao = await page.locator("[data-citacao]").first().innerText().catch(() => "");
    ok("a citação diz o nome da casa, e não o do WhatsApp",
       citacao.includes(ctDeus.ficha) && !citacao.split("\n")[0].includes(ctDeus.nome), citacao);
    // A LINHA DA LISTA JÁ DESENHAVA PELO NOME DA CASA: o alto tem de dizer a
    // mesma letra, e com a mesma cor.
    const av = await page.evaluate((conv) => {
      const doTopo = document.querySelector("[data-topo-conversa] [data-avatar-inicial]");
      const daLinha = document.querySelector(`[data-conversa-id="${conv}"] [data-avatar-inicial]`);
      const ler = (el) => el ? { letra: el.getAttribute("data-avatar-inicial"), cor: getComputedStyle(el).backgroundColor } : null;
      return { topo: ler(doTopo), linha: ler(daLinha) };
    }, ctDeus.conv);
    ok("e o avatar do alto tem a letra e a cor da linha da lista",
       av.topo && av.linha && av.topo.letra === av.linha.letra && av.topo.cor === av.linha.cor, JSON.stringify(av));
    await ctx.close();
  }
}

// ==================================================================
if (vale("13g")) console.log("\n13g. O nome que a agenda grava fica, mesmo depois de o cliente escrever");
if (vale("13g")) {
  const { ctx, page } = await abrir();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(300);
  await clicar(page, 'button:has-text("Configurações")');
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Contatos", exact: true }).first().click();
  await page.waitForTimeout(600);
  ok("abri o novo contato", await clicar(page, "[data-cabecalho-da-aba] > button"));
  await page.locator('input[placeholder="Ex.: João Silva"]').fill("Maria da Agenda");
  await page.locator('input[placeholder="5511999999999"]').fill("5571992590388");
  ok("salvei", await clicar(page, 'button:has-text("Salvar")'));
  await page.waitForTimeout(1200);
  const gravado = await page.evaluate(() => (globalThis.__TABELAS.contatos || []).find((c) => String(c.numero) === "5571992590388") || null);
  ok("o nome foi para o nome que a equipe dá (nome_zorvin)", gravado && gravado.nome_zorvin === "Maria da Agenda", JSON.stringify(gravado));
  // A PONTE REGRAVA `nome` com o do WhatsApp a cada mensagem do cliente.
  const visto = await page.evaluate(async () => {
    const T = globalThis.__TABELAS;
    const ct = (T.contatos || []).find((c) => String(c.numero) === "5571992590388");
    if (ct) ct.nome = "Mãe do Pedro";
    const { nomeDoContato } = await import("/src/contato.js");
    return ct ? nomeDoContato(ct) : null;
  });
  ok("e é ele que a tela mostra depois de a ponte regravar o do WhatsApp", visto === "Maria da Agenda", String(visto));
  await ctx.close();
}

// ==================================================================
if (vale("13h")) console.log("\n13h. O pré-cadastro criado mostra os telefones dele, e “conversar por este” leva ao número certo");
if (vale("13h")) {
  // O VANTORO MANDA OS DÍGITOS COM O 55: "55" colado na frente fazia
  // "555571…", um número que não existe.
  const criado = { ok: true, criado: true, tarefa_cadastro: false,
    cliente: { id: 501, nome: "LEAD DA AUDITORIA", cpf: "", telefone: "", telefone2: "", observacoes: "",
               documentos: 0, processos: [], ordem_servico: null,
               telefones: [{ id: 9, numero: "+55 71 99259-0366", digitos: "5571992590366", principal: true,
                             proprio: true, dono: "", observacao: "", usado_por: [] }] } };
  // A MESMA RESPOSTA PARA A PERGUNTA PELO NÚMERO (sem `clientes`: "não tem
  // cadastro") e para a criação.
  const { ctx, page } = await abrir({ largura: 1600, ponte: { "/vantoro/cliente": { corpo: criado } } });
  ok("abri a conversa", await abrirConversa(page, D.alvo, 1500));
  if (!(await page.locator("[data-ficha]").count())) await abrirFicha(page);
  await page.waitForTimeout(1500);
  const criar = page.getByRole("button", { name: /Criar pré-cadastro/ });
  ok("a ficha sem cadastro oferece o pré-cadastro", (await criar.count()) === 1);
  if (await criar.count()) await criar.first().click();
  await page.waitForTimeout(2000);
  const tels = await page.locator("[data-telefone-do-cliente]").count();
  ok("depois de criar, a ficha mostra os telefones do cadastro que nasceu", tels === 1, String(tels));
  const por = await page.locator("[data-conversar-por]").first().getAttribute("data-conversar-por").catch(() => null);
  ok("e “conversar por este” leva ao número na forma de sempre (55 + DDD + número)", por === "5571992590366", String(por));
  await ctx.close();
}

// ==================================================================
if (vale("13i")) console.log("\n13i. O que ficou por salvar na ficha é de quem escreveu");
if (vale("13i")) {
  // Desde 22/10 o painel sai de cena quando a sessão acaba, e outra pessoa
  // pode entrar na MESMA aba: a ficha dela abria com o que a de antes deixou
  // por salvar — e a ficha tem as senhas do SERASA e do GOV.
  const CLI = { id: 601, nome: "CLIENTE DO RASCUNHO", cpf: "", telefone: "", telefone2: "", ocupacao: "",
                observacoes: "O que está no Vantoro.", documentos: 0, processos: [], ordem_servico: null };
  const { ctx, page } = await abrir({ largura: 1600, ponte: { "/vantoro/cliente": { corpo: { clientes: [CLI], opcoes: {} } } } });
  const obs = page.locator('[data-campo="observacoes"]');
  const abrirAFicha = async () => {
    await abrirConversa(page, D.alvo, 1500);
    if (!(await page.locator("[data-ficha]").count())) await abrirFicha(page);
    await page.waitForTimeout(1500);
    return (await obs.count()) > 0;
  };
  ok("abri a ficha do cliente", await abrirAFicha());
  if (await obs.count()) await obs.fill("RASCUNHO DO RODRIGO, ainda não salvo");
  await page.waitForTimeout(500);
  // A SESSÃO ACABA, E OUTRA PESSOA ENTRA NA MESMA ABA.
  await page.evaluate(() => globalThis.__SAIDA_DA_BIBLIOTECA());
  await page.waitForSelector('button[aria-label="Mostrar senha"]', { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => {
    const u = (globalThis.__TABELAS.usuarios || []).find((x) => x.id === "u-jenifer");
    if (u) u.admin = true;
    globalThis.__ENTRADA_DA_BIBLIOTECA("u-jenifer");
  });
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  ok("a outra pessoa abriu a mesma ficha", await abrirAFicha());
  const dela = await obs.inputValue().catch(() => null);
  ok("e ela vê o que está no Vantoro, e não o rascunho de quem saiu", dela === "O que está no Vantoro.", String(dela));
  ok("sem o aviso de alterações por salvar", (await page.getByText("Você deixou alterações sem salvar nesta ficha").count()) === 0);
  // QUEM ESCREVEU VOLTA, e o rascunho dele está lá: guardado por pessoa, e
  // não apagado.
  await page.evaluate(() => globalThis.__SAIDA_DA_BIBLIOTECA());
  await page.waitForSelector('button[aria-label="Mostrar senha"]', { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => globalThis.__ENTRADA_DA_BIBLIOTECA("u1"));
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  ok("quem escreveu voltou e abriu a ficha", await abrirAFicha());
  const dele = await obs.inputValue().catch(() => null);
  ok("e o rascunho dele voltou", dele === "RASCUNHO DO RODRIGO, ainda não salvo", String(dele));
  await ctx.close();
}

// ==================================================================
if (vale("14")) console.log("\n14. Celular: a busca e a entrada");
if (vale("14")) {
  const { ctx, page } = await abrir({ largura: 360, altura: 740, celular: true });
  const m = await page.evaluate(() => {
    const el = document.querySelector('input[aria-label="Buscar conversas"]');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const c = document.createElement("canvas").getContext("2d");
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return { texto: el.placeholder, precisa: Math.ceil(c.measureText(el.placeholder).width),
             tem: Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) };
  });
  ok("(360) a frase da busca cabe inteira na caixa", m && m.precisa <= m.tem, JSON.stringify(m));
  await ctx.close();
}
if (vale("14")) {
  const { ctx, page } = await abrir({ largura: 390, altura: 844, celular: true, bandeiras: { __DESLOGADO: true },
                                      espera: 'button[aria-label="Mostrar senha"]' });
  const b = await page.locator('button[aria-label="Mostrar senha"]').first().boundingBox();
  ok("(390) o “mostrar senha” é um alvo de dedo (40 pontos)", b && b.width >= 40 && b.height >= 40, JSON.stringify(b));
  await ctx.close();
}

// ==================================================================
if (vale("15")) console.log("\n15. A bancada não entra no pacote que vai para o ar");
if (vale("15")) {
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const saida = fs.mkdtempSync(path.join(os.tmpdir(), "zorvin-pacote-"));
  const env = { ...process.env };
  delete env.VITE_BANCADA;
  const r = spawnSync("npx", ["vite", "build", "--logLevel", "error", "--outDir", saida, "--emptyOutDir"],
                      { env, encoding: "utf8", timeout: 240000 });
  const arquivos = fs.existsSync(path.join(saida, "assets")) ? fs.readdirSync(path.join(saida, "assets")).filter((f) => f.endsWith(".js")) : [];
  const conteudo = arquivos.map((f) => fs.readFileSync(path.join(saida, "assets", f), "utf8")).join("\n");
  ok("o pacote de produção montou", r.status === 0 && arquivos.length > 0, (r.stderr || "").slice(0, 300));
  ok("sem os dados de mentira da bancada", conteudo.length > 0 && !conteudo.includes("ct-grupo-perto"));
  fs.rmSync(saida, { recursive: true, force: true });
}

ok("nada estourou na tela", estouros.length === 0, estouros.slice(0, 3).join(" | "));
await nav.close();
if (CENAS.length) console.log(`\n(rodada parcial: só as cenas ${CENAS.join(", ")})`);
ok("as cenas pedidas em CENAS existem nesta prova", !CENAS.length || CENAS.every((c) => cenasDaProva.has(c)),
   `não existem: ${CENAS.filter((c) => !cenasDaProva.has(c)).join(", ")}`);
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
