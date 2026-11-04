// QUEM SAIU FICA NO FIM DO FILTRO "QUEM PARTICIPOU DA CONVERSA" (04/11)
//
// A pergunta que ficou da entrega de quem saiu (#309): tirar quem saiu também
// do filtro "Quem participou da conversa"? A recomendação foi MANTER, no fim
// da lista e marcado como "saiu" — o filtro é o jeito de achar os clientes que
// a pessoa atendia, e é história, e não escolha. A resposta do Rodrigo: "Pode
// fazer como você recomendou no filtro".
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. com o 047: quem saiu CONTINUA no filtro, no FIM da lista — mesmo tendo
//      participado de mais conversas do que todo mundo, que é o que o poria no
//      alto pela ordem do banco —, marcado "saiu" e com a contagem. As pessoas
//      de hoje ficam na ordem do banco e sem a marca, e a conta que a equipe
//      não conhece ("Rodrigo ADMIN", a conta apagada da bancada) também fica
//      sem ela: pode ser a de quem juntou duas contas e continua no escritório.
//      O nome comprido perde letras, e a marca não (o que está PINTADO). A
//      pesquisa guarda a ordem. E marcar quem saiu filtra as conversas dela;
//   2. o banco sem o 047: ninguém é marcado, e a ordem é a do banco — como
//      sempre foi. É o contraste da cena 1: a mesma lista, com quem saiu no
//      ALTO;
//   3. quem sai no meio do dia: a renovação da sessão relê a equipe, e ela vai
//      para o fim, marcada — numa lista curta, SEM o campo de pesquisa, que é
//      o outro caminho do menu.
//
// Os nomes são de mentira (o repositório é público).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const agora = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// QUEM SAIU: duas pessoas. A do nome comprido participou de MAIS conversas do
// que todo mundo; a outra, de menos — e as duas têm de ir para o fim, na ordem
// do banco entre elas.
const ZU = "u-zuleica-saiu";
const NOME_ZU = "ZULEICA APARECIDA DOS SANTOS OLIVEIRA";
const IS = "u-isadora-saiu";
const NOME_IS = "ISADORA QUE SAIU";

/** O menu "Quem participou": abre (se fechado) e lê cada pessoa, na ordem da tela. */
async function lerMenu(page) {
  if (!(await page.locator("[data-menu-quem]").count())) {
    const b = page.locator('[data-grupo="quem"]');
    if (!(await b.count())) return { aberto: false, itens: [], pesquisa: false };
    await b.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const aberto = (await page.locator("[data-menu-quem]").count()) > 0;
  const itens = await page.evaluate(() => [...document.querySelectorAll("[data-menu-quem] [data-quem]")].map((el) => ({
    nome: el.getAttribute("data-quem"),
    saiu: el.hasAttribute("data-quem-saiu"),
    marca: el.querySelector("[data-marca-saiu]")?.textContent.trim() ?? null,
    texto: el.innerText.replace(/\s+/g, " ").trim(),
  })));
  const pesquisa = (await page.locator("[data-menu-quem] input").count()) > 0;
  return { aberto, itens, pesquisa };
}
async function fecharMenu(page) {
  if (!(await page.locator("[data-menu-quem]").count())) return;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if (await page.locator("[data-menu-quem]").count()) {
    await page.mouse.click(700, 500);
    await page.waitForTimeout(300);
  }
}
const nomes = (itens) => itens.map((i) => i.nome);

// ------------------------------------------------------------------
// O TELEFONE QUE O PAINEL ABRE, as conversas dele e o que o filtro mostra sem
// ninguém que saiu — descobertos, e não escolhidos a dedo.
const descoberta = await (async () => {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  const tel = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const tab = globalThis.__TABELAS;
    const c = (tab.conversas || []).find((x) => String(x.id) === String(cid));
    if (!c) return null;
    const dele = (tab.conversas || []).filter((x) => String(x.advogado_id) === String(c.advogado_id))
      .sort((a, b) => String(b.ultima_atividade || "").localeCompare(String(a.ultima_atividade || "")))
      .map((x) => String(x.id));
    return { adv: c.advogado_id, conversas: dele };
  });
  const menu = await lerMenu(page);
  await ctx.close();
  return { ...(tel || {}), menu };
})();
ok("aprendi qual telefone o painel abre", Boolean(descoberta.adv));
ok("e o que o filtro mostra nele, sem ninguém que saiu", descoberta.menu.itens.length >= 3, JSON.stringify(descoberta.menu.itens));
if (!descoberta.adv || descoberta.menu.itens.length < 3) { await nav.close(); process.exit(1); }

