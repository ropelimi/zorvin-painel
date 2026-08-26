// OS SELOS DA BARRA LATERAL — quanto custa cada mensagem que chega.
//
// Relato do escritório: "o sistema Zorvin está lento". Não havia uma consulta
// lenta para achar; havia uma multidão de consultas pequenas, e ela não
// aparecia em lugar nenhum porque cada uma, sozinha, é rápida.
//
// O QUE FOI MEDIDO ANTES DO CONSERTO, na bancada, com treze telefones:
//
//     1 mensagem  ->  31 idas ao banco
//     5 mensagens -> 155 idas ao banco
//    20 mensagens -> 620 idas ao banco
//
// Linear, e por dois motivos que se multiplicam:
//
//   * a contagem dos selos era UMA CONSULTA POR TELEFONE (treze), mais duas
//     das arquivadas — quinze viagens à internet para produzir treze números;
//
//   * e ela era refeita A CADA MENSAGEM, duas vezes: o Supabase avisa a
//     mensagem nova (INSERT em `mensagens`) E a conversa mudada (UPDATE em
//     `conversas`), e os dois tratadores mandavam recontar.
//
// Em cada aba aberta do escritório. É isso que engasga a tela no movimento.
//
// O CONSERTO SÃO DUAS COISAS, e esta prova cobre as duas:
//
//   1. a contagem virou UMA chamada de função no banco (`group by`), com o
//      caminho antigo intacto para quem ainda não rodou o SQL;
//   2. os pedidos de recontagem se JUNTAM: a rajada inteira vira uma contagem
//      só, com o número final — que é o único que alguém consegue ler.
//
// A RÉGUA É A CONTA, E NÃO O RELÓGIO. Medir milissegundos aqui daria uma prova
// que reprova sozinha em máquina ocupada e aprova um código pior em máquina
// rápida. O que não pode voltar é o NÚMERO DE IDAS AO BANCO — e esse é exato.
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

// O diário das idas ao banco ligado ANTES de a página rodar, senão a abertura
// já teria acontecido quando ele fosse criado.
await page.addInitScript(() => { globalThis.__DIARIO = []; });

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(2500);

/** Esvazia o diário e devolve quantas idas houve, por tabela. */
async function idas() {
  return page.evaluate(() => {
    const l = globalThis.__DIARIO || [];
    globalThis.__DIARIO = [];
    const por = {};
    for (const m of l) por[m.tabela] = (por[m.tabela] || 0) + 1;
    return { total: l.length, por };
  });
}

const quantosTelefones = await page.evaluate(() => (globalThis.__TABELAS.advogados || []).length);

/** A conversa e o telefone que esta prova acompanha. Relido depois de cada
 *  `reload`: a bancada é montada de novo a cada carga da página, e guardar a
 *  referência antiga faria as conferências olharem uma linha que já não é a que
 *  está na tela. */
const descobrirAlvo = () => page.evaluate(() => {
  // O TELEFONE TEM DE ESTAR NA BARRA, e não só no banco.
  //
  // O painel só mostra os telefones a que a pessoa logada tem permissão — o
  // banco da bancada tem doze, a barra desta sessão tem três. Pegar o dono da
  // primeira conversa do banco dava um telefone que não está na tela, e a
  // conferência do selo procurava um botão que não existe. "Não achei o
  // botão" e "o número está errado" são coisas diferentes, e a prova precisa
  // reprovar só pela segunda.
  const naBarra = new Set([...document.querySelectorAll("[data-telefone]")]
    .map((e) => e.getAttribute("data-telefone")));
  const advs = (globalThis.__TABELAS.advogados || []).filter((a) => naBarra.has(a.nome));
  const conversas = globalThis.__TABELAS.conversas || [];
  for (const a of advs) {
    const cv = conversas.find((c) => String(c.advogado_id) === String(a.id));
    if (cv) return { conversa_id: cv.id, advogado_id: a.id, advogado_nome: a.nome };
  }
  return null;
});
let alvo = await descobrirAlvo();
ok("achei um telefone da barra com conversa para acompanhar", !!alvo);
if (!alvo) { await ctx.close(); await nav.close(); process.exit(1); }

/** O número que o selo daquele telefone está mostrando, ou 0 se não há selo —
 *  a bolinha some quando não há nada a ler, e "sem bolinha" é zero. */
const seloNaTela = () => page.evaluate(({ advogado_nome }) => {
  const b = document.querySelector(`[data-telefone="${CSS.escape(advogado_nome)}"]`);
  if (!b) return null;
  const s = b.querySelector("[data-selo-nao-lidas]");
  return s ? Number(s.getAttribute("data-selo-nao-lidas")) : 0;
}, alvo);

/** Quantas não lidas o banco da bancada tem para aquele telefone. */
const seloNoBanco = () => page.evaluate(({ advogado_id }) => (globalThis.__TABELAS.conversas || [])
  .filter((c) => String(c.advogado_id) === String(advogado_id)
              && Number(c.nao_lidas) > 0 && c.arquivada !== true).length, alvo);

/** Emite `quantas` mensagens recebidas, como o Supabase as emitiria: a
 *  mensagem nova E a conversa mudada, que chegam sempre em par. */
async function receber(quantas) {
  await page.evaluate(({ quantas, conversa_id }) => {
    for (let k = 0; k < quantas; k += 1) {
      const nova = {
        id: `rajada-${Date.now()}-${k}`, conversa_id,
        texto: `rajada ${k}`, origem: "contato",
        criado_em: new Date().toISOString(),
      };
      globalThis.__EMITIR("INSERT", "mensagens", nova);
      globalThis.__EMITIR("UPDATE", "conversas", {
        id: conversa_id, ultima_mensagem: nova.texto,
        ultima_atividade: nova.criado_em, nao_lidas: k + 1,
      });
    }
  }, { quantas, conversa_id: alvo.conversa_id });
  // Folga generosa: o relógio que junta os pedidos é curto, e o que se está
  // conferindo é que ele tocou UMA vez, não quando tocou.
  await page.waitForTimeout(3500);
  return idas();
}

