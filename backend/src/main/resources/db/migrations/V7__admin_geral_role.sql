-- Separa administrador global do administrador de pelada.
-- Antes: role 'ADMIN' sem pelada. Agora: 'ADMIN_GERAL' sem pelada; 'ADMIN' sempre com pelada.
UPDATE users SET role = 'ADMIN_GERAL' WHERE role = 'ADMIN';
