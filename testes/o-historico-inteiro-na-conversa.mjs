// O HISTÓRICO INTEIRO NA CONVERSA (26/10)
//
// Pedido do Rodrigo: "Veja também se todos os históricos de conversas estão
// presentes, se não existem erros referente a isso."
//
// No banco do escritório, dos 64 mil avisos que a ponte recebeu desde 08/09,
// nenhum ficou sem processar — mas 36 mensagens nunca entraram no histórico
// (os tipos que a ponte não sabia ler, e os ecos de envio que ela ignorava;
// ver o CLAUDE.md da ponte, "O que não entrava no histórico"). O resto do que
// sumia era na TELA, por quatro caminhos, todos medidos antes de mexer:
//
//   1. "CARREGAR ANTERIORES" PULAVA MENSAGENS. Ele pedia as mensagens de
//      ANTES do horário da mais antiga na tela (`lt`). As que tinham
//      EXATAMENTE aquele horário e não tinham cabido na página nunca vinham.
//      No banco: 1.298 grupos de mensagens com o mesmo horário na mesma
//      conversa (as fotos de um álbum, o histórico importado, que tem minuto
//      cheio); 8 mensagens em 3 conversas caíam numa borda de página;
//   2. A BUSCA DENTRO DA CONVERSA SÓ OLHAVA A TELA. A conversa abre com as
//      120 últimas, e a lupa procurava só nelas — e com acento. Numa conversa
//      de 400 mensagens ela dizia "0" para uma palavra dita no começo. São 84
//      conversas com mais de 120 mensagens no escritório;
//   3. QUEM ABRIA A CONVERSA PELA BUSCA, NUMA MENSAGEM ANTIGA, PERDIA O FIM.
//      Vinham 40 mensagens antes da achada e 120 depois — e mais nada. As
//      mais recentes não estavam na tela, nada dizia isso, e não havia como
//      trazê-las sem sair e entrar de novo. 40 conversas têm mais de 160
//      mensagens;
//   4. A MENSAGEM ANTIGA QUE ENTRA AGORA TOCAVA O AVISO. A importação de
//      histórico e o resgate que a ponte passou a fazer gravam mensagens com
//      a data em que foram escritas; o painel tocava o som para cada uma, como
//      se o cliente tivesse acabado de escrever — e trocava o rótulo da última
//      mensagem da lista ("🎤 Mensagem de voz") pelo "[anexo]" cru.
// ------------------------------------------------------------
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const TEL = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

// ------------------------------------------------------------
//  A CONVERSA LONGA: 400 mensagens, um minuto entre elas.
// ------------------------------------------------------------
const N = 400;
const id = (i) => `m-${String(i).padStart(3, "0")}`;
const minuto = (i) => new Date(AGORA - (N - i + 5) * 60e3).toISOString();
// QUATRO COM O MESMO HORÁRIO, na borda da primeira página (a 120ª mais nova
// é a 281): o álbum de fotos, o histórico importado com minuto cheio.
const EMPATADAS = [279, 280, 281, 282];
const quando = (i) => (EMPATADAS.includes(i) ? minuto(EMPATADAS[0]) : minuto(i));
const ESPECIAIS = {
  10: "esta é a repetida número um",
  50: "a palavra-cinquenta lá do começo",
  60: "Audiência de CONCILIAÇÃO marcada",
  200: "a repetida do meio",
  390: "a repetida do fim",
};
const NOME = "CLIENTE DA CONVERSA LONGA";

