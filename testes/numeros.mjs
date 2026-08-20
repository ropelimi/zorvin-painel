// AS REGRAS DE TELEFONE, SEM NAVEGADOR.
//
// Isto roda em Node puro e leva menos de um segundo. Erro de número é o mais
// caro que este sistema tem — ele não aparece como erro, aparece como um
// cliente com duas conversas, cada uma com metade do diálogo — e é o mais
// barato de achar aqui.
import { numeroCanonico, chaveDoNumero, daParaChamar, telefoneLegivel, outrosNumeros }
  from "../src/numeros.js";

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

console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
