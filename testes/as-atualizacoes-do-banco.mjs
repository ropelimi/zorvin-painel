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
//      lado.
//
// A PONTE É FINGIDA pela prova (`page.route`), como nas outras telas que
// falam com ela: a ponte de verdade, com um Postgres de verdade, é provada no
// repositório dela (seção 51).
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
async function abrir({ respostas, admin = true, largura = 1360, altura = 900 }) {
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
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  // A PERGUNTA SAI TRÊS SEGUNDOS DEPOIS de o painel saber quem administra.
  // Espera-se por ela, e não por um tempo fixo — tempo fixo reprova no dia em
  // que a máquina estiver lenta, falando de outro assunto. Quem atende não
  // pergunta nunca, e aí o que se espera é o tempo em que ela já teria saído.
  for (let i = 0; i < 60 && admin && !perguntas.length; i++) await page.waitForTimeout(150);
  await page.waitForTimeout(admin ? 600 : 5000);
  return { ctx, page, estouros, perguntas };
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
  const { ctx, page, perguntas } = await abrir({ respostas: [FALHOU], admin: false });
  ok("quem atende não pergunta à ponte pelos scripts", perguntas.length === 0, `${perguntas.length} pergunta(s)`);
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

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
