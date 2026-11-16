import { useEffect, useRef, useState } from "react";
import type { AppCopy } from "../App";
import { config } from "../config";
import { cleanComments, cleanName, nameProblem } from "../lib/validate";

export interface RegionAnswer {
  name: string;
  livesIn: boolean;
  fromUS: boolean;
  /** Optional; "" when left blank */
  comments: string;
  /** Honeypot. Real people never see or fill this. */
  website: string;
}

interface Props {
  open: boolean;
  saving: boolean;
  error: string | null;
  /** Starting value for the US checkbox each time the dialog opens */
  defaultFromUS: boolean;
  copy: AppCopy["regionDialog"];
  onSave: (answer: RegionAnswer) => void;
  onRedraw: () => void;
  onDiscard: () => void;
}

export function RegionDialog({
  open,
  saving,
  error,
  defaultFromUS,
  copy,
  onSave,
  onRedraw,
  onDiscard,
}: Props) {
  const [name, setName] = useState("");
  const [livesIn, setLivesIn] = useState(false);
  const [fromUS, setFromUS] = useState(defaultFromUS);
  const [comments, setComments] = useState("");
  const [touched, setTouched] = useState(false);
  const [website, setWebsite] = useState("");
  const inputRef = useRef<HTMLCalciteInputTextElement>(null);

  // Fresh form each time a new shape is drawn
  useEffect(() => {
    if (!open) return;
    setName("");
    setLivesIn(false);
    setFromUS(defaultFromUS);
    setComments("");
    setTouched(false);
    setWebsite("");
    // Wait for the dialog to open before focusing
    const t = window.setTimeout(() => void inputRef.current?.setFocus(), 150);
    return () => window.clearTimeout(t);
    // defaultFromUS only matters at the moment the dialog opens
  }, [open]);

  const problem = nameProblem(name);
  const errorText = touched && problem ? copy.nameErrors[problem] : null;

  function submit() {
    setTouched(true);
    if (problem || saving) return;
    onSave({ name: cleanName(name), livesIn, fromUS, comments: cleanComments(comments), website });
  }

  return (
    <calcite-dialog
      open={open}
      modal
      heading={copy.heading}
      description={copy.description}
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
          {copy.nameLabel}
          <calcite-input-text
            ref={inputRef}
            value={name}
            maxLength={config.limits.nameMaxLength}
            placeholder={copy.namePlaceholder}
            autocomplete="off"
            required
            disabled={saving}
            status={errorText ? "invalid" : "idle"}
            validationMessage={errorText ?? undefined}
            validationIcon={errorText ? true : undefined}
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
          {copy.livesInLabel}
        </calcite-label>

        <calcite-label layout="inline">
          <calcite-checkbox
            checked={fromUS}
            disabled={saving}
            oncalciteCheckboxChange={(e) => setFromUS(e.target.checked)}
          />
          {copy.fromUSLabel}
        </calcite-label>

        <calcite-label>
          {copy.commentsLabel}
          <calcite-text-area
            value={comments}
            maxLength={config.limits.commentsMaxLength}
            limitText
            rows={3}
            resize="vertical"
            placeholder={copy.commentsPlaceholder}
            disabled={saving}
            oncalciteTextAreaInput={(e) => setComments(e.target.value)}
          />
        </calcite-label>

        {/* Honeypot: hidden from people and screen readers, tempting to bots.
            Its label is bait for bots, not copy people see. */}
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
          <div slot="message">{copy.lockedWarning}</div>
        </calcite-notice>

        {error && (
          <calcite-notice open kind="danger" icon="x-octagon" scale="s" width="full">
            <div slot="title">{copy.saveErrorTitle}</div>
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
        {copy.discardButton}
      </calcite-button>
      <calcite-button
        slot="footer-end"
        appearance="outline"
        iconStart="pencil"
        disabled={saving}
        onClick={onRedraw}
      >
        {copy.redrawButton}
      </calcite-button>
      <calcite-button slot="footer-end" loading={saving} disabled={saving} onClick={submit}>
        {error ? copy.retryButton : copy.saveButton}
      </calcite-button>
    </calcite-dialog>
  );
}
