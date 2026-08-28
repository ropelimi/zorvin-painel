// A PARTIDA: quantas RODADAS de rede até a lista aparecer.
//
// Relato do escritório, de vários usuários: "o Zorvin está lento, demora para
// carregar tudo". E dois prints, que juntos contam a história inteira: no
// primeiro a tela diz "Você não tem nenhum número liberado neste departamento";
// no segundo, a mesma sessão segundos depois, com oito números na barra lateral
// e a lista dizendo "Carregando as conversas...".
//
// ERAM DOIS DEFEITOS, e o segundo é pior que a lentidão.
//
// 1. TRÊS RODADAS DE REDE EM FILA INDIANA. O diário da bancada, medido no build
//    de produção (o de desenvolvimento chama todo efeito duas vezes e mentiria
//    aqui):
//
//        173 →  874  conversas   (as fixadas)
//        174 →  880  conversas   (a página)
//        880 → 1580  conversas   (as fixadas — só depois de a página voltar)
//       1581 → 2286  conversas   (atendendo, prévias, digitando)
//
//    Três esperas de ~700 ms para buscar coisas que não dependem umas das
//    outras: todas precisam só do `advId`. Nenhuma precisa da página. O
//    comentário do próprio código já dizia a intenção — as fixadas "buscadas
//    por conta própria, JUNTO da primeira página" —, mas cada `await` no meio
//    empurra o resto para depois da rede.
//
// 2. A TELA AFIRMAVA O QUE NÃO SABIA. "Você não tem nenhum número liberado" é
//    uma frase definitiva, e ela aparecia enquanto a resposta ainda estava
//    vindo. Quem lê aquilo conclui que perdeu o acesso — e é o tipo de susto
//    que faz alguém ligar para o suporte no meio do atendimento.
//
// POR QUE CONTAR RODADAS, E NÃO MILISSEGUNDOS. O relógio daqui não é o do
// escritório: na bancada cada ida custa ~700 ms de mentira, no 4G do fórum
// custa o que custar. O que se leva de uma para a outra é o NÚMERO DE ESPERAS
// EM FILA — esse é igual nos dois lugares, e é ele que o conserto tirou.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O diário tem de existir ANTES da primeira consulta, senão a partida não é
// registrada — que é justamente o que se quer medir.
await page.addInitScript(() => { globalThis.__DIARIO = []; });

console.log("\nEnquanto a resposta não chega, a tela não afirma nada");
{
  // A CORRIDA É DE PROPÓSITO. Esta conferência precisa pegar a tela ANTES de
  // os números chegarem — é o instante do print do relato. `domcontentloaded`
  // devolve o controle assim que o HTML termina, sem esperar a rede.
  await page.goto(ENDERECO, { waitUntil: "domcontentloaded" });
  const cedo = await page.evaluate(() => document.body.innerText);
  // A CONFERÊNCIA QUE PEGA O DEFEITO. Antes, aqui aparecia "Você não tem
  // nenhum número liberado neste departamento".
  ok("não diz que a pessoa perdeu o acesso antes de perguntar",
     !/não tem nenhum número liberado/i.test(cedo),
     "a tela afirmou o que ainda não sabia");
}

await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 });
await page.waitForTimeout(1500);

