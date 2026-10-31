/* AidRelay — six synthetic demo casualties.
   Mirrors files/casualty-relay-demo-scripts.md exactly. All fictional. */
(function (global) {
  'use strict';
  var CASES = [
    {
      id: 1, tag: 'R-07', title: 'Red — medication read-back',
      dictation: 'Tag R-07. Red, immediate. Adult male, leg injury from the collapsed barn roof, fairground north gate. Tourniquet applied to the left leg, wound packed, IV started. Morphine, 4 milligrams, IV — given at T plus four. Confirm that back to me.',
      online: true, confirmMedication: true,
      expected: { tag: 'R-07', category: 'RED', careGiven: ['tourniquet_applied', 'wound_packed', 'iv_started', 'medication_given'], medicationCount: 1, narrativeIncludes: 'leg injury from the collapsed barn roof', syncState: 'relayed' }
    },
    {
      id: 2, tag: 'Y-12', title: 'Yellow — offline entry',
      dictation: 'Tag Y-12. Yellow, delayed. Adult female, arm injury from flying debris near the grandstand. Splint applied, oxygen applied. We have no signal out here.',
      online: false, confirmMedication: false,
      expected: { tag: 'Y-12', category: 'YELLOW', careGiven: ['oxygen_applied', 'splint_applied'], medicationCount: 0, narrativeIncludes: 'arm injury from flying debris', syncState: 'queued' }
    },
    {
      id: 3, tag: 'G-03', title: 'Green — minimal record',
      dictation: 'Tag G-03. Green, minor. Teenager, small cut on the hand, walking around on his own. No care given yet. He\u2019s at the first aid tent.',
      online: true, confirmMedication: false,
      expected: { tag: 'G-03', category: 'GREEN', careGiven: ['no_care_given'], medicationCount: 0, narrativeIncludes: 'small cut on the hand', syncState: 'relayed' }
    },
    {
      id: 4, tag: 'R-09', title: 'Red — CPR / AED',
      dictation: 'Tag R-09. Red, immediate. Adult female found unresponsive by the show ring. CPR in progress, AED applied. Moved to the casualty collection point.',
      online: true, confirmMedication: false,
      expected: { tag: 'R-09', category: 'RED', careGiven: ['cpr_in_progress', 'aed_applied', 'moved_to_collection'], medicationCount: 0, narrativeIncludes: 'found unresponsive by the show ring', syncState: 'relayed' }
    },
    {
      id: 5, tag: 'K-02', title: 'Black — expectant',
      dictation: 'Tag K-02. Black, expectant. Adult male found under the grandstand debris. Airway positioned, no breathing after positioning. Kept with the expectant area by the grandstand.',
      online: true, confirmMedication: false,
      expected: { tag: 'K-02', category: 'BLACK', careGiven: ['airway_positioned'], medicationCount: 0, narrativeIncludes: 'found under the grandstand debris', syncState: 'relayed' }
    },
    {
      id: 6, tag: 'Y-15', title: 'Yellow — unconfirmed medication trap',
      dictation: 'Tag Y-15. Yellow, delayed. Adult male, dizzy and sweating by the food stands. IV started, fluids started. Somebody said he got some insulin earlier, I think — I didn\u2019t see it.',
      online: true, confirmMedication: false,
      expected: { tag: 'Y-15', category: 'YELLOW', careGiven: ['iv_started', 'fluids_started'], medicationCount: 0, narrativeIncludes: 'dizzy and sweating', syncState: 'relayed', unconfirmedMentionsInsulin: true }
    }
  ];
  global.RelayDemoData = CASES;
  if (typeof module !== 'undefined' && module.exports) module.exports = CASES;
})(typeof window !== 'undefined' ? window : globalThis);
