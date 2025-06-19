// spreadProps.ts
import { directive, Directive } from "lit/directive.js";
import { AttributePart, PartType } from "lit";

class SpreadDirective extends Directive {
  render(_props: Record<string, any>) {}
  update(part: AttributePart, [props]: [Record<string, any>]) {
    const element = part.element as HTMLElement;

    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith("data-") || key.startsWith("aria-")) {
        element.setAttribute(key, String(value));
      } else if (key === "style" && typeof value === "object") {
        Object.assign((element as HTMLElement).style, value);
      } else if (value === false || value === undefined || value === null) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, String(value));
      }
    }

    return;
  }
}

export const spreadProps = directive(SpreadDirective);
