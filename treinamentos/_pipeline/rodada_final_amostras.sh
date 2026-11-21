#!/bin/bash
# Rodada final das amostras de voz, com a máquina livre (mede a velocidade sem interferência).
cd /tmp/claude-0/-home-user-willmix/0766eccb-dd36-519d-8b6c-39bfcd75764e/scratchpad/recon/sb/w/treinamentos/_pipeline
while pgrep -f "amostras_voz.py" > /dev/null; do sleep 3; done
TREINO_SEM_CACHE=1 .venv-stt/bin/python amostras_voz.py kokoro-dora kokoro-alex kokoro-santa supertonic-f1 supertonic-m1
.venv-stt/bin/python amostras_voz.py chatterbox-dora
TREINO_SEM_CACHE=1 .venv-stt/bin/python amostras_voz.py chatterbox-embutida
