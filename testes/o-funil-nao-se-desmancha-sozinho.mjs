// O FUNIL NÃO SE DESMANCHA SOZINHO (auditoria de 28/10)
//
// Dois defeitos da tela do funil, os dois invisíveis num funil parado.
//
// 1. O QUADRO ESVAZIAVA E RELIA TUDO A CADA DESENHO DO PAINEL. O Painel
//    passa `advogados={advogadosPermitidos}`, que é um `.filter()` novo a
//    cada desenho dele; `telefonesDoDep` mudava, `ler` mudava, e o efeito
//    `setCartoes([]); setEtapas([]); ler(true)` rodava de novo. Com o funil
//    aberto, qualquer mensagem do tempo real (ou o relógio das tarefas)
//    fazia o quadro sumir ("Lendo o funil…"), a rolagem voltar ao começo,
//    um arraste morrer no meio e o "Mover para…" fechar sozinho.
//
// 2. A PAGINAÇÃO ORDENAVA SÓ POR `movido_em`, SEM DESEMPATE. O "Trazer
//    conversas" põe todos os cartões num INSERT só, com o mesmo `now()`; e
//    no banco o empate não tem ordem garantida entre uma consulta e outra.
//    Acima de 1.000 cartões, a página 2 repetia cartões da 1 e deixava
//    outros de fora. A bancada aprendeu a errar como o banco
//    (`__EMPATE_SEM_ORDEM`): com a ordem estável dela, o defeito passava.
//
// O QUE ESTA PROVA GUARDA:
//   - mensagens do tempo real chegando com o funil aberto não esvaziam o
//     quadro (o filme de 30 em 30 ms nunca vê zero cartões nem "Lendo o
//     funil…"), não voltam a rolagem e não releem o banco — com o contraste
//     de que "Atualizar" relê, senão a contagem de leituras não mediria nada;
//   - trocar de departamento ainda limpa o quadro na hora (o de antes não
//     fica à vista enquanto o novo carrega), e só ela: a releitura do mesmo
//     funil (a resposta das tarefas que chega depois) não esvazia o quadro;
//   - 1.200 cartões empatados aparecem todos, cada um uma vez.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();

/** O telefone que o painel ABRE, e o departamento dele (a régua de
 *  `o-funil-de-etapas`: descoberto, e não escolhido a dedo). */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    const a = c && (globalThis.__TABELAS.advogados || []).find((x) => String(x.id) === String(c.advogado_id));
    return a ? { adv: a.id, dep: a.departamento_id } : null;
  });
  await ctx.close();
  return r;
}
const ABRE = await telefoneQueAbre();
ok("aprendi qual telefone e departamento o painel abre", Boolean(ABRE && ABRE.dep != null), q(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, dep: DEP } = ABRE;
const ET = (n) => `et-${DEP}-${n}`;   // as etapas que a bancada semeia, como o script

const agora = new Date().toISOString();
const NOMES = ["FUNIL ANA", "FUNIL BRUNO", "FUNIL CARLA", "FUNIL DIEGO", "FUNIL ELISA", "FUNIL FABIO"];
const contato = (k, i) => ({ id: `ct-${k}`, numero: `55119700055${String(i).padStart(2, "0")}`, nome: NOMES[i],
                             vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const conversa = (k, i) => ({
  id: `cv-${k}`, advogado_id: ADV, contato_id: `ct-${k}`, nao_lidas: 0, arquivada: false, fixada: false,
  favorita: false, ultima_atividade: agora, ultima_mensagem: "oi", frente: null, vantoro_nome: null,
  digitando_ate: null, contato: { id: `ct-${k}`, nome: NOMES[i], numero: `55119700055${String(i).padStart(2, "0")}`, foto_url: null },
});
const cartao = (k, etapa) => ({ id: `cartao-${k}`, contato_id: `ct-${k}`, departamento_id: DEP, etapa_id: etapa,
                                 criado_em: agora, movido_em: agora, movido_por: "u1" });
const CHAVES = NOMES.map((_, i) => `g${i}`);
// UM CARTÃO EM CADA ETAPA, da primeira à última: o quadro fica mais largo que
// a tela, e a rolagem para o lado existe para ser medida.
const SEMENTE_PEQUENA = {
  contatos: CHAVES.map(contato),
  conversas: CHAVES.map(conversa),
  zorvin_cartoes: CHAVES.map((k, i) => cartao(k, ET(i + 1))),
};
// 1.200 CARTÕES COM O MESMO `movido_em` — o que o "Trazer conversas" grava.
const SEMENTE_GRANDE = {
  zorvin_cartoes: Array.from({ length: 1200 }, (_, i) => ({
    id: `cartao-emp-${String(i).padStart(4, "0")}`, contato_id: `ct-emp-${String(i).padStart(4, "0")}`,
    departamento_id: DEP, etapa_id: ET(1), criado_em: agora, movido_em: agora, movido_por: "u1",
  })),
};

async function abrirPainel(semente, { empateSemOrdem = [], atraso = {} } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept());
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SOU_ADMIN = true;
    globalThis.__SEM_FUNIL = false;
    globalThis.__EMPATE_SEM_ORDEM = d.empateSemOrdem;
    globalThis.__ATRASO_POR_TABELA = d.atraso;
    globalThis.__DIARIO = [];
  }, { semente, empateSemOrdem, atraso });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros };
}
async function abrirFunil(page) {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.locator("[data-abrir-funil]").click();
  await page.waitForSelector('[data-tela="funil"]');
  // O QUADRO PRONTO, e mais um pouco: as respostas que chegam depois da
  // abertura (a das tarefas, que liga o aviso nos cartões) relêem uma vez,
  // e é de propósito.
  for (let i = 0; i < 60; i++) {
    const pronto = await page.evaluate(() => {
      const t = document.querySelector('[data-tela="funil"]');
      return Boolean(t) && !/Lendo o funil/.test(t.innerText) && document.querySelectorAll("[data-cartao-do-funil]").length > 0;
    });
    if (pronto) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2500);
}
const leiturasDasEtapas = (page) => page.evaluate(() =>
  (globalThis.__DIARIO || []).filter((m) => m.tabela === "zorvin_etapas").length);

