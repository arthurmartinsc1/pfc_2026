"""
Selecao de device/dtype para rodar os modelos localmente (Mac Apple Silicon via
MPS, ou CPU). Sem CUDA/bitsandbytes: os notebooks originais usavam quantizacao
4-bit em GPU CUDA, mas essa stack nao funciona em Apple Silicon.
"""

import torch


def resolver_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def resolver_dtype(device: str) -> torch.dtype:
    return torch.float16 if device == "mps" else torch.float32
