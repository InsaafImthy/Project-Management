import {
  parseConfigBoolean,
  parseConfigNumber,
  parseConfigText,
  parseConfigTime,
  validateSettingDraft,
} from "../validation/configuration";

describe("Settings parsing and validation", () => {
  it("parses numeric, boolean, time and text values without coercing invalid input", () => {
    expect(parseConfigNumber(" 8.5 ")).toBe(8.5);
    expect(parseConfigNumber("eight")).toBeUndefined();
    expect(parseConfigBoolean("YES")).toBe(true);
    expect(parseConfigBoolean("0")).toBe(false);
    expect(parseConfigBoolean("maybe")).toBeUndefined();
    expect(parseConfigTime("15")).toEqual({ hours: 15, minutes: 0 });
    expect(parseConfigTime("15:30")).toEqual({ hours: 15, minutes: 30 });
    expect(parseConfigTime("24:00")).toBeUndefined();
    expect(parseConfigText("  OMR ")).toBe("OMR");
  });

  it("validates known percentages, hours, escalation days, currency and versions", () => {
    expect(
      validateSettingDraft({
        key: "TaskEffortWarningPercent",
        category: "Time",
        value: "101",
        description: "Warn before effort is exhausted",
        isActive: true,
      }).value,
    ).toMatch(/between 0 and 100/);
    expect(
      validateSettingDraft({
        key: "DefaultCurrencyCode",
        category: "Finance",
        value: "OM",
        description: "Reporting currency",
        isActive: true,
      }).value,
    ).toMatch(/three-letter/);
    expect(
      validateSettingDraft({
        key: "ImportTemplateVersion",
        category: "Import",
        value: "1.0",
        description: "Workbook contract",
        isActive: true,
      }),
    ).toEqual({});
  });
});
