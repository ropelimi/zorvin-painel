// O REPASSE PENDENTE AO ABRIR A CONVERSA (27/11)
//
// Pedido do Rodrigo: "Todos os clientes que tiverem repasse precisa aparecer
// ao abrir a conversa, informando que tem repasse pendente e o valor do
// repasse. Esse repasse é a "DESPESA EM ABERTO" que é puxada da aba "Andon"
// dentro da ficha do cliente no Vantoro."
//
// O QUE ESTA PROVA GUARDA
//   1. o cliente ligado à ficha com repasse em aberto: a faixa, pintada, com o
//      valor em reais, também no celular;
//   2. o repasse pago, o repasse nulo (o Andon fora do ar) e o valor zero: sem
//      faixa;
//   3. o contato sem ficha: sem faixa, e sem pergunta ao Vantoro;
//   4. trocar de conversa tira a faixa de quem não tem repasse;
//   5. voltar ao mesmo cliente em menos de cinco minutos não pergunta de novo;
//   6. sem Vantoro, nada.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { avisoDoRepasse, valorEmReais } from "../src/repasse.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (v) => JSON.stringify(v);

// 0. A CONTA, direto na função.
console.log("\n0. A conta da faixa");
ok("1234.5 vira R$ 1.234,50", valorEmReais(1234.5).replace(/\s/g, " ") === "R$ 1.234,50", q(valorEmReais(1234.5)));
ok("em aberto, com valor: faixa", avisoDoRepasse({ estado: "aberto", aberto: 80, pago: 0 }) !== null);
ok("pago: sem faixa", avisoDoRepasse({ estado: "pago", aberto: 0, pago: 500 }) === null);
ok("nenhum: sem faixa", avisoDoRepasse({ estado: "nenhum", aberto: 0, pago: 0 }) === null);
ok("nulo: sem faixa", avisoDoRepasse(null) === null);
ok("em aberto com zero: sem faixa", avisoDoRepasse({ estado: "aberto", aberto: 0 }) === null);

const nav = await abrirNavegador();
const AGORA = Date.now();
const iso = (min) => new Date(AGORA - min * 60000).toISOString();

const REPASSES = {
  "v-aberto": { estado: "aberto", aberto: 1234.5, pago: 200, lancamentos: [
    { data: "2026-11-30", valor: 1234.5, situacao: "em aberto", descricao: "Repasse" },
    { data: "2026-11-20", valor: 200, situacao: "pago", descricao: "Repasse" }] },
  "v-pago": { estado: "pago", aberto: 0, pago: 900 },
  "v-andon-fora": null,
};
const contato = (id, numero, nome, cliente) => ({ id, numero, nome, vantoro_nome: cliente ? nome : null,
  nome_zorvin: null, vantoro_cliente_id: cliente, foto_url: null });
const CONTATOS = [
  contato("ct-rep-a", "5511944450001", "CLIENTE COM REPASSE", "v-aberto"),
  contato("ct-rep-p", "5511944450002", "CLIENTE COM REPASSE PAGO", "v-pago"),
  contato("ct-rep-f", "5511944450003", "CLIENTE SEM ANDON", "v-andon-fora"),
  contato("ct-rep-s", "5511944450004", "Lead Sem Ficha", null),
];

async function abrir({ adv = null, largura = 1500, celular = false, comVantoro = true, achaPeloTelefone = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: celular ? 844 : 900 },
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [], fichas = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const semente = adv ? {
    contatos: CONTATOS,
    conversas: CONTATOS.map((c, i) => ({ id: "cv-" + c.id, advogado_id: adv, contato_id: c.id, nao_lidas: 0,
      arquivada: false, fixada: false, ultima_atividade: iso(i + 1), esperando_desde: null, tratada_em: null,
      ultima_mensagem: "Oi", digitando_ate: null, vantoro_nome: null, contato: c })),
    mensagens: CONTATOS.map((c, i) => ({ id: "m-" + c.id, conversa_id: "cv-" + c.id, origem: "contato",
      tipo: "texto", texto: "Oi", id_uazapi: "uz-" + c.id, criado_em: iso(i + 1) })),
  } : null;
  await page.addInitScript((b) => { globalThis.__SEMENTE = b.semente; globalThis.__QUEBRAR = null; }, { semente });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (corpo) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/vantoro/status")) return json({ ligado: comVantoro, configurado: comVantoro });
    if (url.pathname.endsWith("/vantoro/cliente")) {
      // a busca por telefone devolve o RESUMO, sem repasse (como o Vantoro)
      const tel = url.searchParams.get("telefone") || "";
      if (achaPeloTelefone && tel.endsWith("944450001"))
        return json({ clientes: [{ id: "v-aberto", nome: "CLIENTE COM REPASSE", telefone: "(11) 94445-0001",
          telefones: [], processos: [] }], opcoes: {} });
      return json({ clientes: [], opcoes: {} });
    }
    const m = url.pathname.match(/\/vantoro\/cliente\/([^/]+)$/);
    if (m) {
      const id = decodeURIComponent(m[1]);
      fichas.push(id);
      return json({ ok: true, cliente: { id, nome: "X", processos: [], repasse: REPASSES[id] ?? null } });
    }
    return json({ ok: true });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros, fichas };
}

async function abrirConversa(page, nome) {
  const linha = page.locator(`[data-conversa-nome="${nome}"]`);
  if (!(await linha.count())) return false;
  try { await linha.first().click({ timeout: 3000 }); } catch (_) { return false; }
  await page.waitForTimeout(1200);
  return true;
}

