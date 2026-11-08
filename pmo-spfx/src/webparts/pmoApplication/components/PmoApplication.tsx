import * as React from "react";
import styles from "./PmoApplication.module.scss";
import type { IPmoApplicationProps } from "./IPmoApplicationProps";
import { PmoApplicationRoot } from "./PmoApplicationRoot";

const PmoApplication = ({
  isDarkTheme,
  userDisplayName,
}: IPmoApplicationProps): React.ReactElement => (
  <section
    className={styles.pmoApplication}
    data-theme={isDarkTheme ? "dark" : "light"}
  >
    <PmoApplicationRoot userDisplayName={userDisplayName} />
  </section>
);

export default PmoApplication;
