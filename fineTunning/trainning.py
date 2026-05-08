from pathlib import Path

import torch
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
)
from peft import LoraConfig, get_peft_model, TaskType

HF_MODEL = "Qwen/Qwen2.5-Coder-3B"
_DATA_DIR = Path(__file__).resolve().parent
DATASET = str(_DATA_DIR / "dataset.csv")
OUTPUT_DIR = str(_DATA_DIR / "modelo-finetuned")
MAX_LEN = 128
EPOCHS = 3
BATCH = 2
LR = 2e-4

device = (
    "mps" if torch.backends.mps.is_available()
    else "cuda" if torch.cuda.is_available()
    else "cpu"
)
print(f"Device: {device}")

print("Carregando tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(HF_MODEL)
tokenizer.pad_token = tokenizer.eos_token

print("Carregando dataset...")
dataset = load_dataset("csv", data_files=DATASET, split="train")
print(f"Exemplos carregados: {len(dataset)}")


def tokenize(example):
    result = tokenizer(
        example["text"],
        truncation=True,
        max_length=MAX_LEN,
        padding="max_length",
    )
    result["labels"] = result["input_ids"].copy()
    return result


dataset = dataset.map(tokenize, batched=True, remove_columns=["text"])
dataset = dataset.train_test_split(test_size=0.1, seed=42)
print(f"Treino: {len(dataset['train'])} | Validação: {len(dataset['test'])}")

print("Carregando modelo base...")
dtype = torch.float16 if device in ("mps", "cuda") else torch.float32
model = AutoModelForCausalLM.from_pretrained(HF_MODEL, dtype=dtype)
model = model.to(device)

lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=8,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "v_proj"],
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

use_fp16 = device == "cuda"
args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=EPOCHS,
    per_device_train_batch_size=BATCH,
    per_device_eval_batch_size=BATCH,
    learning_rate=LR,
    fp16=use_fp16,
    logging_steps=5,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
)

print("Iniciando treinamento...")
trainer.train()

model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f"\nModelo salvo em: {OUTPUT_DIR}")
