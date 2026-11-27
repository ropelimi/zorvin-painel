// AS CONVERSAS DO QUAZAR (25/11).
//
// Pedido do Rodrigo: *"Tem alguma forma de eu ver todas as mensagens que o
// Quazar conversou com o cliente que estava aguardando há mais de 7 dias? Cria
// uma tela só para isso, e também cria ele como pessoa que participou da
// conversa ou como responsável pelo atendimento, algo do tipo."*
//
// O que esta prova guarda:
//   1. o menu ⋮ do topo oferece a tela, numa guia nova (`?tela=quazar`);
//   2. a tela lista as conversas em que o Quazar escreveu, e a ESPERA de cada
//      uma conta da primeira mensagem do cliente depois da última mensagem de
//      GENTE da equipe (o aviso automático do Vantoro não para a espera) até a
//      primeira do Quazar, em dias de calendário de São Paulo;
//   3. o padrão é "7 dias ou mais", e cada escolha diz quantas;
//   4. abrir uma linha mostra as mensagens, e o link abre a conversa noutra
//      guia, com `noopener`;
//   5. os três estados: o banco sem a marca, a leitura que falha (com o
//      código, e "Tentar de novo") e nenhuma conversa;
//   6. o filtro "Quem participou da conversa" oferece o Quazar, e ele recorta
//      a lista;
//   7. o Quazar aparece entre quem participou da conversa, com o rosto dele, e
//      a frase conta as pessoas à parte;
//   8. no celular, nada rola de lado.
//
// O Quazar NÃO vira responsável, e é decisão (ver o CLAUDE.md): o
// responsável é uma pessoa da equipe (`responsavel_id` aponta para
// `usuarios`), e o aviso de mensagem nova vai só para ele.
import { abrirNavegador, ENDERECO, guiaQueAbre } from "./navegador.mjs";
import { resumoDaConversa, passaNaEspera, ehDaEquipe } from "../src/conversasDoQuazar.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
// Ao meio-dia de Brasília (15h no horário universal).
const AGORA_D = new Date("2026-11-25T15:00:00Z");
const AGORA = AGORA_D.getTime();
const min = (n) => new Date(AGORA - n * 60000).toISOString();
const dias = (n) => new Date(AGORA - n * 86400000).toISOString();

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.count().then((n) => (n ? loc.first().innerText().catch(() => "") : ""));
const attr = (loc, a) => loc.count().then((n) => (n ? loc.first().getAttribute(a).catch(() => null) : null));
const esperar = (page, sel, prazo = 8000) => page.waitForSelector(sel, { timeout: prazo }).then(() => true).catch(() => false);

// ------------------------------------------------------------------
// A SEMENTE. O telefone que o painel abre na bancada é o "Acordos 1" (a7), e
// "SAC" (a5) é outro; quem entra é o Rodrigo (u1). Os clientes são inventados.
const ADV = "a7", OUTRO = "a5";
const contato = (id, nome, numero) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
                                         vantoro_cliente_id: null, foto_url: null });
const C9 = contato("ct-qz-9", "Cliente Nove Dias", "5511944440091");
const C3 = contato("ct-qz-3", "Cliente Tres Dias", "5511944440092");
const C0 = contato("ct-qz-0", "Cliente Da Noite", "5511944440093");
const CO = contato("ct-qz-o", "Cliente Do Sac", "5511944440094");
const conversa = (id, adv, ct, extra) => ({
  id, advogado_id: adv, contato_id: ct.id, contato: ct, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  esperando_desde: null, tratada_em: null, frente: null, digitando_ate: null, vantoro_nome: null,
  responsavel_id: null, responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null, ...extra,
});
const msg = (id, conv, quando, origem, textoDela, extra = {}) => ({
  id, conversa_id: conv, origem, tipo: "texto", texto: textoDela, id_uazapi: `uz-${id}`, criado_em: quando,
  automatica: false, pelo_quazar: false, enviado_por: null, enviado_por_id: null, status: origem === "advogado" ? "enviada" : null, ...extra,
});
const daEquipe = (id, conv, quando, t, quem = "u1", nome = "Rodrigo Sousa") =>
  msg(id, conv, quando, "advogado", t, { enviado_por_id: quem, enviado_por: nome });
const doQuazar = (id, conv, quando, t) =>
  msg(id, conv, quando, "advogado", t, { automatica: true, pelo_quazar: true, enviado_por: "Quazar" });
const doCliente = (id, conv, quando, t) => msg(id, conv, quando, "contato", t);

