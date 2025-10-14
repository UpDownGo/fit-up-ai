// utils/imageQuality.ts

const MIN_RESOLUTION_WIDTH = 300;
const MIN_RESOLUTION_HEIGHT = 300;
const DARKNESS_THRESHOLD = 70; // Average pixel brightness (0-255)
const BLUR_THRESHOLD = 100; // Variance of Laplacian. Higher is sharper.

type QualityIssue = 'low-resolution' | 'too-dark' | 'blurry';

export interface QualityResult {
  isOk: boolean;
  issues: QualityIssue[];
}

const loadImage = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = base64;
  });
};

const calculateLaplacianVariance = (context: CanvasRenderingContext2D, width: number, height: number): number => {
    const imageData = context.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    
    // Convert to grayscale for edge detection
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    const laplacian = new Float32Array(width * height);
    let sum = 0;
    
    // Apply 3x3 Laplacian operator to find edges
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const center = gray[i];
            const top = gray[(y - 1) * width + x];
            const bottom = gray[(y + 1) * width + x];
            const left = gray[y * width + (x - 1)];
            const right = gray[y * width + (x + 1)];
            
            const value = 4 * center - top - bottom - left - right;
            laplacian[i] = value;
            sum += value;
        }
    }

    const mean = sum / (width * height);
    let varianceSum = 0;
    for (let i = 0; i < laplacian.length; i++) {
        varianceSum += (laplacian[i] - mean) ** 2;
    }
    
    // Variance of the Laplacian is a strong indicator of sharpness
    return varianceSum / (width * height);
};

const calculateAverageBrightness = (context: CanvasRenderingContext2D, width: number, height: number): number => {
    const imageData = context.getImageData(0, 0, width, height);
    let colorSum = 0;
    const numPixels = imageData.data.length / 4;
    for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        colorSum += (r + g + b) / 3;
    }
    return colorSum / numPixels;
}

export const checkImageQuality = async (base64: string): Promise<QualityResult> => {
  const issues: QualityIssue[] = [];

  try {
    const img = await loadImage(base64);

    // 1. Resolution Check
    if (img.naturalWidth < MIN_RESOLUTION_WIDTH || img.naturalHeight < MIN_RESOLUTION_HEIGHT) {
      issues.push('low-resolution');
    }
    
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 500 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        return { isOk: issues.length === 0, issues };
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 2. Brightness Check
    const brightness = calculateAverageBrightness(ctx, canvas.width, canvas.height);
    if (brightness < DARKNESS_THRESHOLD) {
      issues.push('too-dark');
    }

    // 3. Blur Check
    const blurVariance = calculateLaplacianVariance(ctx, canvas.width, canvas.height);
    if (blurVariance < BLUR_THRESHOLD) {
      issues.push('blurry');
    }

    return { isOk: issues.length === 0, issues };
  } catch (error) {
    console.error("Failed during image quality check:", error);
    // If loading fails, it's a fundamental issue, but not a quality one.
    // Let other error handling catch it by returning true.
    return { isOk: true, issues: [] };
  }
};
