// O MIOLO DA CONVERSA TEM DE DIZER EM QUE PÉ ESTÁ.
//
// RELATO DE QUEM USA, 31/08, com foto: "zorvin está lento, não consigo abrir as
// mensagens". Na foto, uma conversa aberta — cabeçalho certo, número certo — e
// a área das mensagens PRETA. No banco, aquela conversa tinha mensagem: cinco,
// a primeira três minutos antes da foto.
//
// O QUE ESTAVA ERRADO NÃO ERA (SÓ) A DEMORA. Era que aquela área desenhava a
// MESMA COISA nas três situações:
//
//     ainda buscando   -> nada
//     a leitura falhou -> nada (e um aviso que some em 4 segundos)
//     não tem mensagem -> nada
//
// Três estados, uma tela. Quem olha não sabe se espera, se toca de novo, ou se
// a conversa está mesmo vazia — e "falhou" vira "está lento", que é o relato
// que chegou. O aviso de erro sumia antes de alguém ler, então nem depois dava
// para saber o que tinha acontecido.
//
// O resto do painel já fazia certo: o histórico ao lado diz "Levantando…", a
// galeria de mídias diz "Carregando…". Só o principal da tela ficava mudo.
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

async function abrirOPainel() {
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
}
const abrirAPrimeira = async () => {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2500);
};

console.log("\n1. Quando a leitura FALHA, a tela diz que falhou");
{
  // `addInitScript` e não `evaluate`: o recarregamento apaga o segundo, e a
  // recusa precisa estar de pé ANTES de o painel fazer a primeira consulta.
  await page.addInitScript(() => { globalThis.__RECUSAR_LEITURA = ["mensagens"]; });
  await abrirOPainel();
  await abrirAPrimeira();

  const temErro = await page.locator("[data-mensagens-erro]").count() > 0;
  ok("o miolo mostra o aviso de falha, e não uma área preta", temErro,
     "a conversa abriu muda — quem olha não sabe se espera ou se toca de novo");

  if (temErro) {
    const texto = (await page.locator("[data-mensagens-erro]").innerText()).replace(/\s+/g, " ");
    // NADA FOI PERDIDO tem de estar escrito. Uma conversa que aparece vazia
    // depois de uma falha faz pensar que o histórico do cliente sumiu, e é o
    // tipo de susto que leva alguém a mexer no banco por conta própria.
    ok("e diz que a conversa continua lá, nada perdido",
       /nada foi perdido/i.test(texto), texto.slice(0, 160));
    ok("e traz o código do banco, para dar o que investigar",
       /PGRST301/.test(texto), texto.slice(0, 160));
    ok("e oferece tentar de novo sem sair da conversa",
       await page.locator("[data-tentar-mensagens]").count() === 1);
  } else {
    ok("e diz que a conversa continua lá, nada perdido", false, "sem o aviso");
    ok("e traz o código do banco, para dar o que investigar", false, "sem o aviso");
    ok("e oferece tentar de novo sem sair da conversa", false, "sem o aviso");
  }

  // E NÃO PODE SER CONFUNDIDO COM VAZIA. São coisas diferentes, e a diferença
  // é justamente o que a pessoa precisa saber para decidir o que fazer.
  ok("e NÃO diz que a conversa está vazia",
     await page.locator("[data-conversa-sem-mensagem]").count() === 0,
     "a falha apareceu como 'nenhuma mensagem' — o oposto da verdade");
}

console.log("\n2. O 'tentar de novo' funciona de verdade");
{
  // O botão que não conserta nada é pior do que botão nenhum: quem clica
  // conclui que o sistema está quebrado sem jeito. É o mesmo defeito do
  // "Dispensar este aviso" de agosto, e por isso ele é conferido aqui.
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await page.locator("[data-tentar-mensagens]").first().click();
  await page.waitForTimeout(2500);

  ok("o aviso de falha sai da tela", await page.locator("[data-mensagens-erro]").count() === 0);
  const bolhas = await page.locator("[data-msg-id]").count();
  ok("e as mensagens aparecem", bolhas > 0, `apareceram ${bolhas} bolhas`);
}

console.log("\n3. Enquanto busca, a tela diz que está buscando");
{
  // Com a leitura das mensagens atrasada de propósito, a janela entre o clique
  // e a resposta fica visível — que é o pedaço em que a pessoa olha para a tela
  // e decide se o sistema travou.
  await page.addInitScript(() => {
    globalThis.__RECUSAR_LEITURA = [];
    globalThis.__ATRASO_POR_TABELA = { mensagens: 2500 };
  });
  await abrirOPainel();
  await page.locator("[data-conversa-nome]").nth(1).click();
  await page.waitForTimeout(600);

  ok("aparece 'Carregando as mensagens…' enquanto o banco não responde",
     await page.locator("[data-mensagens-carregando]").count() > 0,
     "a área ficou muda durante a espera — é o que vira 'está lento'");

  await page.waitForTimeout(3500);
  ok("e o aviso some quando as mensagens chegam",
     await page.locator("[data-mensagens-carregando]").count() === 0);
}

console.log("\n4. Conversa sem mensagem nenhuma diz isso, com todas as letras");
{
  // O CAMINHO É DETERMINÍSTICO: abre a lista, TIRA do banco as mensagens da
  // primeira conversa, sai dela e volta. Aí a leitura devolve vazio de
  // verdade — sem erro, sem atraso —, que é o estado "pronto e sem nada".
  //
  // É o caso do lead que ainda não escreveu, e o do contato aberto pelo botão
  // do outro número do cliente. Sem aviso, ele é indistinguível de uma falha:
  // a pessoa fica esperando um histórico que não existe.
  await page.addInitScript(() => { globalThis.__ATRASO_POR_TABELA = {}; });
  await abrirOPainel();

  const primeira = await page.locator("[data-conversa-nome]").first()
    .getAttribute("data-conversa-id");
  ok("achei a conversa para esvaziar", !!primeira, String(primeira));

  const quantasTinha = await page.evaluate((id) => {
    const t = globalThis.__TABELAS;
    const antes = (t.mensagens || []).filter((m) => String(m.conversa_id) === String(id)).length;
    t.mensagens = (t.mensagens || []).filter((m) => String(m.conversa_id) !== String(id));
    t.notas = (t.notas || []).filter((n) => String(n.conversa_id) !== String(id));
    t.fila_envio = (t.fila_envio || []).filter((f) => String(f.conversa_id) !== String(id));
    return antes;
  }, primeira);
  ok("e ela tinha mensagens antes de eu esvaziar", quantasTinha > 0,
     `tinha ${quantasTinha} — sem isso o passo abaixo não prova nada`);

  // Sai e volta, para forçar uma leitura nova.
  await page.locator("[data-conversa-nome]").nth(1).click();
  await page.waitForTimeout(1200);
  await page.locator(`[data-conversa-id="${primeira}"]`).first().click();
  await page.waitForTimeout(2000);

  ok("a conversa vazia diz que está vazia",
     await page.locator("[data-conversa-sem-mensagem]").count() === 1,
     "ficou muda — igual a uma que falhou, e igual a uma que ainda carrega");
  ok("e não finge que houve erro",
     await page.locator("[data-mensagens-erro]").count() === 0);
  ok("nem que ainda está carregando",
     await page.locator("[data-mensagens-carregando]").count() === 0);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
