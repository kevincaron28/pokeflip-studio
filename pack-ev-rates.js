/* Curated, cited inputs for the Pack value tab. Edit by hand; every number needs a source.
 * sets: keyed by TCGplayer group id. A set that is not listed has no sourced pull-rate table,
 *   and the app shows its EV as unknown.
 *   rates[].pool        TCGplayer rarity name, or a print pattern such as "Master Ball Pattern"
 *   rates[].oneIn       published odds "1 in N packs"
 *   rates[].asPrinted   the odds exactly as the source prints them
 *   structure           cards per pack by slot, only when a source states it
 *   replacesReverse     hits that are printed in a reverse-holo slot (they replace that reverse holo)
 *   rareSlot            hits that are printed in the rare slot (Rare odds = 1 − their sum)
 * msrp: US/Canadian suggested retail price of one booster pack. CAD stays null until an official
 *   Canadian price is found: the app then shows "unknown".
 */
(function(root){'use strict';
const MAIN_SETS=[22873,23120,23228,23286,23381,23473,23537,23651,24073,24269,24380,24448,24587,24655,24688,24831];
root.CardsteadPackRates={
 updated:'2026-11-23',
 msrp:{
  rules:[
   {groupIds:MAIN_SETS,usd:4.49,cad:null,product:'single booster pack',
    sourceTitle:'Kotaku, 25 Mar 2026: MSRP on a new pack is $4.49, up from the long-standing $3.99',
    sourceUrl:'https://kotaku.com/gamestop-pokemon-tcg-prices-booster-box-etb-perfect-order-2000681798',seen:'2026-11-23',
    note:'Current US price per pack, also in SNKRDUNK (29 May 2025, Destined Rivals: pack $4.49, 36-pack box $161.64). Applies to numbered main sets; no official Canadian MSRP was found. Sets released while the MSRP was $3.99 sold for less at launch.'}
  ],
  perSet:{}
 },
 // Generated from TCGplayer Infinite "Pull Rates" articles (and one community sample), checked line by line on 2026-11-23.
 notes:{
  "2585": "No published pull-rate table found.",
  "2626": "No published pull-rate table found.",
  "2675": "No published pull-rate table found.",
  "2701": "No published pull-rate table found.",
  "2765": "No published pull-rate table found.",
  "2807": "No published pull-rate table found.",
  "2848": "TCGplayer publishes odds for this set, but by card type (V, VMAX, alternate art, gallery) while its price list groups those cards under one rarity, so a reliable EV cannot be computed yet.",
  "2906": "No published pull-rate table found.",
  "2948": "No published pull-rate table found.",
  "3040": "TCGplayer publishes odds for this set, but by card type (V, VMAX, alternate art, gallery) while its price list groups those cards under one rarity, so a reliable EV cannot be computed yet.",
  "3118": "TCGplayer publishes odds for this set, but by card type (V, VMAX, alternate art, gallery) while its price list groups those cards under one rarity, so a reliable EV cannot be computed yet.",
  "3170": "TCGplayer publishes odds for this set, but by card type (V, VMAX, alternate art, gallery) while its price list groups those cards under one rarity, so a reliable EV cannot be computed yet.",
  "17688": "TCGplayer publishes odds for this set, but by card type (V, VMAX, alternate art, gallery) while its price list groups those cards under one rarity, so a reliable EV cannot be computed yet.",
  "23529": "No published pull-rate table found (TCGplayer has none; other tables were unsourced estimates)."
 },
 sets:{
  "22873": {
   "source": {
    "title": "Pokémon TCG: Scarlet & Violet Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Scarlet-Violet-Pull-Rates/a7702fce-dd64-4a58-beb1-0f871c853215/",
    "publisher": "TCGplayer",
    "date": "2023-03-31",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "13.76% ± 0.73% (1 in 7 Packs)",
     "perPack": 0.1376
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.57% ± 0.52% (1 in 15 Packs)",
     "perPack": 0.0657
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.67% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.0767
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "3.15% ± 0.37% (1 in 32 Packs)",
     "perPack": 0.0315
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "1.85% ± 0.28% (1 in 54 Packs)",
     "perPack": 0.0185
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23120": {
   "source": {
    "title": "Pokémon TCG: Paldea Evolved Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Paldea-Evolved-Pull-Rates/1b7d3e70-9542-4a50-8692-1661e2316521/",
    "publisher": "TCGplayer",
    "date": "2023-06-09",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "13.72% ± 0.73% (1 in 7 Packs)",
     "perPack": 0.1372
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.64% ± 0.53% (1 in 15 Packs)",
     "perPack": 0.0664
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.7% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.077
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "3.17% ± 0.37% (1 in 32 Packs)",
     "perPack": 0.0317
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "1.76% ± 0.28% (1 in 57 Packs)",
     "perPack": 0.0176
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23228": {
   "source": {
    "title": "Pokémon TCG: Obsidian Flames Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Obsidian-Flames-Pull-Rates/e2a66999-a7b5-4621-9765-c9a132e04bd2/",
    "publisher": "TCGplayer",
    "date": "2023-08-11",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "13.61% ± 0.72% (1 in 7 Packs)",
     "perPack": 0.1361
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.63% ± 0.52% (1 in 15 Packs)",
     "perPack": 0.0663
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.6% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.076
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "3.13% ± 0.37% (1 in 32 Packs)",
     "perPack": 0.0313
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "1.92% ± 0.29% (1 in 52 Packs)",
     "perPack": 0.0192
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23237": {
   "source": {
    "title": "Pokémon TCG: Scarlet & Violet—151 Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Scarlet-Violet%E2%80%94151-Pull-Rates/b237df74-fbb0-40d0-9e13-d69ee6e804d9/",
    "publisher": "TCGplayer",
    "date": "2023-09-22",
    "sample": 1500
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "13.28% ± 1.57% (1 in 8 Packs)",
     "perPack": 0.1328
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.44% ± 1.13% (1 in 16 Packs)",
     "perPack": 0.0644
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "8.5% ± 1.29% (1 in 12 Packs)",
     "perPack": 0.085
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "3.11% ± 0.8% (1 in 32 Packs)",
     "perPack": 0.0311
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "1.94% ± 0.64% (1 in 51 Packs)",
     "perPack": 0.0194
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Not modelled (no matching TCGplayer product group): Foil Energy: 24.83% ± 2% (1 in 4 Packs)."
  },
  "23286": {
   "source": {
    "title": "Pokémon TCG: Paradox Rift Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Paradox-Rift-Pull-Rates/0b5fb648-38fc-4f61-a6af-57c2737b4a48/",
    "publisher": "TCGplayer",
    "date": "2023-11-04",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "15.57% ± 0.76% (1 in 6 Packs)",
     "perPack": 0.1557
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.64% ± 0.53% (1 in 15 Packs)",
     "perPack": 0.0664
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.7% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.077
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "2.11% ± 0.3% (1 in 47 Packs)",
     "perPack": 0.0211
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "1.22% ± 0.23% (1 in 82 Packs)",
     "perPack": 0.0122
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23353": {
   "source": {
    "title": "Pokémon TCG: Paldean Fates Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Paldean-Fates-Pull-Rates/23de3e93-0d0f-4ae0-abc4-13664f3001a3/",
    "publisher": "TCGplayer",
    "date": "2024-01-26",
    "sample": 1500
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "15.89% ± 1.69% (1 in 6 Packs)",
     "perPack": 0.1589
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.61% ± 1.15% (1 in 15 Packs)",
     "perPack": 0.0661
    },
    {
     "pool": "Shiny Rare",
     "asPrinted": "25.44% ± 2.01% (1 in 4 Packs)",
     "perPack": 0.2544
    },
    {
     "pool": "Shiny Ultra Rare",
     "asPrinted": "7.72% ± 1.23% (1 in 13 Packs)",
     "perPack": 0.0772
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.22% ± 1.2% (1 in 14 Packs)",
     "perPack": 0.0722
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.72% ± 0.6% (1 in 58 Packs)",
     "perPack": 0.0172
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "1.61% ± 0.58% (1 in 62 Packs)",
     "perPack": 0.0161
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Shiny Rare",
    "Shiny Ultra Rare",
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23381": {
   "source": {
    "title": "Pokémon TCG: Temporal Forces Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Temporal-Forces-Pull-Rates/28c0ad22-00a4-428f-b22d-e7fee9ec50bc/",
    "publisher": "TCGplayer",
    "date": "2024-03-22",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "16.83% ± 0.79% (1 in 6 Packs)",
     "perPack": 0.1683
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.67% ± 0.53% (1 in 15 Packs)",
     "perPack": 0.0667
    },
    {
     "pool": "ACE SPEC Rare",
     "asPrinted": "5% ± 0.46% (1 in 20 Packs)",
     "perPack": 0.05
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.72% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.0772
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.17% ± 0.23% (1 in 86 Packs)",
     "perPack": 0.0117
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.72% ± 0.18% (1 in 139 Packs)",
     "perPack": 0.0072
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "ACE SPEC Rare",
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23473": {
   "source": {
    "title": "Pokémon TCG: Twilight Masquerade Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Twilight-Masquerade-Pull-Rates/f3eea967-e5fb-4108-8655-bb1c89587628/",
    "publisher": "TCGplayer",
    "date": "2024-05-24",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "16.93% ± 0.79% (1 in 6 Packs)",
     "perPack": 0.1693
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.61% ± 0.52% (1 in 15 Packs)",
     "perPack": 0.0661
    },
    {
     "pool": "ACE SPEC Rare",
     "asPrinted": "5.06% ± 0.46% (1 in 20 Packs)",
     "perPack": 0.0506
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.73% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.0773
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.17% ± 0.23% (1 in 86 Packs)",
     "perPack": 0.0117
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.68% ± 0.17% (1 in 146 Packs)",
     "perPack": 0.0068
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "ACE SPEC Rare",
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23537": {
   "source": {
    "title": "Pokémon TCG: Stellar Crown Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Stellar-Crown-Pull-Rates/2c0743dd-dbd0-4504-9ff8-be5a72dd04d1/",
    "publisher": "TCGplayer",
    "date": "2024-09-13",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "16.9% ± 0.79% (1 in 6 Packs)",
     "perPack": 0.169
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.75% ± 0.53% (1 in 15 Packs)",
     "perPack": 0.0675
    },
    {
     "pool": "ACE SPEC Rare",
     "asPrinted": "4.94% ± 0.46% (1 in 20 Packs)",
     "perPack": 0.0494
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.79% ± 0.57% (1 in 13 Packs)",
     "perPack": 0.0779
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.11% ± 0.22% (1 in 90 Packs)",
     "perPack": 0.0111
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.73% ± 0.18% (1 in 137 Packs)",
     "perPack": 0.0073
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "ACE SPEC Rare",
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23651": {
   "source": {
    "title": "Pokémon TCG: Surging Sparks Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Surging-Sparks-Pull-Rates/6ccfb6ab-f26a-4ce8-bab5-5f91c85ec70e/",
    "publisher": "TCGplayer",
    "date": "2024-11-08",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "16.94% ± 0.79% (1 in 6 Packs)",
     "perPack": 0.1694
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.74% ± 0.53% (1 in 15 Packs)",
     "perPack": 0.0674
    },
    {
     "pool": "ACE SPEC Rare",
     "asPrinted": "5.03% ± 0.46% (1 in 20 Packs)",
     "perPack": 0.0503
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "7.67% ± 0.56% (1 in 13 Packs)",
     "perPack": 0.0767
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.15% ± 0.22% (1 in 87 Packs)",
     "perPack": 0.0115
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.53% ± 0.15% (1 in 188 Packs)",
     "perPack": 0.0053
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "ACE SPEC Rare",
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "23821": {
   "source": {
    "title": "Pokémon TCG: Prismatic Evolutions Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Prismatic-Evolutions-Pull-Rates/d94889ea-f76a-4a13-b74d-5b0b071220a7/",
    "publisher": "TCGplayer",
    "date": "2025-01-17",
    "sample": 1200
   },
   "rates": [
    {
     "pool": "Poke Ball Pattern",
     "asPrinted": "33.1% ± 2.6% (1 in 3 Packs)",
     "perPack": 0.331
    },
    {
     "pool": "Double Rare",
     "asPrinted": "16.51% ± 2.05% (1 in 6 Packs)",
     "perPack": 0.1651
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "7.46% ± 1.45% (1 in 13 Packs)",
     "perPack": 0.0746
    },
    {
     "pool": "ACE SPEC Rare",
     "asPrinted": "4.68% ± 1.17% (1 in 21 Packs)",
     "perPack": 0.0468
    },
    {
     "pool": "Master Ball Pattern",
     "asPrinted": "4.92% ± 1.19% (1 in 20 Packs)",
     "perPack": 0.0492
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "2.22% ± 0.81% (1 in 45 Packs)",
     "perPack": 0.0222
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.56% ± 0.41% (1 in 180 Packs)",
     "perPack": 0.0056
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Poke Ball Pattern",
    "ACE SPEC Rare",
    "Master Ball Pattern",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "SIR figure is the average number of SIRs per pack (God and \"Demigod\" packs exist); 1,200-pack sample."
  },
  "24073": {
   "source": {
    "title": "Pokémon TCG: Journey Together Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Journey-Together-Pull-Rates/1b9f379f-97cb-45cc-b6f6-a1a070a422cd/",
    "publisher": "TCGplayer",
    "date": "2025-03-28",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "20.29% ± 0.85% (1 in 5 Packs)",
     "perPack": 0.2029
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.54% ± 0.52% (1 in 15 Packs)",
     "perPack": 0.0654
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "8.5% ± 0.59% (1 in 12 Packs)",
     "perPack": 0.085
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.16% ± 0.23% (1 in 86 Packs)",
     "perPack": 0.0116
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.73% ± 0.18% (1 in 137 Packs)",
     "perPack": 0.0073
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "24269": {
   "source": {
    "title": "Pokémon TCG: Destined Rivals Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Destined-Rivals-Pull-Rates/43ba832e-44c9-45a4-ae2e-594df2defdda/",
    "publisher": "TCGplayer",
    "date": "2025-05-30",
    "sample": 8000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "19.83% ± 0.84% (1 in 5 Packs)",
     "perPack": 0.1983
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "6.39% ± 0.52% (1 in 16 Packs)",
     "perPack": 0.0639
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "8.29% ± 0.58% (1 in 12 Packs)",
     "perPack": 0.0829
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.06% ± 0.22% (1 in 94 Packs)",
     "perPack": 0.0106
    },
    {
     "pool": "Hyper Rare",
     "asPrinted": "0.67% ± 0.17% (1 in 149 Packs)",
     "perPack": 0.0067
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare",
    "Hyper Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ]
  },
  "24325": {
   "source": {
    "title": "Pokémon TCG: Black Bolt and White Flare Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Black-Bolt-and-White-Flare-Pull-Rates/bac92199-a2a7-4668-b4a4-2647a111776f/",
    "publisher": "TCGplayer",
    "date": "2025-07-21",
    "sample": 700
   },
   "rates": [
    {
     "pool": "Poke Ball Pattern",
     "asPrinted": "30.56% ± 3.36% (1 in 3 Packs)",
     "perPack": 0.3056
    },
    {
     "pool": "Double Rare",
     "asPrinted": "21.11% ± 2.98% (1 in 5 Packs)",
     "perPack": 0.2111
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "5.83% ± 1.71% (1 in 17 Packs)",
     "perPack": 0.0583
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "16.39% ± 2.7% (1 in 6 Packs)",
     "perPack": 0.1639
    },
    {
     "pool": "Master Ball Pattern",
     "asPrinted": "5.14% ± 1.61% (1 in 19 Packs)",
     "perPack": 0.0514
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.25% ± 0.81% (1 in 80 Packs)",
     "perPack": 0.0125
    },
    {
     "pool": "Black White Rare",
     "asPrinted": "Unknown"
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Poke Ball Pattern",
    "Illustration Rare",
    "Master Ball Pattern",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Black Bolt and White Flare share one 700-pack sample; no Black White Rare was found, so its odds are unknown."
  },
  "24326": {
   "source": {
    "title": "Pokémon TCG: Black Bolt and White Flare Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Black-Bolt-and-White-Flare-Pull-Rates/bac92199-a2a7-4668-b4a4-2647a111776f/",
    "publisher": "TCGplayer",
    "date": "2025-07-21",
    "sample": 700
   },
   "rates": [
    {
     "pool": "Poke Ball Pattern",
     "asPrinted": "30.56% ± 3.36% (1 in 3 Packs)",
     "perPack": 0.3056
    },
    {
     "pool": "Double Rare",
     "asPrinted": "21.11% ± 2.98% (1 in 5 Packs)",
     "perPack": 0.2111
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "5.83% ± 1.71% (1 in 17 Packs)",
     "perPack": 0.0583
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "16.39% ± 2.7% (1 in 6 Packs)",
     "perPack": 0.1639
    },
    {
     "pool": "Master Ball Pattern",
     "asPrinted": "5.14% ± 1.61% (1 in 19 Packs)",
     "perPack": 0.0514
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.25% ± 0.81% (1 in 80 Packs)",
     "perPack": 0.0125
    },
    {
     "pool": "Black White Rare",
     "asPrinted": "Unknown"
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Poke Ball Pattern",
    "Illustration Rare",
    "Master Ball Pattern",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Black Bolt and White Flare share one 700-pack sample; no Black White Rare was found, so its odds are unknown."
  },
  "24380": {
   "source": {
    "title": "Pokémon TCG: Mega Evolution Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Mega-Evolution-Pull-Rates/40cbeedc-21ce-473b-aef1-74e3969d9f91/",
    "publisher": "TCGplayer",
    "date": "2025-09-30",
    "sample": 5000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "20.91% ± 1.12% (1 in 5 Packs)",
     "perPack": 0.2091
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "8.23% ± 0.76% (1 in 12 Packs)",
     "perPack": 0.0823
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "10.89% ± 0.86% (1 in 9 Packs)",
     "perPack": 0.1089
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "0.99% ± 0.27% (1 in 101 Packs)",
     "perPack": 0.0099
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.08% ± 0.08% (1 in 1260 Packs)",
     "perPack": 0.0008
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Mega Hyper Rare odds rest on a handful of pulls (confidence range as wide as the estimate)."
  },
  "24448": {
   "source": {
    "title": "Pokémon TCG: Phantasmal Flames Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Phantasmal-Flames-Pull-Rates/9abae60d-b7fb-448f-874e-176f78d6a6ca/",
    "publisher": "TCGplayer",
    "date": "2025-11-15",
    "sample": 5000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "20.77% ± 1.12% (1 in 5 Packs)",
     "perPack": 0.2077
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "8.06% ± 0.75% (1 in 12 Packs)",
     "perPack": 0.0806
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "10.97% ± 0.86% (1 in 9 Packs)",
     "perPack": 0.1097
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.25% ± 0.31% (1 in 80 Packs)",
     "perPack": 0.0125
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.08% ± 0.08% (1 in 1260 Packs)",
     "perPack": 0.0008
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Mega Hyper Rare odds rest on a handful of pulls (confidence range as wide as the estimate)."
  },
  "24541": {
   "source": {
    "title": "Pokémon TCG: Ascended Heroes Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Ascended-Heroes-Pull-Rates/60143d94-88a7-42ce-8e73-babd7b3fabd6/",
    "publisher": "TCGplayer",
    "date": "2026-02-24",
    "sample": 2000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "20.37% ± 1.7% (1 in 5 Packs)",
     "perPack": 0.2037
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "4.81% ± 0.9% (1 in 21 Packs)",
     "perPack": 0.0481
    },
    {
     "pool": "Mega Attack Rare",
     "asPrinted": "3.47% ± 0.77% (1 in 29 Packs)",
     "perPack": 0.0347
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "11.25% ± 1.33% (1 in 9 Packs)",
     "perPack": 0.1125
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.44% ± 0.5% (1 in 70 Packs)",
     "perPack": 0.0144
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.19% ± 0.18% (1 in 540 Packs)",
     "perPack": 0.0019
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare",
    "Mega Attack Rare"
   ],
   "caveats": "Poké Ball, Friend Ball and other pattern reverse holos are counted at the plain reverse-holo average; no pattern odds are published. Mega Hyper Rare odds rest on a handful of pulls (confidence range as wide as the estimate)."
  },
  "24587": {
   "source": {
    "title": "Pokémon TCG: Perfect Order Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Perfect-Order-Pull-Rates/73148119-ebcb-40b7-84b6-52b3a6d0c631/",
    "publisher": "TCGplayer",
    "date": "2026-04-03",
    "sample": 3500
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "20.97% ± 1.34% (1 in 5 Packs)",
     "perPack": 0.2097
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "8.54% ± 0.92% (1 in 12 Packs)",
     "perPack": 0.0854
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "11.2% ± 1.03% (1 in 9 Packs)",
     "perPack": 0.112
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.23% ± 0.36% (1 in 81 Packs)",
     "perPack": 0.0123
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.06% ± 0.08% (1 in 1786 Packs)",
     "perPack": 0.0006
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Mega Hyper Rare odds rest on a handful of pulls (confidence range as wide as the estimate)."
  },
  "24655": {
   "source": {
    "title": "Pokémon TCG: Chaos Rising Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Chaos-Rising-Pull-Rates/304e8bfc-175a-4d31-93fe-5bb1be11e5d2/",
    "publisher": "TCGplayer",
    "date": "2026-06-04",
    "sample": 8500
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "20.3% ± 0.85% (1 in 5 Packs)",
     "perPack": 0.203
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "8.29% ± 0.58% (1 in 12 Packs)",
     "perPack": 0.0829
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "10.66% ± 0.65% (1 in 9 Packs)",
     "perPack": 0.1066
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.21% ± 0.23% (1 in 83 Packs)",
     "perPack": 0.0121
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.1% ± 0.07% (1 in 956 Packs)",
     "perPack": 0.001
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Mega Hyper Rare odds rest on a handful of pulls (confidence range as wide as the estimate)."
  },
  "24688": {
   "source": {
    "title": "Pokémon TCG: Pitch Black Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-Pitch-Black-Pull-Rates/069a5fda-2d1f-44a1-97de-b6dcdc5abfb8/",
    "publisher": "TCGplayer",
    "date": "2026-07-21",
    "sample": 4000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "21.02% ± 1.21% (1 in 5 Packs)",
     "perPack": 0.2102
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "8.3% ± 0.82% (1 in 12 Packs)",
     "perPack": 0.083
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "11.01% ± 0.93% (1 in 9 Packs)",
     "perPack": 0.1101
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.25% ± 0.33% (1 in 80 Packs)",
     "perPack": 0.0125
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.09% ± 0.09% (1 in 1081 Packs)",
     "perPack": 0.0009
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "caveats": "Mega Hyper Rare odds rest on a handful of pulls (confidence range as wide as the estimate)."
  },
  "24722": {
   "source": {
    "title": "Pokémon TCG: 30th Celebration Pull Rates",
    "url": "https://www.tcgplayer.com/content/article/Pok%C3%A9mon-TCG-30th-Celebration-Pull-Rates/587b3657-481a-4ab8-827c-68cd3ab585b0/",
    "publisher": "TCGplayer",
    "date": "2026-09-24",
    "sample": 3000
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "21.02% ± 1.21% (1 in 5 Packs)",
     "perPack": 0.2102
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "19.72% ± 1.37% (1 in 5 Packs)",
     "perPack": 0.1972
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "4.88% ± 0.74% (1 in 21 Packs)",
     "perPack": 0.0488
    },
    {
     "pool": "Futuristic Rare",
     "asPrinted": "0.83% ± 0.31% (1 in 120 Packs)",
     "perPack": 0.0083
    },
    {
     "pool": "RGB Rare",
     "asPrinted": "Unknown"
    },
    {
     "pool": "Pikachu Rare",
     "asPrinted": "100% (1 in 1 Packs)",
     "perPack": 1
    }
   ],
   "structure": null,
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare"
   ],
   "caveats": "5-card packs with their own layout, and the \"Classic Collection\" odds have no matching TCGplayer rarity, so this EV covers the listed rarities only. Not modelled (no matching TCGplayer product group): Classic Collection: 10.15% ± 1.04% (1 in 10 Packs)."
  },
  "24831": {
   "source": {
    "title": "Delta Reign Pull Rates & Pack Odds — 252 Packs Opened Pre-Release (2026)",
    "url": "https://tcgtalk.com/guides/delta-reign-pull-rates",
    "publisher": "TCGTalk",
    "date": null,
    "sample": 252
   },
   "rates": [
    {
     "pool": "Double Rare",
     "asPrinted": "22.6% (1 in 4.4 Packs)",
     "perPack": 0.226
    },
    {
     "pool": "Illustration Rare",
     "asPrinted": "9.5% (1 in null Packs)",
     "perPack": 0.095
    },
    {
     "pool": "Ultra Rare",
     "asPrinted": "8.7% (1 in null Packs)",
     "perPack": 0.087
    },
    {
     "pool": "Special Illustration Rare",
     "asPrinted": "1.6% (1 in null Packs)",
     "perPack": 0.016
    },
    {
     "pool": "Mega Hyper Rare",
     "asPrinted": "0.4% (1 in null Packs)",
     "perPack": 0.004
    },
    {
     "pool": "Rare",
     "asPrinted": "57.1% (1 in null Packs)",
     "perPack": 0.571
    }
   ],
   "structure": {
    "commons": 4,
    "uncommons": 3,
    "reverse": 2,
    "source": {
     "title": "Bulbapedia: Booster pack (TCG), international Scarlet & Violet layout (4 commons, 3 uncommons, 2 reverse-holo slots, 1 rare slot)",
     "url": "https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)"
    }
   },
   "replacesReverse": [
    "Illustration Rare",
    "Special Illustration Rare"
   ],
   "rareSlot": [
    "Double Rare",
    "Ultra Rare"
   ],
   "confidence": "low",
   "caveats": "Early community sample of 252 packs, each pack counted once by its best card; SIR rests on 4 pulls and Mega Hyper Rare on 1."
  }
 }
};
})(typeof window!=='undefined'?window:globalThis);
