// O ARQUIVO BAIXA COM O NOME QUE TEM (16/10).
//
// Relato do Rodrigo: "eu envio um arquivo .pdf para o contato com o nome do
// arquivo '0001.01 - Procuração' e ele faz uma assinatura e me devolve esse
// arquivo assinado, só que quando eu vou baixar o arquivo ele não vem com o
// mesmo nome, ele vem com letras e números aleatórios."
//
// As "letras e números" são o endereço do depósito: o que chega mora em
// `recebidos/{messageid}.pdf`. O link do cartão tinha `download`, e o
// navegador ignora esse atributo quando o arquivo é de OUTRO domínio — por
// isso a prova serve os arquivos de um depósito de mentira noutro endereço,
// como o de verdade, e não de `data:`, onde o atributo valeria e a prova
// mediria outra coisa.
//
// O QUE ELA GUARDA:
//
//   1. a conta do nome (o relato sem extensão ganha ".pdf"; o nome da pessoa
//      vence o tipo; sem nome, a data da mensagem, e nunca um carimbo);
//   2. o clique no cartão BAIXA, com o nome — e com o conteúdo do arquivo,
//      não com uma página de erro;
//   3. "Baixando…" enquanto baixa, e o segundo clique não baixa outro;
//   4. o depósito que não tem o arquivo é DITO, e nada é salvo;
//   5. Ctrl+clique (o navegador, sem passar por esta tela) também salva com o
//      nome: o endereço do link já pede o nome ao depósito;
//   6. ler sem baixar mora no menu da mensagem — e só em documento;
//   7. a imagem ampliada baixa com o nome dela, ou com a data;
//   8. o acervo de mídias diz o nome e baixa com ele — e abre num banco sem a
//      coluna do nome;
//   9. o que SAI daqui leva o nome original: enviar, agendar e encaminhar.
//      Era o nome estropiado ("0001.01_-_Procura_o.pdf") que ia ao cliente;
//  10. no modo de seleção o clique é da seleção, e não baixa nada.
import { readFileSync } from "node:fs";
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { nomeParaBaixar, enderecoParaBaixar } from "../src/arquivos.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const FUSO = "America/Sao_Paulo";
/** "14-10-2026 10h05" no fuso da prova — escrito com o `Intl`, e não com a
 *  mesma conta do painel: uma segunda escrita da conta concordaria com ela
 *  até no erro. */
