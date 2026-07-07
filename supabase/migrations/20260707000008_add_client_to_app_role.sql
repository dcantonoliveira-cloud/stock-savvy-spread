-- Adiciona valor 'client' ao enum app_role para o portal do cliente
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'client';
