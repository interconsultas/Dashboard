jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/middleware-roles", () => ({ requireAuth: jest.fn() }));
jest.mock("@/lib/cache", () => ({ clearCache: jest.fn() }));

import { GET } from "@/app/api/carga/historial/route";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware-roles";
import { clearCache } from "@/lib/cache";

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockClearCache = clearCache as jest.MockedFunction<typeof clearCache>;

describe("GET /api/carga/historial - invalidación de caché", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ error: null, user: null });
  });

  it("invalida el caché al ver por primera vez una carga en estado exitoso", async () => {
    mockQuery.mockResolvedValue([{ job_id: "job-exitoso-1", estado: "exitoso" } as never]);

    await GET();

    expect(mockClearCache).toHaveBeenCalledTimes(1);
  });

  it("invalida el caché al ver por primera vez una carga eliminada", async () => {
    mockQuery.mockResolvedValue([{ job_id: "job-eliminado-1", estado: "eliminado" } as never]);

    await GET();

    expect(mockClearCache).toHaveBeenCalledTimes(1);
  });

  it("no vuelve a invalidar el caché para un job ya notificado", async () => {
    mockQuery.mockResolvedValue([{ job_id: "job-dedup-1", estado: "exitoso" } as never]);

    await GET();
    await GET();

    expect(mockClearCache).toHaveBeenCalledTimes(1);
  });

  it("no invalida el caché para estados no terminales", async () => {
    mockQuery.mockResolvedValue([{ job_id: "job-procesando-1", estado: "procesando" } as never]);

    await GET();

    expect(mockClearCache).not.toHaveBeenCalled();
  });
});
