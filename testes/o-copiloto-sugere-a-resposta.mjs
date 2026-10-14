// O COPILOTO SUGERE A RESPOSTA (13/10) — a metade do painel.
//
// Quem fala com a IA (o Claude Haiku 5.5) é a PONTE, provada no repo dela
// (seções 62 e 63). O que esta prova guarda é o que é da tela:
//
//   1. o botão só existe com a caixa vazia, e só quando a ponte não disse
//      "desligado" (a dúvida MOSTRA — a régua de `temVantoro.js`);
//   2. o clique pede à ponte a sugestão DESTA conversa, com a sessão de quem
//      pediu, e a sugestão entra na caixa com {saudacao}, {nome} e
//      {atendente} preenchidos pelas regras das mensagens rápidas — e NÃO SAI
//      SOZINHA;
//   3. enquanto pensa, a faixa diz, e um segundo clique não manda outro pedido;
//   4. o erro é DITO com a frase da ponte;
//   5. trocar de conversa no meio não leva a sugestão para a outra conversa,
//      e o nome que entra é o da conversa EM QUE se clicou;
//   6. quem começou a escrever antes de a sugestão chegar não perde o texto;
//   7. no grupo, o {nome} sai sem rastro; na nota interna, não há botão;
//   8. no celular, o caminho é o ⋮;
//   9. a aba "Copiloto" da administração lê e grava o manual, diz se a ponte
//      tem a chave, e diz a recusa e a falha — nunca uma caixa vazia.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
// TERÇA, 13/10/2026, 9h EM BRASÍLIA: a saudação é "Bom dia".
const AGORA = Date.parse("2026-10-13T09:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const ATENDENTE = "MARIANA DE OLIVEIRA";
const CAMPO = 'textarea[data-campo]';

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.first().innerText().catch(() => "");

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
// ficha em maiúsculas — o alto da conversa diz o da ficha, e é ele que o
// {nome} usa. A do José é a "outra conversa" da corrida. O grupo não tem "o
// cliente".
const contato = (id, numero, nome, vantoro_nome = null) =>
  ({ id, numero, nome, vantoro_nome, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-cop-1", "5511948230201", "Deus", "ANDREIA CRISTINA MARTINS"),
  contato("ct-cop-2", "5511948230202", "José Carlos Pereira"),
  contato("ct-cop-3", "grupo:120363999000000777", "Mutirão dos Acordos"),
];
const A = "cv-cop-1", B = "cv-cop-2", G = "cv-cop-3";
const conversa = (n) => ({
  id: `cv-cop-${n}`, advogado_id: ADV, contato_id: `ct-cop-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null,
  vantoro_nome: CONTATOS[n - 1].vantoro_nome, contato: CONTATOS[n - 1],
});
const SEMENTE = {
  contatos: CONTATOS,
  conversas: [1, 2, 3].map(conversa),
  mensagens: [1, 2, 3].map((n) => ({
    id: `m-cop-${n}`, conversa_id: `cv-cop-${n}`, origem: "contato", tipo: "texto",
    texto: "Bom dia, mandei o comprovante.", criado_em: antes(n + 5),
  })),
};

// A PONTE DE MENTIRA. `ponte` é trocada por cena; `pedidos` guarda cada
// pedido de sugestão inteiro.
const ponte = {
  estado: { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5" } },
  sugestao: { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Recebi o seu comprovante." }, demora: 0 },
};
const pedidos = [];

async function abrirPagina({ largura = 1400, altura = 900, semCopiloto = false, semEfeito = [],
                             erroNaGravacao = {}, recusarLeitura = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.clock.setFixedTime(new Date(AGORA));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários, e a
  // última escrita é a que vale.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__NOME_NOVO_U1 = b.atendente;
    globalThis.__SEM_COPILOTO = b.semCopiloto;
    globalThis.__ESCRITA_SEM_EFEITO = b.semEfeito;
    globalThis.__ERRO_NA_GRAVACAO = b.erroNaGravacao;
    globalThis.__RECUSAR_LEITURA = b.recusarLeitura;
  }, { semente: SEMENTE, atendente: ATENDENTE, semCopiloto, semEfeito, erroNaGravacao, recusarLeitura });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (url.pathname.endsWith("/copiloto/sugerir")) {
      pedidos.push({ corpo: JSON.parse(rota.request().postData() || "{}"),
                     autorizacao: rota.request().headers()["authorization"] || "" });
      const r = ponte.sugestao;
      if (r.demora) await new Promise((ok_) => setTimeout(ok_, r.demora));
      return json(r.status, r.corpo);
    }
    // SEM VANTORO: a ficha fixa ficaria pedindo cadastro a esta ponte, e a
    // coluna dela estreitaria a conversa sem nada a ver com o copiloto.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
const caixa = (page) => page.locator(CAMPO);
const naCaixa = (page) => caixa(page).inputValue().catch(() => "SEM CAIXA");
async function abrirConversa(page, id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const botao = (page) => page.locator("[data-copiloto-botao]");
const faixa = (page, fase) => page.locator(fase ? `[data-copiloto-situacao="${fase}"]` : "[data-copiloto-situacao]");
const saiuParaOCliente = (page, conversaId) => page.evaluate((id) =>
  (globalThis.__TABELAS.fila_envio || []).filter((f) => String(f.conversa_id) === String(id)).length, conversaId);

// ==================================================================
console.log("\n1. O botão só existe com a caixa vazia");
let { ctx, page, estouros } = await abrirPagina();
ok("abri a conversa da Andreia", await abrirConversa(page, A));
ok("com a caixa vazia, o botão “Sugerir resposta” está lá", (await botao(page).count()) === 1);
const rotulo = await botao(page).first().getAttribute("aria-label").catch(() => "");
ok("e diz o que faz (aria-label)", /Sugerir resposta/.test(rotulo || ""), rotulo);
await caixa(page).fill("Oi");
await page.waitForTimeout(150);
ok("com texto na caixa, ele some — a sugestão nunca apaga o que alguém escreveu", (await botao(page).count()) === 0);
await caixa(page).fill("");
await page.waitForTimeout(150);
ok("esvaziou, ele volta", (await botao(page).count()) === 1);

// ==================================================================
console.log("\n2. O clique pede à ponte, e a sugestão entra na caixa — sem sair sozinha");
{
  ok("clicou no botão", await clicar(botao(page)));
  await page.waitForTimeout(900);
  ok("foi UM pedido à ponte", pedidos.length === 1, `foram ${pedidos.length}`);
  ok("pela conversa aberta", pedidos[0]?.corpo?.conversa_id === A, q(pedidos[0]?.corpo));
  ok("com a sessão de quem pediu", /^Bearer .+/.test(pedidos[0]?.autorizacao || ""), pedidos[0]?.autorizacao);
  const v = await naCaixa(page);
  ok("a sugestão está na caixa, com a saudação da hora e o PRIMEIRO nome da ficha (não “Deus”)",
     v === "Bom dia, Andreia! Recebi o seu comprovante.", q(v));
  ok("e NÃO saiu para o cliente: nada na fila de envio", (await saiuParaOCliente(page, A)) === 0);
  const foco = await page.evaluate(() => {
    const c = document.activeElement;
    return c && c.tagName === "TEXTAREA" ? { fim: c.selectionStart === c.value.length && c.selectionEnd === c.value.length } : null;
  });
  ok("o cursor fica na caixa, no fim do texto, pronto para ajustar", foco && foco.fim === true, q(foco));
  ok("o sucesso não deixa faixa: a resposta é a caixa", (await faixa(page).count()) === 0);
}

// ==================================================================
console.log("\n3. Enquanto pensa, a faixa diz — e não sai um segundo pedido");
{
  await caixa(page).fill("");
  pedidos.length = 0;
  ponte.sugestao = { status: 200, corpo: { ok: true, sugestao: "Já verifico e te retorno." }, demora: 1500 };
  await clicar(botao(page));
  await page.waitForTimeout(300);
  ok("a faixa diz que o copiloto está lendo a conversa",
     (await faixa(page, "pensando").count()) === 1 && /lendo a conversa/.test(await texto(faixa(page, "pensando"))));
  await page.evaluate(() => document.querySelector("[data-copiloto-botao]")?.click());
  await page.waitForTimeout(150);
  ok("o botão fica desligado enquanto pensa", await botao(page).first().isDisabled().catch(() => false));
  await page.waitForTimeout(1700);
  ok("e foi um pedido só", pedidos.length === 1, `foram ${pedidos.length}`);
  ok("a sugestão entrou", (await naCaixa(page)) === "Já verifico e te retorno.", q(await naCaixa(page)));
  ok("e a faixa saiu", (await faixa(page).count()) === 0);
}

// ==================================================================
console.log("\n4. O erro é dito com a frase da ponte");
{
  await caixa(page).fill("");
  ponte.sugestao = { status: 503, demora: 0, corpo: { ok: false,
    erro: "O copiloto ainda não está ligado: falta a variável ANTHROPIC_API_KEY na Render (serviço da ponte)." } };
  await clicar(botao(page));
  await page.waitForTimeout(800);
  const frase = await texto(faixa(page, "erro"));
  ok("a faixa de erro traz a frase da ponte, que diz o que fazer", /ANTHROPIC_API_KEY/.test(frase), q(frase));
  ok("a caixa continua vazia", (await naCaixa(page)) === "");
  ok("e o botão continua, para tentar de novo", (await botao(page).count()) === 1);
  ok("fechou o aviso", await clicar(page.locator("[data-copiloto-fechar]")));
  await page.waitForTimeout(150);
  ok("e ele saiu", (await faixa(page).count()) === 0);
}

// ==================================================================
console.log("\n5. Trocar de conversa no meio: a sugestão vai para a conversa certa, com o nome certo");
{
  ponte.sugestao = { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Vou verificar." }, demora: 1500 };
  await caixa(page).fill("");
  await clicar(botao(page));
  await page.waitForTimeout(200);
  await abrirConversa(page, B);
  await page.waitForTimeout(1600);
  ok("na conversa do José, a caixa continua vazia", (await naCaixa(page)) === "", q(await naCaixa(page)));
  ok("e não há faixa do copiloto ali", (await faixa(page).count()) === 0);
  await abrirConversa(page, A);
  const v = await naCaixa(page);
  ok("de volta à da Andreia, a sugestão está lá — com o nome DELA, e não o do José",
     v === "Bom dia, Andreia! Vou verificar.", q(v));
}

// ==================================================================
console.log("\n6. Quem começou a escrever antes de a sugestão chegar não perde o texto");
{
  await caixa(page).fill("");
  ponte.sugestao = { status: 200, corpo: { ok: true, sugestao: "Recebido, obrigada!" }, demora: 1500 };
  await clicar(botao(page));
  await page.waitForTimeout(250);
  await caixa(page).fill("Oi, tudo bem?");
  await page.waitForTimeout(1700);
  ok("o que foi escrito continua na caixa", (await naCaixa(page)) === "Oi, tudo bem?", q(await naCaixa(page)));
  ok("e a faixa diz que a sugestão chegou depois", (await faixa(page, "atrasada").count()) === 1);
  ok("usou a sugestão", await clicar(page.locator("[data-copiloto-usar]")));
  await page.waitForTimeout(200);
  ok("e ela trocou o texto da caixa", (await naCaixa(page)) === "Recebido, obrigada!", q(await naCaixa(page)));
  ok("e a faixa saiu", (await faixa(page).count()) === 0);
}

// ==================================================================
console.log("\n7. No grupo, sem o nome de ninguém; na nota interna, sem botão");
{
  ponte.sugestao = { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Recebi o seu comprovante." }, demora: 0 };
  await abrirConversa(page, G);
  await caixa(page).fill("");
  await clicar(botao(page));
  await page.waitForTimeout(800);
  const v = await naCaixa(page);
  ok("no grupo, o {nome} sai levando a vírgula — e não vira “Mutirão”",
     v === "Bom dia! Recebi o seu comprovante.", q(v));
  await caixa(page).fill("");
  await clicar(page.locator("[data-nota-interna]"));
  await page.waitForTimeout(300);
  ok("na nota interna não há botão do copiloto (ele escreve ao cliente, não à equipe)",
     (await botao(page).count()) === 0);
  await clicar(page.locator("[data-nota-interna]"));
}
ok("nenhum estouro de página até aqui", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n8. Desligado na ponte, nada aparece; a ponte que não responde, aparece");
{
  ponte.estado = { status: 200, corpo: { ok: true, ligado: false, modelo: "claude-haiku-5-5" } };
  ({ ctx, page } = await abrirPagina());
  await abrirConversa(page, A);
  ok("a ponte disse que não tem a chave: o botão não aparece", (await botao(page).count()) === 0);
  await ctx.close();
  ponte.estado = { status: 500, corpo: { ok: false } };
  ({ ctx, page } = await abrirPagina());
  await abrirConversa(page, A);
  ok("a ponte não respondeu: o botão aparece (o clique dirá o que houver)", (await botao(page).count()) === 1);
  await ctx.close();
  ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5" } };
}

// ==================================================================
console.log("\n9. No celular, o caminho é o ⋮");
{
  ({ ctx, page, estouros } = await abrirPagina({ largura: 390, altura: 844 }));
  pedidos.length = 0;
  await abrirConversa(page, A);
  ok("no celular a caixa não ganha o botão (já divide 390px com quatro)", (await botao(page).count()) === 0);
  ok("abriu o ⋮", await clicar(page.getByRole("button", { name: "Mais opções desta conversa" })));
  await page.waitForTimeout(300);
  const item = page.locator("[data-copiloto-item]");
  ok("o ⋮ tem “Sugerir resposta”", (await item.count()) === 1 && /Sugerir resposta/.test(await texto(item)));
  const altura = await item.first().evaluate((el) => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
  ok("com altura de dedo (40px)", altura >= 40, `${altura}px`);
  await clicar(item);
  await page.waitForTimeout(900);
  ok("e o toque pede à ponte e põe a sugestão na caixa",
     pedidos.length === 1 && (await naCaixa(page)) === "Bom dia, Andreia! Recebi o seu comprovante.", q(await naCaixa(page)));
  await clicar(page.getByRole("button", { name: "Mais opções desta conversa" }));
  await page.waitForTimeout(300);
  ok("com texto na caixa, o ⋮ não oferece mais (a mesma regra do botão)",
     (await page.locator("[data-copiloto-item]").count()) === 0);
  ok("nenhum estouro de página no celular", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n10. A aba “Copiloto” da administração");
async function abrirAAba(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(800);
  if (!(await clicar(page.locator("[data-aba-copiloto]")))) return false;
  await page.waitForTimeout(700);
  return true;
}
const manual = (page) => page.locator("[data-manual-texto]");
const naTabela = (page) => page.evaluate(() => ((globalThis.__TABELAS.zorvin_copiloto || [])[0] || {}).instrucoes);
{
  ({ ctx, page, estouros } = await abrirPagina());
  ok("abri a aba Copiloto", await abrirAAba(page));
  ok("ela diz que o copiloto está ligado, com o modelo",
     /Ligado \(claude-haiku-5-5\)/.test(await texto(page.locator('[data-copiloto-ligado="true"]'))));
  const lido = await manual(page).inputValue().catch(() => "");
  ok("mostra o manual que está no banco", /^QUEM SOMOS/.test(lido), q(lido.slice(0, 40)));
  ok("diz quando o manual foi mudado pela última vez",
     /última alteração em 01\/10\/2026, 09:00/.test(await texto(page.locator("[data-manual-quando]"))),
     q(await texto(page.locator("[data-manual-quando]"))));
  ok("o botão de salvar começa apagado: nada mudou", await page.locator("[data-manual-salvar]").first().isDisabled().catch(() => false));
  await manual(page).fill(lido + "\nNunca prometemos data de pagamento.");
  ok("salvou", await clicar(page.locator("[data-manual-salvar]")));
  await page.waitForTimeout(700);
  ok("o banco guardou o manual novo", /Nunca prometemos data de pagamento\.$/.test((await naTabela(page)) || ""),
     q(await naTabela(page)));
  ok("e a tela diz que salvou", /Salvo/.test(await texto(page.locator('[data-manual-recado="ok"]'))));
  // A ÚLTIMA ALTERAÇÃO VEM DO BANCO (o gatilho do 024, que a bancada imita):
  // é ela que mostra que a tela RELEU depois de salvar, e não só confiou no
  // que foi digitado. Antes de salvar ela dizia 01/10.
  ok("e relê do banco: a última alteração passa a ser a de agora",
     /última alteração em 13\/10\/2026, 09:00/.test(await texto(page.locator("[data-manual-quando]"))),
     q(await texto(page.locator("[data-manual-quando]"))));
  await manual(page).fill("a".repeat(8001));
  await page.waitForTimeout(150);
  ok("acima de 8000 caracteres, não salva — e a conta diz por quê",
     (await page.locator("[data-manual-salvar]").first().isDisabled().catch(() => false))
     && /passou do limite/.test(await texto(page.locator("[data-manual-conta]"))));
  ok("nenhum estouro na aba", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  ({ ctx, page } = await abrirPagina({ semEfeito: ["zorvin_copiloto"] }));
  await abrirAAba(page);
  await manual(page).fill("Manual que o banco não deixa gravar.");
  await clicar(page.locator("[data-manual-salvar]"));
  await page.waitForTimeout(700);
  ok("a recusa calada da regra de acesso é DITA, e não vira “salvo”",
     /o banco não deixou/.test(await texto(page.locator('[data-manual-recado="erro"]'))));
  await ctx.close();
}
{
  ({ ctx, page } = await abrirPagina({ erroNaGravacao: { zorvin_copiloto: { code: "42501", message: "permission denied" } } }));
  await abrirAAba(page);
  await manual(page).fill("Manual que o banco recusa.");
  await clicar(page.locator("[data-manual-salvar]"));
  await page.waitForTimeout(700);
  ok("a recusa com erro é dita COM O CÓDIGO", /erro 42501/.test(await texto(page.locator('[data-manual-recado="erro"]'))));
  await ctx.close();
}
{
  ({ ctx, page } = await abrirPagina({ recusarLeitura: ["zorvin_copiloto"] }));
  ok("com a leitura falhando, a aba aparece mesmo assim", await abrirAAba(page));
  ok("e diz que não leu — sem caixa vazia para salvar por cima",
     /Não consegui ler o manual/.test(await texto(page.locator("[data-manual-erro]")))
     && (await manual(page).count()) === 0);
  await ctx.close();
}
{
  ({ ctx, page } = await abrirPagina({ semCopiloto: true }));
  await clicar(page.getByRole("button", { name: "Menu" }));
  await clicar(page.getByRole("button", { name: "Departamentos e acessos" }));
  await page.waitForTimeout(900);
  ok("sem o script 024, não há aba Copiloto", (await page.locator("[data-aba-copiloto]").count()) === 0);
  await page.keyboard.press("Escape");
  await clicar(page.getByRole("button", { name: "Fechar" }));
  await abrirConversa(page, A);
  ok("e o botão continua: quem decide se ele aparece é a ponte, que sugere sem o manual",
     (await botao(page).count()) === 1);
  await ctx.close();
}
{
  ponte.estado = { status: 200, corpo: { ok: true, ligado: false, modelo: "claude-haiku-5-5" } };
  ({ ctx, page } = await abrirPagina());
  await abrirAAba(page);
  ok("sem a chave na ponte, a aba diz qual variável falta",
     /ANTHROPIC_API_KEY/.test(await texto(page.locator('[data-copiloto-ligado="false"]'))));
  await ctx.close();
  ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5" } };
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
