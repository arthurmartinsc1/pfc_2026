from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

HF_MODEL = "Qwen/Qwen2.5-Coder-3B"
_BASE = Path(__file__).resolve().parent
ADAPTER = str(_BASE / "modelo-finetuned")

PROMPT_BASE = (
    "Texto informativo em português. Continue de forma curta e plausível; "
    "não invente nomes próprios, números ou datas específicas.\n\n"
)

MAX_NEW_TOKENS = 48
TEMPERATURE = 0.35
TOP_P = 0.85
TOP_K = 25
REPETITION_PENALTY = 1.12

device = "cpu"

print("Carregando modelo + adapter...")
tokenizer = AutoTokenizer.from_pretrained(HF_MODEL)
model = AutoModelForCausalLM.from_pretrained(HF_MODEL, torch_dtype=torch.float32)
model = PeftModel.from_pretrained(model, ADAPTER)
model = model.float()
model = model.to(device).eval()


def montar_prompt(fragmento: str) -> str:
    return PROMPT_BASE + fragmento.strip()


def completar(fragmento: str) -> str:
    prompt = montar_prompt(fragmento)
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=True,
            temperature=TEMPERATURE,
            top_p=TOP_P,
            top_k=TOP_K,
            repetition_penalty=REPETITION_PENALTY,
            pad_token_id=tokenizer.eos_token_id,
        )
    gerado = output[0][inputs["input_ids"].shape[-1]:]
    texto = tokenizer.decode(gerado, skip_special_tokens=True).strip()
    for sep in (". ", "! ", "? "):
        if sep in texto:
            texto = texto.split(sep)[0] + sep[0]
            break
    return texto


prompts = [
    "O governo federal anunciou um novo",
    "A taxa de desemprego no Brasil",
    "Pesquisadores brasileiros desenvolveram",
]

for p in prompts:
    print(f"\nFragmento: {p}")
    saida = completar(p)
    print(f"Saída    : {p} {saida}")
