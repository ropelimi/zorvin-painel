// PROVA DE DESEMPENHO E DE TETO DE LINHAS.
//
// Três coisas que só aparecem quando a base é grande — e que, por isso,
// atravessaram todos os testes até a bancada ganhar um telefone com 1200
// conversas e 1100 não lidas:
//
//   1. A LISTA DESENHAVA TUDO. 1000 linhas com avatar, nome, prévia e selos =
//      13 mil elementos na tela. Cada tecla digitada na busca redesenhava o
//      conjunto.
//   2. O SELO DE NÃO LIDAS era contado baixando todas as conversas não lidas de
//      todos os telefones — e a API para em 1000. O selo mentia para MENOS.
//   3. A AGENDA baixava todos os contatos em ordem alfabética e filtrava aqui.
//      Quem estivesse depois do milésimo nome não existia para ela.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const URL = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, detalhe = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? " — " + detalhe : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1320, height: 900 } });
const page = await ctx.newPage();
// 4× mais lento: um computador de escritório, não a máquina onde isto roda.
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto(URL);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(1500);

const dados = await page.evaluate(() => globalThis.__ESPERADO.fundo);

// A MESMA MEDIDA NUM TELEFONE COMUM, para servir de régua.
//
// UMA RODADA SÓ NÃO BASTA, e isto foi medido antes de mudar. Sob a CPU freada
// em 4×, a mesma tela mediu de 52 a 73 ms em execuções seguidas do MESMO
// código — e o teto (o dobro da régua) cai bem no meio dessa faixa. Quer dizer:
// esta conferência reprovava por sorte, e passava por sorte.
//
// Um teste que reprova por acaso é pior do que um teste que não existe: ele
// ensina a ignorar a cor vermelha, e no dia em que a lentidão for de verdade
// ninguém vai olhar. Foi conferido intercalando dois ramos — 64/59/63/67 contra
// 59/65 —, e as duas faixas se sobrepunham inteiras: o que variava era o
// instrumento, não a tela.
//
// O CONSERTO É MAIS AMOSTRA, E NÃO UM TETO MAIOR. Afrouxar o limite deixaria
// passar a lentidão que esta prova existe para pegar; medir mais vezes ataca a
// causa, que é o barulho da medida.
//
// CINCO NÃO FORAM O BASTANTE: com cinco, esta prova ainda reprovava mais ou
// menos uma vez a cada vinte execuções, sempre com os dois números colados
// (60 contra 29, por exemplo — dois ruídos, e não uma tela lenta). Sete
// rodadas custam uns oito segundos a mais e apertam a mediana; junto com a
// FOLGA ABSOLUTA abaixo, o barulho deixa de decidir.
const RODADAS = 7;

// A FOLGA QUE SEPARA RUÍDO DE LENTIDÃO, em milissegundos.
//
// O teto é relativo (o dobro da régua), e um teto relativo tem um ponto cego:
// quando a régua sai baixa, o dobro dela vira um número pequeno, e uma
// diferença que nenhuma pessoa perceberia — dez, quinze milissegundos —
// reprova a prova. O defeito que esta conferência existe para pegar não é
// desses: sem a janela da lista, digitar custava QUATRO vezes mais, uma
// diferença de centenas de milissegundos.
//
// Vinte e cinco milissegundos é menos de dois quadros de tela. Nenhuma mão
// sente isso, e nenhuma lentidão de verdade cabe aí dentro.
const FOLGA_MS = 25;

const umaRodada = () => page.evaluate(async () => {
  const el = document.querySelector('input[placeholder*="Buscar por nome"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  const t = [];
  for (const ch of ["a", "n", "d", "r", "e"]) {
    const t0 = performance.now();
    setter.call(el, el.value + ch);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    t.push(performance.now() - t0);
  }
  setter.call(el, "");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return t.slice().sort((a, b) => a - b)[Math.floor(t.length / 2)];
});

const mediana = (v) => v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)];

