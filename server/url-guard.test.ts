import { describe, expect, it } from "vitest";
import { assertUrlAllowed, isBlockedIp, SsrfError } from "./url-guard.js";

describe("isBlockedIp", () => {
  it("blocks loopback, private, link-local and CGNAT ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "169.254.169.254", // cloud metadata
      "10.0.0.1",
      "172.16.5.4",
      "192.168.1.1",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1", // IPv4-mapped loopback
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it("blocks anything that is not a valid IP literal", () => {
    expect(isBlockedIp("not-an-ip")).toBe(true);
  });
});

describe("assertUrlAllowed", () => {
  it("rejects internal IP literals before any request", async () => {
    await expect(assertUrlAllowed("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("http://127.0.0.1/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects localhost-style hostnames", async () => {
    await expect(assertUrlAllowed("http://localhost/admin")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(assertUrlAllowed("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertUrlAllowed("ftp://example.com/x")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects non-standard ports", async () => {
    await expect(assertUrlAllowed("http://example.com:8080/")).rejects.toBeInstanceOf(SsrfError);
  });

  it("allows a public IP literal on a standard port", async () => {
    const url = await assertUrlAllowed("https://1.1.1.1/");
    expect(url.hostname).toBe("1.1.1.1");
  });
});
