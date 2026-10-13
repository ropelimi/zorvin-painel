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
//
//  O BOTÃO É A ÁREA DE TOQUE, E A PÍLULA É UM DESENHO DENTRO DELE (13/10). No
//  celular uma regra da tela força todo botão a 40px de altura — o alvo de
//  dedo —, e a chave, que era o próprio botão de 40×22, virava um CÍRCULO de
//  40×40 com a bolinha branca solta no alto: não se via mais se estava ligada.
//  Acontecia em toda tela com chave (Fora do horário, Avisos, a equipe sem
//  Vantoro), e apareceu na aba Distribuição, que tem uma por linha. Agora o
//  botão cresce e a pílula fica do tamanho dela, no meio — o dedo ganha os 40
//  e o olho continua vendo uma chave.
// ============================================================
export function Chave({ ligada, aoTrocar, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-label={rotulo}
            onClick={aoTrocar}
            style={{
              flexShrink: 0, cursor: "pointer", border: "none", padding: 0, background: "transparent",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
      <span data-pilula-da-chave style={{
        display: "block", width: 40, height: 22, borderRadius: 20, position: "relative",
        background: ligada ? "#2e9e6b" : "#6b7280", transition: "background .15s",
      }}>
        <span style={{
          position: "absolute", top: 3, left: ligada ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left .15s",
        }} />
      </span>
    </button>
  );
}
