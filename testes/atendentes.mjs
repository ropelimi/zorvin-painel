// FILTRAR POR QUEM PARTICIPOU DA CONVERSA.
//
// "Participei" é: em algum momento eu escrevi alguma coisa ali. Quem divide os
// mesmos telefones com o escritório inteiro não tinha nenhum jeito de achar de
// volta as suas conversas.
//
// A montagem é o exemplo do relato, literal. Duas conversas no mesmo telefone:
// na da MARIA falaram RODRIGO e JENIFER; na do JOÃO falaram RODRIGO e ISABELA.
// É a menor montagem que separa os dois modos do filtro — com uma conversa só,
// ou com as mesmas pessoas nas duas, "qualquer um" e "todos juntos" dariam a
// mesma resposta e o teste não mediria nada.
//
// E um segundo telefone, o ANTIGO, em que o filtro não aparecia: o histórico
// dele é todo anterior à coluna `enviado_por_id`, então a lista de atendentes
// vinha vazia e a tela escondia o botão.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const PAGINA = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(PAGINA);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1800);

const botao = page.locator('[data-grupo="quem"]');
const rastro = page.locator("[data-filtro-quem]");
// O ATRIBUTO, e não o texto do cartão. `allTextContents` devolve a linha
// inteira desenhada ("MFMARIA18/08Conversa do filtro..."), com as iniciais do
// avatar grudadas na frente — comparar isso com o nome nunca bateria, e a falha
// falaria do teste, não da tela.
const nomesNaTela = () =>
  page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome") || ""));

/** Abre o menu, escolhe o modo e marca exatamente estas pessoas. */
async function filtrar(pessoas, modo) {
  await botao.click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: modo === "todos" ? "Todos juntos" : "Qualquer um" }).click();
  await page.waitForTimeout(200);
  // Desmarca o que estiver marcado e marca só o pedido.
  for (const alvo of ["Rodrigo Sousa", "JENIFER ALMEIDA", "ISABELA GUEDES"]) {
    const b = page.locator(`[data-quem="${alvo}"]`);
    if (!(await b.count())) continue;
    const marcado = await b.first().evaluate((el) =>
      el.querySelector("span")?.style.background !== "transparent");
    const quer = pessoas.includes(alvo);
    if (marcado !== quer) { await b.first().click(); await page.waitForTimeout(150); }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1800);
  return nomesNaTela();
}

/** Só os contatos do cenário: a lista tem outras conversas do telefone. */
const doCenario = (nomes) =>
  nomes.filter((n) => /MARIA DO FILTRO|JOAO DO FILTRO|CARLOS ANTIGO/.test(n))
       .map((n) => n.replace(/ DO FILTRO| ANTIGO/, "")).sort();

