// A CONVERSA DO HISTÓRICO ABRE — esteja em que aba estiver (22/10)
//
// Relato do Rodrigo: "Quando eu vou consultar a conversa com o cliente por
// outro telefone, no histórico de atendimento, ao clicar para ver a conversa
// não está abrindo a conversa".
//
// A tela da direita não guarda a conversa aberta: ela a PROCURA na lista da
// esquerda (`conversas.find`). E desde as abas (19/10) a lista vem do banco
// recortada pela aba — "Em Atendimento", ao abrir. O botão do histórico
// trocava de telefone e recarregava a lista; a conversa do outro telefone que
// estava em "Novos", em "Finalizados" ou além das 200 mais recentes não vinha
// nela, e o clique terminava em "Selecione uma conversa", sem uma palavra.
//
// A aba foi consertada pelo link (#281) e pelo histórico (#283), na mesma
// função (`abrirNaAbaDela`). Esta prova vigia as quatro portas que passam por
// ela — o histórico, a "Nova conversa", a tarefa e o funil chamam as mesmas
// duas funções — e o que ainda faltava a elas:
//
//   1. a conversa do outro telefone ABRE, nas três abas e além da primeira
//      página — e é ELA que abre, e não a do telefone de antes;
//   2. a lista vai para onde a conversa mora — a aba dela, ou a PASTA DE
//      ARQUIVADAS — e mostra a linha dela, mesmo com um filtro ligado antes:
//      a direita e a esquerda dizem a mesma coisa;
//   3. o cliente que NINGUÉM respondeu também tem o botão no histórico — a
//      lista por telefone só aparecia quando alguém do escritório já tinha
//      escrito para ele;
//   4. a "Nova conversa" com um cliente de conversa finalizada abre, e a
//      tarefa da tela de Tarefas abre a conversa finalizada do outro telefone;
//   5. a leitura que FALHA é dita, com o código, e nada muda na tela — nem o
//      telefone, nem a janela aberta: um clique mudo é indistinguível de um
//      clique quebrado.
// ------------------------------------------------------------
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM RELÓGIO SÓ para a semente inteira — a lição da prova do histórico do
// "Já tratei".
const AGORA = Date.now();
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();

/** O telefone que o painel ABRE, e outro de OUTRO departamento — o caso do
 *  escritório, em que o cliente fala com o SAC e com o SDC. Descobertos, e
 *  não escolhidos a dedo: a conta de teste é quem decide o que abre. */
