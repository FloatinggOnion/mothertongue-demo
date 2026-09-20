export interface LanguageConfig {
  id: 'yoruba' | 'hausa' | 'igbo';
  name: string;
  nativeWelcome: string;
  sttEngine: 'intron';
  accentColor: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    id: 'yoruba',
    name: 'Yoruba',
    nativeWelcome: 'Ẹ káàbò',
    sttEngine: 'intron',
    accentColor: 'from-orange-500 to-red-600',
  },
  {
    id: 'hausa',
    name: 'Hausa',
    nativeWelcome: 'Sannu da zuwa',
    sttEngine: 'intron',
    accentColor: 'from-green-500 to-emerald-700',
  },
  {
    id: 'igbo',
    name: 'Igbo',
    nativeWelcome: 'Nnọọ',
    sttEngine: 'intron',
    accentColor: 'from-blue-500 to-indigo-700',
  },
];
