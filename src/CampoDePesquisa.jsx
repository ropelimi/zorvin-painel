import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

// ============================================================
//  O CAMPO DE PESQUISA DOS MENUS — uma definição, vários lugares (23/10)
//
//  As etiquetas da seta, o "Marcar tags" e o "Assumir" da conversa, o filtro
//  de quem participou e as listas de Configurações. Um desenho só, pela razão
//  de `Chave.jsx`: cópias divergem no primeiro conserto, e aqui divergir é o
//  Esc apagar o que foi escrito num menu e fechar o menu no outro.
//
//  A conta de "este item casa?" não mora aqui: é `pesquisaNosMenus.js`, para a
//  prova poder conferi-la sem navegador.
// ============================================================

/** Guarda o que foi escrito ENQUANTO O MENU ESTÁ ABERTO, e nada mais.
 *
 *  Ela mora dentro do menu, e não no painel: fechado o menu, ela vai junto, e
 *  o menu reabre com a lista inteira. Guardada no painel, a pesquisa de
 *  "minuta" de dez minutos atrás reabriria o menu mostrando uma etiqueta só —
 *  e quem não se lembra de ter escrito aquilo pensa que as outras sumiram. */
export function ComPesquisa({ children }) {
  const [pesquisa, setPesquisa] = useState("");
  return children(pesquisa, setPesquisa);
}

export default function CampoDePesquisa({ C, valor, aoMudar, rotulo = "Pesquisar", focar = false, nome }) {
  const ref = useRef(null);

  // O CURSOR JÁ VEM NO CAMPO, mas só no computador (quem chama decide, com
  // `focar`). No celular, pôr o cursor ali abre o teclado, que cobre metade da
  // tela — e quem abriu o menu para tocar na primeira etiqueta da lista não
  // pediu teclado nenhum.
  //
  // `preventScroll` porque o menu já está onde deve: focar sem ele pode rolar
  // a lista de conversas lá atrás para "mostrar" o campo.
  useEffect(() => {
    if (focar && ref.current) ref.current.focus({ preventScroll: true });
  }, [focar]);

  return (
    <div data-campo-de-pesquisa={nome}
         style={{ display: "flex", alignItems: "center", gap: 6, background: C.searchBg,
                  borderRadius: 8, padding: "0 4px 0 9px" }}>
      <Search size={15} color={C.textSecondary} style={{ flexShrink: 0 }} aria-hidden="true" />
      <input ref={ref} type="text" value={valor} placeholder={rotulo} aria-label={rotulo}
             autoComplete="off" spellCheck={false}
             onChange={(e) => aoMudar(e.target.value)}
             onKeyDown={(e) => {
               // O PRIMEIRO ESC APAGA O QUE FOI ESCRITO; só o segundo fecha o
               // menu. É o que fazem os campos de pesquisa de todo lugar — e,
               // sem isto, quem escreveu "minta" e quer começar de novo perde o
               // menu inteiro, que é a escada do Esc do painel (ela ouve a
               // janela, e o `stopPropagation` daqui chega antes dela).
               if (e.key === "Escape" && valor) { e.stopPropagation(); aoMudar(""); }
             }}
             style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
                      color: C.textPrimary, fontSize: 13.5, padding: "8px 0" }} />
      {valor && (
        <button type="button" data-limpar-pesquisa aria-label="Limpar a pesquisa" title="Limpar a pesquisa"
                onClick={() => { aoMudar(""); if (ref.current) ref.current.focus({ preventScroll: true }); }}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textSecondary,
                         display: "flex", alignItems: "center", justifyContent: "center", padding: 5, flexShrink: 0 }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
