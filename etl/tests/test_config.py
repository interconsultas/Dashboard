"""Tests para config.py"""
import os
from unittest.mock import patch


class TestDBConfig:

    def test_valores_por_defecto_estructura(self):
        """Verifica que DB_CONFIG tiene todas las claves requeridas por psycopg2."""
        import config
        claves_requeridas = {"host", "port", "dbname", "user", "password"}
        assert claves_requeridas.issubset(config.DB_CONFIG.keys())

    def test_lee_variables_de_entorno(self):
        env = {
            "DB_HOST": "mi-servidor.com",
            "DB_PORT": "5433",
            "DB_NAME": "mi_base",
            "DB_USER": "mi_usuario",
            "DB_PASSWORD": "secreto123",
        }
        with patch.dict(os.environ, env, clear=True):
            import importlib
            import config
            importlib.reload(config)

            assert config.DB_CONFIG["host"] == "mi-servidor.com"
            assert config.DB_CONFIG["port"] == 5433
            assert config.DB_CONFIG["dbname"] == "mi_base"
            assert config.DB_CONFIG["user"] == "mi_usuario"
            assert config.DB_CONFIG["password"] == "secreto123"

    def test_port_se_convierte_a_int(self):
        with patch.dict(os.environ, {"DB_PORT": "9999"}, clear=True):
            import importlib
            import config
            importlib.reload(config)
            assert isinstance(config.DB_CONFIG["port"], int)

    def test_docs_dir_existe_como_path(self):
        from pathlib import Path
        import config
        assert isinstance(config.DOCS_DIR, Path)

    def test_project_root_es_padre_de_etl(self):
        import config
        assert config.PROJECT_ROOT == config.BASE_DIR.parent
