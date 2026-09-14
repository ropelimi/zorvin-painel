// A BUSCA SEMPRE ACABA — mesmo quando o banco não responde.
//
// RELATO DE QUEM USA, 01/09, com foto: "quando faço a busca no Zorvin,
// continua demorando. Agora na verdade nada está sendo encontrado, fica apenas
// 'Procurando…'". Na foto: RODRIGO ALVES SOUSA escrito na caixa, a lista
// vazia, e o "Procurando…" parado ali.
//
// É a TERCEIRA vez que essa foto chega, e as duas correções anteriores estavam
// certas — só não eram a causa toda:
//
//   30/08  a ida ao Vantoro vinha antes de desenhar     → dois tempos
//   31/08  o `fetch` do Vantoro não tinha prazo         → AbortController
//   01/09  ESTE ARQUIVO
//
// O QUE FALTAVA, e é o que esta prova vigia:
//
//  1. NENHUMA das nove consultas da busca tinha prazo. Se uma delas fosse
//     aceita e não respondesse — que é o que uma varredura da tabela de
//     mensagens faz num banco ocupado —, o `setBuscando(false)` que apaga o
//     "Procurando…" ficava atrás dela. Para sempre.
//
//  2. A BUSCA VELHA CONTINUAVA RODANDO NO BANCO. Cada pausa de 350ms na
//     digitação dispara uma busca; escrever um nome inteiro dispara três ou
//     quatro. A variável `cancelado` fazia a RESPOSTA ser descartada, mas a
//     consulta seguia até o fim, segurando conexão. A última — a única que
//     interessa — esperava atrás de todas as outras.
//
//  3. PROCURAR PELO NOME ESPERAVA PELA VARREDURA DAS MENSAGENS. As três
//     perguntas iam na mesma consulta, então a mais barata (o nome, que é o
//     que se faz o dia inteiro) tinha o custo da mais cara, e as três se
//     perdiam juntas quando a cara estourava.
//
// POR QUE A BANCADA NÃO PEGAVA NADA DISSO. Ela respondia tudo, sempre, em
// dezenas de milissegundos. Uma busca sem prazo nenhum é perfeita num mundo
// onde toda consulta responde. `__PENDURAR` — a consulta que aceita o pedido e
// não responde nunca — foi criada com esta prova, e é o instrumento que faltava.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { PRAZO_DA_BUSCA, foiAbortada, funcaoNaoExiste, termoSeguro,
         condicoesDeNome, recadoDaBusca } from "../src/busca.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// ============================================================
//  PRIMEIRO, O QUE NÃO PRECISA DE NAVEGADOR
// ============================================================

console.log("\nReconhecer uma consulta que foi INTERROMPIDA");
{
  // A FORMA É A DO `postgrest-js`, e não uma inventada: ele não põe código
  // nenhum num aborto (`code: ""`), põe a palavra na dica. Reconhecer por um
  // código bonito passaria aqui e falharia em produção.
  ok("o aborto do postgrest é reconhecido pela dica",
     foiAbortada({ code: "", message: "AbortError: The operation was aborted.",
                   hint: "Request was aborted (timeout or manual cancellation)" }));
  ok("e pelo nome do erro, quando é o `fetch` cru",
     foiAbortada({ name: "AbortError" }));
  // E A METADE QUE PROTEGE: um erro de verdade NÃO pode virar "foi só um
  // cancelamento". Se virasse, a tela deixaria de avisar justamente quando há
  // o que avisar.
  ok("um tempo estourado no banco NÃO é aborto",
     !foiAbortada({ code: "57014", message: "canceling statement due to statement timeout" }));
  ok("uma sessão vencida NÃO é aborto",
     !foiAbortada({ code: "PGRST301", message: "JWT expired" }));
  ok("e nada é nada", !foiAbortada(null) && !foiAbortada(undefined));
}

console.log("\nReconhecer a função que ainda não foi criada");
{
  // Este é o ÚNICO erro permanente da lista: enquanto ninguém rodar o SQL, ela
  // continua não existindo. Confundi-lo com um tropeço passageiro faria o
  // painel perguntar de novo a cada tecla, para ouvir a mesma coisa.
  ok("PGRST202 é 'falta rodar o SQL'",
     funcaoNaoExiste({ code: "PGRST202", message: "Could not find the function public.buscar_conversas" }));
  ok("e pela mensagem, quando o código não vem",
     funcaoNaoExiste({ code: "", message: "Could not find the function public.buscar_conversas" }));
  // A METADE QUE PROTEGE: um tropeço passageiro NÃO pode aposentar o caminho
  // rápido pelo resto da sessão.
  ok("um tempo estourado NÃO aposenta a função",
     !funcaoNaoExiste({ code: "57014", message: "canceling statement due to statement timeout" }));
  ok("um aborto também não", !funcaoNaoExiste({ code: "", message: "AbortError" }));
}

