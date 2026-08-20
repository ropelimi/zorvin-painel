// AS DUAS TELAS QUE MENTIRAM EM 20/08.
//
// Relato, em duas partes, com quinze minutos entre elas:
//
//   1. "Parece que o Zorvin está fora do ar" — a tela parada em "Carregando…",
//      sem erro, sem botão, sem nada. Para sempre.
//   2. "Consegui logar mas está assim agora" — o painel aberto dizendo
//      "Você não tem nenhum número liberado neste departamento" para quem é
//      ADMINISTRADOR e alcança todos os telefones do escritório.
//
// Nenhuma das duas era verdade. O log da ponte do mesmo horário mostra o Auth
// do Supabase respondendo em 161ms e as mensagens entrando e saindo o tempo
// todo; o console do navegador não tem um único erro do painel. O que houve
// foi um tropeço passageiro — e duas telas que reagiram a ele afirmando
// coisas que não apuraram.
//
// O QUE ESTAS PROVAS VIGIAM, e é uma coisa só dita de dois jeitos: uma
// PERGUNTA QUE NÃO FOI RESPONDIDA NÃO PODE VIRAR UMA RESPOSTA. Nem "não há
// sessão" quando o serviço não respondeu, nem "você não tem acesso" quando a
// consulta falhou.
//
// Um F5 resolvia as duas. Isso não é consolo: é a prova de que não havia nada
// errado com a conta nem com a permissão — e de que a tela não dava a ninguém
// motivo para tentar.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Uma aba nova, com os interruptores da bancada ligados ANTES de a página
 *  carregar — o defeito acontece na primeira leitura, e ligar depois seria
 *  chegar atrasado ao lugar do acidente. */
async function abrirCom(preparar) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(preparar);
  const erros = [];
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  return { ctx, page, erros };
}

// ==================================================================
console.log("\nO Auth que não responde não pode prender a tela");
// ==================================================================
{
  // `__SESSAO_PENDURADA` faz `getSession` NUNCA voltar. É o que a biblioteca
  // do Supabase faz quando o bilhete guardado venceu e o serviço de renovação
  // está fora: ela fica pendurada na rede.
  //
  // Pendurada, e não com erro, de propósito: erro tem `catch`, e o defeito era
  // não haver caminho nenhum — nem de erro, nem de prazo.
  const { ctx, page, erros } = await abrirCom(() => {
    globalThis.__SESSAO_PENDURADA = true;
    // E há uma sessão guardada aqui, em dia. É o caso de quem estava
    // trabalhando: a credencial está no navegador, boa, e não depende de
    // ninguém lá fora para ser usada — o banco e o tempo real conferem o
    // bilhete sozinhos.
    localStorage.setItem("sb-bancada-auth-token", JSON.stringify({
      access_token: "jwt-guardado",
      refresh_token: "",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "u1", email: "rodrigo@ropelimi", user_metadata: { nome: "Rodrigo" } },
    }));
  });

  await page.goto(ENDERECO);

  // O prazo da bancada é 1,2s (`VITE_LIMITE_SESSAO_MS`). Cinco segundos é
  // folga de sobra — e se passar disso, é porque ficou preso mesmo.
  let chegou = true;
  try {
    await page.waitForSelector("[data-conversa-nome]", { timeout: 5000 });
  } catch (_e) { chegou = false; }

  const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  ok("a tela NÃO fica presa em 'Carregando…'", !/Carregando/.test(texto),
     `dizia: "${texto.slice(0, 120)}"`);
  ok("e o painel abre com a sessão guardada no navegador", chegou,
     "sem isto, quem estava trabalhando é posto para fora por causa de um "
     + "serviço que nem é preciso para usar o painel");

  ok("sem erro de JavaScript no caminho", erros.length === 0, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem sessão guardada, vai para a entrada — e explica");
// ==================================================================
{
  const { ctx, page } = await abrirCom(() => {
    globalThis.__SESSAO_PENDURADA = true;
    globalThis.__DESLOGADO = true;
    localStorage.removeItem("sb-bancada-auth-token");
  });

  await page.goto(ENDERECO);
  let entrada = true;
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
  } catch (_e) { entrada = false; }

  ok("cai na tela de entrada em vez de ficar carregando", entrada);
  const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  ok("e não fica 'Carregando…'", !/Carregando/.test(texto), `dizia: "${texto.slice(0, 120)}"`);
  // O AVISO EXISTE PARA NÃO CULPAR QUEM ESTÁ ENTRANDO. Sem ele, a pessoa cai
  // numa tela de login comum e conclui que esqueceu a senha.
  ok("com o aviso de que a conferência é que demorou",
     /demorou demais para responder/i.test(texto), `dizia: "${texto.slice(0, 200)}"`);
  ok("e dizendo para entrar assim mesmo, porque a entrada não depende dele",
     /não depende desse serviço/i.test(texto), `dizia: "${texto.slice(0, 240)}"`);
  await ctx.close();
}

