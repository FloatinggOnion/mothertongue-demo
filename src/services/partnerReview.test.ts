import { describe, expect, it } from 'vitest';
import { parsePartnerReview, reviewAcceptsReply, reviewInput } from './partnerReview';

describe('partner reply review', () => {
  it('requires explicit booleans and an English translation', () => {
    expect(() => parsePartnerReview(JSON.stringify({
      translation: 'Good morning', addressesLatestTurn: 'true',
      staysInScene: true, inTargetLanguage: true,
    }))).toThrow();
    expect(() => parsePartnerReview(JSON.stringify({
      translation: '', addressesLatestTurn: true,
      staysInScene: true, inTargetLanguage: true,
    }))).toThrow();
  });

  it('rejects a fluent but irrelevant reply', () => {
    const review = parsePartnerReview(JSON.stringify({
      translation: 'Good morning, Mama Nkechi.', addressesLatestTurn: false,
      staysInScene: false, inTargetLanguage: true,
      reason: 'The learner asked for tomatoes.',
    }));
    expect(reviewAcceptsReply(review)).toBe(false);
  });

  it('rejects an English reply even if its meaning is relevant', () => {
    const review = parsePartnerReview(JSON.stringify({
      translation: 'One basket costs 500 naira.', addressesLatestTurn: false,
      staysInScene: true, inTargetLanguage: false,
    }));
    expect(reviewAcceptsReply(review)).toBe(false);
  });

  it('passes the learner turn and candidate as data', () => {
    expect(JSON.parse(reviewInput('Market', 'Two baskets, please.', 'Ẹ fẹ́ agbọ̀n méjì?')))
      .toEqual({ scene: 'Market', latestLearnerTurn: 'Two baskets, please.', candidateReply: 'Ẹ fẹ́ agbọ̀n méjì?' });
  });
});
