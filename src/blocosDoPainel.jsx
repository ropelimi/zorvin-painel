// OS BLOCOS DAS TELAS DE NÚMEROS — o título de seção e o envelope de um
// gráfico, numa escrita só. Moravam dentro de `PainelNumeros.jsx`; a Visão
// geral (05/11) também os usa, e uma segunda cópia divergiria da primeira no
// primeiro conserto.
import { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";

export function Titulo({ C, children, primeiro = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: primeiro ? "2px 0 10px" : "28px 0 10px" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>{children}</h3>
      <div style={{ flex: 1, height: 1, background: C.divider }} />
    </div>
  );
}

/* ================================================================
   O ENVELOPE DE UM GRÁFICO — legenda e botão de tabela
   ================================================================
   TODO gráfico tem sua tabela. Não é enfeite de acessibilidade: é o que
   permite conferir o desenho, copiar para uma planilha, e ler a tela sem
   depender de distinguir verde de azul. */
export function Grafico({ C, estilos, legenda, colunas, linhas, desenho, vazio, rodape, titulo = null, atributos = null }) {
  const [tabela, setTabela] = useState(false);
  // `titulo` e `atributos` são da Visão geral (05/11): o nome do gráfico
  // dentro do cartão, e as marcas `data-` que as provas procuram. Sem eles,
  // o envelope é o de sempre.
  return (
    <div style={estilos.cartao} {...(atributos || {})}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        {titulo && <div style={{ fontSize: 14, fontWeight: 700, flex: "1 1 auto", minWidth: 0 }} data-titulo-do-grafico>{titulo}</div>}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: titulo ? "0 1 auto" : "1 1 auto" }}>
          {(legenda || []).map((l) => (
            <span key={l.nome} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.textSecondary }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.cor }} /> {l.nome}
            </span>
          ))}
        </div>
        <button onClick={() => setTabela((v) => !v)} title={tabela ? "Ver o gráfico" : "Ver os números"} data-nao-imprime
          style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 30, padding: "4px 10px",
                   border: `1px solid ${C.divider}`, background: "transparent", color: C.textSecondary,
                   borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {tabela ? <BarChart3 size={13} /> : <Table2 size={13} />} {tabela ? "Gráfico" : "Tabela"}
        </button>
      </div>

      {vazio && <div style={{ ...estilos.nota, padding: "18px 0" }}>Nada neste período.</div>}
      {!vazio && !tabela && desenho()}

      {!vazio && tabela && (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{colunas.map((c, i) => <th key={c} style={i ? estilos.thNum : estilos.th}>{c}</th>)}</tr></thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>{l.map((v, j) => <td key={j} style={j ? estilos.num : estilos.td}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rodape && <div style={{ ...estilos.nota, marginTop: 12 }}>{rodape}</div>}
    </div>
  );
}
