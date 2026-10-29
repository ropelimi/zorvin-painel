// O OLHO DA SENHA CABE O DEDO — a tela de entrada no celular (auditoria de 28/10)
//
// O botão "Mostrar senha" tinha 26×26 pixels: o ícone de 18 e 4 de folga em
// volta. A casa adota 40 como o mínimo para o toque (`dedosCabem`, em
// `celular.mjs`) — abaixo disso o dedo erra, e errar aqui é tocar no campo da
// senha em vez de no olho, ou não acertar nada, na primeira tela que a equipe
// toca todo dia. A prova do celular nunca passou por esta tela: ela sobe
// logada.
//
// O conserto aumenta o ALVO e não o DESENHO: o ícone fica onde estava, o
// campo da senha continua da altura do campo do usuário.
//
// O ALVO DE 40 VEIO PELA AUDITORIA DE 27/10, com largura e altura mínimas, e
// não pela folga. Com a margem só à direita, o ícone andava 3 pontos no
// computador e 7 no celular, onde encostava na borda do campo — é o que esta
// prova pega. Por isso o "antes" zera também os mínimos: sem isso ele
// continuava com 40, e não era o desenho de antes.
//
// O QUE ESTA PROVA GUARDA, no celular e no computador:
//   1. o botão tem pelo menos 40×40;
//   2. o ícone não sai do lugar — o mesmo ponto que ocupava com a folga
//      antiga — e o campo não cresce;
//   3. um toque na beirada do alvo novo (fora dos 26 antigos) mostra a senha.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const estouros = [];

for (const [onde, largura, altura] of [["celular", 390, 844], ["computador", 1280, 800]]) {
  console.log(`\nNo ${onde} (${largura}px)`);
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, hasTouch: largura < 500 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => estouros.push(`${onde}: ${e.message}`));
  // A bancada sobe logada; sem sessão, a tela de entrada é a que abre.
  await page.addInitScript(() => { globalThis.__DESLOGADO = true; });
  await page.goto(ENDERECO);
  await page.waitForSelector('button[type="submit"]');

  const m = await page.evaluate(() => {
    const b = document.querySelector('button[title="Mostrar senha"]');
    const usuario = document.querySelector("input");
    if (!b || !usuario) return null;
    const svg = b.querySelector("svg");
    const campo = b.parentElement;
    const caixa = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const agora = { botao: caixa(b), icone: caixa(svg), campo: caixa(campo), usuario: caixa(usuario.parentElement) };
    // O DESENHO DE ANTES, medido na mesma tela: a folga antiga (4px, sem
    // margem e sem os mínimos de 40) devolvida ao botão por um instante. O
    // ícone tem de estar no mesmo ponto nas duas — é o "sem mudar o desenho"
    // posto em número. O estilo inteiro volta depois, como estava.
    const guardado = b.getAttribute("style");
    Object.assign(b.style, { padding: "4px", margin: "0px", minWidth: "0px", minHeight: "0px" });
    const antes = { icone: caixa(svg), campo: caixa(campo) };
    b.setAttribute("style", guardado);
    return { agora, antes, rolaDeLado: document.documentElement.scrollWidth > window.innerWidth };
  });
  ok("achei o botão de mostrar a senha", !!m);
  if (m) {
    const { botao, icone, campo, usuario } = m.agora;
    // ARREDONDADO: a caixa cai em posição fracionária (a borda do campo tem
    // 1,5px), e o navegador a mede com 39,99997 — o mesmo 40 de desenho.
    ok("o botão tem pelo menos 40×40", Math.round(botao.w) >= 40 && Math.round(botao.h) >= 40,
       `tinha ${botao.w.toFixed(2)}×${botao.h.toFixed(2)}`);
    ok("o ícone continua no mesmo lugar",
       Math.abs(icone.x - m.antes.icone.x) < 0.5 && Math.abs(icone.y - m.antes.icone.y) < 0.5,
       `agora em ${icone.x.toFixed(1)},${icone.y.toFixed(1)}; antes em ${m.antes.icone.x.toFixed(1)},${m.antes.icone.y.toFixed(1)}`);
    ok("o campo da senha não cresceu", Math.abs(campo.h - m.antes.campo.h) < 0.5 && Math.abs(campo.h - usuario.h) < 0.5,
       `senha ${campo.h}, antes ${m.antes.campo.h}, usuário ${usuario.h}`);
    ok("e a tela não rola de lado", !m.rolaDeLado);

    // O TOQUE NA BEIRADA: 17px acima e à esquerda do centro do ícone — dentro
    // dos 40 (20 para cada lado) e fora dos 26 antigos (13 para cada lado).
    await page.locator('input[type="password"]').fill("segredo");
    await page.mouse.click(icone.x + icone.w / 2 - 17, icone.y + icone.h / 2 - 17);
    await page.waitForTimeout(200);
    const tipo = await page.locator("form input").nth(1).getAttribute("type").catch(() => null);
    ok("um toque na beirada do alvo mostra a senha", tipo === "text", `o campo ficou "${tipo}"`);
  }
  await ctx.close();
}

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
