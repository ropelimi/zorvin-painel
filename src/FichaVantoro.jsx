// ============================================================
//  FICHA DO CLIENTE (VANTORO) — dentro do atendimento
//
//  Mostra e edita o cadastro do cliente sem sair da conversa.
//  O caminho é: painel -> ponte (zorvin-bridge) -> Vantoro.
//  A ponte é quem guarda o token do Vantoro; aqui mandamos apenas a
//  sessão do Zorvin (o mesmo login que o atendente já fez).
// ============================================================
import { useEffect, useState } from "react";
import { X, Save, UserPlus, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "./supabase";

const BRIDGE_URL = (import.meta.env.VITE_BRIDGE_URL || "").replace(/\/$/, "");

// Aviso exibido quando o painel foi publicado sem saber o endereco da ponte.
// Detalhe importante: o Vite grava as variaveis VITE_* dentro do arquivo final
// no momento do build. Preencher a variavel na Render nao basta — precisa de um
// deploy novo depois, senao o painel continua com o valor vazio de antes.
const FALTA_PONTE =
  "Falta a variável VITE_BRIDGE_URL no painel. Preencha em " +
  "Render → zorvin-painel → Environment com o endereço do zorvin-bridge e " +
  "publique o painel de novo (o Vite grava esse valor durante o build).";

// Campos que o atendente pode preencher direto daqui.
// "minusculo" força letra minúscula enquanto se digita: e-mail não diferencia
// maiúscula de minúscula, e guardar tudo igual evita cadastro duplicado e
// busca que não acha. O Vantoro faz o mesmo do lado dele, por garantia.
const CAMPOS = [
  // CPF na frente: é por ele que o cadastro é procurado e conferido.
  { chave: "cpf", rotulo: "CPF" },
  { chave: "nome", rotulo: "Nome completo" },
  { chave: "email", rotulo: "E-mail", minusculo: true },
  { chave: "nascimento", rotulo: "Nascimento", dica: "DD/MM/AAAA", data: true },
  { chave: "ocupacao", rotulo: "Profissão" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "estado", rotulo: "UF" },
  // Acessos do cliente. Ficam editáveis aqui porque quem descobre a senha é
  // quem está na conversa — obrigar a abrir o Vantoro só para isso custava
  // tempo e a senha acabava anotada em outro lugar.
  { chave: "senha_serasa", rotulo: "Senha SERASA" },
  { chave: "senha_gov", rotulo: "Senha GOV" },
];

// Vai colocando as barras enquanto se digita a data: 25121980 → 25/12/1980.
// Assim o atendente digita só os números e não erra a ordem do dia e do mês.
function mascaraData(valor) {
  const d = (valor || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Chama a ponte já com a sessão do Zorvin no cabeçalho.
async function chamarPonte(caminho, opcoes = {}) {
  if (!BRIDGE_URL) throw new Error(FALTA_PONTE);
  const { data } = await supabase.auth.getSession();
  const jwt = data?.session?.access_token;
  if (!jwt) throw new Error("Sessão expirada. Entre de novo.");

  const r = await fetch(BRIDGE_URL + caminho, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + jwt,
      ...(opcoes.headers || {}),
    },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || "Não consegui falar com o Vantoro.");
  return corpo;
}

export default function FichaVantoro({ numero, nomeContato, C, onFechar, onAviso }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [cliente, setCliente] = useState(null);
  const [edicao, setEdicao] = useState({});
  const [salvando, setSalvando] = useState(false);

  async function buscar() {
    setCarregando(true);
    setErro("");
    try {
      const r = await chamarPonte(`/vantoro/cliente?telefone=${encodeURIComponent(numero || "")}`);
      const achado = (r.clientes && r.clientes[0]) || null;
      setCliente(achado);
      setEdicao(achado ? { ...achado } : {});
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
      onAviso && onAviso(r.criado ? "Pré-cadastro criado no Vantoro." : "Cliente já existia no Vantoro.");
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
      CAMPOS.forEach(({ chave }) => {
        if ((edicao[chave] || "") !== (cliente[chave] || "")) mudou[chave] = edicao[chave] || "";
      });
      if (!Object.keys(mudou).length) { onAviso && onAviso("Nada foi alterado."); return; }
      const r = await chamarPonte(`/vantoro/cliente/${cliente.id}`, {
        method: "PATCH",
        body: JSON.stringify(mudou),
      });
      setCliente(r.cliente);
      setEdicao({ ...r.cliente });
      onAviso && onAviso("Cadastro atualizado no Vantoro.");
    } catch (e) {
      onAviso && onAviso(e.message);
    } finally {
      setSalvando(false);
    }
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

  return (
    <div style={{
      width: 330, flex: "none", background: C.panel, borderLeft: `1px solid ${C.divider}`,
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
    }}>
      <div style={{
        background: C.headerBar, padding: "12px 16px", display: "flex",
        alignItems: "center", gap: 10, borderBottom: `1px solid ${C.divider}`,
      }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: C.textPrimary }}>Ficha do cliente</span>
        <button onClick={buscar} title="Atualizar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
          <RefreshCw size={16} color={C.textSecondary} />
        </button>
        <button onClick={onFechar} title="Fechar" style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex" }}>
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
                {cliente.ordem_servico.pendencias.length ? (
                  cliente.ordem_servico.pendencias.map((p) => (
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

            {CAMPOS.map(({ chave, rotulo: r, dica, minusculo, data }) => (
              <div key={chave} style={{ marginBottom: 10 }}>
                <label style={rotulo}>{r}{dica ? ` (${dica})` : ""}</label>
                <input style={campo} value={edicao[chave] || ""}
                       inputMode={data ? "numeric" : undefined}
                       placeholder={data ? "DD/MM/AAAA" : undefined}
                       onChange={(e) => {
                         let v = e.target.value;
                         if (data) v = mascaraData(v);
                         else if (minusculo) v = v.toLowerCase();
                         setEdicao({ ...edicao, [chave]: v });
                       }} />
              </div>
            ))}

            <button style={{ ...botao, width: "100%", marginTop: 4, opacity: salvando ? 0.6 : 1 }}
                    onClick={salvar} disabled={salvando}>
              <Save size={15} /> {salvando ? "Salvando…" : "Salvar no Vantoro"}
            </button>

            {cliente.processos?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>
                  PROCESSOS · {cliente.processos.length}
                </div>
                {cliente.processos.slice(0, 12).map((p) => (
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
              {cliente.documentos} documento(s) no cadastro.
            </div>

            {import.meta.env.VITE_VANTORO_WEB && (
              <a href={`${import.meta.env.VITE_VANTORO_WEB}/cadastro/clientes/${cliente.id}/`}
                 target="_blank" rel="noopener noreferrer"
                 style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14,
                          fontSize: 12.5, color: C.link, textDecoration: "none" }}>
                <ExternalLink size={13} /> Abrir ficha completa no Vantoro
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
