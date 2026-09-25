// ============================================================
//  A CHAVE DE LIGA E DESLIGA — uma definição, dois lugares
//
//  Ela nasceu dentro de `Departamentos.jsx`, para "Administra o Zorvin" e
//  "Conta ativa". A tela de Avisos precisou da mesma coisa, e copiar seria
//  plantar a próxima divergência — é a mesma razão pela qual `numeros.js`
//  saiu de dentro do painel quando a ficha do cliente precisou das mesmas
//  contas de telefone.
//
//  `role="switch"` e `aria-checked` NÃO são enfeite: sem eles, quem usa leitor
//  de tela ouve "botão" e não fica sabendo se a coisa está ligada ou desligada
//  — que é a única informação que esta peça existe para dar.
// ============================================================
export function Chave({ ligada, aoTrocar, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-label={rotulo}
            onClick={aoTrocar}
            style={{
              width: 40, height: 22, borderRadius: 20, flexShrink: 0, cursor: "pointer",
              border: "none", padding: 0, position: "relative",
              background: ligada ? "#2e9e6b" : "#6b7280",
              transition: "background .15s",
            }}>
      <span style={{
        position: "absolute", top: 3, left: ligada ? 21 : 3, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left .15s",
      }} />
    </button>
  );
}
