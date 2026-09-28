// ============================================================
//  TELEFONE: A FORMA DE GRAVAR E A FORMA DE COMPARAR
//
//  Duas perguntas diferentes, e é por confundi-las que o mesmo cliente vira
//  dois contatos:
//
//    numeroCanonico  — "como este número deve ser GRAVADO?"   → 5511999998888
//    chaveDoNumero   — "estes dois são a MESMA linha?"        → 11999998888
//
//  Isto morava dentro do componente do painel, e a ficha do cliente precisou
//  da mesma resposta. Copiar seria plantar a próxima divergência.
//
//  Aqui não há React nem DOM de propósito: assim estas regras se provam em
//  Node, sem navegador, que é onde erro de número é barato de achar.
//
//  ------------------------------------------------------------------
//  NÃO UNIFIQUE ISTO COM A CHAVE DE `Departamentos.jsx`.
//
//  Existe lá uma função quase igual, e ela responde a OUTRA pergunta:
//  "qual é a etiqueta deste telefone DO ESCRITÓRIO?". O painel grava essa
//  etiqueta no perfil do Vantoro (`zorvin_telefones`) e a ponte lê para
//  aplicar a permissão — as duas pontas de um mesmo acordo, e por isso a
//  ponte tem a mesma função, idêntica, em `index.js`.
//
//  Trocar uma das pontas pela chave daqui faria o painel gravar uma etiqueta
//  e a ponte procurar outra: quem tivesse telefone marcado deixaria de ver as
//  conversas dele, sem erro nenhum na tela. Num escritório de advocacia, esse
//  é o pior tipo de defeito — silencioso e do lado de quem não pode ver.
//
//  Nos telefones do escritório (55 + DDD + 9 dígitos, que é como toda linha
//  conectada chega) as duas dão o MESMO resultado. Elas só divergem no
//  celular escrito na forma antiga, sem o nono dígito — que ali não aparece.
//  ------------------------------------------------------------------
// ============================================================

