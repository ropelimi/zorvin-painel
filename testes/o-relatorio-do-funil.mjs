// O RELATÓRIO DO FUNIL — quantos em cada etapa, e quanto tempo (07/10)
//
// Pedido do Rodrigo logo depois do funil: "quantos clientes há em cada etapa,
// e quanto tempo eles ficam em cada uma". É uma seção do Painel de números,
// somada no banco (script 019 da ponte).
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. cada etapa diz quantos clientes estão nela AGORA, há quanto tempo, e o
//      mais parado;
//   2. no PERÍODO: quantos entraram, quantos saíram, e quanto tempo ficaram
//      na etapa os que saíram (a mediana, e não o "até agora" de quem ficou);
//   3. o resumo do departamento: no funil agora, entraram, saíram do funil;
//   4. trocar o período mexe só nas colunas do período — "agora" não muda;
//   5. o filtro de telefone da barra recorta;
//   6. a seção diz qual coluna é foto de agora e qual é do período;
//   7. sem a função (019), ou sem o funil (017), quem administra lê qual
//      script falta e quem atende não vê nada; com a função FALHANDO, a tela
//      diz, com o código, e não desenha tabela zerada;
//   8. e o caminho inteiro: mudar a etapa na conversa e ver o movimento no
//      relatório.
//
// OS CLIENTES SÃO PLANTADOS num telefone DESCOBERTO, e não escolhido a dedo —
// ver `o-funil-de-etapas`. Os movimentos levam data de dias atrás, como o
// gatilho do 017 teria deixado.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira — a lição das provas do "Já tratei".
const AGORA = Date.now();
const diasAtras = (d) => new Date(AGORA - d * 86400e3).toISOString();

/** O telefone que o painel ABRE, o departamento dele, e um telefone de OUTRO
 *  departamento (para o filtro). */
async function descobrir() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const T = globalThis.__TABELAS;
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (T.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    const outro = a && (T.advogados || []).find((x) => x.ativo !== false && x.departamento_id != null
      && String(x.departamento_id) !== String(a.departamento_id));
    const nomeDep = a && ((T.departamentos || []).find((d) => String(d.id) === String(a.departamento_id)) || {}).nome;
    return a ? { adv: a.id, dep: a.departamento_id, nomeDep,
                 outro: outro ? outro.id : null, outroNome: outro ? (outro.nome || outro.numero) : null } : null;
  });
  await ctx.close();
  return r;
}
const D = await descobrir();
ok("aprendi o telefone, o departamento e um telefone de outro departamento",
   Boolean(D && D.dep != null && D.nomeDep && D.outro), JSON.stringify(D));
if (!D || !D.nomeDep) { await nav.close(); process.exit(1); }
const ET = (n) => `et-${D.dep}-${n}`;   // 1 Novo contato · 2 Em atendimento · 4 Proposta/acordo enviado

const NOMES = { r1: "FUNIL RITA UM", r2: "FUNIL RAUL DOIS", r3: "FUNIL ROSA TRES", r4: "FUNIL RUI QUATRO", r5: "FUNIL RENATA CINCO" };
const NUM = { r1: "01", r2: "02", r3: "03", r4: "04", r5: "05" };
const contato = (k) => ({ id: `ct-${k}`, numero: `55119700066${NUM[k]}`, nome: NOMES[k], vantoro_nome: null,
                          nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k) => ({
  id: `cv-${k}`, advogado_id: D.adv, contato_id: `ct-${k}`, nao_lidas: 0, arquivada: false, fixada: false,
  favorita: false, ultima_atividade: new Date(AGORA + (k === "r5" ? 600e3 : 0)).toISOString(), ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: `55119700066${NUM[k]}`, foto_url: null },
});
const cartao = (k, etapa, dias) => ({ id: `cartao-${k}`, contato_id: `ct-${k}`, departamento_id: D.dep, etapa_id: etapa,
                                       criado_em: diasAtras(dias), movido_em: diasAtras(dias), movido_por: "u1" });
let nMov = 0;
const mov = (k, de, para, dias) => ({ id: `mov-${++nMov}`, contato_id: `ct-${k}`, departamento_id: D.dep,
                                      de_etapa: de, para_etapa: para, quem: "u1", quando: diasAtras(dias) });
const SEMENTE = {
  contatos: Object.keys(NOMES).map(contato),
  conversas: Object.keys(NOMES).map(conversa),
  mensagens: Object.keys(NOMES).map((k) => ({ id: `m-${k}`, conversa_id: `cv-${k}`, origem: "contato",
                                               tipo: "texto", texto: "oi", criado_em: new Date(AGORA - 60e3).toISOString() })),
  zorvin_cartoes: [
    cartao("r1", ET(4), 1),    // Novo (10d) → Em atendimento (6d) → Proposta (1d)
    cartao("r2", ET(2), 3),    // Novo (5d) → Em atendimento (3d), e está lá
    cartao("r3", ET(1), 40),   // Novo há 40 dias — antes do período
    cartao("r5", ET(1), 2),    // Novo há 2 dias — o do caminho inteiro
  ],
  zorvin_movimentos: [
    mov("r1", null, ET(1), 10), mov("r1", ET(1), ET(2), 6), mov("r1", ET(2), ET(4), 1),
    mov("r2", null, ET(1), 5), mov("r2", ET(1), ET(2), 3),
    mov("r3", null, ET(1), 40),
    mov("r4", null, ET(1), 2), mov("r4", ET(1), null, 1),   // entrou e saiu do funil
    mov("r5", null, ET(1), 2),
  ],
};

