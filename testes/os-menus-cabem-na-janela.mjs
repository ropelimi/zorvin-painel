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
//
// E O MENU ⋮ DA CONVERSA CABE NA ALTURA DO CELULAR PEQUENO (25/11). A
// varredura do celular, medindo pela largura de verdade, achou o menu indo até
// depois do pé da tela num celular de 320×568 (o iPhone SE antigo): "Quem
// participou" e o que vem depois ficavam fora de alcance. Hoje ele ganha a
// altura que sobra e rola por dentro; num celular onde cabe, fica como era.
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
      return { esq: Math.round(r.left), dir: Math.round(r.right), tela: document.documentElement.clientWidth,
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

// O MENU ⋮ DA CONVERSA NO CELULAR: no pequeno ele rola por dentro, e o último
// item se alcança; no de 393, onde cabe, fica sem rolagem nenhuma.
for (const [largura, altura, pequeno] of [[320, 568, true], [393, 852, false]]) {
  console.log(`\nO menu ⋮ da conversa num celular de ${largura}×${altura}`);
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${largura}×${altura}: ${e.message}`));
  await page.route("**/ponte-de-mentira/**", (rota) => rota.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ clientes: [], opcoes: {} }) }));
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1500);
  const botao = page.locator('[aria-label="Mais opções desta conversa"]').first();
  const temBotao = (await botao.count()) > 0;
  if (temBotao) { await botao.click(); await page.waitForTimeout(600); }
  const m = await page.evaluate(() => {
    const menu = document.querySelector("[data-menu-conversa]");
    if (!menu) return null;
    const r = menu.getBoundingClientRect(), s = getComputedStyle(menu);
    return { topo: Math.round(r.top), pe: Math.round(r.bottom), tela: document.documentElement.clientHeight,
             largura: document.documentElement.clientWidth, conteudo: document.documentElement.scrollWidth,
             rola: menu.scrollHeight > menu.clientHeight + 1, rolagem: s.overflowY };
  });
  ok(`(${largura}) o menu ⋮ abre`, temBotao && m !== null, temBotao ? "não apareceu" : "sem o botão ⋮");
  ok(`(${largura}) e cabe na altura da tela`, m !== null && m.pe <= m.tela,
     m ? `vai de ${m.topo} a ${m.pe} numa tela de ${m.tela} de altura` : "");
  ok(`(${largura}) e a página não rola de lado`, m !== null && m.conteudo <= m.largura + 1,
     m ? `o conteúdo tem ${m.conteudo} numa tela de ${m.largura}` : "");
  if (pequeno) {
    ok(`(${largura}) o menu rola por dentro`, m !== null && m.rola && m.rolagem === "auto",
       m ? `rola=${m.rola}, overflow-y=${m.rolagem}` : "");
    // O último item, trazido à vista rolando o menu, está PINTADO onde está.
    const ultimo = await page.evaluate(async () => {
      const menu = document.querySelector("[data-menu-conversa]");
      const itens = menu ? [...menu.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().height > 0) : [];
      const b = itens[itens.length - 1];
      if (!b) return null;
      menu.scrollTop = menu.scrollHeight;
      await new Promise((ok) => requestAnimationFrame(() => ok()));
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { texto: b.innerText.trim().slice(0, 40), pe: Math.round(r.bottom), tela: document.documentElement.clientHeight,
               pintado: !!el && (el === b || b.contains(el)) };
    });
    ok(`(${largura}) e o último item se alcança rolando o menu`, ultimo !== null && ultimo.pintado && ultimo.pe <= ultimo.tela,
       ultimo ? `«${ultimo.texto}» termina em ${ultimo.pe} numa tela de ${ultimo.tela}, pintado=${ultimo.pintado}` : "sem itens");
  } else {
    ok(`(${largura}) onde cabe, o menu fica sem rolagem`, m !== null && !m.rola && m.rolagem !== "auto",
       m ? `rola=${m.rola}, overflow-y=${m.rolagem}` : "");
  }
  await ctx.close();
}

ok("sem erro de JavaScript", erros.length === 0, erros.slice(0, 3).join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
