export class BoundedBuffer {
  private value = "";
  private wasTruncated = false;
  public constructor(private readonly maxBytes: number) {
    if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error("maxBytes must be positive.");
  }
  public append(chunk: string): void {
    const remaining = this.maxBytes - Buffer.byteLength(this.value, "utf8");
    if (remaining <= 0) { this.wasTruncated = true; return; }
    const bytes = Buffer.from(chunk, "utf8");
    if (bytes.byteLength <= remaining) { this.value += chunk; return; }
    this.value += bytes.subarray(0, remaining).toString("utf8");
    this.wasTruncated = true;
  }
  public toString(): string { return this.value; }
  public truncated(): boolean { return this.wasTruncated; }
}
