// O CAMPO DE GRUPOS — a setinha do fim da fita, como no WhatsApp Web.
//
// PEDIDO DO RODRIGO, 16/09, com a tela do WhatsApp Web ao lado: lá a fita de
// filtros termina numa seta que abre "Grupos". A equipe já conhece o gesto.
//
// ------------------------------------------------------------
// O QUE É UM GRUPO, AQUI DENTRO
//
// O WhatsApp entrega grupo com um identificador no lugar do telefone, e a
// ponte grava isso em `contatos.numero` com o prefixo `grupo:`. Não existe
// coluna dizendo "isto é um grupo" — o prefixo É a marca, e por isso este
// recurso não precisou de nenhum SQL para existir.
//
// ------------------------------------------------------------
// A CONFERÊNCIA QUE MAIS IMPORTA É A DO GRUPO LÁ NO FUNDO
//
// A lista vem do banco em páginas de 200 conversas, das mais recentes para as
// mais antigas. Um grupo parado há dois meses está a cinco páginas de
// distância — e filtrar só o que já está na tela mostraria "os grupos entre as
// 200 conversas mais recentes" com cara de "os grupos".
//
// Essa é a armadilha nº 2 com outra roupa: uma lista curta que se lê como
// completa. Quem procura o grupo do mutirão e não o encontra conclui que ele
// não existe no Zorvin — e vai procurá-lo no celular.
//
// ------------------------------------------------------------
// E A FITA NÃO PODE QUEBRAR EM DUAS LINHAS
//
// Medido ontem: a fita tem 356px de vão e comporta QUATRO pílulas. Medido hoje,
// com a seta ao lado da pílula de etiquetas: 379px, e ela quebrou. É por isso
// que a seta ABSORVEU as etiquetas em vez de ficar ao lado delas — e é também
// o que o WhatsApp Web faz, onde aquela seta é a gaveta dos filtros que não
// cabem na linha.
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
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1600);

const GRUPO_PERTO = "ACORDOS — EQUIPE";
const GRUPO_FUNDO = "MUTIRÃO INSS 2024";

const nomesNaLista = () => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome") || e.textContent.trim()));

/** Quantas linhas a fita de filtros ocupa, e o que há nela. */
const fita = () => page.evaluate(() => {
  const f = document.querySelector("[data-fita-de-filtros]");
  if (!f) return null;
  const filhos = [...f.children].map((c) => ({
    w: Math.round(c.getBoundingClientRect().width),
    t: Math.round(c.getBoundingClientRect().top),
    txt: (c.innerText || "").trim(),
  }));
  return { linhas: new Set(filhos.map((x) => x.t)).size, filhos };
});

const abrirMenu = async () => {
  await page.locator("[data-mais-filtros]").click();
  await page.waitForTimeout(350);
};

// ------------------------------------------------------------------
console.log("\nA setinha está no fim da fita, e a fita continua numa linha só");
{
  ok("a setinha existe", await page.locator("[data-mais-filtros]").count() === 1);
  const f = await fita();
  ok("a fita cabe numa linha", f && f.linhas === 1, JSON.stringify(f));
  // DESLIGADA ELA É SÓ A SETA, e isso não é economia de gosto: escrita, ela
  // custa 84px num vão que tem 78 de sobra. É a diferença entre caber e
  // quebrar a fita em duas linhas de novo, no dia seguinte ao conserto.
  const so = f && f.filhos[f.filhos.length - 1];
  ok("e desligada ela não gasta uma palavra", so && so.txt === "", JSON.stringify(so));
}

