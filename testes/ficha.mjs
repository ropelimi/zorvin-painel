// A FICHA DO CLIENTE — a coluna que mostra o cadastro do Vantoro ao lado da
// conversa.
//
// Ela nunca tinha sido exercitada: a bancada não tem ponte, então `chamarPonte`
// desistia na primeira linha e a tela passava no teste MOSTRANDO A MENSAGEM DE
// ERRO. Aqui o endereço da ponte existe e quem responde por ele é este teste,
// interceptando a rede — o código do painel roda inteiro, sem saber.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const PAGINA = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Dois clientes bem diferentes, para não haver dúvida sobre qual apareceu.
// A senha do SERASA está aqui de propósito: é o tipo de dado que esta tela
// mostra, e trocar um cliente pelo outro não é um detalhe de layout.
const CLIENTES = {
  // A ANDREIA TEM DOIS NÚMEROS. É o caso do botão "conversar por este número",
  // e os dois estão escritos de jeitos DIFERENTES de propósito: o principal
  // como o WhatsApp manda, o segundo como uma pessoa digita. Se a comparação
  // fosse por texto, este cadastro sozinho já quebraria tudo.
  "5567992183107": { id: "v-100", nome: "ANDREIA CRISTINA MARTINS",
                     cpf: "111.111.111-11", senha_serasa: "senha-da-andreia",
                     telefone: "5567992183107", telefone2: "(67) 99888-7777",
                     documentos: 3, processos: [], ordem_servico: null },
  "5567991110001": { id: "v-200", nome: "MARIA DAS GRACAS PEREIRA",
                     cpf: "222.222.222-22", senha_serasa: "senha-da-maria",
                     documentos: 1, processos: [], ordem_servico: null },
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// A PONTE DE MENTIRA. A ficha do primeiro cliente demora; a do segundo é
// instantânea. É essa diferença que revela quem escreve por último.
let SEM_PENDENCIAS = false;
// O CADASTRO COM UM NÚMERO SÓ — o da imensa maioria dos clientes. É o estado
// em que NENHUM botão deve aparecer, e ele merece interruptor próprio porque
// a diferença entre "não tem outro número" e "tem" é a coisa toda.
let UM_NUMERO_SO = false;
const pedidos = [];
await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  pedidos.push(url.pathname + url.search);
  if (url.pathname.endsWith("/vantoro/cliente")) {
    const tel = (url.searchParams.get("telefone") || "").replace(/\D/g, "");
    let achado = CLIENTES[tel];
    // Uma ordem de serviço SEM a lista de pendências: é uma forma que o Vantoro
    // pode mandar, e a tela precisa aguentar.
    if (achado && SEM_PENDENCIAS) achado = { ...achado, ordem_servico: { status: "EM ANDAMENTO" } };
    if (achado && UM_NUMERO_SO) achado = { ...achado, telefone2: "" };
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ clientes: achado ? [achado] : [], opcoes: {} }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(PAGINA);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

async function abrir(nomeDaConversa) {
  await page.locator(`[data-conversa-nome*="${nomeDaConversa}"]`).first().click();
  await page.waitForTimeout(1200);
}
async function abrirFicha() {
  const b = page.getByRole("button", { name: /Ficha no Vantoro/ });
  if (await b.count()) await b.first().click();
  await page.waitForTimeout(1500);
}
const textoDaFicha = () => page.locator('input[value], div').first().evaluate(() => document.body.innerText);

console.log("\n1. A ficha mostra o cadastro");
{
  await abrir("Deus");
  await abrirFicha();
  const texto = await page.locator("body").innerText();
  ok("a ficha traz o cliente deste número",
     /ANDREIA CRISTINA MARTINS/i.test(texto),
     `pedidos: ${JSON.stringify(pedidos.slice(-2))}`);
}

console.log("\n2. Uma ordem de serviço sem pendências não derruba a tela");
// ------------------------------------------------------------------
// `cliente.ordem_servico.pendencias.length` — sem conferir se `pendencias`
// existe. O Vantoro manda a ordem de serviço; se um dia mandar uma sem a lista
// (ou com ela nula), isto estoura. E no React 18 um erro assim não mostra
// mensagem nenhuma: ele MATA a árvore onde aconteceu. A ficha inteira some, e
// o que sobra é uma coluna em branco ao lado da conversa.
{
  SEM_PENDENCIAS = true;
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  const antes = erros.length;
  await abrir("Deus");
  await abrirFicha();
  const texto = await page.locator("body").innerText();
  ok("a ficha continua de pé",
     /ANDREIA CRISTINA MARTINS/i.test(texto) && erros.length === antes,
     erros.slice(antes).join(" | ").slice(0, 160) || "a ficha sumiu da tela");
  SEM_PENDENCIAS = false;
}

console.log("\n3. O que foi digitado não se perde sem aviso");
// ------------------------------------------------------------------
// A ficha é um formulário com CPF, endereço, nascimento, senhas. Fechar
// descartava tudo o que tinha sido digitado, calado. Quem preencheu meia ficha
// e tocou no X sem querer perdia o trabalho e não recebia nem um aviso.
{
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();

  // Pelo NOME do campo, e não pela posição na página: a posição muda com
  // qualquer mexida de layout, e um teste que quebra por isso não está medindo
  // nada.
  const cpf = page.locator('[data-campo="cpf"]');
  if (await cpf.count()) {
    await cpf.fill("999.888.777-66");
    await page.waitForTimeout(300);
    let perguntou = false;
    page.once("dialog", (d) => { perguntou = true; d.dismiss(); });
    const fechar = page.getByRole("button", { name: "Fechar" });
    if (await fechar.count()) await fechar.first().click();
    await page.waitForTimeout(900);
    const aindaAberta = await page.getByRole("button", { name: /Salvar no Vantoro/ }).count() > 0;
    ok("fechar a ficha com alteração não gravada pergunta antes",
       perguntou && aindaAberta,
       perguntou ? "perguntou, mas fechou assim mesmo"
                 : "fechou e levou junto o que tinha sido digitado, sem perguntar nada");
  } else {
    ok("fechar a ficha com alteração não gravada pergunta antes", false, "campo não encontrado");
  }
}

console.log("\n4. Sem nada digitado, fechar é fechar");
{
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();
  let perguntou = false;
  page.once("dialog", (d) => { perguntou = true; d.accept(); });
  const fechar = page.getByRole("button", { name: "Fechar" });
  if (await fechar.count()) await fechar.first().click();
  await page.waitForTimeout(900);
  const fechou = await page.getByRole("button", { name: /Salvar no Vantoro/ }).count() === 0;
  ok("sem alteração, fechar não pergunta nada", fechou && !perguntou,
     perguntou ? "perguntou sem haver o que perder — vira um aviso que se aprende a ignorar"
               : "a ficha não fechou");
}

console.log("\n5. O cliente com dois números pode ser chamado pelo outro");
// ------------------------------------------------------------------
// Pedido de quem administra: "quando um contato tem dois números, precisa ter
// a opção de conversar com o cliente pelo outro telefone".
//
// Antes, o caminho era sair da conversa, abrir "Novo contato", copiar o número
// da ficha e colar. Quatro passos para uma coisa que a ficha já sabia — e cada
// digitação à mão é uma chance de criar o contato com o número torto, que é
// como nasce conversa duplicada.
{
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();

  // O BOTÃO MUDOU DE LUGAR, e o que ele protege é o mesmo.
  //
  // Ele ficava num bloco à parte (`[data-outros-numeros]`), desenhado dentro do
  // campo "Outro WhatsApp". Esse campo virou a LISTA de telefones — com dono,
  // principal e o aviso de "está em N cadastros" —, e o botão passou a viver
  // dentro de cada linha dela.
  //
  // A troca de lugar não é enfeite: o bloco antigo lia só `telefone` e
  // `telefone2`, então o TERCEIRO número em diante nunca teria botão. Agora
  // todo número da lista tem o seu.
  //
  // Foi esta conferência que pegou o sumiço quando eu substituí o campo pela
  // lista e esqueci de trazer o botão junto.
  const botoes = page.locator("[data-conversar-por]");
  ok("aparece o botão do outro número", await botoes.count() === 1,
     `apareceram ${await botoes.count()}`);

  // O NÚMERO FICA À VISTA DE QUEM VAI CLICAR, e é isto que a conferência
  // protege — não o texto do botão.
  //
  // Antes o número era escrito DENTRO do botão ("Conversar por (67)
  // 99888-7777"), porque ele vivia num bloco solto, longe de qualquer número.
  // Agora o botão mora na LINHA daquele número, com ele em negrito logo acima:
  // repetir o número dentro do botão diria a mesma coisa duas vezes na mesma
  // linha.
  //
  // O que não pode mudar é a garantia: "conversar pelo outro número" sem
  // mostrar QUAL obrigaria a pessoa a confiar que o sistema escolheu certo — e
  // o cadastro com dois números errados é justamente o que mais precisa de
  // conferir antes de clicar. Por isso a leitura passa a ser da linha inteira.
  const linha = page.locator('[data-telefone-do-cliente]').filter({ has: botoes.first() });
  const texto = (await linha.first().innerText()).replace(/\s+/g, " ").trim();
  ok("e o número está à vista, na mesma linha do botão",
     /\(67\) 99888-7777/.test(texto), `a linha dizia: "${texto}"`);

  // A CONFERÊNCIA QUE IMPORTA: o número vai para o clique na forma canônica,
  // com o 55 — e não como está escrito no cadastro. Gravar "67998887777" faria
  // a ponte não achar o contato quando a pessoa respondesse, e a resposta
  // apareceria numa segunda conversa.
  const cru = await botoes.first().getAttribute("data-conversar-por");
  ok("na forma que o WhatsApp usa, com o 55", cru === "5567998887777", `ficou "${cru}"`);
}

console.log("\n6. E clicar abre mesmo a conversa com o outro número");
{
  await page.locator("[data-conversar-por]").first().click();
  await page.waitForTimeout(2000);

  // O contato tem de ter sido criado com o número canônico, e ligado à MESMA
  // ficha do Vantoro — é o mesmo cliente, e sem o vínculo a ficha do outro
  // número abriria em branco.
  const criado = await page.evaluate(() => {
    const t = globalThis.__TABELAS && globalThis.__TABELAS.contatos;
    return (t || []).find((c) => String(c.numero) === "5567998887777") || null;
  });
  ok("o contato do outro número foi criado", !!criado, JSON.stringify(criado));
  ok("com o nome do cadastro, e não um número seco",
     /ANDREIA/i.test(String(criado && criado.nome)), String(criado && criado.nome));
  ok("e ligado à mesma ficha do Vantoro",
     String(criado && criado.vantoro_cliente_id) === "v-100",
     String(criado && criado.vantoro_cliente_id));

  const conversa = await page.evaluate(() => {
    const cont = (globalThis.__TABELAS.contatos || [])
      .find((c) => String(c.numero) === "5567998887777");
    if (!cont) return null;
    return (globalThis.__TABELAS.conversas || [])
      .find((c) => String(c.contato_id) === String(cont.id)) || null;
  });
  ok("e a conversa com ele existe", !!conversa, JSON.stringify(conversa));
}

console.log("\n7. Quem tem um número só não vê botão nenhum");
{
  // A MAIORIA DOS CADASTROS. Um botão que aparece sempre — às vezes oferecendo
  // o número da própria conversa — vira ruído, e ruído se aprende a ignorar
  // junto com o que importa.
  //
  // O MESMO cadastro da seção 5, com o segundo número apagado: assim a única
  // diferença entre ver o botão e não ver é o dado, e não a conversa, o
  // telefone do escritório ou o caminho até a tela.
  UM_NUMERO_SO = true;
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();
  const texto = await page.locator("body").innerText();
  ok("a ficha abriu do mesmo jeito", /ANDREIA CRISTINA MARTINS/i.test(texto),
     texto.slice(0, 120));
  ok("e agora não oferece conversar por outro número",
     await page.locator("[data-conversar-por]").count() === 0);
  UM_NUMERO_SO = false;
}

console.log("\n8. E o próprio número da conversa nunca vira 'o outro'");
{
  // A ARMADILHA DO CADASTRO REAL: o mesmo aparelho escrito de dois jeitos nos
  // dois campos. Sem comparar por chave, a ficha ofereceria com toda a cara de
  // certo abrir a conversa em que a pessoa já está.
  await page.route("**/ponte-de-mentira/vantoro/cliente*", async (rota) => {
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      clientes: [{ id: "v-100", nome: "ANDREIA CRISTINA MARTINS",
                   // O MESMO aparelho, escrito da forma mais traiçoeira que
                   // existe: um com o 55 e o nono dígito, o outro sem nenhum
                   // dos dois — que é como o WhatsApp devolve conta antiga.
                   // Dígito por dígito, "5567992183107" e "6792183107" não têm
                   // nada a ver um com o outro.
                   telefone: "5567992183107", telefone2: "(67) 9218-3107",
                   processos: [], ordem_servico: null }],
      opcoes: {} }) });
  });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrir("Deus");
  await abrirFicha();
  ok("os dois campos com o mesmo número não geram botão",
     await page.locator("[data-conversar-por]").count() === 0,
     "ofereceu abrir a conversa em que a pessoa já está");
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
