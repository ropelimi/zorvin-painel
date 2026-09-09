// O PAINEL AVISA QUANDO ALGO PARA — na tela onde as pessoas já estão.
//
// As últimas rodadas encheram a ponte de proteções: a caixa de entrada guarda o
// evento antes de prometer, a fila tenta de novo sozinha, a saída termina o que
// está no meio. Todas AVISAM quando algo dá errado. No log.
//
// E ninguém abre o log. Foi assim com a linha do escritório que caiu em 19/08, e
// com o `IMPORT_TOKEN` que nunca foi criado: nos dois casos a máquina vinha
// dizendo o que estava errado, para uma tela que ninguém olhava.
//
// O QUE ESTA PROVA GUARDA são as duas metades, e a segunda é tão importante
// quanto a primeira:
//
//   1. a tela FALA quando algo parou, com a frase que muda o que a pessoa faz;
//   2. a tela CALA quando está tudo andando — e cala também sobre o que aquela
//      pessoa não tem como resolver.
//
// Alarme que toca à toa se aprende a ignorar, e aí o próximo, o de verdade,
// passa batido junto. É por isso que metade das conferências abaixo é sobre
// AUSÊNCIA de aviso.
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

const faixa = () => page.locator("[data-aviso-de-saude]");
const texto = async () =>
  (await faixa().count()) ? (await faixa().innerText()).replace(/\s+/g, " ") : "";

/** Abre o painel com um estado ditado.
 *
 *  `addInitScript` e não `evaluate`: as bandeiras precisam existir ANTES de a
 *  página começar a rodar, senão a primeira pergunta já saiu com o padrão e o
 *  teste mede o estado errado.
 *
 *  E TODAS AS BANDEIRAS SÃO ESCRITAS EM TODA ABERTURA, inclusive as que este
 *  cenário não usa. `addInitScript` ACUMULA: cada chamada acrescenta mais um
 *  script, e todos rodam, em ordem, a cada carregamento. Sem escrever tudo, a
 *  recusa de leitura de um cenário continuava valendo nos seguintes — e as duas
 *  últimas conferências reprovavam falando de etiquetas, um assunto que não é o
 *  delas. Escrevendo tudo, o último script vence, que é o que se espera. */
const abrirCom = async (linhas, { admin = true, recusarLeitura = null,
                                  semSaude = false, saudeRecusa = false } = {}) => {
  await ctx.clearCookies();
  await page.addInitScript(([l, a, r, sem, recusa]) => {
    globalThis.__SAUDE = l;
    globalThis.__SOU_ADMIN = a;
    globalThis.__RECUSAR_LEITURA = r;
    globalThis.__SEM_SAUDE = sem;
    globalThis.__SAUDE_RECUSA = recusa;
    // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO PARA VER ALGUMA COISA.
    //
    // Sem esta linha o painel abria na tela de "você não tem nenhum telefone",
    // a lista de conversas nunca aparecia, e a prova morria esperando por ela —
    // acusando um defeito que não existe. Na bancada, `permissoes` nasce vazia
    // e vazio só funciona junto com admin.
    globalThis.__SEMENTE = a === false
      ? { permissoes: [{ id: 1, usuario_id: "u1", departamento_id: null, telefone_id: "a1" }] }
      : null;
  }, [linhas, admin, recusarLeitura, semSaude, saudeRecusa]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1400);
};

const agora = (minutosAtras) => new Date(Date.now() - minutosAtras * 60000).toISOString();


console.log("\n1. Com tudo andando, a tela CALA");
{
  await abrirCom([]);
  ok("nenhuma faixa quando não há nada parado",
     (await faixa().count()) === 0,
     `apareceu: "${await texto()}" — aviso à toa faz o de verdade ser ignorado`);
}


console.log("\n2. A fila parada: o que a pessoa escreveu não está saindo");
{
  await abrirCom([{ sinal: "fila_parada", quantas: 12, desde: agora(9), detalhe: null }]);
  ok("a faixa aparece", (await faixa().count()) === 1, "nada apareceu");
  const t = await texto();
  ok("dizendo QUANTAS mensagens não saíram",
     /12 mensagens escritas aqui não saíram/.test(t), t);
  ok("e há quanto tempo, que é o que separa demora de parada",
     /há 9 min/.test(t), t);
  // A FRASE TEM DE DIZER O QUE FAZER. "A fila está parada" é um fato sobre a
  // máquina; quem atende precisa saber o que muda no atendimento dela.
  ok("e o que fazer a respeito", /não prometa resposta/i.test(t), t);
}


console.log("\n3. A linha caída diz o NOME do telefone");
{
  // Sem o nome, quem atende não sabe se é a linha que ela está usando — e essa
  // é a única pergunta que importa neste aviso.
  await abrirCom([{ sinal: "linhas_caidas", quantas: 1, desde: agora(20),
                    detalhe: "Dra. Marina" }]);
  const t = await texto();
  ok("o nome do telefone aparece na frase", /Dra\. Marina/.test(t), t);
  ok("e diz que nada sai por ele até alguém reconectar",
     /nada sai/i.test(t) && /reconectar/i.test(t), t);
}


