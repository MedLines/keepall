"""Build a Chrome Web Store ZIP from the unpacked development extension."""

import json
import os
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


extension = Path(__file__).resolve().parents[1] / "extension"
manifest = json.loads((extension / "manifest.json").read_text())
manifest.pop("key", None)  # Chrome assigns the Store item ID; key is for unpacked development.
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(f"/tmp/keepall-capture-{manifest['version']}.zip")
output.parent.mkdir(parents=True, exist_ok=True)
temporary = output.with_suffix(".zip.tmp")
files = sorted(path for path in extension.iterdir() if path.is_file())

with ZipFile(temporary, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        if path.name == "manifest.json":
            archive.writestr(path.name, json.dumps(manifest, indent=2) + "\n")
        else:
            archive.write(path, path.name)

os.replace(temporary, output)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert "key" not in json.loads(archive.read("manifest.json"))
    assert archive.namelist() == [path.name for path in files]
print(output)
