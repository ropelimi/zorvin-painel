// AS "FAVORITAS" SAÍRAM DA LISTA (24/11)
//
// Pedido do Rodrigo, com a foto da fita de filtros (Tudo · Não lidas ·
// Favoritas): "a opção 'Favoritas' pode remover, não usamos essa função."
//
// A marca de favorita da conversa tinha três usos, e os três eram desta
// função: a pílula da fita, o "Adicionar aos favoritos" do menu da conversa e
// a estrela amarela na linha. Medido no banco em 24/11, só contando: uma
// conversa favorita em 2.565. Saíram os três; a coluna `favorita` continua no
// banco, sem uso, e nada a apaga.
//
// O "Favoritar" de uma MENSAGEM (o menu da bolha) é outra coisa, e fica.
//
// Esta prova confere:
//   - a fita tem "Tudo" e "Não lidas", e não "Favoritas", no computador e no
//     celular;
//   - a conversa marcada como favorita no banco não ganha estrela na linha;
//   - o menu da conversa não oferece mais "favoritos", e continua com
//     "Marcar como lida", "Fixar no topo" e "Arquivar";
//   - a aba que se atualizou sozinha com o filtro "favoritas" ligado volta em
//     "Tudo" — e, para a foto provar alguma coisa, a que voltou com "Não
//     lidas" volta em "Não lidas";
//   - o "Favoritar" da mensagem continua no menu da bolha.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

// UMA CONVERSA FAVORITA DESDE O COMEÇO, plantada pela semente: sobrevive ao
// carregamento e já vem marcada na primeira leitura da lista.
const SEMENTE = {
  contatos: [{ id: "ct-fav", numero: "5511900000777", nome: "CLIENTE FAVORITA DE TESTE", foto_url: null }],
  conversas: [{
    id: "cv-fav", advogado_id: "a7", contato_id: "ct-fav", ultima_mensagem: "olá",
    ultima_atividade: new Date(AGORA - 60 * 1000).toISOString(), nao_lidas: 0,
    arquivada: false, fixada: false, favorita: true, situacao: "aberto",
  }],
  mensagens: [{
    id: "m-fav-1", conversa_id: "cv-fav", origem: "contato", tipo: "texto", texto: "olá",
    criado_em: new Date(AGORA - 60 * 1000).toISOString(), id_uazapi: "fav-1",
  }],
};

async function abrir({ largura = 1400, altura = 900, foto = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  // A PRIMEIRA ABERTURA de um servidor recém-subido monta o painel inteiro, e
  // passa dos 8 s numa máquina ocupada: a espera da página é outra.
  page.setDefaultNavigationTimeout(60000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript(([s, f]) => {
    globalThis.__SEMENTE = s;
    try {
      if (f && !sessionStorage.getItem("__foto_posta")) {
        sessionStorage.setItem("zorvin_volta_da_atualizacao", JSON.stringify({ ...f, em: Date.now() }));
        sessionStorage.setItem("__foto_posta", "1");
      }
    } catch (_) { /* sem armário */ }
  }, [SEMENTE, foto]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
const abaAtiva = (page) => page.evaluate(() => {
  // A pílula escolhida é a de fundo cheio (a cor do texto vira branco).
  const bs = [...document.querySelectorAll("[data-fita-de-filtros] [data-aba]")];
  const a = bs.find((b) => getComputedStyle(b).color === "rgb(255, 255, 255)");
  return a ? a.getAttribute("data-aba") : null;
});

for (const [nome, l, a] of [["computador", 1400, 900], ["celular", 390, 844]]) {
  console.log(`\n1. A fita, no ${nome}`);
  const { ctx, page, estouros } = await abrir({ largura: l, altura: a });
  const fita = page.locator("[data-fita-de-filtros]");
  ok("a fita está na tela", (await fita.count()) === 1 && await fita.first().isVisible());
  ok("com “Tudo”", (await page.locator('[data-fita-de-filtros] [data-aba="tudo"]').count()) === 1);
  ok("com “Não lidas”", (await page.locator('[data-fita-de-filtros] [data-aba="naolidas"]').count()) === 1);
  ok("sem a pílula “Favoritas”", (await page.locator('[data-aba="favoritas"]').count()) === 0);
  const texto = await fita.first().innerText().catch(() => "");
  ok("e nada na fita diz “Favoritas”", !/Favorit/i.test(texto), texto);
  ok("“Tudo” é a escolhida", (await abaAtiva(page)) === "tudo", String(await abaAtiva(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n2. A conversa favorita, na linha e no menu");
{
  const { ctx, page, estouros } = await abrir();
  const linha = page.locator('[data-conversa-id="cv-fav"]');
  ok("a conversa plantada está na lista", (await linha.count()) === 1);
  const estrela = await linha.first().evaluate((el) =>
    [...el.querySelectorAll("svg")].some((s) => /f5c518|f4c430/i.test(s.getAttribute("fill") || "")
      || /f5c518|f4c430/i.test(s.getAttribute("stroke") || ""))).catch(() => null);
  ok("a linha não tem a estrela amarela", estrela === false, String(estrela));
  const chevron = page.locator('[data-conversa-id="cv-fav"] button[aria-label="Opções da conversa"]');
  ok("o ⌄ da linha existe", (await chevron.count()) === 1);
  if (await chevron.count()) {
    await chevron.first().click().catch(() => {});
    await page.waitForTimeout(400);
    const menu = await linha.first().innerText().catch(() => "");
    ok("o menu abre", /Fixar no topo|Desafixar/.test(menu), menu);
    ok("sem “Adicionar aos favoritos” nem “Remover dos favoritos”", !/favoritos/i.test(menu), menu);
    ok("com “Marcar como lida” ou “não lida”", /Marcar como (não )?lida/.test(menu));
    ok("e com “Arquivar”", /Arquivar/.test(menu));
  }
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\n3. A aba que se atualizou sozinha com o filtro das favoritas");
{
  const { ctx, page, estouros } = await abrir({ foto: { filtro: "favoritas" } });
  ok("volta em “Tudo”", (await abaAtiva(page)) === "tudo", String(await abaAtiva(page)));
  ok("e a conversa favorita aparece como qualquer outra", (await page.locator('[data-conversa-id="cv-fav"]').count()) === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  // O CONTRASTE: sem ele, uma foto que nunca fosse lida passaria também.
  const { ctx, page } = await abrir({ foto: { filtro: "naolidas" } });
  ok("a que voltou com “Não lidas” volta em “Não lidas”", (await abaAtiva(page)) === "naolidas", String(await abaAtiva(page)));
  await ctx.close();
}

console.log("\n4. O “Favoritar” da mensagem continua");
{
  const { ctx, page, estouros } = await abrir({ largura: 1600 });
  await page.locator('[data-conversa-id="cv-fav"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const bolha = page.getByText("olá", { exact: true }).last();
  ok("a mensagem está na conversa", (await bolha.count()) >= 1);
  if (await bolha.count()) {
    await bolha.hover().catch(() => {});
    await page.waitForTimeout(300);
    const seta = page.locator('[aria-label="Opções da mensagem"]');
    if (await seta.count()) {
      await seta.last().click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const t = await page.evaluate(() => document.body.innerText);
    ok("o menu da bolha oferece “Favoritar”", /\bFavoritar\b/.test(t));
  }
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
