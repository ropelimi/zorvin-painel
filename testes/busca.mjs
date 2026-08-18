// PROVA DA BUSCA — procurar pelo nome que está na tela tem de achar.
//
// Três casos, todos reais:
//
//   1. O contato cujo nome vem do CADASTRO do Vantoro. A lista mostra
//      "MARIA DAS GRAÇAS PEREIRA"; o `nome` do contato ainda é "Deusdete", o
//      apelido que ele deixou no WhatsApp.
//   2. O contato batizado AQUI DENTRO (`nome_zorvin`) — o lead que ainda não
//      virou cadastro.
//   3. O contato que está DEPOIS da milésima conversa. A API do Supabase
//      devolve no máximo 1000 linhas e cala; uma busca feita sobre a lista que
//      está na tela não alcança ninguém que esteja além disso.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const URL = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, detalhe = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? " — " + detalhe : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(1500);

const caixa = page.locator('input[placeholder*="Buscar por nome"]');

/** Digita na busca e devolve os nomes que sobraram na lista de conversas. */
async function procurar(termo) {
  await caixa.fill("");
  await page.waitForTimeout(150);
  await caixa.fill(termo);
  // 350ms de espera da própria busca + folga para a consulta responder.
  await page.waitForTimeout(1800);
  return page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome")));
}

async function trocarTelefone(nome) {
  const alvo = page.locator(`[data-telefone="${nome}"]`);
  if (!(await alvo.count())) return false;
  await alvo.first().click();
  await page.waitForTimeout(2200);
  return true;
}

console.log("\nBusca por nome");

