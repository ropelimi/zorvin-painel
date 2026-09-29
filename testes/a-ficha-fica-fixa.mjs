// A FICHA VIROU UMA COLUNA FIXA — e antes ela ESCONDIA a lista de conversas.
//
// Pedido do Rodrigo em 28/09, com a tela do DataCrazy ao lado: ele quer o
// cadastro à vista em toda conversa, numa terceira coluna.
//
// O que havia não era uma coluna escondida: era um botão que trocava a LISTA
// pela ficha. Quem quisesse ver o cadastro perdia de vista a fila de quem está
// esperando — que é a tela inteira do SAC. Por isso a conferência que mais
// importa aqui não é "a ficha apareceu", e sim "a ficha apareceu E a lista
// continua lá".
//
// E há um segundo defeito, mais silencioso: trocar de conversa FECHAVA a
// ficha. Fixa, isso faria o pedido valer até o segundo clique.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const CLIENTES = {
  "5567992183107": { id: "v-100", nome: "ANDREIA CRISTINA MARTINS",
                     cpf: "111.111.111-11", telefone: "5567992183107",
                     documentos: 0, processos: [], ordem_servico: null },
  "5567991110001": { id: "v-200", nome: "MARIA DAS GRACAS PEREIRA",
                     cpf: "222.222.222-22", telefone: "5567991110001",
                     documentos: 0, processos: [], ordem_servico: null },
};

const nav = await abrirNavegador();
const erros = [];

// QUANTAS VEZES O VANTORO FOI CONSULTADO. Fixa, a ficha passa a perguntar em
// toda conversa aberta; o cache de cinco minutos é o que impede trinta idas
// numa manhã, e é aqui que ele é medido.
let consultas = 0;

async function novaJanela({ largura = 1500, altura = 900 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/vantoro/cliente")) {
      consultas++;
      const tel = (url.searchParams.get("telefone") || "").replace(/\D/g, "");
      const achado = CLIENTES[tel];
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: achado ? [achado] : [], opcoes: {} }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page };
}

const temFicha = (page) => page.locator("[data-ficha]").count();
// A LISTA É MEDIDA PELO QUE SE VÊ, e não pelo que está no HTML.
//
// Isto era `.count() > 0`, e a sabotagem que devolvia o defeito — a ficha
// escondendo a lista — PASSOU: o painel esconde a coluna com `display:none`,
// e as linhas continuam no documento. Eu media presença onde precisava medir
// visibilidade, que é o mesmo engano registrado em 16/09 na prova da busca.
const temLista = async (page) => {
  const primeira = page.locator("[data-conversa-nome]").first();
  if (!(await primeira.count())) return false;
  return await primeira.isVisible();
};
// AS CONVERSAS SÃO ABERTAS POR POSIÇÃO, E NÃO PELO NOME — e isso não é
// preguiça: ABRIR A FICHA RENOMEIA A LINHA. `ligarContatoAoCadastro` grava o
// nome do cadastro no contato e o painel atualiza a lista na hora, então a
// conversa que se chamava "Deus" passa a se chamar "ANDREIA CRISTINA
// MARTINS" no instante em que a ficha carrega. Procurar por "Deus" na
// segunda visita espera para sempre por um texto que a própria ficha apagou.
//
// Escrevi esta prova pelo nome primeiro, e foi assim que descobri.
const posicaoDe = async (page, nome) => {
  const nomes = await page.locator("[data-conversa-nome]").allTextContents();
  return nomes.findIndex((n) => n.includes(nome));
};
const abrirPorPosicao = async (page, i) => {
  await page.locator("[data-conversa-nome]").nth(i).click();
  await page.waitForTimeout(1400);
};
const abrirConversa = async (page, nome) => {
  const i = await posicaoDe(page, nome);
  await abrirPorPosicao(page, i < 0 ? 0 : i);
};

console.log("\n1. No computador, a ficha aparece SOZINHA — e a lista fica");
{
  const { ctx, page } = await novaJanela();
  ok("antes de abrir conversa nenhuma, não há ficha", (await temFicha(page)) === 0);
  await abrirConversa(page, "Deus");
  ok("abrindo a conversa, a ficha aparece sem ninguém clicar",
     (await temFicha(page)) === 1);
  // A CONFERÊNCIA QUE MAIS IMPORTA. Antes a ficha TROCAVA a lista por si; uma
  // prova que só olhasse a ficha aprovaria de volta exatamente esse defeito.
  ok("e a lista de conversas continua na tela, ao lado", await temLista(page));
  await ctx.close();
}

