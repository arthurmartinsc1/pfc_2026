from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

MODEL_ID = "Qwen/Qwen2.5-Coder-3B"

PROMPT_BASE = (
    "Texto informativo em português. Continue de forma curta e plausível; "
    "não invente nomes próprios, números ou datas específicas.\n\n"
)

MAX_NEW_TOKENS = 48
TEMPERATURE = 0.35
TOP_P = 0.85
TOP_K = 25
REPETITION_PENALTY = 1.12


def completar(frase: str, modelo=None, tokenizer=None) -> str:
    if modelo is None or tokenizer is None:
        raise ValueError("Modelo e tokenizer devem ser carregados antes.")

    texto_entrada = PROMPT_BASE + frase.strip()
    inputs = tokenizer(texto_entrada, return_tensors="pt").to(modelo.device)
    outputs = modelo.generate(
        **inputs,
        max_new_tokens=MAX_NEW_TOKENS,
        temperature=TEMPERATURE,
        top_p=TOP_P,
        top_k=TOP_K,
        repetition_penalty=REPETITION_PENALTY,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )

    generated = outputs[0][inputs.input_ids.shape[1] :]
    texto = tokenizer.decode(generated, skip_special_tokens=True).strip()

    for sep in (". ", "! ", "? "):
        if sep in texto:
            texto = texto.split(sep)[0] + sep[0]
            break
    return texto


def main():
    device = (
        "mps" if torch.backends.mps.is_available()
        else "cuda" if torch.cuda.is_available()
        else "cpu"
    )
    print(f"Device: {device}\n")

   
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID)
    model = model.to(device)
    model.eval()

    frases = [
        "O governo federal anunciou um novo",
        "A taxa de desemprego no Brasil",
        "Pesquisadores brasileiros desenvolveram",
    ]

    for frase in frases:
        print(f"Prompt: '{frase}'")
        completado = completar(frase, model, tokenizer)
        print(f"Completado: '{frase} {completado}'\n")


if __name__ == "__main__":
    main()
