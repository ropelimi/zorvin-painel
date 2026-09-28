// A TELA NÃO DIZ "SALVEI" SEM TER SALVO.
//
// RELATO DO ESCRITÓRIO, 24/09, em três partes que pareciam três defeitos:
//
//   "quando salvo o nome do cliente, não fica salvo"
//   "não estão sendo salvos novos contatos"
//   "aperto em fazer pré-cadastro e a ficha não aparece"
//
// É UMA FORMA SÓ, repetida em três lugares.
//
// ------------------------------------------------------------
// UM `UPDATE` BARRADO PELA RLS NÃO DEVOLVE ERRO
//
// Ele não é recusado: é FILTRADO. A regra de acesso entra como um `where` a
// mais, nenhuma linha casa, e o banco responde "pronto, atualizei zero linhas"
// com `error` nulo. As três telas olhavam só o `error` e seguiam em frente:
// uma pintava o nome novo (que sumia no F5), outra escrevia "Contato salvo!",
// e a terceira dava o pré-cadastro por ligado ao contato.
//
// Num `insert` é diferente — ali a RLS levanta erro —, e é por isso que o
// defeito mora em quem EDITA. Os dois se parecem em revisão de código.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA MEDE, E O QUE ELA NÃO MEDE
//
// Ela NÃO prova que a gravação funciona — isso as outras já fazem. Ela prova
// que, quando o banco recusa em silêncio, a TELA DIZ. É a armadilha nº 2 do
// CLAUDE.md virada do avesso: ali a tela desenhava ausência no lugar de falha;
// aqui ela desenhava SUCESSO no lugar de falha, que é pior — ausência faz
// alguém perguntar, sucesso faz todo mundo ir embora tranquilo.
//
// `__ESCRITA_SEM_EFEITO = ["contatos"]` é a bancada devolvendo exatamente o que
// o PostgREST devolve nesse caso: `{ data: [], error: null }`.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Abre o painel com a escrita em `contatos` recusada em silêncio (ou não). */
async function abrirPainel({ recusar }) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((r) => {
    globalThis.__ESCRITA_SEM_EFEITO = r ? ["contatos"] : [];
  }, recusar);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const avisoNaTela = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-aviso]");
  return el ? el.innerText.trim() : null;
});

/** Abre uma conversa cujo contato NÃO tem cadastro no Vantoro — só nessas o
 *  lápis de renomear aparece (quem tem ficha é chamado pelo nome dela). */
async function abrirUmaRenomeavel(page) {
  const linhas = page.locator("[data-conversa-nome]");
  const quantas = Math.min(await linhas.count(), 8);
  for (let i = 0; i < quantas; i++) {
    await linhas.nth(i).click();
    await page.waitForTimeout(700);
    if (await page.locator("[data-renomear-contato]").count()) return true;
  }
  return false;
}

