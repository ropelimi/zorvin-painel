// COM O TEMPO REAL FORA, O PAINEL RELÊ SOZINHO — e é por isso que a faixa saiu.
//
// Pedido do Rodrigo em 28/09, pela TERCEIRA vez: *"elimine essa mensagem
// vermelha, não quero que fique aparecendo, isso já está acontecendo há muito
// tempo, resolva logo"*.
//
// A faixa não mentia: enquanto ela aparecia, mensagem nova não chegava
// sozinha. Apagá-la teria escondido isso, e o cliente ficaria sem resposta com
// a tela calada — a armadilha nº 2, de novo. Mas mantê-la também não resolvia
// nada: não há gesto do atendente que conserte o canal, e alarme que não pede
// ação se aprende a ignorar.
//
// O conserto foi na CONSEQUÊNCIA: com o canal fora, o painel relê de 20 em 20
// segundos. As mensagens voltam a chegar — mais devagar, e chegam. A frase
// deixou de ser verdade, e por isso pôde sair.
//
// ESTA PROVA É O QUE SUSTENTA AQUELA DECISÃO. Sem ela, a faixa teria sido
// simplesmente apagada, e ninguém saberia a diferença até um cliente ficar sem
// resposta.
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

const CARENCIA = 400;
// A CADÊNCIA DA BANCADA É MAIOR DO QUE PARECE PRECISO, e é por medição: com
// 700ms as rodadas se emendavam. Uma releitura leva ~400ms de consultas na
// bancada, então duas rodadas a 700ms deixam menos de 400ms de silêncio entre
// si — e o corte que separa rodadas (400ms) as via como UMA. Com 1500 elas
// ficam separadas com folga, e a prova volta a medir rodadas em vez de sorte.
const PESCA = 1500;

// TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` ACUMULA, e uma
// bandeira de um cenário continua valendo nos seguintes.
const abrir = async ({ foraDesdeOInicio = false } = {}) => {
  await ctx.clearCookies();
  await page.addInitScript(([c, p, fora]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__CADENCIA_DA_PESCA = p;
    globalThis.__TEMPO_REAL_FORA = fora;
    globalThis.__MOTIVO_DO_CANAL = "";
    globalThis.__DEMORA_DO_CANAL = 30;
    globalThis.__DIARIO = [];
    globalThis.__SAUDE = [];
  }, [CARENCIA, PESCA, foraDesdeOInicio]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
};

const faixa = async () => {
  const f = page.locator("[data-aviso-de-saude]");
  return (await f.count()) ? (await f.innerText()).replace(/\s+/g, " ") : "";
};
const derrubar = async () => {
  await page.evaluate(() => {
    if (typeof globalThis.__DERRUBAR_TEMPO_REAL === "function") globalThis.__DERRUBAR_TEMPO_REAL();
  });
};
const levantar = async () => {
  await page.evaluate(() => {
    if (typeof globalThis.__LEVANTAR_TEMPO_REAL === "function") globalThis.__LEVANTAR_TEMPO_REAL();
  });
};
/** Quantas idas a `conversas` o painel já fez. */
const idas = () => page.evaluate(() =>
  (globalThis.__DIARIO || []).filter((m) => m.tabela === "conversas").length);

/** Quantas RODADAS de releitura houve — e não quantas consultas.
 *
 *  Uma releitura dispara várias consultas quase juntas; contar consultas
 *  confunde "pescou uma vez" com "pescou três". Foi assim que a sabotagem que
 *  começava a pesca SEM ESPERAR A CARÊNCIA passou: ela custava uma releitura a
 *  mais, e uma releitura a mais se perde no meio de sete consultas.
 *
 *  Uma rodada é um grupo de idas separado do seguinte por mais de 400ms. O
 *  corte começou em 200 e a cena reprovou dizendo "2 rodadas" num painel
 *  certo: UMA releitura dispara consultas em sequência, e com o atraso que a
 *  bancada simula duas delas chegam a ficar 200ms afastadas — o corte partia
 *  uma releitura em duas. 400 é maior do que esse vão e menor do que a
 *  cadência da pesca, que é o que precisa ficar separado. */
const CORTE_DA_RODADA = 400;
const rodadas = () => page.evaluate((CORTE) => {
  const t = (globalThis.__DIARIO || [])
    .filter((m) => m.tabela === "conversas").map((m) => m.inicio).sort((a, b) => a - b);
  let n = 0;
  for (let i = 0; i < t.length; i++) if (i === 0 || t[i] - t[i - 1] > CORTE) n++;
  return n;
}, CORTE_DA_RODADA);

const abrirPrimeira = async () => {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1200);
  return page.evaluate(() =>
    document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));
};

