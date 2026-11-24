// A FICHA DO VANTORO PROCURA O CLIENTE COMO O VANTORO PROCURA (24/11).
//
// Pedido do Rodrigo, com a foto do campo de CPF da ficha sem cadastro:
// "Preciso que na Ficha do Vantoro, tenha a opção de pesquisa igual do
// Vantoro, onde podemos localizar o cliente pelo nome, CPF, e-mail, etc."
//
// O QUE ESTA PROVA VIGIA:
//
//   * a procura vem primeiro, antes do pré-cadastro (a régua de 29/09: a
//     primeira pergunta é "ele já é cliente?");
//   * a pergunta vai à busca do Vantoro com o termo como foi escrito, só
//     quando a pessoa para de digitar, e a resposta de um termo antigo não
//     vira a lista do termo novo;
//   * cada achado diz quem é (nome, CPF, telefones, e-mail) e oferece
//     acrescentar o número desta conversa (a ficha inteira primeiro, o número
//     depois, o vínculo por último) ou só abrir, sem mexer em nada;
//   * "não achei" e "não consegui procurar" são frases diferentes;
//   * o CPF que ninguém tem vai para o pré-cadastro, e o CPF do pré-cadastro
//     continua conferido;
//   * e a lista cabe na ficha, na gaveta e no celular.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const digitos = (s) => String(s || "").replace(/\D/g, "");

// OS CADASTROS DE MENTIRA. Nomes e números inventados.
const CADASTROS = [
  { id: 501, nome: "MARIA DAS GRAÇAS PEREIRA", cpf: "123.456.789-09", telefone: "11987654321",
    telefone2: "", email: "maria.gracas@exemplo.com" },
  { id: 502, nome: "MARIA SILVA", cpf: "", telefone: "21912345678", telefone2: "2133334444", email: "" },
  { id: 503, nome: "ANA BEATRIZ COSTA", cpf: "987.654.321-00", telefone: "31988887777", telefone2: "",
    email: "ana+teste@exemplo.com" },
  { id: 504, nome: "JOÃO PEDRO ALVES", cpf: "", telefone: "41977776666", telefone2: "", email: "" },
  { id: 505, nome: "JOÃO SANTOS", cpf: "", telefone: "51966665555", telefone2: "", email: "" },
];
const CPF_DA_MARIA = "12345678909";
const LOTE = Array.from({ length: 20 }, (_, i) => ({ id: 600 + i, nome: `LOTE CLIENTE ${i + 1}`, cpf: "",
  telefone: `1190000${String(1000 + i)}`, telefone2: "", email: "" }));

const ficha = (c) => ({ ...c, cidade: "", processos: [], documentos: 0, ordem_servico: null, observacoes: "",
                        telefones: c.telefone ? [{ id: 9000 + c.id, numero: c.telefone, digitos: c.telefone,
                          principal: true, proprio: true, dono: "", observacao: "", usado_por: [] }] : [] });

const estado = { buscaFalha: false, atraso: {}, idas: [], numeroDaConversa: null };

function procurar(termo) {
  if (termo === "lote") return { clientes: LOTE };
  if (termo === "0009999") {
    return { clientes: [], processos_sem_cliente: [{ id: 1, numero: "0009999-11.2024", nome_no_processo: "FULANO DO PROCESSO",
                                                     reu: "BANCO", tipo_acao: "COBRANÇA" }] };
  }
  const t = semAcento(termo), d = digitos(termo);
  return { clientes: CADASTROS.filter((c) => semAcento(c.nome).includes(t)
    || (c.email && c.email.toLowerCase().includes(String(termo).toLowerCase()))
    || (d.length >= 3 && [c.cpf, c.telefone, c.telefone2].some((x) => x && digitos(x).includes(d)))) };
}

const nav = await abrirNavegador();

