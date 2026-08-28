// O NÚMERO QUE NÃO TEM COMO RECEBER É DITO ANTES DE ESCREVER.
//
// DE ONDE ISTO VEIO. Uma varredura dos 238 envios que falharam no banco do
// escritório. Tirando o erro passageiro, o que sobrou foram duas coisas — e as
// duas são visíveis no próprio número, sem perguntar nada a ninguém:
//
//   16 celulares gravados na forma antiga, sem o nono dígito. "553189271231" é
//      o 31 8927-1231; o WhatsApp só conhece "5531989271231". Cada um desses é
//      um cliente que nunca recebeu nada.
//
//    8 telefones FIXOS — dois deles escritórios parceiros. Fixo não tem
//      WhatsApp, e insistir não ajuda.
//
// O QUE ISSO CUSTAVA: 26 tentativas para o mesmo número em nove dias, 16 para
// outro, 16 para um terceiro. Ninguém lia a bolha vermelha — ela fica lá
// embaixo, no fim de uma conversa longa, e chega DEPOIS de a pessoa escrever e
// mandar. Cada envio parecia o primeiro porque nada na tela dizia o contrário.
//
// A tarja fica onde o olho passa ANTES de digitar, e diz o que fazer em vez do
// que houve.
//
// E O NÚMERO CORRIGIDO É MOSTRADO, NÃO USADO. A ponte poderia tentar sozinha
// com o 9 inserido e resolver os 16 casos sem ninguém mexer — mas isso é mandar
// mensagem de cliente para um número que ninguém digitou, e o 9 nem sempre
// acerta a mesma pessoa. Quem confere na ficha é gente.
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
await page.waitForTimeout(1800);

/** Abre uma conversa pelo nome do contato e devolve o que a tarja diz. */
async function abrir(nome) {
  // PELA BUSCA, e não rolando a lista. As conversas dos números ruins são
  // antigas de propósito (para não empurrar as outras provas para baixo), então
  // elas moram lá no fim.
  await page.fill('input[placeholder*="Buscar por nome"]', nome);
  await page.waitForTimeout(1400);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1600);
  return page.evaluate(() => {
    const el = document.querySelector("[data-numero-nao-recebe]");
    return el ? { tipo: el.getAttribute("data-tipo"), texto: el.innerText } : null;
  });
}

console.log("\nO celular gravado sem o nono dígito");
{
  const t = await abrir("Alcides");
  ok("a tarja aparece", !!t, "nenhuma tarja na conversa");
  ok("e diz que o número está na forma antiga", t?.tipo === "sem-nono", `veio ${t?.tipo}`);
  // SEM AFIRMAR O QUE NÃO SE SABE. A primeira redação dizia "o WhatsApp só
  // conhece (31) 98927-1231" — uma afirmação forte, e falsa: contas antigas
  // continuam atendendo na forma antiga. A tarja diz o que é verificável.
  ok("sem afirmar que o WhatsApp não conhece o número",
     !/só conhece/i.test(t?.texto || ""), t?.texto);
  // O NÚMERO CERTO NA TELA. Sem ele a tarja só reclama: quem atende teria de
  // saber de cor a regra do nono dígito para fazer alguma coisa com o aviso.
  ok("mostrando o número certo, pronto para conferir na ficha",
     /98927-1231/.test(t?.texto || ""), t?.texto);
  ok("e o número como está hoje, para a pessoa reconhecer qual é",
     /\(31\) 8927-1231/.test(t?.texto || ""), t?.texto);
  ok("e manda conferir na ficha, em vez de só constatar",
     /ficha do cliente/i.test(t?.texto || ""), t?.texto);
}

console.log("\nO telefone fixo");
{
  const t = await abrir("PG Advogados");
  ok("a tarja aparece", !!t, "nenhuma tarja na conversa");
  ok("e diz que é fixo", t?.tipo === "fixo", `veio ${t?.tipo}`);
  // "FIXO NÃO RECEBE WHATSAPP" TAMBÉM ERA FALSO — o WhatsApp Business roda em
  // fixo, e os dois casos do banco são escritórios parceiros, que é justamente
  // quem usa isso.
  ok("explicando que fixo só recebe pelo WhatsApp Business",
     /WhatsApp Business/i.test(t?.texto || ""), t?.texto);
  // A TRAVA QUE IMPORTA AQUI: pôr um 9 num fixo inventa um número que não
  // existe, e mandaria alguém ligar para o nada.
  ok("e NÃO sugere pôr um 9 nele", !/3038-3888/.test((t?.texto || "").replace(/\(11\) 3038-3888/, "")),
     t?.texto);
}

