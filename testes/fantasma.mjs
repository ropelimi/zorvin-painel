// A CONVERSA FANTASMA — a linha vazia que nasce de um clique.
//
// Relato: "quando eu seleciono um contato abre a conversa, mas se eu não
// enviar nenhuma mensagem para o contato, ele permanece como se fosse uma
// conversa, só que não existe nenhuma conversa, então não deveria aparecer.
// Tem que funcionar igual no WhatsApp".
//
// O que acontecia: abrir um contato cria a linha em `conversas` na hora — tem
// de criar, porque a tela inteira pendura nela. Só que a linha entrava na
// lista com o horário do clique e nenhuma palavra dentro, e ficava lá para
// sempre. Na captura de tela do relato, o mesmo contato aparecia DUAS vezes: a
// conversa de verdade, com prévia, e a fantasma logo acima dela.
//
// O QUE ESTA PROVA VIGIA DE VERDADE, e que é onde mora o risco: que o esconder
// erre para o lado de MOSTRAR. Uma tela que some com conversa por engano, num
// escritório de advocacia, é pior do que a linha vazia que ela veio consertar
// — some sem erro, sem log, e ninguém procura o que não sabe que sumiu. Por
// isso há conferência para a junção que não veio, para a contagem que falhou e
// para a conversa fixada.
//
// AS LINHAS SÃO PLANTADAS NA MONTAGEM (`__SEMENTE`, por `addInitScript`), e
// não empurradas no array depois. A bancada reconstrói as tabelas a cada
// carregamento, e esta prova PRECISA recarregar — é recarregando que se vê o
// que a consulta devolve, em vez do que sobrou na tela. Na primeira versão eu
// plantei depois: a linha sumia no `reload` e a conferência ficava verde por a
// linha não existir, e não por a tela ter escondido. Verde falando de outro
// assunto é pior do que vermelho.
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

// Aprende qual telefone está NA TELA, e o feitio de uma linha de conversa.
//
// O molde vem de uma conversa que está sendo DESENHADA, e não de
// `__TABELAS.conversas[0]`. A amostra tem 1339 conversas de vários telefones,
// e o painel abre no que ficou guardado — que é o `a7`, enquanto a primeira
// linha da tabela é do `a1`. Lendo dali, eu plantava as conversas num telefone
// que não está aberto: elas não apareciam, e a prova concluía "a tela
// escondeu" sobre linhas que a tela nunca teve motivo para mostrar.
//
// Um verde (ou um vermelho) sobre o telefone errado não fala do assunto da
// prova. Foi o que aconteceu na segunda tentativa desta aqui.
const molde = await page.evaluate(() => {
  const id = document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id");
  const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
  return c ? { advogado_id: c.advogado_id, chaves: Object.keys(c) } : null;
});
ok("aprendi o feitio da conversa na amostra", !!molde && !!molde.advogado_id,
   JSON.stringify(molde && molde.advogado_id));

const agora = Date.now();
const conversaBase = (id, contatoId, nome, numero, extra = {}) => ({
  id, contato_id: contatoId, advogado_id: molde.advogado_id,
  fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
  ultima_mensagem: null, ultima_atividade: new Date(agora - 60000).toISOString(),
  // As colunas do feitio da amostra, todas presentes. Uma linha plantada com
  // menos colunas do que as de verdade desenha diferente por acidente, e a
  // prova passa a falar do buraco na linha em vez do assunto dela.
  frente: null, vantoro_nome: null, digitando_ate: null,
  atendendo_por: null, atendendo_em: null,
  contato: { nome, numero, foto_url: null },
  ...extra,
});

const SEMENTE = {
  contatos: [
    { id: "ct-fantasma", nome: "ZZ Fantasma", numero: "5521988770001" },
    { id: "ct-fixada", nome: "ZZ Fixada Vazia", numero: "5521988770002" },
    { id: "ct-juncao", nome: "ZZ Sem Juncao", numero: "5521988770003" },
  ],
  conversas: [
    conversaBase("fantasma-1", "ct-fantasma", "ZZ Fantasma", "5521988770001"),
    conversaBase("fantasma-fixada", "ct-fixada", "ZZ Fixada Vazia", "5521988770002",
                 { fixada: true }),
    conversaBase("fantasma-juncao", "ct-juncao", "ZZ Sem Juncao", "5521988770003"),
  ],
};