console.log("\nO termo que não quebra o `or` do PostgREST");
{
  // A vírgula e os parênteses separam condições lá dentro: deixá-los passar
  // não devolve "nenhum resultado", devolve ERRO. A busca inteira morria em
  // silêncio quando alguém procurava um telefone escrito como todo mundo
  // escreve.
  ok("os parênteses do telefone saem",
     !/[()]/.test(termoSeguro("(67) 99111-0001")), termoSeguro("(67) 99111-0001"));
  ok("a vírgula sai", termoSeguro("SILVA, JOAO") === "SILVA  JOAO");
  ok("o asterisco sai", termoSeguro("mar*") === "mar");
  ok("e um nome comum passa inteiro", termoSeguro(" ELIANA ALVES ") === "ELIANA ALVES");
}

console.log("\nAs condições da busca por nome");
{
  const tres = condicoesDeNome("ELIANA", "", true);
  ok("os três nomes entram", tres.length === 3
     && tres.some((c) => c.startsWith("nome.ilike"))
     && tres.some((c) => c.startsWith("vantoro_nome.ilike"))
     && tres.some((c) => c.startsWith("nome_zorvin.ilike")), JSON.stringify(tres));
  ok("numa base sem as colunas do cadastro, sobra o `nome`",
     condicoesDeNome("ELIANA", "", false).length === 1);
  // OS PISOS PROTEGEM QUEM LÊ, e não o banco: duas letras casam com meio
  // escritório, e a pessoa teria de peneirar centenas de linhas com os olhos.
  ok("duas letras não viram condição de nome",
     condicoesDeNome("EL", "", true).length === 0);
  ok("três dígitos não viram condição de número",
     condicoesDeNome("", "123", true).length === 0);
  ok("quatro dígitos viram",
     condicoesDeNome("", "1234", true).some((c) => c.startsWith("numero.ilike")));
}

console.log("\nO recado muda conforme o que faltou");
{
  // "Não consegui completar a busca" dito para os quatro casos é mentira por
  // omissão em três deles: a lista tem gente e o aviso diz que nada vale. Quem
  // lê isso fecha a busca e procura de outro jeito — tendo a resposta na tela.
  const vazio = recadoDaBusca({});
  ok("quando nada faltou, o recado é o SILÊNCIO", vazio === "", JSON.stringify(vazio));
  ok("faltou tudo → 'não consegui completar'",
     /não consegui completar/i.test(recadoDaBusca({ falhouNome: true, falhouMensagem: true })));
  ok("faltaram só os nomes → diz que o que está aí veio do texto",
     /veio do texto/i.test(recadoDaBusca({ falhouNome: true })));
  ok("faltaram só as mensagens → diz que achou pelos nomes",
     /achei pelos nomes/i.test(recadoDaBusca({ falhouMensagem: true })));
  // O TEMPO TEM DUAS FRASES, e a diferença é o que a pessoa está vendo:
  // com resultado na tela, o aviso explica o que pode faltar; sem nada, ele
  // explica por que não há nada.
  ok("estourou o tempo COM achados → fala do que pode faltar",
     /pode faltar/i.test(recadoDaBusca({ tempoEsgotado: true, achouAlgo: true })));
  ok("estourou o tempo SEM nada → diz que parou de esperar",
     /parei de esperar/i.test(recadoDaBusca({ tempoEsgotado: true, achouAlgo: false })));
  ok("e o tempo manda mais do que as falhas",
     /parei de esperar/i.test(recadoDaBusca({
       tempoEsgotado: true, falhouNome: true, falhouMensagem: true })));
  ok("o prazo é menor do que a paciência de quem espera",
     PRAZO_DA_BUSCA >= 5000 && PRAZO_DA_BUSCA <= 15000, String(PRAZO_DA_BUSCA));
}

// ============================================================
//  E AGORA A TELA
// ============================================================

