// ============================================================
//  FICHA DO CLIENTE (VANTORO) — dentro do atendimento
//
//  Mostra e edita o cadastro do cliente sem sair da conversa.
//  O caminho é: painel -> ponte (zorvin-bridge) -> Vantoro.
//  A ponte é quem guarda o token do Vantoro; aqui mandamos apenas a
//  sessão do Zorvin (o mesmo login que o atendente já fez).
//
//  Os campos ficam em seções que abrem e fecham. São muitos dados para uma
//  coluna estreita: deixar tudo aberto vira uma rolagem sem fim, e no meio de
//  um atendimento ninguém tem tempo de procurar. Só a primeira seção começa
//  aberta — é a que responde "com quem estou falando".
// ============================================================
import { useEffect, useState, useRef } from "react";
import { X, Save, UserPlus, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
         MessageSquare } from "lucide-react";
import { supabase } from "./supabase";
// As regras de telefone são as MESMAS do painel, e por isso vêm do mesmo
// lugar: decidir se o segundo número do cadastro é outra linha ou o mesmo
// aparelho escrito diferente é a mesma pergunta que a busca já respondia.
import { chaveDoNumero, outrosNumeros, telefoneLegivel } from "./numeros.js";
// A chamada à ponte mora em `ponte.js`: duas telas precisam dela (esta e a de
// atendentes), e duas cópias divergiriam na primeira mudança.
import { chamarPonte, BRIDGE_URL, FALTA_PONTE } from "./ponte.js";
import { naoGravouNada, comOCodigo } from "./gravar.js";

// Este erro é de configuração da ponte, ou é outra coisa?
//
// Só as mensagens que a ponte emite quando as variáveis realmente faltam ou
// estão recusadas pedem "confira VANTORO_API_URL e VANTORO_API_TOKEN". Serviço
// fora do ar, suspenso, endereço errado ou demora não têm nada com isso — e
// mandar conferir a configuração nesses casos gasta o tempo de quem podia estar
// olhando o lugar certo.
//
// A lista é curta e conservadora de propósito: na dúvida, NÃO dá a dica. Uma
// dica que falta é uma tela um pouco mais seca; uma dica errada manda a pessoa
// para o lugar errado com confiança.
export function ehProblemaDeConfiguracao(mensagem) {
  const t = String(mensagem || "").toLowerCase();
  return t.includes("não configurada")
      || t.includes("nao configurada")
      || t.includes("vantoro_api_token errado")
      || t.includes("token errado")
      || t.includes("vencido");
}

// Lista usada só enquanto o Vantoro não responder com a dele (por exemplo, se
// o painel for publicado antes do Vantoro). A lista boa vem da API, para não
// existirem duas que precisam ser mantidas iguais.
const ESTADO_CIVIL_RESERVA = [
  { valor: "SOLTEIRO", rotulo: "Solteiro(a)" },
  { valor: "CASADO", rotulo: "Casado(a)" },
  { valor: "DIVORCIADO", rotulo: "Divorciado(a)" },
  { valor: "UNIAO_ESTAVEL", rotulo: "União estável" },
  { valor: "VIUVO", rotulo: "Viúvo(a)" },
];

// As seções da ficha, na ordem em que aparecem. "aberta" define quais já vêm
// abertas; as outras o atendente abre quando precisar.
//   minusculo → desce a letra enquanto digita (e-mail)
//   data      → máscara DD/MM/AAAA
//   cep       → máscara 00000-000 e busca o endereço sozinho
//   opcoes    → vira lista de escolha em vez de texto livre
const SECOES = [
  {
    id: "identificacao",
    titulo: "Identificação",
    aberta: true,
    campos: [
      // OS TELEFONES. Num cadastro que já existe, isto vira a LISTA — com
      // principal, dono do aparelho e o aviso de "está em N cadastros". Num
      // pré-cadastro (que ainda não tem id) continua sendo o campo de sempre:
      // não há onde pendurar uma lista de um cliente que não nasceu.
      { chave: "telefone2", rotulo: "Outro WhatsApp/telefone",
        dica: "se a pessoa trocou de número" },
      { chave: "cpf", rotulo: "CPF" },
      { chave: "nome", rotulo: "Nome completo" },
      { chave: "email", rotulo: "E-mail", minusculo: true },
      { chave: "nascimento", rotulo: "Nascimento", dica: "DD/MM/AAAA", data: true },
      { chave: "estado_civil", rotulo: "Estado civil", opcoes: "estado_civil" },
      { chave: "ocupacao", rotulo: "Profissão" },
    ],
  },
  {
    id: "endereco",
    titulo: "Endereço",
    campos: [
      { chave: "cep", rotulo: "CEP", dica: "preenche o resto sozinho", cep: true },
      { chave: "endereco", rotulo: "Rua e número" },
      { chave: "bairro", rotulo: "Bairro" },
      { chave: "cidade", rotulo: "Cidade" },
      { chave: "estado", rotulo: "UF" },
    ],
  },
  {
    id: "acessos",
    titulo: "Acessos",
    campos: [
      { chave: "senha_serasa", rotulo: "Senha SERASA" },
      { chave: "senha_gov", rotulo: "Senha GOV" },
    ],
  },
  {
    id: "origem",
    titulo: "Origem do lead",
    campos: [
      { chave: "origem", rotulo: "Origem" },
      { chave: "utm_campaign", rotulo: "Campanha" },
      { chave: "utm_medium", rotulo: "Conjunto de anúncios" },
      { chave: "utm_content", rotulo: "Anúncio" },
    ],
  },
];

const TODOS_CAMPOS = SECOES.flatMap((s) => s.campos);