/** Grava uma mensagem no banco SEM avisar ninguém — nada de `__EMITIR`.
 *  É assim que acontece de verdade quando o canal está fora: o Postgres
 *  publicou, e não havia ninguém ouvindo. Usar `__EMITIR` provaria que o
 *  painel trata um evento recebido, que é justamente o que NÃO acontece aqui. */
const gravarCalado = (conversa, id, texto) => page.evaluate(([c, i, t]) => {
  globalThis.__TABELAS.mensagens.push({
    id: i, conversa_id: c, tipo: "texto", origem: "contato",
    texto: t, criado_em: new Date().toISOString(),
  });
}, [conversa, id, texto]);

console.log("\n1. Com o canal fora, a mensagem chega assim mesmo");
{
  await abrir();
  const conversa = await abrirPrimeira();
  await derrubar();
  await page.waitForTimeout(CARENCIA + 200);

  await gravarCalado(conversa, "durante-a-queda", "cheguei com o canal fora");
  // Tempo para DUAS rodadas de pesca: uma só poderia ter caído no instante
  // exato da gravação e mascarar um relógio que nunca dispara de novo.
  await page.waitForTimeout(PESCA * 2 + 400);

  ok("a mensagem apareceu sem ninguém clicar em nada",
     (await page.locator('[data-msg-id="durante-a-queda"]').count()) === 1,
     "é isto que a faixa vermelha existia para avisar que NÃO acontecia");
  // E A TELA FICA QUIETA. É o pedido inteiro: nada de tarja vermelha.
  const t = await faixa();
  ok("e a tela não alarmou ninguém", !/chegando sozinhas|reconectando/i.test(t), t);
}

console.log("\n2. A pesca PARA quando o canal volta");
{
  // Uma pesca que continua depois da volta são cinco consultas a cada vinte
  // segundos, por atendente, para sempre — trocaríamos um defeito por uma
  // conta de banco.
  await abrir();
  await abrirPrimeira();
  await derrubar();
  await page.waitForTimeout(CARENCIA + PESCA * 2 + 300);
  const pescando = await idas();

  await levantar();
  // A VOLTA RELÊ (contrato de 15/09), e essa releitura sozinha custa várias
  // idas a `conversas`. O retrato tem de ser tirado DEPOIS que ela terminou,
  // senão a conferência conta a releitura da volta como se fosse mais uma
  // rodada de pesca — foi assim que ela reprovou na primeira vez.
  await page.waitForTimeout(1500);
  const naVolta = await idas();
  await page.waitForTimeout(PESCA * 3 + 300);
  const depois = await idas();

  ok("com o canal fora ela pescou", pescando >= 2, `${pescando} idas a conversas`);
  ok("e com o canal de volta ela parou", depois === naVolta,
     `continuou de ${naVolta} para ${depois}`);
}

