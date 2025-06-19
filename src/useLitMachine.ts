import { CustomService } from "./custom-service";
import type { Machine, MachineSchema, EventObject } from "@zag-js/core";

interface LitActor<T extends MachineSchema> {
  state: { value: T["state"] };
  send: (event: EventObject) => void;
  subscribe: (fn: (s: { value: T["state"] }) => void) => () => void;
}

export function useLitMachine<T extends MachineSchema>(
  machine: Machine<T>,
  context: T["context"],
  props?: Partial<T["props"]>
): {
  service: CustomService<T>;
  actor: LitActor<T>;
} {
  const service = new CustomService(machine, context, props);

  const stateObj = { value: service.state.value };

  const actor: LitActor<T> = {
    state: stateObj,
    send: service.send,
    subscribe: (fn) => {
      fn(stateObj); // immediately notify with current state
      return service.subscribe((next) => {
        stateObj.value = next;
        fn(stateObj);
      });
    },
  };

  return { service, actor };
}
