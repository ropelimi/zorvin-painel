// "NADA ENCONTRADO" DITO ANTES DE SABER.
//
// RELATO DO ESCRITÓRIO, 14/09, com duas fotos da MESMA busca, tiradas com
// segundos de diferença:
//
//   • a primeira: "ELIANA ALVES DA SILVA" na caixa e, embaixo, "Nada
//     encontrado para essa busca.";
//   • a segunda, depois: "NO CADASTRO DO VANTORO, AINDA SEM CONVERSA POR ESTE
//     NÚMERO — ELIANA ALVES DA SILVA, (11) 96797-3545, Começar conversa".
//
// Palavras de quem usa: "Demora, mas aparece. E enquanto não aparece está
// aparecendo uma mensagem falsa."
//
// O QUE ACONTECIA. A busca tem dois tempos, de propósito: o que é do banco
// aparece de imediato e o cadastro do Vantoro chega depois — ele fica atrás da
// ponte, as duas hospedagens hibernam no plano gratuito da Render, e a primeira
// chamada depois de um tempo parado leva dezenas de segundos. Foi assim que o
// "Procurando…" eterno acabou (`busca-nao-espera-o-vantoro`).
//
// Só que o "Procurando…" saía ANTES de a segunda pergunta ter resposta:
//
//     setExtras(peneirar(tudo));
//     setBuscando(false);                          // ← a tela já se dá por pronta
//     const doCadastro = await procurarNoVantoro(…); // ← e isto ainda vai demorar
//
// Com o banco achando alguma coisa, ninguém percebe: a lista tem o que mostrar.
// Com o banco achando NADA — que é justamente o caso de quem só existe no
// cadastro — a tela fica vazia e escreve "Nada encontrado para essa busca."
//
// E "nada encontrado" é uma RESPOSTA. Quem lê conclui que o cliente não está no
// sistema e para de procurar, a segundos de ele aparecer. É o mesmo defeito que
// esta tela já teve duas vezes por outros caminhos, agora pela terceira porta: a
// tela afirma uma ausência que ela ainda não apurou.
//
// O QUE ESTE ARQUIVO VIGIA, e a ordem é a da gravidade:
//
//   1. que a frase NÃO seja dita enquanto o cadastro ainda está sendo
//      consultado — e que a tela diga, no lugar dela, o que ainda falta;
//   2. que ela CONTINUE sendo dita quando o cadastro já respondeu e não havia
//      ninguém: trocar a resposta por silêncio é outro jeito de não responder;
//   3. que a espera pelo cadastro ACABE sozinha, sempre. Um aviso de "ainda
//      procurando" que nunca sai é o "Procurando…" eterno de volta com outro
//      nome;
//   4. e que trocar de pergunta no meio não deixe o aviso da anterior de pé.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// O PRAZO DA CHAMADA AO CADASTRO, o mesmo do `ponte.js`. A seção 3 espera
// passar dele; se ele mudar lá, esta prova tem de saber.
const ESPERA_PADRAO = 30000;

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// A PESSOA QUE SÓ O CADASTRO CONHECE — a do relato. O número não é de contato
// nenhum da bancada e o nome não está em mensagem nenhuma: se ela aparecer na
// tela, foi o Vantoro que a trouxe, e por nenhum outro caminho.
const NOME = "ELIANA ALVES DA SILVA";
const TELEFONE = "(11) 96797-3545";

