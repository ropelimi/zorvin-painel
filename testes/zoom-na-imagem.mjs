// DAR ZOOM NA IMAGEM PARA CONSEGUIR LER.
//
// PEDIDO DO ESCRITÓRIO: "no Zorvin, ao clicar para abrir uma imagem que eu
// recebi ou enviei, preciso que tenha a opção de dar zoom para melhorar a
// leitura".
//
// O QUE CHEGA POR ALI o dia inteiro: procuração fotografada de lado, RG
// amassado, print de conversa com letra de seis pixels, comprovante de
// depósito, receituário escrito à mão. A tela abria a imagem inteira e ela
// cabia — e era por CABER que não dava para ler. Uma foto de 3000 pixels
// desenhada em 1200 perdeu dois terços do que tinha.
//
// QUATRO MANEIRAS DE AMPLIAR, e são quatro de propósito: quem usa isto vai de
// uma criança de oito anos a uma pessoa de oitenta, no computador e no celular.
//
//   os BOTÕES  o único caminho que se DESCOBRE olhando. Os outros três só
//              servem para quem já os conhece.
//   a PINÇA    o gesto do celular, onde metade do escritório atende.
//   o DUPLO    toque ou clique: aproxima e devolve, como no WhatsApp.
//   o TECLADO  + − 0, para quem já está com a mão ali.
//
// E DUAS COISAS QUE NÃO PODEM QUEBRAR JUNTO, porque essa tela já tem dono:
// a galeria (setas e fita) e o clique no preto que fecha.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { ZOOM_MIN, ZOOM_MAX, ZOOM_PARADO, ZOOM_DO_TOQUE_DUPLO, DEGRAUS,
         limitarEscala, degrauSeguinte, porcentagem, limiteDeArrasto,
         limitarPosicao, zoomAncorado, distancia } from "../src/zoom.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const perto = (a, b, folga = 0.5) => Math.abs(a - b) <= folga;

// ============================================================
//  AS CONTAS, sem navegador
// ============================================================

console.log("\nOs limites da escala");
{
  ok("não encolhe abaixo do tamanho normal", limitarEscala(0.2) === ZOOM_MIN);
  ok("e não passa do teto", limitarEscala(99) === ZOOM_MAX);
  // O TETO NÃO É GOSTO: é o ponto em que o pixel vira um quadrado visível.
  // Sem ele, a pessoa continuaria apertando "+" e a letra continuaria
  // ilegível, agora maior — e ela concluiria que o sistema quebrou.
  ok("o teto é seis vezes", ZOOM_MAX === 6);
  ok("lixo vira tamanho normal, e não NaN",
     limitarEscala(undefined) === ZOOM_MIN && limitarEscala("abc") === ZOOM_MIN);
}

console.log("\nOs degraus dos botões");
{
  // Degraus fixos, e não multiplicação: um "+" que multiplica por 1,2 dá 120%,
  // 144%, 173%, 207% — números que não dizem nada e que nunca voltam a 100%
  // redondo. Para quem está tentando ler um CPF, previsível vale mais que suave.
  ok("do normal, o + leva a 150%", degrauSeguinte(1, 1) === 1.5);
  ok("e de 150% a 200%", degrauSeguinte(1.5, 1) === 2);
  ok("o − desfaz exatamente o +", degrauSeguinte(degrauSeguinte(2, 1), -1) === 2);
  // SEM DAR A VOLTA, nos dois extremos. Voltar ao começo sem aviso faria a
  // imagem saltar de seis vezes para o tamanho normal num toque dado para
  // ampliar.
  ok("no teto, o + não dá a volta", degrauSeguinte(ZOOM_MAX, 1) === ZOOM_MAX);
  ok("no normal, o − não dá a volta", degrauSeguinte(ZOOM_MIN, -1) === ZOOM_MIN);
  ok("um valor solto cai no degrau certo", degrauSeguinte(2.4, 1) === 3
     && degrauSeguinte(2.4, -1) === 2, String(degrauSeguinte(2.4, -1)));
  ok("os degraus começam no tamanho normal", DEGRAUS[0] === ZOOM_MIN);
  ok("a porcentagem é redonda", porcentagem(1) === 100 && porcentagem(1.5) === 150);
}