function dataNoNome(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour}h${p.minute}`;
}

console.log("\n1. A conta do nome");
{
  ok("o relato: '0001.01 - Procuração' (sem extensão) baixa como .pdf",
     nomeParaBaixar({ nome: "0001.01 - Procuração", mime: "application/pdf" }) === "0001.01 - Procuração.pdf");
  ok("com a extensão, fica como está",
     nomeParaBaixar({ nome: "0001.01 - Procuração.pdf", mime: "application/pdf" }) === "0001.01 - Procuração.pdf");
  ok("um número no fim não é extensão: '0001.01' vira '0001.01.pdf'",
     nomeParaBaixar({ nome: "0001.01", mime: "application/pdf" }) === "0001.01.pdf");
  ok("o nome da pessoa vence o tipo: 'dados.csv' servido como Excel continua .csv",
     nomeParaBaixar({ nome: "dados.csv", mime: "application/vnd.ms-excel" }) === "dados.csv");
  ok("a assinatura digital (.p7s) não ganha extensão a mais",
     nomeParaBaixar({ nome: "Procuração assinada.pdf.p7s", mime: "application/pkcs7-signature",
                      url: "https://x.supabase.co/storage/v1/object/public/anexos/recebidos/A1.p7s" })
       === "Procuração assinada.pdf.p7s");
  const recusados = nomeParaBaixar({ nome: "Acordo: João | Maria?.pdf", mime: "application/pdf" });
  ok("o que o Windows recusa vira '_', e o acento fica", recusados === "Acordo_ João _ Maria_.pdf", recusados);
  ok("o caminho de quem mandou fica de fora",
     nomeParaBaixar({ nome: "C:\\Users\\joao\\Desktop\\procuracao.pdf", mime: "application/pdf" }) === "procuracao.pdf");
  ok("o espaço e o ponto das pontas saem",
     nomeParaBaixar({ nome: "  Contrato.  ", mime: "application/pdf" }) === "Contrato.pdf");
  const iso = "2026-10-14T13:05:00Z";
  const semNome = nomeParaBaixar({ nome: null, mime: "application/octet-stream", quando: iso,
    url: "https://x.supabase.co/storage/v1/object/public/anexos/recebidos/3EB0C4AB12CD.pdf" });
  ok("sem nome: 'Documento' com a DATA da mensagem, e a extensão do endereço",
     /^Documento \d\d-\d\d-2026 \d\dh\d\d\.pdf$/.test(semNome), semNome);
  ok("e nunca o fim do endereço (os 'números aleatórios')", !/3EB0C4AB12CD/.test(semNome), semNome);
  ok("o tipo que o depósito serviu acerta a extensão do que ficou sem tipo",
     nomeParaBaixar({ nome: "Procuracao", mime: "application/octet-stream", servido: "application/pdf" }) === "Procuracao.pdf");
  ok("sem tipo nenhum, não inventa extensão",
     nomeParaBaixar({ nome: "arquivo-misterioso", mime: "application/octet-stream" }) === "arquivo-misterioso");
  const longo = nomeParaBaixar({ nome: "Petição ".repeat(40) + "final.pdf", mime: "application/pdf" });
  ok("o nome comprido é cortado e guarda o .pdf", longo.length <= 180 && longo.endsWith(".pdf"), `${longo.length}: ${longo.slice(-20)}`);
  ok("o endereço do depósito pede o nome com acento, codificado",
     enderecoParaBaixar("https://x.supabase.co/storage/v1/object/public/anexos/recebidos/A.pdf", "0001.01 - Procuração.pdf")
       === "https://x.supabase.co/storage/v1/object/public/anexos/recebidos/A.pdf?download=0001.01%20-%20Procura%C3%A7%C3%A3o.pdf");
  ok("endereço que não é do depósito volta como veio",
     enderecoParaBaixar("blob:http://127.0.0.1/abc", "x.pdf") === "blob:http://127.0.0.1/abc"
       && enderecoParaBaixar("https://outro.site/x.pdf", "x.pdf") === "https://outro.site/x.pdf");
}

// ---------------------------------------------------------------- a bancada
const HOST = "https://projeto-de-mentira.supabase.co";
const DEPOSITO = `${HOST}/storage/v1/object/public/anexos`;
const PDF = Buffer.from("JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+", "base64");
const XLSX = Buffer.from("PK\u0003\u0004 planilha de mentira da prova");
// 120x80, e não 1x1: a bolha desenha a imagem no tamanho dela, e um botão de
// um pixel não se clica.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAHgAAABQCAIAAABd+SbeAAAAg0lEQVR42u3QQQ0AAAgEoEtiOsMayxbOBxsJSPVwIApEi0a0aNEWRItGtGjRFkSLRrRo0YgWjWjRohEtGtGiRSNaNKJFi0a0aESLFo1o0YgWLRrRohEtWjSiRSNatGhEi0a0aNGIFo1o0aIRLRrRokUjWjSiRYtGtGhEixaNaNGI/mMBrb5Z0VICEYgAAAAASUVORK5CYII=", "base64");

// O que o depósito de mentira tem. O que não está aqui responde como o do
// Supabase responde a um objeto que não existe.
const ARQUIVOS = {
  "/recebidos/3EB0C4AB12CD34EF56.pdf": { corpo: PDF, tipo: "application/pdf" },
  "/recebidos/A1B2C3D4E5F6A7B8C9.pdf": { corpo: PDF, tipo: "application/octet-stream" },
  "/recebidos/77AA99BB00CC11DD.xlsx": { corpo: XLSX, tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  "/recebidos/5D5D5D5D5D5D5D5D.pdf": { corpo: PDF, tipo: "application/pdf", atraso: 1800 },
  "/recebidos/IMG0410AAAA0410.png": { corpo: PNG, tipo: "image/png" },
  "/recebidos/IMG0000BBBB0000.png": { corpo: PNG, tipo: "image/png" },
  "/conversa/1760000000000-Acordo_para_assinar_5521.pdf": { corpo: PDF, tipo: "application/pdf" },
};

// O NAVEGADOR NUM IDIOMA QUE TEM ACENTO. Num Linux com o idioma "POSIX" — o
// destas máquinas de prova —, o Chrome joga fora o nome que não cabe em
// ASCII e salva como "download": medido, com `a.download = "Procuração.pdf"`,
// no Chromium inteiro e no de prova. É do sistema, e não do painel (no Windows
// do escritório o nome é Unicode); sem isto, a prova reprovaria o conserto
// falando de uma máquina.
const nav = await abrirNavegador({ env: { ...process.env, LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });

/** A conversa que o painel abre primeiro — descoberta, e não escolhida a dedo. */
async function primeiraConversa() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(1000);
  const id = await page.evaluate(() =>
    document.querySelector("[data-conversa-id]").getAttribute("data-conversa-id"));
  const outra = await page.evaluate(() =>
    [...document.querySelectorAll("[data-conversa-id]")].map((e) => e.getAttribute("data-conversa-id"))
      .find((x, i, todas) => x !== todas[0]));
  await ctx.close();
  return [id, outra];
}
const [ALVO, OUTRA] = await primeiraConversa();
ok("achei a conversa da prova, e uma segunda para encaminhar", Boolean(ALVO && OUTRA && ALVO !== OUTRA));

const minutosAtras = (n) => new Date(Date.now() - n * 60e3).toISOString();
const NO_SEM_NOME = minutosAtras(8);
const NA_FOTO_SEM_NOME = minutosAtras(3);
const doc = (id, campos) => ({
  id, conversa_id: ALVO, origem: "contato", tipo: "documento", texto: null,
  enviado_por: null, enviado_por_id: null, id_uazapi: `UAZ-${id}`, ...campos,
});
const SEMENTE = {
  mensagens: [
    doc("baixa-proc", { midia_nome: "0001.01 - Procuração", midia_mime: "application/pdf",
      midia_url: `${DEPOSITO}/recebidos/3EB0C4AB12CD34EF56.pdf`, criado_em: minutosAtras(9) }),
    doc("baixa-sem-nome", { midia_nome: null, midia_mime: "application/octet-stream",
      midia_url: `${DEPOSITO}/recebidos/A1B2C3D4E5F6A7B8C9.pdf`, criado_em: NO_SEM_NOME }),
    doc("baixa-planilha", { midia_nome: "Cálculo de liquidação 0410.xlsx",
      midia_mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      midia_url: `${DEPOSITO}/recebidos/77AA99BB00CC11DD.xlsx`, criado_em: minutosAtras(7) }),
    doc("baixa-lento", { midia_nome: "Extrato demorado 7788.pdf", midia_mime: "application/pdf",
      midia_url: `${DEPOSITO}/recebidos/5D5D5D5D5D5D5D5D.pdf`, criado_em: minutosAtras(6) }),
    doc("baixa-sumiu", { midia_nome: "Contrato que sumiu 4411.pdf", midia_mime: "application/pdf",
      midia_url: `${DEPOSITO}/recebidos/0FF0FF0FF0FF0FF0.pdf`, criado_em: minutosAtras(5) }),
    { id: "baixa-foto", conversa_id: ALVO, origem: "contato", tipo: "imagem", texto: null,
      midia_nome: "comprovante pix 0410.png", midia_mime: "image/png", id_uazapi: "UAZ-baixa-foto",
      midia_url: `${DEPOSITO}/recebidos/IMG0410AAAA0410.png`, criado_em: minutosAtras(4) },
    { id: "baixa-foto-sem-nome", conversa_id: ALVO, origem: "contato", tipo: "imagem", texto: null,
      midia_nome: null, midia_mime: "image/png", id_uazapi: "UAZ-baixa-foto-sem-nome",
      midia_url: `${DEPOSITO}/recebidos/IMG0000BBBB0000.png`, criado_em: NA_FOTO_SEM_NOME },
    { id: "baixa-texto", conversa_id: ALVO, origem: "contato", tipo: "texto",
      texto: "Segue o documento assinado 9090", id_uazapi: "UAZ-baixa-texto", criado_em: minutosAtras(2.5) },
    { id: "baixa-nosso", conversa_id: ALVO, origem: "advogado", tipo: "documento", texto: null,
      midia_nome: "Acordo para assinar 5521.pdf", midia_mime: "application/pdf",
      midia_url: `${DEPOSITO}/conversa/1760000000000-Acordo_para_assinar_5521.pdf`,
      enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", id_uazapi: "UAZ-baixa-nosso", criado_em: minutosAtras(2) },
  ],
};

async function abrirPainel({ bandeiras = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: FUSO, acceptDownloads: true });
  const pedidos = [];
  await ctx.route(new RegExp("^" + HOST.replace(/[.]/g, "\\.") + "/"), async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const caminho = decodeURIComponent(u.pathname.replace("/storage/v1/object/public/anexos", ""));
    pedidos.push({ metodo: req.method(), url: req.url(), caminho });
    const CORS = { "access-control-allow-origin": "*" };
    const a = ARQUIVOS[caminho];
    if (!a) {
      return route.fulfill({ status: 404, contentType: "application/json", headers: CORS,
        body: JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found" }) });
    }
    if (a.atraso && req.method() === "GET") await new Promise((r) => setTimeout(r, a.atraso));
    const cabecalhos = { ...CORS };
    // É O QUE O STORAGE DO SUPABASE RESPONDE a `?download=` (storage-api,
    // `renderer.ts`, `handleDownload`).
    const pedido = u.searchParams.get("download");
    if (pedido !== null) {
      const enc = encodeURIComponent(pedido);
      cabecalhos["content-disposition"] = `attachment; filename=${enc}; filename*=UTF-8''${enc};`;
    }
    return route.fulfill({ status: 200, contentType: a.tipo, headers: cabecalhos,
                           body: req.method() === "HEAD" ? "" : a.corpo });
  });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODO DOWNLOAD, de qualquer aba deste contexto — o Ctrl+clique e o "abrir
  // numa aba" baixam numa aba que não é esta.
  const baixados = [];
  const ouvir = (p) => p.on("download", async (d) => {
    const item = { nome: d.suggestedFilename(), url: d.url(), conteudo: null, daAba: p === page ? "esta" : "outra" };
    baixados.push(item);
    try { const c = await d.path(); item.conteudo = c ? readFileSync(c) : null; } catch (_) {}
  });
  ouvir(page);
  const abas = [];
  ctx.on("page", (p) => { if (p !== page) { abas.push(p); ouvir(p); } });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript(({ b, semente }) => {
    globalThis.__SEMENTE = semente;
    globalThis.__SEM_COLUNAS = b.semColunas || {};
    globalThis.__DEPOSITO_COM_ENDERECO = true;
    globalThis.__AVISOS_VISTOS = [];
    globalThis.__ABERTAS = [];
    const abrir = window.open.bind(window);
    window.open = (...a) => { globalThis.__ABERTAS.push(String(a[0])); return abrir(...a); };
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  }, { b: bandeiras, semente: SEMENTE });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-id]");
  await page.waitForTimeout(1000);
  await page.locator(`[data-conversa-id="${ALVO}"]`).first().click();
  await page.waitForTimeout(1200);
  return { ctx, page, estouros, baixados, abas, pedidos };
}

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova
 *  inteira depois de 30 segundos, e prova que estoura não diz QUAL
 *  conferência viu o defeito. */
async function clicar(page, sel, opcoes = {}) {
  const l = page.locator(sel);
  if (!(await l.count())) return false;
  try { await l.first().scrollIntoViewIfNeeded({ timeout: 3000 }); } catch (_) {}
  try { await l.first().click({ timeout: 3000, ...opcoes }); } catch (_) { return false; }
  await page.waitForTimeout(250);
  return true;
}
const cartao = (id) => `[data-msg-id="${id}"] [data-documento-da-conversa]`;
const esperarDownloads = async (baixados, n, ate = 5000) => {
  const fim = Date.now() + ate;
  while (baixados.length < n && Date.now() < fim) await new Promise((r) => setTimeout(r, 100));
  // E o arquivo terminar de chegar ao disco.
  await new Promise((r) => setTimeout(r, 400));
};
const abertas = (page) => page.evaluate(() => globalThis.__ABERTAS.slice());
const filme = (page) => page.evaluate(() => globalThis.__AVISOS_VISTOS.join(" | "));
const fila = (page, conversa) => page.evaluate((alvo) =>
  (globalThis.__TABELAS.fila_envio || []).filter((x) => String(x.conversa_id) === String(alvo)), conversa);

const { ctx, page, estouros, baixados, abas, pedidos } = await abrirPainel();

console.log("\n2. O relato: o clique no cartão baixa com o nome, e com o arquivo dentro");
{
  ok("abrir a conversa não baixou nada", baixados.length === 0, JSON.stringify(baixados.map((b) => b.nome)));
  ok("o cartão diz o nome que o arquivo tem",
     /0001\.01 - Procuração/.test(await page.locator(`[data-msg-id="baixa-proc"]`).innerText().catch(() => "")));
  ok("e o nome com que ele vai baixar",
     (await page.locator(cartao("baixa-proc")).getAttribute("data-nome-ao-baixar").catch(() => null)) === "0001.01 - Procuração.pdf");
  ok("cliquei no cartão", await clicar(page, cartao("baixa-proc")));
  await esperarDownloads(baixados, 1);
  ok("baixou UM arquivo", baixados.length === 1, JSON.stringify(baixados.map((b) => b.nome)));
  ok("com o nome do relato, '0001.01 - Procuração.pdf'", baixados[0]?.nome === "0001.01 - Procuração.pdf",
     `veio "${baixados[0]?.nome}"`);
  ok("e não com o fim do endereço", !/3EB0C4AB12CD34EF56/.test(baixados[0]?.nome || ""));
  ok("o arquivo salvo é o PDF, e não uma página de erro", baixados[0]?.conteudo && PDF.equals(baixados[0].conteudo),
     baixados[0]?.conteudo ? `${baixados[0].conteudo.length} bytes` : "sem conteúdo");
  ok("na mesma aba, sem abrir aba nenhuma", baixados[0]?.daAba === "esta" && abas.length === 0
       && (await abertas(page)).length === 0, `abas: ${abas.length}, abertas: ${(await abertas(page)).join(", ")}`);
  ok("o acento sobrevive: a planilha baixa como 'Cálculo de liquidação 0410.xlsx'",
     await clicar(page, cartao("baixa-planilha")) && (await esperarDownloads(baixados, 2), baixados[1]?.nome === "Cálculo de liquidação 0410.xlsx"),
     `veio "${baixados[1]?.nome}"`);
  ok("e com o conteúdo dela", baixados[1]?.conteudo && XLSX.equals(baixados[1].conteudo));
}

console.log("\n3. Sem nome gravado: a data da mensagem, e a extensão do endereço");
{
  baixados.length = 0;
  ok("cliquei no documento sem nome", await clicar(page, cartao("baixa-sem-nome")));
  await esperarDownloads(baixados, 1);
  const esperado = `Documento ${dataNoNome(NO_SEM_NOME)}.pdf`;
  ok(`baixou como '${esperado}'`, baixados[0]?.nome === esperado, `veio "${baixados[0]?.nome}"`);
}

console.log("\n4. Baixando… enquanto baixa, e o segundo clique não baixa outro");
{
  baixados.length = 0;
  ok("cliquei no documento demorado", await clicar(page, cartao("baixa-lento")));
  ok("o cartão diz que está baixando",
     (await page.locator(cartao("baixa-lento")).getAttribute("data-documento-da-conversa").catch(() => null)) === "baixando");
  ok("com a palavra, na linha do tipo",
     /Baixando…/.test(await page.locator(cartao("baixa-lento")).innerText().catch(() => "")));
  await clicar(page, cartao("baixa-lento"));
  await clicar(page, cartao("baixa-lento"));
  await esperarDownloads(baixados, 1, 6000);
  await page.waitForTimeout(1500);
  ok("três cliques, UM arquivo", baixados.length === 1, JSON.stringify(baixados.map((b) => b.nome)));
  ok("e o cartão volta ao normal depois",
     (await page.locator(cartao("baixa-lento")).getAttribute("data-documento-da-conversa").catch(() => null)) === "pronto");
}

console.log("\n5. O depósito sem o arquivo: dito, e nada salvo");
{
  baixados.length = 0;
  ok("cliquei no documento que sumiu", await clicar(page, cartao("baixa-sumiu")));
  await page.waitForTimeout(1500);
  ok("nada foi baixado — nem a página de erro com o nome certo", baixados.length === 0,
     JSON.stringify(baixados.map((b) => b.nome)));
  const f = await filme(page);
  ok("a faixa diz que não deu, com o número do depósito", /Não consegui baixar/.test(f) && /404/.test(f), f);
  ok("e não abre aba nenhuma", (await abertas(page)).length === 0, (await abertas(page)).join(", "));
}

console.log("\n6. O endereço do link também salva com o nome");
{
  // É ele que vale no Ctrl+clique, no clique do meio, no "Salvar link como…" —
  // tudo o que é do navegador e não passa pelo clique desta tela.
  const href = await page.locator(cartao("baixa-proc")).getAttribute("href").catch(() => "");
  ok("o endereço do link pede o nome ao depósito",
     href === `${DEPOSITO}/recebidos/3EB0C4AB12CD34EF56.pdf?download=0001.01%20-%20Procura%C3%A7%C3%A3o.pdf`, href);
  // UMA ABA NOVA NESSE ENDEREÇO, e não o Ctrl+clique: medido, o download de
  // uma aba aberta em segundo plano não chega ao Playwright (nem no Chromium
  // inteiro, onde a aba termina em `chrome-error://`). Abrir a aba no endereço
  // é o que o Ctrl+clique faz.
  const outra = await ctx.newPage();
  const pegou = [];
  outra.on("download", (d) => pegou.push(d.suggestedFilename()));
  await outra.goto(href).catch(() => {});
  await outra.waitForTimeout(1200);
  ok("e o depósito manda o nome, com o acento", pegou[0] === "0001.01 - Procuração.pdf", `veio "${pegou[0]}"`);
  await outra.close().catch(() => {});
}

