// OS FILTROS NÃO AFIRMAM AUSÊNCIA — "nenhuma" só depois de o banco responder
// (auditoria de 28/10)
//
// Os filtros da lista perguntam ao banco pelo que as páginas lidas não têm: a
// conversa minha parada há dois meses, o grupo a cinco páginas de distância,
// a tarefa de hoje de um cliente esquecido, a etiqueta da conversa 980. O
// contrato está escrito no próprio código, em cima da frase da lista vazia:
// "NADA ENCONTRADO SÓ DEPOIS DE PERGUNTAR EM TODO LUGAR". E não era cumprido:
//
//   * a lista vazia dizia "Nenhuma conversa sua neste telefone…", "Nenhum
//     grupo neste telefone." ou "Nenhuma conversa ainda." ENQUANTO o banco
//     ainda não tinha respondido;
//   * e depois de ele FALHAR: a falha ia só para o console (as minhas, os
//     grupos, as conversas com tarefa) — ou a faixa acendia e a frase dizia
//     "nenhuma" logo abaixo dela (a etiqueta), ou "Procurando…" para sempre
//     (as tarefas);
//   * "Favoritas" e "Não lidas" nem perguntavam: olhavam só as páginas
//     carregadas. A favorita da posição 450 não aparecia, e na ordem
//     "Antigas" a pílula dizia "Não lidas 500" sobre uma lista que dizia
//     "Nenhuma conversa ainda." e "0 de 0+ conversas";
//   * a pasta de arquivadas, pelo mesmo caminho, dizia "Nenhuma conversa
//     arquivada." com a linha "Arquivadas 1" logo antes;
//   * e "Tentar de novo" não relia a etiqueta: a faixa ficava, e as conversas
//     de fora das páginas não voltavam.
//
// O QUE ESTA PROVA GUARDA, filtro por filtro: enquanto procura, "procurando";
// se falhou, a falha (com a faixa); só depois da resposta, a frase de
// ausência DAQUELE filtro — e o contraste de cada um, com o banco respondendo.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

async function abrir({ semente = {}, ordem = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__RECUSAR_LEITURA = [];
    globalThis.__ATRASO_POR_TABELA = {};
    try {
      if (d.ordem) localStorage.setItem("zorvin_ordem", d.ordem);
      else localStorage.removeItem("zorvin_ordem");
    } catch (_) { /* sem armário */ }
  }, { semente, ordem });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}
async function clicar(page, seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function irPara(page, telefone) {
  const r = await clicar(page, `[data-telefone="${telefone}"]`);
  await page.waitForTimeout(3000);
  return r;
}
async function naGaveta(page, seletor) {
  if (!(await clicar(page, "[data-mais-filtros]"))) return false;
  await page.waitForTimeout(300);
  return clicar(page, seletor);
}
const recado = (page) => page.evaluate(() => {
  const r = document.querySelector("[data-recado-da-lista]");
  return r ? { marca: r.getAttribute("data-recado-da-lista"), texto: (r.innerText || "").trim() } : null;
});
const marca = async (page) => ((await recado(page)) || {}).marca || null;
const faixa = (page) => page.locator("[data-falha-de-leitura]").count();
const idsNaLista = (page) => page.locator("[data-conversa-id]").evaluateAll(
  (els) => els.map((e) => e.getAttribute("data-conversa-id")));
const lento = (page, tabela, ms) => page.evaluate(([t, m]) => { globalThis.__ATRASO_POR_TABELA = { [t]: m }; }, [tabela, ms]);
/** O FILME DA FRASE DA LISTA VAZIA: cada marca que ela teve, desenho a
 *  desenho. Um `MutationObserver` vê até a frase que durou um desenho só — a
 *  que a foto de 600 ms depois não pega, e que era o "nenhum" antes de o
 *  efeito sair para perguntar. */
const filmarRecado = (page) => page.evaluate(() => {
  globalThis.__FILME_DO_RECADO = [];
  const anotar = () => {
    const r = document.querySelector("[data-recado-da-lista]");
    const m = r ? r.getAttribute("data-recado-da-lista") : null;
    const f = globalThis.__FILME_DO_RECADO;
    if (f[f.length - 1] !== m) f.push(m);
  };
  globalThis.__OBSERVADOR_DO_RECADO = new MutationObserver(anotar);
  globalThis.__OBSERVADOR_DO_RECADO.observe(document.body,
    { subtree: true, childList: true, attributes: true, attributeFilter: ["data-recado-da-lista"] });
});
const filme = (page) => page.evaluate(() => {
  if (globalThis.__OBSERVADOR_DO_RECADO) globalThis.__OBSERVADOR_DO_RECADO.disconnect();
  return globalThis.__FILME_DO_RECADO || [];
});
const quebrar = (page, tabelas) => page.evaluate((t) => { globalThis.__RECUSAR_LEITURA = t; }, tabelas);
const normal = (page) => page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = {}; globalThis.__RECUSAR_LEITURA = []; });

