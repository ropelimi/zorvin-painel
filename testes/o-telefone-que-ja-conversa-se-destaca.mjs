// O TELEFONE QUE JÁ CONVERSA COM O CLIENTE SE DESTACA (09/11).
//
// Pedido do Rodrigo, com a foto da janela "Falar por qual telefone?", que
// abre quando se clica no ícone do Zorvin dentro do Vantoro: "Preciso que
// esses telefones que já tiveram conversa fiquem mais destacados". E, logo
// depois: "sempre sugerir onde teve a resposta do contato mais recente, ou a
// nossa última mensagem mais recente caso não tenha sido o contato que enviou
// a última mensagem".
//
// O QUE ESTA PROVA VIGIA:
//   * os telefones com conversa num grupo próprio, com título, num cartão
//     verde com a faixa à esquerda; os sem conversa noutro grupo, recuados,
//     com borda tracejada;
//   * cada telefone com conversa diz a última mensagem: "Cliente respondeu" ou
//     "Nossa última mensagem", com a hora;
//   * a sugestão é a conversa da mensagem mais recente, de qualquer lado: com o
//     cliente por último num telefone e nós por último noutro, vale a mais
//     nova das duas;
//   * o aviso automático (`automatica`) não conta;
//   * a sugerida vem primeiro, com o selo "Sugerido", e o cursor já nela: o
//     Enter a escolhe e abre a conversa por aquele telefone;
//   * o telefone aberto na barra diz "aberto agora", e não ganha a borda verde;
//   * sem conversa nenhuma, nenhum "Sugerido", e o título diz isso;
//   * a leitura das mensagens que falha é dita, e não vira sugestão chutada;
//   * cada telefone com conversa diz em qual aba ela mora (09/11): aberta
//     ("Novos", "Em Atendimento") ou finalizada ("Finalizados", "Arquivada");
//     sem o 028 só a arquivada tem selo, e a janela funciona como antes.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
let corDoEmAtendimento = "";
const H = (n) => new Date(Date.now() - n * 3600e3).toISOString();
const contato = (id, numero, nome) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
  vantoro_cliente_id: null, foto_url: null });
const conversa = (id, adv, ct, campos) => ({ id, advogado_id: adv, contato_id: ct.id, nao_lidas: 0, arquivada: false,
  fixada: false, favorita: false, frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null,
  esperando_desde: null, situacao: "aberto", protocolo: `P-${id}`, ultima_mensagem: "oi",
  contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null }, ...campos });
const msg = (id, conv, origem, criado_em, extra = {}) => ({ id, conversa_id: conv, origem, tipo: "texto", texto: "oi",
  criado_em, id_uazapi: `ID-${id}`, ...extra });

// Os telefones da bancada: a5 é o SAC, a7 o "Acordos 1" (o que abre na barra),
// a13 o "Arquivo".
// CLIENTE 1: respondeu no SAC há 3 horas; no Acordos 1 escreveu há 5 e NÓS
// respondemos há 1 hora. A mensagem mais recente é a nossa, no Acordos 1.
// E um aviso automático no Arquivo há 10 minutos, que não conta.
const C1 = contato("ct-dest-1", "5511980011001", "CLIENTE UM");
// CLIENTE 2: respondeu no SAC há 1 hora; nós falamos no Acordos 1 há 3.
const C2 = contato("ct-dest-2", "5511980011002", "CLIENTE DOIS");
// CLIENTE 3: nenhuma conversa.
const C3 = contato("ct-dest-3", "5511980011003", "CLIENTE TRES");

