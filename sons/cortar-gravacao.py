"""OS AVISOS QUE SÃO GRAVAÇÃO — como cada arquivo foi feito, para poder refazer.

Em 02/10 o Rodrigo mandou quatro gravações e pediu que fossem elas:

    python3 sons/cortar-gravacao.py galinha001.mp3 public/avisos/galinha.wav
    python3 sons/cortar-gravacao.py gato001.mp3    public/avisos/gato.wav
    python3 sons/cortar-gravacao.py assobio.mp3    public/avisos/assobio.wav
    python3 sons/cortar-gravacao.py cachorro001.mp3 public/avisos/cachorro.wav

(O assobio e o cachorro vieram depois, do mesmo jeito: limpos, os dois
lados iguais, 24 kHz.)

(pip install numpy scipy soundfile)

A galinha substitui o "pó" cortado do clipe "Pó Pó Pó" (01/10), que ele não
aprovou — nem do jeito que estava, nem em três versões mais agudas. O gato
substitui o miado que eu tinha sintetizado e ele reprovou.

O QUE SE FAZ COM ELAS É POUCO, e de propósito: as duas vêm limpas (o fundo
está 70–80 dB abaixo do som, sem música) e são o som que ELE escolheu. Mexer
no timbre seria trocar o som dele por um palpite meu, e quem escreve isto não
ouve.

  - fica o som INTEIRO: as duas partes do cacarejo ("có" e "cóóó"), e o
    miado desde o "m" baixinho do começo;
  - sai só o silêncio das pontas, medido em relação ao trecho mais alto DO
    PRÓPRIO arquivo — o gato veio gravado bem mais baixo que a galinha, e uma
    régua fixa cortaria o "m" dele;
  - estéreo vira mono (nas duas, os dois lados são idênticos);
  - 24 kHz vira 22,05 kHz, a taxa dos outros avisos.

Os arquivos originais NÃO estão no repositório — só o que o painel toca.

O VOLUME NÃO É DAQUI: o arquivo sai normalizado (pico 0,95) e o painel toca
com o `volume` de `src/avisos.js`, medido pela prova `o-volume-dos-avisos`
para ficar na altura do pato. Refeito um arquivo, refaça essa conta.
"""
import sys
from fractions import Fraction
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

entrada, saida = sys.argv[1], sys.argv[2]
x, sr = sf.read(entrada, always_2d=True)
v = x.mean(1)

# AS PONTAS são medidas em janelas de 2 ms: começa 5 ms antes da primeira a
# menos de 32 dB do trecho mais alto, e termina 10 ms depois da última — o
# começo inteiro (o "có", o "m" do miado) e a cauda sem corte seco.
w = int(0.002 * sr)
n = len(v) // w
db = 20 * np.log10(np.sqrt((v[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-12)
vivas = np.nonzero(db > db.max() - 32)[0]
ini = max(0, vivas[0] * w - int(0.005 * sr))
fim = min(len(v), (vivas[-1] + 1) * w + int(0.010 * sr))
c = v[ini:fim]

r = 22050
q = Fraction(r, sr).limit_denominator(1000)
c = resample_poly(c, q.numerator, q.denominator)
N = len(c)
env = np.ones(N)
a = int(0.003 * r)
env[:a] = np.linspace(0, 1, a)          # sem estalo no começo
f = int(0.015 * r)
env[N - f:] = np.linspace(1, 0, f)       # nem no fim
c = c * env
c = c - c.mean()
c = c * 0.95 / np.abs(c).max()
sf.write(saida, c, r, subtype="PCM_16")
print(f"{saida}: {N / r * 1000:.0f} ms, de {ini / sr:.3f} s a {fim / sr:.3f} s da gravação")
