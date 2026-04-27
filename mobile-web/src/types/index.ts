// ---------------------------------------------------------------------------
// Bubble.io data types for Rondello Buffet management.
// Field names follow Bubble's Portuguese naming convention.
// Adjust any name that doesn't match your actual Bubble schema.
// ---------------------------------------------------------------------------

export interface BubbleEvento {
  _id: string;

  // Core identification
  NomeDoEvento?: string;
  NomeDoContratante?: string;
  dataDoEvento?: string;        // ISO – note lowercase 'd' (confirmed from API)
  Status?: string;              // "Confirmado" | "Pendente" | "Cancelado" | "Realizado"

  // Event details (Ficha Técnica)
  LocalDoEvento?: string;
  TipoDoEvento?: string;        // "Casamento" | "Corporativo" | etc.
  ProdutoEscolhido?: string;    // e.g. "Coquetel Prime com ilha e Jantar"
  HorarioDaCerimonia?: string;
  DuracaoDoEvento?: string;
  Preco?: number;               // "Preço negociado"
  QuantidadeDeConvidados?: number;
  Criancas50?: number;          // "Crianças 50%"
  NaoPagantes?: number;
  HorasAdicionais?: number;
  Observacoes?: string;

  // Professionals / Team
  QuantidadeDeProfissionais?: number;
  ValorAlimentacaoProfissionais?: number;
  AlimentacaoProfissionais?: string;  // "separada" | "junto" | etc.
  Organizadora?: string;
  Decorador?: string;
  Confeiteiro?: string;
  BandaDJ?: string;
  FotoFilmagem?: string;
  Bartender?: string;
  OutrosProfissionais?: string;
  AtracoesAParte?: string;

  // Setup / Equipment
  CoqueteilBoasVindas?: string; // "Sim" | "Não"
  Vinho?: string;
  Whisky?: string;
  PortaGuardanapo?: string;
  Toalha?: string;
  Rechaud?: string;
  Sousplat?: string;
  Aparador?: string;
  Taca?: string;
  SalaDosNoivos?: string;
  EspacoKids?: string;
  QuantidadeDeMesas?: number;

  // Client data (Dados do Cliente tab)
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
  Evento?: string;
  NomeDoContratante?: string;
  DataDaDegustacao?: string;
  HorarioDaDegustacao?: string;
  Status?: string;
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
