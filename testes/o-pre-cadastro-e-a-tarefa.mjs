// O PRÉ-CADASTRO E A TAREFA "Cadastro de ações do cliente" (02/10, e 24/11)
//
// 02/10: o pré-cadastro deixou de prometer a ordem de serviço, e quem atendia
// escolhia, numa caixa desmarcada, se queria a tarefa.
//
// 24/11, pedido do Rodrigo: "remova essa opção de criar a tarefa, pois essa
// tarefa só deve ser criada automaticamente após o lançamento de uma nova
// venda". As conferências da caixa foram INVERTIDAS, e não apagadas: escritas
// ao contrário, são o que impede a caixa de voltar numa limpeza futura.
//
// O QUE ESTA PROVA GUARDA:
//
//   1. a caixa não existe, nem com Cliente nem com a parte contrária, e a
//      frase de baixo diz que a tarefa nasce com a venda;
//   2. o pedido SEMPRE leva `criar_tarefa_cadastro: false`, escrito (sem a
//      chave, o Vantoro decidiria sozinho), para o cliente e para o réu;
//   3. o aviso não fala de tarefa, a não ser que o Vantoro diga que a criou
//      mesmo assim (`tarefa_cadastro: true`): aí ele diz, e manda conferir;
//   4. a pessoa que já existia: "Já existia no Vantoro.", sem falar de tarefa.
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
let responder = () => ({ criado: true, tarefa_cadastro: false });

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

console.log("\n1. A caixa da tarefa não existe, e a frase diz que a tarefa nasce com a venda");
{
  await abrirConversa(0);
  ok("o pré-cadastro aparece", (await page.locator("[data-papel]").count()) === 2);
  ok("sem a caixa da tarefa, com Cliente escolhido", (await caixa().count()) === 0);
  const t = await textoDaFicha();
  ok("e nada oferece criar a tarefa", !/Criar a tarefa/.test(t), t.slice(0, 400));
  ok('o convite continua "Crie o pré-cadastro"',
     /Crie o pré-cadastro/.test(t) && !/iniciar a esteira/i.test(t), t.slice(0, 300));
  ok("a frase diz que nasce só o cadastro, e que a ordem e a tarefa nascem com a venda",
     /Nasce só o cadastro — a ordem e a tarefa “Cadastro de ações do cliente” nascem quando a venda for lançada\./.test(t), t.slice(0, 400));
  ok('e nada promete "a tarefa na fila" nem "entra na esteira"', !/tarefa na fila/.test(t) && !/entra na esteira/i.test(t));
}

console.log("\n2. O pedido leva criar_tarefa_cadastro: false, escrito, e o aviso não fala de tarefa");
{
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok("o corpo leva criar_tarefa_cadastro", "criar_tarefa_cadastro" in r.corpo, JSON.stringify(r.corpo));
  ok("e ele é false", r.corpo.criar_tarefa_cadastro === false, JSON.stringify(r.corpo.criar_tarefa_cadastro));
  ok('junto com papel="cliente"', r.corpo.papel === "cliente");
  ok('o aviso diz "Pré-cadastro criado no Vantoro."', /Pré-cadastro criado no Vantoro\./.test(r.filme), r.filme);
  ok("e não fala de tarefa", !/tarefa/i.test(r.filme), r.filme);
}

console.log("\n3. Parte contrária: sem caixa, e o pedido também leva false");
{
  await abrirConversa(1);
  await clicar(papel("contraria"));
  ok("com o réu, sem a caixa", (await caixa().count()) === 0);
  const t = await textoDaFicha();
  ok("e a frase é a da parte contrária", /NÃO abre ordem de serviço/.test(t), t.slice(0, 300));
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok('papel="contraria" e criar_tarefa_cadastro: false',
     r.corpo.papel === "contraria" && r.corpo.criar_tarefa_cadastro === false, JSON.stringify(r.corpo));
}

console.log("\n4. A pessoa já existia: só o já existia, sem falar de tarefa");
{
  responder = () => ({ criado: false, tarefa_cadastro: false });
  await abrirConversa(2);
  const r = await criar();
  ok("o pré-cadastro foi mandado, com false", r.mandou && r.corpo.criar_tarefa_cadastro === false, JSON.stringify(r.corpo));
  ok('o aviso diz "Já existia no Vantoro."', /Já existia no Vantoro\./.test(r.filme), r.filme);
  ok("e não fala de tarefa (não há o que abrir pela ficha)", !/tarefa|abra pela ficha/i.test(r.filme), r.filme);
}

console.log("\n5. Um Vantoro que não responde tarefa_cadastro: o aviso não fala de tarefa");
{
  responder = () => ({ criado: true });
  await abrirConversa(3);
  const r = await criar();
  ok("o pré-cadastro foi mandado", r.mandou);
  ok('o aviso diz "Pré-cadastro criado no Vantoro."', /Pré-cadastro criado no Vantoro\./.test(r.filme), r.filme);
  ok("e não fala de tarefa nem manda conferir", !/tarefa|confira/i.test(r.filme), r.filme);
}

console.log("\n6. O Vantoro criou a tarefa mesmo assim: a tela diz, e manda conferir");
{
  responder = () => ({ criado: true, tarefa_cadastro: true });
  await abrirConversa(4);
  const r = await criar();
  ok("o pré-cadastro foi mandado, com false", r.mandou && r.corpo.criar_tarefa_cadastro === false, JSON.stringify(r.corpo));
  ok("o aviso diz que o Vantoro criou a tarefa, que deveria nascer só com a venda",
     /O Vantoro criou também a tarefa “Cadastro de ações do cliente”, que deveria nascer só com a venda — confira na ficha de lá\./.test(r.filme), r.filme);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
