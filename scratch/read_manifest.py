import zipfile
import re

aab_path = "native/android/app/build/outputs/bundle/release/app-release.aab"

with zipfile.ZipFile(aab_path, 'r') as zip_ref:
    manifest_data = zip_ref.read("base/manifest/AndroidManifest.xml")
    print("Manifest size:", len(manifest_data))
    
    # Let's find all printable ASCII sequences of length 3 or more
    strings = re.findall(rb'[a-zA-Z0-9_.:/\-]{3,}', manifest_data)
    print("Found strings in manifest:")
    for s in set(strings):
        try:
            print(" -", s.decode('utf-8'))
        except Exception:
            pass
