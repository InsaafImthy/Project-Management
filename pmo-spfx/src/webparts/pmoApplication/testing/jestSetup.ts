jest.mock("@microsoft/sp-http", () => ({
  SPHttpClient: { configurations: { v1: {} } },
}));
