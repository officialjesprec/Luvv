
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
  | 'Cousin'
  | 'Pastor'
  | 'Employer'
  | 'Ex'
  | 'Customer'
  | 'Crush';

export type Tone = 'Romantic' | 'Professional' | 'Friendly' | 'Polite' | 'Funny' | 'Heartbroken' | 'Apology' | 'Appreciation';

export interface AppState {
  step: number;
  relationship: Relationship | null;
  recipientName: string;
  senderName: string;
  tone: Tone | null;
  generatedMessages: string[];
  selectedMessageIndex: number | null;
  editedMessage: string;
  isLoading: boolean;
  error: string | null;
}
