// QUANDO O CONTATO VIRA CLIENTE, O QUE ELE JÁ TINHA ANOTADO SOBE.
//
// Enquanto alguém é só um contato, as notas internas ficam na conversa — não há
// ficha para recebê-las. No dia em que vira cliente, o que foi anotado antes é
// justamente o que alguém vai procurar na ficha: como o caso chegou, o que foi
// combinado no primeiro contato. Sem isto, esse histórico fica para trás em
// silêncio, e ninguém repara porque não há erro nenhum.
//
// TRÊS COISAS QUE ESTA PROVA NÃO DEIXA PASSAR:
//
//   1. abrir a ficha de quem JÁ é cliente não pode disparar subida nenhuma. A
//      ficha se liga ao cadastro toda vez que abre; mandar subir em todas seria
//      uma ida à rede por abertura, para uma resposta que é sempre "nenhuma".
//   2. a ponte fora do ar NÃO pode desfazer o vínculo. O vínculo é o que a
//      pessoa acabou de fazer; a subida é consequência dele.
//   3. a tela não pode ficar presa esperando a subida. A ponte hiberna no plano
//      free, e essa espera pode ser de quase um minuto.
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

// A PONTE DE MENTIRA.
const subidas = [];              // as chamadas de "sobe as notas antigas"
let PONTE_CAI = false;           // a ponte fora do ar
let PONTE_DEMORA = 0;            // a ponte hibernando
let QUANTAS_SUBIRAM = 2;

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());

  if (/\/vantoro\/contato\/[^/]+\/subir-notas$/.test(url.pathname)) {
    subidas.push(url.pathname);
    if (PONTE_DEMORA) await new Promise((r) => setTimeout(r, PONTE_DEMORA));
    if (PONTE_CAI) return rota.fulfill({ status: 502, contentType: "application/json",
      body: JSON.stringify({ erro: "o Vantoro está dormindo" }) });
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, subiram: QUANTAS_SUBIRAM, falharam: 0, jaEstavam: 0 }) });
  }

  // A BUSCA DA FICHA pelo telefone. Quem tem cadastro é achado; quem não tem
  // volta com a lista vazia, que é o estado de "ainda não é cliente".
  if (url.pathname.endsWith("/vantoro/cliente") && rota.request().method() === "GET") {
    const tel = (url.searchParams.get("telefone") || "").replace(/\D/g, "");
    const achado = CADASTROS[tel] || null;
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ clientes: achado ? [achado] : [], opcoes: {} }) });
  }

  // CRIAR O PRÉ-CADASTRO — o momento em que o contato vira cliente.
  if (url.pathname.endsWith("/vantoro/cliente") && rota.request().method() === "POST") {
    const corpo = JSON.parse(rota.request().postData() || "{}");
    const novo = { id: "v-novo", nome: corpo.nome || "Sem nome",
                   telefone: corpo.telefone, cpf: corpo.cpf || "",
                   documentos: 0, processos: [], ordem_servico: null };
    CADASTROS[String(corpo.telefone || "").replace(/\D/g, "")] = novo;
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, criado: true, cliente: novo }) });
  }

  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

const CADASTROS = {
  // A VELHA já é cliente: abrir a ficha dela não pode mandar nada subir.
  "5521977770002": { id: "v-velho", nome: "ZZ Ja Era Cliente",
                     cpf: "222.222.222-22", telefone: "5521977770002",
                     documentos: 0, processos: [], ordem_servico: null },
};

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
// Conversa SEM mensagem não entra na lista — é a "conversa fantasma", que o
// painel esconde de propósito.
ok("e o feitio de uma mensagem", !!molde?.mensagem,
   "sem ela as conversas plantadas somem como fantasmas");

const agora = Date.now();
const conversaBase = (id, contatoId, nome, numero, extra = {}) => ({
  id, contato_id: contatoId, advogado_id: molde.advogado_id,
  fixada: false, arquivada: false, favorita: false, nao_lidas: 0,
  ultima_mensagem: null, ultima_atividade: new Date(agora - 60000).toISOString(),
  frente: null, vantoro_nome: null, digitando_ate: null,
  atendendo_por: null, atendendo_em: null,
  contato: { nome, numero, foto_url: null, vantoro_nome: null, nome_zorvin: null, ...extra },
});
const mensagemBase = (id, conversaId, texto) => ({
  ...molde.mensagem, id, conversa_id: conversaId, texto,
  criado_em: new Date(agora - 90000).toISOString(),
});

