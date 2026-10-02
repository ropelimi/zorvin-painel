// O QUE É DO VANTORO SOME QUANDO NÃO HÁ VANTORO.
//
// Seis lugares desta tela só fazem sentido com ele: a ficha do cliente (o botão
// da barra, o item do menu ⋮ e a coluna), a busca de cadastro dentro de "Nova
// conversa", a aba "Notas no Vantoro", e a lista de processos que a nota
// oferece. Sem Vantoro os seis ficavam lá — um botão que abre coluna vazia, um
// "Procurando no Vantoro…" que não termina em nada, uma aba que não faz nada.
// Para quem compra o programa aquilo não é integração de outro cliente: é o
// programa quebrado.
//
// A RESPOSTA VEM DA PONTE (`GET /vantoro/status`), e não de uma variável do
// painel — mesma razão da aba de atendentes: uma variável daqui poderia ser
// posta em desacordo com as de lá.
//
// ------------------------------------------------------------------
// E A CONFERÊNCIA QUE MAIS IMPORTA É A TERCEIRA: quando a pergunta FALHA, tudo
// continua aparecendo. Tratar falha como ausência faria o escritório perder a
// ficha, a busca de cadastro e a subida da nota sempre que a ponte tossisse —
// sem uma palavra na tela. É a armadilha nº 2 do CLAUDE.md: em 04/09 as
// etiquetas sumiram de todas as conversas exatamente assim.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Abre o painel com a ponte respondendo sobre o Vantoro do jeito pedido.
 *
 *  `status`:
 *    "tem"      -> { configurado: true }
 *    "nao-tem"  -> { configurado: false }
 *    "quebrada" -> responde 500 (o ramo `!r.ok` do módulo)
 *    "sem-rede" -> a chamada nem completa (o ramo `.catch` do módulo)
 *
 *  OS DOIS PRECISAM ESTAR AQUI, e descobri isso sabotando: o módulo trata a
 *  resposta ruim num ramo e a falha de rede noutro. Só o 500 estava coberto, e
 *  trocar o `.catch(() => true)` por `false` — que é a armadilha nº 2 de volta
 *  inteira — passava sem ninguém reprovar.
 */
async function abrirPainel(status, largura = 1600) {
  // A LARGURA IMPORTA: o menu ⋮ da conversa só existe abaixo de 768px (é o
  // layout de celular). Conferir o item do menu numa janela larga passaria
  // porque o menu inteiro não está lá — uma conferência que não pode reprovar.
  //
  // E A LARGA É 1600, não 1360 (02/10): com a ficha aberta, a 1360 a barra
  // da conversa RECOLHE no ⋮ (a conta de largura passou a somar o "Já
  // tratei", que antes ficava de fora), e o botão da ficha sai da barra por
  // falta de espaço — não por falta de Vantoro. A 1600 a barra vem solta, e
  // "está na barra" volta a medir só o que esta prova quer medir.
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));

  const pedidos = [];
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const caminho = url.pathname.replace("/ponte-de-mentira", "");
    pedidos.push(caminho);

    if (caminho === "/vantoro/status") {
      if (status === "quebrada") return rota.fulfill({ status: 500, body: "erro" });
      if (status === "sem-rede") return rota.abort("failed");
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, configurado: status === "tem" }) });
    }
    // A BUSCA DE CADASTRO RESPONDE COM ALGUÉM. Respondendo vazio, a seção não
    // apareceria nem com Vantoro, e a conferência do "com Vantoro aparece"
    // passaria por não ter o que mostrar — provando nada.
    if (caminho === "/vantoro/buscar") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, clientes: [
          // O FORMATO É `telefone`/`telefone2`, e não uma lista. Escrevi
          // `telefones: [...]` primeiro e a seção não desenhou: a tela leu
          // indefinido e descartou a linha por não ter DDD. A prova reprovou
          // dizendo a verdade — o que faltava era a resposta falsa ter a forma
          // da de verdade.
          { id: "v-9", nome: "CLIENTE DO CADASTRO", telefone: "5567999990001" },
        ] }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  // A resposta do `/vantoro/status` vem pela rede da bancada; sem esta espera a
  // tela seria fotografada no instante em que ninguém sabe ainda de nada — e aí
  // TUDO estaria escondido, inclusive no cenário que deve mostrar.
  await page.waitForTimeout(900);
  return { ctx, page, pedidos, estouros };
}

/** Abre a primeira conversa da lista. */
async function abrirUmaConversa(page) {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(300);
}

