// ---------------------------------------------------------------------------
// Bubble.io data types for Rondello Buffet management.
// Adjust field names here to match your actual Bubble schema.
// ---------------------------------------------------------------------------

export interface BubbleEvento {
  _id: string;
  // Core
  NomeDoEvento?: string;
  NomeDoContratante?: string;
  dataDoEvento?: string;        // ISO date string
  Status?: string;              // "Confirmado" | "Pendente" | "Cancelado" | "Realizado"
  // Details
  NumeroDeConvidados?: number;
  Local?: string;
  Valor?: number;
  Descricao?: string;
  ContatoDoContratante?: string;
  Telefone?: string;
  // Relations
  DataDaDegustacao?: string;    // tasting date if stored on event
  Cardapio?: string;            // menu description or ID
}

export interface BubbleDegustacao {
  _id: string;
  Evento?: string;              // reference to Evento._id
  NomeDoContratante?: string;
  DataDaDegustacao?: string;
  HorarioDaDegustacao?: string;
  Status?: string;              // "Agendada" | "Realizada" | "Cancelada"
  Observacoes?: string;
}

export interface BubbleListResponse<T> {
  status: string;
  response: {
    cursor: number;
    results: T[];
    count: number;
    remaining: number;
  };
}

export interface BubbleSingleResponse<T> {
  status: string;
  response: T;
}
