// A COLUNA QUE FALTA CUSTA UMA COLUNA — e não o resto da nota.
//
// RELATO DE 01/09, com foto: uma nota interna com um processo vinculado, e o
// processo não aparecendo na conversa. "Preciso que o processo fique visível
// junto com a nota, para toda a equipe que entrar na conversa ter essa
// informação ao ler."
//
// O QUE A APURAÇÃO ACHOU, medindo o banco do escritório:
//
//     289 notas, ZERO com processo vinculado.
//
// Zero, e não "às vezes". Um recurso que a equipe usava — escolhia o processo,
// via o seletor ficar âmbar — e que nunca funcionou uma vez sequer.
//
// A CAUSA. O painel é escrito para tolerar coluna que ainda não existe: grava
// sem ela e segue. O `enviarNota` fazia isso com quatro quedas encadeadas, e
// cada uma REMONTAVA a linha do zero:
//
//     if (erro fala de autor_foto)  insert({ conversa_id, texto, autor })
//
// Essa foi escrita para a falta de UMA coluna e joga fora QUATRO: o
// `autor_foto` que falta, o `autor_id` que existe, e as três do processo. E
// `notas.autor_foto` NUNCA existiu no banco do escritório — então TODA nota
// passava por ali.
//
// POR QUE ISSO ATRAVESSOU 37 CONFERÊNCIAS DA `nota.mjs`. Naquela bancada toda
// coluna existe. O caminho da tolerância — o código que só roda quando o banco
// é mais pobre do que o painel espera — nunca era executado. Uma bancada
// perfeita não consegue reprovar um conserto de imperfeição.
//
// `__SEM_COLUNAS` é o instrumento que faltava, e nasceu com esta prova.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { colunaQueFalta, gravarSemAsQueFaltam } from "../src/gravar.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// ============================================================
//  LER O NOME DA COLUNA QUE FALTA
// ============================================================

console.log("\nQual coluna o banco disse que não tem");
{
  // AS DUAS FORMAS, porque há dois mensageiros e o painel fala com os dois.
  ok("a do PostgREST (PGRST204)",
     colunaQueFalta({ code: "PGRST204",
       message: "Could not find the 'autor_foto' column of 'notas' in the schema cache" })
     === "autor_foto");
  ok("a do Postgres (42703)",
     colunaQueFalta({ code: "42703",
       message: 'column "autor_foto" of relation "notas" does not exist' })
     === "autor_foto");
  // LER O NOME É O CONSERTO INTEIRO. Sem ele só dá para saber QUE faltou
  // alguma, e "faltou alguma" é o que levava a desistir de todas.
  ok("e não confunde uma coluna com outra",
     colunaQueFalta({ message: "Could not find the 'processo_id' column of 'notas' in the schema cache" })
     === "processo_id");
  // A METADE QUE PROTEGE: um erro que NÃO é de coluna não pode virar um nome,
  // senão a gravação sairia tirando campos por causa de uma queda de rede.
  ok("um erro que não é de coluna não vira nome",
     colunaQueFalta({ code: "PGRST301", message: "JWT expired" }) === null);
  ok("e nada é nada", colunaQueFalta(null) === null);
}

console.log("\nTirar só a que falta, e dizer o que tirou");
{
  // O caso do escritório, em miniatura: um banco onde `autor_foto` não existe.
  const banco = { semColuna: "autor_foto", recebido: null };
  const gravar = async (linha) => {
    if (banco.semColuna in linha) {
      return { data: null, error: { code: "PGRST204",
        message: `Could not find the '${banco.semColuna}' column of 'notas' in the schema cache` } };
    }
    banco.recebido = linha;
    return { data: { id: "n-1" }, error: null };
  };
  const r = await gravarSemAsQueFaltam(gravar, {
    conversa_id: "c1", texto: "oi", autor: "Rodrigo",
    autor_foto: "foto.png", autor_id: "u1",
    processo_id: 22, processo_numero: "0002222-22", processo_reu: "OPERADORA ZZ",
  }, ["autor_foto", "autor_id", "processo_id", "processo_numero", "processo_reu"]);

  ok("gravou", !r.error, JSON.stringify(r.error));
  ok("e tirou SÓ a que faltava", JSON.stringify(r.perdidas) === '["autor_foto"]',
     JSON.stringify(r.perdidas));
  // ESTA É A CONFERÊNCIA QUE DESCREVE O DEFEITO. Com o código antigo, tudo
  // abaixo viria vazio: a queda do `autor_foto` remontava a linha com três
  // campos e mais nada.
  ok("o PROCESSO chegou ao banco", banco.recebido?.processo_id === 22,
     JSON.stringify(banco.recebido));
  ok("o número e o réu também", banco.recebido?.processo_numero === "0002222-22"
     && banco.recebido?.processo_reu === "OPERADORA ZZ", JSON.stringify(banco.recebido));
  ok("e o autor_id, que existe e também estava sendo jogado fora",
     banco.recebido?.autor_id === "u1", JSON.stringify(banco.recebido));
  ok("a coluna que falta é a única ausente", !("autor_foto" in (banco.recebido || {})));
}

