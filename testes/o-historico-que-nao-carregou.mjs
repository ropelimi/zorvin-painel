// O HISTÓRICO QUE NÃO CARREGOU DIZ ISSO — e não derruba o painel (auditoria de 28/10)
//
// O histórico de atendimento mostra, por telefone, a PRIMEIRA e a ÚLTIMA
// mensagem que a equipe mandou ao cliente. São duas consultas separadas (uma
// em cada sentido), na ponte e no caminho de reserva do painel — e o `error`
// de cada uma era ignorado. Com uma delas falhando e a outra não, a linha
// chegava com uma ponta só, e a tela supunha as duas:
//
//   `l.primeira.enviado_por` / `ultima.ultima.criado_em`  →  TypeError
//
// no MEIO DO DESENHO. Sem um limite de erro em volta, o React desmonta a
// árvore inteira: o painel ficava BRANCO até o F5, por causa de um tropeço de
// rede numa tela secundária. E com as duas falhando no caminho de reserva, a
// tela afirmava "Ninguém do escritório enviou mensagem para este cliente
// ainda" — a armadilha nº 2: falha desenhada como ausência.
//
// Na mesma tela, o "Já tratei": quando a lista de assuntos não carregava, cada
// registro aparecia como "assunto removido" — dizendo que alguém APAGOU o que
// só não veio.
//
// O QUE ESTA PROVA GUARDA:
//   1. com uma ponta só (a ponte devolvendo `primeira` sem `ultima`, ou o
//      contrário), o painel não estoura, e a linha daquele telefone diz que não
//      conseguiu ler;
//   2. sem a ponte e com a leitura das mensagens caindo, a tela diz que não
//      conseguiu ler, com o código — e NÃO diz que ninguém mandou nada;
//   3. a primeira e a última continuam aparecendo quando vêm as duas;
//   4. assunto que não carregou é "não carregado", e não "removido" — e abrir
//      o histórico de novo relê a lista; o assunto apagado de verdade continua
//      "assunto removido".
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();

/** O telefone que o painel abre, e outro — descobertos, e não escolhidos. */
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
    const outro = c && (T.advogados || []).find((x) => String(x.id) !== String(c.advogado_id) && x.ativo !== false);
    return a && outro ? { adv: a.id, advNome: a.nome, advNumero: a.numero,
                          outro: outro.id, outroNome: outro.nome, outroNumero: outro.numero } : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefones();
