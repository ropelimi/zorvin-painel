// CLIENTE OU RÉU — a escolha do pré-cadastro.
//
// Pedido do escritório: "ao fazer o pré-cadastro do Lead pelo Zorvin, precisa
// ter a opção de cliente ou réu".
//
// O QUE ESTAVA EM JOGO. O Vantoro não tinha onde guardar o PAPEL do contato, só
// a natureza do documento, e deduzia dali: CPF virava cliente, CNPJ virava
// parte contrária. O erro ia nos dois sentidos — a empresa CLIENTE não ganhava
// ordem de serviço nenhuma, e a pessoa que é RÉU ganhava, com tarefa no pool
// para alguém do escritório trabalhar o adversário como se fosse cliente.
//
// Quem está falando com o lead é o único, em todo o sistema, que sabe a
// resposta. Esta tela é onde ela é dada, e este arquivo vigia três coisas:
//
//   1. QUE A ESCOLHA CHEGA AO VANTORO. Um par de botões bonito que não muda o
//      que sai no corpo do pedido é pior do que botão nenhum: a pessoa marca
//      "réu", vê o botão acender e conclui que resolveu.
//   2. QUE ELA NUNCA FALTA. Sem `papel` no corpo, o Vantoro volta a deduzir
//      pelo documento — o defeito de origem, de volta pela porta dos fundos.
//   3. QUE ELA NÃO GRUDA. A ficha não é remontada a cada conversa; um "réu"
//      esquecido ligado faria o próximo lead nascer sem ordem de serviço, e
//      isso não aparece em tela nenhuma.
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

