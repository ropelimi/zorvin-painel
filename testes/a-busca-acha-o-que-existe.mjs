// A BUSCA ACHA O QUE EXISTE (26/10)
//
// Pedido do Rodrigo: "Verifica para mim e me explica como está funcionando o
// campo de pesquisa no Zorvin. Corrija possíveis bugs."
//
// MEDIDO NO BANCO DO ESCRITÓRIO, só lendo, antes de mexer:
//
//   - 504 contatos (840 conversas) estão gravados na FORMA ANTIGA do celular,
//     sem o nono dígito — é como o WhatsApp devolve umas contas. Quem digita
//     o número como ele é hoje, COM o 9, não achava nenhum deles, a não ser
//     que a conversa já estivesse numa das páginas carregadas da lista. A
//     busca pergunta ao banco pelo número digitado, e "71990012345" não está
//     dentro de "557190012345". É justamente o cliente antigo, com quem não se
//     fala há tempo, que a busca existe para achar;
//   - a "Nova conversa" tinha o mesmo defeito, e mais um: comparava o nome
//     COM acento — "joao" não achava "JOÃO", e "maria graças" não achava
//     "MARIA DAS GRAÇAS PEREIRA". A busca da lista e as pesquisas dos menus já
//     comparavam sem acento e por palavra;
//   - a busca devolve no máximo 80 conversas, e não dizia. "boa tarde" casa
//     com 561 conversas no telefone mais movimentado: a tela mostrava 80 com
//     cara de todas — a armadilha nº 2, uma lista curta que se lê como
//     completa.
// ------------------------------------------------------------
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM RELÓGIO SÓ para a semente inteira.
const AGORA = Date.now();
const H = (h) => new Date(AGORA - h * 3600e3).toISOString();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const TEL = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const ANTIGO = "CLIENTE DA FORMA ANTIGA";     // gravado SEM o nono dígito
const COM_NOVE = "CLIENTE COM O NOVE";        // gravado COM o nono dígito
const JOAO = "JOÃO ACENTUADO";
const MARIA = "MARIA DAS GRAÇAS PEREIRA";
const QUANTAS_COM_A_PALAVRA = 90;             // mais do que as 80 que a busca devolve

