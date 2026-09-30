// O "OUTROS" DO "JÁ TRATEI" — e por que ele pede o que foi tratado
//
// Pedido do Rodrigo em 30/09: a checklist do "Já tratei" precisa de uma opção
// "OUTROS". Os oito assuntos cobrem o dia a dia; o que sobra não tinha onde ir,
// e a equipe marcava o mais parecido — o relatório mentindo em silêncio.
//
// "OUTROS" SOZINHO NÃO DIZ NADA. Um relatório com "OUTROS: 40" é a mesma
// pergunta de antes com um número em cima. Por isso ele pede uma descrição.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. sem o script 009, nada muda — nem OUTROS, nem campo, nem chave na
//      administração, e o "Já tratei" de sempre continua gravando;
//   2. com ele, marcar OUTROS abre o campo e o botão SÓ LIGA com texto — e
//      espaço em branco não é texto;
//   3. o texto vai SÓ na linha do OUTROS: repeti-lo em ACORDOS faria o
//      relatório dizer três vezes a mesma coisa sobre três assuntos;
//   4. quem decide é a MARCA do banco, e não o nome "OUTROS": ligada em
//      ACORDOS pela administração, ACORDOS passa a pedir texto.
//
// E UMA MENTIRA DA BANCADA CONSERTADA NO CAMINHO: ela devolvia a linha
// inteira qualquer que fosse a coluna pedida. Um painel que pedisse
// `id, nome, ordem, ativo` receberia `pede_descricao` aqui e nunca no banco
// de verdade — e esta prova passaria com o OUTROS mudo em produção.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const NOME = "OSVALDO DO OUTROS";

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
const ESPERA = diasAtras(4);

/** O telefone que o painel abre — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const SEMENTE = {
  contatos: [{ id: "ct-outros", numero: "5511970004455", nome: NOME,
               vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null }],
  conversas: [{
    id: "cv-outros", advogado_id: ADV, contato_id: "ct-outros",
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: ESPERA, esperando_desde: ESPERA, tratada_em: null,
    ultima_mensagem: "e a segunda via?", frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { id: "ct-outros", nome: NOME, numero: "5511970004455", foto_url: null },
  }],
  mensagens: [
    { id: "m-outros-1", conversa_id: "cv-outros", origem: "contato", tipo: "texto",
      texto: "e a segunda via?", criado_em: ESPERA },
  ],
};

async function abrirPainel({ semDescricao = false, pedem = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_DESCRICAO = d.semDescricao;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = false;
    globalThis.__SEM_RECONTAGEM = false;
    globalThis.__ERRO_NA_GRAVACAO = {};
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__PEDEM_DESCRICAO = d.pedem;
  }, { semente: SEMENTE, semDescricao, pedem });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** Abre a conversa e a janela do "Já tratei". Guardado: clique em elemento
 *  que não existe estoura a prova inteira e esconde QUAL conferência pegou. */
