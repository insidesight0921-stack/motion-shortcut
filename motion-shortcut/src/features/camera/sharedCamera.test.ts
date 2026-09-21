import { describe, expect, it, vi } from "vitest";
import { createCameraBroker } from "./sharedCamera";

describe("shared camera connection", () => {
  it("shares a pending permission request and stops only after the last consumer releases", async () => {
    let resolve!: (stream: MediaStream) => void;
    const getStream = vi.fn(() => new Promise<MediaStream>(r => { resolve = r; }));
    const broker = createCameraBroker(getStream);
    const center = broker.acquire();
    const popup = broker.acquire();
    await Promise.resolve();
    expect(getStream).toHaveBeenCalledTimes(1);
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    resolve(stream);
    const [a, b] = await Promise.all([center, popup]);
    expect(a.stream).toBe(b.stream);
    a.release();
    a.release();
    expect(stop).not.toHaveBeenCalled();
    const c = await broker.acquire();
    expect(getStream).toHaveBeenCalledTimes(1);
    b.release();
    expect(stop).not.toHaveBeenCalled();
    c.release();
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it("retries one shared request after denial", async () => {
    const stop = vi.fn();
    const getStream = vi.fn().mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
      .mockResolvedValue({ getTracks: () => [{ stop }] });
    const broker = createCameraBroker(getStream);
    const results = await Promise.allSettled([broker.acquire(), broker.acquire()]);
    expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
    expect(getStream).toHaveBeenCalledTimes(1);
    const [center, popup] = await Promise.all([broker.acquire(), broker.acquire()]);
    expect(getStream).toHaveBeenCalledTimes(2);
    center.release();
    popup.release();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
