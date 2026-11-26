// Consume cues from the rendered frame, so pauses and slow devices stay in sync.
export function createCakeIntroSoundTrack(play, reducedMotion = false) {
  let nextTier = 0;
  let starPlayed = false;

  return {
    update(state) {
      if (!reducedMotion) {
        while (nextTier < 5 && state.lights >= Math.max(0.015, nextTier * 0.18)) {
          play("cake-rise", nextTier);
          nextTier++;
        }
      }
      if (!starPlayed && state.star >= 0.015) {
        starPlayed = true;
        play("cake-star");
      }
    },
  };
}
