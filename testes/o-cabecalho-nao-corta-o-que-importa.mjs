// O CABEÇALHO NÃO CORTA O QUE IMPORTA
//
// DOIS RELATOS DO RODRIGO EM 29/09, com foto, e uma coisa em comum: alguma
// coisa da tela aparecia PELA METADE.
//
//   1. "quando clico em marcar tags não estão aparecendo as tags, está com
//      algum erro no layout" — o menu abria e só a faixa "MARCAR TAGS"
//      aparecia. MEDIDO: ele pedia 139px de altura e mostrava 21.
//
//      A causa era minha, de 28/09: pus `overflow: hidden` no cabeçalho como
//      ENCOSTO contra ele pintar por cima da ficha. `overflow: hidden`
//      recorta TODOS os descendentes, e os menus daquele cabeçalho são
//      descendentes. O encosto nunca chegou a ser necessário — a fila é
//      `flex` e, faltando espaço, ela espreme o nome em vez de transbordar —,
//      então ele só cobrava, sem pagar nada.
//
//   2. "com a ficha aberta o nome do cliente está sendo cortado" — a tela
//      dizia "ELANE GO…". MEDIDO com a ficha aberta, e repare no degrau:
//
//        janela 1280 -> conversa 528 -> ícones   -> o nome recebe 166
//        janela 1366 -> conversa 614 -> ícones   -> o nome recebe 252
//        janela 1440 -> conversa 688 -> ESCRITOS -> o nome recebe 199
//
//      Alargar a janela PIORAVA o nome. O teto de 620 que decidia isso não
//      perguntava nada sobre o nome, e quem pagava a diferença era ele.
//
// O QUE ESTA PROVA DEFENDE, e a ordem importa: primeiro que nada aparece
// cortado, e depois que "caber" não virou "esconder". São coisas diferentes,
// e a segunda é a que o Rodrigo pediu com todas as letras: "sem ocultar
// informações importantes".
//
// E A RÉGUA É O QUE ESTÁ PINTADO, não o retângulo. `getBoundingClientRect`
// devolve a caixa que o elemento PEDE; ela não sabe que um ancestral está
// recortando. Foi assim que o menu de tags media 139px de altura enquanto a
// pessoa via 21. Por isso as cenas de menu perguntam ao navegador quem está
// desenhado naquele ponto (`elementFromPoint`).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// O nome do cliente e o número dele moram no mesmo bloco, e é esse bloco que
// encolhia. 230px é o piso: medido com a régua do navegador, na fonte da
// tela, "ANDREIA CRISTINA MARTINS" pede 225 e "ELANE GOMES TEIXEIRA" 194.
const NOME_MINIMO = 230;

const nav = await abrirNavegador();

