// O CLIENTE QUE VOLTOU POR UM NÚMERO NOVO — achado pelo CPF.
//
// RELATO DO RODRIGO, 29/09, com duas fotos: o CRISTIANO RIBEIRO DE JESUS tem
// cadastro no Vantoro com (71) 8425-3304, formatou o celular e voltou a
// escrever por (19) 98209-4819. A ficha procura pelo número da conversa,
// disse que "este número ainda não tem cadastro" e ofereceu CRIAR um — que
// seria o duplicado, com o histórico do cliente partido em dois.
//
// O pedido: "ter na ficha a opção de informar o CPF do cliente para buscar na
// base; se encontrar, aparecer a pergunta se quer acrescentar o novo telefone
// ao cadastro que foi encontrado".
//
// O QUE ESTA PROVA VIGIA, além de o botão existir:
//
//   * a ORDEM das idas: a ficha inteira primeiro, o número depois, o vínculo
//     por último. Se a ficha não vier, nenhum número pode ter sido pendurado;
//   * que o número mandado é o DESTA conversa, e não o que está no cadastro;
//   * que o número que já está lá com outra escrita (o nono dígito) não é
//     mandado de novo — é a mesma conta no WhatsApp;
//   * que "não consegui perguntar" NÃO tem a cara de "não é cliente": é essa
//     confusão que levaria a pessoa a criar o duplicado;
//   * e que o pré-cadastro sai de cena quando o cadastro foi achado.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const CPF_DELE = "75730383568";
const CPF_LIVRE = "52998224725";

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// O CADASTRO ANTIGO, com o telefone de antes. `telefonesDoCadastro` muda por
// cena: numa delas o número desta conversa já está lá, escrito de outro jeito.
let telefonesDoCadastro = [];
let fichaFalha = false;
let cpfFalha = false;
let numeroDaConversa = null;
const idas = [];

const CADASTRO = () => ({
  id: 77, nome: "CRISTIANO RIBEIRO DE JESUS", cpf: "757.303.835-68",
  telefone: "71984253304", telefone2: "", cidade: "SALVADOR",
  processos: [{ id: 1, numero: "0001", tipo_acao: "APELAÇÃO", reu: "BANCO", situacao: "Em andamento" }],
  documentos: 6, ordem_servico: null, telefones: telefonesDoCadastro,
});

await page.route("**/ponte-de-mentira/**", async (rota) => {
  const req = rota.request();
  const url = new URL(req.url());
  const json = (corpo, status = 200) => rota.fulfill({ status, contentType: "application/json",
                                                        body: JSON.stringify(corpo) });

  if (url.pathname.endsWith("/vantoro/cpf-existe")) {
    const cpf = (url.searchParams.get("cpf") || "").replace(/\D/g, "");
    idas.push({ o: "cpf", cpf });
    if (cpfFalha) return rota.abort();
    if (cpf === CPF_DELE) {
      return json({ ok: true, encontrado: true, cliente: {
        id: 77, nome: "CRISTIANO RIBEIRO DE JESUS", cpf: "757.303.835-68",
        telefone: "71984253304", processos: 1, documentos: 6 } });
    }
    return json({ ok: true, encontrado: false });
  }
  if (/\/vantoro\/cliente\/77\/telefones$/.test(url.pathname) && req.method() === "POST") {
    let corpo = null;
    try { corpo = JSON.parse(req.postData() || "null"); } catch (_) { /* nulo */ }
    idas.push({ o: "acrescentar", corpo });
    return json({ ok: true, telefones: [
      ...telefonesDoCadastro,
      { id: 902, numero: corpo?.numero, digitos: String(corpo?.numero || "").replace(/\D/g, ""),
        principal: false, proprio: true, dono: "", observacao: "", usado_por: [] },
    ] });
  }
  if (/\/vantoro\/cliente\/77$/.test(url.pathname)) {
    idas.push({ o: "ficha" });
    if (fichaFalha) return json({ ok: false, erro: "O Vantoro não respondeu." }, 502);
    return json({ ok: true, cliente: CADASTRO() });
  }
  if (url.pathname.endsWith("/vantoro/cliente")) {
    // O NÚMERO DESTA CONVERSA não é de cadastro nenhum: é o caso do relato.
    numeroDaConversa = url.searchParams.get("telefone");
    return json({ ok: true, clientes: [] });
  }
  return json({ ok: true });
});