function semente() {
  const s = { contatos: [], conversas: [], mensagens: [] };
  const planta = (id, nome, numero, quando, texto = "bom dia") => {
    s.contatos.push({ id: `ct-${id}`, numero, nome });
    s.conversas.push({
      id: `cv-${id}`, advogado_id: TEL, contato_id: `ct-${id}`, nao_lidas: 0, arquivada: false,
      fixada: false, favorita: false, ultima_atividade: quando, esperando_desde: null,
      tratada_em: null, situacao: "aberto", protocolo: null, ultima_mensagem: texto, frente: null,
      contato: { id: `ct-${id}`, nome, numero, foto_url: null },
    });
    s.mensagens.push({ id: `m-${id}`, conversa_id: `cv-${id}`, origem: "contato", tipo: "texto",
                       texto, criado_em: quando });
  };
  // OS QUATRO DA CENA, parados há meses: atrás de duzentas e dez conversas
  // mais recentes, fora da primeira página da lista (que é de 200). É ali
  // que a busca precisa perguntar ao banco — e é ali que ela errava.
  planta("antigo", ANTIGO, "557190012345", H(3000));
  planta("com9", COM_NOVE, "5571990012346", H(3001));
  planta("joao", JOAO, "5511970007701", H(3002));
  planta("maria", MARIA, "5511970007702", H(3003));
  for (let i = 0; i < 210; i++) {
    // AS NOVENTA PRIMEIRAS DIZEM A PALAVRA: mais do que as oitenta que a
    // função do banco devolve.
    const texto = i < QUANTAS_COM_A_PALAVRA ? "a palavrarara apareceu aqui" : "bom dia";
    planta(`enche-${i}`, `ENCHIMENTO ${i}`, `55119800${String(10000 + i)}`, H(1 + i * 0.05), texto);
  }
  // TRÊS COM UMA PALAVRA SÓ DELAS: o contraste do corte.
  for (let i = 0; i < 3; i++) {
    planta(`unica-${i}`, `TEM A PALAVRA ${i}`, `55119700${String(20000 + i)}`, H(2000 + i), "palavraunica por aqui");
  }
  return s;
}

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__SEM_COLUNAS = {};
    globalThis.__QUEBRAR = [];
  }, semente());
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const CAIXA = 'input[placeholder^="Buscar por nome"]';
async function buscar(page, termo) {
  await page.fill(CAIXA, "");
  await page.waitForTimeout(300);
  await page.fill(CAIXA, termo);
  await page.waitForTimeout(2200);
}
const linha = (page, id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-conversa-id="${i}"]`);
  return Boolean(el && el.offsetParent !== null);
}, id);

// ==================================================================
console.log("\nA busca da lista acha o celular COM e SEM o nono dígito");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("a conversa antiga NÃO está na primeira página (é o caso que importa)",
     !(await linha(page, "cv-antigo")));

  for (const [termo, conversa, quem] of [
    ["(71) 99001-2345", "cv-antigo", "digitado com o 9, gravado sem"],
    ["99001-2345", "cv-antigo", "só o número local, com o 9"],
    ["+55 71 99001-2345", "cv-antigo", "com o +55 e o 9"],
    ["71 9001-2345", "cv-antigo", "digitado sem o 9, gravado sem"],
    ["9001-2345", "cv-antigo", "os oito dígitos do fim"],
    ["(71) 9001-2346", "cv-com9", "digitado sem o 9, gravado com"],
    ["(71) 99001-2346", "cv-com9", "digitado com o 9, gravado com"],
  ]) {
    await buscar(page, termo);
    ok(`“${termo}” acha a conversa (${quem})`, await linha(page, conversa));
  }

  // O CONTRASTE: um número que não é de ninguém não traz a conversa. Sem
  // isto, um conserto que pusesse TODO contato na resposta passaria igual.
  await buscar(page, "(71) 99999-0000");
  ok("um número de ninguém não traz a conversa antiga", !(await linha(page, "cv-antigo")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA “Nova conversa” acha pelo número com o 9, e pelo nome sem acento");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await page.locator('button[aria-label="Nova conversa"]').first().click({ timeout: 5000 })
    .then(() => true).catch(() => false);
  await page.waitForTimeout(800);
  ok("abri a Nova conversa", abriu);
  const PESQUISA = 'input[placeholder="Pesquisar nome ou número"]';
  const temCaixa = (await page.locator(PESQUISA).count()) > 0;
  ok("a caixa de pesquisa da Nova conversa está lá", temCaixa);
  const naAgenda = (id) => page.evaluate((i) => Boolean(document.querySelector(`[data-contato-agenda="${i}"]`)), id);
  const pesquisar = async (t) => {
    if (!temCaixa) return;
    await page.fill(PESQUISA, t);
    await page.waitForTimeout(1600);
  };

  for (const [termo, contato, quem] of [
    ["(71) 99001-2345", "ct-antigo", "o número com o 9, gravado sem"],
    ["71 9001-2346", "ct-com9", "o número sem o 9, gravado com"],
    ["joao", "ct-joao", "“joao” acha “JOÃO”"],
    ["maria graças", "ct-maria", "duas palavras separadas no nome"],
    ["gracas pereira", "ct-maria", "sem acento, e na ordem do nome"],
  ]) {
    await pesquisar(termo);
    ok(`“${termo}” aparece na agenda (${quem})`, await naAgenda(contato));
  }
  // O CONTRASTE: o que não casa não aparece.
  await pesquisar("joaquina");
  ok("“joaquina” não traz o João", !(await naAgenda("ct-joao")));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nA “Nova conversa” num banco sem a coluna da busca continua achando");
{
  // `contatos.busca` nasceu num SQL de agosto. Num banco sem ela, pedir a
  // coluna dá 42703 — e a agenda não pode ficar vazia por isso: ela volta a
  // procurar pelos nomes, como antes.
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__SEM_COLUNAS = { contatos: ["busca"] };
    globalThis.__QUEBRAR = [];
  }, semente());
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="Nova conversa"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const PESQUISA = 'input[placeholder="Pesquisar nome ou número"]';
  if (await page.locator(PESQUISA).count()) {
    await page.fill(PESQUISA, "ACENTUADO");
    await page.waitForTimeout(1600);
  }
  ok("sem a coluna, o nome escrito como está continua achando",
     await page.evaluate(() => Boolean(document.querySelector('[data-contato-agenda="ct-joao"]'))));
  if (await page.locator(PESQUISA).count()) {
    await page.fill(PESQUISA, "(71) 99001-2345");
    await page.waitForTimeout(1600);
  }
  ok("e o número com o 9 também",
     await page.evaluate(() => Boolean(document.querySelector('[data-contato-agenda="ct-antigo"]'))));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nQuando a busca devolve o máximo, a tela diz que pode haver mais");
{
  const { ctx, page, estouros } = await abrirPainel();
  await buscar(page, "palavrarara");
  const corte = await page.evaluate(() => {
    const el = document.querySelector("[data-corte-da-busca]");
    return el && el.offsetParent !== null ? el.innerText : "";
  });
  // A LISTA DESENHA QUARENTA POR VEZ (`PAGINA`), e o resto vem rolando —
  // contar linhas no documento mediria a página desenhada, e não o que a
  // busca trouxe. O que se confere aqui é que ela trouxe a lista cheia.
  const linhas = await page.evaluate(() =>
    [...document.querySelectorAll("[data-conversa-id]")]
      .filter((el) => el.offsetParent !== null && /^cv-enche-/.test(el.getAttribute("data-conversa-id"))).length);
  ok("a busca trouxe a lista cheia", linhas >= 40, `desenhou ${linhas}`);
  ok("e diz que mostra só as 80 mais recentes", /80/.test(corte) && /recentes/i.test(corte), `disse: “${corte}”`);
  ok("e diz o que fazer (escrever mais para afinar)", /escreva|afinar|mais palavras/i.test(corte), `disse: “${corte}”`);

  // O CONTRASTE: com poucas, nada a dizer. Uma nota que aparecesse sempre
  // seria a que se aprende a não ler.
  await buscar(page, "palavraunica");
  const corte2 = await page.evaluate(() => {
    const el = document.querySelector("[data-corte-da-busca]");
    return el && el.offsetParent !== null ? el.innerText : "";
  });
  ok("com três achadas, não há nota de corte", !corte2, `disse: “${corte2}”`);
  ok("e as três aparecem", (await linha(page, "cv-unica-0")) && (await linha(page, "cv-unica-2")));

  // E APAGAR A BUSCA APAGA A NOTA.
  await buscar(page, "palavrarara");
  await page.fill(CAIXA, "");
  await page.waitForTimeout(800);
  ok("apagar a busca tira a nota", !(await page.evaluate(() =>
    Boolean(document.querySelector("[data-corte-da-busca]")))));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
