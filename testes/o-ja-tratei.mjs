// "JÁ TRATEI" — A FILA GANHA UMA SAÍDA QUE NÃO É MANDAR MENSAGEM
//
// MEDIDO no banco do escritório em 25/09, depois de a fila da espera encher:
// de 813 conversas esperando, 601 eram "nós respondemos e o cliente escreveu
// de volta". E o que ele escreveu por último:
//
//     99  [anexo]      <- o MAIOR grupo, e é espera de verdade
//     42  ok               22  boa tarde       12  bom dia
//      9  obrigada          7  sim              5  certo
//
// Ou seja: ~140 de espera de verdade e ~94 de despedida. Conversa que termina
// em "obrigada" não precisa de resposta, e o banco não tem como saber disso —
// quem sabe é quem leu a conversa. Este botão é só o jeito de ela dizer.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA, e a segunda metade importa mais
//
//   1. tratar tira da fila E DEIXA REGISTRO — não é um botão de "sumir com
//      esta conversa". Sem o registro, a pergunta "o que a equipe fez em
//      setembro" fica sem resposta, que é o motivo de existir uma tabela;
//   2. DESFAZER devolve a espera ORIGINAL. Esta é a conferência que pega o
//      defeito mais caro: escrever `esperando_desde = agora` no painel
//      devolveria a conversa à fila com ZERO dia, apagando os dias que são o
//      motivo de ela precisar voltar. Quem vê a lista não notaria nada.
//
// E as duas laterais, que são armadilhas conhecidas desta casa:
//
//   3. sem o SQL rodado, o botão não aparece — nas DUAS metades do script, que
//      podem estar aplicadas separadamente;
//   4. o banco recusando, a tela NÃO diz que tirou da fila. Nem calada (o
//      `update` barrado pela RLS não devolve erro), nem com erro.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const NOME = "ZULEIDE DA DESPEDIDA";

/** Há seis dias, ao meio-dia.
 *
 *  Ao MEIO-DIA de propósito: "agora menos 144 horas" cai num dia ou noutro
 *  conforme a hora em que a prova roda, e uma conferência que muda de resposta
 *  às 23h não é conferência. */
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
const ESPERA = diasAtras(6);

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo.
 *
 *  A conta de teste não enxerga todos os telefones da bancada (é o filtro de
 *  permissão fazendo o seu trabalho), então plantar a conversa num id fixo
 *  põe metade das vezes num telefone que a tela não oferece. Foi o que
 *  aconteceu na primeira volta desta prova: a conversa existia no banco e não
 *  estava em lugar nenhum da tela, e a prova reprovou falando de "Já tratei"
 *  quando o que faltava era o telefone certo. */
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

/** A CONVERSA QUE O "JÁ TRATEI" EXISTE PARA TIRAR DA FILA.
 *
 *  Ela é plantada aqui, e não emprestada de uma conversa da bancada, por duas
 *  razões:
 *
 *    1. a forma tem de ser a MEDIDA — cliente escreve, nós respondemos, ele
 *       agradece. Uma conversa qualquer não tem essa forma, e a cena diria
 *       medir "a despedida" enquanto mede outra coisa;
 *    2. a recontagem do banco calcula a espera a partir das MENSAGENS. Sem
 *       uma resposta nossa seguida de uma mensagem dele, a cena do desfazer
 *       não teria como ver a conversa voltar — e passaria sem medir nada.
 *
 *  É o mesmo aprendizado da cena do "cliente novo", no CLAUDE.md. */
const SEMENTE = {
  contatos: [{ id: "ct-desp", numero: "5511970001122", nome: NOME,
               vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null }],
  conversas: [{
    id: "cv-desp", advogado_id: ADV, contato_id: "ct-desp",
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: ESPERA, esperando_desde: ESPERA, tratada_em: null,
    ultima_mensagem: "obrigada", frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { id: "ct-desp", nome: NOME, numero: "5511970001122", foto_url: null },
  }],
  mensagens: [
    { id: "m-desp-1", conversa_id: "cv-desp", origem: "contato", tipo: "texto",
      texto: "Boa tarde, consegui a guia?", criado_em: diasAtras(9) },
    { id: "m-desp-2", conversa_id: "cv-desp", origem: "advogado", tipo: "texto",
      texto: "Conseguimos sim, já está protocolado.",
      enviado_por: "Camila Souza", enviado_por_id: "u2", criado_em: diasAtras(8) },
    { id: "m-desp-3", conversa_id: "cv-desp", origem: "contato", tipo: "texto",
      texto: "obrigada", criado_em: ESPERA },
  ],
};

