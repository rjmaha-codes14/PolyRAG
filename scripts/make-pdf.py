def make_pdf(filename, text):
    content = f"BT /F1 18 Tf 50 700 Td ({text}) Tj ET"
    stream_bytes = content.encode('latin1')
    
    obj1 = b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    obj2 = b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    obj3 = b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
    obj4 = b"4 0 obj\n<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>\nendobj\n"
    obj5 = f"5 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode('latin1') + stream_bytes + b"\nendstream\nendobj\n"
    
    header = b"%PDF-1.4\n"
    off1 = len(header)
    off2 = off1 + len(obj1)
    off3 = off2 + len(obj2)
    off4 = off3 + len(obj3)
    off5 = off4 + len(obj4)
    startxref = off5 + len(obj5)
    
    xref = b"xref\r\n0 6\r\n0000000000 65535 f \r\n"
    for off in [off1, off2, off3, off4, off5]:
        xref += f"{off:010d} 00000 n \r\n".encode('latin1')
        
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF\n".encode('latin1')
    
    with open(filename, 'wb') as f:
        f.write(header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer)

make_pdf("sample.pdf", "PolyRAG Document: The capital of Tamil Nadu is Chennai.")
print("Generated sample.pdf")
