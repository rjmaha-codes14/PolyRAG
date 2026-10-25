import fs from 'fs';
import pdfParse from 'pdf-parse';

async function test() {
  const buf = fs.readFileSync('sample.pdf');
  const uint8 = new Uint8Array(buf);
  const data = await pdfParse(uint8);
  console.log('SUCCESS! Extracted text:\n', data.text.trim());
}

test();