/** Abre a primeira conversa, do zero, com a ficha de "sem cadastro" à vista. */
async function abrir() {
  idas.length = 0;
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(500);
  if (!(await page.locator("[data-ficha]").count())) {
    await page.locator("[data-abrir-ficha]").first().click().catch(() => {});
  }
  await page.waitForTimeout(1500);
}

/** Digita o CPF do zero. Limpar antes, sempre: preencher com o mesmo valor
 *  não dispara mudança, e a conferência mediria a etapa anterior. */
async function digitarCpf(cpf) {
  const campo = page.locator("[data-cpf-sem-cadastro]");
  await campo.fill("");
  await page.waitForTimeout(150);
  await campo.fill(cpf);
  await page.waitForTimeout(1300);
}

/** O filme da faixa de aviso: toda frase que passou por ela, e não só a
 *  última — a faixa troca de frase depressa. */
async function comecarFilme() {
  await page.evaluate(() => {
    globalThis.__filme = [];
    clearInterval(globalThis.__relogioDoFilme);
    globalThis.__relogioDoFilme = setInterval(() => {
      const t = document.body.innerText;
      for (const m of t.match(/(Acrescentei|já estava|Não consegui|Nada foi alterado|Abri o cadastro)[^\n]*/g) || []) {
        if (!globalThis.__filme.includes(m)) globalThis.__filme.push(m);
      }
    }, 50);
  });
}
const filme = () => page.evaluate(() => globalThis.__filme || []);

const procura = page.locator("[data-procura-cpf]");
const criar = page.getByRole("button", { name: /Criar pré-cadastro/ });

// ------------------------------------------------------------------
console.log("\nO número sem cadastro pergunta o CPF PRIMEIRO");
await abrir();
{
  const campo = page.locator("[data-cpf-sem-cadastro]");
  ok("a ficha sem cadastro tem o campo do CPF", await campo.count() === 1);
  // O CPF ANTES DO NOME. Com ele depois, o gesto natural era preencher de
  // cima para baixo e apertar Criar — o duplicado do relato.
  const cpfPrimeiro = await page.evaluate(() => {
    const cpf = document.querySelector("[data-cpf-sem-cadastro]");
    const inputs = [...document.querySelectorAll("[data-ficha] input")];
    return cpf ? inputs.indexOf(cpf) === 0 : null;
  });
  ok("e ele vem antes de tudo, antes do nome", cpfPrimeiro === true, String(cpfPrimeiro));
  const dica = await campo.getAttribute("placeholder").catch(() => "");
  ok("dizendo para que serve: achar o cadastro de quem já é cliente",
     /já é cliente/i.test(dica || ""), `dizia: "${dica}"`);
  ok("o pré-cadastro continua oferecido para quem NÃO é cliente",
     await criar.count() === 1);
}

// ------------------------------------------------------------------
console.log("\nCPF pela metade: nada é perguntado nem dito");
{
  await digitarCpf("757303");
  ok("nenhuma resposta aparece", await procura.count() === 0);
  ok("e nada foi perguntado ao Vantoro", !idas.some((i) => i.o === "cpf"),
     JSON.stringify(idas));
}

// ------------------------------------------------------------------
console.log("\nCPF de ninguém: a ficha DIZ que não achou");
{
  await digitarCpf(CPF_LIVRE);
  ok("diz que não há cadastro com este CPF",
     (await procura.getAttribute("data-procura-cpf").catch(() => null)) === "nao-achou");
  ok("e o pré-cadastro segue oferecido", await criar.count() === 1);
}

