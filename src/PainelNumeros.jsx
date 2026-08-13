// PAINEL — quanto se falou, por telefone e por atendente.
//
// A pergunta que ele responde é "quem está atendendo e quanto", e ela vinha
// sendo respondida por estimativa. Duas leituras, porque são duas perguntas:
//
//   POR TELEFONE   quanto entrou e quanto saiu em cada linha do escritório.
//                  Serve para ver qual número está afogado e qual está parado.
//   POR ATENDENTE  quanto CADA PESSOA enviou. Recebida não tem atendente —
//                  ela chega no telefone, não em alguém —, e por isso a tabela
//                  de gente não tem coluna de recebidas: inventar uma seria
//                  dividir por quem abriu a conversa, que não é quem atendeu.
//
// QUEM ENVIOU É CONTADO PELO ID, com o nome como reserva. O nome muda quando
// alguém edita o perfil, e uma pessoa vira duas no relatório. O id não muda —
// mas só existe nas mensagens de agosto/2026 em diante, então o que é anterior
// continua sendo contado pelo nome, com a imprecisão que já tinha. A tela diz
// isso quando é o caso, em vez de apresentar um total redondo que esconde a
// diferença.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { ArrowLeft, RefreshCw } from "lucide-react";

/** Períodos oferecidos. `dias: null` = tudo o que existe. */
const PERIODOS = [
  { chave: "7", rotulo: "7 dias", dias: 7 },
  { chave: "30", rotulo: "30 dias", dias: 30 },
  { chave: "90", rotulo: "90 dias", dias: 90 },
  { chave: "tudo", rotulo: "Tudo", dias: null },
];

const numero = (n) => (n || 0).toLocaleString("pt-BR");