/** A mediana de várias rodadas — o mesmo instrumento dos dois lados da conta. */
async function medirTecla() {
  const rodadas = [];
  for (let i = 0; i < RODADAS; i += 1) {
    rodadas.push(await umaRodada());
    // UMA PAUSA LONGA ENTRE RODADAS, e ela é metade do conserto. Cada rodada
    // digita cinco letras e apaga: numa lista de 1200 conversas isso dispara
    // busca, filtro e redesenho, e a tela ainda está terminando esse trabalho
    // quando a rodada seguinte começa. Com pausa curta, as rodadas mediram
    // 72/69/86/128/100 — subindo —, que é a fila crescendo, não a tecla ficando
    // mais lenta. Esperando a tela assentar, elas ficam planas.
    await page.waitForTimeout(700);
  }
  return { valor: mediana(rodadas), rodadas };
}

const { valor: base, rodadas: rodadasBase } = await medirTecla();
console.log(`     régua: ${base.toFixed(0)} ms num telefone comum `
            + `(${rodadasBase.map((v) => v.toFixed(0)).join("/")})`);
await page.waitForTimeout(1200);

console.log("\n1. A lista de conversas");
await page.locator('[data-telefone="Arquivo"]').first().click();
await page.waitForTimeout(3000);

const conta = () => page.evaluate(() => ({
  linhas: document.querySelectorAll("[data-conversa-nome]").length,
  nos: document.querySelectorAll("*").length,
}));

let n = await conta();
console.log(`     ${n.linhas} linhas desenhadas de ${dados.total}, ${n.nos} elementos no DOM`);
ok("não desenha as 1200 conversas de uma vez", n.linhas <= 60, `desenhou ${n.linhas}`);
ok("o DOM fica pequeno", n.nos < 2000, `${n.nos} elementos`);
const rodape = await page.evaluate(() => {
  const el = document.querySelector('[data-teste="fim-da-lista"]');
  const linha = el && [...el.querySelectorAll("div")].find((d) => /conversas$/.test(d.textContent));
  return linha ? linha.textContent.trim() : "";
});
// "de 200+ conversas": a lista vem em páginas de 200, e o "+" diz que o banco
// tem mais sem inventar um número que a tela não sabe.
ok("o rodapé diz quantas está mostrando, e que há mais",
   /^40 de \d+\+? conversas$/.test(rodape) && rodape.includes("+"), `veio "${rodape}"`);

// Rolar traz mais, sem clique nenhum.
await page.evaluate(() => {
  const alvo = [...document.querySelectorAll("div")]
    .find((d) => d.scrollHeight > d.clientHeight + 200 && d.querySelector("[data-conversa-nome]"));
  if (alvo) alvo.scrollTop = alvo.scrollHeight;
});
await page.waitForTimeout(800);
const depois = await conta();
ok("rolar até o fim traz mais conversas", depois.linhas > n.linhas,
   `${n.linhas} → ${depois.linhas}`);

// A latência de digitar, que é o que a pessoa sente.
//
// O MESMO INSTRUMENTO DA RÉGUA, e é isso que torna a comparação honesta: as
// duas pontas da conta medem do mesmo jeito, com o mesmo número de rodadas, na
// mesma execução. Duas medidas de exatidões diferentes comparadas entre si
// diriam mais sobre a diferença entre elas do que sobre a tela.
const { valor: latencia, rodadas: rodadasLista } = await medirTecla();
console.log(`     tecla → tela: ${latencia.toFixed(0)} ms (num computador 4× mais lento) `
            + `(${rodadasLista.map((v) => v.toFixed(0)).join("/")})`);