// COMO O NÚMERO É GRAVADO.
//
// O WhatsApp devolve sempre com o código do país. Quando o painel gravava sem
// ele, a ponte não achava ninguém com aquele texto ao chegar a resposta, e
// criava um SEGUNDO contato com uma segunda conversa: a mensagem enviada numa,
// a resposta na outra.
//
// O 55 entra só quando o número tem cara de brasileiro (10 ou 11 dígitos: DDD
// mais o telefone). Número que já vem com código de país, ou estrangeiro, passa
// intacto — o WhatsApp do escritório fala com o mundo todo, e prefixar 55 num
// número de Portugal criaria justamente o problema que se quer evitar.
export function numeroCanonico(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

// A CHAVE PARA COMPARAR DOIS TELEFONES ESCRITOS DE JEITOS DIFERENTES.
//
// O mesmo telefone aparece de quatro formas no dia a dia, e as quatro precisam
// se reconhecer:
//
//     5511999999999      como o WhatsApp manda
//     11999999999        como a pessoa digita
//     (11) 999999999     copiado de um e-mail
//     (11) 99999-9999    copiado do cadastro
//
// A chave joga fora a pontuação e o código do país, sobrando "11999999999" nos
// quatro casos.
//
// O 55 só sai quando o que sobra tem cara de telefone brasileiro (10 ou 11
// dígitos). Assim um número de fora que por acaso comece com 55 continua
// inteiro.
export function chaveDoNumero(bruto) {
  const d = String(bruto || "").replace(/\D/g, "");
  const nacional = (d.startsWith("55") && (d.length === 12 || d.length === 13)) ? d.slice(2) : d;
  // O NONO DÍGITO ENTRA NA CHAVE.
  //
  // Tirar o 55 não basta: o mesmo celular aparece com 8 e com 9 dígitos locais,
  // porque o Brasil pôs um 9 na frente e o WhatsApp devolve umas contas na
  // forma antiga. "31 99945-6790" e "31 9945-6790" são a MESMA linha, e era
  // essa diferença que criava duas conversas para a mesma pessoa.
  //
  // A chave é sempre a forma COM o 9. Só para celular: fixo tem 8 dígitos
  // começando em 2..5, e pôr um 9 nele inventaria um número que não existe.
  if (nacional.length === 10 && "6789".includes(nacional[2])) {
    return nacional.slice(0, 2) + "9" + nacional.slice(2);
  }
  return nacional;
}

// A ETIQUETA DE UM TELEFONE DO ESCRITÓRIO — outra pergunta, outra resposta.
//
// Esta NÃO é a chave de comparar duas pessoas. É o texto que identifica uma
// das nossas linhas dentro do perfil do Vantoro, na lista `zorvin_telefones`.
//
// O CONTRATO, e é ele que manda aqui:
//
//     o painel  GRAVA a etiqueta   (tela de Departamentos)
//     a ponte   LÊ a etiqueta      (`aplicarPermissoes`, em index.js)
//
// A ponte tem esta mesma função, idêntica, no arquivo dela. Enquanto as duas
// concordarem, a permissão funciona; no dia em que discordarem, quem tiver
// telefone marcado deixa de ver as conversas dele — e sem erro nenhum na
// tela, que é o pior defeito possível num escritório de advocacia.
//
// POR ISSO ELA NÃO É `chaveDoNumero`, mesmo parecendo. Não a "conserte" para
// ficar igual: as etiquetas JÁ GRAVADAS no Vantoro foram escritas com esta
// regra, e mudá-la de um lado só as deixa órfãs. Se um dia as duas tiverem
// mesmo de virar uma, é uma mudança nas DUAS pontas, com regravação do que já
// está lá — e não uma limpeza de código.
//
// Nos telefones do escritório (55 + DDD + 9 dígitos, que é como toda linha
// conectada chega) esta função e `chaveDoNumero` dão o MESMO resultado. É por
// isso que a diferença nunca apareceu: ela só se manifesta no celular escrito
// na forma antiga, sem o nono dígito, que ali não existe.
//
// UM DEFEITO CONHECIDO, deixado como está de propósito: o `slice(-11)` corta
// um número estrangeiro pelo fim — "351912345678" vira "51912345678", sem o
// 3. É inofensivo aqui porque esta função só toca telefone do escritório, e
// todos são brasileiros. Consertar exige mexer na ponte junto, pelo mesmo
// motivo de tudo acima; fica escrito para quem for fazer isso um dia.
export function etiquetaDoTelefone(bruto) {
  let d = String(bruto || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length > 11 ? d.slice(-11) : d;
}

// DÁ PARA CHAMAR ESTE NÚMERO?
//
// Menos de 10 dígitos é DDD faltando, e sem DDD não há para onde ligar. É a
// mesma régua que a busca do Vantoro já usava; agora ela tem nome, porque
// passou a ser usada em dois lugares.
export function daParaChamar(bruto) {
  return chaveDoNumero(bruto).length >= 10;
}

// 5511997303331 → (11) 99730-3331. Só para LER; o que vale é sempre o cru.
export function telefoneLegivel(valor) {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor || "—";
}

// OS OUTROS NÚMEROS DESTE CLIENTE — os que dão para chamar e que NÃO são o
// desta conversa.
//
// É o miolo do botão "conversar por este número", e está aqui, longe da tela,
// porque as três armadilhas dele são de dado e não de desenho:
//
//   1. O MESMO NÚMERO ESCRITO DIFERENTE. O cadastro tem "(11) 99730-3331" no
//      `telefone` e "5511997303331" no `telefone2` — o mesmo aparelho. Sem
//      comparar por chave, a ficha ofereceria "conversar pelo outro número"
//      para abrir a conversa em que a pessoa já está.
//   2. O CAMPO PELA METADE. Quem está digitando o segundo número passa por
//      "11", "119", "1199"… Cada tecla ofereceria um botão que abriria uma
//      conversa com um número que não existe, e criaria o contato.
//   3. OS DOIS IGUAIS ENTRE SI. Cadastro com `telefone` e `telefone2` iguais
//      mostraria o mesmo botão duas vezes.
//
// `numeroDaConversa` pode ser qualquer um dos dois: a ficha abre pelo número da
// conversa, e ele tanto pode ser o principal do cadastro quanto o segundo.
export function outrosNumeros(cadastro, numeroDaConversa) {
  const aqui = chaveDoNumero(numeroDaConversa);
  const vistos = new Set(aqui ? [aqui] : []);
  const fora = [];
  for (const bruto of [cadastro?.telefone, cadastro?.telefone2]) {
    if (!daParaChamar(bruto)) continue;
    const chave = chaveDoNumero(bruto);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    fora.push({ chave, cru: numeroCanonico(bruto), legivel: telefoneLegivel(bruto) });
  }
  return fora;
}

// ============================================================
//  ESTE NÚMERO TEM COMO RECEBER WHATSAPP?
//
//  Veio de uma varredura dos 238 envios que falharam no banco do escritório.
//  Tirando os que são erro passageiro, o que sobrou foram DUAS coisas, as duas
//  visíveis no próprio número, sem perguntar nada a ninguém:
//
//    16 celulares gravados na forma antiga, sem o nono dígito. "553189271231"
//       é o 31 8927-1231 do Alcides. O WhatsApp só conhece "5531989271231".
//       Cada um desses é um cliente que nunca recebeu nada.
//
//     8 telefones FIXOS — PG ADVOGADOS, BSPZ ADVOGADOS, Queiroz Cavalcanti.
//       Fixo raramente tem WhatsApp (só com o WhatsApp Business), e vale
//       conferir se há um celular na ficha.
//
//  E o que isso custava: 26 tentativas para o mesmo número em nove dias, 16
//  para outro, 16 para um terceiro. Ninguém lia a bolha vermelha — cada envio
//  parecia o primeiro, porque nada na tela dizia o contrário.
//
//  POR QUE AQUI, E NÃO NA PONTE. A ponte poderia tentar sozinha com o 9
//  inserido, e resolveria os 16 casos sem ninguém mexer. Mas isso é mandar uma
//  mensagem de cliente para um número que ninguém digitou — e o 9 nem sempre
//  acerta a mesma pessoa. Mostrar o número corrigido para alguém CONFERIR na
//  ficha tem quase todo o benefício e nenhum desses riscos.
//
//  NÃO responde "tem WhatsApp?": isso só o WhatsApp sabe, e a primeira versão
//  desta função fingiu que sabia. Ela dizia "o WhatsApp só conhece (31)
//  98418-0018" numa conversa em que as mensagens iam e voltavam com dois
//  tiques pelo número de oito dígitos. Contas antigas continuam atendendo na
//  forma antiga, e fixo recebe quando o dono usa o WhatsApp Business.
//
//  O que ela responde é o que dá para VERIFICAR olhando: em que forma o número
//  está escrito, e qual seria a outra forma. Quem decide é quem olha a ficha.
//  Um celular de 11 dígitos com DDD bom volta `null` — não temos o que dizer
//  sobre ele, e inventar aviso seria pior do que calar.
//
//  E QUEM CHAMA TEM DE CALAR ANTES: se a conversa já tem mensagem que foi ou
//  veio, aquele número FUNCIONA, e nada aqui deveria ser mostrado. A tela faz
//  esse corte; esta função só olha o número, e o número não sabe disso.

// Os DDDs que existem. Sem esta lista, "550497234535" (do cadastro de um
// escritório parceiro) vira "04 9723-4535" e a tela sugere ligar para um DDD
// que não existe — foi o que aconteceu quando eu montei essa conta na mão.
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
].map(String));