export default function PainelNumeros({ C, advogados = [], departamentos = [], aoFechar }) {
  const [periodo, setPeriodo] = useState("30");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [linhas, setLinhas] = useState([]);       // mensagens cruas do período
  const [conversas, setConversas] = useState([]); // para saber de qual telefone é cada conversa

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
      setCarregando(true); setErro("");
      // As conversas dizem de qual TELEFONE é cada mensagem — a mensagem só
      // conhece a conversa dela.
      const conv = await supabase.from("conversas").select("id, advogado_id");
      let q = supabase.from("mensagens").select("conversa_id, origem, enviado_por, enviado_por_id, criado_em");
      if (desde) q = q.gte("criado_em", desde);
      const msg = await q;
      if (!vivo) return;
      if (msg.error) {
        // Base sem o SQL de agosto/2026: repete sem a coluna nova, para a tela
        // funcionar (contando só pelo nome) em vez de não abrir.
        if (/enviado_por_id/i.test(msg.error.message || "")) {
          let q2 = supabase.from("mensagens").select("conversa_id, origem, enviado_por, criado_em");
          if (desde) q2 = q2.gte("criado_em", desde);
          const msg2 = await q2;
          if (!vivo) return;
          if (msg2.error) { setErro(msg2.error.message); setCarregando(false); return; }
          setLinhas(msg2.data || []);
        } else {
          setErro(msg.error.message); setCarregando(false); return;
        }
      } else {
        setLinhas(msg.data || []);
      }
      setConversas(conv.data || []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [desde]);

  const dados = useMemo(() => {
    const telefoneDaConversa = new Map(conversas.map((c) => [String(c.id), String(c.advogado_id)]));
    const nomeDoTelefone = new Map(advogados.map((a) => [String(a.id), a.nome || a.numero || a.id]));
    const depDoTelefone = new Map(advogados.map((a) => [String(a.id), a.departamento_id]));
    const nomeDoDep = new Map(departamentos.map((d) => [String(d.id), d.nome]));

    const porTelefone = new Map();
    const porPessoa = new Map();
    let semId = 0, enviadas = 0, recebidas = 0, notas = 0;

    for (const m of linhas) {
      // NOTA INTERNA NÃO É MENSAGEM TROCADA. Ela nunca saiu do escritório;
      // somá-la a "enviadas" inflaria o trabalho de quem escreve muita nota.
      if (m.origem === "nota") { notas++; continue; }
      const ehEnviada = m.origem === "advogado";
      if (ehEnviada) enviadas++; else recebidas++;

      const tel = telefoneDaConversa.get(String(m.conversa_id));
      if (tel) {
        const r = porTelefone.get(tel) || { enviadas: 0, recebidas: 0 };
        r[ehEnviada ? "enviadas" : "recebidas"]++;
        porTelefone.set(tel, r);
      }

      if (!ehEnviada) continue;
      // Pelo ID quando existe; pelo nome quando não. A chave leva o prefixo
      // para um id nunca colidir com um nome.
      const chave = m.enviado_por_id ? `id:${m.enviado_por_id}` : `nome:${(m.enviado_por || "").trim() || "(sem nome)"}`;
      if (!m.enviado_por_id) semId++;
      const r = porPessoa.get(chave) || { enviadas: 0, nome: (m.enviado_por || "").trim() || "(sem nome)", temId: !!m.enviado_por_id };
      r.enviadas++;
      // Um nome mais recente vale mais do que um antigo para rotular a linha.
      if (m.enviado_por) r.nome = m.enviado_por.trim();
      porPessoa.set(chave, r);
    }

    const telefones = [...porTelefone.entries()]
      .map(([id, r]) => ({
        id, nome: nomeDoTelefone.get(id) || "(telefone removido)",
        departamento: nomeDoDep.get(String(depDoTelefone.get(id))) || "",
        ...r, total: r.enviadas + r.recebidas,
      }))
      .sort((a, b) => b.total - a.total);

    const pessoas = [...porPessoa.entries()]
      .map(([chave, r]) => ({ chave, ...r }))
      .sort((a, b) => b.enviadas - a.enviadas);

    return { telefones, pessoas, enviadas, recebidas, notas, semId,
             total: enviadas + recebidas };
  }, [linhas, conversas, advogados, departamentos]);

  const maiorTel = Math.max(1, ...dados.telefones.map((t) => t.total));
  const maiorPes = Math.max(1, ...dados.pessoas.map((p) => p.enviadas));

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

  /** Barrinha proporcional — o número diz quanto, a barra diz quanto comparado. */
  const barra = (parte, todo, cor) => (
    <div style={{ height: 6, background: C.divider, borderRadius: 3, overflow: "hidden", marginTop: 5 }}>
      <div style={{ width: `${Math.round((parte / todo) * 100)}%`, height: "100%", background: cor }} />
    </div>
  );

  return (
    // `data-tela` é para o teste conseguir apontar para DENTRO desta tela. A
    // lista de conversas, lá atrás, também tem um botão escrito "Tudo", e sem
    // uma âncora o teste clicava naquele e concluía que o filtro de período
    // não funcionava.
    <div data-tela="painel"
         style={{ position: "fixed", inset: 0, background: C.headerBar, color: C.textPrimary, zIndex: 200, overflowY: "auto" }}>
      {/* `flexWrap` para o celular: sem ele os quatro períodos espremiam o
          título até "7 dias" quebrar em duas linhas dentro do próprio botão. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", flexWrap: "wrap",
                    background: C.panel, borderBottom: `1px solid ${C.divider}`, position: "sticky", top: 0, zIndex: 2 }}>
        <button onClick={aoFechar} title="Voltar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
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
        {!!erro && (
          <div style={{ ...cartao, borderColor: "#e5573f", color: "#e5573f" }}>
            Não consegui ler as mensagens: {erro}
          </div>
        )}

        {!carregando && !erro && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              <div style={cartao}><div style={rotulo}>Recebidas</div><div style={valor}>{numero(dados.recebidas)}</div></div>
              <div style={cartao}><div style={rotulo}>Enviadas</div><div style={valor}>{numero(dados.enviadas)}</div></div>
              <div style={cartao}><div style={rotulo}>Total trocado</div><div style={valor}>{numero(dados.total)}</div></div>
              {/* Notas ficam à parte, e não somadas: elas nunca saíram daqui. */}
              <div style={cartao}><div style={rotulo}>Notas internas</div>
                <div style={{ ...valor, color: C.textSecondary }}>{numero(dados.notas)}</div></div>
            </div>

            <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: "22px 0 8px" }}>Por telefone</h3>
            {dados.telefones.length === 0 && <div style={{ ...cartao, color: C.textSecondary }}>Nenhuma mensagem no período.</div>}
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
            <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
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

            {dados.semId > 0 && (
              <div style={{ ...cartao, marginTop: 12, fontSize: 13, color: C.textSecondary, lineHeight: 1.55 }}>
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
