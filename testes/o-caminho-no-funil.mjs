// O CAMINHO DO CLIENTE NO FUNIL — no histórico de atendimento (07/10)
//
// Pedido do Rodrigo: ver por onde o cliente passou no funil, quem o moveu e
// quanto tempo ele ficou em cada etapa. O banco já guardava cada passo
// (`zorvin_movimentos`, script 017); a tela não mostrava nenhum.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a seção aparece no histórico, um caminho por departamento, o
//      departamento mexido por último primeiro;
//   2. cada passo diz quem moveu (o Zorvin, quando o cliente entrou sozinho;
//      "Você"; o nome do colega), de onde e para onde, do mais recente para
//      o mais antigo;
//   3. "ficou N dias em X" sai da ÚLTIMA chegada a X até a saída — inclusive
//      numa etapa desativada, que continua tendo nome;
//   4. onde o cliente está AGORA, e "fora do funil" quando o último passo foi
//      uma saída;
//   5. passos de outro cliente não entram;
//   6. sem passo nenhum, a seção diz isso; com a leitura FALHANDO, diz que
//      falhou, com o código — e nunca "ainda não passou pelo funil";
//   7. sem o funil (script 017), a seção não existe;
//   8. o caminho inteiro: mudar a etapa na conversa com o histórico aberto, e
//      o passo novo aparecer na hora.
//
// OS CLIENTES SÃO PLANTADOS num telefone DESCOBERTO (a régua de
// `o-relatorio-do-funil`), e os passos levam data de dias atrás, como o
// gatilho do 017 teria deixado.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const diasAtras = (d) => new Date(AGORA - d * 86400e3).toISOString();

/** O telefone que o painel ABRE, o departamento dele, e um OUTRO departamento. */
async function descobrir() {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const T = globalThis.__TABELAS;
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (T.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    const nome = (id) => ((T.departamentos || []).find((d) => String(d.id) === String(id)) || {}).nome;
    const outro = a && (T.departamentos || []).find((d) => String(d.id) !== String(a.departamento_id));
    return a ? { adv: a.id, dep: a.departamento_id, nomeDep: nome(a.departamento_id),
                 outroDep: outro ? outro.id : null, nomeOutro: outro ? outro.nome : null } : null;
  });
  await ctx.close();
  return r;
}
const D = await descobrir();
ok("aprendi o telefone, o departamento e um outro departamento",
   Boolean(D && D.dep != null && D.nomeDep && D.outroDep != null), JSON.stringify(D));
if (!D || !D.nomeDep) { await nav.close(); process.exit(1); }
const ET = (n, dep = D.dep) => `et-${dep}-${n}`;   // 1 Novo contato · 2 Em atendimento · 4 Proposta/acordo enviado
const DESATIVADA = `et-${D.dep}-velha`;

const ANA = "CAMINHO ANA", BETO = "CAMINHO BETO", CIDA = "CAMINHO CIDA";
const NUM = { ana: "01", beto: "02", cida: "03" };
const NOMES = { ana: ANA, beto: BETO, cida: CIDA };
const contato = (k) => ({ id: `ct-${k}`, numero: `55119700077${NUM[k]}`, nome: NOMES[k], vantoro_nome: null,
                          nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k) => ({
  id: `cv-${k}`, advogado_id: D.adv, contato_id: `ct-${k}`, nao_lidas: 0, arquivada: false, fixada: false,
  favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(), ultima_mensagem: "oi",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: `55119700077${NUM[k]}`, foto_url: null },
});
let nMov = 0;
const mov = (k, de, para, dias, quem, dep = D.dep) => ({
  id: `mov-cam-${++nMov}`, contato_id: `ct-${k}`, departamento_id: dep,
  de_etapa: de, para_etapa: para, quem, quando: diasAtras(dias) });

const SEMENTE = {
  contatos: ["ana", "beto", "cida"].map(contato),
  conversas: ["ana", "beto", "cida"].map(conversa),
  mensagens: ["ana", "beto", "cida"].map((k) => ({ id: `m-cam-${k}`, conversa_id: `cv-${k}`, origem: "contato",
                                                    tipo: "texto", texto: "oi", criado_em: new Date(AGORA - 60e3).toISOString() })),
  // UMA ETAPA DESATIVADA — continua tendo nome, e é por isso que não se apaga.
  zorvin_etapas: [{ id: DESATIVADA, departamento_id: D.dep, nome: "Triagem antiga", cor: "#999999",
                    ordem: 5, ativo: false, criado_em: "2026-09-01T10:00:00Z" }],
  zorvin_cartoes: [
    { id: "cartao-ana", contato_id: "ct-ana", departamento_id: D.dep, etapa_id: ET(2),
      criado_em: diasAtras(10), movido_em: diasAtras(2), movido_por: "u1" },
  ],
  zorvin_movimentos: [
    // ANA no departamento do telefone: entrou sozinha, a Jenifer moveu,
    // eu movi para a desativada e de volta.
    mov("ana", null, ET(1), 10, null),
    mov("ana", ET(1), ET(2), 7, "u-jenifer"),        // ficou 3 dias em Novo contato
    mov("ana", ET(2), DESATIVADA, 4, "u1"),          // ficou 3 dias em Em atendimento
    mov("ana", DESATIVADA, ET(2), 2, "u1"),          // ficou 2 dias na desativada
    // ANA noutro departamento: entrou e saiu, há mais tempo.
    mov("ana", null, ET(1, D.outroDep), 12, "u1", D.outroDep),
    mov("ana", ET(1, D.outroDep), null, 11, "u-jenifer", D.outroDep),   // ficou 1 dia
    // CIDA, no mesmo departamento — não pode aparecer no caminho da Ana.
    mov("cida", null, ET(1), 3, null),
    mov("cida", ET(1), ET(4), 1, "u1"),
  ],
};

