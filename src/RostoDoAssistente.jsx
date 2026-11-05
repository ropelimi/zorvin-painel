import { useId } from "react";

// O ROSTO DO QUAZAR (05/11), o assistente oficial do Zorvin: um pato malandro,
// de óculos escuros e topete, de frente. Ver "O Quazar" no CLAUDE.md.
//
// O DESENHO É DE FRENTE E SIMÉTRICO, e as duas lentes são o MESMO caminho,
// espelhado em x = 120 (o Rodrigo reprovou o desenho de três quartos, que
// deixava uma lente maior que a outra). Quem gerou os caminhos foi um script,
// e não a mão: mexer numa lente sem mexer na outra é o defeito de volta.
//
// OS IDS DOS GRADIENTES LEVAM O useId: o rosto aparece mais de uma vez na
// mesma tela (o do botão e o do quadro do resumo), e dois gradientes com o
// mesmo id fariam o segundo rosto pintar com as cores do primeiro — ou com
// nenhuma, quando o primeiro sai da tela. A prova confere que não há id
// repetido, e que esconder um rosto não tira a cor do outro.
//
// NÃO TEM NOME ACESSÍVEL PRÓPRIO (aria-hidden): quem o usa é um botão que já
// diz o que faz. Sozinho, ele passa `titulo`.

/** O rosto, quadrado: `tamanho` em pixels. */
export function RostoDoAssistente({ tamanho = 24, titulo = null, style = null }) {
  const p = "zq" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg data-rosto-do-assistente viewBox="0 0 240 240" width={tamanho} height={tamanho}
         role={titulo ? "img" : undefined} aria-label={titulo || undefined} aria-hidden={titulo ? undefined : true}
         focusable="false" style={{ flexShrink: 0, display: "block", ...(style || {}) }}>
      <defs>
      <linearGradient id={`${p}cab`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#1FC79A"/>
      <stop offset="1" stopColor="#0A7A5C"/>
      </linearGradient>
      <linearGradient id={`${p}lente`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#3A444C"/>
      <stop offset="1" stopColor="#0B0E10"/>
      </linearGradient>
      <linearGradient id={`${p}bico`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#FFD45E"/>
      <stop offset="1" stopColor="#F3A21A"/>
      </linearGradient>
      <linearGradient id={`${p}peito`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#BE6A31"/>
      <stop offset="1" stopColor="#8E4419"/>
      </linearGradient>
      </defs>
      <path d="M62 240 C60 222 76 208 96 204 L144 204 C164 208 180 222 178 240 Z" fill={`url(#${p}peito)`} stroke="#5E2E10" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M78 206 C100 214 140 214 162 206 L160 194 C138 202 102 202 80 194 Z" fill="#F8F6F0" stroke="#9A958A" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M86 62 C78 30 108 8 146 14 C168 18 178 34 170 46 C160 36 140 34 126 44 C118 50 112 58 108 66 Z" fill="#0B6B53" stroke="#073F33" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M104 46 C116 30 138 24 154 28" fill="none" stroke="#2FD9A8" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
      <ellipse cx="120" cy="124" rx="88" ry="82" fill={`url(#${p}cab)`} stroke="#073F33" strokeWidth="6"/>
      <path d="M54 92 C62 66 84 50 110 46" fill="none" stroke="#7FF0CF" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" opacity="0.7"/>
      <path d="M66 84 C78 78 92 77 104 80" fill="none" stroke="#073F33" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M136 76 C148 70 162 69 174 73" fill="none" stroke="#073F33" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M50 102 L112 102 L110 124 C109 136 101 142 89 142 L71 142 C59 142 51 136 50 124 Z" fill={`url(#${p}lente)`} stroke="#111417" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M 190 102 L 128 102 L 130 124 C 131 136 139 142 151 142 L 169 142 C 181 142 189 136 190 124 Z" fill={`url(#${p}lente)`} stroke="#111417" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M44 100 L196 100" fill="none" stroke="#111417" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M112 108 C116 104 124 104 128 108" fill="none" stroke="#111417" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M66 110 L58 132 M78 110 L70 132" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" opacity="0.55"/>
      <path d="M144 110 L136 132 M156 110 L148 132" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" opacity="0.55"/>
      <path d="M80 154 C98 144 142 144 160 154 C174 162 174 178 162 186 C146 196 94 196 78 186 C66 178 66 162 80 154 Z" fill={`url(#${p}bico)`} stroke="#9C620C" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"/>
      <ellipse cx="106" cy="160" rx="4" ry="2.6" fill="#9C620C"/>
      <ellipse cx="134" cy="160" rx="4" ry="2.6" fill="#9C620C"/>
      <path d="M86 180 C104 187 130 187 150 179 C156 176 160 172 162 166" fill="none" stroke="#9C620C" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M94 192 C108 201 132 201 146 192 C144 204 132 210 120 210 C108 210 96 204 94 192 Z" fill="#E38E14" stroke="#9C620C" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}
