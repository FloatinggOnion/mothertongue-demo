import { z } from 'zod';

const PartnerReviewSchema = z.object({
  translation: z.string().trim().min(1),
  addressesLatestTurn: z.boolean(),
  staysInScene: z.boolean(),
  inTargetLanguage: z.boolean(),
  reason: z.string().default(''),
});

export type PartnerReview = z.infer<typeof PartnerReviewSchema>;

export function parsePartnerReview(raw: string): PartnerReview {
  return PartnerReviewSchema.parse(JSON.parse(raw));
}

export function reviewAcceptsReply(review: PartnerReview): boolean {
  return review.addressesLatestTurn && review.staysInScene && review.inTargetLanguage;
}

export function failedReviewAreas(review: PartnerReview): string {
  const areas = [
    !review.addressesLatestTurn && 'latest learner meaning',
    !review.staysInScene && 'scene or speaker role',
    !review.inTargetLanguage && 'target language',
  ].filter(Boolean);
  return areas.join(', ');
}

export function reviewInput(scene: string, latestLearnerTurn: string, candidateReply: string): string {
  return JSON.stringify({ scene, latestLearnerTurn, candidateReply });
}