// ---- 1. o nome que veio do cadastro do Vantoro ----
{
  const achados = await procurar("GRAÇAS");
  ok('acha pelo nome do CADASTRO ("MARIA DAS GRAÇAS PEREIRA")',
     achados.some((n) => /GRA[ÇC]AS/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 2. o nome dado aqui dentro ----
{
  const achados = await procurar("Feira do Livro");
  ok('acha pelo nome dado no Zorvin ("Lead Feira do Livro")',
     achados.some((n) => /Feira do Livro/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 3. o nome que o WhatsApp deu continua achando ----
{
  const achados = await procurar("JOSEFA");
  ok("acha pelo nome que veio do WhatsApp",
     achados.some((n) => /JOSEFA/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 4. o apelido continua servindo, mesmo quando não é o nome mostrado ----
{
  const achados = await procurar("Deusdete");
  ok("acha pelo apelido do WhatsApp, mesmo com o cadastro por cima",
     achados.some((n) => /GRA[ÇC]AS|Deusdete/i.test(n || "")), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 5. o que está depois da milésima conversa ----
{
  const nome = await page.evaluate(() => globalThis.__ESPERADO.fundo.nome);
  const foi = await trocarTelefone("Arquivo");
  ok("consigo abrir o telefone com mais de mil conversas", foi);
  if (foi) {
    const quantas = await page.evaluate(() => document.querySelectorAll("[data-conversa-nome]").length);
    console.log(`     a lista trouxe ${quantas} conversas de 1200`);
    const achados = await procurar(nome.split(" ")[0]);
    ok(`acha "${nome}", que está na conversa 1151 de 1200`,
       achados.some((n) => (n || "").includes(nome)), `veio: ${JSON.stringify(achados.slice(0, 5))}`);
  }
}

// ---- 6. pelo TEXTO de uma mensagem, numa conversa que a lista não trouxe ----
{
  const texto = await page.evaluate(() => globalThis.__ESPERADO.fundo.texto);
  const achados = await procurar(texto);
  ok(`acha pelo que foi DITO na conversa ("${texto}")`, achados.length > 0,
     `veio: ${JSON.stringify(achados.slice(0, 5))}`);
  ok("e explica por que aquela conversa apareceu",
     achados.length > 0
       && /💬/.test(await page.locator("[data-conversa-nome]").first().innerText()),
     "sem conversa na lista não há o que explicar");
}

// ---- 7. termo com parêntese não derruba a busca ----
// A vírgula e os parênteses separam condições dentro de um `or` do PostgREST:
// deixá-los passar não devolve "nada encontrado", devolve ERRO — e a busca
// inteira morria em silêncio ao procurar por um telefone escrito à mão.
{
  // De volta ao telefone onde esse contato conversa: o teste anterior trocou
  // para o "Arquivo", e a busca é por telefone — procurar aqui não acharia nada
  // por um motivo legítimo, e a conferência acusaria um defeito que não existe.
  await trocarTelefone("Acordos 1");
  const achados = await procurar("(67) 99111-0001");
  ok("procurar um telefone escrito à mão acha o contato", achados.length > 0,
     `veio: ${JSON.stringify(achados.slice(0, 5))}`);
}

// ---- 8. busca curta não filtra nada, e limpar devolve a lista ----
{
  const achados = await procurar("");
  ok("apagar a busca devolve a lista inteira", achados.length > 5, `veio ${achados.length}`);
}

// ==================================================================
//  9. O ACENTO
// ==================================================================
//
// Ninguém digita "MARIA DAS GRAÇAS" com cedilha numa caixa de busca. Digita-se
// "gracas", e o teclado do celular nem oferece o resto.
//
// O `ilike` do Postgres compara letra por letra: "ç" não é "c", "ã" não é "a".
// Então o cliente cadastrado com acento no nome — que é a maioria dos nomes
// brasileiros — não aparece. E aparece o de nome sem acento, o que faz o
// defeito parecer aleatório: "em alguns casos não aparece, mesmo cadastrado".
{
  console.log("\nO acento");
  const achados = await procurar("gracas");
  ok('procurar "gracas" acha "MARIA DAS GRAÇAS PEREIRA"',
     achados.some((n) => /GRA[ÇC]AS/i.test(n || "")),
     `veio: ${JSON.stringify(achados.slice(0, 5))} — ninguém digita cedilha na busca`);

  const comAcento = await procurar("GRAÇAS");
  ok("e procurar com o acento continua achando",
     comAcento.some((n) => /GRA[ÇC]AS/i.test(n || "")),
     `veio: ${JSON.stringify(comAcento.slice(0, 5))}`);
}

// ==================================================================
//  10. O QUE FOI DITO DENTRO DA CONVERSA
// ==================================================================
//
// No WhatsApp, procurar uma palavra acha a conversa em que ela foi escrita.
// Aqui a palavra é "teste", que é comum: ela existe nesta conversa e em outras
// 1.400 mensagens mais recentes, de outros telefones.
//
// A busca pedia as 1000 mensagens mais recentes que casassem, do escritório
// INTEIRO, e só depois jogava fora as de outros telefones. Uma palavra comum
// enche as mil vagas com conversa alheia e a certa fica de fora — sem erro
// nenhum na tela.
//
// E, antes disso, a consulta varria `mensagens` inteira: `ilike '%teste%'` não
// usa índice, e a API corta em 8 segundos. O que voltava era um erro que
// ninguém conferia — `data` nulo, lista vazia, nada dito.
{
  console.log("\nO que foi dito dentro da conversa");
  await trocarTelefone("Acordos 1");
  const palavra = await page.evaluate(() => globalThis.__PALAVRA_NA_CONVERSA || "teste");
  const achados = await procurar(palavra);
  ok(`procurar "${palavra}" acha a conversa em que essa palavra foi escrita`,
     achados.length > 0,
     `não veio nada — a palavra está numa mensagem enviada por este telefone`);
  ok("e a conversa aparece marcada como achada pela mensagem",
     achados.length > 0
       && /💬/.test(await page.locator("[data-conversa-nome]").first().innerText()),
     "sem o balãozinho, quem procurou não sabe por que aquela conversa apareceu");
}

// ==================================================================
//  11. QUANDO A BUSCA NÃO CONSEGUE, ELA PRECISA DIZER
// ==================================================================
//
// Uma busca que falha e mostra lista vazia é pior do que uma que falha e avisa:
// a lista vazia é uma RESPOSTA — "esse cliente não existe aqui" —, e quem leu
// isso para de procurar.
{
  console.log("\nQuando não dá");
  await page.evaluate(() => { globalThis.__QUEBRAR_BUSCA = true; });
  const achados = await procurar("qualquercoisa");
  const texto = await page.locator("body").innerText();
  ok("busca que falha avisa, em vez de dizer que não há nada",
     /não consegui|tente de novo|falhou/i.test(texto),
     `a tela mostrou ${achados.length} conversa(s) e nenhum aviso`);
  await page.evaluate(() => { globalThis.__QUEBRAR_BUSCA = false; });
}

// ==================================================================
//  12. CLICAR NO RESULTADO LEVA ATÉ A MENSAGEM
// ==================================================================
//
// Achar a conversa é meio caminho. Se a palavra foi dita há três meses, abrir
// a conversa no fim deixa a pessoa procurando dentro dela, rolando — que é o
// trabalho que a busca deveria ter poupado.
//
// A mensagem de prova está a três meses de distância, com 200 mensagens depois
// dela: fora, portanto, das 120 que a conversa carrega ao abrir. Se ela
// estivesse perto do fim, esta conferência passaria sem que nada tivesse sido
// feito.
{
  console.log("\nClicar no resultado leva até a mensagem");
  await trocarTelefone("Acordos 1");
  const palavra = await page.evaluate(() => globalThis.__PALAVRA_NA_CONVERSA || "teste");
  const alvo = await page.evaluate(() => globalThis.__MSG_ACHADA);
  const achados = await procurar(palavra);
  ok("a busca acha a conversa", achados.length > 0);

  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2000);

  const bolha = page.locator(`[data-msg-id="${alvo}"]`);
  ok("a mensagem achada é carregada, mesmo estando fora das últimas 120",
     await bolha.count() > 0,
     "a conversa abriu no fim, e a mensagem de três meses atrás nem foi buscada");

  if (await bolha.count()) {
    const naTela = await bolha.first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
    });
    ok("e a tela está nela, sem ninguém rolar", naTela,
       "a mensagem está carregada mas fora da vista — quem clicou continua procurando");

    const marcada = await bolha.first().evaluate(
      (el) => getComputedStyle(el).backgroundColor !== "rgba(0, 0, 0, 0)");
    ok("e ela vem destacada, para dar para saber qual é", marcada,
       "sem marca, a tela para no meio da conversa e nada diz qual bolha respondeu à busca");
  }

  // ---- E DE NOVO, COM OUTRA PALAVRA DA MESMA CONVERSA ----
  //
  // É o caso do relato: a primeira busca leva à mensagem; a segunda, na mesma
  // conversa, abre no fim. Duas coisas conspiram aqui — a conversa já está
  // aberta (então nada é recarregado) e a rolagem automática para o fim, que
  // devia ter sido travada, não é.
  const outra = await page.evaluate(() => globalThis.__OUTRA_PALAVRA);
  const alvo2 = await page.evaluate(() => globalThis.__MSG_ACHADA_2);
  await procurar(outra);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2500);

  const bolha2 = page.locator(`[data-msg-id="${alvo2}"]`);
  const naTela2 = await bolha2.count()
    ? await bolha2.first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
      })
    : false;
  ok("procurar outra palavra da MESMA conversa também leva até ela",
     naTela2,
     "a segunda busca abriu a conversa no fim — foi exatamente este o relato");

  // ---- E DEPOIS DE FECHAR E ABRIR OUTRA VEZ ----
  //
  // Fechar a conversa e voltar pela busca é o gesto de quem está conferindo
  // várias — e é onde um alvo consumido no lugar errado deixa de valer.
  await page.locator("[data-conversa-nome]").first().click().catch(() => {});
  await procurar(palavra);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2500);
  const devolta = await page.locator(`[data-msg-id="${alvo}"]`).count()
    ? await page.locator(`[data-msg-id="${alvo}"]`).first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
      })
    : false;
  ok("e voltar à primeira palavra leva de volta à primeira mensagem", devolta,
     "a terceira busca não levou a lugar nenhum");

  // ---- E COM A PÁGINA RECÉM-CARREGADA ----
  //
  // No relato, atualizar a página e fazer a PRIMEIRA busca também falhava, com
  // os mesmos passos que tinham funcionado minutos antes. Duas execuções
  // iguais com resultados diferentes é a assinatura de uma corrida: o salto só
  // aparecia quando ganhava da rolagem automática para o fim. Cinco voltas,
  // porque uma corrida ganha às vezes.
  let saltouSempre = true;
  for (let volta = 1; volta <= 5; volta++) {
    await page.reload();
    await page.waitForSelector("[data-conversa-nome]");
    await page.waitForTimeout(1500);
    await procurar(palavra);
    await page.locator("[data-conversa-nome]").first().click();
    await page.waitForTimeout(2500);
    const viu = await page.locator(`[data-msg-id="${alvo}"]`).count()
      ? await page.locator(`[data-msg-id="${alvo}"]`).first().evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
        })
      : false;
    if (!viu) { saltouSempre = false; console.log(`     falhou na volta ${volta}`); }
  }
  ok("com a página recém-carregada, leva até a mensagem TODA vez", saltouSempre,
     "às vezes vai e às vezes não — é corrida, não acaso");

  // Abrir a MESMA conversa de novo, agora sem busca, tem de voltar ao normal:
  // o alvo é de uma busca, não uma propriedade da conversa.
  await procurar("");
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1800);
  const ultima = await page.evaluate(() => {
    const todas = [...document.querySelectorAll("[data-msg-id]")];
    return todas.length ? todas[todas.length - 1].getAttribute("data-msg-id") : null;
  });
  ok("abrir a conversa sem busca volta a mostrar o fim",
     ultima !== null && ultima !== alvo,
     `a última bolha desenhada é "${ultima}"`);
}

// ==================================================================
//  13. ANTES DE O SQL SER RODADO
// ==================================================================
//
// O código vai para o ar antes do script — sempre vai, porque são duas ações
// diferentes feitas por mãos diferentes. Nesse intervalo a busca precisa
// continuar funcionando COMO ESTAVA, e não pior: quem não rodou o SQL ainda
// não tem a comparação sem acento, mas tem de continuar achando pelo nome.
{
  console.log("\nAntes de o SQL ser rodado");
  await page.evaluate(() => { globalThis.__SEM_BUSCA_NO_BANCO = true; });
  await trocarTelefone("Acordos 1");
  const achados = await procurar("JOSEFA");
  ok("sem a função no banco, a busca por nome continua achando",
     achados.some((n) => /JOSEFA/i.test(n || "")),
     `veio: ${JSON.stringify(achados.slice(0, 5))} — o caminho antigo precisa `
     + "continuar de pé enquanto o script não é rodado");
  await page.evaluate(() => { globalThis.__SEM_BUSCA_NO_BANCO = false; });
}

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
