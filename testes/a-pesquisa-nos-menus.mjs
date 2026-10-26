// A PESQUISA NOS MENUS (23/10)
//
// Pedido do Rodrigo, com a foto do menu da seta: "quando eu clico na seta e
// aparece a lista de etiquetas, precisa ter a opção de também pesquisar por
// nome para facilitar encontrar a etiqueta correta, e quando eu clico em
// 'Assumir' ou 'Etiquetas' dentro da conversa, também é bom ter o campo de
// pesquisa". O escritório tem 32 etiquetas e 23 pessoas.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. a CONTA, direto na função (`pesquisaNosMenus.js`): sem acento, sem
//      maiúscula, e cada palavra em qualquer lugar — "minuta acordo" acha
//      "Acordo Fechado - Ag. Minuta";
//   2. o menu da seta: o campo aparece, já com o cursor no computador, filtra
//      as etiquetas E as opções fixas, diz quando nada casa, continua à vista
//      com a lista rolada, e reabre limpo;
//   3. o primeiro Esc apaga o que foi escrito, e só o segundo fecha o menu;
//   4. o "Marcar tags" da conversa: filtra, marca, e a pesquisa continua
//      depois de marcar (marcar é escolher várias);
//   5. o "Assumir": filtra só as PESSOAS — "Assumir esta conversa" continua
//      no lugar — e passar a conversa a quem foi achado grava no banco;
//   6. "Quem participou da conversa": filtra, e quem foi marcado continua
//      marcado quando se pesquisa outro nome;
//   7. Configurações: as mensagens rápidas (pelo título E pelo texto) e as
//      etiquetas; a pesquisa sobrevive ao lápis de editar, e cada aba começa
//      a sua;
//   8. as pesquisas que já existiam passaram a ignorar o acento: o "/" das
//      rápidas, o Encaminhar e a lista de departamentos;
//   9. no celular o campo existe, mas o cursor NÃO vem nele — senão o teclado
//      cobriria a lista que a pessoa abriu para tocar;
//  10. com poucos itens não há campo nenhum: com dois, correr o olho é mais
//      rápido do que escrever;
//  11. e as outras duas pesquisas que mudaram de conta: a do Funil e a da
//      equipe, em Departamentos e acessos.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { PESQUISA_A_PARTIR_DE, chaveDaPesquisa, casaComAPesquisa, nadaComAPesquisa }
  from "../src/pesquisaNosMenus.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

// ==================================================================
//  1. A CONTA, SEM NAVEGADOR
// ==================================================================
console.log("\n1. A conta da pesquisa, direto na função");
ok("sete itens já ganham o campo (a régua do menu de departamentos)", PESQUISA_A_PARTIR_DE === 7,
   String(PESQUISA_A_PARTIR_DE));
ok("a chave tira acento, maiúscula e espaço sobrando",
   chaveDaPesquisa("  Execução   PENHORA ") === "execucao penhora", chaveDaPesquisa("  Execução   PENHORA "));
ok("“execucao” acha “Execução”", casaComAPesquisa("execucao", "Execução"));
ok("“EXECUÇÃO” acha “execução”", casaComAPesquisa("EXECUÇÃO", "execução"));
ok("um pedaço do meio da palavra também acha", casaComAPesquisa("ssina", "Ag. assinatura da minuta"));
ok("“minuta acordo” acha “Acordo Fechado - Ag. Minuta” (as palavras em qualquer ordem)",
   casaComAPesquisa("minuta acordo", "Acordo Fechado - Ag. Minuta"));
ok("mas toda palavra tem de estar lá: “minuta penhora” não acha",
   !casaComAPesquisa("minuta penhora", "Acordo Fechado - Ag. Minuta"));
ok("campo vazio mostra tudo", casaComAPesquisa("", "Qualquer coisa"));
ok("campo só com espaço também", casaComAPesquisa("   ", "Qualquer coisa"));
ok("procura em mais de um texto (o título e o texto da rápida)",
   casaComAPesquisa("saudacao escritorio", "Saudação", "Aqui é do escritório"));
ok("e um texto que não veio não estoura nem casa sozinho",
   casaComAPesquisa("bom", null, "Bom dia") && !casaComAPesquisa("bom", null, undefined));
ok("a frase de nada achado repete o que foi escrito",
   nadaComAPesquisa("Nenhuma etiqueta", "  minta ") === "Nenhuma etiqueta com “minta”.",
   nadaComAPesquisa("Nenhuma etiqueta", "  minta "));

// ==================================================================
//  O QUE A BANCADA GANHA
// ==================================================================
const nav = await abrirNavegador();

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo (o
 *  ajudante de `o-responsavel-pela-conversa`). */
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
ok("aprendi qual telefone (e departamento) o painel abre", Boolean(ABRE && ABRE.dep != null), JSON.stringify(ABRE));
if (!ABRE) { await nav.close(); process.exit(1); }
const { adv: ADV, dep: DEP } = ABRE;

