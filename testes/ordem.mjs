// A ORDEM DA LISTA — mais recentes ou mais antigas primeiro.
//
// Pedida por quem administra. O uso é achar o que ficou para trás: com a lista
// sempre pela mais recente, uma conversa parada há três semanas fica no fim de
// tudo e ninguém rola até lá.
//
// O QUE ESTA PROVA VIGIA DE VERDADE: que a ordem vá para a CONSULTA, e não
// para uma reordenação da lista já carregada. A lista vem do banco em páginas;
// virar o que já está na tela mostraria "a mais antiga das 200 que vieram", que
// numa conta com mil conversas não é a mais antiga de nada — uma resposta
// errada com cara de certa, e justamente para essa pergunta que o filtro serve.
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
await page.waitForTimeout(1200);

const pilula = page.locator("[data-ordem]");

/** As datas de atividade da lista, na ordem em que estão na tela. */
async function datasDaLista() {
  return page.evaluate(() => {
    const t = globalThis.__TABELAS && globalThis.__TABELAS.conversas;
    if (!t) return null;
    return [...document.querySelectorAll("[data-conversa-nome]")]
      .map((el) => {
        const linha = t.find((c) => String(c.id) === el.getAttribute("data-conversa-id"));
        return linha ? { fixada: !!linha.fixada, quando: linha.ultima_atividade } : null;
      })
      .filter(Boolean);
  });
}

/** A lista está ordenada no sentido pedido? Fixadas ficam de fora: elas moram
 *  no alto nos dois casos, por escolha de quem atende. */
function estaOrdenada(linhas, crescente) {
  const soltas = linhas.filter((l) => !l.fixada).map((l) => new Date(l.quando).getTime());
  for (let i = 1; i < soltas.length; i++) {
    if (crescente ? soltas[i] < soltas[i - 1] : soltas[i] > soltas[i - 1]) {
      return `quebrou na posição ${i}: ${soltas[i - 1]} depois ${soltas[i]}`;
    }
  }
  return null;
}

console.log("\nA pílula está lá e diz qual ordem está valendo");
{
  ok("existe o filtro de ordem", await pilula.count() === 1);
  const texto = (await pilula.innerText()).trim();
  ok("e ele começa nas mais recentes", /recentes/i.test(texto), `dizia: "${texto}"`);
  // UM BOTÃO QUE SÓ TROCA E NÃO CONTA EM QUE ESTADO ESTÁ transforma "achei
  // estranho" em "está quebrado". Por isso ele escreve a ordem, e não é só
  // uma setinha.
  ok("com a ordem escrita, e não só um desenho", texto.length > 6, `dizia: "${texto}"`);
}

console.log("\nAs mais recentes primeiro — a ordem de sempre");
{
  const linhas = await datasDaLista();
  ok("consegui ler as datas da lista", !!linhas && linhas.length > 3,
     `vieram ${linhas && linhas.length}`);
  const quebra = estaOrdenada(linhas, false);
  ok("a lista está da mais recente para a mais antiga", quebra === null, quebra || "");
}

console.log("\nTrocar para as mais antigas vira a lista");
{
  await pilula.click();
  await page.waitForTimeout(400);
  const menu = page.locator("[data-menu-ordem]");
  ok("o menu abre", await menu.count() === 1);
  const texto = (await menu.innerText()).replace(/\s+/g, " ");
  // AS DUAS FRASES DE APOIO. "Mais antigas" é ambíguo para quem lê rápido:
  // antiga é a conversa que começou faz tempo, ou a que ninguém responde faz
  // tempo? Dizer qual das duas evita a pergunta.
  ok("e explica o que cada uma faz",
     /esperando há mais tempo/i.test(texto) && /falou por último/i.test(texto),
     `dizia: "${texto}"`);

  await page.locator('[data-ordem-opcao="antigas"]').click();
  await page.waitForTimeout(1500);

  const t2 = (await pilula.innerText()).trim();
  ok("a pílula passa a dizer 'Mais antigas'", /antigas/i.test(t2), `dizia: "${t2}"`);

  const linhas = await datasDaLista();
  const quebra = estaOrdenada(linhas, true);
  ok("e a lista está da mais antiga para a mais recente", quebra === null, quebra || "");
}

console.log("\nE a escolha veio do BANCO, não de uma virada na tela");
{
  // A prova disto: a primeira conversa da lista invertida tem de ser a mais
  // antiga de TODAS as que existem, e não a mais antiga das que já estavam
  // carregadas. Numa base paginada, essas duas são conversas diferentes.
  const conferencia = await page.evaluate(() => {
    const t = globalThis.__TABELAS && globalThis.__TABELAS.conversas;
    const primeira = document.querySelector("[data-conversa-nome]");
    if (!t || !primeira) return null;
    const naTela = t.find((c) => String(c.id) === primeira.getAttribute("data-conversa-id"));
    // Do mesmo telefone que a tela está mostrando, e sem as fixadas.
    //
    // E SEM AS QUE A TELA ESCONDE DE PROPÓSITO. O painel tem uma regra:
    // "conversa sem nenhuma mensagem não é conversa" — abrir um contato cria a
    // linha na hora, e sem essa regra a lista encheria de conversas vazias com
    // o horário do clique.
    //
    // Comparar a tela contra a tabela CRUA ignorava essa regra, e a prova
    // reprovava assim que alguém pusesse na bancada uma conversa sem mensagem:
    // ela apontaria para a ordenação, que está certa, em vez de para a
    // montagem. Aconteceu. Uma prova que acusa o lugar errado custa mais caro
    // do que uma que não existe.
    const comMensagem = new Set(
      (globalThis.__TABELAS.mensagens || []).map((m) => String(m.conversa_id)));
    const doMesmo = t.filter((c) => c.advogado_id === naTela.advogado_id && !c.fixada
                                    && comMensagem.has(String(c.id)));
    const maisAntiga = doMesmo.reduce((a, c) =>
      new Date(c.ultima_atividade) < new Date(a.ultima_atividade) ? c : a, doMesmo[0]);
    return { naTela: naTela.ultima_atividade, maisAntiga: maisAntiga.ultima_atividade,
             quantas: doMesmo.length };
  });
  ok("consegui comparar com a base inteira", !!conferencia, JSON.stringify(conferencia));
  if (conferencia) {
    ok("a primeira da lista é a mais antiga DE TODAS",
       conferencia.naTela === conferencia.maisAntiga,
       `na tela ${conferencia.naTela}, mas a mais antiga das ${conferencia.quantas} é ${conferencia.maisAntiga}`);
  }
}

