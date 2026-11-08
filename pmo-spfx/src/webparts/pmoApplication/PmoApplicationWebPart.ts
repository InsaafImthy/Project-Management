import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Version } from "@microsoft/sp-core-library";
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
} from "@microsoft/sp-property-pane";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import { IReadonlyTheme } from "@microsoft/sp-component-base";

import * as strings from "PmoApplicationWebPartStrings";
import PmoApplication from "./components/PmoApplication";
import type { IPmoApplicationProps } from "./components/IPmoApplicationProps";

export interface IPmoApplicationWebPartProps {
  description: string;
}

/** SharePoint-hosted entry point. Teams host support is intentionally deferred. */
export default class PmoApplicationWebPart extends BaseClientSideWebPart<IPmoApplicationWebPartProps> {
  private _isDarkTheme: boolean = false;
  private _root: Root | undefined;

  public render(): void {
    const element: React.ReactElement<IPmoApplicationProps> =
      React.createElement(PmoApplication, {
        isDarkTheme: this._isDarkTheme,
        userDisplayName: this.context.pageContext.user.displayName,
      });

    if (!this._root) {
      this._root = createRoot(this.domElement);
    }

    this._root.render(element);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    this.domElement.style.setProperty(
      "--bodyText",
      currentTheme.semanticColors?.bodyText ?? null,
    );
  }

  protected onDispose(): void {
    this._root?.unmount();
    this._root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField("description", {
                  label: strings.DescriptionFieldLabel,
                }),
              ],
            },
          ],
        },
      ],
    };
  }
}
