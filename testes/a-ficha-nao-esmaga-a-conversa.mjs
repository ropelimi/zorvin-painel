// A FICHA NÃO ESMAGA A CONVERSA (auditoria de 28/10)
//
// O layout de três colunas começa nos 768px, e as três somam 60 (barra) +
// 360 (lista) + 330 (ficha) = 750. Com a ficha fixa — o padrão desde 28/09 —
// o que sobrava para a CONVERSA era o resto: MEDIDO na bancada, 18px a 768 (o
// iPad em pé), 150 a 900 e 274 a 1024. A mensagem saía uma letra por linha, o
// nome do cliente sumia do cabeçalho e os ícones da barra de escrever eram
// desenhados por cima da ficha. Uma janela na metade de um monitor de 1920
// (960px) caía no mesmo lugar.
//
// Agora a ficha só é coluna quando sobra, ao lado dela, a conversa mínima — a
// do próprio cabeçalho recolhido (nome 230 + ⋮ 82 + avatar 56 = 368). Abaixo
// disso ela se comporta como no celular: nasce recolhida, abre por gesto e,
// aberta, toma o lugar da CONVERSA — nunca o da lista, que era o pedido de
// 28/09 (a fila de quem espera continua à vista).
//
// O QUE ESTA PROVA GUARDA
//   1. de 768 a 1120, a conversa aberta fica com tudo o que sobra da lista
//      (e nunca menos que 368px ao lado da ficha), e o nome do cliente
//      aparece inteiro no cabeçalho;
//   2. a 768, a ficha abre pelo ⋮, toma o lugar da conversa e a lista fica;
//   3. o X da ficha devolve a conversa; o Esc também;
//   4. com a ficha aberta, clicar noutra conversa da lista mostra a conversa;
//   5. o gesto não mexe na preferência guardada do computador largo;
//   6. a 1500 nada mudou: a ficha continua coluna fixa, ao lado da conversa.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const CLIENTE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
                  telefone: "5567992183107", documentos: 0, processos: [], ordem_servico: null };
const CONVERSA_MINIMA = 230 + 82 + 56;

const nav = await abrirNavegador();
const erros = [];

