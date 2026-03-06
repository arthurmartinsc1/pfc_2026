import ollama

MODEL = "qwen2.5-coder:7b"

prompt = """
Me ajdue a implementar o codigo em python do fatorial recursivo 
"""

print(f"Perguntando para {MODEL}...\n")
print(f" Prompt: {prompt.strip()}\n")
print("=" * 50)

response = ollama.chat(
    model=MODEL,
    messages=[
        {
            "role": "system",
            "content": "Você é um assistente especialista em Python. Responda sempre com código limpo e explicações curtas."
        },
        {
            "role": "user",
            "content": prompt
        }
    ]
)



print(response.message.content)