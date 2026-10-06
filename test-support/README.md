# PDF fixtures

`pdf-fixture.ts` creates small PDFs with embedded page text for unit and browser tests.

`password-protected.pdf` is a blank page encrypted with the test password `keepall-fixture-password` using pypdf.

`scanned.pdf` contains a JPEG 2000 image of the words "Scanned reference page", generated with Pillow and pypdf. It has no text layer. The offline browser test checks that PDF.js decodes the image using its locally cached assets.

The binary fixtures contain no personal data. Tests read them directly and do not need Python packages installed.
