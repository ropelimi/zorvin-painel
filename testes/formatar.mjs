// A BARRA DE FORMATAÇÃO — negrito, itálico, tachado, código, listas e citação.
//
// Pedida por quem administra, com os atalhos do WhatsApp Web ditados um a um.
//
// Esta prova tem duas metades, e elas provam coisas diferentes:
//
//  1. AS REGRAS, direto de `src/formatacao.js`, sem navegador. É onde os erros
//     de verdade moram — pôr e tirar a marca, a linha que já estava marcada, a
//     renumeração. Provar isso clicando na tela seria lento e diria menos.
//
//  2. A TELA, com navegador: a barra aparece ao selecionar, o clique formata o
//     texto certo, o atalho de teclado faz o mesmo, e a legenda mostra a tecla.
//
// E uma conferência que não é bem uma prova, e sim uma MEDIÇÃO: o Ctrl+Shift+I
// é o atalho das ferramentas de desenvolvedor do Chrome. Se o navegador o
// engolir antes da página, o atalho do código inline não funciona e não há o
// que fazer no nosso lado — o botão da barra continua servindo. A conferência
// existe para a resposta ficar registrada em vez de suposta.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { calcularFormato, aplicar, formatoDaTecla, FORMATOS } from "../src/formatacao.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// ------------------------------------------------------------------
//  1. AS REGRAS
// ------------------------------------------------------------------
console.log("\nAs marcas: pôr e tirar");
{
  const r = (t, i, f, fmt) => aplicar(t, calcularFormato(t, i, f, fmt));

  ok("põe o negrito na seleção", r("oi mundo", 3, 8, "negrito") === "oi *mundo*",
     r("oi mundo", 3, 8, "negrito"));
  ok("o itálico usa underline, como o WhatsApp", r("oi mundo", 3, 8, "italico") === "oi _mundo_",
     r("oi mundo", 3, 8, "italico"));
  ok("o tachado usa til", r("oi mundo", 3, 8, "tachado") === "oi ~mundo~",
     r("oi mundo", 3, 8, "tachado"));
  ok("o código usa crase", r("faca x=1", 5, 8, "codigo") === "faca `x=1`",
     r("faca x=1", 5, 8, "codigo"));

  // TIRAR É TÃO IMPORTANTE QUANTO PÔR. Sem isto, dois cliques produzem
  // `**assim**`, que no WhatsApp não é negrito nenhum — são dois asteriscos
  // soltos aparecendo na tela do cliente.
  ok("clicar de novo TIRA a marca (seleção por dentro)",
     r("oi *mundo*", 3, 10, "negrito") === "oi mundo", r("oi *mundo*", 3, 10, "negrito"));
  ok("e também quando as marcas ficaram fora da seleção",
     r("oi *mundo*", 4, 9, "negrito") === "oi mundo", r("oi *mundo*", 4, 9, "negrito"));

  // Sem nada selecionado, o atalho prepara o terreno — é como se formata ANTES
  // de escrever, que é como muita gente escreve.
  const vazio = calcularFormato("oi ", 3, 3, "negrito");
  ok("sem seleção, deixa o cursor entre as marcas",
     aplicar("oi ", vazio) === "oi **" && vazio.selecao[0] === 4 && vazio.selecao[1] === 4,
     `${aplicar("oi ", vazio)} com cursor em ${JSON.stringify(vazio.selecao)}`);

  // A seleção volta para o TEXTO, sem as marcas: dá para encadear negrito e
  // itálico sem selecionar de novo.
  const posto = calcularFormato("oi mundo", 3, 8, "negrito");
  ok("depois de formatar, a seleção fica no texto e não nas marcas",
     posto.selecao[0] === 4 && posto.selecao[1] === 9, JSON.stringify(posto.selecao));
}