// GUARDADA: o item que não existe (a sabotagem que tira quem saiu) é zero, e
// não um estouro que esconde quais conferências viram o defeito.
const contagem = (it) => Number((String((it && it.texto) || "").match(/(\d+)$/) || [])[1] || 0);
const MAIOR = Math.max(...descoberta.menu.itens.map(contagem));
const ISABELA = descoberta.menu.itens.find((i) => i.nome === "ISABELA GUEDES");
ok("a ISABELA está no filtro deste telefone (a pesquisa da cena 1 depende dela)", Boolean(ISABELA),
   JSON.stringify(nomes(descoberta.menu.itens)));
const N_ZU = MAIOR + 2;                              // mais do que todo mundo
const N_IS = (ISABELA ? contagem(ISABELA) : 0) + 1;  // mais do que a ISABELA
ok("o telefone tem conversas para as duas", descoberta.conversas.length >= N_ZU + N_IS,
   `${descoberta.conversas.length} conversas, preciso de ${N_ZU + N_IS}`);
const CONVERSAS_DA_ZU = descoberta.conversas.slice(0, N_ZU);
const CONVERSAS_DA_IS = descoberta.conversas.slice(N_ZU, N_ZU + N_IS);
const DE_HOJE = nomes(descoberta.menu.itens);        // quem atende hoje, sem quem saiu
// A ORDEM DO BANCO, CALCULADA AQUI pela regra da função (quem participou de
// mais conversas primeiro, e o nome desempata) — e não lida do menu da
// descoberta: lida de lá, ela viria do mesmo painel que está sendo provado, e
// um painel que reordenasse as pessoas de hoje passaria pela conferência
// (foi a sabotagem que mostrou).
const ORDEM_DO_BANCO = [...descoberta.menu.itens]
  .sort((a, b) => contagem(b) - contagem(a) || String(a.nome).localeCompare(String(b.nome)))
  .map((i) => i.nome);

function semente({ zuAtiva = false, comIsadora = true, isAtiva = false } = {}) {
  const usuarios = [{ id: ZU, admin: false, nome: NOME_ZU, foto_url: null, ativo: zuAtiva }];
  if (comIsadora) usuarios.push({ id: IS, admin: false, nome: NOME_IS, foto_url: null, ativo: isAtiva });
  const fala = (quem, nome, convs, prefixo) => convs.map((cid, i) => ({
    id: `m-${prefixo}-${i}`, conversa_id: cid, origem: "advogado", tipo: "texto", texto: "Bom dia, tudo certo por aí?",
    criado_em: iso(agora - (i + 2) * 86400e3), id_uazapi: `ID-${prefixo.toUpperCase()}-${i}`, status: "lida",
    enviado_por: nome, enviado_por_id: quem, enviado_por_foto: null,
  }));
  return {
    usuarios,
    mensagens: [...fala(ZU, NOME_ZU, CONVERSAS_DA_ZU, "zu"),
                ...(comIsadora ? fala(IS, NOME_IS, CONVERSAS_DA_IS, "is") : [])],
  };
}

/** TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula. */
async function abrirPainel({ semente: sem, sem047 = false }) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => {
    globalThis.__SEMENTE = d.semente;
    globalThis.__SEM_COLUNAS = d.sem047 ? { equipe: ["ativo"] } : {};
  }, { semente: sem, sem047 });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