async function telefones() {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const T = globalThis.__TABELAS;
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (T.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    if (!a) return null;
    const outros = (T.advogados || []).filter((x) => String(x.id) !== String(a.id) && x.ativo !== false);
    const outro = outros.find((x) => x.departamento_id !== a.departamento_id) || outros[0];
    return outro ? { adv: a.id, advNome: a.nome, advNumero: a.numero,
                     outro: outro.id, outroNome: outro.nome, outroNumero: outro.numero } : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefones();
ok("aprendi os dois telefones", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const CLARA = "CLARA DOS DOIS TELEFONES";
const BRUNO = "BRUNO FINALIZADO";
const DO_PRIMEIRO = "oi, pelo primeiro telefone";
const DO_OUTRO = "mensagem pelo outro telefone";

const conversa = (id, contatoId, nome, numero, adv, quando, extra = {}) => ({
  id, advogado_id: adv, contato_id: contatoId, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: quando, esperando_desde: null, tratada_em: null, situacao: "aberto", protocolo: null,
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: contatoId, nome, numero, foto_url: null }, ...extra,
});
const msg = (id, conversaId, texto, quando) => ({
  id, conversa_id: conversaId, origem: "contato", tipo: "texto", texto, criado_em: quando,
});

/** A Clara no telefone que abre (em atendimento, no alto da lista) e no
 *  outro, com a conversa de lá na situação da cena. `antiga` a põe atrás de
 *  duzentas conversas mais recentes do outro telefone. */
function semente({ situacao = "aberto", arquivada = false, antiga = false } = {}) {
  const quandoDoOutro = antiga ? H(3000) : H(0.5);
  const s = {
    contatos: [
      { id: "ct-clara", numero: "5511970008801", nome: CLARA },
      { id: "ct-bruno", numero: "5511970008802", nome: BRUNO },
    ],
    conversas: [
      conversa("cv-c1", "ct-clara", CLARA, "5511970008801", TEL.adv, H(0.02)),
      conversa("cv-c2", "ct-clara", CLARA, "5511970008801", TEL.outro, quandoDoOutro,
               { situacao, arquivada, protocolo: situacao === "finalizado" ? "2026-000901" : null }),
      // O BRUNO, finalizado no telefone que abre: fora de "Em Atendimento".
      conversa("cv-b1", "ct-bruno", BRUNO, "5511970008802", TEL.adv, H(1),
               { situacao: "finalizado", protocolo: "2026-000902" }),
    ],
    mensagens: [
      msg("m-c1", "cv-c1", DO_PRIMEIRO, H(0.02)),
      msg("m-c2", "cv-c2", DO_OUTRO, quandoDoOutro),
      msg("m-b1", "cv-b1", "obrigado, até mais", H(1)),
    ],
  };
  if (antiga) {
    // UMA CONVERSA SEM MENSAGEM no outro telefone: ainda fora da lista. Quando
    // o cliente dela escrever, a lista é relida — e a conversa aberta, que a
    // página 0 não traz, tem de continuar aberta.
    s.contatos.push({ id: "ct-chega", numero: "5511970008803", nome: "DONA QUE CHEGOU AGORA" });
    s.conversas.push(conversa("cv-chega", "ct-chega", "DONA QUE CHEGOU AGORA", "5511970008803", TEL.outro, H(48)));
    // DUZENTAS E DEZ conversas mais recentes no outro telefone, todas em
    // atendimento e todas com mensagem: a da Clara fica fora da primeira
    // página, que é de 200.
    for (let i = 0; i < 210; i++) {
      const id = `cv-enche-${i}`;
      const quando = H(1 + i * 0.05);
      s.contatos.push({ id: `ct-enche-${i}`, numero: `55119800${String(10000 + i)}`, nome: `ENCHIMENTO ${i}` });
      s.conversas.push(conversa(id, `ct-enche-${i}`, `ENCHIMENTO ${i}`, `55119800${String(10000 + i)}`, TEL.outro, quando));
      s.mensagens.push(msg(`m-enche-${i}`, id, "bom dia", quando));
    }
  }
  return s;
}

/** O QUE A EQUIPE MANDOU por um telefone, como a ponte devolve. A Clara foi
 *  respondida pelo primeiro telefone — o caso do relato: quem atende está
 *  numa conversa já atendida e quer ver a do outro telefone. */
const ENVIO = { id: "m-equipe", texto: "Recebemos, obrigado", criado_em: H(30),
                enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", enviado_por_foto: null };

/** A PONTE DE MENTIRA diz quais conversas o cliente tem em todos os
 *  telefones — é dela que o histórico tira as linhas. `semResposta` é o
 *  cliente que ninguém do escritório respondeu ainda, em telefone nenhum. */
async function abrirPainel(s, { largura = 1920, altura = 1000, tarefas = [], semResposta = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = { ...d.semente, zorvin_tarefas: d.tarefas };
    globalThis.__SEM_SITUACAO = false;
    globalThis.__QUEBRAR = [];
    globalThis.__QUEBRAR_SO_A_LEITURA = [];
    globalThis.__RECUSAR_LEITURA = [];
  }, { semente: s, tarefas });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const m = url.pathname.match(/\/historico\/contato\/([^/]+)(\/quantas)?$/);
    if (m) {
      const convs = s.conversas.filter((c) => c.contato_id === decodeURIComponent(m[1]));
      if (m[2]) {
        return rota.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, conversas: convs.length, telefones: new Set(convs.map((c) => c.advogado_id)).size }) });
      }
      const linhas = convs.map((c) => {
        const deMim = c.advogado_id === TEL.adv;
        const respondida = deMim && !semResposta;
        return { conversa_id: c.id, advogado_id: c.advogado_id,
                 advogado_nome: deMim ? TEL.advNome : TEL.outroNome,
                 advogado_numero: deMim ? TEL.advNumero : TEL.outroNumero,
                 primeira: respondida ? ENVIO : null, ultima: respondida ? ENVIO : null };
      });
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, linhas }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: o elemento que não existe não estoura a prova — ela
 *  reprova na conferência que diz o quê. */
async function clicar(page, alvo) {
  const l = typeof alvo === "string" ? page.locator(alvo) : alvo;
  if (!(await l.count())) return false;
  await l.first().click({ timeout: 5000 }).catch(() => {});
  return true;
}