// O teto é o do BUILD DE PRODUÇÃO, que é o que a equipe usa: rodando contra o
// servidor de desenvolvimento, o próprio React gasta mais que isso em
// verificações que não existem em produção.
// O TETO É RELATIVO, medido na mesma execução: um número absoluto reprovaria
// numa máquina mais lenta e passaria numa mais rápida sem dizer nada sobre a
// tela. Antes da correção, a conta era 4× a de um telefone comum.
//
// O ALCANCE DESTA CONFERÊNCIA, MEDIDO E ESCRITO — porque saber o que ela NÃO
// pega vale tanto quanto saber o que ela pega.
//
// Tirando a janela da lista (fazendo-a desenhar tudo de novo, que é o defeito
// original), as três conferências acima reprovam na hora — 201 linhas, 2829
// elementos — e ESTA AQUI CONTINUA PASSANDO, com 59 e 49 ms. A razão é que a
// lista chega em páginas de 200: desenhar "tudo" são 201 linhas, e 201 linhas
// não chegam a doer nesta máquina.
//
// Quer dizer: quem pega a volta do defeito são as contas de DOM. Este número é
// confirmação, não sentinela. Mantê-lo tem valor — ele fecharia a conta se a
// lentidão viesse de outro lugar que não o tamanho do DOM —, mas quem mexer
// aqui precisa saber em qual das quatro confiar.
//
// (Medir a latência DEPOIS de carregar as 1200 foi tentado, para ela morder de
// verdade. Não serve: a primeira tecla sobre a lista inteira custa ~235 ms e as
// seguintes ~55, então a mediana volta a cair em cima do teto e a prova reprova
// por sorte de novo — trocando um problema conhecido por ele mesmo.)
ok(`digitar num telefone de 1200 conversas custa quase o mesmo que num comum`,
   latencia < base * 2 || latencia - base < FOLGA_MS,
   `${latencia.toFixed(0)} ms contra ${base.toFixed(0)} ms`);


// ROLAR ATÉ O FIM DE TUDO tem de passar do teto de 1000 da API: é o caso que
// fazia a conversa número 1100 não existir para a tela.
// A caixa de busca fica VAZIA para esta parte: a medida de latência acima
// digitou nela, e a lista filtrada não é a lista — foi assim que a primeira
// versão desta conferência "parou em 17", que era o número de resultados da
// busca que tinha ficado para trás.
await page.locator('input[placeholder*="Buscar por nome"]').fill("");
await page.waitForTimeout(900);

// Pelo BOTÃO, e não pela rolagem: o botão é o caminho determinístico (a
// rolagem depende de o navegador emitir o evento, e um teste que espera evento
// mede o teste, não a tela). A rolagem já foi conferida acima.
for (let i = 0; i < 40; i++) {
  const b = page.locator('[data-teste="fim-da-lista"] button');
  if (!(await b.count())) break;
  if (await b.isDisabled().catch(() => false)) { await page.waitForTimeout(300); continue; }
  await b.click();
  await page.waitForTimeout(260);
  const c = await page.evaluate(() => document.querySelectorAll("[data-conversa-nome]").length);
  if (c >= dados.total) break;
}
const tudo = await conta();
console.log(`     rolando até o fim: ${tudo.linhas} de ${dados.total}`);
ok("dá para chegar na conversa 1200, passando do teto de 1000 da API",
   tudo.linhas >= dados.total, `parou em ${tudo.linhas}`);

console.log("\n2. O selo de não lidas");
// O selo escreve "99+" quando passa de 99 — o número exato está no `title`,
// que é onde a pessoa confere passando o mouse. A primeira versão deste teste
// lia o texto do selo e reprovava um número que estava certo.
const selo = await page.getAttribute('[data-telefone="Arquivo"]', "title");
const contado = Number((selo || "").replace(/\D/g, ""));
ok(`o selo conta as ${dados.naoLidas} não lidas, e não para no teto de 1000`,
   contado === dados.naoLidas, `veio "${selo}"`);

console.log("\n3. A agenda de contatos");
await page.getByRole("button", { name: "Nova conversa" }).click();
await page.waitForSelector('input[placeholder*="Pesquisar nome"]');
await page.locator('input[placeholder*="Pesquisar nome"]').fill(dados.nome.split(" ")[0]);
await page.waitForTimeout(1500);
const texto = await page.locator("body").innerText();
ok(`a agenda acha "${dados.nome}", que está depois do milésimo nome`,
   texto.includes(dados.nome), texto.slice(0, 200).replace(/\n/g, " | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
