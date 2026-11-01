// A FAXINA DA FILA (01/11) — recomendação nº 3 de 31/10.
//
// "Uma tela de faxina da fila. As conversas paradas há mais de um mês, uma
// embaixo da outra, cada uma com a última mensagem à vista e o Finalizar a um
// clique. Dá para limpar a fila numa tarde, sem abrir conversa por conversa."
//
// O que esta prova guarda, e por quê:
//
//   - PARADA É SEM MENSAGEM HÁ MAIS DE N DIAS, e não "esperando há N dias": o
//     cliente que esperava desde 40 dias atrás e escreveu de novo anteontem
//     está ali, e não é faxina. A cena dele é a que separa as duas contas;
//   - o que NÃO entra: a finalizada, a arquivada, a vazia (sem mensagem
//     nenhuma — medido em 01/11, 286 delas no escritório) e a de 20 dias;
//   - os dois grupos (o cliente espera / a equipe falou por último), com os
//     números do banco, e a página de 50 com "Carregar mais";
//   - Finalizar uma e Finalizar várias passam pela gravação do Finalizar da
//     conversa (o registro em `zorvin_tratamentos`), com a marcação
//     obrigatória — também em lote;
//   - ANTES DE CADA FINALIZAÇÃO, a conversa é conferida: a que recebeu
//     mensagem depois de a lista ser lida não é finalizada, e a linha diz por
//     quê. Sem isto, a mensagem do cliente que escreveu enquanto alguém
//     limpava a fila ficaria coberta pela finalização, sem ninguém ler;
//   - a falha do banco é dita, com o código, e nada some.
//
// AS CENAS SÃO PLANTADAS NO TELEFONE a8 (Acordos 2), que na bancada não tem
// nenhuma conversa parada: o a7 tem cinco e o a13 (o das 1.200) tem centenas,
// e é nele que a prova mede a página e a conta.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const DIA = 24 * 3600e3;
const haDias = (d) => new Date(Date.now() - d * DIA).toISOString();

