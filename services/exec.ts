import { spawn } from "node:child_process";
import { ProcessingError } from "@/lib/errors";

export interface ExecResult {
  stdout: Buffer;
  stderr: string;
  code: number;
}

/**
 * Run an external tool (LibRaw, ExifTool, FFmpeg) without a shell — arguments are
 * passed as an array so filenames can never be interpreted as shell syntax.
 */
export function run(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; onStdoutLine?: (line: string) => void; onStderrLine?: (line: string) => void; maxStdout?: number } = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let outLen = 0;
    let err = "";
    let lineBuf = "";
    let errLineBuf = "";
    const maxStdout = opts.maxStdout ?? 512 * 1024 * 1024;
    const timer = opts.timeoutMs ? setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs) : null;
    child.stdout.on("data", (c: Buffer) => {
      if (opts.onStdoutLine) {
        lineBuf += c.toString();
        const lines = lineBuf.split("\n");
        lineBuf = lines.pop() ?? "";
        lines.forEach(opts.onStdoutLine);
      } else if (outLen < maxStdout) {
        out.push(c);
        outLen += c.length;
      }
    });
    child.stderr.on("data", (c: Buffer) => {
      const s = c.toString();
      err = (err + s).slice(-64 * 1024);
      if (opts.onStderrLine) {
        errLineBuf += s;
        const lines = errLineBuf.split(/\r|\n/);
        errLineBuf = lines.pop() ?? "";
        lines.forEach(opts.onStderrLine);
      }
    });
    child.on("error", (e) =>
      reject(new ProcessingError(`Required tool "${cmd}" is not available on this worker`, String(e), false)),
    );
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout: Buffer.concat(out), stderr: err, code: code ?? -1 });
    });
  });
}

export async function runOrThrow(cmd: string, args: string[], humanMessage: string, opts?: Parameters<typeof run>[2]) {
  const res = await run(cmd, args, opts);
  if (res.code !== 0) {
    throw new ProcessingError(humanMessage, `${cmd} ${args.join(" ")}\nexit ${res.code}\n${res.stderr}`);
  }
  return res;
}
