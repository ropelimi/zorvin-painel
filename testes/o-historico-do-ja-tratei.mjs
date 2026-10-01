// O "JÁ TRATEI" NO HISTÓRICO DE CADA CLIENTE
//
// Pedido do Rodrigo em 30/09: o que foi tratado tinha de aparecer "em cada
// contato também, talvez no histórico". O relatório do Painel responde "o que
// a equipe fez"; esta seção responde "o que já fizemos POR ESTA PESSOA", que é
// a pergunta de quem abre a conversa de um cliente que voltou.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. É POR CONTATO: os registros das conversas de TODOS os telefones dele
//      aparecem, e os de outro cliente não;
//   2. UM CLIQUE É UM REGISTRO — marcar ACORDOS e OUTROS juntos é uma linha
//      com dois assuntos, e não duas linhas. É assim que o relatório conta;
//   3. o texto do OUTROS aparece, e o telefone por onde foi tratado também;
//   4. o desfeito FICA, marcado, com quem desfez;
//   5. sem nenhum registro, a seção diz "ninguém marcou";
//   6. a leitura que FALHA diz que falhou, com o código — e não "ninguém
//      marcou", que faria a pessoa responder como se fosse a primeira vez;
//   7. sem a tabela (script 005 não rodado), a seção não aparece e o resto do
//      histórico continua;
//   8. sem a ponte, a seção lê o que alcança e DIZ que é parcial;
//   9. e o caminho inteiro: marcar "Já tratei" com o histórico aberto ao lado,
//      e a seção acompanhar sem reabrir.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
// UM "AGORA" SÓ para a semente inteira. Cada `Date.now()` separado cai num
// milissegundo diferente, e aí "o mesmo instante" vira dois cliques e uma
// espera de 7 dias vira 6,99999. A prova reprovava às vezes falando de um
// defeito que era dela.
const AGORA = Date.now();
const horasAtras = (h) => new Date(AGORA - h * 3600e3).toISOString();
const diasAtras = (d) => horasAtras(d * 24);

/** Os dois telefones: o que o painel abre, e outro qualquer. */
async function telefones() {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const T = globalThis.__TABELAS;
    const c = (T.conversas || []).find((x) => String(x.id) === String(cid));
    const a = (T.advogados || []).find((x) => c && String(x.id) === String(c.advogado_id));
    const outro = (T.advogados || []).find((x) => c && String(x.id) !== String(c.advogado_id) && x.ativo !== false);
    return c && a && outro
      ? { adv: c.advogado_id, advNome: a.nome, advNumero: a.numero,
          outro: outro.id, outroNome: outro.nome, outroNumero: outro.numero }
      : null;
  });
  await ctx.close();
  return r;
}
const TEL = await telefones();
ok("aprendi os dois telefones", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

const HELENA = "HELENA DO HISTÓRICO";
const VAZIO = "VALTER SEM REGISTRO";
// AS DUAS QUE A PROVA ABRE vêm no alto da lista (atividade de minutos
// atrás): a lista só desenha as linhas que cabem na tela, e uma conversa
// plantada no meio das da bancada não teria linha para clicar.
const conversa = (id, contatoId, nome, numero, adv, espera = null, minutos = 60) => ({
  id, advogado_id: adv, contato_id: contatoId, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date(AGORA - minutos * 60e3).toISOString(), esperando_desde: espera, tratada_em: null,
  ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { id: contatoId, nome, numero, foto_url: null },
});
const UM_CLIQUE = diasAtras(3);
const SEMENTE = {
  contatos: [
    { id: "ct-hj", numero: "5511970007701", nome: HELENA },
    { id: "ct-hv", numero: "5511970007702", nome: VAZIO },
    { id: "ct-ho", numero: "5511970007703", nome: "OUTRO CLIENTE" },
  ],
  conversas: [
    // A HELENA EM DOIS TELEFONES — e esperando na do primeiro, para a cena do
    // caminho inteiro ter o botão "Já tratei" para apertar.
    conversa("cv-h1", "ct-hj", HELENA, "5511970007701", TEL.adv, diasAtras(2), 2),
    conversa("cv-h2", "ct-hj", HELENA, "5511970007701", TEL.outro),
    conversa("cv-hv", "ct-hv", VAZIO, "5511970007702", TEL.adv, null, 1),
    conversa("cv-ho", "ct-ho", "OUTRO CLIENTE", "5511970007703", TEL.adv),
  ],
  mensagens: [
    { id: "m-h1", conversa_id: "cv-h1", origem: "contato", tipo: "texto", texto: "e aí?", criado_em: diasAtras(2) },
    // SEM MENSAGEM NENHUMA a conversa não vem na lista (a página pede
    // `mensagens(id)` junto) — e a cena do "ninguém marcou" ficaria sem linha
    // para clicar.
    { id: "m-hv", conversa_id: "cv-hv", origem: "contato", tipo: "texto", texto: "bom dia", criado_em: horasAtras(0.02) },
  ],
  zorvin_tratamentos: [
    // UM CLIQUE, DOIS ASSUNTOS: mesmo instante, mesma conversa, mesma pessoa.
    // O instante é UMA constante, e não duas chamadas a `diasAtras(3)`: duas
    // chamadas podem cair em milissegundos diferentes, e aí são dois cliques
    // de verdade — a prova reprovava às vezes, falando de um defeito que era
    // da semente.
    { id: "th-1a", conversa_id: "cv-h1", assunto_id: "as-6", quem: "u1", quando: UM_CLIQUE, esperava_desde: diasAtras(6) },
    { id: "th-1b", conversa_id: "cv-h1", assunto_id: "as-outros", quem: "u1", quando: UM_CLIQUE, esperava_desde: diasAtras(6),
      observacao: "Pediu a segunda via do boleto; enviada por e-mail." },
    // A JENIFER, pelo OUTRO telefone da mesma cliente.
    { id: "th-2", conversa_id: "cv-h2", assunto_id: "as-1", quem: "u-jenifer", quando: diasAtras(5) },
    // DESFEITO pela Jenifer.
    { id: "th-3", conversa_id: "cv-h1", assunto_id: "as-8", quem: "u1", quando: diasAtras(10),
      desfeito_em: diasAtras(9), desfeito_por: "u-jenifer" },
    // DE OUTRO CLIENTE: não pode aparecer na Helena.
    { id: "th-9", conversa_id: "cv-ho", assunto_id: "as-6", quem: "u1", quando: diasAtras(1) },
  ],
};

/** A PONTE DE MENTIRA, que é quem diz quais conversas o cliente tem em
 *  todos os telefones. `ponte = false` a faz não responder: é o caminho
 *  parcial, em que o painel lê só o que alcança. */
async function abrirPainel({ ponte = true, recusar = [], semTabela = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1920, height: 1000 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_TRATADA = false;
    globalThis.__SEM_ASSUNTOS = d.semTabela;
    globalThis.__SEM_DESCRICAO = false;
    globalThis.__SEM_RECONTAGEM = false;
    globalThis.__RECUSAR_LEITURA = d.recusar;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semente: SEMENTE, recusar, semTabela });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const m = url.pathname.match(/\/historico\/contato\/([^/]+)(\/quantas)?$/);
    if (m) {
      if (!ponte) return rota.abort();
      const convs = SEMENTE.conversas.filter((c) => c.contato_id === decodeURIComponent(m[1]));
      if (m[2]) {
        return rota.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, conversas: convs.length, telefones: new Set(convs.map((c) => c.advogado_id)).size }) });
      }
      const linhas = convs.map((c) => {
        const deMim = c.advogado_id === TEL.adv;
        return { conversa_id: c.id, advogado_id: c.advogado_id,
                 advogado_nome: deMim ? TEL.advNome : TEL.outroNome,
                 advogado_numero: deMim ? TEL.advNumero : TEL.outroNumero,
                 primeira: null, ultima: null };
      });
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, linhas }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