console.log("\nAs linhas: listas e citação");
{
  const r = (t, i, f, fmt) => aplicar(t, calcularFormato(t, i, f, fmt));

  ok("cita as duas linhas selecionadas", r("um\ndois", 0, 7, "citar") === "> um\n> dois",
     JSON.stringify(r("um\ndois", 0, 7, "citar")));
  ok("e clicar de novo descita", r("> um\n> dois", 0, 11, "citar") === "um\ndois",
     JSON.stringify(r("> um\n> dois", 0, 11, "citar")));
  ok("marcadores em todas as linhas", r("um\ndois", 0, 7, "marcadores") === "- um\n- dois",
     JSON.stringify(r("um\ndois", 0, 7, "marcadores")));
  ok("numera de 1 em diante", r("um\ndois\ntres", 0, 12, "numerada") === "1. um\n2. dois\n3. tres",
     JSON.stringify(r("um\ndois\ntres", 0, 12, "numerada")));

  // ESTE CASO ACHOU UM DEFEITO. Com uma linha já marcada e outra não, a
  // primeira versão marcava as duas de novo: "- um" virava "- - um", e o
  // segundo traço aparecia como texto na tela do cliente.
  ok("com uma linha já marcada, marca só a outra",
     r("- um\ndois", 0, 9, "marcadores") === "- um\n- dois",
     JSON.stringify(r("- um\ndois", 0, 9, "marcadores")));
  // E o mesmo na numerada, que é o caso de inserir uma linha no meio da lista
  // e renumerar: sem tirar o número velho, saía "1. 1. um".
  ok("renumerar uma lista com linha nova no meio",
     r("1. um\nnova\n2. dois", 0, 18, "numerada") === "1. um\n2. nova\n3. dois",
     JSON.stringify(r("1. um\nnova\n2. dois", 0, 18, "numerada")));

  // A seleção não precisa cobrir a linha inteira: quem põe o cursor no meio da
  // frase e clica em "Citar" está falando da linha.
  ok("basta o cursor na linha, não precisa selecioná-la inteira",
     r("um\ndois", 4, 4, "citar") === "um\n> dois",
     JSON.stringify(r("um\ndois", 4, 4, "citar")));
}

console.log("\nOs atalhos são lidos pela POSIÇÃO da tecla, e não pela letra");
{
  // Num teclado ABNT2 — o de todo mundo aqui — o Ctrl+Shift+7 chega com `key`
  // valendo "/" e o Ctrl+Shift+. com `key` valendo ":". Lendo `key`, os
  // atalhos funcionariam só no teclado de quem escreveu o código.
  ok("Ctrl+B é negrito", formatoDaTecla({ ctrlKey: true, code: "KeyB" }) === "negrito");
  ok("Ctrl+I é itálico", formatoDaTecla({ ctrlKey: true, code: "KeyI" }) === "italico");
  ok("Ctrl+Shift+X é tachado",
     formatoDaTecla({ ctrlKey: true, shiftKey: true, code: "KeyX" }) === "tachado");
  ok("Ctrl+Shift+I é código inline",
     formatoDaTecla({ ctrlKey: true, shiftKey: true, code: "KeyI" }) === "codigo");
  ok("Ctrl+Shift+7 é a lista numerada",
     formatoDaTecla({ ctrlKey: true, shiftKey: true, code: "Digit7" }) === "numerada");
  ok("Ctrl+Shift+8 é a lista com marcadores",
     formatoDaTecla({ ctrlKey: true, shiftKey: true, code: "Digit8" }) === "marcadores");
  ok("Ctrl+Shift+. é citar",
     formatoDaTecla({ ctrlKey: true, shiftKey: true, code: "Period" }) === "citar");

  ok("a tecla sozinha não formata nada", formatoDaTecla({ code: "KeyB" }) === null);
  ok("e o Ctrl+Alt+B também não — é outra combinação",
     formatoDaTecla({ ctrlKey: true, altKey: true, code: "KeyB" }) === null);

  // A legenda tem de prometer a tecla que funciona. Um atalho escrito na tela
  // e ausente no código é pior do que atalho nenhum.
  const prometidos = FORMATOS.map((f) => f.atalho);
  ok("a barra tem formatos para conferir", prometidos.length > 0,
     "lista vazia deixaria a conferência abaixo verde sem provar nada");
  ok("todo formato da barra anuncia um atalho", prometidos.every(Boolean),
     JSON.stringify(prometidos));
  ok("e não há dois formatos com o mesmo atalho",
     new Set(prometidos).size === prometidos.length, JSON.stringify(prometidos));
}

// ------------------------------------------------------------------
//  2. A TELA
// ------------------------------------------------------------------
const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);
await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(700);

const caixa = page.locator('textarea[placeholder*="Digite"]');
const barra = page.locator("[data-barra-formato]");

