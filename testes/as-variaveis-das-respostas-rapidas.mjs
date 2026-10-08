// AS VARIÁVEIS DAS RESPOSTAS RÁPIDAS (08/10) — pedido do Rodrigo: a resposta
// pronta que diz o nome do cliente.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. a conta, direto na função (`variaveis.js`): o primeiro nome sem o grito
//      das maiúsculas do cadastro, o nome inteiro com "da"/"de" minúsculos, o
//      tratamento ("Dr.", "Dona") que não é nome, a saudação pela hora e com
//      maiúscula só no começo da frase, as grafias com acento e chave dobrada,
//      e o cliente SEM nome, que não pode virar "Olá, !";
//   2. o texto sem variável volta IGUAL — a rápida de sempre não muda só porque
//      passou por aqui;
//   3. na conversa: o menu do "/" já mostra o texto preenchido, ele entra assim
//      na caixa, e SAI assim para a fila — o que se vê é o que sai;
//   4. o nome é o do alto da conversa (a ficha, e não o "Deus" do WhatsApp);
//      o grupo não empresta o nome dele; o texto preenchido de um cliente não
//      atravessa para a conversa de outro;
//   5. na configuração: as variáveis num clique, postas ONDE ESTÁ O CURSOR; a
//      prévia; o aviso da variável que o Zorvin não conhece; e o texto GUARDADO
//      com a variável, e não preenchido.
//
// O RELÓGIO É FIXADO (`page.clock`), no fuso de São Paulo: a saudação depende
// da hora, e uma prova que roda às 11:59 não pode reprovar às 12:00.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { preencherVariaveis, primeiroNome, nomeCompleto, saudacaoDaHora,
         variaveisDesconhecidas, usaVariaveis } from "../src/variaveis.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

// ==================================================================
//  1. A CONTA, DIRETO NA FUNÇÃO
// ==================================================================
console.log("\n1. A conta, direto na função");
const AS9 = new Date(2026, 9, 8, 9, 0);
const AS14 = new Date(2026, 9, 8, 14, 0);
const AS20 = new Date(2026, 9, 8, 20, 0);
const ANDREIA = { cliente: "ANDREIA CRISTINA MARTINS", atendente: "MARIANA DE OLIVEIRA", agora: AS9 };
const SEM_NOME = { cliente: "", atendente: "MARIANA DE OLIVEIRA", agora: AS14 };
const CASOS = [
  ["o primeiro nome, sem o grito das maiúsculas", "{saudacao}, {nome}! Aqui é {atendente}.", ANDREIA,
   "Bom dia, Andreia! Aqui é Mariana."],
  ["o nome inteiro, com as partículas minúsculas", "Prezado(a) {nome_completo},",
   { ...ANDREIA, cliente: "MARIA DAS GRAÇAS DE SOUZA" }, "Prezado(a) Maria das Graças de Souza,"],
  ["a saudação no meio da frase é minúscula", "Olá, {saudacao}!", ANDREIA, "Olá, bom dia!"],
  ["depois de ponto de exclamação, abre frase", "Oi! {saudacao}, tudo bem?", ANDREIA, "Oi! Bom dia, tudo bem?"],
  ["depois de quebra de linha, abre frase", "Tudo certo.\n{saudacao}", { ...ANDREIA, agora: AS20 }, "Tudo certo.\nBoa noite"],
  ["com acento, maiúscula, espaço e chave dobrada", "{Saudação}, { NOME }! {nome completo} {{nome}}", ANDREIA,
   "Bom dia, Andreia! Andreia Cristina Martins Andreia"],
  ["a variável desconhecida fica como foi escrita", "{processo} de {nome}", ANDREIA, "{processo} de Andreia"],
  ["sem nome: \"Olá, {nome}!\" vira \"Olá!\"", "Olá, {nome}!", SEM_NOME, "Olá!"],
  ["sem nome, antes de vírgula", "Oi {nome}, tudo bem?", SEM_NOME, "Oi, tudo bem?"],
  ["sem nome, no começo: a frase que sobra ganha maiúscula", "{nome}, seu documento chegou.", SEM_NOME,
   "Seu documento chegou."],
  ["sem nome, no meio da frase", "Obrigado {nome} pelo contato.", SEM_NOME, "Obrigado pelo contato."],
  ["sem nome, entre duas vírgulas", "Olá, {nome}, tudo bem?", SEM_NOME, "Olá, tudo bem?"],
  ["sem nome, junto da saudação", "{saudacao}, {nome}!", SEM_NOME, "Boa tarde!"],
  ["sem nome, numa segunda linha", "Linha 1\n{nome}, segunda linha", SEM_NOME, "Linha 1\nSegunda linha"],
  ["sem variável: volta IGUAL, espaço duplo e tudo", "Olá,  tudo bem ?", ANDREIA, "Olá,  tudo bem ?"],
  ["com variável e nome: o resto do texto não é mexido", "Olá,  {nome} !", ANDREIA, "Olá,  Andreia !"],
];
for (const [nome, texto, opcoes, esperado] of CASOS) {
  const veio = preencherVariaveis(texto, opcoes);
  ok(nome, veio === esperado, `${q(texto)} → ${q(veio)}, esperava ${q(esperado)}`);
}