async function abrirPainel({ semTratada = false, semAssuntos = false, semRecontagem = false,
                             erro = {}, semEfeito = [], largura = 1400 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula, e uma
  // ligada num cenário continuaria valendo nos seguintes.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_TRATADA = d.semTratada;
    globalThis.__SEM_ASSUNTOS = d.semAssuntos;
    globalThis.__SEM_RECONTAGEM = d.semRecontagem;
    globalThis.__ERRO_NA_GRAVACAO = d.erro || {};
    globalThis.__ESCRITA_SEM_EFEITO = d.semEfeito || [];
    globalThis.__SEM_ESPERA = false;
  }, { semente: SEMENTE, semTratada, semAssuntos, semRecontagem, erro, semEfeito });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

async function abrirADespedida(page) {
  const linha = page.locator(`[data-conversa-nome="${NOME}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}

/** O que o banco de mentira guarda sobre esta conversa, agora. */
const estadoNoBanco = (page) => page.evaluate(() => {
  const T = globalThis.__TABELAS;
  const c = (T.conversas || []).find((x) => String(x.id) === "cv-desp");
  const tr = (T.zorvin_tratamentos || []).filter((x) => String(x.conversa_id) === String(c && c.id));
  const nomeDo = (id) => (T.zorvin_assuntos || []).find((a) => String(a.id) === String(id))?.nome || null;
  return {
    esperando_desde: c ? c.esperando_desde : "SEM CONVERSA",
    tratada_em: c ? c.tratada_em : "SEM CONVERSA",
    tratamentos: tr.map((x) => ({ assunto: nomeDo(x.assunto_id),
                                  esperava_desde: x.esperava_desde,
                                  desfeito: Boolean(x.desfeito_em) })),
  };
});

/** Os dias que a linha da lista escreve — é o que a pessoa vê. */
const diasNaLista = (page) => page.evaluate((nome) => {
  const linha = document.querySelector(`[data-conversa-nome="${nome}"]`);
  if (!linha) return null;
  const selo = linha.querySelector("[data-espera]");
  return selo ? Number(selo.getAttribute("data-espera")) : 0;
}, NOME);

// ==================================================================
//  1. A DESPEDIDA ESTÁ NA FILA, e é por isso que ela incomoda
// ==================================================================
console.log("\nA conversa que termina em “obrigada” está na fila de espera");
{
  const { ctx, page, estouros } = await abrirPainel();
  const achou = await abrirADespedida(page);
  ok("achei a conversa da despedida", achou);
  if (achou) {
    const dias = await diasNaLista(page);
    ok("ela está esperando, e a lista escreve há quantos dias", dias >= 5, `dias = ${dias}`);
    const antes = await estadoNoBanco(page);
    ok("e no banco ela tem espera e nenhum tratamento",
       antes.esperando_desde && antes.tratamentos.length === 0, JSON.stringify(antes));

    const botao = page.locator('[data-ja-tratei="tratar"]');
    ok("o botão “Já tratei” existe no cabeçalho", (await botao.count()) > 0);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  2. A CHECKLIST — obrigatória, e só com o que está EM USO
// ==================================================================
console.log("\nA janela exige marcar o que foi tratado, e só oferece o que está em uso");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirADespedida(page);
  await page.locator('[data-ja-tratei="tratar"]').first().click();
  await page.waitForSelector("[data-ja-tratei-janela]");

  const listados = await page.$$eval("[data-assunto-do-ja-tratei]",
    (ns) => ns.map((n) => n.getAttribute("data-assunto-do-ja-tratei")));
  ok("a janela lista os assuntos", listados.length >= 8, `foram ${listados.length}`);
  // O ASSUNTO DESATIVADO É A CONFERÊNCIA QUE SEPARA "lista os assuntos" de
  // "lista os assuntos EM USO". Enquanto todos estiverem ativos, as duas
  // telas são idênticas — e a segunda é a que o banco descreve.
  ok("e NÃO oferece o que foi tirado de uso", !listados.includes("MUTIRÃO 2024"),
     listados.join(", "));

  const confirmar = page.locator("[data-ja-tratei-confirmar]");
  ok("o botão de confirmar nasce desligado", await confirmar.isDisabled());
  ok("e a tela diz por quê", (await page.locator("[data-ja-tratei-falta-marcar]").count()) > 0);

  await page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input').click();
  await page.waitForTimeout(150);
  ok("marcando um assunto, ele liga", !(await confirmar.isDisabled()));

  // E NADA FOI GRAVADO SÓ POR ABRIR A JANELA. Sem esta, uma tela que tirasse
  // da fila no clique do botão (antes da checklist) passaria nas outras cenas.
  const meio = await estadoNoBanco(page);
  ok("e até aqui nada foi gravado", meio.esperando_desde && meio.tratamentos.length === 0,
     JSON.stringify(meio));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  3. CONFIRMAR — sai da fila E fica registrado
// ==================================================================
console.log("\nConfirmando, a conversa sai da fila e o que foi tratado fica registrado");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirADespedida(page);
  const esperaOriginal = (await estadoNoBanco(page)).esperando_desde;

  await page.locator('[data-ja-tratei="tratar"]').first().click();
  await page.waitForSelector("[data-ja-tratei-janela]");
  await page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input').click();
  await page.locator('[data-assunto-do-ja-tratei="VENDA LN"] input').click();
  await page.locator("[data-ja-tratei-confirmar]").click();
  await page.waitForTimeout(1200);

  const d = await estadoNoBanco(page);
  ok("a conversa saiu da fila", d.esperando_desde === null, JSON.stringify(d));
  ok("e ficou marcada como tratada", Boolean(d.tratada_em), JSON.stringify(d));
  // UMA LINHA POR ASSUNTO, e não uma com a lista dentro: a pergunta que este
  // registro responde é uma CONTAGEM por assunto.
  ok("ficou UMA linha por assunto marcado", d.tratamentos.length === 2,
     JSON.stringify(d.tratamentos));
  const nomes = d.tratamentos.map((t) => t.assunto).sort();
  ok("e são os dois que foram marcados", nomes.join("|") === "ACORDOS|VENDA LN", nomes.join("|"));
  // O RETRATO DA ESPERA. Sem ele o relatório não sabe dizer se a equipe
  // limpou conversas de ontem ou de dois meses — que é a única coisa que
  // separa uma limpeza de um mutirão.
  ok("o registro guarda desde quando o cliente esperava",
     d.tratamentos.every((t) => t.esperava_desde === esperaOriginal),
     `esperava ${JSON.stringify(d.tratamentos.map((t) => t.esperava_desde))}, original ${esperaOriginal}`);

  ok("a janela fechou", (await page.locator("[data-ja-tratei-janela]").count()) === 0);
  const dias = await diasNaLista(page);
  ok("e a linha não escreve mais que está esperando", dias === 0, `dias = ${dias}`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. DESFAZER — e a espera que volta é a ORIGINAL
// ==================================================================
console.log("\nDesfazendo, a conversa volta com a espera ORIGINAL — e não com zero dia");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirADespedida(page);
  const antes = await estadoNoBanco(page);
  const diasAntes = await diasNaLista(page);

  await page.locator('[data-ja-tratei="tratar"]').first().click();
  await page.waitForSelector("[data-ja-tratei-janela]");
  await page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input').click();
  await page.locator("[data-ja-tratei-confirmar]").click();
  await page.waitForTimeout(1200);

  const desfazer = page.locator('[data-ja-tratei="desfazer"]');
  ok("o botão passou a oferecer a volta", (await desfazer.count()) > 0);
  await desfazer.first().click();
  await page.waitForTimeout(1500);

  const d = await estadoNoBanco(page);
  ok("a conversa voltou para a fila", Boolean(d.esperando_desde), JSON.stringify(d));
  ok("e deixou de estar marcada como tratada", d.tratada_em === null, JSON.stringify(d));
  // A CONFERÊNCIA QUE PEGA O DEFEITO MAIS CARO desta rodada.
  //
  // `esperando_desde = agora` no painel devolveria a conversa à fila com ZERO
  // dia — e ela desceria para o fim, com cara de cliente novo, depois de já
  // ter esperado quase uma semana. Quem olha a lista não veria nada de errado.
  ok("com a espera ORIGINAL, e não com a de agora",
     d.esperando_desde === antes.esperando_desde,
     `voltou ${d.esperando_desde}, era ${antes.esperando_desde}`);
  const diasDepois = await diasNaLista(page);
  ok("e a linha volta a escrever os mesmos dias", diasDepois === diasAntes,
     `antes ${diasAntes}, depois ${diasDepois}`);
  // O REGISTRO NÃO SOME, ele é CARIMBADO: quem desfez e quando é justamente o
  // que se pergunta quando um cliente sumiu da fila em agosto.
  ok("o registro continua existindo, carimbado como desfeito",
     d.tratamentos.length === 1 && d.tratamentos[0].desfeito === true,
     JSON.stringify(d.tratamentos));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  5. SEM O SQL — as DUAS metades, porque podem estar separadas
// ==================================================================
console.log("\nSem o script 005, o botão não aparece — e o script tem duas metades");
{
  // A COLUNA vive dentro do bloco guardado do script; a TABELA dos assuntos,
  // fora dele. Um banco com metade aplicada existe de verdade, e provar só uma
  // das metades deixaria a outra por conta da sorte.
  const semColuna = await abrirPainel({ semTratada: true });
  await abrirADespedida(semColuna.page);
  ok("sem a coluna `tratada_em`, nada de botão",
     (await semColuna.page.locator("[data-ja-tratei]").count()) === 0);
  ok("sem erro de JavaScript no caminho", semColuna.estouros.length === 0,
     semColuna.estouros.join(" | "));
  await semColuna.ctx.close();

  const semLista = await abrirPainel({ semAssuntos: true });
  await abrirADespedida(semLista.page);
  ok("sem a tabela dos assuntos, nada de botão",
     (await semLista.page.locator("[data-ja-tratei]").count()) === 0);
  ok("sem erro de JavaScript no caminho", semLista.estouros.length === 0,
     semLista.estouros.join(" | "));
  await semLista.ctx.close();
}

// ==================================================================
//  6. O BANCO RECUSANDO — a tela não diz que tirou da fila
// ==================================================================
console.log("\nO banco recusando, a tela não afirma ter tirado da fila");
{
  // 6a. O REGISTRO FALHA COM ERRO. Nada pode sair da fila: é a ordem das duas
  // gravações que garante isso, e sem esta conferência inverter a ordem
  // passaria verde.
  const comErro = await abrirPainel({ erro: { zorvin_tratamentos: { code: "42501", message: "permission denied" } } });
  await abrirADespedida(comErro.page);
  await comErro.page.locator('[data-ja-tratei="tratar"]').first().click();
  await comErro.page.waitForSelector("[data-ja-tratei-janela]");
  await comErro.page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input').click();
  await comErro.page.locator("[data-ja-tratei-confirmar]").click();
  await comErro.page.waitForTimeout(1200);

  const frase = await comErro.page.locator("[data-ja-tratei-erro]").first().innerText().catch(() => "");
  ok("a janela diz que falhou", /não consegui registrar/i.test(frase), frase);
  // O CÓDIGO DO BANCO NA FRASE: é o que se digita numa mensagem para quem
  // conserta, e é o que separa 42501 de PGRST301.
  ok("e leva o código do banco junto", /42501/.test(frase), frase);
  const d1 = await estadoNoBanco(comErro.page);
  ok("e NADA saiu da fila", Boolean(d1.esperando_desde) && d1.tratada_em === null,
     JSON.stringify(d1));
  ok("sem erro de JavaScript no caminho", comErro.estouros.length === 0,
     comErro.estouros.join(" | "));
  await comErro.ctx.close();

  // 6b. A RECUSA CALADA, que é a pior das duas: o `update` barrado pela regra
  // de acesso NÃO devolve erro — ele atualiza zero linhas e responde "pronto".
  const calada = await abrirPainel({ semEfeito: ["conversas"] });
  await abrirADespedida(calada.page);
  await calada.page.locator('[data-ja-tratei="tratar"]').first().click();
  await calada.page.waitForSelector("[data-ja-tratei-janela]");
  await calada.page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input').click();
  await calada.page.locator("[data-ja-tratei-confirmar]").click();
  await calada.page.waitForTimeout(1200);

  const frase2 = await calada.page.locator("[data-ja-tratei-erro]").first().innerText().catch(() => "");
  ok("a janela diz que a conversa CONTINUA esperando", /continua esperando/i.test(frase2), frase2);
  const d2 = await estadoNoBanco(calada.page);
  ok("e ela continua mesmo", Boolean(d2.esperando_desde), JSON.stringify(d2));
  ok("sem erro de JavaScript no caminho", calada.estouros.length === 0,
     calada.estouros.join(" | "));
  await calada.ctx.close();
}

// ==================================================================
//  7. NO CELULAR — o mesmo controle, pelo outro endereço
// ==================================================================
console.log("\nNo celular o controle vive no menu ⋮, e é o MESMO");
{
  // A JANELA ESTREITA IMPORTA: abaixo de 768px o cabeçalho não comporta mais
  // um botão (a regra dos 40px de alvo de dedo não deixa encolher os que já
  // estão lá), e por isso o controle muda de endereço. Uma conferência numa
  // janela larga passaria por não ter achado o menu.
  const { ctx, page, estouros } = await abrirPainel({ largura: 390 });
  const achou = await abrirADespedida(page);
  ok("a conversa abre no celular", achou);
  ok("e o botão escrito do cabeçalho NÃO está lá",
     (await page.locator("[data-ja-tratei]").count()) === 0);

  await page.locator('[aria-label="Mais opções desta conversa"]').first().click();
  await page.waitForTimeout(400);
  const item = page.locator('[data-ja-tratei="tratar"]');
  ok("o menu ⋮ oferece o “Já tratei”", (await item.count()) > 0);

  await item.first().click();
  await page.waitForSelector("[data-ja-tratei-janela]");
  await page.locator('[data-assunto-do-ja-tratei="ACORDOS"] input').click();
  await page.locator("[data-ja-tratei-confirmar]").click();
  await page.waitForTimeout(1200);
  const d = await estadoNoBanco(page);
  ok("e ele faz a MESMA coisa que no computador",
     d.esperando_desde === null && d.tratamentos.length === 1, JSON.stringify(d));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
if (falhas) process.exit(1);
