// A MENSAGEM ENVIADA NÃO SOME, E O TEMPO REAL NÃO ENTOPE (20/10).
//
// Relato do Rodrigo: *"Quando é enviada uma mensagem demora para aparecer,
// muitas vezes parece que falhou o envio."*
//
// MEDIDO no Supabase naquele dia, antes de mexer:
//
//   - três abas do escritório faziam ~100 mil pedidos por hora cada uma — uma
//     aba normal faz de 2 a 15 mil —, relendo a lista, as etiquetas, os selos
//     e a conversa aberta de três a cinco vezes POR SEGUNDO;
//   - 190 mil leituras de etiquetas numa hora, e 45 mil contas de selos;
//   - o tempo real avisou 19 vezes no dia que o limite de 100 avisos por
//     segundo do plano gratuito tinha estourado.
//
// TRÊS DEFEITOS, e esta prova tem uma parte para cada um:
//
//   1. O RELÓGIO ÓRFÃO. Sair de um canal faz a biblioteca chamar de volta com
//      `CLOSED`, e o painel armava a pesca de 20 em 20 segundos num efeito já
//      desmontado — ninguém a fechava. E o efeito era refeito a cada troca de
//      aba, de telefone e de ordem. Cada troca deixava um relógio para sempre.
//   2. A RELEITURA APAGAVA A BOLHA. Reler a conversa troca a lista pelo banco,
//      e a mensagem que acabou de entrar na fila ainda não está lá: ela sumia
//      da tela — "parece que falhou" — e voltava quando a ponte a gravava.
//   3. SEM O AVISO, A BOLHA FICAVA COM O RELÓGIO até alguém sair e entrar na
//      conversa. Agora a conversa é relida aos 12 e aos 40 segundos.
//
// A BANCADA PRECISOU APRENDER DUAS COISAS, e as duas sobre sair do canal:
//
//   - a saída chama de volta com `CLOSED`, como o Supabase de verdade
//     (`RealtimeChannel.subscribe` registra isso em `_onClose`). Era por ela
//     não chamar que nenhuma prova via o relógio órfão — a quarta vez que a
//     bancada mente por omissão sobre o canal;
//   - o canal que já saiu NÃO responde mais à entrada. Aqui ele respondia: o
//     `SUBSCRIBED` atrasado de um canal removido apagava, por acaso, a
//     carência que o `CLOSED` tinha acabado de armar. A sabotagem que tira a
//     guarda do canal PASSOU na primeira rodada por causa disso.
//
// A GUARDA DO CANAL QUE SAIU é medida na abertura: em desenvolvimento o React
// monta o painel, desmonta e monta de novo, de propósito — é a mesma saída de
// canal de quem sai e entra no Zorvin sem recarregar a página. Sem a guarda,
// o canal da primeira montagem deixa um relógio órfão, e a janela calada da
// cena 1 vê as releituras dele.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const CARENCIA = 300;
const PESCA = 600;
const CONFERENCIA = [900, 2200];

const nav = await abrirNavegador();
const erros = [];

/** Uma janela nova por cena: `addInitScript` ACUMULA, e uma bandeira de uma
 *  cena continuaria valendo na seguinte. */
async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  await page.addInitScript(([c, p, conf]) => {
    globalThis.__CARENCIA_TEMPO_REAL = c;
    globalThis.__CADENCIA_DA_PESCA = p;
    globalThis.__CONFERENCIA_DO_ENVIO = conf;
    globalThis.__DEMORA_DO_CANAL = 30;
    globalThis.__TEMPO_REAL_FORA = false;
    globalThis.__DIARIO = [];
  }, [CARENCIA, PESCA, CONFERENCIA]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page };
}

/** Clique guardado: o elemento que falta não estoura a prova inteira depois de
 *  30 segundos — diz qual passo não achou o que procurava. */
async function clicar(page, seletor) {
  const alvo = page.locator(seletor).first();
  if (!(await alvo.count())) return false;
  await alvo.click();
  return true;
}

/** Quantas idas ao banco desde a última limpeza do diário, por tabela — e a
 *  conta dos selos à parte, pela função. */
