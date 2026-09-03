// A BUSCA ACHA AS CONVERSAS ARQUIVADAS.
//
// RELATO DE QUEM USA: "a busca não está encontrando as conversas arquivadas,
// corrija isso".
//
// A tela tinha uma regra só, aplicada em dois lugares que pedem coisas
// diferentes:
//
//     !!c.arquivada === verArquivadas
//
// Para a LISTA ela está certa: fora da pasta, arquivada não aparece — é o que
// arquivar quer dizer. Durante a BUSCA ela vira outra coisa: quem procura um
// cliente arquivado meses atrás recebe "Nada encontrado para essa busca".
//
// E isso não é uma tela vazia, é uma RESPOSTA. Quem lê "nada encontrado"
// conclui que o cliente não está no Zorvin — e vai procurar noutro lugar, ou
// cadastra de novo o que já existe.
//
// O BANCO NUNCA ESCONDEU NADA. A função `buscar_conversas` devolve as
// arquivadas: o SQL dela não tem filtro nenhum de `arquivada`. Era a tela que
// as jogava fora depois de o banco já as ter encontrado — o pior lugar para se
// perder um resultado, porque tudo antes dele funcionou.
//
// POR QUE A BANCADA NÃO PEGAVA ISTO: ela não tinha uma única conversa
// arquivada. Todas nasciam com `arquivada: false`, e uma bancada onde o estado
// não existe é uma bancada que aprova o defeito. A conversa arquivada foi
// criada com esta prova.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { NOME_ARQUIVADA, TEXTO_NA_ARQUIVADA } from "../src/bancada.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(ENDERECO);
await page.waitForSelector('input[placeholder*="Buscar por nome"]');
await page.waitForTimeout(1500);

const caixa = page.locator('input[placeholder*="Buscar por nome"]');

async function procurar(termo) {
  await caixa.fill("");
  await page.waitForTimeout(150);
  await caixa.fill(termo);
  await page.waitForTimeout(1800);
  return page.evaluate(() => [...document.querySelectorAll("[data-conversa-nome]")]
    .map((e) => e.getAttribute("data-conversa-nome")));
}

/** Troca para o telefone "Arquivo" (a13), onde a conversa arquivada mora. */
async function irParaOFundo() {
  const alvo = page.locator('[data-telefone="Arquivo"]');
  if (!(await alvo.count())) throw new Error('não achei o telefone "Arquivo" na tela');
  await alvo.first().click();
  await page.waitForTimeout(2500);
}

console.log("\nA busca acha as conversas arquivadas");

// ------------------------------------------------------------
//  O RETRATO DE ANTES: ela NÃO está na lista comum
//
//  Esta conferência é a que dá sentido às outras. Se a conversa arquivada
//  aparecesse na lista normal, achá-la na busca não provaria nada — e a
//  correção teria quebrado o que arquivar significa.
// ------------------------------------------------------------
await irParaOFundo();
const semBusca = await page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-nome")));
ok("sem busca, a conversa arquivada NÃO aparece na lista",
   !semBusca.includes(NOME_ARQUIVADA),
   `apareceu entre ${semBusca.length} linhas`);

// ------------------------------------------------------------
//  PELO NOME
// ------------------------------------------------------------
const porNome = await procurar("ARQUIVADO NEVES");
ok("procurando pelo nome, ela aparece",
   porNome.includes(NOME_ARQUIVADA),
   `vieram: ${JSON.stringify(porNome.slice(0, 6))}`);

// ------------------------------------------------------------
//  E A LINHA DIZ QUE ESTÁ ARQUIVADA
//
//  Sem o selo, ela aparece ao procurar, some quando a busca é apagada, e
//  parece defeito. O selo é o que faz o resultado ser compreensível.
// ------------------------------------------------------------
const temSelo = await page.evaluate(() => {
  const linhas = [...document.querySelectorAll("[data-conversa-nome]")];
  const alvo = linhas.find((e) => e.getAttribute("data-conversa-nome") === "OTAVIO ARQUIVADO NEVES");
  return !!(alvo && alvo.querySelector("[data-selo-arquivada]"));
});
ok("e a linha diz, com um selo, que ela está arquivada", temSelo);

// ------------------------------------------------------------
//  PELO TEXTO DE DENTRO
//
//  É o caminho caro — a varredura das mensagens — e o que mais importa: quem
//  não lembra o nome do cliente lembra do que foi combinado.
// ------------------------------------------------------------
const porTexto = await procurar(TEXTO_NA_ARQUIVADA);
ok("procurando pelo que foi dito dentro dela, ela também aparece",
   porTexto.includes(NOME_ARQUIVADA),
   `vieram: ${JSON.stringify(porTexto.slice(0, 6))}`);

// ------------------------------------------------------------
//  APAGAR A BUSCA A DEVOLVE PARA A PASTA
//
//  A metade que protege: se ela ficasse na lista depois da busca, arquivar
//  teria deixado de querer dizer alguma coisa. Mostrar e não tirar é o defeito
//  oposto, e seria pior — a pasta de arquivadas existe para tirar da frente.
// ------------------------------------------------------------
await caixa.fill("");
await page.waitForTimeout(1200);
const depois = await page.evaluate(() =>
  [...document.querySelectorAll("[data-conversa-nome]")].map((e) => e.getAttribute("data-conversa-nome")));
ok("apagando a busca, ela volta para a pasta e sai da lista",
   !depois.includes(NOME_ARQUIVADA),
   `continuou entre ${depois.length} linhas`);

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
await nav.close();
process.exit(falhas ? 1 : 0);
