// PRÉVIA DE DOCUMENTO — e a etiqueta de quem não tem prévia possível.
//
// A imagem sempre teve prévia; todo o resto virava um retângulo cinza com
// "Documento" escrito dentro. Numa banca isso pesa: o que chega o dia inteiro é
// PDF — procuração, contrato, extrato, comprovante, intimação — e "Documento"
// não distingue a procuração que se estava esperando do panfleto que alguém
// encaminhou. Quem atende abre um por um para descobrir.
//
// O QUE ESTA PROVA NÃO DEIXA PASSAR, e as duas metades importam igualmente:
//
//   1. o PDF SEM prévia — o defeito que se está corrigindo;
//   2. a planilha COM prévia — um `<iframe>` apontando para um .xlsx desenha
//      um retângulo em branco ou dispara um download, e as duas coisas são
//      piores do que o cartão honesto que estava lá antes.
//
// Sem as duas, a prova não separa nada: com só a primeira, um código que
// desenhasse prévia para tudo passaria; com só a segunda, um que não
// desenhasse nada passaria também.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { comoPrever, nomeDoTipo, tamanhoLegivel, extensaoDe, oQuadroDesenha } from "../src/arquivos.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

console.log("\nO que dá para mostrar, e o que não dá");
{
  ok("PDF dá para mostrar", comoPrever("application/pdf", "x.pdf") === "pdf");
  ok("imagem dá", comoPrever("image/png", "x.png") === "imagem");
  ok("texto dá", comoPrever("text/plain", "x.txt") === "texto");

  // O QUE NÃO TEM LEITOR NO NAVEGADOR FICA DE FORA, e é a metade que protege.
  // Um `<iframe>` apontando para um .xlsx desenha branco ou dispara download.
  for (const [mime, nome] of [
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "a.xlsx"],
    ["application/msword", "a.doc"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx"],
    ["application/zip", "a.zip"],
  ]) {
    ok(`${nome} NÃO tem prévia`, comoPrever(mime, nome) === null, `${mime}`);
  }

  // O MIME MANDA, MAS O NOME SALVA. O WhatsApp manda anexo com
  // `application/octet-stream` mais vezes do que se gostaria, e aí só a
  // extensão sabe que aquilo é um PDF. Sem este caminho, o caso mais comum de
  // todos ficaria justamente sem prévia.
  ok("PDF disfarçado de octet-stream ainda é reconhecido pelo nome",
     comoPrever("application/octet-stream", "procuracao.pdf") === "pdf");
  ok("e sem nome nem mime, não inventa",
     comoPrever("", "") === null);
  ok("nome sem extensão não vira palpite",
     comoPrever("application/octet-stream", "arquivo") === null);
}

console.log("\nO que o QUADRO faz com o arquivo — e não o que o arquivo é");
{
  // RELATO DE 29/09: abrir a conversa baixava arquivos sozinho. `comoPrever`
  // diz que um `.pdf` é PDF pelo nome, e está certo; o iframe, porém, obedece
  // ao tipo que o SERVIDOR diz. Por isso a segunda pergunta existe.
  ok("PDF servido como PDF, com leitor ligado: desenha",
     oQuadroDesenha("pdf", "application/pdf", true) === true);
  ok("navegador que nem conhece o leitor fica com o que sempre fez",
     oQuadroDesenha("pdf", "application/pdf", undefined) === true);
  ok("PDF servido como octet-stream: NÃO desenha — o iframe baixaria",
     oQuadroDesenha("pdf", "application/octet-stream", true) === false);
  ok("tipo desconhecido (não deu para perguntar): NÃO desenha",
     oQuadroDesenha("pdf", null, true) === false);
  ok("Chrome em 'baixar PDFs em vez de abrir': NÃO desenha",
     oQuadroDesenha("pdf", "application/pdf", false) === false);
  ok("e texto nunca vai para o quadro, nem servido como texto",
     oQuadroDesenha("texto", "text/plain", true) === false);
}

console.log("\nO tipo dito por extenso");
{
  ok("planilha é chamada de planilha", nomeDoTipo("", "orcamento.xlsx") === "Planilha do Excel");
  ok("documento do Word também", nomeDoTipo("", "peticao.docx") === "Documento do Word");
  ok("PDF é PDF", nomeDoTipo("application/pdf", "x.pdf") === "PDF");
  // NA DÚVIDA, "Arquivo" — e não um palpite. Rótulo errado é pior que genérico,
  // porque ele é acreditado.
  ok("extensão desconhecida vira 'Arquivo', e não um chute",
     nomeDoTipo("", "coisa.qwerty") === "Arquivo");
  ok("a extensão é lida sem o ponto e em minúsculas",
     extensaoDe("Procuracao.PDF") === "pdf");
}

