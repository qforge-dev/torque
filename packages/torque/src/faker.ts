import { Faker, en } from "@faker-js/faker";
import { random } from "./utils";

// Custom randomizer that integrates with torque's seed system
const customRandomizer = {
  next: () => random(),
  seed: () => {}, // no-op, seeding is handled by torque's withSeed
};

export const faker = new Faker({
  locale: en,
  randomizer: customRandomizer,
});

