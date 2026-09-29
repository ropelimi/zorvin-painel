// O CANAL QUE NÃO VOLTA SOZINHO — e a faixa que prometia que ele voltaria.
//
// RELATO DO ESCRITÓRIO, 14/09, com foto: a faixa vermelha no alto do Zorvin,
// "As mensagens novas não estão chegando sozinhas — a conexão ao vivo caiu.
// Estamos reconectando; quando voltar, a tela se atualiza."
//
// A faixa em si é o painel funcionando: ela só acende depois de dez segundos
// calados, para não piscar a cada soluço, e quando o canal volta o painel RELÊ
// o que passou (`o-tempo-real-que-cai-e-volta`). O problema é a promessa.
//
// QUEM RECONECTAVA ERA A BIBLIOTECA, sozinha, e o painel só olhava. Na maioria
// das quedas isso basta. Menos num caminho, e ele está escrito no código dela
// (`RealtimeChannel.subscribe`): quando o servidor devolve um conjunto de
// assinaturas diferente do que foi pedido, ela faz
//
//     this.unsubscribe();        // e o `leave()` ZERA o relógio de retentativa
//     callback(CHANNEL_ERROR, new Error('mismatch between server and client
//                                        bindings for postgres changes'));
//
// O canal fica morto. Nada mais tenta, e a faixa segue prometendo que está
// reconectando — para sempre. Só recarregar a página resolve, e ninguém
// recarrega: a tela diz que não precisa.
//
// O QUE ESTE ARQUIVO VIGIA:
//
//   1. que o painel REFAÇA o canal ele mesmo, em vez de esperar por quem já
//      desistiu;
//   2. que ele não insista sem parar — as esperas crescem;
//   3. que a volta conseguida pelo vigia RELEIA o que passou, como a outra;
//   4. que nada disso apareça na tela: a faixa vermelha saiu em 28/09, quando
//      o painel passou a RELER sozinho enquanto o canal está fora. O vigia
//      ficou; o alarme que não pedia ação de ninguém é que saiu;
//   5. e que ela NÃO diga isso antes da hora, porque mandar recarregar por um
//      soluço de rede é trocar um defeito por outro.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// OS TEMPOS DE PRODUÇÃO SÃO 10s, 3min e esperas de até 2min. Aqui são
// encurtados, senão um cenário só custaria cinco minutos e ninguém rodaria a
// suíte. O que se mede é a ORDEM das coisas, não os números.
const CARENCIA = 300;
const ESPERAS = [250, 350, 450];
const LIMITE = 3000;

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const faixa = () => page.locator("[data-aviso-de-saude]");
const texto = async () =>
  (await faixa().count()) ? (await faixa().innerText()).replace(/\s+/g, " ") : "";
// QUANTAS VEZES O PAINEL SE INSCREVEU. A bancada já contava isto para provar
// que trocar de telefone parou de derrubar o canal; aqui ele serve ao
// contrário — para provar que o painel refaz o canal quando precisa.
const canais = () => page.evaluate(() => globalThis.__CANAIS || 0);
// DEIXAR SUBIR NÃO É LEVANTAR, e a diferença é o assunto deste arquivo.
//
//   `deixarSubir` só tira o impedimento: quem tem de reerguer o canal é o
//   VIGIA do painel, na próxima tentativa dele. É o caminho que se mede aqui.
//
//   `levantar` chama a volta na mão, como se a biblioteca tivesse reconectado
//   sozinha. Usá-lo no lugar do outro faria a prova aprovar um painel sem
//   vigia nenhum — ela mediria a bancada, e não o conserto.
//   Chamar `__LEVANTAR_TEMPO_REAL` na mão, como a prova irmã faz, imita a
//   biblioteca reconectando sozinha — e é justamente o que NÃO acontece no
//   caminho que este arquivo mede. Por isso ele não aparece aqui.
const deixarSubir = () => page.evaluate(() => { globalThis.__TEMPO_REAL_FORA = false; });