// AS 28 ETIQUETAS QUE FALTAVAM — junto com as duas da bancada, 30, perto das
// 32 do escritório. Com acento de propósito: é onde a pesquisa erraria.
const NOMES_DAS_ETIQUETAS = [
  "Acordo Bom", "Acordo Fechado - Ag. Minuta", "Acordos", "Ag. assinatura da minuta", "Anderson",
  "Audiência marcada", "Blindagem", "Cálculo pendente", "Cliente VIP", "Documentação pendente",
  "Execução", "Execução - Penhora", "Financeiro", "Indenização", "Juntada", "Leilão",
  "Notificação extrajudicial", "Novo cliente", "Pagamento confirmado", "Perícia", "Prazo",
  "Procuração", "Recurso", "Repasse", "Retorno do cliente", "Sentença", "Subsídio CCR", "Venda LN",
];
const ETIQUETAS = NOMES_DAS_ETIQUETAS.map((nome, i) => ({
  id: `t-pesq-${i}`, nome, cor: ["#c0392b", "#2a78d6", "#25d366", "#a06cd5"][i % 4],
}));
const idDaEtiqueta = (nome) => ETIQUETAS.find((t) => t.nome === nome).id;
const TOTAL_DE_ETIQUETAS = ETIQUETAS.length + 2;

// AS OITO PESSOAS A MAIS — com as três da bancada, onze; para quem passa a
// conversa, dez. Também com acento.
const PESSOAS = [
  ["u-jose", "JOSÉ RIBEIRO"], ["u-marcia", "MÁRCIA LEÃO"], ["u-ana", "ANA PAULA SOUZA"],
  ["u-beatriz", "BEATRIZ CARVALHO"], ["u-carla", "CARLA MENDES"], ["u-diego", "DIEGO FARIAS"],
  ["u-elaine", "ELAINE GOMES"], ["u-fabio", "FÁBIO NUNES"],
].map(([id, nome]) => ({ id, nome, admin: false, foto_url: null }));

const RAPIDAS = [
  ["Saudação", "{saudacao}, {nome}! Aqui é {atendente}, do escritório."],
  ["Envio da minuta", "Segue a minuta do acordo para a sua conferência."],
  ["Documentos pendentes", "Ainda faltam o RG e o comprovante de endereço."],
  ["Pix do acordo", "O pagamento pode ser feito por Pix."],
  ["Audiência", "A sua audiência foi marcada. Mandaremos os detalhes."],
  ["Procuração", "Precisamos da procuração assinada."],
  ["Agradecimento", "Nós que agradecemos!"],
  ["Horário", "Atendemos de segunda a sexta, das 8h às 18h."],
].map(([titulo, texto], i) => ({ id: `r-pesq-${i}`, titulo, texto, criado_em: "2026-10-01T12:00:00Z" }));

const agora = new Date();
const em = (min) => new Date(agora.getTime() - min * 60000).toISOString();
const conversa = (id, ct, nome, numero, minutos) => ({
  id, advogado_id: ADV, contato_id: ct, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: em(minutos), ultima_mensagem: "bom dia", frente: null, vantoro_nome: null,
  digitando_ate: null, responsavel_id: null, responsavel_em: null, responsavel_por: null,
  contato: { id: ct, nome, numero, foto_url: null },
});
const ALVO = "CLIENTE DA PESQUISA";
const DESTINO = "MARIA DAS GRAÇAS DESTINO";
const contato = (id, nome, numero) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
                                         vantoro_cliente_id: null, foto_url: null });
// DOIS CLIENTES NO FUNIL, um com acento no nome.
const cartao = (k) => ({ id: `cartao-${k}`, contato_id: `ct-${k}`, departamento_id: DEP, etapa_id: `et-${DEP}-1`,
                          criado_em: em(5), movido_em: em(5), movido_por: "u1" });
const SEMENTE = {
  contatos: [
    contato("ct-pesq", ALVO, "5511970004401"),
    contato("ct-destino", DESTINO, "5511970004402"),
    contato("ct-funil-joao", "JOÃO DO FUNIL", "5511970004403"),
    contato("ct-funil-maria", "MARIA DO FUNIL", "5511970004404"),
  ],
  conversas: [
    conversa("cv-pesq", "ct-pesq", ALVO, "5511970004401", 0),
    conversa("cv-destino", "ct-destino", DESTINO, "5511970004402", 1),
    conversa("cv-funil-joao", "ct-funil-joao", "JOÃO DO FUNIL", "5511970004403", 2),
    conversa("cv-funil-maria", "ct-funil-maria", "MARIA DO FUNIL", "5511970004404", 3),
  ],
  zorvin_cartoes: [cartao("funil-joao"), cartao("funil-maria")],
  // UMA MENSAGEM DE CADA PESSOA NOVA: é dela que sai a lista de "quem
  // participou da conversa" (`atendentes_do_telefone`).
  mensagens: [
    { id: "m-pesq-0", conversa_id: "cv-pesq", origem: "contato", tipo: "texto", texto: "bom dia",
      criado_em: em(30), id_uazapi: "uz-m-pesq-0" },
    ...PESSOAS.map((p, i) => ({
      id: `m-pesq-${i + 1}`, conversa_id: "cv-pesq", origem: "advogado", tipo: "texto",
      texto: `Resposta de ${p.nome}`, enviado_por_id: p.id, enviado_por: p.nome,
      criado_em: em(29 - i), id_uazapi: `uz-m-pesq-${i + 1}`, status: "enviada",
    })),
    { id: "m-destino-0", conversa_id: "cv-destino", origem: "contato", tipo: "texto", texto: "oi",
      criado_em: em(1), id_uazapi: "uz-m-destino-0" },
    ...["funil-joao", "funil-maria"].map((k, i) => ({ id: `m-${k}`, conversa_id: `cv-${k}`, origem: "contato",
      tipo: "texto", texto: "oi", criado_em: em(2 + i), id_uazapi: `uz-m-${k}` })),
  ],
};