const NOMES = [
  ["o cadastro em maiúsculas", "ANDREIA CRISTINA MARTINS", "Andreia"],
  ["o emoji do WhatsApp sai", "Jô 💜", "Jô"],
  ["o til de enfeite sai", "~Maria Silva", "Maria"],
  ["\"Dr.\" é tratamento, não nome", "Dr. João Pedro", "João"],
  ["\"Dona\" também", "Dona Maria", "Maria"],
  ["número não é nome", "+5511987654321", ""],
  ["só emoji não é nome", "🌸", ""],
  ["quem escreveu McDonald sabia", "McDonald Souza", "McDonald"],
  ["o hífen e o acento", "ANA-PAULA", "Ana-Paula"],
  ["a maiúscula acentuada", "ÉLCIO", "Élcio"],
];
for (const [nome, de, esperado] of NOMES) {
  const veio = primeiroNome(de);
  ok(`primeiro nome — ${nome}`, veio === esperado, `${q(de)} → ${q(veio)}`);
}
ok("o nome inteiro também perde o tratamento", nomeCompleto("Dr. João Pedro") === "João Pedro",
   q(nomeCompleto("Dr. João Pedro")));

const HORAS = [[4, 59, "boa noite"], [5, 0, "bom dia"], [11, 59, "bom dia"], [12, 0, "boa tarde"],
               [17, 59, "boa tarde"], [18, 0, "boa noite"], [0, 30, "boa noite"]];
for (const [h, m, esperado] of HORAS) {
  const veio = saudacaoDaHora(new Date(2026, 9, 8, h, m));
  ok(`às ${h}:${String(m).padStart(2, "0")}, "${esperado}"`, veio === esperado, q(veio));
}
{
  const d = variaveisDesconhecidas("{processo} {nome} {cliente} {processo}");
  ok("as desconhecidas são achadas, sem repetir", q(d) === q(["{processo}", "{cliente}"]), q(d));
  ok("e as que o Zorvin conhece não entram na lista", variaveisDesconhecidas("{Saudação} {nome completo}").length === 0,
     q(variaveisDesconhecidas("{Saudação} {nome completo}")));
  ok("\"usa variáveis\" diz sim só para as conhecidas", usaVariaveis("Olá, {nome}") && !usaVariaveis("só {processo}"));
}

// ==================================================================
//  A BANCADA
// ==================================================================
const nav = await abrirNavegador();
const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';
const ATENDENTE = "MARIANA DE OLIVEIRA";
const AGORA = Date.parse("2026-10-08T09:00:00-03:00");
const antes = (min) => new Date(AGORA - min * 60000).toISOString();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
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

