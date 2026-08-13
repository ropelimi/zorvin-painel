// PAINEL — quanto se falou, por telefone e por atendente.
//
// A pergunta que ele responde é "quem está atendendo e quanto". Duas leituras,
// porque são duas perguntas:
//
//   POR TELEFONE   quanto entrou e quanto saiu em cada linha do escritório.
//                  Serve para ver qual número está afogado e qual está parado —
//                  por isso a lista traz TODOS os telefones, inclusive os que
//                  ficaram em zero. Telefone parado sumindo da tabela é a
//                  informação mais útil da tela indo embora.
//   POR ATENDENTE  quanto CADA PESSOA enviou. Recebida não tem atendente —
//                  ela chega no telefone, não em alguém —, e por isso a tabela
//                  de gente não tem coluna de recebidas: inventar uma seria
//                  dividir por quem abriu a conversa, que não é quem atendeu.
//
// A CONTA É FEITA NO BANCO, e isso não é preferência: a API do Supabase
// devolve no máximo 1000 linhas por consulta e não avisa que cortou. A
// primeira versão desta tela baixava as mensagens para contar no navegador, e
// por isso travava em 1000, escondia os telefones que não couberam na fatia, e
// dava o mesmo número para "7 dias" e para "Tudo". Quem conta agora é a função
// `painel_numeros` (sql/2026-08-painel-conta-no-banco.sql, na ponte).
//
// QUEM ENVIOU É CONTADO PELO ID, com o nome como reserva. O nome muda quando
// alguém edita o perfil, e uma pessoa vira duas no relatório. O id não muda —
// mas só existe nas mensagens de agosto/2026 em diante, então o que é anterior
// continua sendo contado pelo nome, com a imprecisão que já tinha. A tela diz
// isso quando é o caso, em vez de apresentar um total redondo que esconde a
// diferença.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";

/** Períodos oferecidos. `dias: null` = tudo o que existe. */
const PERIODOS = [
  { chave: "7", rotulo: "7 dias", dias: 7 },
  { chave: "30", rotulo: "30 dias", dias: 30 },
  { chave: "90", rotulo: "90 dias", dias: 90 },
  { chave: "tudo", rotulo: "Tudo", dias: null },
];

const numero = (n) => Number(n || 0).toLocaleString("pt-BR");