console.log("\n3. O soluço curto não chega a começar a pesca");
{
  // A pesca só começa DEPOIS da carência, aproveitando o relógio que já
  // existia. Sem isso, cada reconexão de três segundos — que acontece o dia
  // inteiro — viraria uma rodada de consultas por atendente.
  //
  // A RÉGUA É "UMA RELEITURA", MEDIDA NA HORA. Duas tentativas minhas falharam
  // antes desta, e as duas por medir a coisa errada:
  //
  //   1. exigir "no máximo 2 consultas" — uma releitura custa ~7, e o número
  //      estava errado, não o painel;
  //   2. contar RODADAS separadas por 400ms — no soluço as duas releituras
  //      ficam a 130ms uma da outra e o agrupamento as via como uma só.
  //
  // Então o custo de UMA releitura é medido aqui mesmo, e a conferência
  // compara com ele. Assim a régua se ajusta sozinha no dia em que a releitura
  // ficar mais cara ou mais barata.
  await abrir();
  await abrirPrimeira();
  const base = await idas();
  await derrubar();
  // Passada a carência sai a primeira releitura da pesca — e só ela, porque
  // a cadência é bem maior do que esta espera.
  await page.waitForTimeout(CARENCIA + 700);
  const umaReleitura = (await idas()) - base;
  ok("uma releitura custa idas ao banco", umaReleitura >= 3, `${umaReleitura} idas`);

  await abrir();
  await abrirPrimeira();
  const antes = await idas();
  await derrubar();
  await page.waitForTimeout(CARENCIA / 3);
  await levantar();
  await page.waitForTimeout(PESCA * 2 + 500);
  const curto = (await idas()) - antes;

  // A VOLTA RELÊ UMA VEZ (contrato de 15/09): o que o banco publicou durante a
  // queda não chega nunca, então voltar sem reler deixaria a tela errada. UMA
  // releitura é isso; DUAS já seriam a pesca tendo começado antes da hora.
  ok("o soluço custou UMA releitura, a da volta", curto <= umaReleitura * 1.5,
     `soluço custou ${curto} idas; uma releitura custa ${umaReleitura}`);

  // E a queda que DURA pesca de verdade — senão a conferência de cima passaria
  // num painel que não relê nunca.
  await abrir();
  await abrirPrimeira();
  const antesLongo = await rodadas();
  await derrubar();
  await page.waitForTimeout(CARENCIA + PESCA * 3 + 400);
  const longo = (await rodadas()) - antesLongo;
  ok("e a queda que dura relê várias vezes", longo >= 3, `foram ${longo} rodadas`);
}

console.log("\n4. Com o canal de pé, o painel não pesca nada");
{
  // A régua de sempre: o que só existe para o caso ruim não pode custar nada
  // no caso bom, que é o de todo dia.
  await abrir();
  await abrirPrimeira();
  const antes = await idas();
  await page.waitForTimeout(PESCA * 4 + 300);
  const depois = await idas();
  ok("nenhuma ida a mais com tudo funcionando", depois === antes,
     `foram ${depois - antes} idas em ${PESCA * 4}ms`);
  ok("e nenhuma faixa", !/chegando sozinhas|reconectando/i.test(await faixa()), await faixa());
}

console.log("\n5. Quem abre o painel com a conexão já ruim também recebe");
{
  // O caso de quem chega de manhã com o wi-fi instável: antes ele abria o
  // painel e a primeira coisa que via era uma tarja vermelha, e nada chegava.
  await abrir({ foraDesdeOInicio: true });
  const conversa = await abrirPrimeira();
  await page.waitForTimeout(CARENCIA + 200);
  await gravarCalado(conversa, "sem-nunca-ter-subido", "e eu cheguei assim mesmo");
  await page.waitForTimeout(PESCA * 2 + 400);
  ok("a mensagem chega mesmo sem o canal nunca ter subido",
     (await page.locator('[data-msg-id="sem-nunca-ter-subido"]').count()) === 1);
  ok("e a tela continua quieta",
     !/chegando sozinhas|reconectando/i.test(await faixa()), await faixa());
}

await ctx.close();
await nav.close();
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
