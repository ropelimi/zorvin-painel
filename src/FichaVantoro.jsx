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
import { useEffect, useState } from "react";
import { X, Save, UserPlus, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
         MessageSquare } from "lucide-react";
import { supabase } from "./supabase";
// As regras de telefone são as MESMAS do painel, e por isso vêm do mesmo
// lugar: decidir se o segundo número do cadastro é outra linha ou o mesmo
// aparelho escrito diferente é a mesma pergunta que a busca já respondia.
import { outrosNumeros, telefoneLegivel } from "./numeros.js";
// A chamada à ponte mora em `ponte.js`: duas telas precisam dela (esta e a de
// atendentes), e duas cópias divergiriam na primeira mudança.
import { chamarPonte, BRIDGE_URL, FALTA_PONTE } from "./ponte.js";

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
  const [edicao, setEdicao] = useState({});
  const [salvando, setSalvando] = useState(false);
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
  async function ligarContatoAoCadastro(dadosCliente) {
    const nome = (dadosCliente?.nome || "").trim();
    if (!numero || !nome) return;
    const campos = { vantoro_nome: nome };
    if (dadosCliente.id) campos.vantoro_cliente_id = dadosCliente.id;
    // Instalação sem as colunas de vínculo: perder o vínculo é aceitável, a
    // ficha ter falhado por causa dele não é. É a mesma tolerância que a ponte
    // já tem do outro lado ao gravar.
    const { error } = await supabase.from("contatos").update(campos).eq("numero", numero);
    if (error && /vantoro_/i.test(error.message || "")) return;
    if (error) return;
    aoLigarCadastro && aoLigarCadastro({ numero, nome, clienteId: dadosCliente.id || null });
  }

  async function buscar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await chamarPonte(`/vantoro/cliente?telefone=${encodeURIComponent(numero || "")}`);
      const achado = (r.clientes && r.clientes[0]) || null;
      if (r.opcoes?.estado_civil?.length) setOpcoes(r.opcoes);
      setCliente(achado);
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

  useEffect(() => { if (numero) buscar(); /* eslint-disable-next-line */ }, [numero]);

  async function criar() {
    setSalvando(true);
    try {
      const r = await chamarPonte("/vantoro/cliente", {
        method: "POST",
        body: JSON.stringify({
          nome: (edicao.nome || nomeContato || "").trim() || "Sem nome",
          telefone: numero,
          cpf: edicao.cpf || "",
        }),
      });
      setCliente(r.cliente);
      setEdicao({ ...r.cliente });
      await ligarContatoAoCadastro(r.cliente);
      onAviso && onAviso(r.criado ? "Pré-cadastro criado no Vantoro." : "Já existia no Vantoro.");
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
      await ligarContatoAoCadastro(r.cliente);
      onAviso && onAviso("Cadastro atualizado no Vantoro.");
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
            {/* A dica só faz sentido quando o painel já sabe o endereço da
                ponte; se nem isso ele tem, a mensagem acima já explica tudo. */}
            {BRIDGE_URL && (
              <div style={{ color: C.textSecondary, marginTop: 8, fontSize: 12 }}>
                Verifique se a ponte está configurada com VANTORO_API_URL e VANTORO_API_TOKEN.
              </div>
            )}
          </div>
        )}

        {!carregando && !erro && !cliente && (
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
            <button style={{ ...botao, width: "100%", opacity: salvando ? 0.6 : 1 }} onClick={criar} disabled={salvando}>
              <UserPlus size={15} /> {salvando ? "Criando…" : "Criar pré-cadastro"}
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
                  <button style={cabecalhoSecao} onClick={() => alternar(secao.id)}>
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
