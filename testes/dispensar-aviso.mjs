// "DISPENSAR ESTE AVISO" TEM DE DISPENSAR O AVISO.
//
// Relato do escritório: "vi no histórico de uma conversa um aviso de erro de
// mensagem — não temos mais erros, foi coisa do passado. Mas ao clicar em
// 'Dispensar esse aviso' nada aconteceu, além da mensagem 'Não consigo
// dispensar este aviso agora'".
//
// O QUE ACONTECIA. O aviso vermelho é lido de `fila_envio` com
// `status = 'erro'`. Dispensar era gravar `status = 'descartada'` — e SÓ isso:
//
//     const { error } = await supabase.from("fila_envio").update(...)
//     if (error) { mostrarAviso("Não consegui dispensar este aviso agora."); return; }
//     setMensagens((prev) => prev.filter(...));
//
// Se o banco recusasse a gravação, o botão não tinha plano nenhum. Ele avisava
// e devolvia a pessoa exatamente ao estado anterior. E o banco recusa: só a
// ponte escreve nessa coluna, e ela só escreve 'pendente', 'enviando',
// 'enviada' e 'erro' — 'descartada' é um valor que só o painel usa. Uma lista
// fechada de valores na coluna (`CHECK`), ou uma regra de acesso que esconde a
// linha do painel, e o gesto não tem como funcionar.
//
// Resultado na tela: uma falha de meses atrás, já resolvida, piscando em
// vermelho no meio de uma conversa, sem gesto capaz de tirá-la dali. O botão
// existia e não servia para nada.
//
// COMO SE PROVA. A bancada sabe recusar a gravação dos dois jeitos que um
// Postgres recusa — com erro (`__RECUSAR_STATUS`) e sem erro, alterando zero
// linhas (`__ESCRITA_SEM_EFEITO`). Nos dois casos o aviso tem de sair da tela,
// continuar fora depois de recarregar a página, e a tela tem de dizer a verdade
// sobre o que o banco respondeu — em vez de "não consigo agora", que não diz
// nada a ninguém.
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

/** Abre a conversa que tem os dois avisos de falha da bancada. */
async function abrirAConversaComFalha() {
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2500);
}

const contarAvisos = () => page.locator("[data-dispensar-aviso]").count();

// A LIMPEZA COMEÇA DO ZERO, sempre. O registro dos dispensados mora no
// aparelho e sobrevive ao recarregamento — que é o ponto dele. Numa prova que
// roda duas vezes seguidas, a segunda começaria com tudo já dispensado e
// passaria sem ter exercido nada.
await page.goto(ENDERECO);
await page.evaluate(() => localStorage.removeItem("zorvin_avisos_dispensados"));

console.log("\nCom o banco aceitando a gravação (o caminho feliz)");
{
  await abrirAConversaComFalha();
  const antes = await contarAvisos();
  ok("a conversa tem avisos de falha para dispensar", antes >= 2, `achei ${antes}`);

  await page.locator("[data-dispensar-aviso]").first().click();
  await page.waitForTimeout(1200);
  ok("clicar em 'Dispensar este aviso' tira o aviso da tela",
     (await contarAvisos()) === antes - 1, `de ${antes} para ${await contarAvisos()}`);

  const naFila = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).map((l) => l.status));
  ok("e a linha vira 'descartada' no banco, sem ser apagada",
     naFila.includes("descartada") && naFila.length >= 2, JSON.stringify(naFila));

  await abrirAConversaComFalha();
  ok("e ela não volta ao reabrir a conversa",
     (await contarAvisos()) === antes - 1, `voltaram ${await contarAvisos()}`);
}