async function abrirFicha(largura = 1500, altura = 900) {
  const celular = largura < 768;
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura },
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    const json = (corpo, status = 200) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/vantoro/status")) return json({ ligado: true, configurado: true });
    if (url.pathname.endsWith("/vantoro/buscar")) {
      const termo = url.searchParams.get("q") || "";
      estado.idas.push({ o: "buscar", q: termo });
      if (estado.buscaFalha) return rota.abort();
      const espera = estado.atraso[termo] || 0;
      if (espera) await new Promise((r) => setTimeout(r, espera));
      return json({ ok: true, ...procurar(termo) });
    }
    if (url.pathname.endsWith("/vantoro/cpf-existe")) {
      const cpf = digitos(url.searchParams.get("cpf"));
      estado.idas.push({ o: "cpf", cpf });
      if (cpf === CPF_DA_MARIA) {
        return json({ ok: true, encontrado: true, cliente: { id: 501, nome: CADASTROS[0].nome, cpf: CADASTROS[0].cpf,
                                                              telefone: CADASTROS[0].telefone, processos: 0, documentos: 0 } });
      }
      return json({ ok: true, encontrado: false });
    }
    let m = url.pathname.match(/\/vantoro\/cliente\/(\d+)\/telefones$/);
    if (m && req.method() === "POST") {
      let corpo = null;
      try { corpo = JSON.parse(req.postData() || "null"); } catch (_) { /* nulo */ }
      estado.idas.push({ o: "acrescentar", id: m[1], corpo });
      const c = [...CADASTROS, ...LOTE].find((x) => String(x.id) === m[1]);
      return json({ ok: true, telefones: [...ficha(c).telefones,
        { id: 99001, numero: corpo?.numero, digitos: digitos(corpo?.numero), principal: false, proprio: true,
          dono: "", observacao: "", usado_por: [] }] });
    }
    m = url.pathname.match(/\/vantoro\/cliente\/(\d+)$/);
    if (m) {
      estado.idas.push({ o: "ficha", id: m[1] });
      const c = [...CADASTROS, ...LOTE].find((x) => String(x.id) === m[1]);
      return c ? json({ ok: true, cliente: ficha(c) }) : json({ ok: false, erro: "não achei" }, 404);
    }
    if (url.pathname.endsWith("/vantoro/cliente")) {
      estado.numeroDaConversa = url.searchParams.get("telefone");
      return json({ ok: true, clientes: [] });
    }
    return json({ ok: true });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await page.locator("[data-conversa-nome]").first().click().catch(() => {});
  await page.waitForTimeout(1000);
  if (!(await page.locator("[data-ficha]").count())) {
    const b = page.locator("[data-abrir-ficha]");
    if (await b.count() && await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => {});
    else {
      const mais = page.getByRole("button", { name: "Mais opções desta conversa" });
      if (await mais.count()) {
        await mais.first().click().catch(() => {});
        await page.waitForTimeout(300);
        const item = page.locator("[data-menu-ficha]");
        if (await item.count()) await item.first().click().catch(() => {});
      }
    }
  }
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

const CAMPO = "[data-ficha] [data-busca-sem-cadastro]";
const resposta = (page) => page.locator("[data-ficha] [data-busca-no-vantoro]");
const estadoDa = (page) => resposta(page).count().then((n) => (n ? resposta(page).first().getAttribute("data-busca-no-vantoro") : null));
const textoDe = (loc) => loc.count().then((n) => (n ? loc.first().innerText().then((t) => t.replace(/\s+/g, " ")).catch(() => "") : ""));
const achados = (page) => page.evaluate(() => [...document.querySelectorAll("[data-ficha] [data-achado-na-busca]")]
  .map((e) => e.getAttribute("data-achado-na-busca")));