// TRÊS CONVERSAS PLANTADAS. A da Andreia tem o nome do WhatsApp "Deus" e a
// ficha em maiúsculas — o caso real que o CLAUDE.md conta: o alto da conversa
// diz o da ficha, e é ele que a variável usa. A sem nome mostra só o número. O
// grupo tem nome, e esse nome não pode ir num "Olá, {nome}!".
const contato = (id, numero, nome, vantoro_nome = null) =>
  ({ id, numero, nome, vantoro_nome, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-var-1", "5511948230101", "Deus", "ANDREIA CRISTINA MARTINS"),
  contato("ct-var-2", "5511948230102", null),
  contato("ct-var-3", "grupo:120363999000000001", "Mutirão dos Acordos"),
];
const conversa = (n) => ({
  id: `cv-var-${n}`, advogado_id: ADV, contato_id: `ct-var-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null,
  vantoro_nome: CONTATOS[n - 1].vantoro_nome, contato: CONTATOS[n - 1],
});
const RAPIDAS = [
  { id: "rp-var-1", titulo: "Saudação", texto: "{saudacao}, {nome}! Aqui é {atendente}, do escritório." },
  { id: "rp-var-2", titulo: "Documento recebido", texto: "Olá, {nome}! Recebemos o seu documento." },
  { id: "rp-var-3", titulo: "Prezado", texto: "Prezado(a) {nome_completo},\nseu acordo foi registrado." },
  { id: "rp-var-4", titulo: "Sem variável", texto: "Pode me mandar  a foto do RG?" },
  { id: "rp-var-5", titulo: "Retorno", texto: "Olá, {saudacao}! Retornando o seu contato." },
];
const SEMENTE = {
  contatos: CONTATOS,
  conversas: [1, 2, 3].map(conversa),
  mensagens: [1, 2, 3].map((n) => ({
    id: `m-var-${n}`, conversa_id: `cv-var-${n}`, origem: "contato", tipo: "texto",
    texto: "Bom dia, alguma novidade?", criado_em: antes(n + 5),
  })),
  mensagens_rapidas: RAPIDAS,
};

const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
await page.clock.setFixedTime(new Date(AGORA));
// TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
await page.addInitScript(({ semente, atendente }) => {
  globalThis.__SEMENTE = semente;
  globalThis.__NOME_NOVO_U1 = atendente;
}, { semente: SEMENTE, atendente: ATENDENTE });
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Abre a conversa — com o clique GUARDADO: num elemento que não existe,
 *  `click()` estoura a prova inteira, e prova que estoura não diz QUAL
 *  conferência viu o defeito. */
async function abrir(id) {
  const linha = page.locator(`[data-conversa-id="${id}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  return true;
}
const caixa = () => page.locator(CAMPO);
const naCaixa = () => caixa().inputValue().catch(() => "SEM CAIXA");
/** Digita o "/" com o filtro e lê o que o menu mostra para a rápida. */
async function menuDiz(filtro, titulo) {
  if (!(await caixa().count())) return null;
  await caixa().fill(`/${filtro}`);
  await page.waitForTimeout(250);
  const item = page.locator(`[data-rapida-no-menu="${titulo}"] [data-texto-da-rapida]`);
  return (await item.count()) ? (await item.first().innerText()).trim() : null;
}
/** Escolhe a rápida no menu e devolve a caixa. Pelo CLIQUE no item, e não
 *  pelo Enter: "/Sauda" também acha a "Retorno", que tem {saudacao} no texto,
 *  e o Enter pega a primeira da lista. `teclado` usa o Enter, para o filtro
 *  que só acha uma — os dois caminhos que a equipe usa. */
async function escolher(filtro, titulo, { teclado = false } = {}) {
  const previa = await menuDiz(filtro, titulo);
  if (previa === null) return { previa, caixa: "MENU SEM A RÁPIDA" };
  if (teclado) await caixa().press("Enter");
  else await page.locator(`[data-rapida-no-menu="${titulo}"]`).first().click();
  await page.waitForTimeout(250);
  return { previa, caixa: await naCaixa() };
}

// ==================================================================
//  2. NA CONVERSA, ÀS 9h
// ==================================================================
console.log("\n2. Na conversa da Andreia, às 9h");
ok("a conversa da Andreia abriu", await abrir("cv-var-1"));
{
  const nomeNoAlto = await page.locator("[data-nome-do-contato]").first().innerText().catch(() => "");
  ok("o alto da conversa diz o nome da ficha, e não o do WhatsApp", nomeNoAlto.trim() === "ANDREIA CRISTINA MARTINS",
     q(nomeNoAlto));
  const ESPERADO = "Bom dia, Andreia! Aqui é Mariana, do escritório.";
  const r = await escolher("Sauda", "Saudação");
  ok("o menu do \"/\" já mostra o texto preenchido", r.previa === ESPERADO, q(r.previa));
  ok("e ele entra assim na caixa", r.caixa === ESPERADO, q(r.caixa));
  // O QUE SE VÊ É O QUE SAI: o Enter manda o que está na caixa, e é a fila que
  // diz o que foi mandado.
  await caixa().press("Enter");
  await page.waitForTimeout(900);
  const saiu = await page.evaluate(() => (globalThis.__TABELAS.fila_envio || [])
    .filter((f) => String(f.conversa_id) === "cv-var-1").map((f) => f.texto));
  ok("e sai assim para o cliente (a fila tem esse texto)", saiu.length === 1 && saiu[0] === ESPERADO, q(saiu));
}
{
  const r = await escolher("Prez", "Prezado");
  ok("{nome_completo} sem o grito, e a quebra de linha mantida",
     r.caixa === "Prezado(a) Andreia Cristina Martins,\nseu acordo foi registrado.", q(r.caixa));
  await caixa().fill("");
}
{
  const r = await escolher("Sem var", "Sem variável");
  ok("a rápida sem variável entra IGUAL, espaço duplo e tudo", r.caixa === "Pode me mandar  a foto do RG?", q(r.caixa));
  await caixa().fill("");
}
{
  // O TEXTO PREENCHIDO NÃO ATRAVESSA. Escolhido na Andreia e deixado na caixa,
  // ele é o rascunho DELA: a conversa seguinte não pode abrir com "Olá,
  // Andreia!" pronto para ir ao cliente errado.
  const r = await escolher("Docu", "Documento recebido", { teclado: true });
  ok("na Andreia, pelo Enter: \"Olá, Andreia! …\"", r.caixa === "Olá, Andreia! Recebemos o seu documento.", q(r.caixa));
  ok("a conversa sem nome abriu", await abrir("cv-var-2"));
  ok("e a caixa dela NÃO tem o texto da Andreia", (await naCaixa()) === "", q(await naCaixa()));
}

console.log("\n3. O cliente sem nome, e o grupo");
{
  const r = await escolher("Docu", "Documento recebido");
  ok("sem nome: \"Olá! Recebemos o seu documento.\" — sem \"Olá, !\"",
     r.caixa === "Olá! Recebemos o seu documento.", q(r.caixa));
  ok("o número não entra no lugar do nome", !/\d{4}/.test(r.caixa), q(r.caixa));
  await caixa().fill("");
  const s = await escolher("Sauda", "Saudação");
  ok("sem nome, a saudação fica de pé", s.caixa === "Bom dia! Aqui é Mariana, do escritório.", q(s.caixa));
  await caixa().fill("");
}
ok("o grupo abriu", await abrir("cv-var-3"));
{
  const r = await escolher("Docu", "Documento recebido");
  ok("no grupo, o nome do grupo não vira {nome}", r.caixa === "Olá! Recebemos o seu documento.", q(r.caixa));
  await caixa().fill("");
}

// ==================================================================
//  4. ÀS 14h, A MESMA RÁPIDA DIZ OUTRA COISA
// ==================================================================
console.log("\n4. Às 14h");
await page.clock.setFixedTime(new Date(AGORA + 5 * 3600000));
ok("a conversa da Andreia abriu de novo", await abrir("cv-var-1"));
{
  await caixa().fill("");
  const r = await escolher("Sauda", "Saudação");
  ok("\"Boa tarde, Andreia! …\"", r.caixa === "Boa tarde, Andreia! Aqui é Mariana, do escritório.", q(r.caixa));
  await caixa().fill("");
  const s = await escolher("Retor", "Retorno");
  ok("e no meio da frase, minúscula: \"Olá, boa tarde!\"", s.caixa === "Olá, boa tarde! Retornando o seu contato.",
     q(s.caixa));
  await caixa().fill("");
}

// ==================================================================
//  5. NA CONFIGURAÇÃO
// ==================================================================
console.log("\n5. Na configuração das mensagens rápidas");
async function abrirConfig(aba) {
  // PELO MENU, e não direto: o botão de Configurações mora dentro do menu ⋮.
  const menu = page.getByRole("button", { name: "Menu" });
  if (!(await menu.count())) return false;
  await menu.first().click();
  await page.waitForTimeout(300);
  const config = page.getByRole("button", { name: "Configurações" });
  if (!(await config.count())) return false;
  await config.first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: aba, exact: true }).last().click();
  await page.waitForTimeout(500);
  return true;
}
ok("a configuração das mensagens rápidas abriu", await abrirConfig("Mensagens rápidas"));
const nova = page.getByRole("button", { name: "Nova", exact: true });
if (await nova.count()) { await nova.last().click(); await page.waitForTimeout(300); }
const texto = page.locator("[data-texto-da-rapida-na-config]");
ok("o formulário de nova rápida abriu", (await texto.count()) === 1);
{
  const chaves = await page.locator("[data-variaveis-da-rapida] [data-variavel]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-variavel")));
  ok("as quatro variáveis estão à vista, num clique",
     q(chaves) === q(["saudacao", "nome", "nome_completo", "atendente"]), q(chaves));

  // A VARIÁVEL VAI ONDE ESTÁ O CURSOR: entre a vírgula e o "!", e não no fim.
  await texto.fill("Olá, !");
  await texto.evaluate((el) => { el.focus(); el.setSelectionRange(5, 5); });
  const botaoNome = page.locator('[data-variaveis-da-rapida] [data-variavel="nome"]');
  if (await botaoNome.count()) await botaoNome.click();
  await page.waitForTimeout(200);
  ok("o clique põe {nome} onde estava o cursor", (await texto.inputValue()) === "Olá, {nome}!",
     q(await texto.inputValue()));
  const previa = page.locator("[data-previa-texto]");
  ok("a prévia mostra como fica", (await previa.count()) === 1
     && (await previa.innerText()).trim() === "Olá, Maria!",
     (await previa.count()) ? q(await previa.innerText()) : "sem prévia");

  await texto.fill("{saudacao}, {nome_completo}. Sobre o {processo}");
  await page.waitForTimeout(200);
  const aviso = page.locator("[data-variavel-desconhecida]");
  ok("a variável que o Zorvin não conhece é avisada",
     (await aviso.count()) === 1 && (await aviso.innerText()).includes("{processo}"),
     (await aviso.count()) ? q(await aviso.innerText()) : "sem aviso");
  ok("e a prévia diz a hora certa e o nome inteiro",
     (await previa.count()) === 1
     && (await previa.innerText()).trim() === "Boa tarde, Maria Aparecida dos Santos. Sobre o {processo}",
     (await previa.count()) ? q(await previa.innerText()) : "sem prévia");

  await texto.fill("Texto sem variável nenhuma.");
  await page.waitForTimeout(200);
  ok("sem variável, nem prévia nem aviso", (await previa.count()) === 0 && (await aviso.count()) === 0);
}
{
  // GUARDADA COM A VARIÁVEL. A rápida é da equipe inteira: preenchida na hora
  // de salvar, ela diria o nome do cliente de exemplo para todo mundo.
  await page.locator('input[placeholder="Ex.: Saudação"]').fill("Teste do nome");
  await texto.fill("{saudacao}, {nome_completo}.");
  const salvar = page.locator("[data-salvar-rapida]");
  if (await salvar.count()) await salvar.click();
  await page.waitForTimeout(800);
  const guardada = await page.evaluate(() => (globalThis.__TABELAS.mensagens_rapidas || [])
    .filter((r) => r.titulo === "Teste do nome").map((r) => r.texto));
  ok("ela é guardada com a variável, e não preenchida",
     guardada.length === 1 && guardada[0] === "{saudacao}, {nome_completo}.", q(guardada));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("a configuração fechou", (await texto.count()) === 0);
  ok("na conversa da Andreia", await abrir("cv-var-1"));
  await caixa().fill("");
  const r = await escolher("Teste do", "Teste do nome");
  ok("a rápida nova sai preenchida para quem atende", r.caixa === "Boa tarde, Andreia Cristina Martins.", q(r.caixa));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
