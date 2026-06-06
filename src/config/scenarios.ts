import { Scenario } from '@/types';

export const scenarios: Scenario[] = [
  {
    id: 'market-haggling',
    language: 'yoruba',
    title: 'Market Haggling',
    titleYoruba: 'Ríra Lọ́jà',
    description: 'Bargain for goods at a Nigerian market',
    icon: '🛒',
    context: `You are at Mama Nkechi's vegetable stall in Balogun Market, Lagos. 
She sells tomatoes, peppers, onions, and other produce. 
Prices are negotiable, and friendly haggling is expected.
The market is busy and lively.`,
    aiRole: 'Mama Nkechi, a warm but shrewd Yoruba market woman',
    aiRoleYoruba: 'Mama Nkechi, alájàpá tó mọ̀ ọjà',
    starterPrompt: 'Ẹ kú àárọ̀ o! Ẹ wá ra nǹkan? I have fresh tomatoes today, very fresh! Kí ló fẹ́ ra?',
    difficulty: 'beginner',
    gender: 'female',
  },
  {
    id: 'greeting-elders',
    language: 'yoruba',
    title: 'Greeting Elders',
    titleYoruba: 'Ìkíni Àwọn Àgbà',
    description: 'Practice proper greetings and respect for elders',
    icon: '🙏',
    context: `You are visiting your grandmother (Mama Àgbà) at her home in Ibadan.
She is sitting in the living room with some of her friends.
Proper Yoruba greetings and prostration/kneeling customs are important.
Show respect while maintaining warm family connection.`,
    aiRole: 'Mama Àgbà, your wise and loving grandmother',
    aiRoleYoruba: 'Mama Àgbà, ìyá àgbà rẹ tó ní ọgbọ́n',
    starterPrompt: 'Ọmọ mi! Ẹ̀yin ti dé o! Come in, come in. How was your journey? Báwo ni àwọn òbí rẹ?',
    difficulty: 'beginner',
    gender: 'female',
  },
  {
    id: 'ordering-food',
    language: 'yoruba',
    title: 'Ordering Food',
    titleYoruba: 'Títọ́ Oúnjẹ',
    description: 'Order a meal at a local restaurant or buka',
    icon: '🍲',
    context: `You are at a popular buka (local restaurant) called "Mama Put" in Surulere.
The menu includes classics like amala, ewedu, gbegiri, efo riro, pounded yam, and egusi.
The owner, Iya Basira, takes pride in her cooking.
The place is casual and friendly.`,
    aiRole: 'Iya Basira, a proud and friendly buka owner',
    aiRoleYoruba: 'Iya Basira, olóúnjẹ tó dára',
    starterPrompt: 'Ẹ kú ìrọ̀lẹ́! Welcome to my buka. Today we have fresh amala and ewedu, the soup is sweet die! Kí lẹ fẹ́ jẹ?',
    difficulty: 'intermediate',
    gender: 'female',
  },
  {
    id: 'chatting-friends',
    language: 'yoruba',
    title: 'Chatting with Friends',
    titleYoruba: 'Ìbánisọ̀rọ̀ Pẹ̀lú Ọ̀rẹ́',
    description: 'Have a casual conversation with your peers',
    icon: '💬',
    context: `You are hanging out with your friend Tunde at a local spot after school/work.
The conversation is casual and can cover topics like football, music, movies, weekend plans, or gossip.
Young Lagosians often mix Yoruba, English, and Pidgin naturally.
The vibe is relaxed and playful.`,
    aiRole: 'Tunde, your fun-loving friend',
    aiRoleYoruba: 'Tunde, ọ̀rẹ́ rẹ tó nífẹ̀ẹ́ àyọ̀',
    starterPrompt: 'Guy! Ẹ̀yin don land? How far, how body? You don hear the latest about that match yesterday? Crazy tin happen o!',
    difficulty: 'intermediate',
    gender: 'male',
  },
  {
    id: 'transportation',
    language: 'yoruba',
    title: 'Transportation',
    titleYoruba: 'Ìrìnàjò',
    description: 'Navigate public transport like danfo and okada',
    icon: '🚌',
    context: `You need to get from Yaba to Ikeja using public transport.
Options include danfo (yellow buses), BRT, okada (motorcycle taxis), and keke (tricycles).
Conductors are loud and negotiations happen fast.
You need to know where to drop and how much to pay.`,
    aiRole: 'A Lagos danfo conductor',
    aiRoleYoruba: 'Agbẹ́rò',
    starterPrompt: 'Ikeja! Ikeja! Ọ̀kan hundred naira! Ẹ wọlé, ẹ wọlé! E quick o, motor dey go now now!',
    difficulty: 'advanced',
    gender: 'male',
  },
  {
    id: 'hausa-market-haggling',
    language: 'hausa',
    title: 'Market Haggling',
    titleYoruba: 'Ciniki a Kasuwa',
    description: 'Bargain for goods at a northern market',
    icon: '🛒',
    context: `You are at Malam Bello's spice and grain stall in Kurmi Market, Kano.
He sells onions, peppers, rice, and various spices.
Friendly bargaining is an essential part of the transaction.
The market environment is energetic and bustling.`,
    aiRole: 'Malam Bello, a polite but firm Hausa trader',
    aiRoleYoruba: 'Malam Bello, mai shago mai bincike',
    starterPrompt: 'Sannu da zuwa! Shigo ciki. Kana son sayan albasa ko shinkafa yau? Akwai kaya masu kyau sosai!',
    difficulty: 'beginner',
    gender: 'male',
  },
  {
    id: 'hausa-greeting-elders',
    language: 'hausa',
    title: 'Greeting Elders',
    titleYoruba: 'Gaishe da Dattijai',
    description: 'Practice respectful greetings and traditional etiquette',
    icon: '🙏',
    context: `You are visiting a respected family elder, Alhaji Ibrahim, at his home in Kaduna.
Showing deep respect and using proper honorific structures is key in Hausa culture.
The atmosphere is serene and formal.`,
    aiRole: 'Alhaji Ibrahim, your dignified and welcoming uncle',
    aiRoleYoruba: 'Alhaji Ibrahim, dattijo mai mutunci',
    starterPrompt: 'Barka da rana, barka da zuwa. Ina kwana? Yaya iyali da mutanen gida?',
    difficulty: 'beginner',
    gender: 'male',
  }
];

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}