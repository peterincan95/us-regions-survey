import type { AppCopy } from "../App";

interface Props {
  open: boolean;
  copy: AppCopy["intro"];
  onStart: () => void;
}

export function IntroDialog({ open, copy, onStart }: Props) {
  return (
    <calcite-dialog
      open={open}
      modal
      heading={copy.heading}
      width="s"
      closeDisabled
      escapeDisabled
      outsideCloseDisabled
    >
      <div className="dialog-body">
        <p>{copy.body}</p>
        <calcite-notice open icon="lock" kind="brand" width="full">
          <div slot="title">{copy.privacyTitle}</div>
          <div slot="message">
            <ul className="tight-list">
              {copy.privacyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </calcite-notice>
      </div>
      <calcite-button slot="footer-end" onClick={onStart} iconEnd="arrow-right">
        {copy.startButton}
      </calcite-button>
    </calcite-dialog>
  );
}
