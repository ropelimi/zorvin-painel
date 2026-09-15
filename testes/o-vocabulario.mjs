// COMO ESTA INSTALAÇÃO CHAMA QUEM É DONO DE UM TELEFONE.
//
// O painel dizia "advogado" em NOVE frases — "ADVOGADO (dono destas
// conversas)", "Escolha o advogado…", "QUAL NOME É VOCÊ (o advogado) NAS
// CONVERSAS?", "No celular do advogado: …". Para o escritório está certo. Para
// uma clínica ou uma imobiliária, o programa fala de uma profissão que não é a
// deles.
//
// ONDE ELAS FICAM, medido: em Configurações → Importar histórico e
// Configurações → Contatos. NÃO na primeira tela — ela diz "ATENDENDO COMO" e
// lista nomes de telefone. Escrevi esta prova supondo o contrário e ela
// reprovou três vezes, falando de um rótulo que não existe lá.
//
// E O QUE NÃO SE TROCA: `origem === "advogado"` aparece vinte vezes no
// `Painel.jsx` e é VALOR GRAVADO NO BANCO — é o que separa mensagem da equipe
// de mensagem do cliente. Trocar aquilo junto quebraria as bolhas de todas as
// conversas.
//
// A palavra mora em `zorvin_palavras` (script 003, no repo da ponte) e é
// trocada numa seção da tela de administração — não por SQL, porque quem compra
// o programa não cola SQL, e palavra que exige chamar o fornecedor para ser
// trocada é palavra fixa.
//
// SEM A TABELA, TUDO COMO ANTES: é o primeiro cenário, e ele é o que garante
// que o escritório não vê diferença nenhuma.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Abre o painel com (ou sem) a linha de palavras no banco de mentira.
 *
 *  TODAS AS BANDEIRAS EM TODA ABERTURA, sempre — `addInitScript` acumula, e uma
 *  bandeira ligada num cenário continuaria valendo nos seguintes, fazendo a
 *  prova reprovar falando de outro assunto. Está escrito no CLAUDE.md porque já
 *  aconteceu duas vezes. */
