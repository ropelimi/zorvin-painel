// A NOTA INTERNA COM PROCESSO.
//
// A equipe escreve a nota dentro da conversa, que é onde ela está quando
// descobre o que precisa anotar. Mas quem for procurar aquilo meses depois vai
// à ficha do cliente, ou ao histórico do processo. Então a nota sobe.
//
// O VÍNCULO É SEMPRE COM O CLIENTE. O processo é opcional e serve para achar a
// informação depois — a "nota geral" é o caso comum, e é o que acontece quando
// ninguém escolhe nada.
//
// DUAS COISAS QUE ESTA PROVA NÃO DEIXA PASSAR:
//
//   1. contato SEM cadastro no Vantoro não pode nem ver o seletor. Não há
//      processo a escolher, e um seletor vazio é uma pergunta sem resposta
//      possível — a nota dele fica na conversa, que é o certo.
//   2. a nota tem de ser salva ANTES de subir. Se a subida derrubasse a nota,
//      o que a pessoa escreveu se perderia porque um serviço de terceiro
//      estava fora do ar.
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

// A PONTE DE MENTIRA. Guarda o que recebeu: é o que prova que a nota subiu com
// o processo certo, e não só que a tela não quebrou.
const subiram = [];
let PONTE_CAI = false;
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (/\/vantoro\/cliente\/[^/]+\/nota$/.test(url.pathname)) {
    if (PONTE_CAI) return rota.fulfill({ status: 502, contentType: "application/json",
      body: JSON.stringify({ erro: "o Vantoro está dormindo" }) });
    let corpo = null;
    try { corpo = JSON.parse(rota.request().postData() || "null"); } catch (_) { /* deixa nulo */ }
    subiram.push({ caminho: url.pathname, corpo });
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, atividade: { id: 55 } }) });
  }
  // A ficha do cliente, com os processos que o seletor vai listar.
  if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, cliente: { id: "v-900", nome: "ZZ Cliente",
        processos: [
          { id: 11, numero: "0001111-11.2026.8.26.0100", tipo_acao: "Trabalhista" },
          { id: 22, numero: "0002222-22.2026.8.26.0100", tipo_acao: "Cível" },
        ] } }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

// O feitio das linhas de verdade, para as plantadas desenharem igual.
const molde = await page.evaluate(() => {
  const id = document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id");
  const c = globalThis.__TABELAS.conversas.find((x) => String(x.id) === String(id));
  const m = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
  return c ? { advogado_id: c.advogado_id, mensagem: m || null } : null;
});
ok("aprendi o feitio da conversa na amostra", !!molde?.advogado_id);
// E O FEITIO DA MENSAGEM, porque conversa SEM mensagem não entra na lista —
// é a "conversa fantasma", que o painel esconde de propósito. Plantar a
// conversa sem plantar uma mensagem faria esta prova procurar uma linha que o
// próprio painel decidiu não desenhar.
ok("e o feitio de uma mensagem", !!molde?.mensagem,
   "sem ela as conversas plantadas somem como fantasmas");

const mensagemBase = (id, conversaId, texto) => ({
  ...molde.mensagem, id, conversa_id: conversaId, texto,
  criado_em: new Date(Date.now() - 90000).toISOString(),
});

const agora = Date.now();
const conversaBase = (id, contatoId, nome, numero, contatoExtra = {}) => ({
  id, contato_id: contatoId, advogado_id: molde.advogado_id,
  fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
  ultima_mensagem: null, ultima_atividade: new Date(agora - 60000).toISOString(),
  frente: null, vantoro_nome: null, digitando_ate: null,
  atendendo_por: null, atendendo_em: null,
  contato: { nome, numero, foto_url: null, ...contatoExtra },
});

const SEMENTE = {
  contatos: [
    // COM cadastro no Vantoro — vê o seletor.
    { id: "ct-cli", nome: "ZZ Com Cadastro", numero: "5521977660001",
      vantoro_cliente_id: "v-900", vantoro_nome: null, nome_zorvin: null },
    // SEM cadastro — não vê nada, e a nota fica só na conversa.
    { id: "ct-sem", nome: "ZZ Sem Cadastro", numero: "5521977660002",
      vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null },
  ],
  conversas: [
    conversaBase("nota-cli", "ct-cli", "ZZ Com Cadastro", "5521977660001",
                 { vantoro_cliente_id: "v-900", vantoro_nome: null, nome_zorvin: null }),
    conversaBase("nota-sem", "ct-sem", "ZZ Sem Cadastro", "5521977660002",
                 { vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null }),
  ],
  mensagens: [
    mensagemBase("msg-nota-cli", "nota-cli", "oi, tudo bem?"),
    mensagemBase("msg-nota-sem", "nota-sem", "oi, tudo bem?"),
  ],
};
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

async function abrir(nome) {
  await page.locator(`[data-conversa-nome*="${nome}"]`).first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(600);
}
const botaoNota = () => page.locator('button[title*="nota interna"]');
const seletor = () => page.locator("[data-processo-da-nota] select");