console.log("\n2. Trocar de conversa NÃO recolhe a ficha");
{
  // Ela fechava a cada troca — um `setFichaAberta(false)` no efeito da
  // conversa. Fixa, isso faria o pedido valer só até o segundo clique.
  const { ctx, page } = await novaJanela();
  const a = await posicaoDe(page, "Deus"), b = await posicaoDe(page, "MARIA");
  await abrirPorPosicao(page, a);
  ok("a ficha está à vista na primeira conversa", (await temFicha(page)) === 1);
  await abrirPorPosicao(page, b);
  ok("e continua à vista na segunda", (await temFicha(page)) === 1);
  await ctx.close();
}

console.log("\n3. Recolher fica GUARDADO, e sobrevive ao F5");
{
  // Quem atende de um notebook de 1280 precisa do espaço da conversa. Uma
  // preferência que se perde ao recarregar é uma preferência que a pessoa
  // refaz todo dia até desistir.
  const { ctx, page } = await novaJanela();
  await abrirConversa(page, "Deus");
  await page.locator("[data-recolher-ficha]").first().click();
  await page.waitForTimeout(500);
  ok("recolhendo, a ficha some", (await temFicha(page)) === 0);
  ok("e a lista continua lá", await temLista(page));
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await abrirPorPosicao(page, 0);
  ok("depois do F5, ela continua recolhida", (await temFicha(page)) === 0);
  // E TROCAR DE CONVERSA NÃO A TRAZ DE VOLTA: uma coluna que reaparece
  // sozinha é pior do que uma que nunca recolheu.
  await abrirPorPosicao(page, 1);
  ok("e trocar de conversa não a traz de volta", (await temFicha(page)) === 0);
  // Mostrando de novo, a escolha também fica guardada.
  await page.locator("[data-abrir-ficha]").first().click();
  await page.waitForTimeout(700);
  ok("mostrando de novo, ela volta", (await temFicha(page)) === 1);
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await abrirPorPosicao(page, 0);
  ok("e depois do F5 continua à vista", (await temFicha(page)) === 1);
  await ctx.close();
}

console.log("\n4. O Vantoro é consultado UMA vez por conversa, e não a cada volta");
{
  // Fixa, a ficha pergunta em toda conversa aberta: numa manhã de trinta
  // conversas seriam trinta idas a um serviço que fica atrás da ponte, que
  // hiberna. O cache de cinco minutos corta a ida repetida.
  const { ctx, page } = await novaJanela();
  // As duas posições são lidas ANTES de qualquer ficha abrir — ver o
  // comentário de `abrirPorPosicao`.
  const umA = await posicaoDe(page, "Deus");
  const umB = await posicaoDe(page, "MARIA");
  consultas = 0;
  await abrirPorPosicao(page, umA);
  const depoisDaPrimeira = consultas;
  ok("abrir a conversa consulta o Vantoro", depoisDaPrimeira >= 1, String(depoisDaPrimeira));
  await abrirPorPosicao(page, umB);
  await abrirPorPosicao(page, umA);
  await abrirPorPosicao(page, umB);
  ok("ir e voltar entre duas conversas NÃO consulta de novo",
     consultas === depoisDaPrimeira + 1,
     `${consultas} consultas para 4 aberturas de 2 clientes`);
  // O BOTÃO DE ATUALIZAR FURA O CACHE, senão ele passaria a devolver a mesma
  // resposta guardada e pareceria quebrado justamente para quem sabe que o
  // cadastro mudou agora.
  const antes = consultas;
  await page.getByTitle("Atualizar").first().click();
  await page.waitForTimeout(900);
  ok("mas o botão Atualizar consulta mesmo assim", consultas === antes + 1,
     `${consultas} contra ${antes}`);
  await ctx.close();
}

console.log("\n5. No celular ela NÃO nasce aberta — senão some a conversa");
{
  // Abaixo de 768px não cabem três colunas: lá a ficha toma a tela inteira.
  // Nascer aberta faria abrir uma conversa mostrar o CADASTRO no lugar da
  // conversa — e é por isso que são dois estados, e não um.
  const { ctx, page } = await novaJanela({ largura: 360, altura: 740 });
  await abrirConversa(page, "Deus");
  ok("no celular, abrir a conversa mostra a CONVERSA", (await temFicha(page)) === 0);
  await page.locator('[aria-label="Mais opções desta conversa"]').first().click();
  await page.waitForTimeout(400);
  await page.locator("[data-menu-ficha]").first().click();
  await page.waitForTimeout(900);
  ok("e pelo menu ⋮ ela abre", (await temFicha(page)) === 1);
  // E NÃO CONTAMINA O COMPUTADOR: o gesto do celular é desta vez, e a
  // preferência guardada é outra coisa.
  const guardado = await page.evaluate(() => localStorage.getItem("zorvin_ficha_fixa"));
  ok("e o gesto do celular não vira preferência guardada", guardado === null,
     String(guardado));
  await ctx.close();
}

