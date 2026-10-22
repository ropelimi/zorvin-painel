// A SESSÃO QUE ACABA VOLTA PARA A TELA DE ENTRADA — COM O RECADO (22/10)
//
// Medido nos registros do Supabase em 22/10: um navegador do escritório
// passou das 09:57 às 16:35 pedindo coisas ao banco SEM sessão — 152 pedidos,
// todos recusados (401), com o papel "anon". A tela continuava sendo o painel
// e nada carregava: nem a lista, nem as etiquetas, nem a conversa aberta.
//
// A biblioteca do Supabase devolve "sem sessão" SEM AVISAR em alguns
// caminhos, e o `App` só trocava de tela quando ela avisava. Hoje ele
// pergunta — ver `vigiaDaSessao.js`.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a sessão assinada pela ponte que vence (ela não tem com o que
//      renovar) leva à tela de entrada, com "Sua sessão terminou", e sai do
//      armário do navegador;
//   2. a sessão que some sem aviso é notada quando a aba volta à frente;
//   3. ... e NA HORA quando uma leitura falha com cara de acesso vencido —
//      mas a leitura que falha com a sessão boa NÃO põe ninguém para fora;
//   4. o tropeço de rede tem tolerância: passando, a pessoa fica; durando,
//      ela vai para a entrada;
//   5. o Auth calado com o bilhete em dia não põe ninguém para fora (a régua
//      de 19/08);
//   6. quem aperta "Sair" vai para a entrada SEM o recado;
//   7. a saída que a biblioteca faz sozinha leva o recado;
//   8. abrir o Zorvin com a sessão assinada já vencida dá "Sua sessão
//      terminou", e não "a conferência demorou demais" — que mandaria esperar
//      por um serviço que está de pé;
//   9. o recado não sobrevive a uma recarga;
//  10. o que estava escrito volta quando a pessoa entra de novo — a resposta
//      na caixa de mensagem, e a nota interna na caixa da nota;
//  11. os rascunhos são de cada pessoa (a conta direto na função).
// ------------------------------------------------------------
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** A sessão que a ponte assina quando o Auth está fora: `refresh_token`
 *  VAZIO, de propósito — ver `sessao.js`. `segundos` é quanto falta para
 *  vencer; a biblioteca a dá por vencida 90 segundos antes. */
const sessaoDaPonte = (segundos) => ({
  access_token: "jwt-da-ponte",
  refresh_token: "",
  expires_at: Math.floor(Date.now() / 1000) + segundos,
  user: { id: "u1", email: "rodrigo@ropelimi", user_metadata: { nome: "Rodrigo" } },
});

/** Uma aba nova. TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript`
 *  acumula, e uma bandeira de uma cena valeria na seguinte. */
async function abrir({ sessao = null, deslogado = false, vigia = 600000, tolerancia = 120000 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__VIGIA_DA_SESSAO = d.vigia;
    globalThis.__TOLERANCIA_DA_SESSAO = d.tolerancia;
    globalThis.__DESLOGADO = d.deslogado;
    globalThis.__SESSAO_SUMIU = false;
    globalThis.__SESSAO_SEM_RENOVACAO = false;
    globalThis.__SESSAO_REDE = false;
    globalThis.__SESSAO_PENDURADA = false;
    globalThis.__RECUSAR_LEITURA = [];
    // A SESSÃO SÓ É PLANTADA NA PRIMEIRA ABERTURA desta aba: numa recarga,
    // ela tem de estar onde a tela a deixou.
    if (d.sessao && !sessionStorage.getItem("plantei")) {
      localStorage.setItem("sb-bancada-auth-token", JSON.stringify(d.sessao));
      sessionStorage.setItem("plantei", "1");
    }
  }, { sessao, deslogado, vigia, tolerancia });
  await page.goto(ENDERECO);
  return { ctx, page, erros };
}

/** O que a tela é agora: o painel, a entrada, ou nenhuma das duas ainda. */
const tela = (page) => page.evaluate(() => ({
  painel: Boolean(document.querySelector("[data-conversa-nome]")),
  entrada: Boolean(document.querySelector('input[type="password"]')),
  recado: document.querySelector("[data-sessao-terminou]")?.innerText || "",
  texto: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
  guardada: (() => { try { return localStorage.getItem("sb-bancada-auth-token"); } catch (_e) { return "?"; } })(),
}));

/** Espera a tela virar a ENTRADA, até `ms`. Devolve em quanto tempo. */
async function esperarEntrada(page, ms) {
  const comecou = Date.now();
  try {
    await page.waitForSelector('input[type="password"]', { timeout: ms });
    return Date.now() - comecou;
  } catch (_e) { return null; }
}

const painelAberto = (page) => page.waitForSelector("[data-conversa-nome]", { timeout: 15000 })
  .then(() => true).catch(() => false);

