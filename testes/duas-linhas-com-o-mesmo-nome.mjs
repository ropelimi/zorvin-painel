// DUAS LINHAS COM O MESMO NOME — qual delas é qual?
//
// RELATO DE 25/09, com foto: duas conversas idênticas na lista de conversas,
// mesmo nome e mesma foto, e o pedido de "juntar, porque é a mesma conversa".
//
// MEDIDO NO BANCO, e não eram duplicadas. Eram DOIS TELEFONES da mesma pessoa:
//
//     (19) 98209-4819   19 mensagens, desde 24/09   @lid 2735639489…
//     (71) 8425-3304    90 mensagens, desde 18/08   @lid 4011090094…
//
// Contas diferentes do WhatsApp, DDD diferente, as duas ativas no mesmo dia. No
// WhatsApp Web do escritório elas também são duas conversas. O Zorvin não
// duplicou nada — o que ele fazia de errado era ESCONDER que são dois números.
//
// POR QUE FICARAM IGUAIS: `nomeDoContato` mostra o nome da FICHA quando ela
// existe, e os dois contatos apontam para o mesmo cliente do Vantoro (o 1233).
// Os nomes do WhatsApp eram diferentes — "Cristiano" e "CristanoCristiano
// Ribeiro" — e a ficha cobriu os dois.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
// Que a tela diz o número QUANDO ELE FAZ FALTA, e fica quieta quando não faz.
// As duas metades importam. Sem a primeira, duas linhas iguais continuam
// iguais e alguém responde pelo número errado — que, está escrito no projeto,
// não tem desfazer. Sem a segunda, TODA linha ganha um telefone do lado do
// nome, o sinal vira ruído e deixa de ser lido justamente no dia em que
// importa.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

async function abrirPainel(semente) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s || undefined;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, semente);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1600);
  return { ctx, page, estouros };
}

/** O feitio de uma conversa de verdade da bancada — telefone e mensagem. */
async function molde() {
  const { ctx, page } = await abrirPainel(null);
  const m = await page.evaluate(() => {
    const id = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
    const msg = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
    return c ? { advogado_id: c.advogado_id, mensagem: msg || null } : null;
  });
  await ctx.close();
  return m;
}

const base = await molde();
ok("aprendi o feitio de uma conversa de verdade", !!base?.advogado_id);
if (!base?.advogado_id) { await nav.close(); process.exit(1); }

const agora = Date.now();
// Uma pessoa, DOIS TELEFONES, a mesma ficha — o caso do relato, com os números
// de verdade. Os nomes do WhatsApp são diferentes de propósito: é a ficha que
// os iguala na tela, e é isso que a prova precisa reproduzir.
const FICHA = "ZZ CRISTIANO RIBEIRO DE JESUS";
// E uma segunda dupla, escrita em caixas diferentes. "Maria Silva" e "MARIA
// SILVA" o olho separa e quem lê correndo não — a comparação ignora a caixa.
const CAIXA_A = "ZZ Maria Da Silva";
const CAIXA_B = "ZZ MARIA DA SILVA";
// E dois GRUPOS com o mesmo nome: o "número" deles é `grupo:<id>`, que não é
// telefone de ninguém. Sem o corte, a linha trocaria um nome repetido por um
// código que não quer dizer nada.
const GRUPO = "ZZ Mutirão de Acordos";

function pessoa(id, numero, nomeWhats, fichaNome) {
  return { id, nome: nomeWhats, numero, nome_zorvin: null,
           vantoro_cliente_id: fichaNome ? "1233" : null, vantoro_nome: fichaNome };
}
function conversa(id, contatoId, contato, minutosAtras) {
  return { id, contato_id: contatoId, advogado_id: base.advogado_id,
           fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
           ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
           atendendo_por: null, atendendo_em: null,
           ultima_atividade: new Date(agora - minutosAtras * 60000).toISOString(),
           contato };
}
function mensagem(id, conversaId, minutosAtras) {
  return { ...(base.mensagem || {}), id, conversa_id: conversaId, texto: "oi",
           criado_em: new Date(agora - minutosAtras * 60000).toISOString() };
}