function semente() {
  const s = {
    contatos: [
      { id: "ct-longa", numero: "5511970009901", nome: NOME },
      { id: "ct-aviso", numero: "5511970009902", nome: "CLIENTE DO AVISO" },
      { id: "ct-audio", numero: "5511970009903", nome: "CLIENTE DO AUDIO" },
    ],
    conversas: [
      { id: "cv-longa", advogado_id: TEL, contato_id: "ct-longa", nao_lidas: 0, arquivada: false,
        fixada: false, favorita: false, ultima_atividade: quando(N), esperando_desde: null,
        tratada_em: null, situacao: "aberto", protocolo: null, ultima_mensagem: `mensagem ${N}`,
        frente: null, contato: { id: "ct-longa", nome: NOME, numero: "5511970009901", foto_url: null } },
      // A DO AVISO: só o cliente escreveu, e ninguém é dono — a regra 4 do
      // aviso (todo mundo é avisado). É a que mais avisa, e por isso é nela
      // que o silêncio da mensagem antiga se mede.
      { id: "cv-aviso", advogado_id: TEL, contato_id: "ct-aviso", nao_lidas: 0, arquivada: false,
        fixada: false, favorita: false, ultima_atividade: new Date(AGORA - 50 * 3600e3).toISOString(),
        esperando_desde: null, tratada_em: null, situacao: "aberto", protocolo: null,
        responsavel_id: null, ultima_mensagem: "oi", frente: null,
        contato: { id: "ct-aviso", nome: "CLIENTE DO AVISO", numero: "5511970009902", foto_url: null } },
      // A DO ÁUDIO: a última mensagem é um áudio, e a lista diz "🎤 Mensagem
      // de voz" no lugar do "[anexo]" que o banco guarda como prévia.
      { id: "cv-audio", advogado_id: TEL, contato_id: "ct-audio", nao_lidas: 0, arquivada: false,
        fixada: false, favorita: false, ultima_atividade: new Date(AGORA - 2 * 3600e3).toISOString(),
        esperando_desde: null, tratada_em: null, situacao: "aberto", protocolo: null,
        responsavel_id: null, ultima_mensagem: "[anexo]", frente: null,
        contato: { id: "ct-audio", nome: "CLIENTE DO AUDIO", numero: "5511970009903", foto_url: null } },
    ],
    mensagens: [
      { id: "m-aviso-0", conversa_id: "cv-aviso", origem: "contato", tipo: "texto", texto: "oi",
        criado_em: new Date(AGORA - 50 * 3600e3).toISOString() },
      { id: "m-audio-0", conversa_id: "cv-audio", origem: "contato", tipo: "audio", texto: null,
        midia_url: "https://x/a.ogg", criado_em: new Date(AGORA - 2 * 3600e3).toISOString() },
    ],
    notas: [
      { id: "nota-unica", conversa_id: "cv-longa", texto: "nota com notaunica dentro",
        autor: "Equipe", autor_id: null, autor_foto: null, editada_em: null, editada_por: null,
        apagada_em: null, apagada_por: null, apagada_por_id: null, criado_em: quando(100) },
    ],
  };
  for (let i = 1; i <= N; i++) {
    const nossa = i % 3 === 0;
    s.mensagens.push({
      id: id(i), conversa_id: "cv-longa", origem: nossa ? "advogado" : "contato", tipo: "texto",
      texto: ESPECIAIS[i] || `mensagem ${i}`, criado_em: quando(i),
      ...(nossa ? { enviado_por: "Equipe", status: "enviada" } : {}),
    });
  }
  return s;
}

