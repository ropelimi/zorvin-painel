// AS REGRAS DE TELEFONE, SEM NAVEGADOR.
//
// Isto roda em Node puro e leva menos de um segundo. Erro de número é o mais
// caro que este sistema tem — ele não aparece como erro, aparece como um
// cliente com duas conversas, cada uma com metade do diálogo — e é o mais
// barato de achar aqui.
import { numeroCanonico, chaveDoNumero, daParaChamar, telefoneLegivel, outrosNumeros,
         etiquetaDoTelefone, porQueNaoRecebeWhatsApp } from "../src/numeros.js";
import { readFileSync } from "node:fs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

console.log("\nA forma de GRAVAR: o 55 entra quando é brasileiro, e só então");
{
  ok("celular com DDD ganha o 55", numeroCanonico("11999998888") === "5511999998888");
  ok("fixo com DDD também", numeroCanonico("1133334444") === "551133334444");
  ok("com máscara, o mesmo resultado", numeroCanonico("(11) 99999-8888") === "5511999998888");
  ok("quem já tem o 55 não ganha outro", numeroCanonico("5511999998888") === "5511999998888");
  // O NÚMERO DE FORA. Prefixar 55 num número de Portugal cria exatamente o
  // contato duplicado que o 55 veio evitar.
  ok("número estrangeiro passa intacto",
     numeroCanonico("351912345678") === "351912345678");
  ok("e o vazio não vira '55'", numeroCanonico("") === "" && numeroCanonico(null) === "");
}

console.log("\nA forma de COMPARAR: as quatro escritas do mesmo telefone");
{
  const esperado = "11999998888";
  for (const forma of ["5511999998888", "11999998888", "(11) 999998888", "(11) 99999-8888"]) {
    ok(`"${forma}" dá a mesma chave`, chaveDoNumero(forma) === esperado,
       `deu "${chaveDoNumero(forma)}"`);
  }
}

console.log("\nO nono dígito: a mesma linha escrita das duas eras");
{
  // O caso que criava duas conversas para a mesma pessoa.
  ok("celular com 9 e sem 9 são a mesma linha",
     chaveDoNumero("31999456790") === chaveDoNumero("3199456790"),
     `${chaveDoNumero("31999456790")} vs ${chaveDoNumero("3199456790")}`);

  // E O QUE NÃO PODE ACONTECER: pôr um 9 num fixo inventa um número que não
  // existe. Fixo tem 8 dígitos começando em 2..5.
  ok("mas o fixo NÃO ganha um nono dígito",
     chaveDoNumero("1133334444") === "1133334444",
     `deu "${chaveDoNumero("1133334444")}"`);
  ok("nem o fixo que começa com 5",
     chaveDoNumero("1155554444") === "1155554444",
     `deu "${chaveDoNumero("1155554444")}"`);
}

console.log("\nO estrangeiro que por acaso começa com 55");
{
  // 55 é o Brasil, mas também são os dois primeiros dígitos de números que
  // nada têm a ver. O corte só vale quando o que sobra tem cara de brasileiro.
  ok("não perde os dois primeiros dígitos se o tamanho não bate",
     chaveDoNumero("5551234") === "5551234", `deu "${chaveDoNumero("5551234")}"`);
}

console.log("\nDá para chamar? Sem DDD, não");
{
  ok("celular completo, sim", daParaChamar("11999998888"));
  ok("com o 55 na frente, sim", daParaChamar("5511999998888"));
  ok("fixo com DDD, sim", daParaChamar("1133334444"));
  // O CAMPO PELA METADE. Quem digita passa por todos estes.
  ok("só o DDD, não", !daParaChamar("11"));
  ok("meio número, não", !daParaChamar("119999"));
  ok("vazio, não", !daParaChamar("") && !daParaChamar(null));
}

console.log("\nA escrita para ler");
{
  ok("celular vira (11) 99999-8888", telefoneLegivel("5511999998888") === "(11) 99999-8888",
     telefoneLegivel("5511999998888"));
  ok("fixo vira (11) 3333-4444", telefoneLegivel("551133334444") === "(11) 3333-4444",
     telefoneLegivel("551133334444"));
  ok("o que não reconheço volta como veio", telefoneLegivel("351912345678") === "351912345678");
  ok("e o vazio vira um traço", telefoneLegivel("") === "—");
}

