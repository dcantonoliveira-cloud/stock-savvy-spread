// ---------------------------------------------------------------------------
// Bubble.io data types for Rondello Buffet management.
// Field names match EXACTLY what the Bubble Data API returns.
// ---------------------------------------------------------------------------

export interface BubbleEvento {
  _id: string;

  // Core identification
  NomeDoEvento?: string;
  dataDoEvento?: string;         // ISO date string
  status?: string;               // "Fechado" | "Cancelado" | "Não fechou" | "Negociando" | "1º Contato"
  Data_reservada?: boolean;

  // Location (reference ID to Locais_eventos)
  LocalDoEvento?: string;
  'Local Do Evento_TXT'?: string;

  // Event details
  Tipo_Do_Evento?: string;
  HorarioCerimonia?: string;
  'duraçãoDoEvento'?: number | string;
  'duração do evento'?: number | string;
  ProdutoEscolhido?: string;
  PreçoCombinado?: number;
  ValorTotalEvento?: number;     // Total do evento (base para Financeiro)
  Quitado?: boolean;

  // Guests
  QtdConvidados?: number;
  'Crianças50%'?: number;
  CriançasNãoPagantes?: number;
  QtdHorasAdicionais?: number;
  QuantidadeConvidadosPorMesa?: number;

  // Observations & Cardápio
  'Observações'?: string;
  CardapioEvento?: string;       // Cardápio escolhido (rich text)

  // Professionals / Team
  QuantidadeProfissionais?: number;
  'AlimentaçãoProfissionais'?: number;
  tipoAlimentProf?: string;
  'Organizador(a) escolhido'?: string;
  Decorador?: string;
  Confeiteira?: string;
  'Banda/DjEscolhido'?: string;
  HorarioBanda?: string;
  'Foto/Filmagem'?: string;
  Bartender?: string;
  OutrosProfissionais?: string;
  AtracoesAParte?: string;
  Assessoria?: string;

  // Setup / Equipment
  CoquetelDeBoasVindas?: string;
  vinho?: string;
  whisky?: string;
  Cerveja?: string;
  PortaGuardanapo?: string;
  Toalha?: string;
  rechaud?: string;
  'Sousplát'?: string;
  Aparador?: string;
  'Qtd aparadores'?: string;
  'Tamanho dos aparadores'?: string;
  'taça'?: string;
  'sala dos noivos'?: string;
  'espaço kids'?: string;
  QuantidadeDeMesas?: number;
  'localizaçãoMesaBolo'?: string;

  // Linked records (list of IDs)
  pagamentos?: string[];
  ValoresAdicionais?: string[];
  'Degustações'?: string[];      // linked degustações — usado para filtro orçamentos
  PagouDegustacao?: boolean;

  // Client data (kept for future use, may not be directly on evento)
  NomeDoContratante?: string;
  ContatoDoContratante?: string;
  Telefone?: string;
  Email?: string;
  CPF?: string;
  Endereco?: string;
}

export interface BubbleLocal {
  _id: string;
  Nome?: string;
}

export interface BubblePagamento {
  _id: string;
  data?: string;
  Valor?: number;
  conferido?: boolean;
  evento?: string;
}

export interface BubbleValorAdicional {
  _id: string;
  'Descrição'?: string;
  valor?: number;
  evento?: string;
}

export interface BubbleDegustacao {
  _id: string;
  data?: string;           // ISO date string (tasting date)
  convidados?: number;
  'Observações'?: string;
  'Cardápio'?: string;
  tipo_degust?: string;
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