// ==================================================================
console.log("\n1. Mensagens do tempo real com o funil aberto não desmancham o quadro");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE_PEQUENA);
  await abrirFunil(page);
  const cartoes = await page.locator("[data-cartao-do-funil]").count();
  ok("o funil abriu com os seis cartões", cartoes === 6, String(cartoes));

  // A ROLAGEM PARA O LADO: o quadro de sete etapas passa da tela.
  const rolou = await page.evaluate(() => {
    const q = [...document.querySelectorAll('[data-tela="funil"] div')]
      .find((d) => getComputedStyle(d).overflowX === "auto" && d.scrollWidth > d.clientWidth);
    if (!q) return null;
    q.setAttribute("data-prova-quadro", "");
    q.scrollLeft = 300;
    return q.scrollLeft;
  });
  ok("o quadro rola para o lado, e eu rolei 300px", rolou === 300, String(rolou));

  // O FILME, e não a foto: o quadro que some e volta em meio segundo
  // terminaria igual, e só o filme vê o buraco.
  await page.evaluate(() => {
    globalThis.__FILME_DO_FUNIL = [];
    globalThis.__FILMANDO = setInterval(() => {
      const t = document.querySelector('[data-tela="funil"]');
      globalThis.__FILME_DO_FUNIL.push({
        cartoes: document.querySelectorAll("[data-cartao-do-funil]").length,
        lendo: Boolean(t) && /Lendo o funil/.test(t.innerText),
      });
    }, 30);
  });
  const antes = await leiturasDasEtapas(page);
  // TRÊS MENSAGENS PELA PONTE, como chegam no escritório: a bancada grava e
  // avisa pelo tempo real, e o Painel se redesenha a cada uma.
  for (const k of ["g0", "g2", "g4"]) {
    await page.evaluate((id) => globalThis.__MENSAGEM_PELA_PONTE(id, "contato", "oi, chegou agora"), `cv-${k}`);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  const filme = await page.evaluate(() => { clearInterval(globalThis.__FILMANDO); return globalThis.__FILME_DO_FUNIL; });
  const depois = await leiturasDasEtapas(page);
  ok("o filme tem quadros", filme.length > 20, String(filme.length));
  const menor = Math.min(...filme.map((f) => f.cartoes));
  ok("o quadro nunca ficou vazio", filme.length > 0 && menor === cartoes, `menor: ${menor} de ${cartoes}`);
  ok("e nunca disse “Lendo o funil…”", filme.length > 0 && !filme.some((f) => f.lendo),
     `${filme.filter((f) => f.lendo).length} quadros lendo`);
  const rolagem = await page.evaluate(() => document.querySelector("[data-prova-quadro]")?.scrollLeft ?? null);
  ok("a rolagem ficou onde eu deixei", rolagem === 300, String(rolagem));
  ok("e o banco não foi relido por causa das mensagens", depois === antes, `${antes} → ${depois} leituras das etapas`);

  // O CONTRASTE: "Atualizar" relê. Sem ele, a conferência de cima passaria
  // com um diário que não anota nada.
  await page.locator("[data-atualizar-funil]").click();
  await page.waitForTimeout(1200);
  ok("“Atualizar” relê o banco (o diário anota)", (await leiturasDasEtapas(page)) > depois);

  // TROCAR DE DEPARTAMENTO AINDA LIMPA NA HORA: o quadro de antes não pode
  // ficar à vista com o nome do outro departamento no alto.
  await page.evaluate(() => { globalThis.__ATRASO_POR_TABELA = { zorvin_etapas: 1500 }; });
  const outro = await page.evaluate((dep) => {
    const s = document.querySelector("[data-funil-departamento]");
    const o = s && [...s.options].find((x) => String(x.value) !== String(dep));
    return o ? o.value : null;
  }, DEP);
  ok("há outro departamento para escolher", outro !== null);
  if (outro !== null) {
    await page.locator("[data-funil-departamento]").selectOption(String(outro));
    await page.waitForTimeout(400);
    ok("trocando de departamento, os cartões do de antes saem na hora",
       (await page.locator("[data-cartao-do-funil]").count()) === 0,
       `${await page.locator("[data-cartao-do-funil]").count()} cartões à vista`);
  }
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. A resposta das tarefas que chega depois relê sem esvaziar o quadro");
{
  // `ler` TAMBÉM MUDA SEM O DEPARTAMENTO MUDAR: a pergunta "existem
  // tarefas?" do Painel volta depois de o funil abrir, `comTarefas` vira
  // verdade e o funil relê para pôr o aviso de tarefa nos cartões. Relê, sim
  // — mas o quadro é o mesmo funil, e não pode sumir enquanto a resposta
  // não chega (aqui ela demora 4 s, como a ponte que acorda).
  const { ctx, page, estouros } = await abrirPainel(SEMENTE_PEQUENA, { atraso: { zorvin_tarefas: 4000 } });
  await page.evaluate(() => {
    globalThis.__FILME_DO_FUNIL = [];
    globalThis.__FILMANDO = setInterval(() => {
      globalThis.__FILME_DO_FUNIL.push(document.querySelectorAll("[data-cartao-do-funil]").length);
    }, 30);
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.locator("[data-abrir-funil]").click();
  await page.waitForTimeout(11000);
  const filme = await page.evaluate(() => { clearInterval(globalThis.__FILMANDO); return globalThis.__FILME_DO_FUNIL; });
  const primeiro = filme.findIndex((n) => n > 0);
  const depois = primeiro >= 0 ? filme.slice(primeiro) : [];
  ok("o quadro chegou a aparecer", primeiro >= 0 && depois.length > 0, `${filme.length} quadros no filme`);
  ok("e, depois de aparecer, nunca ficou vazio", depois.length > 0 && Math.min(...depois) > 0,
     `${depois.filter((n) => n === 0).length} quadros vazios`);
  ok("e terminou com os seis cartões", filme.length > 0 && filme[filme.length - 1] === 6, String(filme[filme.length - 1]));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. 1.200 cartões empatados aparecem todos, cada um uma vez");
{
  const { ctx, page, estouros } = await abrirPainel(SEMENTE_GRANDE, { empateSemOrdem: ["zorvin_cartoes"] });
  await abrirFunil(page);
  const ids = await page.locator("[data-cartao-do-funil]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cartao-do-funil")));
  const unicos = new Set(ids).size;
  const repetidos = ids.length - unicos;
  const esperados = SEMENTE_GRANDE.zorvin_cartoes.map((c) => c.contato_id);
  const faltando = esperados.filter((id) => !ids.includes(id)).length;
  ok("os 1.200 cartões estão no quadro", unicos === 1200, `${unicos} diferentes`);
  ok("nenhum repetido", ids.length > 0 && repetidos === 0, `${repetidos} repetidos`);
  ok("nenhum de fora", ids.length > 0 && faltando === 0, `${faltando} de fora`);
  const total = await page.locator("[data-total-do-funil]").innerText().catch(() => "");
  ok("e o total diz 1200 clientes", /1200 clientes/.test(total), total);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
