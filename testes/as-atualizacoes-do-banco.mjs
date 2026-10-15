// AS ATUALIZAÇÕES DO BANCO — o que a ponte fez com os scripts ao subir (08/10)
//
// Até 08/10 cada mudança de banco era um bloco de SQL colado à mão, e a última
// linha dele respondia "deu certo?" no editor da Supabase. Agora a ponte aplica
// sozinha (`sql/automaticos/`) e guarda o desfecho; quem administra o lê numa
// aba de "Departamentos e acessos" e, quando há algo a fazer, numa linha da
// faixa vermelha.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. em dia: nada acende; a aba diz "Em dia", mostra o que entrou nesta
//      subida com a conferência, e os colados à mão RECOLHIDOS numa linha;
//   2. um script que falhou acende uma linha na faixa — só para quem
//      administra — e o botão dela abre a administração JÁ na aba certa;
//   3. a conferência que não fechou: acende pela que entrou NESTA subida, e
//      não pela de antes; na aba, o valor que preocupa vem pintado;
//   4. quem atende nem pergunta;
//   5. a pergunta que FALHA não vira "em dia" nem "desligada" — a aba diz a
//      falha, e a faixa não acende (a armadilha nº 2 com outra roupa);
//   6. a ponte de antes desta tela (sem a rota) é dita, e não é erro;
//   7. "Perguntar de novo" na aba atualiza a faixa — a mesma tela não pode
//      dizer duas coisas;
//   8. desligada (sem DATABASE_URL) não acende nada, e a aba diz;
//   9. no celular as abas quebram em linha, e a página não ganha rolagem de
//      lado;
//  10. A PONTE NO AR (15/10): a aba diz qual versão está no ar e o que o
//      GitHub tem de mais novo; a versão que a Render não publicou acende a
//      faixa, contada da PRIMEIRA que falta; a entrega recém-mesclada não
//      acende nada; o GitHub que não responde não vira "a mais nova"; e a
//      pergunta que falha não apaga o aviso da mesma ponte.
//
// A PONTE É FINGIDA pela prova (`page.route`), como nas outras telas que
// falam com ela: a ponte de verdade, com um Postgres de verdade, é provada no
// repositório dela (seção 51). O GITHUB TAMBÉM: uma prova que perguntasse ao
// de verdade reprovaria no dia em que ele limitasse as perguntas da máquina
// da integração contínua — falando de outro assunto.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const iso = (msAtras) => new Date(AGORA - msAtras).toISOString();

// Os vinte que o Rodrigo colou à mão, como a ponte os anota com o marco.
const A_MAO = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return { nome: `${n}-script-${n}.sql`, origem: "a_mao", aplicado_em: iso(3600e3), tempo_ms: null,
           sucesso: true, erro: null, conferencia: null, alerta: false };
});
const O_021 = { nome: "021-o-campo-novo.sql", origem: "ponte", aplicado_em: iso(60e3), tempo_ms: 42,
                sucesso: true, erro: null, alerta: false,
                conferencia: [{ o_que: "a coluna nova existe", resposta: "true" },
                              { o_que: "conversas com a coluna preenchida", resposta: "1802" }] };

