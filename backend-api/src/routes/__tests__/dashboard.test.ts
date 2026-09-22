import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { formatTaskLabel } from "../dashboard";

describe("formatTaskLabel", () => {
  it("uses the populated project code when available", () => {
    expect(
      formatTaskLabel({
        taskNumber: "TSK-1001",
        title: "Build login API",
        project: { projectCode: "PRJ-100" },
      }),
    ).toBe("TSK-1001 (PRJ-100) — Build login API");
  });

  it("falls back to N/A for unpopulated project references", () => {
    expect(
      formatTaskLabel({
        taskNumber: "TSK-1002",
        title: "Write regression tests",
        project: new Types.ObjectId(),
      }),
    ).toBe("TSK-1002 (N/A) — Write regression tests");
  });
});