const SEMENTE = {
  contatos: [
    // AINDA NÃO É CLIENTE. É dele que as notas antigas têm de subir.
    { id: "ct-novo", nome: "ZZ Vai Virar Cliente", numero: "5521977770001",
      vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null },
    // JÁ É CLIENTE. Abrir a ficha dele não pode disparar nada.
    { id: "ct-velho", nome: "ZZ Ja Era Cliente", numero: "5521977770002",
      vantoro_cliente_id: "v-velho", vantoro_nome: "ZZ Ja Era Cliente", nome_zorvin: null },
  ],
  conversas: [
    conversaBase("cv-novo", "ct-novo", "ZZ Vai Virar Cliente", "5521977770001",
                 { vantoro_cliente_id: null }),
    conversaBase("cv-velho", "ct-velho", "ZZ Ja Era Cliente", "5521977770002",
                 { vantoro_cliente_id: "v-velho", vantoro_nome: "ZZ Ja Era Cliente" }),
  ],
  mensagens: [
    mensagemBase("msg-novo", "cv-novo", "oi, preciso de ajuda"),
    mensagemBase("msg-velho", "cv-velho", "oi, tudo bem?"),
  ],
};
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.reload();
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

// A FICHA ABERTA COBRE A LISTA DE CONVERSAS. Sem fechar antes de trocar de
// conversa, o clique na linha seguinte espera para sempre por um elemento que
// existe no HTML mas não está visível — e o erro fala de "elemento não visível",
// que não diz nada sobre a ficha.
async function fecharFicha() {
  const x = page.locator('button[title="Fechar"]');
  if (await x.count()) { await x.first().click(); await page.waitForTimeout(500); }
}
async function abrir(nome) {
  await fecharFicha();
  await page.locator(`[data-conversa-nome*="${nome}"]`).first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(700);
}
// A FICHA JÁ NASCE ABERTA desde 28/09 — ela virou coluna fixa. Clicar no
// botão para "abrir" agora a RECOLHE, e as conferências seguintes mediriam
// uma coluna fora da tela. E o rótulo do botão mudou junto ("Ficha no
// Vantoro" → "Recolher a ficha"), então endereçar pelo texto deixou de achar
// qualquer coisa — em silêncio, porque o clique morava dentro de um `if`.
async function garantirFicha(page) {
  if (!(await page.locator("[data-ficha]").count())) {
    const b = page.locator("[data-abrir-ficha]");
    if (await b.count()) await b.first().click();
  }
  await page.waitForTimeout(1600);
}
const abrirFicha = () => garantirFicha(page);

console.log("\nQuem JÁ é cliente não dispara subida nenhuma");
{
  await abrir("ZZ Ja Era Cliente");
  await abrirFicha();
  ok("a ficha dele abriu", /ZZ Ja Era Cliente/i.test(await page.locator("body").innerText()));
  // ESTA É A CONFERÊNCIA DO BLOCO. A ficha se liga ao cadastro toda vez que
  // abre; sem a leitura do estado anterior, isto aqui dispararia uma subida a
  // cada abertura de ficha do escritório inteiro.
  ok("e nada foi mandado subir", subidas.length === 0,
     JSON.stringify(subidas));
}

console.log("\nCriar o cadastro faz as notas antigas subirem");
{
  await abrir("ZZ Vai Virar Cliente");
  await abrirFicha();

  const criar = page.getByRole("button", { name: /Criar pré-cadastro|Criar cadastro|pré-cadastro/i });
  ok("o botão de criar cadastro aparece para quem ainda não é cliente",
     await criar.count() >= 1, await page.locator("body").innerText());
  await criar.first().click();
  await page.waitForTimeout(2000);

  ok("as notas antigas foram mandadas subir", subidas.length === 1,
     JSON.stringify(subidas));
  // NO CONTATO CERTO. A rota da ponte recebe o id do CONTATO do Zorvin, e não o
  // do cliente do Vantoro — trocar os dois subiria as notas de outra pessoa.
  ok("no endereço do contato do Zorvin, e não do cliente do Vantoro",
     subidas[0] === "/ponte-de-mentira/vantoro/contato/ct-novo/subir-notas",
     subidas[0]);
  ok("e a tela conta quantas subiram",
     /2 notas internas/i.test(await page.locator("body").innerText()),
     "subiu em silêncio — quem cadastrou não fica sabendo que o histórico foi junto");
}