const idas = (page) => page.evaluate(() => {
  const d = globalThis.__DIARIO || [];
  const conta = {};
  for (const m of d) {
    const k = m.funcao ? `rpc:${m.funcao}` : m.tabela;
    conta[k] = (conta[k] || 0) + 1;
  }
  return conta;
});
const limparDiario = (page) => page.evaluate(() => { globalThis.__DIARIO = []; });

async function abrirAPrimeira(page) {
  await clicar(page, "[data-conversa-nome]");
  await page.waitForSelector('textarea[placeholder*="Digite uma mensagem"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return page.evaluate(() => document.querySelector("[data-conversa-nome]")?.getAttribute("data-conversa-id") || null);
}

async function escreverEEnviar(page, texto) {
  const caixa = page.locator('textarea[placeholder*="Digite uma mensagem"]').first();
  if (!(await caixa.count())) return false;
  await caixa.fill(texto);
  await caixa.press("Enter");
  return true;
}

/** As bolhas da conversa aberta com este texto, e o que cada uma diz do envio. */
const bolhasCom = (page, texto) => page.evaluate((t) =>
  [...document.querySelectorAll("[data-msg-id]")]
    .filter((el) => (el.textContent || "").includes(t))
    .map((el) => ({
      id: el.getAttribute("data-msg-id"),
      estado: el.querySelector("[data-estado-do-envio]")?.getAttribute("data-estado-do-envio") || null,
    })), texto);

/** A ponte gravando a mensagem SEM o tempo real avisar ninguém — o aviso que
 *  se perdeu é o caso que esta prova existe para medir. */
const ponteGravaCalada = (page, convId, texto, id) => page.evaluate(([c, t, i]) => {
  const fila = (globalThis.__TABELAS.fila_envio || []).filter((f) => f.texto === t);
  for (const f of fila) { f.status = "enviada"; f.enviado_em = new Date().toISOString(); }
  globalThis.__TABELAS.mensagens.push({
    id: i, conversa_id: c, origem: "advogado", tipo: "texto", texto: t,
    criado_em: new Date().toISOString(), status: "enviada", id_uazapi: "ID-" + i,
    enviado_por: "Rodrigo Sousa", enviado_por_id: "u1",
  });
  return fila.length;
}, [convId, texto, id]);

// ------------------------------------------------------------------
console.log("\n1. Trocar de aba, de telefone e de ordem não deixa releitura rodando");
{
  const { ctx, page } = await abrir();
  await abrirAPrimeira(page);
  const canaisAntes = await page.evaluate(() => (globalThis.__NOMES_DE_CANAL || []).length);
  const trocas = [];
  for (const aba of ["finalizado", "aguardando", "aberto", "finalizado", "aberto"]) {
    trocas.push(await clicar(page, `[data-aba-da-situacao="${aba}"]`));
    await page.waitForTimeout(500);
  }
  trocas.push(await clicar(page, '[data-telefone="Acordos 2"]'));
  await page.waitForTimeout(900);
  trocas.push(await clicar(page, '[data-telefone="Acordos 1"]'));
  await page.waitForTimeout(900);
  if (await clicar(page, "[data-ordem]")) {
    await page.waitForTimeout(200);
    trocas.push(await clicar(page, '[data-ordem-opcao="antigas"]'));
    await page.waitForTimeout(700);
    if (await clicar(page, "[data-ordem]")) {
      await page.waitForTimeout(200);
      trocas.push(await clicar(page, '[data-ordem-opcao="recentes"]'));
    }
  } else trocas.push(false);
  await page.waitForTimeout(900);
  ok("as trocas foram feitas na tela", trocas.length === 9 && trocas.every(Boolean), JSON.stringify(trocas));

  // A JANELA CALADA: canal de pé, ninguém escrevendo. Cabem nela a carência e
  // três voltas da pesca — o relógio órfão mais lento já teria relido.
  await abrirAPrimeira(page);
  await limparDiario(page);
  await page.waitForTimeout(CARENCIA + PESCA * 3 + 600);
  const calado = await idas(page);
  ok("nada releu as etiquetas da casa (a releitura completa lê `tags`)", !calado.tags, JSON.stringify(calado));
  ok("nada releu a conversa aberta", !calado.mensagens && !calado.notas, JSON.stringify(calado));
  ok("nada releu a lista", !calado.conversas, JSON.stringify(calado));

  const canaisDepois = await page.evaluate(() => (globalThis.__NOMES_DE_CANAL || []).length);
  ok("e nenhuma troca abriu canal novo", canaisDepois === canaisAntes,
     `${canaisAntes} canais antes das trocas, ${canaisDepois} depois`);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. Sair do canal não acende a pesca: a volta do canal relê UMA vez");
{
  // O contrato de 15/09 continua: a volta de uma queda relê, porque o que o
  // banco publicou durante a queda não chega nunca. E só UMA vez, e não para
  // sempre — o defeito era o relógio que sobrava depois.
  const { ctx, page } = await abrir();
  await abrirAPrimeira(page);
  await page.evaluate(() => globalThis.__DERRUBAR_TEMPO_REAL && globalThis.__DERRUBAR_TEMPO_REAL());
  await page.waitForTimeout(CARENCIA + PESCA + 200);
  await page.evaluate(() => globalThis.__LEVANTAR_TEMPO_REAL && globalThis.__LEVANTAR_TEMPO_REAL());
  await page.waitForTimeout(1200);
  await limparDiario(page);
  await page.waitForTimeout(CARENCIA + PESCA * 3 + 600);
  const depois = await idas(page);
  ok("depois da volta, nenhuma releitura sobra rodando", !depois.tags && !depois.mensagens,
     JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. O aviso que não muda nada não relê etiquetas nem conta selos");
{
  const { ctx, page } = await abrir();
  await abrirAPrimeira(page);
  await limparDiario(page);
  // O "estou atendendo" de dez colegas, de minuto em minuto: a mesma linha,
  // com outra hora. Nada de selo, nada de etiqueta muda com isso.
  const emitidos = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-conversa-id]")].slice(0, 10)
      .map((el) => el.getAttribute("data-conversa-id"));
    let n = 0;
    for (const id of ids) {
      const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
      if (!c) continue;
      const { contato, ...linha } = c;
      globalThis.__EMITIR("UPDATE", "conversas", { ...linha, atendendo_por: "Colega", atendendo_em: new Date().toISOString() });
      n++;
    }
    return n;
  });
  await page.waitForTimeout(2600);
  const presenca = await idas(page);
  ok("os avisos de presença chegaram à tela", emitidos >= 5, `${emitidos} avisos`);
  ok("e nenhum releu as etiquetas da lista", !presenca.conversa_tags, JSON.stringify(presenca));
  ok("nem contou os selos da barra", !presenca["rpc:nao_lidas_por_telefone"], JSON.stringify(presenca));

  // O CONTRASTE: a conversa que passa a ter não lida muda o selo, e ele é
  // contado. Sem isto, um painel que nunca contasse passaria acima.
  await limparDiario(page);
  const virou = await page.evaluate(() => {
    const id = [...document.querySelectorAll("[data-conversa-id]")]
      .map((el) => el.getAttribute("data-conversa-id"))
      .find((i) => { const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(i)); return c && !c.nao_lidas && !c.arquivada; });
    if (!id) return false;
    const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
    c.nao_lidas = 2;
    const { contato, ...linha } = c;
    globalThis.__EMITIR("UPDATE", "conversas", { ...linha });
    return true;
  });
  await page.waitForTimeout(2600);
  const passou = await idas(page);
  ok("a conversa que passou a ter não lida conta os selos", virou && (passou["rpc:nao_lidas_por_telefone"] || 0) >= 1,
     JSON.stringify(passou));

  // A MENSAGEM DA EQUIPE não acende "não lida", e não conta os selos; a do
  // CLIENTE pode acender, e conta. As duas numa conversa que não é a aberta.
  const umaDaLista = await page.evaluate(() => [...document.querySelectorAll("[data-conversa-id]")]
    .map((el) => el.getAttribute("data-conversa-id"))[3] || null);
  const chegar = (origem, id) => page.evaluate(([c, o, i]) => {
    const linha = { id: i, conversa_id: c, origem: o, tipo: "texto", texto: "Prova dos selos " + i,
      criado_em: new Date().toISOString(), status: "enviada", id_uazapi: "ID-" + i,
      ...(o === "advogado" ? { enviado_por: "Colega", enviado_por_id: "u-colega" } : {}) };
    globalThis.__TABELAS.mensagens.push(linha);
    globalThis.__EMITIR("INSERT", "mensagens", { ...linha });
  }, [umaDaLista, origem, id]);
  await limparDiario(page);
  await chegar("advogado", "selo-da-equipe");
  await page.waitForTimeout(2600);
  const daEquipe = await idas(page);
  ok("a mensagem da equipe não conta os selos", umaDaLista && !daEquipe["rpc:nao_lidas_por_telefone"],
     JSON.stringify(daEquipe));
  await limparDiario(page);
  await chegar("contato", "selo-do-cliente");
  await page.waitForTimeout(2600);
  const doCliente = await idas(page);
  ok("a do cliente conta", (doCliente["rpc:nao_lidas_por_telefone"] || 0) >= 1, JSON.stringify(doCliente));

  // E A LISTA QUE MUDA DE CONVERSAS relê as etiquetas: trocar de aba traz
  // outras conversas, e são outras etiquetas.
  await limparDiario(page);
  await clicar(page, '[data-aba-da-situacao="finalizado"]');
  await page.waitForTimeout(1500);
  const outraLista = await idas(page);
  ok("a lista com outras conversas relê as etiquetas", (outraLista.conversa_tags || 0) >= 1,
     JSON.stringify(outraLista));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. A releitura não apaga a mensagem que ainda está saindo");
{
  const { ctx, page } = await abrir();
  await abrirAPrimeira(page);
  const TEXTO = "Prova do envio 20/10 — a releitura no meio";
  ok("a mensagem foi escrita e enviada", await escreverEEnviar(page, TEXTO));
  await page.waitForTimeout(400);
  const antes = await bolhasCom(page, TEXTO);
  ok("a bolha aparece na hora, com o relógio", antes.length === 1 && antes[0].estado === "enviando",
     JSON.stringify(antes));
  // A queda e a volta do canal: a volta relê a conversa inteira do banco, e a
  // mensagem ainda não está lá (a ponte não a gravou).
  await page.evaluate(() => globalThis.__DERRUBAR_TEMPO_REAL && globalThis.__DERRUBAR_TEMPO_REAL());
  await page.waitForTimeout(100);
  await page.evaluate(() => globalThis.__LEVANTAR_TEMPO_REAL && globalThis.__LEVANTAR_TEMPO_REAL());
  await page.waitForTimeout(700);
  const depois = await bolhasCom(page, TEXTO);
  ok("depois da releitura ela continua na tela", depois.length === 1, JSON.stringify(depois));
  ok("e continua dizendo que está saindo", depois.length === 1 && depois[0].estado === "enviando",
     JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4b. O \"ok\" de antes não é o eco do \"ok\" de agora");
{
  // A mensagem de mesmo texto que JÁ estava na conversa não confirma a bolha
  // nova: "ok" e "Bom dia" se repetem o dia inteiro, e a primeira versão desta
  // regra deixaria a releitura apagar a bolha de agora por causa da de ontem.
  const { ctx, page } = await abrir();
  const conv = await abrirAPrimeira(page);
  const TEXTO = "Prova do envio 20/10 — ok";
  await page.evaluate(([c, t]) => {
    const linha = { id: "ok-de-antes", conversa_id: c, origem: "advogado", tipo: "texto", texto: t,
      criado_em: new Date(Date.now() - 120000).toISOString(), status: "lida", id_uazapi: "ID-ok-de-antes",
      enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" };
    globalThis.__TABELAS.mensagens.push(linha);
    globalThis.__EMITIR("INSERT", "mensagens", { ...linha });
  }, [conv, TEXTO]);
  await page.waitForTimeout(500);
  const plantada = await bolhasCom(page, TEXTO);
  ok("a mensagem de antes está na tela", plantada.length === 1 && plantada[0].id === "ok-de-antes",
     JSON.stringify(plantada));
  ok("a mensagem nova foi escrita e enviada", await escreverEEnviar(page, TEXTO));
  await page.waitForTimeout(300);
  await page.evaluate(() => globalThis.__DERRUBAR_TEMPO_REAL && globalThis.__DERRUBAR_TEMPO_REAL());
  await page.waitForTimeout(100);
  await page.evaluate(() => globalThis.__LEVANTAR_TEMPO_REAL && globalThis.__LEVANTAR_TEMPO_REAL());
  await page.waitForTimeout(700);
  const depois = await bolhasCom(page, TEXTO);
  ok("depois da releitura, as duas estão na tela", depois.length === 2, JSON.stringify(depois));
  ok("e a nova continua saindo", depois.some((b) => b.id !== "ok-de-antes" && b.estado === "enviando"),
     JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. Sem o aviso do tempo real, a conferência traz a mensagem como saiu");
{
  const { ctx, page } = await abrir();
  const conv = await abrirAPrimeira(page);
  const TEXTO = "Prova do envio 20/10 — o aviso que se perdeu";
  ok("a mensagem foi escrita e enviada", await escreverEEnviar(page, TEXTO));
  await page.waitForTimeout(300);
  const naFila = await ponteGravaCalada(page, conv, TEXTO, "eco-perdido");
  ok("a ponte gravou (sem avisar ninguém)", naFila === 1, `${naFila} linhas da fila com o texto`);
  await page.waitForTimeout(150);
  const antes = await bolhasCom(page, TEXTO);
  ok("antes da conferência, a bolha ainda tem o relógio", antes.length === 1 && antes[0].estado === "enviando",
     JSON.stringify(antes));
  await page.waitForTimeout(CONFERENCIA[0] + 900);
  const depois = await bolhasCom(page, TEXTO);
  ok("depois da conferência, é a mensagem gravada que está na tela",
     depois.length === 1 && depois[0].id === "eco-perdido", JSON.stringify(depois));
  ok("e ela diz que saiu", depois.length === 1 && depois[0].estado === "gravada", JSON.stringify(depois));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. A que ainda está na fila continua na tela, com o relógio — e é relida duas vezes, não mais");
{
  const { ctx, page } = await abrir();
  await abrirAPrimeira(page);
  await limparDiario(page);
  const TEXTO = "Prova do envio 20/10 — a ponte demorando";
  ok("a mensagem foi escrita e enviada", await escreverEEnviar(page, TEXTO));
  // Uma segunda logo atrás: dez mensagens seguidas são UMA conferência.
  await page.waitForTimeout(150);
  await escreverEEnviar(page, TEXTO + " (a segunda)");
  await page.waitForTimeout(CONFERENCIA[1] + 1500);
  const ficou = await bolhasCom(page, TEXTO);
  ok("as duas continuam na tela", ficou.length === 2, JSON.stringify(ficou));
  ok("e as duas com o relógio", ficou.length === 2 && ficou.every((b) => b.estado === "enviando"),
     JSON.stringify(ficou));
  const conta = await idas(page);
  ok("a conversa foi relida pelas conferências", (conta.mensagens || 0) >= 1, JSON.stringify(conta));
  ok("e no máximo duas vezes", (conta.mensagens || 0) <= 2, JSON.stringify(conta));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. Com o aviso em dia, a conferência não relê nada");
{
  const { ctx, page } = await abrir();
  const conv = await abrirAPrimeira(page);
  await limparDiario(page);
  const TEXTO = "Prova do envio 20/10 — o aviso em dia";
  ok("a mensagem foi escrita e enviada", await escreverEEnviar(page, TEXTO));
  await page.waitForTimeout(300);
  // A ponte grava e o tempo real avisa, como num dia bom.
  await page.evaluate(([c, t]) => {
    const linha = { id: "eco-em-dia", conversa_id: c, origem: "advogado", tipo: "texto", texto: t,
      criado_em: new Date().toISOString(), status: "enviada", id_uazapi: "ID-eco-em-dia",
      enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" };
    globalThis.__TABELAS.mensagens.push(linha);
    globalThis.__EMITIR("INSERT", "mensagens", { ...linha });
  }, [conv, TEXTO]);
  await page.waitForTimeout(CONFERENCIA[1] + 800);
  const bolhas = await bolhasCom(page, TEXTO);
  ok("a mensagem gravada substituiu a bolha", bolhas.length === 1 && bolhas[0].id === "eco-em-dia",
     JSON.stringify(bolhas));
  const conta = await idas(page);
  ok("e a conversa não foi relida", !conta.mensagens, JSON.stringify(conta));
  await ctx.close();
}

ok("nenhum erro de página", erros.length === 0, erros.slice(0, 3).join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
