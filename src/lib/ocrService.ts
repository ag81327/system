export interface OCRWordResult {
  id: string;
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  numericValue: number;
  snippetUrl?: string;
}

/**
 * Preprocess image on canvas:
 * 1. Grayscale
 * 2. Contrast stretching & thresholding (reduces shadow and emphasizes pen strokes)
 */
export function preprocessImage(
  img: HTMLImageElement,
  options: { enhanceHandwriting?: boolean; binarize?: boolean; contrast?: number } = {}
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);

  if (!options.enhanceHandwriting) {
    return canvas;
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = options.contrast ?? 1.3; // 1.0 = normal, > 1.0 = higher contrast
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Grayscale
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;

    // Contrast stretch
    gray = factor * (gray - 128) + 128;
    gray = Math.max(0, Math.min(255, gray));

    if (options.binarize) {
      // Light binarization / thresholding to remove light paper gray/shadows
      gray = gray > 180 ? 255 : gray < 100 ? 0 : gray;
    }

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generate a zoomed snippet from the original image for the magnifier
 */
export function extractSnippet(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  padding = 8
): string {
  try {
    const canvas = document.createElement('canvas');
    const width = sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth : sourceImage.width;
    const height = sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight : sourceImage.height;

    const cropX = Math.max(0, bbox.x0 - padding);
    const cropY = Math.max(0, bbox.y0 - padding);
    const cropW = Math.min(width - cropX, (bbox.x1 - bbox.x0) + padding * 2);
    const cropH = Math.min(height - cropY, (bbox.y1 - bbox.y0) + padding * 2);

    if (cropW <= 0 || cropH <= 0) return '';

    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(sourceImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Failed to extract snippet:', err);
    return '';
  }
}

/**
 * Run OCR on image using Tesseract.js (Pure Client-side WebAssembly)
 */
export async function runClientSideOCR(
  imageSource: string | HTMLCanvasElement | HTMLImageElement,
  options: {
    enhanceHandwriting?: boolean;
    onProgress?: (progress: number, status: string) => void;
  } = {}
): Promise<{ words: OCRWordResult[]; rawText: string }> {
  // Dynamically import tesseract.js
  const Tesseract = await import('tesseract.js');
  
  options.onProgress?.(0.1, '正在初始化 OCR 引擎...');

  const worker = await Tesseract.createWorker('eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        options.onProgress?.(0.2 + (m.progress || 0) * 0.75, '正在分析表格與數字...');
      } else if (m.status) {
        options.onProgress?.(0.2, `狀態: ${m.status}`);
      }
    }
  });

  try {
    // Restrict whitelist to numbers, dots, and hyphens for highest accuracy
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.- ',
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // sparse text is optimal for tables and floating numbers
    });

    options.onProgress?.(0.3, '正在進行光學字符識別...');
    const result = await worker.recognize(imageSource, {}, { tsv: true });
    
    // Process words and extract numeric candidates from TSV output
    const words: OCRWordResult[] = [];
    
    if (result.data.tsv) {
      const tsvLines = result.data.tsv.trim().split('\n');
      let index = 0;

      for (const line of tsvLines) {
        const cols = line.split('\t');
        // Level 5 corresponds to word in Tesseract TSV
        if (cols[0] === '5' && cols.length >= 12) {
          const left = parseInt(cols[6], 10);
          const top = parseInt(cols[7], 10);
          const width = parseInt(cols[8], 10);
          const height = parseInt(cols[9], 10);
          const conf = parseFloat(cols[10]);
          const rawText = cols[11]?.trim() || '';

          // Look for valid numbers
          const numMatch = rawText.match(/-?\d+(?:\.\d+)?/);
          if (numMatch) {
            const numericVal = parseFloat(numMatch[0]);
            if (!isNaN(numericVal)) {
              words.push({
                id: `ocr-word-${index++}-${Math.random().toString(36).substring(2, 7)}`,
                text: numMatch[0],
                confidence: isNaN(conf) ? 0 : conf,
                bbox: {
                  x0: left,
                  y0: top,
                  x1: left + width,
                  y1: top + height,
                },
                numericValue: numericVal,
              });
            }
          }
        }
      }
    }

    options.onProgress?.(1.0, '辨識完成');
    return {
      words,
      rawText: result.data.text || '',
    };
  } finally {
    await worker.terminate();
  }
}