console.log("\n4. A mensagem de cliente que NÃO ENTROU");
{
  // O sinal mais grave que existe aqui, e o único em que o silêncio da tela
  // mente sobre uma conversa inteira: alguém escreveu para o escritório e a
  // conversa não mostra nada.
  await abrirCom([{ sinal: "eventos_desistidos", quantas: 3, desde: agora(45), detalhe: null }]);
  const t = await texto();
  ok("a tela diz que mensagens de cliente não entraram",
     /3 mensagens de cliente não entraram no Zorvin/.test(t), t);
  ok("e avisa que uma conversa calada pode não estar calada",
     /calada pode não estar calada/i.test(t), t);
}


console.log("\n5. Quem atende não vê o que não tem como resolver");
{
  const caixa = [{ sinal: "eventos_pendentes", quantas: 4, desde: agora(3), detalhe: null }];

  await abrirCom(caixa, { admin: false });
  ok("a caixa atrasada NÃO aparece para quem atende",
     (await faixa().count()) === 0,
     `apareceu: "${await texto()}" — ela se resolve sozinha, e a luz só ensinaria a ignorar`);

  await abrirCom(caixa, { admin: true });
  ok("mas aparece para quem administra",
     /esperando para entrar/i.test(await texto()), await texto());
}
{
  // E O QUE É DE TODO MUNDO CONTINUA SENDO. Sem esta, a conferência acima
  // passaria com uma tela que simplesmente não avisa nada a quem atende.
  await abrirCom([{ sinal: "eventos_desistidos", quantas: 1, desde: agora(30), detalhe: null }],
                 { admin: false });
  ok("a mensagem que não entrou aparece para quem atende também",
     /não entrou no Zorvin/i.test(await texto()), await texto());
}


console.log("\n6. Duas coisas paradas ao mesmo tempo");
{
  await abrirCom([
    { sinal: "linhas_caidas", quantas: 1, desde: agora(15), detalhe: "Dr. Paulo" },
    { sinal: "fila_parada",   quantas: 2, desde: agora(7),  detalhe: null },
  ]);
  ok("as duas são ditas", (await page.locator("[data-frase-de-saude]").count()) === 2,
     await texto());
  // UMA FAIXA SÓ, com uma frase por linha. Duas faixas empilhadas no alto de
  // uma tela de atendimento tomam metade dela.
  ok("numa faixa só", (await faixa().count()) === 1, "apareceu mais de uma");
}


console.log("\n7. As duas faixas convivem sem se cobrir");
{
  // A do que não carregou é `position: fixed` no alto desde 04/09. A nova ia
  // para o mesmo lugar — e as duas ficariam ilegíveis justamente quando as duas
  // importam.
  await abrirCom([{ sinal: "fila_parada", quantas: 1, desde: agora(10), detalhe: null }],
                 { recusarLeitura: ["conversa_tags"] });

  const a = await page.locator("[data-falha-de-leitura]").boundingBox();
  const b = await faixa().boundingBox();
  ok("as duas estão na tela", Boolean(a) && Boolean(b), JSON.stringify({ a, b }));
  ok("e uma não cobre a outra",
     Boolean(a) && Boolean(b) && (a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1),
     JSON.stringify({ a, b }));
}


console.log("\n8. Sem o SQL rodado, tudo como antes");
{
  // O estado real entre a entrega e o SQL aplicado. Uma coisa nova não pode
  // acender alarme sobre a própria ausência: quem ainda não rodou o SQL tem de
  // ver o painel exatamente como via.
  await abrirCom([], { semSaude: true });
  ok("sem a função no banco, nenhuma faixa de saúde",
     (await faixa().count()) === 0, await texto());
  ok("e nenhuma faixa de falha de leitura por causa disso",
     (await page.locator("[data-falha-de-leitura]").count()) === 0,
     "a função que falta não é uma leitura que falhou");
}


console.log("\n9. Erro DE VERDADE na pergunta é dito, e não engolido");
{
  // O desfecho pior de todos seria este ficar calado: o silêncio desta tela é
  // exatamente o que significa "está tudo bem". Sem esta conferência, uma
  // permissão errada na função faria o painel jurar que está tudo andando.
  await abrirCom([], { saudeRecusa: true });
  const t = (await page.locator("[data-falha-de-leitura]").count())
    ? (await page.locator("[data-falha-de-leitura]").innerText()).replace(/\s+/g, " ") : "";
  ok("a tela diz que não conseguiu saber o estado do sistema",
     /estado do sistema/i.test(t), t || "nada apareceu");
  ok("com o código do banco, que é por onde se procura",
     /42501/.test(t), t);
}


await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
