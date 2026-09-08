// O TELEFONE TEM DONO, E APARECE NA FICHA.
//
// Esta é a tela dos três pedidos de 04/09 — a única em que eles ficam visíveis
// para quem atende:
//
//   1. "o mesmo número cadastrado para dois contatos tem que ter a informação
//       de que está em dois ou mais CPF, e poder escolher de quem é o telefone
//       (o responsável). Por exemplo, uma mãe que entra em contato pelo
//       telefone do filho, e ambos são clientes";
//   2. "ao invés de ter apenas a opção de incluir mais um número, ter a opção
//       de ter mais números, o principal e pelo menos mais dois";
//   3. "poder fazer alteração do número de WhatsApp pelo Zorvin".
//
// E NÃO É HIPÓTESE. Medido no cadastro do escritório: onze números aparecem em
// dois ou mais cadastros, e nem todos são duplicata — ELIVANIA DA SILVA DOS
// SANTOS e ELIVANIA VIEIRA DA SILVA, sobrenomes diferentes, as duas com
// processo, dividindo o mesmo número.
//
// O QUE ESTA PROVA MEDE, E O QUE ELA NÃO MEDE. A regra toda (quem é o
// principal, o número velho não sumir na troca, o último não sair) mora no
// VANTORO, e está provada lá — `core/tests_o_telefone_tem_dono.py`, 32
// conferências. Aqui se prova o que é da TELA: que ela desenha o que a ficha
// devolveu, e que cada gesto chega à ponte com o corpo certo.
//
// Fingir a regra aqui dentro seria pior do que não prová-la: duas versões da
// mesma verdade, e a da tela sendo a errada no primeiro caso não previsto.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O ESTADO DO CADASTRO, do lado de cá. As rotas devolvem a lista refeita, que
// é o que o Vantoro faz de verdade — e é isso que a tela desenha.
let TELEFONES = [
  { id: 1, numero: "11999991111", digitos: "11999991111", principal: true,
    proprio: true, dono: "", observacao: "",
    usado_por: [{ id: 99, nome: "MARIA DA SILVA", cpf: "98765432100" }] },
  { id: 2, numero: "11988882222", digitos: "11988882222", principal: false,
    proprio: true, dono: "", observacao: "", usado_por: [] },
];
const pedidos = [];

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  const metodo = rota.request().method();
  let corpo = null;
  try { corpo = JSON.parse(rota.request().postData() || "null"); } catch (_) { /* nulo */ }

  if (/\/telefones(\/\d+)?$/.test(url.pathname)) {
    pedidos.push({ metodo, caminho: url.pathname, corpo });
    const id = Number((url.pathname.match(/\/telefones\/(\d+)$/) || [])[1] || 0);
    if (metodo === "POST") {
      TELEFONES = [...TELEFONES, {
        id: 3, numero: corpo.numero, digitos: corpo.numero.replace(/\D/g, ""),
        principal: false, proprio: true, dono: "", observacao: "", usado_por: [] }];
    } else if (metodo === "PATCH") {
      TELEFONES = TELEFONES.map((t) => {
        if (t.id !== id) return corpo.principal ? { ...t, principal: false } : t;
        return { ...t, ...corpo, dono: corpo.proprio ? "" : (corpo.dono ?? t.dono) };
      });
    } else if (metodo === "DELETE") {
      TELEFONES = TELEFONES.filter((t) => t.id !== id);
    }
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, telefones: TELEFONES }) });
  }

  if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, cliente: {
        id: 55, nome: "JOAO DA SILVA", cpf: "12345678909",
        telefone: "11999991111", telefone2: "", processos: [], documentos: 0,
        ordem_servico: null, telefones: TELEFONES } }) });
  }
  if (url.pathname.endsWith("/vantoro/cliente")) {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, clientes: [{
        id: 55, nome: "JOAO DA SILVA", cpf: "12345678909",
        telefone: "11999991111", telefone2: "", processos: [], documentos: 0,
        ordem_servico: null, telefones: TELEFONES }] }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);
await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(600);

// Abre a ficha do cliente.
const botaoFicha = page.locator('button[title="Ficha no Vantoro"]').first();
if (await botaoFicha.count()) await botaoFicha.click();
await page.waitForTimeout(1800);

const bloco = page.locator("[data-telefones]");

console.log("\nO telefone tem dono, e aparece na ficha");

// CONFERIR QUE O BOTÃO EXISTE ANTES DE CLICAR NELE.
//
// Sem isto, um botão que some faz o Playwright esperar TRINTA SEGUNDOS e
// derrubar a prova inteira com um rastro de erro. A sabotagem mostrou: tirar o
// "usar este como WhatsApp" não reprovava dizendo o que faltava — matava a
// rodada no meio, e as conferências seguintes nem chegavam a rodar.
//
// Uma prova que morre é pior do que uma que reprova: quem lê tem de decifrar um
// estouro em vez de ler uma frase.
async function clicar(nome, seletor) {
  const alvo = page.locator(seletor);
  const existe = (await alvo.count()) > 0;
  ok(nome, existe, `não achei ${seletor} na tela`);
  if (!existe) return false;
  await alvo.first().click();
  return true;
}

const temBloco = (await bloco.count()) === 1;
ok("a ficha desenha a lista de telefones", temBloco,
   "sem ela, nenhum dos três pedidos existe na tela");
