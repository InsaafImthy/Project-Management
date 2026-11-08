import * as React from "react";
import styles from "./PmoApplication.module.scss";
import type { IPmoApplicationProps } from "./IPmoApplicationProps";
import { PmoApplicationRoot } from "./PmoApplicationRoot";
import { initializePmoIcons } from "../theme/initializePmoIcons";

initializePmoIcons();

const PmoApplication = ({
  isDarkTheme,
  userDisplayName,
  userEmail,
}: IPmoApplicationProps): React.ReactElement => (
  <section
    className={styles.pmoApplication}
    data-theme={isDarkTheme ? "dark" : "light"}
  >
    <PmoApplicationRoot
      userDisplayName={userDisplayName}
      userEmail={userEmail}
    />
  </section>
);

export default PmoApplication;
