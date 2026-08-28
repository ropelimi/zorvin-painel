// PROVA DO PAINEL — Playwright contra a bancada.
//
// O que a bancada garante e o que este teste cobra são coisas diferentes:
//
//   A BANCADA entrega o resultado CERTO (ela agrega o roteiro de atendimentos
//   que ela mesma escreveu). A lógica de "o que é um atendimento" é provada
//   onde ela roda de verdade: num Postgres, em /tmp/pgdash/prova.sql.
//
//   ESTE TESTE cobra da TELA que ela mostre exatamente o que recebeu — nos
//   cartões, nos gráficos, nas tabelas —, que os quatro filtros recortem, que
//   quem não administra não consiga sair do próprio recorte, e que os gráficos
//   e as tabelas contem a mesma história.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const URL = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, detalhe = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? " — " + detalhe : ""}`); }
};

/** Só os dígitos de um texto, como número. "1.234" -> 1234 */
const so = (t) => Number(String(t || "").replace(/[^\d]/g, "")) || 0;

async function abrirPainel(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Painel" }).click();
  await page.waitForSelector('[data-tela="painel"]');
  await page.waitForSelector('[data-teste="escopo"]', { timeout: 15000 });
}

/** Lê um cartão de número pelo rótulo.
 *  Pelo `data-cartao`, e não caminhando pelo DOM: a primeira versão procurava
 *  "o div sem filhos cujo texto é a etiqueta" e pegava outro elemento assim que
 *  o rótulo ganhou um ícone de ajuda — devolvia 0 e 4112836 com cara de leitura
 *  legítima, e três conferências passaram comparando zero com zero. */
async function cartao(page, etiqueta) {
  const el = page.locator(`[data-cartao="${etiqueta}"] [data-valor]`);
  if (!(await el.count())) return null;
  return so(await el.first().innerText());
}

/** Escolhe um atalho de período no seletor. */
async function periodo(page, rotulo) {
  await page.locator('[data-teste="abrir-periodo"]').click();
  await page.waitForSelector('[data-grupo="periodo"]');
  await page.locator('[data-grupo="periodo"]').getByRole("button", { name: rotulo, exact: true }).click();
  await page.waitForTimeout(600);
}

/** Escolhe uma opção num dos filtros de lista (atendente, telefone, …). */
async function filtrar(page, grupo, rotulo) {
  await page.locator(`[data-grupo="${grupo}"] > button`).click();
  await page.waitForTimeout(200);
  await page.locator(`[data-grupo="${grupo}"]`).getByRole("button", { name: rotulo }).first().click();
  await page.waitForTimeout(600);
}

