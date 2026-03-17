import ollama
from transformers import AutoTokenizer

MODEL = "qwen2.5-coder:7b"
HF_MODEL = "Qwen/Qwen2.5-Coder-7B"

TEMPERATURE = 1.2
TOP_P = 0.93
TOP_K = 65
MAX_TOKENS = 100
REPEAT_PENALTY = 1.2
SEED = -1

prompt_base = "maria é uma pessoa muito "

print("Carregando tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(HF_MODEL)


input_ids = tokenizer.encode(prompt_base)
tokens = [tokenizer.decode([tid]) for tid in input_ids]

print(f"\nPrompt: '{prompt_base}'")
print(f"Tokens ({len(tokens)}):")
for tid, tok in zip(input_ids, tokens):
    print(f"  {tid:>6}  →  {repr(tok)}")


for i in range(1, 4):
    response = ollama.generate(
        model=MODEL,
        prompt=prompt_base,
        system="Complete a frase com 3 adjetivos positivos separados por vírgula. Responda APENAS com os adjetivos, sem explicações, sem ponto final, sem repetir o início da frase.",
        options={
            "temperature":    TEMPERATURE,
            "top_p":          TOP_P,
            "top_k":          TOP_K,
            "num_predict":    MAX_TOKENS,
            "repeat_penalty": REPEAT_PENALTY,
            "seed":           SEED,
            "stop":           [".", "\n\n", "Maria", "maria"],
        }
    )

    resultado = response['response'].strip()

  
    out_ids = tokenizer.encode(resultado)
    out_tokens = [tokenizer.decode([tid]) for tid in out_ids]

    print(f"\nOpção {i}:")
    print(f"  Texto  : maria é uma pessoa muito {resultado}")
    print(f"  Tokens ({len(out_tokens)}): {out_tokens}")
    print(f"  IDs    : {out_ids}")
   