async function abrirPainel({ largura = 1920, altura = 1000, comMuitos = true } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, hasTouch: largura < 768 });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // A ETIQUETA DA CONVERSA VAI PELA PONTE (`/etiqueta/contato`, ver
  // `o-cliente-e-um-so`): a de mentira guarda o pedido e responde que deu.
  const etiquetados = [];
  await page.route("**/ponte-de-mentira/etiqueta/contato", async (rota) => {
    let corpo = null;
    try { corpo = JSON.parse(rota.request().postData() || "null"); } catch (_) { /* nulo */ }
    etiquetados.push(corpo);
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.comMuitos ? d.semente : {};
  }, { semente: { ...SEMENTE, tags: ETIQUETAS, usuarios: PESSOAS, mensagens_rapidas: RAPIDAS }, comMuitos });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1300);
  return { ctx, page, estouros, etiquetados };
}

async function clicar(page, seletor) {
  // GUARDADO: `click()` num elemento que não existe estoura a prova inteira
  // depois de 30 segundos, e uma prova que estoura não diz QUAL conferência
  // pegou o defeito.
  const l = page.locator(seletor);
  if (!(await l.count())) return false;
  await l.first().click();
  await page.waitForTimeout(400);
  return true;
}

/** Escreve no campo de pesquisa daquele menu, apagando o que havia. */
async function escrever(page, nome, texto) {
  const campo = page.locator(`[data-campo-de-pesquisa="${nome}"] input`);
  if (!(await campo.count())) return false;
  await campo.first().fill(texto);
  await page.waitForTimeout(250);
  return true;
}

// PERGUNTANDO ANTES SE EXISTE: `inputValue()` num campo que não está na tela
// espera 30 segundos antes de desistir, e a sabotagem que tira o campo levaria
// minutos para ser lida.
const valorDoCampo = async (page, nome) => {
  const campo = page.locator(`[data-campo-de-pesquisa="${nome}"] input`);
  if (!(await campo.count())) return null;
  return campo.first().inputValue().catch(() => null);
};

/** O cursor está neste campo? */
const cursorNoCampo = (page, nome) => page.evaluate((n) => {
  const a = document.activeElement;
  return Boolean(a && a.tagName === "INPUT" && a.closest(`[data-campo-de-pesquisa="${n}"]`));
}, nome);

/** Os valores de um atributo, na ordem da tela, só dos elementos VISÍVEIS. */
const visiveis = (page, atributo) => page.evaluate((at) =>
  [...document.querySelectorAll(`[${at}]`)]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .map((el) => el.getAttribute(at)), atributo);

const frase = async (page) => {
  const el = page.locator("[data-nada-com-a-pesquisa]");
  if (!(await el.count())) return "";
  return el.first().innerText().catch(() => "");
};

async function abrirConversa(page, nome) {
  // PELO `data-`, e não pelo papel: a linha da conversa também é um botão, e
  // o nome acessível dela engole tudo o que está dentro.
  const abriu = await clicar(page, `[data-conversa-nome="${nome}"]`);
  await page.waitForTimeout(700);
  return abriu;
}

