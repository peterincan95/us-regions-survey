import { useEffect, useRef, useState } from "react";
import { config } from "../config";
import { cleanName, nameError } from "../lib/validate";

export interface RegionAnswer {
  name: string;
  livesIn: boolean;
  /** Honeypot. Real people never see or fill this. */
  website: string;
}

interface Props {
  open: boolean;
  saving: boolean;
  error: string | null;
  onSave: (answer: RegionAnswer) => void;
  onRedraw: () => void;
  onDiscard: () => void;
}

export function RegionDialog({ open, saving, error, onSave, onRedraw, onDiscard }: Props) {
  const [name, setName] = useState("");
  const [livesIn, setLivesIn] = useState(false);
  const [touched, setTouched] = useState(false);
  const [website, setWebsite] = useState("");
  const inputRef = useRef<HTMLCalciteInputTextElement>(null);

  // Fresh form each time a new shape is drawn
  useEffect(() => {
    if (!open) return;
    setName("");
    setLivesIn(false);
    setTouched(false);
    setWebsite("");
    // Wait for the dialog to open before focusing
    const t = window.setTimeout(() => void inputRef.current?.setFocus(), 150);
    return () => window.clearTimeout(t);
  }, [open]);

  const invalid = nameError(name);
  const showError = touched && invalid;

  function submit() {
    setTouched(true);
    if (invalid || saving) return;
    onSave({ name: cleanName(name), livesIn, website });
  }

  return (
    <calcite-dialog
      open={open}
      modal
      heading="Name this region"
      description="What do you call the area you outlined?"
      width="s"
      escapeDisabled={saving}
      outsideCloseDisabled
      closeDisabled={saving}
      oncalciteDialogClose={() => {
        if (open) onDiscard();
      }}
    >
      <form
        className="dialog-body"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <calcite-label>
          Region name
          <calcite-input-text
            ref={inputRef}
            value={name}
            maxLength={config.limits.nameMaxLength}
            placeholder="e.g. The Pacific Northwest"
            autocomplete="off"
            required
            disabled={saving}
            status={showError ? "invalid" : "idle"}
            validationMessage={showError ? invalid : undefined}
            validationIcon={showError ? true : undefined}
            oncalciteInputTextInput={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </calcite-label>

        <calcite-label layout="inline">
          <calcite-checkbox
            checked={livesIn}
            disabled={saving}
            oncalciteCheckboxChange={(e) => setLivesIn(e.target.checked)}
          />
          I live in this region
        </calcite-label>

        {/* Honeypot: hidden from people and screen readers, tempting to bots */}
        <div className="hp" aria-hidden="true">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        <calcite-notice open kind="warning" icon="exclamation-mark-triangle" scale="s" width="full">
          <div slot="message">Once saved, a region can’t be changed or removed.</div>
        </calcite-notice>

        {error && (
          <calcite-notice open kind="danger" icon="x-octagon" scale="s" width="full">
            <div slot="title">Couldn’t save</div>
            <div slot="message">{error}</div>
          </calcite-notice>
        )}
      </form>

      <calcite-button
        slot="footer-start"
        appearance="transparent"
        kind="neutral"
        iconStart="trash"
        disabled={saving}
        onClick={onDiscard}
      >
        Discard
      </calcite-button>
      <calcite-button
        slot="footer-end"
        appearance="outline"
        iconStart="pencil"
        disabled={saving}
        onClick={onRedraw}
      >
        Redraw
      </calcite-button>
      <calcite-button slot="footer-end" loading={saving} disabled={saving} onClick={submit}>
        {error ? "Try again" : "Save region"}
      </calcite-button>
    </calcite-dialog>
  );
}