/** Abre o painel numa largura, com a primeira conversa aberta. */
async function abrir(L) {
  const ctx = await nav.newContext({ viewport: { width: L, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(900);
  return { ctx, page, estouros };
}

/** O que está PINTADO no pé deste menu? É a pergunta que pega o recorte. */
const peDoMenuAparece = (page, seletor) => page.evaluate((s) => {
  const m = document.querySelector(s);
  if (!m) return null;
  const r = m.getBoundingClientRect();
  const quem = document.elementFromPoint(Math.round(r.left + r.width / 2),
                                         Math.round(r.bottom - 6));
  return { pede: Math.round(r.height), pintado: !!(quem && m.contains(quem)) };
}, seletor);

// ------------------------------------------------------------------
console.log("\n1. O menu de etiquetas abre INTEIRO — foi o relato da foto");
{
  // 1600 é uma largura em que a fila vem solta, com o botão de etiqueta no
  // cabeçalho. É o caminho exato da foto do Rodrigo.
  const { ctx, page, estouros } = await abrir(1600);
  // O CLIQUE É GUARDADO, e isto não é zelo: `locator.click()` num elemento que
  // não existe ESTOURA a prova inteira depois de 30s, e uma prova que estoura
  // não diz QUAL conferência pegou o defeito — some a lista toda. Já custou
  // caro aqui em 28/09, quando quase consertei o painel por causa disso.
  const botao = page.locator('[data-topo-conversa] [aria-label="Etiquetas"]');
  const temBotao = await botao.count() === 1;
  ok("o botão de etiquetas está no cabeçalho", temBotao);
  if (temBotao) { await botao.click(); await page.waitForTimeout(400); }

  const menu = !temBotao ? null : await page.evaluate(() => {
    const m = [...document.querySelectorAll("div")].find(
      (d) => /MARCAR TAGS/.test(d.innerText || "") && getComputedStyle(d).position === "absolute");
    if (!m) return null;
    m.setAttribute("data-menu-de-tags", "");
    return true;
  });
  ok("o menu abriu", !!menu);
  const visto = await peDoMenuAparece(page, "[data-menu-de-tags]");
  ok("ele tem altura de menu, e não de faixa", visto && visto.pede > 60,
     JSON.stringify(visto));
  ok("e o PÉ dele está desenhado na tela, não recortado",
     visto && visto.pintado, JSON.stringify(visto));
  ok("o cabeçalho não recorta os filhos",
     await page.evaluate(() =>
       getComputedStyle(document.querySelector("[data-topo-conversa]")).overflow !== "hidden"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. O nome do cliente nunca é espremido abaixo do piso");
{
  // A ESCADA INTEIRA, e ela tem de ser sensata nos dois sentidos: alargar a
  // janela não pode piorar o nome, que era o defeito de 1440.
  const escada = [];
  for (const L of [1180, 1280, 1366, 1440, 1600, 1920]) {
    const { ctx, page } = await abrir(L);
    const m = await page.evaluate(() => {
      const topo = document.querySelector("[data-topo-conversa]");
      const bloco = [...topo.children].find((c) => getComputedStyle(c).flexGrow !== "0");
      return {
        conversa: Math.round(topo.getBoundingClientRect().width),
        nome: Math.round(bloco.getBoundingClientRect().width),
        recolhido: !!topo.querySelector('[aria-label="Mais opções desta conversa"]'),
        escrito: /Marcar como (não )?lida/i.test(topo.innerText || ""),
      };
    });
    escada.push({ L, ...m });
    await ctx.close();
  }
  for (const e of escada) {
    console.log(`     ${String(e.L).padStart(4)} -> conversa ${String(e.conversa).padStart(4)}`
      + ` | ${e.recolhido ? "⋮ recolhido" : e.escrito ? "escritos   " : "ícones     "}`
      + ` | nome ${e.nome}`);
  }
  // O TAMANHO VAI JUNTO no `.every`, e não é preciosismo: numa lista vazia
  // ele devolve `true`, e a conferência passaria sem conferir nada. É a
  // armadilha que o vigia `provas-que-reprovam` existe para pegar — e pegou
  // esta, na integração contínua.
  ok(`o nome tem pelo menos ${NOME_MINIMO}px em TODAS as larguras`,
     escada.length === 6 && escada.every((e) => e.nome >= NOME_MINIMO),
     JSON.stringify({ medidas: escada.length,
                      abaixoDoPiso: escada.filter((e) => e.nome < NOME_MINIMO) }));

  // E A FORMA SÓ ABRE, nunca volta a se fechar quando a janela cresce.
  //
  // ESCREVI ESTA CONFERÊNCIA ERRADA DA PRIMEIRA VEZ, e ela me reprovou com
  // razão: pedi que alargar a janela nunca ENCOLHESSE o espaço do nome. Mas
  // de 1280 para 1366 o nome cai de 444 para 252 — e está certo, porque ali
  // a fila sai do ⋮ e volta solta, o que só acontece quando o piso do nome
  // continua respeitado. A regra que eu tinha escrito proibia o
  // comportamento correto.
  //
  // O que de fato não pode acontecer são duas coisas, e as duas estão
  // conferidas: o nome abaixo do piso (acima), e a forma ANDAR PARA TRÁS —
  // uma janela maior mostrando menos do que uma menor. O defeito de 1440 era
  // do primeiro tipo: nome em 199, abaixo dos 230.
  const forma = (e) => e.recolhido ? 0 : e.escrito ? 2 : 1;
  const voltas = escada.slice(1)
    .map((e, i) => ({ de: escada[i].L, para: e.L, antes: forma(escada[i]), depois: forma(e) }))
    .filter((d) => d.depois < d.antes);
  ok("a fila só se abre conforme a janela cresce, nunca o contrário",
     escada.length === 6 && voltas.length === 0,
     JSON.stringify({ medidas: escada.length, voltas }));

  // E A ESCADA TEM DE TER OS TRÊS DEGRAUS. Sem isto, um painel que se
  // recolhesse SEMPRE passaria nas duas conferências de cima — e teria
  // trocado a fila inteira por um menu em telas onde ela cabia folgada.
  ok("nas telas pequenas a fila se recolhe no ⋮",
     escada.find((e) => e.L === 1280)?.recolhido === true);
  ok("nas médias ela volta, em ícone",
     escada.find((e) => e.L === 1440)?.recolhido === false
     && escada.find((e) => e.L === 1440)?.escrito === false);
  ok("e nas grandes os rótulos vêm escritos",
     escada.find((e) => e.L === 1920)?.escrito === true);
}

// ------------------------------------------------------------------
console.log("\n3. Recolher NÃO é esconder — o ⋮ diz o nome de cada ação");
{
  // É o pedido do Rodrigo em uma frase: "sem ocultar informações
  // importantes". Recolhido, o cabeçalho mostra menos BOTÕES e mais
  // PALAVRAS: o que era um ícone mudo vira um item escrito por extenso.
  const { ctx, page, estouros } = await abrir(1280);
  const tres = page.locator('[aria-label="Mais opções desta conversa"]');
  const temTres = await tres.count() === 1;
  ok("a 1280 com a ficha aberta, o ⋮ está lá", temTres);
  if (temTres) { await tres.click(); await page.waitForTimeout(400); }

  const texto = !temTres ? "" : (await page.locator("[data-menu-conversa]").innerText()).replace(/\s+/g, " ");
  for (const [oQue, regra] of [
    ["marcar como lida ou não lida", /marcar como (não )?lida/i],
    ["a ficha do cliente", /ficha/i],
    ["o histórico de atendimento", /histórico/i],
    ["as etiquetas", /etiquetas/i],
    ["buscar na conversa", /buscar/i],
  ]) ok(`o menu escreve: ${oQue}`, regra.test(texto), texto.slice(0, 200));

  const visto = await peDoMenuAparece(page, "[data-menu-conversa]");
  ok("e o menu aparece inteiro", visto && visto.pintado, JSON.stringify(visto));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. O menu de mais filtros cai DENTRO da coluna");
{
  // SEGUNDO RELATO DO DIA: "ao clicar em Grupo e depois clicar novamente para
  // voltar para Todas as conversas, as opções estão cortadas". Na foto, o
  // menu começava fora da tela pela esquerda: lia-se "…versas", "…Concluída".
  //
  // A causa é geométrica e só aparece com a fita QUEBRADA em duas linhas —
  // que é o que acontece no escritório, com "Não lidas 181". Aí a pílula
  // começa colada na borda da coluna, e um menu de 250px ancorado nela com
  // `right: 0` termina ali e começa em −63. MEDIDO, com a fita forçada a
  // quebrar: antes left −63, agora left 72.
  const { ctx, page, estouros } = await abrir(1366);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("[data-fita-de-filtros] button")]
      .find((b) => /Não lidas/.test(b.innerText));
    if (t) t.style.minWidth = "200px";   // o efeito de um contador de 3 dígitos
  });
  await page.waitForTimeout(200);
  const pilula = page.locator("[data-mais-filtros]");
  const temPilula = await pilula.count() === 1;
  ok("a pílula de mais filtros está na fita", temPilula);
  if (temPilula) { await pilula.click(); await page.waitForTimeout(300); }

  const m = await page.evaluate(() => {
    const menu = document.querySelector("[data-menu-mais-filtros]");
    const fita = document.querySelector("[data-fita-de-filtros]");
    if (!menu || !fita) return null;
    const r = menu.getBoundingClientRect(), f = fita.getBoundingClientRect();
    const quem = document.elementFromPoint(Math.round(r.left + 8), Math.round(r.bottom - 8));
    return { linhasDaFita: new Set([...fita.children]
               .map((c) => Math.round(c.getBoundingClientRect().top))).size,
             menu: { left: Math.round(r.left), right: Math.round(r.right) },
             coluna: { left: Math.round(f.left), right: Math.round(f.right) },
             cantoPintado: !!(quem && menu.contains(quem)) };
  });
  ok("a fita está mesmo quebrada (senão esta cena mede o caso fácil)",
     m && m.linhasDaFita === 2, JSON.stringify(m));
  // A RÉGUA É A COLUNA, E NÃO A JANELA — a mesma lição de 16/09, no menu da
  // ordem: um menu pode caber na janela e mesmo assim derramar da coluna.
  ok("o menu começa dentro da coluna",
     m && m.menu.left >= m.coluna.left - 1, JSON.stringify(m));
  ok("e termina dentro dela também",
     m && m.menu.right <= m.coluna.right + 1, JSON.stringify(m));
  ok("e o canto de baixo à esquerda está pintado, não cortado",
     m && m.cantoPintado, JSON.stringify(m));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
