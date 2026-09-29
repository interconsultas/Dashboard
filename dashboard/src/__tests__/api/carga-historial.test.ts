jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));

import { GET } from "@/app/api/carga/historial/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe("GET /api/carga/historial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza si requireAuth devuelve error", async () => {
    const errorResponse = { status: 403 } as never;
    mockRequireAuth.mockResolvedValue({ error: errorResponse, user: null });

    const res = await GET();

    expect(res).toBe(errorResponse);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("devuelve las filas del historial excluyendo canceladas", async () => {
    mockRequireAuth.mockResolvedValue({ error: null, user: null });
    mockQuery.mockResolvedValue([{ job_id: "job-1", estado: "exitoso" } as never]);

    const res = await GET();
    const body = await res.json();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain("estado NOT IN ('cancelado')");
    expect(body).toEqual([{ job_id: "job-1", estado: "exitoso" }]);
  });
});
