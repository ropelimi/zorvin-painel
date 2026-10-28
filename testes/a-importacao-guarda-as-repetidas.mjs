// A IMPORTAÇÃO GUARDA AS MENSAGENS REPETIDAS (auditoria de 28/10)
//
// A importação de histórico (Configurações › Importar histórico) dá a cada
// mensagem uma chave — conversa, minuto, quem mandou e o texto — para que
// reimportar o mesmo arquivo não duplique nada. Só que a exportação do Android
// só tem o MINUTO, e três fotos mandadas no mesmo minuto viram, no arquivo,
// três linhas iguais ("📷 Foto (mídia não incluída…)"). Mesma chave: a
// gravação ficava com UMA, e as outras eram descartadas caladas. O "ok"
// repetido também. E o aviso no fim dizia "6 mensagens importadas" com três
// na conversa.
//
// O conserto põe na chave a ORDEM da repetição dentro do arquivo — a 2ª, a 3ª
// — e deixa a PRIMEIRA com a chave de sempre. É isso que faz reimportar um
// arquivo que já entrou antes do conserto não duplicar nada: as primeiras
// casam com o que já está no banco, e só as repetidas, que tinham se perdido,
// entram.
//
// O QUE ESTA PROVA GUARDA:
//   1. num arquivo novo, as seis linhas viram seis mensagens — e o número do
//      aviso é o que está na conversa;
//   2. reimportando um arquivo que já tinha entrado com a chave antiga, nada
//      fica em dobro, e as repetidas que faltavam entram;
//   3. reimportar de novo, já com o conserto, não muda nada.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// O FUSO É FIXO: a chave leva o horário em UTC, e "14:05" do arquivo é a hora
// do celular. Em São Paulo, 14:05 é 17:05 UTC — é com isso que a chave antiga
// é refeita aqui.
const CONTEXTO = { viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" };

/** A chave do painel, copiada de `hashCurto` (Painel.jsx). */
function hashCurto(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const FOTO = "📷 Foto (mídia não incluída na exportação)";
const EU = "Dr. Teste";

/** O arquivo, como o Android exporta: só o minuto. */
const arquivo = (cliente) => [
  `12/03/2024 14:05 - ${cliente}: IMG-20240312-WA0005.jpg (arquivo anexado)`,
  `12/03/2024 14:05 - ${cliente}: IMG-20240312-WA0006.jpg (arquivo anexado)`,
  `12/03/2024 14:05 - ${cliente}: IMG-20240312-WA0007.jpg (arquivo anexado)`,
  `12/03/2024 14:06 - ${EU}: ok`,
  `12/03/2024 14:06 - ${EU}: ok`,
  `12/03/2024 14:07 - ${cliente}: obrigada`,
].join("\n");

// AS PRIMEIRAS DE CADA REPETIÇÃO, gravadas com a CHAVE ANTIGA — como ficou no
// banco quem importou este arquivo antes do conserto.
const antiga = (conversa, iso, origem, texto) => ({
  id: `m-antiga-${hashCurto(iso + texto)}`, conversa_id: conversa, origem, tipo: "texto", texto,
  id_uazapi: "txt-" + hashCurto(`${conversa}|${iso}|${origem}|${texto.slice(0, 80)}`),
  status: origem === "advogado" ? "enviada" : "recebida", criado_em: iso,
  enviado_por: origem === "advogado" ? EU : null,
});

/** O telefone que o painel abre — é o dono das conversas importadas. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext(CONTEXTO);
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const ADV = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const SEMENTE = {
  contatos: [{ id: "ct-rep", numero: "5511970005501", nome: "MARIA REPETIDA" }],
  conversas: [{ id: "cv-rep", advogado_id: ADV, contato_id: "ct-rep", nao_lidas: 0, arquivada: false,
                fixada: false, favorita: false, ultima_atividade: "2024-03-12T17:07:00.000Z",
                esperando_desde: null, ultima_mensagem: "obrigada",
                contato: { id: "ct-rep", nome: "MARIA REPETIDA", numero: "5511970005501", foto_url: null } }],
  mensagens: [
    antiga("cv-rep", "2024-03-12T17:05:00.000Z", "contato", FOTO),
    antiga("cv-rep", "2024-03-12T17:06:00.000Z", "advogado", "ok"),
    antiga("cv-rep", "2024-03-12T17:07:00.000Z", "contato", "obrigada"),
  ],
};

const ctx = await nav.newContext(CONTEXTO);
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.addInitScript((d) => {
  globalThis.__SEMENTE = d.semente;
  globalThis.__FILME = [];
  setInterval(() => {
    const el = document.querySelector("[data-aviso]");
    const t = el ? el.innerText.trim() : "";
    if (t && globalThis.__FILME[globalThis.__FILME.length - 1] !== t) globalThis.__FILME.push(t);
  }, 50);
}, { semente: SEMENTE });
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);

/** Sobe os arquivos (`[[cliente, número], …]`), preenche o que falta e
 *  importa. Devolve se chegou a apertar "Importar tudo". */
async function importar(quais) {
  await page.evaluate(() => { globalThis.__FILME = []; });
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Importar histórico" }).click();
  await page.waitForTimeout(400);
  await page.locator("select").first().selectOption(String(ADV));
  await page.locator('input[type="file"][accept^=".txt"]').setInputFiles(quais.map(([cliente]) => (
    { name: `Conversa do WhatsApp com ${cliente}.txt`, mimeType: "text/plain", buffer: Buffer.from(arquivo(cliente)) })));
  await page.waitForTimeout(1500);
  const numeros = page.locator('input[placeholder="Número (ex.: 5511999999999)"]');
  if ((await numeros.count()) !== quais.length) return false;
  for (let i = 0; i < quais.length; i++) await numeros.nth(i).fill(quais[i][1]);
  const meu = page.locator("select").nth(1);
  if (await meu.count()) await meu.selectOption(EU).catch(() => {});
  const botao = page.getByRole("button", { name: "Importar tudo" });
  if (!(await botao.count()) || await botao.isDisabled()) return false;
  await botao.click();
  await page.waitForTimeout(3000);
  return true;
}
const NOVA = ["Maria Nova", "5511970005502"];
const REPETIDA = ["Maria Repetida", "5511970005501"];

/** As mensagens da conversa deste número, no telefone que abre. */
const daConversa = (numero) => page.evaluate(([n, adv]) => {
  const T = globalThis.__TABELAS;
  const ct = (T.contatos || []).find((c) => c.numero === n);
  const cv = ct && (T.conversas || []).find((c) => String(c.contato_id) === String(ct.id) && String(c.advogado_id) === String(adv));
  return cv ? (T.mensagens || []).filter((m) => String(m.conversa_id) === String(cv.id))
    .map((m) => `${m.criado_em.slice(11, 16)} ${m.origem} ${m.texto}`).sort() : null;
}, [numero, ADV]);
const contar = (lista, trecho) => (lista || []).filter((l) => l.includes(trecho)).length;

console.log("\nUm arquivo novo: as seis linhas viram seis mensagens");
{
  ok("cheguei a apertar Importar tudo", await importar([NOVA]));
  const nova = await daConversa(NOVA[1]);
  ok("a conversa nova foi criada", Array.isArray(nova), String(nova));
  ok("as três fotos do mesmo minuto ficaram as três", contar(nova, "Foto") === 3, JSON.stringify(nova));
  ok('os dois "ok" do mesmo minuto ficaram os dois', contar(nova, " ok") === 2, JSON.stringify(nova));
  ok("seis mensagens no total", (nova || []).length === 6, JSON.stringify(nova));
  // O AVISO E A CONVERSA DIZEM O MESMO NÚMERO. Antes, o aviso dizia seis e a
  // conversa tinha três.
  const avisos = await page.evaluate(() => globalThis.__FILME.join(" ‖ "));
  const n = Number((/(\d+) mensagens importadas/.exec(avisos) || [])[1]);
  ok("e o aviso diz o número que está na conversa", n === (nova || []).length && n > 0,
     `aviso: "${avisos}" · na conversa: ${(nova || []).length}`);
}

console.log("\nO arquivo que já tinha entrado antes do conserto não duplica");
{
  ok("cheguei a apertar Importar tudo", await importar([REPETIDA]));
  const rep = await daConversa(REPETIDA[1]);
  ok("nenhuma mensagem em dobro: seis, e não nove", (rep || []).length === 6, JSON.stringify(rep));
  ok("as fotos são três (a antiga e as duas que tinham se perdido)", contar(rep, "Foto") === 3, JSON.stringify(rep));
  ok('os "ok" são dois', contar(rep, " ok") === 2, JSON.stringify(rep));
  ok('e o "obrigada", um só', contar(rep, "obrigada") === 1, JSON.stringify(rep));
}

console.log("\nReimportar os dois de novo, já com o conserto, não muda nada");
{
  ok("cheguei a apertar Importar tudo de novo", await importar([NOVA, REPETIDA]));
  const rep = await daConversa(REPETIDA[1]);
  const nova = await daConversa(NOVA[1]);
  ok("as duas conversas continuam com seis", (rep || []).length === 6 && (nova || []).length === 6,
     `${(rep || []).length} e ${(nova || []).length}`);
}

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
