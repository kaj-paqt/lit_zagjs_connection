// spreadProps.ts
import { Part, noChange } from "lit";
import { directive, Directive } from "lit/directive.js";

class SpreadPropsDirective extends Directive {
  render(_props: Record<string, any>) {
    return noChange;
  }

  update(part: Part, [props]: [Record<string, any>]) {
    const element = part.element as HTMLElement;

    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith("data-") || key.startsWith("aria-")) {
        if (value === undefined || value === false || value === null) {
          element.removeAttribute(key);
        } else {
          element.setAttribute(key, String(value));
        }
      } else if (key === "style" && typeof value === "object") {
        Object.assign(element.style, value);
      } else if (key.startsWith("on") && typeof value === "function") {
        // Add event listener (e.g., onclick, onblur)
        const event = key.slice(2).toLowerCase();
        element.addEventListener(event, value);
      } else if (value === false || value === undefined || value === null) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, String(value));
      }
    }

    return noChange;
  }
}

export const spreadProps = directive(SpreadPropsDirective);
