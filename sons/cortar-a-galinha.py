"""A GALINHA DO AVISO (01/10) — como o "pó" foi feito, para poder refazer.

O Rodrigo mandou um trecho de 4,45 s do clipe "Pó Pó Pó" e pediu um "pó" só,
e depois SÓ A VOZ, sem a música de fundo. O arquivo inteiro NÃO está no
repositório — só os 300 ms que o painel toca.

PASSO 1 — TIRAR A MÚSICA, com um separador de voz (o modelo é baixado do
GitHub na primeira vez):

    pip install "audio-separator[cpu]" imageio-ffmpeg soundfile scipy
    # o separador chama `ffmpeg`; o imageio-ffmpeg traz um pronto
    audio-separator trecho.wav -m Kim_Vocal_2.onnx --output_format WAV

Filtro não serve: a voz e a música ocupam as mesmas frequências, e tirar as
notas da música tiraria a voz junto. O separador devolve duas faixas.

PASSO 2 — CORTAR O "PÓ", com este arquivo:

    python3 sons/cortar-a-galinha.py "trecho_(Vocals)_Kim_Vocal_2.wav" public/avisos/galinha.wav

Fica o "pó" de 0,91 s: dos sete da faixa da voz, é o que tinha mais voz e
menos música no original (63%) e que começa depois de silêncio. O "ó" grave
que se alterna com ele no clipe NÃO é a galinha — é instrumento, e foi
inteiro para a faixa da música.

O VOLUME NÃO É DAQUI: o arquivo sai normalizado (pico 0,95) e o painel toca
com o `volume` de `src/avisos.js`, medido pela prova `o-volume-dos-avisos`
para ficar na altura do pato. Refeito o arquivo, refaça essa conta.
"""
import sys
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

voz, saida = sys.argv[1], sys.argv[2]
x, sr = sf.read(voz, always_2d=True)
v = x.mean(1)  # a voz fica no centro: a média dos dois lados não perde nada

# O COMEÇO é medido, e não escrito à mão: a primeira janela de 1 ms acima de
# -40 dB depois de 0,88 s, menos 4 ms — o "p" inteiro, sem silêncio antes.
w = int(0.001 * sr)
a0 = int(0.88 * sr)
trecho = v[a0:a0 + int(0.1 * sr)]
n = len(trecho) // w
db = 20 * np.log10(np.sqrt((trecho[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-9)
k = next(i for i in range(n) if db[i] > -40)
ini = a0 + k * w - int(0.004 * sr)

c = v[ini:ini + int(0.30 * sr)]
c = resample_poly(c, 1, 2)  # 44,1 kHz -> 22,05 kHz: metade do tamanho, e sobra
r = sr // 2
N = len(c)
env = np.ones(N)
a = int(0.003 * r)
env[:a] = np.linspace(0, 1, a)          # sem estalo no começo
f = int(0.10 * r)
env[N - f:] = np.linspace(1, 0, f) ** 2  # o rabo do "ó" morre, sem corte seco
c = c * env
c = c - c.mean()
c = c * 0.95 / np.abs(c).max()
sf.write(saida, c, r, subtype="PCM_16")
print(f"{saida}: {N / r * 1000:.0f} ms, começa em {ini / sr:.3f} s do trecho")
