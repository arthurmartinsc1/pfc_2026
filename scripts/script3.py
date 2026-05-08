from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

HF_MODEL = "Qwen/Qwen2.5-Coder-7B"
TEMPERATURE = 1.2
TOP_P = 0.93
TOP_K = 65
MAX_NEW_TOKENS = 100

prompt_base = "maria é uma pessoa muito "

# Device: mps no Mac M4, cuda se tiver GPU, senão cpu
device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)
print(f"Usando device: {device}")

print("Carregando tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(HF_MODEL)

print("Carregando modelo...")
model = AutoModelForCausalLM.from_pretrained(
    HF_MODEL,
    torch_dtype=torch.float16,  # float16 economiza memória
    device_map=device,
)

# Tokenização do prompt
input_ids = tokenizer.encode(prompt_base, return_tensors="pt").to(device)
tokens = [tokenizer.decode([tid]) for tid in input_ids[0]]

print(f"\nPrompt: '{prompt_base}'")
print(f"Tokens ({len(tokens)}):")
for tid, tok in zip(input_ids[0].tolist(), tokens):
    print(f"  {tid:>6}  →  {repr(tok)}")

# Geração
for i in range(1, 4):
    output = model.generate(
        input_ids,
        max_new_tokens=MAX_NEW_TOKENS,
        temperature=TEMPERATURE,
        top_p=TOP_P,
        top_k=TOP_K,
        repetition_penalty=1.2,
        do_sample=True,
    )

    # Pega só os tokens gerados (sem o prompt)
    generated_ids = output[0][input_ids.shape[-1]:]
    resultado = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()

    out_tokens = [tokenizer.decode([tid]) for tid in generated_ids.tolist()]

    print(f"\nOpção {i}:")
    print(f"  Texto  : maria é uma pessoa muito {resultado}")
    print(f"  Tokens ({len(out_tokens)}): {out_tokens}")
    print(f"  IDs    : {generated_ids.tolist()}")