console.log("\nAs idas ao banco da partida saem JUNTAS");
{
  const d = await page.evaluate(() => (globalThis.__DIARIO || [])
    .filter((m) => m.tabela === "conversas")
    .map((m) => ({ i: Math.round(m.inicio), f: m.fim ? Math.round(m.fim) : null })));

  ok("houve consulta de conversas para medir", d.length >= 4, `foram ${d.length}`);

  // AS RODADAS: uma consulta que COMEÇA depois de outra TERMINAR é uma espera
  // em fila. É essa contagem que separa "seis idas juntas" de "seis idas em
  // fila indiana" — o total de idas é o mesmo nos dois casos, e por isso contar
  // idas não diria nada.
  const porInicio = d.slice().sort((a, b) => a.i - b.i);
  let rodadas = 0, fimDaRodada = -1;
  for (const c of porInicio) {
    if (c.i > fimDaRodada) { rodadas += 1; fimDaRodada = c.f ?? c.i; }
    else fimDaRodada = Math.max(fimDaRodada, c.f ?? c.i);
  }
  const inicio = porInicio[0].i;
  const fim = Math.max(...porInicio.map((c) => c.f ?? c.i));
  console.log(`     ${d.length} consultas a conversas em ${rodadas} rodada(s), ${inicio}→${fim} ms`);

  // A CONFERÊNCIA QUE PEGA O DEFEITO. Eram três; com o conserto é uma.
  //
  // A régua é DUAS, e não uma: uma base sem o SQL das frentes ainda repete a
  // consulta sem as colunas novas, e essa repetição é uma segunda rodada
  // legítima — que acontece uma vez por sessão, não a cada partida.
  ok("a partida cabe em no máximo duas rodadas de rede", rodadas <= 2,
     `foram ${rodadas} rodadas — a partida voltou a ser fila indiana`);

  // E A ESPERA TOTAL NÃO PASSA DE DUAS IDAS. Na bancada cada ida custa ~700 ms;
  // três rodadas davam ~2100. A régua é medida, e não escolhida: é o tempo da
  // ida mais lenta, com folga para duas.
  const maisLenta = Math.max(...porInicio.map((c) => (c.f ?? c.i) - c.i));
  console.log(`     ida mais lenta: ${maisLenta} ms | espera total: ${fim - inicio} ms`);
  // A RÉGUA APERTOU DEPOIS DE UMA SABOTAGEM QUE PASSOU.
  //
  // Ela era `maisLenta * 2.2`. Devolvendo a fila indiana, a espera foi de
  // 725 ms para 1526 — o dobro — e a prova passou assim mesmo, porque 1404 de
  // atraso ainda cabia em 2,2 idas. Uma régua que aceita o dobro do certo não
  // é régua.
  //
  // 1,5 é o que separa as duas medidas reais: uma rodada custa ~725 ms e duas
  // custam ~1450. A folga de meia ida absorve a variação do relógio sem
  // deixar passar uma espera inteira.
  ok("e a espera total é a de uma ida, não a de duas",
     (fim - inicio) < maisLenta * 1.5,
     `esperou ${fim - inicio} ms com a ida mais lenta em ${maisLenta} ms`);

  // E A CONFERÊNCIA MAIS DIRETA DE TODAS: ninguém começa depois de a primeira
  // resposta ter chegado. É isso que "sair junto" quer dizer, e é uma pergunta
  // que não depende de relógio nenhum.
  //
  // A contagem de rodadas acima não bastava: com as três de baixo saindo na
  // frente e demorando o mesmo tanto, uma quarta consulta atrasada se
  // sobrepunha ao fim delas e a rodada não era contada como nova.
  const primeiroFim = Math.min(...porInicio.map((c) => c.f ?? Infinity));
  const atrasadas = porInicio.filter((c) => c.i > primeiroFim + 50).length;
  ok("nenhuma consulta espera a resposta de outra para começar", atrasadas === 0,
     `${atrasadas} consulta(s) só começaram depois de a primeira voltar`);
}

console.log("\nE quando a pessoa REALMENTE não tem número, aí sim a tela diz");
{
  // A TRAVA CONTRA O CONSERTO QUE CONSERTA DEMAIS. Trocar a frase por um
  // "carregando" eterno esconderia o caso de verdade — e aí quem perdeu acesso
  // ficaria olhando uma tela girando, sem nunca saber por quê.
  // ESVAZIAR ANTES DE A PÁGINA EXISTIR, e não depois. Recarregar recria a
  // bancada do zero — mexer nas tabelas e só então recarregar apagaria o que
  // acabou de ser feito. O gancho abaixo espera a bancada se apresentar
  // (`globalThis.__TABELAS = ...`) e a esvazia no mesmo instante, antes da
  // primeira consulta.
  await page.addInitScript(() => {
    let guardado;
    Object.defineProperty(globalThis, "__TABELAS", {
      configurable: true,
      get: () => guardado,
      set: (novo) => {
        guardado = novo;
        // SÓ AS PERMISSÕES, e o admin desligado junto. Esvaziar `advogados`
        // seria outra coisa — "o escritório não tem telefone nenhum" —, e
        // derruba a tela por um caminho que não é o desta prova. Quem não tem
        // número liberado tem o escritório inteiro lá; o que ele não tem é
        // permissão. E admin alcança tudo por definição, então enquanto ele
        // for admin não existe "sem número liberado".
        if (novo && novo.permissoes) novo.permissoes.length = 0;
        if (novo && novo.usuarios) novo.usuarios.forEach((u) => { u.admin = false; });
      },
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const tarde = await page.evaluate(() => document.body.innerText);
  ok("sem número nenhum, a tela diz isso com todas as letras",
     /não tem nenhum número liberado/i.test(tarde),
     "a tela ficou muda sobre um acesso que realmente não existe");
  ok("e não fica 'carregando' para sempre",
     !/Carregando os seus números/i.test(tarde), tarde.slice(0, 120));
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
