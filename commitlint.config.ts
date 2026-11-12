import type { UserConfig } from "@commitlint/types";
import { subjectCaseAfterTicket } from "./scripts/src/commit-subject.ts";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "subject-case-after-ticket": subjectCaseAfterTicket } }],
  rules: {
    "subject-case": [0],
    "subject-case-after-ticket": [
      2,
      "never",
      ["sentence-case", "start-case", "pascal-case", "upper-case"],
    ],
  },
};

export default config;
