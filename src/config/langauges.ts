export interface LanguageConfig {
  id: 'yoruba' | 'hausa';
  name: string;
  nativeWelcome: string;
  sttEngine: 'google_cloud' | 'modal';
  accentColor: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    id: 'yoruba',
    name: 'Yoruba',
    nativeWelcome: 'Ẹ káàbò',
    sttEngine: 'google_cloud',
    accentColor: 'from-orange-500 to-red-600',
  },
  {
    id: 'hausa',
    name: 'Hausa',
    nativeWelcome: 'Sannu da zuwa',
    sttEngine: 'modal',
    accentColor: 'from-green-500 to-emerald-700',
  },
];