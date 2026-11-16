"""Rodadas de amostras de voz entregues ao dono (ordem, rótulo e observação de cada uma)."""

RODADAS = {
    1: {
        "situacao": "Reprovada pelo dono em 14/11/2026: não soa brasileira.",
        "vozes": [
            ("A", "kokoro-dora", "Kokoro · Dora (feminina)", ""),
            ("B", "kokoro-alex", "Kokoro · Alex (masculina)", ""),
            ("C", "chatterbox-dora", "Chatterbox pt-BR · timbre feminino (lenta)", ""),
            ("C2", "chatterbox-embutida", "Chatterbox pt-BR · voz do modelo (lenta)", ""),
            ("D", "supertonic-f1", "Supertonic 3 · F1 (feminina)", ""),
            ("E", "supertonic-m1", "Supertonic 3 · M1 (masculina)", ""),
            ("F", "kokoro-santa", "Kokoro · Santa (masculina)", ""),
        ],
    },
    2: {
        "situacao": "Só vozes de falantes brasileiros ou de modelos treinados com leitura brasileira.",
        "vozes": [
            ("1", "piper-faber", "Piper · Faber (masculina)",
             "Voz treinada com gravações de um brasileiro. Muito rápida de gerar."),
            ("2", "piper-cadu", "Piper · Cadu (masculina)",
             "Outro falante brasileiro. Muito rápida de gerar."),
            ("3", "chatterbox-faber", "Chatterbox pt-BR com o timbre do Faber (masculina)",
             "Modelo mais expressivo, ajustado para o português do Brasil. Lento sem placa de vídeo."),
            ("4", "chatterbox-cadu", "Chatterbox pt-BR com o timbre do Cadu (masculina)",
             "O mesmo modelo, com o outro timbre. Lento sem placa de vídeo."),
            ("5", "chatterbox-feminina", "Chatterbox pt-BR com timbre feminino",
             "Timbre feminino sintético; o sotaque vem só do modelo brasileiro. Lento sem placa de vídeo."),
            ("6", "parler-sophia", "Parler-TTS · Sophia (feminina)",
             "Treinado com leituras de livros em português. Errou várias palavras e a marca; lento."),
            ("7", "parler-nicholas", "Parler-TTS · Nicholas (masculina)",
             "Treinado com leituras de livros em português. Errou a marca; lento."),
        ],
    },
}