// TODAS AS BANDEIRAS EM TODA ABERTURA. `addInitScript` ACUMULA: sem escrever
// tudo, o estado de um cenário seguiria valendo nos seguintes.
const abrir = async ({ foraDesdeOInicio = false } = {}) => {
  await ctx.clearCookies();
  await page.addInitScript(([c, esperas, limite, fora]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__ESPERAS_DE_VOLTA = esperas;
    globalThis.__LIMITE_DA_PROMESSA = limite;
    globalThis.__TEMPO_REAL_FORA = fora;
    globalThis.__DEMORA_DO_CANAL = 30;
    globalThis.__MOTIVO_DO_CANAL = "";
    // A pesca fica longe: aqui se contam SALAS, e as consultas dela só
    // encheriam o cenário de ruído. Quem a mede é `a-pesca-enquanto-o-canal-
    // esta-fora`.
    globalThis.__CADENCIA_DA_PESCA = 100000;
    globalThis.__CANAIS = 0;
    globalThis.__SAUDE = [];
    // A SAÍDA DO CANAL DEMORA, COMO A DE VERDADE. Era instantânea na bancada,
    // e foi por isso que este arquivo aprovou um vigia que não consertava em
    // produção: com a saída imediata, sair-e-entrar na ordem certa e na errada
    // davam no mesmo. 120ms é a janela em que o canal novo NÃO pode nascer.
    globalThis.__SAIDA_DO_CANAL_MS = 120;
    globalThis.__SAINDO_DO_CANAL = 0;
    globalThis.__SAIDAS_CONCLUIDAS = 0;
    globalThis.__ENTROU_NUMA_SALA_SAINDO = 0;
    globalThis.__SAINDO_NOMES = [];
    globalThis.__NOMES_DE_CANAL = [];
  }, [CARENCIA, ESPERAS, LIMITE, foraDesdeOInicio]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(600);
};

console.log("\n1. Com o canal fora, o painel refaz o canal ele mesmo");
{
  // A CONFERÊNCIA DO DEFEITO. `__TEMPO_REAL_FORA` faz TODA inscrição terminar
  // em erro — que é o caminho em que a biblioteca desistiu e não tenta mais.
  // Sem o conserto, o painel se inscreve uma vez e para por aí.
  await abrir({ foraDesdeOInicio: true });
  const primeiro = await canais();
  ok("o painel assinou o canal ao abrir", primeiro >= 1, `foram ${primeiro}`);

  // A TELA É LIDA LOGO DEPOIS DA CARÊNCIA, que é quando a faixa acenderia.
  // Escrita ao contrário desde 28/09: o vigia continua tentando, e quem não
  // aparece mais é o alarme — ver o cabeçalho deste arquivo.
  await page.waitForTimeout(CARENCIA + 300);
  const cedo = await texto();
  ok("e a tela não alarma ninguém por causa disso",
     !/chegando sozinhas|reconectando/i.test(cedo), cedo.slice(0, 200));

  await page.waitForTimeout(1200);
  const depois = await canais();
  ok("e o painel volta a assinar sozinho quando o canal não sobe", depois > primeiro,
     `continuou em ${depois} — e aí ninguém mais tentaria`);

  // NÃO SEM PARAR. As esperas crescem: 250, 350, 450ms na bancada. Na janela
  // deste cenário cabem umas poucas tentativas; vinte seria o painel batendo
  // na porta de quem já não está atendendo.
  ok("sem insistir sem parar", depois - primeiro <= 8,
     `foram ${depois - primeiro} tentativas`);
}

console.log("\n2. A volta que o VIGIA conseguiu relê o que passou");
{
  // Sem isto o conserto resolveria metade: o canal volta, o aviso apaga, e a
  // pessoa fica tranquila com a tela errada — que é pior do que o aviso aceso.
  // O `postgres_changes` não repete o que passou.
  await abrir({ foraDesdeOInicio: true });
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1200);
  const conversa = await page.evaluate(() =>
    document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));

  // A MENSAGEM ENTRA NO BANCO SEM AVISO NENHUM — nada de `__EMITIR`. É assim
  // que acontece de verdade: o Postgres publicou e o canal não estava lá para
  // ouvir. Com `__EMITIR` a prova mediria outra coisa.
  await page.evaluate((c) => {
    globalThis.__TABELAS.mensagens.push({
      id: "durante-a-queda", conversa_id: c, tipo: "texto", origem: "contato",
      texto: "cheguei enquanto a conexão estava fora",
      criado_em: new Date().toISOString(),
    });
  }, conversa);
  await page.waitForTimeout(400);
  ok("a mensagem NÃO está na tela enquanto o canal está fora",
     (await page.locator('[data-msg-id="durante-a-queda"]').count()) === 0,
     "se ela aparecesse sozinha, esta prova não estaria medindo o tempo real");

  // SÓ TIRA O IMPEDIMENTO. Quem reergue é o vigia, na próxima tentativa —
  // ninguém chama `__LEVANTAR_TEMPO_REAL` aqui.
  await deixarSubir();
  await page.waitForTimeout(1500);

  ok("o vigia reergueu o canal sozinho", !/chegando sozinhas/.test(await texto()),
     await texto());
  ok("e a mensagem que entrou durante a queda APARECE",
     (await page.locator('[data-msg-id="durante-a-queda"]').count()) === 1,
     "sem reler, ela não chegaria nunca — o postgres_changes não repete o que passou");

  // E O VIGIA PARA. Um canal de pé que continuasse sendo refeito abriria uma
  // fresta de silêncio a cada volta — e o que o Postgres publica na fresta não
  // chega nunca.
  const paradoEm = await canais();
  await page.waitForTimeout(1500);
  ok("e o painel para de refazer o canal depois que ele sobe",
     (await canais()) === paradoEm, `continuou subindo até ${await canais()}`);
}