// Vai colocando as barras enquanto se digita a data: 25121980 → 25/12/1980.
// Assim o atendente digita só os números e não erra a ordem do dia e do mês.
function mascaraData(valor) {
  const d = (valor || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function mascaraCep(valor) {
  const d = (valor || "").replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

// Busca o endereço pelo CEP. Serviço público e sem cadastro; se estiver fora do
// ar, o atendente digita à mão e nada trava.
async function buscarCep(cep) {
  const d = (cep || "").replace(/\D/g, "");
  if (d.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.erro) return null;
  return {
    endereco: j.logradouro || "",
    bairro: j.bairro || "",
    cidade: j.localidade || "",
    estado: j.uf || "",
  };
}

export default function FichaVantoro({ numero, nomeContato, C, estreito, onFechar, onAviso, aoLigarCadastro, aoConversarPor }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [cliente, setCliente] = useState(null);
  // OS OUTROS CADASTROS QUE TAMBÉM ATENDEM POR ESTE NÚMERO.
  //
  // Mãe e filho, marido e mulher, o escritório inteiro num telefone de empresa:
  // um número serve mais de um cliente, e isso é normal. A ficha ficava com o
  // PRIMEIRO da lista e jogava fora o resto, sem dizer nada — e a API sempre
  // devolveu até cinco, exatamente porque isso acontece.
  const [candidatos, setCandidatos] = useState([]);
  const [edicao, setEdicao] = useState({});
  const [salvando, setSalvando] = useState(false);
  // O ERRO DA ÚLTIMA TENTATIVA DE LIGAR O CADASTRO AO CONTATO.
  //
  // Num espelho, e não em estado: ele é lido no mesmo passo em que é escrito
  // (quem chamou compõe a frase logo depois), e estado só chega no desenho
  // seguinte — a frase sairia sem o código na primeira vez e com o código
  // antigo na segunda, que é pior do que não ter.
  const erroDoVinculo = useRef(null);
  // A LISTA DE TELEFONES DO CADASTRO.
  //
  // Vem da ficha (`cliente.telefones`) e é trocada inteira a cada gesto: as
  // rotas devolvem a lista já refeita pelo Vantoro, que é quem sabe as regras
  // (quem é o principal, o que não pode sair). Remontá-la aqui a partir do que
  // foi clicado daria duas versões da mesma verdade, e a da tela seria a
  // errada no primeiro caso que eu não tivesse previsto.
  // ------------------------------------------------------------
  //  DE QUEM É ESTE CPF — perguntado ENQUANTO se digita
  //
  //  Relato do escritório, em 08/09: "está sendo permitido cadastrar o mesmo
  //  cliente com o mesmo CPF... o ideal é que ao digitar o CPF o sistema avise
  //  que já existe o cadastro e se o usuário quer ver a ficha".
  //
  //  O Vantoro passou a RECUSAR (vantoro#232). Mas recusar no fim é tarde: a
  //  pessoa preencheu nome, nascimento, endereço e profissão, e só então
  //  descobre que o cadastro já existia — o trabalho todo refeito à toa, e o
  //  cadastro certo continuando sem o que ela digitou.
  //
  //  `null` quer dizer "ainda não sei" e desenha nada. É diferente de "não
  //  achei", e a diferença importa: um aviso que pisca a cada tecla ensina a
  //  ignorar avisos.
  const [cpfDeOutro, setCpfDeOutro] = useState(null);
  const [telefones, setTelefones] = useState([]);
  const [novoNumero, setNovoNumero] = useState("");
  const [mexendoTel, setMexendoTel] = useState(false);
  // Cliente ou parte contrária. Nasce em "cliente" porque é o caso de quase
  // todo lead — e porque um pré-cadastro sem escolha nenhuma faria o Vantoro
  // voltar a deduzir pelo documento, que é o defeito que isto conserta.
  const [papel, setPapel] = useState("cliente");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [opcoes, setOpcoes] = useState({ estado_civil: ESTADO_CIVIL_RESERVA });
  const [abertas, setAbertas] = useState(
    () => new Set(SECOES.filter((s) => s.aberta).map((s) => s.id))
  );

  function alternar(id) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  }

  // O NOME DO CADASTRO PRECISA VOLTAR PARA O CONTATO DO ZORVIN.
  //
  // O título da conversa sai de `nomeDoContato`, que já prefere
  // `contatos.vantoro_nome` ao nome que veio do WhatsApp. Só que esse campo era
  // gravado num único lugar: na ponte, quando chega mensagem E a classificação
  // em cache já venceu (sete dias). Quem preenchia a ficha aqui via o cadastro
  // certo do lado direito e o apelido do WhatsApp — "Deus", "Eu", o nome da
  // loja — continuar no cabeçalho por até uma semana.
  //
  // Agora a ficha grava na hora. É o mesmo campo, escrito pelo lado que acabou
  // de saber o nome.
  /** Liga o cadastro do Vantoro a este contato do Zorvin.
   *
   *  Devolve `true` quando o vínculo ficou gravado e `false` quando não —
   *  inclusive no caso silencioso, em que o banco responde "pronto" sem ter
   *  mexido em nenhuma linha (ver `naoGravouNada`, em `gravar.js`). */
  async function ligarContatoAoCadastro(dadosCliente) {
    const nome = (dadosCliente?.nome || "").trim();
    if (!numero || !nome) return;
    const campos = { vantoro_nome: nome };
    if (dadosCliente.id) campos.vantoro_cliente_id = dadosCliente.id;

    // COMO ESTAVA ANTES, para saber se isto é uma ESTREIA ou uma revisita.
    //
    // Sem esta leitura não há como distinguir "acabou de virar cliente" de
    // "abriu a ficha de alguém que já era". A ficha se liga ao cadastro toda
    // vez que é aberta — mandar as notas subirem em todas seria uma ida à rede
    // por abertura, à toa, para uma resposta que quase sempre é "nenhuma".
    const { data: antes } = await supabase
      .from("contatos").select("id, vantoro_cliente_id").eq("numero", numero).maybeSingle();

    // Instalação sem as colunas de vínculo: perder o vínculo é aceitável, a
    // ficha ter falhado por causa dele não é. É a mesma tolerância que a ponte
    // já tem do outro lado ao gravar.
    const r = await supabase.from("contatos")
      .update(campos).eq("numero", numero).select("id");
    if (r.error && /vantoro_/i.test(r.error.message || "")) return false;
    // O ERRO FICA GUARDADO PARA QUEM CHAMOU.
    //
    // A função devolve só um sim/não de propósito (ver logo abaixo: avisar por
    // conta própria fazia a frase ser apagada pela de quem chamou). Mas o
    // `error` é a única pista de POR QUE não ligou, e jogá-lo fora é o defeito
    // que custou uma rodada de scripts em 24/09. Ele fica aqui, e quem compõe
    // a frase final o põe nela.
    if (r.error) { erroDoVinculo.current = r.error; return false; }
    // E SE O BANCO NÃO MEXEU EM NENHUMA LINHA, o vínculo NÃO existe.
    //
    // Sem esta pergunta a ficha seguia como se tivesse ligado o cadastro ao
    // contato: avisava quem chamou, mandava as notas subirem e se desenhava
    // inteira — com `vantoro_cliente_id` continuando vazio no banco. Na
    // abertura seguinte o contato não tinha cadastro nenhum, e o relato que
    // chegou foi "faço o pré-cadastro e a ficha não aparece".
    //
    // Um `update` barrado pela regra de acesso volta SEM erro e com zero
    // linhas (ver `naoGravouNada`, em `gravar.js`) — e é justamente por isso
    // que o `if (error)` de cima não bastava.
    // ELA DEVOLVE SE LIGOU, e não avisa por conta própria.
    //
    // Escrevi primeiro com um `onAviso` aqui dentro, e a prova pegou: quem
    // chama mostra a SUA frase logo depois ("Pré-cadastro criado no Vantoro."),
    // e ela apagava a minha em menos de um segundo. A pessoa via a mensagem de
    // sucesso e ia embora — que é exatamente o defeito, com um passo a mais.
    //
    // Quem sabe qual é a frase final da ação é quem começou a ação.
    if (naoGravouNada(r)) { erroDoVinculo.current = null; return false; }
    aoLigarCadastro && aoLigarCadastro({ numero, nome, clienteId: dadosCliente.id || null });

    // O CONTATO ACABOU DE GANHAR FICHA: o que ele já tinha anotado sobe.
    //
    // Enquanto ele não era cliente, as notas internas ficavam só na conversa —
    // não havia ficha para recebê-las. Agora há, e o que foi anotado antes é
    // justamente o que alguém vai procurar: como o caso chegou, o que foi
    // combinado no primeiro contato.
    //
    // SÓ NA ESTREIA. Se já havia vínculo, não há nada de novo para subir: as
    // notas antigas já subiram quando ele virou cliente, e as novas sobem uma a
    // uma, na hora em que são escritas.
    if (antes?.id && !antes.vantoro_cliente_id && dadosCliente.id) {
      subirNotasAntigas(antes.id);
    }
    // LIGOU. Sem este `return`, a função devolveria `undefined` — falso — e o
    // caminho de sucesso passaria a mostrar a frase da falha. A prova pegou.
    erroDoVinculo.current = null;
    return true;
  }

  // SEM `await`, E DE PROPÓSITO.
  //
  // A pessoa acabou de criar o cadastro; o que ela espera ver é a ficha pronta.
  // Segurar a tela esperando o histórico subir transformaria uma consequência
  // num obstáculo — e a ponte hiberna no plano free, então essa espera pode ser
  // de quase um minuto.
  //
  // E FALHAR AQUI NÃO DESFAZ NADA. O vínculo é o que a pessoa fez; a subida é
  // consequência dele. Se a ponte estiver fora, o vínculo fica de pé e o
  // retroativo do administrador pega estas notas depois — ele é idempotente, o
  // que já subiu é reconhecido e não duplica.
  async function subirNotasAntigas(contatoId) {
    try {
      const r = await chamarPonte(`/vantoro/contato/${encodeURIComponent(contatoId)}/subir-notas`,
                                  { method: "POST" });
      // SÓ AVISA SE HOUVE O QUE SUBIR. "0 notas subiram" é ruído para quem só
      // queria cadastrar o cliente, e este aviso divide espaço com o de
      // cadastro criado, que é o que ela está esperando ler.
      if (r?.subiram > 0 && onAviso) {
        onAviso(r.subiram === 1
          ? "1 nota interna foi para o histórico do cliente."
          : `${r.subiram} notas internas foram para o histórico do cliente.`);
      }
    } catch (_e) {
      // Calado por escolha: o cadastro deu certo, e é isso que a pessoa precisa
      // saber agora. Um erro sobre notas antigas, logo depois do aviso de
      // cadastro criado, pareceria que o cadastro falhou.
    }
  }

  /** Quem já foi escolhido para ESTA conversa, ou null. */
  async function clienteJaLigado() {
    if (!numero) return null;
    // Um erro aqui não pode derrubar a ficha: numa base sem a coluna de
    // vínculo, a ficha continua funcionando — só sem a memória da escolha.
    const { data } = await supabase
      .from("contatos").select("vantoro_cliente_id").eq("numero", numero).maybeSingle();
    return data?.vantoro_cliente_id ?? null;
  }

  /** A pessoa escolheu qual dos cadastros é o desta conversa. */
  // A PERGUNTA SÓ SAI QUANDO A PESSOA PARA DE DIGITAR.
  //
  // 400ms é a pausa que separa "ainda escrevendo" de "terminei". Perguntar a
  // cada tecla seriam onze idas à rede por CPF, num serviço que hiberna — e as
  // respostas chegariam fora de ordem, fazendo o aviso aparecer e sumir.
  //
  // E O PEDIDO ANTERIOR É ABANDONADO: sem isso, a resposta de "3985066183"
  // (dez dígitos, ainda faltando um) poderia chegar DEPOIS da de "39850661836"
  // e apagar um aviso verdadeiro.
  useEffect(() => {
    const digitado = String(edicao.cpf || "").replace(/\D/g, "");
    if (digitado.length !== 11 && digitado.length !== 14) { setCpfDeOutro(null); return; }
    // O CPF QUE JÁ É DESTE CADASTRO NÃO É AVISO. Abrir a ficha de alguém e ver
    // "este CPF já existe" apontando para ele mesmo seria alarme falso na
    // ficha inteira, o tempo todo.
    if (cliente && String(cliente.cpf || "").replace(/\D/g, "") === digitado) {
      setCpfDeOutro(null); return;
    }
    let valeu = true;
    const relogio = setTimeout(async () => {
      try {
        const r = await chamarPonte(`/vantoro/cpf-existe?cpf=${encodeURIComponent(digitado)}`);
        if (!valeu) return;
        const achado = r && r.encontrado ? r.cliente : null;
        // O PRÓPRIO CADASTRO NÃO CONTA, de novo aqui: entre a digitação e a
        // resposta a ficha pode ter sido trocada.
        setCpfDeOutro(achado && (!cliente || String(achado.id) !== String(cliente.id))
                      ? achado : null);
      } catch (_) {
        // A ponte hiberna. Sem resposta, nenhum aviso — e a gravação continua
        // recusando o duplicado do lado do Vantoro, que é a trava de verdade.
        if (valeu) setCpfDeOutro(null);
      }
    }, 400);
    return () => { valeu = false; clearTimeout(relogio); };
  }, [edicao.cpf, cliente]);

  // ABRIR O CADASTRO QUE JÁ TEM ESTE CPF.
  //
  // `cpf-existe` responde POUCO de propósito — id, nome e as contagens —,
  // porque é chamado enquanto a pessoa digita. Passar esse resumo direto para
  // `escolher` desenharia uma ficha pela metade: sem processos, sem ordem de
  // serviço, sem endereço, com os campos vazios parecendo cadastro incompleto.
  //
  // Então a ficha INTEIRA é buscada aqui, e só então trocamos.
  async function abrirCadastroDeOutro(resumo) {
    if (!resumo) return;
    try {
      const r = await chamarPonte(`/vantoro/cliente/${resumo.id}`);
      const inteiro = (r && r.cliente) || null;
      if (!inteiro) throw new Error("não veio a ficha");
      setCpfDeOutro(null);
      await escolher(inteiro);
      onAviso && onAviso(`Abri o cadastro de ${inteiro.nome}.`);
    } catch (e) {
      // Sem a ficha inteira NÃO SE TROCA NADA. Trocar com o resumo deixaria a
      // pessoa olhando campos vazios e concluindo que o cadastro está incompleto
      // — e ela preencheria de novo o que já existe.
      onAviso && onAviso(e.message || "Não consegui abrir o outro cadastro.");
    }
  }

  async function escolher(c) {
    setCliente(c);
    setEdicao({ ...c });
    // A ESCOLHA FICA GRAVADA, e é o que faz a pergunta não voltar amanhã. É o
    // mesmo campo que já guardava o vínculo; a diferença é que agora ele é uma
    // resposta de alguém, e não um sorteio.
    // O retorno é ignorado aqui de propósito: esta é a resposta a uma pergunta
    // de escolha de cadastro, e a frase que interessa já foi dada. Falhando o
    // vínculo, quem cria ou salva logo em seguida é que avisa.
    await ligarContatoAoCadastro(c);
  }

  async function buscar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await chamarPonte(`/vantoro/cliente?telefone=${encodeURIComponent(numero || "")}`);
      const todos = r.clientes || [];
      if (r.opcoes?.estado_civil?.length) setOpcoes(r.opcoes);
      setCandidatos(todos);

      // QUAL DELES É O DESTA CONVERSA.
      //
      // Antes era `clientes[0]` — o primeiro da lista, que a API ordena pelo
      // cadastro mais recente. Com mãe e filho no mesmo número, isso quer dizer
      // "quem foi cadastrado por último", que não é uma resposta: é um sorteio.
      // E o sorteio decidia para QUEM iam as notas internas daquela conversa.
      //
      // A regra agora tem três degraus, do mais confiável ao menos:
      //   1. quem já foi ESCOLHIDO nesta conversa (fica gravado no contato);
      //   2. havendo um só candidato, é ele — nada a decidir;
      //   3. havendo vários e nenhum escolhido, NÃO SE ESCOLHE. A ficha
      //      pergunta.
      const jaEscolhido = await clienteJaLigado();
      const casa = todos.find((c) => String(c.id) === String(jaEscolhido));
      const achado = casa || (todos.length === 1 ? todos[0] : null);

      setCliente(achado);
      setTelefones(listaDeTelefones(achado));
      setEdicao(achado ? { ...achado } : {});
      // Só ABRIR a ficha já conserta o nome da conversa. Sem isto, os contatos
      // que ficaram para trás só se acertariam quando alguém os editasse — e
      // ninguém edita uma ficha que já está certa.
      if (achado) ligarContatoAoCadastro(achado);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  // TROCOU DE NÚMERO, A ESCOLHA DE PAPEL VOLTA AO PADRÃO.
  //
  // HOJE ISTO NUNCA DISPARA, e está aqui de propósito. Quem garante a escolha
  // limpa é o painel, que fecha a ficha a cada troca de conversa e portanto a
  // desmonta inteira — um detalhe de OUTRO arquivo, a 6.000 linhas daqui.
  //
  // O que não pode acontecer é a marca "parte contrária" sobrar para o próximo
  // atendimento: o lead seguinte nasceria como réu, sem ordem de serviço, sem
  // tarefa no pool e sem aviso nenhum — quem atendeu juraria ter criado um
  // cliente. Uma garantia desse tamanho não fica pendurada num detalhe alheio
  // que ninguém lembra de conferir ao mexer.
  useEffect(() => { setPapel("cliente"); if (numero) buscar(); /* eslint-disable-next-line */ }, [numero]);

  async function criar() {
    setSalvando(true);
    try {
      const r = await chamarPonte("/vantoro/cliente", {
        method: "POST",
        body: JSON.stringify({
          nome: (edicao.nome || nomeContato || "").trim() || "Sem nome",
          telefone: numero,
          cpf: edicao.cpf || "",
          // O PAPEL DECIDE SE NASCE UMA ORDEM DE SERVIÇO.
          //
          // Pedido do escritório: "ao fazer o pré-cadastro do Lead pelo Zorvin,
          // precisa ter a opção de cliente ou réu". Antes o Vantoro deduzia
          // pelo documento — CPF virava cliente, CNPJ virava parte contrária —,
          // e errava nos dois sentidos: a empresa cliente ficava sem ordem de
          // serviço, e a pessoa que é réu ganhava uma, com tarefa no pool para
          // alguém trabalhar o adversário como se fosse cliente.
          //
          // Quem está falando com o lead é o único, em todo o sistema, que sabe
          // a resposta. É aqui que ela é dada.
          papel,
        }),
      });
      setCliente(r.cliente);
      setEdicao({ ...r.cliente });
      const ligou = await ligarContatoAoCadastro(r.cliente);
      // O CADASTRO NASCEU LÁ; O VÍNCULO É DAQUI. Dizer só "criado" quando o
      // segundo não gravou é o relato de 24/09: o pré-cadastro existe no
      // Vantoro, e na abertura seguinte o contato não tem ficha nenhuma.
      const naoLigou = "Criei no Vantoro, mas não consegui ligá-lo a este contato aqui — "
                     + "a ficha não vai aparecer sozinha.";
      onAviso && onAviso(
        !ligou ? (erroDoVinculo.current
                   ? comOCodigo(naoLigou, erroDoVinculo.current, "ligar o pré-cadastro ao contato")
                   : naoLigou)
        : r.criado ? "Pré-cadastro criado no Vantoro." : "Já existia no Vantoro.");
    } catch (e) {
      onAviso && onAviso(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!cliente) return;
    setSalvando(true);
    try {
      const mudou = {};
      TODOS_CAMPOS.forEach(({ chave }) => {
        if ((edicao[chave] || "") !== (cliente[chave] || "")) mudou[chave] = edicao[chave] || "";
      });
      if (!Object.keys(mudou).length) { onAviso && onAviso("Nada foi alterado."); return; }
      const r = await chamarPonte(`/vantoro/cliente/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify(mudou),
      });
      setCliente(r.cliente);
      setEdicao({ ...r.cliente });
      const ligou = await ligarContatoAoCadastro(r.cliente);
      const naoLigou = "Atualizei no Vantoro, mas não consegui ligá-lo a este contato aqui.";
      onAviso && onAviso(ligou ? "Cadastro atualizado no Vantoro."
        : erroDoVinculo.current
            ? comOCodigo(naoLigou, erroDoVinculo.current, "ligar o cadastro ao contato")
            : naoLigou);
    } catch (e) {
      onAviso && onAviso(e.message);
    } finally {
      setSalvando(false);
    }
  }

  // CEP completo: puxa o endereço e preenche o resto. Falhou? Segue sem avisar
  // com alarde — os campos continuam lá para digitar.
  async function aoDigitarCep(valor) {
    const mascarado = mascaraCep(valor);
    setEdicao((e) => ({ ...e, cep: mascarado }));
    if (mascarado.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    try {
      const achado = await buscarCep(mascarado);
      if (achado) setEdicao((e) => ({ ...e, ...achado }));
      else onAviso && onAviso("CEP não encontrado. Preencha o endereço à mão.");
    } catch {
      onAviso && onAviso("Não consegui consultar o CEP agora. Preencha à mão.");
    } finally {
      setBuscandoCep(false);
    }
  }

  // O QUE FOI DIGITADO E AINDA NÃO FOI GRAVADO.
  //
  // Esta ficha é um formulário: CPF, endereço, nascimento, profissão, senhas.
  // Fechar descartava tudo, calado. Quem preencheu meia ficha e tocou no X sem
  // querer perdia o trabalho e não recebia nem um aviso — e nem sabia que
  // tinha perdido, porque a coluna simplesmente sumia.
  //
  // A comparação é a MESMA que `salvar()` usa para decidir o que mandar ao
  // Vantoro. Duas contas diferentes de "mudou" acabariam discordando, e a
  // pergunta apareceria na hora errada — que é o jeito de ensinar as pessoas a
  // clicar em "sim" sem ler.
  function mudouAlgumaCoisa() {
    if (!cliente) return false;
    return TODOS_CAMPOS.some(({ chave }) => (edicao[chave] || "") !== (cliente[chave] || ""));
  }

  function tentarFechar() {
    if (mudouAlgumaCoisa()
        && !window.confirm("Você preencheu campos que ainda não foram salvos no Vantoro.\n\n"
                         + "Fechar agora descarta o que foi digitado. Fechar mesmo assim?")) {
      return;
    }
    onFechar();
  }

  const rotulo = { fontSize: 11, color: C.textSecondary, marginBottom: 3, display: "block" };
  const campo = {
    width: "100%", boxSizing: "border-box", background: C.inputBg, color: C.textPrimary,
    border: `1px solid ${C.divider}`, borderRadius: 7, padding: "7px 9px", fontSize: 13.5,
  };
  const botao = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13.5,
    fontWeight: 600, cursor: "pointer", background: C.green, color: "#fff",
  };
  const cabecalhoSecao = {
    display: "flex", alignItems: "center", gap: 6, width: "100%", border: "none",
    background: "transparent", color: C.textPrimary, cursor: "pointer",
    padding: "9px 0", fontSize: 12.5, fontWeight: 600, textAlign: "left",
  };

  function desenharCampo(c) {
    // O CAMPO "OUTRO WHATSAPP" VIRA A LISTA num cadastro que já existe. Deixar
    // os dois na tela mostraria o mesmo número em dois lugares, com regras
    // diferentes — e a pessoa não teria como saber qual dos dois vale.
    if (c.chave === "telefone2" && cliente) return desenharTelefones();
    const lista = c.opcoes ? (opcoes[c.opcoes] || []) : null;
    return (
      <div key={c.chave} style={{ marginBottom: 10 }}>
        <label style={rotulo}>{c.rotulo}{c.dica ? ` (${c.dica})` : ""}</label>
        {lista ? (
          <select data-campo={c.chave} style={campo} value={edicao[c.chave] || ""}
                  onChange={(e) => setEdicao({ ...edicao, [c.chave]: e.target.value })}>
            <option value="">—</option>
            {lista.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        ) : (
          <input data-campo={c.chave} style={campo} value={edicao[c.chave] || ""}
                 inputMode={(c.data || c.cep) ? "numeric" : undefined}
                 placeholder={c.data ? "DD/MM/AAAA" : c.cep ? "00000-000" : undefined}
                 onChange={(e) => {
                   const v = e.target.value;
                   if (c.cep) { aoDigitarCep(v); return; }
                   setEdicao({
                     ...edicao,
                     [c.chave]: c.data ? mascaraData(v) : c.minusculo ? v.toLowerCase() : v,
                   });
                 }} />
        )}
        {c.cep && buscandoCep && (
          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 3 }}>Buscando endereço…</div>
        )}
        {c.chave === "cpf" && desenharCpfDeOutro()}
        {c.chave === "telefone2" && desenharOutrosNumeros()}
      </div>
    );
  }

  // "CONVERSAR POR ESTE NÚMERO".
  //
  // Quem tem dois números tem dois WhatsApp, e o atendimento continua no que
  // responder. Antes disto, falar pelo outro número era sair da conversa, abrir
  // "Novo contato", copiar o número da ficha e colar — quatro passos para uma
  // coisa que a ficha já sabia.
  //
  // Sai da lista o que já é ESTA conversa. O cadastro guarda o mesmo aparelho
  // escrito de jeitos diferentes o tempo todo — "(11) 99730-3331" num campo e
  // "5511997303331" no outro —, e sem comparar por chave o botão apareceria
  // oferecendo abrir a conversa em que a pessoa já está.
  //
  // Vale para os DOIS lados: a ficha abre pelo número da conversa, que tanto
  // pode ser o principal do cadastro quanto o segundo. Olhar só `telefone2`
  // deixaria sem botão justamente quem já está falando pelo segundo.
  //
  // Lê de `edicao`, e não de `cliente`: é o que está escrito na tela. Quem
  // acabou de digitar o número do filho não precisa salvar antes de ligar para
  // ele — e o botão diz qual número vai abrir, então não há dúvida sobre o que
  // o clique faz.
  // ------------------------------------------------------------
  //  OS TRÊS GESTOS DOS TELEFONES
  //
  //  Todos passam pela ponte, e todos recebem A LISTA REFEITA de volta. Quem
  //  decide o que aconteceu é o Vantoro: ele é que sabe que o último número
  //  não sai, que só há um principal, e que trocar o WhatsApp não apaga o
  //  número velho. A tela desenha a resposta em vez de adivinhá-la.
  //
  //  O ERRO APARECE EM LETRAS. Um gesto que falha em silêncio faz a pessoa
  //  clicar de novo, e de novo — e concluir que o sistema não grava telefone.
  // ------------------------------------------------------------
  async function mexerNosTelefones(caminho, opcoes, aviso) {
    if (!cliente || mexendoTel) return;
    setMexendoTel(true);
    try {
      const r = await chamarPonte(`/vantoro/cliente/${cliente.id}/telefones${caminho}`, opcoes);
      if (r && Array.isArray(r.telefones)) setTelefones(r.telefones);
      if (r && r.aviso) onAviso && onAviso(r.aviso);
      else if (aviso) onAviso && onAviso(aviso);
    } catch (e) {
      onAviso && onAviso(e.message || "Não consegui mexer nos telefones.");
    } finally {
      setMexendoTel(false);
    }
  }

  async function acrescentarTelefone() {
    const numero = (novoNumero || "").trim();
    if (!numero) return;
    await mexerNosTelefones("", { method: "POST", body: JSON.stringify({ numero }) },
                            "Número acrescentado.");
    setNovoNumero("");
  }

  const editarTelefone = (t, campos, aviso) =>
    mexerNosTelefones(`/${t.id}`, { method: "PATCH", body: JSON.stringify(campos) }, aviso);

  function tirarTelefone(t) {
    // CONFIRMAR ANTES DE TIRAR. O número é o que liga a conversa ao cadastro:
    // tirar o errado não quebra nada na hora, e a falta só aparece dias depois,
    // quando a pessoa escrever por ele e a ficha não abrir.
    if (!window.confirm(`Tirar ${telefoneLegivel(t.digitos || t.numero)} deste cadastro?`)) return;
    return mexerNosTelefones(`/${t.id}`, { method: "DELETE" }, "Número removido.");
  }

  // ------------------------------------------------------------
  //  A LISTA DE TELEFONES NA FICHA
  //
  //  Os três pedidos de 04/09 aparecem aqui, e é a única tela em que eles são
  //  visíveis para quem atende:
  //
  //    1. "está cadastrado em dois ou mais CPF, e poder escolher de quem é o
  //        telefone" -> o aviso âmbar e o botão "não é dela".
  //    2. "o principal e pelo menos mais dois" -> a lista cresce.
  //    3. "alteração do número de WhatsApp pelo Zorvin" -> "usar este".
  //
  //  SÓ EM CADASTRO QUE JÁ EXISTE. Num pré-cadastro não há id para pendurar
  //  telefone nenhum, e o campo de sempre continua servindo.
  // ------------------------------------------------------------
  // ------------------------------------------------------------
  //  A LISTA, MESMO CONTRA UM VANTORO ANTIGO
  //
  //  `cliente.telefones` só existe depois do #228. O painel e o Vantoro são
  //  publicados por caminhos diferentes, e o painel pode subir primeiro — numa
  //  publicação atrasada, numa reversão, num dia em que a Render falhe num e
  //  não no outro.
  //
  //  Sem esta queda, nesse intervalo a ficha ficaria SEM TELEFONE NENHUM: os
  //  campos antigos deixaram de ser desenhados (a lista tomou o lugar deles) e
  //  a lista viria vazia. O cliente pareceria não ter número.
  //
  //  Quem cai aqui não tem `id` de linha, e por isso não ganha os botões que
  //  precisam de um: trocar o principal, dizer de quem é o aparelho, tirar.
  //  Mostrar botão que vai falhar é pior do que não mostrar — a pessoa clica,
  //  nada acontece, e ela conclui que o sistema não grava telefone.
  //
  //  Foi a suíte que apontou isto: a prova da ficha responde com um cadastro
  //  sem `telefones`, e o botão de conversar pelo outro número sumiu.
  function listaDeTelefones(c) {
    if (!c) return [];
    if (Array.isArray(c.telefones) && c.telefones.length) return c.telefones;
    const vistos = new Set();
    const saida = [];
    for (const [bruto, principal] of [[c.telefone, true], [c.telefone2, false]]) {
      const d = chaveDoNumero(bruto);
      if (!d || vistos.has(d)) continue;
      vistos.add(d);
      saida.push({ id: null, numero: bruto, digitos: d, principal,
                   proprio: true, dono: "", observacao: "", usado_por: [] });
    }
    return saida;
  }

  // ------------------------------------------------------------
  //  "ESTE CPF JÁ É DE OUTRO CADASTRO" — e o botão de ir até ele
  //
  //  O pedido tinha duas metades, e a segunda é a que evita o duplicado: "e se
  //  o usuário quer ver a ficha do cadastro". Avisar sem oferecer o caminho faz
  //  a pessoa procurar quem é na outra tela — e o mais provável é que ela
  //  desista e crie o duplicado por outro caminho.
  //
  //  O QUE FAZ RECONHECER O CADASTRO vai junto: quem tem 17 processos é cliente
  //  antigo, quem tem zero pode ser um pré-cadastro esquecido. É o que decide se
  //  vale abrir a ficha ou se foi engano de digitação.
  // ------------------------------------------------------------
  function desenharCpfDeOutro() {
    if (!cpfDeOutro) return null;
    // AS CORES SAEM DA PALETA (`C`), e nao de um `modo` claro/escuro.
    //
    // Eu escrevi `modo === "escuro"` aqui, copiando de uma parte do Painel — e
    // essa variavel NAO EXISTE neste arquivo. O resultado nao era um aviso
    // feio: era `modo is not defined`, e a FICHA INTEIRA deixava de desenhar.
    // A prova pegou pelo `pageerror`; sem ela, isso chegaria ao escritorio
    // como "a ficha do cliente parou de abrir".
    //
    // Ambar na borda e no texto funciona nos dois temas, e o fundo e o do
    // proprio painel — que ja acompanha o tema.
    const AMBAR = "#d4a017";
    const pedacos = [];
    if (cpfDeOutro.processos) pedacos.push(`${cpfDeOutro.processos} ação(ões)`);
    if (cpfDeOutro.documentos) pedacos.push(`${cpfDeOutro.documentos} documento(s)`);
    if (cpfDeOutro.telefone) pedacos.push(telefoneLegivel(cpfDeOutro.telefone));
    return (
      <div data-cpf-de-outro={cpfDeOutro.id}
           style={{ marginTop: 6, borderRadius: 8, padding: "8px 10px",
                    border: `1px solid ${AMBAR}`,
                    background: C.panel, color: C.textPrimary,
                    fontSize: 12.5, lineHeight: 1.5 }}>
        <div>
          Este CPF já é do cadastro de <b>{cpfDeOutro.nome}</b>
          {pedacos.length ? ` — ${pedacos.join(" · ")}` : ""}.
        </div>
        <div style={{ marginTop: 3 }}>
          Dois cadastros da mesma pessoa partem o histórico em dois.
        </div>
        <button data-ver-cadastro={cpfDeOutro.id}
                onClick={() => abrirCadastroDeOutro(cpfDeOutro)}
                style={{ marginTop: 6, border: `1px solid ${AMBAR}`, borderRadius: 7,
                         background: "transparent", color: AMBAR, cursor: "pointer",
                         fontSize: 12.5, fontWeight: 700, padding: "5px 10px" }}>
          Abrir o cadastro de {cpfDeOutro.nome}
        </button>
      </div>
    );
  }

  function desenharTelefones() {
    if (!cliente) return null;
    const AMBAR = "#d4a017";
    return (
      <div data-telefones style={{ marginBottom: 10 }}>
        <label style={rotulo}>Telefones</label>
        {telefones.map((t) => (
          <div key={t.id} // `data-telefone-do-cliente`, e não `data-telefone`: este último já existe no
               // painel, no seletor de telefones do escritório na barra lateral. A
               // colisão fez uma prova contar 6 linhas onde havia 3 — e o nome curto
               // ia continuar mentindo para quem escrevesse a próxima.
               data-telefone-do-cliente={t.digitos || t.numero}
               style={{ border: `1px solid ${C.divider}`, borderRadius: 8,
                        padding: "8px 10px", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <b style={{ fontSize: 13.5 }}>{telefoneLegivel(t.digitos || t.numero)}</b>
              {t.principal && (
                <span data-principal style={{ fontSize: 10.5, fontWeight: 700, color: C.green,
                               border: `1px solid ${C.green}`, borderRadius: 5, padding: "1px 5px" }}>
                  WhatsApp
                </span>
              )}
            </div>

            {/* DE QUEM É O APARELHO. É o pedido 1: a mãe que atende no telefone
                do filho não é dona dele, e sem isto os dois cadastros dizem ser
                donos do mesmo número. */}
            {!t.proprio && (
              <div data-nao-e-dela style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                O aparelho não é desta pessoa{t.dono ? ` — ${t.dono}` : ""}.
              </div>
            )}

            {/* ESTÁ EM OUTROS CADASTROS. O aviso que faltava: a ficha aberta
                não dizia nada, e quem atendia não tinha como saber que o mesmo
                número serve outra pessoa. */}
            {(t.usado_por || []).length > 0 && (
              <div data-usado-por={(t.usado_por || []).length}
                   style={{ fontSize: 12, color: AMBAR, marginTop: 4, lineHeight: 1.45 }}>
                Também cadastrado em {(t.usado_por || []).length} outro(s):{" "}
                {(t.usado_por || []).map((o) => o.nome + (o.cpf ? ` (${o.cpf})` : "")).join(" · ")}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              {!t.principal && t.id != null && (
                <button data-usar-este onClick={() => editarTelefone(t, { principal: true },
                          "Este passou a ser o WhatsApp do cadastro. O número anterior continua na lista.")}
                        disabled={mexendoTel}
                        style={{ border: "none", background: "transparent", color: C.verdeTexto,
                                 cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}>
                  usar este como WhatsApp
                </button>
              )}
              {t.id != null && (
              <button data-alternar-dono
                      onClick={() => {
                        if (t.proprio) {
                          const dono = window.prompt(
                            "De quem é este aparelho?\n\nEx.: do filho, JOÃO DA SILVA", t.dono || "");
                          if (dono === null) return;
                          editarTelefone(t, { proprio: false, dono }, "Anotado de quem é o aparelho.");
                        } else {
                          editarTelefone(t, { proprio: true }, "Marcado como aparelho da própria pessoa.");
                        }
                      }}
                      disabled={mexendoTel}
                      style={{ border: "none", background: "transparent", color: C.textSecondary,
                               cursor: "pointer", fontSize: 12, padding: 0 }}>
                {t.proprio ? "o aparelho não é dela" : "é o aparelho dela"}
              </button>
              )}
              {/* CONVERSAR POR ESTE NÚMERO.
                  Estava num bloco à parte, desenhado dentro do campo "Outro
                  WhatsApp" — que a lista substituiu. A suíte pegou: o botão
                  simplesmente sumiu para todo cliente que já existe.

                  Trazê-lo para DENTRO da linha é melhor do que devolvê-lo ao
                  lugar antigo: o bloco lia só `telefone` e `telefone2`, então o
                  terceiro número em diante nunca teria botão nenhum. Aqui todo
                  número da lista tem o seu.

                  SAI O DA CONVERSA ABERTA: um botão que oferece abrir a
                  conversa em que a pessoa já está não faz nada e confunde. */}
              {aoConversarPor && chaveDoNumero(t.digitos || t.numero) !== chaveDoNumero(numero) && (
                <button data-conversar-por={`55${t.digitos}`}
                        onClick={() => aoConversarPor({
                          numero: `55${t.digitos}`,
                          // O nome do CADASTRO, e não o do contato do WhatsApp: é
                          // o mesmo cliente, e é assim que a conversa nova nasce
                          // com o nome certo em vez de um número seco no topo.
                          nome: (edicao.nome || cliente?.nome || nomeContato || "").trim(),
                          clienteId: cliente?.id || null,
                        })}
                        style={{ border: "none", background: "transparent", color: C.green,
                                 cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0 }}>
                  conversar por este
                </button>
              )}
              {telefones.length > 1 && t.id != null && (
                <button data-tirar-telefone onClick={() => tirarTelefone(t)} disabled={mexendoTel}
                        style={{ border: "none", background: "transparent", color: C.textSecondary,
                                 cursor: "pointer", fontSize: 12, padding: 0 }}>
                  tirar
                </button>
              )}
            </div>
          </div>
        ))}

        {telefones.some((t) => t.id != null) || !telefones.length ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input data-novo-telefone style={{ ...campo, flex: 1 }} value={novoNumero}
                 inputMode="numeric" placeholder="Acrescentar outro número"
                 onChange={(e) => setNovoNumero(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); acrescentarTelefone(); } }} />
          <button data-acrescentar-telefone onClick={acrescentarTelefone}
                  disabled={mexendoTel || !novoNumero.trim()}
                  style={{ ...botao, padding: "7px 12px", fontSize: 12.5,
                           opacity: (mexendoTel || !novoNumero.trim()) ? 0.5 : 1 }}>
            + Acrescentar
          </button>
        </div>
        ) : null}
      </div>
    );
  }

  function desenharOutrosNumeros() {
    if (!aoConversarPor) return null;
    const fora = outrosNumeros(edicao, numero);
    if (!fora.length) return null;
    return (
      <div data-outros-numeros style={{ marginTop: 6 }}>
        {fora.map((n) => (
          <button
            key={n.chave}
            data-conversar-por={n.cru}
            onClick={() => aoConversarPor({
              numero: n.cru,
              // O nome do cadastro, e não o do contato do WhatsApp: é o mesmo
              // cliente, e é assim que a conversa nova já nasce com o nome
              // certo em vez de um número seco no cabeçalho.
              nome: (edicao.nome || cliente?.nome || nomeContato || "").trim(),
              clienteId: cliente?.id || null,
            })}
            style={{
              display: "flex", alignItems: "center", gap: 7, width: "100%",
              border: `1px solid ${C.divider}`, borderRadius: 8, padding: "8px 10px",
              background: "transparent", color: C.green, cursor: "pointer",
              fontSize: 12.5, fontWeight: 600, textAlign: "left",
            }}>
            <MessageSquare size={15} />
            Conversar por {n.legivel}
          </button>
        ))}
      </div>
    );
  }

  return (
    // Coluna de verdade, ao lado da conversa — não uma camada por cima dela.
    // No celular não cabem as duas, então a ficha ocupa a tela inteira.
    <div style={{
      width: estreito ? "100%" : 330, flex: estreito ? 1 : "none",
      background: C.panel, borderLeft: `1px solid ${C.divider}`,
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
    }}>
      <div style={{
        background: C.headerBar, padding: "12px 16px", display: "flex",
        alignItems: "center", gap: 10, borderBottom: `1px solid ${C.divider}`,
      }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.textPrimary }}>Ficha no Vantoro</span>
        {/* Atualizar relê o cadastro e substitui os campos — descarta o que foi
            digitado do mesmo jeito que fechar. Pergunta pelo mesmo motivo. */}
        <button onClick={() => { if (!mudouAlgumaCoisa()
              || window.confirm("Atualizar descarta o que você digitou e ainda não salvou. Continuar?")) buscar(); }}
                title="Atualizar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
          <RefreshCw size={16} color={C.textSecondary} />
        </button>
        <button onClick={tentarFechar} title="Fechar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
          <X size={18} color={C.textSecondary} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {carregando && <div style={{ color: C.textSecondary, fontSize: 13.5 }}>Consultando o Vantoro…</div>}

        {!carregando && erro && (
          <div style={{ color: "#e5695a", fontSize: 13, lineHeight: 1.5 }}>
            {erro}
            {/* A DICA SÓ APARECE QUANDO ELA É MESMO A EXPLICAÇÃO.
                Antes vinha grudada em QUALQUER erro, e mandava conferir
                VANTORO_API_URL e VANTORO_API_TOKEN mesmo quando o problema era
                o Vantoro fora do ar. Em 21/08 foi o que aconteceu: a
                configuração estava intacta, e a tela mandou conferir a
                configuração. Uma dica errada é pior do que dica nenhuma — ela
                manda a pessoa para o lugar errado com confiança. */}
            {BRIDGE_URL && ehProblemaDeConfiguracao(erro) && (
              <div style={{ color: C.textSecondary, marginTop: 8, fontSize: 12 }}>
                Verifique se a ponte está configurada com VANTORO_API_URL e VANTORO_API_TOKEN.
              </div>
            )}
          </div>
        )}

        {/* MAIS DE UM CADASTRO NESTE NÚMERO: quem escolhe é a pessoa.
            Mãe e filho, marido e mulher, o telefone de uma empresa — um número
            serve mais de um cliente, e isso é normal. Escolher sozinho é
            escolher para quem vão as notas internas daquela conversa, e errar
            aqui põe o caso de um cliente na ficha de outro. */}
        {!carregando && !erro && !cliente && candidatos.length > 1 && (
          <div data-escolher-cadastro>
            <div style={{ color: C.textPrimary, fontSize: 13.5, lineHeight: 1.55, marginBottom: 4 }}>
              <b>{candidatos.length} cadastros</b> atendem por este número.
            </div>
            <div style={{ color: C.textSecondary, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
              Escolha de quem é esta conversa. As anotações internas daqui vão para
              a ficha de quem for escolhido — e a escolha fica guardada.
            </div>
            {candidatos.map((c) => (
              <button key={c.id} onClick={() => escolher(c)} data-candidato={c.id}
                      style={{ width: "100%", textAlign: "left", cursor: "pointer",
                               border: `1px solid ${C.divider}`, background: "transparent",
                               color: C.textPrimary, borderRadius: 9, padding: "10px 12px",
                               marginBottom: 8, fontSize: 13.5 }}>
                <b>{c.nome}</b>
                <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 3 }}>
                  {[c.cpf, c.cidade && (c.estado ? `${c.cidade}/${c.estado}` : c.cidade),
                    (c.processos || []).length ? `${(c.processos || []).length} ação(ões)` : null]
                    .filter(Boolean).join(" · ") || "sem outros dados"}
                </div>
              </button>
            ))}
          </div>
        )}

        {!carregando && !erro && !cliente && candidatos.length <= 1 && (
          <div>
            <div style={{ color: C.textSecondary, fontSize: 13.5, lineHeight: 1.55, marginBottom: 14 }}>
              Este número ainda <b>não tem cadastro</b> no Vantoro.
              Crie o pré-cadastro para abrir a ordem de serviço e iniciar a esteira.
            </div>
            <label style={rotulo}>Nome</label>
            <input style={{ ...campo, marginBottom: 10 }} value={edicao.nome ?? (nomeContato || "")}
                   onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            <label style={rotulo}>CPF (opcional agora)</label>
            <input style={{ ...campo, marginBottom: 14 }} value={edicao.cpf || ""}
                   onChange={(e) => setEdicao({ ...edicao, cpf: e.target.value })} />
            {/* CLIENTE OU RÉU — a escolha que decide a ordem de serviço.
                Dois botões, e não uma lista: são duas opções, e uma lista
                fechada esconderia a segunda atrás de um clique. Quem atende
                precisa VER que existe a escolha, senão ela não é feita.
                "Cliente" já vem marcado porque é o caso de quase todo lead;
                o réu é a exceção, e a exceção precisa estar à vista. */}
            <label style={rotulo}>Quem é esta pessoa para o escritório?</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              {[["cliente", "Cliente"], ["contraria", "Parte contrária (réu)"]].map(([v, r]) => (
                <button key={v} data-papel={v} aria-pressed={papel === v}
                        onClick={() => setPapel(v)}
                        style={{ flex: 1, padding: "9px 8px", borderRadius: 9, cursor: "pointer",
                                 fontSize: 13, fontWeight: 600,
                                 border: `1px solid ${papel === v ? C.green : C.divider}`,
                                 background: papel === v ? C.green : "transparent",
                                 color: papel === v ? "#fff" : C.textSecondary }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ color: C.textSecondary, fontSize: 12, lineHeight: 1.45, marginBottom: 14 }}>
              {papel === "contraria"
                ? "A parte contrária entra no cadastro, mas NÃO abre ordem de serviço."
                : "O cliente abre a ordem de serviço e entra na esteira."}
            </div>
            <button style={{ ...botao, width: "100%", opacity: salvando ? 0.6 : 1 }} onClick={criar} disabled={salvando}>
              <UserPlus size={15} /> {salvando ? "Criando…" : "Criar pré-cadastro"}
            </button>
          </div>
        )}

        {/* JÁ ESCOLHIDO, MAS NÃO É O ÚNICO. O aviso fica, e não some depois da
            escolha: quem abre a conversa amanhã precisa saber que este número
            serve outra pessoa também — senão anota na ficha errada achando que
            só existe uma. */}
        {!carregando && !erro && cliente && candidatos.length > 1 && (
          <div data-outro-cadastro
               style={{ background: C.searchBg, border: `1px solid ${C.divider}`,
                        borderRadius: 9, padding: "9px 11px", marginBottom: 12,
                        fontSize: 12.5, lineHeight: 1.5, color: C.textSecondary }}>
            Este número atende <b>{candidatos.length} cadastros</b>. Esta conversa está
            ligada a <b>{cliente.nome}</b>.{" "}
            <button onClick={() => { setCliente(null); setEdicao({}); }}
                    data-trocar-cadastro
                    style={{ border: "none", background: "transparent", padding: 0,
                             cursor: "pointer", color: C.green, fontWeight: 600,
                             font: "inherit" }}>
              trocar
            </button>
          </div>
        )}

        {!carregando && !erro && cliente && (
          <div>
            {cliente.ordem_servico && (
              <div style={{
                background: C.listActive, borderRadius: 9, padding: "10px 12px", marginBottom: 14,
              }}>
                <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 5 }}>
                  ORDEM DE SERVIÇO · {cliente.ordem_servico.status}
                </div>
                {/* `pendencias` pode não vir. Sem esta guarda, `.length` estoura —
                    e no React 18 um erro assim não mostra mensagem nenhuma: ele
                    MATA a árvore onde aconteceu. A ficha inteira sumia, e o que
                    sobrava era uma coluna em branco ao lado da conversa. */}
                {(cliente.ordem_servico.pendencias || []).length ? (
                  (cliente.ordem_servico.pendencias || []).map((p) => (
                    <div key={p.id} style={{ fontSize: 12.5, color: C.textPrimary, marginTop: 3 }}>
                      • {p.titulo}
                      <span style={{ color: C.textSecondary }}>
                        {p.responsavel ? ` — com ${p.responsavel}` : " — disponível no pool"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12.5, color: C.textSecondary }}>Sem pendências.</div>
                )}
              </div>
            )}

            {/* Atalho para o cadastro inteiro. Fica no topo, junto com o que se
                olha primeiro: aqui cabe só um resumo, e quem precisa do resto
                (processos, documentos, histórico) não deveria ter de rolar a
                ficha inteira para descobrir que existe um caminho. */}
            {import.meta.env.VITE_VANTORO_WEB && (
              <a href={`${import.meta.env.VITE_VANTORO_WEB}/cadastro/clientes/${cliente.id}/`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14,
                          fontSize: 12.5, color: C.link, textDecoration: "none" }}>
                <ExternalLink size={13} /> Abrir ficha completa no Vantoro
              </a>
            )}

            {/* O número desta conversa, só para conferir. Não se edita aqui: é
                por ele que a conversa acha o cadastro, e trocá-lo no meio do
                atendimento desfaria esse vínculo. Se o cliente mudou de número,
                anote no campo abaixo; a troca do principal é feita no Vantoro. */}
            <div style={{ marginBottom: 10 }}>
              <label style={rotulo}>WhatsApp desta conversa</label>
              <div style={{ ...campo, background: C.headerBar, color: C.textSecondary }}>
                {telefoneLegivel(numero)}
              </div>
            </div>

            {SECOES.map((secao) => {
              const aberta = abertas.has(secao.id);
              // Quantos campos da seção já têm conteúdo — dá para saber o que
              // falta preencher sem abrir uma por uma.
              const preenchidos = secao.campos.filter((c) => (edicao[c.chave] || "").trim()).length;
              return (
                <div key={secao.id} style={{ borderTop: `1px solid ${C.divider}` }}>
                  {/* O `id` da seção sai no HTML para a prova poder abrir uma
                      seção fechada e conferir o que está dentro. Sem isso, a
                      única forma seria procurar pelo TÍTULO — que muda. */}
                  <button data-secao={secao.id} style={cabecalhoSecao}
                          onClick={() => alternar(secao.id)}>
                    {aberta ? <ChevronDown size={15} color={C.textSecondary} />
                            : <ChevronRight size={15} color={C.textSecondary} />}
                    <span style={{ flex: 1 }}>{secao.titulo}</span>
                    <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 400 }}>
                      {preenchidos}/{secao.campos.length}
                    </span>
                  </button>
                  {aberta && <div style={{ paddingBottom: 6 }}>{secao.campos.map(desenharCampo)}</div>}
                </div>
              );
            })}

            <button style={{ ...botao, width: "100%", marginTop: 12, opacity: salvando ? 0.6 : 1 }}
                    onClick={salvar} disabled={salvando}>
              <Save size={15} /> {salvando ? "Salvando…" : "Salvar no Vantoro"}
            </button>

            {(cliente.processos || []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>
                  PROCESSOS · {(cliente.processos || []).length}
                </div>
                {(cliente.processos || []).slice(0, 12).map((p) => (
                  <div key={p.id} style={{ fontSize: 12.5, color: C.textPrimary, marginBottom: 6, lineHeight: 1.4 }}>
                    {p.tipo_acao || p.numero || "processo"}
                    <span style={{ display: "block", color: C.textSecondary, fontSize: 11.5 }}>
                      {p.reu ? `Réu: ${p.reu}` : "Sem réu"} · {p.situacao}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: C.textSecondary }}>
              {cliente.documentos || 0} documento(s) no cadastro.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