/** Abre a conversa e o histórico dela. Guardado: um clique em elemento que
 *  não existe estoura a prova inteira e esconde QUAL conferência pegou. */
async function abrirHistorico(page, nome) {
  const linha = page.locator(`[data-conversa-nome="${nome}"]`);
  if (!(await linha.count())) return false;
  await linha.first().click();
  await page.waitForTimeout(900);
  const botao = page.locator('button[title^="Histórico de atendimento"]');
  if (!(await botao.count())) return false;
  await botao.first().click();
  await page.waitForTimeout(1500);
  return true;
}

const S = "[data-historico-ja-tratei]";
const textoDaSecao = (page) => page.locator(S).innerText().catch(() => "");
const registros = (page) => page.$$eval(`${S} [data-registro-no-historico]`, (ns) => ns.map((n) => ({
  texto: n.innerText,
  desfeito: n.getAttribute("data-desfeito") === "sim",
  assuntos: [...n.querySelectorAll("[data-assunto-no-historico]")].map((a) => a.textContent.trim()),
  observacoes: [...n.querySelectorAll("[data-observacao-no-historico]")].map((a) => a.textContent.trim()),
}))).catch(() => []);

// ==================================================================
console.log("\nO histórico da cliente mostra o que foi tratado, em todos os telefones");
{
  const { ctx, page, estouros } = await abrirPainel();
  const abriu = await abrirHistorico(page, HELENA);
  ok("o histórico abre", abriu);
  ok("a seção do “Já tratei” aparece", (await page.locator(S).count()) === 1);
  const regs = await registros(page);
  ok("três registros: um clique com dois assuntos conta UM", regs.length === 3,
     `vieram ${regs.length}: ${regs.map((r) => r.assuntos.join("+")).join(" | ")}`);
  ok("o título diz o mesmo número", /Já tratei \(3\)/i.test(await textoDaSecao(page)));
  ok("o registro de outro cliente não entra",
     !regs.some((r) => r.texto.includes("OUTRO CLIENTE")) && regs.length <= 3);

  const [primeiro, segundo, terceiro] = regs;
  ok("o mais recente vem primeiro, com os dois assuntos juntos",
     primeiro && primeiro.assuntos.join(",") === "ACORDOS,OUTROS", primeiro?.assuntos.join(","));
  ok("o texto do OUTROS aparece",
     primeiro && primeiro.observacoes.some((o) => o.includes("segunda via do boleto")));
  ok("e diz quem marcou", primeiro && /Rodrigo Sousa/.test(primeiro.texto));
  ok("e por qual telefone", primeiro && primeiro.texto.includes(TEL.advNome || "§"), primeiro?.texto);

  ok("o da Jenifer, pelo OUTRO telefone, aparece",
     segundo && /JENIFER/i.test(segundo.texto) && segundo.assuntos.join(",") === "BLINDAGEM");
  ok("com o nome do outro telefone", segundo && segundo.texto.includes(TEL.outroNome || "§"), segundo?.texto);

  ok("o desfeito FICA, marcado", terceiro && terceiro.desfeito && /desfeito/i.test(terceiro.texto));
  ok("e diz quem desfez", terceiro && /desfeito por JENIFER/i.test(terceiro.texto), terceiro?.texto);
  ok("com a ponte respondendo, não há aviso de lista parcial",
     !/telefones que você alcança/.test(await textoDaSecao(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\nSem registro nenhum, a seção diz isso");
{
  const { ctx, page } = await abrirPainel();
  ok("o histórico abre", await abrirHistorico(page, VAZIO));
  const t = await textoDaSecao(page);
  ok("diz que ninguém marcou", /Ninguém marcou/i.test(t), t);
  ok("e nenhum registro aparece", (await registros(page)).length === 0);
  await ctx.close();
}

// ==================================================================
console.log("\nA leitura que falha diz que falhou");
{
  const { ctx, page } = await abrirPainel({ recusar: ["zorvin_tratamentos"] });
  await abrirHistorico(page, HELENA);
  const t = await textoDaSecao(page);
  ok("a seção aparece", (await page.locator(S).count()) === 1);
  ok("diz que não conseguiu ler", (await page.locator(`${S} [data-historico-ja-tratei-erro]`).count()) === 1, t);
  ok("com o código do banco", /PGRST301/.test(t), t);
  ok("e NÃO diz que ninguém marcou", !/Ninguém marcou/i.test(t));
  await ctx.close();
}

// ==================================================================
console.log("\nSem a tabela (script 005), a seção não aparece e o resto continua");
{
  const { ctx, page } = await abrirPainel({ semTabela: true });
  const abriu = await abrirHistorico(page, HELENA);
  ok("o histórico abre", abriu);
  ok("a seção do “Já tratei” não aparece", (await page.locator(S).count()) === 0);
  ok("e o histórico continua mostrando os telefones",
     /Por telefone|Ninguém do escritório enviou/i.test(await page.locator("body").innerText()));
  await ctx.close();
}

// ==================================================================
console.log("\nSem a ponte, lê o que alcança e diz que é parcial");
{
  const { ctx, page } = await abrirPainel({ ponte: false });
  await abrirHistorico(page, HELENA);
  const regs = await registros(page);
  ok("os registros aparecem mesmo assim", regs.length >= 1, `vieram ${regs.length}`);
  ok("e a seção avisa que é parcial", /telefones que você alcança/.test(await textoDaSecao(page)));
  await ctx.close();
}

// ==================================================================
console.log("\nO caminho inteiro: marcar com o histórico aberto, e a seção acompanha");
{
  const { ctx, page, estouros } = await abrirPainel();
  await abrirHistorico(page, HELENA);
  const antes = (await registros(page)).length;
  const botao = page.locator('[data-ja-tratei="tratar"]');
  let marcou = false;
  if (await botao.count()) {
    await botao.first().click();
    await page.waitForSelector("[data-ja-tratei-janela]");
    const l = page.locator('[data-assunto-do-ja-tratei="VENDA CCS"] input');
    if (await l.count()) {
      await l.click();
      await page.waitForTimeout(150);
      await page.locator("[data-ja-tratei-confirmar]").click();
      await page.waitForTimeout(1800);
      marcou = true;
    }
  }
  ok("marquei “Já tratei” com o histórico aberto", marcou);
  const depois = await registros(page);
  ok("a seção ganhou o registro novo sem reabrir", depois.length === antes + 1, `${antes} → ${depois.length}`);
  ok("e ele vem primeiro, com o assunto marcado",
     depois[0] && depois[0].assuntos.join(",") === "VENDA CCS", depois[0]?.assuntos.join(","));

  // E O DESFAZER também acompanha: o registro fica, agora marcado.
  let desfez = false;
  const desfazer = page.locator('[data-ja-tratei="desfazer"]');
  if (await desfazer.count()) {
    await desfazer.first().click();
    await page.waitForTimeout(1800);
    desfez = true;
  }
  ok("desfiz pelo cabeçalho", desfez);
  const final = await registros(page);
  ok("o registro desfeito continua na seção, marcado",
     final.length === antes + 1 && final[0]?.desfeito === true,
     `${final.length} registros; o primeiro desfeito? ${final[0]?.desfeito}`);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
