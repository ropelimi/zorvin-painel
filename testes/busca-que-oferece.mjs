// QUEM O VANTORO ACHA E O ZORVIN NUNCA VIU.
//
// Relato do escritório, com print: procurar "ELIANA ALVES DA SILVA" no Zorvin
// devolvia "Nada encontrado para essa busca". A ELIANA está no Vantoro — com
// telefone, três processos e vinte e um documentos —, e o print do lado mostra
// exatamente isso, o cadastro dela aberto.
//
// O QUE ACONTECIA. O Vantoro ERA consultado, e respondia certo. Com o telefone
// dele em mãos, o painel procurava a CONVERSA daquele número:
//
//     .eq("advogado_id", advId)
//
// Se a pessoa nunca escreveu para AQUELE número do escritório, não existe
// conversa nenhuma — e a busca terminava sem nada a mostrar.
//
// "Nada encontrado" era falso, e é o pior tipo de falso: uma RESPOSTA. Nós
// encontramos a pessoa; o que não temos é conversa com ela. Quem lê "não achei"
// conclui que o cliente não existe no sistema e para de procurar — quando o que
// faltava era um clique para começar a falar.
//
// E O TELEFONE VEM DO CADASTRO, que é o que dá valor ao gesto: ninguém decora o
// número do cliente. Sem isto, a saída era abrir o Vantoro, copiar o telefone,
// voltar ao Zorvin e usar "Nova conversa" — quatro passos e uma troca de aba
// para falar com alguém que o sistema já conhecia.
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

// A PESSOA QUE SÓ O VANTORO CONHECE. O número dela não é de contato nenhum da
// bancada, e o nome não está em mensagem nenhuma — se ela aparecer na tela, foi
// o cadastro que a trouxe, e por nenhum outro caminho.
const NOME = "ELIANA ALVES DA SILVA";
const TELEFONE_NO_CADASTRO = "(11) 96797-3545";
const SO_DIGITOS = "5511967973545";

// E UMA SEGUNDA, PARA A TRAVA DO SILÊNCIO: existe no Vantoro, e a conversa dela
// existe aqui. Esta NÃO pode virar oferta — oferecer "começar conversa" com
// quem já tem conversa aberta seria criar uma segunda, e aí o histórico da
// pessoa nasce partido em dois lugares.
let telefoneDeQuemJaTemConversa = "";

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (url.pathname.endsWith("/vantoro/buscar")) {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const clientes = [];
    if ("eliana alves da silva".includes(q) || q.includes("eliana")) {
      clientes.push({ id: 1, nome: NOME, telefone: TELEFONE_NO_CADASTRO, telefone2: "" });
    }
    if (q.includes("apelido") && telefoneDeQuemJaTemConversa) {
      clientes.push({ id: 2, nome: "QUEM JA TEM CONVERSA",
                      telefone: telefoneDeQuemJaTemConversa, telefone2: "" });
    }
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, clientes }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2000);

const busca = page.locator('input[placeholder*="Buscar por nome"]').first();
async function procurar(termo) {
  await busca.click();
  await busca.fill("");
  await page.waitForTimeout(400);
  await busca.type(termo, { delay: 40 });
  await page.waitForTimeout(3500);
}

console.log("\nA pessoa que só o cadastro conhece aparece, com um caminho");
{
  await procurar("ELIANA");
  const oferta = await page.evaluate(() => {
    const el = document.querySelector("[data-comecar-conversa]");
    return el ? { tel: el.getAttribute("data-comecar-conversa"), texto: el.innerText } : null;
  });

  // A CONFERÊNCIA QUE PEGA O DEFEITO. Antes, aqui a tela dizia "Nada
  // encontrado para essa busca" e mais nada.
  ok("ela aparece na busca", !!oferta, "a tela não ofereceu nada");
  ok("com o nome do cadastro", /ELIANA ALVES DA SILVA/i.test(oferta?.texto || ""), oferta?.texto);
  ok("e com o telefone que o Vantoro tem",
     /96797-3545/.test(oferta?.texto || ""), oferta?.texto);
  // O QUE O CLIQUE FAZ, ESCRITO. As outras linhas desta lista abrem uma
  // conversa que existe; esta CRIA uma. Sem dizer, as duas parecem a mesma
  // coisa — e a pessoa clica achando que vai ler o histórico.
  ok("dizendo que o clique COMEÇA uma conversa, e não abre uma que existe",
     /começar conversa/i.test(oferta?.texto || ""), oferta?.texto);

  const naTela = await page.evaluate(() => document.body.innerText);
  ok("e a tela NÃO diz mais 'nada encontrado'",
     !/Nada encontrado para essa busca/i.test(naTela),
     "encontramos a pessoa e a tela continuou dizendo que não");
}

