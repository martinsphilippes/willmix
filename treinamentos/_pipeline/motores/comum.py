"""Contrato comum dos motores de voz (cada um roda no próprio ambiente).

Entrada: um arquivo JSON de trabalho:
  { "voz": "...", "velocidade": 1.0, "seed": 7, "opcoes": {...},
    "itens": [ { "id": "s1", "texto": "Texto já normalizado.", "saida": "/caminho/s1.wav" } ] }
Saída: um WAV mono por item e, no stdout, uma linha JSON por item com a
duração do áudio e o tempo de síntese (para medir a velocidade na máquina).
"""
import json
import sys
import time


def carregar_trabalho():
    if len(sys.argv) < 2:
        sys.exit("uso: python motor_<nome>.py trabalho.json")
    with open(sys.argv[1], encoding="utf-8") as f:
        return json.load(f)


def relatar(item_id, duracao, tempo, **extra):
    print(json.dumps({"id": item_id, "duracao": round(duracao, 3),
                      "tempo_sintese": round(tempo, 3), **extra},
                     ensure_ascii=False), flush=True)


class Cronometro:
    def __enter__(self):
        self.t0 = time.time()
        return self

    def __exit__(self, *a):
        self.tempo = time.time() - self.t0