async function abrirPainel({ admin = true, recusar = [], semFunil = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = d.admin;
    globalThis.__SEM_FUNIL = d.semFunil;
    globalThis.__RECUSAR_LEITURA = d.recusar;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: admin ? SEMENTE
          // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO — sem ela não vê telefone nenhum.
          : { ...SEMENTE, permissoes: [{ id: 902, usuario_id: "u1", departamento_id: D.dep, telefone_id: null }] },
        admin, recusar, semFunil });
  // A PONTE NÃO RESPONDE: o histórico cai no caminho parcial, que lê do banco
  // o que alcança. O caminho no funil não depende dela — é por contato.
  await page.route("**/ponte-de-mentira/**", (rota) => rota.abort());
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function abrirHistorico(page, nome) {
  if (!(await clicar(page.locator(`[data-conversa-nome="${nome}"]`)))) return false;
  await page.waitForTimeout(900);
  if (!(await clicar(page.locator('button[title^="Histórico de atendimento"]')))) return false;
  await page.waitForTimeout(1500);
  return true;
}

const S = "[data-historico-funil]";
const textoDaSecao = (page) => page.locator(S).innerText().catch(() => "");
const grupos = (page) => page.$$eval(`${S} [data-caminho-do-departamento]`, (ns) => ns.map((n) => ({
  dep: n.getAttribute("data-caminho-do-departamento"),
  // ESPAÇO NORMALIZADO: o nome da etapa é um bloco em linha com a bolinha, e
  // o `innerText` o separa em linhas que a tela não mostra.
  agora: (n.querySelector("[data-onde-esta-agora]")?.innerText || "").replace(/\s+/g, " "),
  passos: [...n.querySelectorAll("[data-passo-no-caminho]")].map((p) => ({
    tipo: p.getAttribute("data-passo-no-caminho"),
    texto: p.innerText.replace(/\s+/g, " "),
    ficou: p.querySelector("[data-ficou-na-etapa]")?.innerText || "",
  })),
}))).catch(() => []);

