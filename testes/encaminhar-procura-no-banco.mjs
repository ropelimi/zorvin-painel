// ENCAMINHAR PROCURA NO TELEFONE INTEIRO, e não só na lista carregada
// (auditoria de 28/10)
//
// A janela "Encaminhar para" procurava o destino em `conversas` — a aba que
// está aberta, e só as páginas que a lista já trouxe. Quem quisesse mandar a
// mensagem para um cliente em "Finalizados", ou para um que não fala há
// meses, lia "Nenhuma conversa encontrada.": a tela afirmando que o cliente
// não existe, quando ele estava a uma consulta de distância. É o defeito que
// a busca da lista teve e consertou indo ao banco (`buscar_conversas`).
//
// O QUE ESTA PROVA GUARDA: o destino em "Finalizados" aparece; o que mora
// além das páginas lidas também, e a mensagem vai para ele; e, com o banco
// falhando, a janela não diz "Nenhuma conversa encontrada." — diz que não
// conseguiu procurar.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const contato = (id, numero, nome) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null, foto_url: null });
const conversa = (id, adv, ct, campos) => ({
  id, advogado_id: adv, contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null, ultima_mensagem: "oi",
  contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null }, ...campos,
});
const msg = (id, conv, texto, campos = {}) => ({ id, conversa_id: conv, origem: "contato", tipo: "texto", texto,
  criado_em: new Date(AGORA - 3600e3).toISOString(), id_uazapi: `ID-${id}`, ...campos });
const CT = {
  origem: contato("ct-enc-origem", "5511970009901", "ORIGEM DO ENCAMINHAR"),
  fim: contato("ct-enc-fim", "5511970009902", "FLAVIO FINALIZADO DESTINO"),
};
const SEMENTE = {
  contatos: Object.values(CT),
  conversas: [
    conversa("cv-enc-origem", "a7", CT.origem, { ultima_atividade: new Date(AGORA + 600e3).toISOString() }),
    // EM "FINALIZADOS": a lista abre em "Em Atendimento", e esta não vem nela.
    conversa("cv-enc-fim", "a7", CT.fim, { situacao: "finalizado", ultima_atividade: new Date(AGORA - 86400e3).toISOString() }),
  ],
  mensagens: [
    msg("m-enc-1", "cv-enc-origem", "Segue o comprovante do pagamento"),
    msg("m-enc-2", "cv-enc-fim", "obrigado"),
    // Uma mensagem na conversa 5 do telefone de 1.200, para abrir o menu de lá.
    msg("m-enc-a13", "a13-c5", "Documento para encaminhar"),
  ],
};

async function abrir({ quebrarFuncao = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__QUEBRAR_FUNCAO = d.quebrarFuncao;
  }, { semente: SEMENTE, quebrarFuncao });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
async function clicar(page, seletor) {
  const el = page.locator(seletor);
  if (!(await el.count())) return false;
  try { await el.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
/** Abre a conversa, o menu da mensagem e o "Encaminhar". */
async function encaminharDe(page, conversaId, msgId) {
  if (!(await clicar(page, `[data-conversa-id="${conversaId}"]`))) return false;
  await page.waitForTimeout(1500);
  await page.locator(`[data-msg-id="${msgId}"]`).hover({ timeout: 3000 }).catch(() => {});
  if (!(await clicar(page, `[data-msg-id="${msgId}"] button[aria-label="Opções da mensagem"]`))) return false;
  await page.waitForTimeout(300);
  return clicar(page, 'div[data-menu-msg] button:has-text("Encaminhar")');
}
const pesquisar = async (page, termo) => {
  await page.locator('input[placeholder="Pesquisar conversa"]').fill(termo).catch(() => {});
  await page.waitForTimeout(2500);
};
const destinos = (page) => page.locator("[data-encaminhar-para]").evaluateAll((els) => els.map((e) => e.getAttribute("data-encaminhar-para")));

// ==================================================================
console.log("\n1. O destino que está em “Finalizados”");
{
  const { ctx, page, estouros } = await abrir();
  ok("abri o Encaminhar de uma mensagem", await encaminharDe(page, "cv-enc-origem", "m-enc-1"));
  await pesquisar(page, "FLAVIO");
  const d = await destinos(page);
  ok("a conversa finalizada aparece como destino", d.includes("cv-enc-fim"), JSON.stringify(d));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. O destino que mora além das páginas lidas — e a mensagem vai para ele");
{
  const { ctx, page, estouros } = await abrir();
  ok("fui ao telefone de 1.200 conversas", await clicar(page, '[data-telefone="Arquivo"]'));
  await page.waitForTimeout(3000);
  ok("abri o Encaminhar de uma mensagem", await encaminharDe(page, "a13-c5", "m-enc-a13"));
  await pesquisar(page, "ZULMIRA");
  const d = await destinos(page);
  ok("a ZULMIRA, a conversa 1.150, aparece como destino", d.includes("a13-c1150"), JSON.stringify(d));
  ok("escolhi a ZULMIRA", await clicar(page, '[data-encaminhar-para="a13-c1150"]'));
  await page.waitForTimeout(1500);
  const foi = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || [])
    .some((f) => String(f.conversa_id) === "a13-c1150" && /Documento para encaminhar/.test(f.texto || "")));
  ok("e a mensagem entrou na fila para a conversa dela", foi);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Com o banco falhando, a janela não afirma que não há ninguém");
{
  const { ctx, page, estouros } = await abrir({ quebrarFuncao: ["buscar_conversas"] });
  ok("abri o Encaminhar de uma mensagem", await encaminharDe(page, "cv-enc-origem", "m-enc-1"));
  await pesquisar(page, "FLAVIO");
  const janela = await page.locator('input[placeholder="Pesquisar conversa"]').locator("xpath=ancestor::div[3]")
    .innerText().catch(() => "");
  ok("não diz “Nenhuma conversa encontrada.”", !/Nenhuma conversa encontrada/.test(janela), janela);
  ok("diz que não conseguiu procurar", /Não consegui procurar/.test(janela), janela);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