console.log("\n3. O vigia continua tentando, e a tela segue quieta");
{
  // ESTA CENA SUBSTITUI A DA "PROMESSA", que media a faixa dizendo "estamos
  // reconectando" e, passado o prazo, "recarregue a página".
  //
  // As duas frases saíram em 28/09 junto com a faixa: o painel passou a RELER
  // sozinho enquanto o canal está fora, então não há mais o que prometer nem
  // por que mandar alguém recarregar. O que NÃO saiu é o vigia — e é isso que
  // esta cena guarda, para o conserto não ir junto com o alarme.
  await abrir({ foraDesdeOInicio: true });
  await page.waitForTimeout(CARENCIA + 500);
  const antes = await canais();
  await page.waitForTimeout(ESPERAS[0] * 3 + 600);
  const depois = await canais();
  ok("o vigia segue refazendo o canal minutos adentro", depois > antes,
     `parou em ${depois}, tendo começado em ${antes}`);
  const naTela = await texto();
  ok("e a tela continua sem prometer nem mandar recarregar",
     !/reconectando/i.test(naTela) && !/[Rr]ecarregue a página/.test(naTela),
     naTela.slice(0, 220));

  // E VOLTANDO, ELE PARA. Um vigia que continua depois de o canal subir são
  // salas novas para sempre, e o painel recebendo cada mensagem duas vezes.
  await deixarSubir();
  await page.waitForTimeout(ESPERAS[0] * 2 + 800);
  const paradoEm = await canais();
  await page.waitForTimeout(ESPERAS[0] * 2 + 400);
  ok("e para quando o canal sobe", (await canais()) === paradoEm,
     `continuou subindo até ${await canais()}`);
}

console.log("\n5. E o vigia não atropela a própria saída");
{
  // O DEFEITO QUE ESCAPOU DAQUI ATÉ 15/09.
  //
  // O vigia fazia `removeChannel(canal)` SEM ESPERAR e criava o canal novo na
  // mesma batida, com o MESMO nome. `removeChannel` é assíncrono no Supabase de
  // verdade: ele manda o pedido de saída e só termina quando o servidor
  // responde. Pedir a sala da qual ainda se está saindo é uma das formas de
  // receber o "mismatch" que MATA o canal — o conserto se reinfectava, e o
  // painel ficava sem tempo real para sempre.
  //
  // Relato de 15/09: a faixa (de então) no ar, e só o F5 resolvendo. O vigia
  // estava publicado e rodando; era ele que não pegava.
  await abrir({ foraDesdeOInicio: true });
  // Tempo para várias tentativas do vigia — é em cada uma delas que o
  // atropelamento aconteceria.
  await page.waitForTimeout(ESPERAS[0] * 4 + 600);

  const m = await page.evaluate(() => ({
    entrouSaindo: globalThis.__ENTROU_NUMA_SALA_SAINDO || 0,
    saidas: globalThis.__SAIDAS_CONCLUIDAS || 0,
    nomes: globalThis.__NOMES_DE_CANAL || [],
  }));

  // A PRIMEIRA CONFERÊNCIA GARANTE QUE HOUVE O QUE MEDIR. Sem saída nenhuma
  // concluída, as duas de baixo passariam por não ter acontecido nada — que é
  // exatamente como este caminho passou despercebido antes.
  ok("o vigia chegou a refazer o canal", m.saidas >= 1, `saídas concluídas: ${m.saidas}`);
  // DUAS SALAS DIFERENTES VIVAS AO MESMO TEMPO É O NORMAL (a tela remontando).
  // O defeito é pedir a sala da qual ainda se está SAINDO.
  ok("nunca entrou numa sala da qual ainda estava saindo", m.entrouSaindo === 0,
     `entrou saindo: ${m.entrouSaindo}`);
  ok("e cada tentativa pediu um nome próprio",
     new Set(m.nomes).size === m.nomes.length,
     `pedidos: ${JSON.stringify(m.nomes)}`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
