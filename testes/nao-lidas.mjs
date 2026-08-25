// O NÚMERO DE NÃO LIDAS TEM DE SER O MESMO NOS DOIS LUGARES.
//
// Relatado pelo escritório com um print: o selo do telefone na barra lateral
// dizia 71 e o chip "Não lidas" ao lado dizia 37. Dois números para a mesma
// pergunta, na mesma tela, a três centímetros um do outro.
//
// A CAUSA: o selo conta NO BANCO; o chip contava a lista CARREGADA. E a lista
// vem em páginas de 200 — num telefone com mais do que isso, o chip só enxerga
// as não lidas do pedaço que já chegou.
//
// E ele errava PARA MENOS, que é a pior direção: some o aviso de que há gente
// esperando. Quem olhasse o 37 concluiria que a fila é metade do que é.
//
// ESTA PROVA PRECISA DE MAIS CONVERSAS DO QUE CABE NUMA PÁGINA. Com poucas, os
// dois jeitos de contar dão o mesmo número e a conferência não distingue nada —
// foi exatamente assim que o defeito passou até hoje.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

const molde = await page.evaluate(() => {
  const id = document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id");
  const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
  const m = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
  return c ? { advogado_id: c.advogado_id, mensagem: m || null } : null;
});
ok("aprendi o feitio da conversa na amostra", !!molde?.advogado_id);
ok("e o feitio de uma mensagem", !!molde?.mensagem,
   "sem ela as conversas plantadas somem como fantasmas");

// 260 CONVERSAS: acima da página de 200, para os dois jeitos de contar deixarem
// de coincidir. 60 delas não lidas, e as não lidas ficam nas MAIS ANTIGAS de
// propósito — assim caem na segunda página, que é onde o chip não olhava.
const QUANTAS = 260;
const NAO_LIDAS = 60;
// ARQUIVADAS COM MENSAGEM POR LER. Sem elas na amostra, tirar o filtro de
// arquivada do selo não muda número nenhum — e foi assim que a sabotagem que
// remove esse filtro passou sem morder. Um contador sobre arquivadas só é
// medível se houver arquivada.
const ARQUIVADAS_NAO_LIDAS = 7;
const agora = Date.now();
const contatos = [], conversas = [], mensagens = [];
for (let i = 0; i < QUANTAS; i++) {
  const n = String(i).padStart(4, "0");
  // As últimas do laço são as mais ANTIGAS (data mais para trás), e são as que
  // ficam não lidas.
  const naoLida = i >= QUANTAS - NAO_LIDAS;
  contatos.push({ id: `ct-${n}`, nome: `ZZ Contato ${n}`, numero: `5521970${n}000`,
                  vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null });
  conversas.push({
    id: `cv-${n}`, contato_id: `ct-${n}`, advogado_id: molde.advogado_id,
    fixada: false, arquivada: false, favorita: false,
    nao_lidas: naoLida ? 1 : 0,
    ultima_mensagem: null,
    ultima_atividade: new Date(agora - i * 60000).toISOString(),
    frente: null, vantoro_nome: null, digitando_ate: null,
    atendendo_por: null, atendendo_em: null,
    contato: { nome: `ZZ Contato ${n}`, numero: `5521970${n}000`, foto_url: null,
               vantoro_nome: null, nome_zorvin: null },
  });
  mensagens.push({ ...molde.mensagem, id: `msg-${n}`, conversa_id: `cv-${n}`,
                   texto: "oi", criado_em: new Date(agora - i * 60000 - 1000).toISOString() });
}

for (let i = 0; i < ARQUIVADAS_NAO_LIDAS; i++) {
  const n = `arq${i}`;
  contatos.push({ id: `ct-${n}`, nome: `ZZ Arquivado ${i}`, numero: `552197${i}99000`,
                  vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null });
  conversas.push({
    id: `cv-${n}`, contato_id: `ct-${n}`, advogado_id: molde.advogado_id,
    fixada: false, arquivada: true, favorita: false, nao_lidas: 1,
    ultima_mensagem: null,
    // MAIS ANTIGAS QUE A PÁGINA INTEIRA, e isto é a coisa toda.
    //
    // Elas estavam a oito minutos atrás — ou seja, no TOPO da lista, dentro da
    // primeira página. Contar a página e contar o banco davam o mesmo número, e
    // a sabotagem que devolve o contador para a lista passava sem morder.
    //
    // Uma prova sobre paginação precisa que o dado esteja DO OUTRO LADO da
    // página. Aqui elas ficam além das 260, bem fora das 200 que carregam.
    ultima_atividade: new Date(agora - (QUANTAS + 50 + i) * 60000).toISOString(),
    frente: null, vantoro_nome: null, digitando_ate: null,
    atendendo_por: null, atendendo_em: null,
    contato: { nome: `ZZ Arquivado ${i}`, numero: `552197${i}99000`, foto_url: null,
               vantoro_nome: null, nome_zorvin: null },
  });
  mensagens.push({ ...molde.mensagem, id: `msg-${n}`, conversa_id: `cv-${n}`, texto: "oi",
                   criado_em: new Date(agora - (QUANTAS + 50 + i) * 60000 - 1000).toISOString() });
}