console.log("\nCom o banco RECUSANDO a gravação (uma lista fechada de valores na coluna)");
{
  // É ESTE O CASO DO RELATO. Antes: o aviso ficava na tela para sempre.
  await page.evaluate(() => localStorage.removeItem("zorvin_avisos_dispensados"));
  await page.addInitScript(() => {
    globalThis.__RECUSAR_STATUS = ["descartada"];
  });
  await abrirAConversaComFalha();
  const antes = await contarAvisos();
  ok("os avisos voltaram (a limpeza do aparelho valeu)", antes >= 2, `achei ${antes}`);

  await page.locator("[data-dispensar-aviso]").first().click();
  await page.waitForTimeout(1500);

  // A CONFERÊNCIA QUE PEGA O DEFEITO. Aqui ficava exatamente igual a antes.
  ok("mesmo assim o aviso sai da tela",
     (await contarAvisos()) === antes - 1, `de ${antes} para ${await contarAvisos()}`);

  const naTela = await page.evaluate(() => document.body.innerText);
  ok("e a tela diz que ele saiu só aqui, em vez de 'não consigo agora'",
     /deste computador/i.test(naTela), "nada dizendo o que houve");
  // O CÓDIGO DO BANCO E O ARQUIVO A RODAR. Sem os dois, o recado é bonito e
  // não leva a lugar nenhum: quem lê não tem o que fazer com a informação.
  ok("e diz o código do banco, para dar o que consertar",
     /23514/.test(naTela), "nenhum código do banco na tela");
  ok("e diz qual arquivo rodar para valer para todo mundo",
     /dispensar_aviso_de_falha\.sql/i.test(naTela), "nenhuma saída oferecida");

  // E CONTINUA FORA DEPOIS DE RECARREGAR. Sem isto o gesto seria um alívio de
  // dez segundos: a próxima abertura da conversa traria o alarme de volta,
  // porque no banco a linha continua com `status = 'erro'`.
  await abrirAConversaComFalha();
  ok("e não volta ao reabrir a conversa, mesmo com o banco recusando",
     (await contarAvisos()) === antes - 1, `voltaram ${await contarAvisos()}`);

  const naFila = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).map((l) => l.status));
  // `[].every(...)` É VERDADE — verdade vazia. Sem a linha de baixo, a fila
  // APAGADA passaria por "a linha continua no banco, intacta", que é o oposto
  // exato do que esta conferência promete: quem fosse investigar não acharia
  // mais nada.
  ok("há linha na fila para conferir", naFila.length > 0, "a fila ficou vazia");
  ok("e a linha continua no banco, intacta, para quem for investigar",
     naFila.every((s) => s === "erro"), JSON.stringify(naFila));
}

console.log("\nCom o banco aceitando e não alterando nada (regra de acesso fechada)");
{
  // A FALHA SEM ERRO. O Postgres não reclama de uma regra de acesso que esconde
  // a linha: ele atualiza zero linhas e responde "tudo certo". O painel via
  // `error === null`, dava o gesto por feito, e o aviso voltava na abertura
  // seguinte sem explicação nenhuma.
  await page.evaluate(() => localStorage.removeItem("zorvin_avisos_dispensados"));
  await page.addInitScript(() => {
    globalThis.__RECUSAR_STATUS = [];
    globalThis.__ESCRITA_SEM_EFEITO = ["fila_envio"];
  });
  await abrirAConversaComFalha();
  const antes = await contarAvisos();
  ok("os avisos estão lá de novo", antes >= 2, `achei ${antes}`);

  await page.locator("[data-dispensar-aviso]").first().click();
  await page.waitForTimeout(1500);
  ok("o aviso sai da tela", (await contarAvisos()) === antes - 1,
     `de ${antes} para ${await contarAvisos()}`);
  const naTela = await page.evaluate(() => document.body.innerText);
  ok("e a tela conta que nenhuma linha foi alterada, em vez de calar",
     /nenhuma linha/i.test(naTela), "a tela não denunciou a escrita sem efeito");

  await abrirAConversaComFalha();
  ok("e ele não volta ao reabrir", (await contarAvisos()) === antes - 1,
     `voltaram ${await contarAvisos()}`);
}

