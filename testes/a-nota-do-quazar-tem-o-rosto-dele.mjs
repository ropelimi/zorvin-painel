// A NOTA INTERNA DO QUAZAR TEM O ROSTO DELE (27/11).
//
// Pedido do Rodrigo, com a foto de uma nota do Quazar com um "Q" num círculo:
// "Quando o Quazar deixar uma nota interna, deve aparecer a foto dele também,
// igual os demais usuários." A nota dele (o aviso de quem pede atenção,
// script 068 da ponte) é assinada "Quazar", sem conta (`autor_id` nulo).
//
// O que esta prova confere: a nota do Quazar mostra o rosto dele, pintado e
// do tamanho dos outros rostos, sem as iniciais; a nota de uma pessoa
// continua com a foto ou as iniciais dela, e não ganha o rosto do Quazar.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const CT = { id: "nq-ct", nome: "CLIENTE DA NOTA", numero: "5511930005555", foto_url: null };
const SEMENTE = {
  contatos: [CT],
  conversas: [{
    id: "nq-c", advogado_id: "a7", contato_id: CT.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: iso(AGORA - 60e3), ultima_mensagem: "Bom dia", esperando_desde: null, frente: null,
    vantoro_nome: null, digitando_ate: null, contato: { nome: CT.nome, numero: CT.numero, foto_url: null },
  }],
  mensagens: [
    { id: "nq-m1", conversa_id: "nq-c", origem: "contato", tipo: "texto", texto: "Bom dia", id_uazapi: "NQ-M1", criado_em: iso(AGORA - 30 * 60e3) },
    { id: "nq-m2", conversa_id: "nq-c", origem: "contato", tipo: "texto", texto: "Alguma novidade?", id_uazapi: "NQ-M2", criado_em: iso(AGORA - 10 * 60e3) },
  ],
  notas: [
    { id: "nq-n1", conversa_id: "nq-c", texto: "O cliente espera resposta, e não finalizei esta conversa.", autor: "Quazar", autor_id: null, criado_em: iso(AGORA - 20 * 60e3) },
    { id: "nq-n2", conversa_id: "nq-c", texto: "Vou ligar para ele.", autor: "Jenifer Almeida", autor_id: null, criado_em: iso(AGORA - 5 * 60e3) },
  ],
};

for (const [rotulo, viewport] of [["No computador", { width: 1600, height: 900 }], ["No celular", { width: 390, height: 844 }]]) {
  console.log(`\n${rotulo}`);
  const ctx = await nav.newContext({ viewport });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector('[data-conversa-id="nq-c"]', { timeout: 60000 }).catch(() => {});
  await page.locator('[data-conversa-id="nq-c"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForSelector("text=Vou ligar para ele.", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const rostos = await page.locator("[data-avatar-nota-quazar]").count();
  ok("a nota do Quazar tem o rosto dele (um só)", rostos === 1, `${rostos}`);
  const medida = rostos ? await page.locator("[data-avatar-nota-quazar]").first().evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { w: r.width, h: r.height, pintado: !!no && el.contains(no), svg: !!el.querySelector("svg"), texto: el.innerText.trim() };
  }) : null;
  ok("pintado na tela", Boolean(medida?.pintado), JSON.stringify(medida));
  ok("do tamanho dos outros rostos (28)", Boolean(medida) && Math.abs(medida.w - 28) < 0.5 && Math.abs(medida.h - 28) < 0.5, JSON.stringify(medida));
  ok("é o desenho, e não a letra Q", Boolean(medida?.svg) && medida.texto === "", JSON.stringify(medida));
  const titulo = rostos ? await page.locator("[data-avatar-nota-quazar]").first().getAttribute("title") : "";
  ok("o title diz que foi o Quazar", /Quazar/.test(titulo || ""), titulo || "");
  // A nota da pessoa continua com as iniciais dela.
  const daPessoa = await page.evaluate(() => {
    const linha = document.querySelector('[data-msg-id="nota-nq-n2"]');
    return linha ? { quazar: !!linha.querySelector("[data-avatar-nota-quazar]"), rosto: !!linha.querySelector("img, [data-avatar-inicial]") } : null;
  });
  ok("a nota da pessoa continua com a foto (ou as iniciais) dela, sem o rosto do Quazar", Boolean(daPessoa) && daPessoa.rosto && !daPessoa.quazar, JSON.stringify(daPessoa));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