/** Escreve na caixa e seleciona um pedaço, pelas posições do texto.
 *
 *  SELECIONA COM O TECLADO DE VERDADE, e não com `setSelectionRange`.
 *
 *  A primeira versão mexia na seleção pelo código e disparava um evento
 *  `select` na mão. A barra não aparecia, e a prova acusava o painel — mas o
 *  errado era ela: o React não escuta `select`; ele deduz a mudança de seleção
 *  a partir de `keyup`, `mouseup` e companhia. Um evento inventado não passa
 *  por lugar nenhum do caminho real.
 *
 *  Setinha por setinha é mais lento e prova mais: é exatamente o que faz quem
 *  seleciona com Shift+seta, que era um caso que eu tinha afirmado num
 *  comentário e não tinha provado em lugar nenhum. */
async function escreverESelecionar(texto, ini, fim) {
  await caixa.click();
  await caixa.fill("");
  await caixa.fill(texto);
  await caixa.press("Control+Home");
  for (let i = 0; i < ini; i++) await caixa.press("ArrowRight");
  for (let i = 0; i < fim - ini; i++) await caixa.press("Shift+ArrowRight");
  await page.waitForTimeout(200);
}

const valor = () => caixa.inputValue();

console.log("\nA barra aparece ao selecionar, e some quando não há seleção");
{
  await caixa.click();
  await caixa.fill("oi mundo");
  await page.waitForTimeout(250);
  ok("com o texto escrito e nada selecionado, a barra não aparece",
     await barra.count() === 0);

  await escreverESelecionar("oi mundo", 3, 8);
  ok("ao selecionar um trecho, a barra aparece", await barra.count() === 1);
  ok("com os sete formatos", await barra.locator("[data-formato]").count() === 7,
     `apareceram ${await barra.locator("[data-formato]").count()}`);
}

console.log("\nA legenda mostra o nome e a tecla de atalho");
{
  await barra.locator('[data-formato="negrito"]').hover();
  await page.waitForTimeout(300);
  const legenda = await barra.locator('[data-formato="negrito"]').innerText();
  ok("passar o mouse mostra a legenda", /negrito/i.test(legenda), `dizia: "${legenda}"`);
  ok("e a legenda traz o atalho", /Ctrl\+B/i.test(legenda), `dizia: "${legenda}"`);

  // A legenda é DESENHADA POR NÓS, e não o balãozinho do sistema: aquele
  // demora um segundo, sai claro no tema escuro e não deixa pôr a tecla em
  // cinza ao lado do nome.
  const tem = await page.evaluate(() => {
    const b = document.querySelector('[data-formato="citar"]');
    return b ? !b.getAttribute("title") : false;
  });
  ok("e não é o balão do navegador", tem);
}

console.log("\nO clique formata o texto selecionado");
{
  await escreverESelecionar("oi mundo", 3, 8);
  await barra.locator('[data-formato="negrito"]').click();
  await page.waitForTimeout(300);
  ok("o negrito entra no texto", await valor() === "oi *mundo*", `ficou "${await valor()}"`);

  // A SELEÇÃO SOBREVIVE AO CLIQUE. É o defeito clássico da barra flutuante:
  // apertar o botão tira o foco da caixa, a seleção se perde, e o segundo
  // clique formata o nada.
  await barra.locator('[data-formato="italico"]').click();
  await page.waitForTimeout(300);
  ok("e dá para encadear outro formato sem selecionar de novo",
     await valor() === "oi *_mundo_*", `ficou "${await valor()}"`);
}

