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
  Data_reservada?: boolean;      // capital D – yes/no field in Bubble

  // Location (reference ID to Locais_eventos)
  LocalDoEvento?: string;
  'Local Do Evento_TXT'?: string; // pre-resolved text version stored on the record

  // Event details (Ficha Técnica)
  Tipo_Do_Evento?: string;       // "Casamento" | "Corporativo" | etc.
  HorarioCerimonia?: string;
  'duraçãoDoEvento'?: number | string;
  ProdutoEscolhido?: string;
  PreçoCombinado?: number;       // "Preço negociado"
  QtdConvidados?: number;
  Criancas50?: number;           // "Crianças 50%"
  NaoPagantes?: number;
  HorasAdicionais?: number;
  'Observações'?: string;

  // Professionals / Team
  QuantidadeProfissionais?: number;
  'AlimentaçãoProfissionais'?: number;  // value (R$) of professional food
  tipoAlimentProf?: string;            // "Separada" | "Junto" | etc.
  'Organizador(a) escolhido'?: string;
  Decorador?: string;
  Confeiteira?: string;
  'Banda/DjEscolhido'?: string;
  'Foto/Filmagem'?: string;
  Bartender?: string;
  OutrosProfissionais?: string;
  AtracoesAParte?: string;
  Assessoria?: string;

  // Setup / Equipment
  CoquetelDeBoasVindas?: string; // "Sim" | "Não tem" | etc.
  vinho?: string;
  whisky?: string;
  PortaGuardanapo?: string;
  Toalha?: string;
  rechaud?: string;
  'Sousplát'?: string;
  Aparador?: string;
  'taça'?: string;
  SalaDosNoivos?: string;
  EspacoKids?: string;
  QuantidadeDeMesas?: number;

  // Client data (linked via Cliente reference — typically not on the evento record
  // but kept here so pages can gracefully handle any partial data that may exist)
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
  empresa?: string;
}

export interface BubbleDegustacao {
  _id: string;
  // Actual fields returned by Bubble for the "Degustação" type:
  data?: string;           // ISO date string (tasting date)
  convidados?: number;     // number of guests
  'Observações'?: string;  // notes
  'Cardápio'?: string;     // menu text (can be long rich text)
  tipo_degust?: string;    // reference to tasting type
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
