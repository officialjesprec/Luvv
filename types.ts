
export type Relationship = 
  | 'Male Friend' 
  | 'Female Friend' 
  | 'Spouse' 
  | 'Girlfriend' 
  | 'Boyfriend' 
  | 'Father' 
  | 'Mother' 
  | 'Sister' 
  | 'Brother' 
  | 'Pastor' 
  | 'Employer';

export type Tone = 'Romantic' | 'Professional' | 'Friendly' | 'Polite' | 'Funny';

export interface AppState {
  step: number;
  relationship: Relationship | null;
  recipientName: string;
  senderName: string;
  tone: Tone | null;
  generatedMessages: string[];
  selectedMessageIndex: number | null;
  isLoading: boolean;
  error: string | null;
}