// ==================================================================
//  2. O MENU DA SETA
// ==================================================================
console.log("\n2. O menu da seta, com as 30 etiquetas");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri o menu da seta", await clicar(page, "[data-mais-filtros]"));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="mais-filtros"]').count()) === 1);
  ok("e já com o cursor nele (no computador)", await cursorNoCampo(page, "mais-filtros"));
  const todas = await visiveis(page, "data-etiqueta-da-seta");
  ok("sem nada escrito, todas as etiquetas", todas.length === TOTAL_DE_ETIQUETAS, `${todas.length}`);

  // ESCREVENDO COMO A PESSOA ESCREVE — tecla por tecla, e não `fill`: é o
  // caminho do cursor que já veio no campo.
  await page.keyboard.type("minuta");
  await page.waitForTimeout(300);
  let achadas = await visiveis(page, "data-etiqueta-da-seta");
  ok("“minuta” deixa só as duas etiquetas com minuta",
     achadas.length === 2 && achadas.includes(idDaEtiqueta("Acordo Fechado - Ag. Minuta"))
       && achadas.includes(idDaEtiqueta("Ag. assinatura da minuta")), achadas.join(", "));
  ok("e as opções fixas que não casam saem também (Grupos)",
     (await page.locator("[data-grupos-opcao]").count()) === 0);
  ok("mas “Gerenciar etiquetas” fica — é um gesto, não um item",
     (await page.locator('[data-menu-mais-filtros] button:has-text("Gerenciar etiquetas")').count()) === 1);

  await escrever(page, "mais-filtros", "execucao");
  achadas = await visiveis(page, "data-etiqueta-da-seta");
  ok("“execucao”, sem acento, acha as duas de Execução",
     achadas.length === 2 && achadas.includes(idDaEtiqueta("Execução"))
       && achadas.includes(idDaEtiqueta("Execução - Penhora")), achadas.join(", "));

  await escrever(page, "mais-filtros", "minuta acordo");
  achadas = await visiveis(page, "data-etiqueta-da-seta");
  ok("“minuta acordo” acha “Acordo Fechado - Ag. Minuta”, fora de ordem",
     achadas.length === 1 && achadas[0] === idDaEtiqueta("Acordo Fechado - Ag. Minuta"), achadas.join(", "));

  await escrever(page, "mais-filtros", "grupo");
  ok("“grupo” acha a opção Grupos", (await page.locator("[data-grupos-opcao]").count()) === 1);
  ok("e nenhuma etiqueta", (await visiveis(page, "data-etiqueta-da-seta")).length === 0);
  ok("(e por isso não diz que nada foi achado)", (await page.locator("[data-nada-com-a-pesquisa]").count()) === 0);

  await escrever(page, "mais-filtros", "zzz");
  ok("nada casando, o menu diz o que foi escrito",
     (await frase(page)) === "Nenhuma etiqueta com “zzz”.", await frase(page));

  // O X DO CAMPO apaga e devolve o cursor.
  ok("o X do campo existe com algo escrito", await clicar(page, "[data-limpar-pesquisa]"));
  ok("e apaga o que foi escrito", (await valorDoCampo(page, "mais-filtros")) === "");
  ok("devolvendo todas as etiquetas", (await visiveis(page, "data-etiqueta-da-seta")).length === TOTAL_DE_ETIQUETAS);
  ok("e o cursor continua no campo", await cursorNoCampo(page, "mais-filtros"));

  // O CAMPO NÃO ROLA JUNTO: com a lista rolada até o fim, ele continua no
  // alto, PINTADO — medido pelo que está desenhado, e não pelo retângulo.
  const fixo = await page.evaluate(() => {
    const menu = document.querySelector("[data-menu-mais-filtros]");
    const campo = document.querySelector('[data-campo-de-pesquisa="mais-filtros"]');
    if (!menu || !campo) return null;
    menu.scrollTop = menu.scrollHeight;
    const rolou = menu.scrollTop > 0;
    const r = campo.getBoundingClientRect(), m = menu.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { rolou, dentroDoMenu: r.top >= m.top - 1 && r.bottom <= m.bottom + 1,
             pintado: Boolean(topo && campo.contains(topo)) };
  });
  ok("a lista rola (senão esta conferência mede o caso fácil)", fixo && fixo.rolou, JSON.stringify(fixo));
  ok("e com ela rolada o campo continua à vista, no alto", fixo && fixo.dentroDoMenu && fixo.pintado,
     JSON.stringify(fixo));

  // ESCOLHER: a etiqueta achada vira o filtro, e o menu fecha.
  await escrever(page, "mais-filtros", "pericia");
  ok("“pericia” acha “Perícia”", (await visiveis(page, "data-etiqueta-da-seta")).join() === idDaEtiqueta("Perícia"));
  ok("e clicar nela escolhe o filtro", await clicar(page, `[data-etiqueta-da-seta="${idDaEtiqueta("Perícia")}"]`));
  ok("o menu fechou", (await page.locator("[data-menu-mais-filtros]").count()) === 0);
  const pilula = await page.locator("[data-mais-filtros]").first().innerText().catch(() => "");
  ok("e a pílula diz a etiqueta escolhida", /Perícia/.test(pilula), pilula);

  // REABRIR COMEÇA LIMPO: a pesquisa de antes reabriria o menu mostrando uma
  // etiqueta só, e quem não lembra de ter escrito aquilo acha que as outras
  // sumiram.
  ok("reabri o menu", await clicar(page, "[data-mais-filtros]"));
  ok("e o campo está vazio", (await valorDoCampo(page, "mais-filtros")) === "");
  ok("com todas as etiquetas de volta", (await visiveis(page, "data-etiqueta-da-seta")).length === TOTAL_DE_ETIQUETAS);

  // O ESC EM DOIS TEMPOS.
  await page.keyboard.type("leil");
  await page.waitForTimeout(250);
  ok("(escrevi “leil”)", (await visiveis(page, "data-etiqueta-da-seta")).length === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("o primeiro Esc apaga o que foi escrito", (await valorDoCampo(page, "mais-filtros")) === "");
  ok("e o menu continua aberto", (await page.locator("[data-menu-mais-filtros]").count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("o segundo Esc fecha o menu", (await page.locator("[data-menu-mais-filtros]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  3. "MARCAR TAGS" NA CONVERSA
// ==================================================================
console.log("\n3. As etiquetas da conversa");
{
  const { ctx, page, estouros, etiquetados } = await abrirPainel();
  ok("abri a conversa", await abrirConversa(page, ALVO));
  ok("abri as etiquetas da conversa", await clicar(page, 'button[aria-label="Etiquetas"]'));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="marcar-tags"]').count()) === 1);
  ok("e com o cursor nele", await cursorNoCampo(page, "marcar-tags"));
  await page.keyboard.type("minuta");
  await page.waitForTimeout(300);
  const achadas = await visiveis(page, "data-tag-opcao");
  ok("“minuta” deixa as duas", achadas.length === 2, achadas.join(", "));
  const alvo = idDaEtiqueta("Ag. assinatura da minuta");
  ok("marquei uma delas", await clicar(page, `[data-tag-opcao="${alvo}"]`));
  await page.waitForTimeout(400);
  // A ETIQUETA ACHADA é a que vai para a ponte, e não a primeira da lista
  // inteira: com a lista filtrada, o item clicado e o que está por baixo dele
  // na lista de sempre são etiquetas diferentes.
  const pedido = etiquetados[etiquetados.length - 1];
  ok("a ponte recebeu a etiqueta achada, para aplicar",
     etiquetados.length === 1 && pedido && pedido.tag_id === alvo && pedido.aplicar === true,
     JSON.stringify(etiquetados));
  const marcada = await page.locator(`[data-tag-opcao="${alvo}"] svg`).count();
  ok("e ela aparece marcada no menu", marcada === 1, `${marcada}`);
  // MARCAR É ESCOLHER VÁRIAS: o menu fica aberto, e a pesquisa também.
  ok("o menu continua aberto", (await page.locator("[data-menu-marcar-tags]").count()) === 1);
  ok("e a pesquisa continua escrita", (await valorDoCampo(page, "marcar-tags")) === "minuta");
  ok("com as mesmas duas na lista", (await visiveis(page, "data-tag-opcao")).length === 2);
  await escrever(page, "marcar-tags", "xyz");
  ok("nada casando, diz o que foi escrito", (await frase(page)) === "Nenhuma etiqueta com “xyz”.", await frase(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  4. "ASSUMIR" — O RESPONSÁVEL PELA CONVERSA
// ==================================================================
console.log("\n4. O menu do responsável");
{
  // A 1920: a 1400 com a ficha aberta, a linha do número escreve os selos em
  // ícone (ver "Tarefas e lembretes" no CLAUDE.md) — e o controle continua
  // sendo o mesmo.
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a conversa", await abrirConversa(page, ALVO));
  ok("abri o menu do responsável", await clicar(page, "[data-responsavel-da-conversa]"));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="responsavel"]').count()) === 1);
  ok("e com o cursor nele", await cursorNoCampo(page, "responsavel"));
  const todos = await visiveis(page, "data-passar-para");
  ok("sem nada escrito, os dez colegas", todos.length === 10, todos.join(", "));
  await page.keyboard.type("jose");
  await page.waitForTimeout(300);
  ok("“jose”, sem acento, acha o JOSÉ", (await visiveis(page, "data-passar-para")).join() === "u-jose",
     (await visiveis(page, "data-passar-para")).join(", "));
  // ASSUMIR NÃO É UM NOME: continua com qualquer coisa escrita.
  ok("e “Assumir esta conversa” continua no lugar",
     (await page.locator("[data-assumir-conversa]").count()) === 1);
  await escrever(page, "responsavel", "zzz");
  ok("ninguém casando, diz o que foi escrito", (await frase(page)) === "Ninguém com “zzz”.", await frase(page));
  ok("e “Assumir” continua ali também", (await page.locator("[data-assumir-conversa]").count()) === 1);
  await escrever(page, "responsavel", "leao marcia");
  ok("“leao marcia” acha a MÁRCIA LEÃO", (await visiveis(page, "data-passar-para")).join() === "u-marcia",
     (await visiveis(page, "data-passar-para")).join(", "));
  ok("passei a conversa para ela", await clicar(page, '[data-passar-para="u-marcia"]'));
  await page.waitForTimeout(500);
  const dono = await page.evaluate(() =>
    ((globalThis.__TABELAS.conversas || []).find((c) => c.id === "cv-pesq") || {}).responsavel_id);
  ok("e o banco gravou a Márcia como dona", dono === "u-marcia", String(dono));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  5. "QUEM PARTICIPOU DA CONVERSA"
// ==================================================================
console.log("\n5. O filtro de quem participou");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri o filtro de quem participou", await clicar(page, '[data-grupo="quem"]'));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="quem"]').count()) === 1);
  const todos = await visiveis(page, "data-quem");
  ok("a lista tem as pessoas novas (senão a cena mede outra coisa)",
     todos.includes("FÁBIO NUNES") && todos.length >= PESQUISA_A_PARTIR_DE, todos.join(", "));
  await escrever(page, "quem", "fabio");
  ok("“fabio” acha o FÁBIO NUNES", (await visiveis(page, "data-quem")).join() === "FÁBIO NUNES",
     (await visiveis(page, "data-quem")).join(", "));
  ok("marquei o Fábio", await clicar(page, '[data-quem="FÁBIO NUNES"]'));
  const filtrando = async () => (await page.locator('[data-grupo="quem"]').first().getAttribute("title")) || "";
  ok("e o filtro está ligado", /Filtrando/.test(await filtrando()), await filtrando());
  await escrever(page, "quem", "jose");
  ok("pesquisando outro nome, a lista mostra só o José", (await visiveis(page, "data-quem")).join() === "JOSÉ RIBEIRO",
     (await visiveis(page, "data-quem")).join(", "));
  ok("e o Fábio continua marcado, mesmo fora da vista", /Filtrando/.test(await filtrando()), await filtrando());
  await escrever(page, "quem", "zzz");
  ok("ninguém casando, diz o que foi escrito", (await frase(page)) === "Ninguém com “zzz”.", await frase(page));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  6. CONFIGURAÇÕES
// ==================================================================
console.log("\n6. As listas de Configurações");
async function abrirConfig(page, aba) {
  // PELO MENU, e não direto: o botão de Configurações mora dentro do menu ⋮
  // do topo. A ÚLTIMA aba com o nome, e não a primeira: atrás desta janela
  // ficou a fita de filtros, que também tem botão chamado "Etiquetas".
  if (!(await clicar(page, 'button[aria-label="Menu"]'))) return false;
  const config = page.getByRole("button", { name: "Configurações" });
  if (!(await config.count())) return false;
  await config.first().click();
  await page.waitForTimeout(600);
  const botao = page.getByRole("button", { name: aba, exact: true });
  if (!(await botao.count())) return false;
  await botao.last().click();
  await page.waitForTimeout(600);
  return true;
}
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri Configurações → Mensagens rápidas", await abrirConfig(page, "Mensagens rápidas"));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="rapidas-da-config"]').count()) === 1);
  // AQUI O CURSOR NÃO VEM NO CAMPO: a tela tem a sua ação principal (Nova),
  // e não é um menu que se abre para procurar.
  ok("sem o cursor nele", !(await cursorNoCampo(page, "rapidas-da-config")));
  ok("sem nada escrito, as oito", (await visiveis(page, "data-rapida-da-config")).length === RAPIDAS.length);
  await escrever(page, "rapidas-da-config", "saudacao");
  ok("“saudacao” acha a Saudação", (await visiveis(page, "data-rapida-da-config")).join() === "Saudação",
     (await visiveis(page, "data-rapida-da-config")).join(", "));
  await escrever(page, "rapidas-da-config", "minuta conferencia");
  ok("“minuta conferencia” acha pelo título E pelo texto",
     (await visiveis(page, "data-rapida-da-config")).join() === "Envio da minuta",
     (await visiveis(page, "data-rapida-da-config")).join(", "));
  // O LÁPIS: a pesquisa sobrevive a editar e voltar.
  ok("abri o lápis da rápida achada", await clicar(page, "[data-editar-rapida]"));
  ok("(o formulário abriu)", (await page.locator("[data-salvar-rapida]").count()) === 1);
  const cancelar = page.getByRole("button", { name: "Cancelar", exact: true });
  if (await cancelar.count()) { await cancelar.last().click(); await page.waitForTimeout(400); }
  ok("cancelando, a lista volta ainda filtrada",
     (await visiveis(page, "data-rapida-da-config")).join() === "Envio da minuta",
     (await visiveis(page, "data-rapida-da-config")).join(", "));
  ok("com o que foi escrito no campo", (await valorDoCampo(page, "rapidas-da-config")) === "minuta conferencia");
  await escrever(page, "rapidas-da-config", "zzz");
  ok("nada casando, diz o que foi escrito", (await frase(page)) === "Nenhuma mensagem rápida com “zzz”.",
     await frase(page));

  // CADA ABA COMEÇA A SUA.
  const etiquetas = page.getByRole("button", { name: "Etiquetas", exact: true });
  if (await etiquetas.count()) { await etiquetas.last().click(); await page.waitForTimeout(500); }
  ok("na aba Etiquetas o campo começa vazio", (await valorDoCampo(page, "etiquetas-da-config")) === "");
  ok("com as trinta", (await visiveis(page, "data-etiqueta-da-config")).length === TOTAL_DE_ETIQUETAS,
     `${(await visiveis(page, "data-etiqueta-da-config")).length}`);
  await escrever(page, "etiquetas-da-config", "minuta");
  const nomes = await visiveis(page, "data-etiqueta-da-config");
  ok("“minuta” deixa as duas", nomes.length === 2 && nomes.includes("Ag. assinatura da minuta"), nomes.join(", "));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  7. AS PESQUISAS QUE JÁ EXISTIAM, AGORA SEM ACENTO
// ==================================================================
console.log("\n7. O “/” das rápidas, o Encaminhar e os departamentos");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("abri a conversa", await abrirConversa(page, ALVO));
  const caixa = page.locator('textarea[placeholder*="Digite uma mensagem"]');
  if (await caixa.count()) { await caixa.first().fill("/saudacao"); await page.waitForTimeout(400); }
  ok("“/saudacao” acha a Saudação no menu do “/”",
     (await visiveis(page, "data-rapida-no-menu")).join() === "Saudação",
     (await visiveis(page, "data-rapida-no-menu")).join(", "));
  if (await caixa.count()) { await caixa.first().fill("/minuta conferencia"); await page.waitForTimeout(400); }
  ok("e “/minuta conferencia” acha pelo título e pelo texto",
     (await visiveis(page, "data-rapida-no-menu")).join() === "Envio da minuta",
     (await visiveis(page, "data-rapida-no-menu")).join(", "));
  if (await caixa.count()) { await caixa.first().fill(""); await page.waitForTimeout(200); }

  // ENCAMINHAR: a conversa da Maria das Graças, escrita sem acento e fora de
  // ordem.
  await page.locator('[data-msg-id="m-pesq-1"]').hover().catch(() => {});
  ok("abri o menu de uma mensagem", await clicar(page, '[data-msg-id="m-pesq-1"] button[aria-label="Opções da mensagem"]'));
  ok("escolhi Encaminhar", await clicar(page, 'div[data-menu-msg] button:has-text("Encaminhar")'));
  const busca = page.locator('input[placeholder="Pesquisar conversa"]');
  if (await busca.count()) { await busca.first().fill("destino gracas"); await page.waitForTimeout(300); }
  const destinos = await visiveis(page, "data-encaminhar-para");
  ok("“destino gracas” acha a MARIA DAS GRAÇAS DESTINO", destinos.join() === "cv-destino", destinos.join(", "));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // DEPARTAMENTOS: a bancada tem oito, e o campo já aparecia; o que muda é a
  // conta.
  ok("abri a lista de departamentos", await clicar(page, 'button[title="Trocar de departamento"]'));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="departamentos"]').count()) === 1);
  await escrever(page, "departamentos", "audiencias");
  const deptos = await page.evaluate(() => [...document.querySelectorAll('[role="listbox"] button[role="option"]')]
    .map((b) => b.innerText.split("\n")[0].trim()));
  ok("“audiencias”, sem acento, acha Audiências", deptos.length === 1 && /Audiências/.test(deptos[0]), deptos.join(", "));
  await escrever(page, "departamentos", "cliente sucesso");
  const deptos2 = await page.evaluate(() => [...document.querySelectorAll('[role="listbox"] button[role="option"]')]
    .map((b) => b.innerText.split("\n")[0].trim()));
  ok("“cliente sucesso” acha Sucesso do Cliente", deptos2.length === 1 && /Sucesso do Cliente/.test(deptos2[0]),
     deptos2.join(", "));
  // FECHADO SEM ESCOLHER, a pesquisa vai junto.
  // NO MEIO DA CONVERSA, que é "fora" e não abre nada: no canto da barra
  // lateral mora o rosto que abre Configurações.
  await page.mouse.click(1300, 500);
  await page.waitForTimeout(300);
  ok("cliquei fora e a lista fechou", (await page.locator('[data-campo-de-pesquisa="departamentos"]').count()) === 0);
  ok("reabri a lista", await clicar(page, 'button[title="Trocar de departamento"]'));
  ok("e o campo voltou vazio", (await valorDoCampo(page, "departamentos")) === "");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  8. NO CELULAR
// ==================================================================
console.log("\n8. No celular, o campo existe e o cursor não vem nele");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 390, altura: 844 });
  ok("abri o menu da seta", await clicar(page, "[data-mais-filtros]"));
  ok("o campo de pesquisa está lá", (await page.locator('[data-campo-de-pesquisa="mais-filtros"]').count()) === 1);
  ok("mas sem o cursor nele — senão o teclado cobriria a lista",
     !(await cursorNoCampo(page, "mais-filtros")));
  const altura = await page.evaluate(() => {
    const el = document.querySelector('[data-campo-de-pesquisa="mais-filtros"] input');
    return el ? el.getBoundingClientRect().height : 0;
  });
  ok("e o campo tem o alvo de dedo (40px)", altura >= 39.5, `${altura}`);
  const largo = await page.evaluate(() => {
    const m = document.querySelector("[data-menu-mais-filtros]");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return { esquerda: r.left, direita: r.right, janela: window.innerWidth };
  });
  ok("e o menu cabe na tela do celular", largo && largo.esquerda >= 0 && largo.direita <= largo.janela,
     JSON.stringify(largo));
  const campo = page.locator('[data-campo-de-pesquisa="mais-filtros"] input');
  if (await campo.count()) { await campo.first().tap(); await campo.first().fill("minuta"); await page.waitForTimeout(300); }
  ok("tocando e escrevendo, filtra igual", (await visiveis(page, "data-etiqueta-da-seta")).length === 2,
     (await visiveis(page, "data-etiqueta-da-seta")).join(", "));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  9. COM POUCOS ITENS, CAMPO NENHUM
// ==================================================================
console.log("\n9. Com as duas etiquetas e os dois colegas da bancada, nenhum campo");
{
  const { ctx, page, estouros } = await abrirPainel({ comMuitos: false });
  ok("abri o menu da seta", await clicar(page, "[data-mais-filtros]"));
  ok("as duas etiquetas estão lá", (await visiveis(page, "data-etiqueta-da-seta")).length === 2);
  ok("e não há campo de pesquisa", (await page.locator('[data-campo-de-pesquisa="mais-filtros"]').count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const primeira = await page.locator("[data-conversa-nome]").first().getAttribute("data-conversa-nome");
  ok("abri uma conversa", await abrirConversa(page, primeira));
  ok("abri o menu do responsável", await clicar(page, "[data-responsavel-da-conversa]"));
  ok("com os dois colegas", (await visiveis(page, "data-passar-para")).length === 2,
     (await visiveis(page, "data-passar-para")).join(", "));
  ok("e sem campo de pesquisa", (await page.locator('[data-campo-de-pesquisa="responsavel"]').count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  10. O FUNIL E A EQUIPE
// ==================================================================
console.log("\n10. A pesquisa do Funil e a da equipe, pela mesma conta");
{
  const { ctx, page, estouros } = await abrirPainel({ largura: 1400, altura: 900 });
  ok("abri o menu do topo", await clicar(page, 'button[aria-label="Menu"]'));
  ok("e o Funil", await clicar(page, "[data-abrir-funil]"));
  await page.waitForTimeout(600);
  const busca = page.locator("[data-busca-no-funil]");
  ok("(os dois cartões estão no funil)",
     (await page.locator('[data-cartao-do-funil="ct-funil-joao"]').count()) === 1
       && (await page.locator('[data-cartao-do-funil="ct-funil-maria"]').count()) === 1);
  if (await busca.count()) { await busca.first().fill("funil joao"); await page.waitForTimeout(400); }
  ok("“funil joao”, sem acento e fora de ordem, acha o JOÃO DO FUNIL",
     (await page.locator('[data-cartao-do-funil="ct-funil-joao"]').count()) === 1);
  ok("e só ele", (await page.locator('[data-cartao-do-funil="ct-funil-maria"]').count()) === 0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // A EQUIPE, em Departamentos e acessos → Atendentes. A lista vem da ponte
  // (`/permissoes/atendentes`), e a de mentira responde a equipe que a cena
  // pede.
  const pessoa = (id, login, nome) => ({ id, login, nome, email: `${login}@x`, admin: false, ativo: true,
    ja_entrou: true, zorvin_definido: false, zorvin_so_telefones: false, zorvin: [], zorvin_telefones: [] });
  await page.route("**/ponte-de-mentira/permissoes/atendentes", (rota) => rota.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, com_vantoro: true, usuarios: [
      pessoa("u-jose", "jose", "JOSÉ RIBEIRO"), pessoa("u-marcia", "marcia", "MÁRCIA LEÃO"),
      pessoa("u-ana", "ana", "ANA PAULA SOUZA")] }) }));
  ok("abri o menu do topo de novo", await clicar(page, 'button[aria-label="Menu"]'));
  const dep = page.getByRole("button", { name: "Departamentos e acessos" });
  if (await dep.count()) { await dep.first().click(); await page.waitForTimeout(500); }
  const atendentes = page.getByRole("button", { name: "Atendentes", exact: true });
  if (await atendentes.count()) { await atendentes.first().click(); await page.waitForTimeout(900); }
  ok("(a equipe da ponte está na lista)", (await page.locator("[data-pessoa-da-equipe]").count()) === 3,
     `${await page.locator("[data-pessoa-da-equipe]").count()}`);
  const campo = page.locator('input[placeholder="Pesquisar…"]');
  // "JOSE RIBEIRO", SEM ACENTO E NESTA ORDEM, e não ao contrário: a conta de
  // antes juntava nome, login e e-mail numa frase só ("josé ribeiro jose
  // jose@x"), e "ribeiro jose" aparecia ali colado — a sabotagem que devolve a
  // conta de antes passou na primeira escrita desta cena.
  if (await campo.count()) { await campo.first().fill("jose ribeiro"); await page.waitForTimeout(300); }
  const achados = await page.$$eval("[data-pessoa-da-equipe]", (ns) => ns.map((n) => n.getAttribute("data-pessoa-da-equipe")));
  ok("“jose ribeiro”, sem acento, acha o JOSÉ RIBEIRO, e só ele", achados.join() === "u-jose", achados.join(", "));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
