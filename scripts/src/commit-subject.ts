import rules from "@commitlint/rules";
import type { RuleConfigCondition, SyncRule, TargetCaseType } from "@commitlint/types";

type ParsedCommit = Parameters<SyncRule>[0];

export const TICKET_PREFIX = /^(?:T-\d+[,:]?\s+)+/u;

export const subjectCaseAfterTicket: SyncRule<TargetCaseType[]> = (
  parsed: ParsedCommit,
  when?: RuleConfigCondition,
  value?: TargetCaseType[],
) => {
  const subject = parsed["subject"]?.replace(TICKET_PREFIX, "") ?? null;
  const rule = rules["subject-case"] as SyncRule<TargetCaseType[]>;
  return rule(Object.assign({}, parsed, { subject }), when, value);
};