async function abrirPainel(palavras, { admin = true, recusarEscrita = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript(([p, a, r]) => {
    globalThis.__PALAVRAS = p || undefined;
    globalThis.__SOU_ADMIN = a;
    globalThis.__ESCRITA_SEM_EFEITO = r ? ["zorvin_palavras"] : [];
  }, [palavras, admin, recusarEscrita]);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(700);
  return { ctx, page, estouros };
}

/** Abre Configurações → Importar histórico.
 *
 *  É ALI QUE A PALAVRA MORA, e não na barra lateral. Eu tinha escrito esta
 *  prova procurando "ADVOGADO" na tela principal — ela diz "ATENDENDO COMO" e
 *  lista nomes de telefone, então as três conferências reprovaram falando de um
 *  rótulo que não existe lá. Foi a prova que me corrigiu, e de quebra mostrou
 *  que eu tinha deixado uma frase para trás ("No celular do advogado: …"),
 *  escondida do meu primeiro extrator por um `<b>` no meio dela. */
async function abrirOndeAPalavraMora(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Importar histórico" }).click();
  await page.waitForTimeout(400);
  return page.locator("body").innerText();
}

async function abrirAdministracao(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(800);
}

// ------------------------------------------------------------------
console.log("\nSem a tabela, o escritório não vê diferença nenhuma");
{
  const { ctx, page, estouros } = await abrirPainel(null);
  const texto = await abrirOndeAPalavraMora(page);
  ok("a tela de importar continua dizendo ADVOGADO", /ADVOGADO/.test(texto),
     texto.slice(0, 400));
  ok("e a frase do celular também", /No celular do advogado/i.test(texto));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await abrirAdministracao(page);
  // A SEÇÃO NÃO APARECE sem a linha: são os campos de um "Salvar" que não
  // acharia o que atualizar — a pessoa escreve, aperta, e nada acontece nem
  // falha.
  ok("e a tela de administração não oferece trocar a palavra",
     await page.locator("[data-palavras-da-casa]").count() === 0);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nCom a palavra trocada, a tela fala a língua da casa");
{
  const { ctx, page, estouros } = await abrirPainel(
    { singular: "corretor", plural: "corretores", genero: "m" });
  const texto = await abrirOndeAPalavraMora(page);
  ok("a tela de importar diz CORRETOR", /CORRETOR/.test(texto), texto.slice(0, 400));
  ok("e a frase do celular diz 'do corretor'", /No celular do corretor/i.test(texto),
     (texto.match(/No celular[^\n]{0,40}/i) || [""])[0]);
  // ESTA É A CONFERÊNCIA QUE PROVA QUE A TROCA ACONTECEU, e não que a palavra
  // nova foi só acrescentada em algum canto: "advogado" não pode ter sobrado.
  ok("e 'ADVOGADO' não sobrou em lugar nenhum", !/ADVOGADO/.test(texto),
     (texto.match(/.{0,40}ADVOGADO.{0,40}/) || [""])[0]);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nE ela concorda em gênero, que é o que erra");
{
  const { ctx, page } = await abrirPainel(
    { singular: "médica", plural: "médicas", genero: "f" });
  const texto = await abrirOndeAPalavraMora(page);
  ok("diz MÉDICA na tela de importar", /MÉDICA/i.test(texto), texto.slice(0, 400));
  // "No celular do médica" é o mesmo erro de concordância, na frase que o
  // primeiro extrator nem tinha achado.
  ok("e a frase do celular diz 'da médica'", /No celular da médica/i.test(texto),
     (texto.match(/No celular[^\n]{0,40}/i) || [""])[0]);
  // "o médica" é o erro que faz um comprador achar que o programa é amador, e
  // é exatamente o que aconteceria deduzindo o gênero da terminação.
  ok("e não escreve 'o médica' em lugar nenhum", !/\bo médica\b/i.test(texto),
     (texto.match(/.{0,40}o médica.{0,40}/i) || [""])[0]);
  ok("nem 'dono' quando a palavra é feminina",
     !/MÉDICA \(dono/i.test(texto), (texto.match(/MÉDICA \([^)]*\)/i) || [""])[0]);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nE a palavra em que deduzir pela terminação erra");
{
  // "CORRETOR" e "MÉDICA" obedecem à dedução por terminação — os dois
  // cenários acima passavam IGUAL com o gênero deduzido, e a sabotagem provou
  // isso. "gerente" é o caso que separa: termina em "e", e aqui é feminino.
  // Sem esta cena, a coluna `genero` poderia ser jogada fora sem nenhuma prova
  // reclamar, e o erro só apareceria na tela de um comprador.
  const { ctx, page } = await abrirPainel(
    { singular: "gerente", plural: "gerentes", genero: "f" });
  const texto = await abrirOndeAPalavraMora(page);
  ok("diz 'da gerente', e não 'do gerente'", /No celular da gerente/i.test(texto),
     (texto.match(/No celular[^\n]{0,40}/i) || [""])[0]);
  ok("e 'dona destas conversas', e não 'dono'",
     /GERENTE \(dona destas conversas\)/i.test(texto),
     (texto.match(/GERENTE \([^)]*\)/i) || [""])[0]);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nQuem administra troca a palavra na tela, e não por SQL");
{
  const { ctx, page } = await abrirPainel(
    { singular: "advogado", plural: "advogados", genero: "m" });
  await abrirAdministracao(page);
  ok("a seção existe quando a tabela está pronta",
     await page.locator("[data-palavras-da-casa]").count() === 1);

  await page.locator("[data-palavra-singular]").fill("consultor");
  await page.locator("[data-palavra-plural]").fill("consultores");
  await page.waitForTimeout(200);
  // A PRÉVIA É O QUE MOSTRA A CONCORDÂNCIA ANTES DE SALVAR. Sem ela, quem
  // escreve "médica" e esquece o gênero só descobre o "o médica" depois de
  // fechar a tela.
  const previa = await page.locator("[data-palavras-previa]").innerText();
  ok("a prévia mostra a frase montada", /CONSULTOR \(dono destas conversas\)/i.test(previa),
     previa);

  await page.locator("[data-palavras-salvar]").click();
  await page.waitForTimeout(700);
  const depois = await page.locator("[data-palavras-previa]").innerText();
  ok("e salvar confirma na tela", /salvo/i.test(depois), depois);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nO campo em branco não salva");
{
  const { ctx, page } = await abrirPainel(
    { singular: "advogado", plural: "advogados", genero: "m" });
  await abrirAdministracao(page);
  await page.locator("[data-palavra-singular]").fill("");
  await page.locator("[data-palavras-salvar]").click();
  await page.waitForTimeout(500);
  const texto = await page.locator("body").innerText();
  // "Escolha o …" é pior do que uma frase com a profissão errada.
  ok("a tela recusa e diz por quê", /Escreva as duas palavras/i.test(texto),
     texto.slice(0, 400));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nE a gravação que o banco esconde não passa por sucesso");
{
  // A REGRA DE ACESSO QUE BARRA UM UPDATE NÃO DEVOLVE ERRO: ela não acha a
  // linha, atualiza zero e responde "tudo certo". Sem o `.select("id")`, quem
  // não administra apertaria Salvar, veria a confirmação, e a palavra voltaria
  // ao abrir de novo — a tela afirmando o que o banco não tem. Está descrito
  // no `Departamentos.jsx` como a armadilha que fazia aquela tela "não
  // funcionar sem dizer nada"; a sabotagem mostrou que aqui ela não tinha
  // prova nenhuma.
  const { ctx, page } = await abrirPainel(
    { singular: "advogado", plural: "advogados", genero: "m" },
    { recusarEscrita: true });
  await abrirAdministracao(page);
  await page.locator("[data-palavra-singular]").fill("consultor");
  await page.locator("[data-palavras-salvar]").click();
  await page.waitForTimeout(700);
  const texto = await page.locator("body").innerText();
  ok("a tela diz que NÃO salvou", /Não salvou/i.test(texto), texto.slice(0, 400));
  ok("e não mostra a confirmação de salvo",
     !/· salvo/i.test(await page.locator("[data-palavras-previa]").innerText()));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