console.log("\nJá subiu uma vez: não sobe de novo");
{
  // Fecha e reabre a ficha do MESMO contato, agora já ligado. Sem esta trava,
  // cada reabertura repetiria a chamada.
  const antes = subidas.length;
  await fecharFicha();
  await page.waitForTimeout(600);
  await abrirFicha();
  await page.waitForTimeout(1600);
  ok("reabrir a ficha não manda subir de novo", subidas.length === antes,
     JSON.stringify(subidas));
}

console.log("\nSe a ponte estiver fora do ar, o vínculo NÃO se desfaz");
{
  PONTE_CAI = true;
  QUANTAS_SUBIRAM = 0;
  // Um terceiro contato, ainda sem cadastro.
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, {
    ...SEMENTE,
    contatos: [...SEMENTE.contatos,
      { id: "ct-terceiro", nome: "ZZ Terceiro Sem Ponte", numero: "5521977770003",
        vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null }],
    conversas: [...SEMENTE.conversas,
      conversaBase("cv-terceiro", "ct-terceiro", "ZZ Terceiro Sem Ponte", "5521977770003",
                   { vantoro_cliente_id: null })],
    mensagens: [...SEMENTE.mensagens,
      mensagemBase("msg-terceiro", "cv-terceiro", "oi")],
  });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);

  await abrir("ZZ Terceiro Sem Ponte");
  await abrirFicha();
  const criar = page.getByRole("button", { name: /Criar pré-cadastro|Criar cadastro|pré-cadastro/i });
  await criar.first().click();
  await page.waitForTimeout(2200);

  const naTela = await page.locator("body").innerText();
  // O CADASTRO É O QUE IMPORTA. Se a subida das notas derrubasse o vínculo, a
  // pessoa teria criado o cliente e ficado sem ele por causa de um serviço de
  // terceiro que estava dormindo.
  ok("o cadastro foi criado assim mesmo", /criado|já existia/i.test(naTela),
     naTela.slice(0, 300));
  ok("e a tela não acusa erro de nota, que confundiria com falha do cadastro",
     !/não subiu|erro ao subir/i.test(naTela), naTela.slice(0, 300));
  PONTE_CAI = false;
}

console.log("\nA tela não fica presa esperando a subida");
{
  // A ponte hiberna no plano free: a primeira chamada pode levar quase um
  // minuto. Segurar a ficha nessa espera transformaria uma consequência num
  // obstáculo — a pessoa quer ver o cadastro pronto.
  PONTE_DEMORA = 6000;
  QUANTAS_SUBIRAM = 1;
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, {
    ...SEMENTE,
    contatos: [...SEMENTE.contatos,
      { id: "ct-quarto", nome: "ZZ Quarto Ponte Lenta", numero: "5521977770004",
        vantoro_cliente_id: null, vantoro_nome: null, nome_zorvin: null }],
    conversas: [...SEMENTE.conversas,
      conversaBase("cv-quarto", "ct-quarto", "ZZ Quarto Ponte Lenta", "5521977770004",
                   { vantoro_cliente_id: null })],
    mensagens: [...SEMENTE.mensagens,
      mensagemBase("msg-quarto", "cv-quarto", "oi")],
  });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);

  await abrir("ZZ Quarto Ponte Lenta");
  await abrirFicha();
  const criar = page.getByRole("button", { name: /Criar pré-cadastro|Criar cadastro|pré-cadastro/i });
  const partiu = Date.now();
  await criar.first().click();
  // Espera CURTA de propósito: bem menos do que a demora da ponte. Se a tela
  // esperasse a subida, o cadastro ainda não estaria na tela aqui.
  await page.waitForTimeout(2000);
  const levou = Date.now() - partiu;
  const naTela = await page.locator("body").innerText();
  ok("o cadastro aparece antes de a subida terminar",
     /criado|já existia/i.test(naTela),
     `levou ${levou}ms e a tela ainda não mostrava o cadastro`);
  PONTE_DEMORA = 0;
}

console.log("\nE nada disso estourou no caminho");
ok("sem erro de JavaScript", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
