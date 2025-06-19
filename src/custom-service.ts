import {
  createScope,
  MachineStatus,
  type Machine,
  type MachineSchema,
  type EventObject,
  type Scope,
  type BindableContext,
  type PropFn,
  type ComputedFn,
  type BindableRefs,
  type Params,
} from "@zag-js/core";
interface MachineBaseProps {
  id?: string | undefined;
  ids?: Record<string, any> | undefined;
  getRootNode?: (() => ShadowRoot | Document | Node) | undefined;
  [key: string]: any;
}
type ValueOrFn<T> = T | ((prev: T) => T);
interface Bindable<T> {
  initial: T | undefined;
  ref: any;
  get: () => T;
  set(value: ValueOrFn<T>): void;
  invoke(nextValue: T, prevValue: T): void;
  hash(value: T): string;
}
type State<T extends MachineSchema> = Bindable<T["state"]> & {
  value: T["state"];
  hasTag: (tag: T["tag"]) => boolean;
  matches: (...values: T["state"][]) => boolean;
};
type EventType<T = any> = T & {
  previousEvent?: T & {
    [key: string]: any;
  };
  src?: string;
  [key: string]: any;
};

function createBindableContext<T extends MachineSchema>(
  props: T["context"]
): BindableContext<T> {
  type Ctx = NonNullable<T["context"]>;
  type Key = keyof Ctx;

  const internal = { ...props } as Ctx;
  const initialValues = { ...props } as Ctx;

  const keys = Object.keys(initialValues);

  const ctx: BindableContext<T> = {
    get<K extends Key>(key: K): Ctx[K] {
      const value = internal[key];
      return value;
    },

    set<K extends Key>(key: K, value: ValueOrFn<Ctx[K]>): void {
      const prev = internal[key];
      const nextVal =
        typeof value === "function"
          ? (value as (prev: Ctx[K]) => Ctx[K])(prev)
          : value;

      internal[key] = nextVal;

      console.log(
        `[BindableContext] set(${String(key)}) from`,
        prev,
        "to",
        nextVal
      );

      (globalThis as any).ctxUpdate?.();
    },

    initial<K extends Key>(key: K): Ctx[K] {
      const initVal = initialValues[key];
      return initVal;
    },

    hash<K extends Key>(key: K): string {
      const val = internal[key];
      const hash = JSON.stringify(val);
      return hash;
    },
  };

  Object.defineProperty(ctx, "__keys", {
    value: keys,
    enumerable: false,
    writable: false,
  });

  console.groupEnd();
  return ctx;
}

export class CustomService<T extends MachineSchema> {
  private machine: Machine<T>;
  private _currentEvent: EventObject | null = null;
  private _previousEvent: EventObject | null = null;
  private onTransition?: (state: T["state"]) => void;
  private status: MachineStatus = MachineStatus.NotStarted;

  public context: BindableContext<T>;
  public state!: State<T>;
  public refs: BindableRefs<T> = {
    get: () => undefined as any,
    set: () => {},
  };
  public scope: Scope;

  private props: T["props"] = {} as T["props"];

  private listeners: Array<(state: T["state"]) => void> = [];

