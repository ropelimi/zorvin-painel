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
import { comoPrever, nomeDoTipo, tamanhoLegivel, extensaoDe } from "../src/arquivos.js";

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
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);
// A conversa que tem os dois anexos.
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(1800);

console.log("\nNa conversa");
{
  const previas = await page.evaluate(() =>
    [...document.querySelectorAll("[data-previa-arquivo]")]
      .map((e) => e.getAttribute("data-previa-arquivo")));
  ok("o PDF ganha prévia", previas.includes("pdf"), JSON.stringify(previas));

  // A OUTRA METADE. Se aparecesse prévia para tudo, esta lista teria duas.
  ok("e a planilha NÃO ganha", previas.filter((p) => p !== "imagem").length === 1,
     JSON.stringify(previas));

  const tipos = await page.evaluate(() =>
    [...document.querySelectorAll("[data-doc-tipo]")]
      .map((e) => e.getAttribute("data-doc-tipo")));
  ok("o cartão do PDF diz que é um PDF", tipos.includes("PDF"), JSON.stringify(tipos));
  ok("e o da planilha diz que é uma planilha",
     tipos.includes("Planilha do Excel"), JSON.stringify(tipos));

  // A PRÉVIA NÃO PODE ROUBAR O CLIQUE. Ela mora dentro do link que baixa o
  // arquivo; um iframe que aceita clique engole o clique do link, e um que
  // rola faz a roda do mouse parar a conversa para rolar um PDF sem querer.
  const passaClique = await page.evaluate(() => {
    const el = document.querySelector('[data-previa-arquivo="pdf"] iframe');
    return el ? getComputedStyle(el).pointerEvents : null;
  });
  ok("a prévia não engole o clique do link", passaClique === "none", String(passaClique));

  // E O ARQUIVO CONTINUA BAIXÁVEL: a prévia é um acréscimo, não uma troca.
  const temLink = await page.evaluate(() => {
    const p = document.querySelector('[data-previa-arquivo="pdf"]');
    return !!(p && p.closest("a") && p.closest("a").getAttribute("href"));
  });
  ok("e o documento continua abrindo com um clique", temLink);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.slice(0, 2).join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