console.log("\nClicar abre a conversa com o número do cadastro");
{
  const antes = await page.evaluate(() => (globalThis.__TABELAS.conversas || []).length);
  await page.locator("[data-comecar-conversa]").first().click();
  await page.waitForTimeout(3000);

  const criou = await page.evaluate((n) => {
    const c = (globalThis.__TABELAS.contatos || []).find((x) =>
      String(x.numero || "").replace(/\D/g, "").endsWith("967973545"));
    const conv = (globalThis.__TABELAS.conversas || []).find((x) => x.contato_id === (c && c.id));
    return { contato: !!c, conversa: !!conv, quantas: (globalThis.__TABELAS.conversas || []).length - n };
  }, antes);
  ok("o contato passa a existir no Zorvin, com o número do Vantoro", criou.contato,
     JSON.stringify(criou));
  ok("e a conversa é criada", criou.conversa, JSON.stringify(criou));
  ok("uma só, e não uma por clique", criou.quantas === 1, `criou ${criou.quantas}`);

  const aberta = await page.evaluate(() => document.querySelector("[data-lista-mensagens]") !== null);
  ok("e ela abre na tela, em vez de só entrar na lista", aberta);
}

console.log("\nE o silêncio: quem JÁ tem conversa não vira oferta");
{
  // A TRAVA CONTRA O CONSERTO QUE CONSERTA DEMAIS. Oferecer "começar conversa"
  // com quem já tem uma criaria uma segunda, e o histórico da pessoa nasceria
  // partido em dois lugares — que é o defeito mais caro que este sistema tem.
  telefoneDeQuemJaTemConversa = await page.evaluate(() => {
    const conv = (globalThis.__TABELAS.conversas || []).find((c) => c.contato && c.contato.numero);
    return conv ? conv.contato.numero : "";
  });
  ok("achei alguém com conversa para usar de contraprova", !!telefoneDeQuemJaTemConversa);

  await procurar("apelido");
  const ofertas = await page.evaluate(() =>
    document.querySelectorAll("[data-comecar-conversa]").length);
  ok("quem já tem conversa NÃO aparece como 'começar conversa'", ofertas === 0,
     `apareceram ${ofertas} oferta(s) para quem já tem conversa`);
}

console.log("\nE a busca que não acha nada continua dizendo que não achou");
{
  // A OUTRA METADE DA HONESTIDADE. Trocar "nada encontrado" por silêncio
  // deixaria quem procurou sem resposta nenhuma — e ficar olhando uma lista
  // vazia sem uma palavra é pior do que ler que não há.
  await procurar("zzzzznaoexistezzzzz");
  const naTela = await page.evaluate(() => document.body.innerText);
  ok("sem ninguém, a tela diz que não achou",
     /Nada encontrado para essa busca/i.test(naTela), naTela.slice(0, 200));
}

console.log("\nE apagar a busca tira a oferta da tela");
{
  // Deixá-la de pé faria quem apagou a busca continuar vendo "começar conversa
  // com Fulano" no alto da lista de sempre — uma sugestão sobre uma pergunta
  // que a pessoa já desfez.
  await procurar("ELIANA");
  ok("a oferta voltou", await page.locator("[data-comecar-conversa]").count() > 0);
  await busca.fill("");
  await page.waitForTimeout(1500);
  ok("e some ao limpar a caixa",
     await page.locator("[data-comecar-conversa]").count() === 0);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