console.log("\nA escolha sobrevive a recarregar a página");
{
  // Quem escolheu "mais antigas" está no meio de uma varredura do que ficou
  // para trás. Voltar para o padrão a cada F5 desfaria o trabalho no meio.
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  const texto = (await page.locator("[data-ordem]").innerText()).trim();
  ok("depois de recarregar, continua nas mais antigas", /antigas/i.test(texto),
     `dizia: "${texto}"`);
  const linhas = await datasDaLista();
  const quebra = estaOrdenada(linhas, true);
  ok("e a lista continua virada", quebra === null, quebra || "");
}

console.log("\nE dá para voltar");
{
  await page.locator("[data-ordem]").click();
  await page.waitForTimeout(400);
  await page.locator('[data-ordem-opcao="recentes"]').click();
  await page.waitForTimeout(1500);
  const linhas = await datasDaLista();
  const quebra = estaOrdenada(linhas, false);
  ok("volta para as mais recentes", quebra === null, quebra || "");
  const texto = (await page.locator("[data-ordem]").innerText()).trim();
  ok("e a pílula acompanha", /recentes/i.test(texto), `dizia: "${texto}"`);
}

// ------------------------------------------------------------------
console.log("\nA pílula PARECE escolhida nas três ordens");
{
  // RELATO DO RODRIGO, 29/09, com três fotos: "'Recentes' e 'Esperando'
  // quando estão selecionados, não parece que estão selecionados, pois não
  // possuem cor de fundo".
  //
  // Ela pintava de verde só o `antigas` — sobra de quando havia DUAS ordens e
  // o verde queria dizer "não é a de sempre". Com três, `esperando` é a que
  // mais vira a lista do avesso e era a que menos aparecia.
  //
  // A RÉGUA SAI DA PRÓPRIA TELA, e não de um valor copiado para cá: a
  // conferência compara com a pílula ATIVA da fita de filtros, que é o jeito
  // da casa de dizer "escolhida". Escrever a cor à mão aqui seria uma segunda
  // definição dela, para divergir no dia em que o tema mudar.
  const fundoDaEscolhida = await page.evaluate(() => {
    const ativa = [...document.querySelectorAll("[data-fita-de-filtros] [data-aba]")]
      .find((b) => getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)");
    return ativa ? getComputedStyle(ativa).backgroundColor : null;
  });
  ok("achei na fita a cor de 'pílula escolhida'", !!fundoDaEscolhida, String(fundoDaEscolhida));

  const escolher = async (regra) => {
    await page.locator("[data-ordem]").click();
    await page.waitForTimeout(300);
    const op = page.locator("[data-menu-ordem] button").filter({ hasText: regra });
    if (await op.count() === 0) return null;
    await op.first().click();
    await page.waitForTimeout(600);
    return page.evaluate(() => {
      const b = document.querySelector("[data-ordem]");
      const cs = getComputedStyle(b);
      return { diz: b.innerText.trim(), fundo: cs.backgroundColor, cor: cs.color };
    });
  };

  const vistas = [];
  for (const [nome, regra] of [["Recentes", /Mais recentes/], ["Antigas", /Mais antigas/],
                               ["Esperando", /Esperando/]]) {
    const v = await escolher(regra);
    if (!v) { console.log(`     ${nome}: não é oferecida nesta bancada`); continue; }
    vistas.push({ nome, ...v });
    console.log(`     ${nome.padEnd(10)} fundo ${v.fundo} | texto ${v.cor} | diz "${v.diz}"`);
  }

  // O TAMANHO VAI JUNTO: `.every` numa lista vazia devolve `true`, e a
  // conferência passaria sem olhar nada — foi assim que o vigia
  // `provas-que-reprovam` me pegou em 29/09.
  ok("as três ordens foram exercitadas", vistas.length === 3,
     JSON.stringify(vistas.map((v) => v.nome)));
  ok("as TRÊS têm cor de fundo de escolhida, e é a mesma da fita",
     vistas.length === 3 && vistas.every((v) => v.fundo === fundoDaEscolhida),
     JSON.stringify(vistas));
  // E A PALAVRA CONTINUA LÁ. A cor é o reforço; quem DIZ em que ordem a lista
  // está é o texto, e é ele que serve a quem não distingue a cor.
  ok("e cada uma continua escrevendo a ordem",
     vistas.length === 3 && vistas.every((v) => v.diz.length > 5),
     JSON.stringify(vistas.map((v) => v.diz)));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