console.log("\n7. Ler sem baixar: 'Abrir numa aba nova', só em documento");
{
  const abrirMenu = async (id) => {
    await page.locator(`[data-msg-id="${id}"]`).hover().catch(() => {});
    return clicar(page, `[data-msg-id="${id}"] button[aria-label="Opções da mensagem"]`);
  };
  ok("abri o menu do documento", await abrirMenu("baixa-proc"));
  ok("ele tem 'Abrir numa aba nova'", (await page.locator("[data-abrir-numa-aba]").count()) === 1);
  ok("cliquei", await clicar(page, "[data-abrir-numa-aba]"));
  const pedidas = await abertas(page);
  ok("pediu o endereço DE LER, sem o '?download='",
     pedidas[pedidas.length - 1] === `${DEPOSITO}/recebidos/3EB0C4AB12CD34EF56.pdf`, pedidas.join(", "));
  ok("o menu fechou", (await page.locator("[data-abrir-numa-aba]").count()) === 0);
  ok("abri o menu de uma mensagem de texto", await abrirMenu("baixa-texto"));
  ok("e ali ele não aparece", (await page.locator("[data-abrir-numa-aba]").count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  for (const p of abas.splice(0)) await p.close().catch(() => {});
}

console.log("\n8. A imagem ampliada baixa com o nome dela, ou com a data");
{
  baixados.length = 0;
  ok("ampliei a foto que tem nome", await clicar(page, `[data-msg-id="baixa-foto"] button[aria-label="Abrir a imagem em tela cheia"]`));
  ok("baixei", await clicar(page, 'button[title="Baixar imagem"]'));
  await esperarDownloads(baixados, 1);
  ok("com o nome que veio com ela", baixados[0]?.nome === "comprovante pix 0410.png", `veio "${baixados[0]?.nome}"`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("ampliei a foto sem nome", await clicar(page, `[data-msg-id="baixa-foto-sem-nome"] button[aria-label="Abrir a imagem em tela cheia"]`));
  ok("baixei", await clicar(page, 'button[title="Baixar imagem"]'));
  await esperarDownloads(baixados, 2);
  const esperado = `Imagem ${dataNoNome(NA_FOTO_SEM_NOME)}.png`;
  ok(`com a data da mensagem: '${esperado}'`, baixados[1]?.nome === esperado, `veio "${baixados[1]?.nome}"`);
  ok("e não um carimbo de milissegundos", !/\d{12,}/.test(baixados[1]?.nome || ""));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

console.log("\n9. No modo de seleção, o clique é da seleção");
{
  baixados.length = 0;
  await page.locator(`[data-msg-id="baixa-nosso"]`).hover().catch(() => {});
  ok("abri o menu do documento que nós mandamos",
     await clicar(page, `[data-msg-id="baixa-nosso"] button[aria-label="Opções da mensagem"]`));
  ok("e escolhi Apagar (liga a seleção)", await clicar(page, 'div[data-menu-msg] button:has-text("Apagar")'));
  ok("a seleção está ligada", (await page.locator('button[title="Cancelar seleção"]').count()) === 1);
  ok("cliquei no cartão", await clicar(page, cartao("baixa-nosso")));
  await page.waitForTimeout(1500);
  ok("e nada foi baixado", baixados.length === 0, JSON.stringify(baixados.map((b) => b.nome)));
  await clicar(page, 'button[title="Cancelar seleção"]');
  ok("fora da seleção, o mesmo cartão baixa", await clicar(page, cartao("baixa-nosso")));
  await esperarDownloads(baixados, 1);
  ok("com o nome que foi mandado", baixados[0]?.nome === "Acordo para assinar 5521.pdf", `veio "${baixados[0]?.nome}"`);
}

console.log("\n10. O acervo de mídias diz o nome, e baixa com ele");
{
  baixados.length = 0;
  const jaAbertas = (await abertas(page)).length;
  const abasAntes = abas.length;
  ok("abri o acervo", await clicar(page, '[title="Mídias, documentos e links"]'));
  ok("e a aba Documentos", await clicar(page, '[data-aba-das-midias="documentos"]'));
  await page.waitForTimeout(800);
  const linha = page.locator('[data-documento-do-acervo][data-nome-ao-baixar="0001.01 - Procuração.pdf"]');
  ok("a linha da procuração está lá", (await linha.count()) === 1);
  ok("escrevendo o nome, e não 'Documento'",
     /0001\.01 - Procuração/.test(await linha.first().innerText().catch(() => "")));
  ok("cliquei na linha", await clicar(page, '[data-documento-do-acervo][data-nome-ao-baixar="0001.01 - Procuração.pdf"]'));
  await esperarDownloads(baixados, 1);
  ok("baixou com o nome", baixados[0]?.nome === "0001.01 - Procuração.pdf", `veio "${baixados[0]?.nome}"`);
  // AS DUAS PORTAS DE UMA ABA NOVA: o `window.open` e o próprio link. Sem o
  // clique desta tela, o navegador segue o `href` numa aba — e, como o
  // endereço já pede o nome, o arquivo baixaria certo, e só a aba diria que
  // o clique não é o daqui. Foi uma sabotagem que vazou que ensinou isto.
  ok("sem aba nova — nem pelo `window.open`, nem pelo link",
     (await abertas(page)).length === jaAbertas && abas.length === abasAntes,
     `abertas: ${(await abertas(page)).length - jaAbertas}, abas: ${abas.length - abasAntes}`);
  ok("cliquei no extrato que demora",
     await clicar(page, '[data-documento-do-acervo][data-nome-ao-baixar="Extrato demorado 7788.pdf"]'));
  const linhaLenta = page.locator('[data-documento-do-acervo][data-nome-ao-baixar="Extrato demorado 7788.pdf"]');
  ok("a linha dele diz que está baixando",
     (await linhaLenta.getAttribute("data-documento-do-acervo").catch(() => null)) === "baixando"
       && /Baixando…/.test(await linhaLenta.innerText().catch(() => "")));
  await esperarDownloads(baixados, 2, 6000);
  ok("e baixou com o nome dele", baixados[1]?.nome === "Extrato demorado 7788.pdf", `veio "${baixados[1]?.nome}"`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

console.log("\n11. O que SAI daqui leva o nome original");
{
  // ENVIAR. O nome tem o que o depósito recusa numa chave (espaço, acento):
  // é por isso que o endereço é higienizado — e só ele.
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "0001.01 - Procuração 2209.pdf", mimeType: "application/pdf", buffer: PDF,
  });
  await page.waitForTimeout(500);
  ok("a prévia do anexo abriu", (await page.locator("[data-previa-anexo]").count()) === 1);
  ok("enviei", await clicar(page, '[data-previa-anexo] button[title*="Enviar"]'));
  await page.waitForTimeout(1200);
  const enviado = (await fila(page, ALVO)).find((x) => String(x.midia_url || "").includes("2209"));
  ok("o anexo entrou na fila", Boolean(enviado), JSON.stringify((await fila(page, ALVO)).slice(-2)));
  ok("com o nome ORIGINAL, que é o que o cliente recebe", enviado?.midia_nome === "0001.01 - Procuração 2209.pdf",
     `foi "${enviado?.midia_nome}"`);
  ok("e o endereço higienizado, que é o que o depósito aceita",
     /0001\.01_-_Procura_o_2209\.pdf$/.test(enviado?.midia_url || ""), enviado?.midia_url);

  // AGENDAR, pelo mesmo caminho do anexo.
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "Acordo assinado — João 3318.pdf", mimeType: "application/pdf", buffer: PDF,
  });
  await page.waitForTimeout(500);
  ok("a prévia abriu de novo", (await page.locator("[data-previa-anexo]").count()) === 1);
  ok("abri a janela da hora", await clicar(page, "[data-agendar-anexo]"));
  ok("escolhi amanhã às 14h", await clicar(page, '[data-agenda-rapida="amanha14"]'));
  ok("confirmei", await clicar(page, "[data-agenda-confirmar]"));
  await page.waitForTimeout(1000);
  const agendado = (await fila(page, ALVO)).find((x) => String(x.midia_url || "").includes("3318"));
  ok("o anexo agendado entrou na fila", Boolean(agendado));
  ok("com o nome original, travessão e acento", agendado?.midia_nome === "Acordo assinado — João 3318.pdf",
     `foi "${agendado?.midia_nome}"`);

  // ENCAMINHAR.
  await page.locator(`[data-msg-id="baixa-proc"]`).hover().catch(() => {});
  ok("abri o menu da procuração", await clicar(page, `[data-msg-id="baixa-proc"] button[aria-label="Opções da mensagem"]`));
  ok("Encaminhar", await clicar(page, 'div[data-menu-msg] button:has-text("Encaminhar")'));
  ok("para a outra conversa", await clicar(page, `[data-encaminhar-para="${OUTRA}"]`));
  await page.waitForTimeout(900);
  const encaminhado = (await fila(page, OUTRA)).find((x) => String(x.midia_url || "").includes("3EB0C4AB12CD34EF56"));
  ok("o documento entrou na fila da outra conversa", Boolean(encaminhado));
  ok("com o nome dele — sem isso o WhatsApp o chamava pelo fim do endereço",
     encaminhado?.midia_nome === "0001.01 - Procuração", `foi "${encaminhado?.midia_nome}"`);
}
ok("nada estourou na tela", estouros.length === 0, estouros.join(" | "));
await ctx.close();

console.log("\n12. Num banco sem a coluna do nome, o acervo abre como abria");
{
  const b = await abrirPainel({ bandeiras: { semColunas: { mensagens: ["midia_nome"] } } });
  ok("abri o acervo", await clicar(b.page, '[title="Mídias, documentos e links"]'));
  ok("e a aba Documentos", await clicar(b.page, '[data-aba-das-midias="documentos"]'));
  await b.page.waitForTimeout(800);
  ok("sem a frase de erro", (await b.page.locator("[data-erro-das-midias]").count()) === 0,
     await b.page.locator("[data-erro-das-midias]").innerText().catch(() => ""));
  ok("com os documentos na lista", (await b.page.locator("[data-documento-do-acervo]").count()) > 0);
  // O NOME NÃO SE CONFERE AQUI: a bancada devolve a linha inteira de
  // `mensagens` qualquer que seja a coluna pedida (só `zorvin_assuntos` está
  // em `COM_PROJECAO`), então o nome viria mesmo na segunda leitura. O que
  // esta cena guarda é o acervo ABRIR — sem a segunda leitura, a primeira
  // reprova com 42703 e a janela mostra a frase de erro.
  ok("e ainda baixando", await clicar(b.page, "[data-documento-do-acervo]"));
  await esperarDownloads(b.baixados, 1);
  ok("baixou um arquivo", b.baixados.length === 1, JSON.stringify(b.baixados.map((x) => x.nome)));
  ok("nada estourou na tela", b.estouros.length === 0, b.estouros.join(" | "));
  await b.ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