// ------------------------------------------------------------------
console.log("\nA setinha abre o menu, com Grupos e com as etiquetas");
{
  await abrirMenu();
  ok("o menu abre", await page.locator("[data-menu-mais-filtros]").count() === 1);
  const texto = (await page.locator("[data-menu-mais-filtros]").innerText()).replace(/\s+/g, " ");
  ok("e oferece Grupos", /Grupos/.test(texto), texto.slice(0, 200));
  // AS ETIQUETAS NÃO PODEM TER SUMIDO NO CAMINHO. Elas tinham pílula própria
  // antes desta mudança; se a seta as engoliu sem levá-las junto, um recurso
  // inteiro do painel desapareceu sem ninguém pedir.
  ok("e as etiquetas continuam aqui dentro",
     /Todas as conversas/.test(texto) && /Gerenciar etiquetas/.test(texto),
     texto.slice(0, 300));
  // O CONTADOR, como no WhatsApp Web: responde "vale a pena entrar agora?"
  // antes do clique.
  const selo = page.locator("[data-nao-lidas-grupos]");
  ok("e diz quantos grupos têm mensagem não lida",
     await selo.count() === 1 && Number(await selo.innerText()) > 0,
     `achei ${await selo.count()}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

// ------------------------------------------------------------------
console.log("\nEscolhendo Grupos, a lista mostra só os grupos");
{
  const antes = await nomesNaLista();
  ok("antes, a lista tem gente que não é grupo",
     antes.length > 1 && antes.some((n) => !/EQUIPE|MUTIRÃO/.test(n)),
     JSON.stringify(antes.slice(0, 4)));

  await abrirMenu();
  await page.locator("[data-grupos-opcao]").click();
  await page.waitForTimeout(1600);

  const depois = await nomesNaLista();
  ok("o grupo está na lista", depois.some((n) => n.includes(GRUPO_PERTO)),
     JSON.stringify(depois));
  // E NADA ALÉM DELE. Sem esta, "mostrar os grupos" passaria numa tela que não
  // filtrou nada e só por acaso tinha o grupo no alto.
  ok("e mais ninguém", depois.every((n) => /EQUIPE|MUTIRÃO/.test(n)),
     JSON.stringify(depois));

  // LIGADA, A SETA ESCREVE O QUE ESTÁ VALENDO. Uma lista que ficou curta sem
  // nada na tela dizendo por quê é a lista que parece quebrada.
  const f = await fita();
  const pilula = f && f.filhos[f.filhos.length - 1];
  ok("a seta virou uma pílula escrita", pilula && /Grupos/.test(pilula.txt),
     JSON.stringify(pilula));
  ok("e a fita CONTINUA numa linha só", f && f.linhas === 1, JSON.stringify(f));
}

// ------------------------------------------------------------------
console.log("\nE dá para desfazer, pelo mesmo caminho por onde se ligou");
{
  // O DESFAZER MORA NO MENU, e não num "×" na pílula. A pílula é o gatilho do
  // menu desde sempre — é assim que ela se comporta com uma etiqueta escolhida
  // —, e dar a ela dois significados conforme o filtro que está ligado faria o
  // mesmo clique abrir um menu num caso e apagar o filtro no outro.
  //
  // Escrevi a prova esperando o "×" primeiro, e ela reprovou com a lista
  // filtrada na mão: era a prova descrevendo um desenho que o painel não tem.
  await abrirMenu();
  ok("o item de grupos está marcado", await page.evaluate(() =>
       document.querySelector("[data-grupos-opcao]")?.getAttribute("aria-selected") === "true"));
  await page.locator("[data-grupos-opcao]").click();
  await page.waitForTimeout(1600);
  const voltou = await nomesNaLista();
  ok("desmarcando, a lista inteira volta",
     voltou.length > 1 && voltou.some((n) => !/EQUIPE|MUTIRÃO/.test(n)),
     JSON.stringify(voltou.slice(0, 4)));
  // E A PÍLULA VOLTA A SER SETA — senão a tela continuaria dizendo que filtra
  // alguma coisa depois de ter parado.
  const f = await fita();
  const so = f && f.filhos[f.filhos.length - 1];
  ok("e a pílula volta a ser só a seta", so && so.txt === "", JSON.stringify(so));
}

// ------------------------------------------------------------------
console.log("\nE o grupo que está a cinco páginas de distância também aparece");
{
  // O TELEFONE DE 1200 CONVERSAS. O grupo dele está na posição ~1150, muito
  // além das 200 que a primeira página traz: filtrar só o que está carregado
  // não o alcança nunca.
  const alvo = page.locator('[data-telefone="Arquivo"]');
  ok("achei o telefone do fundo", await alvo.count() > 0);
  await alvo.first().click();
  await page.waitForTimeout(2500);

  const carregadas = await nomesNaLista();
  // O RETRATO DE ANTES, e é ele que dá sentido ao resto: o grupo NÃO está na
  // lista carregada. Sem esta conferência, a de baixo passaria num telefone em
  // que ele estava na tela desde o começo.
  ok("o grupo do fundo NÃO está entre as conversas carregadas",
     !carregadas.some((n) => n.includes(GRUPO_FUNDO)),
     `${carregadas.length} carregadas`);

  await abrirMenu();
  await page.locator("[data-grupos-opcao]").click();
  await page.waitForTimeout(2500);

  const comFiltro = await nomesNaLista();
  ok("e mesmo assim ele aparece quando se filtra por grupos",
     comFiltro.some((n) => n.includes(GRUPO_FUNDO)), JSON.stringify(comFiltro));
}

// ------------------------------------------------------------------
console.log("\nE um telefone sem grupo nenhum diz isso, em vez de mentir");
{
  // "NENHUMA CONVERSA AINDA" COM O FILTRO LIGADO seria sobre o telefone, e a
  // pessoa acabou de ver a lista cheia dois cliques atrás. A frase tem de
  // falar do que ela pediu.
  const outro = page.locator('[data-telefone="Acordos 2"]');
  if (await outro.count()) {
    await outro.first().click();
    await page.waitForTimeout(2000);
    await abrirMenu();
    await page.locator("[data-grupos-opcao]").click();
    await page.waitForTimeout(2000);
    const recado = page.locator("[data-recado-da-lista]");
    const marca = await recado.count() ? await recado.getAttribute("data-recado-da-lista") : null;
    ok("a tela diz que não há grupo NESTE telefone", marca === "sem-grupo",
       `a marca era "${marca}"`);
  } else {
    ok("achei o segundo telefone para a conferência do vazio", false,
       'não achei [data-telefone="Acordos 2"]');
  }
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