const EM_DIA = {
  ok: true, ligado: true, modo: "aplicar", situacao: "em_dia",
  mensagem: "O banco está em dia. Nesta subida entrou: 021-o-campo-novo.sql.",
  detalhe: "", quando: iso(30e3), servidor: "aws-0-sa-east-1.pooler.supabase.com:5432",
  na_pasta: [...A_MAO.map((a) => a.nome), O_021.nome], pendentes: [], nesta_subida: [O_021.nome],
  marco: null, aplicados: [...A_MAO, O_021], alertas: [], proxima_tentativa: null,
};
const FALHOU = {
  ...EM_DIA, situacao: "falhou",
  mensagem: "022-a-tabela-nova.sql falhou e não foi aplicado, nem os que vêm depois dele. "
    + "A ponte segue atendendo normalmente.",
  detalhe: 'syntax error at or near "tabel" · código 42601',
  pendentes: ["022-a-tabela-nova.sql", "023-o-indice.sql"], nesta_subida: [],
  aplicados: [...A_MAO, O_021, { nome: "022-a-tabela-nova.sql", origem: "ponte", aplicado_em: iso(20e3),
    tempo_ms: 3, sucesso: false, erro: 'syntax error at or near "tabel" · código 42601',
    conferencia: null, alerta: false }],
};
const NAO_FECHOU = {
  ...EM_DIA,
  aplicados: [...A_MAO,
    // a de ANTES desta subida, que já não fechou e continua marcada
    { ...O_021, nome: "021-o-campo-novo.sql", aplicado_em: iso(86400e3), alerta: true,
      conferencia: [{ o_que: "a função responde para quem atende", resposta: "NÃO — permission denied (código 42501)" }] },
    { nome: "022-a-regra-nova.sql", origem: "ponte", aplicado_em: iso(60e3), tempo_ms: 8, sucesso: true,
      erro: null, alerta: true, conferencia: [{ o_que: "a regra nova existe", resposta: false }] },
  ],
  nesta_subida: ["022-a-regra-nova.sql"], alertas: ["021-o-campo-novo.sql", "022-a-regra-nova.sql"],
  mensagem: "O banco está em dia. Nesta subida entrou: 022-a-regra-nova.sql.",
};
// SÓ A DE ANTES não fechou: nada nesta subida.
const NAO_FECHOU_ANTES = { ...NAO_FECHOU, nesta_subida: [], alertas: ["021-o-campo-novo.sql"],
  aplicados: NAO_FECHOU.aplicados.filter((a) => a.nome !== "022-a-regra-nova.sql"),
  mensagem: "O banco está em dia: nenhum script esperando." };
const DESLIGADO = {
  ok: true, ligado: false, modo: "conferir", situacao: "desligado",
  mensagem: "Sem DATABASE_URL na Render: as mudanças de banco continuam sendo coladas à mão, como sempre foram.",
  detalhe: "", quando: iso(30e3), servidor: "", na_pasta: [], pendentes: [], nesta_subida: [],
  marco: null, aplicados: [], alertas: [], proxima_tentativa: null,
};

/**
 * Abre o painel com a ponte respondendo `respostas` à pergunta dos scripts —
 * uma por pergunta, e a última se repete. Uma resposta é o corpo (200), ou
 * `{ status, corpo }`.
 */
