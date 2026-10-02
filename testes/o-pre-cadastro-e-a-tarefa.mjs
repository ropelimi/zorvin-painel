// O PRÉ-CADASTRO E A TAREFA "Cadastro de ações do cliente" (02/10)
//
// Pedido do Rodrigo: o pré-cadastro deixa de prometer a ordem de serviço. Quem
// atende escolhe, numa caixa DESMARCADA, se quer a tarefa "Cadastro de ações
// do cliente"; sem ela nasce só o cadastro, e a ordem abre quando a venda for
// lançada.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. a caixa existe, nasce desmarcada, e só aparece para "Cliente";
//   2. o pedido SEMPRE leva `criar_tarefa_cadastro`, true ou false — e false
//      para a parte contrária, mesmo com a caixa marcada antes de trocar;
//   3. as frases que prometiam a ordem saíram, e a de baixo acompanha a caixa;
//   4. a caixa volta desmarcada na conversa seguinte (a ficha é coluna fixa e
//      não é remontada — uma marca esquecida abriria tarefa para o próximo
//      lead sem ninguém ter pedido);
//   5. o aviso diz o que o VANTORO respondeu (`tarefa_cadastro`), e, quando a
//      pessoa já existia, manda abrir a tarefa pela ficha de lá.
//
// O AVISO É LIDO PELO FILME, e não pela foto: a faixa mostra uma frase por
// vez, e a das notas internas pode cobrir a do pré-cadastro um instante
// depois (ver "A prova precisou ver o FILME" no CLAUDE.md).
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

await page.addInitScript(() => {
  globalThis.__AVISOS_VISTOS = [];
  setInterval(() => {
    const el = document.querySelector("[data-aviso]");
    const t = el && el.innerText.trim();
    const vistos = globalThis.__AVISOS_VISTOS;
    if (t && vistos[vistos.length - 1] !== t) vistos.push(t);
  }, 50);
});

// A PONTE DE MENTIRA. Nenhum número tem cadastro — é o estado em que o
// pré-cadastro aparece. Cada POST fica guardado inteiro, e a RESPOSTA do
// próximo é escolhida pela cena (`responder`).
const criados = [];
let responder = (corpo) => ({ criado: true, tarefa_cadastro: !!corpo.criar_tarefa_cadastro });

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const req = rota.request();
  const url = new URL(req.url());
  if (url.pathname.endsWith("/vantoro/cliente") && req.method() === "POST") {
    let corpo = {};
    try { corpo = JSON.parse(req.postData() || "{}"); } catch { /* fica vazio */ }
    criados.push(corpo);
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ...responder(corpo), cliente: {
        id: `v-${criados.length}`, nome: corpo.nome, telefone: corpo.telefone,
        cpf: corpo.cpf || "", papel: corpo.papel || "",
        processos: [], ordem_servico: null } }) });
  }
  if (url.pathname.endsWith("/vantoro/cliente")) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ clientes: [], opcoes: {} }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

