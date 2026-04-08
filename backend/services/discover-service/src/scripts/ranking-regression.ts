import { type FeedCandidate } from "../data";
import { applyFiltersAndRank, parseFeedPreferences } from "../ranking";

const assertTrue = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const scenarioA = () => {
  const preferences = parseFeedPreferences({
    ageMin: "18",
    ageMax: "65",
    distanceKm: "100",
    launchCity: "Voronezh",
    genderPreference: "everyone",
  });
  const ranked = applyFiltersAndRank(["all"], preferences, null, new Set<string>());
  const voronezhIndex = ranked.findIndex((candidate) => candidate.id === "u-3");
  const saintPetersburgIndex = ranked.findIndex((candidate) => candidate.id === "u-2");

  assertTrue(voronezhIndex >= 0, "Scenario A: expected Voronezh candidate to exist");
  assertTrue(saintPetersburgIndex >= 0, "Scenario A: expected Saint Petersburg candidate to exist");
  assertTrue(
    voronezhIndex < saintPetersburgIndex,
    "Scenario A regression: launch-city profile should rank above non-local profile with no strong signal",
  );
};

const scenarioB = () => {
  const preferences = parseFeedPreferences({
    ageMin: "18",
    ageMax: "65",
    distanceKm: "100",
    launchCity: "Moscow",
    originCountry: "russian",
    genderPreference: "everyone",
  });
  const ranked = applyFiltersAndRank(["all"], preferences, null, new Set<string>());
  const topTwo = ranked.slice(0, 2);
  const hasLocalInTopTwo = topTwo.some((candidate) => candidate.city.toLowerCase() === "moscow");
  const topOneIsCrossNationality = topTwo[0]?.originCountry.toLowerCase() !== "russian";

  assertTrue(hasLocalInTopTwo, "Scenario B regression: local city profile dropped out of top-2 unexpectedly");
  assertTrue(topOneIsCrossNationality, "Scenario B regression: cross-national boost no longer effective at top");
};

const scenarioC = () => {
  const syntheticCandidates: FeedCandidate[] = [
    {
      id: "mono-lang",
      name: "Mono",
      gender: "women",
      age: 24,
      city: "Moscow",
      originCountry: "russian",
      distanceKm: 3,
      languages: ["English"],
      bio: "Mono language profile",
      photos: ["https://example.com/mono.jpg"],
      compatibility: 80,
      interests: ["Art"],
      online: true,
      flags: {
        verifiedIdentity: false,
        premiumTier: "free",
        hideAge: false,
        hideDistance: false,
        shadowGhost: false,
      },
      rankScore: 50,
      scoreReason: "seed",
    },
    {
      id: "multi-lang",
      name: "Multi",
      gender: "women",
      age: 24,
      city: "Moscow",
      originCountry: "russian",
      distanceKm: 3,
      languages: ["English", "French", "Spanish", "Italian", "German"],
      bio: "Multi language profile",
      photos: ["https://example.com/multi.jpg"],
      compatibility: 80,
      interests: ["Art"],
      online: true,
      flags: {
        verifiedIdentity: false,
        premiumTier: "free",
        hideAge: false,
        hideDistance: false,
        shadowGhost: false,
      },
      rankScore: 50,
      scoreReason: "seed",
    },
  ];

  const preferences = parseFeedPreferences({
    ageMin: "18",
    ageMax: "65",
    distanceKm: "100",
    userLanguages: "english",
    genderPreference: "everyone",
  });
  const ranked = applyFiltersAndRank(["all"], preferences, null, new Set<string>(), syntheticCandidates);
  const mono = ranked.find((candidate) => candidate.id === "mono-lang");
  const multi = ranked.find((candidate) => candidate.id === "multi-lang");

  assertTrue(Boolean(mono && multi), "Scenario C: expected both synthetic candidates to exist");
  assertTrue((multi?.rankScore ?? 0) > (mono?.rankScore ?? 0), "Scenario C regression: language diversity lost impact");
  assertTrue(
    (multi?.rankScore ?? 0) - 50 <= 10,
    "Scenario C regression: language diversity cap exceeded (+10 max expected)",
  );
};

const run = () => {
  scenarioA();
  scenarioB();
  scenarioC();
  // eslint-disable-next-line no-console
  console.log("Ranking regression checks passed (A/B/C).");
};

run();
