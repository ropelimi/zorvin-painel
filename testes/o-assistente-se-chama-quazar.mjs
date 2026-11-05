// O ASSISTENTE SE CHAMA QUAZAR (05/11) — o copiloto ganhou nome e rosto.
//
// Pedido do Rodrigo: "O Copiloto tem que ter um nome, pois ele será o
// assistente oficial do Zorvin. Ele tem que ser um “mascote” do sistema." O
// nome é QUAZAR: um pato malandro de óculos escuros (o "quá" foi o primeiro
// som de aviso do Zorvin), de frente e simétrico — o primeiro desenho, de três
// quartos, foi reprovado por ter uma lente maior que a outra.
//
// O nome mora num lugar só (`src/assistente.js`) e o rosto num componente só
// (`src/RostoDoAssistente.jsx`). O que esta prova guarda:
//
//   1. o botão da caixa de escrever: o rosto no lugar das estrelinhas,
//      PINTADO e do tamanho do botão, e o nome no title e no aria-label —
//      também enquanto ele escreve;
//   2. a faixa da sugestão: o rosto e o nome, e o campo de pedir uma mudança,
//      o "Pedir", o fechar, o "Desfazer" e o "Desfeito" dizem Quazar;
//   3. a frase de erro da ponte chega como veio, com o nome no alto da faixa;
//   4. o resumo: o rosto no alto do quadro, o botão e o "Resumir de novo"
//      pelo nome, e "Feito pelo Quazar, a IA do Zorvin" — o texto copiado
//      continua dizendo que é IA, porque longe da tela "Quazar" não diz nada;
//   5. dois rostos na tela ao mesmo tempo (o do botão e o do resumo) não
//      dividem os gradientes: os ids não se repetem, e esconder o primeiro
//      não apaga as cores do segundo;
//   6. o tema escuro;
//   7. o celular: o item "Sugerir resposta" do ⋮ com o rosto;
//   8. a aba da administração se chama Quazar, com o rosto e o nome;
//   9. e as frases de quando algo falha dizem Quazar: a lição que o banco não
//      deixou desfazer, a ponte que não respondeu, e as três leituras da aba;
//   e, nos estados de cada cena, nenhuma palavra "copiloto" à vista — nem no
//   texto, nem num title, aria-label ou placeholder.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { textoDoResumo } from "../src/resumoDaConversa.js";
import { NOME_DO_ASSISTENTE } from "../src/assistente.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await abrirNavegador();
// QUINTA, 05/11/2026, 9h EM BRASÍLIA.
const AGORA = Date.parse("2026-11-05T09:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const CAMPO = "textarea[data-campo]";
const PEDIDO = "não podemos passar o telefone do advogado";

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function preencher(loc, v) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(v, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function apertar(loc, tecla) {
  if (!(await loc.count())) return false;
  try { await loc.first().press(tecla, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = async (loc) => ((await loc.count()) ? loc.first().innerText().catch(() => "") : "");
const attr = async (loc, nome) => ((await loc.count()) ? loc.first().getAttribute(nome).catch(() => null) : null);
async function esperar(fn, ms = 8000) {
  const ate = Date.now() + ms;
  while (Date.now() < ate) {
    if (await fn()) return true;
    await pausa(100);
  }
  return Boolean(await fn());
}

ok("o nome mora num lugar só, e é Quazar", NOME_DO_ASSISTENTE === "Quazar", q(NOME_DO_ASSISTENTE));

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function oTelefoneQueOPainelAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
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
const ADV = await oTelefoneQueOPainelAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV), q(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const contato = (id, numero, nome) =>
  ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-qz-1", "5511948230401", "Carla Mendes"),
  contato("ct-qz-2", "5511948230402", "Bruno Teixeira"),
];
const A = "cv-qz-1", B = "cv-qz-2";
const conversa = (n) => ({
  id: `cv-qz-${n}`, advogado_id: ADV, contato_id: `ct-qz-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null, contato: CONTATOS[n - 1],
});
const ULTIMA = antes(6);
const SEMENTE = {
  contatos: CONTATOS,
  conversas: [1, 2].map(conversa),
  mensagens: [1, 2].map((n) => ({
    id: `m-qz-${n}`, conversa_id: `cv-qz-${n}`, origem: "contato", tipo: "texto",
    texto: "Bom dia, qual é o telefone do advogado?", criado_em: n === 1 ? ULTIMA : antes(n + 5),
  })),
};

// A PONTE DE MENTIRA, trocada por cena.
const ponte = {
  estado: { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, ajustar: true, aprende: true } },
  sugestao: { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Vamos verificar e retornamos." }, demora: 0 },
  ajuste: null,
  resumo: { status: 200, corpo: { ok: true, resumo: { quer: "Saber o telefone do advogado.", combinado: [], falta: ["Explicar que o atendimento é por aqui."] },
                                  mensagens: 1, notas: 0, cortou: false, ate: ULTIMA, avisos: [] } },
};
const LICAO = "Não passamos o telefone do advogado ao cliente.";

async function abrirPagina({ largura = 1400, altura = 900, escuro = false, bandeiras = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => { d.accept().catch(() => {}); });
  await page.clock.setFixedTime(new Date(AGORA));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários, e a
  // última escrita é a que vale.
  await page.addInitScript((b) => {
    globalThis.__SEMENTE = b.semente;
    globalThis.__ESCRITA_SEM_EFEITO = b.bandeiras.semEfeito || [];
    globalThis.__RECUSAR_LEITURA = b.bandeiras.recusarLeitura || [];
    try { localStorage.setItem("zorvin_modo", b.escuro ? "escuro" : "claro"); } catch (_) { /* sem armazenamento */ }
  }, { semente: SEMENTE, escuro, bandeiras });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) return json(ponte.estado.status, ponte.estado.corpo);
    if (url.pathname.endsWith("/copiloto/sugerir")) {
      const r = ponte.sugestao;
      if (r.demora) await pausa(r.demora);
      return json(r.status, r.corpo);
    }
    if (url.pathname.endsWith("/copiloto/ajustar")) {
      const r = ponte.ajuste || { status: 500, corpo: { ok: false, erro: "sem ajuste nesta cena" } };
      if (r.gravar) {
        await page.evaluate((l) => { (globalThis.__TABELAS.zorvin_copiloto_licoes ||= []).push(l); }, r.gravar)
          .catch(() => {});
      }
      return json(r.status, r.corpo);
    }
    if (url.pathname.endsWith("/copiloto/resumir")) return json(ponte.resumo.status, ponte.resumo.corpo);
    // SEM VANTORO: a ficha fixa ficaria pedindo cadastro a esta ponte.
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
async function abrirConversa(page, id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const botao = (page) => page.locator("[data-copiloto-botao]");
const faixa = (page, fase) => page.locator(fase ? `[data-copiloto-situacao="${fase}"]` : "[data-copiloto-situacao]");
const caixa = (page) => page.locator(CAMPO);
const naCaixa = (page) => caixa(page).inputValue().catch(() => "SEM CAIXA");
const rostoEm = (loc) => loc.locator("[data-rosto-do-assistente]");
const estrelinhasEm = (loc) => loc.locator("svg.lucide-sparkles");

/** O rosto PINTADO: o que está no meio dele, na tela, é ele mesmo — e não
 *  algo por cima, nem nada. E as medidas, para conferir o tamanho. */
const pintado = (page, seletorDoDono) => page.evaluate((sel) => {
  const dono = document.querySelector(sel);
  const rosto = dono && dono.querySelector("[data-rosto-do-assistente]");
  if (!rosto) return { ok: false, motivo: "sem rosto" };
  const r = rosto.getBoundingClientRect();
  const d = dono.getBoundingClientRect();
  const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.45);
  return { ok: Boolean(el && rosto.contains(el)), alvo: el ? el.tagName : null,
           largura: Math.round(r.width), altura: Math.round(r.height),
           dentroDoDono: r.left >= d.left - 0.5 && r.right <= d.right + 0.5 && r.top >= d.top - 0.5 && r.bottom <= d.bottom + 0.5,
           escondidoDoLeitor: rosto.getAttribute("aria-hidden") === "true" };
}, seletorDoDono);

/** Os gradientes de cada rosto são DELE: os ids não se repetem no documento,
 *  e cada `url(#…)` aponta para dentro do próprio desenho. Com o mesmo id em
 *  dois rostos, o segundo pintaria com o gradiente do primeiro — e, com o
 *  primeiro escondido, ficaria sem cor. */
const gradientes = (page) => page.evaluate(() => {
  const rostos = [...document.querySelectorAll("[data-rosto-do-assistente]")];
  const ids = rostos.flatMap((s) => [...s.querySelectorAll("[id]")].map((e) => e.id));
  const repetidos = ids.filter((id) => document.querySelectorAll(`[id="${CSS.escape(id)}"]`).length !== 1);
  let refs = 0, foraDoProprio = 0;
  for (const svg of rostos) {
    for (const el of svg.querySelectorAll("[fill^='url(']")) {
      refs++;
      const id = el.getAttribute("fill").replace(/^url\(#?|\)$/g, "");
      const alvo = document.getElementById(id);
      if (!alvo || !svg.contains(alvo)) foraDoProprio++;
    }
  }
  return { rostos: rostos.length, ids: ids.length, refs, repetidos: repetidos.length, foraDoProprio };
});

/** Quanto do rosto está pintado de verde (a cabeça do pato), numa foto da
 *  tela: é o que separa "o desenho está lá" de "o desenho está lá, sem cor". */
async function verdeNoRosto(page, rosto) {
  const bb = await rosto.boundingBox().catch(() => null);
  if (!bb) return -1;
  const png = await page.screenshot({ clip: bb });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let verdes = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (gg > 100 && gg > r + 40 && gg > b + 10) verdes++;
    }
    return Math.round((verdes / (d.length / 4)) * 100) / 100;
  }, png.toString("base64"));
}

/** Onde a tela ainda diz "copiloto": o texto à vista e os títulos, rótulos e
 *  placeholders. Os `data-copiloto-*` são da prova e do código, e ninguém os
 *  lê. */
const ondeDizCopiloto = (page, seletor = "body") => page.evaluate((sel) => {
  const raiz = document.querySelector(sel);
  if (!raiz) return ["(sem a raiz)"];
  const achados = [];
  const m = (raiz.innerText || "").match(/.{0,30}copiloto.{0,30}/gi);
  if (m) achados.push(...m.map((x) => `texto: ${x}`));
  for (const el of raiz.querySelectorAll("[title], [aria-label], [placeholder], [alt]")) {
    for (const a of ["title", "aria-label", "placeholder", "alt"]) {
      const v = el.getAttribute(a);
      if (v && /copiloto/i.test(v)) achados.push(`${a}: ${v}`);
    }
  }
  return achados;
}, seletor);

// ==================================================================
console.log("\n1. O botão da caixa de escrever: o rosto do Quazar, e o nome dele");
let { ctx, page, estouros } = await abrirPagina();
ok("abri a conversa da Carla", await abrirConversa(page, A));
ok("o botão está lá, com a caixa vazia", await esperar(async () => (await botao(page).count()) === 1));
ok("com o rosto do Quazar", (await rostoEm(botao(page)).count()) === 1);
ok("e sem as estrelinhas de antes", (await estrelinhasEm(botao(page)).count()) === 0);
{
  const p = await pintado(page, "[data-copiloto-botao]");
  ok("o rosto está PINTADO no botão (o meio dele é ele mesmo)", p.ok, q(p));
  ok("do tamanho do botão: 28 pontos, dentro dos 40 do alvo", p.largura === 28 && p.altura === 28 && p.dentroDoDono, q(p));
  ok("e escondido do leitor de tela: quem diz o que o botão faz é o rótulo", p.escondidoDoLeitor, q(p));
}
ok("o title diz o nome", (await attr(botao(page), "title")) === "Sugerir resposta (Quazar)", q(await attr(botao(page), "title")));
ok("e o aria-label também", (await attr(botao(page), "aria-label")) === "Sugerir resposta com o Quazar",
   q(await attr(botao(page), "aria-label")));
ok("o botão se acha pelo nome que o leitor de tela lê",
   (await page.getByRole("button", { name: "Sugerir resposta com o Quazar" }).count()) === 1);
{
  const g = await gradientes(page);
  ok("os gradientes do rosto são dele: nenhum id repetido, nenhuma cor apontando para fora",
     g.rostos >= 1 && g.refs >= 4 && g.repetidos === 0 && g.foraDoProprio === 0, q(g));
}
{
  const v = await verdeNoRosto(page, rostoEm(botao(page)).first());
  ok("e com cor: a cabeça verde está na foto do botão", v >= 0.15, `verde em ${v} do rosto`);
}
ponte.sugestao = { ...ponte.sugestao, demora: 1500 };
ok("pedi a sugestão", await clicar(botao(page)));
ok("enquanto ele escreve, o title diz que é o Quazar quem está escrevendo",
   await esperar(async () => (await attr(botao(page), "title")) === "O Quazar está escrevendo a sugestão…", 1200),
   q(await attr(botao(page), "title")));
ok("e a faixa diz o nome", await esperar(async () => /^Quazar · lendo a conversa/.test(await texto(page.locator("[data-copiloto-frase]"))), 1200),
   q(await texto(page.locator("[data-copiloto-frase]"))));
ok("a sugestão entrou na caixa", await esperar(async () => (await naCaixa(page)).length > 0));
ponte.sugestao = { ...ponte.sugestao, demora: 0 };
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));

// ==================================================================
console.log("\n2. A faixa da sugestão: o rosto e o nome, em cada frase e em cada botão");
ok("a faixa está lá", await esperar(async () => (await faixa(page, "sugeriu").count()) === 1));
ok("com o rosto do Quazar no lugar das estrelinhas",
   (await rostoEm(faixa(page)).count()) === 1 && (await estrelinhasEm(faixa(page)).count()) === 0);
{
  const p = await pintado(page, "[data-copiloto-situacao]");
  ok("pintado, e de 22 pontos", p.ok && p.largura === 22, q(p));
}
ok("a frase começa pelo nome dele",
   /^Quazar · a sugestão está na caixa/.test(await texto(page.locator("[data-copiloto-frase]"))),
   q(await texto(page.locator("[data-copiloto-frase]"))));
const campo = page.locator("[data-copiloto-pedido-campo]");
ok("o campo de pedir uma mudança diz a quem se pede",
   (await attr(campo, "placeholder")) === "Pedir uma mudança ao Quazar (ex.: não podemos passar o telefone do advogado)",
   q(await attr(campo, "placeholder")));
ok("e o rótulo dele também", (await attr(campo, "aria-label")) === "Pedir uma mudança ao Quazar", q(await attr(campo, "aria-label")));
ok("o Pedir diz a quem manda", (await attr(page.locator("[data-copiloto-pedir]"), "title")) === "Mandar o pedido ao Quazar");
ok("e o fechar diz de quem é o aviso",
   (await attr(page.locator("[data-copiloto-fechar]"), "aria-label")) === "Fechar o aviso do Quazar",
   q(await attr(page.locator("[data-copiloto-fechar]"), "aria-label")));
{
  const achados = await ondeDizCopiloto(page);
  ok("nada na tela diz “copiloto”", achados.length === 0, q(achados));
}
ponte.ajuste = { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Por segurança, não passamos o telefone do advogado.",
                                      licao: { id: "lc-qz", texto: LICAO } },
                 gravar: { id: "lc-qz", texto: LICAO, pedido: PEDIDO, conversa_id: A, criada_por: "u1",
                           criada_em: new Date(AGORA).toISOString(), editada_por: null, editada_em: null } };
ok("pedi a mudança", await preencher(campo, PEDIDO) && await apertar(campo, "Enter"));
ok("a lição apareceu", await esperar(async () => (await page.locator("[data-copiloto-licao]").count()) === 1));
ok("o Desfazer diz quem esquece a lição",
   (await attr(page.locator("[data-copiloto-desfazer]"), "title")) === "Desfazer: o Quazar esquece esta lição",
   q(await attr(page.locator("[data-copiloto-desfazer]"), "title")));
ok("desfiz", await clicar(page.locator("[data-copiloto-desfazer]")));
ok("e a faixa diz que o Quazar esqueceu",
   await esperar(async () => (await texto(page.locator("[data-copiloto-licao-desfeita]"))).trim() === "Desfeito: o Quazar esqueceu essa lição."),
   q(await texto(page.locator("[data-copiloto-licao-desfeita]"))));
{
  const achados = await ondeDizCopiloto(page);
  ok("e, depois da lição desfeita, nada diz “copiloto”", achados.length === 0, q(achados));
}
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n2b. A lição que o banco não deixa desfazer manda para a aba do Quazar");
({ ctx, page, estouros } = await abrirPagina({ bandeiras: { semEfeito: ["zorvin_copiloto_licoes"] } }));
ok("abri a conversa da Carla", await abrirConversa(page, A));
ok("pedi a sugestão", await esperar(async () => (await botao(page).count()) === 1) && await clicar(botao(page)));
ok("a sugestão entrou na caixa", await esperar(async () => (await naCaixa(page)).length > 0));
{
  const c = page.locator("[data-copiloto-pedido-campo]");
  ok("pedi a mudança", await esperar(async () => (await c.count()) === 1) && await preencher(c, PEDIDO) && await apertar(c, "Enter"));
}
ok("a lição apareceu", await esperar(async () => (await page.locator("[data-copiloto-licao]").count()) === 1));
ok("desfiz", await clicar(page.locator("[data-copiloto-desfazer]")));
ok("o banco não deixou, e a frase manda à aba do Quazar",
   await esperar(async () => /quem administra pode apagá-la na aba Quazar, em Departamentos e acessos\./
     .test(await texto(page.locator("[data-copiloto-erro-desfazer]")))),
   q(await texto(page.locator("[data-copiloto-erro-desfazer]"))));
{
  const achados = await ondeDizCopiloto(page);
  ok("e nada diz “copiloto”", achados.length === 0, q(achados));
}
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n3. O erro da ponte chega como veio, com o nome no alto da faixa");
({ ctx, page, estouros } = await abrirPagina());
ponte.sugestao = { status: 502, corpo: { ok: false,
  erro: "O Quazar preferiu não sugerir uma resposta para esta conversa. Escreva a resposta sem ele." }, demora: 0 };
ok("abri a conversa do Bruno", await abrirConversa(page, B));
ok("pedi a sugestão", await esperar(async () => (await botao(page).count()) === 1) && await clicar(botao(page)));
ok("a faixa diz o erro, pelo nome",
   await esperar(async () => (await texto(page.locator('[data-copiloto-situacao="erro"] [data-copiloto-frase]')))
     === "Quazar · O Quazar preferiu não sugerir uma resposta para esta conversa. Escreva a resposta sem ele."),
   q(await texto(page.locator("[data-copiloto-frase]"))));
{
  const achados = await ondeDizCopiloto(page);
  ok("e nada diz “copiloto”", achados.length === 0, q(achados));
}
// A RESPOSTA VAZIA (05/11): a frase de reserva é do PAINEL, e não da ponte. Ela
// dizia "A IA não devolveu…", e a PR do Quazar não a viu: nenhuma cena
// mandava uma resposta vazia.
ponte.sugestao = { status: 200, corpo: { ok: true, sugestao: "   " }, demora: 0 };
ok("pedi de novo, e a ponte respondeu em branco", await clicar(botao(page)));
ok("a faixa diz que o Quazar não devolveu sugestão",
   await esperar(async () => (await texto(page.locator('[data-copiloto-situacao="erro"] [data-copiloto-frase]')))
     === "Quazar · O Quazar não devolveu sugestão desta vez. Tente de novo."),
   q(await texto(page.locator("[data-copiloto-frase]"))));
ponte.sugestao = { status: 200, corpo: { ok: true, sugestao: "{saudacao}, {nome}! Vamos verificar e retornamos." }, demora: 0 };
ok("pedi de novo, e a sugestão veio", await clicar(botao(page)) && await esperar(async () => (await naCaixa(page)).length > 0));
ponte.ajuste = { status: 200, corpo: { ok: true, sugestao: "" } };
{
  const c = page.locator("[data-copiloto-pedido-campo]");
  ok("pedi uma mudança, e a ponte devolveu a mensagem em branco",
     await esperar(async () => (await c.count()) === 1) && await preencher(c, PEDIDO) && await apertar(c, "Enter"));
}
ok("a faixa diz que o Quazar não devolveu a mensagem",
   await esperar(async () => (await texto(page.locator("[data-copiloto-erro-do-pedido]"))).trim()
     === "O Quazar não devolveu a mensagem desta vez. Tente de novo."),
   q(await texto(page.locator("[data-copiloto-erro-do-pedido]"))));
{
  const achados = await ondeDizCopiloto(page);
  ok("e nada diz “copiloto”", achados.length === 0, q(achados));
}
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n4. O resumo: o rosto no alto do quadro, e “feito pelo Quazar, a IA do Zorvin”");
({ ctx, page, estouros } = await abrirPagina());
ok("abri a conversa da Carla", await abrirConversa(page, A));
const botaoDoResumo = page.locator("[data-resumo-botao]");
ok("o botão do resumo diz o nome no title",
   (await attr(botaoDoResumo, "title")) === "Resumir a conversa (Quazar)", q(await attr(botaoDoResumo, "title")));
ok("e no aria-label", (await attr(botaoDoResumo, "aria-label")) === "Resumir a conversa com o Quazar",
   q(await attr(botaoDoResumo, "aria-label")));
ok("pedi o resumo", await clicar(botaoDoResumo));
const quadro = page.locator('[data-resumo-da-conversa="pronto"]');
ok("o quadro chegou", await esperar(async () => (await quadro.count()) === 1));
ok("com o rosto do Quazar no alto, e sem as estrelinhas",
   (await rostoEm(quadro).count()) === 1 && (await estrelinhasEm(quadro).count()) === 0);
{
  const p = await pintado(page, '[data-resumo-da-conversa="pronto"]');
  ok("pintado, e de 24 pontos", p.ok && p.largura === 24, q(p));
}
ok("a frase de baixo diz quem fez, e que é IA",
   (await texto(page.locator("[data-resumo-aviso-da-ia]"))).trim()
     === "Feito pelo Quazar, a IA do Zorvin, a partir da conversa e das notas internas: confira na conversa antes de agir.",
   q(await texto(page.locator("[data-resumo-aviso-da-ia]"))));
ok("o “Resumir de novo” pede ao Quazar",
   (await attr(page.locator("[data-resumo-de-novo]"), "title")) === "Pedir um resumo novo ao Quazar",
   q(await attr(page.locator("[data-resumo-de-novo]"), "title")));
{
  const copiado = textoDoResumo({ quer: "Saber o telefone do advogado.", combinado: [], falta: [] },
                                { nome: "CARLA MENDES", quando: "às 09:00" });
  ok("o texto copiado diz que foi o Quazar, e que ele é a IA do Zorvin",
     copiado.startsWith("Resumo da conversa com CARLA MENDES, às 09:00 (feito pelo Quazar, a IA do Zorvin)"), q(copiado.slice(0, 120)));
}

console.log("\n5. Dois rostos na tela não dividem os gradientes");
ok("o botão do Quazar continua na caixa vazia, junto do quadro", (await botao(page).count()) === 1);
{
  const g = await gradientes(page);
  ok("são dois rostos, e nenhum id se repete", g.rostos === 2 && g.repetidos === 0, q(g));
  ok("cada cor aponta para dentro do próprio desenho", g.refs >= 8 && g.foraDoProprio === 0, q(g));
}
{
  // O PRIMEIRO rosto do documento some; o segundo tem de continuar colorido.
  // Com os ids repetidos, o segundo pintaria com os gradientes do primeiro —
  // que, escondidos, não pintam nada.
  const segundo = await page.evaluate(() => {
    const rostos = [...document.querySelectorAll("[data-rosto-do-assistente]")];
    if (rostos.length < 2) return null;
    rostos[0].style.display = "none";
    rostos[1].setAttribute("data-rosto-que-fica", "");
    return rostos[1].closest("[data-copiloto-botao]") ? "o do botão" : "o do resumo";
  });
  ok("escondi o primeiro rosto", Boolean(segundo), q(segundo));
  const v = await verdeNoRosto(page, page.locator("[data-rosto-que-fica]").first());
  ok("e o outro continua com a cabeça verde", v >= 0.15, `verde em ${v} de ${segundo}`);
}
{
  const achados = await ondeDizCopiloto(page);
  ok("e nada na tela diz “copiloto”", achados.length === 0, q(achados));
}
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n6. No tema escuro");
({ ctx, page, estouros } = await abrirPagina({ escuro: true }));
ok("a tela está no tema escuro", await page.evaluate(() => localStorage.getItem("zorvin_modo")) === "escuro");
ok("abri a conversa da Carla", await abrirConversa(page, A));
ok("o botão está lá, com o rosto", await esperar(async () => (await rostoEm(botao(page)).count()) === 1));
{
  const p = await pintado(page, "[data-copiloto-botao]");
  ok("pintado", p.ok, q(p));
  const v = await verdeNoRosto(page, rostoEm(botao(page)).first());
  ok("e com a cabeça verde sobre o fundo escuro", v >= 0.15, `verde em ${v} do rosto`);
}
ok("pedi a sugestão", await clicar(botao(page)));
ok("a faixa tem o rosto e o nome",
   await esperar(async () => (await rostoEm(faixa(page, "sugeriu")).count()) === 1
     && /^Quazar · /.test(await texto(page.locator("[data-copiloto-frase]")))));
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n7. No celular, o item do ⋮ tem o rosto do Quazar");
({ ctx, page, estouros } = await abrirPagina({ largura: 390, altura: 844 }));
ok("abri a conversa da Carla", await abrirConversa(page, A));
ok("no celular, o botão não fica na caixa", (await botao(page).count()) === 0);
ok("abri o ⋮", await clicar(page.getByRole("button", { name: "Mais opções desta conversa" })));
const item = page.locator("[data-copiloto-item]");
ok("o item “Sugerir resposta” está lá", await esperar(async () => (await item.count()) === 1));
ok("com o rosto, e sem as estrelinhas", (await rostoEm(item).count()) === 1 && (await estrelinhasEm(item).count()) === 0);
ok("e escrito “Sugerir resposta”", /Sugerir resposta/.test(await texto(item)), q(await texto(item)));
{
  const p = await pintado(page, "[data-copiloto-item]");
  ok("o rosto está pintado no item, e de 20 pontos", p.ok && p.largura === 20, q(p));
}
{
  const achados = await ondeDizCopiloto(page);
  ok("nada na tela diz “copiloto”", achados.length === 0, q(achados));
}
ok("tocar no item pede a sugestão", await clicar(item) && await esperar(async () => (await naCaixa(page)).length > 0));
ok("e a faixa, no celular, tem o rosto e o nome",
   (await rostoEm(faixa(page, "sugeriu")).count()) === 1 && /^Quazar · /.test(await texto(page.locator("[data-copiloto-frase]"))));
ok("a página não rola de lado", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n8. A aba da administração se chama Quazar");
({ ctx, page, estouros } = await abrirPagina());
ok("abri Departamentos e acessos",
   await clicar(page.getByRole("button", { name: "Menu" }))
   && await clicar(page.getByRole("button", { name: "Departamentos e acessos" })));
await page.waitForTimeout(800);
const aba = page.locator("[data-aba-copiloto]");
ok("a aba está lá", await esperar(async () => (await aba.count()) === 1));
ok("e se chama Quazar", (await texto(aba)).trim() === "Quazar", q(await texto(aba)));
ok("abri a aba", await clicar(aba));
const titulo = page.locator("[data-titulo-do-assistente]");
ok("o título diz quem ele é", await esperar(async () => (await texto(titulo)).trim() === "O Quazar, o assistente do Zorvin"),
   q(await texto(titulo)));
ok("com o rosto dele", (await rostoEm(titulo).count()) === 1);
{
  const p = await pintado(page, "[data-titulo-do-assistente]");
  ok("pintado", p.ok, q(p));
}
const manual = page.locator("[data-manual-do-copiloto]");
ok("a explicação diz o que o Quazar lê", /o Quazar lê as últimas 40 mensagens/.test(await texto(manual)), q((await texto(manual)).slice(0, 300)));
ok("e que as notas internas não vão para ele", /As notas internas não vão para o Quazar\./.test(await texto(manual)));
ok("a seção das lições diz o que ele aprendeu com a equipe",
   await esperar(async () => /O que o Quazar aprendeu com a equipe/.test(await texto(page.locator("[data-licoes-do-copiloto]")))),
   q(await texto(page.locator("[data-licoes-do-copiloto]"))));
ok("e a das notas, o que ele aprendeu lendo as conversas",
   await esperar(async () => /O que o Quazar aprendeu lendo as conversas/.test(await texto(page.locator("[data-notas-do-copiloto-secao]")))),
   q(await texto(page.locator("[data-notas-do-copiloto-secao]"))));
{
  const achados = await ondeDizCopiloto(page, "[data-manual-do-copiloto]");
  ok("nada na aba diz “copiloto”", achados.length === 0, q(achados));
}
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();

// ==================================================================
console.log("\n9. A aba com a ponte calada e as três leituras falhando: cada frase diz Quazar");
ponte.estado = { status: 500, corpo: { ok: false } };
({ ctx, page, estouros } = await abrirPagina({ bandeiras: {
  recusarLeitura: ["zorvin_copiloto", "zorvin_copiloto_licoes", "zorvin_copiloto_aprendido"] } }));
ok("abri Departamentos e acessos",
   await clicar(page.getByRole("button", { name: "Menu" }))
   && await clicar(page.getByRole("button", { name: "Departamentos e acessos" })));
await page.waitForTimeout(800);
ok("a aba Quazar está lá, mesmo com a leitura falhando", await esperar(async () => (await texto(page.locator("[data-aba-copiloto]"))).trim() === "Quazar"));
ok("abri a aba", await clicar(page.locator("[data-aba-copiloto]")));
ok("a ponte que não respondeu é dita pelo nome",
   await esperar(async () => /^Não consegui perguntar à ponte se o Quazar está ligado\./.test(await texto(page.locator('[data-copiloto-ligado="perguntando"], [data-copiloto-ligado="null"]')))),
   q(await texto(page.locator("[data-copiloto-ligado]"))));
ok("o manual que não veio também",
   await esperar(async () => /^Não consegui ler o manual do Quazar\./.test(await texto(page.locator("[data-manual-erro]")))),
   q(await texto(page.locator("[data-manual-erro]"))));
ok("as lições que não vieram também",
   await esperar(async () => /^Não consegui ler as lições do Quazar\./.test(await texto(page.locator("[data-licoes-erro]")))),
   q(await texto(page.locator("[data-licoes-erro]"))));
ok("e as notas que não vieram também",
   await esperar(async () => /^Não consegui ler o que o Quazar aprendeu com as conversas\./.test(await texto(page.locator("[data-notas-erro]")))),
   q(await texto(page.locator("[data-notas-erro]"))));
ok("a leitura das conversas, sem a ponte, diz que não deu para perguntar",
   /^Não consegui perguntar à ponte se o Quazar está lendo as conversas\./.test(await texto(page.locator('[data-copiloto-leitura="duvida"]'))),
   q(await texto(page.locator("[data-copiloto-leitura]"))));
{
  const achados = await ondeDizCopiloto(page, "[data-manual-do-copiloto]");
  ok("e nada na aba diz “copiloto”", achados.length === 0, q(achados));
}
ok("nenhum estouro de página", estouros.length === 0, estouros.join(" | "));
await ctx.close();
ponte.estado = { status: 200, corpo: { ok: true, ligado: true, modelo: "claude-haiku-5-5", resumo: true, ajustar: true, aprende: true } };

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
if (falhas) { console.log(`${falhas} FALHARAM`); process.exit(1); }