console.log("\nOS OUTROS NÚMEROS — o miolo do botão da ficha");
{
  // O caso comum: dois números, a conversa está no primeiro.
  {
    const fora = outrosNumeros({ telefone: "11999998888", telefone2: "1133334444" },
                               "5511999998888");
    ok("sobra o outro, e só ele", fora.length === 1, JSON.stringify(fora));
    ok("gravado na forma canônica", fora[0]?.cru === "551133334444", fora[0]?.cru);
    ok("e escrito de um jeito que dá para ler", fora[0]?.legivel === "(11) 3333-4444",
       fora[0]?.legivel);
  }

  // A CONVERSA ESTÁ NO SEGUNDO NÚMERO. A ficha abre pelo número da conversa, e
  // ele tanto pode ser o principal do cadastro quanto o segundo. Se só se
  // olhasse `telefone2`, este caso não ofereceria nada.
  {
    const fora = outrosNumeros({ telefone: "11999998888", telefone2: "1133334444" },
                               "551133334444");
    ok("estando no segundo, sobra o primeiro", fora.length === 1, JSON.stringify(fora));
    ok("e é mesmo o principal", fora[0]?.cru === "5511999998888", fora[0]?.cru);
  }

  // ARMADILHA 1: o mesmo aparelho escrito diferente nos dois campos.
  {
    const fora = outrosNumeros({ telefone: "(11) 99730-3331", telefone2: "5511997303331" },
                               "5511997303331");
    ok("o mesmo número escrito diferente não vira 'outro'", fora.length === 0,
       JSON.stringify(fora));
  }

  // E a versão dele com o nono dígito, que é a que a chave do Departamentos
  // deixaria passar.
  {
    const fora = outrosNumeros({ telefone: "31999456790", telefone2: "3199456790" },
                               "5531999456790");
    ok("nem quando a diferença é só o nono dígito", fora.length === 0, JSON.stringify(fora));
  }

  // ARMADILHA 2: o campo pela metade, tecla a tecla.
  {
    for (const meio of ["1", "11", "119", "11999"]) {
      const fora = outrosNumeros({ telefone: "11999998888", telefone2: meio }, "5511999998888");
      ok(`"${meio}" não vira botão`, fora.length === 0, JSON.stringify(fora));
    }
  }

  // ARMADILHA 3: os dois campos iguais entre si, e a conversa num terceiro.
  {
    const fora = outrosNumeros({ telefone: "1133334444", telefone2: "1133334444" },
                               "5511999998888");
    ok("dois campos iguais mostram um botão só", fora.length === 1, JSON.stringify(fora));
  }

  // O CADASTRO SEM SEGUNDO NÚMERO — o caso da imensa maioria. Nada aparece.
  {
    ok("cadastro com um número só não oferece nada",
       outrosNumeros({ telefone: "11999998888" }, "5511999998888").length === 0);
    ok("cadastro vazio também não", outrosNumeros({}, "5511999998888").length === 0);
    ok("e nem um cadastro que não veio", outrosNumeros(null, "5511999998888").length === 0);
  }

  // DOIS NÚMEROS E NENHUM É O DA CONVERSA. Acontece quando o contato do Zorvin
  // foi criado por um número que o cadastro não tem — os dois são "outros", e
  // os dois devem aparecer.
  {
    const fora = outrosNumeros({ telefone: "11999998888", telefone2: "1133334444" },
                               "5521988887777");
    ok("os dois aparecem quando nenhum é o daqui", fora.length === 2, JSON.stringify(fora));
  }
}