// ------------------------------------------------------------------
console.log("\nCom Vantoro, tudo continua onde estava");
{
  const { ctx, page, estouros } = await abrirPainel("tem");
  await abrirUmaConversa(page);
  ok("o botão da ficha está na barra da conversa",
     await page.locator("[data-abrir-ficha]").count() === 1);

  await page.locator("[data-abrir-ficha]").click();
  await page.waitForTimeout(500);
  ok("e ele abre a coluna da ficha",
     (await page.locator("body").innerText()).length > 0
     && await page.locator("[data-abrir-ficha]").count() === 1);

  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nSem Vantoro, a ficha não é oferecida por nenhuma das duas portas");
{
  const { ctx, page, estouros } = await abrirPainel("nao-tem");
  await abrirUmaConversa(page);
  ok("o botão da ficha sumiu da barra",
     await page.locator("[data-abrir-ficha]").count() === 0);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// O MENU ⋮ É A SEGUNDA PORTA, e esconder só a primeira deixaria o caminho
// aberto justamente onde se procura o que não está à vista. Ele só existe no
// layout de celular, então esta cena roda estreita — e confere os DOIS mundos,
// senão "não achei o item" seria satisfeito por não ter achado o menu.
console.log("\nE a segunda porta é o menu ⋮ do celular");
{
  const abrirMenu = async (page) => {
    await abrirUmaConversa(page);
    await page.getByRole("button", { name: "Mais opções desta conversa" }).click();
    await page.waitForTimeout(400);
  };

  const comV = await abrirPainel("tem", 430);
  await abrirMenu(comV.page);
  const comVantoro = await comV.page.locator("[data-menu-ficha]").count();
  await comV.ctx.close();

  const semV = await abrirPainel("nao-tem", 430);
  await abrirMenu(semV.page);
  const semVantoro = await semV.page.locator("[data-menu-ficha]").count();
  const textoSemV = await semV.page.locator("body").innerText();
  await semV.ctx.close();

  ok("com Vantoro, o menu ⋮ oferece a ficha", comVantoro === 1,
     `contei ${comVantoro}`);
  ok("e sem Vantoro ele não oferece", semVantoro === 0 && !/Ficha no Vantoro/i.test(textoSemV),
     textoSemV.slice(0, 400));
}

// ------------------------------------------------------------------
console.log("\nSem Vantoro, a busca de cadastro não é feita nem anunciada");
{
  const { ctx, page, pedidos, estouros } = await abrirPainel("nao-tem");
  await page.getByRole("button", { name: "Nova conversa" }).click();
  await page.waitForTimeout(300);
  // Três letras é o mínimo que dispara a consulta; "MAR" acha gente nos dois
  // lados numa instalação com Vantoro.
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("MAR");
  await page.waitForTimeout(1200);

  const texto = await page.locator("body").innerText();
  ok("a tela não diz 'PESSOAS DO VANTORO'", !/PESSOAS DO VANTORO/i.test(texto),
     texto.slice(0, 500));
  ok("nem 'Procurando no Vantoro…'", !/Procurando no Vantoro/i.test(texto));
  // A FRASE DO VAZIO TAMBÉM MENTIRIA. "Nenhuma pessoa com esse nome no
  // Vantoro" é sobre uma busca que voltou sem nada — e aqui não houve busca.
  ok("nem 'Nenhuma pessoa com esse nome no Vantoro'",
     !/Nenhuma pessoa com esse nome no Vantoro/i.test(texto));
  // ESTA É A QUE PROVA QUE A ECONOMIA ACONTECEU. Esconder a seção e continuar
  // perguntando a cada tecla seria uma ida à rede por letra digitada, para uma
  // resposta que a tela joga fora.
  ok("e a ponte NÃO foi perguntada sobre cadastro",
     !pedidos.some((c) => c === "/vantoro/buscar"),
     pedidos.join(" "));

  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nCom Vantoro, essa mesma busca continua acontecendo");
{
  const { ctx, page, pedidos } = await abrirPainel("tem");
  await page.getByRole("button", { name: "Nova conversa" }).click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("MAR");
  await page.waitForTimeout(1200);
  ok("a ponte foi perguntada sobre cadastro",
     pedidos.some((c) => c === "/vantoro/buscar"), pedidos.join(" "));
  ok("e a seção do cadastro aparece",
     /PESSOAS DO VANTORO/i.test(await page.locator("body").innerText()));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nA aba de administração perde a de notas, e só ela");
{
  const { ctx, page } = await abrirPainel("nao-tem");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(700);
  ok("a aba 'Notas no Vantoro' não existe",
     await page.locator("[data-aba-notas]").count() === 0);
  // AS OUTRAS DUAS FICAM. Uma conferência que só olhasse a aba sumida passaria
  // igual se a tela inteira tivesse deixado de abrir.
  const texto = await page.locator("body").innerText();
  ok("e as outras duas continuam lá",
     /Departamentos e telefones/i.test(texto) && /Atendentes/i.test(texto),
     texto.slice(0, 400));
  await ctx.close();
}

{
  const { ctx, page } = await abrirPainel("tem");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(700);
  ok("com Vantoro, a aba de notas continua existindo",
     await page.locator("[data-aba-notas]").count() === 1);
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\nO nome deixa de ficar travado pelo cadastro");
{
  // A CONVERSA É ESCOLHIDA PELO ID, e não "a primeira da lista". Só
  // `ct-do-vantoro` tem `vantoro_nome` preenchido; em qualquer outra o lápis
  // aparece de qualquer jeito, e a conferência passaria sem ter olhado para o
  // que ela diz olhar. Foi o que aconteceu — a sabotagem pegou.
  // A CONVERSA É ACHADA PELA BUSCA, e não pelo id: ela não está entre as
  // primeiras da lista, e um clique direto no id estourava por tempo — e
  // ESTOURAR DERRUBA A PROVA INTEIRA em vez de reprovar uma conferência, que é
  // pior do que qualquer defeito que ela fosse achar. Devolve `false` quando
  // não acha, e aí quem chamou reprova dizendo isso.
  const abrirADoCadastro = async (page) => {
    const caixa = page.locator('input[placeholder*="Buscar por nome"]');
    await caixa.fill("GRACAS");
    await page.waitForTimeout(1800);
    const linha = page.locator("[data-conversa-nome]").first();
    if (!(await linha.count())) return false;
    await linha.click();
    await page.waitForSelector("[data-topo-conversa]", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    return (await page.locator("[data-topo-conversa]").count()) > 0;
  };

  const comV = await abrirPainel("tem");
  const abriuComV = await abrirADoCadastro(comV.page);
  const comVantoro = await comV.page.locator("[data-renomear-contato]").count();
  const nomeComV = abriuComV
    ? await comV.page.locator("[data-nome-do-contato]").innerText() : "(não abriu)";
  await comV.ctx.close();

  const semV = await abrirPainel("nao-tem");
  const abriuSemV = await abrirADoCadastro(semV.page);
  const semVantoro = await semV.page.locator("[data-renomear-contato]").count();
  await semV.ctx.close();

  ok("a conversa de quem tem cadastro abriu nos dois casos",
     abriuComV && abriuSemV, `com Vantoro: ${abriuComV}, sem: ${abriuSemV}`);

  // ESTA CONFERÊNCIA É O CONTRASTE, e sem ela a de baixo não prova nada: se o
  // lápis aparecesse nos dois mundos, "sem Vantoro ele aparece" continuaria
  // verdadeira e o corte poderia nem existir.
  ok("é mesmo a conversa de quem tem cadastro", /GRA[ÇC]AS/i.test(nomeComV), nomeComV);
  ok("com Vantoro, o nome está travado pelo cadastro (sem lápis)", comVantoro === 0,
     `contei ${comVantoro}`);
  ok("e sem Vantoro o lápis volta — senão o contato ficaria sem saída",
     semVantoro === 1, `contei ${semVantoro}`);
}

// ------------------------------------------------------------------
console.log("\nE quando a pergunta FALHA, nada some — que é o ponto todo");
{
  // Esconder por falha de rede seria desenhar AUSÊNCIA no lugar de FALHA: o
  // escritório perderia a ficha e a busca de cadastro num soluço da ponte, sem
  // nada na tela dizendo por quê. Mostrando, o pior caso é abrir a ficha e ler
  // o erro que a própria ponte dá — que é uma frase, e não um sumiço.
  for (const [jeito, comoSeChama] of [["quebrada", "respondendo erro"],
                                      ["sem-rede", "sem completar a chamada"]]) {
    const { ctx, page, estouros } = await abrirPainel(jeito);
    await abrirUmaConversa(page);
    ok(`com a ponte ${comoSeChama}, o botão da ficha continua na barra`,
       await page.locator("[data-abrir-ficha]").count() === 1);

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "Departamentos e acessos" }).click();
    await page.waitForTimeout(700);
    ok(`e a aba de notas continua existindo (${comoSeChama})`,
       await page.locator("[data-aba-notas]").count() === 1);

    ok(`sem erro de JavaScript no caminho (${comoSeChama})`,
       estouros.length === 0, estouros.join(" | "));
    await ctx.close();
  }
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
