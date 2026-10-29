// A AGENDA PERGUNTA AO BANCO — Configurações › Contatos (auditoria de 28/10)
//
// Dois defeitos da mesma agenda, os dois com a mesma saída: um contato a mais
// no banco, e o cliente partido em duas conversas.
//
// 1. A ABA "CONTATOS" NUNCA PERGUNTAVA. A leitura da agenda só corria com a
//    "Nova conversa" aberta; a aba usava a mesma caixa de busca, mas só
//    filtrava a lista que estivesse na memória. Sem ter aberto a "Nova
//    conversa", ela dizia "Nenhum contato ainda. Toque em Novo para criar." —
//    e quem acreditava criava pelo "Novo" o contato que já existia. Tendo
//    aberto, a lista era a da ÚLTIMA busca de lá. E depois de salvar, a
//    recarga vinha SEM o termo: os 200 primeiros do alfabeto, filtrados pelo
//    que estava escrito na caixa — "Nenhum contato encontrado."
//
// 2. A CONFERÊNCIA "ESTE NÚMERO JÁ EXISTE?" ENGOLIA O ERRO. Falhando a
//    consulta, `contatoExistente` respondia "não existe", e quem chamou criava
//    o contato pela forma canônica. Para quem está gravado sem o nono dígito
//    (504 contatos medidos em 26/10), nascia um SEGUNDO contato — e, quando o
//    cliente respondesse, uma segunda conversa.
//
// O QUE ESTA PROVA GUARDA:
//   1. a aba Contatos mostra a agenda do banco ao abrir — e não "nenhum
//      contato" nem a lista de outra busca —, e procura no banco o que se
//      escreve nela, inclusive quem está além dos 200 primeiros;
//   2. depois de salvar, a lista continua sendo a do termo escrito;
//   3. com a leitura de `contatos` caindo, "Novo contato", "Salvar" da aba,
//      "Conversar com +número" e o link `?telefone=` NÃO criam contato — e a
//      tela diz que não conseguiu conferir, com o código;
//   4. e com a leitura de pé, o mesmo número acha o contato antigo (sem o
//      nono dígito) e não duplica nada.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

// DOIS CONTATOS PLANTADOS NO FIM DO ALFABETO — além dos 200 primeiros que a
// agenda traz sem termo. A Zilda está gravada SEM o nono dígito, como o
// WhatsApp devolve as contas antigas.
const ZENAIDE = "ZENAIDE DA AGENDA";
const ZILDA = "ZILDA SEM O NOVE";
const ZILDA_GRAVADA = "557190012345";
const ZILDA_DIGITADA = "(71) 99001-2345";
const SEMENTE = {
  contatos: [
    { id: "ct-zenaide", numero: "5531970004321", nome: ZENAIDE, foto_url: null },
    { id: "ct-zilda", numero: ZILDA_GRAVADA, nome: ZILDA, foto_url: null },
  ],
};

/** O painel com a semente, e um FILME de todos os avisos que passarem pela
 *  faixa — um aviso pode ser trocado pelo seguinte antes de ser lido. */
async function abrirPainel({ endereco = ENDERECO, quebrarContatos = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__QUEBRAR_SO_A_LEITURA = d.quebrar ? ["contatos"] : [];
    globalThis.__FILME = [];
    globalThis.__DISSE_NENHUM = false;
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el ? el.innerText.trim() : "";
      if (t && globalThis.__FILME[globalThis.__FILME.length - 1] !== t) globalThis.__FILME.push(t);
      // A FRASE QUE MANDAVA CRIAR O QUE JÁ EXISTE — vista em qualquer quadro,
      // e não só no fim: enquanto a agenda vem, ela também seria mentira.
      if (document.body && document.body.textContent.includes("Nenhum contato ainda")) globalThis.__DISSE_NENHUM = true;
    }, 50);
  }, { semente: SEMENTE, quebrar: quebrarContatos });
  await page.goto(endereco);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** Clique guardado: o que não existe não estoura a prova. */
async function clicar(alvo) {
  if (!(await alvo.count())) return false;
  await alvo.first().click({ timeout: 5000 }).catch(() => {});
  return true;
}

