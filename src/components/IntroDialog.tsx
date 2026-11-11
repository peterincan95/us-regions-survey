interface Props {
  open: boolean;
  onStart: () => void;
}

export function IntroDialog({ open, onStart }: Props) {
  return (
    <calcite-dialog
      open={open}
      modal
      heading="Where do you think the regions of the US are?"
      width="s"
      closeDisabled
      escapeDisabled
      outsideCloseDisabled
    >
      <div className="dialog-body">
        <p>
          Draw an outline around any part of the country that you think of as a region, like
          “the Midwest”, “the Bay Area” or “Upstate”, and tell us what you call it. Add as many
          as you like.
        </p>
        <calcite-notice open icon="lock" kind="brand" width="full">
          <div slot="title">Your privacy</div>
          <div slot="message">
            <ul className="tight-list">
              <li>No account or sign-in, and we don’t ask who you are.</li>
              <li>
                We save only your shapes, their names, whether you live there, and a random code
                that groups the shapes from this visit. Your location isn’t collected.
              </li>
              <li>You’ll only ever see your own shapes. Answers may be published as combined maps.</li>
            </ul>
          </div>
        </calcite-notice>
      </div>
      <calcite-button slot="footer-end" onClick={onStart} iconEnd="arrow-right">
        Start drawing
      </calcite-button>
    </calcite-dialog>
  );
}