console.log("\nA ETIQUETA DO TELEFONE DO ESCRITÓRIO — e o acordo com a ponte");
{
  // POR QUE ESTA SEÇÃO EXISTE.
  //
  // O painel GRAVA a etiqueta no perfil do Vantoro; a ponte LÊ para aplicar a
  // permissão. São duas pontas de um acordo, e cada lado tem sua cópia da
  // regra. Enquanto concordarem, a permissão funciona. No dia em que
  // discordarem, quem tem telefone marcado deixa de ver as conversas dele —
  // sem erro na tela, sem log, sem nada.
  //
  // Nenhum teste vigiava isso. Agora vigia: a regra da ponte é LIDA DO
  // ARQUIVO DELA e comparada com a daqui, número por número. Se alguém mexer
  // num lado só, esta prova reprova antes de a permissão sumir de alguém.

  // A REGRA DA PONTE, extraída do código-fonte da ponte de verdade — e não
  // copiada à mão para cá. Uma cópia à mão envelheceria em silêncio, que é o
  // defeito exato que esta seção veio impedir.
  const PONTE = "../../zorvin-bridge/index.js";
  let regraDaPonte = null;
  try {
    const fonte = readFileSync(new URL(PONTE, import.meta.url), "utf8");
    const m = fonte.match(/function chaveDoNumero\(bruto\)\s*\{[\s\S]*?\n\}/);
    if (m) regraDaPonte = new Function("bruto", m[0] + "\nreturn chaveDoNumero(bruto);");
  } catch (_) { /* a ponte não está do lado; tratado abaixo */ }

  if (!regraDaPonte) {
    // SEM A PONTE POR PERTO, ISTO NÃO PASSA CALADO.
    //
    // Um "não deu para conferir" que conta como aprovado é pior do que não ter
    // a conferência: ele fica verde para sempre e ninguém repara.
    ok("consegui ler a regra da ponte para comparar", false,
       `não achei ou não entendi ${PONTE} — sem isso o acordo fica sem vigia`);
  } else {
    // Os telefones do escritório, como toda linha conectada chega: 55 + DDD +
    // 9 dígitos. É neste formato que o acordo precisa valer.
    const DO_ESCRITORIO = [
      "5511976378160", "5511993289441", "5511950473857", "5511995941666",
      "5511969401932", "5511913559990", "5511911112222", "5511933334444",
      "5511992057503", "5511955556666", "5511977778888", "5511900001111",
    ];
    const divergentes = DO_ESCRITORIO
      .filter((n) => etiquetaDoTelefone(n) !== regraDaPonte(n));
    ok("painel e ponte etiquetam TODOS os telefones do escritório igual",
       divergentes.length === 0,
       divergentes.map((n) => `${n}: painel ${etiquetaDoTelefone(n)} vs ponte ${regraDaPonte(n)}`).join("; "));

    // E TAMBÉM NAS FORMAS TORTAS. O número de um telefone pode ser regravado à
    // mão um dia, e o acordo tem de continuar valendo.
    //
    // ESTA É A CONFERÊNCIA QUE DE FATO VIGIA, e isso foi medido: trocando a
    // etiqueta por `chaveDoNumero` — o "conserto" que quebraria a permissão —,
    // a lista do escritório acima continua VERDE, porque nela as duas regras
    // concordam. Quem fica vermelho é aqui, por causa do "3199456790". Uma
    // seção montada só com os números de hoje passaria a mão na cabeça do
    // defeito que ela existe para pegar.
    const TORTOS = ["11976378160", "(11) 97637-8160", "5511976378160  ",
                    "+55 11 97637-8160", "1133334444", "3199456790", ""];
    const tortosRuins = TORTOS.filter((n) => etiquetaDoTelefone(n) !== regraDaPonte(n));
    ok("e também nas formas tortas de escrever o mesmo número",
       tortosRuins.length === 0,
       tortosRuins.map((n) => `"${n}": painel ${etiquetaDoTelefone(n)} vs ponte ${regraDaPonte(n)}`).join("; "));
  }

  // A ETIQUETA NÃO MUDOU DE COMPORTAMENTO ao ganhar nome. Estes valores são os
  // que já estão gravados no Vantoro hoje; se algum sair diferente, as
  // permissões existentes viram órfãs.
  ok("55 + DDD + 9 dígitos vira DDD + 9 dígitos",
     etiquetaDoTelefone("5511976378160") === "11976378160",
     etiquetaDoTelefone("5511976378160"));
  ok("já sem o 55, fica como está",
     etiquetaDoTelefone("11976378160") === "11976378160");
  ok("com máscara, o mesmo",
     etiquetaDoTelefone("(11) 97637-8160") === "11976378160");
  ok("e o vazio continua vazio", etiquetaDoTelefone("") === "");

  // ONDE AS DUAS REGRAS DIVERGEM — escrito de propósito, para que a diferença
  // seja uma decisão registrada e não uma surpresa. Se alguém "unificar" as
  // duas sem mexer na ponte, é aqui que a prova avisa.
  ok("no celular da forma antiga elas divergem, e isso é esperado",
     etiquetaDoTelefone("3199456790") === "3199456790"
       && chaveDoNumero("3199456790") === "31999456790",
     `etiqueta ${etiquetaDoTelefone("3199456790")}, chave ${chaveDoNumero("3199456790")}`);

  // O DEFEITO CONHECIDO, registrado como está: o corte pelo fim estraga
  // número estrangeiro. Inofensivo aqui — esta função só toca telefone do
  // escritório —, mas quem for consertar precisa saber que a ponte vai junto.
  ok("o número estrangeiro é cortado — defeito conhecido, e sem efeito aqui",
     etiquetaDoTelefone("351912345678") === "51912345678",
     etiquetaDoTelefone("351912345678"));
}