// ------------------------------------------------------------------
console.log("\nA ponte fora do ar NÃO tem a cara de 'não é cliente'");
{
  cpfFalha = true;
  await digitarCpf(CPF_DELE);
  const estado = await procura.getAttribute("data-procura-cpf").catch(() => null);
  ok("a falha é dita como falha", estado === "falhou", String(estado));
  const texto = (await procura.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("e avisa que isso NÃO quer dizer que a pessoa não seja cliente",
     /não quer dizer/i.test(texto), `dizia: "${texto}"`);
  ok("e não oferece acrescentar a ninguém",
     await page.locator("[data-acrescentar-ao-achado]").count() === 0);
  cpfFalha = false;
}

// ------------------------------------------------------------------
console.log("\nCPF de quem já é cliente: a pergunta aparece");
{
  await digitarCpf(CPF_DELE);
  const cartao = page.locator('[data-procura-cpf="achou"]');
  ok("o cadastro é achado pelo CPF", await cartao.count() === 1);
  const texto = (await cartao.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("dizendo de QUEM é", /CRISTIANO RIBEIRO DE JESUS/.test(texto), `dizia: "${texto}"`);
  ok("com o telefone de antes, que é o que faz reconhecer",
     /\(71\) 8425-3304|\(71\) 98425-3304/.test(texto), `dizia: "${texto}"`);
  ok("e PERGUNTA se é a mesma pessoa por um número novo",
     /mesma pessoa/i.test(texto), `dizia: "${texto}"`);
  const botao = page.locator("[data-acrescentar-ao-achado]");
  const rotulo = (await botao.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("o botão diz QUAL número vai entrar",
     /Acrescentar \(\d\d\) [\d-]+ ao cadastro/.test(rotulo), `dizia: "${rotulo}"`);
  // ACHOU, O PRÉ-CADASTRO SAI. Criar ali seria o duplicado — e o Vantoro
  // recusaria o CPF de qualquer jeito, depois de a pessoa escolher o papel.
  ok("e o 'Criar pré-cadastro' sai de cena", await criar.count() === 0);
}

// ------------------------------------------------------------------
console.log("\nAcrescentar: a ficha inteira, depois o número, depois o vínculo");
{
  await comecarFilme();
  const antes = idas.length;
  await page.locator("[data-acrescentar-ao-achado]").click();
  await page.waitForTimeout(2200);
  const depois = idas.slice(antes).map((i) => i.o);
  ok("primeiro a ficha inteira, depois o número",
     depois.indexOf("ficha") > -1 && depois.indexOf("ficha") < depois.indexOf("acrescentar"),
     JSON.stringify(depois));
  const post = idas.slice(antes).find((i) => i.o === "acrescentar");
  // O NÚMERO DESTA CONVERSA — e não o que estava no cadastro. Mandar o outro
  // não acrescentaria nada, e a conversa continuaria sem ficha.
  const digitosMandados = String(post?.corpo?.numero || "").replace(/\D/g, "");
  const digitosDaConversa = String(numeroDaConversa || "").replace(/\D/g, "").replace(/^55/, "");
  ok("o número mandado é o DESTA conversa",
     !!digitosMandados && digitosMandados === digitosDaConversa,
     `mandou "${post?.corpo?.numero}", a conversa é ${numeroDaConversa}`);

  // O NOME MORA NUM CAMPO: o texto da página não mostra o valor de um
  // `input`, e ler o texto diria "não trocou" para uma ficha que trocou.
  const nome = await page.locator('[data-ficha] [data-campo="nome"]').inputValue().catch(() => "");
  ok("a ficha passa a ser a do cadastro achado",
     nome === "CRISTIANO RIBEIRO DE JESUS" && await page.locator("[data-cpf-sem-cadastro]").count() === 0,
     `o nome na ficha: "${nome}"`);
  const linhas = await page.evaluate(() =>
    [...document.querySelectorAll("[data-telefone-do-cliente]")]
      .map((e) => e.getAttribute("data-telefone-do-cliente")));
  ok("e a lista de telefones dela já traz o número novo",
     linhas.some((d) => String(d).replace(/\D/g, "") === digitosDaConversa), JSON.stringify(linhas));

  const ligado = await page.evaluate((n) => {
    const c = (globalThis.__TABELAS.contatos || []).find((x) => String(x.numero) === String(n));
    return c ? c.vantoro_cliente_id : "sem contato";
  }, numeroDaConversa);
  ok("e esta conversa ficou LIGADA ao cadastro", String(ligado) === "77", String(ligado));

  const frases = await filme();
  ok("a tela diz o que fez", frases.some((f) => /Acrescentei .* ao cadastro de CRISTIANO/.test(f)),
     JSON.stringify(frases));
}

// ------------------------------------------------------------------
console.log("\nA ficha que não vem: NADA é alterado");
await abrir();
{
  fichaFalha = true;
  await digitarCpf(CPF_DELE);
  await comecarFilme();
  const antes = idas.length;
  await page.locator("[data-acrescentar-ao-achado]").click().catch(() => {});
  await page.waitForTimeout(1800);
  const depois = idas.slice(antes).map((i) => i.o);
  // A METADE QUE PROTEGE. Pendurar o número num cadastro que a tela não
  // consegue mostrar deixaria a pessoa sem saber se deu certo — e ela
  // clicaria de novo.
  ok("sem a ficha inteira, o número NÃO é mandado", !depois.includes("acrescentar"),
     JSON.stringify(depois));
  const frases = await filme();
  ok("e a tela diz que nada foi alterado", frases.some((f) => /Nada foi alterado/.test(f)),
     JSON.stringify(frases));
  const ligado = await page.evaluate((n) => {
    const c = (globalThis.__TABELAS.contatos || []).find((x) => String(x.numero) === String(n));
    return c ? (c.vantoro_cliente_id ?? null) : "sem contato";
  }, numeroDaConversa);
  ok("e a conversa NÃO ficou ligada a cadastro nenhum", ligado === null || ligado === undefined,
     String(ligado));
  fichaFalha = false;
}

// ------------------------------------------------------------------
console.log("\nO número que já está lá, com outra escrita, não é mandado de novo");
await abrir();
{
  // O NONO DÍGITO: no WhatsApp as duas formas são a mesma conta, e o Zorvin
  // já as trata como uma (relato de 28/09). Mandar de novo criaria a segunda
  // escrita do mesmo número na ficha.
  const d = String(numeroDaConversa || "").replace(/\D/g, "").replace(/^55/, "");
  const outraEscrita = d.length === 11 ? d.slice(0, 2) + d.slice(3) : d.slice(0, 2) + "9" + d.slice(2);
  telefonesDoCadastro = [{ id: 901, numero: outraEscrita, digitos: outraEscrita, principal: true,
                           proprio: true, dono: "", observacao: "", usado_por: [] }];
  await digitarCpf(CPF_DELE);
  await comecarFilme();
  const antes = idas.length;
  await page.locator("[data-acrescentar-ao-achado]").click().catch(() => {});
  await page.waitForTimeout(2000);
  const depois = idas.slice(antes).map((i) => i.o);
  ok("o número NÃO é mandado de novo", depois.includes("ficha") && !depois.includes("acrescentar"),
     JSON.stringify(depois));
  const frases = await filme();
  ok("e a tela diz que ele já estava lá", frases.some((f) => /já estava no cadastro/.test(f)),
     JSON.stringify(frases));
  const ligado = await page.evaluate((n) => {
    const c = (globalThis.__TABELAS.contatos || []).find((x) => String(x.numero) === String(n));
    return c ? c.vantoro_cliente_id : "sem contato";
  }, numeroDaConversa);
  ok("mas a conversa é ligada ao cadastro assim mesmo", String(ligado) === "77", String(ligado));
  telefonesDoCadastro = [];
}

// ------------------------------------------------------------------
console.log("\nO 'não é ele' também tem saída, e ela não mexe no cadastro");
await abrir();
{
  // A mãe falando pelo celular do filho, com o CPF dele na mão: abrir o
  // cadastro sem pendurar o número da mãe nele.
  await digitarCpf(CPF_DELE);
  const antes = idas.length;
  const so = page.locator("[data-so-abrir-achado]");
  ok("há o caminho de só abrir, sem acrescentar", await so.count() === 1);
  await so.click().catch(() => {});
  await page.waitForTimeout(1800);
  const depois = idas.slice(antes).map((i) => i.o);
  ok("e ele NÃO manda número nenhum", !depois.includes("acrescentar"), JSON.stringify(depois));
}

ok("nenhum erro de página no caminho", erros.length === 0, erros.slice(0, 2).join(" | "));

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
await ctx.close();
await nav.close();
process.exit(falhas ? 1 : 0);