async function digitar(page, termo, { devagar = false } = {}) {
  const campo = page.locator(CAMPO);
  if (!(await campo.count())) return false;
  try {
    await campo.fill("");
    if (devagar) await campo.pressSequentially(termo, { delay: 70 });
    else await campo.fill(termo);
  } catch (_) { return false; }
  return true;
}
async function esperarEstado(page, alvo, ms = 4000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if ((await estadoDa(page)) === alvo) return true;
    await page.waitForTimeout(80);
  }
  return false;
}
async function comecarFilme(page) {
  await page.evaluate(() => {
    globalThis.__filme = [];
    clearInterval(globalThis.__relogioDoFilme);
    globalThis.__relogioDoFilme = setInterval(() => {
      for (const m of document.body.innerText.match(/(Acrescentei|já estava|Não consegui|Nada foi alterado|Abri o cadastro)[^\n]*/g) || []) {
        if (!globalThis.__filme.includes(m)) globalThis.__filme.push(m);
      }
    }, 50);
  });
}
const filme = (page) => page.evaluate(() => globalThis.__filme || []);
const ligadoA = (page) => page.evaluate((n) => {
  const c = (globalThis.__TABELAS.contatos || []).find((x) => String(x.numero) === String(n));
  return c ? (c.vantoro_cliente_id ?? null) : "sem contato";
}, estado.numeroDaConversa);
const buscas = () => estado.idas.filter((i) => i.o === "buscar");