const MENSAGENS = [
  // A — esperava há 9 dias. A equipe respondeu há 12, o cliente escreveu há 9
  // e há 8; no meio, o aviso automático do Vantoro (não para a espera). O
  // Quazar respondeu hoje às 10h de Brasília, e o cliente agradeceu.
  daEquipe("q9-1", "cv-qz-9", dias(12), "Vou conferir o seu processo."),
  doCliente("q9-2", "cv-qz-9", dias(9), "Alguma novidade do meu processo?"),
  msg("q9-3", "cv-qz-9", dias(8.5), "advogado", "Lembrete: sua audiência é dia 30.", { automatica: true }),
  doCliente("q9-4", "cv-qz-9", dias(8), "Estou aguardando, por favor."),
  doQuazar("q9-5", "cv-qz-9", min(120), "Boa tarde! Sou o Quazar, assistente virtual do escritório. Peço desculpas pela demora."),
  doCliente("q9-6", "cv-qz-9", min(60), "Obrigado pelo retorno!"),
  // B — esperava há 3 dias, sem ninguém da equipe antes; depois a Jenifer
  // entrou na conversa, e o cliente não respondeu ao Quazar.
  doCliente("q3-1", "cv-qz-3", dias(3), "Bom dia, preciso de ajuda."),
  doQuazar("q3-2", "cv-qz-3", min(180), "Bom dia! Sou o Quazar. A equipe vai verificar e retornar."),
  daEquipe("q3-3", "cv-qz-3", min(90), "Olá, aqui é a Jenifer.", "u-jenifer", "JENIFER ALMEIDA"),
  // C — à noite, no mesmo dia, e um episódio antigo também do mesmo dia.
  daEquipe("q0-1", "cv-qz-0", dias(20), "Recebemos os documentos."),
  doCliente("q0-2", "cv-qz-0", dias(15), "Mandei mais um documento."),
  doQuazar("q0-3", "cv-qz-0", new Date(AGORA - 15 * 86400000 + 60000).toISOString(), "Recebido, obrigado!"),
  daEquipe("q0-4", "cv-qz-0", dias(14), "Conferimos, está tudo certo."),
  doCliente("q0-5", "cv-qz-0", "2026-11-25T04:00:00Z", "Boa noite, tenho uma dúvida."),
  doQuazar("q0-6", "cv-qz-0", "2026-11-25T04:01:00Z", "Boa noite! Sou o Quazar, a equipe volta amanhã às 8h."),
  // D — no SAC, esperava há 5 dias; finalizada, comigo.
  doCliente("qo-1", "cv-qz-o", dias(5), "Qual o andamento?"),
  doQuazar("qo-2", "cv-qz-o", min(30), "Olá! Sou o Quazar. O seu processo está em andamento."),
];
const SEMENTE = {
  contatos: [C9, C3, C0, CO],
  conversas: [
    conversa("cv-qz-9", ADV, C9, { ultima_atividade: min(60), ultima_mensagem: "Obrigado pelo retorno!", esperando_desde: dias(9),
                                   responsavel_id: "u-jenifer", responsavel_em: dias(10), responsavel_por: "u1" }),
    conversa("cv-qz-3", ADV, C3, { ultima_atividade: min(90), ultima_mensagem: "Olá, aqui é a Jenifer." }),
    conversa("cv-qz-0", ADV, C0, { ultima_atividade: "2026-11-25T04:01:00Z", ultima_mensagem: "Boa noite! Sou o Quazar",
                                   situacao: "aguardando", esperando_desde: "2026-11-25T04:00:00Z" }),
    conversa("cv-qz-o", OUTRO, CO, { ultima_atividade: min(30), ultima_mensagem: "Olá! Sou o Quazar.", situacao: "finalizado",
                                     responsavel_id: "u1", responsavel_em: dias(6), responsavel_por: "u1" }),
  ],
  mensagens: MENSAGENS,
};

/** Abre um contexto com a semente e as bandeiras em TODAS as guias (a guia
 *  nova que um link abre nasce da mesma semente). */
async function contexto({ semente = SEMENTE, largura = 1400, altura = 900, flags = {}, celular = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo",
                                     ...(celular ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}) });
  await ctx.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    for (const [k, v] of Object.entries(b.flags)) globalThis[k] = v;
  }, { semente, flags });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.clock.setFixedTime(AGORA_D);
  return { ctx, page, estouros };
}

const FIM_DA_LEITURA = "[data-filtros-do-quazar], [data-quazar-vazio], [data-quazar-sem-coluna], [data-falha-do-quazar]";
async function abrirATelaDoQuazar(opcoes = {}) {
  const r = await contexto(opcoes);
  await r.page.goto(`${ENDERECO}?tela=quazar`);
  r.abriu = await esperar(r.page, '[data-tela="quazar"]', 20000);
  r.leu = await esperar(r.page, FIM_DA_LEITURA, 15000);
  // A equipe (os nomes dos responsáveis) chega numa leitura à parte.
  await r.page.waitForTimeout(700);
  return r;
}
const linhasNaTela = (page) => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-do-quazar]")].map((e) => e.getAttribute("data-conversa-do-quazar")));
async function campo(page, conv, nome) {
  return texto(page.locator(`[data-conversa-do-quazar="${conv}"] [data-${nome}]`));
}