// ==================================================================
console.log("\n1. A sessão assinada pela ponte vence, e a tela vai para a entrada");
{
  // 100 segundos para vencer: a biblioteca a dá por vencida aos 10, pela
  // margem de 90. A conferência roda a cada 1,5 s.
  const { ctx, page, erros } = await abrir({ sessao: sessaoDaPonte(100), deslogado: true, vigia: 1500 });
  ok("o painel abre com a sessão em dia", await painelAberto(page));
  const quando = await esperarEntrada(page, 25000);
  const t = await tela(page);
  ok("vencida, a tela vai sozinha para a entrada", quando !== null, t.texto.slice(0, 120));
  ok("com o recado “Sua sessão terminou. Entre de novo para continuar.”",
     /Sua sessão terminou\. Entre de novo para continuar\./.test(t.recado), `recado: “${t.recado}”`);
  ok("e a sessão sai do armário do navegador", t.guardada === null, `ficou: ${String(t.guardada).slice(0, 40)}`);
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. A sessão que some sem aviso é notada quando a aba volta à frente");
/** A aba volta à frente — como o navegador avisa quando a pessoa troca de
 *  aba e volta. */
const voltarAba = (page) => page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
});
for (const [como, gesto] of [
  ["a aba volta a ficar visível", voltarAba],
  ["a janela volta a ter o foco", (page) => page.evaluate(() => window.dispatchEvent(new Event("focus")))],
]) {
  // A conferência de minuto em minuto está desligada (10 minutos): quem
  // tem de notar é a volta da aba.
  const { ctx, page, erros } = await abrir();
  ok(`(${como}) o painel abre`, await painelAberto(page));
  await gesto(page);
  await page.waitForTimeout(1500);
  ok(`(${como}) com a sessão boa, não muda nada`, (await tela(page)).painel);
  await page.evaluate(() => { globalThis.__SESSAO_SUMIU = true; });
  await gesto(page);
  const quando = await esperarEntrada(page, 5000);
  const t = await tela(page);
  ok(`(${como}) sem sessão, vai para a entrada`, quando !== null, t.texto.slice(0, 120));
  ok(`(${como}) com o recado`, /Sua sessão terminou/.test(t.recado), `recado: “${t.recado}”`);
  ok(`(${como}) sem erro de JavaScript`, !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. A leitura que falha com cara de acesso vencido confere NA HORA");
{
  const { ctx, page, erros } = await abrir();
  ok("o painel abre", await painelAberto(page));
  // PRIMEIRO O CONTRASTE: a leitura falha, e a sessão está boa. `42501` e o
  // "JWT expired" também acontecem a quem entrou (a coluna sem permissão, o
  // bilhete renovado no meio do caminho) — e isso não pode pôr ninguém para
  // fora.
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["conversas"]; });
  await page.locator('[data-aba-da-situacao="finalizado"]').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const antes = await tela(page);
  ok("com a sessão boa, a leitura que falha NÃO leva para a entrada", !antes.entrada, antes.texto.slice(0, 120));
  ok("(e a falha é dita na faixa âmbar, como sempre)",
     await page.evaluate(() => Boolean(document.querySelector("[data-falha-de-leitura]"))));
  // AGORA SEM SESSÃO: a mesma leitura que falha leva à entrada em segundos,
  // sem esperar a conferência de minuto em minuto (desligada nesta cena).
  await page.evaluate(() => { globalThis.__SESSAO_SUMIU = true; });
  await page.locator('[data-aba-da-situacao="aguardando"]').click({ timeout: 5000 }).catch(() => {});
  const quando = await esperarEntrada(page, 5000);
  const t = await tela(page);
  ok("sem sessão, a leitura que falha leva à entrada na hora", quando !== null, t.texto.slice(0, 120));
  ok("com o recado", /Sua sessão terminou/.test(t.recado), `recado: “${t.recado}”`);
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. O tropeço de rede tem tolerância");
{
  // A conferência a cada 0,7 s, e 4 s de tolerância.
  const { ctx, page, erros } = await abrir({ vigia: 700, tolerancia: 4000 });
  ok("o painel abre", await painelAberto(page));
  await page.evaluate(() => { globalThis.__SESSAO_REDE = true; });
  await page.waitForTimeout(2500);
  ok("um tropeço de 2,5 s não põe ninguém para fora", (await tela(page)).painel);
  await page.evaluate(() => { globalThis.__SESSAO_REDE = false; });
  await page.waitForTimeout(4500);
  ok("e, passado o tropeço, a pessoa fica", (await tela(page)).painel);
  // A TOLERÂNCIA RECOMEÇA: o tropeço seguinte não herda o tempo do anterior.
  await page.evaluate(() => { globalThis.__SESSAO_REDE = true; });
  await page.waitForTimeout(2500);
  ok("um segundo tropeço curto também não (a conta recomeçou)", (await tela(page)).painel);
  const quando = await esperarEntrada(page, 6000);
  const t = await tela(page);
  ok("durando além da tolerância, a tela vai para a entrada", quando !== null, t.texto.slice(0, 120));
  ok("com o recado", /Sua sessão terminou/.test(t.recado), `recado: “${t.recado}”`);
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. O Auth calado com o bilhete em dia não põe ninguém para fora");
{
  // A régua de 19/08: o Auth é necessário para NASCER uma sessão, e não para
  // usá-la. A conferência espera 1,2 s pela biblioteca e lê o armário.
  const { ctx, page, erros } = await abrir({ sessao: sessaoDaPonte(3600), deslogado: true, vigia: 700 });
  ok("o painel abre", await painelAberto(page));
  await page.evaluate(() => { globalThis.__SESSAO_PENDURADA = true; });
  await page.waitForTimeout(6000);
  const t = await tela(page);
  ok("seis segundos de Auth calado, e o painel continua", t.painel && !t.entrada, t.texto.slice(0, 120));
  ok("e a sessão continua guardada", Boolean(t.guardada));
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. Quem aperta “Sair” vai para a entrada SEM o recado");
{
  const { ctx, page, erros } = await abrir();
  ok("o painel abre", await painelAberto(page));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  // PELO MENU ⋮ DO TOPO: é lá que moram as Configurações, e o "Sair" mora
  // dentro delas. Os cliques são guardados — um clique que estoura levaria a
  // prova inteira embora, sem dizer qual conferência viu o defeito.
  await page.getByRole("button", { name: "Menu" }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Configurações" }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  const botaoSair = page.locator("button", { hasText: "Sair" }).filter({ visible: true });
  ok("o “Sair” está à vista nas Configurações", (await botaoSair.count()) > 0);
  await botaoSair.first().click({ timeout: 5000 }).catch(() => {});
  const quando = await esperarEntrada(page, 5000);
  const t = await tela(page);
  ok("o “Sair” leva à entrada", quando !== null, t.texto.slice(0, 120));
  ok("sem “Sua sessão terminou”: foi a pessoa que saiu", !t.recado, `recado: “${t.recado}”`);
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n7. A saída que a biblioteca faz sozinha leva o recado");
{
  // A renovação recusada de vez — a conta desativada, a credencial revogada:
  // a biblioteca tira a sessão e avisa a saída, sem ninguém ter apertado nada.
  const { ctx, page, erros } = await abrir();
  ok("o painel abre", await painelAberto(page));
  await page.evaluate(() => globalThis.__SAIDA_DA_BIBLIOTECA());
  const quando = await esperarEntrada(page, 5000);
  const t = await tela(page);
  ok("a tela vai para a entrada", quando !== null, t.texto.slice(0, 120));
  ok("com o recado", /Sua sessão terminou/.test(t.recado), `recado: “${t.recado}”`);
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n8. Abrir o Zorvin com a sessão da ponte já vencida");
{
  // 30 segundos para vencer: dentro da margem de 90, a biblioteca estoura ao
  // tentar renovar. Antes, o estouro era lido como "o Auth não respondeu", e
  // a entrada dizia que a conferência tinha demorado demais.
  const { ctx, page, erros } = await abrir({ sessao: sessaoDaPonte(30), deslogado: true });
  const quando = await esperarEntrada(page, 8000);
  const t = await tela(page);
  ok("a tela de entrada abre", quando !== null, t.texto.slice(0, 120));
  ok("dizendo que a sessão terminou", /Sua sessão terminou/.test(t.recado), `recado: “${t.recado}”`);
  ok("e NÃO que a conferência demorou demais", !/demorou demais para responder/i.test(t.texto), t.texto.slice(0, 200));
  ok("e a sessão vencida sai do armário", t.guardada === null, `ficou: ${String(t.guardada).slice(0, 40)}`);

  console.log("\n9. O recado não sobrevive a uma recarga");
  await page.reload();
  await esperarEntrada(page, 8000);
  const depois = await tela(page);
  ok("recarregada, a entrada abre sem o recado", depois.entrada && !depois.recado, `recado: “${depois.recado}”`);
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n10. O que estava escrito volta quando a pessoa entra de novo");
{
  // A sessão pode acabar com a pessoa NO MEIO de uma resposta. Sem trocar de
  // conversa: quem guardava o rascunho era só a troca, e o painel que sai de
  // cena levava o texto junto. Entrar de novo é pelo caminho de sempre, que
  // não recarrega a página (`__ENTRADA_DA_BIBLIOTECA`, na bancada).
  const MENSAGEM = 'textarea[data-campo="mensagem"]';
  const NOTA = 'textarea[data-campo="nota"]';
  const ESCRITO = "Bom dia! Conferi o seu acordo e o próximo passo é";
  const ANOTADO = "Cliente pediu para ligar só depois das 18h";
  const { ctx, page, erros } = await abrir();
  ok("o painel abre", await painelAberto(page));
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("[data-conversa-id]")].map((el) => el.getAttribute("data-conversa-id")));
  const [primeira, segunda] = [...new Set(ids)];
  ok("há duas conversas para abrir", Boolean(primeira && segunda), `achei ${ids.length}`);
  const abrirConversa = async (id) => {
    await page.locator(`[data-conversa-id="${id}"]`).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
  };
  /** A sessão acaba sozinha e a pessoa entra de novo, na mesma página. */
  const acabaEEntraDeNovo = async () => {
    await page.evaluate(() => { globalThis.__SESSAO_SUMIU = true; window.dispatchEvent(new Event("focus")); });
    const foi = (await esperarEntrada(page, 5000)) !== null;
    await page.evaluate(() => globalThis.__ENTRADA_DA_BIBLIOTECA("u1"));
    return foi && await painelAberto(page);
  };
  const valor = (sel) => page.locator(sel).first().inputValue({ timeout: 2000 }).catch(() => null);

  // A RESPOSTA AO CLIENTE.
  await abrirConversa(primeira);
  await page.locator(MENSAGEM).first().fill(ESCRITO, { timeout: 5000 }).catch(() => {});
  ok("escrevi a resposta na caixa", (await valor(MENSAGEM)) === ESCRITO);
  ok("a sessão acaba no meio da resposta, e a pessoa entra de novo", await acabaEEntraDeNovo());
  await abrirConversa(primeira);
  const voltou = await valor(MENSAGEM);
  ok("de volta à conversa, a resposta está na caixa", voltou === ESCRITO, `caixa: “${voltou}”`);

  // A NOTA INTERNA VOLTA COMO NOTA. Voltando como mensagem, um Enter mandaria
  // ao cliente o que a equipe escreveu para não chegar a ele.
  await abrirConversa(segunda);
  await page.locator("[data-nota-interna]").first().click({ timeout: 5000 }).catch(() => {});
  await page.locator(NOTA).first().fill(ANOTADO, { timeout: 5000 }).catch(() => {});
  ok("escrevi uma nota interna", (await valor(NOTA)) === ANOTADO);
  ok("a sessão acaba de novo, e a pessoa entra de novo", await acabaEEntraDeNovo());
  await abrirConversa(segunda);
  const nota = await valor(NOTA);
  const mensagem = await valor(MENSAGEM);
  ok("a nota volta na caixa da NOTA", nota === ANOTADO, `nota: “${nota}”`);
  ok("e não na caixa de mensagem ao cliente", !mensagem, `mensagem: “${mensagem}”`);
  ok("e a resposta da outra conversa continua lá", await (async () => {
    await abrirConversa(primeira);
    return (await valor(MENSAGEM)) === ESCRITO;
  })());
  ok("sem erro de JavaScript", !erros.length, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n11. Os rascunhos são de cada pessoa");
{
  // A CONTA DIRETO NA FUNÇÃO: na bancada, quem entra é sempre a mesma pessoa
  // (a que administra), e outra pessoa entrando na mesma aba não teria
  // conversa nenhuma para abrir. Numa máquina dividida, quem entra depois não
  // pode encontrar na caixa o que a pessoa de antes escreveu para um cliente.
  const { rascunhosDe, guardarRascunho } = await import("../src/rascunhos.js");
  const meus = rascunhosDe("u-teste-a");
  ok("a mesma pessoa encontra os mesmos rascunhos", rascunhosDe("u-teste-a") === meus);
  guardarRascunho(meus, "c-1", { texto: "Olá, Andreia!", nota: false, editando: false });
  ok("outra pessoa não encontra o rascunho da primeira",
     !rascunhosDe("u-teste-b")["c-1"] && rascunhosDe("u-teste-b") !== meus);
  ok("a primeira continua com o dela", meus["c-1"]?.texto === "Olá, Andreia!");
  guardarRascunho(meus, "c-1", { texto: "corrigido", nota: false, editando: true });
  ok("uma edição em curso não vira rascunho (07/10)", meus["c-1"]?.texto === "Olá, Andreia!");
  guardarRascunho(meus, "c-1", { texto: "   ", nota: false, editando: false });
  ok("a caixa vazia apaga o rascunho", !("c-1" in meus));
  guardarRascunho(meus, "c-2", { texto: "só a equipe lê", nota: 1, editando: false });
  ok("a nota é guardada como nota", meus["c-2"]?.nota === true);
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
