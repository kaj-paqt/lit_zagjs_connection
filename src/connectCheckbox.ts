import type { CustomService } from "./custom-service";

export function connectCheckbox(
  service: CustomService<any>,
  normalize = (x: any) => x
) {
  const computed = service.computed();

  return {
    ...computed,
    getRootProps: () => normalize(service.getRootProps?.() ?? {}),
    getControlProps: () => normalize(service.getControlProps?.() ?? {}),
    getHiddenInputProps: () => normalize(service.getHiddenInputProps?.() ?? {}),
    getLabelProps: () => normalize(service.getLabelProps?.() ?? {}),
    getIndicatorProps: () => normalize(service.getIndicatorProps?.() ?? {}),
    setChecked: (v: boolean) => {
      service.context.set("checked", v);
      Object.assign(service, service.computed()); // sync updates
    },
    toggleChecked: () => {
      const current = service.context.get("checked");
      service.context.set("checked", !current);
      Object.assign(service, service.computed());
    },
  };
}