// ==================================================================
//  POR QUE ESTE NÚMERO NÃO RECEBE WHATSAPP
// ==================================================================
//
// OS CASOS SÃO REAIS. Saíram de uma varredura dos 238 envios que falharam no
// banco do escritório — nome, número e quantidade de tentativas. Não inventei
// nenhum: um teste de regra de telefone escrito com números de mentira acerta
// os de mentira.
//
// O que a varredura mostrou, tirando o erro passageiro: 16 celulares gravados
// sem o nono dígito e 8 telefones fixos. E o preço disso: 26 tentativas para o
// mesmo número em nove dias, 16 para outro, 16 para um terceiro — porque nada
// na tela dizia que o problema era o número.
console.log("\nO que dá para saber olhando o número, antes de tentar mandar");
{
  const diz = (n) => porQueNaoRecebeWhatsApp(n);

  // ---- os 16 sem o nono dígito ----
  {
    // ALCIDES PINTO COLARES DOS SANTOS, 8 tentativas entre 10 e 27 de agosto.
    const r = diz("553189271231");
    ok("celular sem o nono dígito é reconhecido", r?.tipo === "sem-nono", JSON.stringify(r));
    ok("e a tela recebe o número certo para conferir", r?.sugestao === "5531989271231",
       `sugeriu ${r?.sugestao}`);
    ok("dizendo os dois, o que está e o que devia estar",
       /\(31\) 8927-1231/.test(r?.detalhe || "") && /98927-1231/.test(r?.detalhe || ""),
       r?.detalhe);
    // JUCIMARA DA SILVA PEREIRA (71) e ANDRE EUGENIO (31), da mesma varredura.
    ok("vale para qualquer DDD", diz("557182197259")?.sugestao === "5571982197259");
    ok("e para o celular antigo que começa com 7",
       diz("553172371748")?.sugestao === "5531972371748");
  }

  // ---- os 8 fixos ----
  {
    // PG ADVOGADOS, 8 tentativas. BSPZ ADVOGADOS, 2.
    const r = diz("551130383888");
    ok("telefone fixo é reconhecido como fixo", r?.tipo === "fixo", JSON.stringify(r));
    ok("e diz o número por extenso, para quem confere na ficha",
       /\(11\) 3038-3888/.test(r?.titulo || ""), r?.titulo);
    ok("NÃO sugere pôr um 9 num fixo", !r?.sugestao,
       `inventou ${r?.sugestao} — seria um número que não existe`);
    ok("outro fixo, outro estado", diz("555133214500")?.tipo === "fixo");
  }

  // ---- o DDD que não existe ----
  //
  // FONTANA & ADVOGADOS ASSOCIADOS, gravado como "550497234535". Sem a lista
  // de DDDs, a regra do nono dígito transforma isso em "04 99723-4535" e a
  // tela sugere, com toda a confiança, um DDD que não existe no Brasil. Foi o
  // que aconteceu quando montei essa conta na mão, antes de escrever isto.
  {
    const r = diz("550497234535");
    ok("DDD inexistente é apontado, e não 'consertado'", r?.tipo === "ddd", JSON.stringify(r));
    ok("dizendo qual é o DDD errado", /04/.test(r?.titulo || ""), r?.titulo);
    ok("e sem sugerir número nenhum", !r?.sugestao, `inventou ${r?.sugestao}`);
  }

  // ---- e o silêncio, que é metade do valor ----
  //
  // Um aviso que aparece em número bom é um aviso que se aprende a ignorar — e
  // aí ele não serve para os 24 casos em que era para servir.
  {
    // FRANCISCO VIEIRA DA SILVA, 26 tentativas: o número está PERFEITO, ele é
    // que não tem WhatsApp. Isso o número não conta, e a tela não deve fingir
    // que conta.
    ok("celular bem escrito não gera aviso nenhum", diz("5511991777483") === null);
    ok("nem o que já tem o nono dígito", diz("5531989271231") === null);
    ok("número estrangeiro não é medido pelas regras daqui",
       diz("351912345678") === null, JSON.stringify(diz("351912345678")));
    ok("grupo do WhatsApp não é telefone", diz("grupo:120363@g.us") === null);
    ok("e o vazio não vira aviso", diz("") === null && diz(null) === null);
    // Número pela metade, que é o que se vê enquanto alguém digita.
    ok("número incompleto é dito incompleto", diz("119")?.tipo === "curto");
  }
}

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
