// O RESUMO DA CONVERSA (01/11) — a metade do painel.
//
// Recomendação nº 4: um botão "Resumir" que diz em poucas linhas o que o
// cliente quer, o que já foi combinado e o que falta. Quem fala com a IA é a
// PONTE (seção 87 do repo dela). O que esta prova guarda é o que é da tela:
//
//   1. o botão mora na barra de escrever, no computador, ao lado do ✨, e NÃO
//      some com texto na caixa; some quando a ponte disse que o copiloto está
//      desligado, e quando ela é de antes do resumo (responde sem
//      `resumo: true`); na dúvida, mostra;
//   2. o clique pede o resumo DESTA conversa, com a sessão de quem pediu; o
//      quadro diz "lendo a conversa…", e um segundo clique não manda outro
//      pedido; nada vai para o cliente;
//   3. pronto, o quadro mostra as três partes, o que a IA leu e a frase
//      "feito pela IA: confira";
//   4. o quadro fecha pelo X, pelo próprio botão e pelo Esc — e o Esc fecha
//      o quadro ANTES da conversa;
//   5. trocar de conversa no meio: o resumo de A não aparece em B, e está lá
//      ao voltar para A; fechado no meio, a resposta não reabre o quadro;
//   6. o erro é DITO com a frase da ponte, e "Tentar de novo" pede de novo;
//   7. a conversa cortada, os avisos e as listas vazias são ditos;
//   8. as mensagens que chegam depois do resumo são contadas;
//   9. Copiar leva o texto puro, dizendo que foi feito pela IA;
//  10. o quadro não cobre as mensagens mais novas;
//  11. no celular, o caminho é o ⋮, e o quadro cabe na tela;
//  12. onde o cabeçalho recolhe no ⋮, o "Resumir" vai junto, e a caixa de
//      escrever não perde largura.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
// DOMINGO, 01/11/2026, 9h EM BRASÍLIA: o quadro diz "Feito às 09:00".
const AGORA = Date.parse("2026-11-01T09:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const CAMPO = "textarea[data-campo]";

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
const normal = (s) => String(s || "").replace(/\s+/g, " ").trim();

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

// TRÊS CONVERSAS PLANTADAS. A da Andreia tem o nome do WhatsApp "Deus" e a
// ficha em maiúsculas — o Copiar usa o nome do alto da conversa. A do José é
// a "outra conversa" da corrida. A longa tem 40 mensagens, para a conferência
// de que o quadro não cobre as mais novas.
const contato = (id, numero, nome, vantoro_nome = null) =>
  ({ id, numero, nome, vantoro_nome, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-res-1", "5511948230301", "Deus", "ANDREIA CRISTINA MARTINS"),
  contato("ct-res-2", "5511948230302", "José Carlos Pereira"),
  contato("ct-res-3", "5511948230303", "Conversa Longa"),
];
const A = "cv-res-1", B = "cv-res-2", L = "cv-res-3";
const conversa = (n) => ({
  id: `cv-res-${n}`, advogado_id: ADV, contato_id: `ct-res-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null,
  vantoro_nome: CONTATOS[n - 1].vantoro_nome, contato: CONTATOS[n - 1],
});
const ULTIMA_A = antes(10);
const SEMENTE = {
  contatos: CONTATOS,
  conversas: [1, 2, 3].map(conversa),
  mensagens: [
    ...[50, 40, 30, 20, 10].map((min, i) => ({
      id: `m-res-a-${i}`, conversa_id: A, origem: i % 2 ? "advogado" : "contato", tipo: "texto",
      texto: `Mensagem ${i} da Andreia`, criado_em: antes(min) })),
    { id: "m-res-b-0", conversa_id: B, origem: "contato", tipo: "texto", texto: "Bom dia, sou o José.", criado_em: antes(15) },
    ...Array.from({ length: 40 }, (_, i) => ({
      id: `m-res-l-${i}`, conversa_id: L, origem: i % 2 ? "advogado" : "contato", tipo: "texto",
      texto: `LONGA-${i} ${"conversa ".repeat(6)}`, criado_em: antes(400 - i * 5) })),
  ],
};

const RESUMO_A = {
  quer: "Saber se o acordo de 12 parcelas foi fechado.",
  combinado: ["Mandou o comprovante do sinal em 30/10.", "A equipe confirmou o recebimento."],
  falta: ["A equipe confirmar o acordo com o cliente."],
};
const RESUMO_B = { quer: "QUER-DO-JOSE: atualizar o endereço.", combinado: [], falta: ["O cliente mandar o comprovante de residência."] };
const pronto = (resumo, extra = {}) => ({ status: 200, demora: 0,
  corpo: { ok: true, resumo, mensagens: 5, notas: 1, cortou: false, ate: ULTIMA_A, avisos: [], ...extra } });

// A PONTE DE MENTIRA. `ponte` é trocada por cena; `pedidos` guarda cada
// pedido de resumo.
const ponte = {
  estado: { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true } },
  resumir: () => pronto(RESUMO_A),
};
const pedidos = [];

async function abrirPagina({ largura = 1400, altura = 900, area = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  if (area) await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(ENDERECO).origin });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.clock.setFixedTime(new Date(AGORA));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários.
  await page.addInitScript((b) => { globalThis.__SEMENTE = b.semente; }, { semente: SEMENTE });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (url.pathname.endsWith("/copiloto/resumir")) {
      const corpo = JSON.parse(rota.request().postData() || "{}");
      pedidos.push({ corpo, autorizacao: rota.request().headers()["authorization"] || "" });
      const r = ponte.resumir(corpo.conversa_id);
      if (r.demora) await new Promise((ok_) => setTimeout(ok_, r.demora));
      return json(r.status, r.corpo);
    }
    // SEM VANTORO: a ficha fixa estreitaria a conversa sem nada a ver com o
    // resumo.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
async function abrirConversa(page, id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const botao = (page) => page.locator("[data-resumo-botao]");
const quadro = (page, fase) => page.locator(fase ? `[data-resumo-da-conversa="${fase}"]` : "[data-resumo-da-conversa]");
const parte = (page, chave) => page.locator(`[data-resumo-parte="${chave}"]`);
const naCaixa = (page) => page.locator(CAMPO).inputValue().catch(() => "SEM CAIXA");
const saiuParaOCliente = (page, conversaId) => page.evaluate((id) =>
  (globalThis.__TABELAS.fila_envio || []).filter((f) => String(f.conversa_id) === String(id)).length, conversaId);
/** Espera o quadro chegar a uma fase, com teto — e diz em qual parou. */
async function esperarFase(page, fase, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (await quadro(page, fase).count()) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

// ==================================================================
console.log("\n1. O botão mora na barra de escrever, e só some quando a ponte diz");
{
  const { ctx, page, estouros } = await abrirPagina();
  ok("abri a conversa da Andreia", await abrirConversa(page, A));
  ok("o botão “Resumir” está na barra de escrever", (await botao(page).count()) === 1);
  const rotulo = await botao(page).first().getAttribute("aria-label").catch(() => "");
  ok("e diz o que faz (aria-label)", /Resumir a conversa/.test(rotulo || ""), rotulo);
  await page.locator(CAMPO).fill("Oi, tudo bem?");
  await page.waitForTimeout(150);
  ok("com texto na caixa ele NÃO some (resumir não mexe no que está escrito)", (await botao(page).count()) === 1);
  ok("enquanto o ✨ do copiloto, que troca o texto, some", (await page.locator("[data-copiloto-botao]").count()) === 0);
  await page.locator(CAMPO).fill("");
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}
for (const [nome, estado, deve] of [
  ["a ponte de antes do resumo (responde sem `resumo: true`): o Resumir some, e o ✨ fica",
   { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5" } }, false],
  ["a ponte disse que o copiloto está desligado: some",
   { status: 200, corpo: { ok: true, ligado: false, modelo: "claude-haiku-5-5", resumo: true } }, false],
  ["a pergunta falhou: na dúvida, MOSTRA (a régua de temVantoro.js)", { status: 500, corpo: {} }, true],
]) {
  ponte.estado = estado;
  const { ctx, page } = await abrirPagina();
  await abrirConversa(page, A);
  const tem = (await botao(page).count()) === 1;
  const comCopiloto = estado.corpo.resumo === undefined && estado.status === 200
    ? (await page.locator("[data-copiloto-botao]").count()) === 1 : true;
  ok(nome, tem === deve && comCopiloto, q({ tem, comCopiloto }));
  await ctx.close();
}
ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true } };

// ==================================================================
console.log("\n2. O clique pede o resumo DESTA conversa, e o quadro diz que está lendo");
let { ctx, page, estouros } = await abrirPagina();
await abrirConversa(page, A);
{
  pedidos.length = 0;
  ponte.resumir = () => ({ ...pronto(RESUMO_A), demora: 1500 });
  ok("clicou em Resumir", await clicar(botao(page)));
  await page.waitForTimeout(300);
  ok("o quadro diz que a IA está lendo a conversa",
     (await quadro(page, "pensando").count()) === 1 && /Lendo a conversa/.test(await texto(quadro(page, "pensando"))));
  await page.evaluate(() => document.querySelector("[data-resumo-botao]")?.click());
  await page.waitForTimeout(150);
  ok("o botão fica desligado enquanto pensa", await botao(page).first().isDisabled().catch(() => false));
  ok("o resumo chegou", await esperarFase(page, "pronto", 4000));
  ok("e foi UM pedido à ponte", pedidos.length === 1, `foram ${pedidos.length}`);
  ok("pela conversa aberta", pedidos[0]?.corpo?.conversa_id === A, q(pedidos[0]?.corpo));
  ok("com a sessão de quem pediu", /^Bearer .+/.test(pedidos[0]?.autorizacao || ""), pedidos[0]?.autorizacao);
  ok("e nada foi para o cliente: a fila de envio vazia, a caixa intacta",
     (await saiuParaOCliente(page, A)) === 0 && (await naCaixa(page)) === "");
}

// ==================================================================
console.log("\n3. O resumo: as três partes, o que a IA leu, e a frase da IA");
{
  ok("o que o cliente quer", normal(await texto(parte(page, "quer"))).includes(RESUMO_A.quer),
     await texto(parte(page, "quer")));
  const itens = async (chave) => page.locator(`[data-resumo-parte="${chave}"] li`).allInnerTexts().catch(() => []);
  ok("o que já foi combinado, um item por fato, na ordem", q(await itens("combinado")) === q(RESUMO_A.combinado),
     q(await itens("combinado")));
  ok("o que falta", q(await itens("falta")) === q(RESUMO_A.falta), q(await itens("falta")));
  ok("as três partes têm título", /O que o cliente quer/i.test(await texto(parte(page, "quer")))
     && /O que já foi combinado/i.test(await texto(parte(page, "combinado"))) && /O que falta/i.test(await texto(parte(page, "falta"))));
  const leitura = normal(await texto(page.locator("[data-resumo-leitura]")));
  ok("diz quando foi feito e o que a IA leu", leitura === "Feito às 09:00. Leu a conversa inteira: 5 mensagens e 1 nota interna.",
     q(leitura));
  ok("e que foi feito pela IA, para conferir antes de agir",
     /Feito pela IA .*confira na conversa antes de agir/.test(await texto(page.locator("[data-resumo-aviso-da-ia]"))));
  ok("o botão diz que fecha o resumo", (await botao(page).first().getAttribute("aria-pressed")) === "true"
     && /Fechar/.test((await botao(page).first().getAttribute("title")) || ""));
}

// ==================================================================
console.log("\n4. O quadro fecha pelo X, pelo botão e pelo Esc — e o Esc fecha ele antes da conversa");
{
  ok("fechou pelo X", await clicar(page.locator("[data-resumo-fechar]")));
  await page.waitForTimeout(150);
  ok("e ele saiu", (await quadro(page).count()) === 0);
  pedidos.length = 0;
  ponte.resumir = () => pronto(RESUMO_A);
  await clicar(botao(page));
  ok("pedido de novo, voltou", await esperarFase(page, "pronto"));
  ok("e foi um pedido novo", pedidos.length === 1, `foram ${pedidos.length}`);
  await clicar(botao(page));
  await page.waitForTimeout(150);
  ok("o próprio botão, com o quadro aberto, fecha", (await quadro(page).count()) === 0);
  ok("sem pedir outro resumo", pedidos.length === 1, `foram ${pedidos.length}`);
  await clicar(botao(page));
  await esperarFase(page, "pronto");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("o Esc fecha o quadro", (await quadro(page).count()) === 0);
  ok("e a conversa continua aberta", (await page.locator(CAMPO).count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("só o Esc seguinte fecha a conversa", (await page.locator(CAMPO).count()) === 0);
  await abrirConversa(page, A);
}

// ==================================================================
console.log("\n5. Trocar de conversa no meio: o resumo é da conversa em que se clicou");
{
  ponte.resumir = (id) => ({ ...(id === B ? pronto(RESUMO_B) : pronto(RESUMO_A)), demora: 1500 });
  await clicar(botao(page));
  await page.waitForTimeout(200);
  await abrirConversa(page, B);
  ok("na conversa do José, não há quadro", (await quadro(page).count()) === 0);
  await page.waitForTimeout(1600);
  ok("nem depois de o resumo da Andreia chegar", (await quadro(page).count()) === 0);
  ok("e o botão do José não está apertado", (await botao(page).first().getAttribute("aria-pressed")) === "false");
  await abrirConversa(page, A);
  ok("de volta à da Andreia, o resumo dela está lá", (await quadro(page, "pronto").count()) === 1
     && normal(await texto(parte(page, "quer"))).includes(RESUMO_A.quer), await texto(quadro(page)));
  await abrirConversa(page, B);
  await clicar(botao(page));
  ok("o José ganha o resumo dele", await esperarFase(page, "pronto", 3000));
  ok("com o texto do José, e não o da Andreia", normal(await texto(parte(page, "quer"))).includes("QUER-DO-JOSE"),
     await texto(parte(page, "quer")));
  await abrirConversa(page, A);
  ok("e a Andreia continua com o dela", normal(await texto(parte(page, "quer"))).includes(RESUMO_A.quer));
  // FECHADO NO MEIO: a resposta que chega depois não reabre o quadro.
  await clicar(page.locator("[data-resumo-fechar]"));
  ponte.resumir = () => ({ ...pronto(RESUMO_A), demora: 1200 });
  await clicar(botao(page));
  await page.waitForTimeout(200);
  await clicar(page.locator("[data-resumo-fechar]"));
  await page.waitForTimeout(1500);
  ok("fechado enquanto a IA lia, a resposta que chega depois não reabre o quadro", (await quadro(page).count()) === 0);
  // "RESUMIR DE NOVO" troca pelo novo.
  ponte.resumir = () => pronto(RESUMO_A);
  await clicar(botao(page));
  await esperarFase(page, "pronto");
  ponte.resumir = () => ({ ...pronto({ ...RESUMO_A, quer: "QUER-NOVO: saber a data da audiência." }), demora: 600 });
  ok("clicou em Resumir de novo", await clicar(page.locator("[data-resumo-de-novo]")));
  await page.waitForTimeout(150);
  ok("o quadro volta a dizer que está lendo", (await quadro(page, "pensando").count()) === 1);
  await esperarFase(page, "pronto");
  ok("e traz o resumo novo", normal(await texto(parte(page, "quer"))).includes("QUER-NOVO"), await texto(parte(page, "quer")));
}

// ==================================================================
console.log("\n6. O erro é dito com a frase da ponte, e “Tentar de novo” pede de novo");
{
  await clicar(page.locator("[data-resumo-fechar]"));
  ponte.resumir = () => ({ status: 502, demora: 0, corpo: { ok: false,
    erro: "A Anthropic recusou a chave. Confira a variável ANTHROPIC_API_KEY na Render (serviço da ponte)." } });
  await clicar(botao(page));
  ok("o quadro vira erro", await esperarFase(page, "erro"));
  ok("com a frase da ponte, que diz o que fazer", /ANTHROPIC_API_KEY/.test(await texto(page.locator("[data-resumo-erro]"))),
     await texto(page.locator("[data-resumo-erro]")));
  ok("sem as três partes de um resumo", (await parte(page, "quer").count()) === 0);
  ponte.resumir = () => pronto(RESUMO_A);
  ok("tentou de novo", await clicar(page.locator("[data-resumo-tentar]")));
  ok("e o resumo veio", await esperarFase(page, "pronto"));
  await clicar(page.locator("[data-resumo-fechar]"));
  ponte.resumir = () => ({ status: 200, demora: 0, corpo: { ok: true, resumo: { quer: " ", combinado: [], falta: [""] },
                                                             mensagens: 5, notas: 0, cortou: false, ate: ULTIMA_A, avisos: [] } });
  await clicar(botao(page));
  await esperarFase(page, "erro");
  ok("o resumo vazio vira erro, e não um quadro em branco",
     /não devolveu resumo/.test(await texto(page.locator("[data-resumo-erro]"))), await texto(quadro(page)));
  await clicar(page.locator("[data-resumo-fechar]"));
  ponte.resumir = () => ({ status: 404, demora: 0, corpo: {} });
  await clicar(botao(page));
  await esperarFase(page, "erro");
  ok("a rota que não responde também é dita",
     /Não consegui falar com o servidor/.test(await texto(page.locator("[data-resumo-erro]"))), await texto(quadro(page)));
  await clicar(page.locator("[data-resumo-fechar]"));
}

// ==================================================================
console.log("\n7. A conversa cortada, os avisos e as listas vazias são ditos");
{
  ponte.resumir = () => pronto({ quer: "Só cumprimentou.", combinado: [], falta: [] }, {
    mensagens: 300, notas: 2, cortou: true,
    avisos: ["Não consegui ler as notas internas (código XX000): o resumo saiu só das mensagens."] });
  await clicar(botao(page));
  await esperarFase(page, "pronto");
  const leitura = normal(await texto(page.locator("[data-resumo-leitura]")));
  ok("a conversa cortada é dita: as últimas 300, e as mais antigas de fora",
     leitura.endsWith("Leu as últimas 300 mensagens e 2 notas internas — as mais antigas ficaram de fora."), q(leitura));
  ok("a lista vazia diz que está vazia", /Nada combinado ainda/.test(await texto(parte(page, "combinado")))
     && /Nada pendente/.test(await texto(parte(page, "falta"))));
  ok("o aviso da ponte aparece", /notas internas \(código XX000\)/.test(await texto(page.locator("[data-resumo-aviso]"))),
     await texto(page.locator("[data-resumo-aviso]")));
  await clicar(page.locator("[data-resumo-fechar]"));
}

// ==================================================================
console.log("\n8. As mensagens que chegam depois do resumo são contadas");
{
  ponte.resumir = () => pronto(RESUMO_A);
  await clicar(botao(page));
  await esperarFase(page, "pronto");
  ok("logo depois do resumo, nada chegou", (await page.locator("[data-resumo-novas]").count()) === 0);
  await page.evaluate((id) => globalThis.__MENSAGEM_PELA_PONTE(id, "contato", "Alguma novidade?"), A);
  await page.waitForTimeout(1200);
  ok("o cliente escreveu: o quadro diz que chegou 1 mensagem depois",
     /Chegou 1 mensagem depois deste resumo/.test(await texto(page.locator("[data-resumo-novas]"))), await texto(quadro(page)));
  await page.evaluate((id) => globalThis.__MENSAGEM_PELA_PONTE(id, "advogado", "Vou verificar."), A);
  await page.waitForTimeout(1200);
  ok("e conta as duas", (await page.locator('[data-resumo-novas="2"]').count()) === 1, await texto(quadro(page)));
  ok("sem erro de JavaScript até aqui", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n9. Copiar leva o texto puro, dizendo que é da IA");
{
  ({ ctx, page, estouros } = await abrirPagina({ area: true }));
  await abrirConversa(page, A);
  ponte.resumir = () => pronto(RESUMO_A);
  await clicar(botao(page));
  await esperarFase(page, "pronto");
  await page.evaluate(() => navigator.clipboard.writeText("(nada copiado)"));
  ok("clicou em Copiar", await clicar(page.locator("[data-resumo-copiar]")));
  await page.waitForTimeout(300);
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  ok("o texto diz de quem é a conversa, quando e que foi feito pela IA",
     copiado.startsWith("Resumo da conversa com ANDREIA CRISTINA MARTINS, às 09:00 (feito pela IA do Zorvin)"), q(copiado.slice(0, 120)));
  ok("e traz as três partes, com os itens em linhas",
     copiado.includes(`O que o cliente quer:\n${RESUMO_A.quer}`) && copiado.includes(`- ${RESUMO_A.combinado[0]}`)
     && copiado.includes(`O que falta:\n- ${RESUMO_A.falta[0]}`), q(copiado));
  ok("e o aviso diz que copiou", /Resumo copiado/.test(await page.locator("body").innerText()));
  await ctx.close();
}

// ==================================================================
console.log("\n10. O quadro não cobre as mensagens mais novas");
{
  ({ ctx, page, estouros } = await abrirPagina());
  await abrirConversa(page, L);
  ponte.resumir = () => pronto(RESUMO_A, { mensagens: 40, notas: 0, ate: antes(205) });
  await clicar(botao(page));
  await esperarFase(page, "pronto");
  await page.waitForTimeout(300);
  const visto = await page.evaluate(() => {
    // O ELEMENTO QUE TEM O TEXTO COMO FILHO DIRETO: a bolha guarda, junto do
    // texto, a hora e os tiques num <span>, e por isso ela não é "folha".
    const ultima = [...document.querySelectorAll("[data-lista-mensagens] *")]
      .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /LONGA-39/.test(n.textContent || ""))).pop();
    const q2 = document.querySelector("[data-resumo-da-conversa]");
    if (!ultima || !q2) return { ultima: !!ultima, quadro: !!q2 };
    const r = ultima.getBoundingClientRect();
    const naUltima = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
    const rq = q2.getBoundingClientRect();
    const noQuadro = document.elementFromPoint(rq.left + rq.width / 2, rq.top + 20);
    return { ultima: true, quadro: true, ultimaPintada: !!naUltima && !q2.contains(naUltima) && ultima.contains(naUltima),
             quadroPintado: !!noQuadro && q2.contains(noQuadro), fundoDoQuadro: Math.round(rq.bottom), topoDaUltima: Math.round(r.top) };
  });
  ok("o quadro está pintado por cima do alto da conversa", visto.quadroPintado === true, q(visto));
  ok("e a mensagem mais nova continua à vista, por baixo dele", visto.ultimaPintada === true, q(visto));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n11. No celular, o caminho é o ⋮, e o quadro cabe na tela");
{
  ({ ctx, page, estouros } = await abrirPagina({ largura: 390, altura: 844 }));
  await abrirConversa(page, A);
  ok("no celular, não há botão na barra de escrever", (await botao(page).count()) === 0);
  ponte.resumir = () => pronto(RESUMO_A);
  ok("abriu o ⋮", await clicar(page.getByRole("button", { name: "Mais opções desta conversa" })));
  await page.waitForTimeout(300);
  const item = page.locator("[data-resumo-item]");
  ok("o ⋮ tem “Resumir a conversa”", /Resumir a conversa/.test(await texto(item)), await texto(item));
  await clicar(item);
  ok("o resumo veio", await esperarFase(page, "pronto"));
  const medida = await page.evaluate(() => {
    const q2 = document.querySelector("[data-resumo-da-conversa]");
    const r = q2.getBoundingClientRect();
    const x = document.querySelector("[data-resumo-fechar]").getBoundingClientRect();
    return { esq: Math.round(r.left), dir: Math.round(r.right), larg: innerWidth,
             rolaDeLado: document.scrollingElement.scrollWidth > innerWidth + 1,
             xAlto: Math.round(x.height), xLargo: Math.round(x.width) };
  });
  ok("o quadro cabe na largura da tela", medida.esq >= 0 && medida.dir <= medida.larg, q(medida));
  ok("e a página não rola de lado", medida.rolaDeLado === false, q(medida));
  ok("o X tem o alvo de dedo (40 pontos)", medida.xAlto >= 40 && medida.xLargo >= 40, q(medida));
  await clicar(page.getByRole("button", { name: "Mais opções desta conversa" }));
  await page.waitForTimeout(300);
  ok("com o resumo aberto, o ⋮ oferece resumir de novo", /Resumir de novo/.test(await texto(page.locator("[data-resumo-item]"))));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5" } };
  ({ ctx, page } = await abrirPagina({ largura: 390, altura: 844 }));
  await abrirConversa(page, A);
  await clicar(page.getByRole("button", { name: "Mais opções desta conversa" }));
  await page.waitForTimeout(300);
  ok("com a ponte de antes do resumo, o ⋮ não oferece resumir", (await page.locator("[data-resumo-item]").count()) === 0);
  await ctx.close();
}
ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true } };

// ==================================================================
// A 900, A CAIXA DE ESCREVER CAÍA PARA 181 PONTOS com o botão na barra (o
// piso é 200, medido pela `a-auditoria-de-27-10`). Ali o cabeçalho já recolhe
// no ⋮, e o "Resumir" vai junto.
console.log("\n12. Onde o cabeçalho recolhe no ⋮, o Resumir vai junto, e a caixa de escrever não perde largura");
{
  ({ ctx, page, estouros } = await abrirPagina({ largura: 900, altura: 800 }));
  await abrirConversa(page, A);
  ok("a 900, não há botão na barra de escrever", (await botao(page).count()) === 0);
  const largura = await page.evaluate((sel) => {
    const c = document.querySelector(sel);
    return c ? Math.round(c.getBoundingClientRect().width) : null;
  }, CAMPO);
  ok("e a caixa de escrever fica com largura de gente", largura != null && largura >= 200, `largura ${largura}`);
  const menu = page.locator('[data-topo-conversa] [aria-label="Mais opções desta conversa"]');
  ok("o cabeçalho recolheu no ⋮", (await menu.count()) === 1);
  ponte.resumir = () => pronto(RESUMO_A);
  await clicar(menu);
  await page.waitForTimeout(300);
  const item = page.locator("[data-resumo-item]");
  ok("e o ⋮ tem “Resumir a conversa”", /Resumir a conversa/.test(await texto(item)), await texto(item));
  await clicar(item);
  ok("o resumo veio por ele", await esperarFase(page, "pronto"));
  ok("sem erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
