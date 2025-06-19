import { createNormalizer } from "@zag-js/types";
import { isObject, isString } from "@zag-js/utils";

const booleanAttr = `allowFullscreen,allowTransparency,allowpopups,autosize,async,autoFocus,autoPlay,contentEditable,controls,checked,controls,defer,default,disabled,formNovalidate,frame,hidden,indeterminate,inert,isMap,loop,multiple,muted,noModule,noValidate,open,popover,playsInline,readOnly,required,reversed,scoped,seamless,selected`;
const booleanAttrs = new Set(booleanAttr.split(","));

const eventMap: any = {
  onDoubleClick: "onDblClick",
  onChange: "onInput",
  defaultChecked: "checked",
  defaultValue: "value",
  htmlFor: "for",
  className: "class",
};

function toProp(prop: string) {
  return prop in eventMap ? eventMap[prop] : prop;
}

type Dict = Record<string, any>;

export const normalizeProps = createNormalizer<any>((props: Dict) => {
  const normalized: Dict = {};

  // if (import.meta.env.DEV) {
  //   console.groupCollapsed("[normalizeProps] Normalizing props:");
  //   console.log("🔹 Incoming props:", props);
  // }

  for (const key in props) {
    let value = props[key];

    // ✅ Skip `undefined` or `symbol` values (they crash spread/rendering)
    if (value === undefined || typeof value === "symbol") continue;

    let reason = "";

    if (key === "style" && isObject(value)) {
      normalized["style"] = cssify(value);
      reason = "→ style object → css string";
      // devLog(key, value, normalized["style"], reason);
      continue;
    }

    if (booleanAttrs.has(key)) {
      if (value === false) continue; // ✅ omit false boolean attributes
      normalized[key] = "";
      reason = "→ boolean attribute";
      // devLog(key, props[key], "", reason);
      continue;
    }

    if (key === "children") {
      if (isString(value)) {
        normalized["textContent"] = value;
        reason = "→ children → textContent";
        // devLog(key, value, value, reason);
      }
      continue;
    }

    if (key === "dir") continue;

    const nextKey = toProp(key);
    if (typeof value === "function" && key.startsWith("on") && key.length > 2) {
      const eventName = key.slice(2).toLowerCase(); // onPointerEnter → pointerenter
      normalized[`@${eventName}`] = value;
      continue; // Don't fall through to regular prop assignment
    }

    if (nextKey === "checked") {
      console.log(`[normalizeProps] Handling "checked":`, {
        rawValue: value,
        stringified: safeStringify(value),
        type: typeof value,
        willRenderAs: value === true ? 'checked=""' : "(omitted)",
      });
    }
    normalized[nextKey] = value;

    if (nextKey !== key) {
      reason = `→ remapped key "${key}" → "${nextKey}"`;
    }

    // devLog(key, value, value, reason);
  }

  // if (import.meta.env.DEV) {
  //   console.log("✅ Final normalized props:", normalized);
  //   console.groupEnd();
  // }

  return normalized;
});

function safeStringify(val: unknown) {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return "[unstringifiable]";
  }
}

function cssify(style: Record<string, number | string>) {
  let string = "";
  for (let key in style) {
    const value = style[key];
    if (value == null) continue;
    if (!key.startsWith("--")) {
      key = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    }
    string += `${key}:${value};`;
  }
  return string;
}

function devLog(key: string, input: any, output: any, reason: string) {
  if (import.meta.env.DEV) {
    console.log(`  🛠 "${key}":`, {
      input,
      output,
      reason: reason || "→ passthrough",
    });
  }
}
