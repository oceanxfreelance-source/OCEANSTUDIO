import type { RawDevelopSettings } from "@/lib/processing/settings";

export interface RawFile {
  path: string;
  extension: string;
}

export interface FaceRegion {
  /** normalised 0…1 coordinates relative to the oriented image */
  x: number;
  y: number;
  w: number;
  h: number;
  source: string;
}

export interface RawMetadata {
  width: number | null;
  height: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lens: string | null;
  iso: number | null;
  shutter: string | null;
  aperture: number | null;
  focalLength: number | null;
  capturedAt: Date | null;
  faceRegions: FaceRegion[];
  exif: Record<string, unknown>;
  raw: Record<string, string>;
}

export interface Preview {
  path: string;
  width: number;
  height: number;
  source: "embedded" | "decoded";
}

/** High-bit-depth developed image on disk (16-bit sRGB TIFF). */
export interface DevelopedImage {
  path: string;
  width: number;
  height: number;
  bitDepth: 16;
}

export interface ExportSettings {
  format: "tiff16" | "tiff8" | "jpeg" | "png";
  jpegQuality: number;
  outputPath: string;
  /** copy camera/lens EXIF from this file (typically the RAW master) */
  metadataSource?: string;
}

export interface ProcessedFile {
  path: string;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  size: number;
}

/** Abstraction so OCEANX is not permanently tied to one RAW library. */
export interface RawProcessor {
  readonly name: string;
  canProcess(extension: string): boolean;
  extractMetadata(file: RawFile): Promise<RawMetadata>;
  generatePreview(file: RawFile, outputJpeg: string): Promise<Preview>;
  develop(file: RawFile, settings: RawDevelopSettings, workDir: string): Promise<DevelopedImage>;
  export(image: DevelopedImage, settings: ExportSettings): Promise<ProcessedFile>;
}