console.log("\nAbrir o painel não faz uma consulta por telefone");
{
  await idas();
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(2500);
  alvo = await descobrirAlvo();
  const { por } = await idas();
  const emConversas = por.conversas || 0;
  // Quinze das idas antigas eram só os selos. O resto da abertura (a lista, os
  // atendimentos, o "digitando", as últimas mídias) continua existindo, então a
  // régua fica bem abaixo de "uma por telefone" e bem acima de zero.
  ok(`abre com menos idas a 'conversas' do que telefones cadastrados (${emConversas} < ${quantosTelefones})`,
     emConversas < quantosTelefones, `foram ${emConversas} para ${quantosTelefones} telefones`);
}

console.log("\nUma rajada de mensagens custa UMA contagem, e não uma por mensagem");
{
  const uma = await receber(1);
  const cinco = await receber(5);
  const vinte = await receber(20);

  console.log(`     1 mensagem  -> ${uma.total} idas`);
  console.log(`     5 mensagens -> ${cinco.total} idas`);
  console.log(`    20 mensagens -> ${vinte.total} idas`);

  // A CONTA QUE IMPORTA: vinte mensagens não podem custar vinte vezes uma.
  // Antes eram exatamente 620 (31 por mensagem, linear). O teto de 60 dá folga
  // enorme para o que sobrou — uma confirmação de `advogado_id` por mensagem
  // mais uma contagem — e ainda reprova qualquer volta ao comportamento antigo.
  ok(`20 mensagens custam bem menos que 20 vezes uma (${vinte.total} idas)`,
     vinte.total < 60, `foram ${vinte.total}`);
  ok(`e o custo NÃO é linear: 20 mensagens custam menos que 4 vezes 5 mensagens`,
     vinte.total < cinco.total * 4, `5 -> ${cinco.total}, 20 -> ${vinte.total}`);
  ok("uma mensagem sozinha ainda faz a tela perguntar ao banco",
     uma.total > 0, "nenhuma ida: a contagem parou de acontecer");
}

console.log("\nTrocar de telefone não derruba o canal de tempo real");
{
  // A função que conta os selos entrava na lista de dependências do efeito que
  // monta o canal, e ela mudava de identidade a cada troca de telefone. Efeito
  // remontado é canal DESMONTADO e inscrito de novo — e o `postgres_changes`
  // não repete o que passou, então a mensagem que chegar nessa fresta não
  // chega nunca. O conserto foi dar identidade fixa ao embrulho.
  const antes = await page.evaluate(() => globalThis.__CANAIS || 0);
  const telefones = await page.locator("[data-telefone]").count();
  for (let k = 1; k < Math.min(telefones, 4); k += 1) {
    await page.locator("[data-telefone]").nth(k).click();
    await page.waitForTimeout(1200);
  }
  const depois = await page.evaluate(() => globalThis.__CANAIS || 0);
  ok(`trocar de telefone 3 vezes não refaz o canal (${depois - antes} inscrições novas)`,
     depois - antes === 0, `foram ${depois - antes}`);
  // Volta para o telefone do alvo, senão as conferências seguintes olham a
  // barra lateral de outro lugar.
  await page.locator("[data-telefone]").first().click();
  await page.waitForTimeout(1500);
}

console.log("\nE o selo mostra o número CERTO depois da rajada");
{
  // Juntar os pedidos só vale se o último número chegar. Um relógio que junta e
  // esquece de tocar seria mais rápido e mentiria — que é bem pior que lento.
  const noBanco = await seloNoBanco();
  const naTela = await seloNaTela();
  ok(`o selo do telefone bate com o banco (tela ${naTela}, banco ${noBanco})`,
     naTela === noBanco, `tela ${naTela}, banco ${noBanco}`);
}

console.log("\nSem o SQL rodado, o painel conta do jeito antigo — e conta certo");
{
  // A função do banco é um SQL que alguém precisa rodar. Enquanto não rodar, o
  // caminho de sempre tem de continuar inteiro: mais lento, e correto. É o
  // caminho que TODA instalação usa no minuto antes de o SQL ser rodado.
  // Por `addInitScript` e não por `evaluate`: a chave tem de existir ANTES de o
  // painel montar, e `evaluate` escreve numa página que o `reload` joga fora.
  await page.addInitScript(() => { globalThis.__SEM_CONTAGEM_NO_BANCO = true; });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(3000);
  alvo = await descobrirAlvo();

  const noBanco = await seloNoBanco();
  const naTela = await seloNaTela();
  ok(`o selo continua certo sem a função (tela ${naTela}, banco ${noBanco})`,
     naTela === noBanco, `tela ${naTela}, banco ${noBanco}`);

  // E o caminho antigo também tem de estar JUNTANDO os pedidos: o relógio é do
  // painel, não da função do banco. Aqui a rajada volta a custar uma consulta
  // por telefone, mas UMA VEZ — e não uma vez por mensagem.
  await idas();
  const vinte = await receber(20);
  console.log(`    (sem a função) 20 mensagens -> ${vinte.total} idas`);
  ok(`sem a função, 20 mensagens ainda custam bem menos que as 620 de antes (${vinte.total})`,
     vinte.total < 200, `foram ${vinte.total}`);
}

ok("sem erro de JavaScript no caminho", erros.length === 0, erros.join(" | "));

await ctx.close();
await nav.close();

console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
if (falhas) process.exit(1);
