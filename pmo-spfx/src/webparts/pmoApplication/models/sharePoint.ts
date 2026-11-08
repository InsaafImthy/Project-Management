/** Raw values returned by SharePoint REST before repository mapping. */
export interface ISharePointUserWire {
  readonly Id: number;
  readonly Title: string;
  readonly EMail?: string;
  readonly Name?: string;
}

export interface ISharePointHyperlinkWire {
  readonly Url: string;
  readonly Description?: string;
}

export interface ISharePointItemWire {
  readonly ID: number;
  readonly "@odata.etag"?: string;
  readonly "odata.etag"?: string;
  readonly Created?: string;
  readonly Modified?: string;
  readonly [field: string]: unknown;
}

export interface ISharePointCollectionWire<T> {
  readonly value?: readonly T[];
  readonly d?: {
    readonly results?: readonly T[];
    readonly __next?: string;
  };
  readonly "@odata.nextLink"?: string;
  readonly "odata.nextLink"?: string;
}

export interface ISharePointFileWire {
  readonly Name: string;
  readonly ServerRelativeUrl: string;
  readonly ListItemAllFields?: ISharePointItemWire;
}

export const getWireEtag = (item: ISharePointItemWire): string =>
  item["@odata.etag"] ?? item["odata.etag"] ?? "";

export const readWireString = (
  item: ISharePointItemWire,
  field: string,
): string | undefined => {
  const value = item[field];
  return typeof value === "string" ? value : undefined;
};

export const readWireNumber = (
  item: ISharePointItemWire,
  field: string,
): number | undefined => {
  const value = item[field];
  return typeof value === "number" ? value : undefined;
};

export const readWireBoolean = (
  item: ISharePointItemWire,
  field: string,
): boolean | undefined => {
  const value = item[field];
  return typeof value === "boolean" ? value : undefined;
};