if (!temBloco) {
  // Sem o bloco não há o que medir, e insistir produziria dez estouros em vez
  // de uma frase. A prova diz o que faltou e para.
  console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
  await nav.close();
  process.exit(1);
}

// ------------------------------------------------------------
//  PEDIDO 1 — o número está noutro CPF, e a ficha diz
// ------------------------------------------------------------
const aviso = page.locator("[data-usado-por]");
ok("a ficha avisa que o número está noutro cadastro", (await aviso.count()) === 1);
const texto = (await aviso.first().innerText().catch(() => "")) || "";
ok("e diz o nome e o CPF de quem mais usa",
   /MARIA DA SILVA/.test(texto) && /98765432100/.test(texto), `dizia: "${texto}"`);
ok("o número que é só dele NÃO ganha aviso",
   (await page.locator('[data-telefone-do-cliente="11988882222"] [data-usado-por]').count()) === 0,
   "um aviso em toda linha seria ruído, e ruído constante deixa de ser lido");

// ------------------------------------------------------------
//  PEDIDO 1 (segunda metade) — de quem é o aparelho
// ------------------------------------------------------------
page.once("dialog", (d) => d.accept("do filho, JOAO DA SILVA"));
await clicar("há como dizer de quem é o aparelho",
             '[data-telefone-do-cliente="11999991111"] [data-alternar-dono]');
await page.waitForTimeout(900);
const patch = pedidos.filter((p) => p.metodo === "PATCH").slice(-1)[0];
ok("dizer que o aparelho não é dela chega à ponte",
   !!patch && patch.corpo && patch.corpo.proprio === false,
   JSON.stringify(patch));
ok("com o nome de quem é o dono",
   patch && patch.corpo.dono === "do filho, JOAO DA SILVA", JSON.stringify(patch && patch.corpo));
ok("e a ficha passa a mostrar isso",
   (await page.locator('[data-telefone-do-cliente="11999991111"] [data-nao-e-dela]').count()) === 1);

// ------------------------------------------------------------
//  PEDIDO 3 — trocar o WhatsApp
// ------------------------------------------------------------
ok("o número principal aparece marcado",
   (await page.locator('[data-telefone-do-cliente="11999991111"] [data-principal]').count()) === 1);
await clicar("há como trocar o WhatsApp por outro número da lista",
             '[data-telefone-do-cliente="11988882222"] [data-usar-este]');
await page.waitForTimeout(900);
const troca = pedidos.filter((p) => p.metodo === "PATCH").slice(-1)[0];
ok("trocar o WhatsApp chega à ponte, na linha certa",
   !!troca && /\/telefones\/2$/.test(troca.caminho) && troca.corpo.principal === true,
   JSON.stringify(troca));
ok("e a marca passa para o número novo",
   (await page.locator('[data-telefone-do-cliente="11988882222"] [data-principal]').count()) === 1
   && (await page.locator('[data-telefone-do-cliente="11999991111"] [data-principal]').count()) === 0);
// O NÚMERO VELHO CONTINUA NA LISTA. É o que preserva o vínculo com a conversa
// que já está aberta — e a razão de a troca poder ser feita por aqui.
ok("o número velho continua na lista",
   (await page.locator('[data-telefone-do-cliente="11999991111"]').count()) === 1);

// ------------------------------------------------------------
//  PEDIDO 2 — mais de dois números
// ------------------------------------------------------------
const temCaixa = (await page.locator("[data-novo-telefone]").count()) > 0;
ok("há como acrescentar outro número", temCaixa);
if (temCaixa) {
  await page.locator("[data-novo-telefone]").fill("11977773333");
  await clicar("e o botão de acrescentar existe", "[data-acrescentar-telefone]");
  await page.waitForTimeout(900);
}
const posto = pedidos.filter((p) => p.metodo === "POST").slice(-1)[0];
ok("acrescentar um terceiro número chega à ponte",
   !!posto && posto.corpo && posto.corpo.numero === "11977773333", JSON.stringify(posto));
ok("e a ficha passa a mostrar três",
   (await page.locator("[data-telefone-do-cliente]").count()) === 3,
   `mostrou ${await page.locator("[data-telefone-do-cliente]").count()}`);
ok("e a caixa de digitar esvazia",
   (await page.locator("[data-novo-telefone]").inputValue()) === "",
   "senão o próximo número é digitado em cima do anterior");

// ------------------------------------------------------------
//  TIRAR — com confirmação, porque a falta só aparece dias depois
// ------------------------------------------------------------
page.once("dialog", (d) => d.dismiss());
await clicar("há como tirar um número",
             '[data-telefone-do-cliente="11977773333"] [data-tirar-telefone]');
await page.waitForTimeout(700);
ok("cancelar a confirmação NÃO tira o número",
   (await page.locator('[data-telefone-do-cliente="11977773333"]').count()) === 1
   && pedidos.filter((p) => p.metodo === "DELETE").length === 0);

page.once("dialog", (d) => d.accept());
await clicar("e confirmando ele sai",
             '[data-telefone-do-cliente="11977773333"] [data-tirar-telefone]');
await page.waitForTimeout(900);
ok("confirmando, o número sai",
   (await page.locator('[data-telefone-do-cliente="11977773333"]').count()) === 0
   && pedidos.filter((p) => p.metodo === "DELETE").length === 1);

ok("nenhum erro de página no caminho", erros.length === 0, erros.join(" | "));

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
await nav.close();
process.exit(falhas ? 1 : 0);