console.log("\nOs atalhos de teclado fazem o mesmo");
{
  await escreverESelecionar("oi mundo", 3, 8);
  await page.keyboard.press("Control+b");
  await page.waitForTimeout(300);
  ok("Ctrl+B", await valor() === "oi *mundo*", `ficou "${await valor()}"`);

  await escreverESelecionar("oi mundo", 3, 8);
  await page.keyboard.press("Control+i");
  await page.waitForTimeout(300);
  ok("Ctrl+I", await valor() === "oi _mundo_", `ficou "${await valor()}"`);

  await escreverESelecionar("oi mundo", 3, 8);
  await page.keyboard.press("Control+Shift+x");
  await page.waitForTimeout(300);
  ok("Ctrl+Shift+X", await valor() === "oi ~mundo~", `ficou "${await valor()}"`);

  await escreverESelecionar("um\ndois", 0, 7);
  await page.keyboard.press("Control+Shift+Digit7");
  await page.waitForTimeout(300);
  ok("Ctrl+Shift+7 numera", await valor() === "1. um\n2. dois", `ficou "${await valor()}"`);

  await escreverESelecionar("um\ndois", 0, 7);
  await page.keyboard.press("Control+Shift+Digit8");
  await page.waitForTimeout(300);
  ok("Ctrl+Shift+8 marca", await valor() === "- um\n- dois", `ficou "${await valor()}"`);

  await escreverESelecionar("um\ndois", 0, 7);
  await page.keyboard.press("Control+Shift+Period");
  await page.waitForTimeout(300);
  ok("Ctrl+Shift+. cita", await valor() === "> um\n> dois", `ficou "${await valor()}"`);

  // CTRL+SHIFT+I, E O QUE ESTA CONFERÊNCIA NÃO PODE PROVAR.
  //
  // Ctrl+Shift+I é o atalho das ferramentas de desenvolvedor do Chrome, do
  // Edge e do Firefox. O Playwright injeta a tecla direto na página, POR BAIXO
  // da camada em que o navegador decide abrir as ferramentas — então o verde
  // aqui prova que o nosso tratador faz a coisa certa quando a tecla chega, e
  // NÃO prova que ela chega num navegador de verdade.
  //
  // Deixar a conferência sem esta ressalva seria pior do que não tê-la: um
  // verde afirmando o que não foi medido. Quem confere isto de verdade é uma
  // pessoa, no navegador dela — e, dê no que der, o botão da barra continua
  // sendo o caminho que funciona sempre.
  await escreverESelecionar("faca x=1", 5, 8);
  await page.keyboard.press("Control+Shift+i");
  await page.waitForTimeout(400);
  const codigoSaiu = await valor();
  console.log(`     Ctrl+Shift+I → a caixa ficou "${codigoSaiu}"`);
  console.log("     (a bancada injeta a tecla por baixo do navegador: isto mede");
  console.log("      o nosso tratador, e não se o Chrome deixa a tecla passar)");
  ok("Ctrl+Shift+I faz o código inline QUANDO a tecla chega à página",
     codigoSaiu === "faca `x=1`",
     `ficou "${codigoSaiu}"`);
}

console.log("\nO Enter continua enviando, e o atalho não atrapalha");
{
  // A caixa já tinha significados para Enter, Shift+Enter, Alt+Enter e "/".
  // Um atalho novo que atropelasse qualquer um deles seria uma troca ruim.
  await escreverESelecionar("oi mundo", 3, 8);
  await page.keyboard.press("Control+b");
  await page.waitForTimeout(200);
  await page.keyboard.press("Alt+Enter");
  await page.waitForTimeout(250);
  ok("Alt+Enter continua quebrando a linha", /\n/.test(await valor()),
     `ficou "${await valor()}"`);
}

console.log("\nE a bolha desenha o que a barra escreveu");
{
  // Sem isto a barra seria meia funcionalidade: a mensagem sairia certa para o
  // cliente e errada para quem a escreveu.
  const desenhado = await page.evaluate(() => {
    const t = globalThis.__TABELAS && globalThis.__TABELAS.conversas;
    return !!t;
  });
  ok("a bancada está de pé", desenhado);

  const conversa = await page.evaluate(() =>
    document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));
  await page.evaluate((c) => globalThis.__EMITIR("INSERT", "mensagens", {
    id: "fmt-1", conversa_id: c, tipo: "texto", origem: "contato",
    texto: "olha *isto*\n- um\n- dois\n> citado\n1. passo",
    criado_em: new Date().toISOString(),
  }), conversa);
  await page.waitForTimeout(700);

  const bolha = await page.evaluate(() => {
    const el = document.querySelector('[data-msg-id="fmt-1"]');
    if (!el) return null;
    return {
      negrito: !!el.querySelector("strong"),
      lista: !!el.querySelector("ul li"),
      numerada: !!el.querySelector("ol li"),
      citacao: el.innerText.includes("citado") && !el.innerText.includes("> citado"),
      cru: el.innerText,
    };
  });
  ok("a bolha existe", !!bolha);
  if (bolha) {
    ok("o negrito vira negrito", bolha.negrito);
    ok("os marcadores viram uma lista de verdade", bolha.lista, bolha.cru);
    ok("a numerada vira lista numerada", bolha.numerada, bolha.cru);
    ok("e a citação some com o '>' e vira citação", bolha.citacao, bolha.cru);
  }
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