console.log("\nO essencial NÃO sai — nem para conseguir gravar");
{
  // Uma tolerância sem lista vira um gravador que aceita salvar qualquer coisa,
  // inclusive nada. Se o banco disser que `texto` não existe, é para o erro
  // chegar à tela — e não para uma nota vazia entrar no lugar.
  const gravar = async (linha) => ("texto" in linha
    ? { data: null, error: { code: "PGRST204",
        message: "Could not find the 'texto' column of 'notas' in the schema cache" } }
    : { data: { id: "n-2" }, error: null });
  const r = await gravarSemAsQueFaltam(gravar,
    { conversa_id: "c1", texto: "oi", autor: "Rodrigo" },
    ["autor_foto", "autor_id"]);
  ok("uma nota SEM TEXTO não é gravada no lugar", !!r.error, JSON.stringify(r));
  ok("e nada foi tirado", JSON.stringify(r.perdidas) === "[]", JSON.stringify(r.perdidas));
}

console.log("\nDuas colunas faltando saem as duas, uma de cada vez");
{
  const ausentes = ["autor_foto", "processo_reu"];
  const gravar = async (linha) => {
    const falta = ausentes.find((c) => c in linha);
    if (falta) {
      return { data: null, error: { code: "PGRST204",
        message: `Could not find the '${falta}' column of 'notas' in the schema cache` } };
    }
    return { data: { id: "n-3" }, error: null };
  };
  const r = await gravarSemAsQueFaltam(gravar, {
    conversa_id: "c1", texto: "oi", autor: "R",
    autor_foto: "f", processo_id: 22, processo_numero: "000", processo_reu: "X",
  }, ["autor_foto", "autor_id", "processo_id", "processo_numero", "processo_reu"]);
  ok("gravou depois de tirar as duas", !r.error, JSON.stringify(r.error));
  ok("e o VÍNCULO sobreviveu às duas", r.perdidas.includes("autor_foto")
     && r.perdidas.includes("processo_reu") && !r.perdidas.includes("processo_id"),
     JSON.stringify(r.perdidas));
}

console.log("\nO que já se sabe que falta não é perguntado de novo");
{
  // Sem lembrete, a PRIMEIRA gravação sempre falha e a segunda sempre passa:
  // duas idas ao banco por nota, para sempre, e uma linha de erro no registro
  // do Postgres a cada uma. Um dia de escritório são centenas delas — no mesmo
  // lugar onde um erro DE VERDADE precisaria ser visto.
  const lembrete = new Set();
  let idas = 0;
  const gravar = async (linha) => {
    idas += 1;
    if ("autor_foto" in linha) {
      return { data: null, error: { code: "PGRST204",
        message: "Could not find the 'autor_foto' column of 'notas' in the schema cache" } };
    }
    return { data: { id: "n" + idas }, error: null };
  };
  const linha = { conversa_id: "c", texto: "t", autor: "a", autor_foto: "f", processo_id: 22 };
  const opcionais = ["autor_foto", "autor_id", "processo_id", "processo_numero", "processo_reu"];

  const primeira = await gravarSemAsQueFaltam(gravar, linha, opcionais, lembrete);
  ok("a primeira nota custa duas idas (a que descobre e a que grava)", idas === 2, `foram ${idas}`);
  ok("e grava", !primeira.error);

  idas = 0;
  const segunda = await gravarSemAsQueFaltam(gravar, linha, opcionais, lembrete);
  ok("a segunda custa UMA", idas === 1, `foram ${idas}`);
  ok("continua gravando", !segunda.error);
  // E A COLUNA LEMBRADA NÃO PODE LEVAR AS OUTRAS JUNTO — é o mesmo defeito de
  // origem, só que por outro caminho.
  ok("e o vínculo com o processo sobrevive ao atalho",
     JSON.stringify(segunda.perdidas) === '["autor_foto"]', JSON.stringify(segunda.perdidas));
}

