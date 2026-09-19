import pdfmake from 'pdfmake';

async function testPureNodePdf() {
  console.log('Testing pure Node.js PDF generation with pdfmake (No browser required)...');
  try {
    pdfmake.fonts = {
      Times: {
        normal: 'Times-Roman',
        bold: 'Times-Bold',
        italics: 'Times-Italic',
        bolditalics: 'Times-BoldItalic'
      }
    };
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy(() => true);

    const doc = pdfmake.createPdf({
      defaultStyle: { font: 'Times' },
      content: [{ text: 'SyncBridge Pure Node PDF Test' }]
    });
    const buffer = await doc.getBuffer();
    const isPdf = buffer && buffer.length > 4 && buffer.subarray(0, 4).toString() === '%PDF';
    if (isPdf) {
      console.log('Success! Pure Node PDF generated successfully without browser. Size:', buffer.length, 'bytes');
      return true;
    } else {
      console.error('Buffer is not a valid PDF');
      return false;
    }
  } catch (err) {
    console.error('Failed generating PDF:', err.message);
    return false;
  }
}

async function main() {
  const success = await testPureNodePdf();
  process.exit(success ? 0 : 1);
}

main();
