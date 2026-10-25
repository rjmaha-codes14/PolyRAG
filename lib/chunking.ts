import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { splitIndicSentences, detectScriptFromUnicode } from './languages';
import { extractTextWithGeminiVision } from './gemini';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface DocumentChunkData {
  pageNumber: number;
  chunkIndex: number;
  content: string;
}

/**
 * Extract pages and text from various document formats:
 * - PDF: Extracts page text using pdf-parse; if a page has empty text (<20 chars), flags for vision OCR
 * - DOCX: Extracts markdown/text via mammoth
 * - TXT / MD: Plain text UTF-8 reading
 * - Images (PNG, JPG, WEBP): Gemini vision OCR
 */
export async function extractDocumentPages(
  fileBuffer: Buffer,
  fileType: string,
  fileName: string
): Promise<ExtractedPage[]> {
  const ext = fileType.toLowerCase();

  if (ext === 'pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    return extractPdfPages(fileBuffer);
  }

  if (ext === 'docx' || fileName.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const fullText = result.value || '';
    return splitTextIntoPages(fullText, 2500);
  }

  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext) || /\.(png|jpe?g|webp)$/i.test(fileName)) {
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const text = await extractTextWithGeminiVision(fileBuffer, mimeType);
    return [{ pageNumber: 1, text: text || '(No readable text detected in image)' }];
  }

  // Fallback for TXT, MD, CSV, etc.
  const text = fileBuffer.toString('utf-8');
  return splitTextIntoPages(text, 2500);
}

/**
 * Split text from single-stream files (DOCX, TXT) into pseudo-pages of ~2500 characters
 */
function splitTextIntoPages(text: string, charsPerPage: number = 2500): ExtractedPage[] {
  const pages: ExtractedPage[] = [];
  const lines = text.split(/\r?\n/);
  let currentPageText = '';
  let pageNum = 1;

  for (const line of lines) {
    if (currentPageText.length + line.length > charsPerPage && currentPageText.length > 0) {
      pages.push({ pageNumber: pageNum++, text: currentPageText.trim() });
      currentPageText = '';
    }
    currentPageText += line + '\n';
  }

  if (currentPageText.trim().length > 0 || pages.length === 0) {
    pages.push({ pageNumber: pageNum, text: currentPageText.trim() });
  }

  return pages;
}

/**
 * Extract per-page text from PDF using pdf-parse pager render callback
 */
async function extractPdfPages(pdfBuffer: Buffer): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  let currentPageIndex = 1;
  const uint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);

  try {
    const options = {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => {
        return pageData.getTextContent().then((textContent) => {
          let lastY = -1;
          let text = '';
          for (const item of textContent.items) {
            if (lastY === -1 || Math.abs((item as any).transform?.[5] - lastY) > 5) {
              text += '\n' + item.str;
              lastY = (item as any).transform?.[5];
            } else {
              text += ' ' + item.str;
            }
          }
          pages.push({ pageNumber: currentPageIndex++, text: text.trim() });
          return text;
        });
      },
    };

    await pdfParse(uint8, options);
  } catch (err) {
    console.warn('pdf-parse custom pagerender failed, using default text extraction:', err);
    try {
      const data = await pdfParse(uint8);
      if (data.text) {
        return splitTextIntoPages(data.text, 2500);
      }
    } catch (fallbackErr) {
      console.error('PDF text extraction error:', fallbackErr);
    }
  }

  // Sort by pageNumber and return
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return pages.length > 0 ? pages : [{ pageNumber: 1, text: '' }];
}

/**
 * Create ~800-character overlapping chunks from pages, respecting Indic sentence boundaries
 */
export function chunkDocumentPages(
  pages: ExtractedPage[],
  targetChunkChars: number = 800,
  overlapChars: number = 150
): DocumentChunkData[] {
  const chunks: DocumentChunkData[] = [];
  let chunkIndexCounter = 0;

  for (const page of pages) {
    const pageText = page.text.trim();
    if (!pageText) continue;

    const sentences = splitIndicSentences(pageText);
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      if ((currentChunk + ' ' + sentence).length > targetChunkChars && currentChunk.length > 0) {
        chunks.push({
          pageNumber: page.pageNumber,
          chunkIndex: chunkIndexCounter++,
          content: currentChunk.trim(),
        });

        // Compute overlap by taking the last portion of currentChunk
        if (overlapChars > 0 && currentChunk.length > overlapChars) {
          const words = currentChunk.split(/\s+/);
          const overlapWords: string[] = [];
          let curLen = 0;
          for (let w = words.length - 1; w >= 0; w--) {
            overlapWords.unshift(words[w]);
            curLen += words[w].length + 1;
            if (curLen >= overlapChars) break;
          }
          currentChunk = overlapWords.join(' ') + ' ' + sentence;
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        pageNumber: page.pageNumber,
        chunkIndex: chunkIndexCounter++,
        content: currentChunk.trim(),
      });
    }
  }

  return chunks;
}