ok("aprendi os dois telefones", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const HILDA = "HILDA DO HISTÓRICO";
const conversa = (id, adv) => ({
  id, advogado_id: adv, contato_id: "ct-hilda", nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: H(0.02), esperando_desde: null, tratada_em: null, situacao: "aberto", protocolo: null,
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: "ct-hilda", nome: HILDA, numero: "5511970006601", foto_url: null },
});
const ENVIO = (h) => ({ texto: "Recebemos", criado_em: H(h), enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", enviado_por_foto: null });
const SEMENTE = {
  contatos: [{ id: "ct-hilda", numero: "5511970006601", nome: HILDA }],
  conversas: [conversa("cv-hi1", TEL.adv), conversa("cv-hi2", TEL.outro)],
  mensagens: [
    { id: "m-hi1", conversa_id: "cv-hi1", origem: "contato", tipo: "texto", texto: "oi", criado_em: H(0.02) },
    { id: "m-hi1b", conversa_id: "cv-hi1", origem: "advogado", tipo: "texto", texto: "Recebemos", criado_em: H(30),
      enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" },
  ],
  zorvin_tratamentos: [
    { id: "th-a", conversa_id: "cv-hi1", assunto_id: "as-6", quem: "u1", quando: H(5) },
    // UM ASSUNTO APAGADO DE VERDADE — este continua "assunto removido".
    { id: "th-b", conversa_id: "cv-hi1", assunto_id: "as-que-nao-existe-mais", quem: "u1", quando: H(50) },
  ],
};

/** O painel, com a ponte respondendo `linhas(conversa)` para cada conversa
 *  da Hilda — ou caindo, com `ponte = false`. */
async function abrirPainel({ ponte = true, linhas = null, quebrar = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__QUEBRAR = d.quebrar;
    globalThis.__RECUSAR_LEITURA = [];
  }, { semente: SEMENTE, quebrar });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const m = url.pathname.match(/\/historico\/contato\/([^/]+)(\/quantas)?$/);
    if (m) {
      if (!ponte) return rota.abort();
      const convs = SEMENTE.conversas.filter((c) => c.contato_id === decodeURIComponent(m[1]));
      if (m[2]) {
        return rota.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, conversas: convs.length, telefones: convs.length }) });
      }
      const corpo = convs.map((c) => {
        const deMim = c.advogado_id === TEL.adv;
        return { conversa_id: c.id, advogado_id: c.advogado_id,
                 advogado_nome: deMim ? TEL.advNome : TEL.outroNome,
                 advogado_numero: deMim ? TEL.advNumero : TEL.outroNumero,
                 ...(linhas ? linhas(c) : { primeira: null, ultima: null }) };
      });
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, linhas: corpo }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** Abre a conversa da Hilda e o histórico dela. */
async function abrirHistorico(page, { antes = null } = {}) {
  const linha = page.locator(`[data-conversa-nome="${HILDA}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  const botao = page.locator('button[title^="Histórico de atendimento"]');
  if (!(await botao.count())) return false;
  if (antes) await antes();
  await botao.first().click();
  // ATÉ O "LEVANTANDO…" SAIR. Sem a ponte, o caminho de reserva lê a lista de
  // conversas e duas pontas por telefone, cada uma com o atraso da bancada.
  for (let i = 0; i < 40 && /Levantando/.test(await textoDoHistorico(page)); i++) await page.waitForTimeout(200);
  await page.waitForTimeout(300);
  return true;
}

/** O texto da coluna do histórico — o que está entre o título e o fim dela. */
const textoDoHistorico = (page) => page.evaluate(() => {
  const titulo = [...document.querySelectorAll("span")].find((s) => s.textContent === "Histórico de atendimento");
  const coluna = titulo && titulo.parentElement && titulo.parentElement.parentElement;
  return coluna ? coluna.innerText : "";
});
const painelDePe = async (page) => (await page.locator("[data-conversa-nome]").count()) > 0;

// ==================================================================
console.log("\nA ponte devolve a ÚLTIMA sem a PRIMEIRA (uma das consultas dela falhou)");
{
  const { ctx, page, estouros } = await abrirPainel({
    linhas: (c) => (c.advogado_id === TEL.adv ? { primeira: null, ultima: ENVIO(30) } : { primeira: null, ultima: null }) });
  ok("o histórico abre", await abrirHistorico(page));
  ok("o painel continua de pé (nada de tela branca)", await painelDePe(page), estouros.join(" | "));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  const t = await textoDoHistorico(page);
  ok("a linha do telefone diz que não conseguiu ler", /não consegui ler/i.test(t), t.slice(-500));
  ok('e a tela NÃO diz que ninguém enviou nada', !/Ninguém do escritório enviou/i.test(t), t.slice(-500));
  await ctx.close();
}

// ==================================================================
console.log("\nA ponte devolve a PRIMEIRA sem a ÚLTIMA");
{
  const { ctx, page, estouros } = await abrirPainel({
    linhas: (c) => (c.advogado_id === TEL.adv ? { primeira: ENVIO(30), ultima: null } : { primeira: null, ultima: null }) });
  ok("o histórico abre", await abrirHistorico(page));
  ok("o painel continua de pé", await painelDePe(page), estouros.join(" | "));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  ok("a linha do telefone diz que não conseguiu ler", /não consegui ler/i.test(await textoDoHistorico(page)),
     (await textoDoHistorico(page)).slice(-500));
  await ctx.close();
}

// ==================================================================
console.log("\nUm telefone com as duas pontas, outro com uma só");
{
  const { ctx, page, estouros } = await abrirPainel({
    linhas: (c) => (c.advogado_id === TEL.adv ? { primeira: ENVIO(30), ultima: ENVIO(2) } : { primeira: null, ultima: ENVIO(1) }) });
  ok("o histórico abre", await abrirHistorico(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  const t = await textoDoHistorico(page);
  ok("a primeira e a última aparecem, pelo telefone que veio inteiro",
     /Primeira mensagem enviada/i.test(t) && /Última mensagem enviada/i.test(t), t.slice(-500));
  ok("e o outro telefone diz que não conseguiu ler", /não consegui ler/i.test(t), t.slice(-500));
  await ctx.close();
}

// ==================================================================
console.log("\nSem a ponte, e com a leitura das mensagens caindo");
{
  const { ctx, page, estouros } = await abrirPainel({ ponte: false });
  ok("o histórico abre", await abrirHistorico(page, {
    // A LEITURA CAI DEPOIS DE A CONVERSA ABRIR: é a das pontas que falha.
    antes: () => page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["mensagens"]; }) }));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  const t = await textoDoHistorico(page);
  ok("diz que não conseguiu ler", /não consegui ler/i.test(t), t.slice(-500));
  ok("com o código do banco", /PGRST301/.test(t), t.slice(-500));
  ok("e NÃO diz que ninguém enviou nada", !/Ninguém do escritório enviou/i.test(t), t.slice(-500));
  await ctx.close();
}

// ==================================================================
console.log("\nO contraste: com tudo de pé, a primeira e a última aparecem");
{
  const { ctx, page, estouros } = await abrirPainel({ ponte: false });
  ok("o histórico abre", await abrirHistorico(page));
  const t = await textoDoHistorico(page);
  ok("pelo caminho de reserva, a primeira e a última aparecem",
     /Primeira mensagem enviada/i.test(t) && /Última mensagem enviada/i.test(t), t.slice(-500));
  ok("e nenhum telefone diz que não conseguiu ler", !/não consegui ler/i.test(t), t.slice(-500));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nO assunto que não carregou não vira \"assunto removido\"");
{
  const { ctx, page, estouros } = await abrirPainel({ quebrar: ["zorvin_assuntos"] });
  ok("o histórico abre", await abrirHistorico(page));
  const chips = () => page.$$eval("[data-historico-ja-tratei] [data-assunto-no-historico]",
    (ns) => ns.map((n) => n.textContent.trim()));
  const antes = await chips();
  ok("os dois registros aparecem", antes.length === 2, JSON.stringify(antes));
  ok('sem a lista de assuntos, nenhum vira "assunto removido"', antes.length === 2 && !antes.includes("assunto removido"),
     JSON.stringify(antes));
  ok('e os dois dizem que não carregaram', antes.length === 2 && antes.every((c) => /não carregado/i.test(c)),
     JSON.stringify(antes));

  // ABRIR DE NOVO RELÊ — com o banco de volta.
  await page.evaluate(() => { globalThis.__QUEBRAR = []; });
  const botao = page.locator('button[title^="Histórico de atendimento"]').first();
  await botao.click();
  await page.waitForTimeout(400);
  await botao.click();
  await page.waitForTimeout(1800);
  const depois = await chips();
  ok("reaberto o histórico, o assunto aparece pelo nome", depois.includes("ACORDOS"), JSON.stringify(depois));
  ok('e o apagado de verdade continua "assunto removido"', depois.includes("assunto removido"), JSON.stringify(depois));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