async function abrirJanela(page) {
  const linha = page.locator(`[data-conversa-nome="${NOME}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(800);
  const botao = page.locator('[data-ja-tratei="tratar"]');
  if (!(await botao.count())) return false;
  await botao.first().click();
  await page.waitForSelector("[data-ja-tratei-janela]");
  return true;
}

const marcar = async (page, nome) => {
  const l = page.locator(`[data-assunto-do-ja-tratei="${nome}"] input`);
  if (!(await l.count())) return false;
  await l.click();
  await page.waitForTimeout(150);
  return true;
};

const registros = (page) => page.evaluate(() => {
  const T = globalThis.__TABELAS;
  const nomeDo = (id) => (T.zorvin_assuntos || []).find((a) => String(a.id) === String(id))?.nome || null;
  return (T.zorvin_tratamentos || []).filter((x) => x.conversa_id === "cv-outros").map((x) => ({
    assunto: nomeDo(x.assunto_id),
    temChave: Object.prototype.hasOwnProperty.call(x, "observacao"),
    observacao: x.observacao ?? null,
  }));
});
const esperaNoBanco = (page) => page.evaluate(() =>
  (globalThis.__TABELAS.conversas.find((x) => x.id === "cv-outros") || {}).esperando_desde ?? null);

// ==================================================================
console.log("\nSem o script 009, o “Já tratei” é o de sempre");
{
  const { ctx, page, estouros } = await abrirPainel({ semDescricao: true });
  const abriu = await abrirJanela(page);
  ok("a janela do “Já tratei” abre", abriu);
  const listados = await page.$$eval("[data-assunto-do-ja-tratei]", (ns) => ns.map((n) => n.getAttribute("data-assunto-do-ja-tratei")));
  ok("os assuntos de sempre estão lá", listados.includes("ACORDOS") && listados.length >= 8, listados.join(", "));
  ok("e não há OUTROS", !listados.includes("OUTROS"), listados.join(", "));
  await marcar(page, "ACORDOS");
  ok("marcando um assunto, nenhum campo de texto aparece",
     (await page.locator("[data-ja-tratei-descricao]").count()) === 0);
  ok("e o botão liga", !(await page.locator("[data-ja-tratei-confirmar]").isDisabled()));
  await page.locator("[data-ja-tratei-confirmar]").click();
  await page.waitForTimeout(1200);
  const r = await registros(page);
  ok("o registro foi feito", r.length === 1 && r[0].assunto === "ACORDOS", JSON.stringify(r));
  // A CHAVE NEM VAI: num banco sem a coluna, mandar `observacao` derrubaria o
  // registro inteiro com "column does not exist".
  ok("e SEM a chave do texto, que o banco antigo recusaria", r.length === 1 && !r[0].temChave, JSON.stringify(r));
  ok("e a conversa saiu da fila", (await esperaNoBanco(page)) === null);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nCom o script, OUTROS pede o que foi tratado");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirJanela(page);
  const listados = await page.$$eval("[data-assunto-do-ja-tratei]", (ns) => ns.map((n) => n.getAttribute("data-assunto-do-ja-tratei")));
  ok("OUTROS está na lista", listados.includes("OUTROS"), listados.join(", "));
  // O CAMPO SÓ APARECE COM ELE MARCADO: sempre à vista, viraria "opcional".
  await marcar(page, "ACORDOS");
  ok("marcando só ACORDOS, nenhum campo de texto", (await page.locator("[data-ja-tratei-descricao]").count()) === 0);

  await marcar(page, "OUTROS");
  const campo = page.locator("[data-ja-tratei-descricao]");
  ok("marcando OUTROS, o campo aparece", (await campo.count()) === 1);
  const confirmar = page.locator("[data-ja-tratei-confirmar]");
  ok("e o botão DESLIGA enquanto o campo está vazio", await confirmar.isDisabled());
  ok("e a tela diz por quê", (await page.locator("[data-ja-tratei-falta-texto]").count()) === 1);
  const rotulo = await page.locator('label[for="ja-tratei-descricao"]').innerText().catch(() => "");
  ok("a pergunta diz de qual assunto é o texto", /OUTROS/.test(rotulo), rotulo);
  ok("o campo tem o teto do banco",
     (await campo.count()) === 1 && (await campo.getAttribute("maxlength")) === "500");

  // ESPAÇO NÃO É TEXTO. Os `fill` são GUARDADOS: num campo que não existe
  // eles estourariam a prova inteira, e a lista de conferências sumiria junto.
  const escrever = async (t) => { if (await campo.count()) await campo.fill(t); };
  await escrever("    ");
  await page.waitForTimeout(100);
  ok("só espaços não ligam o botão", await confirmar.isDisabled());

  await escrever("  Cliente pediu a segunda via do boleto; enviada por e-mail.  ");
  await page.waitForTimeout(100);
  ok("com texto, o botão liga", !(await confirmar.isDisabled()));
  // AINDA NADA GRAVADO: abrir e escrever não é confirmar.
  ok("e até aqui nada foi gravado", (await registros(page)).length === 0);

  await confirmar.click();
  await page.waitForTimeout(1200);
  const r = await registros(page);
  const outros = r.find((x) => x.assunto === "OUTROS");
  const acordos = r.find((x) => x.assunto === "ACORDOS");
  ok("ficaram as duas linhas, uma por assunto", r.length === 2, JSON.stringify(r));
  ok("a do OUTROS guarda o texto, sem os espaços das pontas",
     outros && outros.observacao === "Cliente pediu a segunda via do boleto; enviada por e-mail.",
     JSON.stringify(outros));
  // O TEXTO É DO OUTROS, e não de todos os marcados.
  ok("a do ACORDOS NÃO repete o texto", acordos && acordos.observacao === null, JSON.stringify(acordos));
  ok("e a conversa saiu da fila", (await esperaNoBanco(page)) === null);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nDesmarcar OUTROS tira a exigência");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirJanela(page);
  await marcar(page, "OUTROS");
  await marcar(page, "BLINDAGEM");
  ok("com OUTROS marcado e sem texto, o botão fica desligado",
     await page.locator("[data-ja-tratei-confirmar]").isDisabled());
  await marcar(page, "OUTROS");   // desmarca
  ok("desmarcando OUTROS, o campo some", (await page.locator("[data-ja-tratei-descricao]").count()) === 0);
  ok("e o botão volta a ligar pelo BLINDAGEM", !(await page.locator("[data-ja-tratei-confirmar]").isDisabled()));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA administração liga e desliga a marca");
{
  const { ctx, page, estouros } = await abrirPainel();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(900);
  ok("a seção dos assuntos aparece", (await page.locator("[data-assuntos-do-ja-tratei]").count()) === 1);
  const linhaOutros = page.locator('[data-assunto-da-config="OUTROS"]');
  ok("o OUTROS aparece como “pede descrição”",
     /pede descrição/.test(await linhaOutros.innerText().catch(() => "")));
  const chave = page.locator('[data-assunto-da-config="ACORDOS"] [data-assunto-pede-descricao]');
  ok("ACORDOS tem a chave, desligada",
     (await chave.getAttribute("data-assunto-pede-descricao").catch(() => null)) === "nao");
  if (await chave.count()) { await chave.click(); await page.waitForTimeout(900); }
  const noBanco = await page.evaluate(() =>
    (globalThis.__TABELAS.zorvin_assuntos.find((a) => a.nome === "ACORDOS") || {}).pede_descricao);
  ok("ligando, o banco grava a marca em ACORDOS", noBanco === true, String(noBanco));
  ok("e a tela RELÊ e passa a dizer “pede descrição” em ACORDOS",
     /pede descrição/.test(await page.locator('[data-assunto-da-config="ACORDOS"]').innerText().catch(() => "")));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // SEM O SCRIPT, A CHAVE NÃO APARECE: ela ligaria uma coluna que não existe.
  const { ctx, page } = await abrirPainel({ semDescricao: true });
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(900);
  ok("sem o script, a seção existe mas não tem a chave",
     (await page.locator("[data-assuntos-do-ja-tratei]").count()) === 1
     && (await page.locator("[data-assunto-pede-descricao]").count()) === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nQuem decide é a MARCA, e não o nome “OUTROS”");
{
  // ACORDOS com a marca, e OUTROS sem ela — o contrário do que o script faz.
  const { ctx, page, estouros } = await abrirPainel({ pedem: ["ACORDOS"] });
  await abrirJanela(page);
  await marcar(page, "OUTROS");
  ok("OUTROS sem a marca NÃO pede texto", (await page.locator("[data-ja-tratei-descricao]").count()) === 0);
  await marcar(page, "OUTROS");
  await marcar(page, "ACORDOS");
  ok("ACORDOS com a marca pede texto", (await page.locator("[data-ja-tratei-descricao]").count()) === 1);
  ok("e o botão espera por ele", await page.locator("[data-ja-tratei-confirmar]").isDisabled());
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