  public subscribe(fn: (state: T["state"]) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  public get event(): EventType<T["event"]> & {
    current: () => EventType<T["event"]>;
    previous: () => EventType<T["event"]>;
  } {
    return {
      type: this._currentEvent?.type ?? "UNKNOWN",
      ...(this._currentEvent ?? {}),
      previousEvent: this._previousEvent ?? undefined,
      src: (this._currentEvent as any)?.src ?? undefined,
      current: () =>
        (this._currentEvent ?? { type: "UNKNOWN" }) as EventType<T["event"]>,
      previous: () =>
        (this._previousEvent ?? { type: "UNKNOWN" }) as EventType<T["event"]>,
    };
  }

  constructor(
    machine: Machine<T>,
    initialContext?: T["context"],
    props: Partial<T["props"]> = {},
    onTransition?: (state: T["state"]) => void
  ) {
    this.machine = machine;

    this.context = createBindableContext<T>(
      (initialContext ?? {}) as T["context"]
    );

    this.onTransition = onTransition;

    const baseProps = props as Partial<MachineBaseProps>;

    this.scope = createScope({
      id: baseProps.id,
      ids: baseProps.ids,
      getRootNode: baseProps.getRootNode ?? (() => document),
    });

    const defaulted =
      typeof machine.props === "function"
        ? machine.props({ props, scope: this.scope })
        : {};

    this.props = {
      ...defaulted,
      ...props,
    };

    const initialState = this.machine.initialState({
      prop: this.prop,
    }) as T["state"];

    this.createState(initialState);

    if (typeof machine.refs === "function") {
      this.refs = machine.refs({
        prop: this.prop,
        context: this.context,
      });
    }

    const computedFns = (this.machine as any).computed ?? {};
    const context = this.context;
    const prop = this.prop;

    const computedFn = ((key: any) => {
      const fn = computedFns?.[key];
      return typeof fn === "function" ? fn({ context, prop }) : undefined;
    }) as ComputedFn<T> & Record<string, any>;

    Object.keys(computedFns).forEach((key) => {
      Object.defineProperty(computedFn, key, {
        get: () => computedFn(key),
        enumerable: true,
      });
    });

    this.computed = computedFn;

    Object.assign(this, this.computed);
  }

  public prop: PropFn<T> = <K extends keyof T["props"]>(
    key: K
  ): T["props"][K] => {
    const val = this.props[key];
    return val;
  };

  private runEffects() {
    const params: Params<T> = {
      context: this.context,
      event: this.event,
      prop: this.prop,
      refs: this.refs,
      computed: this.computed,
      state: this.state,
      scope: this.scope,
      send: this.send,
      flush: (fn) => fn(),
      action: () => {},
      track: () => {},
      choose: () => undefined,
      guard: () => undefined,
    };

    const run = (effects: typeof this.machine.effects | undefined) => {
      if (!effects) return;
      const effList = typeof effects === "function" ? effects(params) : effects;
      const arr = Array.isArray(effList) ? effList : [effList];

      for (const eff of arr) {
        const fn =
          typeof eff === "string"
            ? this.machine.implementations?.effects?.[eff]
            : typeof eff === "function"
            ? eff
            : undefined;

        if (typeof fn === "function") {
          const cleanup = fn(params);
        }
      }
    };

    run(this.machine.effects);
    const stateDef = this.machine.states[this.state.value as T["state"]];
    run(stateDef?.effects);
  }

  private createState(value: T["state"]) {
    let internal = value;

    this.state = {
      value: internal,
      initial: internal,
      ref: () => {
        return () => internal;
      },
      get: () => internal,
      set: (next) => {
        const resolved = typeof next === "function" ? next(internal) : next;
        if (resolved !== internal) {
          internal = resolved;
          this.state.value = resolved;

          Object.assign(this, this.computed);

          this.listeners.forEach((fn) => fn(resolved));

          this.onTransition?.(resolved);
        }
      },
      invoke: (next, prev) => {
        if (next !== prev) {
          this.state.set(next);
        }
      },
      hash: () => {
        try {
          return JSON.stringify(internal);
        } catch {
          return String(internal);
        }
      },
      matches: (...values: T["state"][]) => values.includes(internal),
      hasTag: (tag: T["tag"]) => {
        const tagged = (this.machine as any).tags?.[internal] ?? [];
        return Array.isArray(tagged) ? tagged.includes(tag) : tagged === tag;
      },
    };

    (this.state as any).context = this.contextSnapshot();

    Object.assign(this.state, {
      subscribe: (fn: (value: T["state"]) => void) => {
        listeners.push(fn);
        return () => {
          const i = listeners.indexOf(fn);
          if (i > -1) listeners.splice(i, 1);
        };
      },
    });
  }

  public getSnapshot(): T["state"] {
    return this.state.value;
  }

  public send = (event: EventObject) => {
    this._previousEvent = this._currentEvent;
    this._currentEvent = event;

    const currentState = this.state.value;
    const stateDef = this.machine.states[currentState];
    const rootTransitions = this.machine.on ?? {};
    const localTransitions = stateDef?.on ?? {};
    const transitions = { ...rootTransitions, ...localTransitions };
    const transitionTarget = transitions[event.type];

    console.log("[CustomService] send event:", {
      type: event.type,
      currentState,
      transitionTarget,
    });

    if (!transitionTarget) {
      return;
    }

    let nextState: T["state"] | undefined;
    let actionsToRun: string[] = [];

    const buildGuardParams = (): Params<T> => ({
      context: this.context,
      event: this.event,
      prop: this.prop,
      refs: this.refs,
      computed: this.computed,
      state: this.state,
      scope: this.scope,
      send: this.send,
      flush: (fn) => fn(),
      action: () => {},
      track: () => {},
      choose: () => undefined,
      guard: () => undefined,
    });

    if (typeof transitionTarget === "string") {
      nextState = transitionTarget;
    } else if (Array.isArray(transitionTarget)) {
      const guards = this.machine.implementations?.guards ?? {};
      const found = transitionTarget.find((t) => {
        const guardName = t.guard;
        if (!guardName) return true;
        const guardFn = guards[guardName];
        return typeof guardFn === "function"
          ? guardFn(buildGuardParams())
          : true;
      });

      if (!found) return;

      nextState = found.target;
      actionsToRun = Array.isArray(found.actions)
        ? found.actions.filter((a): a is string => typeof a === "string")
        : typeof found.actions === "string"
        ? [found.actions]
        : [];
    } else {
      const guards = this.machine.implementations?.guards ?? {};
      const guardName = transitionTarget.guard;
      const guardFn = guardName ? guards[guardName] : undefined;

      if (guardFn && !guardFn(buildGuardParams())) return;

      nextState = transitionTarget.target;
      actionsToRun = Array.isArray(transitionTarget.actions)
        ? transitionTarget.actions.filter(
            (a): a is string => typeof a === "string"
          )
        : typeof transitionTarget.actions === "string"
        ? [transitionTarget.actions]
        : [];
    }

    const rawActions = this.machine.implementations?.actions ?? {};
    const actions = rawActions as Record<string, (params: Params<T>) => void>;

    const actionParams: Params<T> = buildGuardParams();

    for (const action of actionsToRun) {
      const fn = actions[action];
      if (typeof fn === "function") {
        fn(actionParams);
      }
    }

    if (nextState) {
      const nextStateDef = this.machine.states[nextState];
      const entry = nextStateDef?.entry ?? [];
      const entryActions = Array.isArray(entry) ? entry : [entry];

      for (const action of entryActions) {
        const fn =
          typeof action === "string"
            ? actions[action]
            : typeof action === "function"
            ? action
            : undefined;

        if (typeof fn === "function") {
          fn(actionParams);
        }
      }

      this.state.set(nextState);
      this.runEffects();
      this.runEntryActions(nextState);
    }

    console.log("[CustomService] ctx.checked:", this.context.get("checked"));
  };

  private buildParams(): Params<T> {
    return {
      context: this.context,
      event: this.event,
      prop: this.prop,
      refs: this.refs,
      computed: this.computed,
      state: this.state,
      scope: this.scope,
      send: this.send,
      flush: (fn) => fn(),
      action: () => {},
      track: () => {},
      choose: () => undefined,
      guard: () => undefined,
    };
  }

  private transitionTo(state: T["state"], actions: string[] = []) {
    const actionFns = this.machine.implementations?.actions ?? {};
    const params = this.buildParams();

    for (const action of actions) {
      const fn = actionFns[action];
      if (typeof fn === "function") {
        fn(params);
      }
    }

    this.state.set(state);
    this.runEffects();
    this.runEntryActions(state);
  }

  private runEntryActions(state: T["state"]) {
    const stateDef = this.machine.states[state];
    const entries = stateDef?.entry ?? [];

    const actions = Array.isArray(entries) ? entries : [entries];
    const actionFns = this.machine.implementations?.actions ?? {};

    const self = this;

    const params: Params<T> = {
      ...this.buildParams(),
      send(event) {
        self.send(event);
      },
    };

    for (const action of actions) {
      const fn =
        typeof action === "string"
          ? actionFns[action]
          : typeof action === "function"
          ? action
          : undefined;

      if (typeof fn === "function") {
        fn(params);
      }
    }
  }

  public start() {
    if (this.status === MachineStatus.Started) return;

    this.status = MachineStatus.Started;
    const currentState = this.state.value;
    this.runEntryActions(currentState);

    const stateDef = this.machine.states[currentState];
    const autoTransitions = (stateDef?.on?.[""] ?? []) as any[];

    for (const transition of autoTransitions) {
      const guardName = transition.guard;
      const guards = this.machine.implementations?.guards ?? {};
      const guardFn = guardName ? guards[guardName] : undefined;
      const params = this.buildParams();

      const allowed = guardFn ? guardFn(params) : true;
      if (allowed) {
        const nextState = transition.target;
        this.transitionTo(nextState, transition.actions);
        return;
      }
    }
  }

  public getStatus(): MachineStatus {
    return this.status;
  }

  private contextSnapshot(): T["context"] {
    const keys = (this.context as any).__keys ?? [];
    const result = {} as T["context"];
    for (const key of keys) {
      result[key] = this.context.get(key);
    }
    return result;
  }

  public computed!: ComputedFn<T> & Record<string, any>;
}
