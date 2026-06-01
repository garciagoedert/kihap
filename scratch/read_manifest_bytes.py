import zipfile

aab_path = "native/android/app/build/outputs/bundle/release/app-release.aab"

with zipfile.ZipFile(aab_path, 'r') as zip_ref:
    manifest_data = zip_ref.read("base/manifest/AndroidManifest.xml")
    
    # Let's search for "versionCode" in the manifest_data
    idx = manifest_data.find(b"versionCode")
    if idx != -1:
        print("Found versionCode string at index:", idx)
        # Print surrounding bytes in hex and ascii
        start = max(0, idx - 100)
        end = min(len(manifest_data), idx + 200)
        surrounding = manifest_data[start:end]
        print("Hex dump around versionCode:")
        print(surrounding.hex())
        
        # Let's search for the actual version name "2.8.0" too
        idx_vn = manifest_data.find(b"2.8.0")
        if idx_vn != -1:
            print("Found versionName '2.8.0' at index:", idx_vn)
            print("Hex dump around 2.8.0:")
            print(manifest_data[idx_vn-50:idx_vn+100].hex())
