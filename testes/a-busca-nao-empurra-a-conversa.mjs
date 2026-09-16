// A BUSCA NÃO EMPURRA PARA FORA DA TELA A CONVERSA QUE ELA ACHOU.
//
// RELATO DO ESCRITÓRIO, 16/09, com foto: "a conversa do nome que eu pesquiso
// aparece e em segundos some, e ficam aparecendo outros contatos todos sem
// conversa".
//
// A CONVERSA NÃO SUMIA. A busca pergunta em dois lugares e em dois tempos: o
// banco responde em milissegundos, o cadastro do Vantoro leva segundos (ele
// fica atrás da ponte, que hiberna na Render). O que o cadastro trazia —
// homônimos com quem o escritório nunca falou — era desenhado ACIMA das
// conversas, e empurrava para baixo da dobra a conversa que já estava na tela.
//
// MEDIDO NA BANCADA, com doze homônimos: aos 900ms, 1 conversa e 0 ofertas;
// aos 2100ms, as MESMAS 3 conversas com 12 ofertas na frente — 800px de
// sugestões entre o alto da lista e a conversa que a pessoa procurou.
//
// ------------------------------------------------------------
// ESTA PROVA MEDE O QUE SE VÊ, e não a ordem no HTML.
//
// Conferir só "o bloco vem depois" aprovaria uma tela em que a conversa está
// logo abaixo de doze ofertas dentro de um recipiente rolável: no HTML a ordem
// estaria certa e na tela a conversa continuaria fora da vista. O defeito
// relatado é visual, e é assim que ele tem de ser medido.
//
// E A OFERTA NÃO PODE SUMIR NO CONSERTO. Ela existe por um relato anterior (a
// ELIANA, que o Vantoro conhece e o Zorvin nunca viu): descê-la é ordenar,
// apagá-la seria desfazer. Sem conversa nenhuma, ela fica no alto sozinha,
// porque não há nada acima dela.
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

// QUANTOS HOMÔNIMOS. Doze é o que faz a conta virar: cada linha da oferta tem
// ~69px, então doze passam de 800 — mais do que a altura útil da lista. Com
// dois ou três o defeito existiria e não apareceria, e a prova diria que está
// tudo bem no dia em que o escritório procura "maria".
const QUANTOS = 12;
// "rodrigo" é o termo do relato, e a bancada tem uma conversa com RODRIGO
// ALVES SOUSA — o caso real é este: o nome procurado tem conversa E tem
// dezenas de homônimos no cadastro.
const TERMO = "rodrigo";
const SO_NO_CADASTRO = "ELIANA ALVES DA SILVA";

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const url = new URL(rota.request().url());
  if (url.pathname.endsWith("/vantoro/buscar")) {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const clientes = [];
    if (q.includes("rodrigo")) {
      for (let i = 1; i <= QUANTOS; i++) {
        clientes.push({ id: 100 + i, nome: `RODRIGO CADASTRO ${i}`,
                        telefone: `(11) 9100-${String(2000 + i)}`, telefone2: "" });
      }
    }
    if (q.includes("eliana")) {
      clientes.push({ id: 9, nome: SO_NO_CADASTRO, telefone: "(11) 96797-3545", telefone2: "" });
    }
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, clientes }) });
  }
  rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
});

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1800);

const caixa = page.locator('input[placeholder*="Buscar por nome"]').first();
async function procurar(termo) {
  await caixa.click();
  await caixa.fill("");
  await page.waitForTimeout(400);
  await caixa.type(termo, { delay: 40 });
}

/** O que está na tela AGORA: quantas ofertas, e onde está a primeira conversa
 *  em relação à parte visível da lista. */
const oQueSeVe = () => page.evaluate(() => {
  const prim = document.querySelector("[data-conversa-nome]");
  const ofertas = document.querySelectorAll("[data-comecar-conversa]").length;
  if (!prim) return { ofertas, conversas: 0, primeiraVisivel: null };
  // O RECIPIENTE QUE ROLA é quem decide o que se vê — não a janela. A lista
  // vive dentro de uma coluna com rolagem própria, e é do alto DELA que se
  // mede: medindo da janela, os 188px do cabeçalho entram na conta e a régua
  // passa a falar de outra coisa. (Escrevi assim primeiro, procurando o
  // primeiro ancestral cujo conteúdo transborda — e ele não achava nada,
  // caindo na janela em silêncio. Quem decide é o `overflow-y`.)
  let caixa = prim.parentElement;
  while (caixa && !/auto|scroll/.test(getComputedStyle(caixa).overflowY)) caixa = caixa.parentElement;
  if (!caixa) return { erro: "não achei o quadro que rola" };
  const linha = prim.closest("[data-conversa-id]") || prim;
  const r = linha.getBoundingClientRect();
  const c = caixa.getBoundingClientRect();
  return {
    ofertas,
    conversas: document.querySelectorAll("[data-conversa-nome]").length,
    nome: prim.textContent.trim().slice(0, 30),
    primeiraVisivel: r.top >= c.top - 1 && r.top < c.bottom,
    quantoAbaixoDoTopo: Math.round(r.top - c.top),
  };
});

