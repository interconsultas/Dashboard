import { spawnEtl } from "@/lib/etl-spawn";

jest.mock("child_process", () => ({
  spawn: jest.fn().mockReturnValue({
    unref: jest.fn(),
  }),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  openSync: jest.fn().mockReturnValue(3),
  closeSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { spawn } from "child_process";
import { openSync, closeSync } from "fs";

describe("spawnEtl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lanza proceso con argumentos correctos", () => {
    const jobId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    spawnEtl(["--preview", "--archivo", "test.xlsx"], jobId);

    expect(spawn).toHaveBeenCalledTimes(1);
    const [, args] = (spawn as jest.Mock).mock.calls[0];
    expect(args).toContain("--preview");
    expect(args).toContain("--archivo");
    expect(args).toContain("test.xlsx");
  });

  it("rechaza jobId con caracteres inválidos", () => {
    expect(() => {
      spawnEtl(["--preview"], "'; DROP TABLE--");
    }).toThrow("Invalid jobId format");
  });

  it("rechaza jobId con espacios", () => {
    expect(() => {
      spawnEtl(["--preview"], "job id con espacios");
    }).toThrow("Invalid jobId format");
  });

  it("acepta jobId UUID válido", () => {
    expect(() => {
      spawnEtl(["--preview"], "550e8400-e29b-41d4-a716-446655440000");
    }).not.toThrow();
  });

  it("abre y cierra el file descriptor para el log", () => {
    spawnEtl(["--confirm", "abc"], "aabbccdd-1122-3344-5566-778899001122");
    expect(openSync).toHaveBeenCalledTimes(1);
    expect(closeSync).toHaveBeenCalledTimes(1);
  });

  it("lanza proceso en modo detached", () => {
    spawnEtl(["--preview"], "abcd1234-0000-0000-0000-000000000000");
    const [, , opts] = (spawn as jest.Mock).mock.calls[0];
    expect(opts.detached).toBe(true);
  });
});