// ------------------------------------------------------------------
console.log("\n1. Com o 047: quem saiu continua no filtro, no fim e marcado");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: semente() });
  const m = await lerMenu(page);
  ok("o menu \"Quem participou\" abre", m.aberto);
  const lista = nomes(m.itens);
  ok("quem saiu CONTINUA no filtro — as duas", lista.includes(NOME_ZU) && lista.includes(NOME_IS), JSON.stringify(lista));
  ok("e as pessoas de hoje também, todas", DE_HOJE.every((n) => lista.includes(n)) && lista.length === DE_HOJE.length + 2,
     JSON.stringify(lista));

  const posZu = lista.indexOf(NOME_ZU), posIs = lista.indexOf(NOME_IS);
  const ultimaDeHoje = Math.max(...DE_HOJE.map((n) => lista.indexOf(n)));
  ok("quem saiu vem DEPOIS de todas as pessoas de hoje", posZu > ultimaDeHoje && posIs > ultimaDeHoje,
     JSON.stringify(lista));
  ok(`mesmo a que participou de mais conversas do que todo mundo (${N_ZU})`,
     posZu > ultimaDeHoje && contagem(m.itens[posZu] || { texto: "" }) === N_ZU, JSON.stringify(m.itens[posZu]));
  ok("entre quem saiu, a ordem é a do banco: quem participou de mais conversas primeiro",
     posZu >= 0 && posIs > posZu, JSON.stringify(lista));
  ok("as pessoas de hoje na ordem do banco, como antes",
     JSON.stringify(lista.filter((n) => DE_HOJE.includes(n))) === JSON.stringify(ORDEM_DO_BANCO),
     `${JSON.stringify(lista)}, e o banco diz ${JSON.stringify(ORDEM_DO_BANCO)}`);

  const marcados = m.itens.filter((i) => i.saiu).map((i) => i.nome);
  ok("as duas que saíram são marcadas, e só elas",
     marcados.length === 2 && marcados.includes(NOME_ZU) && marcados.includes(NOME_IS), JSON.stringify(marcados));
  const itZu = m.itens[posZu] || {};
  ok("a marca diz \"saiu\", com a palavra", itZu.marca === "saiu", JSON.stringify(itZu));
  ok("e a contagem continua ao lado (é o \"quanto vou ver se marcar\")", contagem(itZu) === N_ZU, JSON.stringify(itZu));
  const semMarcaNasDeHoje = m.itens.filter((i) => DE_HOJE.includes(i.nome)).map((i) => i.marca);
  ok("as pessoas de hoje não têm a marca", semMarcaNasDeHoje.length === DE_HOJE.length && semMarcaNasDeHoje.every((x) => x === null),
     JSON.stringify(m.itens));
  ok("nem a conta que a equipe não conhece (\"Rodrigo ADMIN\", a conta apagada)",
     lista.includes("Rodrigo ADMIN") && !marcados.includes("Rodrigo ADMIN"), JSON.stringify(m.itens));

  // O NOME COMPRIDO PERDE LETRAS, E A MARCA NÃO — o que está PINTADO.
  const pintura = await page.evaluate((nome) => {
    const el = [...document.querySelectorAll("[data-menu-quem] [data-quem]")].find((x) => x.getAttribute("data-quem") === nome);
    const marca = el && el.querySelector("[data-marca-saiu]");
    if (!el || !marca) return null;
    el.scrollIntoView({ block: "center" });
    const r = marca.getBoundingClientRect();
    const menu = document.querySelector("[data-menu-quem]").getBoundingClientRect();
    const alvo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const spans = [...el.querySelectorAll(":scope > span")];
    const nomeEl = spans.find((s) => s.textContent === nome);
    const conta = spans[spans.length - 1].getBoundingClientRect();
    return {
      pintada: Boolean(alvo && marca.contains(alvo)),
      dentroDoMenu: r.left >= menu.left && r.right <= menu.right,
      antesDaConta: r.right <= conta.left + 0.5,
      nomeCortado: Boolean(nomeEl) && nomeEl.scrollWidth > nomeEl.clientWidth,
    };
  }, NOME_ZU);
  ok("o nome comprido perde letras (reticências)", Boolean(pintura && pintura.nomeCortado), JSON.stringify(pintura));
  ok("e a marca está PINTADA, inteira, dentro do menu e antes da contagem",
     Boolean(pintura && pintura.pintada && pintura.dentroDoMenu && pintura.antesDaConta), JSON.stringify(pintura));

  // A PESQUISA GUARDA A ORDEM: "isa" acha a ISABELA (de hoje) e a ISADORA (que
  // saiu) — e pela ordem do banco a ISADORA viria antes, por ter mais conversas.
  ok("com sete pessoas, o menu tem o campo de pesquisa", m.pesquisa);
  await page.locator("[data-menu-quem] input").first().fill("isa").catch(() => {});
  await page.waitForTimeout(300);
  const achados = await lerMenu(page);
  ok("a pesquisa \"isa\" acha a de hoje e a que saiu, nessa ordem",
     JSON.stringify(nomes(achados.itens)) === JSON.stringify(["ISABELA GUEDES", NOME_IS]), JSON.stringify(achados.itens));
  ok("e a que saiu continua marcada no achado",
     achados.itens.length === 2 && achados.itens[1].marca === "saiu" && achados.itens[0].marca === null,
     JSON.stringify(achados.itens));
  await page.locator("[data-menu-quem] input").first().fill("").catch(() => {});
  await page.waitForTimeout(200);

  // MARCAR QUEM SAIU FILTRA AS CONVERSAS DELA — é para isso que ela fica.
  await page.locator(`[data-menu-quem] [data-quem="${NOME_ZU}"]`).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  await fecharMenu(page);
  await page.waitForTimeout(1200);
  const naLista = await page.locator("[data-conversa-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-conversa-id")));
  ok("marcá-la filtra a lista", naLista.length > 0, JSON.stringify(naLista));
  ok("e só ficam conversas em que ela participou",
     naLista.length > 0 && naLista.every((id) => CONVERSAS_DA_ZU.includes(id)),
     `${naLista.filter((id) => !CONVERSAS_DA_ZU.includes(id)).length} de fora: ${JSON.stringify(naLista)}`);
  const rastro = (await page.locator("[data-filtro-quem]").count())
    ? (await page.locator("[data-filtro-quem]").first().innerText().catch(() => "")) : "";
  ok("e o rastro na fita diz o nome dela", rastro.includes(NOME_ZU.split(" ")[0]), rastro);

  ok("sem a faixa âmbar", (await page.locator("[data-falha-de-leitura]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n2. O banco sem o 047: ninguém é marcado, e a ordem é a do banco");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: semente(), sem047: true });
  const m = await lerMenu(page);
  ok("o menu abre, com as mesmas sete pessoas", m.aberto && m.itens.length === DE_HOJE.length + 2, JSON.stringify(nomes(m.itens)));
  ok("ninguém é marcado — o banco não sabe quem saiu",
     m.itens.length > 0 && m.itens.every((i) => !i.saiu && i.marca === null), JSON.stringify(m.itens));
  ok("e a ordem é a do banco: quem participou de mais conversas vem PRIMEIRO",
     m.itens.length > 0 && m.itens[0].nome === NOME_ZU, JSON.stringify(nomes(m.itens)));
  ok("sem a faixa âmbar: a coluna que falta não é falha", (await page.locator("[data-falha-de-leitura]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n3. Quem sai no meio do dia: a equipe relida a manda para o fim, marcada");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: semente({ zuAtiva: true, comIsadora: false }) });
  const antes = await lerMenu(page);
  ok("enquanto ela está no escritório, vem no ALTO, sem marca (o contraste)",
     antes.itens.length > 0 && antes.itens[0].nome === NOME_ZU && antes.itens[0].marca === null, JSON.stringify(antes.itens));
  ok("é uma lista curta: o menu não tem o campo de pesquisa", antes.aberto && !antes.pesquisa,
     `${antes.itens.length} pessoas`);
  await fecharMenu(page);

  // ELA SAI: o banco a desliga, e a sessão se renova (a renovação de hora em
  // hora da biblioteca, que troca o objeto da sessão e relê a equipe).
  await page.evaluate((id) => {
    const u = (globalThis.__TABELAS.usuarios || []).find((x) => String(x.id) === id);
    if (u) u.ativo = false;
    globalThis.__ENTRADA_DA_BIBLIOTECA("u1");
  }, ZU);
  await page.waitForTimeout(1800);

  const depois = await lerMenu(page);
  ok("ela continua no filtro", nomes(depois.itens).includes(NOME_ZU), JSON.stringify(nomes(depois.itens)));
  ok("agora no FIM", depois.itens.length > 1 && depois.itens[depois.itens.length - 1].nome === NOME_ZU,
     JSON.stringify(nomes(depois.itens)));
  ok("e marcada \"saiu\"", depois.itens.length > 0 && depois.itens[depois.itens.length - 1].marca === "saiu",
     JSON.stringify(depois.itens[depois.itens.length - 1]));
  ok("ainda sem o campo de pesquisa — o caminho do menu curto", depois.aberto && !depois.pesquisa);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas} de ${feitas} conferências passaram.`);
if (falhas) { console.log(`${falhas} FALHA(S).`); process.exit(1); }
