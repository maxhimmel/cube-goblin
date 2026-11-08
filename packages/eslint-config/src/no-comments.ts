import type { Rule } from "eslint";

const DIRECTIVE = /^\s*(eslint|@ts-expect-error|@ts-ignore|global\s)/u;

export const noComments: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow code comments; code and names carry the meaning." },
    messages: { noComment: "Comments are not allowed. Express intent through naming instead." },
    schema: [],
  },
  create(context) {
    const hasShebang = context.sourceCode.text.startsWith("#!");
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const isShebang = hasShebang && comment.range?.[0] === 0;
          if (isShebang || DIRECTIVE.test(comment.value) || !comment.loc) {
            continue;
          }
          context.report({ loc: comment.loc, messageId: "noComment" });
        }
      },
    };
  },
};
