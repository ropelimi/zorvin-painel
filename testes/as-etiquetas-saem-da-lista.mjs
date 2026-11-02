// AS ETIQUETAS SAEM DA LISTA DE CONVERSAS (02/11).
//
// Pedido do Rodrigo, com a foto da lista (três conversas, a etiqueta de cada
// uma riscada embaixo): "As etiquetas não devem mais aparecer na lista de
// conversas, porque ocupa espaço da tela e isso tem incomodado os usuários."
//
// O que esta prova confere:
//
//   1. a linha da lista não mostra etiqueta nenhuma, NEM GUARDA O LUGAR
//      DELA: duas conversas iguais, uma com duas etiquetas e outra sem
//      nenhuma, têm a mesma altura. Esconder a etiqueta e deixar a faixa vazia
//      seria cumprir a letra do pedido e não o motivo dele;
//   2. as etiquetas continuam onde não foram riscadas: no alto da conversa
//      aberta, no menu "Etiquetas" da conversa (marcadas) e no filtro da seta;
//   3. o mesmo no celular, onde a faixa custava mais.
//
// A conversa que vem de fora das páginas (pelo filtro ou pela busca) é
// conferida em `as-conversas-de-fora-tem-etiqueta`.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// DUAS CONVERSAS IGUAIS no telefone que a bancada abre primeiro ("Acordos 1",
// a7): o mesmo tamanho de nome, a mesma prévia, ninguém esperando, nenhuma
// não lida. Só a primeira tem etiqueta — e duas, para a faixa que ela ocupava
// ser a mais alta possível. A diferença de altura entre as duas linhas é,
// exatamente, o espaço que a etiqueta ocupa na lista.
const contato = (id, nome, numero) => ({ id, nome, numero, foto_url: null });
const conversa = (id, ct, minutos) => ({
  id, advogado_id: "a7", contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: iso(AGORA - minutos * 60e3), ultima_mensagem: "Bom dia, tudo bem?",
  esperando_desde: null, frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { nome: ct.nome, numero: ct.numero, foto_url: null },
});
const CT_COM = contato("et-ct-com", "CLIENTE COM ETIQUETA", "5511930001111");
const CT_SEM = contato("et-ct-sem", "CLIENTE SEM ETIQUETA", "5511930002222");
const SEMENTE = {
  contatos: [CT_COM, CT_SEM],
  conversas: [conversa("et-com", CT_COM, 1), conversa("et-sem", CT_SEM, 2)],
  mensagens: [
    { id: "et-m-com", conversa_id: "et-com", origem: "contato", tipo: "texto", texto: "Bom dia, tudo bem?", id_uazapi: "ET-M-COM", criado_em: iso(AGORA - 60e3) },
    { id: "et-m-sem", conversa_id: "et-sem", origem: "contato", tipo: "texto", texto: "Bom dia, tudo bem?", id_uazapi: "ET-M-SEM", criado_em: iso(AGORA - 120e3) },
  ],
  conversa_tags: [
    { id: "et-tag-1", conversa_id: "et-com", tag_id: "t-urgente" },
    { id: "et-tag-2", conversa_id: "et-com", tag_id: "t-aguardando" },
  ],
};

async function abrir(viewport) {
  const ctx = await nav.newContext({ viewport });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 }).catch(() => {});
  await page.waitForSelector('[data-conversa-id="et-com"]', { timeout: 8000 }).catch(() => {});
  // As etiquetas da lista chegam numa leitura à parte, depois das linhas.
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
const contar = (page, sel) => page.locator(sel).count();
const texto = async (page, sel) => ((await contar(page, sel)) ? (await page.locator(sel).first().innerText()) : "");
/** CLIQUE GUARDADO: o que não existe não estoura a prova inteira. */
async function clicar(page, sel) {
  if (!(await contar(page, sel))) return false;
  try { await page.locator(sel).first().click({ timeout: 3000 }); return true; } catch (_) { return false; }
}
/** As linhas da lista: o texto que cada uma mostra, e a altura dela. */
const linhas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-conversa-id]")].map((el) => ({
  id: el.getAttribute("data-conversa-id"), texto: el.innerText || "", altura: el.getBoundingClientRect().height,
})));
const ETIQUETA = /\bUrgente\b|Aguardando cliente/;