console.log("\n6. A conversa ganhou espaço, e o cabeçalho não invade a ficha");
{
  // Relato do Rodrigo em 28/09, com foto: a lupa da busca aparecia POR BAIXO
  // da ficha. Medido na época: o bloco do nome já tinha encolhido a ZERO e os
  // botões sozinhos passavam da borda — os dois ESCRITOS ("Marcar como não
  // lida" e "Já tratei") custam ~280px dos ~550 que a fila precisa.
  //
  // E ele pediu junto que a lista encolhesse para a conversa respirar.
  for (const L of [1280, 1920]) {
    const ctx = await nav.newContext({ viewport: { width: L, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/ponte-de-mentira/**", (rota) =>
      rota.fulfill({ status: 200, contentType: "application/json",
                     body: JSON.stringify({ clientes: [], opcoes: {} }) }));
    await page.goto(ENDERECO);
    await page.waitForSelector("[data-conversa-nome]");
    await page.waitForTimeout(1200);
    const lista = await page.locator("[data-conversa-nome]").first()
      .evaluate((e) => Math.round(e.closest("div[style*='flex-direction: column']")
        .getBoundingClientRect().width));
    await page.locator("[data-conversa-nome]").nth(0).click();
    await page.waitForTimeout(1400);

    const m = await page.evaluate(() => {
      const topo = document.querySelector("[data-topo-conversa]");
      const ficha = document.querySelector("[data-ficha]");
      const filhos = [...topo.children].map((e) => e.getBoundingClientRect());
      const ultimo = filhos[filhos.length - 1];
      const marcar = document.querySelector('[data-marcar]');
      return {
        fimDoTopo: Math.round(ultimo.right),
        fichaComecaEm: ficha ? Math.round(ficha.getBoundingClientRect().left) : null,
        larguraDoMarcar: marcar ? Math.round(marcar.getBoundingClientRect().width) : null,
        // O BLOCO DO NOME — é ELE que denuncia a falta de espaço.
        larguraDoNome: (() => {
          const bloco = [...topo.children].find((e) => getComputedStyle(e).flexGrow !== "0");
          return bloco ? Math.round(bloco.getBoundingClientRect().width) : null;
        })(),
      };
    });

    // A CONFERÊNCIA DO DEFEITO RELATADO: nada do cabeçalho pode passar da
    // borda esquerda da ficha. É o que a foto dele mostrava acontecendo.
    ok(`a ${L}px o cabeçalho não entra na ficha`,
       m.fichaComecaEm !== null && m.fimDoTopo <= m.fichaComecaEm,
       `topo termina em ${m.fimDoTopo}, ficha começa em ${m.fichaComecaEm}`);
    // E ESTA É A QUE PEGA DE VERDADE, aprendida numa sabotagem que VAZOU.
    //
    // A de cima é barata e quase não tem como reprovar: a fila é flex, então
    // faltando espaço ela ESPREME o bloco do nome em vez de empurrar alguém
    // para fora — e o `overflow: hidden` ainda corta o que sobrar. Medido a
    // 1280 com os rótulos escritos à força, o último botão ainda terminava
    // 16px ANTES da ficha, e o nome tinha ficado com 39px. Era exatamente a
    // foto do Rodrigo: o avatar e nenhum nome.
    ok(`a ${L}px o bloco do nome não foi espremido a nada`,
       m.larguraDoNome !== null && m.larguraDoNome >= 100,
       `o nome ficou com ${m.larguraDoNome}px`);
    // E A LISTA ENCOLHEU. 360 — eram 380, e 320 foi tentado e REPROVADO por
    // `o-topo-mais-baixo`: lá a marca ficava com 96px para um nome que pede
    // 134 e a tela dizia "Ropelimi Zo". O piso da coluna é a linha da marca,
    // e ele foi medido lá; aqui só se confere que este número é o que está
    // desenhado. A conferência aceita 362: o traço divisório de 1px entra na
    // medida do retângulo, e exigir 360 cravado reprovaria por causa de uma
    // borda — reprovar pelo que não se mede é o que faz alguém apagar a
    // conferência em vez de ler o que ela diz.
    ok(`a ${L}px a lista encolheu para ~360px`, Math.abs(lista - 360) <= 2, `${lista}px`);
    // O QUE FAZ CABER: apertado, os botões escritos viram ícone. Sem isto a
    // conferência de cima passaria só por sorte, na largura que eu escolhi.
    const apertado = L === 1280;
    ok(`a ${L}px o botão de marcar ${apertado ? "vira ícone" : "continua escrito"}`,
       apertado ? m.larguraDoMarcar < 70 : m.larguraDoMarcar > 100,
       `${m.larguraDoMarcar}px`);
    await ctx.close();
  }
}

await nav.close();
console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 3).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas++;
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