console.log("\nO DDD que não existe");
{
  const t = await abrir("Fontana");
  ok("a tarja aparece", !!t, "nenhuma tarja na conversa");
  ok("e aponta o DDD, sem tentar consertar", t?.tipo === "ddd", `veio ${t?.tipo}`);
  ok("dizendo qual é", /04/.test(t?.texto || ""), t?.texto);
}

console.log("\nE o silêncio, que é metade do valor");
{
  // FRANCISCO VIEIRA DA SILVA, 26 tentativas na varredura: o número está
  // PERFEITO — ele é que não tem WhatsApp. Isso o número não conta, e a tela
  // não deve fingir que conta.
  //
  // Uma tarja que aparece em número bom é uma tarja que se aprende a pular, e
  // aí ela não serve para os 24 casos em que era para servir.
  const t = await abrir("Francisco");
  ok("número bem escrito não ganha tarja nenhuma", t === null,
     `apareceu: ${JSON.stringify(t)}`);

  // O CASO QUE VEIO DO ESCRITÓRIO, e é o mais importante desta prova.
  //
  // "Dias Costa Advogados", (31) 8418-0018: doze dígitos, forma antiga — e a
  // conversa FUNCIONA, com mensagens indo e voltando desde julho. A primeira
  // versão da tarja anunciava em âmbar "falta o nono dígito, o WhatsApp só
  // conhece (31) 98418-0018", com a prova do contrário logo abaixo, na mesma
  // tela: quatro mensagens do cliente e duas nossas com dois tiques.
  //
  // A premissa estava errada. Doze dígitos não é prova de que o número não
  // recebe: contas antigas continuam atendendo na forma de oito dígitos. O
  // formato é PISTA, e a prova está na conversa.
  //
  // Um aviso que contradiz o que a pessoa está VENDO é pior do que aviso
  // nenhum: ele ensina que a tarja mente, e a partir daí ela não serve nem
  // quando estiver certa.
  const dias = await abrir("Dias Costa");
  ok("número na forma antiga QUE FUNCIONA não ganha tarja", dias === null,
     `apareceu: ${JSON.stringify(dias)}`);

  await page.fill('input[placeholder*="Buscar por nome"]', "");
  await page.waitForTimeout(1200);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1600);
  const naComum = await page.evaluate(() =>
    document.querySelectorAll("[data-numero-nao-recebe]").length);
  ok("nem a conversa de sempre", naComum === 0, `apareceram ${naComum}`);
}

console.log("\nNo celular");
{
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(1000);
  // Volta para a lista: no celular a conversa aberta ocupa a tela inteira.
  await page.locator('[aria-label="Voltar"], [title="Voltar"]').first().click().catch(() => {});
  await page.waitForTimeout(900);
  const t = await abrir("Alcides");
  ok("a tarja também aparece no celular", !!t, "nenhuma tarja");
  const r = await page.evaluate(() => {
    const el = document.querySelector("[data-numero-nao-recebe]");
    if (!el) return null;
    const c = el.getBoundingClientRect();
    return { largura: Math.round(c.width), altura: Math.round(c.height),
             janela: window.innerWidth };
  });
  console.log(`     tarja: ${r?.largura}x${r?.altura}px numa tela de ${r?.janela}px`);
  ok("sem estourar a largura da tela", r && r.largura <= r.janela,
     `${r?.largura}px numa tela de ${r?.janela}px`);
  // A CONVERSA NÃO PODE SUMIR ATRÁS DO AVISO. Num celular de 780px, uma tarja
  // de 150px é um quinto da tela gasto para dizer uma frase.
  ok("e sem comer um quinto da tela", r && r.altura < 120, `a tarja tem ${r?.altura}px`);
  await page.setViewportSize({ width: 1400, height: 900 });
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
