-- Adiciona o valor 'lost' ao enum event_status (usado para "Não fechou")
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'lost';