export default function PainelNumeros({ C, advogados = [], departamentos = [], aoFechar }) {
  const [periodo, setPeriodo] = useState("30");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [faltaSql, setFaltaSql] = useState(false);
  const [bruto, setBruto] = useState(null);

  const desde = useMemo(() => {
    const d = PERIODOS.find((p) => p.chave === periodo)?.dias;
    if (!d) return null;
    const t = new Date();
    t.setDate(t.getDate() - d);
    return t.toISOString();
  }, [periodo]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true); setErro(""); setFaltaSql(false);
      const { data, error } = await supabase.rpc("painel_numeros", { p_desde: desde });
      if (!vivo) return;
      if (error) {
        // Banco sem a função ainda. Aqui NÃO existe plano B honesto: contar no
        // navegador é justamente o que dava número errado. Melhor a tela dizer
        // o que falta do que mostrar um total que parece certo.
        const m = (error.message || "") + (error.code || "");
        if (/painel_numeros|PGRST202|does not exist|Could not find/i.test(m)) setFaltaSql(true);
        else setErro(error.message || "Erro desconhecido");
        setCarregando(false);
        return;
      }
      setBruto(data || null);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [desde]);

  const dados = useMemo(() => {
    const b = bruto || {};
    const nomeDoDep = new Map(departamentos.map((d) => [String(d.id), d.nome]));
    const doBanco = new Map((b.por_telefone || []).map((t) => [String(t.advogado_id), t]));

    // Todos os telefones que a pessoa alcança, e não só os que tiveram
    // movimento. Zero é resposta.
    const vistos = new Set();
    const telefones = advogados.map((a) => {
      const id = String(a.id);
      vistos.add(id);
      const r = doBanco.get(id) || {};
      const recebidas = Number(r.recebidas || 0), enviadas = Number(r.enviadas || 0);
      return { id, nome: a.nome || a.numero || id,
               departamento: nomeDoDep.get(String(a.departamento_id)) || "",
               recebidas, enviadas, total: recebidas + enviadas };
    });
    // Telefone que saiu do cadastro mas tem mensagem no período: continua
    // contando, com o nome que der. Some da lista de telefones, não da conta.
    for (const [id, r] of doBanco) {
      if (vistos.has(id)) continue;
      const recebidas = Number(r.recebidas || 0), enviadas = Number(r.enviadas || 0);
      telefones.push({ id, nome: "(telefone removido do cadastro)", departamento: "",
                       recebidas, enviadas, total: recebidas + enviadas });
    }
    telefones.sort((a, b2) => b2.total - a.total);

    const pessoas = (b.por_pessoa || [])
      .map((p) => ({ chave: p.chave, nome: p.nome || "(sem nome)",
                     temId: !!p.enviado_por_id, enviadas: Number(p.enviadas || 0) }))
      .sort((a, b2) => b2.enviadas - a.enviadas);

    // Rótulos marcados no de-para como "isto não é pessoa" — nome de linha que
    // veio do importador de histórico, mensagem sem autor. Saem do ranking de
    // atendentes, mas continuam na tela e na conta do telefone.
    const rotulos = (b.por_rotulo || [])
      .map((r) => ({ nome: r.nome || "(sem nome)", enviadas: Number(r.enviadas || 0) }))
      .sort((a, b2) => b2.enviadas - a.enviadas);

    const recebidas = Number(b.recebidas || 0), enviadas = Number(b.enviadas || 0);
    return { telefones, pessoas, rotulos, recebidas, enviadas, total: recebidas + enviadas,
             notas: Number(b.notas || 0), aparelho: Number(b.aparelho || 0),
             semId: Number(b.sem_id || 0), outras: Number(b.outras || 0),
             totalRotulos: rotulos.reduce((t, r) => t + r.enviadas, 0) };
  }, [bruto, advogados, departamentos]);

  const maiorTel = Math.max(1, ...dados.telefones.map((t) => t.total));
  const maiorPes = Math.max(1, ...dados.pessoas.map((p) => p.enviadas), dados.aparelho);

  // A paleta tem `headerBar` (fundo de tela) e `panel` (cartão); não tem `bg`.
  // Chave inexistente não dá erro: rende `background: undefined` e a tela sai
  // transparente por cima da conversa.
  const cartao = { background: C.panel, border: `1px solid ${C.divider}`, borderRadius: 12, padding: "14px 16px" };
  const rotulo = { fontSize: 11.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" };
  const valor = { fontSize: 26, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" };
  const th = { textAlign: "left", fontSize: 11.5, color: C.textSecondary, fontWeight: 700, letterSpacing: 0.4,
               textTransform: "uppercase", padding: "0 0 6px", borderBottom: `1px solid ${C.divider}` };
  const td = { padding: "9px 0", borderBottom: `1px solid ${C.divider}`, fontSize: 14 };
  // O respiro à esquerda é o que separa uma coluna da outra. Sem ele, no
  // celular os três títulos encostavam e viravam "RECEBIDASENVIADASTOTAL".
  const thNum = { ...th, textAlign: "right", paddingLeft: 14, whiteSpace: "nowrap" };
  const num = { ...td, textAlign: "right", paddingLeft: 14, fontVariantNumeric: "tabular-nums", fontWeight: 600 };
  const nota = { fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 };

  /** Barrinha proporcional — o número diz quanto, a barra diz quanto comparado. */
  const barra = (parte, todo, cor) => (
    <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 5 }}>
      <div style={{ width: `${Math.round((parte / todo) * 100)}%`, height: "100%", background: cor }} />
    </div>
  );

  return (
    <div data-tela="painel"
         style={{ position: "fixed", inset: 0, background: C.headerBar, color: C.textPrimary, zIndex: 200, overflowY: "auto" }}>
      {/* `flexWrap` para o celular: sem ele os quatro períodos espremiam o
          título até "7 dias" quebrar em duas linhas dentro do próprio botão. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", flexWrap: "wrap",
                    background: C.panel, borderBottom: `1px solid ${C.divider}`, position: "sticky", top: 0, zIndex: 2 }}>
        <button onClick={aoFechar} title="Voltar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", minHeight: 32, alignItems: "center" }}>
          <ArrowLeft size={20} color={C.textSecondary} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, flex: "1 1 auto" }}>Painel</div>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODOS.map((p) => (
            <button key={p.chave} onClick={() => setPeriodo(p.chave)}
              style={{ minHeight: 32, border: `1px solid ${periodo === p.chave ? C.greenDark : C.divider}`,
                       background: periodo === p.chave ? C.greenDark : "transparent",
                       color: periodo === p.chave ? "#fff" : C.textSecondary,
                       borderRadius: 20, padding: "5px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
        {carregando && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, padding: 24 }}>
            <RefreshCw size={16} /> Contando as mensagens…
          </div>
        )}

        {faltaSql && (
          <div style={{ ...cartao, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertCircle size={20} color="#d99a1e" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              <b>Falta um passo no banco.</b>
              <div style={{ ...nota, marginTop: 6 }}>
                Este painel conta as mensagens dentro do banco, e a função que faz
                essa conta ainda não foi criada. Rode o arquivo
                {" "}<code style={{ background: C.headerBar, padding: "1px 5px", borderRadius: 4 }}>
                  sql/2026-08-painel-conta-no-banco.sql
                </code>{" "}
                (repositório da ponte) no SQL Editor do Supabase e abra esta tela de novo.
                <div style={{ marginTop: 8 }}>
                  Não mostro número nenhum enquanto isso: a conta feita aqui fora dá
                  resultado errado em base grande, e errado com cara de certo é pior
                  do que vazio.
                </div>
              </div>
            </div>
          </div>
        )}

        {!!erro && (
          <div style={{ ...cartao, borderColor: "#e5573f", color: "#e5573f" }}>
            Não consegui contar as mensagens: {erro}
          </div>
        )}

        {!carregando && !erro && !faltaSql && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <div style={cartao}><div style={rotulo}>Recebidas</div><div style={valor}>{numero(dados.recebidas)}</div></div>
              <div style={cartao}><div style={rotulo}>Enviadas</div><div style={valor}>{numero(dados.enviadas)}</div></div>
              <div style={cartao}><div style={rotulo}>Total trocado</div><div style={valor}>{numero(dados.total)}</div></div>
              {/* Notas ficam à parte, e não somadas: elas nunca saíram daqui. */}
              <div style={cartao}><div style={rotulo}>Notas internas</div>
                <div style={{ ...valor, color: C.textSecondary }}>{numero(dados.notas)}</div></div>
            </div>

            {/* `origem` fora das duas conhecidas. Enquanto for zero, não ocupa
                espaço; se um dia deixar de ser, aparece em vez de engordar as
                recebidas em silêncio. */}
            {dados.outras > 0 && (
              <div style={{ ...cartao, marginTop: 12, ...nota }}>
                <b style={{ color: C.textPrimary }}>{numero(dados.outras)}</b> mensagens não são
                nem recebidas nem enviadas (têm uma origem que este painel não conhece) e ficaram
                fora das duas colunas. Se esse número crescer, me avise.
              </div>
            )}

            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: "22px 0 8px" }}>Por telefone</h3>
            {dados.telefones.length === 0 && <div style={{ ...cartao, color: C.textSecondary }}>Nenhum telefone cadastrado.</div>}
            {dados.telefones.length > 0 && (
              <div style={cartao}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={th}>Telefone</th>
                    <th style={thNum}>Recebidas</th>
                    <th style={thNum}>Enviadas</th>
                    <th style={thNum}>Total</th>
                  </tr></thead>
                  <tbody>
                    {dados.telefones.map((t) => (
                      <tr key={t.id}>
                        <td style={{ ...td, width: "46%" }}>
                          <div style={{ fontWeight: 600 }}>{t.nome}</div>
                          {t.departamento && <div style={{ fontSize: 12, color: C.textSecondary }}>{t.departamento}</div>}
                          {barra(t.total, maiorTel, C.green)}
                        </td>
                        <td style={num}>{numero(t.recebidas)}</td>
                        <td style={num}>{numero(t.enviadas)}</td>
                        <td style={{ ...num, fontWeight: 700 }}>{numero(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: "22px 0 8px" }}>Por atendente</h3>
            <div style={{ ...nota, marginBottom: 8 }}>
              Só ENVIADAS. Mensagem recebida chega no telefone, não em uma pessoa —
              atribuí-la a alguém seria inventar quem atendeu.
            </div>
            {dados.pessoas.length === 0 && <div style={{ ...cartao, color: C.textSecondary }}>Ninguém enviou nada no período.</div>}
            {dados.pessoas.length > 0 && (
              <div style={cartao}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={th}>Atendente</th>
                    <th style={thNum}>Enviadas</th>
                  </tr></thead>
                  <tbody>
                    {dados.pessoas.map((p) => (
                      <tr key={p.chave}>
                        <td style={{ ...td, width: "70%" }}>
                          <div style={{ fontWeight: 600 }}>
                            {p.nome}
                            {/* Sem id, a linha pode ser duas pessoas somadas (ou uma
                                pessoa partida em duas, se ela trocou de nome). Dizer
                                isso na linha é mais honesto do que um total liso. */}
                            {!p.temId && (
                              <span title="Contado pelo nome: mensagens anteriores a agosto/2026 não guardam quem enviou."
                                    style={{ marginLeft: 7, fontSize: 11, fontWeight: 700, color: C.textSecondary,
                                             border: `1px solid ${C.divider}`, borderRadius: 10, padding: "1px 7px" }}>
                                pelo nome
                              </span>
                            )}
                          </div>
                          {barra(p.enviadas, maiorPes, C.greenDark)}
                        </td>
                        <td style={{ ...num, fontWeight: 700 }}>{numero(p.enviadas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ISTO NÃO É UMA PESSOA. Mensagem enviada pelo aparelho, fora do
                Zorvin, chega com o rótulo "WhatsApp" em quem enviou. Na lista de
                atendentes ela aparecia como um colega — em geral no topo. */}
            {/* NÃO É GENTE. O importador de histórico assina as mensagens com o
                nome da LINHA como estava salvo no celular de quem exportou
                ("Cadastro - C&A"), e isso entrava no ranking como se fosse um
                colega — em geral no topo, porque são milhares. Aqui elas
                aparecem separadas, e discriminadas: sair do ranking não é a
                mesma coisa que sumir. */}
            {dados.rotulos.length > 0 && (
              <div style={{ ...cartao, marginTop: 12 }}>
                <div style={{ ...nota, marginBottom: 10 }}>
                  <b style={{ color: C.textPrimary }}>{numero(dados.totalRotulos)}</b> mensagens
                  enviadas com um rótulo que não é atendente — nome de linha vindo do histórico
                  importado, ou mensagem sem autor. Contam no total do telefone e ficam fora do
                  ranking de gente.
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {dados.rotulos.map((r) => (
                      <tr key={r.nome}>
                        <td style={{ ...td, fontSize: 13.5 }}>{r.nome}</td>
                        <td style={{ ...num, fontSize: 13.5 }}>{numero(r.enviadas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dados.aparelho > 0 && (
              <div style={{ ...cartao, marginTop: 12, ...nota }}>
                {/* Mesmo formato da observação de baixo, de propósito: um título
                    grande e um ícone faziam isto parecer mais uma seção de
                    ranking, quando é justamente o contrário — é o que foi TIRADO
                    do ranking. */}
                <b style={{ color: C.textPrimary }}>{numero(dados.aparelho)}</b> mensagens enviadas
                pelo aparelho — saíram pelo WhatsApp no celular, fora do Zorvin. Contam no total
                do telefone, mas não dá para saber quem escreveu, por isso ficam fora da lista de
                atendentes.
              </div>
            )}

            {dados.semId > 0 && (
              <div style={{ ...cartao, marginTop: 12, ...nota }}>
                <b style={{ color: C.textPrimary }}>{numero(dados.semId)}</b> das mensagens enviadas neste período
                não guardam quem as escreveu e foram contadas pelo nome. São as anteriores a agosto/2026;
                daqui em diante toda mensagem sai identificada, e este aviso some sozinho.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