// A PONTE DE MENTIRA. Aqui NENHUM número tem cadastro — é justamente o estado
// em que a tela de pré-cadastro aparece, e é o único que interessa a este
// arquivo. Cada POST fica guardado inteiro para ser conferido depois.
const criados = [];

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const req = rota.request();
  const url = new URL(req.url());
  if (url.pathname.endsWith("/vantoro/cliente") && req.method() === "POST") {
    let corpo = {};
    try { corpo = JSON.parse(req.postData() || "{}"); } catch { /* fica vazio */ }
    criados.push(corpo);
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ criado: true, cliente: {
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

// Abre a conversa de POSIÇÃO `n` da lista, e não por nome: este arquivo precisa
// de DUAS conversas diferentes para a seção 4, e o nome de cada uma depende de
// dados da bancada que podem mudar. A posição não muda o que se está medindo.
async function abrirConversa(n) {
  const linhas = page.locator("[data-conversa-nome]");
  await linhas.nth(n).click();
  await page.waitForTimeout(1200);
}
async function abrirFicha() {
  const b = page.getByRole("button", { name: /Ficha no Vantoro/ });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(1500);
}
const botaoPapel = (v) => page.locator(`[data-papel="${v}"]`);
const marcado = async (v) => (await botaoPapel(v).first().getAttribute("aria-pressed")) === "true";
async function criarPreCadastro() {
  await page.getByRole("button", { name: /Criar pré-cadastro/ }).first().click();
  await page.waitForTimeout(1200);
}

console.log("\n1. A escolha existe, e está à vista");
{
  await abrirConversa(0);
  await abrirFicha();

  // AS DUAS, E SÓ AS DUAS. Se um dia a tela virar uma lista fechada, este
  // número cai a zero e a prova reprova — que é o ponto: uma lista esconderia
  // a segunda opção atrás de um clique, e quem atende não faria a escolha por
  // não saber que ela existe.
  const quantos = await page.locator("[data-papel]").count();
  ok("os dois botões aparecem no pré-cadastro", quantos === 2, `apareceram ${quantos}`);

  const texto = await page.locator("body").innerText();
  ok("e dizem, com todas as letras, o que são",
     /Cliente/.test(texto) && /Parte contrária/i.test(texto) && /réu/i.test(texto),
     texto.slice(0, 200));

  ok('"Cliente" já vem marcado', await marcado("cliente"));
  ok("e o réu, não", !(await marcado("contraria")));

  // A CONSEQUÊNCIA ESCRITA NA TELA. "Cliente" e "parte contrária" são palavras
  // de processo, não de sistema: quem atende não tem por que adivinhar que uma
  // delas abre trabalho para o escritório e a outra não.
  ok("a tela diz o que a escolha provoca", /ordem de serviço/i.test(texto),
     "a escolha aparece sem dizer o que ela muda");
}

console.log("\n2. Marcar o réu muda a tela E o que vai para o Vantoro");
{
  await botaoPapel("contraria").first().click();
  await page.waitForTimeout(300);
  ok("o botão do réu fica marcado", await marcado("contraria"));
  ok("e o de cliente desmarca", !(await marcado("cliente")),
     "os dois acesos ao mesmo tempo — a pessoa não sabe qual vale");

  const texto = await page.locator("body").innerText();
  ok("e a tela avisa que o réu NÃO abre ordem de serviço",
     /NÃO abre ordem de serviço/i.test(texto), texto.slice(0, 300));

  // A CONFERÊNCIA QUE IMPORTA. Tudo o que veio antes é aparência; é esta linha
  // que separa "a tela mudou de cor" de "o Vantoro soube".
  const antes = criados.length;
  await criarPreCadastro();
  ok("o pré-cadastro foi mandado", criados.length === antes + 1,
     `mandou ${criados.length - antes}`);
  const corpo = criados[criados.length - 1] || {};
  ok('e o corpo do pedido leva papel="contraria"', corpo.papel === "contraria",
     `foi papel=${JSON.stringify(corpo.papel)} — corpo: ${JSON.stringify(corpo).slice(0, 200)}`);
}

console.log("\n3. Sem tocar em nada, vai 'cliente' — e não vai vazio");
{
  // A JANELA ENTRE AS PUBLICAÇÕES já é tratada do lado do Vantoro: pedido sem
  // `papel` cai na regra antiga. Mas aqui, com a tela nova no ar, um corpo sem
  // o campo seria o defeito de origem voltando pela porta dos fundos — o
  // Vantoro deduzindo pelo documento, e a empresa cliente sem ordem nenhuma.
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrirConversa(0);
  await abrirFicha();

  const antes = criados.length;
  await criarPreCadastro();
  ok("o pré-cadastro foi mandado", criados.length === antes + 1);
  const corpo = criados[criados.length - 1] || {};
  ok('sem clicar em nada, o corpo leva papel="cliente"', corpo.papel === "cliente",
     `foi papel=${JSON.stringify(corpo.papel)}`);
  ok("e o campo nunca sai do pedido", "papel" in corpo,
     `corpo: ${JSON.stringify(corpo).slice(0, 200)}`);
}

console.log("\n4. O réu de um atendimento não gruda no próximo");
{
  // O CAMINHO DE VERDADE, e não um que eu gostaria que existisse: com a ficha
  // aberta a LISTA DE CONVERSAS some da tela — a ficha ocupa o lugar dela. Quem
  // atende fecha a ficha, escolhe a próxima conversa e abre a ficha de novo.
  // É esse trajeto que está medido aqui.
  //
  // O QUE ELE TEM DE GARANTIR: cada pré-cadastro começa em "Cliente". Marcar
  // "parte contrária" para um réu e ver a marca sobrar no atendimento seguinte
  // faria o próximo lead nascer sem ordem de serviço — sem tarefa no pool e sem
  // aviso nenhum. Quem atendeu juraria ter criado um cliente.
  //
  // Hoje quem garante isso é o painel fechar a ficha a cada troca de conversa,
  // o que a desmonta inteira. A garantia é essa, e não o detalhe de como ela é
  // obtida: se um dia a ficha passar a ficar aberta entre conversas, é aqui que
  // isso aparece.
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);

  await abrirConversa(0);
  await abrirFicha();
  await botaoPapel("contraria").first().click();
  await page.waitForTimeout(300);
  ok("marquei o réu no primeiro atendimento", await marcado("contraria"));

  const fechar = page.getByRole("button", { name: "Fechar" });
  ok("a ficha tem como ser fechada", await fechar.count() > 0);
  await fechar.first().click();
  await page.waitForTimeout(700);

  await abrirConversa(1);
  await abrirFicha();
  const temEscolha = await page.locator("[data-papel]").count() === 2;
  ok("o segundo atendimento mostra a escolha", temEscolha,
     "a tela de pré-cadastro não apareceu na segunda conversa");

  if (temEscolha) {
    ok('e começa em "Cliente"', await marcado("cliente"),
       "o réu grudou do atendimento anterior");
    const antes = criados.length;
    await criarPreCadastro();
    const corpo = criados[criados.length - 1] || {};
    ok("e o que chega ao Vantoro é cliente mesmo",
       criados.length === antes + 1 && corpo.papel === "cliente",
       `foi papel=${JSON.stringify(corpo.papel)}`);
  } else {
    // NÃO CONTA COMO PASSOU. Uma seção que não conseguiu montar o cenário é uma
    // seção que não conferiu nada, e deixá-la verde é pior do que não tê-la
    // escrito.
    ok('e começa em "Cliente"', false, "cenário não montou");
    ok("e o que chega ao Vantoro é cliente mesmo", false, "cenário não montou");
  }
}

console.log("\n5. O nome e o telefone continuam indo junto");
{
  // A TRAVA CONTRA O CONSERTO QUE QUEBRA O VIZINHO. O `papel` entrou no MESMO
  // corpo de pedido que já levava nome, telefone e CPF; um erro de vírgula ali
  // deixaria o pré-cadastro nascer sem nome — e um cadastro "Sem nome" é um
  // cliente que ninguém acha na busca do Vantoro.
  const corpos = criados.filter((c) => c && c.telefone);
  ok("houve pré-cadastro para conferir", corpos.length >= 3, `foram ${criados.length}`);
  for (const c of corpos) {
    ok(`o pedido levou nome (${String(c.nome).slice(0, 22)})`,
       !!c.nome && c.nome !== "Sem nome", JSON.stringify(c).slice(0, 160));
    ok("e levou o telefone da conversa", /^\d{10,}$/.test(String(c.telefone)),
       String(c.telefone));
  }
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
