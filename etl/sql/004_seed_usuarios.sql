-- ============================================================
-- Dashboard de Autorizaciones — IPS Manizales
-- 004_seed_usuarios.sql
-- Crea el usuario administrador inicial
-- IMPORTANTE: cambiar la contraseña en el primer login
-- ============================================================

-- Hash bcrypt de 'Admin2026!' con cost factor 12
-- Generado con: python -c "import bcrypt; print(bcrypt.hashpw(b'Admin2026!', bcrypt.gensalt(12)).decode())"
-- Re-generar si se cambia la contraseña

INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
VALUES (
    'admin@ips.local',
    '$2b$12$SwtvDbcyWfvlmsN8cPOE0.BYnYJ5Um5kVwbngEZpiSfJQEIFKJPuC',
    'Administrador IPS',
    'admin',
    TRUE
)
ON CONFLICT (email) DO NOTHING;
