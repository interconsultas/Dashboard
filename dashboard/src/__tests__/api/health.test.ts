import { GET } from "@/app/api/health/route";

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));

import { query } from "@/lib/db";
const mockQuery = query as jest.MockedFunction<typeof query>;

describe("GET /api/health", () => {
  afterEach(() => jest.restoreAllMocks());

  it("retorna status ok cuando la BD responde", async () => {
    mockQuery.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1");
  });

  it("retorna 503 cuando la BD falla", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "error" });
  });
});
