export interface QuestionResult {
  id: string;
  timestamp: number;
  imageUrl?: string;
  questionText: string;
  directAnswer: string;
  options?: string[];
  correctOptionIndex?: number | null;
  explanation: string;
  subject?: string;
  confidence?: 'Alta' | 'Media' | 'Baja';
}

export interface AnswerApiResponse {
  success: boolean;
  data?: Omit<QuestionResult, 'id' | 'timestamp'>;
  error?: string;
  providerUsed?: 'gemini' | 'openai';
}

export interface AppSettings {
  useOpenAi: boolean;
  openAiApiKey: string;
  autoFlash: boolean;
  keepHistory: boolean;
}