/** Abre a conversa da Clara no telefone que abre, o histórico dela, e clica
 *  em "Abrir neste telefone" na linha do outro. */
async function abrirPeloHistorico(page, { antesDoClique = null } = {}) {
  if (!(await clicar(page, `[data-conversa-nome="${CLARA}"]`))) return "a conversa da Clara não estava na lista";
  await page.waitForTimeout(900);
  if (!(await clicar(page, 'button[title^="Histórico de atendimento"]'))) return "o botão do histórico não apareceu";
  await page.waitForTimeout(1500);
  const botao = page.locator("button", { hasText: "Abrir neste telefone" });
  if (!(await botao.count())) return "o histórico não ofereceu abrir no outro telefone";
  if (antesDoClique) await antesDoClique();
  await botao.first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return "";
}

/** O que a tela mostra agora. */
const estado = (page) => page.evaluate(() => {
  const visivel = (el) => Boolean(el && el.offsetParent !== null);
  let telefone = null;
  try { telefone = localStorage.getItem("zorvin_advogado"); } catch (_) { /* sem armazenamento */ }
  return {
    topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
    doOutro: visivel(document.querySelector('[data-msg-id="m-c2"]')),
    doPrimeiro: visivel(document.querySelector('[data-msg-id="m-c1"]')),
    doBruno: visivel(document.querySelector('[data-msg-id="m-b1"]')),
    telefone,
    aba: document.querySelector('[data-aba-da-situacao][data-aba-ativa="sim"]')?.getAttribute("data-aba-da-situacao") || null,
    pasta: document.querySelectorAll("[data-vendo-arquivadas]").length === 1,
    linhaDoOutro: visivel(document.querySelector('[data-conversa-id="cv-c2"]')),
    linhaDoBruno: visivel(document.querySelector('[data-conversa-id="cv-b1"]')),
    aviso: document.querySelector("[data-aviso]")?.innerText || "",
  };
});

