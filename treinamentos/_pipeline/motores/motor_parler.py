"""Parler-TTS Mini Multilingual v1.1 (Apache-2.0, código e pesos).

Treinado com leituras em português (CML-TTS, LibriVox). A voz é escolhida por nome
e descrição em texto: em português, "Sophia" e "Nicholas" são falantes consistentes.
"""
import warnings
warnings.filterwarnings("ignore")
import soundfile as sf
import torch
from comum import Cronometro, carregar_trabalho, relatar
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer

trab = carregar_trabalho()
op = trab.get("opcoes", {})
torch.set_num_threads(int(op.get("threads", 4)))
REPO = "parler-tts/parler-tts-mini-multilingual-v1.1"
modelo = ParlerTTSForConditionalGeneration.from_pretrained(REPO).to("cpu")
tok = AutoTokenizer.from_pretrained(REPO)
tok_desc = AutoTokenizer.from_pretrained(modelo.config.text_encoder._name_or_path)
descricao = op.get("descricao") or (
    f"{trab['voz']}'s voice is warm, friendly and clear, with natural intonation and a moderate pace. "
    "The recording is of very high quality, very close up, with no background noise.")
desc_ids = tok_desc(descricao, return_tensors="pt")
for i, item in enumerate(trab["itens"]):
    torch.manual_seed(int(trab.get("seed", 7)) + i)
    with Cronometro() as c, torch.inference_mode():
        prompt = tok(item["texto"], return_tensors="pt")
        g = modelo.generate(input_ids=desc_ids.input_ids, attention_mask=desc_ids.attention_mask,
                            prompt_input_ids=prompt.input_ids, prompt_attention_mask=prompt.attention_mask)
        a = g.cpu().numpy().squeeze()
    sf.write(item["saida"], a, modelo.config.sampling_rate, subtype="PCM_16")
    relatar(item["id"], len(a) / modelo.config.sampling_rate, c.tempo)