console.log("\nO botão VIZINHO — 'reenviar' — tinha o mesmo buraco e não tinha prova nenhuma");
{
  // POR QUE ISTO ENTRA AQUI. `reenviar` é o irmão de `dispensarFalha`: os dois
  // saem da mesma bolha vermelha, e os dois aposentam a linha velha da fila
  // gravando 'descartada'. Só que `reenviar` fazia isso com os erros engolidos:
  //
  //     supabase.from("fila_envio").update({ status: "descartada" })...
  //       .then(() => {}, () => {});
  //
  // Se essa gravação não passasse — e ela não passa, é o mesmo banco que
  // recusava a do "Dispensar" —, a mensagem SAÍA para o cliente e a bolha
  // vermelha da tentativa velha voltava a cada abertura da conversa, para
  // sempre. Ninguém relacionaria uma coisa à outra: a mensagem chegou, e a tela
  // continua dizendo que não foi enviada.
  //
  // E ele não tinha conferência NENHUMA em toda a bancada — o botão que reenvia
  // uma mensagem a um cliente, sem prova. Este é o buraco maior dos dois.
  await page.evaluate(() => localStorage.removeItem("zorvin_avisos_dispensados"));
  await page.addInitScript(() => {
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__RECUSAR_STATUS = ["descartada"];   // o banco do relato, recusando
  });
  await abrirAConversaComFalha();
  const antes = await contarAvisos();
  ok("a bolha vermelha está lá, com o 'reenviar'", antes >= 2, `achei ${antes}`);

  const naFilaAntes = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).length);
  await page.locator("[data-reenviar]").first().click();
  await page.waitForTimeout(2500);

  const naFila = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).map((l) => ({ t: l.texto, s: l.status })));
  console.log(`     fila: ${JSON.stringify(naFila)}`);
  ok("reenviar cria uma linha NOVA, pendente, na fila",
     naFila.length === naFilaAntes + 1 && naFila.some((l) => l.s === "pendente"),
     JSON.stringify(naFila));
  // O TEXTO É CONFERIDO PELO TEXTO, e não por "tem alguma coisa escrita".
  //
  // `every((l) => !!l.t)` respondia à pergunta errada: reenviar com o texto de
  // OUTRA mensagem — mandar ao cliente uma frase que ele nunca deveria receber
  // agora — passava por "com o mesmo texto da mensagem que falhou". E numa
  // lista vazia passava do mesmo jeito, porque `[].every(...)` é verdade.
  const pendentes = naFila.filter((l) => l.s === "pendente");
  ok("nasceu exatamente uma linha pendente", pendentes.length === 1,
     JSON.stringify(naFila));
  // Os textos que a bancada põe na fila com erro nesta conversa. O reenvio tem
  // de repetir UM DELES, letra por letra.
  const DA_CONVERSA = ["Doutor, segue o documento que combinamos",
                       "Consegue confirmar por aqui?"];
  ok("com o mesmo texto da mensagem que falhou",
     pendentes.length === 1 && DA_CONVERSA.includes(pendentes[0].t),
     JSON.stringify(naFila));
  // E COM QUEM ESCREVEU. Faltava aqui e só aqui: a reenviada era a única da
  // conversa a continuar assinada com o nome de antes.
  const autores = await page.evaluate(() =>
    (globalThis.__TABELAS.fila_envio || []).filter((l) => l.status === "pendente")
      .map((l) => l.enviado_por));
  ok("e assinada por quem escreveu",
     autores.length === 1 && !!autores[0],
     `autores das pendentes: ${JSON.stringify(autores)}`);

  // A CONFERÊNCIA QUE PEGA O DEFEITO. Com o banco recusando o 'descartada', a
  // linha velha continua com `status = 'erro'` — e sem o registro no aparelho a
  // bolha vermelha voltaria aqui, com a mensagem já entregue.
  await abrirAConversaComFalha();
  ok("e a bolha vermelha da tentativa velha NÃO volta ao reabrir",
     (await contarAvisos()) === antes - 1,
     `voltaram ${await contarAvisos()} de ${antes} — a tentativa velha ressuscitou`);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
