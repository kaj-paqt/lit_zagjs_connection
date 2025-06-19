import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import * as checkbox from "@zag-js/checkbox";
import { CustomService } from "./custom-service";
import { spread } from "@open-wc/lit-helpers";
import { normalizeProps } from "./normalize-props";
import { createMachine } from "@zag-js/core";

@customElement("my-checkbox")
export class MyCheckbox extends LitElement {
  private service!: CustomService<any>;

  @state()
  private api: any = null;

  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.service = new CustomService(checkbox.machine, undefined, {
      id: "checkbox-id",
    });

    this.api = checkbox.connect(this.service, normalizeProps);

    // this is a workaround to allow the API to be updated
    (globalThis as any).ctxUpdate = () => {
      console.log("[ctxUpdate] reconnecting API");
      this.api = checkbox.connect(this.service, normalizeProps);
      this.requestUpdate();
    };

    this.service.subscribe((state) => {
      // this never fires, and it should.
      this.api = checkbox.connect(this.service, normalizeProps);
      this.requestUpdate();
    });
  }

  static styles = css`
    label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .checkbox-control {
      width: 16px;
      height: 16px;
      border: 2px solid black;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      background: white;
    }

    .checkbox-control[data-checked="true"] {
      background: black;
      color: white;
    }
  `;

  updated() {
    const root = this.renderRoot.querySelector(".checkbox-control");
    console.log(
      "[DOM] checkbox-control data-checked:",
      root?.getAttribute("data-checked")
    );
  }

  render() {
    if (!this.api) {
      return html`<p>Loading checkbox...</p>`;
    }

    console.log("[Render] this.api.checked:", this.api?.checked);

    return html`
      <form
        @change=${(e: Event) => {
          const form = e.currentTarget as HTMLFormElement;
          const data = new FormData(form);
          console.log("[Form Serialize]", Object.fromEntries(data.entries()));
        }}
      >
        <fieldset>
          <label ${spread(this.api.getRootProps())}>
            <div
              class="checkbox-control"
              data-checked=${this.api.checked}
              ${spread(this.api.getControlProps())}
            >
              <div ${spread(this.api.getIndicatorProps?.())}>✓</div>
            </div>
            <span ${spread(this.api.getLabelProps())}>
              Input is ${this.api.checked ? "Checked" : "Unchecked"}
            </span>
            <input
              ${spread(this.api.getHiddenInputProps())}
              data-testid="hidden-input"
              name="my-checkbox"
            />
          </label>

          <div style="margin-top: 1rem;">
            <button
              type="button"
              @click=${() => {
                console.log("[UI] Calling api.setChecked(true)");
                this.api.setChecked(true);
              }}
              ?disabled=${this.api?.checked}
            >
              Check
            </button>
            <button
              type="button"
              @click=${() => this.api.setChecked(false)}
              ?disabled=${!this.api.checked}
            >
              Uncheck
            </button>
            <button
              type="button"
              @click=${() => this.service.send({ type: "CHECK" })}
            >
              Check (manual)
            </button>
            <button type="reset">Reset Form</button>
          </div>
        </fieldset>
      </form>
    `;
  }
}
