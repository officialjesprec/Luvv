
import * as React from 'react';
import {
  Heart,
  User,
  Users,
  Briefcase,
  Church,
  Smile,
  HeartPulse,
  HeartHandshake,
  HeartOff,
  ShoppingBag,
  Flame
} from 'lucide-react';
import { Relationship, Tone } from './types';

export const COLORS = {
  crimson: '#8B0000',
  rose: '#FFC0CB',
  cream: '#FFFDD0',
};

export const RELATIONSHIP_OPTIONS: { label: Relationship; icon: React.ReactNode }[] = [
  { label: 'Spouse', icon: <Heart className="w-6 h-6" /> },
  { label: 'Girlfriend', icon: <HeartPulse className="w-6 h-6" /> },
  { label: 'Boyfriend', icon: <HeartHandshake className="w-6 h-6" /> },
  { label: 'Crush', icon: <Flame className="w-6 h-6" /> },
  { label: 'Ex', icon: <HeartOff className="w-6 h-6" /> },
  { label: 'Male Friend', icon: <User className="w-6 h-6" /> },
  { label: 'Female Friend', icon: <User className="w-6 h-6" /> },
  { label: 'Father', icon: <Users className="w-6 h-6" /> },
  { label: 'Mother', icon: <Users className="w-6 h-6" /> },
  { label: 'Sister', icon: <Smile className="w-6 h-6" /> },
  { label: 'Brother', icon: <Smile className="w-6 h-6" /> },
  { label: 'Cousin', icon: <Users className="w-6 h-6" /> },
  { label: 'Pastor', icon: <Church className="w-6 h-6" /> },
  { label: 'Employer', icon: <Briefcase className="w-6 h-6" /> },
  { label: 'Customer', icon: <ShoppingBag className="w-6 h-6" /> },
];

export const TONE_OPTIONS: Tone[] = ['Romantic', 'Professional', 'Friendly', 'Polite', 'Funny'];