await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Os nomes que estão na lista de conversas, na ordem da tela. */
const nomesNaLista = () => page.$$eval("[data-conversa-nome]",
  (els) => els.map((e) => e.textContent.trim()));

/** A lista mostra alguma linha deste contato? */
const naLista = async (nome) => (await nomesNaLista()).some((n) => n.includes(nome));

console.log("\nA conversa vazia não entra na lista — e as de verdade ficam");
{
  // Primeiro a contraprova: as linhas foram MESMO plantadas. Sem isto, tudo
  // abaixo passaria de graça num banco vazio, dizendo "escondeu" sobre uma
  // conversa que nunca existiu.
  const plantadas = await page.evaluate(() =>
    globalThis.__TABELAS.conversas.filter((c) => String(c.id).startsWith("fantasma-")).length);
  ok("as três conversas plantadas estão no banco de mentira", plantadas === 3,
     `estão ${plantadas}`);

  ok("a conversa sem nenhuma mensagem não entra na lista",
     !(await naLista("ZZ Fantasma")),
     `a lista tinha: ${(await nomesNaLista()).slice(0, 5).join(" | ")}`);

  const quantas = await page.locator("[data-conversa-nome]").count();
  ok("e a lista continua cheia das conversas de verdade", quantas >= 5,
     `só ${quantas} linha(s) na lista`);
}

console.log("\nMas a FIXADA fica, mesmo vazia");
{
  // Fixar é dizer "esta eu quero à vista". Sumir com ela seria desobedecer uma
  // escolha explícita de quem atende, e sem nada na tela explicando por quê.
  ok("a conversa fixada aparece mesmo sem nenhuma mensagem",
     await naLista("ZZ Fixada Vazia"),
     `a lista tinha: ${(await nomesNaLista()).slice(0, 6).join(" | ")}`);
}

console.log("\nCom uma mensagem dentro, ela aparece");
{
  // A contrapartida do primeiro caso, e a que separa "esconde o que está
  // vazio" de "esconde o que eu plantei".
  await page.addInitScript(() => {
    globalThis.__SEMENTE = globalThis.__SEMENTE || {};
    globalThis.__SEMENTE.mensagens = [{
      id: "m-fantasma-1", conversa_id: "fantasma-1", origem: "advogado", tipo: "texto",
      texto: "primeira palavra", status: "enviada",
      criado_em: new Date().toISOString(),
    }];
  });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);

  ok("a mesma conversa, agora com uma mensagem, entra na lista",
     await naLista("ZZ Fantasma"),
     `a lista tinha: ${(await nomesNaLista()).slice(0, 6).join(" | ")}`);
}

console.log("\nAbrir pela agenda mostra a conversa — e sair sem escrever a tira");
{
  // O CAMINHO DO RELATO, ponta a ponta e pela porta que a pessoa usa: o botão
  // de nova conversa, a agenda, o contato.
  //
  // A conversa recém-aberta TEM de aparecer enquanto está aberta. Sem isso, a
  // tela mostraria a conversa e a lista diria que ela não existe — uma
  // contradição pior do que o defeito original.
  await page.locator('[aria-label="Nova conversa"]').first().click();
  await page.waitForTimeout(700);
  // Procura pelo nome: a agenda tem centenas de contatos e mostra os
  // primeiros, e o plantado aqui entra no fim da lista. Sem a busca, a linha
  // existe e não está desenhada — e a prova acusaria a agenda de não ter o
  // contato que ela tem.
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("ZZ Sem Juncao");
  await page.waitForTimeout(800);
  await page.locator('[data-contato-agenda="ct-juncao"]').click();
  await page.waitForSelector("[data-topo-conversa]", { timeout: 20000 });
  await page.waitForTimeout(1800);

  ok("com a conversa ABERTA, ela aparece na lista",
     await naLista("ZZ Sem Juncao"),
     `a lista tinha: ${(await nomesNaLista()).slice(0, 8).join(" | ")}`);

  // Uma vizinha de verdade, guardada pelo nome, para conferir depois que ela
  // continua lá. Contar linhas do DOM não serviria: a lista é virtualizada e
  // desenha só a janela visível — tirando uma, ela puxa outra de baixo e o
  // total fica igual. Um "contei o mesmo tanto" ali significaria tanto "não
  // sumiu nada" quanto "sumiu tudo e veio outro tanto no lugar".
  const vizinha = (await nomesNaLista()).find((n) => !n.includes("ZZ "));
  ok("achei uma conversa de verdade para vigiar", !!vizinha, String(vizinha));

  // Sai para outra conversa qualquer, sem ter escrito nada.
  await page.locator("[data-conversa-nome]").filter({ hasNotText: "ZZ Sem Juncao" })
    .first().click();
  await page.waitForTimeout(2000);

  ok("e ao sair sem escrever nada, ela some da lista",
     !(await naLista("ZZ Sem Juncao")),
     `a lista ficou: ${(await nomesNaLista()).slice(0, 8).join(" | ")}`);
  // A trava contra o sumiço em massa.
  ok("e não levou nenhuma outra junto",
     vizinha ? await naLista(vizinha.slice(0, 12)) : false,
     `sumiu também: ${vizinha}`);
}