await page.addInitScript((s) => { globalThis.__SEMENTE = s; },
                         { contatos, conversas, mensagens });
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2500);

const numeroDoChip = async () => {
  const t = await page.locator('[data-aba="naolidas"], button:has-text("Não lidas")')
    .first().innerText().catch(() => "");
  const m = /(\d+)/.exec(t || "");
  return m ? Number(m[1]) : null;
};
const numeroDoSelo = async () => {
  const t = await page.locator("[data-selo-nao-lidas]").first().innerText().catch(() => "");
  const m = /(\d+)/.exec(t || "");
  return m ? Number(m[1]) : null;
};

console.log("\nO chip e o selo dizem o mesmo número");
{
  // O ESPERADO SAI DO PRÓPRIO BANCO DE MENTIRA, e não de um número escrito aqui.
  //
  // A semente SOMA às conversas da amostra em vez de substituí-las — plantei 60
  // não lidas e a resposta certa era 69, porque a amostra já trazia 9. Um número
  // fixo aqui reprovaria a correção certa, e no dia em que a amostra mudasse
  // reprovaria de novo, por outro motivo.
  const esperado = await page.evaluate((adv) => (globalThis.__TABELAS.conversas || [])
    .filter((c) => String(c.advogado_id) === String(adv)
                && !c.arquivada && (c.nao_lidas || 0) > 0).length, molde.advogado_id);
  ok("a amostra tem mais não lidas do que eu plantei, e a conta usa a do banco",
     esperado >= NAO_LIDAS, `esperado=${esperado}, plantadas=${NAO_LIDAS}`);

  const chip = await numeroDoChip();
  const selo = await numeroDoSelo();
  // A CONFERÊNCIA DO DEFEITO RELATADO. Antes desta correção o chip dizia o que
  // coube na página e o selo dizia a verdade.
  ok("o chip conta todas as não lidas, e não só a página carregada",
     chip === esperado, `chip=${chip}, esperado ${esperado}`);
  ok("e o selo diz o mesmo número", selo === esperado,
     `selo=${selo}, esperado ${esperado}`);
  // ESTA SOZINHA NÃO BASTA: dois números errados do mesmo jeito também batem
  // entre si. Ela só tem valor ao lado das duas de cima, que ancoram no banco.
  ok("os dois batem entre si", chip === selo, `chip=${chip} selo=${selo}`);
}

console.log("\nAs arquivadas não entram no selo, mas não somem da tela");
{
  // DUAS COISAS AO MESMO TEMPO, e as duas importam.
  //
  // Conversa arquivada NÃO entra no selo: ninguém vai atendê-la, e o número tem
  // de bater com a fila de verdade. Mas "não conta lá" não pode virar "não
  // existe" — são mensagens de cliente que ninguém leu, e sem um contador
  // próprio elas ficariam invisíveis para sempre atrás de uma pasta que ninguém
  // tem motivo para abrir.
  const noSelo = await numeroDoSelo();
  const semArquivadas = await page.evaluate((adv) => (globalThis.__TABELAS.conversas || [])
    .filter((c) => String(c.advogado_id) === String(adv)
                && !c.arquivada && (c.nao_lidas || 0) > 0).length, molde.advogado_id);
  ok("o selo NÃO conta as arquivadas", noSelo === semArquivadas,
     `selo=${noSelo}, não arquivadas=${semArquivadas}`);

  // A LINHA "ARQUIVADAS" TEM DE ESTAR NA TELA.
  //
  // Ela só é desenhada quando `totalArquivadas > 0`, e esse número também vinha
  // da lista carregada. Com as arquivadas além da primeira página, a linha
  // sumia INTEIRA — não era só o contador ficar errado, era a porta para as
  // conversas arquivadas desaparecer, e com ela o único aviso de que há
  // mensagem por ler lá dentro.
  const linha = page.locator('[data-nao-lidas-arquivadas]').first();
  ok("a linha das arquivadas aparece mesmo com elas fora da página carregada",
     await linha.count() === 1, "a porta para as arquivadas sumiu da tela");

  const marca = page.locator("[data-nao-lidas-arquivadas]").first();
  const nasArquivadas = Number(await marca.getAttribute("data-nao-lidas-arquivadas")
    .catch(() => "0")) || 0;
  const arquivadasNoBanco = await page.evaluate((adv) => (globalThis.__TABELAS.conversas || [])
    .filter((c) => String(c.advogado_id) === String(adv)
                && c.arquivada && (c.nao_lidas || 0) > 0).length, molde.advogado_id);
  ok("mas elas aparecem no contador das arquivadas",
     nasArquivadas === arquivadasNoBanco && nasArquivadas > 0,
     `contador=${nasArquivadas}, no banco=${arquivadasNoBanco}`);
}

console.log("\nE nada disso estourou no caminho");
ok("sem erro de JavaScript", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
