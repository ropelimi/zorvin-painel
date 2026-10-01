// AS OBSERVAÇÕES DO CADASTRO, NA FICHA DO ZORVIN
//
// Pedido do Rodrigo em 30/09: *"Na 'Ficha do Vantoro', no Zorvin, precisa
// aparecer as 'Observações' também"*. O Vantoro já mandava o campo e já
// aceitava gravá-lo; o Zorvin não o desenhava.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. as observações aparecem, À VISTA (seção aberta, logo depois da
//      identificação) e INTEIRAS — com as quebras de linha;
//   2. editar e salvar manda SÓ o campo mudado, com as quebras de linha;
//   3. salvar outro campo NÃO mexe nas observações;
//   4. o cadastro que chega SEM a chave não vira caixa vazia — porque o que
//      se digitasse ali apagaria no Vantoro o texto que não chegou;
//   5. o cadastro com observações vazias continua editável.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const OBS = "Cliente prefere contato à tarde.\nJá pagou a 1ª parcela do acordo.";
const BASE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
               telefone: "5567992183107", telefone2: "", ocupacao: "Costureira",
               documentos: 0, processos: [], ordem_servico: null };

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

const caixa = (page) => page.locator('[data-campo="observacoes"]');
const valor = async (page) => (await caixa(page).count()) ? await caixa(page).inputValue() : null;
/** Salva pelo botão da ficha. Guardado: clique em elemento que não existe
 *  estoura a prova inteira e esconde QUAL conferência pegou o defeito. */
async function salvar(page) {
  const b = page.getByRole("button", { name: /Salvar no Vantoro/ });
  if (!(await b.count())) return false;
  await b.first().click();
  await page.waitForTimeout(1500);
  return true;
}

// ==================================================================
console.log("\nAs observações aparecem, à vista e inteiras");
{
  const { ctx, page, estouros } = await abrirFicha({ ...BASE, observacoes: OBS });
  ok("a ficha abriu com a cliente", /ANDREIA CRISTINA MARTINS/.test(await page.locator("body").innerText()));
  ok("a caixa das observações está na tela", (await caixa(page).count()) === 1 && await caixa(page).isVisible());
  ok("com o texto inteiro, quebra de linha incluída", (await valor(page)) === OBS, JSON.stringify(await valor(page)));
  ok("é uma caixa de várias linhas, e não um campo de uma linha",
     (await caixa(page).evaluate((n) => n.tagName).catch(() => "")) === "TEXTAREA");
  const secoes = await page.$$eval("[data-secao]", (ns) => ns.map((n) => n.getAttribute("data-secao")));
  ok("a seção vem logo depois da identificação", secoes[0] === "identificacao" && secoes[1] === "observacoes",
     secoes.join(","));
  ok("e diz que está preenchida (1/1)",
     /1\/1/.test(await page.locator('[data-secao="observacoes"]').innerText().catch(() => "")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nEditar e salvar manda só as observações, com as quebras de linha");
{
  const { ctx, page, patches } = await abrirFicha({ ...BASE, observacoes: OBS });
  const novo = OBS + "\nPediu para ligar só depois das 14h.";
  if (await caixa(page).count()) await caixa(page).fill(novo);
  ok("salvei", await salvar(page));
  ok("um pedido de gravação foi ao Vantoro", patches.length === 1, `foram ${patches.length}`);
  ok("só com as observações", patches[0] && Object.keys(patches[0]).join(",") === "observacoes",
     JSON.stringify(patches[0]));
  ok("com o texto inteiro, quebras de linha incluídas", patches[0]?.observacoes === novo,
     JSON.stringify(patches[0]?.observacoes));
  ok("e a tela mostra o que ficou gravado", (await valor(page)) === novo);
  await ctx.close();
}

// ==================================================================
console.log("\nSalvar outro campo não mexe nas observações");
{
  const { ctx, page, patches } = await abrirFicha({ ...BASE, observacoes: OBS });
  const prof = page.locator('[data-campo="ocupacao"]');
  if (await prof.count()) await prof.fill("Costureira autônoma");
  ok("salvei", await salvar(page));
  ok("o pedido leva só a profissão", patches[0] && Object.keys(patches[0]).join(",") === "ocupacao",
     JSON.stringify(patches[0]));
  ok("e as observações continuam na tela", (await valor(page)) === OBS);
  await ctx.close();
}

// ==================================================================
console.log("\nO cadastro que chega sem a chave não vira caixa vazia");
{
  const { ctx, page, patches } = await abrirFicha({ ...BASE });
  ok("não há caixa para escrever", (await caixa(page).count()) === 0);
  ok("e a ficha diz por quê", (await page.locator('[data-campo-ausente="observacoes"]').count()) === 1);
  const prof = page.locator('[data-campo="ocupacao"]');
  if (await prof.count()) await prof.fill("Costureira autônoma");
  await salvar(page);
  ok("salvar outro campo não manda observações vazias ao Vantoro",
     patches.length === 1 && !Object.prototype.hasOwnProperty.call(patches[0] || {}, "observacoes"),
     JSON.stringify(patches));
  await ctx.close();
}

// ==================================================================
console.log("\nCadastro com observações vazias continua editável");
{
  const { ctx, page, patches } = await abrirFicha({ ...BASE, observacoes: "" });
  ok("a caixa está lá, vazia", (await valor(page)) === "");
  ok("e diz que falta preencher (0/1)",
     /0\/1/.test(await page.locator('[data-secao="observacoes"]').innerText().catch(() => "")));
  if (await caixa(page).count()) await caixa(page).fill("Primeira observação.");
  await salvar(page);
  ok("a primeira observação vai ao Vantoro", patches[0]?.observacoes === "Primeira observação.",
     JSON.stringify(patches));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