// ==================================================================
console.log("\nConsulta que falha não vira 'você não tem acesso'");
// ==================================================================
{
  // QUEBRA-SE `advogados`, E NÃO `permissoes`. A diferença não é detalhe.
  //
  // A primeira versão desta prova quebrava `permissoes` — e passou no código
  // VELHO, que tinha o defeito. Motivo: quem está entrado na bancada é
  // administrador, e administrador alcança todos os telefones sem consultar
  // permissão nenhuma (`filtrarPermitidos` devolve a lista inteira antes de
  // olhar para o erro). A lista não esvaziava, a frase não aparecia, e a
  // conferência ficava verde sobre um caminho que ela não tinha percorrido.
  //
  // Quebrar `advogados` reproduz o relato como ele aconteceu: a lista de
  // telefones volta vazia para QUALQUER pessoa, inclusive para quem é
  // administrador — que foi exatamente quem leu na tela que não tinha número
  // liberado nenhum.
  const { ctx, page, erros } = await abrirCom(() => {
    globalThis.__QUEBRAR = ["advogados"];
  });

  await page.goto(ENDERECO);
  await page.waitForTimeout(2500);

  const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");

  // A CONFERÊNCIA PRINCIPAL desta prova. A frase é uma afirmação sobre a
  // permissão de alguém, e ela não pode sair de uma pergunta sem resposta.
  ok("a tela NÃO afirma que a pessoa está sem número liberado",
     !/não tem nenhum número liberado/i.test(texto), `dizia: "${texto.slice(0, 240)}"`);

  const caixa = page.locator("[data-erro-do-acesso]");
  ok("ela diz que não conseguiu conferir", await caixa.count() === 1);
  const dentro = await caixa.count() ? (await caixa.innerText()).replace(/\s+/g, " ") : "";
  ok("nomeando o que não veio", /telefones/i.test(dentro), `dizia: "${dentro}"`);
  // ISTO É PARA A PESSOA, E NÃO PARA QUEM PROGRAMA. Quem lê "não tem acesso"
  // vai procurar o administrador; quem lê isto tenta de novo.
  ok("e separando as duas coisas com todas as letras",
     /não quer dizer que você perdeu acesso/i.test(dentro), `dizia: "${dentro}"`);

  const temBotao = await page.locator("[data-tentar-acesso]").count() === 1;
  ok("e oferece tentar de novo, que era a saída que ninguém sabia que existia", temBotao);

  // O BOTÃO PRECISA FUNCIONAR. Um botão que reapresenta o mesmo erro é pior
  // do que não ter botão: ele promete uma saída e não entrega.
  //
  // O `if` não é frouxidão: sem ele, a ausência do botão ESTOURA o arquivo
  // aqui (`locator.click` espera trinta segundos e desiste com exceção), e
  // tudo o que vem depois deixa de ser conferido. Rodando contra o código
  // velho foi o que aconteceu — a seção das quatro consultas nem chegou a
  // rodar. Uma prova que morre no meio esconde o resto do que ela sabia.
  if (temBotao) {
    await page.evaluate(() => { globalThis.__QUEBRAR = []; });
    await page.locator("[data-tentar-acesso]").click();
    let voltou = true;
    try {
      await page.waitForSelector("[data-conversa-nome]", { timeout: 6000 });
    } catch (_e) { voltou = false; }
    ok("e ao tentar de novo, com o banco respondendo, os telefones voltam", voltou,
       "sem recarregar a página");

    const depois = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    ok("e o aviso de erro some quando deixa de ser verdade",
       await page.locator("[data-erro-do-acesso]").count() === 0, depois.slice(0, 120));
  } else {
    ok("e ao tentar de novo, com o banco respondendo, os telefones voltam", false,
       "não há botão para clicar");
    ok("e o aviso de erro some quando deixa de ser verdade", false, "não há aviso");
  }

  ok("sem erro de JavaScript no caminho", erros.length === 0, erros.slice(0, 2).join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nCada uma das quatro consultas, sozinha, já bastava para mentir");
// ==================================================================
{
  // A prova acima quebra `permissoes`. Mas o `usuarios` é o pior dos quatro:
  // é dele que sai o "sou administrador", e o erro dele nem chegava a ser
  // olhado (`eu.data && eu.data.admin` — sem `eu.error` em lugar nenhum).
  // Para um administrador, essa única falha esvaziava a barra inteira.
  for (const tabela of ["usuarios", "permissoes", "departamentos"]) {
    const { ctx, page } = await abrirCom(new Function(
      `globalThis.__QUEBRAR = ["${tabela}"];`));
    await page.goto(ENDERECO);
    await page.waitForTimeout(2200);
    const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    ok(`com '${tabela}' fora do ar, a tela não afirma falta de acesso`,
       !/não tem nenhum número liberado/i.test(texto), `dizia: "${texto.slice(0, 160)}"`);
    ok(`e explica o que houve (${tabela})`,
       await page.locator("[data-erro-do-acesso]").count() === 1);
    await ctx.close();
  }
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