// POR POSIÇÃO, e não por nome: abrir a ficha renomeia a linha da conversa.
async function abrirConversa(n) {
  await page.locator("[data-conversa-nome]").nth(n).click();
  await page.waitForTimeout(1600);
}
const caixa = () => page.locator("[data-criar-tarefa]");
const temCaixa = async () => (await caixa().count()) === 1 && (await caixa().isVisible());
const marcada = async () => (await temCaixa()) && (await caixa().isChecked());
const textoDaFicha = async () => {
  const f = page.locator("[data-ficha]");
  return (await f.count()) ? f.first().innerText() : "";
};
/** Cliques GUARDADOS: num elemento que não existe, `click()` estoura a prova
 *  inteira depois de 30s, e prova que estoura não diz QUAL conferência viu o
 *  defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  await loc.first().click();
  await page.waitForTimeout(300);
  return true;
}
const papel = (v) => page.locator(`[data-papel="${v}"]`);
async function criar() {
  // O FILME COMEÇA NA FRASE QUE JÁ ESTÁ NA TELA, e ela não conta: a faixa
  // fica quatro segundos, e o aviso do pré-cadastro anterior entraria no filme
  // deste como se fosse dele.
  await page.evaluate(() => {
    const el = document.querySelector("[data-aviso]");
    globalThis.__AVISOS_VISTOS = [el ? el.innerText.trim() : ""];
  });
  const antes = criados.length;
  const clicou = await clicar(page.getByRole("button", { name: /Criar pré-cadastro/ }));
  await page.waitForTimeout(1800);
  const filme = await page.evaluate(() => globalThis.__AVISOS_VISTOS.slice(1).join(" | "));
  return { mandou: clicou && criados.length === antes + 1, corpo: criados[criados.length - 1] || {}, filme };
}

console.log("\n1. A caixa existe, desmarcada, e as promessas antigas saíram");
{
  await abrirConversa(0);
  ok("o pré-cadastro aparece", (await page.locator("[data-papel]").count()) === 2);
  ok("a caixa da tarefa aparece com Cliente escolhido", await temCaixa());
  ok("e nasce DESMARCADA", (await temCaixa()) && !(await marcada()));
  const t = await textoDaFicha();
  ok("e diz o nome da tarefa", /Criar a tarefa “Cadastro de ações do cliente”/.test(t), t.slice(0, 300));
  ok('o convite virou só "Crie o pré-cadastro"',
     /Crie o pré-cadastro/.test(t) && !/iniciar a esteira/i.test(t), t.slice(0, 300));
  ok('desmarcada, diz que nasce só o cadastro',
     /Nasce só o cadastro — a ordem abre quando a venda for lançada\./.test(t), t.slice(0, 300));
  ok('e nada mais promete "entra na esteira"', !/entra na esteira/i.test(t));
}

console.log("\n2. Desmarcada, o pedido leva false — e o aviso diz sem tarefa");
{
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok("o corpo leva criar_tarefa_cadastro", "criar_tarefa_cadastro" in r.corpo, JSON.stringify(r.corpo));
  ok("e ele é false", r.corpo.criar_tarefa_cadastro === false, JSON.stringify(r.corpo.criar_tarefa_cadastro));
  ok('junto com papel="cliente"', r.corpo.papel === "cliente");
  ok('o aviso diz "sem tarefa"', /Pré-cadastro criado no Vantoro, sem tarefa\./.test(r.filme), r.filme);
}

console.log("\n3. Marcada, a frase muda, o pedido leva true, e o aviso diz com a tarefa");
{
  await abrirConversa(1);
  ok("a outra conversa mostra o pré-cadastro", await temCaixa());
  await clicar(caixa());
  ok("a caixa marca", await marcada());
  const t = await textoDaFicha();
  ok("a frase vira a da tarefa na fila", /Abre a ordem de serviço com a tarefa na fila\./.test(t), t.slice(0, 300));
  ok("e a de só o cadastro sai", !/Nasce só o cadastro/.test(t));
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok("e o corpo leva criar_tarefa_cadastro: true", r.corpo.criar_tarefa_cadastro === true,
     JSON.stringify(r.corpo));
  ok("o aviso diz com a tarefa",
     /Pré-cadastro criado no Vantoro, com a tarefa “Cadastro de ações do cliente”\./.test(r.filme), r.filme);
}

console.log("\n4. A caixa não gruda na conversa seguinte");
{
  await abrirConversa(2);
  await clicar(caixa());
  ok("marquei a caixa nesta conversa", await marcada());
  await abrirConversa(3);
  ok("na seguinte ela aparece", await temCaixa());
  ok("e DESMARCADA", (await temCaixa()) && !(await marcada()), "a marca grudou da conversa anterior");
}

console.log("\n5. Parte contrária: a caixa some, e o pedido leva false mesmo marcada antes");
{
  await clicar(caixa());
  ok("marquei a caixa com Cliente", await marcada());
  await clicar(papel("contraria"));
  ok("com o réu a caixa some", !(await temCaixa()));
  const t = await textoDaFicha();
  ok("e a frase é a da parte contrária", /NÃO abre ordem de serviço/.test(t));
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok('papel="contraria" e criar_tarefa_cadastro: false',
     r.corpo.papel === "contraria" && r.corpo.criar_tarefa_cadastro === false, JSON.stringify(r.corpo));
}

console.log("\n6. A pessoa já existia: a tarefa não nasce por aqui, e a tela diz onde abrir");
{
  responder = () => ({ criado: false, tarefa_cadastro: false });
  await abrirConversa(4);
  await clicar(caixa());
  ok("marquei a caixa", await marcada());
  const r = await criar();
  ok("o pré-cadastro foi mandado com a tarefa pedida", r.mandou && r.corpo.criar_tarefa_cadastro === true);
  ok('o aviso diz "Já existia"', /Já existia no Vantoro\./.test(r.filme), r.filme);
  ok("e manda abrir a tarefa pela ficha no Vantoro",
     /não é criada por aqui — abra pela ficha no Vantoro/.test(r.filme), r.filme);
  ok('e não diz "com a tarefa"', !/com a tarefa/.test(r.filme), r.filme);

  // SEM TER PEDIDO, NÃO HÁ O QUE AVISAR: mandar abrir uma tarefa que ninguém
  // quis seria ruído.
  await abrirConversa(5);
  const r2 = await criar();
  ok("sem a caixa, só o já existia", r2.mandou && /Já existia no Vantoro\./.test(r2.filme)
     && !/abra pela ficha/.test(r2.filme), r2.filme);
}

console.log("\n7. Um Vantoro que não responde tarefa_cadastro: a tela não afirma nada sobre ela");
{
  responder = () => ({ criado: true });
  await abrirConversa(6);
  await clicar(caixa());
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok('não diz "com a tarefa" nem "sem tarefa"', !/com a tarefa|sem tarefa/.test(r.filme), r.filme);
  ok("e manda conferir na ficha de lá", /não disse se a tarefa foi criada/.test(r.filme), r.filme);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
