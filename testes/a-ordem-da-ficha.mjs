// A ORDEM DA FICHA — as senhas embaixo do nome, as observações no alto
//
// Pedido do Rodrigo em 13/10: *"em 'Ficha no Vantoro', os acessos preciso
// colocar embaixo do Nome completo do cliente, antes do E-mail. As
// Observações podem ficar mais acima, antes da Identificação."*
//
// As senhas moravam numa seção própria, "Acessos", FECHADA e no fim da ficha.
// Agora elas ficam à vista, na identificação — e isso trouxe uma obrigação
// que a seção fechada escondia: o Vantoro não manda as senhas a quem não pode
// vê-las, e no lugar delas a ficha desenhava uma caixa VAZIA. No alto da
// ficha, essa caixa convidaria a digitar por cima da senha que está lá.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a ordem: Observações, Identificação, Endereço, Origem — e nenhuma
//      seção "Acessos";
//   2. dentro da identificação: Nome completo → Senha SERASA → Senha GOV →
//      E-mail, uma logo depois da outra, à vista sem abrir nada;
//   3. a senha que veio continua editável, e salvar manda SÓ ela;
//   4. a senha que NÃO veio não vira caixa vazia: a ficha diz que não veio,
//      não deixa digitar, não a manda ao salvar outro campo e não a conta
//      como "falta preencher";
//   5. uma senha que veio e outra que não, cada uma com o seu desenho.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const BASE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
               telefone: "5567992183107", telefone2: "", ocupacao: "Costureira",
               observacoes: "Prefere contato à tarde.",
               documentos: 0, processos: [], ordem_servico: null };
const COM_SENHAS = { ...BASE, email: "andreia@exemplo.com",
                     senha_serasa: "serasa-da-andreia", senha_gov: "gov-da-andreia" };

const nav = await abrirNavegador();

/** Abre o painel com a ponte de mentira respondendo `cliente` para a
 *  conversa "Deus". Guarda o corpo de todo PATCH, que é o que vai ao Vantoro. */
async function abrirFicha(cliente) {
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const patches = [];
  let atual = { ...cliente };
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    if (url.pathname.endsWith("/vantoro/cliente") && metodo === "GET") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: [atual], opcoes: {} }) });
    }
    if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname) && metodo === "PATCH") {
      let corpo = {};
      try { corpo = JSON.parse(rota.request().postData() || "{}"); } catch (_) { /* vazio */ }
      patches.push(corpo);
      atual = { ...atual, ...corpo };
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, cliente: atual }) });
    }
    if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname) && metodo === "GET") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, cliente: atual }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const linha = page.locator('[data-conversa-nome*="Deus"]');
  if (await linha.count()) {
    await linha.first().click();
    await page.waitForTimeout(1200);
  }
  if (!(await page.locator("[data-ficha]").count())) {
    const b = page.locator("[data-abrir-ficha]");
    if (await b.count()) await b.first().click();
  }
  await page.waitForTimeout(1500);
  return { ctx, page, estouros, patches };
}

/** A ficha lida na ORDEM DO DOCUMENTO: o cabeçalho de cada seção
 *  ("secao:x"), cada campo ("campo:x") e cada campo que não veio
 *  ("ausente:x"). É a ordem em que a pessoa lê, de cima para baixo. */
async function lerAFicha(page) {
  return page.$$eval("[data-ficha] [data-secao], [data-ficha] [data-campo], [data-ficha] [data-campo-ausente]",
    (ns) => ns.map((n) => n.hasAttribute("data-secao") ? `secao:${n.getAttribute("data-secao")}`
      : n.hasAttribute("data-campo-ausente") ? `ausente:${n.getAttribute("data-campo-ausente")}`
      : `campo:${n.getAttribute("data-campo")}`));
}
/** O que vem logo depois de `item` na ficha, ou null. */
const depoisDe = (lista, item) => {
  const i = lista.indexOf(item);
  return i >= 0 && i + 1 < lista.length ? lista[i + 1] : null;
};
/** A seção onde `item` mora: o último cabeçalho antes dele. */
const secaoDe = (lista, item) => {
  const i = lista.indexOf(item);
  if (i < 0) return null;
  for (let j = i - 1; j >= 0; j--) if (lista[j].startsWith("secao:")) return lista[j].slice(6);
  return null;
};
/** Salva pelo botão da ficha. Guardado: clique em elemento que não existe
 *  estoura a prova inteira e esconde QUAL conferência pegou o defeito. */