const cts = [
  pessoa("ct-um", "5519982094819", "Cristiano", FICHA),
  pessoa("ct-dois", "557184253304", "CristanoCristiano Ribeiro", FICHA),
  pessoa("ct-caixa-a", "5511970001111", CAIXA_A, null),
  pessoa("ct-caixa-b", "5511970002222", CAIXA_B, null),
  // O SOZINHO: nome que não se repete em ninguém. É o contraste.
  pessoa("ct-so", "5511970003333", "ZZ Fulano Sem Xara", null),
  { id: "ct-gr-a", nome: GRUPO, numero: "grupo:aaa111", nome_zorvin: null,
    vantoro_cliente_id: null, vantoro_nome: null },
  { id: "ct-gr-b", nome: GRUPO, numero: "grupo:bbb222", nome_zorvin: null,
    vantoro_cliente_id: null, vantoro_nome: null },
];
const SEMENTE = {
  contatos: cts,
  conversas: cts.map((c, i) => conversa("cv-" + c.id, c.id, { ...c }, i + 1)),
  // SEM MENSAGEM A CONVERSA NÃO VEM NA LISTA — a consulta da página pede
  // `mensagens(id)` junto. Medido na prova dos grupos, em 16/09.
  mensagens: cts.map((c, i) => mensagem("m-" + c.id, "cv-" + c.id, i + 2)),
};

/** O que a linha desta conversa mostra ao lado do nome. */
const numeroNaLinha = (page, convId) => page.evaluate((id) => {
  const linha = document.querySelector(`[data-conversa-id="${id}"]`);
  if (!linha) return { achei: false };
  const marca = linha.querySelector("[data-numero-que-separa]");
  return { achei: true, texto: marca ? marca.innerText.trim() : null,
           bruto: marca ? marca.getAttribute("data-numero-que-separa") : null };
}, convId);

// ==================================================================
console.log("\nDuas conversas com o MESMO nome: cada uma diz o seu telefone");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE);
  const um = await numeroNaLinha(page, "cv-ct-um");
  const dois = await numeroNaLinha(page, "cv-ct-dois");
  ok("as duas conversas do relato estão na lista", um.achei && dois.achei);

  ok("a primeira mostra o telefone dela", um.texto === "(19) 98209-4819", JSON.stringify(um));
  ok("a segunda mostra o telefone dela", dois.texto === "(71) 8425-3304", JSON.stringify(dois));
  // CADA LINHA COM O SEU. Um conserto que pegasse o número do primeiro achado
  // mostraria o mesmo nas duas — e duas linhas iguais continuariam iguais, só
  // que agora com um número errado numa delas, que é pior.
  ok("e os dois são DIFERENTES entre si", um.texto && um.texto !== dois.texto,
     `${um.texto} / ${dois.texto}`);
  // O NÚMERO É O DA CONVERSA, e não um texto bonito qualquer: o bruto tem de
  // bater com o contato daquela linha.
  ok("o número mostrado é o do contato daquela linha",
     um.bruto === "5519982094819" && dois.bruto === "557184253304",
     `${um.bruto} / ${dois.bruto}`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nNome que não se repete: a linha fica quieta");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE);
  const so = await numeroNaLinha(page, "cv-ct-so");
  ok("a conversa sem xará está na lista", so.achei);
  // O CONTRASTE, e é ele que impede o conserto de virar ruído. Com o telefone
  // em toda linha, o sinal deixa de ser lido justamente no dia em que importa.
  ok("ela NÃO mostra telefone nenhum ao lado do nome", so.texto === null, JSON.stringify(so));

  // E a lista inteira: só as linhas ambíguas ganham a marca.
  const quantas = await page.locator("[data-numero-que-separa]").count();
  const linhas = await page.locator("[data-conversa-nome]").count();
  ok("só as linhas ambíguas ganham a marca, e não a lista inteira",
     quantas > 0 && quantas < linhas, `${quantas} marcas em ${linhas} linhas`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nMesmo nome escrito em caixas diferentes também é ambíguo");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE);
  const a = await numeroNaLinha(page, "cv-ct-caixa-a");
  const b = await numeroNaLinha(page, "cv-ct-caixa-b");
  ok("as duas estão na lista", a.achei && b.achei);
  ok('"ZZ Maria Da Silva" mostra o telefone', a.texto === "(11) 97000-1111", JSON.stringify(a));
  ok('"ZZ MARIA DA SILVA" mostra o telefone', b.texto === "(11) 97000-2222", JSON.stringify(b));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nGrupo com nome repetido NÃO ganha um código no lugar do telefone");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE);
  const a = await numeroNaLinha(page, "cv-ct-gr-a");
  const b = await numeroNaLinha(page, "cv-ct-gr-b");
  ok("os dois grupos de mesmo nome estão na lista", a.achei && b.achei);
  // "grupo:aaa111" não é telefone de ninguém: escrevê-lo trocaria um nome
  // repetido por um código que não quer dizer nada para quem lê.
  ok("o primeiro grupo não mostra número", a.texto === null, JSON.stringify(a));
  ok("o segundo grupo não mostra número", b.texto === null, JSON.stringify(b));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
