export type RootStackParamList = {
  Home: undefined;
  Evento: { eventId: string };
  Success: { selectedDishes: BubblePrato[] };
};

export interface BubbleEvento {
  _id: string;
  NomeDoEvento?: string;
  NomeDoContratante?: string;
  dataDoEvento?: string;
}

// Field names match the Bubble "Pratos" data type.
// Adjust keys here if your Bubble type uses different field names.
export interface BubblePrato {
  _id: string;
  Nome: string;
  Categoria?: string;
  Descricao?: string;
  Imagem?: string;
  // Bubble may return a list field as an array or a comma-separated string
  Ingredientes?: string | string[];
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
