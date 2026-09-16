// CLICAR NA CITAÇÃO LEVA ATÉ A MENSAGEM CITADA.
//
// PEDIDO DO RODRIGO, 16/09: "ao clicar na mensagem que foi respondida, ir para
// a mensagem". É o que o WhatsApp faz, e sem isso a citação é só uma prévia de
// 120 caracteres — bastante para lembrar do assunto, pouco para achar o que
// foi dito antes dela.
//
// O ELO JÁ ESTAVA GRAVADO: `responder_id_uazapi` guarda o id da citada desde
// que a ponte aprendeu o formato certo da Uazapi (15/09). O que faltava era o
// clique.
//
// ------------------------------------------------------------
// SÃO QUATRO CASOS, E TRÊS DELES SÓ APARECEM COM DADO DE PROPÓSITO
//
//   1. a citada está carregada  -> rola até ela e a marca;
//   2. a citada NÃO está carregada -> vai ao banco buscar as anteriores e
//      só então rola. A conversa abre com as 120 mais recentes, e responder a
//      algo de três semanas atrás aponta para fora desse pedaço;
//   3. a resposta não tem elo (gravada antes do conserto da ponte) -> não
//      finge ser botão;
//   4. o elo aponta para o nada (citada apagada) -> DIZ isso.
//
// O 4 é o que separa "não fez nada" de "não deu para fazer". Um clique mudo é
// indistinguível de um clique quebrado, e quem atende vai clicar de novo.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1600);
// A conversa das citações é a primeira da lista — é nela que a bancada planta
// as quatro respostas.
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(2200);

/** Onde está a mensagem na tela, e se está marcada. */
const ondeEsta = (id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-msg-id="${i}"]`);
  if (!el) return { existe: false };
  const r = el.getBoundingClientRect();
  // A MARCA É UM FUNDO, posto por `msgDestacada`. Ler o estilo em linha é o
  // que separa "rolou até lá" de "rolou até lá E disse qual é".
  return { existe: true, topo: Math.round(r.top),
           dentroDaJanela: r.top > 0 && r.top < window.innerHeight,
           marcada: !!el.style.background && el.style.background !== "" };
}, id);

const avisoNaTela = () => page.evaluate(() =>
  document.body.innerText.match(/Não achei a mensagem citada[^\n]*/)?.[0] || null);

// ------------------------------------------------------------------
console.log("\nAs citações aparecem, e só é botão a que tem para onde levar");
{
  const quais = await page.evaluate(() =>
    [...document.querySelectorAll("[data-citacao]")].map((e) => ({
      tag: e.tagName, leva: e.getAttribute("data-citacao-leva-a") })));
  ok("as quatro citações estão na tela", quais.length === 4, JSON.stringify(quais));
  ok("três são botão", quais.filter((q) => q.tag === "BUTTON").length === 3,
     JSON.stringify(quais));
  // A SEM ELO NÃO PODE PARECER BOTÃO. Ela existe: são as respostas gravadas
  // antes de a ponte aprender o formato da Uazapi, e elas têm prévia sem id.
  // Um bloco que parece clicável e não faz nada é pior do que um que não
  // parece.
  ok("e a que não tem elo NÃO é botão",
     quais.some((q) => q.tag === "DIV" && !q.leva), JSON.stringify(quais));
}

// ------------------------------------------------------------------
console.log("\n1. A citada que está carregada: rola até ela e a marca");
{
  const antes = await ondeEsta("m-depois-200");
  ok("a citada está na conversa, mas fora da vista",
     antes.existe && !antes.dentroDaJanela, JSON.stringify(antes));

  await page.locator('[data-citacao-leva-a="uz-m-depois-200"]').click();
  await page.waitForTimeout(1500);

  const depois = await ondeEsta("m-depois-200");
  ok("depois do clique ela está à vista", depois.dentroDaJanela, JSON.stringify(depois));
  // ROLAR SEM MARCAR NÃO RESOLVE: a tela para no meio de uma conversa e nada
  // diz qual das bolhas é a citada.
  ok("e está marcada, para saber qual é", depois.marcada, JSON.stringify(depois));
  ok("e nada de aviso de erro", await avisoNaTela() === null);
}

// ------------------------------------------------------------------
console.log("\n2. A citada de três meses atrás: vai ao banco buscá-la");
{
  // ESTA É A CONFERÊNCIA QUE MAIS IMPORTA, e a que pegou dois defeitos meus.
  //
  // A conversa abre com as 120 mensagens mais recentes; esta citada tem 200
  // mensagens depois dela, então está fora. Sem ir ao banco, o clique diria
  // "não achei" sobre uma mensagem que existe — e o painel estaria desistindo
  // em nome de quem clicou.
  const antes = await ondeEsta("m-palavra");
  ok("a citada NÃO está entre as carregadas", antes.existe === false,
     JSON.stringify(antes));

  await page.locator('[data-citacao-leva-a="uz-m-palavra"]').click();
  await page.waitForTimeout(2600);

  const depois = await ondeEsta("m-palavra");
  ok("depois do clique ela foi carregada", depois.existe, JSON.stringify(depois));
  ok("e está à vista", depois.dentroDaJanela, JSON.stringify(depois));
  ok("e marcada", depois.marcada, JSON.stringify(depois));
  ok("e sem aviso de erro", await avisoNaTela() === null);
}

// ------------------------------------------------------------------
console.log("\n3. O elo que aponta para o nada: a tela DIZ que não achou");
{
  // Um clique mudo é indistinguível de um clique quebrado. A citada pode ter
  // sido apagada — é uma resposta, e não um defeito, mas só se for dita.
  await page.locator('[data-citacao-leva-a="uz-mensagem-que-nao-existe"]').click();
  await page.waitForTimeout(1500);
  const aviso = await avisoNaTela();
  ok("a tela avisa que não achou a citada", !!aviso, `aviso: ${aviso}`);
  ok("e diz o motivo provável, em vez de só falhar",
     /apagada/i.test(aviso || ""), `aviso: ${aviso}`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
