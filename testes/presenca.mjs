// "FULANA TAMBÉM ESTÁ NESTA CONVERSA" — o aviso de que duas pessoas do
// escritório abriram o mesmo atendimento.
//
// Relato: "esse aviso é realmente em tempo real? acho que não está funcionando
// da forma correta".
//
// Estava metade certo, e a metade errada era a pior: ele APARECIA na hora em
// que a outra pessoa entrava, pelo aviso de tempo real do banco. E depois
// ficava na tela — apontando alguém que tinha saído havia meia hora — porque
// ninguém escrevia nada ao SAIR de uma conversa, e porque a conta de "faz
// menos de 3 minutos" só era refeita quando alguma OUTRA coisa mandava a tela
// redesenhar.
//
// Um aviso que não some é pior do que nenhum: ele faz duas pessoas evitarem
// uma conversa que está livre.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

// Abre a primeira conversa e guarda o id dela.
await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(700);
const conversa = await page.evaluate(() =>
  document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));

/** Manda o aviso de tempo real que o banco mandaria. */
async function presencaDe(nome, haQuantosSegundos = 0) {
  await page.evaluate(([id, quem, atras]) => {
    globalThis.__EMITIR("UPDATE", "conversas", {
      id,
      atendendo_por: quem,
      atendendo_em: quem ? new Date(Date.now() - atras * 1000).toISOString() : null,
      ultima_mensagem: "oi", ultima_atividade: new Date().toISOString(), nao_lidas: 0,
    });
  }, [conversa, nome, haQuantosSegundos]);
}

const aviso = () => page.locator("[data-topo-conversa]")
  .getByText(/também está nesta conversa/);

console.log("\nQuando outra pessoa entra, o aviso aparece");
{
  await presencaDe("Isabela Guedes", 0);
  await page.waitForTimeout(600);
  ok("o aviso aparece sem recarregar nada", await aviso().count() === 1);
  const texto = (await page.locator("[data-topo-conversa]").innerText()).replace(/\s+/g, " ");
  ok("dizendo quem é", /Isabela Guedes/.test(texto), `dizia: "${texto}"`);
  // PEDIDO DE 07/10, com foto: o aviso tomava a linha do número e dos selos
  // (responsável, etapa, lembrete) — o que se confere antes de responder. Ele
  // desceu para a linha das etiquetas. Mede-se o que se VÊ: a linha do número
  // continua visível, e o aviso fica ABAIXO dela.
  const linhaNum = page.locator("[data-topo-conversa] [data-linha-do-numero]");
  ok("com o aviso na tela, o número do cliente continua à vista",
     (await linhaNum.count()) === 1 && await linhaNum.isVisible());
  const pos = await page.evaluate(() => {
    const n = document.querySelector("[data-topo-conversa] [data-linha-do-numero]");
    const a = document.querySelector("[data-topo-conversa] [data-tambem-esta]");
    if (!n || !a) return null;
    const rn = n.getBoundingClientRect(), ra = a.getBoundingClientRect();
    return { numFim: rn.bottom, avisoTopo: ra.top, avisoLargura: ra.width,
             naLinhaDasEtiquetas: !!a.closest("[data-linha-das-etiquetas]") };
  });
  ok("e o aviso fica na linha de baixo, a das etiquetas",
     pos && pos.naLinhaDasEtiquetas && pos.avisoTopo >= pos.numFim - 1, JSON.stringify(pos));
  ok("escrito, e não espremido a nada", pos && pos.avisoLargura > 150, JSON.stringify(pos));
}

console.log("\nE quando ela sai, o aviso some — sem esperar nada acontecer");
{
  // ESTE É O CASO DO RELATO. A marca fica com quase 3 minutos de idade e mais
  // nenhum evento é mandado: o aviso tem de sumir sozinho, pelo relógio.
  //
  // Sem o relógio, ele ficaria ali até alguém mandar uma mensagem, trocar de
  // conversa, ou recarregar a página — e "até alguém fazer outra coisa" não é
  // tempo real.
  await presencaDe("Isabela Guedes", 178);   // 2min58s atrás
  await page.waitForTimeout(400);
  ok("com 2min58s ainda aparece", await aviso().count() === 1,
     "a tolerância é de 3 minutos, para aguentar dois pulsos perdidos");

  // Daqui a pouco ela passa dos 3 minutos. Nenhum evento novo é mandado.
  await page.waitForTimeout(6000);
  ok("passados os 3 minutos, some sozinho", await aviso().count() === 0,
     "nenhum evento foi mandado — quem tinha de reparar na hora era o relógio");
}

console.log("\nEntrar marca, e sair apaga");
{
  // A outra metade do conserto, e a que faz o aviso sumir NA HORA na tela dos
  // outros, em vez de esperar os três minutos.
  //
  // A ordem aqui não é enfeite: primeiro conferimos que ENTRAR deixa a marca,
  // senão a conferência do apagar passaria de graça — uma marca que nunca foi
  // escrita já está limpa, e o teste ficaria verde com o conserto ausente.
  const marcaDe = (id) => page.evaluate((c) => {
    const t = globalThis.__TABELAS && globalThis.__TABELAS.conversas;
    const linha = t && t.find((x) => x.id === c);
    return linha ? (linha.atendendo_por || null) : "conversa não achada";
  }, id);

  // Volta para a primeira e deixa a marca ser escrita.
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(1200);
  const aoEntrar = await marcaDe(conversa);
  ok("entrar na conversa deixa a minha marca", !!aoEntrar && aoEntrar !== "conversa não achada",
     `ficou "${aoEntrar}"`);

  const outra = await page.evaluate(() => {
    const linhas = [...document.querySelectorAll("[data-conversa-nome]")];
    return linhas[1] ? linhas[1].getAttribute("data-conversa-id") : null;
  });
  ok("há uma segunda conversa para trocar", !!outra);

  await page.locator("[data-conversa-nome]").nth(1).click();
  await page.waitForTimeout(1200);
  const aoSair = await marcaDe(conversa);
  ok("e sair apaga a marca da conversa que deixei", aoSair === null,
     `ficou "${aoSair}" — sem apagar, o aviso fica de pé na tela de quem continuou lá`);

  // E a marca da NOVA conversa é a minha, que é o outro lado da mesma moeda.
  const naNova = await marcaDe(outra);
  ok("e a conversa nova passa a ter a minha", !!naNova && naNova !== "conversa não achada",
     `ficou "${naNova}"`);
}

console.log("\nE o meu próprio nome nunca vira aviso");
{
  // Ver "Você também está nesta conversa" seria assustador e inútil.
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(700);
  const meuNome = await page.evaluate(() => {
    const foto = document.querySelector('[title$="— configurações"]');
    return foto ? foto.getAttribute("title").replace(" — configurações", "") : null;
  });
  ok("consegui descobrir com que nome estou entrada", !!meuNome, String(meuNome));
  if (meuNome) {
    await presencaDe(meuNome, 0);
    await page.waitForTimeout(600);
    ok("a minha própria presença não vira aviso", await aviso().count() === 0);
  }
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
