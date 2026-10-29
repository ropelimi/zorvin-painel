// OS MENUS QUE ABREM PARA O LADO CABEM NA JANELA (auditoria de 28/10)
//
// Os menus dos selos da linha do número — responsável, etapa no funil,
// tarefas — e o painel de emojis da caixa de escrever abrem para a DIREITA de
// onde nascem. A varredura de layout da auditoria, a 768px (o iPad em pé),
// mediu o "Tarefas desta conversa" indo até 933px, o "Etapa no funil" até 860,
// o "Responsável" até 846 e os emojis até 835: a página inteira passava a
// rolar de lado, e o fim de cada menu ficava fora da tela.
//
// O QUE ESTA PROVA GUARDA, em quatro larguras de computador estreito/tablet:
// cada um dos quatro abre inteiro dentro da janela, e a página não rola de lado.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const erros = [];

// [o que é, quem abre, o que aparece]
const MENUS = [
  ["o menu do responsável", "[data-responsavel-da-conversa]", "[data-menu-responsavel]"],
  ["o menu da etapa no funil", "[data-etapa-da-conversa]", "[data-menu-etapa]"],
  ["o menu das tarefas", "[data-tarefa-da-conversa]", "[data-menu-tarefas]"],
  ["o painel de emojis", '[title="Emojis e figurinhas"]', 'input[placeholder="Pesquisar emoji"]'],
];

for (const largura of [768, 900, 1024, 1200]) {
  console.log(`\nA ${largura}px`);
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${largura}px: ${e.message}`));
  await page.route("**/ponte-de-mentira/**", (rota) => rota.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ clientes: [], opcoes: {} }) }));
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1500);

  for (const [nome, gatilho, menu] of MENUS) {
    const botao = page.locator(gatilho).first();
    const temBotao = (await botao.count()) > 0 && await botao.isVisible();
    if (temBotao) {
      await botao.click();
      await page.waitForTimeout(600);
    }
    // O PAINEL DE EMOJIS é medido pela caixa inteira, e não pelo campo de
    // pesquisa: sobe-se até o primeiro ancestral posicionado por fora.
    const caixa = await page.evaluate((sel) => {
      let el = document.querySelector(sel);
      if (!el) return null;
      if (el.tagName === "INPUT") {
        while (el && getComputedStyle(el).position !== "absolute") el = el.parentElement;
        if (!el) return null;
      }
      const r = el.getBoundingClientRect();
      return { esq: Math.round(r.left), dir: Math.round(r.right), tela: innerWidth,
               conteudo: document.documentElement.scrollWidth };
    }, menu);
    ok(`${nome} abre`, temBotao && caixa !== null, temBotao ? "não apareceu" : `sem o botão ${gatilho}`);
    ok(`${nome} cabe na janela`, caixa !== null && caixa.esq >= 0 && caixa.dir <= caixa.tela,
       caixa ? `vai de ${caixa.esq} a ${caixa.dir}px numa janela de ${caixa.tela}` : "");
    ok(`e a página não rola de lado com ${nome} aberto`, caixa !== null && caixa.conteudo <= caixa.tela + 1,
       caixa ? `o conteúdo tem ${caixa.conteudo}px` : "");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    // O Esc fecha o que está por cima; se ainda houver menu, um clique fora
    // fecha (os menus dos selos fecham ao clicar fora).
    if (await page.locator(menu).count()) {
      await page.mouse.click(largura - 20, 450);
      await page.waitForTimeout(300);
    }
  }
  await ctx.close();
}

ok("sem erro de JavaScript", erros.length === 0, erros.slice(0, 3).join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