const semente = {
  contatos: [C1, C2, C3],
  conversas: [
    // As situações (09/11): o SAC do cliente 1 finalizado, o Acordos 1 em
    // atendimento, o Arquivo arquivado (e por isso finalizado, o 057); o SAC
    // do cliente 2 novo, o Acordos 1 dele finalizado.
    conversa("cv-d1-a5", "a5", C1, { ultima_atividade: H(3), situacao: "finalizado" }),
    conversa("cv-d1-a7", "a7", C1, { ultima_atividade: H(1), situacao: "aberto" }),
    conversa("cv-d1-a13", "a13", C1, { ultima_atividade: H(0.17), situacao: "finalizado", arquivada: true }),
    conversa("cv-d2-a5", "a5", C2, { ultima_atividade: H(1), situacao: "aguardando" }),
    conversa("cv-d2-a7", "a7", C2, { ultima_atividade: H(3), situacao: "finalizado" }),
  ],
  mensagens: [
    msg("m-d1-a5", "cv-d1-a5", "contato", H(3)),
    msg("m-d1-a7-c", "cv-d1-a7", "contato", H(5)),
    msg("m-d1-a7-n", "cv-d1-a7", "advogado", H(1)),
    msg("m-d1-a13", "cv-d1-a13", "advogado", H(0.17), { automatica: true }),
    msg("m-d2-a5", "cv-d2-a5", "contato", H(1)),
    msg("m-d2-a7", "cv-d2-a7", "advogado", H(3)),
  ],
};

