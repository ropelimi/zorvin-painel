// A NOTA INTERNA TEM LUGAR PRÓPRIO, NO ALTO.
//
// Pedido do escritório: "mude o ícone da nota interna lá para cima, perto da
// 'Ficha no Vantoro' e 'Histórico de atendimento'. E ao clicar no ícone da nota,
// o campo de escrever deve aparecer na parte de cima, ao invés de embaixo, para
// não confundir o usuário".
//
// A CONFUSÃO ERA REAL E SÉRIA. A mesma caixa, no mesmo lugar, ora mandava uma
// mensagem para o cliente no WhatsApp, ora guardava um recado interno que só a
// equipe lê. A única diferença era a cor. Quem estivesse com pressa — que é o
// estado normal de quem atende — escrevia no lugar certo achando que era o
// outro, e isso erra nas duas direções: recado da equipe indo para o cliente,
// ou combinado com o cliente ficando só entre nós.
//
// Agora são dois lugares: a nota no alto, colada no cabeçalho de onde se clica;
// a mensagem embaixo, onde sempre esteve. É o lugar, e não a cor, que a mão
// aprende.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1300, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2000);
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(3000);

const CAMPO_NOTA = 'textarea[placeholder*="nota interna"]';
const CAMPO_MSG = 'textarea[placeholder*="Digite uma mensagem"]';

/** Onde uma coisa está na tela, em pixels a partir do topo. */
const onde = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { topo: Math.round(r.top), base: Math.round(r.bottom) };
}, sel);

console.log("\nCom a nota fechada, a tela é a de sempre");
{
  ok("o botão da nota está no cabeçalho", await page.locator("[data-nota-interna]").count() > 0);
  ok("e a caixa de baixo é a de MENSAGEM", await page.locator(CAMPO_MSG).count() > 0);
  ok("não há caixa de nota nenhuma aberta", await page.locator(CAMPO_NOTA).count() === 0);
  // O BOTÃO SAIU DE BAIXO. Deixá-lo nos dois lugares seria pior do que não ter
  // mexido: dois caminhos para o mesmo estado, um deles no meio dos botões de
  // mandar — que é exatamente a companhia que confundia.
  const naBarraDeBaixo = await page.evaluate((s) => {
    const campo = document.querySelector(s);
    if (!campo) return -1;
    const barra = campo.closest("div[style*='display: flex']")?.parentElement;
    return barra ? barra.querySelectorAll("[data-nota-interna]").length : -1;
  }, CAMPO_MSG);
  ok("e o botão da nota NÃO está mais na barra de baixo", naBarraDeBaixo === 0,
     `achei ${naBarraDeBaixo} ali`);
}

console.log("\nClicar no ícone abre a caixa da nota EM CIMA da conversa");
{
  await page.locator("[data-nota-interna]").first().click();
  await page.waitForTimeout(1200);

  ok("o painel da nota apareceu", await page.locator("[data-nota-no-alto]").count() > 0);
  ok("com uma caixa para escrever a nota", await page.locator(CAMPO_NOTA).count() > 0);

  // A CONFERÊNCIA QUE É O PEDIDO INTEIRO: em cima, e não embaixo.
  const nota = await onde(CAMPO_NOTA);
  // O QUADRO DA CONVERSA, e não a primeira bolha. A lista está rolada: a
  // primeira bolha mora a milhares de pixels acima da tela, e comparar com ela
  // mediria a rolagem, não o lugar da caixa.
  const lista = await onde("[data-lista-mensagens]");
  const janela = await page.evaluate(() => window.innerHeight);
  console.log(`     caixa da nota: ${nota?.topo}–${nota?.base}px | conversa começa em: ${lista?.topo}px | janela: ${janela}px`);
  ok("a caixa da nota fica ACIMA das mensagens", nota && lista && nota.base <= lista.topo,
     `nota termina em ${nota?.base}px, a conversa começa em ${lista?.topo}px`);
  ok("e no terço de cima da tela, perto do botão que a abriu",
     nota && nota.topo < janela / 3,
     `a caixa começa em ${nota?.topo}px de ${janela}px`);

  // E A CAIXA DE MENSAGEM SAI DE CENA enquanto a nota está aberta: são a mesma
  // caixa mudando de lugar, e não duas ao mesmo tempo. Duas convidariam a
  // escrever nas duas.
  ok("a caixa de mensagem sai de cena enquanto a nota está aberta",
     await page.locator(CAMPO_MSG).count() === 0);
  // Mas a barra de baixo continua existindo e DIZ onde a caixa foi parar.
  // "A caixa sumiu" é um susto; "a caixa subiu, olhe lá" é uma instrução.
  const rodape = await page.evaluate(() => document.body.innerText);
  ok("e a barra de baixo explica que a caixa subiu",
     /na caixa lá em cima/i.test(rodape), "nada explicando embaixo");
}

