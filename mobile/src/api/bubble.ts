import {
  BubbleEvento,
  BubblePrato,
  BubbleListResponse,
  BubbleSingleResponse,
} from '../types';

const BASE_URL = 'https://rondellobuffet-app.com.br/api/1.1/obj';
const TOKEN = 'Bearer b4b3c4138bb1000811d5a3c0ba47a238';

const HEADERS = {
  Authorization: TOKEN,
  'Content-Type': 'application/json',
};

export async function fetchEvento(id: string): Promise<BubbleEvento> {
  const res = await fetch(`${BASE_URL}/Eventos/${id}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Evento não encontrado (${res.status})`);
  const json: BubbleSingleResponse<BubbleEvento> = await res.json();
  return json.response;
}

// Fetches up to 200 dishes sorted by category.
// Adjust the data type name "Pratos" if your Bubble type has a different name.
export async function fetchPratos(): Promise<BubblePrato[]> {
  const params = new URLSearchParams({
    sort_field: 'Categoria',
    limit: '200',
  });
  const res = await fetch(`${BASE_URL}/Pratos?${params}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Erro ao carregar pratos (${res.status})`);
  const json: BubbleListResponse<BubblePrato> = await res.json();
  return json.response?.results ?? [];
}

export async function submitMenuSelecao(
  eventoId: string,
  pratosIds: string[]
): Promise<void> {
  const res = await fetch(`${BASE_URL}/MenuSelecao`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      Evento: eventoId,
      PratosIds: JSON.stringify(pratosIds),
      DataEnvio: new Date().toISOString(),
      Status: 'pendente',
    }),
  });
  if (!res.ok) throw new Error(`Erro ao enviar seleção (${res.status})`);
}