/** O QUE VALE NAS DUAS LARGURAS: nenhuma etiqueta na linha, e nem o lugar dela. */
async function conferirAsLinhas(page) {
  const l = await linhas(page);
  const com = l.find((x) => x.id === "et-com"), sem = l.find((x) => x.id === "et-sem");
  ok("as duas conversas plantadas estão na lista", Boolean(com && sem), JSON.stringify(l.slice(0, 4).map((x) => x.id)));
  ok("nenhuma linha da lista mostra etiqueta", l.length > 0 && l.every((x) => !ETIQUETA.test(x.texto)),
     JSON.stringify(l.filter((x) => ETIQUETA.test(x.texto)).map((x) => x.id)));
  ok("nem a faixa das etiquetas existe na linha", (await contar(page, "[data-etiquetas-da-linha]")) === 0);
  ok("e a conversa COM etiqueta tem a mesma altura da que não tem: a faixa não fica guardando lugar",
     Boolean(com && sem) && Math.abs(com.altura - sem.altura) < 0.5,
     com && sem ? `com ${com.altura.toFixed(1)} · sem ${sem.altura.toFixed(1)}` : "");
}

// A 1600, E NÃO A 1360: com a ficha do Vantoro aberta, abaixo disso o alto da
// conversa recolhe os botões no ⋮ (o nome do cliente vem primeiro), e o de
// "Etiquetas" sai da barra — a régua de `o-cabecalho-nao-corta-o-que-importa`.
console.log("\n1. No computador");
{
  const { ctx, page, estouros } = await abrir({ width: 1600, height: 900 });
  await conferirAsLinhas(page);
  // AS ETIQUETAS CONTINUAM NO ALTO DA CONVERSA ABERTA, que não foi riscado.
  ok("abri a conversa com etiqueta", await clicar(page, '[data-conversa-id="et-com"]'));
  await page.waitForTimeout(800);
  const alto = await texto(page, "[data-etiquetas-do-alto]");
  ok("o alto da conversa mostra as duas etiquetas", /Urgente/.test(alto) && /Aguardando cliente/.test(alto), alto);
  // E NO MENU "Etiquetas" DA CONVERSA, marcadas.
  ok("abri o menu das etiquetas da conversa", await clicar(page, 'button[aria-label="Etiquetas"]'));
  await page.waitForTimeout(300);
  const marcadas = await page.evaluate(() => [...document.querySelectorAll("[data-tag-opcao]")]
    .filter((b) => b.querySelector("svg")).map((b) => b.getAttribute("data-tag-opcao")));
  ok("e o menu as mostra marcadas", marcadas.includes("t-urgente") && marcadas.includes("t-aguardando"), JSON.stringify(marcadas));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  // E O FILTRO DA SETA CONTINUA ACHANDO A CONVERSA PELA ETIQUETA.
  ok("abri a seta dos filtros", await clicar(page, "[data-mais-filtros]"));
  await page.waitForTimeout(300);
  ok("escolhi “Aguardando cliente”", await clicar(page, '[data-etiqueta-da-seta="t-aguardando"]'));
  await page.waitForTimeout(2000);
  const filtradas = await linhas(page);
  ok("o filtro acha a conversa pela etiqueta, e não a outra",
     filtradas.some((x) => x.id === "et-com") && !filtradas.some((x) => x.id === "et-sem"),
     JSON.stringify(filtradas.map((x) => x.id)));
  ok("e, filtrada, a linha continua sem a etiqueta", filtradas.length > 0 && filtradas.every((x) => !ETIQUETA.test(x.texto)),
     JSON.stringify(filtradas.filter((x) => ETIQUETA.test(x.texto)).map((x) => x.id)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// NO CELULAR A FAIXA CUSTAVA MAIS: a coluna é a tela inteira, e cada conversa
// com etiqueta ocupava uma linha a mais numa tela que mostra poucas.
console.log("\n2. No celular");
{
  const { ctx, page, estouros } = await abrir({ width: 390, height: 844 });
  await conferirAsLinhas(page);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