console.log("\nOnde o botão mora");
{
  ok("o filtro de quem participou aparece", await botao.count() > 0,
     "sem ele não há como filtrar por atendente");

  // O LUGAR IMPORTA, e dá para conferir sem olhar a tela: ele tem de estar na
  // MESMA linha de "Nova conversa" e do "Menu", e ENTRE os dois. Estava na
  // fita de filtros, embaixo da busca, misturado com "Tudo / Não lidas /
  // Favoritas / Etiquetas" — que respondem outra pergunta.
  const ordem = await page.evaluate(() => {
    const b = document.querySelector('[data-grupo="quem"]');
    const nova = document.querySelector('[aria-label="Nova conversa"]');
    const menu = document.querySelector('[aria-label="Menu"]');
    if (!b || !nova || !menu) return null;
    const linha = nova.parentElement;
    const mesmaLinha = linha.contains(b) && linha.contains(menu);
    // `compareDocumentPosition` & FOLLOWING = "o segundo vem depois do primeiro".
    const depoisDaNova = !!(nova.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const antesDoMenu  = !!(b.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { mesmaLinha, depoisDaNova, antesDoMenu };
  });
  ok("fica na barra de cima, entre Nova conversa e Menu",
     !!(ordem && ordem.mesmaLinha && ordem.depoisDaNova && ordem.antesDoMenu),
     `posição: ${JSON.stringify(ordem)}`);

  await botao.click();
  await page.waitForTimeout(400);
  const texto = await page.locator("body").innerText();
  // Sem rótulo no botão, é o menu que diz o que ele é.
  ok("o menu se apresenta", /Quem participou da conversa/i.test(texto),
     "um ícone sozinho não diz o que filtra");
  ok("e explica a diferença entre os dois modos", /pelo menos UMA/i.test(texto),
     "marcar duas pessoas sem saber qual regra vale faz o resultado parecer aleatório");
  ok("e mostra quantas conversas cada pessoa tem",
     await page.locator('[data-quem="Rodrigo Sousa"]').count() > 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("\nO exemplo do relato");
{
  const so_rodrigo = doCenario(await filtrar(["Rodrigo Sousa"], "qualquer"));
  ok("RODRIGO sozinho traz as duas conversas dele",
     JSON.stringify(so_rodrigo) === JSON.stringify(["JOAO", "MARIA"]),
     `veio: ${JSON.stringify(so_rodrigo)}`);

  const so_isabela = doCenario(await filtrar(["ISABELA GUEDES"], "qualquer"));
  ok("ISABELA sozinha traz só a conversa do JOÃO",
     JSON.stringify(so_isabela) === JSON.stringify(["JOAO"]),
     `veio: ${JSON.stringify(so_isabela)}`);

  const juntos = doCenario(await filtrar(["Rodrigo Sousa", "JENIFER ALMEIDA"], "todos"));
  ok("RODRIGO + JENIFER, todos juntos, traz só a da MARIA",
     JSON.stringify(juntos) === JSON.stringify(["MARIA"]),
     `veio: ${JSON.stringify(juntos)} — é a única em que os dois falaram`);

  const qualquer = doCenario(await filtrar(["Rodrigo Sousa", "JENIFER ALMEIDA"], "qualquer"));
  ok("e, qualquer um deles, traz as duas (mais a antiga da JENIFER)",
     qualquer.includes("MARIA") && qualquer.includes("JOAO"),
     `veio: ${JSON.stringify(qualquer)}`);

  const nunca = doCenario(await filtrar(["JENIFER ALMEIDA", "ISABELA GUEDES"], "todos"));
  ok("JENIFER + ISABELA, todos juntos, não traz nenhuma",
     nunca.length === 0,
     `veio: ${JSON.stringify(nunca)} — elas nunca falaram na mesma conversa`);
}

console.log("\nO rastro de que o filtro está ligado");
{
  // O botão subiu para o topo; a lista fica embaixo. Filtro ligado longe da
  // lista é a receita da lista misteriosamente curta — some conversa e não há
  // nada na tela dizendo por quê. Por isso o rastro na fita de filtros.
  await filtrar(["Rodrigo Sousa", "JENIFER ALMEIDA"], "todos");
  ok("ligado, ele deixa um rastro na fita de filtros", await rastro.count() > 0,
     "sem isso a lista encolhe sem explicação");
  const t = (await rastro.innerText()).replace(/\s+/g, " ");
  // UM NOME E QUANTOS FALTAM, e não "2 pessoas". Com dois marcados a pílula
  // não cabe os dois inteiros; um nome de verdade mais o "+1" diz mais do que
  // uma contagem sozinha, e o nome que aparece é o primeiro que se marcou.
  ok("o rastro diz QUEM está marcado", /Rodrigo|JENIFER/i.test(t), `dizia: "${t}"`);
  ok("e avisa que há mais de um", /\+1/.test(t), `dizia: "${t}"`);
  ok("e diz qual das duas regras está valendo", /juntos/i.test(t), `dizia: "${t}"`);

  // Visível de verdade, e não só presente no DOM.
  const cabe = await rastro.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.height > 10 && r.top >= 0;
  });
  ok("e está visível na tela", cabe);

  const antes = (await nomesNaTela()).length;
  await page.getByRole("button", { name: "Tirar o filtro de quem participou" }).click();
  await page.waitForTimeout(1500);
  const depois = (await nomesNaTela()).length;
  ok("o × do rastro desliga o filtro", await rastro.count() === 0);
  ok("e a lista volta a crescer", depois > antes, `${antes} antes, ${depois} depois`);
}

console.log("\nO histórico antigo, que não tem o id de quem escreveu");
{
  // A coluna `enviado_por_id` é recente. Procurando só por ela, "as conversas
  // em que eu participei" começaria no dia em que ela foi criada.
  const jenifer = doCenario(await filtrar(["JENIFER ALMEIDA"], "qualquer"));
  ok("acha também a conversa antiga, casando pelo nome",
     jenifer.includes("CARLOS"),
     `veio: ${JSON.stringify(jenifer)} — a mensagem do CARLOS foi assinada `
     + '"jenifer almeida", em minúscula e sem id');
}

console.log("\nLimpar devolve a lista");
{
  await botao.click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Limpar a escolha" }).click();
  await page.waitForTimeout(1800);
  const todas = await nomesNaTela();
  ok("limpar a escolha devolve a lista inteira", todas.length > 5, `ficaram ${todas.length}`);
}

console.log("\nO telefone antigo — onde o filtro não aparecia");
{
  // O relato: "existem alguns telefones em que não apareceu essa opção". Era
  // este caso. Todo o histórico deste número é anterior à coluna
  // `enviado_por_id`, então a lista de atendentes vinha vazia — e a tela, que
  // só mostrava o botão com mais de um nome, escondia o filtro inteiro.
  await page.locator('[data-telefone="Acordos 2"]').first().click();
  await page.waitForTimeout(2200);
  ok("o filtro aparece também no telefone antigo", await botao.count() > 0,
     "é o número em que ele sumia");

  await botao.click();
  await page.waitForTimeout(600);
  const nomes = await page.locator("[data-quem]").evaluateAll(
    (ns) => ns.map((n) => n.getAttribute("data-quem")));
  ok("e a lista traz quem escreveu, achado pelo NOME",
     nomes.includes("Rodrigo Sousa") && nomes.includes("JENIFER ALMEIDA"),
     `veio: ${JSON.stringify(nomes)} — nenhuma dessas mensagens tem id`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

console.log("\nSem a função no banco");
{
  // O código vai para o ar antes do script — sempre vai. Nesse intervalo a tela
  // não pode mostrar um filtro que não filtra nada.
  // `addInitScript` e não `evaluate`: a bandeira precisa existir ANTES de a
  // página montar, e `globalThis` é zerado a cada recarregamento — posta
  // depois, ela some justamente no recarregamento que deveria exercitá-la.
  await page.addInitScript(() => { globalThis.__SEM_FILTRO_DE_ATENDENTE = true; });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1800);
  ok("sem a função, o botão nem aparece", await botao.count() === 0,
     "um filtro que não filtra é pior do que filtro nenhum");
  ok("e a lista continua inteira", (await nomesNaTela()).length > 5);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
