import pdfParse from 'pdf-parse';

function createPdf(text) {
  const content = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const streamLen = Buffer.byteLength(content, 'latin1');

  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4 = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const obj5 = `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${content}\nendstream\nendobj\n`;

  const header = `%PDF-1.4\n`;
  const off1 = header.length;
  const off2 = off1 + obj1.length;
  const off3 = off2 + obj2.length;
  const off4 = off3 + obj3.length;
  const off5 = off4 + obj4.length;
  const startxref = off5 + obj5.length;

  const pad = (n) => String(n).padStart(10, '0');
  const xref = `xref\r\n0 6\r\n0000000000 65535 f \r\n${pad(off1)} 00000 n \r\n${pad(off2)} 00000 n \r\n${pad(off3)} 00000 n \r\n${pad(off4)} 00000 n \r\n${pad(off5)} 00000 n \r\n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;

  return Buffer.from(header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer, 'latin1');
}

const pdfBuf = createPdf("PolyRAG Document Intelligence: India has 22 officially recognized languages.");

async function test() {
  const data = await pdfParse(pdfBuf);
  console.log('SUCCESS! Extracted text:', data.text.trim());
}

test();