// GARANTE o modo nota, em vez de alternar às cegas.
//
// Depois de enviar uma nota o modo CONTINUA ligado — e o botão troca de título
// ("Voltar para mensagem normal"). Um clique cego ali desligaria o modo em vez
// de ligar, e a conferência seguinte falaria de outro assunto.
async function entrarNoModoNota() {
  const ligar = page.locator('button[title*="nota interna"]');
  if (await ligar.count()) {
    await ligar.first().click();
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(300);
}

async function escrever(texto) {
  const caixa = page.locator("textarea, [contenteditable=true]").first();
  await caixa.click();
  await caixa.fill(texto);
  await page.waitForTimeout(200);
  await caixa.press("Enter");
  await page.waitForTimeout(1200);
}

console.log("\nQuem TEM cadastro no Vantoro escolhe o processo");
{
  await abrir("ZZ Com Cadastro");
  await entrarNoModoNota();
  ok("o seletor de processo aparece", await seletor().count() === 1,
     "sem ele, a escolha simplesmente não existe na tela");

  const opcoes = await seletor().locator("option").allInnerTexts();
  ok("a primeira opção é a NOTA GERAL, escrita por extenso",
     /geral/i.test(opcoes[0] || ""), JSON.stringify(opcoes));
  ok("e ela vem escolhida por padrão",
     (await seletor().inputValue()) === "",
     "o padrão tem de ser sem processo — é o caso comum");
  ok("os processos do cliente estão na lista",
     opcoes.join(" ").includes("0001111-11") && opcoes.join(" ").includes("0002222-22"),
     JSON.stringify(opcoes));
}

console.log("\nA nota geral sobe sem processo");
{
  await escrever("Cliente vai viajar em marco");
  const ultima = subiram[subiram.length - 1];
  ok("subiu para o Vantoro", !!ultima, JSON.stringify(subiram));
  ok("no endereço do CLIENTE — o vínculo é sempre com ele",
     /\/vantoro\/cliente\/v-900\/nota$/.test(ultima?.caminho || ""), ultima?.caminho);
  ok("sem processo, manda null e não inventa um",
     ultima?.corpo?.processo_id === null, JSON.stringify(ultima?.corpo));
  ok("levando o texto", /viajar/.test(ultima?.corpo?.texto || ""));
  ok("e o id da nota, que é o elo entre os dois sistemas",
     !!ultima?.corpo?.id, "sem ele, editar cria uma segunda em vez de reescrever");
}

console.log("\nCom processo escolhido, ele vai junto — e aparece na conversa");
{
  await entrarNoModoNota();
  await seletor().selectOption("22");
  await escrever("Combinado: entrar com o recurso");

  const ultima = subiram[subiram.length - 1];
  ok("o processo escolhido chega ao Vantoro", String(ultima?.corpo?.processo_id) === "22",
     JSON.stringify(ultima?.corpo));

  // A ESCOLHA TEM DE APARECER NA CONVERSA. Sem isto ela existiria no banco e no
  // Vantoro, e a tela onde a equipe lê não diria de qual ação se está falando.
  const marca = page.locator("[data-nota-processo]");
  ok("e a bolha da nota mostra o processo", await marca.count() >= 1,
     "a escolha ficou invisível para quem lê a conversa");
  ok("com o número, e não com o id",
     /0002222-22/.test((await marca.last().innerText()) || ""),
     await marca.last().innerText().catch(() => "sem a marca"));
}

console.log("\nA escolha NÃO gruda na próxima nota");
{
  // Uma escolha que sobrevive faria a nota seguinte entrar no processo
  // anterior sem ninguém ter pedido — no histórico do processo errado.
  await entrarNoModoNota();
  ok("o seletor volta para a nota geral", (await seletor().inputValue()) === "",
     `ficou em "${await seletor().inputValue()}"`);
}

console.log("\nQuem NÃO tem cadastro não vê seletor nenhum");
{
  await abrir("ZZ Sem Cadastro");
  await entrarNoModoNota();
  ok("nenhum seletor de processo", await seletor().count() === 0,
     "seletor vazio é uma pergunta sem resposta possível");

  const antes = subiram.length;
  await escrever("Nota de quem ainda nao e cliente");
  await page.waitForTimeout(600);
  ok("e a nota NÃO sobe para o Vantoro", subiram.length === antes,
     "não há ficha para receber — ela fica na conversa, que é o certo");
}

console.log("\nSe o Vantoro estiver fora do ar, a nota NÃO se perde");
{
  // É o ponto todo da ordem: gravar primeiro, subir depois. Desfazer a nota
  // por causa de um serviço de terceiro seria apagar o que a pessoa escreveu.
  PONTE_CAI = true;
  await abrir("ZZ Com Cadastro");
  await entrarNoModoNota();
  await escrever("Esta tem de sobreviver");
  await page.waitForTimeout(1200);

  const naTela = await page.evaluate(() => document.body.innerText);
  ok("a nota continua na conversa", /Esta tem de sobreviver/.test(naTela),
     "a nota sumiu porque o Vantoro estava dormindo");
  ok("e o aviso diz o que não aconteceu",
     /não subiu|nao subiu/i.test(naTela), "sumiu em silêncio");
  PONTE_CAI = false;
}

console.log("\nE nada disso estourou no caminho");
ok("sem erro de JavaScript", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