// ------------------------------------------------------------------
console.log("\nRenomear: com o banco recusando calado, a tela DIZ e desfaz");
{
  const { ctx, page, estouros } = await abrirPainel({ recusar: true });
  const achou = await abrirUmaRenomeavel(page);
  ok("achei uma conversa com o lápis de renomear", achou,
     "nenhuma das primeiras conversas tinha o lápis");

  const nomeAntes = await page.locator("[data-nome-do-contato]").innerText();
  await page.locator("[data-renomear-contato]").click();
  await page.waitForTimeout(300);
  const campo = page.locator('input[placeholder]').filter({ hasNot: page.locator("x") }).first();
  await page.keyboard.type("NOME QUE NAO DEVE FICAR");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);

  // 1. A TELA TEM DE DIZER. Sem isto o nome fica na tela e some no F5 — e
  //    quem renomeou vai jurar que salvou.
  const aviso = await avisoNaTela(page);
  ok("a tela avisa que não conseguiu salvar", !!aviso, `aviso: ${aviso}`);
  ok("e o aviso fala em não ter salvo, e não em outra coisa",
     /não deixou|não consegui/i.test(aviso || ""), `aviso: ${aviso}`);

  // 2. E TEM DE DESFAZER. O nome foi pintado na tela antes da resposta (de
  //    propósito, para a tela responder na hora); recusado, ele volta.
  const nomeDepois = await page.locator("[data-nome-do-contato]").innerText();
  ok("e o nome volta ao que era", nomeDepois.trim() === nomeAntes.trim(),
     `era "${nomeAntes.trim()}", ficou "${nomeDepois.trim()}"`);

  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nE com o banco deixando, o nome fica — senão o conserto virou um bloqueio");
{
  // O CONTRASTE, e sem ele a conferência de cima não prova nada: uma tela que
  // recusasse SEMPRE também passaria lá.
  const { ctx, page, estouros } = await abrirPainel({ recusar: false });
  const achou = await abrirUmaRenomeavel(page);
  ok("achei uma conversa com o lápis", achou);
  await page.locator("[data-renomear-contato]").click();
  await page.waitForTimeout(300);
  await page.keyboard.type("NOME QUE DEVE FICAR");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);

  const nomeDepois = await page.locator("[data-nome-do-contato]").innerText();
  ok("o nome novo fica na tela", /NOME QUE DEVE FICAR/.test(nomeDepois),
     `ficou "${nomeDepois.trim()}"`);
  const aviso = await avisoNaTela(page);
  ok("e nenhum aviso de falha aparece",
     !aviso || !/não deixou|não consegui/i.test(aviso), `aviso: ${aviso}`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log('\nSalvar contato: a tela não escreve "Contato salvo!" sem ter salvo');
{
  // O NÚMERO É UM QUE JÁ EXISTE, de propósito: aí o `upsert` vira um `update`
  // por baixo, e cai no mesmo silêncio. Num número novo o banco faria um
  // `insert`, e um `insert` barrado LEVANTA erro — não é este o caso que
  // passava despercebido.
  const { ctx, page, estouros } = await abrirPainel({ recusar: true });
  const numeroExistente = await page.evaluate(() => {
    const c = (globalThis.__TABELAS.contatos || [])
      .find((x) => x.numero && !String(x.numero).startsWith("grupo:"));
    return c ? c.numero : null;
  });
  ok("achei um contato que já existe na bancada", !!numeroExistente, `${numeroExistente}`);

  // CADA PASSO CONFERIDO ANTES DE SEGUIR. Escrevi isto clicando às cegas
  // primeiro, e a prova ESTOUROU em vez de reprovar — levando embora a rodada
  // inteira. Prova que derruba a suíte não reprova nada, ela cala tudo.
  let chegou = false;
  if (numeroExistente) {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Configurações" }).click();
    await page.waitForTimeout(500);
    const aba = page.getByRole("button", { name: "Contatos", exact: true }).first();
    if (await aba.count()) {
      await aba.click();
      await page.waitForTimeout(600);
      const novo = page.getByRole("button", { name: "Novo", exact: true }).first();
      if (await novo.count()) {
        await novo.click();
        await page.waitForTimeout(400);
        const oNome = page.locator('input[placeholder="Ex.: João Silva"]');
        const oNumero = page.locator('input[placeholder="5511999999999"]');
        if (await oNome.count() && await oNumero.count()) {
          await oNome.fill("CONTATO QUE NAO DEVE SALVAR");
          await oNumero.fill(String(numeroExistente));
          const salvar = page.getByRole("button", { name: "Salvar", exact: true }).last();
          if (await salvar.count()) {
            await salvar.click();
            await page.waitForTimeout(1400);
            chegou = true;
          }
        }
      }
    }
  }
  ok("cheguei a apertar Salvar no formulário de contato", chegou,
     "não achei algum passo do caminho até o botão");

  if (chegou) {
    const aviso = await avisoNaTela(page);
    // A CONFERÊNCIA DO RELATO: era aqui que a tela dizia "Contato salvo!".
    ok('a tela NÃO diz "Contato salvo!"', !/Contato salvo/i.test(aviso || ""),
       `aviso: ${aviso}`);
    ok("e diz que não deu para salvar", /não deixou|não consegui/i.test(aviso || ""),
       `aviso: ${aviso}`);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
async function cenaDoPreCadastro({ recusar }) {
  // O TERCEIRO SINTOMA DO RELATO: "aperto em fazer pré-cadastro e a ficha não
  // aparece". O cadastro NASCE no Vantoro — isso funcionava —, mas o vínculo
  // com o contato daqui (`vantoro_cliente_id`) não gravava, e a ficha seguia
  // como se tivesse ligado. Na abertura seguinte o contato não tinha cadastro
  // nenhum, e o trabalho se perdia sem uma palavra.
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));

  const subidas = [];
  const CADASTROS = {};
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (/\/vantoro\/contato\/[^/]+\/subir-notas$/.test(url.pathname)) {
      subidas.push(url.pathname);
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, subiram: 1, falharam: 0, jaEstavam: 0 }) });
    }
    if (url.pathname.endsWith("/vantoro/cliente") && rota.request().method() === "GET") {
      const tel = (url.searchParams.get("telefone") || "").replace(/\D/g, "");
      const achado = CADASTROS[tel] || null;
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: achado ? [achado] : [], opcoes: {} }) });
    }
    // O VANTORO ACEITA E CRIA. É importante que este lado dê CERTO: o defeito
    // não é o cadastro falhar, é ele nascer e o vínculo daqui não gravar.
    if (url.pathname.endsWith("/vantoro/cliente") && rota.request().method() === "POST") {
      const corpo = JSON.parse(rota.request().postData() || "{}");
      const novo = { id: "v-novo", nome: corpo.nome || "Sem nome", telefone: corpo.telefone,
                     cpf: corpo.cpf || "", documentos: 0, processos: [], ordem_servico: null };
      CADASTROS[String(corpo.telefone || "").replace(/\D/g, "")] = novo;
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, criado: true, cliente: novo }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  // A CONVERSA PLANTADA COPIA O FEITIO DE UMA DE VERDADE.
  //
  // Montei os campos à mão na primeira versão e a conversa não apareceu na
  // lista: faltava o `advogado_id`, e sem ele ela não é de telefone nenhum.
  // A mensagem também é obrigatória — conversa sem mensagem é "fantasma", e o
  // painel a esconde de propósito.
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const molde = await page.evaluate(() => {
    const id = document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id");
    const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
    const m = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
    return c ? { advogado_id: c.advogado_id, mensagem: m || null } : null;
  });
  ok("aprendi o feitio de uma conversa de verdade", !!molde?.advogado_id && !!molde?.mensagem);

  const agora = Date.now();
  // TODA MENSAGEM QUE PASSOU, e não só a última.
  //
  // A faixa de aviso mostra UMA frase por vez, e a seguinte apaga a anterior.
  // Lendo só o que está na tela no fim, a sabotagem que tirava o `return true`
  // PASSAVA: a frase errada aparecia e era coberta pela das notas um instante
  // depois. O que se quer saber é se a pessoa chegou a ser informada errado —
  // e para isso é preciso ver o filme, não a foto.
  await page.addInitScript(() => {
    globalThis.__AVISOS_VISTOS = [];
    // UM RELÓGIO, e não um `MutationObserver`: `addInitScript` roda ANTES de
    // existir documento, e `observe(document.documentElement)` estoura com
    // "parameter 1 is not of type 'Node'". Vinte vezes por segundo pega
    // qualquer frase que fique na tela por mais de 50ms — e a faixa fica
    // quatro segundos.
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const vistos = globalThis.__AVISOS_VISTOS;
      if (t && vistos[vistos.length - 1] !== t) vistos.push(t);
    }, 50);
  });
  await page.addInitScript((d) => {
    globalThis.__ESCRITA_SEM_EFEITO = d.recusar ? ["contatos"] : [];
    globalThis.__SEMENTE = d.semente;
  }, { recusar, semente: {
    contatos: [{ id: "ct-zz", nome: "ZZ Vai Virar Cliente", numero: "5521977770001",
                 vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null }],
    conversas: [{ id: "cv-zz", contato_id: "ct-zz", advogado_id: molde?.advogado_id,
                  fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
                  ultima_mensagem: "oi", ultima_atividade: new Date(agora - 60000).toISOString(),
                  frente: null, vantoro_nome: null, digitando_ate: null,
                  atendendo_por: null, atendendo_em: null,
                  contato: { nome: "ZZ Vai Virar Cliente", numero: "5521977770001",
                             foto_url: null, vantoro_nome: null, nome_zorvin: null } }],
    mensagens: [{ ...(molde?.mensagem || {}), id: "m-zz", conversa_id: "cv-zz",
                  texto: "oi, preciso de ajuda",
                  criado_em: new Date(agora - 90000).toISOString() }],
  } });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1600);

  let chegou = false;
  const linha = page.locator('[data-conversa-nome*="ZZ Vai Virar Cliente"]');
  if (await linha.count()) {
    await linha.first().click();
    await page.waitForSelector("[data-topo-conversa]").catch(() => {});
    await page.waitForTimeout(700);
    // A FICHA JÁ NASCE ABERTA (coluna fixa, 28/09). Clicar no botão para
    // "abrir" agora a RECOLHE — e foi assim que esta cena reprovou dizendo
    // que não achou o botão de pré-cadastro: ela tinha acabado de fechar a
    // coluna onde ele mora.
    if (!(await page.locator("[data-ficha]").count())) {
      const b = page.locator("[data-abrir-ficha]");
      if (await b.count()) await b.first().click();
    }
    await page.waitForTimeout(1600);
    const criar = page.getByRole("button", { name: /Criar pré-cadastro|Criar cadastro|pré-cadastro/i });
    if (await criar.count()) {
      await criar.first().click();
      await page.waitForTimeout(2200);
      chegou = true;
    }
  }
  ok("cheguei a apertar 'Criar pré-cadastro'", chegou,
     "não achei a conversa, a ficha ou o botão");

  if (chegou) {
    // O RECADO PELO MARCADOR, e não varrendo o texto da página: com a ficha
    // aberta por cima, o `innerText` do corpo volta praticamente vazio.
    const texto = (await avisoNaTela(page)) || "";
    const todos = await page.evaluate(() => globalThis.__AVISOS_VISTOS || []);
    const oFilme = todos.join(" | ");
    if (recusar) {
      // 1. A TELA DIZ. Sem isto o atendente sai achando que ligou o cadastro.
      //    E a frase tem de ser a ÚLTIMA: escrevi o aviso dentro da função que
      //    liga, e o "Pré-cadastro criado no Vantoro." de quem a chamou o
      //    apagava um instante depois. A prova pegou.
      ok("a tela avisa que o vínculo não foi gravado",
         /não consegui ligá-lo|não consegui ligar/i.test(oFilme), oFilme.slice(0, 400));
      ok('e NÃO termina dizendo só "Pré-cadastro criado"',
         !/^Pré-cadastro criado no Vantoro\.$/.test(texto.trim()), texto);
      // 2. E NÃO MANDA AS NOTAS SUBIREM. Elas sobem para o CONTATO que acabou
      //    de ganhar ficha — e ele não ganhou. Subir aqui seria agir sobre um
      //    vínculo que não existe: o mesmo engano com outra roupa.
      ok("e não manda as notas antigas subirem para um vínculo que não existe",
         subidas.length === 0, JSON.stringify(subidas));
    } else {
      // O CONTRASTE. Sem ele, um conserto que gritasse SEMPRE passaria na
      // metade de cima — e foi assim que um `return true` que faltava quase
      // passou: o caminho de sucesso mostrava a frase da falha.
      // A FRASE FINAL AQUI PODE SER A DAS NOTAS ("1 nota interna foi para o
      // histórico"), que chega depois da criação e é comportamento de sempre.
      // Por isso a régua é "terminou numa frase de sucesso", e não "terminou
      // nesta frase": prender a conferência à ordem de duas mensagens faria
      // ela reprovar por causa de uma corrida que não é defeito.
      ok("no caminho normal a tela diz que criou",
         /Pré-cadastro criado|Já existia/i.test(oFilme), oFilme.slice(0, 400));
      // NO FILME INTEIRO, e não só na última frase: a mensagem errada aparecia
      // e era coberta pela das notas em menos de um segundo. Ver o espião.
      ok("e em momento nenhum fala de vínculo que faltou",
         !/não consegui ligá-lo|não consegui ligar/i.test(oFilme), oFilme);
      ok("e as notas antigas sobem, como sempre subiram",
         subidas.length === 1, JSON.stringify(subidas));
    }
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nPré-cadastro: o vínculo que não gravou não é dado por feito");
await cenaDoPreCadastro({ recusar: true });

console.log("\nE no caminho normal a frase é a de sucesso, e as notas sobem");
await cenaDoPreCadastro({ recusar: false });

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