async function salvar(page) {
  const b = page.getByRole("button", { name: /Salvar no Vantoro/ });
  if (!(await b.count())) return false;
  await b.first().click();
  await page.waitForTimeout(1500);
  return true;
}
const valorDe = async (page, chave) => {
  const l = page.locator(`[data-ficha] [data-campo="${chave}"]`);
  return (await l.count()) ? await l.first().inputValue().catch(() => null) : null;
};
const contagem = async (page, secao) =>
  (await page.locator(`[data-secao="${secao}"]`).innerText().catch(() => "")).match(/\d+\/\d+/)?.[0] || "";

// ==================================================================
console.log("\n1. A ordem das seções: Observações no alto, e nenhuma \"Acessos\"");
{
  const { ctx, page, estouros } = await abrirFicha(COM_SENHAS);
  ok("a ficha abriu com a cliente", (await valorDe(page, "nome")) === "ANDREIA CRISTINA MARTINS",
     String(await valorDe(page, "nome")));
  const secoes = await page.$$eval("[data-ficha] [data-secao]", (ns) => ns.map((n) => n.getAttribute("data-secao")));
  ok("Observações, Identificação, Endereço, Origem — nessa ordem",
     secoes.join(",") === "observacoes,identificacao,endereco,origem", secoes.join(","));
  ok("e a seção \"Acessos\" não existe mais", secoes.length > 0 && !secoes.includes("acessos"), secoes.join(","));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. As senhas ficam embaixo do Nome completo, antes do E-mail, à vista");
{
  const { ctx, page } = await abrirFicha(COM_SENHAS);
  const ficha = await lerAFicha(page);
  ok("a Senha SERASA vem logo depois do Nome completo",
     depoisDe(ficha, "campo:nome") === "campo:senha_serasa", ficha.join(" "));
  ok("a Senha GOV, logo depois da SERASA",
     depoisDe(ficha, "campo:senha_serasa") === "campo:senha_gov", ficha.join(" "));
  ok("e o E-mail, logo depois da GOV",
     depoisDe(ficha, "campo:senha_gov") === "campo:email", ficha.join(" "));
  ok("as duas senhas moram na Identificação",
     secaoDe(ficha, "campo:senha_serasa") === "identificacao" && secaoDe(ficha, "campo:senha_gov") === "identificacao",
     `${secaoDe(ficha, "campo:senha_serasa")} / ${secaoDe(ficha, "campo:senha_gov")}`);
  // À VISTA SEM ABRIR NADA: a prova não clicou em seção nenhuma. Numa seção
  // fechada o campo nem é desenhado — e foi assim que elas moravam antes.
  const serasa = page.locator('[data-ficha] [data-campo="senha_serasa"]');
  const gov = page.locator('[data-ficha] [data-campo="senha_gov"]');
  ok("as duas estão na tela sem abrir seção nenhuma",
     (await serasa.count()) === 1 && (await gov.count()) === 1
       && await serasa.isVisible() && await gov.isVisible());
  ok("com as senhas que vieram do Vantoro",
     (await valorDe(page, "senha_serasa")) === "serasa-da-andreia" && (await valorDe(page, "senha_gov")) === "gov-da-andreia",
     `${await valorDe(page, "senha_serasa")} / ${await valorDe(page, "senha_gov")}`);
  ok("são campos de escrever, e não caixas cinzas",
     (await page.locator('[data-ficha] [data-campo-ausente^="senha"]').count()) === 0);
  // 9 campos, e preenchidos: CPF, nome, as duas senhas, e-mail e profissão.
  ok("e a Identificação conta as duas (6/9)", (await contagem(page, "identificacao")) === "6/9",
     await contagem(page, "identificacao"));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Editar a senha que veio manda só ela");
{
  const { ctx, page, patches } = await abrirFicha(COM_SENHAS);
  const gov = page.locator('[data-ficha] [data-campo="senha_gov"]');
  if (await gov.count()) await gov.first().fill("gov-nova");
  ok("salvei", await salvar(page));
  ok("um pedido de gravação foi ao Vantoro", patches.length === 1, `foram ${patches.length}`);
  ok("só com a Senha GOV, e o texto novo",
     patches[0] && Object.keys(patches[0]).join(",") === "senha_gov" && patches[0].senha_gov === "gov-nova",
     JSON.stringify(patches[0]));
  ok("e a tela mostra o que ficou gravado", (await valorDe(page, "senha_gov")) === "gov-nova");
  await ctx.close();
}

// ==================================================================
console.log("\n4. A senha que não veio não vira caixa vazia");
{
  const { ctx, page, patches } = await abrirFicha(BASE);
  ok("não há campo para escrever a Senha SERASA nem a GOV",
     (await page.locator('[data-ficha] [data-campo="senha_serasa"], [data-ficha] [data-campo="senha_gov"]').count()) === 0);
  const ausentes = page.locator('[data-ficha] [data-campo-ausente="senha_serasa"], [data-ficha] [data-campo-ausente="senha_gov"]');
  ok("no lugar delas, as duas dizem que não vieram",
     (await ausentes.count()) === 2
       && (await ausentes.allInnerTexts()).filter((t) => /Não veio do Vantoro/.test(t)).length === 2,
     JSON.stringify(await ausentes.allInnerTexts()));
  ok("e estão à vista", (await ausentes.count()) === 2 && await ausentes.nth(0).isVisible() && await ausentes.nth(1).isVisible());
  // O MOTIVO VAI NO `title`: a caixa é de uma linha, e a frase inteira, duas
  // vezes no alto de toda ficha, seria ruído que se aprende a pular.
  const porque = await page.locator('[data-ficha] [data-campo-ausente="senha_serasa"] [title]').first()
    .getAttribute("title").catch(() => "");
  ok("com o porquê, para quem passar o mouse", /só manda as senhas a quem pode vê-las/.test(porque || ""), porque);
  const ficha = await lerAFicha(page);
  ok("no mesmo lugar: entre o Nome completo e o E-mail",
     depoisDe(ficha, "campo:nome") === "ausente:senha_serasa"
       && depoisDe(ficha, "ausente:senha_serasa") === "ausente:senha_gov"
       && depoisDe(ficha, "ausente:senha_gov") === "campo:email", ficha.join(" "));
  // 9 campos menos as 2 senhas que não vieram. Preenchidos: CPF, nome e
  // profissão. Contar as senhas diria "falta" sobre o que talvez esteja lá.
  ok("a Identificação não conta o que não veio (3/7)", (await contagem(page, "identificacao")) === "3/7",
     await contagem(page, "identificacao"));
  const prof = page.locator('[data-ficha] [data-campo="ocupacao"]');
  if (await prof.count()) await prof.first().fill("Costureira autônoma");
  ok("salvei outro campo", await salvar(page));
  ok("e o pedido leva só a profissão — nenhuma senha vazia vai ao Vantoro",
     patches.length === 1 && Object.keys(patches[0] || {}).join(",") === "ocupacao", JSON.stringify(patches));
  await ctx.close();
}

// ==================================================================
console.log("\n5. Uma senha veio e a outra não: cada uma com o seu desenho");
{
  const { ctx, page, patches } = await abrirFicha({ ...BASE, senha_serasa: "serasa-da-andreia" });
  ok("a SERASA, que veio, é campo de escrever com a senha",
     (await valorDe(page, "senha_serasa")) === "serasa-da-andreia", String(await valorDe(page, "senha_serasa")));
  ok("a GOV, que não veio, é a caixa cinza",
     (await page.locator('[data-ficha] [data-campo="senha_gov"]').count()) === 0
       && (await page.locator('[data-ficha] [data-campo-ausente="senha_gov"]').count()) === 1);
  ok("e a conta tira só a GOV (4/8)", (await contagem(page, "identificacao")) === "4/8",
     await contagem(page, "identificacao"));
  const serasa = page.locator('[data-ficha] [data-campo="senha_serasa"]');
  if (await serasa.count()) await serasa.first().fill("serasa-nova");
  ok("salvei", await salvar(page));
  ok("o pedido leva só a SERASA",
     patches.length === 1 && Object.keys(patches[0] || {}).join(",") === "senha_serasa"
       && patches[0].senha_serasa === "serasa-nova", JSON.stringify(patches));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