function hash(t) { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
/** Uma conversa plantada no a8. */
const conversa = (id, dias, extra = {}) => ({
  id, advogado_id: "a8", contato_id: `${id}-ct`, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: haDias(dias), ultima_mensagem: "Obrigado", frente: null, vantoro_nome: null, digitando_ate: null,
  responsavel_id: null, responsavel_em: null, responsavel_por: null, situacao: "aberto", protocolo: null,
  esperando_desde: null, tratada_em: null,
  contato: { id: `${id}-ct`, nome: `CLIENTE ${id.toUpperCase()}`, numero: `5511${String(hash(id)).padStart(9, "0").slice(0, 9)}`,
             foto_url: null, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null },
  ...extra,
});
const msg = (id, conversa_id, origem, dias, texto, extra = {}) => ({
  id, conversa_id, origem, tipo: "texto", texto, criado_em: haDias(dias), status: "lida",
  ...(origem === "advogado" ? { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" } : {}),
  ...extra,
});

const SEMENTE = {
  conversas: [
    // O CLIENTE ESPERA RESPOSTA, parado há 40 dias.
    conversa("fx-cli-1", 40, { esperando_desde: haDias(40), ultima_mensagem: "Ainda aguardo o retorno sobre o acordo" }),
    // NUNCA RESPONDIDO, parado há 70 dias, e o que ele mandou por último foi um documento.
    conversa("fx-cli-2", 70, { esperando_desde: haDias(70), situacao: "aguardando", ultima_mensagem: "[anexo]" }),
    // A EQUIPE FALOU POR ÚLTIMO: a minha (35 dias), a da colega (50) e um grupo (45).
    conversa("fx-eq-1", 35, { responsavel_id: "u1", ultima_mensagem: "Qualquer dúvida, estamos à disposição" }),
    conversa("fx-eq-2", 50, { responsavel_id: "u2", ultima_mensagem: "Enviamos a proposta" }),
    conversa("fx-grupo", 45, { ultima_mensagem: "Reunião confirmada",
      contato: { id: "fx-grupo-ct", nome: "MUTIRÃO DE TESTE", numero: "grupo:120363000000000001", foto_url: null,
                 vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null } }),
    // O QUE NÃO ENTRA:
    conversa("fx-recente", 5, { esperando_desde: haDias(5) }),
    // esperando desde 40 dias atrás, mas escreveu de novo anteontem: está ali.
    conversa("fx-voltou", 2, { esperando_desde: haDias(40) }),
    conversa("fx-finalizada", 60, { situacao: "finalizado", tratada_em: haDias(59) }),
    conversa("fx-arquivada", 60, { arquivada: true }),
    conversa("fx-vazia", 60, { ultima_mensagem: null }),
    // 20 dias: fora com 30, dentro com 15.
    conversa("fx-20dias", 20, { ultima_mensagem: "Combinado" }),
  ],
  mensagens: [
    msg("fx-m1", "fx-cli-1", "contato", 47, "Bom dia, queria saber do acordo"),
    msg("fx-m2", "fx-cli-1", "advogado", 45, "Bom dia! Estamos conferindo e já retornamos."),
    msg("fx-m3", "fx-cli-1", "contato", 40, "Ainda aguardo o retorno sobre o acordo"),
    msg("fx-m4", "fx-cli-2", "contato", 70, null, { tipo: "documento", midia_url: "https://exemplo.invalid/doc.pdf", midia_nome: "rg.pdf" }),
    msg("fx-m5", "fx-eq-1", "contato", 36, "Obrigado pelas informações"),
    msg("fx-m6", "fx-eq-1", "advogado", 35, "Qualquer dúvida, estamos à disposição"),
    msg("fx-m7", "fx-eq-2", "advogado", 50, "Enviamos a proposta", { enviado_por: "Jenifer Almeida", enviado_por_id: "u2" }),
    msg("fx-m8", "fx-grupo", "advogado", 45, "Reunião confirmada"),
    msg("fx-m9", "fx-recente", "contato", 5, "Oi"),
    msg("fx-m10", "fx-voltou", "contato", 40, "Primeira pergunta"),
    msg("fx-m11", "fx-voltou", "contato", 2, "Alguém pode me responder?"),
    msg("fx-m12", "fx-finalizada", "contato", 60, "Obrigado"),
    msg("fx-m13", "fx-arquivada", "contato", 60, "Obrigado"),
    msg("fx-m14", "fx-20dias", "advogado", 20, "Combinado"),
  ],
};

/** Abre o painel com TODAS as bandeiras escritas — `addInitScript` acumula. */
async function abrir(opcoes = {}) {
  const ctx = await nav.newContext({ viewport: opcoes.viewport || { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((o) => {
    globalThis.__SEMENTE = o.semente;
    globalThis.__SEM_SITUACAO = Boolean(o.semSituacao);
    globalThis.__SEM_ASSUNTOS = Boolean(o.semAssuntos);
    globalThis.__QUEBRAR = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__CLIQUE_NAO_FINALIZA = false;
    globalThis.__DESATIVAR = [];
    globalThis.__AVISOS_DA_FAIXA = [];
    globalThis.__ATRASO_UNIFORME = o.atrasoUniforme;
    globalThis.__DIARIO = o.diario ? [] : undefined;
  }, { semente: opcoes.semente === undefined ? SEMENTE : opcoes.semente, semSituacao: opcoes.semSituacao, semAssuntos: opcoes.semAssuntos,
       atrasoUniforme: opcoes.atrasoUniforme, diario: opcoes.diario });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 });
  return { ctx, page, estouros };
}

const contar = (page, sel) => page.locator(sel).count();
const texto = async (page, sel) => ((await contar(page, sel)) ? (await page.locator(sel).first().innerText()) : "");
const attr = async (page, sel, nome) => ((await contar(page, sel)) ? page.locator(sel).first().getAttribute(nome) : null);
/** O valor de um campo — guardado: `inputValue` num elemento que não existe
 *  espera 30 segundos e derruba a prova inteira. */
const valor = async (page, sel) => ((await contar(page, sel)) ? page.locator(sel).first().inputValue() : null);
/** CLIQUE GUARDADO: o que não existe não estoura a prova depois de 30 segundos. */
async function clicar(page, sel) {
  if (!(await contar(page, sel))) return false;
  await page.locator(sel).first().click();
  return true;
}
async function esperar(page, sel, ms = 6000) {
  try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch (_) { return false; }
}
/** As linhas da faxina, na ordem da tela. */
const linhas = (page) => page.locator("[data-faxina-linha]").evaluateAll((els) => els.map((e) => e.getAttribute("data-faxina-linha")));
/** Quantas leituras a tela já terminou — a página e os números juntos. */
const leituras = async (page) => Number(await attr(page, "[data-faxina-estado]", "data-faxina-leituras")) || 0;
/** Faz o gesto e espera a LEITURA QUE ELE PROVOCOU terminar. Esperar "haver
 *  linhas" não serve: entre o clique e a resposta a tela ainda mostra a lista
 *  de antes — foi a primeira escrita desta prova, conferindo a lista velha. */
async function depoisDeLer(page, gesto) {
  const antes = await leituras(page);
  const fez = await gesto();
  for (let i = 0; i < 80; i++) {
    if ((await leituras(page)) > antes && (await attr(page, "[data-faxina-estado]", "data-faxina-estado")) !== "procurando") break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(150);
  return fez;
}
/** Espera a primeira leitura, ao abrir. */
async function assentar(page) {
  for (let i = 0; i < 80; i++) {
    if ((await leituras(page)) > 0 && (await attr(page, "[data-faxina-estado]", "data-faxina-estado")) !== "procurando") break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(150);
}
/** Botão desligado? Sem o elemento, `isDisabled` esperaria 30 segundos e
 *  derrubaria a prova inteira — e a prova que estoura não diz o que viu. */
const desligado = async (page, sel) => ((await contar(page, sel)) ? page.locator(sel).first().isDisabled() : null);
async function abrirFaxina(page) {
  await clicar(page, 'button[aria-label="Menu"]');
  await page.waitForTimeout(250);
  const tem = await clicar(page, "[data-abrir-faxina]");
  if (tem) { await esperar(page, '[data-tela="faxina"]', 4000); await assentar(page); }
  return tem;
}
async function escolher(page, sel, valor) {
  if (!(await contar(page, sel))) return false;
  // A OPÇÃO QUE NÃO EXISTE não estoura a prova: `selectOption` esperaria 30
  // segundos e derrubaria tudo, sem dizer qual conferência viu o defeito.
  const tem = await page.locator(`${sel} option[value="${valor}"]`).count();
  if (!tem) return false;
  return depoisDeLer(page, async () => { await page.locator(sel).first().selectOption(String(valor)); return true; });
}
/** Troca de grupo e espera a leitura dele. */
const grupo = (page, chave) => depoisDeLer(page, () => clicar(page, `[data-faxina-grupo="${chave}"]`));
const tabela = (page, nome) => page.evaluate((n) => globalThis.__TABELAS[n] || [], nome);
const conversaNoBanco = async (page, id) => (await tabela(page, "conversas")).find((c) => c.id === id) || null;
const tratamentosDe = async (page, id) => (await tabela(page, "zorvin_tratamentos")).filter((t) => t.conversa_id === id);
async function marcarAssunto(page, nome) {
  const l = page.locator(`[data-assunto-do-ja-tratei="${nome}"] input[type="checkbox"]`);
  if (await l.count()) await l.first().check();
}

// ------------------------------------------------------------------
console.log("\n1. O que aparece, e o que não aparece");
{
  const { ctx, page, estouros } = await abrir();
  ok("o ⋮ do topo tem “Faxina da fila”, e ela abre", await abrirFaxina(page));
  await escolher(page, "[data-faxina-telefone]", "a8");
  ok("abre no grupo do cliente que espera resposta", (await attr(page, '[data-faxina-grupo="cliente"]', "aria-selected")) === "true");
  const cli = await linhas(page);
  ok("o cliente que espera: as duas, a parada há mais tempo primeiro", JSON.stringify(cli) === JSON.stringify(["fx-cli-2", "fx-cli-1"]), JSON.stringify(cli));
  ok("os números dos grupos vêm do banco: 2 e 3",
     (await attr(page, '[data-faxina-grupo="cliente"]', "data-faxina-conta")) === "2"
     && (await attr(page, '[data-faxina-grupo="equipe"]', "data-faxina-conta")) === "3",
     `${await attr(page, '[data-faxina-grupo="cliente"]', "data-faxina-conta")} e ${await attr(page, '[data-faxina-grupo="equipe"]', "data-faxina-conta")}`);
  const l2 = '[data-faxina-linha="fx-cli-2"]';
  ok("a linha diz há quantos dias está parada e há quantos espera",
     /parada há 70 dias/.test(await texto(page, l2)) && /esperando há 70 dias/.test(await texto(page, l2)), await texto(page, l2));
  ok("diz em que aba ela está (Novos)", (await attr(page, `${l2} [data-faxina-aba]`, "data-faxina-aba")) === "aguardando"
     && /Novos/.test(await texto(page, `${l2} [data-faxina-aba]`)), await texto(page, `${l2} [data-faxina-aba]`));
  ok("e a última mensagem: o anexo com o rótulo, e não “[anexo]”",
     /Cliente:\s*📄 Documento/.test(await texto(page, `${l2} [data-faxina-ultima]`)) && !/\[anexo\]/.test(await texto(page, `${l2} [data-faxina-ultima]`)),
     await texto(page, `${l2} [data-faxina-ultima]`));
  ok("a do outro cliente mostra o que ele escreveu",
     /Cliente:\s*Ainda aguardo o retorno sobre o acordo/.test(await texto(page, '[data-faxina-linha="fx-cli-1"] [data-faxina-ultima]')),
     await texto(page, '[data-faxina-linha="fx-cli-1"] [data-faxina-ultima]'));
  ok("o que voltou a escrever anteontem NÃO é faxina, mesmo esperando há 40 dias", !cli.includes("fx-voltou"));
  ok("nem a recente, a finalizada, a arquivada ou a vazia",
     !cli.some((id) => ["fx-recente", "fx-finalizada", "fx-arquivada", "fx-vazia"].includes(id)), JSON.stringify(cli));

  await grupo(page, "equipe");
  const eq = await linhas(page);
  ok("a equipe falou por último: a da colega, o grupo e a minha, na ordem da parada",
     JSON.stringify(eq) === JSON.stringify(["fx-eq-2", "fx-grupo", "fx-eq-1"]), JSON.stringify(eq));
  ok("quem falou por último é dito pelo nome", /Jenifer Almeida:\s*Enviamos a proposta/.test(await texto(page, '[data-faxina-linha="fx-eq-2"] [data-faxina-ultima]')),
     await texto(page, '[data-faxina-linha="fx-eq-2"] [data-faxina-ultima]'));
  ok("o grupo é marcado como grupo", /grupo/.test(await texto(page, '[data-faxina-linha="fx-grupo"]')));
  ok("e a de 20 dias não entra com 30", !eq.includes("fx-20dias"));
  ok("a da colega diz com quem está", /com /.test(await texto(page, '[data-faxina-linha="fx-eq-2"] [data-faxina-dono]'))
     && !/sem responsável/.test(await texto(page, '[data-faxina-linha="fx-eq-2"] [data-faxina-dono]')),
     await texto(page, '[data-faxina-linha="fx-eq-2"] [data-faxina-dono]'));

  await escolher(page, "[data-faxina-responsavel]", "minhas");
  ok("“As minhas”: só a minha", JSON.stringify(await linhas(page)) === JSON.stringify(["fx-eq-1"]), JSON.stringify(await linhas(page)));
  await escolher(page, "[data-faxina-responsavel]", "sem");
  ok("“Sem responsável”: só o grupo", JSON.stringify(await linhas(page)) === JSON.stringify(["fx-grupo"]), JSON.stringify(await linhas(page)));
  await escolher(page, "[data-faxina-responsavel]", "todas");
  await escolher(page, "[data-faxina-dias]", 15);
  ok("com 15 dias, a de 20 entra", (await linhas(page)).includes("fx-20dias"), JSON.stringify(await linhas(page)));
  ok("e a frase diz os dias escolhidos", /há mais de 15 dias/.test(await texto(page, '[data-tela="faxina"]')));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. As últimas mensagens, sem sair da tela");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a8");
  await clicar(page, '[data-faxina-ver="fx-cli-1"]');
  await esperar(page, '[data-faxina-mensagens="fx-cli-1"] [data-faxina-mensagem]', 4000);
  const msgs = await page.locator('[data-faxina-mensagens="fx-cli-1"] [data-faxina-mensagem]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ")));
  ok("mostra as três mensagens, na ordem em que aconteceram", msgs.length === 3
     && /queria saber do acordo/.test(msgs[0]) && /Estamos conferindo/.test(msgs[1]) && /Ainda aguardo/.test(msgs[2]), JSON.stringify(msgs));
  ok("e diz quem escreveu cada uma", msgs.length === 3 && /^Cliente/.test(msgs[0]) && /^Rodrigo Sousa/.test(msgs[1]), JSON.stringify(msgs));
  ok("a tela continua aberta", (await contar(page, '[data-tela="faxina"]')) === 1);
  await clicar(page, '[data-faxina-ver="fx-cli-1"]');
  await page.waitForTimeout(200);
  ok("clicar de novo esconde", (await contar(page, '[data-faxina-mensagens="fx-cli-1"]')) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Finalizar uma: a marcação continua obrigatória, e o banco finaliza");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a8");
  await clicar(page, '[data-faxina-finalizar="fx-cli-1"]');
  ok("abre a janela do Finalizar, de uma conversa", await esperar(page, "[data-ja-tratei-janela]", 3000)
     && (await attr(page, "[data-ja-tratei-janela]", "data-ja-tratei-modo")) === "finalizar"
     && (await attr(page, "[data-ja-tratei-janela]", "data-ja-tratei-lote")) === null);
  ok("ela diz há quantos dias o cliente espera", (await attr(page, "[data-ja-tratei-dias]", "data-ja-tratei-dias")) === "40");
  ok("sem assunto marcado, o botão não liga", (await desligado(page, "[data-ja-tratei-confirmar]")) === true);
  // O Esc fecha a janela, e não a tela.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok("o Esc fecha a janela", (await contar(page, "[data-ja-tratei-janela]")) === 0);
  ok("e a tela da faxina continua aberta", (await contar(page, '[data-tela="faxina"]')) === 1);
  await clicar(page, '[data-faxina-finalizar="fx-cli-1"]');
  await esperar(page, "[data-ja-tratei-janela]", 3000);
  await marcarAssunto(page, "ACORDOS");
  await clicar(page, "[data-ja-tratei-confirmar]");
  for (let i = 0; i < 30 && (await contar(page, "[data-ja-tratei-janela]")); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(300);
  ok("a linha sai da lista", !(await linhas(page)).includes("fx-cli-1"), JSON.stringify(await linhas(page)));
  const c = await conversaNoBanco(page, "fx-cli-1");
  ok("no banco ela foi finalizada", c && c.situacao === "finalizado", JSON.stringify(c && { situacao: c.situacao }));
  const t = await tratamentosDe(page, "fx-cli-1");
  ok("pelo registro do Finalizar: uma linha, com o assunto, quem e desde quando esperava",
     t.length === 1 && t[0].assunto_id === "as-6" && t[0].quem === "u1" && Boolean(t[0].esperava_desde), JSON.stringify(t));
  ok("o número do grupo desce para 1", (await attr(page, '[data-faxina-grupo="cliente"]', "data-faxina-conta")) === "1",
     String(await attr(page, '[data-faxina-grupo="cliente"]', "data-faxina-conta")));
  ok("e a faixa diz que finalizou", /Finalizada/.test(await texto(page, "[data-aviso]")), await texto(page, "[data-aviso]"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n4. A conversa que recebeu mensagem depois da lista não é finalizada");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a8");
  // O CLIENTE ESCREVE enquanto a lista está aberta: a ponte grava a mensagem,
  // e o gatilho do banco põe a hora dela na conversa.
  await page.evaluate(() => {
    const T = globalThis.__TABELAS;
    const agora = new Date().toISOString();
    T.mensagens.push({ id: "fx-m-agora", conversa_id: "fx-cli-2", origem: "contato", tipo: "texto",
                       texto: "Ainda estou esperando!", criado_em: agora, status: "entregue" });
    const c = T.conversas.find((x) => x.id === "fx-cli-2");
    c.ultima_atividade = agora; c.ultima_mensagem = "Ainda estou esperando!";
  });
  await clicar(page, '[data-faxina-finalizar="fx-cli-2"]');
  await esperar(page, "[data-ja-tratei-janela]", 3000);
  await marcarAssunto(page, "ACORDOS");
  await clicar(page, "[data-ja-tratei-confirmar]");
  for (let i = 0; i < 30 && (await contar(page, "[data-ja-tratei-janela]")); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(300);
  const c = await conversaNoBanco(page, "fx-cli-2");
  ok("ela NÃO foi finalizada", c && c.situacao === "aguardando", JSON.stringify(c && { situacao: c.situacao }));
  ok("e nada foi registrado", (await tratamentosDe(page, "fx-cli-2")).length === 0);
  ok("a linha continua na lista", (await linhas(page)).includes("fx-cli-2"));
  ok("dizendo por quê", /Chegou mensagem nesta conversa/.test(await texto(page, '[data-faxina-linha="fx-cli-2"] [data-faxina-problema]')),
     await texto(page, '[data-faxina-linha="fx-cli-2"]'));
  // E A QUE OUTRA PESSOA FINALIZOU depois de a lista ser lida: não se registra
  // de novo — o relatório contaria o mesmo atendimento duas vezes.
  await page.evaluate(() => {
    globalThis.__TABELAS.conversas.find((x) => x.id === "fx-cli-1").situacao = "finalizado";
  });
  const antesDela = (await tratamentosDe(page, "fx-cli-1")).length;
  await clicar(page, '[data-faxina-finalizar="fx-cli-1"]');
  await esperar(page, "[data-ja-tratei-janela]", 3000);
  await marcarAssunto(page, "ACORDOS");
  await clicar(page, "[data-ja-tratei-confirmar]");
  for (let i = 0; i < 30 && (await contar(page, "[data-ja-tratei-janela]")); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(300);
  ok("a que outra pessoa finalizou não é registrada de novo", (await tratamentosDe(page, "fx-cli-1")).length === antesDela,
     JSON.stringify(await tratamentosDe(page, "fx-cli-1")));
  ok("ela sai da lista", !(await linhas(page)).includes("fx-cli-1"), JSON.stringify(await linhas(page)));
  ok("e a faixa diz que ela já tinha sido finalizada", /já tinha sido finalizada/.test(await texto(page, "[data-aviso]")),
     await texto(page, "[data-aviso]"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. Finalizar várias: o mesmo registro, uma de cada vez, conferidas");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a8");
  await grupo(page, "equipe");
  ok("sem nada marcado, não há o botão de finalizar várias", (await contar(page, "[data-faxina-finalizar-marcadas]")) === 0);
  await clicar(page, "[data-faxina-marcar-todas]");
  ok("marcar as desta página marca as três", /Finalizar 3 conversas/.test(await texto(page, "[data-faxina-finalizar-marcadas]")),
     await texto(page, "[data-faxina-lote]"));
  // A DA COLEGA RECEBE MENSAGEM no meio: ela tem de ficar, e as outras saírem.
  await page.evaluate(() => {
    const T = globalThis.__TABELAS;
    const agora = new Date().toISOString();
    T.mensagens.push({ id: "fx-m-agora-2", conversa_id: "fx-eq-2", origem: "contato", tipo: "texto",
                       texto: "Recebi, vou ler", criado_em: agora, status: "entregue" });
    const c = T.conversas.find((x) => x.id === "fx-eq-2");
    c.ultima_atividade = agora;
  });
  await clicar(page, "[data-faxina-finalizar-marcadas]");
  ok("a janela é a do lote, e diz quantas", await esperar(page, "[data-ja-tratei-janela]", 3000)
     && (await attr(page, "[data-ja-tratei-janela]", "data-ja-tratei-lote")) === "3"
     && /Finalizar 3 conversas/.test(await texto(page, "[data-ja-tratei-janela]")), await texto(page, "[data-ja-tratei-janela]"));
  ok("e promete que nenhum cliente recebe mensagem", /sem mandar mensagem a nenhum\s+cliente/.test(await texto(page, "[data-ja-tratei-janela]")));
  await marcarAssunto(page, "OUTROS");
  ok("o OUTROS continua pedindo o que foi tratado", (await desligado(page, "[data-ja-tratei-confirmar]")) === true);
  if (await contar(page, "[data-ja-tratei-descricao]")) await page.locator("[data-ja-tratei-descricao]").fill("Faxina da fila: sem retorno do cliente");
  await clicar(page, "[data-ja-tratei-confirmar]");
  // O ANDAMENTO aparece enquanto o lote anda.
  let viuAndamento = false;
  for (let i = 0; i < 60; i++) {
    if (await contar(page, "[data-faxina-andamento]")) viuAndamento = true;
    if (viuAndamento && !(await contar(page, "[data-faxina-andamento]"))) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(400);
  ok("o andamento aparece enquanto o lote anda", viuAndamento);
  const ficou = await linhas(page);
  ok("as duas saíram, e a que recebeu mensagem ficou", JSON.stringify(ficou) === JSON.stringify(["fx-eq-2"]), JSON.stringify(ficou));
  ok("dizendo por quê", /Chegou mensagem/.test(await texto(page, '[data-faxina-linha="fx-eq-2"] [data-faxina-problema]')));
  const g = await conversaNoBanco(page, "fx-grupo"), e1 = await conversaNoBanco(page, "fx-eq-1"), e2 = await conversaNoBanco(page, "fx-eq-2");
  ok("no banco: as duas finalizadas, a terceira não",
     g?.situacao === "finalizado" && e1?.situacao === "finalizado" && e2?.situacao === "aberto",
     JSON.stringify([g?.situacao, e1?.situacao, e2?.situacao]));
  const tg = await tratamentosDe(page, "fx-grupo");
  ok("cada uma com o registro do OUTROS e o texto",
     tg.length === 1 && tg[0].assunto_id === "as-outros" && tg[0].observacao === "Faxina da fila: sem retorno do cliente"
     && (await tratamentosDe(page, "fx-eq-1")).length === 1 && (await tratamentosDe(page, "fx-eq-2")).length === 0, JSON.stringify(tg));
  ok("a faixa resume: 2 finalizadas, 1 não", /2 conversas finalizadas; 1 não foi/.test(await texto(page, "[data-aviso]")), await texto(page, "[data-aviso]"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5b. O lote grande: no máximo 50, uma de cada vez, e o Parar para");
{
  // ATRASO ZERO NA BANCADA: o tempo entre uma finalização e a seguinte passa
  // a ser só a pausa da faxina, e é ela que esta cena mede — pelo diário, que
  // anota quando cada gravação começou.
  const { ctx, page, estouros } = await abrir({ atrasoUniforme: 0, diario: true });
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a13");
  await grupo(page, "equipe");
  await depoisDeLer(page, () => clicar(page, "[data-faxina-mais]"));
  const naTela = (await linhas(page)).length;
  ok("com 100 na tela", naTela === 100, String(naTela));
  ok("a caixa diz que marca as primeiras 50", /Marcar as primeiras 50/.test(await texto(page, "[data-faxina-lote]")),
     await texto(page, "[data-faxina-lote]"));
  await clicar(page, "[data-faxina-marcar-todas]");
  ok("e marca 50, e não 100", /Finalizar 50 conversas/.test(await texto(page, "[data-faxina-finalizar-marcadas]")),
     await texto(page, "[data-faxina-lote]"));
  await clicar(page, "[data-faxina-finalizar-marcadas]");
  await esperar(page, "[data-ja-tratei-janela]", 3000);
  await marcarAssunto(page, "ACORDOS");
  await clicar(page, "[data-ja-tratei-confirmar]");
  // TRÊS FINALIZADAS, para medir os dois intervalos entre elas.
  const feitasNoBanco = async () => (await tabela(page, "zorvin_tratamentos")).length;
  for (let i = 0; i < 100 && (await feitasNoBanco()) < 3; i++) await page.waitForTimeout(50);
  // O ESC NO MEIO DO LOTE não fecha a tela: fechar pararia o lote sem querer.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok("o Esc no meio do lote não fecha a tela", (await contar(page, '[data-tela="faxina"]')) === 1);
  ok("e o lote continua andando", (await contar(page, "[data-faxina-andamento]")) === 1);
  const inicios = await page.evaluate(() => (globalThis.__DIARIO || [])
    .filter((m) => m.tabela === "zorvin_tratamentos" && m.colunas === "id").map((m) => m.inicio));
  const vaos = inicios.slice(1).map((t, i) => Math.round(t - inicios[i]));
  ok("uma de cada vez, com a pausa entre elas", vaos.length >= 2 && vaos.every((v) => v >= 250), JSON.stringify(vaos));
  await clicar(page, "[data-faxina-parar]");
  for (let i = 0; i < 60 && (await contar(page, "[data-faxina-andamento]")); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(300);
  const feitas = await feitasNoBanco();
  ok("o Parar para: bem menos que as 50", feitas >= 3 && feitas <= 10, String(feitas));
  ok("e a faixa diz que parou antes do fim", /Você parou antes do fim/.test(await texto(page, "[data-aviso]")), await texto(page, "[data-aviso]"));
  const sobrou = (await linhas(page)).length;
  ok("as que não foram ficam na lista, desmarcadas", sobrou === 100 - feitas
     && (await contar(page, "[data-faxina-finalizar-marcadas]")) === 0, `${sobrou} na tela, ${feitas} finalizadas`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n6. O banco que recusa é dito, e nada some");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a8");
  await page.evaluate(() => {
    globalThis.__ERRO_NA_GRAVACAO = { zorvin_tratamentos: { code: "42501", message: "new row violates row-level security policy" } };
  });
  await clicar(page, '[data-faxina-finalizar="fx-cli-1"]');
  await esperar(page, "[data-ja-tratei-janela]", 3000);
  await marcarAssunto(page, "ACORDOS");
  await clicar(page, "[data-ja-tratei-confirmar]");
  await esperar(page, "[data-ja-tratei-erro]", 4000);
  ok("a janela diz que não registrou, com o código", /Não consegui registrar/.test(await texto(page, "[data-ja-tratei-erro]"))
     && /42501/.test(await texto(page, "[data-ja-tratei-erro]")), await texto(page, "[data-ja-tratei-erro]"));
  ok("a conversa continua na lista", (await linhas(page)).includes("fx-cli-1"));
  ok("e no banco não foi finalizada", (await conversaNoBanco(page, "fx-cli-1"))?.situacao === "aberto");
  await page.evaluate(() => { globalThis.__ERRO_NA_GRAVACAO = {}; globalThis.__CLIQUE_NAO_FINALIZA = true; });
  await clicar(page, "[data-ja-tratei-confirmar]");
  for (let i = 0; i < 30 && !/não finalizou/.test(await texto(page, "[data-ja-tratei-erro]")); i++) await page.waitForTimeout(150);
  ok("o banco que registra e não finaliza também é dito", /o banco não finalizou/.test(await texto(page, "[data-ja-tratei-erro]")),
     await texto(page, "[data-ja-tratei-erro]"));
  ok("e a linha continua", (await linhas(page)).includes("fx-cli-1"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. A leitura que falha é dita, e não vira “nenhuma conversa parada”");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  await escolher(page, "[data-faxina-telefone]", "a8");
  await page.evaluate(() => { globalThis.__QUEBRAR = ["conversas"]; });
  await depoisDeLer(page, () => clicar(page, "[data-atualizar-faxina]"));
  ok("a tela diz que não conseguiu ler", /Não consegui ler as conversas paradas/.test(await texto(page, "[data-faxina-falhou]")),
     await texto(page, '[data-tela="faxina"]').then((t) => t.slice(0, 300)));
  ok("e não diz “nenhuma conversa parada”", (await contar(page, "[data-faxina-vazia]")) === 0);
  ok("nem os números dos grupos como zero", (await attr(page, '[data-faxina-grupo="cliente"]', "data-faxina-conta")) === ""
     && (await contar(page, "[data-faxina-conta-falhou]")) === 1, String(await attr(page, '[data-faxina-grupo="cliente"]', "data-faxina-conta")));
  await page.evaluate(() => { globalThis.__QUEBRAR = []; });
  await depoisDeLer(page, () => clicar(page, "[data-faxina-falhou] button"));
  ok("“Tentar de novo” traz a lista", (await linhas(page)).length === 2, JSON.stringify(await linhas(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. A página de 50, a conta do banco e abrir a conversa");
{
  const { ctx, page, estouros } = await abrir();
  await abrirFaxina(page);
  ok("o telefone das 1.200 conversas está entre os filtros", await escolher(page, "[data-faxina-telefone]", "a13"));
  await grupo(page, "equipe");
  // A CONTA ESPERADA sai das linhas da própria bancada, pela mesma régua.
  const ordem = await page.evaluate(() => {
    const corte = Date.now() - 30 * 864e5;
    return globalThis.__TABELAS.conversas.filter((c) => c.advogado_id === "a13" && ["aguardando", "aberto"].includes(c.situacao)
      && c.ultima_mensagem && !c.arquivada && !c.esperando_desde && new Date(c.ultima_atividade).getTime() < corte)
      .sort((a, b) => (new Date(a.ultima_atividade) - new Date(b.ultima_atividade)) || (a.id < b.id ? -1 : 1))
      .map((c) => c.id);
  });
  const esperado = ordem.length;
  ok("o número do grupo é o do banco", Number(await attr(page, '[data-faxina-grupo="equipe"]', "data-faxina-conta")) === esperado && esperado > 100,
     `${await attr(page, '[data-faxina-grupo="equipe"]', "data-faxina-conta")} contra ${esperado}`);
  let l = await linhas(page);
  ok("a primeira página tem 50", l.length === 50, String(l.length));
  ok("a parada há mais tempo primeiro, na ordem do banco", l.length === 50 && JSON.stringify(l) === JSON.stringify(ordem.slice(0, 50)),
     `${JSON.stringify(l.slice(0, 3))} contra ${JSON.stringify(ordem.slice(0, 3))}`);
  ok("e diz quantas faltam", /Carregar mais \((\d+) restantes\)/.test(await texto(page, "[data-faxina-mais]"))
     && Number((await texto(page, "[data-faxina-mais]")).match(/\((\d+)/)[1]) === esperado - 50, await texto(page, "[data-faxina-mais]"));
  // A TERCEIRA RECEBE MENSAGEM, e a tentativa de finalizá-la a deixa na tela,
  // com o porquê — mas fora do recorte do banco. O "Carregar mais" seguinte
  // tem de trazer a 51ª conversa, e não pular para a 52ª.
  await page.evaluate((id) => {
    const c = globalThis.__TABELAS.conversas.find((x) => x.id === id);
    c.ultima_atividade = new Date().toISOString();
  }, ordem[2]);
  await clicar(page, `[data-faxina-finalizar="${ordem[2]}"]`);
  await esperar(page, "[data-ja-tratei-janela]", 3000);
  await marcarAssunto(page, "ACORDOS");
  await clicar(page, "[data-ja-tratei-confirmar]");
  for (let i = 0; i < 30 && (await contar(page, "[data-ja-tratei-janela]")); i++) await page.waitForTimeout(150);
  await page.waitForTimeout(300);
  ok("a que recebeu mensagem fica na tela, com o porquê", (await contar(page, `[data-faxina-linha="${ordem[2]}"] [data-faxina-problema]`)) === 1);
  await depoisDeLer(page, () => clicar(page, "[data-faxina-mais]"));
  l = await linhas(page);
  ok("“Carregar mais” traz as 50 seguintes, sem repetir", l.length === 100 && new Set(l).size === 100
     && JSON.stringify(l.slice(50)) === JSON.stringify(ordem.slice(50, 100)), `${l.length} · ${l[50]} contra ${ordem[50]}`);
  // ABRIR UMA CONVERSA do a8 com o telefone a7 aberto: a tela fecha, e a conversa abre no telefone dela.
  await escolher(page, "[data-faxina-telefone]", "a8");
  await grupo(page, "cliente");
  await escolher(page, "[data-faxina-responsavel]", "sem");
  await clicar(page, '[data-faxina-abrir="fx-cli-1"]');
  await page.waitForTimeout(1500);
  ok("abrir a conversa fecha a faxina", (await contar(page, '[data-tela="faxina"]')) === 0);
  ok("e abre a conversa, no telefone dela", /CLIENTE FX-CLI-1/.test(await texto(page, "[data-topo-conversa]")),
     (await texto(page, "[data-topo-conversa]")).slice(0, 80));
  // E A FAXINA VOLTA COMO FICOU: quem abre uma conversa para conferir e volta
  // pelo ⋮ não recomeça do zero.
  await abrirFaxina(page);
  ok("voltando pelo ⋮, a faxina está como ficou: o telefone e o responsável",
     (await valor(page, "[data-faxina-telefone]")) === "a8" && (await valor(page, "[data-faxina-responsavel]")) === "sem",
     `${await valor(page, "[data-faxina-telefone]")} · ${await valor(page, "[data-faxina-responsavel]")}`);
  ok("e a lista é a desse recorte", JSON.stringify(await linhas(page)) === JSON.stringify(["fx-cli-2", "fx-cli-1"]),
     JSON.stringify(await linhas(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n9. No celular, e sem o 028 ou sem os assuntos");
{
  const { ctx, page, estouros } = await abrir({ viewport: { width: 390, height: 844 } });
  ok("no celular, o ⋮ também tem a faxina", await abrirFaxina(page));
  await escolher(page, "[data-faxina-telefone]", "a8");
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  ok("a tela não rola de lado", largura <= 390, String(largura));
  const alturas = await page.locator('[data-faxina-linha="fx-cli-1"] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  ok("os botões da linha têm alvo de dedo (40px)", alturas.length >= 3 && alturas.every((h) => h >= 40), JSON.stringify(alturas));
  // AS CAIXAS DE MARCAR ficam fora da regra geral dos 40 pontos (esticadas,
  // viram retângulos), e por isso o alvo delas é o rótulo em volta.
  const alvos = await page.evaluate(() => [
    document.querySelector('[data-faxina-linha="fx-cli-1"] [data-faxina-alvo-marcar]'),
    document.querySelector("[data-faxina-alvo-marcar-todas]"),
  ].map((e) => (e ? { l: Math.round(e.getBoundingClientRect().width), a: Math.round(e.getBoundingClientRect().height) } : null)));
  ok("as caixas de marcar também têm alvo de dedo", alvos.length === 2 && alvos[0] && alvos[1]
     && alvos[0].l >= 40 && alvos[0].a >= 40 && alvos[1].a >= 40, JSON.stringify(alvos));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ semSituacao: true });
  await clicar(page, 'button[aria-label="Menu"]');
  await page.waitForTimeout(300);
  ok("sem o 028 (sem as abas), não há faxina", (await contar(page, "[data-abrir-faxina]")) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ semAssuntos: true });
  await clicar(page, 'button[aria-label="Menu"]');
  await page.waitForTimeout(300);
  ok("sem os assuntos do Finalizar, não há faxina", (await contar(page, "[data-abrir-faxina]")) === 0);
  await ctx.close();
}

await nav.close();
console.log(`\n${falhas ? `${falhas} de ${feitas} conferências FALHARAM.` : `${feitas}/${feitas} conferências passaram`}`);
process.exit(falhas ? 1 : 0);