async function abrirPainel({ admin = true, semFuncao = false, falha = false, semFunil = false, largura = 1400 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__SEM_RELATORIO_FUNIL = d.semFuncao;
    globalThis.__RELATORIO_FUNIL_FALHA = d.falha;
    globalThis.__SEM_FUNIL = d.semFunil;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: admin ? SEMENTE
          // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO — sem ela não vê telefone
          // nenhum (a lição de `o-funil-de-etapas`).
          : { ...SEMENTE, permissoes: [{ id: 901, usuario_id: "u1", departamento_id: D.dep, telefone_id: null }] },
        admin, semFuncao, falha, semFunil });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function irAoPainel(page) {
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  await clicar(page.getByRole("button", { name: "Painel" }));
  await page.waitForSelector('[data-tela="painel"]').catch(() => {});
  await page.waitForTimeout(1500);
}

const S = "[data-relatorio-funil]";
const DEP = () => `${S} [data-funil-departamento="${D.nomeDep}"]`;
/** A linha de uma etapa, lida como a tela a mostra. */
const etapa = (page, nome) => page.evaluate(([sel, nome]) => {
  const tr = document.querySelector(`${sel} [data-funil-etapa="${nome}"]`);
  if (!tr) return null;
  const v = (a) => tr.querySelector(`[${a}]`)?.getAttribute(a);
  return { agora: v("data-agora"), agoraMediana: v("data-agora-mediana"), maisAntigo: v("data-mais-antigo"),
           entraram: v("data-entraram"), sairam: v("data-sairam"), tempo: v("data-tempo-mediana"),
           texto: tr.innerText };
}, [DEP(), nome]);
const resumo = (page) => page.evaluate((sel) => {
  const r = document.querySelector(`${sel} [data-funil-resumo]`);
  if (!r) return null;
  const v = (a) => r.querySelector(`[${a}]`)?.getAttribute(a);
  return { agora: v("data-funil-agora"), entraram: v("data-funil-entraram-no-funil"),
           sairam: v("data-funil-sairam-do-funil"), texto: r.innerText };
}, DEP());
const DIA = 86400;
const perto = (s, dias) => s !== "" && s != null && Math.abs(Number(s) - dias * DIA) < 120;

// ==================================================================
console.log("\nCada etapa: agora, há quanto tempo, e o período");
{
  const { ctx, page, estouros } = await abrirPainel();
  await irAoPainel(page);
  ok("a seção aparece", (await page.locator(S).count()) === 1);
  ok("o departamento do telefone aparece", (await page.locator(DEP()).count()) === 1, D.nomeDep);
  const novo = await etapa(page, "Novo contato");
  ok("Novo contato: 2 clientes agora", novo?.agora === "2", JSON.stringify(novo));
  ok("o mais parado está lá há 40 dias", novo?.maisAntigo === "40" && /há 40 dias/.test(novo?.texto || ""), novo?.maisAntigo);
  ok("no período, 4 entraram (o de 40 dias não)", novo?.entraram === "4", novo?.entraram);
  ok("e 3 saíram", novo?.sairam === "3", novo?.sairam);
  ok("quem saiu ficou 2 dias, na mediana (4, 2 e 1)", perto(novo?.tempo, 2), novo?.tempo);
  const at = await etapa(page, "Em atendimento");
  ok("Em atendimento: 1 agora, há 3 dias", at?.agora === "1" && perto(at?.agoraMediana, 3), JSON.stringify(at));
  ok("2 entraram e 1 saiu", at?.entraram === "2" && at?.sairam === "1");
  ok("o tempo é o de quem SAIU (5 dias), e não o de quem ficou", perto(at?.tempo, 5), at?.tempo);
  const pr = await etapa(page, "Proposta/acordo enviado");
  ok("Proposta: 1 agora, 1 entrou, ninguém saiu", pr?.agora === "1" && pr?.entraram === "1" && pr?.sairam === "0", JSON.stringify(pr));
  ok("e sem saída, o tempo é “—”, e não zero", pr?.tempo === "" && /—/.test(pr?.texto || ""), pr?.texto);
  const r = await resumo(page);
  ok("o resumo: 4 no funil agora", r?.agora === "4", JSON.stringify(r));
  ok("4 entraram no funil e 1 saiu", r?.entraram === "4" && r?.sairam === "1");
  const escopo = await page.locator(`${S} [data-funil-escopo]`).innerText().catch(() => "");
  ok("a seção diz o que é foto de agora e o que é do período",
     /Agora/.test(escopo) && /período/.test(escopo) && /quem saiu/.test(escopo), escopo);
  ok("as etapas vêm na ordem do funil", await page.evaluate((sel) =>
    [...document.querySelectorAll(`${sel} [data-funil-etapa]`)].map((t) => t.getAttribute("data-funil-etapa"))
      .slice(0, 3).join("|"), DEP()) === "Novo contato|Em atendimento|Aguardando cliente");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));

  // O PERÍODO MEXE SÓ NO QUE É DO PERÍODO.
  await clicar(page.locator('[data-teste="abrir-periodo"]'));
  await page.waitForTimeout(200);
  await clicar(page.locator('[data-grupo="periodo"]').getByRole("button", { name: "Hoje", exact: true }));
  await page.waitForTimeout(1500);
  const hoje = await etapa(page, "Novo contato");
  ok("em “Hoje”, ninguém entrou nem saiu", hoje?.entraram === "0" && hoje?.sairam === "0", JSON.stringify(hoje));
  ok("e o “agora” continua 2", hoje?.agora === "2");
  await ctx.close();
}