console.log("\nAté onde dá para arrastar");
{
  // Metade do que sobra: a imagem ampliada mede tamanho × escala, o buraco mede
  // o visor, e a diferença se reparte entre os dois lados.
  ok("imagem de 1000 em visor de 1000, ampliada 2x, arrasta 500 para cada lado",
     limiteDeArrasto(1000, 1000, 2) === 500);
  // A METADE QUE PROTEGE, e o erro clássico: sem o `max(0, …)`, uma imagem
  // menor que a tela ganharia limite NEGATIVO — e aí NENHUMA posição seria
  // válida. A imagem ficaria presa, tremendo, no meio da tela.
  ok("imagem que CABE no visor não arrasta nada", limiteDeArrasto(400, 1000, 1) === 0);
  ok("nem quando é bem menor", limiteDeArrasto(200, 1000, 1.5) === 0);

  const imagem = { largura: 1000, altura: 600 }, visor = { largura: 1000, altura: 600 };
  // OS DOIS SENTIDOS DE CADA EIXO, e o sinal preservado: arrastar muito para a
  // direita para na borda DIREITA, e muito para cima para na de CIMA. Um
  // `Math.abs` esquecido aqui grudaria a imagem sempre no mesmo canto.
  const preso = limitarPosicao({ x: 9999, y: -9999 }, imagem, visor, 2);
  ok("arrastar demais para na borda, e não descola",
     preso.x === 500 && preso.y === -300, JSON.stringify(preso));
  const oOutroLado = limitarPosicao({ x: -9999, y: 9999 }, imagem, visor, 2);
  ok("e para na do outro lado quando se arrasta para o outro lado",
     oOutroLado.x === -500 && oOutroLado.y === 300, JSON.stringify(oOutroLado));
  // OS DOIS EIXOS, com tamanhos diferentes. Um limite calculado só na
  // horizontal e reaproveitado na vertical passaria em metade das fotos e
  // erraria na outra metade — justamente nas altas, que é a forma de um
  // documento fotografado em pé.
  ok("o limite de cada eixo é o do SEU tamanho",
     limiteDeArrasto(1000, 1000, 2) !== limiteDeArrasto(600, 600, 2));
  const noNormal = limitarPosicao({ x: 300, y: 300 }, imagem, visor, 1);
  ok("no tamanho normal a imagem volta ao centro",
     noNormal.x === 0 && noNormal.y === 0, JSON.stringify(noNormal));
}

console.log("\nAmpliar segurando o ponto no lugar");
{
  // A conta que separa um zoom que serve de um que atrapalha. Quem aperta os
  // dedos em cima do CPF está dizendo "quero ver ISTO maior"; se a imagem
  // crescer a partir do centro, o CPF escapa da tela.
  const imagem = { largura: 1000, altura: 1000 }, visor = { largura: 1000, altura: 1000 };
  // Ponto no centro: nada se desloca.
  const doCentro = zoomAncorado(ZOOM_PARADO, 2, { x: 0, y: 0 }, imagem, visor);
  ok("ampliando pelo centro, a imagem não se desloca",
     doCentro.escala === 2 && doCentro.x === 0 && doCentro.y === 0, JSON.stringify(doCentro));

  // Ponto a 200px à direita do centro, dobrando: o pixel que estava ali tem de
  // continuar ali. x' = a − k(a − x) = 200 − 2(200 − 0) = −200.
  const noPonto = zoomAncorado(ZOOM_PARADO, 2, { x: 200, y: 0 }, imagem, visor);
  ok("ampliando num ponto, ele fica onde estava",
     perto(noPonto.x, -200) && noPonto.escala === 2, JSON.stringify(noPonto));
  // E O SINAL, que é o erro que faz a imagem correr para o lado ERRADO: um
  // ponto à esquerda tem de empurrar para o outro lado do de cima.
  const naEsquerda = zoomAncorado(ZOOM_PARADO, 2, { x: -200, y: 0 }, imagem, visor);
  ok("e do outro lado, para o outro lado",
     perto(naEsquerda.x, 200), JSON.stringify(naEsquerda));

  // VOLTAR AO NORMAL DEVOLVE A IMAGEM AO CENTRO, mesmo tendo sido arrastada.
  // Sem isto, quem apertasse "−" até 100% ficaria com a foto inteira encostada
  // num canto, com preto do outro lado.
  const arrastada = { escala: 4, x: 900, y: -700 };
  const devolta = zoomAncorado(arrastada, 1, { x: 0, y: 0 }, imagem, visor);
  ok("voltando ao tamanho normal, a imagem volta ao centro",
     devolta.escala === 1 && devolta.x === 0 && devolta.y === 0, JSON.stringify(devolta));

  ok("e o teto vale aqui também",
     zoomAncorado(ZOOM_PARADO, 99, { x: 0, y: 0 }, imagem, visor).escala === ZOOM_MAX);
}