/** Troca um gráfico para a tabela e devolve as linhas. */
async function tabelaDoGrafico(page, titulo) {
  return page.evaluate((t) => {
    const h = [...document.querySelectorAll('[data-tela="painel"] h3')]
      .find((x) => x.textContent.trim() === t);
    const cartao = h.parentElement.nextElementSibling;
    const botao = [...cartao.querySelectorAll("button")].find((b) => /Tabela|Mapa/.test(b.textContent));
    if (botao && /Tabela/.test(botao.textContent)) botao.click();
    return true;
  }, titulo).then(() => page.waitForTimeout(150)).then(() => page.evaluate((t) => {
    const h = [...document.querySelectorAll('[data-tela="painel"] h3')]
      .find((x) => x.textContent.trim() === t);
    const tab = h.parentElement.nextElementSibling.querySelector("table");
    if (!tab) return [];
    return [...tab.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
  }, titulo));
}

// O Chromium do ambiente, e não o que o pacote baixaria: aqui a versão
// instalada é a 1194 e o pacote procura a dele.
const navegador = await abrirNavegador();

// ==================================================================
//  1. ADMINISTRADOR — vê o escritório, e pode se recortar
// ==================================================================
{
  console.log("\n1. Quem administra");
  const ctx = await navegador.newContext({ viewport: { width: 1320, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await abrirPainel(page);
  await periodo(page, "30 dias");

  const esperado = await page.evaluate(() => globalThis.__ESPERADO.painel(30, null));
  const eu = await page.evaluate(() => globalThis.__ESPERADO.eu);

  ok("mostra que os números são do escritório",
     /escritório inteiro/i.test(await page.locator('[data-teste="escopo"]').innerText()));

  ok("atendimentos batem com a bancada",
     await cartao(page, "Atendimentos") === esperado.total.atendimentos,
     `tela ${await cartao(page, "Atendimentos")} × bancada ${esperado.total.atendimentos}`);
  ok("recebidas batem", await cartao(page, "Recebidas") === esperado.total.recebidas);
  ok("enviadas batem", await cartao(page, "Enviadas") === esperado.total.enviadas);
  ok("notas internas batem", await cartao(page, "Notas internas") === esperado.total.notas);

  // A SOMA DO GRÁFICO TEM DE DAR O CARTÃO. Um gráfico que não fecha com o
  // número em cima dele é pior do que gráfico nenhum: os dois estão na mesma
  // tela, e um desmente o outro.
  const serie = await tabelaDoGrafico(page, "Atendimentos por período");
  const somaSerie = serie.reduce((s, l) => s + so(l[1]), 0);
  ok("a soma do gráfico por período dá o total do cartão",
     somaSerie === esperado.total.atendimentos, `gráfico ${somaSerie} × cartão ${esperado.total.atendimentos}`);
  ok("o gráfico traz os dias em zero também", serie.length >= 28, `só ${serie.length} colunas`);

  const msgs = await tabelaDoGrafico(page, "Mensagens por período");
  ok("a soma das recebidas no gráfico dá o cartão",
     msgs.reduce((s, l) => s + so(l[1]), 0) === esperado.total.recebidas);
  ok("a soma das enviadas no gráfico dá o cartão",
     msgs.reduce((s, l) => s + so(l[2]), 0) === esperado.total.enviadas);

  const mapa = await tabelaDoGrafico(page, "Atendimentos por horário");
  ok("o mapa de horários tem os sete dias", mapa.length === 7, `veio ${mapa.length}`);
  ok("a soma do mapa de horários dá o total",
     mapa.reduce((s, l) => s + so(l[5]), 0) === esperado.total.atendimentos);

  // O TELEFONE PARADO PRECISA APARECER. É a informação mais útil da tabela.
  const mudo = await page.evaluate(() => globalThis.__ESPERADO.telefoneMudo);
  ok(`o telefone mudo ("${mudo}") continua na lista`,
     (await page.locator('[data-tela="painel"]').innerText()).includes(mudo));

  const linhaEu = page.locator(`[data-atendente="${eu.nome}"]`);
  ok("apareço no ranking de atendentes", await linhaEu.count() > 0);
  ok("a minha linha vem marcada com “você”", /você/i.test(await linhaEu.first().innerText()));
  const outro = await page.evaluate(() => globalThis.__ESPERADO.outroAutor);
  ok(`o colega ("${outro}") também aparece`,
     await page.locator(`[data-atendente="${outro}"]`).count() > 0);

  // NINGUÉM DUAS VEZES. É o defeito que já apareceu de verdade no banco ("Max
  // Canaverde" em duas linhas) e que voltou aqui na primeira olhada na tela.
  const nomes = await page.locator("[data-atendente]").evaluateAll(
    (ns) => ns.map((n) => n.getAttribute("data-atendente")));
  const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i);
  ok("nenhum atendente aparece duas vezes", !repetido, `“${repetido}” repetido`);

  ok("o tempo de resposta traz um número", /\d/.test(
     await page.locator('[data-cartao="Tempo de resposta"] [data-valor]').innerText()));
  ok("o tempo para atender traz um número", /\d/.test(
     await page.locator('[data-cartao="Tempo para atender"] [data-valor]').innerText()));

  // A situação tem de fechar com o total: todo atendimento está num dos três
  // estados, e em um só.
  const sit = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[data-tela="painel"] div')]
      .find((x) => x.textContent.trim() === "Situação dos atendimentos");
    return t.parentElement.innerText;
  });
  const tres = (sit.match(/\n(\d+)\s/g) || []).map((x) => Number(x.trim()));
  ok("aguardando + em andamento + encerrados dá o total de atendimentos",
     tres.length === 3 && tres.reduce((a, b) => a + b, 0) === esperado.total.atendimentos,
     `${tres.join(" + ")} × ${esperado.total.atendimentos}`);

  // A leitura ao passar o mouse.
  const primeiraColuna = page.locator('[data-tela="painel"] [tabindex="0"]').first();
  await primeiraColuna.hover();
  await page.waitForTimeout(150);
  ok("passar o mouse na coluna mostra o dia e o número",
     await page.locator('[data-teste="leitura"]').count() > 0);

  const texto = await page.locator('[data-tela="painel"]').innerText();
  ok("diz quantas mensagens saíram pelo aparelho", /pelo aparelho|ressalva/i.test(texto));
  ok("explica o que é um atendimento", /6 horas/.test(texto));

  await ctx.close();
}

// ==================================================================
//  2. OS FILTROS
// ==================================================================
{
  console.log("\n2. Os filtros");
  const ctx = await navegador.newContext({ viewport: { width: 1320, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await abrirPainel(page);
  await periodo(page, "30 dias");

  const eu = await page.evaluate(() => globalThis.__ESPERADO.eu);
  const tudo = await cartao(page, "Atendimentos");

  // ---- por ATENDENTE ----
  const meu = await page.evaluate((id) => globalThis.__ESPERADO.painel(30, id), eu.id);
  await filtrar(page, "escopo", eu.nome);
  ok("filtrar por atendente muda os números",
     await cartao(page, "Atendimentos") === meu.total.atendimentos,
     `tela ${await cartao(page, "Atendimentos")} × bancada ${meu.total.atendimentos}`);
  ok("a tela avisa que está recortada em mim",
     /seus números/i.test(await page.locator('[data-teste="escopo"]').innerText()));
  // O RANKING NÃO SE RECORTA. É para isso que ele existe.
  const outro = await page.evaluate(() => globalThis.__ESPERADO.outroAutor);
  ok("o ranking continua trazendo o colega mesmo no recorte",
     await page.locator(`[data-atendente="${outro}"]`).count() > 0);
  // A etiqueta do filtro aplicado, com o X para tirar.
  ok("aparece a etiqueta do filtro aplicado",
     (await page.locator('[data-tela="painel"]').innerText()).includes("Filtrando por:"));
  await page.getByRole("button", { name: "limpar tudo" }).click();
  await page.waitForTimeout(600);
  ok("“limpar tudo” devolve os números do escritório",
     await cartao(page, "Atendimentos") === tudo);

  // ---- por TELEFONE ----
  const tels = await page.evaluate(() => globalThis.__ESPERADO.telefones);
  const alvo = tels.find((t) => t.nome === "Comercial");
  const soTel = await page.evaluate((id) => globalThis.__ESPERADO.painel(30, null, id), alvo.id);
  await filtrar(page, "telefone", alvo.nome);
  ok(`filtrar pelo telefone "${alvo.nome}" recorta`,
     await cartao(page, "Atendimentos") === soTel.total.atendimentos,
     `tela ${await cartao(page, "Atendimentos")} × bancada ${soTel.total.atendimentos}`);
  ok("e o recorte é MENOR que o escritório inteiro", soTel.total.atendimentos < tudo);
  // A tabela por telefone passa a mostrar só o telefone escolhido: linhas
  // zeradas de telefones que a tela já excluiu seriam ruído.
  const linhasTel = await page.locator("[data-telefone-linha]").count();
  ok("a tabela por telefone mostra só o telefone filtrado", linhasTel === 1, `veio ${linhasTel}`);
  await page.getByRole("button", { name: "limpar tudo" }).click();
  await page.waitForTimeout(600);

  // ---- por DEPARTAMENTO ----
  const deps = await page.evaluate(() => globalThis.__ESPERADO.departamentos);
  const dep = deps.find((x) => x.nome === "Sucesso do Cliente");
  const soDep = await page.evaluate((id) => globalThis.__ESPERADO.painel(30, null, null, String(id)), dep.id);
  await filtrar(page, "departamento", dep.nome);
  ok(`filtrar pelo departamento "${dep.nome}" recorta`,
     await cartao(page, "Atendimentos") === soDep.total.atendimentos,
     `tela ${await cartao(page, "Atendimentos")} × bancada ${soDep.total.atendimentos}`);
  ok("o departamento soma mais que um telefone só dele",
     soDep.total.atendimentos > soTel.total.atendimentos || alvo.departamento_id !== dep.id);
  // Só os telefones daquele departamento ficam na tabela.
  const nomesTel = await page.locator("[data-telefone-linha]").evaluateAll(
    (ns) => ns.map((n) => n.getAttribute("data-telefone-linha")));
  const doDep = await page.evaluate((id) => globalThis.__ESPERADO.telefones
    .filter((t) => String(t.departamento_id) === String(id)).map((t) => t.nome), dep.id);
  // DUAS LISTAS VAZIAS SÃO IGUAIS, e `.every()` numa vazia é verdade: sem esta
  // linha, uma tabela que não desenhasse nada passaria por "mostra só os do
  // departamento".
  ok("o departamento escolhido tem telefones para conferir", doDep.length > 0,
     "sem telefone nenhum a conferência abaixo não prova nada");
  ok("a tabela por telefone mostra só os telefones do departamento",
     nomesTel.length === doDep.length && nomesTel.every((n) => doDep.includes(n)),
     `veio ${JSON.stringify(nomesTel)} × esperado ${JSON.stringify(doDep)}`);

  await ctx.close();
}

// ==================================================================
//  3. O PERÍODO
// ==================================================================
{
  console.log("\n3. O período");
  const ctx = await navegador.newContext({ viewport: { width: 1320, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await abrirPainel(page);

  const leia = async (rotulo) => { await periodo(page, rotulo); return cartao(page, "Atendimentos"); };
  const d7 = await leia("7 dias"), d30 = await leia("30 dias"), d90 = await leia("90 dias");
  console.log(`     7=${d7}  30=${d30}  90=${d90}`);
  ok("7 dias < 30 dias", d7 < d30);
  ok("30 dias < 90 dias", d30 < d90);

  const esperado = await page.evaluate(() => globalThis.__ESPERADO.painel(7, null));
  await leia("7 dias");
  ok("os 7 dias batem com a bancada", await cartao(page, "Atendimentos") === esperado.total.atendimentos);

  // "Hoje" e "Ontem" são períodos de um dia, e o rótulo do botão tem de dizer isso.
  await periodo(page, "Hoje");
  ok('o botão passa a dizer "Hoje"',
     /Hoje/.test(await page.locator('[data-teste="abrir-periodo"]').innerText()));
  await periodo(page, "Este mês");
  const mes = await page.locator('[data-teste="abrir-periodo"]').innerText();
  ok("“Este mês” escreve o mês e quantos dias", /\/20\d\d\s·\s\d+\s*dias/.test(mes), mes);

  // A SETINHA ANDA UM MÊS, e não 31 dias — senão ela cairia no meio do mês
  // anterior e o rótulo diria um intervalo em vez de um mês.
  await page.getByRole("button", { name: "Período anterior" }).click();
  await page.waitForTimeout(700);
  const anterior = await page.locator('[data-teste="abrir-periodo"]').innerText();
  ok("a setinha anda de mês em mês", /\/20\d\d\s·\s\d+\s*dias/.test(anterior) && anterior !== mes,
     `${mes} → ${anterior}`);

  // Período longo: o gráfico agrupa em vez de virar 365 colunas de 1 pixel.
  await periodo(page, "Este ano");
  const serie = await tabelaDoGrafico(page, "Atendimentos por período");
  ok("em um ano o gráfico agrupa por semana", serie.length <= 60, `veio ${serie.length}`);

  await ctx.close();
}

// ==================================================================
//  4. QUEM NÃO ADMINISTRA — entra, e não sai do próprio recorte
// ==================================================================
{
  console.log("\n4. Quem não administra");
  const ctx = await navegador.newContext({ viewport: { width: 1320, height: 900 } });
  await ctx.addInitScript(() => { globalThis.__SOU_ADMIN = false; });
  const page = await ctx.newPage();
  await page.goto(URL);
  await abrirPainel(page);
  await periodo(page, "30 dias");

  const eu = await page.evaluate(() => globalThis.__ESPERADO.eu);
  const meu = await page.evaluate((id) => globalThis.__ESPERADO.painel(30, id), eu.id);
  const tudo = await page.evaluate(() => globalThis.__ESPERADO.painel(30, null));

  ok("o Painel aparece no menu para quem não administra", true);
  ok("não existe filtro de atendente", await page.locator('[data-grupo="escopo"]').count() === 0);
  ok("os filtros de lugar continuam existindo",
     await page.locator('[data-grupo="telefone"]').count() === 1);
  ok("os números são os meus", await cartao(page, "Atendimentos") === meu.total.atendimentos,
     `tela ${await cartao(page, "Atendimentos")} × meus ${meu.total.atendimentos}`);
  ok("e NÃO são os do escritório", meu.total.atendimentos !== tudo.total.atendimentos);

  // O RECORTE É DO BANCO. Mesmo pedindo "todo mundo" por fora, a resposta vem
  // recortada — é o que separa recorte de sugestão.
  const forcado = await page.evaluate(async () => {
    const m = await import("/src/supabase.js");
    const { data } = await m.supabase.rpc("painel_dashboard", { p_desde: null, p_quem: null });
    return data.total.atendimentos;
  });
  ok("pedir “todo mundo” por fora não devolve todo mundo",
     forcado === (await page.evaluate((id) => globalThis.__ESPERADO.painel(null, id), eu.id)).total.atendimentos,
     `veio ${forcado}`);

  await ctx.close();
}

// ==================================================================
//  5. SEM O SQL, NENHUM NÚMERO
// ==================================================================
// Errado com cara de certo é pior do que vazio.
{
  console.log("\n5. Banco sem a função");
  const ctx = await navegador.newContext();
  await ctx.addInitScript(() => { globalThis.__TEM_FUNCAO_PAINEL = false; });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Painel" }).click();
  await page.waitForSelector('[data-tela="painel"]');
  await page.waitForTimeout(700);
  const texto = await page.locator('[data-tela="painel"]').innerText();
  ok("diz o que falta rodar", /Falta um passo no banco/i.test(texto));
  ok("diz o nome do arquivo", /2026-08-painel-completo\.sql/.test(texto));
  ok("não mostra cartão de número nenhum",
     await page.locator("[data-cartao]").count() === 0);
  await ctx.close();
}

await navegador.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
