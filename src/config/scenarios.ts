import { Scenario } from '@/types';

export const scenarios: Scenario[] = [
  {
    id: 'market-haggling',
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
];

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