console.log("\nA distância entre dois dedos");
{
  ok("três-quatro-cinco", distancia({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 }) === 5);
  ok("dedos no mesmo lugar dão zero",
     distancia({ clientX: 7, clientY: 7 }, { clientX: 7, clientY: 7 }) === 0);
}

// ============================================================
//  E AGORA A TELA
// ============================================================

const nav = await abrirNavegador();
const erros = [];

async function abrirAConversaComImagens(page) {
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1200);
}

const escalaAgora = (page) =>
  page.locator("[data-visor-zoom]").getAttribute("data-escala").then(Number);
const nivelEscrito = (page) => page.locator("[data-zoom-nivel]").innerText();

// ---- COMPUTADOR ----
{
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  await abrirAConversaComImagens(page);

  console.log("\n1. A imagem abre no tamanho normal, e os botões estão lá");
  {
    const bolhas = page.locator('button[aria-label="Abrir a imagem em tela cheia"]');
    ok("a conversa tem imagem para abrir", await bolhas.count() >= 2,
       `achei ${await bolhas.count()} — a galeria precisa de duas`);
    await bolhas.first().click();
    await page.waitForSelector("[data-visor-zoom]", { timeout: 4000 });
    ok("a imagem abriu em tela cheia", await page.locator("[data-visor-zoom]").count() === 1);
    ok("no tamanho normal", await escalaAgora(page) === 1);
    // OS BOTÕES SÃO O ÚNICO CAMINHO QUE SE DESCOBRE OLHANDO. Pinça, duplo
    // toque e teclado só servem para quem já sabe que existem.
    ok("o botão de aumentar está visível", await page.locator("[data-zoom-mais]").isVisible());
    ok("o de diminuir também", await page.locator("[data-zoom-menos]").isVisible());
    ok("e a porcentagem diz onde se está", (await nivelEscrito(page)).trim() === "100%");
  }

  console.log("\n2. O botão amplia, e a imagem ampliada é MESMO maior");
  {
    await page.locator("[data-zoom-mais]").click();
    await page.waitForTimeout(300);
    ok("a escala subiu para 150%", await escalaAgora(page) === 1.5,
       String(await escalaAgora(page)));
    ok("e a porcentagem acompanha", (await nivelEscrito(page)).trim() === "150%");
    // A PROVA QUE NÃO ACEITA MENTIRA: o número mudou, mas a imagem cresceu na
    // tela? Um `data-escala` certo com um `transform` esquecido passaria em
    // tudo o que está acima e não ampliaria nada.
    const largura = () => page.locator("[data-visor-zoom] img")
      .evaluate((e) => e.getBoundingClientRect().width);
    const a150 = await largura();
    await page.locator("[data-zoom-mais]").click();
    await page.waitForTimeout(300);
    const a200 = await largura();
    ok("a imagem na tela cresceu de verdade", a200 > a150 * 1.2,
       `${Math.round(a150)}px → ${Math.round(a200)}px`);
    ok("e está em 200%", await escalaAgora(page) === 2);
  }

  console.log("\n3. Voltar ao normal, que é a saída de quem se perdeu");
  {
    await page.locator("[data-zoom-nivel]").click();
    await page.waitForTimeout(300);
    ok("um toque na porcentagem devolve os 100%", await escalaAgora(page) === 1);
    // NO NORMAL, O "−" NÃO TEM O QUE FAZER e diz isso estando desabilitado.
    // Um botão que aceita o toque e não faz nada é pior: quem aperta conclui
    // que a tela travou.
    ok("e o '−' fica desabilitado", await page.locator("[data-zoom-menos]").isDisabled());
    ok("enquanto o '+' continua disponível",
       !(await page.locator("[data-zoom-mais]").isDisabled()));
  }

  console.log("\n4. O teclado, a rodinha e o clique duplo");
  {
    await page.keyboard.press("+");
    await page.waitForTimeout(250);
    ok("a tecla + amplia", await escalaAgora(page) > 1, String(await escalaAgora(page)));
    await page.keyboard.press("0");
    await page.waitForTimeout(250);
    ok("a tecla 0 devolve ao normal", await escalaAgora(page) === 1);

    await page.locator("[data-visor-zoom]").hover();
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(250);
    ok("a rodinha amplia", await escalaAgora(page) > 1, String(await escalaAgora(page)));
    await page.keyboard.press("0");
    await page.waitForTimeout(250);

    await page.locator("[data-visor-zoom] img").dblclick();
    await page.waitForTimeout(300);
    ok("o clique duplo aproxima", await escalaAgora(page) === ZOOM_DO_TOQUE_DUPLO,
       String(await escalaAgora(page)));
    await page.locator("[data-visor-zoom] img").dblclick();
    await page.waitForTimeout(300);
    ok("e o segundo devolve", await escalaAgora(page) === 1);
  }

  console.log("\n5. O teto e o piso existem na tela, e não só na conta");
  {
    // ATÉ O BOTÃO SE DESABILITAR, e não um número fixo de vezes. Um laço de
    // oito cliques ficaria preso no sexto — porque no teto o botão RECUSA o
    // toque, que é justamente o que se quer provar.
    for (let i = 0; i < 10; i++) {
      if (await page.locator("[data-zoom-mais]").isDisabled()) break;
      await page.locator("[data-zoom-mais]").click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(300);
    ok("apertando muito, para no teto", await escalaAgora(page) === ZOOM_MAX,
       String(await escalaAgora(page)));
    ok("e o '+' fica desabilitado", await page.locator("[data-zoom-mais]").isDisabled());
    ok("a porcentagem diz 600%", (await nivelEscrito(page)).trim() === "600%");
  }

  console.log("\n6. Arrastar a imagem ampliada — e não conseguir soltá-la da tela");
  {
    const caixa = await page.locator("[data-visor-zoom]").boundingBox();
    const cx = caixa.x + caixa.width / 2, cy = caixa.y + caixa.height / 2;
    const posicao = () => page.locator("[data-visor-zoom] img")
      .evaluate((e) => e.getBoundingClientRect().left);
    const antes = await posicao();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 160, cy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    ok("arrastar move a imagem", (await posicao()) > antes + 40,
       `${Math.round(antes)} → ${Math.round(await posicao())}`);

    // E O LIMITE. Arrastando muito além do que existe de foto, a borda não
    // pode descolar: uma faixa preta entrando pelo canto é a aparência
    // clássica de "quebrou".
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(cx - 200, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 400, cy, { steps: 4 });
      await page.mouse.up();
    }
    await page.waitForTimeout(200);
    const esquerda = await posicao();
    const visor = await page.locator("[data-visor-zoom]").boundingBox();
    ok("mas a imagem não descola da borda", esquerda <= visor.x + 1,
       `borda da imagem em ${Math.round(esquerda)}, visor começa em ${Math.round(visor.x)}`);
  }

  console.log("\n7. O que já existia nessa tela continua existindo");
  {
    // A TRAVA CONTRA O CONSERTO QUE TROCA UMA COISA POR OUTRA. Esta tela já
    // tinha dono: a galeria e o clique no preto que fecha.
    ok("a galeria continua lá (duas imagens na conversa)",
       await page.locator("[data-visor-zoom]").count() === 1
       && (await page.locator("body").innerText()).includes("de 2"));

    // TROCAR DE FOTO ZERA O ZOOM. Sem isso, a próxima abriria já cortada num
    // canto qualquer, e quem passa as fotos com a seta acharia que ela veio
    // errada do celular de quem mandou.
    ok("estamos ampliados antes de trocar", await escalaAgora(page) > 1);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    ok("a seta troca de imagem e o zoom VOLTA ao normal",
       await escalaAgora(page) === 1, String(await escalaAgora(page)));

    // O CLIQUE NO PRETO FECHA, como sempre fechou — mas só quando não há um
    // gesto em andamento.
    await page.locator("[data-zoom-mais]").click();
    await page.waitForTimeout(250);
    const caixa = await page.locator("[data-visor-zoom]").boundingBox();
    await page.mouse.click(caixa.x + 8, caixa.y + caixa.height / 2);
    await page.waitForTimeout(300);
    ok("com a foto ampliada, o clique NÃO fecha por acidente",
       await page.locator("[data-visor-zoom]").count() === 1);

    await page.keyboard.press("0");
    await page.waitForTimeout(250);
    await page.mouse.click(caixa.x + 8, caixa.y + caixa.height / 2);
    await page.waitForTimeout(400);
    ok("e no tamanho normal ele fecha, como sempre",
       await page.locator("[data-visor-zoom]").count() === 0);
  }

  await ctx.close();
}

