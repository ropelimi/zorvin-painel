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

const pilula = page.locator('[data-grupo="quem"]');
// O ATRIBUTO, e não o texto do cartão. `allTextContents` devolve a linha
// inteira desenhada ("MFMARIA18/08Conversa do filtro..."), com as iniciais do
// avatar grudadas na frente — comparar isso com o nome nunca bateria, e a falha
// falaria do teste, não da tela.
const nomesNaTela = () =>
  page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome") || ""));

/** Abre o menu, escolhe o modo e marca exatamente estas pessoas. */
async function filtrar(pessoas, modo) {
  await pilula.click();
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

console.log("\nO filtro existe e diz o que faz");
{
  ok("a pílula de quem participou aparece", await pilula.count() > 0,
     "sem ela não há como filtrar por atendente");
  await pilula.click();
  await page.waitForTimeout(400);
  const texto = await page.locator("body").innerText();
  ok("o menu explica a diferença entre os dois modos",
     /pelo menos UMA/i.test(texto),
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
  await pilula.click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Limpar a escolha" }).click();
  await page.waitForTimeout(1800);
  const todas = await nomesNaTela();
  ok("limpar a escolha devolve a lista inteira", todas.length > 5, `ficaram ${todas.length}`);
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
  ok("sem a função, a pílula nem aparece", await pilula.count() === 0,
     "um filtro que não filtra é pior do que filtro nenhum");
  ok("e a lista continua inteira", (await nomesNaTela()).length > 5);

}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