async function abrirAbaContatos(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Configurações" })))) return false;
  await page.waitForTimeout(400);
  if (!(await clicar(page.getByRole("button", { name: "Contatos", exact: true })))) return false;
  await page.waitForTimeout(1500);
  return true;
}

/** Os nomes da lista da aba Contatos. Cada linha é o retrato, o bloco do
 *  nome e do número, e o "Conversar" — o nome é o primeiro do bloco do meio
 *  (a primeira linha do texto da linha inteira seria a inicial do retrato). */
const nomesDaAba = (page) => page.$$eval('button[title="Abrir conversa"]',
  (bs) => bs.map((b) => (b.previousElementSibling?.firstElementChild?.innerText || "").trim()));

/** Quantos contatos do banco são esta linha, em qualquer escrita. */
const contatosDaZilda = (page) => page.evaluate(() => (globalThis.__TABELAS.contatos || [])
  .filter((c) => { const d = String(c.numero || "").replace(/\D/g, "");
                   return d.endsWith("90012345") && d.includes("71"); }).map((c) => c.numero));

const filme = (page) => page.evaluate(() => globalThis.__FILME.join(" ‖ "));

// ==================================================================
console.log("\nA aba Contatos mostra a agenda do banco, sem ter aberto a Nova conversa");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("cheguei à aba Contatos", await abrirAbaContatos(page));
  const corpo = await page.locator("body").innerText();
  ok('ela NÃO diz "Nenhum contato ainda"', !/Nenhum contato ainda/.test(corpo));
  ok("nem por um instante, enquanto a agenda vinha", !(await page.evaluate(() => globalThis.__DISSE_NENHUM)));
  const nomes = await nomesDaAba(page);
  ok("e mostra contatos", nomes.length > 0, `${nomes.length} linhas`);

  await page.locator('input[placeholder="Buscar contato"]').fill("ZENAIDE");
  await page.waitForTimeout(1500);
  const achados = await nomesDaAba(page);
  ok("procurando, acha quem está além dos 200 primeiros", achados.includes(ZENAIDE), achados.slice(0, 5).join(", "));

  // DEPOIS DE SALVAR, A LISTA CONTINUA SENDO A DO TERMO. O "Novo" esconde a
  // caixa de busca, e o termo fica lá.
  await clicar(page.getByRole("button", { name: "Novo", exact: true }));
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Ex.: João Silva"]').fill("ZENAIDE NOVA DA AGENDA");
  await page.locator('input[placeholder="5511999999999"]').fill("5531970004399");
  await clicar(page.getByRole("button", { name: "Salvar", exact: true }));
  await page.waitForTimeout(1800);
  const depois = await nomesDaAba(page);
  ok("salvo o novo, a busca escrita continua achando as duas",
     depois.includes(ZENAIDE) && depois.includes("ZENAIDE NOVA DA AGENDA"),
     `${depois.length} linhas: ${depois.slice(0, 4).join(", ")} · avisos: ${await filme(page)}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA aba não herda a lista da última busca da Nova conversa");
{
  const { ctx, page } = await abrirPainel();
  ok("abri a Nova conversa", await clicar(page.locator('button[aria-label="Nova conversa"]')));
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("VANESSA");
  await page.waitForTimeout(1500);
  ok("lá a busca trouxe as Vanessas", await page.locator("[data-contato-agenda]").count() > 0);
  await clicar(page.locator('button[title="Voltar"]'));
  await page.waitForTimeout(300);
  ok("cheguei à aba Contatos", await abrirAbaContatos(page));
  const nomes = await nomesDaAba(page);
  ok("a aba, sem termo, mostra o começo da agenda — e não as Vanessas de lá",
     nomes.length > 0 && !nomes.every((n) => /VANESSA/.test(n)), nomes.slice(0, 3).join(", "));
  await ctx.close();
}

// ==================================================================
console.log("\nA conferência que falha não cria contato — Novo contato da Nova conversa");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("a Zilda começa sendo UM contato", (await contatosDaZilda(page)).length === 1,
     JSON.stringify(await contatosDaZilda(page)));
  await clicar(page.locator('button[aria-label="Nova conversa"]'));
  await page.waitForTimeout(500);
  ok("abri o Novo contato", await clicar(page.getByRole("button", { name: "Novo contato" })));
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Ex.: João Silva"]').fill("ZILDA DE NOVO");
  await page.locator('input[placeholder="5511999999999"]').fill(ZILDA_DIGITADA);
  // A LEITURA CAI AGORA, depois de a agenda ter carregado — é a consulta da
  // conferência que falha, e não a tela inteira.
  await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = ["contatos"]; });
  await clicar(page.getByRole("button", { name: "Salvar e conversar" }));
  await page.waitForTimeout(1500);
  const zildas = await contatosDaZilda(page);
  ok("NENHUM contato novo nasceu", zildas.length === 1, JSON.stringify(zildas));
  const avisos = await filme(page);
  ok("e a tela diz que não conseguiu conferir", /não consegui conferir/i.test(avisos), avisos);
  ok("com o código do banco", /57014/.test(avisos), avisos);

  // O CONTRASTE: com a leitura de pé, o mesmo clique acha a Zilda antiga.
  await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = []; });
  await clicar(page.getByRole("button", { name: "Salvar e conversar" }));
  await page.waitForTimeout(1800);
  const depois = await contatosDaZilda(page);
  ok("com a leitura de pé, o número acha o contato antigo e não duplica", depois.length === 1
     && depois[0] === ZILDA_GRAVADA, JSON.stringify(depois));
  ok("e a conversa abre", (await page.locator("[data-topo-conversa]").count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nE pelas outras portas: o Salvar da aba e o Conversar com +número");
{
  const { ctx, page } = await abrirPainel();
  ok("cheguei à aba Contatos", await abrirAbaContatos(page));
  await clicar(page.getByRole("button", { name: "Novo", exact: true }));
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Ex.: João Silva"]').fill("ZILDA PELA ABA");
  await page.locator('input[placeholder="5511999999999"]').fill(ZILDA_DIGITADA);
  await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = ["contatos"]; });
  await clicar(page.getByRole("button", { name: "Salvar", exact: true }));
  await page.waitForTimeout(1500);
  ok("o Salvar da aba não cria contato", (await contatosDaZilda(page)).length === 1,
     JSON.stringify(await contatosDaZilda(page)));
  const avisos = await filme(page);
  ok('e não diz "Contato salvo!"', !/Contato salvo/i.test(avisos) && /não consegui conferir/i.test(avisos), avisos);
  await ctx.close();
}
{
  const { ctx, page } = await abrirPainel();
  await clicar(page.locator('button[aria-label="Nova conversa"]'));
  await page.waitForTimeout(800);
  // A LEITURA CAI ANTES DE DIGITAR: com ela de pé, a busca pelo número traria
  // a Zilda para a agenda da memória, e a conferência a acharia ali sem
  // precisar do banco — a cena não mediria nada.
  await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = ["contatos"]; });
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("71990012345");
  await page.waitForTimeout(1500);
  const botao = page.getByRole("button", { name: /Conversar com \+/ });
  ok("a Nova conversa oferece conversar com o número", (await botao.count()) === 1);
  await clicar(botao);
  await page.waitForTimeout(1500);
  ok("o Conversar com +número não cria contato", (await contatosDaZilda(page)).length === 1,
     JSON.stringify(await contatosDaZilda(page)));
  ok("e diz que não conferiu", /não consegui conferir/i.test(await filme(page)), await filme(page));
  await ctx.close();
}

// ==================================================================
console.log("\nE o link ?telefone= não segue sem ter conferido");
{
  const { ctx, page } = await abrirPainel({ endereco: `${ENDERECO}?telefone=5571990012345&nome=ZILDA%20DO%20LINK`,
                                           quebrarContatos: true });
  await page.waitForTimeout(800);
  const avisos = await filme(page);
  ok("o link diz que não conseguiu conferir o número", /não consegui conferir/i.test(avisos), avisos);
  ok("e não oferece a escolha do telefone, que criaria o contato",
     !/Falar por qual telefone|por qual telefone/i.test(await page.locator("body").innerText()));
  ok("nenhum contato novo", (await contatosDaZilda(page)).length === 1, JSON.stringify(await contatosDaZilda(page)));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