// ==================================================================
for (const [titulo, opcoes, abaEsperada] of [
  ["em atendimento no outro telefone (a de sempre)", { situacao: "aberto" }, "aberto"],
  ["finalizada no outro telefone", { situacao: "finalizado" }, "finalizado"],
  ["em “Novos” no outro telefone", { situacao: "aguardando" }, "aguardando"],
]) {
  console.log(`\nA conversa ${titulo} abre`);
  const { ctx, page, estouros } = await abrirPainel(semente(opcoes));
  const tropeco = await abrirPeloHistorico(page);
  ok("cheguei ao botão do histórico", !tropeco, tropeco);
  const e = await estado(page);
  ok("a conversa do outro telefone ABRE", e.doOutro && /CLARA/.test(e.topo),
     `topo: “${e.topo.slice(0, 60)}”; a mensagem do outro telefone na tela? ${e.doOutro}`);
  ok("e é ela, e não a do telefone de antes", !e.doPrimeiro);
  ok("no telefone dela", e.telefone === TEL.outro, `${e.telefone} ≠ ${TEL.outro}`);
  ok(`a lista vai para a aba dela (${abaEsperada})`, e.aba === abaEsperada, `aba ativa: ${e.aba}`);
  ok("e mostra a linha dela", e.linhaDoOutro);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nCom o filtro “Não lidas” ligado, a linha dela aparece assim mesmo");
{
  // O filtro de antes esconderia a linha que se acabou de abrir — a direita
  // mostrando a conversa e a esquerda dizendo que ela não está lá. A regra é
  // a de trocar de telefone pela barra: a lista volta para "Tudo".
  const s = semente({ situacao: "finalizado" });
  s.conversas.find((c) => c.id === "cv-c1").nao_lidas = 2;
  const { ctx, page, estouros } = await abrirPainel(s);
  const filtrou = await clicar(page, '[data-aba="naolidas"]');
  await page.waitForTimeout(800);
  ok("liguei o filtro “Não lidas”", filtrou);
  const tropeco = await abrirPeloHistorico(page);
  ok("cheguei ao botão do histórico", !tropeco, tropeco);
  const e = await estado(page);
  ok("a conversa do outro telefone ABRE", e.doOutro && /CLARA/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("e a linha dela aparece na lista", e.linhaDoOutro);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA conversa ARQUIVADA no outro telefone abre, e a lista vai para a pasta");
{
  const { ctx, page, estouros } = await abrirPainel(semente({ situacao: "finalizado", arquivada: true }));
  const tropeco = await abrirPeloHistorico(page);
  ok("cheguei ao botão do histórico", !tropeco, tropeco);
  const e = await estado(page);
  ok("a conversa arquivada ABRE", e.doOutro && /CLARA/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("no telefone dela", e.telefone === TEL.outro);
  ok("a lista abre a pasta de arquivadas", e.pasta);
  ok("e mostra a linha dela", e.linhaDoOutro);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA conversa ANTIGA, atrás de 200 mais recentes, abre e entra na lista");
{
  const { ctx, page, estouros } = await abrirPainel(semente({ situacao: "aberto", antiga: true }));
  const tropeco = await abrirPeloHistorico(page);
  ok("cheguei ao botão do histórico", !tropeco, tropeco);
  const e = await estado(page);
  ok("a conversa antiga ABRE", e.doOutro && /CLARA/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("no telefone dela", e.telefone === TEL.outro);
  // A LISTA DO TELEFONE DELA JÁ FOI LIDA — a mais recente das duzentas está
  // no alto — e a conversa continua aberta: a releitura que a troca de
  // telefone pede não a trouxe, e foi a emenda que a manteve.
  ok("a lista do telefone dela foi lida, e a conversa continuou aberta",
     await page.evaluate(() => Boolean(document.querySelector('[data-conversa-id="cv-enche-0"]'))) && e.doOutro);
  // A LINHA DELA ESTÁ NA LISTA, no fim: é a mais antiga. A lista desenha só o
  // que cabe e cresce ao rolar — rola-se até ela aparecer.
  let temLinha = false;
  for (let i = 0; i < 20 && !temLinha; i++) {
    temLinha = await page.evaluate(() => {
      if (document.querySelector('[data-conversa-id="cv-c2"]')) return true;
      const alvo = [...document.querySelectorAll("div")]
        .find((d) => d.scrollHeight > d.clientHeight + 200 && d.querySelector("[data-conversa-nome]"));
      if (alvo) alvo.scrollTop = alvo.scrollHeight;
      return false;
    });
    if (!temLinha) await page.waitForTimeout(500);
  }
  ok("e a linha dela está na lista, depois das duzentas", temLinha);
  // E CONTINUA ABERTA quando a lista é relida de novo. Quem relê é uma
  // conversa que não estava na lista e recebe uma resposta da equipe pelo
  // celular: ela entra em "Em Atendimento", e a lista é pedida outra vez.
  await page.evaluate(() => globalThis.__MENSAGEM_PELA_PONTE("cv-chega", "advogado", "Bom dia, pode mandar"));
  await page.waitForTimeout(3500);
  const depois = await estado(page);
  const releu = await page.evaluate(() => Boolean(document.querySelector('[data-conversa-id="cv-chega"]')));
  ok("a lista foi relida (a conversa respondida entrou)", releu);
  ok("e a conversa antiga continua aberta", depois.doOutro && /CLARA/.test(depois.topo),
     `topo: “${depois.topo.slice(0, 60)}”`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nCom o cliente que NINGUÉM respondeu ainda, o histórico também oferece abrir");
{
  // Sem resposta do escritório em telefone nenhum, o histórico escrevia
  // "a conversa existe, mas só com o que ele mandou" — e não mostrava a lista
  // por telefone, nem o botão. A conversa do outro telefone, que é justamente
  // a que ninguém atendeu, ficava sem caminho.
  const { ctx, page, estouros } = await abrirPainel(semente({ situacao: "aguardando" }), { semResposta: true });
  let frase = "";
  const tropeco = await abrirPeloHistorico(page, {
    antesDoClique: async () => { frase = await page.locator("body").innerText().catch(() => ""); },
  });
  ok("o histórico oferece abrir no outro telefone", !tropeco, tropeco);
  ok("e continua dizendo que ninguém respondeu", /Ninguém do escritório enviou/.test(frase));
  const e = await estado(page);
  ok("a conversa do outro telefone ABRE", e.doOutro && /CLARA/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("na aba dela (Novos)", e.aba === "aguardando", `aba ativa: ${e.aba}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA “Nova conversa” com um cliente de conversa finalizada abre");
{
  const { ctx, page, estouros } = await abrirPainel(semente());
  let chegou = await clicar(page, '[aria-label="Nova conversa"]');
  await page.waitForTimeout(700);
  if (chegou) {
    await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("BRUNO FINALIZADO").catch(() => {});
    await page.waitForTimeout(900);
    chegou = await clicar(page, '[data-contato-agenda="ct-bruno"]');
    await page.waitForTimeout(2500);
  }
  ok("cheguei ao contato na agenda", chegou);
  const e = await estado(page);
  ok("a conversa finalizada ABRE", e.doBruno && /BRUNO/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("a lista vai para “Finalizados”", e.aba === "finalizado", `aba ativa: ${e.aba}`);
  ok("e mostra a linha dele", e.linhaDoBruno);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA tarefa da tela de Tarefas abre a conversa finalizada do outro telefone");
{
  const tarefa = { id: "tf-clara", conversa_id: "cv-c2", texto: "Confirmar o acordo da Clara", vence_em: H(-24),
                   para_quem: "u1", criada_por: "u1", criada_em: H(2), feita_em: null, feita_por: null };
  const { ctx, page, estouros } = await abrirPainel(semente({ situacao: "finalizado" }), { tarefas: [tarefa] });
  let chegou = await clicar(page, "[data-abrir-tarefas]");
  await page.waitForTimeout(1500);
  if (chegou) {
    chegou = await clicar(page, '[data-tarefa-da-tela="tf-clara"] [data-abrir-tarefa]');
    await page.waitForTimeout(2500);
  }
  ok("cheguei à tarefa na tela de Tarefas", chegou);
  const e = await estado(page);
  ok("a conversa da tarefa ABRE", e.doOutro && /CLARA/.test(e.topo), `topo: “${e.topo.slice(0, 60)}”`);
  ok("no telefone dela", e.telefone === TEL.outro);
  ok("e na aba dela", e.aba === "finalizado", `aba ativa: ${e.aba}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA leitura que falha é DITA, e o telefone não muda");
{
  const { ctx, page, estouros } = await abrirPainel(semente({ situacao: "finalizado" }));
  const tropeco = await abrirPeloHistorico(page, {
    antesDoClique: () => page.evaluate(() => { globalThis.__QUEBRAR = ["conversas"]; }),
  });
  ok("cheguei ao botão do histórico", !tropeco, tropeco);
  const e = await estado(page);
  ok("o aviso diz que não conseguiu abrir", /não consegui abrir/i.test(e.aviso), `aviso: “${e.aviso}”`);
  ok("com o código do banco", /57014/.test(e.aviso), `aviso: “${e.aviso}”`);
  ok("e o telefone continua o de antes", e.telefone === TEL.adv, `${e.telefone}`);
  await page.evaluate(() => { globalThis.__QUEBRAR = []; });
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nNa “Nova conversa”, a leitura que falha é DITA, e a janela continua aberta");
{
  // A GRAVAÇÃO PASSA e a LEITURA tropeça: é a ida que vem depois da
  // gravação, para abrir a conversa onde ela mora. Fechar a janela e não
  // abrir nada seria o clique mudo com outra roupa.
  const { ctx, page, estouros } = await abrirPainel(semente());
  let chegou = await clicar(page, '[aria-label="Nova conversa"]');
  await page.waitForTimeout(700);
  if (chegou) {
    await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("BRUNO FINALIZADO").catch(() => {});
    await page.waitForTimeout(900);
    await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = ["conversas"]; });
    chegou = await clicar(page, '[data-contato-agenda="ct-bruno"]');
    await page.waitForTimeout(2500);
  }
  ok("cheguei ao contato na agenda", chegou);
  const e = await estado(page);
  const janela = await page.evaluate(() =>
    Boolean(document.querySelector('[data-contato-agenda="ct-bruno"]')?.offsetParent));
  await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = []; });
  ok("o aviso diz que não conseguiu abrir", /não consegui abrir/i.test(e.aviso), `aviso: “${e.aviso}”`);
  ok("com o código do banco", /57014/.test(e.aviso), `aviso: “${e.aviso}”`);
  ok("a janela da “Nova conversa” continua aberta", janela);
  ok("e nenhuma conversa abriu atrás dela", !e.doBruno && !e.topo, `topo: “${e.topo.slice(0, 60)}”`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