async function novaJanela(largura, altura = 900) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${largura}px: ${e.message}`));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/vantoro/cliente")) {
      const tel = (url.searchParams.get("telefone") || "").replace(/\D/g, "");
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: tel === CLIENTE.telefone ? [CLIENTE] : [], opcoes: {} }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page };
}

// A conversa é medida pelo cabeçalho dela, que tem a largura da coluna. Pelo
// que se VÊ: esconder com `display:none` deixa o elemento no documento.
const larguraDaConversa = (page) => page.evaluate(() => {
  const topo = document.querySelector("[data-topo-conversa]");
  if (!topo) return null;
  const r = topo.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? Math.round(r.width) : 0;
});
const fichaVisivel = async (page) => {
  const f = page.locator("[data-ficha]");
  return (await f.count()) > 0 && await f.first().isVisible();
};
const listaVisivel = async (page) => page.locator("[data-conversa-nome]").first().isVisible();
const conversaVisivel = async (page) => {
  const t = page.locator("textarea").first();
  return (await t.count()) > 0 && await t.isVisible();
};
async function abrirAPrimeira(page) {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1300);
}

console.log("\n1. Entre 768 e 1120, a conversa não é esmagada");
for (const largura of [768, 900, 1024, 1100, 1120]) {
  const { ctx, page } = await novaJanela(largura);
  await abrirAPrimeira(page);
  const w = await larguraDaConversa(page);
  // Sem a ficha ao lado, a conversa fica com TUDO o que sobra da lista; com
  // ela, nunca menos que o piso.
  const esperado = Math.min(CONVERSA_MINIMA, largura - 60 - 360);
  ok(`a ${largura}px a conversa tem pelo menos ${esperado}px`, w !== null && w >= esperado - 1,
     `tinha ${w}px`);
  // O NOME INTEIRO NO CABEÇALHO: é o que diz com quem se está falando.
  const nome = await page.evaluate(() => {
    const alvo = document.querySelector("[data-nome-do-contato]");
    if (!alvo) return null;
    const r = alvo.getBoundingClientRect();
    return { texto: alvo.textContent, visivel: r.width > 0 && r.right <= innerWidth,
             cortado: alvo.scrollWidth > alvo.clientWidth + 1, largura: Math.round(r.width) };
  });
  ok(`a ${largura}px o nome do cliente aparece inteiro no cabeçalho`,
     nome && nome.visivel && !nome.cortado, JSON.stringify(nome));
  ok(`a ${largura}px a lista continua à vista`, await listaVisivel(page));
  await ctx.close();
}

console.log("\n2. A 768, a ficha abre pelo ⋮ e toma o lugar da conversa — não o da lista");
{
  const { ctx, page } = await novaJanela(768, 1024);
  await abrirAPrimeira(page);
  ok("a ficha nasce recolhida (não há três colunas)", !(await fichaVisivel(page)));
  const guardadaAntes = await page.evaluate(() => localStorage.getItem("zorvin_ficha_fixa"));

  const mais = page.locator('[aria-label="Mais opções desta conversa"]');
  ok("o ⋮ da conversa está à vista", (await mais.count()) > 0 && await mais.first().isVisible());
  await mais.first().click();
  await page.waitForTimeout(400);
  const item = page.getByRole("button", { name: /Ficha no Vantoro/ });
  ok("o ⋮ oferece a ficha", (await item.count()) > 0);
  await item.last().click();
  await page.waitForTimeout(1500);

  ok("a ficha abriu", await fichaVisivel(page));
  const larguraFicha = await page.locator("[data-ficha]").first().evaluate((e) => Math.round(e.getBoundingClientRect().width));
  ok("e ela tem espaço (pelo menos a largura da coluna de sempre)", larguraFicha >= 330, `${larguraFicha}px`);
  ok("a lista de conversas continua à vista", await listaVisivel(page));
  ok("a conversa saiu da frente (não ficou espremida ao lado)", !(await conversaVisivel(page)));

  // 3. o X devolve a conversa
  await page.locator("[data-recolher-ficha]").first().click();
  await page.waitForTimeout(600);
  ok("o X da ficha devolve a conversa", await conversaVisivel(page) && !(await fichaVisivel(page)));

  // o Esc também
  await mais.first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Ficha no Vantoro/ }).last().click();
  await page.waitForTimeout(1200);
  ok("(reabriu)", await fichaVisivel(page));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  ok("o Esc fecha a ficha e devolve a conversa", !(await fichaVisivel(page)) && await conversaVisivel(page));

  // 4. com a ficha aberta, clicar noutra conversa mostra a conversa
  await mais.first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Ficha no Vantoro/ }).last().click();
  await page.waitForTimeout(1200);
  ok("(reabriu de novo)", await fichaVisivel(page));
  await page.locator("[data-conversa-nome]").nth(1).click();
  await page.waitForTimeout(1300);
  ok("clicar noutra conversa da lista mostra a conversa, e não a ficha",
     await conversaVisivel(page) && !(await fichaVisivel(page)));

  // 5. o gesto não vira preferência
  const guardadaDepois = await page.evaluate(() => localStorage.getItem("zorvin_ficha_fixa"));
  ok("abrir e fechar a ficha aqui não mexe na preferência do computador largo",
     guardadaAntes === guardadaDepois, `antes ${guardadaAntes}, depois ${guardadaDepois}`);
  await ctx.close();
}

console.log("\n6. No computador largo nada mudou");
{
  const { ctx, page } = await novaJanela(1500);
  await abrirAPrimeira(page);
  ok("a 1500 a ficha continua coluna fixa", await fichaVisivel(page));
  ok("ao lado da conversa", await conversaVisivel(page));
  ok("e da lista", await listaVisivel(page));
  await ctx.close();
}

ok("sem erro de JavaScript em nenhuma largura", erros.length === 0, erros.slice(0, 3).join(" | "));

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