// ==================================================================
console.log("\n1. “Minhas conversas”");
{
  const { ctx, page, estouros } = await abrir();
  await lento(page, "conversas", 2500);
  await filmarRecado(page);
  ok("escolhi “Minhas conversas”", await naGaveta(page, "[data-minhas-opcao]"));
  await page.waitForTimeout(600);
  const durante = await marca(page);
  ok("com o banco ainda no ar, a lista diz que procura — e não “Nenhuma conversa sua”",
     durante === "procurando-filtro", String(durante));
  const quadros = await filme(page);
  ok("e em nenhum desenho antes da resposta ela disse “nenhuma”", quadros.length > 0 && !quadros.includes("sem-minhas"),
     JSON.stringify(quadros));
  await page.waitForTimeout(4500);
  const depois = await marca(page);
  ok("com a resposta, aí sim: nenhuma conversa sua", depois === "sem-minhas", String(depois));
  ok("e nada de faixa, com tudo respondendo", (await faixa(page)) === 0);

  // A FALHA: a leitura das minhas não volta.
  await normal(page);
  await clicar(page, '[data-aba="tudo"]');
  await page.waitForTimeout(600);
  await quebrar(page, ["conversas"]);
  await naGaveta(page, "[data-minhas-opcao]");
  await page.waitForTimeout(2500);
  const r = await recado(page);
  ok("a leitura que falhou não vira “Nenhuma conversa sua”", r && r.marca === "falhou-filtro", JSON.stringify(r));
  ok("a frase traz o código do banco", r && /PGRST301/.test(r.texto), JSON.stringify(r));
  ok("e a faixa âmbar acende", (await faixa(page)) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. “Minhas conversas” com mais de 500: a tela diz que pode haver mais");
{
  const { ctx, page, estouros } = await abrir();
  // QUINHENTAS E UMA conversas minhas no telefone de 1.200 — o teto da
  // consulta é 500, e chegar nele quer dizer que pode haver mais.
  await page.evaluate(() => {
    let n = 0;
    for (const c of globalThis.__TABELAS.conversas) {
      if (c.advogado_id === "a13" && n < 501) { c.responsavel_id = "u1"; n += 1; }
    }
  });
  ok("fui ao telefone de 1.200 conversas", await irPara(page, "Arquivo"));
  await naGaveta(page, "[data-minhas-opcao]");
  await page.waitForTimeout(3000);
  ok("a lista mostra as minhas", (await idsNaLista(page)).length > 0);
  ok("e diz que pode haver mais do que as mostradas", (await page.locator("[data-corte-do-filtro]").count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. “Grupos”");
{
  const { ctx, page, estouros } = await abrir();
  ok("fui a um telefone sem grupo", await irPara(page, "Acordos 2"));
  await lento(page, "contatos", 2500);
  await filmarRecado(page);
  ok("escolhi “Grupos”", await naGaveta(page, "[data-grupos-opcao]"));
  await page.waitForTimeout(600);
  const durante = await marca(page);
  ok("com o banco ainda no ar, a lista diz que procura — e não “Nenhum grupo”", durante === "procurando-filtro", String(durante));
  const quadros = await filme(page);
  ok("e em nenhum desenho antes da resposta ela disse “nenhum grupo”", quadros.length > 0 && !quadros.includes("sem-grupo"),
     JSON.stringify(quadros));
  await page.waitForTimeout(4500);
  ok("com a resposta, aí sim: nenhum grupo neste telefone", (await marca(page)) === "sem-grupo", String(await marca(page)));
  ok("e nada de faixa, com tudo respondendo", (await faixa(page)) === 0);

  await normal(page);
  await clicar(page, '[data-aba="tudo"]');
  await page.waitForTimeout(600);
  await quebrar(page, ["contatos"]);
  await naGaveta(page, "[data-grupos-opcao]");
  await page.waitForTimeout(2500);
  ok("a leitura que falhou não vira “Nenhum grupo neste telefone.”", (await marca(page)) === "falhou-filtro", String(await marca(page)));
  ok("e a faixa âmbar acende", (await faixa(page)) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. “Com tarefa para hoje”");
{
  const tarefa = (id, conversa, para = "u2") => ({ id, conversa_id: conversa, texto: `Ligar (${id})`,
    vence_em: new Date(AGORA - 3600e3).toISOString(), para_quem: para, criada_por: "u1",
    criada_em: new Date(AGORA - 86400e3).toISOString(), feita_em: null, feita_por: null });
  const { ctx, page, estouros } = await abrir({ semente: { zorvin_tarefas: [tarefa("tf-fundo", "a13-c900")] } });
  ok("fui ao telefone de 1.200 conversas", await irPara(page, "Arquivo"));
  // A TABELA DAS TAREFAS NÃO RESPONDE: era "Procurando…" para sempre.
  await quebrar(page, ["zorvin_tarefas"]);
  ok("escolhi “Com tarefa para hoje”", await naGaveta(page, "[data-tarefas-opcao]"));
  await page.waitForTimeout(2500);
  ok("a leitura que falhou não fica em “Procurando…” para sempre", (await marca(page)) === "falhou-filtro", String(await marca(page)));
  ok("e a faixa âmbar acende", (await faixa(page)) === 1);

  // AS TAREFAS VÊM, E A CONVERSA DELA (fora das páginas) NÃO: era "Nenhuma
  // conversa deste telefone com tarefa", com a tarefa a uma consulta dali.
  await normal(page);
  await clicar(page, '[data-aba="tudo"]');
  await page.waitForTimeout(600);
  await quebrar(page, ["conversas"]);
  await naGaveta(page, "[data-tarefas-opcao]");
  await page.waitForTimeout(2500);
  ok("a conversa da tarefa que não veio não vira “nenhuma conversa com tarefa”", (await marca(page)) === "falhou-filtro",
     String(await marca(page)));

  // E O CONTRASTE: com tudo respondendo, a conversa lá do fundo aparece.
  await normal(page);
  await clicar(page, '[data-aba="tudo"]');
  await page.waitForTimeout(600);
  await clicar(page, "[data-tentar-leituras]");
  await page.waitForTimeout(1500);
  await naGaveta(page, "[data-tarefas-opcao]");
  await page.waitForTimeout(2500);
  ok("com o banco respondendo, a conversa da tarefa aparece", (await idsNaLista(page)).includes("a13-c900"),
     JSON.stringify(await idsNaLista(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();

  // MIL TAREFAS: o teto da consulta, e a tela diz que pode haver mais.
  const mil = Array.from({ length: 1000 }, (_, i) => tarefa(`tf-mil-${i}`, `cv-de-outro-${i}`));
  const outra = await abrir({ semente: { zorvin_tarefas: mil } });
  await naGaveta(outra.page, "[data-tarefas-opcao]");
  // Mil conversas a procurar são sete idas de 150 — e cada uma demora.
  await outra.page.waitForTimeout(8000);
  ok("com mil tarefas, a tela diz que pode haver mais", (await outra.page.locator("[data-corte-do-filtro]").count()) === 1);
  await outra.ctx.close();
}

// ==================================================================
console.log("\n5. A etiqueta");
{
  const { ctx, page, estouros } = await abrir({ semente: { tags: [{ id: "t-sem-uso", nome: "Sem uso", cor: "#888888" }] } });
  await lento(page, "conversa_tags", 2500);
  ok("escolhi “Urgente” num telefone que não tem nenhuma", await naGaveta(page, '[data-etiqueta-da-seta="t-urgente"]'));
  await page.waitForTimeout(600);
  ok("com o banco ainda no ar, a lista diz que procura — e não “Nenhuma conversa ainda.”",
     (await marca(page)) === "procurando-filtro", String(await marca(page)));
  await page.waitForTimeout(4500);
  const r = await recado(page);
  // A FRASE É A DA #290 (auditoria de 27/10), que chegou antes ao mesmo
  // defeito: "Nenhuma conversa com esta etiqueta neste telefone." — fala da
  // etiqueta escolhida, que a pílula do filtro mostra, sem repetir o nome.
  ok("com a resposta, a frase é da etiqueta, e não do telefone", r && r.marca === "sem-etiqueta"
     && /com esta etiqueta/.test(r.texto) && !/Nenhuma conversa ainda/.test(r.texto), JSON.stringify(r));

  // A ETIQUETA SEM CONVERSA NENHUMA, depois de uma falha: a faixa apaga.
  await normal(page);
  await quebrar(page, ["conversa_tags"]);
  await naGaveta(page, '[data-etiqueta-da-seta="t-sem-uso"]');
  await page.waitForTimeout(2500);
  ok("a leitura da etiqueta falhou, e a lista diz", (await marca(page)) === "falhou-filtro", String(await marca(page)));
  ok("com a faixa", (await faixa(page)) === 1);
  await normal(page);
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(2500);
  ok("a etiqueta sem nenhuma conversa responde, e a faixa apaga", (await faixa(page)) === 0);
  ok("e a frase passa a ser a da etiqueta vazia", (await marca(page)) === "sem-etiqueta", String(await marca(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. “Tentar de novo” relê a etiqueta");
{
  const { ctx, page, estouros } = await abrir();
  ok("fui ao telefone de 1.200 conversas", await irPara(page, "Arquivo"));
  await quebrar(page, ["conversa_tags"]);
  await naGaveta(page, '[data-etiqueta-da-seta="t-urgente"]');
  await page.waitForTimeout(2500);
  ok("a etiqueta não carregou, e a faixa diz", (await faixa(page)) === 1);
  await normal(page);
  ok("apertei “Tentar de novo”", await clicar(page, "[data-tentar-leituras]"));
  await page.waitForTimeout(3500);
  const ids = await idsNaLista(page);
  ok("as cinco “Urgente” aparecem — inclusive as três de fora das páginas", ids.length === 5
     && ["a13-c700", "a13-c980", "a13-c1150"].every((id) => ids.includes(id)), JSON.stringify(ids));
  ok("e a faixa apaga", (await faixa(page)) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n7. “Favoritas” e a pasta de arquivadas perguntam ao banco");
{
  const { ctx, page, estouros } = await abrir();
  // A FAVORITA NA POSIÇÃO 450 — três páginas além da que a lista trouxe.
  await page.evaluate(() => { globalThis.__TABELAS.conversas.find((c) => c.id === "a13-c450").favorita = true; });
  ok("fui ao telefone de 1.200 conversas", await irPara(page, "Arquivo"));
  ok("a favorita não está entre as carregadas", !(await idsNaLista(page)).includes("a13-c450"));
  ok("escolhi “Favoritas”", await clicar(page, '[data-aba="favoritas"]'));
  await page.waitForTimeout(3000);
  ok("a favorita da posição 450 aparece", (await idsNaLista(page)).includes("a13-c450"), JSON.stringify(await idsNaLista(page)));
  // O "+" É A PÁGINA CARREGADA FALANDO PELO FILTRO: com o banco já perguntado,
  // não há mais nada a buscar por ele. Era "0 de 0+" com a lista vazia; com as
  // linhas de fora trazidas, seria "1 de 1+" — a mesma promessa falsa.
  const rodape = await page.locator('[data-teste="fim-da-lista"]').innerText().catch(() => "");
  ok("e o rodapé não promete mais com o “+” — nem “0 de 0+”", !/\+/.test(rodape), rodape);

  await clicar(page, '[data-aba="tudo"]');
  await page.waitForTimeout(800);
  ok("entrei nas arquivadas", await clicar(page, 'text="Arquivadas"'));
  await page.waitForTimeout(3000);
  ok("a arquivada de duzentos dias atrás aparece, e não “Nenhuma conversa arquivada.”",
     (await idsNaLista(page)).includes("a13-arquivada"), `${await marca(page)} ${JSON.stringify(await idsNaLista(page))}`);
  ok("e nada de faixa, com tudo respondendo", (await faixa(page)) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n8. “Favoritas” num telefone sem nenhuma, e com o banco falhando");
{
  const { ctx, page, estouros } = await abrir();
  await lento(page, "conversas", 2500);
  ok("escolhi “Favoritas”", await clicar(page, '[data-aba="favoritas"]'));
  await page.waitForTimeout(600);
  ok("com o banco no ar, a lista diz que procura", (await marca(page)) === "procurando-filtro", String(await marca(page)));
  await page.waitForTimeout(4500);
  const r = await recado(page);
  ok("com a resposta, a frase é das favoritas, e não “Nenhuma conversa ainda.”", r && r.marca === "sem-favoritas", JSON.stringify(r));

  await normal(page);
  await clicar(page, '[data-aba="tudo"]');
  await page.waitForTimeout(600);
  await quebrar(page, ["conversas"]);
  await clicar(page, '[data-aba="favoritas"]');
  await page.waitForTimeout(2500);
  ok("a leitura que falhou não vira “nenhuma favorita”", (await marca(page)) === "falhou-filtro", String(await marca(page)));
  ok("e a faixa âmbar acende", (await faixa(page)) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n9. “Não lidas” na ordem “Antigas”");
{
  const { ctx, page, estouros } = await abrir({ ordem: "antigas" });
  // AS 600 MAIS ANTIGAS DO TELEFONE DE 1.200 FICAM LIDAS: na ordem "Antigas"
  // a página que a lista traz é justamente a delas, e as não lidas (da 100 à
  // 599) moram fora dela.
  await page.evaluate(() => {
    for (const c of globalThis.__TABELAS.conversas) {
      if (c.advogado_id !== "a13") continue;
      const n = Number(String(c.id).replace("a13-c", ""));
      if (!Number.isFinite(n) || n >= 600) c.nao_lidas = 0;
    }
  });
  ok("fui ao telefone de 1.200 conversas", await irPara(page, "Arquivo"));
  const pilula = await page.locator('[data-aba="naolidas"]').innerText().catch(() => "");
  ok("a pílula diz quantas não lidas há", /Não lidas \d+/.test(pilula), pilula);
  ok("escolhi “Não lidas”", await clicar(page, '[data-aba="naolidas"]'));
  await page.waitForTimeout(3500);
  const ids = await idsNaLista(page);
  ok("a lista mostra as não lidas, e não “Nenhuma conversa ainda.”", ids.length > 0, `${await marca(page)}`);
  const rodape = await page.locator('[data-teste="fim-da-lista"]').innerText().catch(() => "");
  ok("e o rodapé não promete mais com o “+” — nem “0 de 0+”", !/\+/.test(rodape), rodape);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