console.log("\nE a contagem que falha nunca esconde nada");
{
  // O outro caminho de sumiço: ao sair, a tela conta as mensagens no banco. Se
  // a contagem der erro, a linha TEM de ficar. Erro de rede não pode virar
  // "esta conversa está vazia".
  await page.locator('[aria-label="Nova conversa"]').first().click();
  await page.waitForTimeout(700);
  // Procura pelo nome: a agenda tem centenas de contatos e mostra os
  // primeiros, e o plantado aqui entra no fim da lista. Sem a busca, a linha
  // existe e não está desenhada — e a prova acusaria a agenda de não ter o
  // contato que ela tem.
  await page.waitForSelector("[data-contato-agenda]", { timeout: 20000 });
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("ZZ Sem Juncao");
  await page.waitForTimeout(900);
  await page.locator('[data-contato-agenda="ct-juncao"]').click();
  await page.waitForSelector("[data-topo-conversa]", { timeout: 20000 });
  await page.waitForTimeout(2200);
  ok("abri a conversa vazia de novo", await naLista("ZZ Sem Juncao"),
     `a lista tinha: ${(await nomesNaLista()).slice(0, 8).join(" | ")}`);

  // Daqui em diante, toda consulta a `mensagens` devolve erro.
  await page.evaluate(() => { globalThis.__QUEBRAR = ["mensagens"]; });
  await page.locator("[data-conversa-nome]").filter({ hasNotText: "ZZ Sem Juncao" })
    .first().click();
  await page.waitForTimeout(2000);

  ok("com a contagem falhando, a conversa continua na lista",
     await naLista("ZZ Sem Juncao"),
     `a lista ficou: ${(await nomesNaLista()).slice(0, 8).join(" | ")}`);
  await page.evaluate(() => { delete globalThis.__QUEBRAR; });
}

console.log("\nE o erro cai sempre para o lado de MOSTRAR");
{
  // ESTA É A SEÇÃO QUE MAIS IMPORTA. O conserto tem poder de sumir com
  // conversa da tela; se ele errar, erra escondendo trabalho de advogado, sem
  // erro e sem log. Então tudo que não for um "zero" cravado tem de mostrar.
  //
  // Aqui a junção não vem — banco antigo, coluna ausente, o que for. O campo
  // fica INDEFINIDO, e indefinido não é lista vazia.
  await page.addInitScript(() => { globalThis.__SEM_JUNCAO_MENSAGENS = true; });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);

  const nomes = await nomesNaLista();
  ok("sem a junção, a conversa vazia NÃO é escondida",
     nomes.some((n) => n.includes("ZZ Sem Juncao")),
     `a lista tinha: ${nomes.slice(0, 8).join(" | ")}`);
  ok("e nem a outra", nomes.some((n) => n.includes("ZZ Fantasma")),
     `a lista tinha: ${nomes.slice(0, 8).join(" | ")}`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
