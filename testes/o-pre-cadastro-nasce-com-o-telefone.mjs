// O PRÉ-CADASTRO NASCE COM O TELEFONE, E A FICHA NÃO REPETE CHAVE
// (auditoria de 28/10)
//
// 1. O PRÉ-CADASTRO RECÉM-CRIADO APARECIA SEM TELEFONE. `criar()` não
//    chamava `setTelefones`, embora o POST do Vantoro devolva
//    `cliente.telefones` (o Vantoro espelha o `telefone` na lista ao gravar).
//    A seção "Telefones" ficava vazia logo depois de criar, e o
//    "+ Acrescentar" conferia a duplicata contra a lista vazia: o número da
//    própria conversa ia de novo ao Vantoro como se fosse outro. Idem no
//    "Já existia no Vantoro".
//
// 2. AS LISTAS DA FICHA SEM CHAVE ÚNICA. Com a ficha aberta, o console do
//    React dizia "Each child in a list should have a unique key prop" (o
//    bloco dos telefones entra na lista dos campos da Identificação sem
//    `key`) — com o cadastro como o Vantoro de hoje manda — e "Encountered
//    two children with the same key" (os telefones de um Vantoro de antes da
//    lista, sem `id`, todos com a chave `null`). Chave repetida faz o React
//    duplicar ou sumir com linhas: aviso de console que é defeito.
//
// O QUE ESTA PROVA GUARDA:
//   - criado o pré-cadastro, a seção "Telefones" mostra o número da conversa,
//     e acrescentar esse mesmo número diz que ele já está lá, sem ir ao
//     Vantoro; no "Já existia", a ficha mostra os telefones do cadastro;
//   - o console não reclama de chave da ficha, nem com o cadastro de hoje
//     nem com o de um Vantoro antigo (sem `telefones`, com dois números).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

/** Os dígitos como o Vantoro guarda (`normalizar_telefone`): sem o 55. */
const doVantoro = (n) => { const d = String(n || "").replace(/\D/g, ""); return d.length > 11 && d.startsWith("55") ? d.slice(2) : d; };
const linha = (id, numero, principal) => ({ id, numero, digitos: doVantoro(numero), principal, proprio: true,
                                            dono: "", observacao: "", usado_por: [] });

const nav = await abrirNavegador();

/** `cadastro(telefone)` decide o que a ficha acha ao abrir (null = nenhum);
 *  `criar(corpo)` decide a resposta do POST do pré-cadastro. */
async function abrir({ cadastro = () => null, criar = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  // OS AVISOS DO REACT SOBRE CHAVE, que só aparecem no console.
  const chaves = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/key/.test(t) && /FichaVantoro/.test(t)) chaves.push(t.replace(/\s+/g, " ").slice(0, 160));
  });
  const criados = [];
  const acrescimos = [];
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    const json = (corpo, status = 200) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) }).catch(() => {});
    if (url.pathname.endsWith("/vantoro/status")) return json({ ok: true, configurado: true });
    if (url.pathname.endsWith("/vantoro/cliente") && req.method() === "POST") {
      let corpo = {};
      try { corpo = JSON.parse(req.postData() || "{}"); } catch (_) { /* vazio */ }
      criados.push(corpo);
      return json({ ok: true, ...criar(corpo) });
    }
    if (url.pathname.endsWith("/vantoro/cliente")) {
      const achado = cadastro(url.searchParams.get("telefone") || "");
      return json({ clientes: achado ? [achado] : [], opcoes: {} });
    }
    if (/\/vantoro\/cliente\/[^/]+\/telefones$/.test(url.pathname) && req.method() === "POST") {
      acrescimos.push(req.postData() || "");
      return json({ ok: true, telefones: [] });
    }
    return json({ ok: true });
  });
  await page.addInitScript(() => {
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros, chaves, criados, acrescimos };
}
async function clicar(loc, espera = 300) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await new Promise((r) => setTimeout(r, espera));
  return true;
}
async function abrirConversa(page, seletor) {
  await clicar(page.locator(seletor), 1600);
  if (!(await page.locator("[data-ficha]").count())) await clicar(page.locator("[data-abrir-ficha]"), 1200);
  await page.waitForTimeout(400);
}
const telefonesNaFicha = (page) => page.locator("[data-telefone-do-cliente]")
  .evaluateAll((els) => els.map((e) => e.getAttribute("data-telefone-do-cliente")));
const filme = (page) => page.evaluate(() => (globalThis.__AVISOS_VISTOS || []).join(" | "));