// ==================================================================
console.log("\n0. A conta, direto na função");
{
  const H = (n) => new Date(AGORA - n * 3600000).toISOString();
  const m = (id, quando, de) => ({ id, criado_em: quando, origem: de === "cliente" ? "contato" : "advogado",
                                    automatica: de === "quazar" || de === "aviso", pelo_quazar: de === "quazar" });
  // Dois momentos do Quazar: o ANTIGO depois de 8 dias de espera, e o RECENTE
  // no mesmo dia. A linha é a da maior espera, e não a do mais recente nem a
  // do primeiro que aparece.
  const doisMomentos = [
    m("e1", H(24 * 30), "equipe"), m("c1", H(24 * 20), "cliente"), m("q1", H(24 * 12), "quazar"),
    m("e2", H(24 * 11), "equipe"), m("c2", H(5), "cliente"), m("q2", H(4), "quazar"),
  ];
  const r = resumoDaConversa(doisMomentos);
  ok("dois momentos, contados", r && r.episodios.length === 2 && r.quantasDoQuazar === 2, q(r && r.episodios.map((e) => e.dias)));
  ok("a linha é a da maior espera (8 dias), e não a do mais recente", r && r.principal.dias === 8, q(r && r.principal));
  // Agora o antigo é o MENOR: a linha continua sendo a da maior (a recente).
  const invertido = [
    m("e1", H(24 * 30), "equipe"), m("c1", H(24 * 29), "cliente"), m("q1", H(24 * 29 - 1), "quazar"),
    m("e2", H(24 * 28), "equipe"), m("c2", H(24 * 6), "cliente"), m("q2", H(4), "quazar"),
  ];
  const r2 = resumoDaConversa(invertido);
  ok("com o antigo menor, a linha é a recente (6 dias), e não a primeira", r2 && r2.principal.dias === 6, q(r2 && r2.principal));
  ok("e passa no \"2 dias ou mais\", não no de 7", r2 && passaNaEspera(r2, "2") && !passaNaEspera(r2, "7"));
  // O aviso automático e o próprio Quazar não são gente da equipe.
  ok("o aviso automático não é gente da equipe", !ehDaEquipe(m("a", H(1), "aviso")));
  ok("o Quazar não é gente da equipe", !ehDaEquipe(m("b", H(1), "quazar")));
  ok("a mensagem de gente é", ehDaEquipe(m("c", H(1), "equipe")));
  ok("sem mensagem do Quazar, nada", resumoDaConversa([m("x", H(3), "cliente"), m("y", H(2), "equipe")]) === null);
}

