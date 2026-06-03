"""Tests para utils/dedup.py"""
import hashlib
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from utils.dedup import hash_archivo, calcular_hash_filas


class TestHashArchivo:

    def test_hash_consistente(self, tmp_path):
        archivo = tmp_path / "test.xlsx"
        archivo.write_bytes(b"contenido de prueba")
        h1 = hash_archivo(archivo)
        h2 = hash_archivo(archivo)
        assert h1 == h2

    def test_hash_es_sha256_hex(self, tmp_path):
        archivo = tmp_path / "test.xlsx"
        archivo.write_bytes(b"datos")
        h = hash_archivo(archivo)
        assert len(h) == 64
        int(h, 16)  # debe ser hex válido

    def test_archivos_diferentes_hash_diferente(self, tmp_path):
        a = tmp_path / "a.xlsx"
        b = tmp_path / "b.xlsx"
        a.write_bytes(b"contenido A")
        b.write_bytes(b"contenido B")
        assert hash_archivo(a) != hash_archivo(b)

    def test_hash_coincide_con_hashlib_directo(self, tmp_path):
        contenido = b"verificacion directa"
        archivo = tmp_path / "verify.bin"
        archivo.write_bytes(contenido)
        esperado = hashlib.sha256(contenido).hexdigest()
        assert hash_archivo(archivo) == esperado

    def test_archivo_vacio(self, tmp_path):
        archivo = tmp_path / "vacio.bin"
        archivo.write_bytes(b"")
        h = hash_archivo(archivo)
        assert h == hashlib.sha256(b"").hexdigest()

    def test_chunk_size_no_afecta_resultado(self, tmp_path):
        contenido = b"x" * 200_000
        archivo = tmp_path / "grande.bin"
        archivo.write_bytes(contenido)
        h_default = hash_archivo(archivo)
        h_small = hash_archivo(archivo, chunk_bytes=1024)
        h_big = hash_archivo(archivo, chunk_bytes=1_000_000)
        assert h_default == h_small == h_big


class TestCalcularHashFilas:

    def test_hash_filas_basico(self):
        df = pd.DataFrame({
            "Numero_Consec_Orden_Serie": ["100", "200"],
            "Numero_Consec_Evento": ["1", "2"],
            "CODIGO_PRESTACION_OP": ["890201", "890301"],
            "PERIODO": ["202603", "202603"],
        })
        result = calcular_hash_filas(df)
        assert len(result) == 2
        assert all(len(h) == 64 for h in result)

    def test_filas_diferentes_hash_diferente(self):
        df = pd.DataFrame({
            "Numero_Consec_Orden_Serie": ["100", "200"],
            "Numero_Consec_Evento": ["1", "1"],
            "CODIGO_PRESTACION_OP": ["890201", "890201"],
            "PERIODO": ["202603", "202603"],
        })
        result = calcular_hash_filas(df)
        assert result.iloc[0] != result.iloc[1]

    def test_filas_iguales_hash_igual(self):
        df = pd.DataFrame({
            "Numero_Consec_Orden_Serie": ["100", "100"],
            "Numero_Consec_Evento": ["1", "1"],
            "CODIGO_PRESTACION_OP": ["890201", "890201"],
            "PERIODO": ["202603", "202603"],
        })
        result = calcular_hash_filas(df)
        assert result.iloc[0] == result.iloc[1]

    def test_hash_coincide_con_calculo_manual(self):
        df = pd.DataFrame({
            "Numero_Consec_Orden_Serie": ["100"],
            "Numero_Consec_Evento": ["1"],
            "CODIGO_PRESTACION_OP": ["890201"],
            "PERIODO": ["202603"],
        })
        result = calcular_hash_filas(df)
        esperado = hashlib.sha256("100|1|890201|202603".encode()).hexdigest()
        assert result.iloc[0] == esperado

    def test_sin_columnas_hash_lanza_error(self):
        df = pd.DataFrame({"col_irrelevante": [1, 2]})
        with pytest.raises(ValueError, match="Ninguna columna de hash"):
            calcular_hash_filas(df)

    def test_columnas_parciales_no_falla(self):
        df = pd.DataFrame({
            "Numero_Consec_Orden_Serie": ["100"],
            "PERIODO": ["202603"],
        })
        result = calcular_hash_filas(df)
        assert len(result) == 1
        assert len(result.iloc[0]) == 64