// O ALVO TEM DE SER ALGUÉM QUE SÓ O BANCO ACHA.
//
// O painel filtra a lista carregada em memória; um nome que já esteja nela
// aparece sem o banco responder, e a prova passaria com o conserto E sem ele.
// "ZULMIRA ANTUNES DO PRADO" é a conversa 1151 de 1200 do telefone Arquivo, e
// a lista carrega 40.
const ALVO = "ZULMIRA";

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O VANTORO DORMINDO — como na prova irmã. Ele não pode influir em nada do que
// se mede aqui.
//
// MENOS NUMA COISA, desde 14/09: "Nada encontrado para essa busca" só é dito
// depois de o cadastro ter respondido. A frase era escrita com a pergunta
// ainda no ar, e era o defeito do relato ("está aparecendo uma mensagem
// falsa"). Onde esta prova mede a FRASE — o fim da seção 5 —, o cadastro
// precisa ter respondido; em todo o resto ele continua dormindo.
let vantoroAcordado = false;
await page.route("**/vantoro/buscar*", async (rota) => {
  if (vantoroAcordado) {
    return rota.fulfill({ status: 200, contentType: "application/json",
                          body: JSON.stringify({ ok: true, clientes: [] }) });
  }
  await new Promise((r) => setTimeout(r, 60000));
  rota.abort();
});

await page.goto(ENDERECO);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(1800);

const caixa = page.locator('input[placeholder*="Buscar por nome"]');
const naLista = () => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome")));
// PELA MARCA, e não pela palavra no texto da página.
//
// A primeira versão desta prova procurava "Procurando…" no `innerText` do
// corpo — e reprovou o conserto por causa de uma frase MINHA: o aviso de tempo
// esgotado citava a palavra entre aspas. A tela estava certa; o instrumento é
// que lia "ainda procurando" num texto que dizia "desisti".
const dizProcurando = async () =>
  (await page.locator('[data-recado-da-lista="procurando"]').count()) > 0;
const achouOAlvo = async () =>
  (await naLista()).some((n) => (n || "").toUpperCase().includes(ALVO));
const pendurar = (quais) =>
  page.evaluate((q) => { globalThis.__PENDURAR = q; }, quais);

// O telefone com mil e duzentas conversas: é o único lugar da bancada onde
// "não está na lista carregada" é verdade.
await page.locator('[data-telefone="Arquivo"]').first().click();
await page.waitForTimeout(2500);
{
  const carregadas = await naLista();
  ok("a lista do telefone NÃO traz a conversa procurada",
     carregadas.length > 0 && !carregadas.some((n) => (n || "").toUpperCase().includes(ALVO)),
     `a lista já tinha ${ALVO} — esta prova não mediria nada`);
}

console.log("\n1. Com a função do banco PENDURADA, o nome aparece assim mesmo");
{
  // Este é o caso do relato. A função `buscar_conversas` é a que varre as
  // mensagens; num banco ocupado ela aceita o pedido e não volta.
  //
  // A consulta por NOME é outra, e é barata. Agora ela sai na frente e desenha
  // sozinha — antes ia junto, e afundava junto.
  await pendurar(["buscar_conversas"]);
  await caixa.fill("");
  await page.waitForTimeout(300);
  await caixa.fill(ALVO);

  // TRÊS SEGUNDOS: os 350ms da própria busca mais folga larga, e MUITO menos
  // do que os nove segundos do prazo. É essa distância que a prova mede — sem
  // o conserto, aqui ainda estaria escrito "Procurando…", e para sempre.
  await page.waitForTimeout(3000);
  ok("a conversa apareceu sem esperar a função do banco", await achouOAlvo(),
     JSON.stringify((await naLista()).slice(0, 6)));
  ok("e o 'Procurando…' já saiu da tela", !(await dizProcurando()));
}

console.log("\n2. E quando o prazo estoura, a tela DIZ que estourou");
{
  // Passados os nove segundos, o que ficou pendurado é cortado. A tela não
  // pode simplesmente esquecer o assunto: quem procurou tem de saber que a
  // parte de dentro das mensagens não foi feita, senão vai concluir que
  // aquela lista é a lista completa.
  await page.waitForTimeout(PRAZO_DA_BUSCA - 2000);
  const texto = await page.locator("body").innerText();
  ok("a tela avisa que parou de esperar", /9 segundos|parei de esperar/i.test(texto),
     texto.slice(0, 300));
  ok("e a conversa achada continua na lista", await achouOAlvo(),
     "mostrar e tirar é pior do que nunca ter mostrado");
  ok("e nada de 'Procurando…'", !(await dizProcurando()));
}