// ==================================================================
console.log("\n1. Criado o pré-cadastro, a ficha mostra o telefone da conversa");
{
  // O POST COMO O VANTORO DE HOJE RESPONDE: o cadastro novo já com a lista,
  // onde o `telefone` mandado entrou como principal.
  const { ctx, page, estouros, chaves, criados, acrescimos } = await abrir({
    criar: (corpo) => ({ criado: true, tarefa_cadastro: false, cliente: {
      id: 901, nome: corpo.nome, cpf: corpo.cpf || "", telefone: corpo.telefone, telefone2: "",
      telefones: [linha(7001, corpo.telefone, true)], observacoes: "", senha_gov: "", senha_serasa: "",
      documentos: 0, processos: [], ordem_servico: null } }),
  });
  await abrirConversa(page, '[data-conversa-nome*="Deus"]');
  ok("a conversa não tem cadastro, e o pré-cadastro aparece", (await page.locator("[data-papel]").count()) === 2);
  await clicar(page.getByRole("button", { name: /Criar pré-cadastro/ }), 1800);
  ok("o pré-cadastro foi pedido ao Vantoro", criados.length === 1, q(criados));
  const numero = (criados[0] || {}).telefone || "";
  const tels = await telefonesNaFicha(page);
  ok("a seção Telefones mostra o número da conversa", tels.length === 1 && tels[0] === doVantoro(numero),
     `${q(tels)} (esperava ${doVantoro(numero)})`);

  // O MESMO NÚMERO, escrito à mão como uma pessoa escreve: a ficha diz que
  // já está lá, e não manda ao Vantoro.
  const d = doVantoro(numero);
  const escrito = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  await page.locator("[data-novo-telefone]").fill(escrito);
  await clicar(page.locator("[data-acrescentar-telefone]"), 1200);
  ok("acrescentar o número da conversa não vai ao Vantoro", acrescimos.length === 0, q(acrescimos));
  ok("e a ficha diz que ele já está nela", /já está nesta ficha/.test(await filme(page)), await filme(page));
  ok("o console não reclama de chave na ficha (cadastro de hoje)", chaves.length === 0, q(chaves.slice(0, 2)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. “Já existia no Vantoro”: a ficha mostra os telefones do cadastro");
{
  const { ctx, page, criados } = await abrir({
    criar: (corpo) => ({ criado: false, tarefa_cadastro: false, cliente: {
      id: 902, nome: "MARIA JA EXISTIA", cpf: "", telefone: corpo.telefone, telefone2: "(67) 99888-1234",
      telefones: [linha(7101, corpo.telefone, true), linha(7102, "(67) 99888-1234", false)],
      observacoes: "", documentos: 0, processos: [], ordem_servico: null } }),
  });
  await abrirConversa(page, '[data-conversa-nome*="Deus"]');
  await clicar(page.getByRole("button", { name: /Criar pré-cadastro/ }), 1800);
  ok("o pré-cadastro foi pedido ao Vantoro", criados.length === 1);
  ok("o aviso diz que já existia", /Já existia no Vantoro/.test(await filme(page)), await filme(page));
  const tels = await telefonesNaFicha(page);
  ok("a ficha mostra os dois telefones do cadastro", tels.length === 2 && tels.includes("67998881234"), q(tels));
  await ctx.close();
}

// ==================================================================
console.log("\n3. A ficha de um Vantoro antigo, sem a lista, não repete chave");
{
  // O VANTORO DE ANTES DO #228: `telefone` e `telefone2`, sem `telefones`.
  // A ficha monta a lista sozinha, e as linhas não têm `id`.
  const ANTIGO = { id: "v-300", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
                   telefone: "5567992183107", telefone2: "(67) 99888-7777", observacoes: "",
                   documentos: 1, processos: [{ id: "p0", tipo_acao: "Revisional", situacao: "Em andamento" }],
                   ordem_servico: { status: "EM ANDAMENTO", pendencias: [{ id: 1, titulo: "Documentos" }] } };
  const { ctx, page, estouros, chaves } = await abrir({ cadastro: () => ANTIGO });
  await abrirConversa(page, '[data-conversa-nome*="Deus"]');
  const tels = await telefonesNaFicha(page);
  ok("a ficha mostra os dois números do cadastro antigo", tels.length === 2, q(tels));
  ok("e o console não reclama de chave na ficha", chaves.length === 0, q(chaves.slice(0, 2)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