async function abrir({ respostas, github = [], admin = true, largura = 1360, altura = 900 }) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((a) => {
    globalThis.__SOU_ADMIN = a;
    // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO — sem ela não vê telefone
    // nenhum, e a prova esperaria para sempre por uma lista que não vem. A
    // linha com os dois vazios quer dizer "qualquer".
    globalThis.__SEMENTE = a ? undefined
      : { permissoes: [{ id: 903, usuario_id: "u1", departamento_id: null, telefone_id: null }] };
    globalThis.__RECUSAR_LEITURA = [];
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, admin);
  const perguntas = [];
  await page.route("**/ponte-de-mentira/**", (rota) => {
    const caminho = new URL(rota.request().url()).pathname.replace("/ponte-de-mentira", "");
    if (caminho === "/scripts/estado") {
      const r = respostas[Math.min(perguntas.length, respostas.length - 1)];
      perguntas.push(caminho);
      const { status = 200, corpo = r } = r && r.status ? r : {};
      return rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  // O GITHUB DE MENTIRA: uma resposta por pergunta, e a última se repete.
  // "cair" é a rede que não chega lá. Sem `github`, toda pergunta cai — e é
  // contada, para as cenas que exigem que ela NEM saia.
  const doGitHub = [];
  await page.route("https://api.github.com/**", (rota) => {
    const r = github[Math.min(doGitHub.length, github.length - 1)];
    doGitHub.push(rota.request().url());
    if (!r || r === "cair") return rota.abort();
    const { status = 200, corpo = r, cabecalhos = {} } = !Array.isArray(r) && r.status ? r : {};
    return rota.fulfill({ status, body: JSON.stringify(corpo),
      headers: { "content-type": "application/json", "access-control-allow-origin": "*",
                 "access-control-expose-headers": "X-RateLimit-Remaining", ...cabecalhos } });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  // A PERGUNTA SAI TRÊS SEGUNDOS DEPOIS de o painel saber quem administra.
  // Espera-se por ela, e não por um tempo fixo — tempo fixo reprova no dia em
  // que a máquina estiver lenta, falando de outro assunto. Quem atende não
  // pergunta nunca, e aí o que se espera é o tempo em que ela já teria saído.
  for (let i = 0; i < 60 && admin && !perguntas.length; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(admin ? 600 : 5000);
  return { ctx, page, estouros, perguntas, doGitHub };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}

async function abrirAAba(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(500);
  if (!(await clicar(page.locator("[data-aba-banco]")))) return false;
  await page.waitForTimeout(700);
  return true;
}

const FRASE = "[data-frase-dos-scripts]";
const ABA = "[data-atualizacoes-do-banco]";
const texto = (page, sel) => page.locator(sel).first().innerText().catch(() => "");

// ==================================================================
console.log("\nEm dia: nada acende, e a aba diz o que entrou");
{
  const { ctx, page, estouros, perguntas } = await abrir({ respostas: [EM_DIA] });
  ok("quem administra pergunta à ponte ao abrir", perguntas.length === 1, `${perguntas.length} pergunta(s)`);
  ok("em dia, a faixa não ganha linha nenhuma", (await page.locator(FRASE).count()) === 0);
  ok("a aba abre", await abrirAAba(page));
  ok("e diz Em dia", (await page.locator('[data-situacao-dos-scripts="em_dia"]').count()) === 1
     && /Em dia/.test(await texto(page, "[data-situacao-dos-scripts]")), await texto(page, ABA));
  const s021 = page.locator('[data-script-aplicado="021-o-campo-novo.sql"][data-origem="ponte"]');
  ok("o script desta subida aparece, com o selo de que entrou agora",
     (await s021.count()) === 1 && /nesta subida/.test(await s021.innerText().catch(() => "")),
     await s021.innerText().catch(() => "(não achei)"));
  const conf = await s021.locator("[data-linha-da-conferencia]").allInnerTexts().catch(() => []);
  ok("com a conferência dele, linha por linha",
     conf.length === 2 && /a coluna nova existe:\s*true/.test(conf[0]) && /1802/.test(conf[1]), JSON.stringify(conf));
  ok("e nada pintado de defeito numa conferência boa",
     (await page.locator(`${ABA} [data-valor-preocupa]`).count()) === 0);
  // OS COLADOS À MÃO, RECOLHIDOS: abertos, eles empurrariam para fora da vista
  // o script de hoje, que é o que se veio olhar.
  const linhaAMao = await texto(page, "[data-colados-a-mao]");
  ok("os vinte colados à mão ficam numa linha só, dizendo de qual a qual",
     /20 scripts colados à mão/.test(linhaAMao) && /001 a 020/.test(linhaAMao), linhaAMao);
  ok("recolhidos de início", (await page.locator('[data-origem="a_mao"]').count()) === 0);
  await clicar(page.locator("[data-ver-colados-a-mao]"));
  await page.waitForTimeout(300);
  ok("e abrem num clique", (await page.locator('[data-origem="a_mao"]').count()) === 20,
     `${await page.locator('[data-origem="a_mao"]').count()}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nUm script que falhou: a faixa acende, e o botão leva à aba");
{
  const { ctx, page, estouros } = await abrir({ respostas: [FALHOU] });
  const frase = await texto(page, FRASE);
  ok("a faixa ganha a linha das atualizações, dizendo qual", /atualização 022 do banco falhou/.test(frase), frase);
  ok("e que o resto segue funcionando", /segue funcionando/.test(frase), frase);
  ok("o botão dela abre a administração JÁ na aba das atualizações",
     (await clicar(page.locator("[data-ver-atualizacoes-do-banco]")))
       && (await page.waitForTimeout(800), (await page.locator(ABA).count()) === 1));
  const aba = await texto(page, ABA);
  ok("a aba diz Falhou e a frase da ponte",
     (await page.locator('[data-situacao-dos-scripts="falhou"]').count()) === 1 && /022-a-tabela-nova\.sql falhou/.test(aba), aba);
  ok("com o motivo técnico à parte", /syntax error/.test(await texto(page, "[data-detalhe-dos-scripts]")));
  ok("e o que ficou esperando", /022-a-tabela-nova\.sql, 023-o-indice\.sql/.test(await texto(page, "[data-scripts-pendentes]")));
  const s022 = page.locator('[data-script-aplicado="022-a-tabela-nova.sql"]');
  ok("o script que falhou aparece marcado como falhou", /falhou/.test(await s022.innerText().catch(() => "")));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA conferência que não fechou");
{
  const { ctx, page } = await abrir({ respostas: [NAO_FECHOU] });
  const frase = await texto(page, FRASE);
  ok("a que entrou NESTA subida e não fechou acende a faixa",
     /atualização 022 do banco entrou, mas a conferência/.test(frase), frase);
  await abrirAAba(page);
  const s022 = page.locator('[data-script-aplicado="022-a-regra-nova.sql"]');
  ok("na aba, o script vem marcado", (await s022.getAttribute("data-conferencia-preocupa").catch(() => null)) === "sim");
  ok("e o valor que preocupa vem pintado",
     (await s022.locator("[data-valor-preocupa]").count()) === 1
       && (await s022.locator("[data-valor-preocupa]").innerText()) === "false");
  ok('"NÃO — …" também é pintado',
     /NÃO — permission denied/.test(await page.locator('[data-script-aplicado="021-o-campo-novo.sql"] [data-valor-preocupa]').innerText().catch(() => "")));
  await ctx.close();
}
{
  // A DE ANTES já foi dita na subida dela. Acender de novo a cada abertura
  // seria a faixa que nunca apaga — e essa se aprende a ignorar.
  const { ctx, page } = await abrir({ respostas: [NAO_FECHOU_ANTES] });
  ok("a que não fechou numa subida ANTERIOR não acende a faixa", (await page.locator(FRASE).count()) === 0);
  await abrirAAba(page);
  ok("mas continua marcada na aba",
     (await page.locator('[data-script-aplicado="021-o-campo-novo.sql"][data-conferencia-preocupa="sim"]').count()) === 1);
  await ctx.close();
}

// ==================================================================
console.log("\nQuem atende nem pergunta");
{
  const { ctx, page, perguntas, doGitHub } = await abrir({ respostas: [FALHOU], admin: false });
  ok("quem atende não pergunta à ponte pelos scripts", perguntas.length === 0, `${perguntas.length} pergunta(s)`);
  ok("nem ao GitHub pela versão da ponte", doGitHub.length === 0, doGitHub.join(" | "));
  ok("e a faixa não ganha a linha", (await page.locator(FRASE).count()) === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nA pergunta que falha não vira \"em dia\"");
{
  const { ctx, page } = await abrir({ respostas: [{ status: 502, corpo: { ok: false, erro: "A ponte tropeçou." } }] });
  ok("a pergunta que falha não acende a faixa", (await page.locator(FRASE).count()) === 0);
  await abrirAAba(page);
  const falha = await texto(page, "[data-falha-dos-scripts]");
  ok("a aba diz que não conseguiu perguntar, com a frase da ponte",
     /Não consegui perguntar à ponte/.test(falha) && /A ponte tropeçou/.test(falha), falha);
  ok("e não diz situação nenhuma — nem em dia, nem desligada",
     (await page.locator("[data-situacao-dos-scripts]").count()) === 0);
  await ctx.close();
}
{
  // A PONTE DE ANTES DESTA TELA, numa publicação no meio do caminho.
  const { ctx, page } = await abrir({ respostas: [{ status: 404, corpo: {} }] });
  await abrirAAba(page);
  const falha = await texto(page, "[data-falha-dos-scripts]");
  ok("a ponte sem a rota é dita como ponte de antes desta tela, e não como erro",
     /ainda não sabe responder/.test(falha) && !/Não consegui perguntar/.test(falha), falha);
  await ctx.close();
}

// ==================================================================
console.log("\n\"Perguntar de novo\" atualiza a faixa");
{
  const { ctx, page } = await abrir({ respostas: [FALHOU, EM_DIA] });
  ok("começa com a faixa acesa", (await page.locator(FRASE).count()) === 1);
  // A ABA PERGUNTA AO ABRIR — é a segunda resposta, "em dia".
  await clicar(page.locator("[data-ver-atualizacoes-do-banco]"));
  await page.waitForTimeout(900);
  ok("a aba, perguntando de novo, diz em dia", (await page.locator('[data-situacao-dos-scripts="em_dia"]').count()) === 1);
  ok("e a faixa apaga junto — a mesma tela não diz duas coisas", (await page.locator(FRASE).count()) === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nDesligada: nada acende, e a aba diz");
{
  const { ctx, page } = await abrir({ respostas: [DESLIGADO] });
  ok("desligada não acende a faixa", (await page.locator(FRASE).count()) === 0);
  await abrirAAba(page);
  ok("a aba diz Desligada e por quê",
     (await page.locator('[data-situacao-dos-scripts="desligado"]').count()) === 1
       && /coladas à mão/.test(await texto(page, "[data-mensagem-dos-scripts]")));
  await ctx.close();
}

// ==================================================================
console.log("\nNo celular");
{
  const { ctx, page } = await abrir({ respostas: [FALHOU], largura: 360, altura: 780 });
  await clicar(page.locator("[data-ver-atualizacoes-do-banco]"));
  await page.waitForTimeout(800);
  ok("a aba abre pelo botão da faixa", (await page.locator(ABA).count()) === 1);
  const larguras = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth, janela: window.innerWidth,
    aba: (() => { const b = document.querySelector("[data-aba-banco]"); const r = b && b.getBoundingClientRect();
                  return r ? Math.round(r.right) : null; })(),
  }));
  ok("as abas quebram em linha, e a página não ganha rolagem de lado",
     larguras.pagina <= larguras.janela && larguras.aba !== null && larguras.aba <= larguras.janela,
     JSON.stringify(larguras));
  await ctx.close();
}

// ==================================================================
//  A PONTE NO AR, E O QUE O GITHUB TEM DE MAIS NOVO (15/10)
//
//  Em 14/10 três PRs da ponte foram mesclados e a Render não publicou nenhum;
//  esta aba dizia "Em dia", certa para a ponte que estava no ar. As cenas
//  abaixo são esse dia, e os vizinhos dele.
// ==================================================================
const SHA = {
  v193: "a1b2c3d" + "4".repeat(33), v192: "efc32ba" + "0".repeat(33), v191: "16c29eb" + "1".repeat(33),
  v190: "658dc71" + "2".repeat(33), v189: "3df2681" + "3".repeat(33),
};
// COMO O GITHUB DEVOLVE, só o que o painel lê. O autor escreveu um dia ANTES
// do merge: a hora certa é a do "committer", que é a da entrada no ramo.
//
// A HORA SAI DO RELÓGIO DE AGORA, e não do `AGORA` do começo da prova: a
// cena do "mesclada há cinco minutos" roda minutos depois de a prova começar,
// e na primeira escrita ela leu "há 7 minutos" — a prova envelhecendo a
// própria cena.
const commitDoGitHub = (sha, titulo, msAtras) => {
  const quando = (ms) => new Date(Date.now() - ms).toISOString();
  return { sha, commit: { message: `${titulo}\n\n* o corpo do PR`,
    committer: { date: quando(msAtras) }, author: { date: quando(msAtras + 86400e3) } } };
};
const H = 3600e3, M = 60e3;
const LISTA_DE_14_10 = [
  commitDoGitHub(SHA.v192, "O assunto DÚVIDAS TRATADAS no \"Já tratei\" (script 027) (#192)", 18 * H),
  commitDoGitHub(SHA.v191, "O OUTROS sempre no fim da lista do \"Já tratei\" (script 026) (#191)", 18.3 * H),
  commitDoGitHub(SHA.v190, "O REPASSE no \"Já tratei\", e a lista em ordem alfabética (script 025) (#190)", 18.6 * H),
  commitDoGitHub(SHA.v189, "O copiloto (#189)", 40 * H),
];
const versao = (commit, ultimo = "027-duvidas-tratadas.sql") => ({ commit, ramo: "main",
  repositorio: "ropelimi/zorvin-bridge", servico: "zorvin-bridge", ultimo_script: ultimo });
const comVersao = (commit, ultimo) => ({ ...EM_DIA, versao: versao(commit, ultimo) });
const VERSAO = "[data-versao-da-ponte]";
const tipoDaVersao = (page) => page.locator(VERSAO).first().getAttribute("data-versao-da-ponte").catch(() => null);
// A HORA COMO O NAVEGADOR A ESCREVE, no fuso dele — e não no da prova. Lida
// do próprio commit de mentira, para não haver dois relógios na conta.
const comoONavegadorEscreve = (page, commit) => page.evaluate((i) => {
  const d = new Date(i); const dois = (n) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}, commit.commit.committer.date);

console.log("\nA ponte no ar é a mais nova");
{
  const { ctx, page, estouros, perguntas: perguntasDaPonte, doGitHub: perguntas } = await abrir({ respostas: [comVersao(SHA.v192)], github: [LISTA_DE_14_10] });
  ok("a mais nova não acende a faixa", (await page.locator(FRASE).count()) === 0);
  const pergunta = perguntas[0] || "";
  ok("o painel pergunta ao GitHub pelas versões do ramo DA PONTE, sem os arquivos",
     /^https:\/\/api\.github\.com\/repos\/ropelimi\/zorvin-bridge\/commits\?/.test(pergunta)
       && /[?&]sha=main(&|$)/.test(pergunta) && /[?&]per_page=20(&|$)/.test(pergunta), pergunta || "(não perguntou)");
  await abrirAAba(page);
  const bloco = await texto(page, VERSAO);
  ok("a aba começa dizendo qual ponte está no ar, com o selo de a mais nova",
     (await tipoDaVersao(page)) === "a_mais_nova" && /a mais nova/.test(bloco) && /efc32ba/.test(bloco), bloco);
  ok("a versão leva ao GitHub, no commit inteiro",
     (await page.locator("[data-link-da-versao]").getAttribute("href").catch(() => null))
       === `https://github.com/ropelimi/zorvin-bridge/commit/${SHA.v192}`);
  ok("com o título dela, e sem o corpo do PR",
     /“O assunto DÚVIDAS TRATADAS no "Já tratei" \(script 027\) \(#192\)”/.test(bloco) && !/corpo do PR/.test(bloco), bloco);
  const hora = await comoONavegadorEscreve(page, LISTA_DE_14_10[0]);
  ok("e a hora em que ela entrou no ramo — a do merge, e não a de quem escreveu",
     bloco.includes(`de ${hora}`), `esperava "de ${hora}" em: ${bloco}`);
  ok("e até qual atualização do banco ela conhece",
     (await texto(page, "[data-ultimo-script]")) === "027" && /conhece as atualizações do banco até a 027/.test(bloco), bloco);
  ok("vem ANTES da situação dos scripts — é ela que dá sentido ao \"em dia\"",
     await page.evaluate(() => {
       const v = document.querySelector("[data-versao-da-ponte]"), s = document.querySelector("[data-situacao-dos-scripts]");
       return Boolean(v && s && (v.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING));
     }));
  ok("sem instrução de publicar quando não há o que publicar", (await page.locator("[data-como-publicar]").count()) === 0);
  // A ABA PERGUNTA AO ABRIR, e não a cada desenho do painel. Ela pergunta de
  // novo sempre que a função `aoSaber` muda; feita de novo a cada desenho,
  // cada resposta redesenharia o painel e puxaria a pergunta seguinte — à
  // ponte e ao GitHub, sem parar.
  //
  // TRÊS, e não duas: no desenvolvimento o React monta a aba duas vezes
  // (`StrictMode`), e são duas perguntas ao abrir, mais a da faixa. O que a
  // conferência separa é o número que PARA de um que continua subindo.
  const aoAbrir = { ponte: perguntasDaPonte.length, github: perguntas.length };
  await page.waitForTimeout(2500);
  ok("a aba pergunta ao abrir, e não continua perguntando — à ponte e ao GitHub",
     perguntasDaPonte.length === aoAbrir.ponte && perguntas.length === aoAbrir.github
       && perguntasDaPonte.length <= 3 && perguntas.length <= 3,
     `ao abrir: ${JSON.stringify(aoAbrir)}; 2,5 s depois: ${perguntasDaPonte.length} à ponte e ${perguntas.length} ao GitHub`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n14/10: três versões que a Render não publicou");
{
  const { ctx, page, estouros } = await abrir({
    respostas: [comVersao(SHA.v189, "024-o-manual-do-copiloto.sql")], github: [LISTA_DE_14_10] });
  const frase = await texto(page, FRASE);
  const primeira = await comoONavegadorEscreve(page, LISTA_DE_14_10[2]);
  ok("a faixa acende para quem administra: quantas, e que a Render não publicou",
     /3 versões novas da ponte não estão no ar/.test(frase) && /a Render não publicou/.test(frase), frase);
  ok("contando da PRIMEIRA que falta — a que já devia estar no ar há mais tempo",
     frase.includes(primeira), `esperava ${primeira} em: ${frase}`);
  ok("o botão dela leva à aba", (await clicar(page.locator("[data-ver-atualizacoes-do-banco]")))
     && (await page.waitForTimeout(900), (await page.locator(ABA).count()) === 1));
  const bloco = await texto(page, VERSAO);
  ok("a aba diz desatualizada, e qual versão está no ar",
     (await tipoDaVersao(page)) === "desatualizada" && /desatualizada/.test(bloco) && /3df2681/.test(bloco), bloco);
  ok("e que ela conhece as atualizações só até a 024", /até a 024/.test(bloco), bloco);
  const comoPublicar = await texto(page, "[data-como-publicar]");
  ok("e como publicar, com o nome do serviço na Render",
     /Manual Deploy → Deploy latest commit/.test(comoPublicar) && /zorvin-bridge/.test(comoPublicar)
       && /a Render não publicou/i.test(comoPublicar), comoPublicar);
  const faltam = await page.locator("[data-versao-que-falta]").allInnerTexts().catch(() => []);
  ok("e as que faltam, da mais nova para a mais velha",
     faltam.length === 3 && /#192/.test(faltam[0]) && /#191/.test(faltam[1]) && /#190/.test(faltam[2]), JSON.stringify(faltam));
  ok("cada uma levando ao GitHub",
     (await page.locator("[data-versao-que-falta] a").first().getAttribute("href").catch(() => null))
       === `https://github.com/ropelimi/zorvin-bridge/commit/${SHA.v192}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nA entrega de agora, que a Render ainda está publicando");
{
  const lista = [commitDoGitHub(SHA.v193, "A versão de agora (#193)", 5 * M), ...LISTA_DE_14_10];
  const { ctx, page } = await abrir({ respostas: [comVersao(SHA.v192)], github: [lista] });
  ok("mesclada há cinco minutos, a faixa não acende — é o normal de toda entrega",
     (await page.locator(FRASE).count()) === 0, await texto(page, FRASE));
  await abrirAAba(page);
  const bloco = await texto(page, VERSAO);
  ok("a aba diz publicando, há quanto tempo, e que é para perguntar de novo",
     (await tipoDaVersao(page)) === "publicando" && /há [4-6] minutos/.test(bloco) && /pergunte de novo/.test(bloco), bloco);
  ok("sem mandar fazer o Manual Deploy", (await page.locator("[data-como-publicar]").count()) === 0);
  await ctx.close();
}
{
  // DUAS ENTREGAS SEGUIDAS: a segunda, recém-mesclada, não pode esconder a
  // primeira, que já devia estar no ar há quarenta minutos.
  const lista = [commitDoGitHub(SHA.v193, "A versão de agora (#193)", 3 * M),
                 commitDoGitHub(SHA.v192, "A de quarenta minutos atrás (#192)", 40 * M), ...LISTA_DE_14_10.slice(1)];
  const { ctx, page } = await abrir({ respostas: [comVersao(SHA.v191)], github: [lista] });
  const frase = await texto(page, FRASE);
  ok("com duas por publicar, conta a primeira: a faixa acende", /2 versões novas da ponte não estão no ar/.test(frase), frase);
  await ctx.close();
}

console.log("\nO GitHub que não responde não vira \"a mais nova\"");
for (const [rotulo, resposta, frase] of [
  ["limitado", { status: 403, corpo: { message: "API rate limit exceeded" }, cabecalhos: { "x-ratelimit-remaining": "0" } },
   /limitou as perguntas deste endereço/],
  ["fora do ar", "cair", /não consegui falar com o GitHub/],
  ["sem o repositório", { status: 404, corpo: { message: "Not Found" } }, /pode ser privado/],
]) {
  const { ctx, page } = await abrir({ respostas: [comVersao(SHA.v189, "024-o-manual-do-copiloto.sql")], github: [resposta] });
  ok(`GitHub ${rotulo}: a faixa não acende`, (await page.locator(FRASE).count()) === 0, await texto(page, FRASE));
  await abrirAAba(page);
  const bloco = await texto(page, VERSAO);
  ok(`GitHub ${rotulo}: a aba diz que não conseguiu conferir, e por quê — sem selo nenhum`,
     (await tipoDaVersao(page)) === "sem_github" && /Não consegui conferir no GitHub/.test(bloco) && frase.test(bloco)
       && (await page.locator("[data-selo-da-versao]").count()) === 0, bloco);
  ok(`GitHub ${rotulo}: e a versão no ar continua dita`, /3df2681/.test(bloco) && /até a 024/.test(bloco), bloco);
  await ctx.close();
}

console.log("\nSem o que comparar, nem pergunta");
{
  // A PONTE DE ANTES DESTA LINHA — a de hoje no escritório, até a próxima
  // publicação dela.
  const { ctx, page, doGitHub: perguntas } = await abrir({ respostas: [EM_DIA], github: [LISTA_DE_14_10] });
  await abrirAAba(page);
  ok("a ponte que não diz a versão é dita como de antes desta linha",
     (await tipoDaVersao(page)) === "sem_versao" && /não diz qual versão é/.test(await texto(page, VERSAO)),
     await texto(page, VERSAO));
  ok("e o GitHub nem é perguntado", perguntas.length === 0, perguntas.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, doGitHub: perguntas } = await abrir({ github: [LISTA_DE_14_10], respostas: [{ ...EM_DIA,
    versao: { commit: null, ramo: null, repositorio: null, servico: null, ultimo_script: "027-duvidas-tratadas.sql" } }] });
  await abrirAAba(page);
  const bloco = await texto(page, VERSAO);
  ok("fora da Render: diz até qual atualização conhece, e que não sabe a versão do código",
     (await tipoDaVersao(page)) === "sem_commit" && /até a 027/.test(bloco) && /Fora da Render/.test(bloco), bloco);
  ok("e o GitHub nem é perguntado", perguntas.length === 0, perguntas.join(" | "));
  await ctx.close();
}

console.log("\nMais antiga que todas as olhadas");
{
  const lista = Array.from({ length: 20 }, (_, i) =>
    commitDoGitHub(String(i).padStart(2, "0") + "f".repeat(38), `A versão ${200 - i} (#${200 - i})`, (2 + i) * 24 * H));
  const { ctx, page } = await abrir({ respostas: [comVersao(SHA.v189, "024-o-manual-do-copiloto.sql")], github: [lista] });
  const frase = await texto(page, FRASE);
  ok("a faixa acende: a ponte é mais antiga que as 20 últimas", /mais antiga que as 20 últimas versões/.test(frase), frase);
  await abrirAAba(page);
  ok("a aba diz desatualizada e como publicar",
     (await tipoDaVersao(page)) === "desatualizada" && /mais antiga que as 20 últimas do GitHub/.test(await texto(page, "[data-como-publicar]")),
     await texto(page, VERSAO));
  ok("e mostra cinco das que faltam, contando o resto",
     (await page.locator("[data-versao-que-falta]").count()) === 5 && /e mais 15/.test(await texto(page, "[data-versoes-que-faltam]")),
     await texto(page, "[data-versoes-que-faltam]"));
  await ctx.close();
}

console.log("\nO GitHub que falha depois não apaga o aviso da mesma ponte");
{
  // A PRIMEIRA PERGUNTA (a da faixa) acha a ponte desatualizada; a da aba,
  // logo depois, encontra o GitHub limitado.
  const limitado = { status: 403, corpo: { message: "API rate limit exceeded" }, cabecalhos: { "x-ratelimit-remaining": "0" } };
  const atrasada = comVersao(SHA.v189, "024-o-manual-do-copiloto.sql");
  const { ctx, page } = await abrir({ respostas: [atrasada, atrasada], github: [LISTA_DE_14_10, limitado] });
  ok("começa com a faixa acesa", (await page.locator(FRASE).count()) === 1);
  await clicar(page.locator("[data-ver-atualizacoes-do-banco]"));
  await page.waitForTimeout(900);
  ok("a aba, perguntando de novo, diz que não conseguiu conferir",
     (await tipoDaVersao(page)) === "sem_github", await texto(page, VERSAO));
  ok("e a faixa continua dizendo o que já se sabia — é a mesma ponte",
     /3 versões novas da ponte não estão no ar/.test(await texto(page, FRASE)), await texto(page, FRASE));
  await ctx.close();
}
{
  // COM A PONTE TROCADA, o que se sabia era da outra: publicou, e o aviso
  // tem de ir embora mesmo com o GitHub sem responder.
  const limitado = { status: 403, corpo: { message: "API rate limit exceeded" }, cabecalhos: { "x-ratelimit-remaining": "0" } };
  const { ctx, page } = await abrir({ respostas: [comVersao(SHA.v189, "024-o-manual-do-copiloto.sql"), comVersao(SHA.v192)],
                                      github: [LISTA_DE_14_10, limitado] });
  ok("começa com a faixa acesa", (await page.locator(FRASE).count()) === 1);
  await clicar(page.locator("[data-ver-atualizacoes-do-banco]"));
  await page.waitForTimeout(900);
  ok("publicada a ponte nova, a faixa apaga — mesmo com o GitHub sem responder",
     (await page.locator(FRASE).count()) === 0, await texto(page, FRASE));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
