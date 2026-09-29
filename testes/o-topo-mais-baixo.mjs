// O TOPO DA COLUNA DAS CONVERSAS — mais baixo, e sem perder nada.
//
// PEDIDO DO RODRIGO, 16/09, com as duas telas lado a lado: o topo do Zorvin
// ocupava quase o dobro do topo do WhatsApp Web, e a equipe conhece o segundo.
//
// MEDIDO ANTES, nesta bancada, a 1360x900: do alto da coluna até a primeira
// conversa iam 283px. No WhatsApp Web são ~147, em três faixas — título,
// busca, filtros. O Zorvin tinha SEIS: marca, departamento, "ATENDENDO COMO",
// nome e número, busca, e a fita de filtros QUEBRADA EM DUAS LINHAS.
//
// A conta de onde saíam os 283: a fita quebrada custava 38px só porque cinco
// pílulas não cabem em 357px; o rótulo "ATENDENDO COMO" empilhado sobre o nome
// custava uma linha inteira para dizer o que o valor ao lado já dizia; e havia
// dois traços horizontais em sessenta pixels de tela.
//
// HOJE SÃO 188px no computador e 281 no celular (eram 283 e 315).
//
// O CONTROLE DA ORDEM PASSOU A TER DOIS ENDEREÇOS, um por layout, e por isso
// esta prova roda em DUAS larguras. No computador ele fica na linha da marca,
// e é isso que tira a quinta pílula da fita. No celular ele fica na fita, e é
// isso que deixa a marca caber — lá em cima os botões têm 40px de alvo de dedo
// por regra, e com quatro deles sobravam 100px para um nome que pede 134.
//
// ------------------------------------------------------------
// ESTA PROVA TEM DUAS METADES, E A SEGUNDA É A QUE IMPORTA MAIS
//
// A primeira mede que encolheu. Sozinha, ela aprovaria a tela que encolheu
// APAGANDO coisa — e o jeito mais fácil de baixar um cabeçalho é jogar fora o
// que ele diz. A segunda confere que cada informação continua lá: qual número
// vai aparecer para o cliente, em que departamento se está, e em que ordem a
// lista está.
//
// O NÚMERO é o caso mais grave dos três: é ele que o cliente vê chegar no
// WhatsApp dele, e responder pelo número errado não tem desfazer.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

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
page.on("pageerror", (e) => erros.push(e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

// ------------------------------------------------------------------
console.log("\nO topo cabe na altura do WhatsApp Web, e não no dobro dela");
{
  const alturas = await page.evaluate(() => {
    const topo = document.querySelector("[data-topo-da-coluna]");
    const primeira = document.querySelector("[data-conversa-nome]");
    if (!topo || !primeira) return null;
    return {
      doAltoAteAPrimeiraConversa:
        Math.round(primeira.getBoundingClientRect().top - topo.getBoundingClientRect().top),
    };
  });
  ok("consegui medir a coluna", !!alturas, "não achei o topo ou a primeira conversa");

  // O TETO É 205, e o número tem procedência: 283 era o de antes, 188 é o de
  // agora, ~147 é o do WhatsApp Web. Um teto colado em 188 reprovaria por meio
  // pixel de fonte noutra máquina; um teto em 260 deixaria uma faixa inteira
  // voltar sem ninguém notar.
  //
  // COMEÇOU EM 215 E DESCEU. Com 215, a sabotagem que devolvia os recheios
  // antigos media 215 cravados e PASSAVA — o teto tinha ficado um pixel largo
  // demais para pegar exatamente o que ele existe para pegar. Teto que não
  // reprova o defeito que motivou a mudança é decoração.
  const h = alturas && alturas.doAltoAteAPrimeiraConversa;
  ok("do alto até a primeira conversa cabem menos de 205px", h != null && h < 205,
     `medi ${h}px`);
}

// ------------------------------------------------------------------
console.log("\nE a fita de filtros cabe numa linha só");
{
  // ISTO É O QUE MAIS REGRIDE. Basta acrescentar uma pílula para a fita
  // quebrar de novo, e a segunda linha não avisa que nasceu — ela só empurra
  // a lista para baixo. Medir "estão todas na mesma altura" pega isso; medir
  // a altura da fita não pegaria, porque uma pílula mais baixa compensaria.
  const linhas = await page.evaluate(() => {
    const fita = document.querySelector("[data-fita-de-filtros]");
    if (!fita) return null;
    const topos = [...fita.children].map((c) => Math.round(c.getBoundingClientRect().top));
    return { quantasLinhas: new Set(topos).size, quantasPilulas: topos.length };
  });
  ok("achei a fita de filtros", !!linhas);
  ok("as pílulas estão todas na mesma linha",
     linhas && linhas.quantasLinhas === 1,
     linhas && `${linhas.quantasPilulas} pílulas em ${linhas.quantasLinhas} linhas`);

  // E COM O CONTADOR GRANDE TAMBÉM. A bancada tem 9 não lidas; o escritório
  // tinha 164 no dia do pedido, e três dígitos são ~10px a mais. Uma fita que
  // só cabe com um dígito quebra no primeiro dia movimentado.
  const comTresDigitos = await page.evaluate(() => {
    const fita = document.querySelector("[data-fita-de-filtros]");
    const naoLidas = [...fita.children].find((c) => /Não lidas/.test(c.innerText));
    if (!naoLidas) return null;
    naoLidas.innerHTML = naoLidas.innerHTML.replace(/\d+/, "164");
    const topos = [...fita.children].map((c) => Math.round(c.getBoundingClientRect().top));
    return { linhas: new Set(topos).size, diz: naoLidas.innerText.trim() };
  });
  ok("e continuam numa linha só com o contador de três dígitos",
     comTresDigitos && comTresDigitos.linhas === 1,
     JSON.stringify(comTresDigitos));
}

// ------------------------------------------------------------------
console.log("\nE a linha de cima não escondeu nenhum botão para fora");
{
  // A ORDEM SUBIU PARA ESTA LINHA. Se ela não couber, o navegador não avisa:
  // o botão fica fora da vista, à direita, e a tela parece inteira.
  const linha = await page.evaluate(() => {
    const topo = document.querySelector("[data-topo-da-coluna]");
    const primeira = topo && topo.children[0];
    if (!primeira) return null;
    return { escondido: primeira.scrollWidth - primeira.clientWidth };
  });
  ok("nada transbordou da linha dos ícones",
     linha && linha.escondido <= 1, JSON.stringify(linha));
}

// ------------------------------------------------------------------
console.log("\nE a marca não ficou cortada para caber");
{
  // ISTO ACONTECEU DE VERDADE, nesta mesma mudança. Com a ordem subindo para a
  // linha da marca, sobraram 105px para um nome que pede ~156, e a tela passou
  // a dizer "Ropelimi Zo" — cortado no meio da palavra, sem nem as reticências
  // que avisariam que faltou pedaço. Ninguém teria reclamado; teria só ficado
  // com cara de programa mal feito, que é pior num sistema que se quer vender.
  //
  // Medir a LARGURA DA CAIXA não pegaria: a caixa tinha 105px e estava "certa".
  // O que denuncia é o conteúdo ser mais largo do que a caixa que o guarda.
  const marca = await page.evaluate(() => {
    const linha = document.querySelector("[data-linha-da-marca]");
    if (!linha) return null;
    const caixa = linha.children[0];
    const dentro = caixa.querySelector("span, b") ? caixa.firstElementChild : caixa;
    return { caixa: Math.round(caixa.getBoundingClientRect().width),
             conteudo: Math.round(dentro.scrollWidth),
             diz: caixa.innerText.replace(/\s+/g, " ").trim() };
  });
  ok("achei a linha da marca", !!marca);
  ok("a marca cabe inteira na caixa dela",
     marca && marca.conteudo <= marca.caixa + 1, JSON.stringify(marca));
  ok("e ela continua escrevendo o nome todo",
     marca && /Ropelimi/.test(marca.diz) && /Zorvin/.test(marca.diz),
     marca && marca.diz);

  // E A CONTA VALE PARA A ORDEM MAIS LARGA, não para a que está ligada.
  //
  // A pílula da ordem escreve "Recentes" (53px de texto), "Antigas" (44) ou
  // "Esperando" (62) — ela MUDA de largura conforme o que a pessoa escolheu.
  // Medir só com a de hoje aprovaria um topo que corta a marca no dia em que
  // alguém trocar para a fila de espera, e ninguém ligaria uma coisa à outra.
  // Aqui a régua soma a diferença da mais larga antes de comparar.
  const pior = await page.evaluate(() => {
    const linha = document.querySelector("[data-linha-da-marca]");
    const botao = linha && linha.querySelector("[data-ordem]");
    if (!botao) return null;
    const cs = getComputedStyle(botao);
    const regua = document.createElement("span");
    regua.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`;
    document.body.appendChild(regua);
    const larguras = {};
    for (const t of ["Recentes", "Antigas", "Esperando"]) {
      regua.textContent = t;
      larguras[t] = regua.getBoundingClientRect().width;
    }
    regua.remove();
    const agora = larguras[botao.innerText.replace(/\s+/g, " ").trim()];
    const maior = Math.max(...Object.values(larguras));
    const caixa = linha.children[0];
    const dentro = caixa.firstElementChild || caixa;
    return {
      cresceria: Math.round(maior - (agora ?? maior)),
      sobraAgora: Math.round(caixa.getBoundingClientRect().width - dentro.scrollWidth),
    };
  });
  ok("achei a pílula da ordem para medir o pior caso", !!pior);
  ok("e a marca continua cabendo com a ordem MAIS LARGA ligada",
     pior && pior.sobraAgora - pior.cresceria >= 0, JSON.stringify(pior));
}

// ------------------------------------------------------------------
console.log("\nE NADA do que o topo dizia deixou de ser dito");
{
  const topo = page.locator("[data-topo-da-coluna]");
  const texto = (await topo.innerText()).replace(/\s+/g, " ");

  // 1. O NÚMERO QUE O CLIENTE VÊ. O mais grave dos três: responder pelo
  //    número errado não tem desfazer, e a tela é o único lugar que diz qual é.
  const linhaDoTelefone = page.locator("[data-atendendo-como]");
  ok("a linha do telefone existe", await linhaDoTelefone.count() === 1);
  const doTelefone = (await linhaDoTelefone.innerText()).replace(/\s+/g, " ");
  ok("e ela ainda diz ATENDENDO COMO", /ATENDENDO COMO/i.test(doTelefone), doTelefone);
  ok("e o nome do telefone continua escrito",
     doTelefone.replace(/ATENDENDO COMO/i, "").trim().length > 2, doTelefone);
  ok("e o número continua escrito, com DDD",
     /\(\d{2}\)\s*\d/.test(doTelefone), doTelefone);

  // 2. O DEPARTAMENTO. Ele decide quais telefones a pessoa alcança.
  ok("o departamento continua escrito no topo", /deptos?\./i.test(texto), texto.slice(0, 200));

  // 3. A ORDEM DA LISTA. Ela mudou de lugar — saiu da fita e subiu para a
  //    linha dos ícones —, e mudar de lugar é onde um controle se perde.
  const ordem = page.locator("[data-ordem]");
  ok("o controle da ordem continua na tela", await ordem.count() === 1);
  const dizOrdem = (await ordem.innerText()).trim();
  // UM BOTÃO QUE SÓ TROCA E NÃO CONTA EM QUE ESTADO ESTÁ transforma "achei
  // estranho" em "está quebrado". A palavra encurtou de "Mais recentes" para
  // "Recentes" para caber aqui em cima; sumir ela não era opção.
  ok("e continua ESCREVENDO qual ordem está valendo, não só um desenho",
     /recentes|antigas/i.test(dizOrdem) && dizOrdem.length >= 7, `dizia: "${dizOrdem}"`);

  // E O MENU DELE AINDA ABRE DENTRO DA COLUNA.
  //
  // Escrevi esta conferência medindo a JANELA primeiro, e a sabotagem passou:
  // um menu de 244px empurrado para `left: 120` termina em 364px, que cabe
  // numa janela de 1360 com folga de sobra. Só que a coluna acaba em 360 — o
  // menu estaria derramando por cima da conversa aberta, que é exatamente o
  // defeito. A régua é a COLUNA, e não a janela.
  // E NO COMPUTADOR ELE MORA NA LINHA DA MARCA — é isso que tira a quinta
  // pílula da fita e a faz caber numa linha. As duas metades da mesma decisão
  // têm de estar conferidas, senão "mora na fita no celular" passaria também
  // numa versão que o deixou na fita nos dois.
  const ondeMoraPC = await page.evaluate(() => {
    const b = document.querySelector("[data-ordem]");
    return { naLinhaDaMarca: !!b.closest("[data-linha-da-marca]"),
             naFita: !!b.closest("[data-fita-de-filtros]") };
  });
  ok("no computador ele mora na linha da marca, e não na fita",
     ondeMoraPC.naLinhaDaMarca && !ondeMoraPC.naFita, JSON.stringify(ondeMoraPC));

  await ordem.click();
  await page.waitForTimeout(350);
  const menu = page.locator("[data-menu-ordem]");
  ok("o menu da ordem abre", await menu.count() === 1);
  const cabe = await page.evaluate(() => {
    const m = document.querySelector("[data-menu-ordem]");
    const col = document.querySelector("[data-topo-da-coluna]");
    if (!m || !col) return null;
    const b = m.getBoundingClientRect(), c = col.getBoundingClientRect();
    return { menuDe: Math.round(b.left), a: Math.round(b.right),
             colunaDe: Math.round(c.left), ate: Math.round(c.right) };
  });
  ok("e ele cabe dentro da coluna, sem derramar por cima da conversa",
     cabe && cabe.menuDe >= cabe.colunaDe - 1 && cabe.a <= cabe.ate + 1,
     JSON.stringify(cabe));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

// ------------------------------------------------------------------
console.log("\nE no CELULAR, onde a régua é outra");
{
  // ESTA SEÇÃO EXISTE PORQUE A PROVA SEM ELA ME DEIXOU QUEBRAR O CELULAR.
  //
  // Abaixo de 768px uma regra desta tela força todo botão a 40px de alvo de
  // dedo, e ela está certa em forçar. Com a ordem subindo para a linha da
  // marca, os 40px comeram o espaço do nome e a tela passou a dizer "Ropelimi
  // Zorv" — só no telefone. A conferência a 1360px passava feliz.
  //
  // 390x844 é um iPhone comum, e é a largura em que a conta fecha mais
  // apertada entre as que a equipe usa de verdade.
  const cel = await ctx.browser().newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await cel.newPage();
  const errosCel = [];
  p2.on("pageerror", (e) => errosCel.push(e.message));
  await p2.goto(ENDERECO);
  await p2.waitForSelector("[data-conversa-nome]");
  await p2.waitForTimeout(1200);

  const m = await p2.evaluate(() => {
    const linha = document.querySelector("[data-linha-da-marca]");
    const fita = document.querySelector("[data-fita-de-filtros]");
    const topo = document.querySelector("[data-topo-da-coluna]");
    const prim = document.querySelector("[data-conversa-nome]");
    if (!linha || !fita || !topo || !prim) return null;
    const caixa = linha.children[0];
    // O ALVO DE DEDO: o menor dos botões desta linha não pode ter encolhido.
    const botoes = [...linha.querySelectorAll("button")]
      .map((b) => Math.round(Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)));
    return {
      caixa: Math.round(caixa.getBoundingClientRect().width),
      conteudo: Math.round(caixa.firstElementChild.scrollWidth),
      diz: caixa.innerText.replace(/\s+/g, " ").trim(),
      menorBotao: Math.min(...botoes),
      linhasDaFita: new Set([...fita.children].map((c) => Math.round(c.getBoundingClientRect().top))).size,
      altura: Math.round(prim.getBoundingClientRect().top - topo.getBoundingClientRect().top),
    };
  });
  ok("consegui medir o topo no celular", !!m);
  ok("a marca cabe inteira também no celular",
     m && m.conteudo <= m.caixa + 1, JSON.stringify(m));
  ok("e continua escrevendo o nome todo",
     m && /Ropelimi/.test(m.diz) && /Zorvin/.test(m.diz), m && m.diz);
  // E ISTO NÃO PODE SER O PREÇO DAQUILO. Apertar o botão até a marca caber
  // seria trocar um defeito que se vê por um que se sente: toque que erra.
  ok("e os botões continuam com 40px de alvo de dedo",
     m && m.menorBotao >= 40, m && `o menor tinha ${m.menorBotao}px`);
  // NO CELULAR A FITA CONTINUA EM DUAS LINHAS, e isto está medido, não
  // suposto: o vão útil ali são 307px e as quatro pílulas pedem 324. Na `main`
  // eram duas linhas também, com CINCO pílulas — então não piorou; o que não
  // pode é virar TRÊS, que é onde uma pílula nova empurraria. Apertar as
  // quatro até caberem deixaria 2px de folga e quebraria no primeiro contador
  // de três dígitos, que é o dia movimentado.
  ok("a fita não passa de duas linhas no celular", m && m.linhasDaFita <= 2,
     m && `${m.linhasDaFita} linhas`);
  // E O TOPO ENCOLHEU AQUI TAMBÉM: 315px na `main`, 281 agora. O teto em 300
  // fica entre os dois — cabe o que é, reprova o que era.
  ok("e o topo do celular cabe em menos de 300px", m && m.altura < 300,
     m && `medi ${m.altura}px`);

  // A ORDEM EXISTE NO CELULAR TAMBÉM, e escreve o estado como no computador —
  // só que morando na fita, que é onde ESTE layout tem folga. Um controle que
  // some num tamanho de tela é um recurso que metade da equipe não tem.
  const ordemCel = p2.locator("[data-ordem]");
  ok("o controle da ordem existe no celular", await ordemCel.count() === 1);
  ok("e escreve a ordem aqui também",
     /recentes|antigas/i.test((await ordemCel.innerText()).trim()),
     `dizia: "${(await ordemCel.innerText()).trim()}"`);
  // E ELE ESTÁ NA FITA, e não na linha da marca: é disso que depende a marca
  // caber. Conferir só "existe" deixaria passar a versão que o põe de volta lá
  // em cima e corta o nome de novo.
  const ondeMora = await p2.evaluate(() => {
    const b = document.querySelector("[data-ordem]");
    return { naLinhaDaMarca: !!b.closest("[data-linha-da-marca]"),
             naFita: !!b.closest("[data-fita-de-filtros]") };
  });
  ok("e no celular ele mora na fita, não na linha da marca",
     ondeMora.naFita && !ondeMora.naLinhaDaMarca, JSON.stringify(ondeMora));

  await ordemCel.click();
  await p2.waitForTimeout(350);
  await p2.locator('[data-ordem-opcao="antigas"]').click();
  await p2.waitForTimeout(1200);
  ok("e trocar por ele funciona no celular",
     /antigas/i.test((await ordemCel.innerText()).trim()),
     `dizia: "${(await ordemCel.innerText()).trim()}"`);

  ok("sem erro de JavaScript no celular", errosCel.length === 0, errosCel.join(" | "));
  await cel.close();
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
