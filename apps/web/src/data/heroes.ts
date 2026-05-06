/**
 * Playable heroes for the composer (ids = `HeroId` for `@teamcomposer/optimizer`).
 * Names and roles follow the live game; verify on the official roster.
 * @see https://www.marvelrivals.com/heroes/index.html?heroId=0
 * @see https://www.marvelrivals.com/heroes/
 */

export type HeroRole = "Vanguard" | "Duelist" | "Strategist";

export interface Hero {
  id: string;
  name: string;
  role: HeroRole;
}

export const HERO_CATALOG: readonly Hero[] = [
  // Vanguard
  { id: "angela", name: "Angela", role: "Vanguard" },
  { id: "captain-america", name: "Captain America", role: "Vanguard" },
  { id: "doctor-strange", name: "Doctor Strange", role: "Vanguard" },
  { id: "emma-frost", name: "Emma Frost", role: "Vanguard" },
  { id: "groot", name: "Groot", role: "Vanguard" },
  { id: "hulk", name: "Hulk", role: "Vanguard" },
  { id: "magneto", name: "Magneto", role: "Vanguard" },
  { id: "peni-parker", name: "Peni Parker", role: "Vanguard" },
  { id: "deadpool-vanguard", name: "Deadpool (Vanguard)", role: "Vanguard" },
  { id: "rogue", name: "Rogue", role: "Vanguard" },
  { id: "the-thing", name: "The Thing", role: "Vanguard" },
  { id: "thor", name: "Thor", role: "Vanguard" },
  { id: "venom", name: "Venom", role: "Vanguard" },
  // Duelist
  { id: "black-cat", name: "Black Cat", role: "Duelist" },
  { id: "black-panther", name: "Black Panther", role: "Duelist" },
  { id: "black-widow", name: "Black Widow", role: "Duelist" },
  { id: "blade", name: "Blade", role: "Duelist" },
  { id: "daredevil", name: "Daredevil", role: "Duelist" },
  { id: "deadpool-duelist", name: "Deadpool (Duelist)", role: "Duelist" },
  { id: "elsa-bloodstone", name: "Elsa Bloodstone", role: "Duelist" },
  { id: "hawkeye", name: "Hawkeye", role: "Duelist" },
  { id: "hela", name: "Hela", role: "Duelist" },
  { id: "human-torch", name: "Human Torch", role: "Duelist" },
  { id: "iron-fist", name: "Iron Fist", role: "Duelist" },
  { id: "iron-man", name: "Iron Man", role: "Duelist" },
  { id: "magik", name: "Magik", role: "Duelist" },
  { id: "mister-fantastic", name: "Mister Fantastic", role: "Duelist" },
  { id: "moon-knight", name: "Moon Knight", role: "Duelist" },
  { id: "namor", name: "Namor", role: "Duelist" },
  { id: "phoenix", name: "Phoenix", role: "Duelist" },
  { id: "psylocke", name: "Psylocke", role: "Duelist" },
  { id: "punisher", name: "The Punisher", role: "Duelist" },
  { id: "scarlet-witch", name: "Scarlet Witch", role: "Duelist" },
  { id: "spider-man", name: "Spider-Man", role: "Duelist" },
  { id: "squirrel-girl", name: "Squirrel Girl", role: "Duelist" },
  { id: "star-lord", name: "Star-Lord", role: "Duelist" },
  { id: "storm", name: "Storm", role: "Duelist" },
  { id: "winter-soldier", name: "Winter Soldier", role: "Duelist" },
  { id: "wolverine", name: "Wolverine", role: "Duelist" },
  // Strategist
  { id: "adam-warlock", name: "Adam Warlock", role: "Strategist" },
  { id: "cloak-dagger", name: "Cloak & Dagger", role: "Strategist" },
  { id: "gambit", name: "Gambit", role: "Strategist" },
  { id: "invisible-woman", name: "Invisible Woman", role: "Strategist" },
  { id: "jeff", name: "Jeff the Land Shark", role: "Strategist" },
  { id: "loki", name: "Loki", role: "Strategist" },
  { id: "luna-snow", name: "Luna Snow", role: "Strategist" },
  { id: "mantis", name: "Mantis", role: "Strategist" },
  { id: "deadpool-strategist", name: "Deadpool (Strategist)", role: "Strategist" },
  { id: "rocket-raccoon", name: "Rocket Raccoon", role: "Strategist" },
  { id: "ultron", name: "Ultron", role: "Strategist" },
  { id: "white-fox", name: "White Fox", role: "Strategist" },
] as const;
