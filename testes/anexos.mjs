// AS TRÊS PORTAS DE ANEXAR UM ARQUIVO.
//
// O relato veio de um advogado, no canal do escritório: "Estou com
// dificuldade de enviar anexos pelo Zorvin". Ele usou o clipe, escolheu o
// arquivo, e não aconteceu nada — sem erro, sem aviso, sem prévia. Arrastando
// funcionou.
//
// O código diz, num comentário, que "o clipe, o Ctrl+V e o arrastar caem todos
// aqui, então as três portas se comportam igual". Duas se comportavam; a
// terceira não, e nenhuma prova olhava para nenhuma delas. Um comentário não é
// uma garantia — esta prova é.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);
await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("textarea");
await page.waitForTimeout(600);

const previa = page.locator("[data-previa-anexo]");

/** Fecha a prévia, se estiver aberta, e confere que fechou. */
async function limpar() {
  for (let i = 0; i < 6; i++) {
    if (await previa.count() === 0) return true;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  return false;
}

/** Solta arquivos na conversa como se viessem do gerenciador de arquivos. */
async function soltarNaConversa(nomes) {
  await page.evaluate((lista) => {
    const dt = new DataTransfer();
    for (const nome of lista) {
      dt.items.add(new File(["conteudo"], nome, { type: "text/plain" }));
    }
    document.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, nomes);
}

/** Cola um arquivo, como quem dá Ctrl+V depois de um print. */
async function colarNaConversa(nome) {
  await page.evaluate((n) => {
    const dt = new DataTransfer();
    dt.items.add(new File(["conteudo"], n, { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, nome);
}

console.log("\nO clipe — a porta do relato");
{
  // `setInputFiles` faz exatamente o que o gerenciador de arquivos do sistema
  // faz: põe o arquivo no campo escondido e dispara o `change`. É o caminho
  // de verdade, e não uma chamada direta à função de dentro.
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "peticao.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 de mentira"),
  });
  await page.waitForTimeout(600);

  ok("escolher um arquivo abre a prévia", await previa.count() === 1,
     "era isto que não acontecia: nada, sem erro nem aviso");
  const texto = (await previa.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("com o nome do arquivo escolhido", /peticao\.pdf/.test(texto), `dizia: "${texto}"`);
  ok("e com o botão de enviar",
     await previa.locator('button[title*="Enviar"]').count() > 0);
  ok("dá para fechar a prévia", await limpar());
}

console.log("\nE apertar Enviar manda mesmo");
{
  // O relato terminava em "o arquivo não é enviado para o contato". A prévia
  // não abrir já explicava aquilo — mas conferir só a prévia deixaria a
  // metade que importa sem prova: o que a pessoa quer é o arquivo do outro
  // lado, não uma janela bonita.
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "contrato.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
  });
  await page.waitForTimeout(600);
  const antes = await page.locator("[data-msg-id]").count();
  await previa.locator('button[title*="Enviar"]').first().click();
  await page.waitForTimeout(1500);
  ok("a prévia fecha ao enviar", await previa.count() === 0);
  ok("e aparece uma bolha nova na conversa",
     await page.locator("[data-msg-id]").count() > antes,
     "sem bolha, quem enviou não tem como saber se saiu");
  const corpo = await page.locator("body").innerText();
  ok("com o nome do arquivo", /contrato\.pdf/.test(corpo));
  await limpar();
}

console.log("\nO clipe, duas vezes seguidas com o MESMO arquivo");
{
  // O campo é limpo depois de cada escolha justamente para isto: sem limpar,
  // escolher o mesmo arquivo de novo não dispara nada, porque para o navegador
  // o valor não mudou. É a limpeza que quebrou a primeira escolha — e a prova
  // precisa cobrir as duas coisas, senão o conserto de uma estraga a outra.
  const escolher = () => page.setInputFiles('input[type="file"][multiple]', {
    name: "mesmo.pdf", mimeType: "application/pdf", buffer: Buffer.from("igual"),
  });

  await escolher();
  await page.waitForTimeout(500);
  ok("a primeira vez abre", await previa.count() === 1);
  await limpar();

  await escolher();
  await page.waitForTimeout(500);
  ok("e o MESMO arquivo de novo também abre", await previa.count() === 1,
     "sem limpar o campo, o navegador não avisa que houve escolha");
  await limpar();
}

console.log("\nVários arquivos de uma vez");
{
  await page.setInputFiles('input[type="file"][multiple]', [
    { name: "um.pdf", mimeType: "application/pdf", buffer: Buffer.from("a") },
    { name: "dois.png", mimeType: "image/png", buffer: Buffer.from("b") },
    { name: "tres.txt", mimeType: "text/plain", buffer: Buffer.from("c") },
  ]);
  await page.waitForTimeout(700);
  ok("três arquivos abrem a prévia", await previa.count() === 1);
  const texto = (await previa.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("e a prévia diz que são três",
     /3/.test(texto) || /Enviar os 3/i.test(texto), `dizia: "${texto}"`);
  await limpar();
}

console.log("\nArrastar — a porta que funcionava");
{
  await soltarNaConversa(["arrastado.txt"]);
  await page.waitForTimeout(600);
  ok("arrastar abre a prévia", await previa.count() === 1);
  const texto = (await previa.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("com o nome do arquivo", /arrastado\.txt/.test(texto), `dizia: "${texto}"`);
  await limpar();
}

console.log("\nColar — a terceira porta");
{
  await colarNaConversa("print.png");
  await page.waitForTimeout(600);
  ok("colar abre a prévia", await previa.count() === 1);
  await limpar();
}

console.log("\nAs três portas terminam no mesmo lugar");
{
  // O que se ganha juntando-as: uma correção numa vale nas três, e uma quebra
  // numa reprova aqui. Foi a falta disto que deixou o clipe quebrado sem
  // ninguém notar — o arrastar continuava funcionando, e "o Zorvin anexa" era
  // verdade em dois terços.
  const nomes = [];
  await page.setInputFiles('input[type="file"][multiple]',
    { name: "pelo-clipe.pdf", mimeType: "application/pdf", buffer: Buffer.from("a") });
  await page.waitForTimeout(500);
  nomes.push((await previa.innerText().catch(() => "")).includes("pelo-clipe.pdf"));
  await limpar();

  await soltarNaConversa(["pelo-arrasto.txt"]);
  await page.waitForTimeout(500);
  nomes.push((await previa.innerText().catch(() => "")).includes("pelo-arrasto.txt"));
  await limpar();

  // OS DOIS CAMINHOS, e o número deles na própria condição: `[].every(...)` é
  // verdade, então sem o tamanho um `push` que deixasse de acontecer passaria
  // por "os dois caminhos funcionam".
  ok("clipe e arrasto abrem a MESMA prévia, com o mesmo desfecho",
     nomes.length === 2 && nomes.every(Boolean), JSON.stringify(nomes));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