// ---- CELULAR ----
//
// O escritório atende muito pelo telefone, e é lá que a pinça é o gesto
// natural — não há rodinha nem teclado. 390 pixels é o iPhone que a equipe usa.
{
  const ctx = await nav.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push("pageerror (celular): " + e.message));
  await abrirAConversaComImagens(page);

  console.log("\n8. No celular: os botões cabem e o dedo os acerta");
  {
    const bolhas = page.locator('button[aria-label="Abrir a imagem em tela cheia"]');
    await bolhas.first().click();
    await page.waitForSelector("[data-visor-zoom]", { timeout: 4000 });

    for (const [nome, sel] of [["aumentar", "[data-zoom-mais]"],
                               ["diminuir", "[data-zoom-menos]"],
                               ["porcentagem", "[data-zoom-nivel]"]]) {
      const b = await page.locator(sel).boundingBox();
      // QUARENTA E DOIS PIXELS é o alvo que um dedo acerta sem mirar. Abaixo
      // de quarenta, quem tem a mão trêmula erra — e é justamente essa pessoa
      // que mais precisa de zoom.
      ok(`o botão de ${nome} tem alvo de dedo`, b && b.height >= 40 && b.width >= 40,
         b ? `${Math.round(b.width)}×${Math.round(b.height)}` : "não achei");
      ok(`o botão de ${nome} cabe na tela de 390`, b && b.x >= 0 && b.x + b.width <= 390,
         b ? `de ${Math.round(b.x)} a ${Math.round(b.x + b.width)}` : "não achei");
    }
    // E NÃO EM CIMA DO FECHAR: são os botões que a pessoa aperta várias vezes
    // seguidas, e um deles vizinho ao "fechar" acabaria fechando a foto no
    // meio da leitura.
    const mais = await page.locator("[data-zoom-mais]").boundingBox();
    ok("e ficam longe do canto do fechar", mais.x + mais.width < 390 / 2,
       `terminam em ${Math.round(mais.x + mais.width)}`);
  }

  console.log("\n9. A pinça amplia a foto — e não a página");
  {
    ok("começa no tamanho normal", await escalaAgora(page) === 1);
    // Dois dedos afastando-se, despachados como o navegador os despacha. O
    // Playwright só sabe tocar com UM dedo; a pinça precisa ser montada à mão.
    const impedido = await page.evaluate(() => {
      const el = document.querySelector("[data-visor-zoom]");
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dedo = (id, x, y) => new Touch({
        identifier: id, target: el, clientX: x, clientY: y,
        pageX: x, pageY: y, screenX: x, screenY: y,
      });
      const mandar = (tipo, dedos) => {
        const ev = new TouchEvent(tipo, {
          bubbles: true, cancelable: true,
          touches: dedos, targetTouches: dedos, changedTouches: dedos,
        });
        el.dispatchEvent(ev);
        return ev.defaultPrevented;
      };
      mandar("touchstart", [dedo(1, cx - 30, cy), dedo(2, cx + 30, cy)]);
      let barrou = false;
      for (let d = 60; d <= 240; d += 30) {
        barrou = mandar("touchmove", [dedo(1, cx - d / 2, cy), dedo(2, cx + d / 2, cy)]) || barrou;
      }
      mandar("touchend", []);
      return barrou;
    });
    await page.waitForTimeout(300);
    ok("afastar os dedos amplia a foto", await escalaAgora(page) > 1.5,
       String(await escalaAgora(page)));
    // A METADE QUE NINGUÉM VÊ: sem `preventDefault`, o NAVEGADOR amplia a
    // página inteira por baixo — os botões, a lista, tudo. No computador de
    // quem programa isso nunca aparece, porque ali se usa o teclado.
    ok("e o navegador é impedido de ampliar a página junto", impedido);

    // E A PINÇA DE VOLTA, aproximando os dedos.
    await page.evaluate(() => {
      const el = document.querySelector("[data-visor-zoom]");
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dedo = (id, x, y) => new Touch({
        identifier: id, target: el, clientX: x, clientY: y,
        pageX: x, pageY: y, screenX: x, screenY: y,
      });
      const mandar = (tipo, dedos) => el.dispatchEvent(new TouchEvent(tipo, {
        bubbles: true, cancelable: true,
        touches: dedos, targetTouches: dedos, changedTouches: dedos,
      }));
      mandar("touchstart", [dedo(1, cx - 120, cy), dedo(2, cx + 120, cy)]);
      for (let d = 240; d >= 20; d -= 30) {
        mandar("touchmove", [dedo(1, cx - d / 2, cy), dedo(2, cx + d / 2, cy)]);
      }
      mandar("touchend", []);
    });
    await page.waitForTimeout(300);
    ok("aproximar os dedos devolve ao tamanho normal", await escalaAgora(page) === 1,
       String(await escalaAgora(page)));
  }

  await ctx.close();
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