async function faixa(page) {
  return page.evaluate(() => {
    const f = document.querySelector("[data-aviso-de-repasse]");
    if (!f) return null;
    const r = f.getBoundingClientRect();
    const v = f.querySelector("[data-valor-do-repasse]");
    const vr = v ? v.getBoundingClientRect() : null;
    const quem = vr ? document.elementFromPoint(vr.x + vr.width / 2, vr.y + vr.height / 2) : null;
    return { texto: f.textContent.replace(/\s+/g, " ").trim(), valor: v ? v.textContent.replace(/\s/g, " ") : "",
             pintado: !!quem && (quem === v || v.contains(quem)),
             dentro: r.left >= 0 && r.right <= document.documentElement.clientWidth + 1,
             rola: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
}

// O telefone que o painel abre.
const desc = await abrir();
const ADV = await desc.page.evaluate(() => {
  const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
  const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
  return c ? c.advogado_id : null;
});
await desc.ctx.close();
ok("aprendi qual telefone o painel abre", Boolean(ADV));

console.log("\n1. O cliente com repasse em aberto");
{
  const { ctx, page, estouros, fichas } = await abrir({ adv: ADV });
  ok("abre a conversa", await abrirConversa(page, "CLIENTE COM REPASSE"));
  const f = await faixa(page);
  ok("a faixa aparece", !!f);
  ok("diz que há repasse pendente", !!f && f.texto.includes("Repasse pendente"), q(f?.texto));
  ok("com o valor em reais", !!f && f.valor === "R$ 1.234,50", q(f?.valor));
  ok("e diz de onde vem (Andon)", !!f && f.texto.includes("Andon"));
  ok("o valor está pintado", !!f && f.pintado);
  ok("perguntou a ficha do cliente", fichas.includes("v-aberto"), q(fichas));

  console.log("\n2. Pago, Andon fora do ar, sem ficha");
  ok("abre o cliente com repasse pago", await abrirConversa(page, "CLIENTE COM REPASSE PAGO"));
  ok("pago: sem faixa", (await faixa(page)) === null);
  ok("abre o cliente sem Andon", await abrirConversa(page, "CLIENTE SEM ANDON"));
  ok("Andon fora (nulo): sem faixa", (await faixa(page)) === null);
  const antes = fichas.length;
  ok("abre o contato sem ficha", await abrirConversa(page, "Lead Sem Ficha"));
  ok("sem ficha: sem faixa", (await faixa(page)) === null);
  ok("e sem pergunta ao Vantoro", fichas.length === antes, q(fichas));

  console.log("\n3. Voltar ao cliente");
  const idas = fichas.filter((x) => x === "v-aberto").length;
  ok("volta à conversa com repasse", await abrirConversa(page, "CLIENTE COM REPASSE"));
  const f2 = await faixa(page);
  ok("a faixa volta", !!f2 && f2.valor === "R$ 1.234,50");
  ok("sem perguntar de novo (cinco minutos)", fichas.filter((x) => x === "v-aberto").length === idas,
     q(fichas));
  ok("nenhum erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

console.log("\n4. No celular (390)");
{
  const { ctx, page } = await abrir({ adv: ADV, largura: 390, celular: true });
  ok("abre a conversa", await abrirConversa(page, "CLIENTE COM REPASSE"));
  const f = await faixa(page);
  ok("a faixa aparece", !!f);
  ok("dentro da tela", !!f && f.dentro);
  ok("a tela não rola de lado", !!f && !f.rola);
  await ctx.close();
}

console.log("\n6. A Ficha no Vantoro mostra o repasse ao cliente, com a data");
{
  const { ctx, page, estouros } = await abrir({ adv: ADV, achaPeloTelefone: true });
  ok("abre a conversa", await abrirConversa(page, "CLIENTE COM REPASSE"));
  await page.waitForSelector("[data-repasse-na-ficha]", { timeout: 6000 }).catch(() => {});
  const c = await page.evaluate(() => {
    const k = document.querySelector("[data-repasse-na-ficha]");
    if (!k) return null;
    const t = (sel) => [...k.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s/g, " ").trim());
    const r = k.getBoundingClientRect();
    const quem = document.elementFromPoint(r.x + 20, r.y + 10);
    return { estado: k.getAttribute("data-repasse-na-ficha"), texto: k.textContent,
             pago: t("[data-repasse-pago]")[0], aPagar: t("[data-repasse-a-pagar]")[0],
             datas: t("[data-repasse-data]"), valores: t("[data-repasse-valor]"),
             pintada: !!quem && k.contains(quem) };
  });
  ok("a caixa do repasse aparece na ficha", !!c, "a ficha não completou com a ficha inteira");
  ok("diz que é repasse ao cliente", !!c && c.texto.includes("Repasse ao cliente"));
  ok("em aberto", c?.estado === "aberto", q(c?.estado));
  ok("pago: R$ 200,00", c?.pago === "R$ 200,00", q(c?.pago));
  ok("a pagar: R$ 1.234,50", c?.aPagar === "R$ 1.234,50", q(c?.aPagar));
  ok("cada lançamento com a data", q(c?.datas) === q(["30/11/2026", "20/11/2026"]), q(c?.datas));
  ok("e o valor de cada um", q(c?.valores) === q(["R$ 1.234,50", "R$ 200,00"]), q(c?.valores));
  ok("a caixa está pintada", !!c && c.pintada);
  ok("nenhum erro de JavaScript", estouros.length === 0, q(estouros));
  await ctx.close();
}

console.log("\n5. Sem Vantoro");
{
  const { ctx, page, fichas } = await abrir({ adv: ADV, comVantoro: false });
  const abriu = await abrirConversa(page, "CLIENTE COM REPASSE") || await abrirConversa(page, "Lead Sem Ficha");
  ok("abre uma conversa", abriu);
  ok("sem faixa", (await faixa(page)) === null);
  ok("e sem pergunta ao Vantoro", !fichas.includes("v-aberto"), q(fichas));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