// COMO O VANTORO SE COMPORTA nesta rodada. Cada seção escolhe o seu.
let atrasoDoVantoro = 0;      // quanto ele demora para responder
let clientesDoVantoro = [];   // o que ele responde
let penduraDeVez = false;     // ou não responde nunca — a Render acordando
let perguntas = 0;

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (!url.pathname.endsWith("/vantoro/buscar")) {
    return rota.fulfill({ status: 200, contentType: "application/json",
                          body: JSON.stringify({ ok: true }) });
  }
  perguntas += 1;
  if (penduraDeVez) {
    // Nem responde nem recusa: fica pendurada, que é o que a Render faz
    // enquanto acorda o serviço. Mais do que o prazo do painel, de propósito.
    await new Promise((r) => setTimeout(r, ESPERA_PADRAO + 20000));
    return rota.abort();
  }
  if (atrasoDoVantoro) await new Promise((r) => setTimeout(r, atrasoDoVantoro));
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const clientes = clientesDoVantoro.filter(
    (c) => c.nome.toLowerCase().includes(q) || q.includes("eliana"));
  return rota.fulfill({ status: 200, contentType: "application/json",
                        body: JSON.stringify({ ok: true, clientes }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2000);

const caixa = page.locator('input[placeholder*="Buscar por nome"]').first();
const naTela = () => page.evaluate(() => document.body.innerText);
const dizNadaEncontrado = async () => /Nada encontrado para essa busca/i.test(await naTela());
const recado = () => page.evaluate(() => {
  const el = document.querySelector("[data-recado-da-lista]");
  return el ? { marca: el.getAttribute("data-recado-da-lista"), texto: el.innerText } : null;
});
const vendoNoCadastro = async () =>
  (await page.locator('[data-recado-da-lista="cadastro"]').count()) > 0;

async function procurar(termo) {
  await caixa.click();
  await caixa.fill("");
  await page.waitForTimeout(400);
  await caixa.fill(termo);
}

console.log("\n1. Enquanto o cadastro não respondeu, a tela não afirma que não há ninguém");
{
  // SEIS SEGUNDOS — folgado acima dos 350ms de espera da busca mais o tempo do
  // banco, e MUITO abaixo dos trinta do prazo. É essa distância que a prova
  // mede: sem o conserto, a tela escreve a frase no meio dela.
  atrasoDoVantoro = 6000;
  clientesDoVantoro = [{ id: 1, nome: NOME, telefone: TELEFONE, telefone2: "" }];
  const antes = perguntas;
  await procurar("ELIANA");

  // 2,5s: o banco já respondeu (e não achou nada), o cadastro ainda não.
  await page.waitForTimeout(2500);
  const meio = await recado();
  ok("a busca chegou a perguntar ao cadastro", perguntas > antes,
     "não perguntou — a prova não está medindo o que diz medir");

  // A CONFERÊNCIA DO RELATO. Esta é a foto número um.
  ok("a tela NÃO diz 'nada encontrado' com a pergunta ainda no ar",
     !(await dizNadaEncontrado()),
     "é a frase da foto do escritório, dita segundos antes de a ELIANA aparecer");

  // E NÃO BASTA CALAR. Uma lista vazia sem uma palavra é a mesma dúvida sem a
  // frase: quem procurou precisa saber que ainda há uma pergunta no ar.
  ok("ela diz que ainda está vendo no cadastro", meio && meio.marca === "cadastro",
     `recado: ${JSON.stringify(meio)}`);
  ok("com o nome do lugar onde procura, escrito",
     /cadastro do Vantoro/i.test((meio && meio.texto) || ""),
     `recado: ${JSON.stringify(meio)}`);

  // 8s no total: o cadastro respondeu.
  await page.waitForTimeout(6000);
  const oferta = await page.evaluate(() => {
    const el = document.querySelector("[data-comecar-conversa]");
    return el ? el.innerText : null;
  });
  ok("e quando ele responde, a pessoa aparece", !!oferta && /ELIANA/i.test(oferta),
     `oferta: ${oferta}`);
  // PELA MARCA, e não pela frase: o título da oferta é "No cadastro do
  // Vantoro, ainda sem conversa por este número" — procurar "cadastro do
  // Vantoro" no texto da página acharia o próprio acerto e chamaria de erro.
  ok("sem sobrar o aviso de que ainda está vendo", !(await vendoNoCadastro()),
     "a tela continuou dizendo que procura depois de ter achado");
}

console.log("\n2. Respondido e sem ninguém, a tela DIZ que não achou");
{
  // A OUTRA METADE, e é ela que impede o conserto de virar o defeito oposto:
  // esconder "nada encontrado" para sempre deixaria quem procurou olhando uma
  // lista vazia sem uma palavra — que é pior do que ler que não há.
  atrasoDoVantoro = 0;
  clientesDoVantoro = [];
  await procurar("ZZZZNINGUEMZZZZ");
  await page.waitForTimeout(3000);
  ok("sem ninguém em lugar nenhum, a tela responde que não achou",
     await dizNadaEncontrado(), (await naTela()).slice(0, 220));
}

console.log("\n3. O cadastro que nunca responde: a espera acaba sozinha");
{
  // A TRAVA CONTRA O DEFEITO QUE ESTE CONSERTO PODE CRIAR. Segurar a frase
  // enquanto a pergunta está no ar só é honesto se a pergunta TERMINAR. Sem
  // isto, "vendo no cadastro do Vantoro…" é o "Procurando…" eterno da foto de
  // 31/08 de volta, com outro nome — e a tela nunca mais responde nada.
  penduraDeVez = true;
  await procurar("ELIANA");
  await page.waitForTimeout(3000);
  const durante = await recado();
  ok("primeiro ela avisa que está vendo no cadastro",
     durante && durante.marca === "cadastro", JSON.stringify(durante));

  // O prazo do `fetch` é de trinta segundos; espera-se ele mais folga.
  const comeco = Date.now();
  await page.waitForSelector('[data-recado-da-lista="cadastro"]',
                             { state: "detached", timeout: ESPERA_PADRAO + 12000 })
    .then(() => ok(`a espera pelo cadastro acabou sozinha (${Math.round((Date.now() - comeco) / 1000)}s)`, true))
    .catch(() => ok("a espera pelo cadastro acabou sozinha", false,
                    "a tela ficou presa no aviso — é o 'Procurando…' eterno de volta"));

  const fim = await recado();
  ok("e a tela dá uma resposta em vez de ficar muda", !!fim && !!(fim.texto || "").trim(),
     JSON.stringify(fim));
}

console.log("\n4. Trocar de pergunta não deixa o aviso da anterior de pé");
{
  // A busca velha volta DEPOIS da nova. Se ela escrever na tela ao voltar, o
  // aviso que aparece é sobre uma pergunta que ninguém mais está fazendo.
  penduraDeVez = false;
  atrasoDoVantoro = 4000;
  clientesDoVantoro = [{ id: 1, nome: NOME, telefone: TELEFONE, telefone2: "" }];
  await procurar("ELIANA");
  await page.waitForTimeout(1500);        // a pergunta da ELIANA está no ar
  await caixa.fill("");                   // e a pessoa desiste
  await page.waitForTimeout(1200);

  ok("apagar a busca devolve a lista de conversas",
     (await page.locator("[data-conversa-nome]").count()) > 3);
  ok("e não sobra aviso de estar vendo no cadastro", !(await vendoNoCadastro()),
     JSON.stringify(await recado()));

  // E a resposta atrasada, ao chegar, não pode desenhar nada: ela responde a
  // uma pergunta desfeita.
  await page.waitForTimeout(4000);
  ok("nem quando a resposta atrasada chega",
     (await page.locator("[data-comecar-conversa]").count()) === 0
       && !(await vendoNoCadastro()),
     JSON.stringify(await recado()));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