// ==================================================================
console.log("\n1. O menu ⋮ do topo oferece a tela, numa guia nova");
{
  const { ctx, page, estouros } = await contexto();
  await page.goto(ENDERECO);
  await esperar(page, "[data-conversa-nome]", 20000);
  await page.waitForTimeout(900);
  await clicar(page.getByRole("button", { name: "Menu" }));
  await page.waitForTimeout(400);
  const item = page.locator("[data-abrir-quazar]");
  ok("o menu tem o item", (await item.count()) === 1);
  ok("o item diz \"Conversas do Quazar\"", /Conversas do Quazar/.test(await texto(item)), q(await texto(item)));
  ok("com o rosto do Quazar", (await item.locator("[data-rosto-do-assistente]").count()) === 1);
  const href = (await attr(item, "href")) || "";
  ok("é um link para ?tela=quazar", /[?&]tela=quazar\b/.test(href), href);
  ok("abre numa guia nova, com noopener",
     (await attr(item, "target")) === "_blank" && /noopener/.test((await attr(item, "rel")) || ""),
     q([await attr(item, "target"), await attr(item, "rel")]));
  const nova = (await item.count()) ? await guiaQueAbre(ctx, () => item.first().click({ timeout: 3000 }).catch(() => {})) : null;
  ok("o clique abriu outra guia", Boolean(nova));
  if (nova) {
    const apareceu = await esperar(nova, '[data-tela="quazar"]', 20000);
    ok("a guia nova é a tela das conversas do Quazar", apareceu);
    await esperar(nova, FIM_DA_LEITURA, 15000);
    ok("com o título da tela", /Conversas do Quazar · Ropelimi Zorvin/.test(await nova.title()), q(await nova.title()));
    ok("e a lista já lida (o padrão: 7 dias ou mais)", (await linhasNaTela(nova)).join(",") === "cv-qz-9", q(await linhasNaTela(nova)));
  } else {
    ok("a guia nova é a tela das conversas do Quazar", false, "nenhuma guia abriu");
    ok("com o título da tela", false, "nenhuma guia abriu");
    ok("e a lista já lida (o padrão: 7 dias ou mais)", false, "nenhuma guia abriu");
  }
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n2. A tela: a espera, as escolhas e cada linha");
{
  const { ctx, page, estouros, abriu, leu } = await abrirATelaDoQuazar();
  ok("a tela abriu e leu", abriu && leu);
  const chips = await page.evaluate(() => [...document.querySelectorAll("[data-filtro-quazar]")].map((b) => ({
    id: b.getAttribute("data-filtro-quazar"), n: b.getAttribute("data-contagem"), ativo: b.getAttribute("aria-pressed"),
    texto: b.innerText.replace(/\s+/g, " ").trim() })));
  ok("três escolhas, nesta ordem", chips.map((c) => c.id).join(",") === "7,2,todas", q(chips));
  ok("os nomes das escolhas",
     chips.length === 3 && /Esperavam há 7 dias ou mais/.test(chips[0].texto) && /2 dias ou mais/.test(chips[1].texto) && /Todas/.test(chips[2].texto),
     q(chips.map((c) => c.texto)));
  ok("cada uma diz quantas: 1, 3 e 4", chips.map((c) => c.n).join(",") === "1,3,4", q(chips.map((c) => c.n)));
  ok("o padrão é \"7 dias ou mais\"", chips.length === 3 && chips[0].ativo === "true" && chips[1].ativo === "false" && chips[2].ativo === "false",
     q(chips.map((c) => c.ativo)));
  ok("no padrão, só a conversa de quem esperava 9 dias", (await linhasNaTela(page)).join(",") === "cv-qz-9", q(await linhasNaTela(page)));

  const l9 = page.locator('[data-conversa-do-quazar="cv-qz-9"]');
  ok("a linha diz a espera em dias (9)", (await attr(l9, "data-espera-dias")) === "9", q(await attr(l9, "data-espera-dias")));
  ok("o nome do cliente", (await campo(page, "cv-qz-9", "cliente-do-quazar")) === "Cliente Nove Dias", q(await campo(page, "cv-qz-9", "cliente-do-quazar")));
  ok("o telefone da conversa", (await campo(page, "cv-qz-9", "telefone-do-quazar")) === "Acordos 1", q(await campo(page, "cv-qz-9", "telefone-do-quazar")));
  const frase9 = await campo(page, "cv-qz-9", "frase-da-espera");
  ok("a frase: esperava há 9 dias quando o Quazar respondeu, na hora de Brasília",
     frase9 === "O cliente esperava há 9 dias quando o Quazar respondeu (25/11 às 10:00)", q(frase9));
  const peso = await page.evaluate(() => {
    const el = document.querySelector('[data-conversa-do-quazar="cv-qz-9"] [data-frase-da-espera]');
    return el ? getComputedStyle(el).fontWeight : null;
  });
  ok("a espera de 7 dias ou mais vem em negrito", Number(peso) >= 600, q(peso));
  ok("quantas mensagens o Quazar mandou", /^1 mensagem do Quazar$/.test(await campo(page, "cv-qz-9", "quantas-do-quazar")),
     q(await campo(page, "cv-qz-9", "quantas-do-quazar")));
  ok("o cliente respondeu depois", (await attr(l9.locator("[data-cliente-respondeu]"), "data-cliente-respondeu")) === "sim");
  ok("a aba da conversa", /Em Atendimento/.test(await campo(page, "cv-qz-9", "aba-do-quazar")), q(await campo(page, "cv-qz-9", "aba-do-quazar")));
  const resp9 = await campo(page, "cv-qz-9", "responsavel-do-quazar");
  ok("o responsável, com a data", /com JENIFER ALMEIDA desde 15\/11/.test(resp9), q(resp9));
  ok("a equipe não entrou depois (não diz)", (await l9.locator("[data-equipe-entrou]").count()) === 0);

  // A conversa da linha, aberta ali mesmo.
  await clicar(page.locator('[data-ver-conversa-do-quazar="cv-qz-9"]'));
  await esperar(page, '[data-mensagens-do-quazar="cv-qz-9"] [data-mensagem-da-conversa-do-quazar]', 6000);
  const msgs = await page.evaluate(() => [...document.querySelectorAll('[data-mensagens-do-quazar="cv-qz-9"] [data-mensagem-da-conversa-do-quazar]')]
    .map((e) => ({ de: e.getAttribute("data-mensagem-da-conversa-do-quazar"), t: e.innerText.replace(/\s+/g, " ").trim(),
                   rosto: e.querySelectorAll("[data-rosto-do-assistente]").length })));
  ok("abrir mostra a espera e a conversa com o Quazar, na ordem",
     msgs.map((m) => m.de).join(",") === "cliente,cliente,quazar,cliente", q(msgs.map((m) => m.de)));
  ok("com os textos de verdade",
     msgs.length === 4 && /Alguma novidade/.test(msgs[0].t) && /Estou aguardando/.test(msgs[1].t)
       && /Sou o Quazar/.test(msgs[2].t) && /Obrigado pelo retorno/.test(msgs[3].t), q(msgs.map((m) => m.t)));
  ok("o aviso automático do Vantoro não entra como espera nem como conversa", !msgs.some((m) => /Lembrete/.test(m.t)), q(msgs.map((m) => m.t)));
  ok("a mensagem do Quazar diz que é ele, com o rosto",
     msgs.length === 4 && /Quazar · assistente virtual/.test(msgs[2].t) && msgs[2].rosto === 1, q(msgs[2]));
  ok("na hora de Brasília", msgs.length === 4 && /25\/11 às 10:00/.test(msgs[2].t), q(msgs[2] && msgs[2].t));
  ok("o botão diz que esconde, e diz que está aberto",
     /Esconder/.test(await texto(page.locator('[data-ver-conversa-do-quazar="cv-qz-9"]')))
       && (await attr(page.locator('[data-ver-conversa-do-quazar="cv-qz-9"]'), "aria-expanded")) === "true");
  await clicar(page.locator('[data-ver-conversa-do-quazar="cv-qz-9"]'));
  await page.waitForTimeout(250);
  ok("clicar de novo esconde", (await page.locator('[data-mensagens-do-quazar="cv-qz-9"]').count()) === 0);

  // O link da conversa.
  const link = page.locator('[data-abrir-conversa-do-quazar="cv-qz-9"]');
  const href = (await attr(link, "href")) || "";
  ok("o link abre a conversa pelo endereço dela, no telefone dela", /[?&]conversa=cv-qz-9\b/.test(href) && /[?&]linha=a7\b/.test(href), href);
  ok("numa guia nova, com noopener", (await attr(link, "target")) === "_blank" && /noopener/.test((await attr(link, "rel")) || ""));
  const guia = (await link.count()) ? await guiaQueAbre(ctx, () => link.first().click({ timeout: 3000 }).catch(() => {})) : null;
  const abriuConversa = guia ? await esperar(guia, '[data-msg-id="q9-5"]', 20000) : false;
  ok("e a guia nova abre já na conversa, com a mensagem do Quazar", abriuConversa);
  if (guia) await guia.close().catch(() => {});

  // "2 dias ou mais".
  await clicar(page.locator('[data-filtro-quazar="2"]'));
  await page.waitForTimeout(250);
  ok("\"2 dias ou mais\" traz três, a do Quazar mais recente primeiro",
     (await linhasNaTela(page)).join(",") === "cv-qz-o,cv-qz-9,cv-qz-3", q(await linhasNaTela(page)));
  ok("e fica escolhida", (await attr(page.locator('[data-filtro-quazar="2"]'), "aria-pressed")) === "true");
  ok("a de 3 dias: a frase", (await campo(page, "cv-qz-3", "frase-da-espera")) === "O cliente esperava há 3 dias quando o Quazar respondeu (25/11 às 09:00)",
     q(await campo(page, "cv-qz-3", "frase-da-espera")));
  ok("o cliente ainda não respondeu", (await attr(page.locator('[data-conversa-do-quazar="cv-qz-3"] [data-cliente-respondeu]'), "data-cliente-respondeu")) === "nao");
  ok("a equipe entrou depois, e diz quando", /a equipe entrou em 25\/11 às 10:30/.test(await campo(page, "cv-qz-3", "equipe-entrou")),
     q(await campo(page, "cv-qz-3", "equipe-entrou")));
  ok("sem responsável", /sem responsável/.test(await campo(page, "cv-qz-3", "responsavel-do-quazar")), q(await campo(page, "cv-qz-3", "responsavel-do-quazar")));
  ok("a do SAC: o telefone, a aba e \"com você\"",
     (await campo(page, "cv-qz-o", "telefone-do-quazar")) === "SAC" && /Finalizados/.test(await campo(page, "cv-qz-o", "aba-do-quazar"))
       && /com você desde 19\/11/.test(await campo(page, "cv-qz-o", "responsavel-do-quazar")),
     q([await campo(page, "cv-qz-o", "telefone-do-quazar"), await campo(page, "cv-qz-o", "aba-do-quazar"), await campo(page, "cv-qz-o", "responsavel-do-quazar")]));

  // "Todas".
  await clicar(page.locator('[data-filtro-quazar="todas"]'));
  await page.waitForTimeout(250);
  ok("\"Todas\" traz as quatro", (await linhasNaTela(page)).join(",") === "cv-qz-o,cv-qz-9,cv-qz-3,cv-qz-0", q(await linhasNaTela(page)));
  ok("a da noite: o cliente tinha escrito no mesmo dia",
     (await campo(page, "cv-qz-0", "frase-da-espera")) === "O cliente tinha escrito no mesmo dia quando o Quazar respondeu (25/11 às 01:01)",
     q(await campo(page, "cv-qz-0", "frase-da-espera")));
  ok("conta as mensagens do Quazar dos dois momentos", /^2 mensagens do Quazar$/.test(await campo(page, "cv-qz-0", "quantas-do-quazar")),
     q(await campo(page, "cv-qz-0", "quantas-do-quazar")));
  ok("e a aba Novos", /Novos/.test(await campo(page, "cv-qz-0", "aba-do-quazar")), q(await campo(page, "cv-qz-0", "aba-do-quazar")));
  await clicar(page.locator('[data-ver-conversa-do-quazar="cv-qz-0"]'));
  await esperar(page, '[data-mensagens-do-quazar="cv-qz-0"] [data-mensagem-da-conversa-do-quazar]', 6000);
  const noite = await texto(page.locator('[data-mensagens-do-quazar="cv-qz-0"]'));
  ok("aberta, ela mostra o momento mais recente e diz que houve outro",
     /tenho uma dúvida/.test(noite) && /volta amanhã/.test(noite) && !/Mandei mais um documento/.test(noite)
       && /também escreveu nesta conversa em outro momento/.test(noite), q(noite));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n3. O banco sem a marca do Quazar (o script 059 da ponte)");
{
  const { ctx, page, estouros, abriu } = await abrirATelaDoQuazar({ flags: { __SEM_COLUNAS: { mensagens: ["pelo_quazar"] } } });
  ok("a tela abriu", abriu);
  const t = await texto(page.locator("[data-quazar-sem-coluna]"));
  ok("diz que falta a atualização do banco", /falta a atualização do banco/.test(t) && /059/.test(t), q(t));
  ok("e não chama isso de falha", (await page.locator("[data-falha-do-quazar]").count()) === 0);
  ok("nem desenha escolhas nem linhas",
     (await page.locator("[data-filtros-do-quazar]").count()) === 0 && (await linhasNaTela(page)).length === 0);
  ok("nem diz que não há conversa", (await page.locator("[data-quazar-vazio]").count()) === 0);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n4. A leitura que falha é dita, com o código, e se tenta de novo");
{
  const { ctx, page, estouros, abriu } = await abrirATelaDoQuazar({ flags: { __RECUSAR_LEITURA: ["mensagens"] } });
  ok("a tela abriu", abriu);
  const t = await texto(page.locator("[data-falha-do-quazar]"));
  ok("diz que não conseguiu ler, com o código", /Não consegui ler/.test(t) && /PGRST301/.test(t), q(t));
  ok("e não vira \"nenhuma conversa\"", (await page.locator("[data-quazar-vazio]").count()) === 0);
  ok("nem \"falta a atualização\"", (await page.locator("[data-quazar-sem-coluna]").count()) === 0);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = []; });
  await clicar(page.locator("[data-tentar-de-novo-quazar]"));
  await esperar(page, "[data-filtros-do-quazar]", 8000);
  ok("\"Tentar de novo\" lê de novo, e a lista aparece", (await linhasNaTela(page)).join(",") === "cv-qz-9", q(await linhasNaTela(page)));
  ok("e a falha sai", (await page.locator("[data-falha-do-quazar]").count()) === 0);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n5. Nenhuma conversa do Quazar");
{
  const { ctx, page, estouros, abriu } = await abrirATelaDoQuazar({ semente: null });
  ok("a tela abriu", abriu);
  const t = await texto(page.locator("[data-quazar-vazio]"));
  ok("diz que o Quazar ainda não conversou com ninguém", /ainda não conversou com nenhum cliente/.test(t), q(t));
  ok("sem escolhas nem linhas", (await page.locator("[data-filtros-do-quazar]").count()) === 0 && (await linhasNaTela(page)).length === 0);
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ==================================================================
console.log("\n6. \"Quem participou da conversa\" oferece o Quazar, e recorta a lista");
async function abrirOPainel(opcoes = {}) {
  const r = await contexto({ largura: 1600, ...opcoes });
  await r.page.goto(ENDERECO);
  await esperar(r.page, "[data-conversa-nome]", 20000);
  await r.page.waitForTimeout(1200);
  return r;
}
async function abrirMenuDeQuem(page) {
  if (!(await page.locator("[data-menu-quem]").count())) {
    await clicar(page.locator('[data-grupo="quem"]'));
    await page.waitForTimeout(500);
  }
  return (await page.locator("[data-menu-quem]").count()) > 0;
}
const idsDaLista = (page) => page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-id]")].map((e) => e.getAttribute("data-conversa-id")));
{
  const { ctx, page, estouros } = await abrirOPainel();
  const antes = await idsDaLista(page);
  ok("a lista tem as conversas do Quazar e as outras do telefone",
     antes.includes("cv-qz-9") && antes.includes("cv-qz-3") && antes.some((id) => !/^cv-qz-/.test(id)), q(antes));
  ok("o menu de quem participou abre", await abrirMenuDeQuem(page));
  const op = page.locator("[data-participou-quazar]");
  ok("ele oferece o Quazar", (await op.count()) === 1);
  ok("desmarcado", (await attr(op, "data-participou-quazar")) === "desmarcado");
  ok("com o nome, o rosto e \"assistente virtual\"",
     /Quazar/.test(await texto(op)) && /assistente virtual/.test(await texto(op)) && (await op.locator("[data-rosto-do-assistente]").count()) === 1,
     q(await texto(op)));
  // A QUANTIDADE (27/11): as conversas em que ele escreveu, só deste telefone
  // (a do SAC fica de fora), como o número ao lado de cada pessoa.
  await page.waitForFunction(() => document.querySelector("[data-conversas-do-quazar]"), null, { timeout: 8000 }).catch(() => {});
  const qtd = await texto(page.locator("[data-conversas-do-quazar]"));
  ok("mostra quantas conversas o Quazar tem neste telefone (3, sem a do SAC)", qtd.trim() === "3", q(qtd));
  const antesDasPessoas = await page.evaluate(() => {
    const o = document.querySelector("[data-menu-quem] [data-participou-quazar]");
    const p = document.querySelector("[data-menu-quem] [data-quem]");
    return !!o && !!p && Boolean(o.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  ok("antes das pessoas", antesDasPessoas);
  await clicar(op);
  await page.waitForTimeout(1500);
  ok("marcado", (await attr(page.locator("[data-participou-quazar]"), "data-participou-quazar")) === "marcado");
  const depois = await idsDaLista(page);
  ok("a lista fica só com as conversas em que o Quazar escreveu (nesta aba)",
     depois.length === 2 && depois.includes("cv-qz-9") && depois.includes("cv-qz-3"), q(depois));
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  const rastro = await texto(page.locator("[data-filtro-quem]"));
  ok("o rastro na fita diz o Quazar", /Quazar/.test(rastro), q(rastro));
  // "TODOS JUNTOS": o Quazar E a Jenifer na mesma conversa — só a de 3 dias.
  await abrirMenuDeQuem(page);
  await clicar(page.locator("[data-menu-quem]").getByRole("button", { name: "Todos juntos" }));
  await clicar(page.locator('[data-menu-quem] [data-quem="JENIFER ALMEIDA"]'));
  await page.waitForTimeout(1500);
  const juntos = await idsDaLista(page);
  ok("\"Todos juntos\" com a Jenifer: só a conversa em que os dois escreveram", juntos.length === 1 && juntos[0] === "cv-qz-3", q(juntos));
  await clicar(page.locator("[data-menu-quem]").getByRole("button", { name: "Qualquer um" }));
  await page.waitForTimeout(1500);
  const qualquer = await idsDaLista(page);
  ok("\"Qualquer um\" soma as do Quazar e as da Jenifer",
     qualquer.includes("cv-qz-9") && qualquer.includes("cv-qz-3") && qualquer.length >= 2, q(qualquer));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  const { ctx, page } = await abrirOPainel({ flags: { __SEM_COLUNAS: { mensagens: ["pelo_quazar"] } } });
  await abrirMenuDeQuem(page);
  await clicar(page.locator("[data-participou-quazar]"));
  await page.waitForTimeout(1500);
  const aviso = await texto(page.locator("[data-aviso]"));
  ok("num banco sem a marca, marcar o Quazar diz que o filtro não está disponível", /não marca as mensagens do Quazar/.test(aviso), q(aviso));
  await abrirMenuDeQuem(page);
  ok("e a opção sai do menu", (await page.locator("[data-participou-quazar]").count()) === 0);
  ok("a lista não fica vazia por causa disso", (await idsDaLista(page)).length > 2, q((await idsDaLista(page)).length));
  await ctx.close();
}
{
  const { ctx, page } = await abrirOPainel({ flags: { __QUEBRAR: ["mensagens"] } });
  await abrirMenuDeQuem(page);
  await page.waitForTimeout(1200);
  const qtdFalha = await texto(page.locator("[data-conversas-do-quazar]"));
  ok("a contagem que falha diz \"?\", e não zero", qtdFalha.trim() === "?", q(qtdFalha));
  await clicar(page.locator("[data-participou-quazar]"));
  await page.waitForTimeout(1500);
  const faixa = await texto(page.locator("[data-falha-de-leitura]"));
  ok("a leitura que falha acende a faixa âmbar, com as conversas do Quazar", /conversas do Quazar/.test(faixa), q(faixa));
  await ctx.close();
}

// ==================================================================
console.log("\n7. O Quazar entre quem participou da conversa");
{
  const { ctx, page, estouros } = await abrirOPainel();
  await clicar(page.locator('[data-conversa-id="cv-qz-9"]'));
  await esperar(page, '[data-msg-id="q9-5"]', 8000);
  await page.waitForTimeout(500);
  const botao = page.locator("[data-quem-participou]");
  ok("o grupinho de quem participou está no cabeçalho", (await botao.count()) === 1);
  ok("ele conta duas: a pessoa e o Quazar (o aviso automático não conta)",
     /\(2\)/.test((await attr(botao, "aria-label")) || ""), q(await attr(botao, "aria-label")));
  const rosto = page.locator('[data-rosto-participante-quazar="sim"]');
  ok("o rosto do Quazar está no grupinho", (await rosto.count()) === 1 && (await rosto.locator("[data-rosto-do-assistente]").count()) === 1);
  ok("com o title de assistente virtual", /Quazar · assistente virtual/.test((await attr(rosto, "title")) || ""), q(await attr(rosto, "title")));
  await clicar(botao);
  await page.waitForTimeout(400);
  const lista = await page.evaluate(() => [...document.querySelectorAll("[data-participante]")].map((e) => ({
    nome: e.getAttribute("data-participante"), quazar: e.getAttribute("data-participante-quazar"),
    rosto: e.querySelectorAll("[data-rosto-do-assistente]").length })));
  ok("a lista tem o Rodrigo e o Quazar",
     lista.length === 2 && lista.some((p) => p.nome === "Rodrigo Sousa") && lista.some((p) => p.quazar === "sim"), q(lista));
  const oQuazar = lista.find((p) => p.quazar === "sim");
  ok("o Quazar com o nome e o rosto dele", !!oQuazar && oQuazar.nome === "Quazar · assistente virtual" && oQuazar.rosto === 1, q(oQuazar));
  const frase = await page.evaluate(() => {
    const el = document.querySelector("[data-participante]");
    return el ? el.parentElement.innerText : "";
  });
  ok("a frase conta as pessoas à parte do Quazar", /1 pessoa do escritório e o Quazar escreveram aqui/.test(frase), q(frase));
  ok("o Quazar não vira responsável (o seletor do alto continua sem ele)",
     !/Quazar/.test(await page.evaluate(() => document.querySelector("[data-seletor-de-responsaveis]")?.innerText || "")));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}
{
  // Só o Quazar escreveu na conversa (a B sem a Jenifer).
  const semAJenifer = { ...SEMENTE, mensagens: MENSAGENS.filter((m) => m.id !== "q3-3") };
  const { ctx, page } = await abrirOPainel({ semente: semAJenifer });
  await clicar(page.locator('[data-conversa-id="cv-qz-3"]'));
  await esperar(page, '[data-msg-id="q3-2"]', 8000);
  await page.waitForTimeout(500);
  await clicar(page.locator("[data-quem-participou]"));
  await page.waitForTimeout(400);
  const frase = await page.evaluate(() => {
    const el = document.querySelector("[data-participante]");
    return el ? el.parentElement.innerText : "";
  });
  ok("só o Quazar: a frase diz isso", /Só o Quazar, o assistente virtual, escreveu aqui/.test(frase), q(frase));
  await ctx.close();
}

// ==================================================================
console.log("\n8. No celular, nada rola de lado");
for (const largura of [360, 390]) {
  const { ctx, page, estouros, leu } = await abrirATelaDoQuazar({ largura, altura: 800, celular: true });
  ok(`${largura}: a tela leu`, leu);
  await clicar(page.locator('[data-filtro-quazar="todas"]'));
  await page.waitForTimeout(250);
  await clicar(page.locator('[data-ver-conversa-do-quazar="cv-qz-9"]'));
  await esperar(page, '[data-mensagens-do-quazar="cv-qz-9"] [data-mensagem-da-conversa-do-quazar]', 6000);
  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const tela = doc.clientWidth;
    const fora = [...document.querySelectorAll("[data-tela=quazar] *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.right > tela + 0.5 || r.left < -0.5);
    }).map((e) => e.tagName + (e.getAttribute("data-filtro-quazar") ? `[${e.getAttribute("data-filtro-quazar")}]` : ""));
    const alvo = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
    return { rola: doc.scrollWidth > tela + 0.5 || window.innerWidth > tela + 0.5, fora: fora.slice(0, 5),
             link: alvo('[data-abrir-conversa-do-quazar="cv-qz-9"]'), ver: alvo('[data-ver-conversa-do-quazar="cv-qz-9"]'),
             chip: alvo('[data-filtro-quazar="7"]') };
  });
  ok(`${largura}: a página não rola de lado`, !m.rola, q(m));
  ok(`${largura}: nada sai da tela`, m.fora.length === 0, q(m.fora));
  ok(`${largura}: os botões têm o alvo de dedo (40)`, m.link >= 40 && m.ver >= 40 && m.chip >= 40, q(m));
  ok(`${largura}: nenhum estouro`, estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