console.log("\nE não roda para sempre quando o banco insiste no mesmo erro");
{
  // Um laço infinito dentro de "enviar uma nota" trava a aba de quem só queria
  // anotar um recado. O teto é uma volta por coluna opcional.
  let idas = 0;
  const gravar = async () => {
    idas += 1;
    return { data: null, error: { code: "PGRST204",
      message: "Could not find the 'autor_foto' column of 'notas' in the schema cache" } };
  };
  const r = await gravarSemAsQueFaltam(gravar,
    { conversa_id: "c", texto: "t", autor: "a", autor_foto: "f" },
    ["autor_foto", "autor_id"]);
  ok("desiste e devolve erro", !!r.error);
  ok("depois de poucas idas ao banco", idas <= 3, `foram ${idas}`);
}

// ============================================================
//  E AGORA NA TELA, com o banco do escritório
// ============================================================

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

const subiram = [];
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (/\/vantoro\/cliente\/[^/]+\/nota$/.test(url.pathname)) {
    let corpo = null;
    try { corpo = JSON.parse(rota.request().postData() || "null"); } catch (_) { /* nulo */ }
    subiram.push(corpo);
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, atividade: { id: 55 } }) });
  }
  if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, cliente: { id: "v-900", nome: "ZZ Cliente",
        processos: [
          { id: 11, numero: "0001111-11.2026.8.26.0100", reu: "BANCO ZZ S.A." },
          { id: 22, numero: "0002222-22.2026.8.26.0100", reu: "OPERADORA ZZ LTDA" },
        ] } }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

// O BANCO DO ESCRITÓRIO, COM O BURACO QUE ELE TEM DE VERDADE.
await page.addInitScript(() => { globalThis.__SEM_COLUNAS = { notas: ["autor_foto"] }; });
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

// UM CONTATO COM CADASTRO NO VANTORO, plantado como a prova irmã planta.
//
// O seletor de processo só existe para quem TEM ficha lá — é a condição do
// recurso. A amostra da bancada é de leads sem cadastro, e sem plantar isto a
// prova não teria onde escolher processo nenhum.
//
// O FEITIO VEM DA PRÓPRIA BANCADA, e não escrito à mão: uma conversa montada
// com campos inventados some da lista (o painel esconde conversa sem mensagem),
// e a prova ficaria procurando uma linha que ele decidiu não desenhar.
const molde = await page.evaluate(() => {
  const id = document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id");
  const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
  const m = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
  return c ? { advogado_id: c.advogado_id, mensagem: m || null } : null;
});
ok("aprendi o feitio da conversa e da mensagem na amostra",
   !!molde?.advogado_id && !!molde?.mensagem);

const SEMENTE = {
  contatos: [
    { id: "ct-inc", nome: "ZZ Banco Incompleto", numero: "5521977660009",
      vantoro_cliente_id: "v-900", vantoro_nome: null, nome_zorvin: null },
  ],
  conversas: [
    { id: "conv-inc", contato_id: "ct-inc", advogado_id: molde.advogado_id,
      fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
      ultima_mensagem: null, ultima_atividade: new Date(Date.now() - 60000).toISOString(),
      frente: null, vantoro_nome: null, digitando_ate: null,
      atendendo_por: null, atendendo_em: null,
      contato: { nome: "ZZ Banco Incompleto", numero: "5521977660009", foto_url: null,
                 vantoro_cliente_id: "v-900", vantoro_nome: null, nome_zorvin: null } },
  ],
  mensagens: [
    { ...molde.mensagem, id: "msg-inc", conversa_id: "conv-inc", texto: "oi, tudo bem?",
      criado_em: new Date(Date.now() - 90000).toISOString() },
  ],
};
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