console.log("\nO tamanho legível");
{
  ok("bytes", tamanhoLegivel(900) === "900 B");
  ok("quilobytes", tamanhoLegivel(2048) === "2 KB");
  ok("megabytes com vírgula, como se escreve aqui",
     tamanhoLegivel(1500000) === "1,4 MB");
  // TAMANHO DESCONHECIDO SAI EM BRANCO, e não "0 KB": zero faria um anexo de
  // tamanho desconhecido parecer um anexo vazio.
  ok("tamanho desconhecido sai em branco, e não zero",
     tamanhoLegivel(undefined) === "" && tamanhoLegivel(0) === "");
}

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
// O ESPIÃO DO DEFEITO. Todo download que a página disparar — de qualquer
// quadro dentro dela — cai aqui. Ninguém nesta prova clica em baixar nada,
// então a lista tem de terminar vazia.
const baixados = [];
page.on("download", (d) => baixados.push(d.suggestedFilename()));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);
// A conversa que tem os anexos.
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(1800);

// A PRÉVIA NASCE QUANDO A BOLHA CHEGA PERTO DA TELA. Então a prova rola até
// cada documento, como quem lê a conversa — e é assim que o defeito aparecia:
// o iframe nascia, e o Chrome pedia para salvar.
const docs = page.locator("[data-doc-tipo]");
const quantosDocs = await docs.count();
for (let i = 0; i < quantosDocs; i++) {
  await docs.nth(i).scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1200);

/** Para cada documento da conversa: o nome, a prévia e se há um iframe. */
const porDocumento = () => page.evaluate(() =>
  [...document.querySelectorAll("[data-doc-tipo]")].map((t) => {
    const a = t.closest("a");
    const p = a && a.querySelector("[data-previa-arquivo]");
    return {
      nome: (a && a.innerText.split("\n").find((l) => /\.\w{2,4}$/.test(l.trim())) || "").trim(),
      previa: p ? p.getAttribute("data-previa-arquivo") : null,
      quadro: !!(p && p.querySelector("iframe")),
      texto: p ? p.innerText.slice(0, 200) : "",
      link: !!(a && a.getAttribute("href")),
    };
  }));
const vistos = await porDocumento();
const doc = (re) => vistos.find((v) => re.test(v.nome));
console.log("     " + JSON.stringify(vistos.map((v) => `${v.nome}:${v.previa}${v.quadro ? "+quadro" : ""}`)));

console.log("\nNa conversa");
{
  ok("os quatro documentos da bancada estão na conversa", quantosDocs >= 4,
     `vi ${quantosDocs}`);

  // A CONFERÊNCIA QUE IMPORTA. Relato de 29/09, com foto: "só de abrir a
  // conversa isso está acontecendo". Nada foi clicado até aqui.
  ok("abrir a conversa e ler até o fim NÃO baixa arquivo nenhum",
     baixados.length === 0, JSON.stringify(baixados));

  // O PDF CERTO DEPENDE DO NAVEGADOR, e a prova confere os dois mundos. Com
  // leitor, ele ganha a primeira página. SEM leitor — e é o caso da
  // integração contínua, que roda num Chromium sem leitor de PDF, e o de quem
  // escolheu "baixar PDFs em vez de abrir" —, o iframe BAIXARIA até o PDF
  // certo, e por isso ele não nasce. Escrevi primeiro só a primeira metade:
  // passou aqui, num Chrome com leitor, e reprovou na integração contínua,
  // que tinha razão.
  const temLeitor = await page.evaluate(() => navigator.pdfViewerEnabled);
  if (temLeitor === false) {
    ok("sem leitor de PDF no navegador, o PDF NÃO ganha iframe — ele baixaria",
       doc(/procuracao\.pdf/) && doc(/procuracao\.pdf/).quadro === false,
       JSON.stringify(doc(/procuracao/)));
  } else {
    ok("o PDF ganha prévia, desenhada pelo leitor do navegador",
       doc(/procuracao\.pdf/)?.previa === "pdf" && doc(/procuracao\.pdf/)?.quadro === true,
       JSON.stringify(doc(/procuracao/)));
  }

  // A METADE QUE PROTEGE: o que não tem leitor fica sem prévia.
  ok("a planilha do Excel NÃO ganha", doc(/orcamento\.xlsx/)?.previa === null,
     JSON.stringify(doc(/orcamento/)));

  // O PDF SEM TIPO. `comoPrever` reconhece pelo nome, e está certo — mas o
  // servidor diz octet-stream, e o iframe baixaria. Sem prévia, com o cartão
  // dizendo "PDF", ele continua abrindo com um clique.
  ok("o PDF servido sem tipo NÃO ganha iframe — era um dos que baixavam",
     doc(/comprovante\.pdf/) && doc(/comprovante\.pdf/).quadro === false,
     JSON.stringify(doc(/comprovante/)));
  ok("e o cartão dele continua dizendo que é um PDF",
     (await page.evaluate(() => [...document.querySelectorAll("[data-doc-tipo]")]
       .map((e) => e.getAttribute("data-doc-tipo")))).filter((t) => t === "PDF").length >= 2);

  // O CSV. É o arquivo da foto do relato — "Microsoft Excel Comma Separated
  // Values File". Ele ganha prévia, e ela é ESCRITA: o texto lido, e não um
  // quadro.
  ok("o CSV ganha prévia de texto, sem iframe",
     doc(/extrato\.csv/)?.previa === "texto" && doc(/extrato\.csv/)?.quadro === false,
     JSON.stringify(doc(/extrato/)));
  ok("e a prévia mostra o que está DENTRO do arquivo",
     /Saldo inicial/.test(doc(/extrato\.csv/)?.texto || ""),
     JSON.stringify(doc(/extrato/)?.texto));

  // A PRÉVIA NÃO PODE ROUBAR O CLIQUE. Ela mora dentro do link que baixa o
  // arquivo; um iframe que aceita clique engole o clique do link, e um que
  // rola faz a roda do mouse parar a conversa para rolar um PDF sem querer.
  //
  // CADA PRÉVIA QUE EXISTE é conferida — e o TAMANHO vai junto: numa lista
  // vazia `.every` diria que sim sem ter olhado nada. A do texto sempre
  // existe; a do PDF só com leitor.
  const cliques = await page.evaluate(() =>
    [...document.querySelectorAll('[data-previa-arquivo="pdf"] iframe, [data-previa-arquivo="texto"] pre')]
      .map((e) => getComputedStyle(e).pointerEvents));
  ok("nenhuma prévia engole o clique do link",
     cliques.length >= (temLeitor === false ? 1 : 2) && cliques.every((c) => c === "none"),
     JSON.stringify(cliques));

  // E O ARQUIVO CONTINUA BAIXÁVEL, com ou sem prévia: a prévia é um
  // acréscimo, não uma troca — e o PDF que ficou sem ela é justamente o que
  // mais precisa do clique.
  ok("e todo documento continua abrindo com um clique",
     vistos.length >= 4 && vistos.every((v) => v.link), JSON.stringify(vistos.map((v) => v.link)));
}