console.log("\n3. Nada achado e TUDO pendurado: desiste e diz, em vez de ficar de pé");
{
  // O pior caso inteiro: nem a função, nem os contatos, nem as mensagens
  // respondem. Antes, isto era o "Procurando…" eterno da foto. A obrigação
  // aqui é só uma — ACABAR, e contar o que houve.
  await pendurar(["buscar_conversas", "contatos", "mensagens"]);
  await caixa.fill("");
  await page.waitForTimeout(300);
  await caixa.fill("ZZZZNINGUEMZZZZ");

  const comeco = Date.now();
  await page.waitForSelector('[data-recado-da-lista="procurando"]',
                             { state: "detached", timeout: PRAZO_DA_BUSCA + 6000 })
    .then(() => ok(`a busca acabou sozinha (${Math.round((Date.now() - comeco) / 100) / 10}s)`, true))
    .catch(() => ok("a busca acabou sozinha", false,
                    "continua procurando — é exatamente o defeito do relato"));

  const texto = await page.locator("body").innerText();
  ok("e a tela explica por que parou", /parei de esperar/i.test(texto),
     texto.slice(0, 300));
  // A METADE QUE PROTEGE: "Nada encontrado" é uma RESPOSTA — "esse cliente não
  // existe aqui" —, e quem lê isso para de procurar. Depois de uma busca que
  // não conseguiu perguntar, ela seria falsa.
  ok("e NÃO diz 'nada encontrado', que seria uma resposta que ela não apurou",
     !/Nada encontrado/i.test(texto), texto.slice(0, 300));
}

console.log("\n4. A tesoura: digitar outra letra CORTA a busca anterior");
{
  // O pedaço que ninguém vê, e o que explica a lentidão que se acumula. Antes,
  // a busca velha só era IGNORADA: a consulta continuava rodando no banco até
  // o fim, segurando conexão. Escrever um nome inteiro deixava três ou quatro
  // varreduras vivas ao mesmo tempo, e a última esperava atrás de todas.
  //
  // Nada disso aparece na tela — por isso a bancada conta os cortes.
  await pendurar(["buscar_conversas"]);
  await caixa.fill("");
  await page.waitForTimeout(300);
  await page.evaluate(() => { globalThis.__ABORTADAS = 0; });

  await caixa.fill("ZUL");
  await page.waitForTimeout(900);    // a busca saiu e ficou pendurada
  const antes = await page.evaluate(() => globalThis.__ABORTADAS || 0);
  await caixa.fill("ZULM");
  await page.waitForTimeout(900);
  const depois = await page.evaluate(() => globalThis.__ABORTADAS || 0);

  // A JANELA É MENOR QUE O PRAZO de propósito: dentro dela, só a tesoura pode
  // explicar um corte. Se fosse maior, o relógio dos nove segundos cortaria
  // sozinho e a prova aprovaria uma tesoura que não corta nada.
  ok("a busca anterior foi CORTADA, e não só ignorada", depois > antes,
     `cortes: ${antes} → ${depois}`);
}

console.log("\n5. E a busca continua servindo, com tudo respondendo de novo");
{
  // A TRAVA CONTRA O CONSERTO PELA METADE. Pôr prazo em tudo e deixar a busca
  // num estado quebrado seria trocar um defeito por outro.
  await pendurar([]);
  await caixa.fill("");
  await page.waitForTimeout(1500);
  ok("apagar a busca devolve a lista de conversas", (await naLista()).length > 3);

  await caixa.fill(ALVO);
  await page.waitForTimeout(2500);
  ok("e procurar de novo acha a conversa", await achouOAlvo(),
     JSON.stringify((await naLista()).slice(0, 6)));
  const texto = await page.locator("body").innerText();
  ok("sem sobra de aviso de tempo esgotado", !/parei de esperar/i.test(texto),
     texto.slice(0, 200));

  // "tudo respondendo de novo" passa a incluir o cadastro: é ele que fecha a
  // busca agora, e sem ele a tela ainda está esperando — com razão.
  vantoroAcordado = true;
  await caixa.fill("ZZZZNINGUEMZZZZ");
  await page.waitForTimeout(2500);
  const t2 = await page.locator("body").innerText();
  ok("e quando o banco responde e não há ninguém, ela DIZ que não achou",
     /Nada encontrado/i.test(t2), t2.slice(0, 200));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