/** O que está errado com este número, ou `null` se não há nada a dizer.
 *
 *  Devolve `{ tipo, titulo, curto, detalhe, sugestao? }`.
 *
 *  `detalhe` é a frase inteira; `curto` é a versão de celular. Não é enfeite:
 *  numa tela de 360px a frase inteira ocupa 126px de altura, e cada pixel de
 *  aviso é um pixel a menos de conversa. A prova mede isso e reprova se passar.
 *
 *  `sugestao` é o número no formato cru, pronto para gravar, quando existe um
 *  palpite bom. */
export function porQueNaoRecebeWhatsApp(bruto) {
  const guardado = String(bruto || "").replace(/\D/g, "");
  if (!guardado) return null;
  // Grupo do WhatsApp não é telefone: a chave dele começa com "grupo:".
  if (String(bruto).startsWith("grupo:")) return null;

  const chave = chaveDoNumero(bruto);

  if (chave.length < 10) {
    return { tipo: "curto",
             titulo: "Este número está incompleto.",
             curto: "Faltam dígitos — provavelmente o DDD.",
             detalhe: "Faltam dígitos — provavelmente o DDD. Confira na ficha do cliente." };
  }
  // Mais de 11 dígitos na chave é número de fora do Brasil. As regras daqui
  // não valem lá, e um aviso errado é pior do que nenhum.
  if (chave.length > 11) return null;

  const ddd = chave.slice(0, 2);
  if (!DDDS.has(ddd)) {
    return { tipo: "ddd", titulo: `O DDD ${ddd} não existe.`,
             curto: "Confira o número na ficha do cliente.",
             detalhe: "Alguém digitou um dígito a mais, ou um zero na frente. "
                    + "Confira o número na ficha do cliente." };
  }

  // Dez dígitos aqui só pode ser FIXO: `chaveDoNumero` já promoveu para onze
  // tudo que começa com 6, 7, 8 ou 9, que é a faixa de celular.
  if (chave.length === 10) {
    // "FIXO NÃO RECEBE WHATSAPP" ERA FALSO, e foi dito com todas as letras
    // numa conversa de escritório parceiro que usa exatamente isso. O WhatsApp
    // Business roda em telefone fixo. O que dá para dizer é que é INCOMUM, e
    // que vale conferir se há um celular na ficha — não que é impossível.
    return { tipo: "fixo",
             titulo: `${telefoneLegivel(chave)} é um telefone fixo.`,
             curto: "Só recebe por WhatsApp Business.",
             detalhe: "Fixo só recebe WhatsApp se o cliente usar o WhatsApp Business nele. "
                    + "Se as mensagens não estiverem chegando, veja se há um celular na ficha." };
  }

  // ============================================================
  //  O AVISO DO NONO DÍGITO SAIU, E QUEM O TIROU FOI A MEDIÇÃO
  //
  //  Ele nasceu com uma afirmação forte e errada ("o WhatsApp só conhece X"),
  //  foi corrigido uma vez para a forma cautelosa ("números antigos ainda
  //  funcionam — mas se as mensagens não estiverem chegando, confira") e
  //  AINDA ASSIM estava errado. O que caiu agora não foi o texto: foi a
  //  PREMISSA dele.
  //
  //  MEDIDO em 28/09, nas 1.802 conversas do escritório:
  //
  //                            conversas   respondemos   vazias
  //      forma antiga (8)          805        73,8%       12,0%
  //      com o nono dígito (9)     997        72,7%       16,6%
  //
  //  A forma antiga não prevê NADA. Ela recebe resposta nossa um pouco MAIS
  //  do que a nova, e fica vazia um pouco MENOS. O aviso mandava desconfiar
  //  de uma coisa que, nos números do próprio escritório, não é um problema.
  //
  //  E ELE APARECIA EM 805 CONVERSAS — 44% da lista inteira. É a armadilha
  //  do alarme que não pede ação, no pior tamanho possível: quase metade das
  //  conversas com uma tarja âmbar que se aprende a não ler, e aí a do DDD
  //  inválido — que prevê de verdade — passa batida junto.
  //
  //  E O DANO NÃO É HIPOTÉTICO. Em 28/09 ele mandou o Rodrigo conferir o
  //  número na ficha de um cliente; ele acrescentou lá o mesmo celular com o
  //  nono dígito, atrás de uma causa que não existia, e ficou sem entender
  //  por que o painel não oferecia conversar pelo número novo. Não oferecia
  //  porque é a MESMA linha — e quem o mandou procurar foi esta tarja.
  //
  //  OS OUTROS AVISOS FICAM. "DDD que não existe" e "isto é um fixo" dizem
  //  coisas verificáveis sobre o número em si. Este dizia uma coisa
  //  verificável ("está na forma antiga") e a emendava com uma INSINUAÇÃO
  //  sobre entrega, que é o que foi medido e caiu.
  //
  //  Se um dia aparecer relato de uma conta que só atende numa das formas, o
  //  caminho não é devolver a tarja para 44% das conversas: é medir aquela
  //  conta.
  // ============================================================
  return null;
}