console.log("\nA nota escrita ali é gravada como nota, e não como mensagem");
{
  const antesNotas = await page.evaluate(() => (globalThis.__TABELAS.notas || []).length);
  const antesFila = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).length);

  await page.fill(CAMPO_NOTA, "combinei de ligar às 15h");
  await page.press(CAMPO_NOTA, "Enter");
  await page.waitForTimeout(2500);

  const notas = await page.evaluate(() => (globalThis.__TABELAS.notas || []).map((n) => n.texto));
  const fila = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || []).length);
  ok("a nota entrou em `notas`", notas.includes("combinei de ligar às 15h"),
     JSON.stringify(notas.slice(-3)));
  ok("e não entrou na fila de envio", notas.length === antesNotas + 1 && fila === antesFila,
     `notas ${antesNotas}->${notas.length}, fila ${antesFila}->${fila}`);
  // A TRAVA QUE IMPORTA MAIS QUE TODAS: uma nota que fosse parar no WhatsApp é
  // um recado interno chegando ao cliente. Não há como desfazer.
  ok("NADA foi mandado ao cliente", fila === antesFila,
     `a fila de envio foi de ${antesFila} para ${fila}`);
}

console.log("\nDá para voltar para a mensagem, pelos dois caminhos");
{
  await page.locator("[data-fechar-nota]").first().click();
  await page.waitForTimeout(1000);
  ok("o X do painel fecha a nota", await page.locator("[data-nota-no-alto]").count() === 0);
  ok("e a caixa de mensagem volta ao seu lugar", await page.locator(CAMPO_MSG).count() > 0);

  await page.locator("[data-nota-interna]").first().click();
  await page.waitForTimeout(900);
  ok("o mesmo ícone reabre", await page.locator(CAMPO_NOTA).count() > 0);
  await page.locator("[data-nota-interna]").first().click();
  await page.waitForTimeout(900);
  ok("e clicar nele de novo também fecha", await page.locator(CAMPO_MSG).count() > 0);
}

console.log("\nNo celular, onde o cabeçalho não cabe os botões");
{
  // O botão subiu para um cabeçalho que no celular NÃO É DESENHADO — tudo mora
  // no menu ⋮. Sem uma linha lá, mover o botão teria TIRADO a nota interna do
  // celular, e ninguém veria isso acontecer.
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(1200);
  await page.locator('[aria-label="Mais opções desta conversa"]').first().click();
  await page.waitForTimeout(600);
  const noMenu = await page.locator("[data-menu-conversa] [data-nota-interna]").count();
  ok("a nota interna está no menu ⋮ do celular", noMenu > 0);

  if (noMenu > 0) {
    await page.locator("[data-menu-conversa] [data-nota-interna]").first().click();
    await page.waitForTimeout(1200);
    ok("e abre a mesma caixa, no alto", await page.locator("[data-nota-no-alto]").count() > 0);
    const largura = await page.evaluate(() => {
      const el = document.querySelector("[data-nota-no-alto]");
      return el ? Math.round(el.getBoundingClientRect().right) : null;
    });
    // O LAYOUT NÃO PODE QUEBRAR. Um painel mais largo que a tela empurra a
    // conversa para o lado e faz a página rolar na horizontal — no celular isso
    // é a tela inteira andando debaixo do dedo.
    ok("sem estourar a largura da tela", largura !== null && largura <= 390,
       `o painel termina em ${largura}px de 390px`);
  }
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