// ==================================================================
console.log("\nO filtro de telefone da barra recorta");
{
  const { ctx, page } = await abrirPainel();
  await irAoPainel(page);
  await clicar(page.locator('[data-grupo="telefone"] > button'));
  await page.waitForTimeout(200);
  await clicar(page.locator('[data-grupo="telefone"]').getByRole("button", { name: D.outroNome }));
  await page.waitForTimeout(1500);
  ok("com o telefone de outro departamento, o funil deste sai", (await page.locator(DEP()).count()) === 0);
  ok("e o daquele, sem ninguém, é uma linha só — e não uma tabela de zeros",
     (await page.locator(`${S} [data-funil-vazio]`).count()) === 1
     && (await page.locator(`${S} [data-funil-etapa]`).count()) === 0);
  const esc = await page.locator(`${S} [data-funil-escopo]`).innerText().catch(() => "");
  ok("e a seção diz que recortou pelo telefone", /telefone escolhido/.test(esc), esc);
  await ctx.close();
}

// ==================================================================
console.log("\nQuem não administra vê o funil do que atende");
{
  const { ctx, page, estouros } = await abrirPainel({ admin: false });
  await irAoPainel(page);
  ok("a seção aparece", (await page.locator(S).count()) === 1);
  ok("com o departamento que atende", (await page.locator(DEP()).count()) === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem a função, sem o funil, e com a função falhando");
{
  const { ctx, page } = await abrirPainel({ semFuncao: true });
  await irAoPainel(page);
  const t = await page.locator(`${S} [data-funil-falta]`).innerText().catch(() => "");
  ok("quem administra lê qual script falta (019)", /019-o-relatorio-do-funil\.sql/.test(t), t);
  ok("e o resto do painel continua", (await page.locator("[data-relatorio-responsaveis]").count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ semFuncao: true, admin: false });
  await irAoPainel(page);
  ok("quem atende não vê aviso de script nenhum", (await page.locator(S).count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ semFunil: true });
  await irAoPainel(page);
  const t = await page.locator(`${S} [data-funil-falta]`).innerText().catch(() => "");
  ok("sem o funil, a tela aponta o 017", /017-o-funil-de-etapas\.sql/.test(t), t);
  ok("e não desenha etapa nenhuma", (await page.locator(`${S} [data-funil-etapa]`).count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel({ falha: true });
  await irAoPainel(page);
  const t = await page.locator(`${S} [data-funil-erro]`).innerText().catch(() => "");
  ok("com a função falhando, a tela diz — com o código", /57014/.test(t), t);
  ok("e não finge funil vazio", (await page.locator(`${S} [data-funil-etapa]`).count()) === 0
     && (await page.locator(`${S} [data-funil-sem-departamento]`).count()) === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nO caminho inteiro: mudar a etapa na conversa e ver no relatório");
{
  // 1920: a esta largura a etapa na linha do número é escrita, e não ícone.
  const { ctx, page, estouros } = await abrirPainel({ largura: 1920 });
  let moveu = false;
  if (await clicar(page.locator(`[data-conversa-nome="${NOMES.r5}"]`))) {
    await page.waitForTimeout(900);
    if (await clicar(page.locator("button[data-etapa-da-conversa]"))) {
      await page.waitForTimeout(300);
      moveu = await clicar(page.locator('[data-escolher-etapa="Em atendimento"]'));
      await page.waitForTimeout(1200);
    }
  }
  ok("mudei a etapa da Renata para Em atendimento", moveu);
  const noBanco = await page.evaluate(() => (globalThis.__TABELAS.zorvin_movimentos || [])
    .filter((m) => m.contato_id === "ct-r5").length);
  ok("e o movimento foi registrado, como o gatilho faz", noBanco === 2, String(noBanco));
  await irAoPainel(page);
  const at = await etapa(page, "Em atendimento");
  ok("Em atendimento passou a 2 agora, e 3 entraram", at?.agora === "2" && at?.entraram === "3", JSON.stringify(at));
  const novo = await etapa(page, "Novo contato");
  ok("Novo contato: 1 agora, e 4 saíram", novo?.agora === "1" && novo?.sairam === "4", JSON.stringify(novo));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