console.log("\nO navegador que BAIXA PDFs em vez de abrir");
{
  // No Chrome dá para escolher "baixar PDFs em vez de abrir", e aí o iframe
  // baixaria até o PDF servido como PDF. A cena força esse mundo, para que ele
  // seja conferido também numa máquina que tem leitor — senão ele só seria
  // visto na integração contínua, por acaso.
  const ctx2 = await nav.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  await ctx2.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", { get: () => false, configurable: true });
  });
  const p2 = await ctx2.newPage();
  const baixados2 = [];
  p2.on("download", (d) => baixados2.push(d.suggestedFilename()));
  await p2.goto(ENDERECO);
  await p2.waitForSelector("[data-conversa-nome]");
  await p2.waitForTimeout(1200);
  await p2.locator("[data-conversa-nome]").first().click();
  await p2.waitForTimeout(1500);
  const d2 = p2.locator("[data-doc-tipo]");
  const n2 = await d2.count();
  for (let i = 0; i < n2; i++) {
    await d2.nth(i).scrollIntoViewIfNeeded().catch(() => {});
    await p2.waitForTimeout(400);
  }
  await p2.waitForTimeout(1000);
  const quadros = await p2.evaluate(() => document.querySelectorAll("[data-previa-arquivo] iframe").length);
  ok("a cena viu os documentos", n2 >= 4, `vi ${n2}`);
  ok("sem leitor de PDF, nenhum iframe nasce", quadros === 0, `nasceram ${quadros}`);
  ok("e nada é baixado", baixados2.length === 0, JSON.stringify(baixados2));
  await ctx2.close();
}

console.log("\nE a prévia antes de MANDAR, com um CSV escolhido");
{
  // A segunda cópia do mesmo iframe morava na prévia do anexo que se vai
  // mandar. Escolher um CSV para mandar a um cliente baixava o arquivo de
  // volta para a própria máquina.
  const antes = baixados.length;
  const campo = page.locator('input[type="file"][multiple]');
  if (await campo.count() > 0) {
    await campo.first().setInputFiles({
      name: "planilha-do-acordo.csv", mimeType: "text/csv",
      buffer: Buffer.from("parcela;valor\n1;500,00\n2;500,00\n"),
    });
    await page.waitForTimeout(1500);
  }
  const previa = page.locator("[data-previa-anexo]");
  ok("a prévia do anexo abriu", await previa.count() === 1);
  ok("e escolher o CSV NÃO baixa nada", baixados.length === antes,
     JSON.stringify(baixados.slice(antes)));
  const dentro = await page.evaluate(() => {
    const p = document.querySelector('[data-previa-anexo] [data-previa-arquivo]');
    return p ? { como: p.getAttribute("data-previa-arquivo"), texto: p.innerText.slice(0, 120),
                 quadro: !!p.querySelector("iframe") } : null;
  });
  ok("e mostra o conteúdo escrito, sem quadro",
     dentro?.como === "texto" && !dentro.quadro && /parcela/.test(dentro.texto),
     JSON.stringify(dentro));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.slice(0, 2).join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
