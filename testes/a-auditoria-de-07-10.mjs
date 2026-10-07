// A AUDITORIA DE 07/10 — uma conferência para cada conserto que tem cara na tela
//
// Pedido do Rodrigo: "faz uma auditoria completa, em todos os arquivos e todas
// as telas". A varredura achou defeitos que nenhuma prova via, e cada um deles
// tem aqui a cena que o reproduz. As que dependem de tempo de rede (a ficha que
// pintava o cliente da conversa anterior, a releitura do funil por cima de um
// movimento) ficam escritas no código, ao lado do conserto.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a lista de conversas que não carrega DIZ que não carregou, em vez de
//      "Carregando…" para sempre;
//   2. o "renomear" aberto numa conversa não atravessa para a seguinte;
//   3. Esc com a janela do "Já tratei" aberta fecha a JANELA, e não a conversa;
//   4. o menu ⋮ do alto abre ABAIXO do botão, e não por cima dele;
//   5. os assuntos do "Já tratei" que não carregaram são ditos na janela, em
//      vez de "Nenhum assunto cadastrado";
//   6. fechar "Departamentos e acessos" com a releitura falhando não apaga os
//      telefones da barra;
//   7. a agenda acha o contato pelo nome do CADASTRO, e não só pelo do WhatsApp;
//   8. "Voltar para a fila" desfaz só o ÚLTIMO "Já tratei", e não os antigos;
//   9. o atalho "7 dias" do Painel cobre 7 dias, e não 8;
//  10. uma tarefa atrasada se edita sem trocar a hora — e a hora fica a mesma.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const atras = (ms) => new Date(AGORA - ms).toISOString();
const HORA = 3600e3, DIA = 86400e3;