// ------------------------------------------------------------------
console.log("\n1. A procura vem primeiro, e diz por onde procura");
{
  const { ctx, page, estouros } = await abrirFicha();
  ok("a ficha sem cadastro abriu", await page.locator("[data-ficha]").count() === 1);
  const ordem = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("[data-ficha] input")];
    const busca = document.querySelector("[data-ficha] [data-busca-sem-cadastro]");
    const cpf = document.querySelector("[data-ficha] [data-cpf-sem-cadastro]");
    return { busca: inputs.indexOf(busca), cpf: inputs.indexOf(cpf) };
  });
  ok("o campo de procurar é o primeiro da ficha", ordem.busca === 0, q(ordem));
  ok("e o CPF do pré-cadastro vem depois dele, e depois do nome", ordem.cpf > 1, q(ordem));
  const dica = await page.locator(CAMPO).getAttribute("placeholder").catch(() => "");
  ok("a dica diz nome, CPF, e-mail, telefone e processo",
     /nome/i.test(dica) && /CPF/.test(dica) && /e-mail/i.test(dica) && /telefone/i.test(dica) && /processo/i.test(dica), q(dica));
  ok("o rótulo pergunta se já é cliente",
     /já é cliente/i.test(await textoDe(page.locator("[data-ficha] label").first())));
  ok("o pré-cadastro continua oferecido", await page.getByRole("button", { name: /Criar pré-cadastro/ }).count() === 1);

  // ------------------------------------------------------------------
  console.log("\n2. Menos de 3 letras: nada é perguntado");
  estado.idas.length = 0;
  await digitar(page, "ma");
  await page.waitForTimeout(800);
  ok("diz para escrever ao menos 3", (await estadoDa(page)) === "curta", String(await estadoDa(page)));
  ok("e nada foi perguntado ao Vantoro", buscas().length === 0, q(estado.idas));

  // ------------------------------------------------------------------
  console.log("\n3. Pelo nome, sem perguntar a cada tecla");
  estado.idas.length = 0;
  await digitar(page, "maria", { devagar: true });
  ok("achou", await esperarEstado(page, "achou"), String(await estadoDa(page)));
  ok("perguntou uma vez só, com o termo inteiro", buscas().length === 1 && buscas()[0].q === "maria", q(buscas()));
  ok("os dois cadastros com o nome aparecem", q(await achados(page)) === q(["501", "502"]), q(await achados(page)));
  const cartao = await textoDe(page.locator('[data-achado-na-busca="501"]'));
  ok("cada um diz o nome, o CPF, o telefone e o e-mail",
     /MARIA DAS GRAÇAS PEREIRA/.test(cartao) && /123\.456\.789-09/.test(cartao)
     && /\(11\) 98765-4321/.test(cartao) && /maria\.gracas@exemplo\.com/.test(cartao), q(cartao));
  const cartao2 = await textoDe(page.locator('[data-achado-na-busca="502"]'));
  ok("e os dois telefones de quem tem dois", /\(21\) 91234-5678/.test(cartao2) && /\(21\) 3333-4444/.test(cartao2), q(cartao2));
  ok("a frase conta os achados e pergunta se é a mesma pessoa",
     /2 cadastros com “maria”/.test(await textoDe(resposta(page))) && /mesma pessoa/i.test(await textoDe(resposta(page))));
  ok("cada um oferece acrescentar o número desta conversa e só abrir",
     /Acrescentar \(\d\d\) [\d-]+/.test(await textoDe(page.locator('[data-acrescentar-ao-achado-da-busca="501"]')))
     && await page.locator('[data-so-abrir-achado-da-busca="501"]').count() === 1);

  // ------------------------------------------------------------------
  console.log("\n4. O termo vai como foi escrito");
  estado.idas.length = 0;
  await digitar(page, "ana+teste@exemplo.com");
  ok("achou pelo e-mail", await esperarEstado(page, "achou"));
  ok("o e-mail chegou inteiro, com o +", buscas().at(-1)?.q === "ana+teste@exemplo.com", q(buscas()));
  ok("e o achado é a ANA", q(await achados(page)) === q(["503"]), q(await achados(page)));
  estado.idas.length = 0;
  await digitar(page, "123.456.789-09");
  ok("achou pelo CPF com pontuação", await esperarEstado(page, "achou") && q(await achados(page)) === q(["501"]), q(await achados(page)));
  await digitar(page, "(21) 3333-4444");
  ok("e pelo segundo telefone", await esperarEstado(page, "achou") && q(await achados(page)) === q(["502"]), q(await achados(page)));

  // ------------------------------------------------------------------
  console.log("\n5. A resposta de um termo antigo não vira a lista do novo");
  estado.atraso = { "joão": 1800 };
  estado.idas.length = 0;
  await digitar(page, "joão");
  await page.waitForTimeout(700);
  await page.locator(CAMPO).pressSequentially(" pedro", { delay: 30 }).catch(() => {});
  ok("a lista do termo novo chega", await esperarEstado(page, "achou") && q(await achados(page)) === q(["504"]), q(await achados(page)));
  await page.waitForTimeout(1800);
  ok("e continua a dele depois de a resposta antiga chegar", q(await achados(page)) === q(["504"]), q(await achados(page)));
  ok("as duas perguntas foram feitas", buscas().map((b) => b.q).join("|") === "joão|joão pedro", q(buscas()));
  estado.atraso = {};

  // ------------------------------------------------------------------
  console.log("\n6. Mudando o termo, a lista de antes não fica com cara de resposta");
  estado.atraso = { "maria silva": 1500 };
  await digitar(page, "maria silva");
  await page.waitForTimeout(150);
  ok("enquanto a pergunta não sai, a ficha diz que está procurando", (await estadoDa(page)) === "procurando", String(await estadoDa(page)));
  ok("e não mostra os achados do termo anterior", (await achados(page)).length === 0, q(await achados(page)));
  ok("depois, a resposta do termo novo", await esperarEstado(page, "achou", 4000) && q(await achados(page)) === q(["502"]));
  estado.atraso = {};
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n7. Acrescentar (no segundo achado): a ficha inteira, depois o número, depois o vínculo");
{
  const { ctx, page, estouros } = await abrirFicha();
  await digitar(page, "maria");
  await esperarEstado(page, "achou");
  await comecarFilme(page);
  estado.idas.length = 0;
  await page.locator('[data-acrescentar-ao-achado-da-busca="502"]').click().catch(() => {});
  await page.waitForTimeout(2200);
  const ordem = estado.idas.map((i) => i.o);
  ok("primeiro a ficha inteira, depois o número", ordem.indexOf("ficha") > -1 && ordem.indexOf("ficha") < ordem.indexOf("acrescentar"), q(ordem));
  const post = estado.idas.find((i) => i.o === "acrescentar");
  ok("no cadastro escolhido", post && post.id === "502", q(post));
  const mandado = digitos(post?.corpo?.numero), daConversa = digitos(estado.numeroDaConversa).replace(/^55/, "");
  ok("e o número é o desta conversa", !!mandado && mandado === daConversa, q({ mandado, daConversa }));
  const nome = await page.locator('[data-ficha] [data-campo="nome"]').inputValue().catch(() => "");
  ok("a ficha passa a ser a do cadastro achado, e a procura sai", nome === "MARIA SILVA"
     && await page.locator(CAMPO).count() === 0, q(nome));
  ok("esta conversa ficou ligada ao cadastro", String(await ligadoA(page)) === "502", String(await ligadoA(page)));
  ok("e a tela diz o que fez", (await filme(page)).some((f) => /Acrescentei .* ao cadastro de MARIA SILVA/.test(f)), q(await filme(page)));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n8. Só abrir: não acrescenta nem liga nada");
{
  const { ctx, page, estouros } = await abrirFicha();
  await digitar(page, "costa");
  await esperarEstado(page, "achou");
  await comecarFilme(page);
  estado.idas.length = 0;
  await page.locator('[data-so-abrir-achado-da-busca="503"]').click().catch(() => {});
  await page.waitForTimeout(1800);
  const ordem = estado.idas.map((i) => i.o);
  ok("buscou a ficha inteira e não mandou número nenhum", ordem.includes("ficha") && !ordem.includes("acrescentar"), q(ordem));
  const nome = await page.locator('[data-ficha] [data-campo="nome"]').inputValue().catch(() => "");
  ok("a ficha mostra o cadastro", nome === "ANA BEATRIZ COSTA", q(nome));
  const ligado = await ligadoA(page);
  ok("e a conversa NÃO foi ligada a ele", ligado === null || ligado === undefined, String(ligado));
  ok("a tela diz que foi só para ver", (await filme(page)).some((f) => /Abri o cadastro de ANA BEATRIZ COSTA, só para ver/.test(f)), q(await filme(page)));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n9. Não achou: o pré-cadastro segue, e o CPF vai para ele");
{
  const { ctx, page, estouros } = await abrirFicha();
  await digitar(page, "zzz ninguém");
  ok("diz que não há cadastro com o termo", await esperarEstado(page, "nada")
     && /Nenhum cadastro com “zzz ninguém”/.test(await textoDe(resposta(page))), q(await textoDe(resposta(page))));
  ok("e o pré-cadastro segue oferecido", await page.getByRole("button", { name: /Criar pré-cadastro/ }).count() === 1);
  ok("o CPF do pré-cadastro não foi tocado", (await page.locator("[data-cpf-sem-cadastro]").inputValue().catch(() => "?")) === "");
  await digitar(page, "529.982.247-25");
  ok("procurou pelo CPF e não achou", await esperarEstado(page, "nada"));
  ok("o CPF foi para o pré-cadastro", (await page.locator("[data-cpf-sem-cadastro]").inputValue().catch(() => "")) === "529.982.247-25",
     q(await page.locator("[data-cpf-sem-cadastro]").inputValue().catch(() => "")));
  ok("e a frase diz isso", /O CPF já foi para o pré-cadastro/.test(await textoDe(resposta(page))));
  await digitar(page, "111.444.777-35");
  await esperarEstado(page, "nada");
  await page.waitForTimeout(300);
  ok("o CPF que já estava no pré-cadastro não é trocado", (await page.locator("[data-cpf-sem-cadastro]").inputValue().catch(() => "")) === "529.982.247-25");
  ok("e a frase não diz que foi", !/O CPF já foi para o pré-cadastro/.test(await textoDe(resposta(page))));

  console.log("\n10. O processo sem cliente é dito");
  await digitar(page, "0009999");
  ok("não achou cadastro", await esperarEstado(page, "nada"));
  const solto = await textoDe(page.locator("[data-ficha] [data-processos-sem-cliente]"));
  ok("e diz que há um processo sem cliente ligado, com o nome dele", /1 processo/.test(solto) && /FULANO DO PROCESSO/.test(solto), q(solto));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n11. Não conseguir procurar NÃO tem a cara de 'não é cliente'");
{
  const { ctx, page, estouros } = await abrirFicha();
  estado.buscaFalha = true;
  await digitar(page, "maria");
  ok("a falha é dita como falha", await esperarEstado(page, "falhou"), String(await estadoDa(page)));
  ok("e avisa que isso não quer dizer que a pessoa não seja cliente", /não quer dizer/i.test(await textoDe(resposta(page))));
  ok("sem achados nem frase de 'nenhum cadastro'", (await achados(page)).length === 0 && !/Nenhum cadastro/.test(await textoDe(resposta(page))));
  estado.buscaFalha = false;
  const antes = buscas().length;
  await page.locator("[data-busca-tentar-de-novo]").click().catch(() => {});
  ok("o 'Tentar de novo' pergunta de novo, e acha", await esperarEstado(page, "achou") && buscas().length === antes + 1,
     q({ antes, depois: buscas().length }));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n12. Muitos achados: a ficha diz que mostrou só os primeiros");
{
  const { ctx, page } = await abrirFicha();
  await digitar(page, "lote");
  ok("achou", await esperarEstado(page, "achou"));
  ok("os 20 aparecem", (await achados(page)).length === 20);
  ok("e a frase manda escrever mais para afinar", /Mostrando os 20 primeiros/.test(await textoDe(resposta(page))));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n13. O CPF do pré-cadastro continua conferido");
{
  const { ctx, page } = await abrirFicha();
  const cpf = page.locator("[data-cpf-sem-cadastro]");
  await cpf.fill(CPF_DA_MARIA).catch(() => {});
  await page.waitForTimeout(1300);
  ok("o CPF de quem já é cliente acha o cadastro", await page.locator('[data-procura-cpf="achou"]').count() === 1);
  ok("e o 'Criar pré-cadastro' sai de cena", await page.getByRole("button", { name: /Criar pré-cadastro/ }).count() === 0);
  ok("a procura continua no alto", await page.locator(CAMPO).count() === 1);
  await ctx.close();
}

// ------------------------------------------------------------------
for (const [nome, larg, alt] of [["14. Na gaveta, a 1100", 1100, 800], ["15. No celular, a 390", 390, 844],
                                  ["16. No celular de 360, a régua da casa", 360, 780]]) {
  console.log(`\n${nome}`);
  const { ctx, page, estouros } = await abrirFicha(larg, alt);
  ok("a procura aparece", await page.locator(CAMPO).count() === 1);
  await digitar(page, "maria");
  ok("achou", await esperarEstado(page, "achou"));
  const m = await page.evaluate(() => {
    const f = document.querySelector("[data-ficha]");
    if (!f) return null;
    const fr = f.getBoundingClientRect();
    const fora = [];
    for (const el of f.querySelectorAll("[data-achado-na-busca], [data-achado-na-busca] button")) {
      const r = el.getBoundingClientRect();
      if (r.left < fr.left - 1 || r.right > fr.right + 1 || r.right > innerWidth + 1) fora.push(el.textContent.slice(0, 30));
      // e cada botão termina dentro do PRÓPRIO cartão: a ficha corta o que passa dela, e o cartão não
      const cartao = el.closest("[data-achado-na-busca]");
      if (el.tagName === "BUTTON" && cartao) {
        const c = cartao.getBoundingClientRect();
        if (r.left < c.left - 1 || r.right > c.right + 1) fora.push("fora do cartão: " + el.textContent.slice(0, 30));
      }
    }
    const botao = f.querySelector("[data-acrescentar-ao-achado-da-busca]");
    if (botao) botao.scrollIntoView({ block: "center" });
    const r = botao ? botao.getBoundingClientRect() : null;
    const no = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
    return { fora, rolaDeLado: document.documentElement.scrollWidth > innerWidth + 1,
             pintado: !!no && !!botao && botao.contains(no), alto: r ? Math.round(r.height) : 0 };
  });
  ok("os cartões e os botões cabem na ficha e na tela", !!m && m.fora.length === 0, q(m));
  ok("a tela não rola de lado", !!m && !m.rolaDeLado);
  ok("o botão de acrescentar está pintado", !!m && m.pintado, q(m));
  if (larg < 768) ok("e tem os 40 pontos de alvo de dedo", !!m && m.alto >= 40, q(m));
  ok("nenhum estouro", estouros.length === 0, q(estouros));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