async function abrir(ct, { quebrar = false, largura = 1400, sem028 = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  await page.addInitScript(({ s, q, sem }) => {
    globalThis.__SEMENTE = s;
    globalThis.__DIARIO = [];
    if (q) globalThis.__QUEBRAR_SO_A_LEITURA = ["mensagens"];
    if (sem) globalThis.__SEM_SITUACAO = true;
  }, { s: semente, q: quebrar, sem: sem028 });
  await page.goto(`${ENDERECO}?telefone=${ct.numero}&nome=${encodeURIComponent(ct.nome)}`);
  await page.waitForSelector("[data-telefones-da-escolha]", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  const ler = () => page.evaluate(() => {
    const cor = (e) => getComputedStyle(e);
    const opcoes = [...document.querySelectorAll("[data-telefone-opcao]")].map((b) => ({
      id: b.getAttribute("data-telefone-opcao"),
      tem: b.getAttribute("data-tem-conversa"),
      sugerido: b.getAttribute("data-sugerido") === "sim",
      grupo: b.closest("[data-grupo-telefones]")?.getAttribute("data-grupo-telefones") || null,
      ultima: b.querySelector("[data-ultima-mensagem]")?.innerText || "",
      situacao: b.querySelector("[data-situacao-da-conversa]")?.getAttribute("data-situacao-da-conversa") || null,
      seloSit: b.querySelector("[data-situacao-da-conversa]")?.innerText || "",
      corSit: b.querySelector("[data-situacao-da-conversa]") ? getComputedStyle(b.querySelector("[data-situacao-da-conversa]")).color : "",
      tituloSit: b.querySelector("[data-situacao-da-conversa]")?.getAttribute("title") || "",
      // O selo e a última mensagem inteiros dentro do cartão (o celular).
      dentro: [b.querySelector("[data-situacao-da-conversa]"), b.querySelector("[data-ultima-mensagem]")].filter(Boolean)
        .every((x) => x.getBoundingClientRect().right <= b.getBoundingClientRect().right + 0.5),
      selo: !!b.querySelector("[data-selo-sugerido]"),
      aberto: !!b.querySelector("[data-aberto-agora]"),
      texto: b.innerText,
      fundo: cor(b).backgroundImage,
      borda: cor(b).borderTopStyle,
      faixa: cor(b).boxShadow,
      focado: document.activeElement === b,
    }));
    return {
      opcoes,
      titulos: [...document.querySelectorAll("[data-titulo-do-grupo]")].map((t) => ({ marca: t.getAttribute("data-titulo-do-grupo"), texto: t.innerText })),
      semSugestao: document.querySelector("[data-escolha-sem-sugestao]")?.innerText || "",
      // A leitura das conversas do cliente: as colunas que ela pediu. A bancada
      // devolve a linha inteira de \`conversas\` qualquer que seja a coluna
      // pedida, e só o pedido diz se a situação seria lida no banco de verdade.
      colunasDaLeitura: (globalThis.__DIARIO || []).filter((m) => m.tabela === "conversas" && (m.pedidos || []).includes("contato_id"))
        .map((m) => m.colunas),
      largura: document.documentElement.scrollWidth,
      janela: innerWidth,
    };
  });
  return { ctx, page, estouros, ler };
}

// ---- 1. o cliente com conversa em três telefones ----
{
  const { ctx, page, estouros, ler } = await abrir(C1);
  const e = await ler();
  const por = (id) => e.opcoes.find((o) => o.id === id) || {};
  ok("1: a janela abre com as opções", e.opcoes.length >= 4, String(e.opcoes.length));
  const com = e.opcoes.filter((o) => o.tem === "sim").map((o) => o.id).sort();
  ok("1: os três telefones com conversa estão no grupo deles",
     JSON.stringify(com) === JSON.stringify(["a13", "a5", "a7"]) && e.opcoes.filter((o) => o.tem === "sim").length === 3 && e.opcoes.filter((o) => o.tem === "sim").every((o) => o.grupo === "com-conversa"),
     JSON.stringify(e.opcoes.map((o) => [o.id, o.tem, o.grupo])));
  ok("1: os sem conversa estão no grupo de conversa nova",
     e.opcoes.filter((o) => o.tem === "nao").length > 0 && e.opcoes.filter((o) => o.tem === "nao").every((o) => o.grupo === "sem-conversa"),
     JSON.stringify(e.opcoes.map((o) => [o.id, o.grupo])));
  ok("1: o grupo com conversa vem antes", e.titulos[0]?.marca === "com-conversa", JSON.stringify(e.titulos));
  ok("1: o título do grupo conta os três", /já conversam com este cliente · 3/i.test(e.titulos[0]?.texto || ""), JSON.stringify(e.titulos));
  ok("1: o título do outro grupo diz conversa nova", /começar conversa nova por/i.test(e.titulos[1]?.texto || ""), JSON.stringify(e.titulos));
  ok("1: a sugerida é a da mensagem mais recente (a nossa, no Acordos 1)", por("a7").sugerido && e.opcoes.filter((o) => o.sugerido).length === 1,
     JSON.stringify(e.opcoes.map((o) => [o.id, o.sugerido])));
  ok("1: e ela vem primeiro", e.opcoes[0]?.id === "a7", e.opcoes[0]?.id);
  ok("1: com o selo Sugerido", por("a7").selo && /Sugerido/.test(por("a7").texto), por("a7").texto);
  ok("1: e o cursor já nela", por("a7").focado, JSON.stringify(e.opcoes.map((o) => [o.id, o.focado])));
  ok("1: a sugerida diz que a última mensagem foi nossa", /^Nossa última mensagem · /.test(por("a7").ultima), por("a7").ultima);
  ok("1: o SAC diz que o cliente respondeu", /^Cliente respondeu · /.test(por("a5").ultima), por("a5").ultima);
  ok("1: o aviso automático não vira sugestão nem última mensagem",
     !por("a13").sugerido && /^Já tem conversa/.test(por("a13").ultima), JSON.stringify(por("a13")));
  ok("1: depois da sugerida, o SAC (3 h) antes do Arquivo (só o aviso)",
     e.opcoes.findIndex((o) => o.id === "a5") < e.opcoes.findIndex((o) => o.id === "a13"), JSON.stringify(e.opcoes.map((o) => o.id)));
  ok("1: o cartão com conversa é verde (o fundo tingido)", /gradient/.test(por("a5").fundo) && /168, 132/.test(por("a5").fundo), por("a5").fundo);
  ok("1: e tem a faixa à esquerda", /inset/.test(por("a5").faixa) && /4px 0px 0px/.test(por("a5").faixa), por("a5").faixa);
  const semC = e.opcoes.find((o) => o.tem === "nao");
  ok("1: o sem conversa não é tingido e tem borda tracejada", semC && semC.fundo === "none" && semC.borda === "dashed", JSON.stringify(semC));
  ok("1: o sem conversa diz Conversa nova", semC && /Conversa nova/.test(semC.texto), semC?.texto);
  ok("1: o telefone aberto na barra diz aberto agora", e.opcoes.filter((o) => o.aberto).length === 1, JSON.stringify(e.opcoes.map((o) => [o.id, o.aberto])));
  ok("1: sem aviso de falha", !e.semSugestao, e.semSugestao);
  ok("1: a leitura das conversas do cliente pede a situação (ou *)",
     e.colunasDaLeitura.length > 0 && e.colunasDaLeitura.every((c) => c.trim() === "*" || /situacao/.test(c)), JSON.stringify(e.colunasDaLeitura));
  corDoEmAtendimento = por("a7").corSit;
  ok("1: o Acordos 1 diz que a conversa está em atendimento", por("a7").situacao === "aberto" && por("a7").seloSit === "Em Atendimento",
     JSON.stringify([por("a7").situacao, por("a7").seloSit]));
  ok("1: o SAC diz que está finalizada", por("a5").situacao === "finalizado" && por("a5").seloSit === "Finalizados",
     JSON.stringify([por("a5").situacao, por("a5").seloSit]));
  ok("1: o Arquivo diz Arquivada, e não Finalizados", por("a13").situacao === "arquivada" && por("a13").seloSit === "Arquivada",
     JSON.stringify([por("a13").situacao, por("a13").seloSit]));
  ok("1: o título explica aberta e finalizada",
     /em aberto/i.test(por("a7").tituloSit) && /finalizada/i.test(por("a5").tituloSit) && /arquivada/i.test(por("a13").tituloSit),
     JSON.stringify([por("a7").tituloSit, por("a5").tituloSit, por("a13").tituloSit]));
  ok("1: a aberta tem a cor da conversa (verde), e a finalizada é apagada (cinza)",
     !!por("a7").corSit && !!por("a5").corSit && por("a7").corSit !== por("a5").corSit, JSON.stringify([por("a7").corSit, por("a5").corSit]));
  ok("1: os sem conversa não têm selo de situação",
     e.opcoes.filter((o) => o.tem === "nao").length > 0 && e.opcoes.filter((o) => o.tem === "nao").every((o) => !o.situacao),
     JSON.stringify(e.opcoes.map((o) => [o.id, o.situacao])));

  // O Enter escolhe a sugerida.
  await page.keyboard.press("Enter").catch(() => {});
  await page.waitForTimeout(3500);
  const depois = await page.evaluate(() => ({
    janela: !!document.querySelector("[data-telefones-da-escolha]"),
    topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
    conversas: (globalThis.__TABELAS.conversas || []).filter((x) => x.contato_id === "ct-dest-1").length,
  }));
  ok("1: o Enter escolhe a sugerida e a janela fecha", !depois.janela, JSON.stringify(depois));
  ok("1: e a conversa abre, sem criar outra", depois.topo.includes("CLIENTE UM") && depois.conversas === 3, JSON.stringify(depois));
  ok("1: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 2. o cliente respondeu por último ----
// (corDoEmAtendimento vem da cena 1: o Novos tem de ter outra cor.)
{
  const { ctx, estouros, ler } = await abrir(C2);
  const e = await ler();
  const por = (id) => e.opcoes.find((o) => o.id === id) || {};
  ok("2: a sugerida é onde o cliente respondeu por último (SAC)", por("a5").sugerido && !por("a7").sugerido,
     JSON.stringify(e.opcoes.map((o) => [o.id, o.sugerido])));
  ok("2: e ela vem primeiro, com o cursor", e.opcoes[0]?.id === "a5" && por("a5").focado, JSON.stringify(e.opcoes.map((o) => [o.id, o.focado])));
  ok("2: o SAC diz Cliente respondeu", /^Cliente respondeu · /.test(por("a5").ultima), por("a5").ultima);
  ok("2: o Acordos 1 diz Nossa última mensagem", /^Nossa última mensagem · /.test(por("a7").ultima), por("a7").ultima);
  ok("2: o título fala de dois", /já conversam com este cliente · 2/i.test(e.titulos[0]?.texto || ""), JSON.stringify(e.titulos));
  ok("2: o SAC diz Novos (aberta, ninguém respondeu)", por("a5").situacao === "aguardando" && por("a5").seloSit === "Novos",
     JSON.stringify([por("a5").situacao, por("a5").seloSit]));
  ok("2: o Acordos 1 diz Finalizados", por("a7").situacao === "finalizado" && por("a7").seloSit === "Finalizados",
     JSON.stringify([por("a7").situacao, por("a7").seloSit]));
  ok("2: o Novos tem uma cor própria (âmbar), diferente da finalizada e da Em Atendimento",
     !!por("a5").corSit && por("a5").corSit !== por("a7").corSit && por("a5").corSit !== corDoEmAtendimento,
     JSON.stringify([por("a5").corSit, por("a7").corSit, corDoEmAtendimento]));
  ok("2: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 3. o cliente sem conversa nenhuma ----
{
  const { ctx, estouros, ler } = await abrir(C3);
  const e = await ler();
  ok("3: nenhum Sugerido", e.opcoes.length > 0 && e.opcoes.every((o) => !o.sugerido && !o.selo), JSON.stringify(e.opcoes.map((o) => o.id)));
  ok("3: nenhum no grupo com conversa", e.opcoes.every((o) => o.grupo === "sem-conversa"), JSON.stringify(e.opcoes.map((o) => o.grupo)));
  ok("3: o título diz que nenhum conversou ainda",
     e.titulos.length === 1 && /nenhum telefone conversou com este cliente ainda/i.test(e.titulos[0].texto), JSON.stringify(e.titulos));
  ok("3: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 4. a leitura das mensagens que falha ----
{
  const { ctx, estouros, ler } = await abrir(C1, { quebrar: true });
  const e = await ler();
  ok("4: a falha é dita na janela", /Não consegui conferir onde foi a última mensagem/.test(e.semSugestao), e.semSugestao);
  ok("4: e leva o código", /\(|código/i.test(e.semSugestao), e.semSugestao);
  ok("4: nenhum Sugerido chutado", e.opcoes.length > 0 && e.opcoes.every((o) => !o.sugerido), JSON.stringify(e.opcoes.map((o) => [o.id, o.sugerido])));
  ok("4: os telefones com conversa continuam destacados",
     e.opcoes.filter((o) => o.grupo === "com-conversa").length === 3, JSON.stringify(e.opcoes.map((o) => [o.id, o.grupo])));
  ok("4: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 5. no celular, a janela cabe ----
{
  const { ctx, estouros, ler } = await abrir(C1, { largura: 360 });
  const e = await ler();
  ok("5: a 360, a janela abre", e.opcoes.length > 0, String(e.opcoes.length));
  ok("5: e a tela não rola de lado", e.largura <= e.janela, `${e.largura} > ${e.janela}`);
  ok("5: o selo continua na sugerida", e.opcoes[0]?.selo === true, JSON.stringify(e.opcoes[0]));
  ok("5: e o selo da situação também", e.opcoes[0]?.seloSit === "Em Atendimento", JSON.stringify(e.opcoes[0]));
  ok("5: o selo e a última mensagem cabem inteiros no cartão",
     e.opcoes.filter((o) => o.tem === "sim").length === 3 && e.opcoes.filter((o) => o.tem === "sim").every((o) => o.dentro),
     JSON.stringify(e.opcoes.map((o) => [o.id, o.dentro])));
  ok("5: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 6. o banco sem o 028: sem selo de situação, e a janela como antes ----
{
  const { ctx, estouros, ler } = await abrir(C1, { sem028: true });
  const e = await ler();
  ok("6: a janela abre com os três com conversa",
     e.opcoes.filter((o) => o.grupo === "com-conversa").length === 3, JSON.stringify(e.opcoes.map((o) => [o.id, o.grupo])));
  // A arquivada continua dizendo Arquivada: a pasta existe sem o 028.
  ok("6: nenhum selo de aba nas não arquivadas", e.opcoes.filter((o) => o.id !== "a13").length > 0
       && e.opcoes.filter((o) => o.id !== "a13").every((o) => !o.situacao), JSON.stringify(e.opcoes.map((o) => [o.id, o.situacao])));
  ok("6: e a arquivada continua dizendo Arquivada", e.opcoes.find((o) => o.id === "a13")?.seloSit === "Arquivada",
     JSON.stringify(e.opcoes.find((o) => o.id === "a13")));
  ok("6: a sugestão continua", e.opcoes[0]?.id === "a7" && e.opcoes[0]?.sugerido, JSON.stringify(e.opcoes[0]));
  ok("6: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
if (falhas) process.exit(1);