async function abrirPainel({ espiao = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript(({ s, espiao }) => {
    globalThis.__SEMENTE = s;
    globalThis.__QUEBRAR = [];
    globalThis.__QUEBRAR_A_BUSCA_NA_CONVERSA = false;
    globalThis.__AVISOS = [];
    if (espiao) {
      // O SOM E A NOTIFICAÇÃO SÃO ESPIONADOS, e não silenciados — a régua de
      // `o-aviso-de-mensagem-nova`.
      class NotificacaoDeMentira {
        constructor(titulo, opcoes) { globalThis.__AVISOS.push({ o: "notificacao", titulo, ...(opcoes || {}) }); }
        static permission = "granted";
        static requestPermission() { return Promise.resolve("granted"); }
      }
      globalThis.Notification = NotificacaoDeMentira;
      const ACreal = globalThis.AudioContext;
      if (ACreal) {
        globalThis.AudioContext = class extends ACreal {
          createOscillator() { globalThis.__AVISOS.push({ o: "som" }); return super.createOscillator(); }
          createBufferSource() { globalThis.__AVISOS.push({ o: "som" }); return super.createBufferSource(); }
        };
      }
    }
  }, { s: semente(), espiao });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: o que não existe não estoura a prova. */
async function clicar(page, alvo) {
  const l = typeof alvo === "string" ? page.locator(alvo) : alvo;
  if (!(await l.count())) return false;
  await l.first().click({ timeout: 5000 }).catch(() => {});
  return true;
}
async function abrirALonga(page) {
  const abriu = await clicar(page, '[data-conversa-id="cv-longa"]');
  await page.waitForTimeout(1500);
  return abriu;
}
/** Quais das 400 estão no documento. */
const naTela = (page) => page.evaluate((n) => {
  const tem = new Set([...document.querySelectorAll("[data-msg-id]")].map((el) => el.getAttribute("data-msg-id")));
  const r = [];
  for (let i = 1; i <= n; i++) {
    const k = `m-${String(i).padStart(3, "0")}`;
    if (tem.has(k)) r.push(i);
  }
  return r;
}, N);
const visivel = (page, mid) => page.evaluate((m) => {
  const el = document.querySelector(`[data-msg-id="${m}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const lista = document.querySelector("[data-lista-mensagens]")?.getBoundingClientRect();
  return r.height > 0 && (!lista || (r.bottom > lista.top && r.top < lista.bottom));
}, mid);
const BOTAO_ANTERIORES = (page) => page.getByRole("button", { name: /Carregar mensagens anteriores/ });

// ==================================================================
console.log("\n“Carregar anteriores” não pula as mensagens que têm o mesmo horário");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a conversa longa", await abrirALonga(page));
  const antes = await naTela(page);
  ok("ela abre com as 120 mais recentes", antes.length === 120 && antes.includes(N), `vieram ${antes.length}`);
  await clicar(page, BOTAO_ANTERIORES(page));
  await page.waitForTimeout(1500);
  const depois = await naTela(page);
  const faltamEmpatadas = EMPATADAS.filter((i) => !depois.includes(i));
  ok("as quatro com o mesmo horário estão TODAS na tela", !faltamEmpatadas.length,
     `faltaram: ${faltamEmpatadas.join(", ")}`);
  // SOBE ATÉ O COMEÇO.
  for (let k = 0; k < 8 && (await BOTAO_ANTERIORES(page).count()); k++) {
    await clicar(page, BOTAO_ANTERIORES(page));
    await page.waitForTimeout(1200);
  }
  const tudo = await naTela(page);
  const faltam = [];
  for (let i = 1; i <= N; i++) if (!tudo.includes(i)) faltam.push(i);
  ok(`subindo até o começo, as ${N} estão na tela`, !faltam.length,
     `faltaram ${faltam.length}: ${faltam.slice(0, 8).join(", ")}`);
  ok("e nenhuma aparece duas vezes", await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-msg-id]")].map((el) => el.getAttribute("data-msg-id"));
    return ids.length === new Set(ids).size;
  }));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA busca DENTRO da conversa procura no histórico inteiro, e sem acento");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirALonga(page);
  const abriuLupa = await clicar(page, 'button[aria-label="Buscar na conversa"]');
  await page.waitForTimeout(400);
  ok("abri a busca da conversa", abriuLupa);
  const CAIXA = 'input[placeholder="Buscar nesta conversa"]';
  const contagem = () => page.evaluate(() => {
    const caixa = document.querySelector('input[placeholder="Buscar nesta conversa"]');
    const marcada = document.querySelector("[data-contagem-da-busca-na-conversa]");
    return (marcada?.innerText || caixa?.parentElement?.querySelector("span")?.innerText || "").trim();
  });
  const procurar = async (t) => {
    if (!(await page.locator(CAIXA).count())) return;
    await page.fill(CAIXA, t);
    await page.waitForTimeout(2200);
  };

  await procurar("palavra-cinquenta");
  ok("uma palavra dita no começo (fora da tela) é achada: “1 de 1”", (await contagem()) === "1 de 1",
     `disse “${await contagem()}”`);
  ok("e a conversa vai até ela", await visivel(page, id(50)));

  await procurar("conciliacao");
  ok("“conciliacao” acha “CONCILIAÇÃO”", (await contagem()) === "1 de 1", `disse “${await contagem()}”`);
  ok("e vai até ela", await visivel(page, id(60)));

  await procurar("repetida");
  ok("três ocorrências pelo histórico inteiro: “3 de 3”", (await contagem()) === "3 de 3",
     `disse “${await contagem()}”`);
  ok("começa pela mais recente", await visivel(page, id(390)));
  await clicar(page, 'button[title="Anterior"]');
  await page.waitForTimeout(2200);
  ok("“Anterior” vai até a do meio, que não estava na tela", await visivel(page, id(200)),
     `contagem “${await contagem()}”`);
  ok("e a contagem acompanha: “2 de 3”", (await contagem()) === "2 de 3", `disse “${await contagem()}”`);
  await clicar(page, 'button[title="Anterior"]');
  await page.waitForTimeout(2200);
  ok("e de novo, até a primeira", await visivel(page, id(10)));
  await clicar(page, 'button[title="Próxima"]');
  await page.waitForTimeout(2200);
  ok("“Próxima” volta para a do meio", await visivel(page, id(200)));

  await procurar("notaunica");
  ok("a nota interna também é achada", (await contagem()) === "1 de 1", `disse “${await contagem()}”`);

  await procurar("palavraquenaoexiste");
  ok("o que não existe diz 0", (await contagem()) === "0", `disse “${await contagem()}”`);

  // A FALHA É DITA. Procurar só na tela e dizer "0" calado seria o defeito de
  // antes com a frase de agora.
  await page.evaluate(() => { globalThis.__QUEBRAR_A_BUSCA_NA_CONVERSA = true; });
  await procurar("repetida");
  const recado = await page.evaluate(() => document.querySelector("[data-busca-so-na-tela]")?.innerText || "");
  ok("com o banco falhando, a busca diz que procurou só no que está na tela", /só no que está na tela/i.test(recado),
     `disse “${recado}”`);
  ok("e leva o código do banco", /57014/.test(recado), `disse “${recado}”`);
  ok("e acha o que está na tela", /de/.test(await contagem()) && (await contagem()) !== "0",
     `disse “${await contagem()}”`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nAbrir a conversa numa mensagem antiga não perde as mais recentes");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.fill('input[placeholder^="Buscar por nome"]', "palavra-cinquenta");
  await page.waitForTimeout(2500);
  ok("a busca da lista achou a conversa pela mensagem", await clicar(page, '[data-conversa-id="cv-longa"]'));
  await page.waitForTimeout(2500);
  ok("a conversa abre na mensagem achada", await visivel(page, id(50)));
  let tela = await naTela(page);
  ok("e as mais recentes estão carregadas também", tela.includes(N) && tela.includes(N - 100),
     `a mais nova na tela é a ${Math.max(...tela)}`);
  const lacuna = page.locator("[data-lacuna]");
  ok("entre as duas, a tela diz que há mensagens no meio", (await lacuna.count()) === 1);
  const textoDaLacuna = (await lacuna.count()) ? await lacuna.first().innerText() : "";
  ok("e oferece carregá-las", /carregar/i.test(textoDaLacuna), `disse “${textoDaLacuna}”`);
  for (let k = 0; k < 6 && (await lacuna.count()); k++) {
    await clicar(page, "[data-lacuna] button");
    await page.waitForTimeout(1300);
  }
  tela = await naTela(page);
  const faltam = [];
  for (let i = 10; i <= N; i++) if (!tela.includes(i)) faltam.push(i);
  ok("carregando o meio, nada fica faltando entre a achada e o fim", !faltam.length,
     `faltaram ${faltam.length}: ${faltam.slice(0, 8).join(", ")}`);
  ok("e a marca do meio some quando ele acaba", (await lacuna.count()) === 0);
  ok("e nenhuma aparece duas vezes", await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-msg-id]")].map((el) => el.getAttribute("data-msg-id"));
    return ids.length === new Set(ids).size;
  }));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA mensagem que chega durante o salto vai para o FIM, e não para o meio");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.fill('input[placeholder^="Buscar por nome"]', "palavra-cinquenta");
  await page.waitForTimeout(2500);
  await clicar(page, '[data-conversa-id="cv-longa"]');
  await page.waitForTimeout(2500);
  await page.evaluate((agora) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-nova", conversa_id: "cv-longa", origem: "contato", tipo: "texto",
      texto: "acabei de escrever", criado_em: new Date(agora).toISOString(),
    });
  }, Date.now());
  await page.waitForTimeout(1200);
  const ordem = await page.evaluate(() => [...document.querySelectorAll("[data-msg-id]")].map((el) => el.getAttribute("data-msg-id")));
  const iNova = ordem.indexOf("m-nova"), iFim = ordem.indexOf("m-400");
  ok("a nova aparece", iNova >= 0);
  ok("e vem depois da mais recente de antes", iFim >= 0 && iNova > iFim, `nova em ${iNova}, a 400 em ${iFim}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA mensagem ANTIGA que entra agora não toca o aviso; a nova toca");
{
  const { ctx, page, estouros } = await abrirPainel({ espiao: true });
  const avisos = () => page.evaluate(() => globalThis.__AVISOS || []);
  await page.evaluate(() => { globalThis.__AVISOS = []; });
  await page.evaluate((agora) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-aviso-velha", conversa_id: "cv-aviso", origem: "contato", tipo: "texto",
      texto: "escrita há três dias", criado_em: new Date(agora - 3 * 86400e3).toISOString(),
    });
  }, Date.now());
  await page.waitForTimeout(4000);
  const daVelha = await avisos();
  ok("a de três dias atrás não toca o som", !daVelha.some((a) => a.o === "som"), JSON.stringify(daVelha));
  ok("nem levanta a notificação", !daVelha.some((a) => a.o === "notificacao"), JSON.stringify(daVelha));
  await page.evaluate(() => { globalThis.__AVISOS = []; });
  await page.evaluate((agora) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-aviso-nova", conversa_id: "cv-aviso", origem: "contato", tipo: "texto",
      texto: "escrita agora", criado_em: new Date(agora).toISOString(),
    });
  }, Date.now());
  await page.waitForTimeout(4000);
  const daNova = await avisos();
  ok("a de agora toca", daNova.some((a) => a.o === "som"), JSON.stringify(daNova));
  ok("e levanta a notificação", daNova.some((a) => a.o === "notificacao"), JSON.stringify(daNova));
  // A DE ONTEM À NOITE AINDA AVISA. O corte é de um dia: o cliente que
  // escreveu sem sinal e reconectou de manhã não pode ficar mudo.
  await page.evaluate(() => { globalThis.__AVISOS = []; });
  await page.evaluate((agora) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-aviso-noite", conversa_id: "cv-aviso", origem: "contato", tipo: "texto",
      texto: "escrita há dez horas", criado_em: new Date(agora - 10 * 3600e3).toISOString(),
    });
  }, Date.now());
  await page.waitForTimeout(4000);
  ok("a de dez horas atrás ainda toca", (await avisos()).some((a) => a.o === "som"));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA mensagem ANTIGA que entra agora não troca o rótulo da última mensagem da lista");
{
  const { ctx, page, estouros } = await abrirPainel();
  const linha = () => page.evaluate(() =>
    document.querySelector('[data-conversa-id="cv-audio"]')?.innerText || "");
  const antes = await linha();
  ok("(a lista diz que a última é um áudio)", /Mensagem de voz/.test(antes), JSON.stringify(antes));
  await page.evaluate((agora) => {
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-audio-velha", conversa_id: "cv-audio", origem: "contato", tipo: "texto",
      texto: "resgatada de três dias atrás", criado_em: new Date(agora - 3 * 86400e3).toISOString(),
    });
  }, Date.now());
  await page.waitForTimeout(1500);
  const depois = await linha();
  ok("a mensagem de três dias atrás não apaga o rótulo do áudio", /Mensagem de voz/.test(depois)
     && !/\[anexo\]/.test(depois), JSON.stringify(depois));
  // O CONTRASTE: a de agora É a última, e o rótulo dela vale.
  await page.evaluate((agora) => {
    const quando = new Date(agora).toISOString();
    globalThis.__EMITIR("INSERT", "mensagens", {
      id: "m-audio-nova", conversa_id: "cv-audio", origem: "contato", tipo: "texto",
      texto: "escrita agora, depois do áudio", criado_em: quando,
    });
    globalThis.__EMITIR("UPDATE", "conversas", {
      id: "cv-audio", ultima_mensagem: "escrita agora, depois do áudio", ultima_atividade: quando,
    });
  }, Date.now());
  await page.waitForTimeout(1500);
  const agora = await linha();
  ok("e a de agora troca, como sempre trocou", /escrita agora, depois do áudio/.test(agora)
     && !/Mensagem de voz/.test(agora), JSON.stringify(agora));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