// ==================================================================
console.log("\nO caminho da cliente aparece no histórico, por departamento");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("o histórico abre", await abrirHistorico(page, ANA));
  ok("a seção do caminho no funil aparece", (await page.locator(S).count()) === 1);
  const gs = await grupos(page);
  ok("dois departamentos, o mexido por último primeiro",
     gs.length === 2 && gs[0].dep === String(D.dep) && gs[1].dep === String(D.outroDep), JSON.stringify(gs.map((g) => g.dep)));
  const t = await textoDaSecao(page);
  ok("com o nome de cada departamento", t.includes(D.nomeDep) && t.includes(D.nomeOutro), t.slice(0, 200));

  const [aqui, la] = gs;
  ok("diz onde ela está agora, e há quanto tempo",
     aqui && /Agora em\s+Em atendimento\s*· há 2 dias/.test(aqui.agora), aqui?.agora);
  ok("quatro passos neste departamento, do mais recente ao mais antigo",
     aqui && aqui.passos.map((p) => p.tipo).join(",") === "moveu,moveu,moveu,entrou",
     aqui?.passos.map((p) => p.tipo).join(","));
  const [p1, p2, p3, p4] = aqui?.passos || [];
  ok("o mais recente: eu, da desativada para Em atendimento",
     p1 && /^Você moveu de\s+Triagem antiga \(desativada\)\s+para\s+Em atendimento/.test(p1.texto), p1?.texto);
  ok("e quanto tempo ela ficou na etapa desativada",
     p1 && p1.ficou === "ficou 2 dias em Triagem antiga", p1?.ficou);
  ok("antes: eu, de Em atendimento para a desativada, depois de 3 dias lá",
     p2 && /Você moveu de\s+Em atendimento\s+para\s+Triagem antiga/.test(p2.texto)
       && p2.ficou === "ficou 3 dias em Em atendimento", `${p2?.texto} | ${p2?.ficou}`);
  ok("a Jenifer, com o nome dela, depois de 3 dias em Novo contato",
     p3 && /^JENIFER ALMEIDA moveu de\s+Novo contato\s+para\s+Em atendimento/.test(p3.texto)
       && p3.ficou === "ficou 3 dias em Novo contato", `${p3?.texto} | ${p3?.ficou}`);
  ok("e a entrada: sozinha, quando escreveu pela primeira vez — sem tempo inventado",
     p4 && /Entrou no funil em\s+Novo contato, sozinho/.test(p4.texto) && p4.ficou === "", p4?.texto);

  ok("no outro departamento: fora do funil agora", la && /Fora do funil agora/.test(la.agora), la?.agora);
  ok("com a saída dita, e quanto ficou",
     la && la.passos[0]?.tipo === "saiu" && /JENIFER ALMEIDA tirou do funil, de\s+Novo contato/.test(la.passos[0].texto)
       && la.passos[0].ficou === "ficou 1 dia em Novo contato", JSON.stringify(la?.passos[0]));
  ok("e a entrada, por mim", la && /^Você pôs no funil em\s+Novo contato/.test(la.passos[1]?.texto || ""), la?.passos[1]?.texto);

  ok("os passos da Cida não entram no caminho da Ana",
     gs.reduce((n, g) => n + g.passos.length, 0) === 6 && !t.includes("Proposta"));
  ok("quem administra não lê o aviso de recorte", !/Só dos departamentos que você atende/.test(t));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem passo nenhum, a seção diz isso");
{
  const { ctx, page } = await abrirPainel();
  ok("o histórico abre", await abrirHistorico(page, BETO));
  const t = await textoDaSecao(page);
  ok("diz que ele ainda não passou pelo funil", (await page.locator(`${S} [data-historico-funil-vazio]`).count()) === 1, t);
  ok("e nenhum passo aparece", (await grupos(page)).length === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nA leitura que falha diz que falhou");
{
  const { ctx, page } = await abrirPainel({ recusar: ["zorvin_movimentos"] });
  await abrirHistorico(page, ANA);
  const t = await textoDaSecao(page);
  ok("a seção aparece", (await page.locator(S).count()) === 1);
  ok("diz que não conseguiu ler", (await page.locator(`${S} [data-historico-funil-erro]`).count()) === 1, t);
  ok("com o código do banco", /\(erro PGRST301\)/.test(t), t);
  ok("e não diz que ele nunca passou pelo funil", !/ainda não passou/.test(t), t);
  ok("nem desenha caminho", (await grupos(page)).length === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nE as etapas que não carregam também são ditas");
{
  const { ctx, page } = await abrirPainel({ recusar: ["zorvin_etapas"] });
  await abrirHistorico(page, ANA);
  const t = await textoDaSecao(page);
  ok("diz que não conseguiu ler as etapas", /etapas do caminho/.test(t) || /Não consegui ler as etapas/.test(t), t);
  ok("e não desenha um caminho de etapas sem nome", (await grupos(page)).length === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nSem o funil (script 017), a seção não existe");
{
  const { ctx, page } = await abrirPainel({ semFunil: true });
  ok("o histórico abre", await abrirHistorico(page, ANA));
  ok("a seção do caminho não aparece", (await page.locator(S).count()) === 0);
  ok("e o resto do histórico continua lá",
     (await page.getByText("Histórico de atendimento", { exact: true }).count()) >= 1);
  await ctx.close();
}

// ==================================================================
console.log("\nQuem não administra lê que o caminho é dos departamentos que atende");
{
  const { ctx, page } = await abrirPainel({ admin: false });
  ok("o histórico abre", await abrirHistorico(page, ANA));
  const t = await textoDaSecao(page);
  ok("o aviso de recorte aparece", /Só dos departamentos que você atende/.test(t), t.slice(-200));
  await ctx.close();
}

// ==================================================================
console.log("\nO caminho inteiro: mudar a etapa com o histórico aberto");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("o histórico abre", await abrirHistorico(page, ANA));
  let moveu = false;
  if (await clicar(page.locator("button[data-etapa-da-conversa]"))) {
    await page.waitForTimeout(300);
    moveu = await clicar(page.locator('[data-escolher-etapa="Proposta/acordo enviado"]'));
    await page.waitForTimeout(1500);
  }
  ok("mudei a etapa da Ana para Proposta/acordo enviado", moveu);
  const gs = await grupos(page);
  const p1 = gs[0]?.passos[0];
  ok("o passo novo aparece no alto, na hora",
     p1 && /^Você moveu de\s+Em atendimento\s+para\s+Proposta\/acordo enviado/.test(p1.texto), p1?.texto);
  ok("com quanto tempo ela ficou em Em atendimento", p1 && p1.ficou === "ficou 2 dias em Em atendimento", p1?.ficou);
  ok("e o \"agora\" acompanha", /Agora em\s+Proposta\/acordo enviado/.test(gs[0]?.agora || ""), gs[0]?.agora);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
