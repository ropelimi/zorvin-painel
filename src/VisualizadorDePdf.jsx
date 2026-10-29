import React, { useEffect, useRef, useState } from "react";
import { Download, X, ExternalLink, FileText, Loader2 } from "lucide-react";
import { abrirPdf, porQueNaoAbriu } from "./previaDoPdf.js";

// O PDF INTEIRO, EM TELA CHEIA (29/10) — o par da miniatura da bolha, como a
// imagem ampliada é o par da foto. Ver `src/previaDoPdf.js`.
//
// AS PÁGINAS SÃO DESENHADAS QUANDO CHEGAM PERTO DA VISTA, e apagadas quando se
// afastam. Uma página A4 desenhada na largura desta tela, numa tela de alta
// resolução, ocupa uns 18 MB de memória; um contrato de cem páginas desenhado
// inteiro ao abrir seriam quase 2 GB, e o navegador fecharia a aba. Perto da
// vista ficam três ou quatro.
//
// ENQUANTO UMA PÁGINA NÃO É DESENHADA, O LUGAR DELA JÁ TEM O TAMANHO CERTO
// (pela proporção da primeira): a barra de rolagem diz desde o começo o
// tamanho do documento, e nada pula quando as páginas chegam.
//
// O QUE NÃO ABRE É DITO, com o motivo (senha, arquivo que não é PDF, o
// depósito que respondeu outra coisa), e com as duas saídas: baixar, e abrir
// no leitor do navegador numa aba nova.
//
// NADA DE LINKS NEM DE CAMPOS CLICÁVEIS DENTRO DO PDF: a página é uma imagem
// desenhada. É um documento que chegou de fora, e um link dentro dele leva
// para onde quem o fez quis.

/** A largura máxima de uma página, em pixels da tela. */
const LARGURA_MAXIMA = 900;

/** Quanto antes de a página entrar na vista ela começa a ser desenhada — e a
 *  que distância ela é apagada. */
const PERTO = "1200px 0px";