console.log("\nNum banco sem `autor_foto`, o processo ainda é gravado");
{
  await page.locator('[data-conversa-nome*="Banco Incompleto"]').first().click();
  await page.waitForTimeout(900);

  const botao = page.locator("[data-nota-interna]");
  ok("achei o botão da nota interna", await botao.count() > 0);
  if ((await botao.first().getAttribute("aria-pressed")) !== "true") {
    await botao.first().click();
    await page.waitForTimeout(1200);
  }

  const seletor = page.locator("[data-processo-da-nota] select");
  const temSeletor = await seletor.count() > 0;
  ok("o seletor de processo apareceu", temSeletor,
     "sem ele esta prova não mede nada — o contato precisa de cadastro no Vantoro");

  if (temSeletor) {
    await seletor.selectOption("22");
    await page.waitForTimeout(300);
    const caixa = page.locator("textarea").first();
    await caixa.click();
    await caixa.fill("Combinado: entrar com o recurso");
    await caixa.press("Enter");
    await page.waitForTimeout(1500);

    // O QUE FOI PARA A TABELA `notas` — a conferência que faltava.
    //
    // A prova irmã (`nota.mjs`) olhava o que subiu ao Vantoro e o que a bolha
    // desenhou, e passava com o defeito no lugar: os dois vinham do MESMO
    // objeto local, montado antes de gravar. Só a LINHA GRAVADA denuncia.
    const gravadas = await page.evaluate(() => (globalThis.__TABELAS?.notas || [])
      .map((n) => ({ texto: n.texto, processo_id: n.processo_id,
                     autor_id: n.autor_id, autor_foto: n.autor_foto })));
    const minha = gravadas.find((n) => /recurso/.test(n.texto || ""));
    ok("a nota foi gravada", !!minha, JSON.stringify(gravadas));
    ok("COM o processo vinculado", String(minha?.processo_id) === "22",
       JSON.stringify(minha));
    ok("e com o autor_id, que a queda antiga também jogava fora",
       !!minha?.autor_id, JSON.stringify(minha));
    ok("sem a coluna que não existe neste banco", !("autor_foto" in (minha || {}))
       || minha.autor_foto === undefined, JSON.stringify(minha));

    // E A BOLHA MOSTRA O PROCESSO, que é o pedido do escritório: "para toda a
    // equipe que entrar na conversa ter essa informação ao ler a nota".
    const marca = page.locator("[data-nota-processo]");
    ok("e a bolha da nota mostra o processo para quem lê", await marca.count() >= 1,
       "a escolha ficou invisível na conversa");
    ok("com o número do processo", /0002222-22/.test(await marca.last().innerText().catch(() => "")),
       await marca.last().innerText().catch(() => "sem a marca"));

    ok("e o processo também subiu para o Vantoro",
       String(subiram[subiram.length - 1]?.processo_id) === "22",
       JSON.stringify(subiram[subiram.length - 1]));
  }
}

console.log("\nE quando o vínculo REALMENTE não cabe, a pessoa é avisada");
{
  // Um banco sem as colunas do processo. Aqui o vínculo não tem como ser
  // gravado — e é justamente esse o caso em que o silêncio era pior: a pessoa
  // escolhe, o sistema descarta, e ela vai embora achando que ficou ligado.
  await page.evaluate(() => {
    globalThis.__SEM_COLUNAS = { notas: ["processo_id"] };
  });
  const seletor = page.locator("[data-processo-da-nota] select");
  if (await seletor.count() > 0) {
    await seletor.selectOption("11");
    await page.waitForTimeout(300);
    const caixa = page.locator("textarea").first();
    await caixa.click();
    await caixa.fill("Esta nao deve fingir que vinculou");
    await caixa.press("Enter");
    await page.waitForTimeout(1500);

    const tela = await page.locator("body").innerText();
    ok("a tela DIZ que o vínculo não foi gravado", /sem o vínculo com o processo/i.test(tela),
       tela.slice(0, 300));
    // E A BOLHA NÃO PODE AFIRMAR O QUE O BANCO NÃO TEM. Ela nasce com o
    // processo desenhado para a escolha não parecer que não pegou; se o vínculo
    // se perdeu, o desenho tem de sair junto.
    const daNota = await page.evaluate(() => {
      const bolhas = [...document.querySelectorAll("[data-nota-processo]")];
      return bolhas.map((b) => b.innerText);
    });
    ok("e a bolha dessa nota NÃO mostra processo nenhum",
       !daNota.some((t) => /0001111-11/.test(t || "")), JSON.stringify(daNota));
    // A nota em si continua salva: perder o texto da pessoa por causa de uma
    // coluna seria muito pior do que perder o vínculo.
    const gravadas = await page.evaluate(() => (globalThis.__TABELAS?.notas || [])
      .map((n) => n.texto));
    ok("mas a NOTA foi salva, com o texto inteiro",
       gravadas.some((t) => /fingir que vinculou/.test(t || "")), JSON.stringify(gravadas));
  } else {
    ok("o seletor continua na tela para a segunda parte", false, "não achei o seletor");
  }
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