/** O telefone que o painel abre — os clientes desta prova moram nele. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const ADV = await telefoneQueAbre();
ok("aprendi o telefone que o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const NOMES = { a1: "AUDITORIA ALICE", a2: "AUDITORIA BRUNO", a3: "AUDITORIA CICERO" };
const NUM = { a1: "01", a2: "02", a3: "03" };
const conversa = (k, extra = {}) => ({
  id: `cv-${k}`, advogado_id: ADV, contato_id: `ct-${k}`, nao_lidas: 0, arquivada: false, fixada: false,
  favorita: false, ultima_atividade: new Date(AGORA + 600e3 - Number(NUM[k]) * 1000).toISOString(),
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
  contato: { id: `ct-${k}`, nome: NOMES[k], numero: `55119700077${NUM[k]}`, foto_url: null }, ...extra,
});
const SEMENTE = {
  contatos: [
    ...Object.keys(NOMES).map((k) => ({ id: `ct-${k}`, numero: `55119700077${NUM[k]}`, nome: NOMES[k],
                                        vantoro_nome: null, nome_zorvin: null, foto_url: null })),
    // O CONTATO QUE O WHATSAPP CHAMA DE "Deus" e o cadastro de ANDREIA.
    { id: "ct-deus", numero: "5511970007799", nome: "Deus", vantoro_nome: "ANDREIA AUDITADA",
      nome_zorvin: null, foto_url: null },
  ],
  conversas: [
    conversa("a1"),
    conversa("a2"),
    // TIRADA DA FILA pelo "Já tratei", com dois cliques no histórico: um
    // antigo (de outra rodada, legítimo) e o de agora.
    conversa("a3", { tratada_em: atras(HORA) }),
  ],
  mensagens: Object.keys(NOMES).map((k) => ({ id: `m-${k}`, conversa_id: `cv-${k}`, origem: "contato",
                                               tipo: "texto", texto: "oi", criado_em: atras(2 * HORA) })),
  zorvin_tratamentos: [
    { id: "tr-velho", conversa_id: "cv-a3", assunto_id: "as-1", quem: "u1", quando: atras(10 * DIA),
      desfeito_em: null, desfeito_por: null, observacao: null },
    { id: "tr-novo-1", conversa_id: "cv-a3", assunto_id: "as-6", quem: "u1", quando: atras(HORA),
      desfeito_em: null, desfeito_por: null, observacao: null },
    { id: "tr-novo-2", conversa_id: "cv-a3", assunto_id: "as-8", quem: "u1", quando: atras(HORA),
      desfeito_em: null, desfeito_por: null, observacao: null },
  ],
  zorvin_tarefas: [
    { id: "tf-atrasada", conversa_id: "cv-a1", texto: "Ligar para a Alice", vence_em: atras(2 * HORA),
      para_quem: "u1", criada_por: "u1", criada_em: atras(DIA), feita_em: null, feita_por: null },
  ],
};

async function abrir({ recusarLeitura = [], largura = 1400 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__RECUSAR_LEITURA = d.recusarLeitura;
    globalThis.__SOU_ADMIN = true;
    globalThis.__TEM_FUNCAO_PAINEL = true;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: SEMENTE, recusarLeitura });
  await page.goto(ENDERECO);
  return { ctx, page, estouros };
}
async function pronto(page) {
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
}
/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
async function preencher(loc, valor) {
  if (!(await loc.count())) return false;
  try { await loc.first().fill(valor, { timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const abrirConversa = async (page, k) => {
  const r = await clicar(page.locator(`[data-conversa-nome="${NOMES[k]}"]`));
  await page.waitForTimeout(800);
  return r;
};

// ==================================================================
console.log("\n1. A lista que não carrega diz que não carregou");
{
  const { ctx, page } = await abrir({ recusarLeitura: ["conversas"] });
  await page.waitForTimeout(2500);
  const recado = page.locator("[data-recado-da-lista]");
  const marca = await recado.getAttribute("data-recado-da-lista").catch(() => null);
  const texto = await recado.innerText().catch(() => "");
  ok("o recado da lista é o da falha, e não “Carregando…”", marca === "falhou", `${marca}: ${texto}`);
  ok("com o código do banco", /PGRST301/.test(texto), texto);
  ok("e a faixa âmbar acende", await page.locator("[data-falha-de-leitura]").isVisible().catch(() => false));
  await ctx.close();
}

// ==================================================================
console.log("\n2. O “renomear” não atravessa para a conversa seguinte");
{
  const { ctx, page, estouros } = await abrir();
  await pronto(page);
  await abrirConversa(page, "a1");
  const abriu = await clicar(page.locator("[data-renomear-contato]"));
  await page.waitForTimeout(200);
  await preencher(page.locator('[data-topo-conversa] input'), "NOME QUE ERA DA ALICE");
  ok("abri o renomear na conversa da Alice", abriu);
  await abrirConversa(page, "a2");
  ok("na conversa do Bruno, a caixa do renomear não está mais aberta",
     (await page.locator('[data-topo-conversa] input').count()) === 0);
  const nomeBruno = await page.evaluate(() =>
    ((globalThis.__TABELAS.contatos || []).find((c) => c.id === "ct-a2") || {}).nome_zorvin ?? null);
  ok("e o Bruno não ganhou o nome digitado para a Alice", nomeBruno !== "NOME QUE ERA DA ALICE", String(nomeBruno));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Esc com o “Já tratei” aberto fecha a janela, e não a conversa");
{
  const { ctx, page } = await abrir();
  await pronto(page);
  await abrirConversa(page, "a1");
  const abriu = await clicar(page.locator("[data-ja-tratei]"));
  await page.waitForTimeout(300);
  ok("a janela do “Já tratei” abriu", abriu && (await page.locator("[data-ja-tratei-janela]").count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Esc fechou a janela", (await page.locator("[data-ja-tratei-janela]").count()) === 0);
  ok("e a conversa continua aberta atrás", (await page.locator("[data-topo-conversa]").count()) === 1);
  await ctx.close();
}

// ==================================================================
console.log("\n4. O menu ⋮ do alto abre abaixo do botão");
{
  const { ctx, page } = await abrir();
  await pronto(page);
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  await page.waitForTimeout(200);
  const m = await page.evaluate(() => {
    const botao = document.querySelector('[aria-label="Menu"]');
    const item = [...document.querySelectorAll("button")].find((b) => /Marcar todas como lidas/.test(b.textContent || ""));
    if (!botao || !item) return null;
    return { botaoFim: botao.getBoundingClientRect().bottom, menuTopo: item.parentElement.getBoundingClientRect().top };
  });
  ok("o menu começa onde o botão termina — o segundo toque não cai em “Marcar todas como lidas”",
     m && m.menuTopo >= m.botaoFim - 1, JSON.stringify(m));
  await ctx.close();
}

// ==================================================================
console.log("\n5. Os assuntos que não carregaram são ditos na janela");
{
  const { ctx, page } = await abrir({ recusarLeitura: ["zorvin_assuntos"] });
  await pronto(page);
  await abrirConversa(page, "a1");
  await clicar(page.locator("[data-ja-tratei]"));
  await page.waitForTimeout(400);
  const erro = await page.locator("[data-erro-dos-assuntos]").innerText().catch(() => "");
  ok("a janela diz que a lista não carregou, com o código", /PGRST301/.test(erro), erro);
  ok("e NÃO manda o administrador criar a lista", !/Nenhum assunto cadastrado/.test(
     await page.locator("[data-ja-tratei-janela]").innerText().catch(() => "")));
  await ctx.close();
}

// ==================================================================
console.log("\n6. Fechar “Departamentos e acessos” com a releitura falhando não apaga os telefones");
{
  const { ctx, page } = await abrir();
  await pronto(page);
  const antes = await page.locator("[data-telefone]").count();
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  await clicar(page.getByRole("button", { name: /Departamentos e acessos/ }));
  await page.waitForTimeout(800);
  await page.evaluate(() => { globalThis.__RECUSAR_LEITURA = ["advogados", "departamentos"]; });
  // PELO "X" DA TELA, e não pelo Esc: é o botão de fechar que relê as listas
  // (o Esc só esconde a tela, e passaria por não reler nada).
  const fechou = await clicar(page.locator('[aria-label="Fechar"]').first());
  ok("fechei pelo botão da própria tela", fechou);
  await page.waitForTimeout(1200);
  const depois = await page.locator("[data-telefone]").count();
  ok("havia telefones na barra", antes > 0, String(antes));
  ok("e continuam lá depois da releitura que falhou", depois === antes, `${antes} → ${depois}`);
  ok("e a falha é dita na faixa âmbar", await page.locator("[data-falha-de-leitura]").isVisible().catch(() => false));
  await ctx.close();
}

// ==================================================================
console.log("\n7. A agenda acha o contato pelo nome do cadastro");
{
  const { ctx, page } = await abrir();
  await pronto(page);
  await clicar(page.getByRole("button", { name: "Nova conversa" }));
  await page.waitForTimeout(400);
  await preencher(page.locator('input[placeholder="Pesquisar nome ou número"]'), "andreia aud");
  await page.waitForTimeout(1200);
  ok("o “Deus” do WhatsApp aparece ao procurar ANDREIA",
     (await page.locator('[data-contato-agenda="ct-deus"]').count()) === 1);
  await ctx.close();
}

// ==================================================================
console.log("\n8. “Voltar para a fila” desfaz só o último “Já tratei”");
{
  const { ctx, page } = await abrir();
  await pronto(page);
  await abrirConversa(page, "a3");
  const tipo = await page.locator("[data-ja-tratei]").first().getAttribute("data-ja-tratei").catch(() => null);
  ok("a conversa oferece “Voltar para a fila”", tipo === "desfazer", String(tipo));
  await clicar(page.locator("[data-ja-tratei]"));
  await page.waitForTimeout(1200);
  const linhas = await page.evaluate(() => Object.fromEntries((globalThis.__TABELAS.zorvin_tratamentos || [])
    .filter((t) => t.conversa_id === "cv-a3").map((t) => [t.id, Boolean(t.desfeito_em)])));
  ok("as duas linhas do último clique ficaram desfeitas", linhas["tr-novo-1"] && linhas["tr-novo-2"], JSON.stringify(linhas));
  ok("e o “Já tratei” antigo, de outra rodada, continua valendo", linhas["tr-velho"] === false, JSON.stringify(linhas));
  await ctx.close();
}

// ==================================================================
console.log("\n9. O atalho “7 dias” cobre 7 dias");
{
  const { ctx, page } = await abrir();
  await pronto(page);
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  await clicar(page.getByRole("button", { name: "Painel" }));
  await page.waitForTimeout(1000);
  await clicar(page.locator('[data-teste="abrir-periodo"]'));
  await page.waitForTimeout(200);
  await clicar(page.locator('[data-grupo="periodo"]').getByRole("button", { name: "7 dias", exact: true }));
  await page.waitForTimeout(600);
  const r = await page.locator('[data-teste="abrir-periodo"]').innerText().catch(() => "");
  ok("o botão diz “7 dias”, e não 8", /\b7 dias\b/.test(r) && !/\b8 dias\b/.test(r), r);
  await ctx.close();
}

// ==================================================================
console.log("\n10. A tarefa atrasada se edita sem trocar a hora");
{
  const { ctx, page } = await abrir({ largura: 1920 });
  await pronto(page);
  await abrirConversa(page, "a1");
  if (!(await page.locator("[data-menu-tarefas]").isVisible().catch(() => false))) {
    await clicar(page.locator("[data-tarefa-da-conversa]"));
    await page.waitForTimeout(300);
  }
  const abriu = await clicar(page.locator('[data-editar-tarefa="tf-atrasada"]'));
  await page.waitForTimeout(300);
  ok("abri a edição da tarefa atrasada", abriu);
  await preencher(page.locator("[data-tarefa-texto]"), "Ligar para a Alice — a Jenifer cobre");
  const ligado = await page.locator("[data-tarefa-confirmar]").isEnabled().catch(() => false);
  ok("o botão de salvar liga sem precisar escolher outra hora", ligado);
  const antes = SEMENTE.zorvin_tarefas[0].vence_em;
  await clicar(page.locator("[data-tarefa-confirmar]"));
  await page.waitForTimeout(800);
  const t = await page.evaluate(() => (globalThis.__TABELAS.zorvin_tarefas || []).find((x) => x.id === "tf-atrasada") || null);
  ok("o texto novo foi gravado", t && /Jenifer cobre/.test(t.texto), t && t.texto);
  ok("e a hora ficou EXATAMENTE a mesma — o lembrete já avisado não toca de novo",
     t && t.vence_em === antes, `${t && t.vence_em} × ${antes}`);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