export default function VisualizadorDePdf({ url, nome, aoBaixar, aoAbrirNumaAba, aoFechar }) {
  const [estado, setEstado] = useState("carregando");
  const [doc, setDoc] = useState(null);
  const [erro, setErro] = useState("");
  const [proporcao, setProporcao] = useState(297 / 210);
  const [largura, setLargura] = useState(0);
  const rolagem = useRef(null);

  useEffect(() => {
    let vivo = true;
    let tarefa = null;
    setEstado("carregando"); setDoc(null); setErro("");
    abrirPdf(url)
      .then((t) => {
        // A JANELA JÁ FECHOU enquanto a biblioteca chegava: a tarefa que nasce
        // agora é solta na hora. Esquecida, ela abriria o PDF para ninguém, e a
        // falha dela iria para o console como um erro sem dono.
        if (!vivo) { t.destroy().catch(() => {}); return null; }
        tarefa = t;
        return t.promise;
      })
      .then(async (d) => {
        if (!d || !vivo) return;
        const primeira = (await d.getPage(1)).getViewport({ scale: 1 });
        if (!vivo) return;
        setProporcao(primeira.height / primeira.width);
        setDoc(d);
        setEstado("pronto");
      })
      .catch((e) => {
        // O PDF QUE NÃO ABRIU É SOLTO NA HORA, e não só ao fechar a janela.
        if (tarefa) { tarefa.destroy().catch(() => {}); tarefa = null; }
        if (!vivo) return;
        console.warn("visualizador de PDF:", e && e.message);
        setErro(porQueNaoAbriu(e));
        setEstado("falhou");
      });
    // FECHAR NO MEIO DA CARGA também solta o documento: a tarefa destruída
    // cancela o que ainda está chegando.
    return () => { vivo = false; if (tarefa) tarefa.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return undefined;
    const medir = () => setLargura(Math.max(120, Math.min(LARGURA_MAXIMA, el.clientWidth - 32)));
    medir();
    const vigia = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (vigia) vigia.observe(el); else window.addEventListener("resize", medir);
    // O TECLADO JÁ ROLA O DOCUMENTO: setas, Page Down, espaço. Sem o foco aqui,
    // as teclas iriam para a caixa de escrever lá atrás.
    el.focus({ preventScroll: true });
    return () => { if (vigia) vigia.disconnect(); else window.removeEventListener("resize", medir); };
  }, []);

  // O CLIQUE NO ESCURO FECHA, como na imagem ampliada; o clique na página, não.
  function fecharSeForNoEscuro(e) {
    if (!e.target.closest("[data-pagina-do-pdf], [data-pdf-que-nao-abriu]")) aoFechar();
  }

  const botao = {
    border: "none", background: "transparent", cursor: "pointer", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    minWidth: 40, minHeight: 40, padding: 8, borderRadius: 8, flexShrink: 0, fontSize: 13,
  };

  return (
    <div data-visualizador-de-pdf={estado} role="dialog" aria-modal="true" aria-label={`PDF: ${nome}`}
         style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.9)",
                  display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px",
                    background: "rgba(0,0,0,.35)", color: "#fff", minWidth: 0 }}>
        <FileText size={20} style={{ flexShrink: 0, opacity: 0.85 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div data-nome-do-pdf style={{ fontSize: 14, fontWeight: 600, overflow: "hidden",
                                         textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={nome}>
            {nome}
          </div>
          {doc && (
            <div data-paginas-do-pdf={doc.numPages} style={{ fontSize: 12, opacity: 0.75 }}>
              {doc.numPages === 1 ? "1 página" : `${doc.numPages} páginas`}
            </div>
          )}
        </div>
        <button type="button" onClick={aoAbrirNumaAba} title="Abrir no leitor do navegador, numa aba nova"
                aria-label="Abrir numa aba nova" data-pdf-numa-aba style={botao}>
          <ExternalLink size={22} />
        </button>
        <button type="button" onClick={aoBaixar} title={`Baixar “${nome}”`} aria-label="Baixar o PDF"
                data-baixar-o-pdf style={botao}>
          <Download size={24} />
        </button>
        <button type="button" onClick={aoFechar} title="Fechar" aria-label="Fechar o PDF"
                data-fechar-o-pdf style={botao}>
          <X size={26} />
        </button>
      </div>
      <div ref={rolagem} tabIndex={-1} onClick={fecharSeForNoEscuro}
           style={{ flex: 1, minHeight: 0, overflow: "auto", outline: "none", padding: "12px 16px 32px" }}>
        {estado === "carregando" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        color: "rgba(255,255,255,.8)", fontSize: 14, marginTop: 80 }}>
            <style>{"@keyframes zv-pdf-gira { to { transform: rotate(360deg); } }"}</style>
            <Loader2 size={20} style={{ animation: "zv-pdf-gira 1s linear infinite" }} /> Abrindo o PDF…
          </div>
        )}
        {estado === "falhou" && (
          <div data-pdf-que-nao-abriu
               style={{ maxWidth: 420, margin: "80px auto 0", background: "#fff", color: "#111b21",
                        borderRadius: 10, padding: "18px 20px", fontSize: 14, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{erro}</div>
            <div style={{ color: "#54656f", marginBottom: 14 }}>
              O arquivo continua na conversa: dá para baixá-lo, ou abri-lo no leitor do navegador.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={aoBaixar}
                      style={{ ...botao, color: "#fff", background: "#00a884", padding: "8px 14px" }}>
                <Download size={16} /> Baixar
              </button>
              <button type="button" onClick={aoAbrirNumaAba}
                      style={{ ...botao, color: "#00a884", border: "1px solid #00a884", padding: "8px 14px" }}>
                <ExternalLink size={16} /> Abrir numa aba nova
              </button>
            </div>
          </div>
        )}
        {estado === "pronto" && largura > 0 && Array.from({ length: doc.numPages }, (_, i) => (
          <PaginaDoPdf key={i} doc={doc} numero={i + 1} total={doc.numPages}
                       largura={largura} proporcao={proporcao} rolagem={rolagem} />
        ))}
      </div>
    </div>
  );
}

function PaginaDoPdf({ doc, numero, total, largura, proporcao, rolagem }) {
  const caixa = useRef(null);
  const tela = useRef(null);
  // O DESENHO ANTERIOR TEM DE TERMINAR antes do próximo começar na mesma tela:
  // o pdf.js recusa dois desenhos numa tela só, e trocar a largura da janela
  // pede um desenho novo com o velho ainda em curso.
  const anterior = useRef(Promise.resolve());
  const [perto, setPerto] = useState(false);
  const [estado, setEstado] = useState("esperando");
  // A PROPORÇÃO DESTA PÁGINA, sabida depois do primeiro desenho; antes dele,
  // vale a da primeira página (quase todo documento tem as páginas iguais).
  const [aspecto, setAspecto] = useState(null);
  const altura = Math.round(largura * (aspecto || proporcao));

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") { setPerto(true); return undefined; }
    const vigia = new IntersectionObserver((vistos) => {
      for (const v of vistos) setPerto(v.isIntersecting);
    }, { root: rolagem.current, rootMargin: PERTO });
    vigia.observe(el);
    return () => vigia.disconnect();
  }, [rolagem]);

  useEffect(() => {
    const c = tela.current;
    if (!c) return undefined;
    if (!perto) {
      // LONGE DA VISTA, A PÁGINA É APAGADA: a tela de pintura volta a zero, e
      // a memória dela volta para o navegador. O lugar fica, com o tamanho.
      c.width = 0; c.height = 0;
      setEstado("esperando");
      return undefined;
    }
    let vivo = true;
    let desenho = null;
    const vez = anterior.current.catch(() => {}).then(async () => {
      if (!vivo) return;
      setEstado("desenhando");
      const pagina = await doc.getPage(numero);
      if (!vivo) return;
      const base = pagina.getViewport({ scale: 1 });
      const densidade = Math.min(2, window.devicePixelRatio || 1);
      const viewport = pagina.getViewport({ scale: (largura * densidade) / base.width });
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      setAspecto(base.height / base.width);
      desenho = pagina.render({ canvas: c, viewport, background: "#fff" });
      await desenho.promise;
      if (vivo) setEstado("pronta");
    }).catch((e) => {
      if (vivo && !(e && e.name === "RenderingCancelledException")) {
        console.warn(`visualizador de PDF: a página ${numero} não desenhou`, e && e.message);
        setEstado("falhou");
      }
    });
    anterior.current = vez;
    return () => { vivo = false; if (desenho) desenho.cancel(); };
  }, [perto, doc, numero, largura]);

  return (
    <div ref={caixa} data-pagina-do-pdf={numero} data-estado={estado}
         aria-label={`Página ${numero} de ${total}`}
         style={{ position: "relative", width: largura, height: altura, margin: "0 auto 14px",
                  background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,.45)" }}>
      <canvas ref={tela} style={{ display: "block", width: "100%", height: "100%" }} />
      {estado === "falhou" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                      color: "#54656f", fontSize: 13, padding: 20, textAlign: "center" }}>
          Não consegui desenhar a página {numero}. Baixe o arquivo para ver esta página.
        </div>
      )}
      <span style={{ position: "absolute", right: 8, bottom: 6, fontSize: 11, color: "#fff",
                     background: "rgba(0,0,0,.45)", borderRadius: 4, padding: "1px 6px" }}>
        {numero} / {total}
      </span>
    </div>
  );
}