// ------------------------------------------------------------------
console.log("\nA conversa achada aparece — e CONTINUA à vista quando o cadastro chega");
{
  await procurar(TERMO);
  await page.waitForTimeout(900);
  const antes = await oQueSeVe();
  // A PRIMEIRA METADE: o banco respondeu e a conversa está na tela.
  ok("o banco responde primeiro e a conversa aparece",
     antes.conversas > 0 && antes.primeiraVisivel === true, JSON.stringify(antes));
  ok("e o cadastro ainda não chegou", antes.ofertas === 0, JSON.stringify(antes));

  // Tempo de sobra para o cadastro voltar e redesenhar.
  await page.waitForTimeout(3500);
  const depois = await oQueSeVe();

  ok("o cadastro chegou mesmo (senão esta prova não mede nada)",
     depois.ofertas === QUANTOS, JSON.stringify(depois));
  // AS CONVERSAS NÃO SE PERDEM — nem uma.
  ok("nenhuma conversa se perdeu no caminho",
     depois.conversas >= antes.conversas,
     `tinha ${antes.conversas}, ficou com ${depois.conversas}`);
  // E ESTA É A CONFERÊNCIA DO RELATO: ela continua onde a pessoa a viu.
  ok("e a conversa continua À VISTA depois do cadastro chegar",
     depois.primeiraVisivel === true,
     `ficou ${depois.quantoAbaixoDoTopo}px abaixo do alto da lista`);
  // 100px é meia linha de conversa (elas têm ~69px). Medido: com o conserto a
  // primeira fica a 0 do alto; com o defeito, a 680. Qualquer teto entre os
  // dois serve, e este está longe dos dois — não reprova por um pixel de
  // fonte noutra máquina, nem deixa passar uma oferta inteira na frente.
  ok("sem ter sido empurrada para longe do alto",
     depois.quantoAbaixoDoTopo < 100,
     `ficou ${depois.quantoAbaixoDoTopo}px abaixo do alto da lista`);
}

// ------------------------------------------------------------------
console.log("\nE a oferta do cadastro continua lá, depois das conversas");
{
  const posicoes = await page.evaluate(() => {
    const bloco = document.querySelector("[data-do-vantoro-sem-conversa]");
    const prim = document.querySelector("[data-conversa-nome]");
    if (!bloco || !prim) return null;
    const linha = prim.closest("[data-conversa-id]") || prim;
    return { oferta: Math.round(bloco.getBoundingClientRect().top),
             conversa: Math.round(linha.getBoundingClientRect().top) };
  });
  ok("as duas coisas estão na tela", !!posicoes, "faltou o bloco ou a conversa");
  ok("e a oferta vem DEPOIS da conversa",
     posicoes && posicoes.oferta > posicoes.conversa, JSON.stringify(posicoes));
}

// ------------------------------------------------------------------
console.log("\nE quem só o cadastro conhece continua aparecendo — no alto, sozinho");
{
  // A TRAVA QUE IMPEDE O CONSERTO DE VIRAR UM SUMIÇO. Descer a oferta é
  // ordenar; apagá-la desfaria o conserto da ELIANA, que é um relato anterior
  // deste mesmo escritório.
  await procurar("ELIANA");
  await page.waitForTimeout(4500);
  const r = await page.evaluate((nome) => {
    const bloco = document.querySelector("[data-do-vantoro-sem-conversa]");
    return { tem: !!bloco,
             diz: bloco ? /ELIANA/i.test(bloco.innerText) : false,
             conversas: document.querySelectorAll("[data-conversa-nome]").length,
             noAlto: bloco ? Math.round(bloco.getBoundingClientRect().top) : null };
  }, SO_NO_CADASTRO);
  ok("sem conversa nenhuma, a oferta aparece", r.tem && r.diz, JSON.stringify(r));
  ok("e não há conversa acima dela para esconder nada",
     r.conversas === 0, `${r.conversas} conversas`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
